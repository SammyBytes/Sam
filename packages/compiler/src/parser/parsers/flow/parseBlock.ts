import type { FlowNode } from "../../ast";
import type { IParserContext } from "../../types";

export function parseBlock(context: IParserContext): FlowNode["body"] {
  const body: FlowNode["body"] = [];

  context.consume("LBRACE", "Expected '{' to start block");

  while (!context.isAtEnd() && context.peek().type !== "RBRACE") {
    
  }
  context.consume("RBRACE", "Expected '}' to end block");

  return body;
}
