import { test, expect } from "bun:test";
import { tokenize } from "../lexer";
import { Parser } from "../parser";
import { generateCode } from "./index";

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
  expect(output).toContain("export const SecurityAuditSchema = z.object({");
  expect(output).toContain("has_vulnerabilities: z.boolean(),");
  expect(output).toContain("risk_level: z.string(),");
  expect(output).toContain(
    "export type SecurityAudit = z.infer<typeof SecurityAuditSchema>;",
  );
});

test("should generate Bun.spawn code for an agent declaration", () => {
  const code = `
    agent QuickAuditor {
      runner: claude_code,
      workspace: "./src",
    }
  `;

  const tokens = tokenize(code);
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const output = generateCode(ast);

  expect(output).not.toContain('import { z } from "zod";');
  expect(output).toContain("export async function runQuickAuditor(");
  expect(output).toContain('const args = ["claude"];');
  expect(output).toContain('cwd: options?.cwd ?? "./src"');
  expect(output).toContain("Bun.spawn(args, {");
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
  expect(output).toContain("export const ReportSchema = z.object({");
  expect(output).toContain("export async function runCodeReviewer(");
});

test("should return an empty string for an empty program", () => {
  const output = generateCode({ type: "Program", body: [] });
  expect(output).toBe("");
});