export const AgentRunnerKid = {
  CLAUDECODE: Symbol.for("claude_code"),
  OPENCODE: Symbol.for("open_code"),
  MOCK: Symbol.for("mock"),
} as const;

export type AgentRunnerKid =
  (typeof AgentRunnerKid)[keyof typeof AgentRunnerKid];

export interface AgentRunnerConfig {
  name: string;
  runner: AgentRunnerKid;
  workspace: string;
  systemPrompt?: string;
  systemPromptFile?: string;
  timeout?: number;
}
