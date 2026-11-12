import { test, expect } from "bun:test";
import { Parser, tokenize } from "@sam-lang/compiler";

test("should build a valid AST from an empty public flow", () => {
  const code = `flow Basic() {}`;

  const tokens = tokenize(code);
  const parser = new Parser(tokens);
  const ast = parser.parse();

  expect(ast.type).toBe("Program");
  expect(ast.body.length).toBe(1);

  const flow = ast.body[0];
  expect(flow.type).toBe("FlowDeclaration");

  if (flow.type === "FlowDeclaration") {
    expect(flow.name).toBe("Basic");
    expect(flow.isPrivate).toBe(false);
    expect(flow.params).toEqual([]);
    expect(flow.body).toEqual([]);
  }
});

test("should parse a private flow with typed parameters", () => {
  const code = `private flow Audit(target: string, retries: number) {}`;

  const tokens = tokenize(code);
  const parser = new Parser(tokens);
  const ast = parser.parse();

  const flow = ast.body[0];
  expect(flow.type).toBe("FlowDeclaration");

  if (flow.type === "FlowDeclaration") {
    expect(flow.name).toBe("Audit");
    expect(flow.isPrivate).toBe(true);
    expect(flow.params).toEqual([
      { name: "target", type: "string" },
      { name: "retries", type: "number" },
    ]);
  }
});

test("should parse LetStatement and ExpressionStatement inside flow body", () => {
  const code = `
    flow Copy(source: string) {
      let backup = source
      backup
    }
  `;

  const tokens = tokenize(code);
  const parser = new Parser(tokens);
  const ast = parser.parse();

  const flow = ast.body[0];
  expect(flow.type).toBe("FlowDeclaration");

  if (flow.type === "FlowDeclaration") {
    expect(flow.body).toHaveLength(2);
    expect(flow.body[0]).toEqual({
      type: "LetStatement",
      name: "backup",
      value: {
        type: "Identifier",
        name: "source",
      },
    });
    expect(flow.body[1]).toEqual({
      type: "ExpressionStatement",
      expression: {
        type: "Identifier",
        name: "backup",
      },
    });
  }
});

test("should throw SyntaxError on invalid flow parameters or let syntax", () => {
  const missingComma = `flow Bad(a: string b: number) {}`;
  const trailingComma = `flow Bad(a: string,) {}`;
  const missingEquals = `flow Bad() { let x y }`;

  expect(() => new Parser(tokenize(missingComma)).parse()).toThrow();
  expect(() => new Parser(tokenize(trailingComma)).parse()).toThrow();
  expect(() => new Parser(tokenize(missingEquals)).parse()).toThrow();
});