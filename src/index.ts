import { generateCode } from "./codegen";
import { tokenize } from "./lexer";
import { Parser } from "./parser";

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(`
Sam Compiler CLI (v0.1.1)
Usage: sam <input.sb> [options]

Options:
  -o, --output <file>    Specify output file path (default: stdout)
  -h, --help             Display this help message
    `);
    process.exit(0);
  }

  const inputFile = args[0];
  const outputFlagIndex = args.findIndex(
    (arg) => arg === "-o" || arg === "--output",
  );
  const outputFile = outputFlagIndex !== -1 ? args[outputFlagIndex + 1] : null;

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
    const compiledCode = generateCode(ast);

    // Output the compiled code to the specified output file or stdout
    if (outputFile) {
      await Bun.write(outputFile, compiledCode);
      console.log(`Compiled successfully: ${inputFile} -> ${outputFile}`);
    } else {
      console.log(compiledCode);
    }
  } catch (error: any) {
    console.error(`Compilation Error: ${error.message}`);
    process.exit(1);
  }
}

main();
