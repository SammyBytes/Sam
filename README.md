# Sam (`.sb`)

**A high-performance declarative DSL for AI agent orchestration and software engineering workflow automation.**

Sam is a hobby-grade domain-specific language designed to describe, compose, and execute multiagent systems and automation tasks cleanly, with strict typing and full auditability. Its file extension is **`.sb`**.

> **Project Status: Active Development (`v0.1.1`).**
> This is a personal hobby project built to explore compiler design and agent orchestration. The core engine is currently implemented in **TypeScript** on top of the **Bun** runtime, with a long-term goal of achieving *self-hosting* by version `v1.0.0`. Syntax and public interfaces are subject to change.

---

## Table of Contents

- [Overview](#overview)
- [What Works in v0.1.1](#what-works-in-v011)
- [The Value Proposition](#the-value-proposition)
- [Quick Start / Usage](#quick-start--usage)
- [Example](#example)
- [Repository Structure](#repository-structure)
- [Roadmap](#roadmap)
- [Design Principles](#design-principles)
- [License](#license)

---

## Overview

Sam was born to solve a frustrating friction point: **orchestrating AI agents and enforcing contracts deserves its own dedicated language**, rather than being scattered across fragile imperative scripts, raw prompt strings, and unmanaged loops.

A `.sb` program is designed to natively integrate:

- **Schemas** — Strict data contracts guaranteeing that AI responses comply 100% with the expected structure.
- **Agents / Models** — Execution abstractions supporting both cloud providers and autonomous terminal agents (e.g., *Claude Code*, *OpenCode*).
- **Flows** — Imperative/declarative control flow procedures to automate file system tasks and system workflows.

The Sam CLI processes these files, generates a **Zod**-validated intermediate TypeScript source artifact, and leverages native **Bun** capabilities to package them into standalone executable binaries.

## What Works in v0.1.1

The current release implements the complete compiler frontend and the first code generation target:

- **Lexer** — Tokenization of `.sb` source files with line/column tracking.
- **Parser** — Recursive-descent parsing into a typed AST, starting with `schema` declarations.
- **Codegen** — Emission of TypeScript source containing Zod object schemas and inferred types.
- **CLI** — Direct compilation of a `.sb` file to a `.ts` file (or stdout).
- **Supported field types** — `string`, `number`, and `boolean`.

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

```bash
bun install
```

### Compile a `.sb` file

```bash
bun run src/index.ts examples/basic_schema.sb -o dist/output.ts
```

Expected CLI output:

```text
Compiled successfully: examples/basic_schema.sb -> dist/output.ts
```

Omit `-o` to print the generated TypeScript to stdout:

```bash
bun run src/index.ts examples/basic_schema.sb
```

### Run the test suite

```bash
bun test
```

### Run the generated artifact

The generated file imports Zod, so install it before executing the output:

```bash
bun add zod
bun run dist/output.ts
```

## Example

### Input — `examples/basic_schema.sb`

```sb
schema SecurityAudit {
  has_vulnerabilities: boolean,
  risk_level: string
}

schema UserProfile {
  id: string,
  is_active: boolean
}
```

### Output — `dist/output.ts`

```ts
import { z } from "zod";

export const SecurityAuditSchema = z.object({
  has_vulnerabilities: z.boolean(),
  risk_level: z.string(),
});

export type SecurityAudit = z.infer<typeof SecurityAuditSchema>;

export const UserProfileSchema = z.object({
  id: z.string(),
  is_active: z.boolean(),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;
```

## Repository Structure

```
.
├── src/
│   ├── lexer/        # Lexical analysis and tokenization
│   ├── parser/       # Syntactic analysis and AST generation
│   ├── codegen/      # TypeScript/Zod code generation
│   └── index.ts      # CLI entry point (Lexer -> Parser -> Codegen)
├── examples/         # Sample .sb programs
│   └── basic_schema.sb
├── dist/             # Generated TypeScript output
├── LICENSE-MIT
├── LICENSE-APACHE
└── README.md
```

## Roadmap

- **v0.1.0 — The Core**: Lexer, basic Parser, and initial schema declaration support.
- **v0.1.1 — Codegen & Zod (Current)**: TypeScript/Zod emission for schemas, CLI file output, and complete unit test coverage.
- **v0.2.0 — Agents & Grammar**: Parser extensions and AST nodes for `agent` definitions, runners (`claude-code`, etc.), and workspace scoping.
- **v0.3.0 — CLI Orchestrator**: Cargo-style command-line interface, richer diagnostics, formatting options, and standalone binary compilation via `bun build --compile`.
- **v0.4.0 — Flows & Control**: Implementation of `flow` blocks, control statements (`if/else`, variables), and `use Agent.analyze<Schema>()` invocations.
- **v0.5.0 — Runtime & Integrations**: Webhook triggers, contract validation loops, retries, and provider adapters for local and cloud agents.
- **v1.0.0 — Self-Hosting**: Complete rewriting of the compiler in Sam (`.sb`), achieving total independence from TypeScript.

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
