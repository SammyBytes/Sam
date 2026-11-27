import { isContextLimitError, type AgentError } from "../errors";
import { err, ok, type Result } from "../result";
import type {
  HttpRequestSpec,
  IProviderStrategy,
} from "../strategies/provider/providerStrategy";
import type { ProviderAgentConfig } from "./agents/agentConfig";
import type { ProviderConfig } from "./provider/providerConfig";

const RETRYABLE_STATUS_CODES = new Set([408, 429, 502, 503, 504]);
const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;
// Guardrail: a runaway `retries` value in a flow must not hang the process.
export const MAX_RETRIES = 5;

function redactSecret(text: string, secret?: string): string {
  if (!secret) return text;
  return text.replaceAll(secret, "[REDACTED]");
}

function parseRetryAfterMs(headerValue: string | null): number | null {
  if (!headerValue) return null;

  const seconds = Number(headerValue);
  if (!Number.isNaN(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, MAX_BACKOFF_MS);
  }

  const targetDateMs = Date.parse(headerValue);
  if (!Number.isNaN(targetDateMs)) {
    const delta = targetDateMs - Date.now();
    return delta > 0 ? Math.min(delta, MAX_BACKOFF_MS) : 0;
  }

  return null;
}

function computeBackoffMs(
  attempt: number,
  retryAfterHeader: string | null,
): number {
  const serverDelay = parseRetryAfterMs(retryAfterHeader);
  if (serverDelay !== null) {
    return serverDelay;
  }

  // Exponential backoff + jitter (0..500ms)
  const exponential = Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
  const jitter = Math.floor(Math.random() * 500);
  return Math.min(exponential + jitter, MAX_BACKOFF_MS);
}

export async function providerExecute(
  provider: ProviderConfig,
  agent: ProviderAgentConfig,
  strategy: IProviderStrategy,
  spec: HttpRequestSpec,
  sleepFn: (ms: number) => Promise<void> = (ms) => Bun.sleep(ms),
): Promise<Result<string, AgentError>> {
  const maxRetries = Math.min(
    MAX_RETRIES,
    Math.max(0, Math.floor(agent.retries ?? 0)),
  );

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const signal =
        spec.options?.signal ??
        (agent.timeout ? AbortSignal.timeout(agent.timeout) : undefined);

      const response = await fetch(spec.url, {
        method: "POST",
        headers: spec.headers,
        body: JSON.stringify(spec.body),
        signal: signal,
      });

      if (!response.ok) {
        if (
          RETRYABLE_STATUS_CODES.has(response.status) &&
          attempt < maxRetries
        ) {
          const retryAfter = response.headers.get("retry-after");
          await response.body?.cancel();
          const delayMs = computeBackoffMs(attempt, retryAfter);
          await sleepFn(delayMs);
          continue;
        }

        const errorText = await response.text();

        if (isContextLimitError(response.status, errorText)) {
          return err({
            code: "CONTEXT_LIMIT_ERROR",
            agentName: agent.name,
            providerName: provider.name,
            statusCode: response.status,
            message: redactSecret(
              `Provider '${provider.name}' returned a context limit error (HTTP ${response.status}) for agent '${agent.name}'.${errorText ? ` Details: ${errorText}` : ""}`,
              provider.apiKey,
            ),
            retryable: false,
          });
        }

        return err({
          code: "PROVIDER_HTTP_ERROR",
          agentName: agent.name,
          providerName: provider.name,
          statusCode: response.status,
          message: redactSecret(
            `Provider '${provider.name}' returned HTTP ${response.status} for agent '${agent.name}'.${errorText ? ` Details: ${errorText}` : ""}`,
            provider.apiKey,
          ),
        });
      }

      const json = await response.json();
      const content = strategy.extractContent(json);
      if (!content) {
        return err({
          code: "PROVIDER_HTTP_ERROR",
          agentName: agent.name,
          providerName: provider.name,
          statusCode: response.status,
          message: redactSecret(
            `Provider '${provider.name}' returned an empty or malformed response for agent '${agent.name}'.`,
            provider.apiKey,
          ),
        });
      }

      return ok(content);
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        return err({
          code: "TIMEOUT_ERROR",
          agentName: agent.name,
          timeoutMs: agent.timeout!,
          message: redactSecret(
            `Agent '${agent.name}' exceeded timeout of ${agent.timeout}ms.`,
            provider.apiKey,
          ),
        });
      }

      if (attempt < maxRetries) {
        const delayMs = computeBackoffMs(attempt, null);
        await sleepFn(delayMs);
        continue;
      }

      return err({
        code: "PROVIDER_HTTP_ERROR",
        agentName: agent.name,
        providerName: provider.name,
        message: redactSecret(
          `HTTP request to provider '${provider.name}' failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
          provider.apiKey,
        ),
      });
    }
  }

  return err({
    code: "PROVIDER_HTTP_ERROR",
    agentName: agent.name,
    providerName: provider.name,
    message: redactSecret(
      `Provider '${provider.name}' failed after ${maxRetries + 1} attempts for agent '${agent.name}'.`,
      provider.apiKey,
    ),
  });
}
