import type { AgentRunnerKind, ProviderProtocolKind } from "../../types";

export const CLAUDE_PERMISSION_MODES = [
  "default",
  "acceptEdits",
  "plan",
  "auto",
  "dontAsk",
  "bypassPermissions",
  "manual",
] as const;

export type ClaudePermissionMode = (typeof CLAUDE_PERMISSION_MODES)[number];

export type LocalAgentConfig = {
  name: string;
  runner: AgentRunnerKind;
  workspace: string;
  systemPrompt?: string;
  model?: string;
  timeout?: number;
  temperature?: number;
  maxTokens?: number;
  retries?: number;
  reasoningEffort?: "low" | "medium" | "high";
  /** Claude Code `--permission-mode`. */
  permissionMode?: ClaudePermissionMode;
  /** Claude Code `--max-turns`. */
  maxTurns?: number;
  /** Claude Code `--fallback-model`. */
  fallbackModel?: string;
  /** Comma-separated Claude Code `--allowedTools` entries. */
  allowedTools?: string;
  /** Comma-separated Claude Code `--disallowedTools` entries. */
  disallowedTools?: string;
  /** Claude Code `--max-budget-usd`. */
  maxBudgetUsd?: number;
  /** Claude Code `--bare`, which skips project/user config discovery. */
  bare?: boolean;
};

export type ProviderAgentConfig = {
  name: string;
  provider: string;
  model: string;
  systemPrompt?: string;
  timeout?: number;
  temperature?: number;
  maxTokens?: number;
  retries?: number;
  reasoningEffort?: "low" | "medium" | "high";
};

export type AgentConfig = LocalAgentConfig | ProviderAgentConfig;
