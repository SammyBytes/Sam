import type {
  ExpressionNode,
  FlowNode,
  ForStatementNode,
  StatementNode,
} from "../../ast";
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

    case "YIELD":
      return parseYieldStatement(context);

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

  let parallel: ExpressionNode | undefined;
  let ordered: boolean | undefined;

  if (context.peek().type === "IDENTIFIER" && context.peek().value === "with") {
    context.advance(); // consume 'with'
    context.consume("LBRACE", "Expected '{' after 'with'");

    if (context.peek().type === "RBRACE") {
      throw new Error("Expected 'parallel' or 'ordered' inside 'with { ... }'");
    }

    const seenKeys = new Set<string>();

    while (!context.isAtEnd() && context.peek().type !== "RBRACE") {
      const keyToken = context.peek();
      const isOptionName =
        keyToken.type === "IDENTIFIER" ||
        keyToken.type === "PARALLEL" ||
        keyToken.value === "parallel" ||
        keyToken.value === "ordered";

      if (!isOptionName) {
        throw new Error(
          `Expected option name ('parallel' or 'ordered') in 'with' block`,
        );
      }
      context.advance();

      if (seenKeys.has(keyToken.value)) {
        throw new Error(`Duplicate option '${keyToken.value}' in 'with' block`);
      }
      seenKeys.add(keyToken.value);

      context.consume("COLON", `Expected ':' after '${keyToken.value}'`);

      if (keyToken.value === "parallel") {
        parallel = parseExpression(context);
      } else if (keyToken.value === "ordered") {
        const boolToken = context.peek();
        if (boolToken.type !== "BOOLEAN") {
          throw new Error(
            "Expected boolean literal ('true' or 'false') for 'ordered'",
          );
        }
        context.advance();
        ordered = boolToken.value === "true";
      } else {
        throw new Error(`Unknown option '${keyToken.value}' in 'with' block`);
      }

      if (context.peek().type === "COMMA") {
        context.advance();
      } else {
        break;
      }
    }

    context.consume("RBRACE", "Expected '}' after 'with { ... }'");
  }

  const body = parseBlock(context);

  return {
    type: "ForStatement",
    iterator: iteratorToken.value,
    iterable: iterableExpression,
    ...(parallel !== undefined ? { parallel } : {}),
    ...(ordered !== undefined ? { ordered } : {}),
    body,
  };
}

function parseYieldStatement(context: IParserContext): StatementNode {
  context.consume("YIELD", "Expected 'yield' keyword");

  let value: ExpressionNode | undefined;
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

  if (!value) {
    throw new Error("Expected an expression after 'yield'");
  }

  return {
    type: "YieldStatement",
    value,
  };
}

function parseLetStatement(context: IParserContext): StatementNode {
  context.consume("LET", "Expected 'let' keyword");
  const identifierToken = context.consume(
    "IDENTIFIER",
    "Expected identifier after 'let'",
  );
  context.consume("EQUALS", "Expected '=' after identifier");

  const expression =
    context.peek().type === "FOR"
      ? (parseForStatement(context) as ForStatementNode)
      : parseExpression(context);

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
