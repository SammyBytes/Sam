import { z } from "zod";
import type { IAgentStrategy } from "./agentStrategy";
import type { AgentConfig } from "../../engine/agentConfig";

function generateMockFromSchema(schema: z.ZodTypeAny): unknown {
  const jsonSchema = z.toJSONSchema(schema, { target: "openapi-3.0" }) as {
    type?: string;
    properties?: Record<string, { type?: string }>;
  };

  if (jsonSchema.type === "object" && jsonSchema.properties) {
    const mockObj: Record<string, unknown> = {};

    for (const [key, prop] of Object.entries(jsonSchema.properties)) {
      switch (prop.type) {
        case "boolean":
          mockObj[key] = false;
          break;
        case "number":
        case "integer":
          mockObj[key] = 0;
          break;
        case "array":
          mockObj[key] = [];
          break;
        default:
          mockObj[key] = `mock_${key}`;
          break;
      }
    }

    return mockObj;
  }

  return {};
}

export class MockStrategy implements IAgentStrategy {
  getBinaryName(): string {
    return "bun";
  }

  buildArgs(
    _agent: AgentConfig,
    inputPrompt: string,
    schema?: z.ZodTypeAny,
  ): string[] {
    const payload = schema
      ? JSON.stringify(generateMockFromSchema(schema))
      : `Mock output for: ${inputPrompt}`;

    return ["-e", `console.log(${JSON.stringify(payload)})`];
  }
}