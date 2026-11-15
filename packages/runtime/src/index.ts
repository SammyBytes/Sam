export * from "./engine/agentAction";

export * from "./engine/agents/agentConfig";
export * from "./errors";
export * from "./types";

export * from "./result";

export type { IAgentStrategy } from "./strategies/agent/agentStrategy";

export const VERSION = Bun.env.SAM_VERSION || "0.5.0-rc.1";
