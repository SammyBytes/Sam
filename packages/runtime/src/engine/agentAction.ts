import type z from "zod";
import type { AgentError } from "../errors";
import { err, ok } from "../result";
import type { Result } from "../result";
import type { IAgentStrategy } from "../strategies/agent/agentStrategy";
import { ClaudeStrategy } from "../strategies/agent/claudeStrategy";
import { MockStrategy } from "../strategies/agent/mockStrategy";
import { OpenCodeStrategy } from "../strategies/agent/opencodeStrategy";
import type { AgentConfig, LocalAgentConfig } from "./agents/agentConfig";
import { agentExecute } from "./processExecutor";
import type { IProviderStrategy } from "../strategies/provider/providerStrategy";
import { OpenAICompatibleStrategy } from "../strategies/provider/openaiCompatibleStrategy";
import type { ProviderConfig } from "./provider/providerConfig";
import { providerExecute } from "./httpExecutor";
import type { Runtime } from "../types";

const strategyRegistry = new Map<string, IAgentStrategy>([
  ["mock", new MockStrategy()],
  ["opencode", new OpenCodeStrategy()],
  ["claude", new ClaudeStrategy()],
]);

const providerStrategyRegistry = new Map<string, IProviderStrategy>([
  ["openai-compatible", new OpenAICompatibleStrategy()],
]);

export async function executeRunner(
  agent: LocalAgentConfig,
  inputPrompt: string,
  schema?: z.ZodTypeAny,
  options?: { signal?: AbortSignal },
): Promise<Result<string, AgentError>> {
  const strategy = strategyRegistry.get(agent.runner);
  if (!strategy) {
    return err({
      code: "RUNNER_NOT_SUPPORTED",
      agentName: agent.name,
      runner: agent.runner,
      message: `Runner '${agent.runner}' is not supported.`,
    });
  }

  const binary = strategy.getBinaryName();
  const args = strategy.buildArgs(agent, inputPrompt, schema);
  const result = await agentExecute(agent, binary, args, options);

  if (!result.ok || !strategy.extractOutput) {
    return result;
  }

  try {
    return ok(strategy.extractOutput(result.value));
  } catch (error) {
    return err({
      code: "EXECUTION_ERROR",
      agentName: agent.name,
      runner: agent.runner,
      exitCode: 0,
      stderr: error instanceof Error ? error.message : String(error),
      message: `Agent '${agent.name}' produced an invalid runner response.`,
    });
  }
}

export async function executeAgent(
  agent: AgentConfig,
  providerMap: Map<string, ProviderConfig>,
  inputPrompt: string,
  schema?: z.ZodTypeAny,
  options?: { signal?: AbortSignal },
): Promise<Result<string, AgentError>> {
  if (
    agent.maxInputChars !== undefined &&
    inputPrompt.length > agent.maxInputChars
  ) {
    return err({
      code: "INPUT_TOO_LARGE",
      agentName: agent.name,
      runner: "runner" in agent ? agent.runner : undefined,
      providerName: "provider" in agent ? agent.provider : undefined,
      message: `Input prompt length (${inputPrompt.length} chars) exceeds max_input_chars (${agent.maxInputChars}) for agent '${agent.name}'.`,
      retryable: false,
    });
  }

  if ("runner" in agent) {
    return executeRunner(agent, inputPrompt, schema, options);
  }

  const provider = providerMap.get(agent.provider);
  if (!provider) {
    return err({
      code: "PROVIDER_NOT_FOUND",
      agentName: agent.name,
      providerName: agent.provider,
      message: `Provider '${agent.provider}' referenced by agent '${agent.name}' was not found.`,
    });
  }

  const strategy = providerStrategyRegistry.get(provider.protocol);
  if (!strategy) {
    return err({
      code: "PROVIDER_NOT_SUPPORTED",
      agentName: agent.name,
      protocol: provider.protocol,
      message: `Protocol '${provider.protocol}' is not supported.`,
    });
  }

  const spec = strategy.buildRequest(provider, agent, inputPrompt, schema);
  return providerExecute(provider, agent, strategy, spec);
}
