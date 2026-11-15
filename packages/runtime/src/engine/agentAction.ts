import type z from "zod";
import type { AgentError } from "../errors";
import { Result, err, ok } from "../result";
import type { IAgentStrategy } from "../strategies/agent/agentStrategy";
import { MockStrategy } from "../strategies/agent/mockStrategy";
import { OpenCodeStrategy } from "../strategies/agent/opencodeStrategy";
import type { AgentConfig, LocalAgentConfig } from "./agents/agentConfig";
import { agentExecute } from "./processExecutor";
import type { IProviderStrategy } from "../strategies/provider/providerStrategy";
import { OpenAICompatibleStrategy } from "../strategies/provider/openaiCompatibleStrategy";
import type { ProviderConfig } from "./provider/providerConfig";
import { providerExecute } from "./httpExecutor";

export type Runtime = {
  use: <TSchema>(
    agentName: string,
    inputPrompt: string,
    schema: z.ZodType<TSchema>,
  ) => Promise<Result<TSchema, AgentError>>;
  useUnsafe: (
    agentName: string,
    inputPrompt: string,
  ) => Promise<Result<string, AgentError>>;
};

const strategyRegistry = new Map<string, IAgentStrategy>([
  ["mock", new MockStrategy()],
  ["opencode", new OpenCodeStrategy()],
]);

const providerStrategyRegistry = new Map<string, IProviderStrategy>([
  ["openai-compatible", new OpenAICompatibleStrategy()],
]);

async function executeRunner(
  agent: LocalAgentConfig,
  inputPrompt: string,
  schema?: z.ZodTypeAny,
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

  return agentExecute(agent, binary, args);
}

async function executeAgent(
  agent: AgentConfig,
  providerMap: Map<string, ProviderConfig>,
  inputPrompt: string,
  schema?: z.ZodTypeAny,
): Promise<Result<string, AgentError>> {
  if ("runner" in agent) {
    return executeRunner(agent, inputPrompt, schema);
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

export function createRuntime(
  agents: AgentConfig[],
  providers: ProviderConfig[] = [],
): Runtime {
  const agentMap = new Map(agents.map((a) => [a.name, a]));
  const providerMap = new Map(providers.map((p) => [p.name, p]));

  return {
    async use<TSchema>(
      agentName: string,
      inputPrompt: string,
      schema: z.ZodType<TSchema>,
    ): Promise<Result<TSchema, AgentError>> {
      const agent = agentMap.get(agentName);
      if (!agent) {
        return err({
          code: "AGENT_NOT_FOUND",
          agentName,
          message: `Agent ${agentName} not found.`,
        });
      }

      const result = await executeAgent(
        agent,
        providerMap,
        inputPrompt,
        schema,
      );
      if (!result.ok) {
        return result;
      }

      let parsedJson: unknown;
      try {
        const cleanedData = result.value
          .replace(/^```json\s*|\s*```$/g, "")
          .trim();
        parsedJson = JSON.parse(cleanedData);
      } catch (jsonError) {
        return err({
          code: "PARSE_ERROR",
          agentName,
          rawOutput: result.value,
          message: `Failed to parse JSON output from agent '${agentName}': ${
            jsonError instanceof Error ? jsonError.message : String(jsonError)
          }`,
        });
      }

      const parseResult = await schema.safeParseAsync(parsedJson);
      if (!parseResult.success) {
        return err({
          code: "VALIDATION_ERROR",
          agentName,
          rawOutput: result.value,
          issues: parseResult.error.issues,
          message: `Output from agent '${agentName}' failed schema validation.`,
        });
      }
      return ok(parseResult.data);
    },

    async useUnsafe(
      agentName: string,
      inputPrompt: string,
    ): Promise<Result<string, AgentError>> {
      const agent = agentMap.get(agentName);
      if (!agent) {
        return err({
          code: "AGENT_NOT_FOUND",
          agentName,
          message: `Agent ${agentName} not found.`,
        });
      }

      return executeAgent(agent, providerMap, inputPrompt);
    },
  };
}
