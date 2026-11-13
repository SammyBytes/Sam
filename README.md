# Sam (`.sb`)

**A high-performance declarative DSL for AI agent orchestration and software engineering workflow automation.**

Sam is a hobby-grade domain-specific language designed to describe, compose, and execute multiagent systems and automation tasks cleanly, with strict typing and full auditability. Its file extension is **`.sb`**.

> **Project Status: Active Development (`v0.3.0`).**
> This is a personal hobby project built to explore compiler design and agent orchestration. The core engine is currently implemented in **TypeScript** on top of the **Bun** runtime, with a long-term goal of achieving *self-hosting* by version `v1.0.0`. Syntax and public interfaces are subject to change.
>
> The repository is a **Bun Workspaces monorepo**: `@sam-lang/compiler` is the temporary bootstrap toolchain (retired in `v1.0.0`) and `@sam-lang/runtime` is the execution SDK that now backs every generated flow.

---

## Table of Contents

- [Overview](#overview)
- [Monorepo Packages](#monorepo-packages)
- [What Works in v0.3.0](#what-works-in-v030)
- [Key Features](#key-features)
- [The Value Proposition](#the-value-proposition)
- [Quick Start / Usage](#quick-start--usage)
- [Language Reference](#language-reference)
- [Repository Structure](#repository-structure)
- [Roadmap](#roadmap)
- [Design Principles](#design-principles)
- [License](#license)

---

## Overview

Sam was born to solve a frustrating friction point: **orchestrating AI agents and enforcing contracts deserves its own dedicated language**, rather than being scattered across fragile imperative scripts, raw prompt strings, and unmanaged loops.

A `.sb` program natively integrates:

- **Schemas** — Strict data contracts guaranteeing that AI responses comply 100% with the expected structure.
- **Agents / Runners** — Execution abstractions that wrap local CLI executors such as *OpenCode*, a deterministic mock, or future providers.
- **Flows** — Typed procedures with variables, conditionals, early returns, and safe/unsafe agent invocation.

The Sam CLI processes these files, generates a TypeScript source artifact — **Zod** schemas for data contracts and **`Bun.spawn`**-powered functions for agents — and the generated code delegates execution to the `@sam-lang/runtime` SDK.

## Monorepo Packages

| Package | Description | Status |
| :------ | :---------- | :----- |
| [`@sam-lang/compiler`](./packages/compiler) | Lexer, parser, codegen, and CLI for `.sb` files. | **Bootstrap** — temporary TypeScript toolchain, retired in `v1.0.0` when Sam achieves self-hosting. |
| [`@sam-lang/runtime`](./packages/runtime) | Execution SDK for Sam agents and flows: `createRuntime`, runner strategies, process execution, and `Result` values. | **Implemented** — source implementation shipped in `v0.3.0` under version `0.3.0`. |

Both packages are published with `publishConfig.access: "public"` under the `@sam-lang` npm scope.

## What Works in v0.3.0

The current release completes the flow layer and the first real implementation of the runtime SDK:

- **Lexer** — Tokenization of `.sb` source files with line/column tracking.
- **Parser** — Recursive-descent parsing into a typed AST for `schema`, `agent`, and `flow` declarations.
- **Agent AST** — `AgentNode` with a discriminated union for property values (`StringLiteral`, `NumberLiteral`, `BooleanLiteral`, `Identifier`, `EnvLiteral`).
- **Static validation** — Fail-early checks in `parseAgent.ts`: `runner` and `workspace` are required, duplicate properties are rejected, and `system_prompt` / `system_prompt_file` are mutually exclusive.
- **Flows** — Public and `private flow` declarations, typed parameters, `let` bindings, `if` / `else`, early `return`, member access, comparisons, function calls, and `use` expressions.
- **Agent invocation** — `use Agent<Schema>(prompt)` returns a validated `Result`, while `use unsafe Agent(prompt)` returns the raw string output.
- **Codegen** — Zod schemas, typed runtime agent configs, and async flow functions following the **Strategy** pattern.
- **Runtime SDK** — `createRuntime()` with `use` / `useUnsafe`, the `opencode` and `mock` runner strategies, timeout handling, ANSI stripping, JSON-fence cleanup, and Zod validation of agent output.
- **CLI** — Compile a `.sb` file to `.ts` (or stdout), inspect the AST with `--ast`, and report the version with `--version`.
- **Deferred** — Direct execution (`sam run`) and the `flow main()` convention are planned for `v0.4.0`.

## Key Features

| Declaration | Purpose | Generated output |
| :---------- | :------ | :--------------- |
| `schema` | Defines a strict data contract | A Zod object schema and its inferred TypeScript type |
| `agent` | Describes a CLI executor and its workspace | An entry in the runtime agent registry |
| `flow` | Orchestrates agents, bindings, and control flow | An exported async TypeScript function |
| `private flow` | Internal helper flow | A non-exported async TypeScript function |

### `schema` — Zod contracts

```sb
schema SecurityAudit {
  has_vulnerabilities: boolean,
  risk_level: string
}
```

Compiles to a runtime-validated Zod schema:

```ts
import { z } from "zod";

export const SecurityAuditSchema = z.object({
  has_vulnerabilities: z.boolean(),
  risk_level: z.string(),
});

export type SecurityAudit = z.infer<typeof SecurityAuditSchema>;
```

### `agent` — native `Bun.spawn` execution

```sb
agent Reviewer {
  runner: opencode,
  workspace: ".",
  system_prompt: "You are a concise code reviewer.",
  timeout: 60,
  model: "opencode/deepseek-v4.1-flash-free"
}
```

Compiles to a runtime configuration:

```ts
const sam = createRuntime([
  {
    name: "Reviewer",
    runner: "opencode",
    workspace: ".",
    systemPrompt: "You are a concise code reviewer.",
    timeout: 60000,
    model: "opencode/deepseek-v4.1-flash-free",
  },
]);
```

### `flow` — typed orchestration

```sb
flow ReviewSnippet(codeSnippet: string) {
  let result = use Reviewer<CodeReview>(codeSnippet)

  if (!result.ok) {
    return result
  }

  return result.value
}
```

Compiles to an exported async function that calls `sam.use(...)` and returns the runtime `Result`.

## The Value Proposition

Building Sam bridges the gap between raw terminal tools and high-level AI orchestration, delivering concrete benefits for developers:

- **Hardware-Friendly Automation:** Designed to seamlessly wrap lightweight local CLI agents (`Bun.spawn`), making it powerful even on modest development machines without heavy local model hosting costs.
- **Guaranteed Contract Compliance:** Eliminates malformed JSON responses from AI models by combining native API structured outputs with rigorous runtime validation loops.
- **Unified Engineering Control:** Replaces messy bash scripts and scattered API wrappers with a clean, cohesive, and expressive domain syntax built specifically for developer workflows.

## Quick Start / Usage

### Prerequisites

- [Bun](https://bun.sh/) `>= 1.1`
- TypeScript `>= 5.5`
- The `opencode` CLI on your `PATH` when using the `opencode` runner (the `mock` runner needs no external binary).

### Install dependencies

Run from the monorepo root; Bun links the workspace packages automatically:

```bash
bun install
```

### Compile a `.sb` file

```bash
bun run sam examples/opencode_smoke.sb -o dist/review.ts
```

Expected CLI output:

```text
Compiled successfully: examples/opencode_smoke.sb -> dist/review.ts
```

Omit `-o` to print the generated TypeScript to stdout:

```bash
bun run sam examples/opencode_smoke.sb
```

Inspect the parsed AST of a `.sb` file as JSON (stops before codegen):

```bash
bun run ast examples/full_pipeline.sb
```

Check the CLI version:

```bash
bun run sam --version
# 0.3.0
```

Use `--help` for the available options:

```bash
bun run sam --help
```

The equivalent direct invocation is:

```bash
bun run packages/compiler/src/cli.ts examples/opencode_smoke.sb -o dist/review.ts
```

### Run the test suite

```bash
bun test
```

Tests inside `packages/compiler` import the compiler through the workspace link (`@sam-lang/compiler`), which verifies package resolution as part of the test run.

### Build all packages

```bash
bun run build
```

This bundles the compiler entry points into `packages/compiler/dist` and the runtime SDK into `packages/runtime/dist`.

### Use the compiler API

```ts
import { generateCode, Parser, tokenize } from "@sam-lang/compiler";

const source = await Bun.file("examples/full_pipeline.sb").text();
const ast = new Parser(tokenize(source)).parse();

console.log(generateCode(ast));
```

A runnable version of the frontend lives in [`examples/compile.ts`](./examples/compile.ts):

```bash
bun run examples/compile.ts
```

### Run the generated artifact

Compiled flows are exported as async functions. Import them from a small script and invoke them:

```ts
// run-flow.ts
import { RunReleaseGate } from "./dist/release";

const result = await RunReleaseGate("main", false);
console.log(result);
```

```bash
bun run run-flow.ts
```

Generated code imports `zod` and `@sam-lang/runtime`. Both are available in the workspace; when moving generated files outside the monorepo, install them first:

```bash
bun add zod @sam-lang/runtime
```

## Language Reference

### `schema`

Declares a data contract composed of named fields. Supported field types are `string`, `number`, and `boolean`.

```sb
schema UserProfile {
  id: string,
  is_active: boolean
}
```

### `agent`

Declares a CLI executor. Property values may be identifiers, string literals, numbers, booleans, or `env("VAR")` literals.

```sb
agent SecurityAuditor {
  runner: mock,
  workspace: "./src",
  system_prompt: "Analyze the diff and return a structured SecurityAudit JSON.",
  timeout: 45
}
```

| Property | Required | Type | Description |
| :------- | :------: | :--- | :---------- |
| `runner` | Yes | Identifier | Execution strategy: `opencode` or `mock`. |
| `workspace` | Yes | String or `env("VAR")` | Default working directory for the spawned process. |
| `model` | No | String or `env("VAR")` | Model passed to the runner, e.g. `"opencode/deepseek-v4.1-flash-free"`. |
| `system_prompt` | No | String or `env("VAR")` | Inline system prompt. |
| `system_prompt_file` | No | String | Reserved; validated as mutually exclusive with `system_prompt`. |
| `timeout` | No | Number | Execution timeout in seconds; the runtime converts it to milliseconds and kills the process when exceeded. |

`env("VAR")` is resolved at runtime through `Bun.env.VAR`, falling back to an empty string when the variable is not set.

### `flow`

Flows are typed async procedures. Parameters require an explicit type, and the body supports `let`, `if` / `else`, `return`, and `use`.

```sb
flow RunReleaseGate(targetBranch: string, skipAudit: boolean) {
  if (skipAudit == true) {
    return "bypassed"
  }

  let audit = use SecurityAuditor<SecurityAudit>(targetBranch)

  if (!audit.ok) {
    let rawFallback = use unsafe ReleaseSummarizer(targetBranch)
    if (!rawFallback.ok) {
      return "pipeline_error"
    }
    return rawFallback.value
  }

  return audit.value
}
```

### `private flow`

Prefix a flow with `private` to keep it internal to the generated module. It can still be called by other flows in the same file.

```sb
private flow EvaluateSeverity(findings: number, maxAllowed: number) {
  let exceedsLimit = findings > maxAllowed
  if (exceedsLimit) {
    return "critical"
  }

  return "clean"
}
```

### Agent invocation

- `use Agent<Schema>(prompt)` — runs the agent, parses the JSON output, validates it against the named `Schema`, and returns `Result<Schema, AgentError>`.
- `use unsafe Agent(prompt)` — runs the agent and returns `Result<string, AgentError>` without schema validation.

Both forms return a discriminated result with `ok`, `value`, and `error`, allowing flows to branch with `if (!result.ok)`.

### Full example

The real, runnable-in-workspace example lives at [`examples/full_pipeline.sb`](./examples/full_pipeline.sb):

```sb
schema SecurityAudit {
  has_vulnerabilities: boolean,
  risk_level: string,
  findings_count: number
}

schema ReleaseDecision {
  approved: boolean,
  summary: string
}

agent SecurityAuditor {
  runner: mock,
  workspace: "./src",
  system_prompt: "Analyze the diff and return a structured SecurityAudit JSON.",
  timeout: 45
}

agent ReleaseSummarizer {
  runner: opencode,
  workspace: env("RELEASE_WORKSPACE"),
  system_prompt: "Summarize the release changes and return a ReleaseDecision JSON.",
  timeout: 60,
  model: "opencode/deepseek-v4.1-flash-free"
}

private flow EvaluateSeverity(findings: number, maxAllowed: number) {
  let exceedsLimit = findings > maxAllowed
  if (exceedsLimit) {
    return "critical"
  }

  let hasAny = findings != 0
  if (hasAny) {
    return "warning"
  }

  return "clean"
}

flow RunReleaseGate(targetBranch: string, skipAudit: boolean) {
  if (skipAudit == true) {
    return "bypassed"
  }

  let audit = use SecurityAuditor<SecurityAudit>(targetBranch)

  if (!audit.ok) {
    let rawFallback = use unsafe ReleaseSummarizer(targetBranch)
    if (!rawFallback.ok) {
      return "pipeline_error"
    }
    return rawFallback.value
  }

  let isRisky = audit.value.has_vulnerabilities
  if (isRisky) {
    let severity = EvaluateSeverity(audit.value.findings_count, 5)
    if (severity == "critical") {
      return "blocked_critical"
    }

    if (audit.value.risk_level == "critical") {
      return "blocked_critical"
    } else {
      let underThreshold = audit.value.findings_count < 5
      if (underThreshold) {
        return "approved_with_warnings"
      }
      return "blocked_too_many_findings"
    }
  }

  let releaseNote = use ReleaseSummarizer<ReleaseDecision>(targetBranch)
  if (releaseNote.ok) {
    return releaseNote.value.summary
  }

  return "approved_clean"
}
```

Compile it with:

```bash
bun run sam examples/full_pipeline.sb -o dist/release.ts
```

For a minimal OpenCode-backed example, see [`examples/opencode_smoke.sb`](./examples/opencode_smoke.sb).

## Repository Structure

```
.
├── packages/
│   ├── compiler/                 # @sam-lang/compiler (bootstrap, retired in v1.0.0)
│   │   ├── src/
│   │   │   ├── cli.ts            # CLI entry point
│   │   │   ├── index.ts          # Compiler pipeline (Lexer -> Parser -> Codegen) and CLI options
│   │   │   ├── lexer/            # Lexical analysis and tokenization
│   │   │   ├── parser/
│   │   │   │   ├── ast.ts        # AST nodes (SchemaNode, AgentNode, FlowNode, expressions)
│   │   │   │   └── parsers/      # schema, agent, flow and statement/expression parsers
│   │   │   └── codegen/
│   │   │       └── generators/   # Schema, agent, and flow emitters
│   │   ├── README.md
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── runtime/                  # @sam-lang/runtime (execution SDK)
│       ├── src/
│       │   ├── engine/           # createRuntime, agent configs, Bun.spawn executor
│       │   ├── strategies/       # opencode and mock runner strategies
│       │   ├── result.ts         # Result<T, E> helpers
│       │   └── types.ts          # Runner kinds and runtime types
│       ├── package.json
│       └── tsconfig.json
├── examples/                     # Sample .sb programs and API usage
│   ├── basic_schema.sb
│   ├── basic_agent.sb
│   ├── complex_program.sb
│   ├── full_pipeline.sb
│   ├── opencode_smoke.sb
│   └── compile.ts                # Imports @sam-lang/compiler via workspace link
├── dist/                         # Generated TypeScript output
├── package.json                  # Workspace root (private)
├── tsconfig.json                 # Shared compiler options
├── bun.lock
├── LICENSE-MIT
├── LICENSE-APACHE
└── README.md
```

## Roadmap

* **v0.1.0 — The Core** *(Done)*: Lexer, basic Parser, and initial `schema` declaration support.
* **v0.1.1 — Codegen & Zod** *(Done)*: TypeScript/Zod emission for schemas, CLI file output, and unit test coverage.
* **v0.2.0 — Agents & Grammar** *(Done)*: `agent` declarations, `AgentNode` with a discriminated property union, fail-early static validation, Strategy-based codegen, and the Bun Workspaces split into `@sam-lang/compiler` and `@sam-lang/runtime`.
* **v0.3.0 — Flows & Runtime SDK** *(Done)*: `flow` and `private flow` declarations, typed parameters, `let`, `if` / `else`, `return`, agent invocation via `use Agent<Schema>()` and `use unsafe Agent()`, `model` and `env("VAR")` support, and the full `@sam-lang/runtime` implementation with the `opencode` and `mock` strategies.
* **v0.4.0 — Direct Execution** *(Current Target)*: Native `sam run script.sb` orchestration, the `flow main()` convention as the program entry point, ephemeral generated files in `os.tmpdir()` with `finally` cleanup, and standalone CLI binaries (`bun build --compile`) for CI/CD and direct distribution.
* **v0.5.0 — Models & Integrations**: Native LLM `model` adapters, provider-specific integrations, webhook triggers, contract validation loops, and retries.
* **v1.0.0 — Self-Hosting**: Complete rewriting of the compiler in Sam (`.sb`), achieving total independence from TypeScript. `@sam-lang/compiler` is deprecated and retired, replaced by the self-hosted compiler.

## Design Principles

* **Explicit over Implicit.** Execution graphs should be readable at a glance, never magically inferred.
* **Fail Early.** Type and contract violations must be caught during compilation or initial parsing.
* **Portable.** The frontend remains decoupled from any specific model provider.
* **Auditable.** Costs, retries, and decisions remain structured and trackable.

## License

This project is distributed under a **dual license**:

* [MIT](./LICENSE-MIT)
* [Apache License 2.0](./LICENSE-APACHE)

You may choose the license that best fits your use case.
