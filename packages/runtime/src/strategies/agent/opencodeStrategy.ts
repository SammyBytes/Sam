import { z } from "zod";
import type { IAgentStrategy } from "./agentStrategy";
import type { AgentConfig } from "../../engine/agentConfig";

export class OpenCodeStrategy implements IAgentStrategy {
  getBinaryName(): string {
    return "opencode";
  }

  buildArgs(
    agent: AgentConfig,
    inputPrompt: string,
    schema?: z.ZodTypeAny,
  ): string[] {
    const promptParts: string[] = [];

    if (agent.systemPrompt) {
      promptParts.push(`System instructions:\n${agent.systemPrompt}`);
    }

    promptParts.push(inputPrompt);

    if (schema) {
      const jsonSchema = z.toJSONSchema(schema, { target: "openapi-3.0" });
      promptParts.push(
        [
          "IMPORTANT: Respond ONLY with a valid raw JSON object matching this schema.",
          "Do not include markdown code fences (```json), explanations, or extra text.",
          `JSON Schema: ${JSON.stringify(jsonSchema)}`,
        ].join("\n"),
      );
    }

    return ["run", promptParts.join("\n\n")];
  }
}