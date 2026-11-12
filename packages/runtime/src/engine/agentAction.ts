import { JSON5 } from "bun";
import type { AgentError } from "../errors";
import { err, ok, type Result } from "../result";
import type { AgentConfig } from "./agentConfig";
import { z } from "zod";
import { MockStrategy } from "../strategies/agent/mockStrategy";

type Runtime = {
  use: <TSchema>(
    agentName: string,
    inputPrompt: string,
    schema: z.ZodType<TSchema>,
  ) => Promise<Result<TSchema, AgentError>>;
};

async function executeRunner(
  agent: AgentConfig,
  inputPrompt: string,
  schema: z.ZodTypeAny,
): Promise<Result<string, AgentError>> {
  switch (agent.runner) {
    case "claude_code":
      // Implement the logic for executing the claude_code runner
      return err({
        code: "EXECUTION_ERROR",
        agentName: agent.name,
        runner: agent.runner,
        exitCode: null,
        stderr: "",
        message: `Execution for runner ${agent.runner} is not implemented yet.`,
      });
    case "opencode":
      // Implement the logic for executing the opencode runner
      return err({
        code: "EXECUTION_ERROR",
        agentName: agent.name,
        runner: agent.runner,
        exitCode: null,
        stderr: "",
        message: `Execution for runner ${agent.runner} is not implemented yet.`,
      });
    case "mock":
      const runner = new MockStrategy();
      const args = runner.buildArgs(
        new Map([["system_prompt", agent.systemPrompt ?? ""]]),
        schema,
      );
      const binaryName = runner.getBinaryName();

      console.log(
        `Executing mock runner with binary: ${binaryName} and args: ${args.join(" ")}`,
      );

      return err({
        code: "EXECUTION_ERROR",
        agentName: agent.name,
        runner: agent.runner,
        exitCode: null,
        stderr: "",
        message: `Execution for runner ${agent.runner} is not implemented yet.`,
      });
    default:
      return err({
        code: "RUNNER_NOT_SUPPORTED",
        agentName: agent.name,
        runner: agent.runner,
        message: `Runner ${agent.runner} is not supported yet.`,
      });
  }
}

export function createRuntime(agents: AgentConfig[]): Runtime {
  const agentMap = new Map<string, AgentConfig>();
  for (const agent of agents) {
    agentMap.set(agent.name, agent);
  }

  if (agentMap.size === 0) {
    return err({
      code: "AGENT_NOT_FOUND",
      agentName: "",
      message: "No agents are configured.",
    }) as unknown as Runtime;
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

      let dataToParse = result.value;
      if (typeof dataToParse !== "string") {
        return err({
          code: "PARSE_ERROR",
          agentName,
          message: `Expected string output from agent ${agentName}, but got ${typeof dataToParse}.`,
        }) as Result<TSchema, AgentError>;
      }

      try {
        const cleanedData = dataToParse
          .replace(/^```json\s*|\s*```$/g, "")
          .trim();

        dataToParse = JSON.parse(cleanedData);
      } catch (jsonError) {
        if (jsonError instanceof SyntaxError) {
          return err({
            code: "JSON_PARSE_ERROR",
            agentName,
            message: `Failed to parse JSON output from agent ${agentName}: ${jsonError.message}`,
          }) as Result<TSchema, AgentError>;
        }

        return err({
          code: "PARSE_ERROR",
          agentName,
          message: `Unexpected error while parsing output from agent ${agentName}: ${jsonError}`,
        }) as Result<TSchema, AgentError>;
      }

      const parseResult = await schema.safeParseAsync(dataToParse);
      if (!parseResult.success) {
        return err({
          code: "PARSE_ERROR",
          agentName,
          message: `Failed to parse result for agent ${agentName}.`,
        }) as Result<TSchema, AgentError>;
      }

      return ok(parseResult.data);
    },
  };
}
