import type { z } from "zod";
import type { AgentConfig } from "../../engine/agentConfig";
export interface IAgentStrategy {
  /**
   * Builds the arguments for the agent based on the provided properties.
   * @param agent The agent configuration.
   * @param inputPrompt The input prompt for the agent.
   * @param schema An optional Zod schema to validate the properties against.
   * @returns An array of strings representing the arguments for the agent.
   */
  buildArgs(
    agent: AgentConfig,
    inputPrompt: string,
    schema?: z.ZodTypeAny,
  ): string[];
  /**
   * Gets the binary name for the agent.
   * @returns The binary name as a string.
   */
  getBinaryName(): string;
}
