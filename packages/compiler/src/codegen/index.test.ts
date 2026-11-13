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
  expect(output).not.toContain('import { createRuntime } from "@sam-lang/runtime";');
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
      runner: claude_code,
      workspace: "./src",
      timeout: 30
    }
  `;

  const tokens = tokenize(code);
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const output = generateCode(ast);

  expect(output).not.toContain('import { z } from "zod";');
  expect(output).toContain('import { createRuntime } from "@sam-lang/runtime";');
  expect(output).toContain("const sam = createRuntime([");
  expect(output).toContain(
    '{ name: "QuickAuditor", runner: "claude_code", workspace: "./src", timeout: 30000 }',
  );
  expect(output).not.toContain("Bun.spawn");
});

test("should generate combined TypeScript for schemas and agents", () => {
  const code = `
    schema Report {
      status: string
    }

    agent CodeReviewer {
      runner: claude_code,
      workspace: "./src"
    }
  `;

  const tokens = tokenize(code);
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const output = generateCode(ast);

  expect(output).toContain('import { z } from "zod";');
  expect(output).toContain('import { createRuntime } from "@sam-lang/runtime";');
  expect(output).toContain("export const ReportSchema = z.object({");
  expect(output).toContain("const sam = createRuntime([");
  expect(output).toContain(
    '{ name: "CodeReviewer", runner: "claude_code", workspace: "./src" }',
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
      runner: claude_code,
      workspace: "./src"
    }

    agent QuickSummarizer {
      runner: claude_code,
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

  // Imports y estructura base
  expect(output).toContain('import { z } from "zod";');
  expect(output).toContain('import { createRuntime } from "@sam-lang/runtime";');
  expect(output).toContain("export const AuditReportSchema = z.object({");
  expect(output).toContain("const sam = createRuntime([");

  // Firma y cuerpo del flujo
  expect(output).toContain("export async function RunSecurityPipeline(target: string) {");
  expect(output).toContain('  const audit = await sam.use("SecurityAuditor", target, AuditReportSchema);');
  expect(output).toContain("  if (!audit.ok) {");
  expect(output).toContain('    const fallback = await sam.useUnsafe("QuickSummarizer", "fallback summary");');
  expect(output).toContain("    return fallback;");
  expect(output).toContain("  }");
  expect(output).toContain("  return audit.value;");

  // Orden estricto de dependencias en el archivo generado
  expect(output.indexOf("AuditReportSchema")).toBeLessThan(output.indexOf("const sam ="));
  expect(output.indexOf("const sam =")).toBeLessThan(output.indexOf("export async function RunSecurityPipeline"));
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

  expect(output).toContain('import { createRuntime } from "@sam-lang/runtime";');
  expect(output).toContain("const sam = createRuntime([]);");
  expect(output).not.toContain('import { z } from "zod";');
  expect(output).toContain('if (status === "ok") {');
  expect(output).toContain("} else {");
  expect(output).toContain("  if (attempt !== 0) {");
});