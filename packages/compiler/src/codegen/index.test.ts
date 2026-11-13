import { test, expect } from "bun:test";
import { generateCode, Parser, tokenize } from "@sam-lang/compiler";

test("should generate TypeScript with Zod schemas from a .sb program", () => {
  const code = `
    schema SecurityAudit {
      has_vulnerabilities: boolean,
      risk_level: string
    }
  `;

  const tokens = tokenize(code);
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const output = generateCode(ast);

  expect(output).toContain('import { z } from "zod";');
  expect(output).not.toContain(
    'import { createRuntime } from "@sam-lang/runtime";',
  );
  expect(output).toContain("export const SecurityAuditSchema = z.object({");
  expect(output).toContain("has_vulnerabilities: z.boolean(),");
  expect(output).toContain("risk_level: z.string(),");
  expect(output).toContain(
    "export type SecurityAudit = z.infer<typeof SecurityAuditSchema>;",
  );
});

test("should generate runtime agent config for an agent declaration", () => {
  const code = `
    agent QuickAuditor {
      runner: opencode,
      workspace: "./src",
      timeout: 30
    }
  `;

  const tokens = tokenize(code);
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const output = generateCode(ast);

  expect(output).not.toContain('import { z } from "zod";');
  expect(output).toContain(
    'import { createRuntime } from "@sam-lang/runtime";',
  );
  expect(output).toContain("const sam = createRuntime([");
  expect(output).toContain(
    '{ name: "QuickAuditor", runner: "opencode", workspace: "./src", timeout: 30000 }',
  );
  expect(output).not.toContain("Bun.spawn");
});

test("should generate combined TypeScript for schemas and agents", () => {
  const code = `
    schema Report {
      status: string
    }

    agent CodeReviewer {
      runner: opencode,
      workspace: "./src"
    }
  `;

  const tokens = tokenize(code);
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const output = generateCode(ast);

  expect(output).toContain('import { z } from "zod";');
  expect(output).toContain(
    'import { createRuntime } from "@sam-lang/runtime";',
  );
  expect(output).toContain("export const ReportSchema = z.object({");
  expect(output).toContain("const sam = createRuntime([");
  expect(output).toContain(
    '{ name: "CodeReviewer", runner: "opencode", workspace: "./src" }',
  );
});

test("should return an empty string for an empty program", () => {
  const output = generateCode({ type: "Program", body: [] });
  expect(output).toBe("");
});

test("should generate async function for a complete program with schema, agent and flow", () => {
  const code = `
    schema AuditReport {
      passed: boolean,
      summary: string
    }

    agent SecurityAuditor {
      runner: opencode,
      workspace: "./src"
    }

    agent QuickSummarizer {
      runner: opencode,
      workspace: "./src"
    }

    flow RunSecurityPipeline(target: string) {
      let audit = use SecurityAuditor<AuditReport>(target)
      if (!audit.ok) {
        let fallback = use unsafe QuickSummarizer("fallback summary")
        return fallback
      }
      return audit.value
    }
  `;

  const tokens = tokenize(code);
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const output = generateCode(ast);

  // Imports and base structure
  expect(output).toContain('import { z } from "zod";');
  expect(output).toContain(
    'import { createRuntime } from "@sam-lang/runtime";',
  );
  expect(output).toContain("export const AuditReportSchema = z.object({");
  expect(output).toContain("const sam = createRuntime([");

  // Flow function signature and body
  expect(output).toContain(
    "export async function RunSecurityPipeline(target: string) {",
  );
  expect(output).toContain(
    '  const audit = await sam.use("SecurityAuditor", target, AuditReportSchema);',
  );
  expect(output).toContain("  if (!audit.ok) {");
  expect(output).toContain(
    '    const fallback = await sam.useUnsafe("QuickSummarizer", "fallback summary");',
  );
  expect(output).toContain("    return fallback;");
  expect(output).toContain("  }");
  expect(output).toContain("  return audit.value;");

  // Order: Schema -> Runtime Initialization -> Flow Function
  expect(output.indexOf("AuditReportSchema")).toBeLessThan(
    output.indexOf("const sam ="),
  );
  expect(output.indexOf("const sam =")).toBeLessThan(
    output.indexOf("export async function RunSecurityPipeline"),
  );
});

test("should omit export keyword for private flows", () => {
  const code = `
    private flow InternalHelper(input: string) {
      return input
    }
  `;

  const tokens = tokenize(code);
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const output = generateCode(ast);

  expect(output).toContain("async function InternalHelper(input: string) {");
  expect(output).not.toContain("export async function InternalHelper");
});
test("should normalize equality operators and generate clean createRuntime([]) when no agents are declared", () => {
  const code = `
    flow CheckStatus(status: string, attempt: number) {
      if (status == "ok") {
        return true
      } else {
        if (attempt != 0) {
          return false
        }
        return true
      }
    }
  `;

  const tokens = tokenize(code);
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const output = generateCode(ast);

  expect(output).toContain(
    'import { createRuntime } from "@sam-lang/runtime";',
  );
  expect(output).toContain("const sam = createRuntime([]);");
  expect(output).not.toContain('import { z } from "zod";');
  expect(output).toContain('if (status === "ok") {');
  expect(output).toContain("} else {");
  expect(output).toContain("  if (attempt !== 0) {");
});

test("should support inter-flow calls, private flows, forward references, and chained property access", () => {
  const code = `
    flow RunReleaseGate(findings: number, target: string) {
      let severity = EvaluateSeverity(findings, 5)
      if (severity == "critical") {
        return "blocked"
      }

      if (FetchApprovalStatus(target).approved) {
        return "released"
      }

      return "pending"
    }

    private flow EvaluateSeverity(findings: number, maxAllowed: number) {
      if (findings > maxAllowed) {
        return "critical"
      }
      return "clean"
    }

    private flow FetchApprovalStatus(target: string) {
      return target
    }
  `;

  const tokens = tokenize(code);
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const output = generateCode(ast);

  expect(output).toContain(
    "export async function RunReleaseGate(findings: number, target: string) {",
  );
  expect(output).toContain(
    "async function EvaluateSeverity(findings: number, maxAllowed: number) {",
  );
  expect(output).not.toContain("export async function EvaluateSeverity");
  expect(output).toContain(
    "async function FetchApprovalStatus(target: string) {",
  );
  expect(output).not.toContain("export async function FetchApprovalStatus");

  // Forward reference: RunReleaseGate call to flows declared below and injects await
  expect(output).toContain(
    "const severity = (await EvaluateSeverity(findings, 5));",
  );

  // About the regex: it matches both `(await FetchApprovalStatus(target)).approved` and `await FetchApprovalStatus(target).approved`
  expect(output).toMatch(
    /if \(\(await FetchApprovalStatus\(target\)\)\.approved|if \(await FetchApprovalStatus\(target\)\.approved/,
  );
});

test("should throw an error on duplicate flow declarations", () => {
  const code = `
    flow ProcessData(x: string) {
      return x
    }

    private flow ProcessData(y: string) {
      return y
    }
  `;

  const tokens = tokenize(code);
  const parser = new Parser(tokens);
  const ast = parser.parse();

  expect(() => generateCode(ast)).toThrow("Duplicate flow name: ProcessData");
});
