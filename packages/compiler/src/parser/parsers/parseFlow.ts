import type { FlowNode } from "../ast";
import type { IParserContext } from "../types";
import { parseBlock } from "./flow/parseBlock";

export function parseFlow(context: IParserContext): FlowNode {
  const isPrivate = context.peek().type === "PRIVATE";
  if (isPrivate) {
    context.advance();
  }
  context.consume("FLOW", "Expected 'FLOW' keyword");

  const nameToken = context.consume("IDENTIFIER", "Expected flow name");

  context.consume("LPAREN", "Expected '(' after flow name");

  const params: FlowNode["params"] = [];

  while (!context.isAtEnd() && context.peek().type !== "RPAREN") {
    const paramToken = context.consume("IDENTIFIER", "Expected parameter name");
    context.consume("COLON", "Expected ':' after parameter name");
    const typeToken = context.consume("IDENTIFIER", "Expected parameter type");

    params.push({ name: paramToken.value, type: typeToken.value });

    if (context.peek().type !== "RPAREN") {
      context.consume("COMMA", "Expected ',' between parameters");

      if (context.peek().type === "RPAREN" || context.peek().type === "COMMA") {
        throw new Error(
          `SyntaxError: Unexpected token '${context.peek().value}' at line ${context.peek().line}, column ${context.peek().column}. Expected a parameter name.`,
        );
      }
    }
  }

  context.consume("RPAREN", "Expected ')' after flow parameters");

  const body = parseBlock(context);

  return {
    type: "FlowDeclaration",
    name: nameToken.value,
    params,
    isPrivate,
    body,
  };
}
