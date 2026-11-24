import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { z } from "zod";
import type { AgentConfig } from "./agents/agentConfig";
import type { ProviderConfig } from "./provider/providerConfig";
import { createRuntime } from "./agentAction";

let server: ReturnType<typeof Bun.serve>;
let baseUrl: string;
let requestCount = 0;

const MOCK_PROVIDER: ProviderConfig = {
  name: "MockProvider",
  protocol: "openai-compatible",
  baseUrl: "",
};

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    async fetch(req) {
      const url = new URL(req.url);

      if (url.pathname !== "/v1/chat/completions") {
        return new Response("Not Found", { status: 404 });
      }

      requestCount += 1;
      await req.json();

      return Response.json({
        choices: [{ message: { content: "ok" } }],
      });
    },
  });

  baseUrl = `http://localhost:${server.port}/v1`;
});

afterAll(() => {
  server.stop(true);
});

function createProviderRuntime(agent: AgentConfig) {
  return createRuntime([agent], [{ ...MOCK_PROVIDER, baseUrl }]);
}

const providerAgent = (
  overrides: Partial<AgentConfig> = {},
): AgentConfig =>
  ({
    name: "LimitedProvider",
    provider: "MockProvider",
    model: "test-model",
    ...overrides,
  }) as AgentConfig;

const localAgent = (overrides: Partial<AgentConfig> = {}): AgentConfig =>
  ({
    name: "LimitedRunner",
    runner: "mock",
    workspace: ".",
    ...overrides,
  }) as AgentConfig;

describe("maxInputChars enforcement", () => {
  test("rejects a provider prompt above max_input_chars without calling the provider", async () => {
    requestCount = 0;
    const runtime = createProviderRuntime(
      providerAgent({ maxInputChars: 5 }),
    );

    const result = await runtime.useUnsafe("LimitedProvider", "123456");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INPUT_TOO_LARGE");
      expect(result.error.agentName).toBe("LimitedProvider");
      expect(result.error.providerName).toBe("MockProvider");
      expect(result.error.runner).toBeUndefined();
      expect(result.error.retryable).toBe(false);
      expect(result.error.message).toContain("6 chars");
      expect(result.error.message).toContain("max_input_chars (5)");
    }
    expect(requestCount).toBe(0);
  });

  test("allows a provider prompt exactly at max_input_chars", async () => {
    requestCount = 0;
    const runtime = createProviderRuntime(
      providerAgent({ maxInputChars: 5 }),
    );

    const result = await runtime.useUnsafe("LimitedProvider", "12345");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe("ok");
    }
    expect(requestCount).toBe(1);
  });

  test("allows a provider prompt below max_input_chars", async () => {
    requestCount = 0;
    const runtime = createProviderRuntime(
      providerAgent({ maxInputChars: 10 }),
    );

    const result = await runtime.useUnsafe("LimitedProvider", "short");

    expect(result.ok).toBe(true);
    expect(requestCount).toBe(1);
  });

  test("rejects a local runner prompt above max_input_chars before spawning", async () => {
    const runtime = createRuntime([
      localAgent({ maxInputChars: 4, workspace: "./does-not-exist" }),
    ]);

    const result = await runtime.useUnsafe("LimitedRunner", "hello");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INPUT_TOO_LARGE");
      expect(result.error.runner).toBe("mock");
      expect(result.error.providerName).toBeUndefined();
      expect(result.error.retryable).toBe(false);
      expect(result.error.message).toContain("5 chars");
      expect(result.error.message).toContain("max_input_chars (4)");
    }
  });

  test("allows a local runner prompt exactly at max_input_chars", async () => {
    const runtime = createRuntime([localAgent({ maxInputChars: 5 })]);

    const result = await runtime.useUnsafe("LimitedRunner", "hello");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe("Mock output for: hello");
    }
  });

  test("does not limit prompts when max_input_chars is not configured", async () => {
    const runtime = createRuntime([localAgent()]);
    // Keep the prompt well above any implicit limit but under the Windows
    // command-line length limit, since the mock runner receives it as an arg.
    const prompt = "x".repeat(5_000);

    const result = await runtime.useUnsafe("LimitedRunner", prompt);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(`Mock output for: ${prompt}`);
    }
  });

  test("enforces max_input_chars for sam.use() as well", async () => {
    const runtime = createRuntime([
      localAgent({ maxInputChars: 3, workspace: "./does-not-exist" }),
    ]);
    const OutcomeSchema = z.object({ value: z.string() });

    const result = await runtime.use(
      "LimitedRunner",
      "toolong",
      OutcomeSchema,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INPUT_TOO_LARGE");
    }
  });

  test("counts only the input prompt, not the system prompt", async () => {
    const runtime = createRuntime([
      localAgent({ maxInputChars: 4, systemPrompt: "y".repeat(10_000) }),
    ]);

    const result = await runtime.useUnsafe("LimitedRunner", "hey");

    expect(result.ok).toBe(true);
  });
});
