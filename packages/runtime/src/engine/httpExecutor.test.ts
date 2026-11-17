import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { ProviderAgentConfig } from "./agents/agentConfig";
import { MAX_RETRIES, providerExecute } from "./httpExecutor";
import type { ProviderConfig } from "./provider/providerConfig";
import { OpenAICompatibleStrategy } from "../strategies/provider/openaiCompatibleStrategy";

const strategy = new OpenAICompatibleStrategy();

let server: ReturnType<typeof Bun.serve>;
let baseUrl: string;
const requestCounts = new Map<string, number>();

const provider: ProviderConfig = {
  name: "RetryProvider",
  protocol: "openai-compatible",
  baseUrl: "",
  apiKey: "sk-test",
};

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    async fetch(req) {
      const url = new URL(req.url);
      if (url.pathname !== "/v1/chat/completions") {
        return new Response("Not Found", { status: 404 });
      }

      const body = (await req.json()) as { model?: string };
      const model = body.model ?? "unknown";
      const count = (requestCounts.get(model) ?? 0) + 1;
      requestCounts.set(model, count);

      const reply = () =>
        Response.json({ choices: [{ message: { content: "recovered" } }] });

      switch (model) {
        case "retry-429":
          return count === 1
            ? new Response("rate limited", {
                status: 429,
                headers: { "Retry-After": "0" },
              })
            : reply();
        case "retry-429-after-1s":
          return count === 1
            ? new Response("rate limited", {
                status: 429,
                headers: { "Retry-After": "1" },
              })
            : reply();
        case "retry-503":
          return count === 1
            ? new Response("unavailable", { status: 503 })
            : reply();
        case "always-429":
          return new Response("rate limited", {
            status: 429,
            headers: { "Retry-After": "0" },
          });
        case "bad-request":
          return new Response("invalid schema", { status: 400 });
        case "leaky-key":
          return new Response("invalid key: sk-test", { status: 401 });
        case "slow":
          await Bun.sleep(150);
          return reply();
        default:
          return reply();
      }
    },
  });

  baseUrl = `http://localhost:${server.port}/v1`;
});

afterAll(() => {
  server.stop(true);
});

beforeEach(() => {
  requestCounts.clear();
});

function countFor(model: string): number {
  return requestCounts.get(model) ?? 0;
}

function run(
  model: string,
  options: {
    retries?: number;
    timeout?: number;
    baseUrlOverride?: string;
    apiKeyOverride?: string;
  } = {},
) {
  const agent: ProviderAgentConfig = {
    name: `Agent-${model}`,
    provider: provider.name,
    model,
    retries: options.retries,
    timeout: options.timeout,
  };

  const delays: number[] = [];
  const sleeper = async (ms: number) => {
    delays.push(ms);
  };

  const resolvedProvider = {
    ...provider,
    baseUrl: options.baseUrlOverride ?? baseUrl,
    apiKey: options.apiKeyOverride ?? provider.apiKey,
  };

  return {
    delays,
    result: providerExecute(
      resolvedProvider,
      agent,
      strategy,
      strategy.buildRequest(resolvedProvider, agent, "ping"),
      sleeper,
    ),
  };
}

describe("providerExecute retries", () => {
  test("retries a 429 and returns the next successful response", async () => {
    const { result, delays } = run("retry-429", { retries: 2 });
    const outcome = await result;

    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.value).toBe("recovered");
    expect(countFor("retry-429")).toBe(2);
    expect(delays).toEqual([0]);
  });

  test("honors the Retry-After header in seconds", async () => {
    const { result, delays } = run("retry-429-after-1s", { retries: 1 });
    const outcome = await result;

    expect(outcome.ok).toBe(true);
    expect(delays).toEqual([1_000]);
  });

  test("retries a 503 service unavailable", async () => {
    const { result, delays } = run("retry-503", { retries: 1 });
    const outcome = await result;

    expect(outcome.ok).toBe(true);
    expect(countFor("retry-503")).toBe(2);
    expect(delays).toHaveLength(1);
  });

  test("does not retry when retries is not configured", async () => {
    const { result, delays } = run("always-429");
    const outcome = await result;

    expect(outcome.ok).toBe(false);
    if (!outcome.ok && outcome.error.code === "PROVIDER_HTTP_ERROR") {
      expect(outcome.error.statusCode).toBe(429);
    }
    expect(countFor("always-429")).toBe(1);
    expect(delays).toHaveLength(0);
  });

  test("does not retry non-retryable client errors", async () => {
    const { result, delays } = run("bad-request", { retries: 3 });
    const outcome = await result;

    expect(outcome.ok).toBe(false);
    if (!outcome.ok && outcome.error.code === "PROVIDER_HTTP_ERROR") {
      expect(outcome.error.statusCode).toBe(400);
    }
    expect(countFor("bad-request")).toBe(1);
    expect(delays).toHaveLength(0);
  });

  test("redacts the provider api key from HTTP error bodies", async () => {
    const { result } = run("leaky-key");
    const outcome = await result;

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error.code).toBe("PROVIDER_HTTP_ERROR");
      expect(outcome.error.message).not.toContain("sk-test");
      expect(outcome.error.message).toContain("[REDACTED]");
    }
  });

  test("does not alter messages when the api key is empty", async () => {
    const { result } = run("leaky-key", { apiKeyOverride: "" });
    const outcome = await result;

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error.code).toBe("PROVIDER_HTTP_ERROR");
      // An empty secret must not be treated as a pattern to redact: doing so
      // would inject "[REDACTED]" between every character of the message.
      expect(outcome.error.message).not.toContain("[REDACTED]");
      expect(outcome.error.message).toContain("invalid key: sk-test");
    }
  });

  test("returns an error once all retries are exhausted", async () => {
    const { result, delays } = run("always-429", { retries: 2 });
    const outcome = await result;

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error.code).toBe("PROVIDER_HTTP_ERROR");
      expect(outcome.error.message).toContain("HTTP 429");
    }
    expect(countFor("always-429")).toBe(3);
    expect(delays).toHaveLength(2);
  });

  test("caps retries at MAX_RETRIES to protect the process", async () => {
    const { result } = run("always-429", { retries: 100 });
    const outcome = await result;

    expect(outcome.ok).toBe(false);
    expect(countFor("always-429")).toBe(MAX_RETRIES + 1);
  });

  test("does not retry timeouts", async () => {
    const { result, delays } = run("slow", { retries: 3, timeout: 20 });
    const outcome = await result;

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.code).toBe("TIMEOUT_ERROR");
    expect(countFor("slow")).toBe(1);
    expect(delays).toHaveLength(0);
  });

  test("retries transport failures", async () => {
    const { result, delays } = run("unreachable", {
      retries: 1,
      baseUrlOverride: "http://127.0.0.1:1/v1",
    });
    const outcome = await result;

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.code).toBe("PROVIDER_HTTP_ERROR");
    expect(delays).toHaveLength(1);
  });
});
