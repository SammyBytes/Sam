import { describe, expect, test } from "bun:test";
import { z } from "zod";
import type { ProviderAgentConfig } from "../../engine/agents/agentConfig";
import type { ProviderConfig } from "../../engine/provider/providerConfig";
import { OpenAICompatibleStrategy } from "./openaiCompatibleStrategy";

const strategy = new OpenAICompatibleStrategy();

const provider: ProviderConfig = {
  name: "TestProvider",
  protocol: "openai-compatible",
  baseUrl: "https://api.example.com/v1/",
  apiKey: "sk-test",
};

const agent: ProviderAgentConfig = {
  name: "Reviewer",
  provider: "TestProvider",
  model: "test-model",
  systemPrompt: "You are a reviewer.",
};

const ReviewSchema = z.object({
  approved: z.boolean(),
  score: z.number(),
});

function bodyOf(
  overrides: {
    provider?: Partial<ProviderConfig>;
    agent?: Partial<ProviderAgentConfig>;
  } = {},
): Record<string, unknown> {
  const spec = strategy.buildRequest(
    { ...provider, ...overrides.provider },
    { ...agent, ...overrides.agent },
    "Review this change",
    ReviewSchema,
  );
  expect(typeof spec.body).toBe("object");
  return spec.body as Record<string, unknown>;
}

describe("OpenAICompatibleStrategy.buildRequest", () => {
  test("sends max_tokens when the agent defines maxTokens", () => {
    const body = bodyOf({ agent: { maxTokens: 512 } });

    expect(body.max_tokens).toBe(512);
    expect(body.max_completion_tokens).toBeUndefined();
  });

  test("omits token limit fields when maxTokens is not configured", () => {
    const body = bodyOf();

    expect(body.max_tokens).toBeUndefined();
    expect(body.max_completion_tokens).toBeUndefined();
  });

  test("sends reasoning_effort when the agent configures it", () => {
    const body = bodyOf({ agent: { reasoningEffort: "low" } });

    expect(body.reasoning_effort).toBe("low");
  });

  test("omits reasoning_effort when the agent does not configure it", () => {
    expect(bodyOf().reasoning_effort).toBeUndefined();
  });

  test("uses json_object plus an inline schema by default", () => {
    const body = bodyOf();
    const messages = body.messages as Array<{ role: string; content: string }>;

    expect(body.response_format).toEqual({ type: "json_object" });
    expect(messages[1]?.content).toContain("Review this change");
    expect(messages[1]?.content).toContain("JSON Schema:");
    expect(messages[1]?.content).toContain('"approved"');
  });

  test("uses strict json_schema when the provider enables strictSchema", () => {
    const body = bodyOf({ provider: { strictSchema: true } });
    const responseFormat = body.response_format as {
      type: string;
      json_schema: { name: string; strict: boolean; schema: unknown };
    };

    expect(responseFormat.type).toBe("json_schema");
    expect(responseFormat.json_schema.name).toBe("sam_output");
    expect(responseFormat.json_schema.strict).toBe(true);
    expect(responseFormat.json_schema.schema).toEqual({
      type: "object",
      properties: {
        approved: { type: "boolean" },
        score: { type: "number" },
      },
      required: ["approved", "score"],
      additionalProperties: false,
    });
  });

  test("does not duplicate the schema in the prompt in strict mode", () => {
    const body = bodyOf({ provider: { strictSchema: true } });
    const messages = body.messages as Array<{ role: string; content: string }>;

    expect(messages[1]?.content).toBe("Review this change");
  });

  test("normalizes nested objects for strict schema providers", () => {
    const nested = z.object({
      meta: z.object({ tag: z.string() }),
      items: z.array(z.object({ id: z.number() })),
    });

    const spec = strategy.buildRequest(
      { ...provider, strictSchema: true },
      agent,
      "Nested",
      nested,
    );
    const schema = (
      spec.body as {
        response_format: { json_schema: { schema: Record<string, unknown> } };
      }
    ).response_format.json_schema.schema as {
      properties: {
        meta: { additionalProperties: boolean; required: string[] };
        items: { items: { additionalProperties: boolean; required: string[] } };
      };
    };

    expect(schema.properties.meta.additionalProperties).toBe(false);
    expect(schema.properties.meta.required).toEqual(["tag"]);
    expect(schema.properties.items.items.additionalProperties).toBe(false);
    expect(schema.properties.items.items.required).toEqual(["id"]);
  });

  test("omits response_format when no schema is required", () => {
    const spec = strategy.buildRequest(
      provider,
      agent,
      "Just answer",
      undefined,
    );

    expect(
      (spec.body as Record<string, unknown>).response_format,
    ).toBeUndefined();
  });

  test("normalizes the base URL and sets authorization", () => {
    const spec = strategy.buildRequest(provider, agent, "Hello", ReviewSchema);

    expect(spec.url).toBe("https://api.example.com/v1/chat/completions");
    expect(spec.headers.Authorization).toBe("Bearer sk-test");
  });
});
