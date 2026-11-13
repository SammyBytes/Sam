#!/usr/bin/env bun
import { defineCommand, runMain } from "citty";

const main = defineCommand({
  meta: {
    name: "sam",
    version: "0.4.0",
    description: "Sam (.sb) declarative DSL compiler & runtime runner",
  },
  subCommands: {
    run: () => import("./commands/run").then((m) => m.default),
    compile: () => import("./commands/compile").then((m) => m.default),
    ast: () => import("./commands/ast").then((m) => m.default).catch(() => {
      console.error("AST command module not found.");
      process.exit(1);
    }),
  },
});

// Top-level await keeps the process alive until the command settles. Without
// it, Bun on Windows can exit 0 mid-await while a `Bun.file()` read is pending
// (oven-sh/bun#39787), silently skipping the command's output and exit code.
await runMain(main);
