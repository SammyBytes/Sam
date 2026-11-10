import { generateCode, Parser, tokenize } from "@sam-lang/compiler";

const source = await Bun.file(
  new URL("./basic_schema.sb", import.meta.url),
).text();

const ast = new Parser(tokenize(source)).parse();
console.log(generateCode(ast));
