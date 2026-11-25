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

test("Should tokenize a provider definition with env()", () => {
  const code = `provider Groq { protocol: "openai-compatible", base_url: "https://api.groq.com/openai/v1", api_key: env("GROQ_API_KEY") }`;
  const tokens = tokenize(code);

  expect(tokens.length).toBeGreaterThanOrEqual(16);

  const providerToken = tokens[0]!;
  const identifierToken = tokens[1]!;
  const braceToken = tokens[2]!;

  // Expect the first token to be the "provider" keyword
  expect(providerToken.type).toBe("PROVIDER");
  expect(providerToken.value).toBe("provider");

  // Expect the second token to be the provider name
  expect(identifierToken.type).toBe("IDENTIFIER");
  expect(identifierToken.value).toBe("Groq");

  // Expect the opening brace
  expect(braceToken.type).toBe("LBRACE");

  // Expect the env() call sequence near the end of the declaration
  const envIndex = tokens.findIndex((t) => t.type === "ENV");
  expect(envIndex).toBeGreaterThan(-1);

  expect(tokens[envIndex]!.type).toBe("ENV");
  expect(tokens[envIndex]!.value).toBe("env");
  expect(tokens[envIndex + 1]!.type).toBe("LPAREN");
  expect(tokens[envIndex + 2]!.type).toBe("STRING");
  expect(tokens[envIndex + 2]!.value).toBe("GROQ_API_KEY");
  expect(tokens[envIndex + 3]!.type).toBe("RPAREN");
});

test("should tokenize for, in, break, and continue keywords", () => {
  const code = `for item in data { if (i == 5) { break } if (i == 7) { continue } }`;
  const tokens = tokenize(code);

  expect(tokens[0]!.type).toBe("FOR");
  expect(tokens[0]!.value).toBe("for");

  const inToken = tokens.find((t) => t.type === "IN");
  const breakToken = tokens.find((t) => t.type === "BREAK");
  const continueToken = tokens.find((t) => t.type === "CONTINUE");

  expect(inToken).toBeDefined();
  expect(inToken!.value).toBe("in");

  expect(breakToken).toBeDefined();
  expect(breakToken!.value).toBe("break");

  expect(continueToken).toBeDefined();
  expect(continueToken!.value).toBe("continue");
});

test("should tokenize identifiers starting with loop keywords as IDENTIFIER", () => {
  const code = `format input breakfast continued`;
  const tokens = tokenize(code);

  const identifiers = tokens.filter((t) => t.type === "IDENTIFIER");
  expect(identifiers.map((t) => t.value)).toEqual([
    "format",
    "input",
    "breakfast",
    "continued",
  ]);
});