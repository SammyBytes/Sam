# Sam (`.sb`)

[![Version](https://img.shields.io/badge/version-0.4.0-blue.svg)](https://github.com/SammyBytes/Sam/releases)
[![Runtime](https://img.shields.io/badge/runtime-Bun-000000.svg?logo=bun&logoColor=white)](https://bun.sh)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE-MIT)

Sam is a declarative DSL for orchestrating AI agents with schema-validated outputs. Write typed `.sb` flows and execute them directly with `sam run`, or ship them as portable standalone binaries.

---

## Overview

Sam treats agent orchestration as a language problem, not a shell-script problem. A `.sb` program describes three things explicitly:

- **Schemas** — strict contracts for the data an agent must return.
- **Agents** — CLI-backed executors with a runner, workspace, prompt, timeout, and optional model.
- **Flows** — typed procedures with variables, conditionals, early returns, and safe or unsafe agent invocation.

The toolchain is built with **Bun**, **TypeScript**, **Citty**, and **Zod**. Programs are parsed into a typed AST, emitted as temporary TypeScript, validated at runtime, and executed through the `@sam-lang/runtime` SDK.

## Key Features in v0.4.0

### Native direct execution

Run a `.sb` file without a separate compile step:

```bash
sam run review.sb "diff --git a/src/auth.ts b/src/auth.ts"
```

Flow parameters are positional and coerced to their declared types (`string`, `number`, `boolean`). A flow with a single `string` parameter can also receive input from stdin:

```bash
git diff | sam run review.sb
```

### Smart entry point resolution

Sam chooses the entry flow deterministically:

1. An explicit `--flow` / `-f` override.
2. A public `flow main()`.
3. The only public flow in the file.
4. Otherwise, an actionable ambiguity error.

Private flows can be called by other flows in the same file, but never invoked directly.

### Standalone compiled binaries

Build a single executable with zero runtime `node_modules`:

```bash
bun build packages/cli/src/cli.ts --compile --outfile dist/sam
```

The generated binary bundles the CLI, compiler, runtime, Zod, and Citty. At execution time, `sam run` injects `z` and `createRuntime` into `globalThis`, so ephemeral generated code can resolve its dependencies without filesystem imports.

### Safe ephemeral execution

Direct execution emits TypeScript to `os.tmpdir()` as `sam-run-<uuid>.ts`, imports it, and always removes it in a `finally` block — including when the flow returns a failed `Result` or throws.

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) `>= 1.1`
- The `opencode` CLI on your `PATH` when using the `opencode` runner. The `mock` runner requires no external binary.

### Install from source

```bash
git clone https://github.com/SammyBytes/Sam.git
cd Sam
bun install
bun run build:bin

mkdir -p ~/.local/bin
cp dist/sam ~/.local/bin/sam

sam --version
# 0.4.0
```

Ensure `~/.local/bin` is on your `PATH`.

### Write a program

Create `review.sb`:

```sb
schema CodeReview {
  approved: boolean,
  risk_level: string,
  summary: string
}

agent Reviewer {
  runner: opencode,
  model: "opencode/deepseek-v4.1-flash-free",
  workspace: ".",
  system_prompt: "You are a concise code reviewer. Return the requested JSON.",
  timeout: 60
}

flow main(diff: string) {
  let review = use Reviewer<CodeReview>(diff)

  if (!review.ok) {
    return review
  }

  return review.value
}
```

### Execute it

Pass the input as a positional argument:

```bash
sam run review.sb "diff --git a/src/auth.ts b/src/auth.ts"
```

Or pipe it through stdin:

```bash
git diff | sam run review.sb
```

The flow prints JSON for object results, raw text for string results, and exits with code `1` when it returns a failed `Result`.

## CLI Reference

```text
sam <command> [options]
```

| Command | Description |
| :------ | :---------- |
| `sam run <file> [args]` | Compile and execute a `.sb` file directly. |
| `sam compile <file> [-o <output>]` | Compile a `.sb` file to TypeScript. Prints to stdout when `-o` is omitted. |
| `sam ast <file>` | Print the parsed AST as JSON. |
| `sam --version` | Print the CLI version. |
| `sam --help` | Show global or command-specific help. |

### `sam run <file> [args]`

| Option / Argument | Description |
| :---------------- | :---------- |
| `<file>` | Path to the `.sb` source file. Required. |
| `[args...]` | Positional flow arguments, coerced to the declared parameter types. |
| `--flow`, `-f` | Select a specific public flow instead of automatic resolution. |
| `--` | Pass values that begin with `-` as flow arguments. |

If no flow arguments are provided and stdin is not a TTY, a single `string` parameter is populated from stdin.

### `sam compile <file> [-o <output>]`

```bash
sam compile review.sb -o dist/review.ts
sam compile review.sb > dist/review.ts
```

Use `--out` as the long form of `-o`.

### `sam ast <file>`

```bash
sam ast examples/full_pipeline.sb
```

Useful for inspecting parser output before code generation.

## Language Reference

### Schema

Schemas define Zod-validated object contracts. Supported field types are `string`, `number`, and `boolean`.

```sb
schema SecurityAudit {
  has_vulnerabilities: boolean,
  risk_level: string,
  findings_count: number
}
```

### Agent

Agents declare a runner and its execution environment.

```sb
agent ReleaseSummarizer {
  runner: opencode,
  workspace: env("RELEASE_WORKSPACE"),
  system_prompt: "Summarize the release and return a ReleaseDecision JSON.",
  timeout: 60,
  model: "opencode/deepseek-v4.1-flash-free"
}
```

| Property | Required | Type | Description |
| :------- | :------: | :--- | :---------- |
| `runner` | Yes | Identifier | Execution strategy: `opencode` or `mock`. |
| `workspace` | Yes | String or `env("VAR")` | Working directory for the spawned process. |
| `system_prompt` | No | String or `env("VAR")` | Instructions prepended to every prompt. |
| `model` | No | String or `env("VAR")` | Model passed to the runner. |
| `timeout` | No | Number | Execution timeout in seconds. The runtime converts it to milliseconds. |

`env("VAR")` resolves through `Bun.env.VAR` at runtime, falling back to an empty string when unset.

### Flows

Flows are typed async procedures. They support `let`, `if` / `else`, early `return`, member access, comparisons, function calls, and agent invocation.

```sb
private flow EvaluateSeverity(findings: number, maxAllowed: number) {
  let exceedsLimit = findings > maxAllowed

  if (exceedsLimit) {
    return "critical"
  }

  return "clean"
}

flow main(targetBranch: string) {
  let audit = use SecurityAuditor<SecurityAudit>(targetBranch)

  if (!audit.ok) {
    return "audit_failed"
  }

  return EvaluateSeverity(audit.value.findings_count, 5)
}
```

### Agent invocation

| Syntax | Result |
| :----- | :----- |
| `use Agent<Schema>(prompt)` | `Result<Schema, AgentError>` after JSON parsing and Zod validation. |
| `use unsafe Agent(prompt)` | `Result<string, AgentError>` with raw agent output. |

Both forms expose `ok`, `value`, and `error`, so flows can branch with `if (!result.ok)`.

## Execution Model

`sam run` performs the following steps:

1. Reads and parses the `.sb` file into a typed AST.
2. Resolves the entry flow and coerces CLI arguments.
3. Emits TypeScript with `useGlobalRuntime: true`.
4. Writes the output to `os.tmpdir()/sam-run-<uuid>.ts`.
5. Injects `z` and `createRuntime` into `globalThis`.
6. Dynamically imports the module and invokes the entry flow.
7. Removes the temporary file in a `finally` block.

Because the generated file lives outside the project, it has no dependency on the caller's `node_modules` or working directory. The standalone binary supplies both runtime dependencies.

## Packages

| Package | Responsibility |
| :------ | :------------- |
| [`@sam-lang/cli`](./packages/cli) | Citty command surface: `run`, `compile`, and `ast`. |
| [`@sam-lang/compiler`](./packages/compiler) | Lexer, parser, AST, codegen, entry resolution, and CLI argument coercion. |
| [`@sam-lang/runtime`](./packages/runtime) | `createRuntime`, runner strategies, process execution, timeouts, and `Result` values. |

The compiler is a bootstrap implementation in TypeScript. It will be retired in `v1.0.0` when Sam becomes self-hosted.

## Repository Layout

```text
.
├── packages/
│   ├── cli/          # @sam-lang/cli — Citty commands
│   ├── compiler/     # @sam-lang/compiler — lexer, parser, codegen
│   └── runtime/      # @sam-lang/runtime — execution SDK
├── examples/         # Sample .sb programs
├── .github/
│   └── workflows/
│       └── ci.yml    # Linux/macOS tests, binary build, portability smoke test
├── package.json      # Bun workspace root
└── bun.lock
```

## Development

```bash
bun install

bun test              # Unit and integration tests
bun run build         # Build all workspace packages
bun run build:bin     # Compile the standalone binary to dist/sam
```

The test suite covers the compiler frontend, code generation, entry resolution, CLI argument coercion, direct execution, failure exit codes, and ephemeral file cleanup.

## Roadmap

- **v0.4.0 — Direct Execution** *(Done)*: `sam run` with positional arguments and stdin pipelines, smart entry point resolution, standalone compiled binaries, and guaranteed temporary-file cleanup.
- **v0.5.0 — Models & Integrations** *(Next)*: native model provider adapters, richer `model` configuration, webhook triggers, retry policies, and contract validation loops.
- **v1.0.0 — Self-Hosting** *(Planned)*: a compiler written in Sam itself, retiring `@sam-lang/compiler` and removing the TypeScript bootstrap toolchain.

Earlier releases delivered the lexer, schema parsing and Zod codegen (`v0.1.x`), agent declarations and the runtime split (`v0.2.0`), and flows plus the runtime SDK (`v0.3.0`).

## License

Distributed under a dual license. Choose either:

- [MIT](./LICENSE-MIT)
- [Apache License 2.0](./LICENSE-APACHE)
