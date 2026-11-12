import type { IAgentStrategy } from "@sam-lang/runtime";
import type { z } from "zod";
import { formatSchemaForPrompt } from "./helper";
/**
 * MockStrategy is an implementation of the IAgentStrategy interface for testing purposes.
 * It provides methods to build command-line arguments and retrieve the binary name for a mock agent.
 */
export class MockStrategy implements IAgentStrategy {
  buildArgs(props: Map<string, any>, schema?: z.ZodTypeAny): string[] {
    const args: string[] = [];

    let systemPrompt =
      props.get("system_prompt") ?? props.get("system_prompt_file") ?? "";

    if (schema) {
      const jsonSchemaString = formatSchemaForPrompt(schema);

      const schemaDirective = `\n\n[OUTPUT CONTRACT]\nYou MUST respond with a valid JSON object matching this schema:\n${jsonSchemaString}`;

      systemPrompt += schemaDirective;
    }

    if (systemPrompt) {
      args.push("--system-prompt", systemPrompt);
    }
    return args.map((arg) => `args.push(${JSON.stringify(arg)});`);
  }
  getBinaryName(): string {
    return "bun";
  }
}
