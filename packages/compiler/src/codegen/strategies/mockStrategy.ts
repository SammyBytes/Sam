import type { AgentPropertyNode } from "../../parser/ast";
import { getPropertyValue } from "../generators/generateAgent";
import type { IAgentStrategy } from "./agentStrategy";

/**
 * MockStrategy is an implementation of the IAgentStrategy interface for testing purposes.
 * It provides methods to build command-line arguments and retrieve the binary name for a mock agent.
 */
export class MockStrategy implements IAgentStrategy {
  buildArgs(props: Map<string, AgentPropertyNode>): string[] {
   return [
      'args.push("-e", `console.log("[MOCK AGENT OUTPUT] Prompt received:", ${JSON.stringify(prompt)}); process.exit(0);`);'
    ];
  }
  getBinaryName(): string {
    return "bun";
  }
}
