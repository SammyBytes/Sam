import type { TypeAnnotation } from "../../ast";
import type { IParserContext } from "../../types";

export function parseTypeAnnotation(context: IParserContext): TypeAnnotation {
  const baseToken = context.consume("IDENTIFIER", "Expected type annotation");
  let current: TypeAnnotation = {
    kind: "BaseType",
    name: baseToken.value,
  };

  while (context.peek().type === "LBRACKET") {
    context.advance(); // consume '['
    context.consume("RBRACKET", "Expected ']' after '[' in type annotation");
    current = {
      kind: "ArrayType",
      elementType: current,
    };
  }

  return current;
}
