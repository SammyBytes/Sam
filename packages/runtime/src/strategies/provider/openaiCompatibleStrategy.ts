import z from "zod";
import type { ProviderAgentConfig } from "../../engine/agentConfig";
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

    let userContent = inputPrompt;
    if (schema) {
      const jsonSchema = z.toJSONSchema(schema, { target: "openapi-3.0" });
      userContent += [
        "\n\nIMPORTANT: Respond ONLY with a valid raw JSON object matching this schema.",
        "Do not include markdown code fences (```json), explanations, or extra text.",
        `JSON Schema: ${JSON.stringify(jsonSchema)}`,
      ].join("\n");
    }

    messages.push({ role: "user", content: userContent });

    const body: Record<string, unknown> = {
      model: agent.model,
      messages,
    };

    if (agent.temperature !== undefined) {
      body.temperature = agent.temperature;
    }

    if (schema) {
      body.response_format = { type: "json_object" };
    }

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
