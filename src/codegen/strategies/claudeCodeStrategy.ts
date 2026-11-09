import type { AgentPropertyNode } from "../../parser/ast";
import type { IAgentStrategy } from "./agentStrategy";

/**
 * ClaudeCodeStrategy is an implementation of the IAgentStrategy interface for the Claude agent.
 * It provides methods to build command-line arguments and retrieve the binary name for the Claude agent.
 */
export class ClaudeCodeStrategy implements IAgentStrategy {
  buildArgs(props: Map<string, AgentPropertyNode>): string[] {
    const argsStatements: string[] = ['args.push("-p", prompt);'];

    if (props.has("system_prompt")) {
      const val = props.get("system_prompt")?.value;
      argsStatements.push(
        `args.push("--system-prompt", ${JSON.stringify(val)});`,
      );
    } else if (props.has("system_prompt_file")) {
      const val = props.get("system_prompt_file")?.value;
      argsStatements.push(
        `args.push("--system-prompt-file", ${JSON.stringify(val)});`,
      );
    }

    return argsStatements;
  }
  getBinaryName(): string {
    return "claude";
  }
}
