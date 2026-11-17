---
name: sam-automation
description: Write, validate and run Sam (.sb) automations that delegate small, well-scoped tasks to LLM agents (claude, opencode, HTTP providers). Use when the user wants a .sb file, an agent pipeline, a scripted review or triage flow, or wants to split work across cheaper agents.
---

# Sam automation

Sam is a declarative DSL. A `.sb` file declares **schemas** (expected output shapes), **agents** (who runs the work), and **flows** (the steps). Claude's job here is to write the `.sb`, check it, run it on a small input, and report what it cost.

## Workflow

1. **Scope the task.** Decide which steps need a model and which are plain logic. Model calls are the expensive part.
2. **Write the `.sb`** following the syntax below. Keep the file in the project, not in scratch.
3. **Compile** before anything else: `sam compile <file.sb>`. Fix every error first.
4. **Dry run** with `runner: mock` for the agents. The mock returns schema-shaped placeholder output, so the control flow can be checked without spending tokens.
5. **Real run** on one small input with `sam run <file.sb> --flow=<Name> "<input>"`. Keep `max_budget_usd` low while testing.
6. **Report** what ran, the cost if known, and any error code (see Pitfalls).

## Syntax

Verified with `sam compile` against this repo.

```sam
schema Verdict {
  approved: boolean,
  risk_level: string
}

agent Reviewer {
  runner: claude,
  model: "sonnet",
  workspace: "./src",
  system_prompt: "Return only the requested JSON.",
  permission_mode: "plan",
  max_turns: 4,
  max_budget_usd: 0.25,
  disallowed_tools: "Bash, Edit, Write",
  timeout: 120
}

flow Review(change: string) {
  let verdict = use Reviewer<Verdict>(change)
  if (!verdict.ok) {
    return verdict
  }
  return verdict.value
}
```

- **Schemas:** fields are `string`, `number`, `boolean`, or `array` (untyped, so no element type or length is enforced).
- **Agents:** either `runner:` (local: `claude`, `opencode`, `mock`, which need `workspace`) or `provider:` (HTTP, which needs `model`). Not both.
- **`timeout` is in seconds** in `.sb` (`timeout: 60` means 60 s). The runtime converts it to milliseconds. Writing `timeout: 120000` means about 33 hours.
- **Calls:** `use Agent<Schema>(input)` validates the output against the schema. `use unsafe Agent(input)` returns raw text and must not have `<Schema>`.
- **Results:** every `use` returns `{ ok, value }` on success or `{ ok: false, ... }` with an error code.
- **Flows:** `let`, `if (...) { } else { }`, `return`, operators `==`, `!=`, `<`, `>`, `!`. Mark helpers `private flow`.
- **Strings:** double quotes, or backtick templates with `${expr}`. There is no `+` concatenation.
- **Not available:** loops, and `parallel(...)` (the token exists but the compiler rejects it with `Unexpected token 'parallel'`).

## Claude runner rules

- `temperature`, `max_tokens` and `retries` are **rejected** for `runner: claude`. They only apply to HTTP providers.
- Use `permission_mode: "plan"` and `disallowed_tools: "Bash, Edit, Write"` unless the task explicitly needs more. Workspace writes are not configurable yet (tracked in the permissions issue).
- Use `max_turns: 4` or more. `max_turns: 2` was too low for `sonnet` in plan mode, and the run failed with `error_max_turns`.
- Every `claude` call is a separate Claude Code session with fixed overhead. Measured at about $0.08 per call, before the task itself.

## Cost rules (from measurements)

- **Batch related items in one call when you can**, because the per-call overhead dominates small tasks. In the measured run, six reviews in one `sonnet` call cost about one fifth of six separate calls. The DSL cannot type a batch result, though, since `array` has no element type. Batching then means one schema per fixed item count, which is awkward. Say so to the user instead of hiding it.
- **Do not assume `haiku` is cheaper per call** on the `claude` runner. In the measured run it cost slightly more than `sonnet` per call, because each model builds its own cache.
- Set `max_budget_usd` on every agent. Report the total you expect to spend before a large run.

## Parallel work

There is no DSL `parallel`. To run several agents in parallel, launch separate `sam run` processes in the background, one per independent input, collect each JSON result, and merge them in the orchestrating step. Keep the number of concurrent processes small. Two concurrent runs with different models were verified.

## Secrets and safety

- Never write API keys into `.sb` files or commit them. Use `env("NAME")` for values such as the workspace path, and set variables in the shell or the CI environment.
- `ANTHROPIC_API_KEY`, when set, makes Claude Code bill per token through the API instead of the user's subscription. Set it only for the run that needs it, such as `bare` mode or unattended jobs.
- `bare: true` needs an API key, according to `claude --help`.

## Pitfalls seen in testing

- **Timeouts in milliseconds** silently become enormous. Use seconds.
- **`max_turns` too low** causes `error_max_turns` when the model wants a tool call first.
- **Child process failures** return the full JSON envelope in `stderr`. Read the `subtype` and `errors` fields instead of the whole blob.
- **Windows `.cmd` shims:** on Windows the npm install of `claude` is a `.cmd`. Sam resolves the native `claude.exe` behind it. If a structured call fails with `cmd.exe special character`, check the `claude` install.
- **Unknown model names** return `EXECUTION_ERROR` with `unrecognized_model`.
- **Missing workspace** looks like a missing binary. If a run fails with `ENOENT ... uv_spawn 'bun'` (or `'claude'`), first check that the agent's `workspace` path exists relative to where `sam run` is started. The binary is usually fine.

## Done when

- `sam compile` passes.
- A `mock` run shows the flow's control path.
- One real run on a small input returned `ok: true` with a value matching the schema, and the spend is reported.
