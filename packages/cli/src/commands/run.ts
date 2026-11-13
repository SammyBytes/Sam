import { defineCommand } from "citty";
import { unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import {
  coerceCliArgs,
  generateCode,
  Parser,
  resolveEntryFlow,
  tokenize,
} from "@sam-lang/compiler";
import { createRuntime } from "@sam-lang/runtime";

function extractFlowArgs(rawArgs: string[], fileArg: string): string[] {
  const separatorIndex = rawArgs.indexOf("--");
  if (separatorIndex !== -1) {
    return rawArgs.slice(separatorIndex + 1);
  }

  const extracted: string[] = [];
  let fileConsumed = false;

  for (let i = 0; i < rawArgs.length; i++) {
    const token = rawArgs[i]!;
    if (token === "--flow" || token === "-f") {
      i++;
      continue;
    }
    if (token.startsWith("--flow=") || token.startsWith("-f=")) {
      continue;
    }
    if (!fileConsumed && token === fileArg) {
      fileConsumed = true;
      continue;
    }
    extracted.push(token);
  }

  return extracted;
}

export default defineCommand({
  meta: {
    name: "run",
    description: "Compile and execute a .sb file directly",
  },
  args: {
    file: {
      type: "positional",
      description: "Path to the .sb source file",
      required: true,
    },
    flow: {
      type: "string",
      alias: "f",
      description: "Specific public flow name to execute",
    },
  },
  async run({ args, rawArgs }) {
    const file = Bun.file(args.file);
    if (!(await file.exists())) {
      console.error(`File not found: ${args.file}`);
      process.exit(1);
    }

    const source = await file.text();
    const ast = new Parser(tokenize(source)).parse();
    const entryFlow = resolveEntryFlow(ast, args.flow);

    const flowArgs = extractFlowArgs(rawArgs, args.file);
    let stdinText: string | undefined;

    if (flowArgs.length === 0 && !process.stdin.isTTY) {
      stdinText = await Bun.stdin.text();
    }

    const typedArgs = coerceCliArgs(entryFlow, flowArgs, stdinText);

    const tsCode = generateCode(ast, {
      useGlobalRuntime: true,
    });

    const tempFile = join(tmpdir(), `sam-run-${crypto.randomUUID()}.ts`);

    try {
      Object.assign(globalThis, { z, createRuntime });
      await Bun.write(tempFile, tsCode);
      const mod = await import(pathToFileURL(tempFile).href);
      const result = await mod[entryFlow.name](...typedArgs);

      if (
        typeof result === "object" &&
        result !== null &&
        "ok" in result &&
        result.ok === false
      ) {
        console.error(
          JSON.stringify((result as { error: unknown }).error, null, 2)
        );
        process.exitCode = 1;
        return;
      }

      if (typeof result === "string") {
        console.log(result);
      } else if (result !== undefined) {
        console.log(JSON.stringify(result, null, 2));
      }
    } finally {
      await unlink(tempFile).catch(() => {});
    }
  },
});