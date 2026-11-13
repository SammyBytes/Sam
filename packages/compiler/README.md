# @sam-lang/compiler

The **bootstrap TypeScript compiler** for the Sam (`.sb`) DSL, version `0.3.0`.

> **Temporary toolchain:** this package is a bootstrap implementation used to
> develop Sam while the language is young. It will be **deprecated and retired
> in `v1.0.0`**, when Sam reaches self-hosting and the compiler is rewritten in
> Sam (`.sb`) itself.

## What it does

It exposes the Lexer → Parser → Codegen pipeline:

- `tokenize(source)` — lexer with line/column tracking.
- `Parser` — recursive-descent parser producing a typed AST for `schema`,
  `agent`, `flow`, and `private flow` declarations.
- `generateCode(ast)` — emits TypeScript with Zod schemas, `createRuntime(...)`
  agent configurations from `@sam-lang/runtime`, and async flow functions.

Agent invocation is emitted as `sam.use(agent, prompt, schema)` or
`sam.useUnsafe(agent, prompt)`, so the generated code delegates process
execution, timeouts, output parsing, and schema validation to the runtime SDK.

## Usage

From the monorepo root:

```bash
bun run sam examples/full_pipeline.sb -o dist/release.ts
```

Compile the minimal OpenCode example instead:

```bash
bun run sam examples/opencode_smoke.sb -o dist/review.ts
```

Print the parsed AST as JSON without running codegen:

```bash
bun run ast examples/complex_program.sb -o dist/ast.json
```

Check the CLI version:

```bash
bun run sam --version
# 0.3.0
```

Or import the API programmatically:

```ts
import { generateCode, Parser, tokenize } from "@sam-lang/compiler";

const ast = new Parser(tokenize(source)).parse();
const output = generateCode(ast);
```

Generated files import `zod` and `@sam-lang/runtime`. Inside the monorepo both
resolve through the workspace; outside it, install them alongside the generated
artifact.

## Tests

```bash
bun test
```

## Status

Version `0.3.0` is the current bootstrap release. It covers schemas, agents,
flows, `let` / `if` / `else` / `return`, safe and unsafe agent invocation, and
the `model` / `env()` agent properties.

Direct execution (`sam run`) and the `flow main()` convention are planned for
`v0.4.0`. The package is scheduled for retirement in `v1.0.0` (self-hosting);
until then, it remains the only supported way to compile `.sb` files.
