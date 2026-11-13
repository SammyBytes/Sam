import { describe, expect, test } from "bun:test";
import { coerceCliArgs, resolveEntryFlow } from "./entry";
import type { FlowNode, ProgramNode } from "./parser/ast";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFlow(
  name: string,
  options: {
    params?: Array<{ name: string; type: string }>;
    isPrivate?: boolean;
  } = {},
): FlowNode {
  return {
    type: "FlowDeclaration",
    name,
    params: options.params ?? [],
    isPrivate: options.isPrivate ?? false,
    body: [],
  };
}

function makeProgram(...flows: FlowNode[]): ProgramNode {
  return { type: "Program", body: flows };
}

// ---------------------------------------------------------------------------
// resolveEntryFlow
// ---------------------------------------------------------------------------

describe("resolveEntryFlow", () => {
  test("prioritizes a public flow named main over other public flows", () => {
    const main = makeFlow("main");
    const program = makeProgram(makeFlow("prepare"), main, makeFlow("publish"));

    expect(resolveEntryFlow(program)).toBe(main);
  });

  test("selects the only public flow when main is absent", () => {
    const single = makeFlow("ReleaseGate");
    const program = makeProgram(
      makeFlow("InternalAudit", { isPrivate: true }),
      single,
    );

    expect(resolveEntryFlow(program)).toBe(single);
  });

  test("rejects multiple public flows when main is absent", () => {
    const program = makeProgram(makeFlow("Audit"), makeFlow("Release"));

    expect(() => resolveEntryFlow(program)).toThrow(
      "Ambiguous entry point: found multiple public flows (Audit, Release).",
    );
  });

  test("rejects a program that only contains private flows", () => {
    const program = makeProgram(
      makeFlow("InternalAudit", { isPrivate: true }),
      makeFlow("InternalRelease", { isPrivate: true }),
    );

    expect(() => resolveEntryFlow(program)).toThrow(
      "No executable public flow found.",
    );
  });

  test("does not treat a private flow named main as the entry point", () => {
    const publicFlow = makeFlow("ReleaseGate");
    const program = makeProgram(
      makeFlow("main", { isPrivate: true }),
      publicFlow,
    );

    expect(resolveEntryFlow(program)).toBe(publicFlow);
  });

  test("allows an explicit --flow override to select a non-main public flow", () => {
    const selected = makeFlow("ReleaseGate");
    const program = makeProgram(makeFlow("main"), selected, makeFlow("Audit"));

    expect(resolveEntryFlow(program, "ReleaseGate")).toBe(selected);
  });

  test("allows an explicit --flow override to select main itself", () => {
    const main = makeFlow("main");
    const program = makeProgram(main, makeFlow("ReleaseGate"));

    expect(resolveEntryFlow(program, "main")).toBe(main);
  });

  test("rejects an explicit --flow that does not exist", () => {
    const program = makeProgram(makeFlow("main"));

    expect(() => resolveEntryFlow(program, "MissingFlow")).toThrow(
      "Public flow 'MissingFlow' not found.",
    );
  });

  test("rejects an explicit --flow that points to a private flow", () => {
    const program = makeProgram(
      makeFlow("main"),
      makeFlow("InternalAudit", { isPrivate: true }),
    );

    expect(() => resolveEntryFlow(program, "InternalAudit")).toThrow(
      "Flow 'InternalAudit' is private and cannot be invoked directly.",
    );
  });
});

// ---------------------------------------------------------------------------
// coerceCliArgs
// ---------------------------------------------------------------------------

describe("coerceCliArgs", () => {
  test("passes string arguments through unchanged", () => {
    const flow = makeFlow("main", {
      params: [{ name: "target", type: "string" }],
    });

    expect(coerceCliArgs(flow, ["feature/release"])).toEqual([
      "feature/release",
    ]);
  });

  test("coerces number arguments", () => {
    const flow = makeFlow("main", {
      params: [
        { name: "retries", type: "number" },
        { name: "threshold", type: "number" },
      ],
    });

    expect(coerceCliArgs(flow, ["3", "2.5"])).toEqual([3, 2.5]);
    expect(coerceCliArgs(flow, ["-1", "0"])).toEqual([-1, 0]);
  });

  test("coerces boolean arguments case-insensitively", () => {
    const flow = makeFlow("main", {
      params: [
        { name: "enabled", type: "boolean" },
        { name: "verbose", type: "boolean" },
      ],
    });

    expect(coerceCliArgs(flow, ["true", "FALSE"])).toEqual([true, false]);
  });

  test("uses non-TTY stdin text for a single string parameter", () => {
    const flow = makeFlow("main", {
      params: [{ name: "input", type: "string" }],
    });

    expect(coerceCliArgs(flow, [], "piped from stdin\n")).toEqual([
      "piped from stdin\n",
    ]);
  });

  test("does not use stdin text when CLI arguments are present", () => {
    const flow = makeFlow("main", {
      params: [{ name: "input", type: "string" }],
    });

    expect(coerceCliArgs(flow, ["explicit"], "piped from stdin")).toEqual([
      "explicit",
    ]);
  });

  test("does not use stdin text for non-string parameters", () => {
    const flow = makeFlow("main", {
      params: [{ name: "count", type: "number" }],
    });

    expect(() => coerceCliArgs(flow, [], "42")).toThrow(
      "Flow 'main' expects 1 argument(s), got 0.",
    );
  });

  test("does not use stdin text when multiple parameters are expected", () => {
    const flow = makeFlow("main", {
      params: [
        { name: "target", type: "string" },
        { name: "force", type: "boolean" },
      ],
    });

    expect(() => coerceCliArgs(flow, [], "main")).toThrow(
      "Flow 'main' expects 2 argument(s), got 0.",
    );
  });

  test("ignores empty stdin text", () => {
    const flow = makeFlow("main", {
      params: [{ name: "input", type: "string" }],
    });

    expect(() => coerceCliArgs(flow, [], "")).toThrow(
      "Flow 'main' expects 1 argument(s), got 0.",
    );
  });

  test("accepts a flow without parameters", () => {
    const flow = makeFlow("main");

    expect(coerceCliArgs(flow, [])).toEqual([]);
  });

  test("rejects too few arguments", () => {
    const flow = makeFlow("main", {
      params: [
        { name: "target", type: "string" },
        { name: "force", type: "boolean" },
      ],
    });

    expect(() => coerceCliArgs(flow, ["main"])).toThrow(
      "Flow 'main' expects 2 argument(s), got 1.",
    );
  });

  test("rejects too many arguments", () => {
    const flow = makeFlow("main", {
      params: [{ name: "target", type: "string" }],
    });

    expect(() => coerceCliArgs(flow, ["main", "extra"])).toThrow(
      "Flow 'main' expects 1 argument(s), got 2.",
    );
  });

  test("rejects invalid number arguments", () => {
    const flow = makeFlow("main", {
      params: [{ name: "retries", type: "number" }],
    });

    expect(() => coerceCliArgs(flow, ["three"])).toThrow(
      'Invalid number for parameter \'retries\': "three".',
    );
  });

  test("rejects invalid boolean arguments", () => {
    const flow = makeFlow("main", {
      params: [{ name: "enabled", type: "boolean" }],
    });

    expect(() => coerceCliArgs(flow, ["yes"])).toThrow(
      'Invalid boolean for parameter \'enabled\': "yes" (expected \'true\' or \'false\').',
    );
  });
});
