export { createRuntime, type Runtime } from "./engine/agentAction";

export type { AgentConfig } from "./engine/agentConfig";
export type { AgentError } from "./errors";
export type { AgentRunnerKind, AgentRunnerConfig } from "./types";
export { AgentRunner } from "./types";

export * from "./result";

export type { IAgentStrategy } from "./strategies/agent/agentStrategy";

export const VERSION = Bun.env.SAM_VERSION || "0.4.0";
