import type { AgentError } from "../errors";
import { err, type Result } from "../result";
import type { AgentConfig } from "./agentConfig";

export async function agentExecute(
  agent: AgentConfig,
  binary: string,
  args: string[],
): Promise<Result<string, AgentError>> {
  try {
    const process = Bun.spawn({
      cmd: [binary, ...args],
      cwd: agent.workspace,
      stdout: "pipe",
      stderr: "pipe",
    });

    let timedOut = false;
    const timer = agent.timeout
      ? setTimeout(() => {
          timedOut = true;
          process.kill();
        }, agent.timeout)
      : undefined;

    const [stdout, stderr, exitCode] = await Promise.all([
      process.stdout.getReader().read(),
      process.stderr.getReader().read(),
      process.exited,
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
      return err({
        code: "EXECUTION_ERROR",
        agentName: agent.name,
        runner: agent.runner,
        exitCode,
        stderr: new TextDecoder().decode(stderr.value),
        message: `Agent '${agent.name}' failed with exit code ${exitCode}.`,
      });
    }

    return {
      ok: true,
      value: new TextDecoder().decode(stdout.value).trim(),
    };
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
