import { describe, expect, test } from "bun:test";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROOT = join(import.meta.dir, "../../../..");
const CLI = join(import.meta.dir, "../cli.ts");

interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  ephemeralFiles: string[];
}

/**
 * Executes the real CLI in a subprocess with an isolated TMPDIR, so the
 * ephemeral `sam-run-*.ts` files can be asserted without touching the host
 * temporary directory.
 */
async function runSam(
  source: string,
  options: { stdinText?: string } = {},
): Promise<RunResult> {
  const workDir = await mkdtemp(join(tmpdir(), "sam-run-work-"));
  const runtimeTmpDir = await mkdtemp(join(tmpdir(), "sam-run-tmp-"));
  const sourceFile = join(workDir, "program.sb");

  await writeFile(sourceFile, source, "utf8");

  try {
    const proc = Bun.spawn({
      cmd: [process.execPath, CLI, "run", sourceFile],
      cwd: ROOT,
      env: { ...process.env, TMPDIR: runtimeTmpDir },
      stdin: options.stdinText === undefined ? "ignore" : "pipe",
      stdout: "pipe",
      stderr: "pipe",
    });

    if (options.stdinText !== undefined) {
      proc.stdin.write(options.stdinText);
      proc.stdin.end();
    }

    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);

    const ephemeralFiles = (await readdir(runtimeTmpDir)).filter((name) =>
      /^sam-run-.*\.ts$/.test(name),
    );

    return { stdout, stderr, exitCode, ephemeralFiles };
  } finally {
    await rm(workDir, { recursive: true, force: true });
    await rm(runtimeTmpDir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// `sam run` integration tests
// ---------------------------------------------------------------------------

describe("sam run", () => {
  test("executes a flow with the mock runner and prints its output", async () => {
    const source = `
schema Ping {
  message: string
}

agent MockPing {
  runner: mock,
  workspace: "."
}

flow main() {
  let result = use MockPing<Ping>("ping")
  if (!result.ok) {
    return "error"
  }
  return result.value.message
}
`;

    const result = await runSam(source);

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("mock_message");
    expect(result.stderr).toBe("");
    expect(result.ephemeralFiles).toEqual([]);
  });

  test("returns exitCode 1 when a flow resolves to a failed Result", async () => {
    const source = `
agent BrokenReviewer {
  runner: mock,
  workspace: "./sam-missing-workspace"
}

flow main() {
  let result = use unsafe BrokenReviewer("ping")
  return result
}
`;

    const result = await runSam(source);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(JSON.parse(result.stderr)).toMatchObject({
      code: "EXECUTION_ERROR",
      agentName: "BrokenReviewer",
    });
    expect(result.ephemeralFiles).toEqual([]);
  });

  test("removes ephemeral sam-run files after a successful execution", async () => {
    const source = `
flow main() {
  return "done"
}
`;

    const result = await runSam(source);

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("done");
    expect(result.ephemeralFiles).toEqual([]);
  });

  test("reads a single string argument from stdin when no flow args are given", async () => {
    const source = `
flow main(input: string) {
  return input
}
`;

    const result = await runSam(source, { stdinText: "piped input\n" });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("piped input");
    expect(result.ephemeralFiles).toEqual([]);
  });
});
