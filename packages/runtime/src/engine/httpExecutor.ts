import type { AgentError } from "../errors";
import { err, ok, type Result } from "../result";
import type {
  IProviderStrategy,
  HttpRequestSpec,
} from "../strategies/provider/providerStrategy";
import type { ProviderAgentConfig } from "./agents/agentConfig";
import type { ProviderConfig } from "./provider/providerConfig";

export async function providerExecute(
  provider: ProviderConfig,
  agent: ProviderAgentConfig,
  strategy: IProviderStrategy,
  spec: HttpRequestSpec,
): Promise<Result<string, AgentError>> {
  try {
    const response = await fetch(spec.url, {
      method: "POST",
      headers: spec.headers,
      body: JSON.stringify(spec.body),
      signal: agent.timeout ? AbortSignal.timeout(agent.timeout) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return err({
        code: "PROVIDER_HTTP_ERROR",
        agentName: agent.name,
        providerName: provider.name,
        statusCode: response.status,
        message: `Provider '${provider.name}' returned HTTP ${response.status} for agent '${agent.name}'.${errorText ? ` Details: ${errorText}` : ""}`,
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
        message: `Provider '${provider.name}' returned an empty or malformed response for agent '${agent.name}'.`,
      });
    }
    return ok(content);
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return err({
        code: "TIMEOUT_ERROR",
        agentName: agent.name,
        timeoutMs: agent.timeout!,
        message: `Agent '${agent.name}' exceeded timeout of ${agent.timeout}ms.`,
      });
    }

    return err({
      code: "PROVIDER_HTTP_ERROR",
      agentName: agent.name,
      providerName: provider.name,
      message: `HTTP request to provider '${provider.name}' failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    });
  }
}
