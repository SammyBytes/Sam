import { describe, expect, test } from "bun:test";
import { isContextLimitError } from "./errors";

describe("isContextLimitError", () => {
  test("treats HTTP 413 as a context limit error regardless of the message", () => {
    expect(isContextLimitError(413, "payload too large")).toBe(true);
  });

  test("detects max_input_chars messages on HTTP 400", () => {
    expect(
      isContextLimitError(
        400,
        "Input prompt length exceeds max_input_chars for this agent.",
      ),
    ).toBe(true);
  });

  test("detects known context limit markers on HTTP 422", () => {
    expect(
      isContextLimitError(422, "This model's maximum context length is 8192"),
    ).toBe(true);
    expect(
      isContextLimitError(400, "Error: context_length_exceeded"),
    ).toBe(true);
  });

  test("ignores other client errors", () => {
    expect(isContextLimitError(400, "invalid request body")).toBe(false);
    expect(isContextLimitError(401, "invalid api key")).toBe(false);
    expect(isContextLimitError(500, "internal server error")).toBe(false);
  });
});
