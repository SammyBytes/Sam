import type { ParallelResult, Result, WorkerOutcome } from "./result";
import type { AgentError } from "./errors";
import type { z } from "zod";

export type Runtime = {
  use: <TSchema>(
    agentName: string,
    inputPrompt: string,
    schema: z.ZodType<TSchema>,
    options?: { signal?: AbortSignal },
  ) => Promise<Result<TSchema, AgentError>>;
  useUnsafe: (
    agentName: string,
    inputPrompt: string,
    options?: { signal?: AbortSignal },
  ) => Promise<Result<string, AgentError>>;

  mapParallel: <TInput, TOutput>(
    iterable: Iterable<TInput>,
    options: { parallel: number; ordered?: boolean; signal?: AbortSignal },
    workerFn: (
      item: TInput,
      signal: AbortSignal,
    ) => Promise<WorkerOutcome<TOutput>>,
  ) => Promise<ParallelResult<TOutput>>;
};

export const AgentRunner = {
  OPENCODE: "opencode",
  CLAUDE: "claude",
  MOCK: "mock",
} as const;

export type AgentRunnerKind = (typeof AgentRunner)[keyof typeof AgentRunner];

export const ProviderProtocol = {
  OPENAI: "openai-compatible",
  ANTHROPIC: "anthropic",
} as const;

export type ProviderProtocolKind =
  (typeof ProviderProtocol)[keyof typeof ProviderProtocol];
