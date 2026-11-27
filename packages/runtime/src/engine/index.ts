import type z from "zod";
import type { AgentError } from "../errors";
import {
  err,
  type Result,
  ok,
  type ParallelResult,
  type WorkerOutcome,
} from "../result";
import type { Runtime } from "../types";
import { executeAgent } from "./agentAction";
import type { AgentConfig } from "./agents/agentConfig";
import { parallelExecute } from "./parallelExecutor";
import type { ProviderConfig } from "./provider/providerConfig";

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
      options?: { signal?: AbortSignal },
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
        options,
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
          message: `Failed to parse JSON output from agent '${agentName}': ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`,
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
      options?: { signal?: AbortSignal },
    ): Promise<Result<string, AgentError>> {
      const agent = agentMap.get(agentName);
      if (!agent) {
        return err({
          code: "AGENT_NOT_FOUND",
          agentName,
          message: `Agent ${agentName} not found.`,
        });
      }

      return executeAgent(agent, providerMap, inputPrompt, undefined, options);
    },

    mapParallel: function <TInput, TOutput>(
      iterable: Iterable<TInput>,
      options: { parallel: number; ordered?: boolean; signal?: AbortSignal },
      workerFn: (
        item: TInput,
        signal: AbortSignal,
      ) => Promise<WorkerOutcome<TOutput>>,
    ): Promise<ParallelResult<TOutput>> {
      return parallelExecute(iterable, options, workerFn);
    },
  };
}
