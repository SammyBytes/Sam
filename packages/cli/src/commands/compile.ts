import { defineCommand } from "citty";
import { generateCode, Parser, tokenize } from "@sam-lang/compiler";

export default defineCommand({
  meta: {
    name: "compile",
    description: "Compile a .sb file to TypeScript",
  },
  args: {
    file: {
      type: "positional",
      description: "Path to the .sb source file",
      required: true,
    },
    out: {
      type: "string",
      alias: "o",
      description: "Output .ts file path (prints to stdout if omitted)",
    },
  },
  async run({ args }) {
    const source = await Bun.file(args.file).text();
    const ast = new Parser(tokenize(source)).parse();
    const output = generateCode(ast);

    if (args.out) {
      await Bun.write(args.out, output);
      console.log(`Compiled successfully: ${args.file} -> ${args.out}`);
      return;
    }

    process.stdout.write(output);
  },
});