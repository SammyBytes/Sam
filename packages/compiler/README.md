# @sam-lang/compiler

The **bootstrap TypeScript compiler** for the Sam (`.sb`) DSL, version `0.4.0`.

> **Temporary toolchain:** this package is a bootstrap implementation used to
> develop Sam while the language is young. It will be **deprecated and retired
> in `v1.0.0`**, when Sam reaches self-hosting and the compiler is rewritten in
> Sam (`.sb`) itself.

## What it does

It exposes the Lexer → Parser → Codegen pipeline plus the helpers used by direct
execution:

- `tokenize(source)` — lexer with line/column tracking.
- `Parser` — recursive-descent parser producing a typed AST for `schema`,
  `agent`, `flow`, and `private flow` declarations.
- `generateCode(ast, options?)` — emits TypeScript with Zod schemas,
  `createRuntime(...)` agent configurations from `@sam-lang/runtime`, and async
  flow functions. Supports `useGlobalRuntime` for ephemeral execution.
- `resolveEntryFlow(ast, requestedFlow?)` — applies `--flow`, `main()`, and
  single-public-flow entry resolution.
- `coerceCliArgs(flow, rawArgs, stdinText?)` — validates arity and coerces
  positional arguments to `string`, `number`, or `boolean`.

Agent invocation is emitted as `sam.use(agent, prompt, schema)` or
`sam.useUnsafe(agent, prompt)`, so the generated code delegates process
execution, timeouts, output parsing, and schema validation to the runtime SDK.

## Usage

The command surface lives in `@sam-lang/cli`. From the monorepo root:

```bash
bun run sam run examples/opencode_smoke.sb
bun run sam compile examples/full_pipeline.sb -o dist/release.ts
bun run sam ast examples/complex_program.sb
```

Check the CLI version:

```bash
bun run sam --version
# 0.4.0
```

Or import the API programmatically:

```ts
import { generateCode, Parser, tokenize } from "@sam-lang/compiler";

const ast = new Parser(tokenize(source)).parse();
const output = generateCode(ast);
```

Generated files import `zod` and `@sam-lang/runtime`. Inside the monorepo both
resolve through the workspace; outside it, install them alongside the generated
artifact. Direct execution instead injects both dependencies into `globalThis`.

## Tests

```bash
bun test
```

## Status

Version `0.4.0` is the current bootstrap release. It covers schemas, agents,
flows, `let` / `if` / `else` / `return`, safe and unsafe agent invocation, the
`model` / `env()` agent properties, entry flow resolution, and CLI argument
coercion used by `sam run`.

Native model integrations are planned for `v0.5.0`. The package is scheduled for
retirement in `v1.0.0` (self-hosting); until then, it remains the supported way
to compile `.sb` files.
