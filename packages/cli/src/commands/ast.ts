import { defineCommand } from "citty";
import { Parser, tokenize } from "@sam-lang/compiler";

export default defineCommand({
  meta: {
    name: "ast",
    description: "Inspect the parsed AST of a .sb file as JSON",
  },
  args: {
    file: {
      type: "positional",
      description: "Path to the .sb source file",
      required: true,
    },
  },
  async run({ args }) {
    const source = await Bun.file(args.file).text();
    const ast = new Parser(tokenize(source)).parse();
    console.log(JSON.stringify(ast, null, 2));
  },
});