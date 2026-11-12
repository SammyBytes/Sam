import type { AgentRunnerKind } from "../types";

export type AgentConfig = {
  name: string;
  runner: AgentRunnerKind;
  workspace: string;
  systemPrompt?: string;
  timeout?: number;
};
