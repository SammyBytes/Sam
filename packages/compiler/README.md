# @sam-lang/compiler

The **bootstrap TypeScript compiler** for the Sam (`.sb`) DSL.

> **Temporary toolchain:** this package is a bootstrap implementation used to
> develop Sam while the language is young. It will be **deprecated and retired
> in `v1.0.0`**, when Sam reaches self-hosting and the compiler is rewritten in
> Sam (`.sb`) itself.

## What it does

It exposes the Lexer → Parser → Codegen pipeline:

- `tokenize(source)` — lexer with line/column tracking.
- `Parser` — recursive-descent parser producing a typed AST.
- `generateCode(ast)` — emits TypeScript with Zod schemas and `Bun.spawn` agent functions.

## Usage

From the monorepo root:

```bash
bun run sam examples/basic_schema.sb -o dist/output.ts
```

Print the parsed AST as JSON without running codegen:

```bash
bun run ast examples/complex_program.sb -o dist/ast.json
```

Or import the API programmatically:

```ts
import { generateCode, Parser, tokenize } from "@sam-lang/compiler";

const ast = new Parser(tokenize(source)).parse();
const output = generateCode(ast);
```

## Status

Scheduled for retirement in `v1.0.0` (self-hosting). Until then, it remains
the only supported way to compile `.sb` files.
