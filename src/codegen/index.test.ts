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

test("should return an empty string for an empty program", () => {
  const output = generateCode({ type: "Program", body: [] });
  expect(output).toBe("");
});
