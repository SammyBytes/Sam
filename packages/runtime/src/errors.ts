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
    }
  | {
      code: "CONTEXT_LIMIT_ERROR";
      agentName: string;
      providerName: string;
      statusCode?: number;
      message: string;
      retryable: false;
    };

const listContextLimitErrors = [
  "context_length_exceeded",
  "context_length_exceeded_max_tokens",
  "context_length_exceeded_max_prompt_tokens",
  "context_length_exceeded_max_response_tokens",
];

const listContextLimitErrorsTokens = [
  "context window exceeded max tokens",
  "context window exceeded max prompt tokens",
  "context window exceeded max response tokens",
  "input prompt length exceeds max_input_chars",
  "input exceeds the context length limit",
  "maximum context length",
  "reduce the length",
  "too many tokens",
  "prompt is too long",
  "please reduce the length of the messages",
  "your input exceeds the context window of this model.",
];

/**
 * Determines whether an error is a context limit error based on the status code and error text.
 * @param statusCode The HTTP status code of the response.
 * @param errorText The error message text from the response.
 * @returns True if the error is a context limit error, false otherwise.
 */
export function isContextLimitError(
  statusCode: number,
  errorText: string,
): boolean {
  const message = errorText.toLowerCase();
  return (
    statusCode === 413 ||
    ((statusCode === 400 || statusCode === 422) &&
      (listContextLimitErrors.some((e) => message.includes(e)) ||
        listContextLimitErrorsTokens.some((e) => message.includes(e))))
  );
}
