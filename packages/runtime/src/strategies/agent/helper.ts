import { z } from "zod";

export function formatSchemaForPrompt(schema: z.ZodTypeAny): string {
  const jsonSchemaObj = z.toJSONSchema(schema, {
    target: "openapi-3.0",
  });

  return JSON.stringify(jsonSchemaObj, null, 2);
}
