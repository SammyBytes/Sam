import type { AgentError } from "../errors";
import { err, ok, type Result } from "../result";
import type { AgentConfig } from "./agentConfig";
import { z } from "zod";
import { MockStrategy } from "../strategies/agent/mockStrategy";
import type { IAgentStrategy } from "../strategies/agent/agentStrategy";
import { agentExecute } from "./processExecutor";

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
  // ["claude_code", new ClaudeCodeStrategy()],
  // ["opencode", new OpenCodeStrategy()],
]);

async function executeRunner(
  agent: AgentConfig,
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

export function createRuntime(agents: AgentConfig[]): Runtime {
  const agentMap = new Map<string, AgentConfig>();
  for (const agent of agents) {
    agentMap.set(agent.name, agent);
  }

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

      const result = await executeRunner(agent, inputPrompt, schema);
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

      return executeRunner(agent, inputPrompt);
    },
  };
}
