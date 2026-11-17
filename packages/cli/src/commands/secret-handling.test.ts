import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { closeSync, openSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "../../../..");
const CLI = join(import.meta.dir, "../cli.ts");

interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Runs the real CLI against a temporary `.sb` file with an isolated working
 * directory and explicit environment overrides.
 */
async function runCli(
  command: "run" | "compile" | "ast",
  source: string,
  env: Record<string, string> = {},
): Promise<CliResult> {
  const workDir = await mkdtemp(join(tmpdir(), "sam-secret-work-"));
  const sourceFile = join(workDir, "program.sb");
  const stdoutFile = join(workDir, "stdout.log");
  const stderrFile = join(workDir, "stderr.log");

  await writeFile(sourceFile, source, "utf8");

  let stdoutFd: number | undefined;
  let stderrFd: number | undefined;

  try {
    stdoutFd = openSync(stdoutFile, "w");
    stderrFd = openSync(stderrFile, "w");

    const proc = Bun.spawn({
      cmd: [process.execPath, CLI, command, sourceFile],
      cwd: ROOT,
      env: { ...process.env, ...env },
      stdin: "ignore",
      stdout: stdoutFd,
      stderr: stderrFd,
    });

    const exitCode = await proc.exited;

    closeSync(stdoutFd);
    closeSync(stderrFd);
    stdoutFd = undefined;
    stderrFd = undefined;

    const [stdout, stderr] = await Promise.all([
      readFile(stdoutFile, "utf8"),
      readFile(stderrFile, "utf8"),
    ]);

    return { stdout, stderr, exitCode };
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
  }
}

function buildSource(baseUrl: string): string {
  return `
provider TestProvider {
  protocol: "openai-compatible"
  base_url: "${baseUrl}"
  api_key: env("SAM_TEST_SECRET")
}

agent TestAgent {
  provider: TestProvider
  model: "test-model"
}

flow main() {
  let result = use unsafe TestAgent("hello")
  return result
}
`;
}

describe("secret handling", () => {
  test("env() values never appear in sam compile or sam ast output", async () => {
    const secret = `sk-live-${crypto.randomUUID()}`;
    const source = buildSource("http://127.0.0.1:1/v1");
    const env = { SAM_TEST_SECRET: secret };

    const compiled = await runCli("compile", source, env);
    expect(compiled.exitCode).toBe(0);
    expect(compiled.stdout).toContain("Bun.env.SAM_TEST_SECRET");
    expect(compiled.stdout).not.toContain(secret);

    const ast = await runCli("ast", source, env);
    expect(ast.exitCode).toBe(0);
    expect(ast.stdout).toContain("SAM_TEST_SECRET");
    expect(ast.stdout).not.toContain(secret);
  });

  describe("runtime HTTP errors", () => {
    let server: ReturnType<typeof Bun.serve>;
    let baseUrl: string;

    beforeAll(() => {
      server = Bun.serve({
        port: 0,
        async fetch(req) {
          const authorization = req.headers.get("authorization") ?? "";
          return new Response(
            `provider rejected credentials: ${authorization}`,
            { status: 401 },
          );
        },
      });

      baseUrl = `http://localhost:${server.port}/v1`;
    });

    afterAll(() => {
      server.stop(true);
    });

    test("does not echo the resolved env() secret from a provider error body", async () => {
      const secret = `sk-live-${crypto.randomUUID()}`;
      const result = await runCli("run", buildSource(baseUrl), {
        SAM_TEST_SECRET: secret,
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("[REDACTED]");
      expect(result.stderr).not.toContain(secret);
    });
  });
});
