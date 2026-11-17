import { test, expect } from "bun:test";
import { Parser, tokenize } from "@sam-lang/compiler";

test("should build a valid AST from an empty public flow", () => {
  const code = `flow Basic() {}`;

  const tokens = tokenize(code);
  const parser = new Parser(tokens);
  const ast = parser.parse();

  expect(ast.type).toBe("Program");
  expect(ast.body.length).toBe(1);

  const flow = ast.body[0];
  expect(flow.type).toBe("FlowDeclaration");

  if (flow.type === "FlowDeclaration") {
    expect(flow.name).toBe("Basic");
    expect(flow.isPrivate).toBe(false);
    expect(flow.params).toEqual([]);
    expect(flow.body).toEqual([]);
  }
});

test("should parse a private flow with typed parameters", () => {
  const code = `private flow Audit(target: string, retries: number) {}`;

  const tokens = tokenize(code);
  const parser = new Parser(tokens);
  const ast = parser.parse();

  const flow = ast.body[0];
  expect(flow.type).toBe("FlowDeclaration");

  if (flow.type === "FlowDeclaration") {
    expect(flow.name).toBe("Audit");
    expect(flow.isPrivate).toBe(true);
    expect(flow.params).toEqual([
      { name: "target", type: "string" },
      { name: "retries", type: "number" },
    ]);
  }
});

test("should parse LetStatement and ExpressionStatement inside flow body", () => {
  const code = `
    flow Copy(source: string) {
      let backup = source
      backup
    }
  `;

  const tokens = tokenize(code);
  const parser = new Parser(tokens);
  const ast = parser.parse();

  const flow = ast.body[0];
  expect(flow.type).toBe("FlowDeclaration");

  if (flow.type === "FlowDeclaration") {
    expect(flow.body).toHaveLength(2);
    expect(flow.body[0]).toEqual({
      type: "LetStatement",
      name: "backup",
      value: {
        type: "Identifier",
        name: "source",
      },
    });
    expect(flow.body[1]).toEqual({
      type: "ExpressionStatement",
      expression: {
        type: "Identifier",
        name: "backup",
      },
    });
  }
});

test("should throw SyntaxError on invalid flow parameters or let syntax", () => {
  const missingComma = `flow Bad(a: string b: number) {}`;
  const trailingComma = `flow Bad(a: string,) {}`;
  const missingEquals = `flow Bad() { let x y }`;

  expect(() => new Parser(tokenize(missingComma)).parse()).toThrow();
  expect(() => new Parser(tokenize(trailingComma)).parse()).toThrow();
  expect(() => new Parser(tokenize(missingEquals)).parse()).toThrow();
});
test("should parse primitive literals (string, number, boolean) in let statements", () => {
  const code = `
    flow Config() {
      let greeting = "hello"
      let maxRetries = 3
      let isEnabled = true
    }
  `;

  const tokens = tokenize(code);
  const parser = new Parser(tokens);
  const ast = parser.parse();

  const flow = ast.body[0];
  expect(flow.type).toBe("FlowDeclaration");

  if (flow.type === "FlowDeclaration") {
    expect(flow.body).toHaveLength(3);
    expect(flow.body[0]).toEqual({
      type: "LetStatement",
      name: "greeting",
      value: { type: "Literal", value: "hello" },
    });
    expect(flow.body[1]).toEqual({
      type: "LetStatement",
      name: "maxRetries",
      value: { type: "Literal", value: 3 },
    });
    expect(flow.body[2]).toEqual({
      type: "LetStatement",
      name: "isEnabled",
      value: { type: "Literal", value: true },
    });
  }
});

test("should parse IfStatement with else branch and ReturnStatement", () => {
  const code = `
    flow Check(isReady: boolean) {
      if (isReady) {
        return "ok"
      } else {
        return false
      }
    }
  `;

  const tokens = tokenize(code);
  const parser = new Parser(tokens);
  const ast = parser.parse();

  const flow = ast.body[0];
  expect(flow.type).toBe("FlowDeclaration");

  if (flow.type === "FlowDeclaration") {
    expect(flow.body).toHaveLength(1);
    expect(flow.body[0]).toEqual({
      type: "IfStatement",
      condition: { type: "Identifier", name: "isReady" },
      thenBranch: [
        {
          type: "ReturnStatement",
          value: { type: "Literal", value: "ok" },
        },
      ],
      elseBranch: [
        {
          type: "ReturnStatement",
          value: { type: "Literal", value: false },
        },
      ],
    });
  }
});

test("should parse IfStatement without else and empty ReturnStatement", () => {
  const code = `
    flow Guard(skip: boolean) {
      if (skip) {
        return
      }
      return 1
    }
  `;

  const tokens = tokenize(code);
  const parser = new Parser(tokens);
  const ast = parser.parse();

  const flow = ast.body[0];
  expect(flow.type).toBe("FlowDeclaration");

  if (flow.type === "FlowDeclaration") {
    expect(flow.body).toHaveLength(2);
    expect(flow.body[0]).toEqual({
      type: "IfStatement",
      condition: { type: "Identifier", name: "skip" },
      thenBranch: [
        {
          type: "ReturnStatement",
          value: undefined,
        },
      ],
      elseBranch: undefined,
    });
    expect(flow.body[1]).toEqual({
      type: "ReturnStatement",
      value: { type: "Literal", value: 1 },
    });
  }
});

test("should throw SyntaxError on malformed if statements", () => {
  const missingParens = `flow Bad(x: boolean) { if x { return } }`;
  const missingBlock = `flow Bad(x: boolean) { if (x) return }`;

  expect(() => new Parser(tokenize(missingParens)).parse()).toThrow();
  expect(() => new Parser(tokenize(missingBlock)).parse()).toThrow();
});

test("should parse MemberExpression for nested property access", () => {
  const code = `
    flow Inspect(audit: any) {
      let level = audit.value.risk_level
      return level
    }
  `;

  const tokens = tokenize(code);
  const parser = new Parser(tokens);
  const ast = parser.parse();

  const flow = ast.body[0];
  expect(flow.type).toBe("FlowDeclaration");

  if (flow.type === "FlowDeclaration") {
    expect(flow.body[0]).toEqual({
      type: "LetStatement",
      name: "level",
      value: {
        type: "MemberExpression",
        object: {
          type: "MemberExpression",
          object: { type: "Identifier", name: "audit" },
          property: "value",
        },
        property: "risk_level",
      },
    });
  }
});

test("should parse UnaryExpression (!) and BinaryExpression (==, !=, <, >)", () => {
  const code = `
    flow Validate(res: any, count: number) {
      if (!res.ok) {
        return false
      }
      if (res.status != "error") {
        let isHigh = count > 10
        return isHigh
      }
      return res.code == 200
    }
  `;

  const tokens = tokenize(code);
  const parser = new Parser(tokens);
  const ast = parser.parse();

  const flow = ast.body[0];
  expect(flow.type).toBe("FlowDeclaration");

  if (flow.type === "FlowDeclaration") {
    expect(flow.body).toHaveLength(3);

    // 1. if (!res.ok)
    expect(flow.body[0]).toEqual({
      type: "IfStatement",
      condition: {
        type: "UnaryExpression",
        operator: "!",
        argument: {
          type: "MemberExpression",
          object: { type: "Identifier", name: "res" },
          property: "ok",
        },
      },
      thenBranch: [
        {
          type: "ReturnStatement",
          value: { type: "Literal", value: false },
        },
      ],
      elseBranch: undefined,
    });

    // 2. if (res.status != "error")
    expect(flow.body[1]).toEqual({
      type: "IfStatement",
      condition: {
        type: "BinaryExpression",
        operator: "!=",
        left: {
          type: "MemberExpression",
          object: { type: "Identifier", name: "res" },
          property: "status",
        },
        right: { type: "Literal", value: "error" },
      },
      thenBranch: [
        {
          type: "LetStatement",
          name: "isHigh",
          value: {
            type: "BinaryExpression",
            operator: ">",
            left: { type: "Identifier", name: "count" },
            right: { type: "Literal", value: 10 },
          },
        },
        {
          type: "ReturnStatement",
          value: { type: "Identifier", name: "isHigh" },
        },
      ],
      elseBranch: undefined,
    });

    // 3. return res.code == 200
    expect(flow.body[2]).toEqual({
      type: "ReturnStatement",
      value: {
        type: "BinaryExpression",
        operator: "==",
        left: {
          type: "MemberExpression",
          object: { type: "Identifier", name: "res" },
          property: "code",
        },
        right: { type: "Literal", value: 200 },
      },
    });
  }
});

test("should throw SyntaxError on incomplete binary or member expressions", () => {
  const trailingDot = `flow Bad(a: any) { let x = a. }`;
  const missingRightSide = `flow Bad(a: number) { if (a == ) { return } }`;

  expect(() => new Parser(tokenize(trailingDot)).parse()).toThrow();
  expect(() => new Parser(tokenize(missingRightSide)).parse()).toThrow();
});

test("should parse safe and unsafe UseExpression inside flow body", () => {
  const code = `
    flow RunAudit(target: string) {
      let safeRes = use SecurityAuditor<AuditReport>(target)
      let rawRes = use unsafe QuickSummarizer("summarize this")
      return safeRes.value
    }
  `;

  const tokens = tokenize(code);
  const parser = new Parser(tokens);
  const ast = parser.parse();

  const flow = ast.body[0];
  expect(flow.type).toBe("FlowDeclaration");

  if (flow.type === "FlowDeclaration") {
    expect(flow.body).toHaveLength(3);

    // 1. Safe use: use SecurityAuditor<AuditReport>(target)
    expect(flow.body[0]).toEqual({
      type: "LetStatement",
      name: "safeRes",
      value: {
        type: "UseExpression",
        variant: "safe",
        agentName: "SecurityAuditor",
        schema: "AuditReport",
        inputPrompt: { type: "Identifier", name: "target" },
      },
    });

    // 2. Unsafe use: use unsafe QuickSummarizer("summarize this")
    expect(flow.body[1]).toEqual({
      type: "LetStatement",
      name: "rawRes",
      value: {
        type: "UseExpression",
        variant: "unsafe",
        agentName: "QuickSummarizer",
        schema: undefined,
        inputPrompt: { type: "Literal", value: "summarize this" },
      },
    });
  }
});

test("should parse template literals with interpolated expressions", () => {
  const code = `
    flow BuildPrompt(draft: string, reviewer: string) {
      let prompt = \`Review from \${reviewer}: \${draft}\`
      return prompt
    }
  `;

  const ast = new Parser(tokenize(code)).parse();
  const flow = ast.body[0];

  expect(flow.type).toBe("FlowDeclaration");
  if (flow.type === "FlowDeclaration") {
    const statement = flow.body[0];
    expect(statement.type).toBe("LetStatement");
    if (statement.type === "LetStatement") {
      expect(statement.value).toEqual({
        type: "TemplateLiteral",
        quasis: [
          { type: "TemplateElement", value: "Review from " },
          { type: "TemplateElement", value: ": " },
          { type: "TemplateElement", value: "" },
        ],
        expressions: [
          { type: "Identifier", name: "reviewer" },
          { type: "Identifier", name: "draft" },
        ],
      });
    }
  }
});

test("should throw SyntaxError on invalid UseExpression schema combinations", () => {
  const safeWithoutSchema = `flow Bad() { let x = use Auditor("hi") }`;
  const unsafeWithSchema = `flow Bad() { let x = use unsafe Auditor<Report>("hi") }`;

  expect(() => new Parser(tokenize(safeWithoutSchema)).parse()).toThrow();
  expect(() => new Parser(tokenize(unsafeWithSchema)).parse()).toThrow();
});

test("should parse a valid ProviderDeclaration connected to an AgentDeclaration", () => {
  const code = `
    provider Groq {
      protocol: "openai-compatible"
      base_url: "https://api.groq.com/openai/v1"
      api_key: env("GROQ_API_KEY")
    }

    agent Reviewer {
      provider: Groq
      model: "llama-3.3-70b-versatile"
      system_prompt: "You are a strict security auditor."
      temperature: 0.1
    }
  `;

  const tokens = tokenize(code);
  const parser = new Parser(tokens);
  const ast = parser.parse();

  expect(ast.type).toBe("Program");
  expect(ast.body).toHaveLength(2);

  const provider = ast.body[0];
  expect(provider.type).toBe("ProviderDeclaration");

  if (provider.type === "ProviderDeclaration") {
    expect(provider.name).toBe("Groq");
    expect(provider.properties).toEqual([
      {
        type: "ProviderProperty",
        name: "protocol",
        value: { type: "StringLiteral", value: "openai-compatible" },
      },
      {
        type: "ProviderProperty",
        name: "base_url",
        value: {
          type: "StringLiteral",
          value: "https://api.groq.com/openai/v1",
        },
      },
      {
        type: "ProviderProperty",
        name: "api_key",
        value: { type: "EnvLiteral", value: "GROQ_API_KEY" },
      },
    ]);
  }

  const agent = ast.body[1];
  expect(agent.type).toBe("AgentDeclaration");

  if (agent.type === "AgentDeclaration") {
    expect(agent.name).toBe("Reviewer");
    expect(agent.properties).toContainEqual({
      type: "AgentProperty",
      name: "provider",
      value: { type: "Identifier", value: "Groq" },
    });
  }
});

test("should allow env() for agent model, workspace, and system_prompt", () => {
  const code = `
    agent LocalAgent {
      runner: opencode
      workspace: env("AGENT_WORKSPACE")
      model: env("AGENT_MODEL")
      system_prompt: env("AGENT_SYSTEM_PROMPT")
    }
  `;

  const ast = new Parser(tokenize(code)).parse();
  const agent = ast.body[0];

  expect(agent.type).toBe("AgentDeclaration");
  if (agent.type === "AgentDeclaration") {
    expect(agent.properties).toContainEqual({
      type: "AgentProperty",
      name: "workspace",
      value: { type: "EnvLiteral", value: "AGENT_WORKSPACE" },
    });
    expect(agent.properties).toContainEqual({
      type: "AgentProperty",
      name: "model",
      value: { type: "EnvLiteral", value: "AGENT_MODEL" },
    });
    expect(agent.properties).toContainEqual({
      type: "AgentProperty",
      name: "system_prompt",
      value: { type: "EnvLiteral", value: "AGENT_SYSTEM_PROMPT" },
    });
  }
});

test("should throw on invalid or incomplete ProviderDeclaration properties", () => {
  const missingBaseUrl = `
    provider Groq {
      protocol: "openai-compatible"
    }
  `;

  const invalidProtocol = `
    provider Groq {
      protocol: "unsupported-protocol"
      base_url: "https://api.groq.com/openai/v1"
    }
  `;

  const unknownProperty = `
    provider Groq {
      protocol: "openai-compatible"
      base_url: "https://api.groq.com/openai/v1"
      model: "llama-3.3-70b-versatile"
    }
  `;

  const duplicateProperty = `
    provider Groq {
      protocol: "openai-compatible"
      base_url: "https://api.groq.com/openai/v1"
      base_url: "https://api.groq.com/openai/v2"
    }
  `;

  expect(() => new Parser(tokenize(missingBaseUrl)).parse()).toThrow();
  expect(() => new Parser(tokenize(invalidProtocol)).parse()).toThrow();
  expect(() => new Parser(tokenize(unknownProperty)).parse()).toThrow();
  expect(() => new Parser(tokenize(duplicateProperty)).parse()).toThrow();
});

test("should enforce strict agent rules when using provider vs runner", () => {
  const bothProviderAndRunner = `
    provider Groq {
      protocol: "openai-compatible"
      base_url: "https://api.groq.com/openai/v1"
    }
    agent BadAgent {
      provider: Groq
      runner: opencode
      model: "llama-3.3-70b-versatile"
    }
  `;

  const neitherProviderNorRunner = `
    agent OrphanAgent {
      model: "llama-3.3-70b-versatile"
    }
  `;

  const providerWithWorkspace = `
    provider Groq {
      protocol: "openai-compatible"
      base_url: "https://api.groq.com/openai/v1"
    }
    agent BadHttpAgent {
      provider: Groq
      model: "llama-3.3-70b-versatile"
      workspace: "./src"
    }
  `;

  const providerWithoutModel = `
    provider Groq {
      protocol: "openai-compatible"
      base_url: "https://api.groq.com/openai/v1"
    }
    agent ModelLessAgent {
      provider: Groq
    }
  `;

  expect(() => new Parser(tokenize(bothProviderAndRunner)).parse()).toThrow();
  expect(() =>
    new Parser(tokenize(neitherProviderNorRunner)).parse(),
  ).toThrow();
  expect(() => new Parser(tokenize(providerWithWorkspace)).parse()).toThrow();
  expect(() => new Parser(tokenize(providerWithoutModel)).parse()).toThrow();
});

test("should throw SemanticError on duplicate declarations, unknown providers, or unused providers", () => {
  const unknownProviderRef = `
    agent Reviewer {
      provider: NonExistentProvider
      model: "llama-3.3-70b-versatile"
    }
  `;

  const unusedProvider = `
    provider UnusedGroq {
      protocol: "openai-compatible"
      base_url: "https://api.groq.com/openai/v1"
    }

    flow Main() {}
  `;

  const duplicateIdentifier = `
    provider Groq {
      protocol: "openai-compatible"
      base_url: "https://api.groq.com/openai/v1"
    }

    agent Groq {
      provider: Groq
      model: "llama-3.3-70b-versatile"
    }
  `;

  expect(() => new Parser(tokenize(unknownProviderRef)).parse()).toThrow();
  expect(() => new Parser(tokenize(unusedProvider)).parse()).toThrow();
  expect(() => new Parser(tokenize(duplicateIdentifier)).parse()).toThrow();
});

test("should parse provider strict_schema and agent max_tokens and retries", () => {
  const code = `
    provider Groq {
      protocol: "openai-compatible"
      base_url: "https://api.groq.com/openai/v1"
      strict_schema: true
    }

    agent Reviewer {
      provider: Groq
      model: "openai/gpt-oss-20b"
      max_tokens: 2048
      retries: 3
      reasoning_effort: "low"
    }
  `;

  const ast = new Parser(tokenize(code)).parse();
  const provider = ast.body[0];
  const agent = ast.body[1];

  if (provider?.type === "ProviderDeclaration") {
    expect(provider.properties).toContainEqual({
      type: "ProviderProperty",
      name: "strict_schema",
      value: { type: "BooleanLiteral", value: true },
    });
  } else {
    throw new Error("Expected a provider declaration");
  }

  if (agent?.type === "AgentDeclaration") {
    expect(agent.properties).toContainEqual({
      type: "AgentProperty",
      name: "max_tokens",
      value: { type: "NumberLiteral", value: 2048 },
    });
    expect(agent.properties).toContainEqual({
      type: "AgentProperty",
      name: "retries",
      value: { type: "NumberLiteral", value: 3 },
    });
    expect(agent.properties).toContainEqual({
      type: "AgentProperty",
      name: "reasoning_effort",
      value: { type: "StringLiteral", value: "low" },
    });
  } else {
    throw new Error("Expected an agent declaration");
  }
});

test("should reject invalid max_tokens and retries values", () => {
  const invalidCases = [
    `agent A { provider: Groq, model: "m", max_tokens: 0 }`,
    `agent A { provider: Groq, model: "m", max_tokens: 1.5 }`,
    `agent A { provider: Groq, model: "m", retries: -1 }`,
    `agent A { provider: Groq, model: "m", retries: 2.5 }`,
    `agent A { provider: Groq, model: "m", reasoning_effort: "extreme" }`,
    `agent A { provider: Groq, model: "m", reasoning_effort: 2 }`,
  ];

  for (const agentCode of invalidCases) {
    const code = `
      provider Groq {
        protocol: "openai-compatible"
        base_url: "https://api.groq.com/openai/v1"
      }
      ${agentCode}
    `;
    expect(() => new Parser(tokenize(code)).parse()).toThrow();
  }
});

test("should reject a non-boolean strict_schema provider property", () => {
  const code = `
    provider Groq {
      protocol: "openai-compatible"
      base_url: "https://api.groq.com/openai/v1"
      strict_schema: "yes"
    }
  `;

  expect(() => new Parser(tokenize(code)).parse()).toThrow(
    /strict_schema/,
  );
});
test("defaults the edition to 2026 when no directive is present", () => {
  const ast = new Parser(tokenize(`flow main() {}`)).parse();

  expect(ast.edition).toBe("2026");
});

test("accepts an edition directive at the top of the file", () => {
  const ast = new Parser(
    tokenize(`edition "2026"\n\nflow main() {}`),
  ).parse();

  expect(ast.edition).toBe("2026");
});

test("rejects an unsupported edition", () => {
  expect(() =>
    new Parser(tokenize(`edition "2099"\n\nflow main() {}`)).parse(),
  ).toThrow(/Unsupported edition '2099'/);
});

test("rejects an edition directive below another declaration", () => {
  const code = `
    provider Groq {
      protocol: "openai-compatible"
      base_url: "https://api.groq.com/openai/v1"
    }
    edition "2026"
  `;

  expect(() => new Parser(tokenize(code)).parse()).toThrow(
    /'edition' directive must appear only once at the top of the file \(line 6, column 5\)/,
  );
});
