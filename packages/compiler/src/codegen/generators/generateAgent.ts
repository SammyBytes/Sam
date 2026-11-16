import type { AgentNode, AgentPropertyNode } from "../../parser/ast";
import { formatStringOrEnv } from "../helper";

export function getPropertyValue(
  prop?: AgentPropertyNode,
): string | number | boolean | undefined {
  if (!prop) return undefined;
  return prop.value.value;
}

export function generateAgent(agentNode: AgentNode): string {
  const props = new Map(agentNode.properties.map((prop) => [prop.name, prop]));

  const providerProp = props.get("provider");
  const runnerProp = props.get("runner");
  const workspaceProp = props.get("workspace");
  const modelProp = props.get("model");
  const systemPromptProp = props.get("system_prompt");
  const maxTokens = getPropertyValue(props.get("max_tokens")) as
    | number
    | undefined;
  const retries = getPropertyValue(props.get("retries")) as number | undefined;
  const reasoningEffort = getPropertyValue(props.get("reasoning_effort")) as
    | string
    | undefined;
  const temperature = getPropertyValue(props.get("temperature")) as
    | number
    | undefined;
  const timeoutSec = getPropertyValue(props.get("timeout")) as
    | number
    | undefined;

  const configFields: string[] = [`name: ${JSON.stringify(agentNode.name)}`];

  if (providerProp !== undefined) {
    const providerName = getPropertyValue(providerProp) as string | undefined;
    if (!providerName) {
      throw new Error(
        `CodegenError: Missing provider identifier in agent '${agentNode.name}'`,
      );
    }
    if (!modelProp) {
      throw new Error(
        `CodegenError: Missing required property 'model' in agent '${agentNode.name}'`,
      );
    }

    configFields.push(`provider: ${JSON.stringify(providerName)}`);
    configFields.push(`model: ${formatStringOrEnv(modelProp.value)}`);
  } else {
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

    configFields.push(`runner: ${JSON.stringify(runner)}`);
    configFields.push(`workspace: ${formatStringOrEnv(workspaceProp.value)}`);

    if (modelProp !== undefined) {
      configFields.push(`model: ${formatStringOrEnv(modelProp.value)}`);
    }
  }

  if (systemPromptProp !== undefined) {
    configFields.push(
      `systemPrompt: ${formatStringOrEnv(systemPromptProp.value)}`,
    );
  }

  if (temperature !== undefined) {
    configFields.push(`temperature: ${temperature}`);
  }

  if (maxTokens !== undefined) {
    configFields.push(`maxTokens: ${maxTokens}`);
  }

  if (retries !== undefined) {
    configFields.push(`retries: ${retries}`);
  }

  if (reasoningEffort !== undefined) {
    configFields.push(`reasoningEffort: ${JSON.stringify(reasoningEffort)}`);
  }

  if (timeoutSec !== undefined) {
    configFields.push(`timeout: ${timeoutSec * 1000}`);
  }

  return `{ ${configFields.join(", ")} }`;
}
