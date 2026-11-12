# Sam (`.sb`)

**A high-performance declarative DSL for AI agent orchestration and software engineering workflow automation.**

Sam is a hobby-grade domain-specific language designed to describe, compose, and execute multiagent systems and automation tasks cleanly, with strict typing and full auditability. Its file extension is **`.sb`**.

> **Project Status: Active Development (`v0.2.0`).**
> This is a personal hobby project built to explore compiler design and agent orchestration. The core engine is currently implemented in **TypeScript** on top of the **Bun** runtime, with a long-term goal of achieving *self-hosting* by version `v1.0.0`. Syntax and public interfaces are subject to change.
>
> The repository is a **Bun Workspaces monorepo**: `@sam-lang/compiler` is the temporary bootstrap toolchain (retired in `v1.0.0`) and `@sam-lang/runtime` is the upcoming execution SDK.

---

## Table of Contents

- [Overview](#overview)
- [Monorepo Packages](#monorepo-packages)
- [What Works in v0.2.0](#what-works-in-v020)
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

A `.sb` program is designed to natively integrate:

- **Schemas** — Strict data contracts guaranteeing that AI responses comply 100% with the expected structure.
- **Agents / Runners** — Execution abstractions that wrap local CLI executors such as *Claude Code*, *OpenCode*, or testing mocks.
- **Flows** — Imperative/declarative control flow procedures to automate file system tasks and system workflows.

The Sam CLI processes these files, generates a TypeScript source artifact — **Zod** schemas for data contracts and **`Bun.spawn`**-powered functions for agents — and leverages native **Bun** capabilities to execute it.

## Monorepo Packages

| Package | Description | Status |
| :------ | :---------- | :----- |
| [`@sam-lang/compiler`](./packages/compiler) | Lexer, parser, codegen, and CLI for `.sb` files. | **Bootstrap** — temporary TypeScript toolchain, retired in `v1.0.0` when Sam achieves self-hosting. |
| [`@sam-lang/runtime`](./packages/runtime) | Execution SDK for Sam agents and flows. | **Scaffold** — source implementation planned for `v0.3.0`. |

Both packages are published with `publishConfig.access: "public"` under the `@sam-lang` npm scope.

## What Works in v0.2.0

The current release implements the complete compiler frontend and the first two code generation targets:

- **Lexer** — Tokenization of `.sb` source files with line/column tracking.
- **Parser** — Recursive-descent parsing into a typed AST for `schema` and `agent` declarations.
- **Agent AST** — New `AgentNode` plus a discriminated union for property values (`StringLiteral`, `NumberLiteral`, `BooleanLiteral`, `Identifier`, `EnvLiteral`).
- **Static validation** — Fail-early checks in `parseAgent.ts`: `runner` and `workspace` are required, and `system_prompt` / `system_prompt_file` are mutually exclusive.
- **Codegen** — Zod object schemas and TypeScript-typed agents, orchestrated through the **Strategy** pattern (`IAgentStrategy`).
- **Runners** — `claude_code` (invokes the `claude` CLI) and `mock` (an in-process Bun-based test runner).
- **CLI** — Direct compilation of a `.sb` file to a `.ts` file (or stdout).
- **Deferred** — LLM `model` properties are intentionally postponed to a future release.

## Key Features

| Declaration | Purpose | Generated output |
| :---------- | :------ | :--------------- |
| `schema` | Defines a strict data contract | A Zod object schema and its inferred TypeScript type |
| `agent` | Describes a CLI executor and its workspace | An async TypeScript function powered by `Bun.spawn` |

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
agent ClaudeAuditor {
  runner: claude_code,
  workspace: "./src",
  system_prompt: "You are a strict security auditor.",
  timeout: 120
}
```

Compiles to an executable async function:

```ts
export async function runClaudeAuditor(prompt: string, options?: { cwd?: string }) {
  const args = ["claude"];

  args.push("-p", prompt);
  args.push("--system-prompt", "You are a strict security auditor.");

  const proc = Bun.spawn(args, {
    cwd: options?.cwd ?? "./src",
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  });

  const timeout = setTimeout(() => proc.kill(), 120000);

  const exitCode = await proc.exited;
  clearTimeout(timeout);

  if (exitCode !== 0) {
    throw new Error(`Agent 'ClaudeAuditor' failed with exit code ${exitCode}`);
  }

  return { success: true, exitCode };
}
```

## The Value Proposition

Building Sam bridges the gap between raw terminal tools and high-level AI orchestration, delivering concrete benefits for developers:

- **Hardware-Friendly Automation:** Designed to seamlessly wrap lightweight local CLI agents (`Bun.spawn`), making it powerful even on modest development machines without heavy local model hosting costs.
- **Guaranteed Contract Compliance:** Eliminates malformed JSON responses from AI models by combining native API structured outputs with rigorous runtime validation loops.
- **Unified Engineering Control:** Replaces messy bash scripts and scattered API wrappers with a clean, cohesive, and expressive domain syntax built specifically for developer workflows.

## Quick Start / Usage

### Prerequisites

- [Bun](https://bun.sh/) `>= 1.1`
- TypeScript `>= 5.5`

### Install dependencies

Run from the monorepo root; Bun links the workspace packages automatically:

```bash
bun install
```

### Compile a `.sb` file

```bash
bun run sam examples/basic_agent.sb -o dist/agent.ts
```

Expected CLI output:

```text
Compiled successfully: examples/basic_agent.sb -> dist/agent.ts
```

Omit `-o` to print the generated TypeScript to stdout:

```bash
bun run sam examples/basic_agent.sb
```

Inspect the parsed AST of a `.sb` file as JSON (stops before codegen):

```bash
bun run ast examples/complex_program.sb
```

Use `--help` for the available options:

```bash
bun run sam --help
```

The equivalent direct invocation is:

```bash
bun run packages/compiler/src/cli.ts examples/basic_agent.sb -o dist/agent.ts
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

This bundles the compiler entry points into `packages/compiler/dist` and runs the runtime scaffold build step.

### Use the compiler API

```ts
import { generateCode, Parser, tokenize } from "@sam-lang/compiler";

const source = await Bun.file("examples/basic_schema.sb").text();
const ast = new Parser(tokenize(source)).parse();

console.log(generateCode(ast));
```

A runnable version lives in [`examples/compile.ts`](./examples/compile.ts):

```bash
bun run examples/compile.ts
```

### Run the generated artifact

Generated agents are exported as async functions. Import them from a small script and invoke them:

```ts
// run-agent.ts
import { runMockAuditor } from "./dist/agent";

await runMockAuditor("Audit the authentication module");
```

```bash
bun run run-agent.ts
```

If the compiled output includes `schema` declarations, install Zod before executing it:

```bash
bun add zod
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
agent MockAuditor {
  runner: mock,
  workspace: "./src"
}
```

| Property | Required | Type | Description |
| :------- | :------: | :--- | :---------- |
| `runner` | Yes | Identifier | Execution strategy: `claude_code` or `mock`. |
| `workspace` | Yes | String | Default working directory for the spawned process. |
| `system_prompt` | No | String | Inline system prompt. Mutually exclusive with `system_prompt_file`. |
| `system_prompt_file` | No | String | Path to a system prompt file. Mutually exclusive with `system_prompt`. |
| `timeout` | No | Number | Execution timeout in seconds; the process is killed when exceeded. |

### Full example

Input:

```sb
schema SecurityAudit {
  has_vulnerabilities: boolean,
  risk_level: string
}

agent ClaudeAuditor {
  runner: claude_code,
  workspace: "./src",
  system_prompt: "You are a strict security auditor.",
  timeout: 120
}

agent MockAuditor {
  runner: mock,
  workspace: "./src"
}
```

Save it as `audit.sb` and compile it with:

```bash
bun run sam audit.sb -o dist/agent.ts
```

## Repository Structure

```
.
├── packages/
│   ├── compiler/                 # @sam-lang/compiler (bootstrap, retired in v1.0.0)
│   │   ├── src/
│   │   │   ├── cli.ts            # CLI entry point
│   │   │   ├── index.ts          # Compiler pipeline (Lexer -> Parser -> Codegen)
│   │   │   ├── lexer/            # Lexical analysis and tokenization
│   │   │   ├── parser/
│   │   │   │   ├── ast.ts        # AST nodes (SchemaNode, AgentNode, property union)
│   │   │   │   └── parsers/      # Recursive-descent parsers (schema, agent)
│   │   │   └── codegen/
│   │   │       ├── generators/   # Schema and agent code emitters
│   │   │       └── strategies/   # IAgentStrategy implementations (claude_code, mock)
│   │   ├── README.md
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── runtime/                  # @sam-lang/runtime (SDK scaffold)
│       ├── src/                  # Placeholder only (.gitkeep); sources land in v0.3.0
│       ├── package.json
│       └── tsconfig.json
├── examples/                     # Sample .sb programs and API usage
│   ├── basic_schema.sb
│   ├── basic_agent.sb
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
* **v0.2.0 — Agents & Grammar** *(Done)*: `agent` declarations, `AgentNode` with a discriminated property union, fail-early static validation, Strategy-based codegen to `Bun.spawn` for `claude_code` and `mock` runners, and the Bun Workspaces split into `@sam-lang/compiler` and `@sam-lang/runtime`.
* **v0.3.0 — Flows & Runtime SDK** *(Current Target)*: Implementation of `flow` blocks, agent invocation syntax (`use Agent<Schema>()`), variable bindings (`let`), pipelines, control flow (`if/else`), and the first source implementation of the `@sam-lang/runtime` SDK to extract execution logic away from codegen.
* **v0.4.0 — Direct CLI Runner & Binary**: Native `sam run script.sb` orchestrator executing compiled flows via ephemeral files in `os.tmpdir()` with `finally` cleanup, `flow main` convention support, and standalone CLI binaries (`bun build --compile`) for CI/CD and direct distribution.
* **v0.5.0 — Models & Integrations**: Native LLM `model` support, provider adapters, webhook triggers, contract validation loops, and retries.
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
