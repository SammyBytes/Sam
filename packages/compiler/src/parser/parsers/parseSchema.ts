import type { FieldNode, SchemaNode } from "../ast";
import type { IParserContext } from "../types";
import { parseTypeAnnotation } from "./flow/parseTypeAnnotation";

export function parseSchema(context: IParserContext): SchemaNode {
  context.consume("SCHEMA", "Expected 'schema' keyword");

  const nameToken = context.consume("IDENTIFIER", "Expected schema name");

  context.consume("LBRACE", "Expected '{' after schema name");

  const fields: FieldNode[] = [];

  while (!context.isAtEnd() && context.peek().type !== "RBRACE") {
    const fieldNameToken = context.consume("IDENTIFIER", "Expected field name");
    context.consume("COLON", "Expected ':' after field name");
    const fieldType = parseTypeAnnotation(context);

    fields.push({
      type: "FieldDefinition",
      name: fieldNameToken.value,
      fieldType,
    });

    if (context.peek().type === "COMMA") {
      context.advance(); // Consume the comma
    }
  }

  context.consume("RBRACE", "Expected '}' after schema fields");

  return {
    type: "SchemaDeclaration",
    name: nameToken.value,
    fields,
  };
}
