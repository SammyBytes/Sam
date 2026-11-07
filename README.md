# Sam (`.sb`)

**A high-performance declarative DSL for AI agent orchestration and software engineering workflow automation.**

Sam is a hobby-grade domain-specific language designed to describe, compose, and execute multiagent systems and automation tasks cleanly, with strict typing and full auditability. Its file extension is **`.sb`**.

> **Project Status: Active Development (`v0.1.0`).**
> This is a personal hobby project built to explore compiler design and agent orchestration. The core engine is currently implemented in **TypeScript** on top of the **Bun** runtime, with a long-term goal of achieving *self-hosting* by version `v1.0.0`. Syntax and public interfaces are subject to change.

---

## Table of Contents

- [Overview](#overview)
- [The Value Proposition](#the-value-proposition)
- [Example Syntax](#example-syntax)
- [Repository Structure](#repository-structure)
- [Prerequisites](#prerequisites)
- [Installation & Usage](#installation-usage)
- [Roadmap](#roadmap)
- [Design Principles](#design-principles)
- [License](#license)

---

## Overview

Sam was born to solve a frustrating friction point: **orchestrating AI agents and enforcing contracts deserves its own dedicated language**, rather than being scattered across fragile imperative scripts, raw prompt strings, and unmanaged loops.

A `.sb` program natively integrates:

- **Schemas** — Strict data contracts guaranteeing that AI responses comply 100% with the expected structure.
- **Agents / Models** — Execution abstractions supporting both cloud providers and autonomous terminal agents (e.g., *Claude Code*, *OpenCode*).
- **Flows** — Imperative/declarative control flow procedures to automate file system tasks and system workflows.

The Sam CLI processes these files, generates a **Zod**-validated intermediate TypeScript source artifact, and leverages native **Bun** capabilities to package them into standalone executable binaries.

## The Value Proposition

Building Sam bridges the gap between raw terminal tools and high-level AI orchestration, delivering concrete benefits for developers:

- **Hardware-Friendly Automation:** Designed to seamlessly wrap lightweight local CLI agents (`Bun.spawn`), making it powerful even on modest development machines without heavy local model hosting costs.
- **Guaranteed Contract Compliance:** Eliminates malformed JSON responses from AI models by combining native API structured outputs with rigorous runtime validation loops.
- **Unified Engineering Control:** Replaces messy bash scripts and scattered API wrappers with a clean, cohesive, and expressive domain syntax built specifically for developer workflows.

## Example Syntax

```sb
// examples/auditoria.sb

schema SecurityAudit {
    has_vulnerabilities: boolean,
    risk_level: string,
    required_action: string
}

agent TerminalAuditor {
    runner: "claude-code",
    workspace: "./src"
}

flow AuditSystem() {
    print("Initiating security scan...")

    let report = use TerminalAuditor.analyze<SecurityAudit>(
        "Review workspace files for exposed credentials or critical flaws."
    )

    if (report.has_vulnerabilities == true) {
        print("⚠️ Red alert! Risk level: ${report.risk_level}")
    } else {
        print("✅ System is secure.")
    }
}

```

## Repository Structure

```
.
├── src/
│   ├── lexer/        # Lexical analysis and tokenization
│   ├── parser/       # Syntactic analysis and AST generation
│   ├── codegen/      # Intermediate code generation (TypeScript/Zod)
│   └── cli/          # Command-line interface orchestration wrapper
├── examples/         # Sample .sb programs for testing
├── LICENSE-MIT
├── LICENSE-APACHE
└── README.md

```

## Prerequisites

* [Bun](https://bun.sh/) `>= 1.1`
* TypeScript `>= 5.5`

## Installation & Usage

```bash
# Clone the repository
git clone [https://github.com/tu-usuario/sam-lang.git](https://github.com/tu-usuario/sam-lang.git) sam
cd sam

# Install dependencies
bun install

# Run compiler help check
bun run src/cli/index.ts --help

```

## Roadmap

1. **v0.1.0 — The Core**: Lexer, basic Parser, and initial schema declaration support.
2. **v0.2.0 — Codegen & Zod**: Integration of TypeScript code generation with strict schema validation.
3. **v0.3.0 — CLI Orchestrator**: Cargo-style command-line implementation and binary compilation via `bun build --compile`.
4. **v0.5.0 — Flows & Agents**: Full support for `flow` blocks, conditionals, and terminal agent runners.
5. **v1.0.0 — Self-Hosting**: Complete rewriting of the compiler in Sam (`.sb`), achieving total independence from TypeScript.

## Design Principles

* **Explicit over Implicit.** Execution graphs should be readable at a glance, never magically inferred.
* **Fail Early.** Type and contract violations must be caught during compilation or initial parsing.
* **Portable.** The frontend remains decoupled from any specific model provider.
* **Auditable.** Costs, retries, and decisions remain structured and trackable.

## License

This project is distributed under a **dual license**:

* [MIT](https://www.google.com/search?q=LICENSE-MIT)
* [Apache License 2.0](https://www.google.com/search?q=LICENSE-APACHE)

You may choose the license that best fits your use case.