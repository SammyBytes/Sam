import { z } from "zod";
import type { IAgentStrategy } from "./agentStrategy";
import type { AgentConfig } from "../../engine/agents/agentConfig";

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Runs an agent with the Claude Code CLI in non-interactive print mode.
 *
 * The prompt is passed as a positional argument and the optional system prompt
 * is appended to Claude Code's built-in system prompt, so tool guidance and
 * safety instructions stay intact. When a schema is present, Sam asks Claude
 * Code for structured output and extracts the validated object from the JSON
 * result envelope.
 */
export class ClaudeStrategy implements IAgentStrategy {
  getBinaryName(): string {
    return "claude";
  }

  buildArgs(
    agent: AgentConfig,
    inputPrompt: string,
    schema?: z.ZodTypeAny,
  ): string[] {
    const args = ["-p"];

    if (agent.model) {
      args.push("--model", agent.model);
    }

    if (agent.systemPrompt) {
      args.push("--append-system-prompt", agent.systemPrompt);
    }

    if (agent.reasoningEffort) {
      args.push("--effort", agent.reasoningEffort);
    }

    if ("permissionMode" in agent && agent.permissionMode) {
      args.push("--permission-mode", agent.permissionMode);
    }

    if ("maxTurns" in agent && agent.maxTurns !== undefined) {
      args.push("--max-turns", String(agent.maxTurns));
    }

    if ("fallbackModel" in agent && agent.fallbackModel) {
      args.push("--fallback-model", agent.fallbackModel);
    }

    if ("allowedTools" in agent && agent.allowedTools) {
      for (const tool of splitList(agent.allowedTools)) {
        args.push("--allowedTools", tool);
      }
    }

    if ("disallowedTools" in agent && agent.disallowedTools) {
      for (const tool of splitList(agent.disallowedTools)) {
        args.push("--disallowedTools", tool);
      }
    }

    if ("maxBudgetUsd" in agent && agent.maxBudgetUsd !== undefined) {
      args.push("--max-budget-usd", String(agent.maxBudgetUsd));
    }

    if ("bare" in agent && agent.bare) {
      args.push("--bare");
    }

    // Sam never resumes sessions, so do not leave transcripts behind.
    args.push("--no-session-persistence");

    if (schema) {
      const jsonSchema = z.toJSONSchema(schema, { target: "draft-7" });
      args.push(
        "--output-format",
        "json",
        "--json-schema",
        JSON.stringify(jsonSchema),
      );
    }

    args.push(inputPrompt);
    return args;
  }

  extractOutput(rawStdout: string): string {
    const trimmed = rawStdout.trim();
    if (!trimmed) return trimmed;

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return trimmed;
    }

    if (!parsed || typeof parsed !== "object") return trimmed;

    const envelope = parsed as Record<string, unknown>;

    if (envelope.structured_output !== undefined) {
      return JSON.stringify(envelope.structured_output);
    }

    if (typeof envelope.result === "string") {
      if (envelope.is_error === true) {
        throw new Error(`Claude Code reported an error: ${envelope.result}`);
      }
      return envelope.result.trim();
    }

    return trimmed;
  }
}
