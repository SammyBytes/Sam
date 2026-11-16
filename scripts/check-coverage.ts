import { readFileSync } from "node:fs";

const THRESHOLD = 0.8;
const LCOV_PATH = "coverage/lcov.info";

const text = readFileSync(LCOV_PATH, "utf8");

let linesFound = 0;
let linesHit = 0;
let functionsFound = 0;
let functionsHit = 0;

for (const line of text.split("\n")) {
  if (line.startsWith("LF:")) linesFound += Number(line.slice(3));
  else if (line.startsWith("LH:")) linesHit += Number(line.slice(3));
  else if (line.startsWith("FNF:")) functionsFound += Number(line.slice(4));
  else if (line.startsWith("FNH:")) functionsHit += Number(line.slice(4));
}

function ratio(hit: number, found: number): number {
  return found === 0 ? 1 : hit / found;
}

const lineRatio = ratio(linesHit, linesFound);
const functionRatio = ratio(functionsHit, functionsFound);
const percent = (value: number) => `${(value * 100).toFixed(2)}%`;

console.log(
  `Aggregate coverage: ${percent(lineRatio)} lines, ${percent(functionRatio)} functions (threshold ${percent(THRESHOLD)}).`,
);

if (lineRatio < THRESHOLD || functionRatio < THRESHOLD) {
  console.error(
    `Coverage is below the required ${percent(THRESHOLD)} aggregate threshold.`,
  );
  process.exit(1);
}
