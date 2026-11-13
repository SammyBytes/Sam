import type { AgentError } from "../errors";
import { err, ok, type Result } from "../result";
import type { AgentConfig } from "./agentConfig";

const stripAnsi = (text: string): string =>
  text.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "").trim();

export async function agentExecute(
  agent: AgentConfig,
  binary: string,
  args: string[],
): Promise<Result<string, AgentError>> {
  try {
    const proc = Bun.spawn({
      cmd: [binary, ...args],
      cwd: agent.workspace,
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    });

    let timedOut = false;
    const timer = agent.timeout
      ? setTimeout(() => {
          timedOut = true;
          proc.kill();
        }, agent.timeout)
      : undefined;

    const [rawStdout, rawStderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);

    if (timer) clearTimeout(timer);

    if (timedOut) {
      return err({
        code: "TIMEOUT_ERROR",
        agentName: agent.name,
        timeoutMs: agent.timeout!,
        message: `Agent '${agent.name}' exceeded timeout of ${agent.timeout}ms.`,
      });
    }

    if (exitCode !== 0) {
      const cleanStderr = stripAnsi(rawStderr);
      const cleanStdout = stripAnsi(rawStdout);
      const details = [cleanStderr, cleanStdout].filter(Boolean).join("\n");

      return err({
        code: "EXECUTION_ERROR",
        agentName: agent.name,
        runner: agent.runner,
        exitCode,
        stderr: details,
        message: `Agent '${agent.name}' failed with exit code ${exitCode}.${details ? ` Details: ${details}` : ""}`,
      });
    }

    return ok(stripAnsi(rawStdout));
  } catch (error) {
    return err({
      code: "EXECUTION_ERROR",
      agentName: agent.name,
      runner: agent.runner,
      exitCode: null,
      stderr: error instanceof Error ? error.message : String(error),
      message: `Execution for agent '${agent.name}' failed.`,
    });
  }
}