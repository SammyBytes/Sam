import { describe, expect, test } from "bun:test";
import { closeSync, openSync } from "node:fs";
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
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

/** Renders the full result so assertion failures stay debuggable in CI. */
function describeRun(result: RunResult): string {
  return `exit=${result.exitCode} stdout=${JSON.stringify(
    result.stdout,
  )} stderr=${JSON.stringify(result.stderr)} ephemeral=${JSON.stringify(
    result.ephemeralFiles,
  )}`;
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
  const stdoutFile = join(workDir, "stdout.log");
  const stderrFile = join(workDir, "stderr.log");

  await writeFile(sourceFile, source, "utf8");

  let stdoutFd: number | undefined;
  let stderrFd: number | undefined;

  try {
    // Redirect to files instead of pipes: some Bun versions return empty
    // piped output from subprocesses spawned inside `bun test`.
    stdoutFd = openSync(stdoutFile, "w");
    stderrFd = openSync(stderrFile, "w");

    const proc = Bun.spawn({
      cmd: [process.execPath, CLI, "run", sourceFile],
      cwd: ROOT,
      env: {
        ...process.env,
        // `os.tmpdir()` honors TMPDIR on Unix and TEMP/TMP on Windows.
        TMPDIR: runtimeTmpDir,
        TEMP: runtimeTmpDir,
        TMP: runtimeTmpDir,
      },
      stdin: options.stdinText === undefined ? "ignore" : "pipe",
      stdout: stdoutFd,
      stderr: stderrFd,
    });

    if (options.stdinText !== undefined) {
      proc.stdin.write(options.stdinText);
      proc.stdin.end();
    }

    const exitCode = await proc.exited;

    closeSync(stdoutFd);
    closeSync(stderrFd);
    stdoutFd = undefined;
    stderrFd = undefined;

    const [stdout, stderr] = await Promise.all([
      readFile(stdoutFile, "utf8"),
      readFile(stderrFile, "utf8"),
    ]);

    const ephemeralFiles = (await readdir(runtimeTmpDir)).filter((name) =>
      /^sam-run-.*\.ts$/.test(name),
    );

    return { stdout, stderr, exitCode, ephemeralFiles };
  } finally {
    if (stdoutFd !== undefined) {
      try {
        closeSync(stdoutFd);
      } catch {}
    }
    if (stderrFd !== undefined) {
      try {
        closeSync(stderrFd);
      } catch {}
    }

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
    const context = describeRun(result);

    expect(result.exitCode, context).toBe(0);
    expect(result.stdout.trim(), context).toBe("mock_message");
    expect(result.stderr, context).toBe("");
    expect(result.ephemeralFiles, context).toEqual([]);
  });

  test("returns exitCode 1 when a flow resolves to a failed Result", async () => {
    const source = `
agent BrokenReviewer {
  runner: mock,
  workspace: "./package.json"
}

flow main() {
  let result = use unsafe BrokenReviewer("ping")
  return result
}
`;

    const result = await runSam(source);
    const context = describeRun(result);

    expect(result.exitCode, context).toBe(1);
    expect(result.stdout, context).toBe("");
    expect(JSON.parse(result.stderr), context).toMatchObject({
      code: "EXECUTION_ERROR",
      agentName: "BrokenReviewer",
    });
    expect(result.ephemeralFiles, context).toEqual([]);
  });

  test("removes ephemeral sam-run files after a successful execution", async () => {
    const source = `
flow main() {
  return "done"
}
`;

    const result = await runSam(source);
    const context = describeRun(result);

    expect(result.exitCode, context).toBe(0);
    expect(result.stdout.trim(), context).toBe("done");
    expect(result.ephemeralFiles, context).toEqual([]);
  });

  test("reads a single string argument from stdin when no flow args are given", async () => {
    const source = `
flow main(input: string) {
  return input
}
`;

    const result = await runSam(source, { stdinText: "piped input\n" });
    const context = describeRun(result);

    expect(result.exitCode, context).toBe(0);
    expect(result.stdout.trim(), context).toBe("piped input");
    expect(result.ephemeralFiles, context).toEqual([]);
  });
});
