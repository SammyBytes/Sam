import type { ExpressionNode, FlowNode, StatementNode } from "../../ast";
import type { IParserContext } from "../../types";

export function parseStatement(context: IParserContext): StatementNode {
  switch (context.peek().type) {
    case "LET":
      return parseLetStatement(context);

    default:
      return {
        type: "ExpressionStatement",
        expression: parseExpression(context),
      };
  }
}

function parseLetStatement(context: IParserContext): StatementNode {
  context.consume("LET", "Expected 'let' keyword");
  const identifierToken = context.consume(
    "IDENTIFIER",
    "Expected identifier after 'let'",
  );
  context.consume("EQUALS", "Expected '=' after identifier");

  const expression = parseExpression(context);
  return {
    type: "LetStatement",
    name: identifierToken.value,
    value: expression,
  };
}

function parseExpression(context: IParserContext): ExpressionNode {
  const expressionToken = context.consume("IDENTIFIER", "Expected expression");
  return {
    type: "Identifier",
    name: expressionToken.value,
  };
}
