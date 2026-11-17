import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { generateCode } from "./codegen";
import { Parser } from "./parser";
import { tokenize } from "./lexer";

const ROOT = join(import.meta.dir, "../../..");
const EDITION_2026_DIR = join(ROOT, "tests/editions/2026");
const EDITION_GUARD = join(ROOT, "ci/sam/edition-guard.sb");

function parseFile(path: string) {
  const source = readFileSync(path, "utf8");
  return new Parser(tokenize(source)).parse();
}

describe("frozen edition 2026 fixtures", () => {
  const fixtures = readdirSync(EDITION_2026_DIR)
    .filter((file) => file.endsWith(".sb"))
    .sort();

  test("include the required representative programs", () => {
    expect(fixtures).toContain("basic-agent.sb");
    expect(fixtures).toContain("explicit-edition.sb");
    expect(fixtures.length).toBeGreaterThanOrEqual(2);
  });

  for (const fixture of fixtures) {
    test(`${fixture} compiles as edition 2026`, () => {
      const path = join(EDITION_2026_DIR, fixture);
      const ast = parseFile(path);

      expect(ast.edition).toBe("2026");
      expect(() =>
        generateCode(ast, { sourceDir: EDITION_2026_DIR }),
      ).not.toThrow();
    });
  }

  test("basic-agent.sb omits the header and defaults to edition 2026", () => {
    const source = readFileSync(
      join(EDITION_2026_DIR, "basic-agent.sb"),
      "utf8",
    );

    expect(source.trimStart().startsWith("edition")).toBe(false);
    expect(parseFile(join(EDITION_2026_DIR, "basic-agent.sb")).edition).toBe(
      "2026",
    );
  });

  test("explicit-edition.sb declares edition 2026", () => {
    const source = readFileSync(
      join(EDITION_2026_DIR, "explicit-edition.sb"),
      "utf8",
    );

    expect(source.trimStart().startsWith('edition "2026"')).toBe(true);
    expect(parseFile(join(EDITION_2026_DIR, "explicit-edition.sb")).edition).toBe(
      "2026",
    );
  });

  test("ci/sam/edition-guard.sb compiles as edition 2026", () => {
    const ast = parseFile(EDITION_GUARD);

    expect(ast.edition).toBe("2026");
    expect(() =>
      generateCode(ast, { sourceDir: join(ROOT, "ci/sam") }),
    ).not.toThrow();
  });
});
