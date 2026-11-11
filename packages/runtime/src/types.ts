export const AgentRunner = {
  CLAUDECODE: "claude_code",
  OPENCODE: "opencode",
  MOCK: "mock",
} as const;

export type AgentRunnerKind =
  (typeof AgentRunner)[keyof typeof AgentRunner];

export interface AgentRunnerConfig {
  name: string;
  runner: AgentRunnerKind;
  workspace: string;
  systemPrompt?: string;
  systemPromptFile?: string;
  timeout?: number;
}
