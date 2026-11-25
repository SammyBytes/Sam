import type { ExpressionNode, FlowNode, StatementNode } from "../../ast";
import type { IParserContext } from "../../types";
import { parseBlock } from "./parseBlock";
import { parseExpression } from "./parseExpression";

export function parseStatement(context: IParserContext): StatementNode {
  switch (context.peek().type) {
    case "LET":
      return parseLetStatement(context);

    case "IF":
      return parseIfStatement(context);

    case "RETURN":
      return parseReturnStatement(context);

    case "FOR":
      return parseForStatement(context);

    case "BREAK":
      return parseBreakStatement(context);

    case "CONTINUE":
      return parseContinueStatement(context);

    default:
      return {
        type: "ExpressionStatement",
        expression: parseExpression(context),
      };
  }
}

function parseForStatement(context: IParserContext): StatementNode {
  context.consume("FOR", "Expected 'for' keyword");
  const iteratorToken = context.consume(
    "IDENTIFIER",
    "Expected identifier after 'for'",
  );
  context.consume("IN", "Expected 'in' after iterator");

  const iterableExpression = parseExpression(context);
  const body = parseBlock(context);

  return {
    type: "ForStatement",
    iterator: iteratorToken.value,
    iterable: iterableExpression,
    body,
  };
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

function parseIfStatement(context: IParserContext): StatementNode {
  context.consume("IF", "Expected 'if' keyword");
  context.consume("LPAREN", "Expected '(' after 'if'");

  const condition = parseExpression(context);

  context.consume("RPAREN", "Expected ')' after condition");

  const thenBranch = parseBlock(context);

  let elseBranch: FlowNode["body"] | undefined = undefined;

  if (context.peek().type === "ELSE") {
    context.advance(); // Consume 'else'
    elseBranch = parseBlock(context);
  }

  return {
    type: "IfStatement",
    condition,
    thenBranch,
    elseBranch,
  };
}

function parseReturnStatement(context: IParserContext): StatementNode {
  context.consume("RETURN", "Expected 'return' keyword");

  let value: ExpressionNode | undefined = undefined;
  if (
    !context.isAtEnd() &&
    context.peek().type !== "RBRACE" &&
    context.peek().type !== "SEMICOLON"
  ) {
    value = parseExpression(context);
  }

  if (context.peek().type === "SEMICOLON") {
    context.advance();
  }

  return {
    type: "ReturnStatement",
    value,
  };
}

function parseBreakStatement(context: IParserContext): StatementNode {
  context.consume("BREAK", "Expected 'break' keyword");
  if (context.peek().type === "SEMICOLON") {
    context.advance();
  }
  return {
    type: "BreakStatement",
  };
}

function parseContinueStatement(context: IParserContext): StatementNode {
  context.consume("CONTINUE", "Expected 'continue' keyword");
  if (context.peek().type === "SEMICOLON") {
    context.advance();
  }
  return {
    type: "ContinueStatement",
  };
}
