import { generateCode } from "./codegen";
import { tokenize } from "./lexer";
import { Parser } from "./parser";

export { generateCode } from "./codegen";
export { tokenize } from "./lexer";
export type { Token, TokenType } from "./lexer";
export { Parser } from "./parser";
export type {
  AgentNode,
  AgentPropertyNode,
  AgentPropertyType,
  ASTNode,
  FieldNode,
  ProgramNode,
  SchemaNode,
} from "./parser/ast";

export const VERSION = "0.3.0";

export async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--version") || args.includes("-v")) {
    console.log(VERSION);
    process.exit(0);
  }

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(`
Sam Compiler CLI (v${VERSION})
Usage: sam <input.sb> [options]

Options:
  --ast                  Print the parsed AST as JSON instead of generating code
  -o, --output <file>    Specify output file path (default: stdout)
  -v, --version          Print the CLI version
  -h, --help             Display this help message
    `);
    process.exit(0);
  }

  let inputFile: string | null = null;
  let outputFile: string | null = null;
  let printAst = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--ast") {
      printAst = true;
      continue;
    }

    if (arg === "-o" || arg === "--output") {
      const value = args[i + 1];
      if (!value) {
        console.error(`Error: Missing value for '${arg}'.`);
        process.exit(1);
      }
      outputFile = value;
      i++;
      continue;
    }

    if (arg.startsWith("-")) {
      console.error(`Error: Unknown option '${arg}'.`);
      process.exit(1);
    }

    if (inputFile) {
      console.error(`Error: Unexpected argument '${arg}'.`);
      process.exit(1);
    }

    inputFile = arg;
  }

  try {
    // Read the input file .sb
    if (!inputFile) {
      console.error("Error: Input file path is required.");
      process.exit(1);
    }
    const file = Bun.file(inputFile);
    const exists = await file.exists();

    if (!exists) {
      console.error(`Error: File '${inputFile}' not found.`);
      process.exit(1);
    }

    const sourceCode = await file.text();

    // Pipeline of the Compiler (Lexer -> Parser -> Codegen)
    const tokens = tokenize(sourceCode);
    const parser = new Parser(tokens);
    const ast = parser.parse();

    // `--ast` stops before codegen and emits the AST as JSON.
    const output = printAst
      ? JSON.stringify(ast, null, 2)
      : generateCode(ast);

    // Output to the specified output file or stdout
    if (outputFile) {
      await Bun.write(outputFile, output);
      console.log(
        printAst
          ? `AST written successfully: ${inputFile} -> ${outputFile}`
          : `Compiled successfully: ${inputFile} -> ${outputFile}`,
      );
    } else {
      console.log(output);
    }
  } catch (error: any) {
    console.error(`Compilation Error: ${error.message}`);
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}
