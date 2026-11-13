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

runMain(main);