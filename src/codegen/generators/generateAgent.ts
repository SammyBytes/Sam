import type { AgentNode, AgentPropertyNode } from "../../parser/ast";
import type { IAgentStrategy } from "../strategies/agentStrategy";
import { ClaudeCodeStrategy } from "../strategies/claudeCodeStrategy";

const STRATEGIES: Record<string, () => IAgentStrategy> = {
  claude_code: () => new ClaudeCodeStrategy(),
};

export function getPropertyValue(prop?: AgentPropertyNode): string | number | boolean | undefined {
  if (!prop) return undefined;
  return prop.value.value;
}

export function generateAgent(agentNode: AgentNode): string {
  const props = new Map(agentNode.properties.map((prop) => [prop.name, prop]));

  const runner = getPropertyValue(props.get("runner")) as string | undefined;
  const workspace = getPropertyValue(props.get("workspace")) as string | undefined;

  const strategy = runner && STRATEGIES[runner];
  if (!strategy) {
    throw new Error(`CodegenError: Unsupported runner '${runner}' in agent '${agentNode.name}'`);
  }

  if (!workspace) {
    throw new Error(`CodegenError: Missing required property 'workspace' in agent '${agentNode.name}'`);
  }

  const agentStrategy = strategy();
  const argsStatements = agentStrategy.buildArgs(props);
  const binaryName = agentStrategy.getBinaryName();

  const timeoutMs = props.has("timeout")
    ? (getPropertyValue(props.get("timeout")) as number) * 1000
    : null;

    return generateAgentFunction(agentNode, binaryName, workspace, argsStatements, timeoutMs);
}

function generateAgentFunction(
  node: AgentNode,
  binary: string,
  workspace: string,
  argStatements: string[],
  timeoutMs: number | null,
): string {
  return `
export async function run${node.name}(prompt: string, options?: { cwd?: string }) {
  const args = [${JSON.stringify(binary)}];

  ${argStatements.join("\n  ")}

  const proc = Bun.spawn(args, {
    cwd: options?.cwd ?? ${JSON.stringify(workspace)},
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  });

  ${timeoutMs ? `const timeout = setTimeout(() => proc.kill(), ${timeoutMs});` : ""}

  const exitCode = await proc.exited;
  ${timeoutMs ? `clearTimeout(timeout);` : ""}

  if (exitCode !== 0) {
    throw new Error(\`Agent '${node.name}' failed with exit code \${exitCode}\`);
  }

  return { success: true, exitCode };
}
`;
}
