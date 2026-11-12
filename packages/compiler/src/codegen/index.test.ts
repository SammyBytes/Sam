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