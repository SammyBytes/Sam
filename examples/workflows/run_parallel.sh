#!/usr/bin/env bash
# Runs one Sam flow over every ticket file in a directory, in parallel.
# Each run is an independent `sam run` process, so one failure does not stop the others.
#
# Usage: run_parallel.sh <file.sb> <FlowName> <input-dir> <output-dir>
# Set SAM to override the command, for example:
#   SAM="bun run packages/cli/src/cli.ts" ./run_parallel.sh ticket_readiness.sb CheckTicket inputs/tickets out/
set -euo pipefail

sb="$1"
flow="$2"
indir="$3"
outdir="$4"
SAM="${SAM:-sam}"

mkdir -p "$outdir"
pids=()
names=()

for f in "$indir"/*; do
  [ -f "$f" ] || continue
  name="$(basename "$f")"
  name="${name%.*}"
  $SAM run "$sb" --flow="$flow" "$(cat "$f")" > "$outdir/$name.json" 2> "$outdir/$name.err" &
  pids+=($!)
  names+=("$name")
done

status=0
for i in "${!pids[@]}"; do
  if wait "${pids[$i]}"; then
    echo "ok    ${names[$i]}"
  else
    echo "FAIL  ${names[$i]} (see $outdir/${names[$i]}.err)"
    status=1
  fi
done

echo "done: ${#pids[@]} runs, outputs in $outdir"
exit $status
