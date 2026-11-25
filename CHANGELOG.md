# Changelog

All notable changes to Sam are documented in this file. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [0.6.0] - 2026-11-25

**In plain terms:** long documents are often too big to send to an AI agent in
one go, so this release lets a Sam program cut a document into smaller pieces
and process them one at a time. Loops can stop early, skip a piece, or return a
result immediately, and a new safety limit stops oversized prompts before they
are sent.

### Added

- `chunk(text, maxChars)` synchronous builtin in `@sam-lang/runtime`, exported
  and auto-imported by generated code, that splits text preferring whitespace
  boundaries and only hard-cutting tokens that exceed the limit.
- Sequential `for <item> in <iterable>` loops in flows, with `break` and
  `continue`.
- Loop-scope validation: `break` and `continue` outside a `for` loop are
  rejected by the semantic validator.
- `max_input_chars` agent property for HTTP provider and local runner agents.
  Prompts over the limit fail with `INPUT_TOO_LARGE` before any request or
  process is started; the system prompt is not counted.
- Codegen support for iterating over variables and directly over `chunk(...)`,
  emitting `for (const item of iterable)`.
- README examples for chunking, loops, early returns, and `max_input_chars`.

### Changed

- Bumped all packages and the CLI version to `0.6.0`.
- Roadmap reorganized: `v0.6.0` is Chunking & Sequential Iteration (Done), with
  immutable collection and bounded concurrency moved to `v0.7.0`.

### Tests

- Codegen tests cover iteration over a variable, direct `chunk()` iteration
  with the runtime import, and `break` / `continue` / early `return` plus
  awaited `sam.use(...)` calls inside a loop at the expected indentation.
- Lexer, parser, and validator tests cover the new keywords, loop parsing, and
  out-of-loop rejection.
- `bun test packages/compiler` passes (127 tests, 1 skip) and `bun run
  typecheck` is clean.

## [0.5.0]

Earlier releases are summarized in the [Roadmap](./README.md#roadmap).
