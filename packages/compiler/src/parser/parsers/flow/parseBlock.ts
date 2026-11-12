import type { FlowNode } from "../../ast";
import type { IParserContext } from "../../types";
import { parseStatement } from "./parseStatement";

export function parseBlock(context: IParserContext): FlowNode["body"] {
  const body: FlowNode["body"] = [];

  context.consume("LBRACE", "Expected '{' to start block");

  while (!context.isAtEnd() && context.peek().type !== "RBRACE") {
    body.push(parseStatement(context));
  }
  context.consume("RBRACE", "Expected '}' to end block");

  return body;
}
