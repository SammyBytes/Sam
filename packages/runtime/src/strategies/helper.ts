import { z } from "zod";

export function formatSchemaForPrompt(schema: z.ZodTypeAny): string {
  const jsonSchemaObj = z.toJSONSchema(schema, {
    target: "openapi-3.0",
  });

  return JSON.stringify(jsonSchemaObj, null, 2);
}

export function formatStringOrEnv(valueNode: { type: string; value: unknown }): string {
  if (valueNode.type === "EnvLiteral") {
    const varName = String(valueNode.value);
    if (!/^[A-Z_][A-Z0-9_]*$/i.test(varName)) {
      throw new Error(`CodegenError: Invalid environment variable name '${varName}'`);
    }
    return `Bun.env.${varName} ?? ""`;
  }

  return JSON.stringify(valueNode.value);
}
