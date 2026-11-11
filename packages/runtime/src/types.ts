export const AgentRunnerKind = {
  CLAUDECODE: "claude_code",
  OPENCODE: "opencode",
  MOCK: "mock",
} as const;

export type AgentRunnerKind =
  (typeof AgentRunnerKind)[keyof typeof AgentRunnerKind];

export interface AgentRunnerConfig {
  name: string;
  runner: AgentRunnerKind;
  workspace: string;
  systemPrompt?: string;
  systemPromptFile?: string;
  timeout?: number;
}
