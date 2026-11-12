import type { IAgentStrategy } from "@sam-lang/runtime";
import type { z } from "zod";
import { formatSchemaForPrompt } from "./helper";
import type { AgentConfig } from "../../engine/agentConfig";
/**
 * MockStrategy is an implementation of the IAgentStrategy interface for testing purposes.
 * It provides methods to build command-line arguments and retrieve the binary name for a mock agent.
 */
export class MockStrategy implements IAgentStrategy {
  getBinaryName(): string {
    return "bun";
  }

  buildArgs(agent: AgentConfig, inputPrompt: string, schema?: z.ZodTypeAny): string[] {
    const args: string[] = [];
    let systemPrompt = agent.systemPrompt ?? "";

    if (schema) {
      const jsonSchemaString = formatSchemaForPrompt(schema);
      systemPrompt += `\n\n[OUTPUT CONTRACT]\nYou MUST respond with a valid JSON object matching this schema:\n${jsonSchemaString}`;
    }

    if (systemPrompt) {
      args.push("--system-prompt", systemPrompt);
    }

    args.push(inputPrompt);
    return args;
  }
}
