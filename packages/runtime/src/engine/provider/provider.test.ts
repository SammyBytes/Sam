import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { z } from "zod";
import { createRuntime } from "..";

let server: ReturnType<typeof Bun.serve>;
let baseUrl: string;
let lastCapturedRequest: {
  url: string;
  authorization: string | null;
  body: Record<string, unknown>;
} | null = null;

beforeAll(() => {
  server = Bun.serve({
    port: 0, // Automatically assign an available port
    async fetch(req) {
      const url = new URL(req.url);

      if (url.pathname !== "/v1/chat/completions") {
        return new Response("Not Found", { status: 404 });
      }

      const body = (await req.json()) as Record<string, unknown>;
      lastCapturedRequest = {
        url: req.url,
        authorization: req.headers.get("authorization"),
        body,
      };

      const model = body.model as string;

      // Simulate HTTP 401 error
      if (model === "trigger-401") {
        return new Response(
          JSON.stringify({ error: { message: "Invalid API key" } }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }

      // Simulate slow response to test timeout handling
      if (model === "trigger-timeout") {
        await Bun.sleep(150);
        return Response.json({
          choices: [{ message: { content: "Too late" } }],
        });
      }

      // Simulate markdown-wrapped JSON response to test sanitization
      if (model === "trigger-markdown-json") {
        return Response.json({
          choices: [
            {
              message: {
                content: '```json\n{"approved": true, "score": 95}\n```',
              },
            },
          ],
        });
      }

      // Standard structured response when json_object format is requested
      if (
        body.response_format &&
        typeof body.response_format === "object" &&
        (body.response_format as { type?: string }).type === "json_object"
      ) {
        return Response.json({
          choices: [
            {
              message: {
                content: JSON.stringify({ approved: false, score: 42 }),
              },
            },
          ],
        });
      }

      // Plain text response for useUnsafe
      return Response.json({
        choices: [
          {
            message: {
              content: "Plain text summary from HTTP provider.",
            },
          },
        ],
      });
    },
  });

  baseUrl = `http://localhost:${server.port}/v1`;
});

afterAll(() => {
  server.stop(true);
});

describe("HTTP Provider Runtime Execution", () => {
  const ReviewSchema = z.object({
    approved: z.boolean(),
    score: z.number(),
  });

  test("executes safe sam.use() with OpenAI-compatible payload, headers, and Zod validation", async () => {
    const runtime = createRuntime(
      [
        {
          name: "StrictReviewer",
          provider: "MockOpenAI",
          model: "gpt-4o-mini",
          systemPrompt: "You are a code reviewer.",
          temperature: 0.1,
        },
      ],
      [
        {
          name: "MockOpenAI",
          protocol: "openai-compatible",
          baseUrl,
          apiKey: "sk-test-secret",
        },
      ],
    );

    const result = await runtime.use(
      "StrictReviewer",
      "Audit this function",
      ReviewSchema,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ approved: false, score: 42 });
    }

    // Verify the HTTP request payload and headers sent to the server
    expect(lastCapturedRequest).not.toBeNull();
    expect(lastCapturedRequest?.authorization).toBe("Bearer sk-test-secret");
    expect(lastCapturedRequest?.body.model).toBe("gpt-4o-mini");
    expect(lastCapturedRequest?.body.temperature).toBe(0.1);
    expect(lastCapturedRequest?.body.response_format).toEqual({
      type: "json_object",
    });

    const messages = lastCapturedRequest?.body.messages as Array<{
      role: string;
      content: string;
    }>;
    expect(messages[0]).toEqual({
      role: "system",
      content: "You are a code reviewer.",
    });
    expect(messages[1].role).toBe("user");
    expect(messages[1].content).toContain("Audit this function");
    expect(messages[1].content).toContain("JSON Schema:");
  });

  test("strips markdown code fences in sam.use() before Zod parsing", async () => {
    const runtime = createRuntime(
      [
        {
          name: "MarkdownAgent",
          provider: "MockOpenAI",
          model: "trigger-markdown-json",
        },
      ],
      [
        {
          name: "MockOpenAI",
          protocol: "openai-compatible",
          baseUrl,
        },
      ],
    );

    const result = await runtime.use(
      "MarkdownAgent",
      "Check this",
      ReviewSchema,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ approved: true, score: 95 });
    }
  });

  test("executes sam.useUnsafe() without response_format and returns raw string", async () => {
    const runtime = createRuntime(
      [
        {
          name: "Summarizer",
          provider: "MockOpenAI",
          model: "llama-3.3-70b",
        },
      ],
      [
        {
          name: "MockOpenAI",
          protocol: "openai-compatible",
          baseUrl,
        },
      ],
    );

    const result = await runtime.useUnsafe("Summarizer", "Summarize README");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe("Plain text summary from HTTP provider.");
    }
    expect(lastCapturedRequest?.body.response_format).toBeUndefined();
  });

  test("returns PROVIDER_HTTP_ERROR on non-2xx HTTP status codes", async () => {
    const runtime = createRuntime(
      [
        {
          name: "UnauthorizedAgent",
          provider: "MockOpenAI",
          model: "trigger-401",
        },
      ],
      [
        {
          name: "MockOpenAI",
          protocol: "openai-compatible",
          baseUrl,
          apiKey: "bad-key",
        },
      ],
    );

    const result = await runtime.useUnsafe("UnauthorizedAgent", "Hello");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PROVIDER_HTTP_ERROR");
      if (result.error.code === "PROVIDER_HTTP_ERROR") {
        expect(result.error.statusCode).toBe(401);
        expect(result.error.providerName).toBe("MockOpenAI");
      }
    }
  });

  test("returns TIMEOUT_ERROR when HTTP provider exceeds agent timeout", async () => {
    const runtime = createRuntime(
      [
        {
          name: "SlowAgent",
          provider: "MockOpenAI",
          model: "trigger-timeout",
          timeout: 30, // 30ms < 150ms server delay
        },
      ],
      [
        {
          name: "MockOpenAI",
          protocol: "openai-compatible",
          baseUrl,
        },
      ],
    );

    const result = await runtime.useUnsafe("SlowAgent", "Ping");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("TIMEOUT_ERROR");
    }
  });

  test("returns PROVIDER_NOT_FOUND when referencing an unregistered provider", async () => {
    const runtime = createRuntime(
      [
        {
          name: "OrphanAgent",
          provider: "MissingProvider",
          model: "gpt-4o",
        },
      ],
      [],
    );

    const result = await runtime.useUnsafe("OrphanAgent", "Hello");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PROVIDER_NOT_FOUND");
    }
  });
});