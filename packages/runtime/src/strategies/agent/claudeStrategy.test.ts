import { describe, expect, test } from "bun:test";
import { z } from "zod";
import type { LocalAgentConfig } from "../../engine/agents/agentConfig";
import { ClaudeStrategy } from "./claudeStrategy";

const strategy = new ClaudeStrategy();

const agent: LocalAgentConfig = {
  name: "ClaudeReviewer",
  runner: "claude",
  workspace: ".",
  model: "sonnet",
};

const ReviewSchema = z.object({
  approved: z.boolean(),
  risk_level: z.string(),
});

function argsFor(
  overrides: Partial<LocalAgentConfig> = {},
  schema?: z.ZodTypeAny,
): string[] {
  return strategy.buildArgs(
    { ...agent, ...overrides },
    "Review this change",
    schema,
  );
}

describe("ClaudeStrategy", () => {
  test("uses the claude binary", () => {
    expect(strategy.getBinaryName()).toBe("claude");
  });

  test("runs in print mode with the model and without persisted sessions", () => {
    const args = argsFor();

    expect(args.slice(0, 4)).toEqual(["-p", "--model", "sonnet", "--no-session-persistence"]);
    expect(args.at(-1)).toBe("Review this change");
    expect(args[args.indexOf("--output-format") + 1]).toBe("json");
    expect(args).not.toContain("--json-schema");
  });

  test("appends the system prompt and maps reasoning effort", () => {
    const args = argsFor({
      systemPrompt: "Be terse.",
      reasoningEffort: "high",
    });

    expect(args).toContain("--append-system-prompt");
    expect(args[args.indexOf("--append-system-prompt") + 1]).toBe("Be terse.");
    expect(args[args.indexOf("--effort") + 1]).toBe("high");
  });

  test("maps permission, turn, model fallback, tools, budget, and bare options", () => {
    const args = argsFor({
      permissionMode: "acceptEdits",
      maxTurns: 4,
      fallbackModel: "haiku",
      allowedTools: "Read, Grep",
      disallowedTools: "Bash, Edit",
      maxBudgetUsd: 2.5,
      bare: true,
    });

    expect(args[args.indexOf("--permission-mode") + 1]).toBe("acceptEdits");
    expect(args[args.indexOf("--max-turns") + 1]).toBe("4");
    expect(args[args.indexOf("--fallback-model") + 1]).toBe("haiku");
    expect(
      args.flatMap((arg, index) =>
        arg === "--allowedTools" ? [args[index + 1]] : [],
      ),
    ).toEqual(["Read", "Grep"]);
    expect(
      args.flatMap((arg, index) =>
        arg === "--disallowedTools" ? [args[index + 1]] : [],
      ),
    ).toEqual(["Bash", "Edit"]);
    expect(args[args.indexOf("--max-budget-usd") + 1]).toBe("2.5");
    expect(args).toContain("--bare");
  });

  test("requests structured output when a schema is provided", () => {
    const args = argsFor({}, ReviewSchema);

    expect(args[args.indexOf("--output-format") + 1]).toBe("json");
    const schemaArg = args[args.indexOf("--json-schema") + 1];
    expect(schemaArg).toBeDefined();

    const jsonSchema = JSON.parse(schemaArg!) as {
      type: string;
      properties: Record<string, unknown>;
      required: string[];
    };

    expect(jsonSchema.type).toBe("object");
    expect(jsonSchema.properties).toHaveProperty("approved");
    expect(jsonSchema.properties).toHaveProperty("risk_level");
    expect(jsonSchema.required).toEqual(["approved", "risk_level"]);
  });
});

describe("ClaudeStrategy.extractOutput", () => {
  test("returns structured_output as JSON", () => {
    const output = strategy.extractOutput(
      JSON.stringify({
        type: "result",
        subtype: "success",
        is_error: false,
        structured_output: { approved: true, risk_level: "low" },
      }),
    );

    expect(JSON.parse(output)).toEqual({
      approved: true,
      risk_level: "low",
    });
  });

  test("returns the result text for non-structured runs", () => {
    const output = strategy.extractOutput(
      JSON.stringify({
        type: "result",
        subtype: "success",
        is_error: false,
        result: "plain answer",
      }),
    );

    expect(output).toBe("plain answer");
  });

  test("passes plain text through unchanged", () => {
    expect(strategy.extractOutput("plain text output")).toBe(
      "plain text output",
    );
  });

  test("does not treat a JSON-looking model reply as an envelope", () => {
    expect(strategy.extractOutput('{"result":"hola"}')).toBe(
      '{"result":"hola"}',
    );
    expect(
      strategy.extractOutput('{"result":"cuenta","is_error":true}'),
    ).toBe('{"result":"cuenta","is_error":true}');
  });

  test("throws when Claude Code reports an error result", () => {
    expect(() =>
      strategy.extractOutput(
        JSON.stringify({
          type: "result",
          subtype: "error_during_execution",
          is_error: true,
          result: "provider rejected the request",
        }),
      ),
    ).toThrow(/provider rejected the request/);
  });
});
