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
