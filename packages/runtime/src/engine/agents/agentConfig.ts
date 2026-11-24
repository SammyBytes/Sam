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
  /** Milliseconds. Enforced for every runner (process and HTTP). */
  timeout?: number;
  /** HTTP providers only. The parser rejects it for the `claude` runner. */
  temperature?: number;
  /** HTTP providers only. The parser rejects it for the `claude` runner. */
  maxTokens?: number;
  maxInputChars?: number;
  /** HTTP providers only. The parser rejects it for the `claude` runner. */
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
  maxInputChars?: number;
  retries?: number;
  reasoningEffort?: "low" | "medium" | "high";
};

export type AgentConfig = LocalAgentConfig | ProviderAgentConfig;
