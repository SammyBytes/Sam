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
test("should parse primitive literals (string, number, boolean) in let statements", () => {
  const code = `
    flow Config() {
      let greeting = "hello"
      let maxRetries = 3
      let isEnabled = true
    }
  `;

  const tokens = tokenize(code);
  const parser = new Parser(tokens);
  const ast = parser.parse();

  const flow = ast.body[0];
  expect(flow.type).toBe("FlowDeclaration");

  if (flow.type === "FlowDeclaration") {
    expect(flow.body).toHaveLength(3);
    expect(flow.body[0]).toEqual({
      type: "LetStatement",
      name: "greeting",
      value: { type: "Literal", value: "hello" },
    });
    expect(flow.body[1]).toEqual({
      type: "LetStatement",
      name: "maxRetries",
      value: { type: "Literal", value: 3 },
    });
    expect(flow.body[2]).toEqual({
      type: "LetStatement",
      name: "isEnabled",
      value: { type: "Literal", value: true },
    });
  }
});

test("should parse IfStatement with else branch and ReturnStatement", () => {
  const code = `
    flow Check(isReady: boolean) {
      if (isReady) {
        return "ok"
      } else {
        return false
      }
    }
  `;

  const tokens = tokenize(code);
  const parser = new Parser(tokens);
  const ast = parser.parse();

  const flow = ast.body[0];
  expect(flow.type).toBe("FlowDeclaration");

  if (flow.type === "FlowDeclaration") {
    expect(flow.body).toHaveLength(1);
    expect(flow.body[0]).toEqual({
      type: "IfStatement",
      condition: { type: "Identifier", name: "isReady" },
      thenBranch: [
        {
          type: "ReturnStatement",
          value: { type: "Literal", value: "ok" },
        },
      ],
      elseBranch: [
        {
          type: "ReturnStatement",
          value: { type: "Literal", value: false },
        },
      ],
    });
  }
});

test("should parse IfStatement without else and empty ReturnStatement", () => {
  const code = `
    flow Guard(skip: boolean) {
      if (skip) {
        return
      }
      return 1
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
      type: "IfStatement",
      condition: { type: "Identifier", name: "skip" },
      thenBranch: [
        {
          type: "ReturnStatement",
          value: undefined,
        },
      ],
      elseBranch: undefined,
    });
    expect(flow.body[1]).toEqual({
      type: "ReturnStatement",
      value: { type: "Literal", value: 1 },
    });
  }
});

test("should throw SyntaxError on malformed if statements", () => {
  const missingParens = `flow Bad(x: boolean) { if x { return } }`;
  const missingBlock = `flow Bad(x: boolean) { if (x) return }`;

  expect(() => new Parser(tokenize(missingParens)).parse()).toThrow();
  expect(() => new Parser(tokenize(missingBlock)).parse()).toThrow();
});

test("should parse MemberExpression for nested property access", () => {
  const code = `
    flow Inspect(audit: any) {
      let level = audit.value.risk_level
      return level
    }
  `;

  const tokens = tokenize(code);
  const parser = new Parser(tokens);
  const ast = parser.parse();

  const flow = ast.body[0];
  expect(flow.type).toBe("FlowDeclaration");

  if (flow.type === "FlowDeclaration") {
    expect(flow.body[0]).toEqual({
      type: "LetStatement",
      name: "level",
      value: {
        type: "MemberExpression",
        object: {
          type: "MemberExpression",
          object: { type: "Identifier", name: "audit" },
          property: "value",
        },
        property: "risk_level",
      },
    });
  }
});

test("should parse UnaryExpression (!) and BinaryExpression (==, !=, <, >)", () => {
  const code = `
    flow Validate(res: any, count: number) {
      if (!res.ok) {
        return false
      }
      if (res.status != "error") {
        let isHigh = count > 10
        return isHigh
      }
      return res.code == 200
    }
  `;

  const tokens = tokenize(code);
  const parser = new Parser(tokens);
  const ast = parser.parse();

  const flow = ast.body[0];
  expect(flow.type).toBe("FlowDeclaration");

  if (flow.type === "FlowDeclaration") {
    expect(flow.body).toHaveLength(3);

    // 1. if (!res.ok)
    expect(flow.body[0]).toEqual({
      type: "IfStatement",
      condition: {
        type: "UnaryExpression",
        operator: "!",
        argument: {
          type: "MemberExpression",
          object: { type: "Identifier", name: "res" },
          property: "ok",
        },
      },
      thenBranch: [
        {
          type: "ReturnStatement",
          value: { type: "Literal", value: false },
        },
      ],
      elseBranch: undefined,
    });

    // 2. if (res.status != "error")
    expect(flow.body[1]).toEqual({
      type: "IfStatement",
      condition: {
        type: "BinaryExpression",
        operator: "!=",
        left: {
          type: "MemberExpression",
          object: { type: "Identifier", name: "res" },
          property: "status",
        },
        right: { type: "Literal", value: "error" },
      },
      thenBranch: [
        {
          type: "LetStatement",
          name: "isHigh",
          value: {
            type: "BinaryExpression",
            operator: ">",
            left: { type: "Identifier", name: "count" },
            right: { type: "Literal", value: 10 },
          },
        },
        {
          type: "ReturnStatement",
          value: { type: "Identifier", name: "isHigh" },
        },
      ],
      elseBranch: undefined,
    });

    // 3. return res.code == 200
    expect(flow.body[2]).toEqual({
      type: "ReturnStatement",
      value: {
        type: "BinaryExpression",
        operator: "==",
        left: {
          type: "MemberExpression",
          object: { type: "Identifier", name: "res" },
          property: "code",
        },
        right: { type: "Literal", value: 200 },
      },
    });
  }
});

test("should throw SyntaxError on incomplete binary or member expressions", () => {
  const trailingDot = `flow Bad(a: any) { let x = a. }`;
  const missingRightSide = `flow Bad(a: number) { if (a == ) { return } }`;

  expect(() => new Parser(tokenize(trailingDot)).parse()).toThrow();
  expect(() => new Parser(tokenize(missingRightSide)).parse()).toThrow();
});