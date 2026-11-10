import type { AgentPropertyNode } from "../../parser/ast";
import { getPropertyValue } from "../generators/generateAgent";
import type { IAgentStrategy } from "./agentStrategy";

/**
 * ClaudeCodeStrategy is an implementation of the IAgentStrategy interface for the Claude agent.
 * It provides methods to build command-line arguments and retrieve the binary name for the Claude agent.
 */
export class ClaudeCodeStrategy implements IAgentStrategy {
  buildArgs(props: Map<string, AgentPropertyNode>): string[] {
    const argsStatements: string[] = ['args.push("-p", prompt);'];

  const sysPrompt = getPropertyValue(props.get("system_prompt"));
    const sysPromptFile = getPropertyValue(props.get("system_prompt_file"));
   
    
    if (sysPrompt && sysPromptFile) {
      throw new Error(
        "ValidationError: 'system_prompt' and 'system_prompt_file' are mutually exclusive",
      );
    }

   if (sysPrompt) {
      argsStatements.push(`args.push("--system-prompt", ${JSON.stringify(String(sysPrompt))});`);
    } else if (sysPromptFile) {
      argsStatements.push(`args.push("--system-prompt-file", ${JSON.stringify(String(sysPromptFile))});`);
    }

    return argsStatements;
  }
  getBinaryName(): string {
    return "claude";
  }
}
