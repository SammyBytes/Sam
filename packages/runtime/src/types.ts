export const AgentRunner = {
  OPENCODE: "opencode",
  MOCK: "mock",
} as const;

export type AgentRunnerKind = (typeof AgentRunner)[keyof typeof AgentRunner];

export interface AgentRunnerConfig {
  name: string;
  runner: AgentRunnerKind;
  workspace: string;
  systemPrompt?: string;
  timeout?: number;
}

export const ProviderProtocol = {
  OPENAI: "openai",
  ANTHROPIC: "anthropic",
} as const;

export type ProviderProtocolKind = (typeof ProviderProtocol)[keyof typeof ProviderProtocol];