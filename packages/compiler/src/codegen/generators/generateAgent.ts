import type { AgentNode, AgentPropertyNode } from "../../parser/ast";

export function getPropertyValue(
  prop?: AgentPropertyNode,
): string | number | boolean | undefined {
  if (!prop) return undefined;
  return prop.value.value;
}

export function generateAgent(agentNode: AgentNode): string {
  const props = new Map(agentNode.properties.map((prop) => [prop.name, prop]));

  const runner = getPropertyValue(props.get("runner")) as string | undefined;
  const workspace = getPropertyValue(props.get("workspace")) as
    | string
    | undefined;
  const systemPrompt = getPropertyValue(props.get("system_prompt")) as
    | string
    | undefined;
  const systemPromptFile = getPropertyValue(props.get("system_prompt_file")) as
    | string
    | undefined;
  const timeoutSec = getPropertyValue(props.get("timeout")) as
    | number
    | undefined;

  if (!runner) {
    throw new Error(
      `CodegenError: Missing required property 'runner' in agent '${agentNode.name}'`,
    );
  }

  if (!workspace) {
    throw new Error(
      `CodegenError: Missing required property 'workspace' in agent '${agentNode.name}'`,
    );
  }

  const configFields: string[] = [
    `name: ${JSON.stringify(agentNode.name)}`,
    `runner: ${JSON.stringify(runner)}`,
    `workspace: ${JSON.stringify(workspace)}`,
  ];

  if (systemPrompt !== undefined) {
    configFields.push(`systemPrompt: ${JSON.stringify(systemPrompt)}`);
  }

  if (systemPromptFile !== undefined) {
    configFields.push(`systemPromptFile: ${JSON.stringify(systemPromptFile)}`);
  }

  if (timeoutSec !== undefined) {
    configFields.push(`timeout: ${timeoutSec * 1000}`);
  }

  return `{ ${configFields.join(", ")} }`;
}
