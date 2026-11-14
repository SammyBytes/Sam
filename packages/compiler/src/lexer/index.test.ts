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
  const code = `agent MyAgent { runner: opencode }`;
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

test("Should tokenize a template literal with interpolation", () => {
  const code = "`Analiza este resulta ${result.value}`";
  const tokens = tokenize(code);

  expect(tokens.length).toBe(6);

  const headToken = tokens[0]!;
  const objectToken = tokens[1]!;
  const dotToken = tokens[2]!;
  const propertyToken = tokens[3]!;
  const tailToken = tokens[4]!;
  const eofToken = tokens[5]!;

  // Expect the head of the template literal before the interpolation
  expect(headToken.type).toBe("TEMPLATE_HEAD");
  expect(headToken.value).toBe("Analiza este resulta ");

  // Expect the interpolated member expression tokens
  expect(objectToken.type).toBe("IDENTIFIER");
  expect(objectToken.value).toBe("result");

  expect(dotToken.type).toBe("DOT");
  expect(dotToken.value).toBe(".");

  expect(propertyToken.type).toBe("IDENTIFIER");
  expect(propertyToken.value).toBe("value");

  // Expect the closing tail of the template literal
  expect(tailToken.type).toBe("TEMPLATE_TAIL");
  expect(tailToken.value).toBe("");

  // Expect end of file token
  expect(eofToken.type).toBe("EOF");
});

test("Should tokenize a template literal with multiple interpolations", () => {
  const code = "`User ${name} has ${count} alerts`";
  const tokens = tokenize(code);

  // Expect head, first expr, middle, second expr, tail, and EOF
  expect(tokens.map((t) => t.type)).toEqual([
    "TEMPLATE_HEAD",
    "IDENTIFIER",
    "TEMPLATE_MIDDLE",
    "IDENTIFIER",
    "TEMPLATE_TAIL",
    "EOF",
  ]);

  expect(tokens[0]!.value).toBe("User ");
  expect(tokens[1]!.value).toBe("name");
  expect(tokens[2]!.value).toBe(" has ");
  expect(tokens[3]!.value).toBe("count");
  expect(tokens[4]!.value).toBe(" alerts");
});

test("Should tokenize a plain template literal without interpolation as STRING", () => {
  const code = "`Plain multiline prompt`";
  const tokens = tokenize(code);

  expect(tokens.length).toBe(2);

  // Expect a regular STRING token when no interpolation is present
  expect(tokens[0]!.type).toBe("STRING");
  expect(tokens[0]!.value).toBe("Plain multiline prompt");
  expect(tokens[1]!.type).toBe("EOF");
});