import type { AgentRunnerKind, ProviderProtocolKind } from "../types";

export type LocalAgentConfig = {
  name: string;
  runner: AgentRunnerKind;
  workspace: string;
  systemPrompt?: string;
  model?: string;
  timeout?: number;
};

export type ProviderAgentConfig = {
  name: string;
  provider: string;
  model: string;
  systemPrompt?: string;
  timeout?: number;
  temperature?: number;
  maxTokens?: number;
};

export type AgentConfig = LocalAgentConfig | ProviderAgentConfig;
