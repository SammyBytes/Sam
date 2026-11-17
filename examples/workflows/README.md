# Sam workflow examples

Small, single-purpose automations. Each `.sb` file does one job and returns a
structured result, so a person or a script can act on it without reading a
long model reply.

| File | Job | Output |
|---|---|---|
| `ticket_readiness.sb` | Checks that a ticket has an objective, out-of-scope notes and validation steps | `{ has_objective, has_out_of_scope, has_validation, missing_sections }` |
| `pr_review_gate.sb` | Reviews a diff and blocks when it finds blocking issues | `"approved"` or `"blocked"` |
| `iteration_digest.sb` | Writes a short status digest from task lines (uses `use unsafe`, free text) | plain text |
| `run_parallel.sh` | Runs one flow over every file in a folder, in parallel | one JSON file per input |

## Run one example

```bash
sam compile examples/workflows/ticket_readiness.sb
sam run examples/workflows/ticket_readiness.sb --flow=CheckTicket "$(cat examples/workflows/inputs/tickets/ticket_incomplete.txt)"
```

`inputs/` contains synthetic tickets, a task list, and a diff of public code
from this repository. Nothing from a private tracker belongs in this folder.

## Dry run without tokens

Copy an example and change `runner: claude` to `runner: mock`. The mock runner
returns placeholder output that matches the schema, so you can check the flow
logic first.

## Fan out over many tickets

```bash
./examples/workflows/run_parallel.sh examples/workflows/ticket_readiness.sb CheckTicket examples/workflows/inputs/tickets out/readiness
```

Each ticket is a separate `sam run` process. A failure in one does not stop the
others, and the script exits non-zero if any run failed. Errors go to
`<name>.err` next to each output.

## Cost notes

- Each `claude` call pays a fixed overhead of roughly $0.08 before the task
  itself. Keep `max_budget_usd` set on every agent.
- `ticket_readiness` uses `haiku`. `pr_review_gate` uses `sonnet`, because a
  wrong approval costs more than the extra tokens.
- The DSL has no `parallel(...)` yet. Use `run_parallel.sh` instead.
