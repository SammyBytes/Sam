import type { AgentPropertyNode } from "../../parser/ast";

export interface IAgentStrategy {
  /**
   * Builds the arguments for the agent based on the provided properties.
   * @param props A map of property names to their corresponding AgentPropertyNode.
   * @returns An array of strings representing the arguments for the agent.
   */
  buildArgs(props: Map<string, AgentPropertyNode>): string[];
  /**
   * Gets the binary name for the agent.
   * @returns The binary name as a string.
   */
  getBinaryName(): string;
}
