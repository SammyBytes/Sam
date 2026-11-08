import { test, expect } from "bun:test";
import { tokenize } from "./index.ts";

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