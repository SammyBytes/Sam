import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Parser, tokenize } from "@sam-lang/compiler";
import { generateCode } from "./index";

let sourceDir: string;

beforeEach(async () => {
  sourceDir = await mkdtemp(join(tmpdir(), "sam-prompt-codegen-"));
});

afterEach(async () => {
  await rm(sourceDir, { recursive: true, force: true });
});

function program(promptProperty: string): string {
  return `
provider Local {
  protocol: "openai-compatible"
  base_url: "http://127.0.0.1:1/v1"
  api_key: "test"
}

agent Reviewer {
  provider: Local
  model: "test-model"
  ${promptProperty}
}
`;
}

describe("system_prompt_file codegen", () => {
  test("embeds the sanitized Markdown as the system prompt", async () => {
    await writeFile(
      join(sourceDir, "reviewer.md"),
      "\uFEFF# Reviewer\r\n\r\nBe strict.\r\n",
      "utf8",
    );

    const ast = new Parser(
      tokenize(program('system_prompt_file: "./reviewer.md"')),
    ).parse();
    const output = generateCode(ast, { sourceDir });

    expect(output).toContain(
      'systemPrompt: "# Reviewer\\n\\nBe strict."',
    );
    expect(output).not.toContain("systemPromptFile");
    expect(output).not.toContain("reviewer.md");
  });

  test("requires a source directory when system_prompt_file is used", async () => {
    await writeFile(join(sourceDir, "reviewer.md"), "# Reviewer\n");

    const ast = new Parser(
      tokenize(program('system_prompt_file: "./reviewer.md"')),
    ).parse();

    expect(() => generateCode(ast)).toThrow(/no source directory/);
  });

  test("still supports literal system_prompt", () => {
    const ast = new Parser(
      tokenize(program('system_prompt: "Be terse."')),
    ).parse();
    const output = generateCode(ast, { sourceDir });

    expect(output).toContain('systemPrompt: "Be terse."');
  });

  test("rejects system_prompt and system_prompt_file together", () => {
    expect(() =>
      new Parser(
        tokenize(
          program(
            'system_prompt: "Be terse.", system_prompt_file: "./reviewer.md"',
          ),
        ),
      ).parse(),
    ).toThrow(/mutually exclusive/);
  });
});
