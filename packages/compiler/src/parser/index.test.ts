import { test, expect } from "bun:test";
import { Parser, tokenize } from "@sam-lang/compiler";

test("should build a valid AST from a schema block", () => {
  const code = `
    schema SecurityAudit {
      has_vulnerabilities: boolean,
      risk_level: string
    }
  `;

  const tokens = tokenize(code);
  const parser = new Parser(tokens);
  const ast = parser.parse();

  expect(ast.type).toBe("Program");
  expect(ast.body.length).toBe(1);

  const schema = ast.body[0];
  expect(schema.type).toBe("SchemaDeclaration");

  if (schema.type === "SchemaDeclaration") {
    expect(schema.name).toBe("SecurityAudit");
    expect(schema.fields).toHaveLength(2);
    expect(schema.fields[0]).toEqual({
      type: "FieldDefinition",
      name: "has_vulnerabilities",
      fieldType: "boolean",
    });
    expect(schema.fields[1]).toEqual({
      type: "FieldDefinition",
      name: "risk_level",
      fieldType: "string",
    });
  }
});

test("should throw SyntaxError when schema name is missing", () => {
  const code = `schema { active: boolean }`;
  const tokens = tokenize(code);
  const parser = new Parser(tokens);

  expect(() => parser.parse()).toThrow();
});