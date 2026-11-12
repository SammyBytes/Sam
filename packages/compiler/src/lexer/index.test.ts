import { test, expect } from "bun:test";
import { tokenize } from "@sam-lang/compiler";

test("Should tokenize a simple schema definition", () => {
  const code = `schema TestSchema { active: true }`;
  const tokens = tokenize(code);

  expect(tokens.length).toBeGreaterThanOrEqual(3);

  const schemaToken = tokens[0]!;
  const identifierToken = tokens[1]!;
  const braceToken = tokens[2]!;

  // Expect the first token to be the "schema" keyword
  expect(schemaToken.type).toBe("SCHEMA");
  expect(schemaToken.value).toBe("schema");

  // Expect the second token to be the schema name
  expect(identifierToken.type).toBe("IDENTIFIER");
  expect(identifierToken.value).toBe("TestSchema");

  // Expect the opening brace
  expect(braceToken.type).toBe("LBRACE");
});

test("Should tokenize a simple agent definition", () => {
  const code = `agent MyAgent { runner: claude_code }`;
  const tokens = tokenize(code);

  expect(tokens.length).toBeGreaterThanOrEqual(3);

  const agentToken = tokens[0]!;
  const identifierToken = tokens[1]!;
  const braceToken = tokens[2]!;

  // Expect the first token to be the "agent" keyword
  expect(agentToken.type).toBe("AGENT");
  expect(agentToken.value).toBe("agent");

  // Expect the second token to be the agent name
  expect(identifierToken.type).toBe("IDENTIFIER");
  expect(identifierToken.value).toBe("MyAgent");

  // Expect the opening brace
  expect(braceToken.type).toBe("LBRACE");
});

test("Should tokenize a simple flow definition", () => {
  const code = `flow MyFlow() { let x = use MyAgent<TSchema>("input") }`;
  const tokens = tokenize(code);

  expect(tokens.length).toBeGreaterThanOrEqual(3);

  const flowToken = tokens[0]!;
  const identifierToken = tokens[1]!;
  const lparenToken = tokens[2]!;

  // Expect the first token to be the "flow" keyword
  expect(flowToken.type).toBe("FLOW");
  expect(flowToken.value).toBe("flow");

  // Expect the second token to be the flow name
  expect(identifierToken.type).toBe("IDENTIFIER");
  expect(identifierToken.value).toBe("MyFlow");

  // Expect the opening parenthesis
  expect(lparenToken.type).toBe("LPAREN");
});