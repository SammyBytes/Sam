import type { ExpressionNode } from "../../ast";
import type { IParserContext } from "../../types";

export function parseExpression(context: IParserContext): ExpressionNode {
  const token = context.peek();

  switch (token.type) {
    case "STRING": {
      context.advance();
      return {
        type: "Literal",
        value: token.value,
      };
    }

    case "NUMBER": {
      context.advance();
      return {
        type: "Literal",
        value: Number(token.value),
      };
    }

    case "BOOLEAN": {
      context.advance();
      return {
        type: "Literal",
        value: token.value === "true",
      };
    }

    case "IDENTIFIER": {
      context.advance();
      return {
        type: "Identifier",
        name: token.value,
      };
    }

    default:
      throw new Error(
        `SyntaxError: Unexpected token '${token.value}' (${token.type}) at line ${token.line}, column ${token.column}. Expected an expression.`,
      );
  }
}