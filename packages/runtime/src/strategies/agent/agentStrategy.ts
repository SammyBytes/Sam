import type { z } from "zod";
export interface IAgentStrategy {
  /**
   * Builds the arguments for the agent based on the provided properties.
   * @param props A map of property names to their corresponding AgentPropertyNode.
   * @param schema An optional Zod schema to validate the properties against.
   * @returns An array of strings representing the arguments for the agent.
   */
  buildArgs(props: Map<string, any>, schema?: z.ZodTypeAny): string[];
  /**
   * Gets the binary name for the agent.
   * @returns The binary name as a string.
   */
  getBinaryName(): string;
}
