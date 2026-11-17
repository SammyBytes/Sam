import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  mkdir,
  mkdtemp,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadSystemPromptFile,
  MAX_SYSTEM_PROMPT_FILE_BYTES,
} from "./systemPromptFile";

let workDir: string;
let sourceDir: string;

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), "sam-prompt-file-"));
  sourceDir = join(workDir, "project");
  await mkdir(sourceDir, { recursive: true });
});

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true });
});

function load(filePath: string): string {
  return loadSystemPromptFile(filePath, sourceDir);
}

describe("loadSystemPromptFile", () => {
  test("loads Markdown and normalizes BOM and line endings", async () => {
    await writeFile(
      join(sourceDir, "reviewer.md"),
      "\uFEFF# Reviewer\r\n\r\nBe strict.\rUse evidence.\n",
      "utf8",
    );

    expect(load("./reviewer.md")).toBe(
      "# Reviewer\n\nBe strict.\nUse evidence.",
    );
  });

  test("accepts .markdown files and subdirectories", async () => {
    await mkdir(join(sourceDir, "prompts"));
    await writeFile(
      join(sourceDir, "prompts", "review.markdown"),
      "# Review\n",
    );

    expect(load("prompts/review.markdown")).toBe("# Review");
  });

  test("rejects absolute paths", () => {
    expect(() => load(join(sourceDir, "reviewer.md"))).toThrow(
      /must be a relative path/,
    );
  });

  test("allows filenames that begin with two dots", async () => {
    await writeFile(join(sourceDir, "..review.md"), "# Review\n");

    expect(load("..review.md")).toBe("# Review");
  });

  test("rejects path traversal outside the source directory", async () => {
    await writeFile(join(workDir, "secret.md"), "# Secret\n");

    expect(() => load("../secret.md")).toThrow(
      /must resolve inside the \.sb source directory/,
    );
  });

  test.skipIf(process.platform !== "win32")(
    "rejects Windows-style path traversal outside the source directory",
    async () => {
      await writeFile(join(workDir, "secret.md"), "# Secret\n");

      expect(() => load("..\\secret.md")).toThrow(
        /must resolve inside the \.sb source directory/,
      );
    },
  );

  test.skipIf(process.platform === "win32")(
    "rejects symlinks that escape the source directory",
    async () => {
      await writeFile(join(workDir, "secret.md"), "# Secret\n");
      await symlink(join(workDir, "secret.md"), join(sourceDir, "link.md"));

      expect(() => load("link.md")).toThrow(
        /must resolve inside the \.sb source directory/,
      );
    },
  );

  test("rejects non-Markdown extensions", async () => {
    await writeFile(join(sourceDir, "reviewer.txt"), "# Reviewer\n");

    expect(() => load("reviewer.txt")).toThrow(
      /only supports Markdown files/,
    );
  });

  test("rejects files with binary magic headers", async () => {
    await writeFile(
      join(sourceDir, "image.md"),
      Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );

    expect(() => load("image.md")).toThrow(/PNG binary signature/);
  });

  test("rejects NUL bytes", async () => {
    await writeFile(join(sourceDir, "nul.md"), Uint8Array.from([0x23, 0x00]));

    expect(() => load("nul.md")).toThrow(/NUL bytes/);
  });

  test("rejects invalid UTF-8", async () => {
    await writeFile(
      join(sourceDir, "invalid.md"),
      Uint8Array.from([0xff, 0xfe, 0xfd]),
    );

    expect(() => load("invalid.md")).toThrow(/not valid UTF-8/);
  });

  test("rejects control characters", async () => {
    await writeFile(join(sourceDir, "control.md"), "Hello\u0001world\n");

    expect(() => load("control.md")).toThrow(/control characters/);
  });

  test("rejects bidirectional override characters", async () => {
    await writeFile(join(sourceDir, "bidi.md"), "Hello\u202Eworld\n");

    expect(() => load("bidi.md")).toThrow(
      /bidirectional control characters/,
    );
  });

  test("rejects files over the size limit", async () => {
    await writeFile(
      join(sourceDir, "large.md"),
      Buffer.alloc(MAX_SYSTEM_PROMPT_FILE_BYTES + 1, 0x61),
    );

    expect(() => load("large.md")).toThrow(/exceeds the/);
  });

  test("rejects empty or whitespace-only files", async () => {
    await writeFile(join(sourceDir, "empty.md"), "  \n\t\n");

    expect(() => load("empty.md")).toThrow(/is empty/);
  });

  test("rejects missing files", () => {
    expect(() => load("missing.md")).toThrow(/file not found/);
  });

  test("rejects directories", async () => {
    await mkdir(join(sourceDir, "folder.md"));

    expect(() => load("folder.md")).toThrow(/not a regular file/);
  });
});
