import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanupEphemeralFile } from "./ephemeral";

let workDir: string;

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), "sam-ephemeral-"));
});

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true });
});

describe("cleanupEphemeralFile", () => {
  test("removes a generated file", async () => {
    const tempFile = join(workDir, "sam-run-test.ts");
    await writeFile(tempFile, "export {};\n");

    await cleanupEphemeralFile(tempFile);

    await expect(readFile(tempFile, "utf8")).rejects.toThrow();
  });

  test("does not throw when the file was already deleted externally", async () => {
    const tempFile = join(workDir, "sam-run-deleted.ts");
    await writeFile(tempFile, "export {};\n");
    await rm(tempFile, { force: true });

    await expect(cleanupEphemeralFile(tempFile)).resolves.toBeUndefined();
  });

  test("does not throw when the file was never created", async () => {
    await expect(
      cleanupEphemeralFile(join(workDir, "sam-run-missing.ts")),
    ).resolves.toBeUndefined();
  });
});
