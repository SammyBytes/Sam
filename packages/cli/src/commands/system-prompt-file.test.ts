import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { closeSync, openSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

const ROOT = join(import.meta.dir, "../../../..");
const CLI = join(import.meta.dir, "../cli.ts");

interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

async function runCli(
  command: "run" | "compile" | "ast",
  projectDir: string,
  source: string,
  env: Record<string, string> = {},
): Promise<CliResult> {
  const sourceFile = join(projectDir, "program.sb");
  const stdoutFile = join(projectDir, `${command}.stdout.log`);
  const stderrFile = join(projectDir, `${command}.stderr.log`);

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
  }
}

function buildSource(baseUrl: string, promptFile = "./prompt.md"): string {
  return `
provider Local {
  protocol: "openai-compatible"
  base_url: "${baseUrl}"
  api_key: "test-key"
}

agent Reviewer {
  provider: Local
  model: "test-model"
  system_prompt_file: "${promptFile}"
}

flow main() {
  let result = use unsafe Reviewer("hello")
  if (!result.ok) {
    return result
  }
  return result.value
}
`;
}

describe("system_prompt_file", () => {
  let server: ReturnType<typeof Bun.serve>;
  let baseUrl: string;
  let projectDir: string;
  let outsideDir: string;
  let messages: Array<{ role: string; content: string }> = [];

  beforeAll(async () => {
    projectDir = await mkdtemp(join(tmpdir(), "sam-prompt-cli-"));
    outsideDir = await mkdtemp(join(tmpdir(), "sam-prompt-outside-"));

    server = Bun.serve({
      port: 0,
      async fetch(req) {
        const body = (await req.json()) as {
          messages?: Array<{ role: string; content: string }>;
        };
        messages = body.messages ?? [];
        return Response.json({
          choices: [{ message: { content: "ok" } }],
        });
      },
    });

    baseUrl = `http://localhost:${server.port}/v1`;
  });

  afterAll(async () => {
    server.stop(true);
    await rm(projectDir, { recursive: true, force: true });
    await rm(outsideDir, { recursive: true, force: true });
  });

  test("sends the sanitized Markdown file as the system message", async () => {
    await writeFile(
      join(projectDir, "prompt.md"),
      "# Reviewer\r\n\r\nBe strict.\r\n",
      "utf8",
    );

    const result = await runCli("run", projectDir, buildSource(baseUrl));

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("ok");
    expect(messages[0]).toEqual({
      role: "system",
      content: "# Reviewer\n\nBe strict.",
    });
    expect(messages[1]?.role).toBe("user");
  });

  test("sam ast does not read the prompt file", async () => {
    const result = await runCli(
      "ast",
      projectDir,
      buildSource(baseUrl, "./missing.md"),
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("system_prompt_file");
    expect(result.stdout).toContain("missing.md");
  });

  test("rejects path traversal during compilation", async () => {
    await writeFile(join(outsideDir, "outside.md"), "# Outside\n");

    // Use forward slashes: the path is embedded in a `.sb` string literal,
    // where backslashes would be parsed as escape sequences on Windows.
    const relativePath = `../${basename(outsideDir)}/outside.md`;
    const result = await runCli(
      "compile",
      projectDir,
      buildSource(baseUrl, relativePath),
    );

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("must resolve inside");
  });

  test("rejects binary files renamed to .md during compilation", async () => {
    await writeFile(
      join(projectDir, "binary.md"),
      Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );

    const result = await runCli(
      "compile",
      projectDir,
      buildSource(baseUrl, "./binary.md"),
    );

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("PNG binary signature");
  });
});
