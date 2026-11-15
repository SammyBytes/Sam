import z from "zod";
import type { ProviderAgentConfig } from "../../engine/agents/agentConfig";
import type { ProviderConfig } from "../../engine/provider/providerConfig";
import type { HttpRequestSpec, IProviderStrategy } from "./providerStrategy";

export class OpenAICompatibleStrategy implements IProviderStrategy {
  buildRequest(
    provider: ProviderConfig,
    agent: ProviderAgentConfig,
    inputPrompt: string,
    schema?: z.ZodTypeAny,
  ): HttpRequestSpec {
    const normalizedBaseUrl = provider.baseUrl.replace(/\/$/, "");
    const url = `${normalizedBaseUrl}/chat/completions`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (provider.apiKey) {
      headers["Authorization"] = `Bearer ${provider.apiKey}`;
    }

    const messages: Array<{ role: "system" | "user"; content: string }> = [];

    if (agent.systemPrompt) {
      messages.push({ role: "system", content: agent.systemPrompt });
    }

    const useStrictSchema = provider.strictSchema ?? false;
    let userContent = inputPrompt;

    const body: Record<string, unknown> = {
      model: agent.model,
    };

    if (agent.temperature !== undefined) {
      body.temperature = agent.temperature;
    }

    if (agent.maxTokens !== undefined) {
      // `max_tokens` is the field understood by both OpenAI and the widest
      // range of OpenAI-compatible servers (Ollama, LM Studio, Groq, ...).
      body.max_tokens = agent.maxTokens;
    }

    if (schema) {
      const jsonSchema = z.toJSONSchema(schema, {
        target: "openapi-3.0",
      }) as Record<string, unknown>;

      if (useStrictSchema) {
        // If the provider supports strict schema validation, we can include the schema in the request body.
        // This is compatible with OpenAI's API and other providers that support strict schema validation.
        body.response_format = {
          type: "json_schema",
          json_schema: {
            name: "sam_output",
            strict: true,
            schema: toStrictJsonSchema(jsonSchema),
          },
        };
      } else {
        // Fallback compatible with any server (Ollama, LM Studio, etc.)
        body.response_format = { type: "json_object" };
        userContent += [
          "\n\nIMPORTANT: Respond ONLY with a valid raw JSON object matching this schema.",
          "Do not include markdown code fences (```json), explanations, or extra text.",
          `JSON Schema: ${JSON.stringify(jsonSchema)}`,
        ].join("\n");
      }
    }

    messages.push({ role: "user", content: userContent });
    body.messages = messages;

    return {
      url,
      headers,
      body: body,
    };
  }
  extractContent(responseBody: unknown): string | null {
    if (
      !responseBody ||
      typeof responseBody !== "object" ||
      responseBody === null
    ) {
      return null;
    }

    const data = responseBody as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };

    const content = data.choices?.[0]?.message?.content;
    return typeof content === "string" ? content.trim() : null;
  }
}

function toStrictJsonSchema(node: unknown): unknown {
  if (!node || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map(toStrictJsonSchema);

  const record = { ...(node as Record<string, unknown>) };
  delete record.$schema;

  if (
    record.type === "object" &&
    record.properties &&
    typeof record.properties === "object"
  ) {
    record.additionalProperties = false;
    const props = record.properties as Record<string, unknown>;
    const normalizedProps: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(props)) {
      normalizedProps[key] = toStrictJsonSchema(val);
    }
    record.properties = normalizedProps;
    record.required = Object.keys(normalizedProps);
  }

  return record;
}
