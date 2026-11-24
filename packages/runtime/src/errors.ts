import z from "zod";

export type AgentError =
  | {
      code: "AGENT_NOT_FOUND";
      agentName: string;
      message: string;
    }
  | {
      code: "RUNNER_NOT_SUPPORTED";
      agentName: string;
      runner: string;
      message: string;
    }
  | {
      code: "EXECUTION_ERROR";
      agentName: string;
      runner: string;
      exitCode: number | null;
      stderr: string;
      message: string;
    }
  | {
      code: "TIMEOUT_ERROR";
      agentName: string;
      timeoutMs: number;
      message: string;
    }
  | {
      code: "PARSE_ERROR";
      agentName: string;
      rawOutput: string;
      message: string;
    }
  | {
      code: "VALIDATION_ERROR";
      agentName: string;
      rawOutput: string;
      issues: z.core.$ZodIssue[];
      message: string;
    }
  | {
      code: "PROVIDER_NOT_FOUND";
      agentName: string;
      providerName: string;
      message: string;
    }
  | {
      code: "PROVIDER_NOT_SUPPORTED";
      agentName: string;
      protocol: string;
      message: string;
    }
  | {
      code: "PROVIDER_HTTP_ERROR";
      agentName: string;
      providerName: string;
      statusCode?: number;
      message: string;
    }
  | {
      code: "INPUT_TOO_LARGE";
      agentName: string;
      runner?: string;
      providerName?: string;
      message: string;
      retryable: false;
    };
