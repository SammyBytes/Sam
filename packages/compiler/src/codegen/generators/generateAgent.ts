import type { AgentNode, AgentPropertyNode } from "../../parser/ast";

export function getPropertyValue(
  prop?: AgentPropertyNode,
): string | number | boolean | undefined {
  if (!prop) return undefined;
  return prop.value.value;
}

function formatStringOrEnv(prop: AgentPropertyNode): string {
  if (prop.value.type === "EnvLiteral") {
    const varName = String(prop.value.value);
    if (!/^[A-Z_][A-Z0-9_]*$/i.test(varName)) {
      throw new Error(
        `CodegenError: Invalid environment variable name '${varName}'`,
      );
    }
    return `Bun.env.${varName} ?? ""`;
  }

  return JSON.stringify(prop.value.value);
}

export function generateAgent(agentNode: AgentNode): string {
  const props = new Map(agentNode.properties.map((prop) => [prop.name, prop]));

  const runnerProp = props.get("runner");
  const workspaceProp = props.get("workspace");
  const systemPromptProp = props.get("system_prompt");
  const timeoutSec = getPropertyValue(props.get("timeout")) as
    | number
    | undefined;

  const runner = getPropertyValue(runnerProp) as string | undefined;
  if (!runner) {
    throw new Error(
      `CodegenError: Missing required property 'runner' in agent '${agentNode.name}'`,
    );
  }

  if (!workspaceProp || !workspaceProp.value.value) {
    throw new Error(
      `CodegenError: Missing required property 'workspace' in agent '${agentNode.name}'`,
    );
  }

  const configFields: string[] = [
    `name: ${JSON.stringify(agentNode.name)}`,
    `runner: ${JSON.stringify(runner)}`,
    `workspace: ${formatStringOrEnv(workspaceProp)}`,
  ];

  if (systemPromptProp !== undefined) {
    configFields.push(`systemPrompt: ${formatStringOrEnv(systemPromptProp)}`);
  }

  if (timeoutSec !== undefined) {
    configFields.push(`timeout: ${timeoutSec * 1000}`);
  }

  return `{ ${configFields.join(", ")} }`;
}
