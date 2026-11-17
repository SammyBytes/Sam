import type { AgentNode, AgentPropertyNode } from "../../parser/ast";
import { formatStringOrEnv } from "../helper";
import { loadSystemPromptFile, SystemPromptFileError } from "../systemPromptFile";

export interface GenerateAgentOptions {
  /** Absolute directory of the `.sb` source file, used for `system_prompt_file`. */
  sourceDir?: string;
}

export function getPropertyValue(
  prop?: AgentPropertyNode,
): string | number | boolean | undefined {
  if (!prop) return undefined;
  return prop.value.value;
}

export function generateAgent(
  agentNode: AgentNode,
  options: GenerateAgentOptions = {},
): string {
  const props = new Map(agentNode.properties.map((prop) => [prop.name, prop]));

  const providerProp = props.get("provider");
  const runnerProp = props.get("runner");
  const workspaceProp = props.get("workspace");
  const modelProp = props.get("model");
  const systemPromptProp = props.get("system_prompt");
  const systemPromptFileProp = props.get("system_prompt_file");
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

  // Claude Code runner options. They are only emitted for local runners.
  const permissionMode = getPropertyValue(props.get("permission_mode")) as
    | string
    | undefined;
  const maxTurns = getPropertyValue(props.get("max_turns")) as
    | number
    | undefined;
  const fallbackModelProp = props.get("fallback_model");
  const allowedToolsProp = props.get("allowed_tools");
  const disallowedToolsProp = props.get("disallowed_tools");
  const maxBudgetUsd = getPropertyValue(props.get("max_budget_usd")) as
    | number
    | undefined;
  const bare = getPropertyValue(props.get("bare")) as boolean | undefined;

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

    if (permissionMode !== undefined) {
      configFields.push(`permissionMode: ${JSON.stringify(permissionMode)}`);
    }

    if (maxTurns !== undefined) {
      configFields.push(`maxTurns: ${maxTurns}`);
    }

    if (fallbackModelProp !== undefined) {
      configFields.push(
        `fallbackModel: ${formatStringOrEnv(fallbackModelProp.value)}`,
      );
    }

    if (allowedToolsProp !== undefined) {
      configFields.push(
        `allowedTools: ${formatStringOrEnv(allowedToolsProp.value)}`,
      );
    }

    if (disallowedToolsProp !== undefined) {
      configFields.push(
        `disallowedTools: ${formatStringOrEnv(disallowedToolsProp.value)}`,
      );
    }

    if (maxBudgetUsd !== undefined) {
      configFields.push(`maxBudgetUsd: ${maxBudgetUsd}`);
    }

    if (bare !== undefined) {
      configFields.push(`bare: ${bare}`);
    }
  }

  if (systemPromptProp !== undefined) {
    configFields.push(
      `systemPrompt: ${formatStringOrEnv(systemPromptProp.value)}`,
    );
  } else if (systemPromptFileProp !== undefined) {
    const filePath = getPropertyValue(systemPromptFileProp);
    if (typeof filePath !== "string" || !filePath) {
      throw new SystemPromptFileError(
        `Invalid 'system_prompt_file' in agent '${agentNode.name}'.`,
      );
    }
    if (!options.sourceDir) {
      throw new SystemPromptFileError(
        `Agent '${agentNode.name}' uses 'system_prompt_file', but no source directory was provided to codegen.`,
      );
    }

    const prompt = loadSystemPromptFile(filePath, options.sourceDir);
    configFields.push(`systemPrompt: ${JSON.stringify(prompt)}`);
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
