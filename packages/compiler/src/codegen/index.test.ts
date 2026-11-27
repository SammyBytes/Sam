import { test, expect } from "bun:test";
import { generateCode, Parser, tokenize } from "@sam-lang/compiler";

test("should generate TypeScript with Zod schemas from a .sb program", () => {
  const code = `
    schema SecurityAudit {
      has_vulnerabilities: boolean,
      risk_level: string
    }
  `;

  const tokens = tokenize(code);
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const output = generateCode(ast);

  expect(output).toContain('import { z } from "zod";');
  expect(output).not.toContain(
    'import { createRuntime } from "@sam-lang/runtime";',
  );
  expect(output).toContain("export const SecurityAuditSchema = z.object({");
  expect(output).toContain("has_vulnerabilities: z.boolean(),");
  expect(output).toContain("risk_level: z.string(),");
  expect(output).toContain(
    "export type SecurityAudit = z.infer<typeof SecurityAuditSchema>;",
  );
});

test("should generate Zod arrays and TypeScript array types for T[] annotations", () => {
  const code = `
    schema Item {
      name: string
    }

    schema Report {
      tags: string[],
      scores: number[][],
      items: Item[],
      flags: boolean[]
    }

    flow Process(tags: string[], matrix: number[][], items: Item[]) {}
  `;

  const output = generateCode(new Parser(tokenize(code)).parse());

  expect(output).toContain("tags: z.array(z.string()),");
  expect(output).toContain("scores: z.array(z.array(z.number())),");
  expect(output).toContain("items: z.array(ItemSchema),");
  expect(output).toContain("flags: z.array(z.boolean()),");
  expect(output).toContain(
    "export async function Process(tags: string[], matrix: number[][], items: Item[]) {",
  );
});

test("should generate array literals in flow bodies", () => {
  const code = `
    flow Lists() {
      let values = [1, 2, 3]
      let empty = []
      let nested = [[1], [2, 3]]
      return values
    }
  `;

  const output = generateCode(new Parser(tokenize(code)).parse());

  expect(output).toContain("const values = [1, 2, 3];");
  expect(output).toContain("const empty = [];");
  expect(output).toContain("const nested = [[1], [2, 3]];");
});

test("should generate runtime agent config for an agent declaration", () => {
  const code = `
    agent QuickAuditor {
      runner: opencode,
      workspace: "./src",
      timeout: 30
    }
  `;

  const tokens = tokenize(code);
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const output = generateCode(ast);

  expect(output).not.toContain('import { z } from "zod";');
  expect(output).toContain(
    'import { createRuntime, chunk } from "@sam-lang/runtime";',
  );
  expect(output).toContain("const sam = createRuntime([");
  expect(output).toContain(
    '{ name: "QuickAuditor", runner: "opencode", workspace: "./src", timeout: 30000 }',
  );
  expect(output).not.toContain("Bun.spawn");
});

test("should generate combined TypeScript for schemas and agents", () => {
  const code = `
    schema Report {
      status: string
    }

    agent CodeReviewer {
      runner: opencode,
      workspace: "./src"
    }
  `;

  const tokens = tokenize(code);
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const output = generateCode(ast);

  expect(output).toContain('import { z } from "zod";');
  expect(output).toContain(
    'import { createRuntime, chunk } from "@sam-lang/runtime";',
  );
  expect(output).toContain("export const ReportSchema = z.object({");
  expect(output).toContain("const sam = createRuntime([");
  expect(output).toContain(
    '{ name: "CodeReviewer", runner: "opencode", workspace: "./src" }',
  );
});

test("should return an empty string for an empty program", () => {
  const output = generateCode({ type: "Program", body: [] });
  expect(output).toBe("");
});

test("should generate async function for a complete program with schema, agent and flow", () => {
  const code = `
    schema AuditReport {
      passed: boolean,
      summary: string
    }

    agent SecurityAuditor {
      runner: opencode,
      workspace: "./src"
    }

    agent QuickSummarizer {
      runner: opencode,
      workspace: "./src"
    }

    flow RunSecurityPipeline(target: string) {
      let audit = use SecurityAuditor<AuditReport>(target)
      if (!audit.ok) {
        let fallback = use unsafe QuickSummarizer("fallback summary")
        return fallback
      }
      return audit.value
    }
  `;

  const tokens = tokenize(code);
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const output = generateCode(ast);

  // Imports and base structure
  expect(output).toContain('import { z } from "zod";');
  expect(output).toContain(
    'import { createRuntime, chunk } from "@sam-lang/runtime";',
  );
  expect(output).toContain("export const AuditReportSchema = z.object({");
  expect(output).toContain("const sam = createRuntime([");

  // Flow function signature and body
  expect(output).toContain(
    "export async function RunSecurityPipeline(target: string) {",
  );
  expect(output).toContain(
    '  const audit = await sam.use("SecurityAuditor", target, AuditReportSchema);',
  );
  expect(output).toContain("  if (!audit.ok) {");
  expect(output).toContain(
    '    const fallback = await sam.useUnsafe("QuickSummarizer", "fallback summary");',
  );
  expect(output).toContain("    return fallback;");
  expect(output).toContain("  }");
  expect(output).toContain("  return audit.value;");

  // Order: Schema -> Runtime Initialization -> Flow Function
  expect(output.indexOf("AuditReportSchema")).toBeLessThan(
    output.indexOf("const sam ="),
  );
  expect(output.indexOf("const sam =")).toBeLessThan(
    output.indexOf("export async function RunSecurityPipeline"),
  );
});

test("should generate template literals and chained agent responses", () => {
  const code = `
    schema Draft {
      body: string
    }

    agent Writer {
      runner: mock
      workspace: "."
    }

    agent Reviewer {
      runner: mock
      workspace: "."
    }

    flow main(input: string) {
      let draft = use Writer<Draft>(input)
      if (!draft.ok) {
        return draft
      }
      let review = use unsafe Reviewer(\`Review this: \${draft.value.body}\`)
      if (!review.ok) {
        return review
      }
      return review.value
    }
  `;

  const ast = new Parser(tokenize(code)).parse();
  const output = generateCode(ast);

  expect(output).toContain(
    'const review = await sam.useUnsafe("Reviewer", `Review this: ${draft.value.body}`);',
  );
});

test("should omit export keyword for private flows", () => {
  const code = `
    private flow InternalHelper(input: string) {
      return input
    }
  `;

  const tokens = tokenize(code);
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const output = generateCode(ast);

  expect(output).toContain("async function InternalHelper(input: string) {");
  expect(output).not.toContain("export async function InternalHelper");
});
test("should normalize equality operators and generate clean createRuntime([]) when no agents are declared", () => {
  const code = `
    flow CheckStatus(status: string, attempt: number) {
      if (status == "ok") {
        return true
      } else {
        if (attempt != 0) {
          return false
        }
        return true
      }
    }
  `;

  const tokens = tokenize(code);
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const output = generateCode(ast);

  expect(output).toContain(
    'import { createRuntime, chunk } from "@sam-lang/runtime";',
  );
  expect(output).toContain("const sam = createRuntime([]);");
  expect(output).not.toContain('import { z } from "zod";');
  expect(output).toContain('if (status === "ok") {');
  expect(output).toContain("} else {");
  expect(output).toContain("  if (attempt !== 0) {");
});

test("should support inter-flow calls, private flows, forward references, and chained property access", () => {
  const code = `
    flow RunReleaseGate(findings: number, target: string) {
      let severity = EvaluateSeverity(findings, 5)
      if (severity == "critical") {
        return "blocked"
      }

      if (FetchApprovalStatus(target).approved) {
        return "released"
      }

      return "pending"
    }

    private flow EvaluateSeverity(findings: number, maxAllowed: number) {
      if (findings > maxAllowed) {
        return "critical"
      }
      return "clean"
    }

    private flow FetchApprovalStatus(target: string) {
      return target
    }
  `;

  const tokens = tokenize(code);
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const output = generateCode(ast);

  expect(output).toContain(
    "export async function RunReleaseGate(findings: number, target: string) {",
  );
  expect(output).toContain(
    "async function EvaluateSeverity(findings: number, maxAllowed: number) {",
  );
  expect(output).not.toContain("export async function EvaluateSeverity");
  expect(output).toContain(
    "async function FetchApprovalStatus(target: string) {",
  );
  expect(output).not.toContain("export async function FetchApprovalStatus");

  // Forward reference: RunReleaseGate call to flows declared below and injects await
  expect(output).toContain(
    "const severity = (await EvaluateSeverity(findings, 5));",
  );

  // About the regex: it matches both `(await FetchApprovalStatus(target)).approved` and `await FetchApprovalStatus(target).approved`
  expect(output).toMatch(
    /if \(\(await FetchApprovalStatus\(target\)\)\.approved|if \(await FetchApprovalStatus\(target\)\.approved/,
  );
});

test("should throw an error on duplicate flow declarations", () => {
  const code = `
    flow ProcessData(x: string) {
      return x
    }

    private flow ProcessData(y: string) {
      return y
    }
  `;

  expect(() => {
    const ast = new Parser(tokenize(code)).parse();
    generateCode(ast);
  }).toThrow();
});
test("should generate providers array and pass it to createRuntime when providers are declared", () => {
  const code = `
    provider Groq {
      protocol: "openai-compatible"
      base_url: "https://api.groq.com/openai/v1"
      api_key: env("GROQ_API_KEY")
    }

    agent FastReviewer {
      provider: Groq
      model: "llama-3.3-70b-versatile"
      system_prompt: "Be concise."
      temperature: 0.2
      timeout: 15
    }
  `;

  const tokens = tokenize(code);
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const output = generateCode(ast);

  expect(output).toContain(
    'import { createRuntime, chunk } from "@sam-lang/runtime";',
  );
  expect(output).toContain("const providers = [");
  expect(output).toContain(
    '{ name: "Groq", protocol: "openai-compatible", baseUrl: "https://api.groq.com/openai/v1", apiKey: Bun.env.GROQ_API_KEY ?? "" }',
  );
  expect(output).toContain("const sam = createRuntime([");
  expect(output).toContain(
    '{ name: "FastReviewer", provider: "Groq", model: "llama-3.3-70b-versatile", systemPrompt: "Be concise.", temperature: 0.2, timeout: 15000 }',
  );
  expect(output).toContain("], providers);");
});

test("should resolve env() for provider base_url and agent model/system_prompt", () => {
  const code = `
    provider EnvProvider {
      protocol: "openai-compatible"
      base_url: env("PROVIDER_BASE_URL")
      api_key: env("PROVIDER_API_KEY")
    }

    agent EnvAgent {
      provider: EnvProvider
      model: env("PROVIDER_MODEL")
      system_prompt: env("PROVIDER_SYSTEM_PROMPT")
    }
  `;

  const tokens = tokenize(code);
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const output = generateCode(ast);

  expect(output).toContain('baseUrl: Bun.env.PROVIDER_BASE_URL ?? ""');
  expect(output).toContain('apiKey: Bun.env.PROVIDER_API_KEY ?? ""');
  expect(output).toContain(
    'model: Bun.env.PROVIDER_MODEL ?? "", systemPrompt: Bun.env.PROVIDER_SYSTEM_PROMPT ?? ""',
  );
  expect(output).not.toContain('baseUrl: "PROVIDER_BASE_URL"');
});

test("should generate hybrid program mixing HTTP provider agents and local CLI runner agents", () => {
  const code = `
    schema Finding {
      severity: string
    }

    provider OpenRouter {
      protocol: "openai-compatible"
      base_url: "https://openrouter.ai/api/v1"
    }

    agent CloudClassifier {
      provider: OpenRouter
      model: "anthropic/claude-3.5-sonnet"
    }

    agent LocalFixer {
      runner: opencode
      workspace: "./src"
    }

    flow HybridPipeline(codeSnippet: string) {
      let classification = use CloudClassifier<Finding>(codeSnippet)
      if (!classification.ok) {
        return use unsafe LocalFixer(codeSnippet)
      }
      return classification.value
    }
  `;

  const tokens = tokenize(code);
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const output = generateCode(ast);

  expect(output).toContain("export const FindingSchema = z.object({");
  expect(output).toContain("const providers = [");
  expect(output).toContain(
    '{ name: "OpenRouter", protocol: "openai-compatible", baseUrl: "https://openrouter.ai/api/v1" }',
  );
  expect(output).toContain(
    '{ name: "CloudClassifier", provider: "OpenRouter", model: "anthropic/claude-3.5-sonnet" }',
  );
  expect(output).toContain(
    '{ name: "LocalFixer", runner: "opencode", workspace: "./src" }',
  );
  expect(output).toContain("], providers);");
  expect(output).toContain(
    'await sam.use("CloudClassifier", codeSnippet, FindingSchema)',
  );
  expect(output).toContain('await sam.useUnsafe("LocalFixer", codeSnippet)');
});

test("should generate strictSchema, maxTokens, and retries config fields", () => {
  const code = `
    provider Groq {
      protocol: "openai-compatible"
      base_url: "https://api.groq.com/openai/v1"
      strict_schema: true
    }

    agent Reviewer {
      provider: Groq
      model: "openai/gpt-oss-20b"
      temperature: 0
      max_tokens: 2048
      retries: 3
      reasoning_effort: "low"
    }
  `;

  const output = generateCode(new Parser(tokenize(code)).parse());

  expect(output).toContain(
    '{ name: "Groq", protocol: "openai-compatible", baseUrl: "https://api.groq.com/openai/v1", strictSchema: true }',
  );
  expect(output).toContain(
    '{ name: "Reviewer", provider: "Groq", model: "openai/gpt-oss-20b", temperature: 0, maxTokens: 2048, retries: 3, reasoningEffort: "low" }',
  );
});

test("should omit strictSchema when the provider does not enable it", () => {
  const code = `
    provider Compatible {
      protocol: "openai-compatible"
      base_url: "http://localhost:11434/v1"
    }

    agent Reviewer {
      provider: Compatible
      model: "llama3"
      max_tokens: 256
      retries: 0
    }
  `;

  const output = generateCode(new Parser(tokenize(code)).parse());

  expect(output).toContain(
    '{ name: "Compatible", protocol: "openai-compatible", baseUrl: "http://localhost:11434/v1" }',
  );
  expect(output).toContain("maxTokens: 256, retries: 0");
});
test("should generate the maxInputChars config field when max_input_chars is set", () => {
  const code = `
    provider Groq {
      protocol: "openai-compatible"
      base_url: "https://api.groq.com/openai/v1"
    }

    agent Reviewer {
      provider: Groq
      model: "openai/gpt-oss-20b"
      max_input_chars: 8000
    }
  `;

  const output = generateCode(new Parser(tokenize(code)).parse());

  expect(output).toContain(
    '{ name: "Reviewer", provider: "Groq", model: "openai/gpt-oss-20b", maxInputChars: 8000 }',
  );
});

test("should generate maxInputChars for a local runner agent", () => {
  const code = `
    agent LocalReviewer {
      runner: opencode
      workspace: "./src"
      max_input_chars: 12000
    }
  `;

  const output = generateCode(new Parser(tokenize(code)).parse());

  expect(output).toContain(
    '{ name: "LocalReviewer", runner: "opencode", workspace: "./src", maxInputChars: 12000 }',
  );
});

test("should omit maxInputChars when max_input_chars is not set", () => {
  const code = `
    agent LocalReviewer {
      runner: opencode
      workspace: "./src"
    }
  `;

  const output = generateCode(new Parser(tokenize(code)).parse());

  expect(output).not.toContain("maxInputChars");
});

test("should generate Claude Code runner options for a local agent", () => {
  const code = `
    agent ClaudeReviewer {
      runner: claude,
      workspace: "./src",
      model: "sonnet",
      permission_mode: "acceptEdits",
      max_turns: 4,
      fallback_model: "haiku",
      allowed_tools: "Read, Grep",
      disallowed_tools: "Bash",
      max_budget_usd: 2.5,
      bare: true,
      reasoning_effort: "high",
      timeout: 30
    }
  `;

  const ast = new Parser(tokenize(code)).parse();
  const output = generateCode(ast);

  expect(output).toContain(
    '{ name: "ClaudeReviewer", runner: "claude", workspace: "./src", model: "sonnet", permissionMode: "acceptEdits", maxTurns: 4, fallbackModel: "haiku", allowedTools: "Read, Grep", disallowedTools: "Bash", maxBudgetUsd: 2.5, bare: true, reasoningEffort: "high", timeout: 30000 }',
  );
});

test("should not emit Claude Code runner options for provider agents", () => {
  const code = `
    provider Groq {
      protocol: "openai-compatible",
      base_url: "https://api.groq.com/openai/v1",
      api_key: "test"
    }

    agent Reviewer {
      provider: Groq,
      model: "test-model",
      permission_mode: "acceptEdits",
      max_turns: 4,
      bare: true
    }
  `;

  const ast = new Parser(tokenize(code)).parse();
  const output = generateCode(ast);

  expect(output).not.toContain("permissionMode");
  expect(output).not.toContain("maxTurns");
  expect(output).not.toContain("bare");
});

test("should import chunk from runtime and emit synchronous chunk() calls", () => {
  const code = `
    flow SplitDoc(doc: string) {
      let parts = chunk(doc, 2000)
      return parts
    }
  `;

  const output = generateCode(new Parser(tokenize(code)).parse());

  expect(output).toContain(
    'import { createRuntime, chunk } from "@sam-lang/runtime";',
  );
  expect(output).toContain("const parts = chunk(doc, 2000);");
  expect(output).not.toContain("await chunk");
});

test("should generate for...of loops when iterating over a variable", () => {
  const code = `
    flow IterateChunks(chunks: string[]) {
      for part in chunks {
        let current = part
      }
      return "done"
    }
  `;

  const output = generateCode(new Parser(tokenize(code)).parse());

  expect(output).toContain("for (const part of chunks) {");
  expect(output).toContain("    const current = part;");
});

test("should generate for...of loops over chunk() and import chunk from runtime", () => {
  const code = `
    flow IterateDoc(doc: string) {
      for part in chunk(doc, 2000) {
        let current = part
      }
      return "done"
    }
  `;

  const output = generateCode(new Parser(tokenize(code)).parse());

  expect(output).toContain(
    'import { createRuntime, chunk } from "@sam-lang/runtime";',
  );
  expect(output).toContain("for (const part of chunk(doc, 2000)) {");
  expect(output).not.toContain("await chunk");
});

test("should generate break, continue, early return and agent calls inside a for loop", () => {
  const code = `
    schema Finding {
      severity: string
    }

    agent Auditor {
      runner: mock
      workspace: "."
    }

    flow ReviewAll(doc: string) {
      let chunks = chunk(doc, 2000)
      for part in chunks {
        let finding = use Auditor<Finding>(part)
        if (finding.value.severity == "critical") {
          break
        }
        if (finding.value.severity == "low") {
          continue
        }
        if (!finding.ok) {
          return finding
        }
      }
      return "done"
    }
  `;

  const output = generateCode(new Parser(tokenize(code)).parse());

  expect(output).toContain("  for (const part of chunks) {");
  // Agent calls inside the loop are awaited and indented two levels deep.
  expect(output).toContain(
    '    const finding = await sam.use("Auditor", part, FindingSchema);',
  );
  expect(output).toContain("      break;");
  expect(output).toContain("      continue;");
  expect(output).toContain("      return finding;");
  expect(output).toContain("  return \"done\";");
});

test("should collect yielded values from a for-expression into an immutable array", () => {
  const code = `
    schema Summary {
      text: string
    }

    agent Summarizer {
      runner: mock
      workspace: "."
    }

    flow Summarize(items: string[]) {
      let summaries = for item in items {
        let result = use Summarizer<Summary>(item)
        if (!result.ok) {
          return result
        }
        yield result.value
      }
      return summaries
    }
  `;

  const output = generateCode(new Parser(tokenize(code)).parse());

  expect(output).toContain("const _loop_summaries = await (async () => {");
  expect(output).toContain("const _acc: any[] = [];");
  expect(output).toContain("for (const item of items) {");
  expect(output).toContain("_acc.push(result.value);");
  expect(output).toContain("const summaries = _loop_summaries.value;");
  expect(output).toContain("return summaries;");
});

test("should propagate early returns from a nested for-expression", () => {
  const code = `
    flow Nested() {
      let outer = for a in ["A1", "A2"] {
        let inner = for b in ["B1", "STOP"] {
          if (b == "STOP") {
            return "aborted"
          }
          yield b
        }
        yield inner
      }
      return outer
    }
  `;

  const output = generateCode(new Parser(tokenize(code)).parse());

  expect(output).toContain(
    "if (_loop_inner.__samReturn) return { __samReturn: true as const, value: _loop_inner.value };",
  );
  expect(output).toContain("if (_loop_outer.__samReturn) return _loop_outer.value;");
});
