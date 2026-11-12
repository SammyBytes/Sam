import type { ExpressionNode } from "../../ast";
import type { IParserContext } from "../../types";

/**
 * Parses an expression from the given parser context. This function serves as the entry point for parsing expressions and delegates to more specific parsing functions based on the structure of the expression.
 * @param context  The parser context containing the tokens to be parsed.
 * @returns  An ExpressionNode representing the parsed expression.
 */
export function parseExpression(context: IParserContext): ExpressionNode {
  return parseComparison(context);
}

/**
 * Parses comparison expressions, which can include operators like '==', '!=', '<', and '>'.
 * @param context The parser context.
 * @returns An ExpressionNode representing the comparison expression.
 */
function parseComparison(context: IParserContext): ExpressionNode {
  const left = parseUnary(context);

  const token = context.peek();
  if (
    token.type === "EQUALS_EQUALS" ||
    token.type === "NOT_EQUALS" ||
    token.type === "LESS_THAN" ||
    token.type === "GREATER_THAN"
  ) {
    context.advance();
    const right = parseUnary(context);
    return {
      type: "BinaryExpression",
      operator: token.value as "==" | "!=" | "<" | ">",
      left,
      right,
    };
  }

  return left;
}

/**
 * Parses unary expressions, which can include negation using the '!' operator.
 * For example, it can parse expressions like `!a`.
 * @param context The parser context.
 * @returns An ExpressionNode representing the unary expression.
 */
function parseUnary(context: IParserContext): ExpressionNode {
  if (context.peek().type === "NOT") {
    context.advance();
    const argument = parseUnary(context);
    return {
      type: "UnaryExpression",
      operator: "!",
      argument,
    };
  }

  return parseMember(context);
}

/**
 * Parses member expressions, which can include property access using the dot operator.
 * For example, it can parse expressions like `object.property`.
 * @param context  The parser context.
 * @returns An ExpressionNode representing the member expression.
 */
function parseMember(context: IParserContext): ExpressionNode {
  let expr = parsePrimary(context);

  while (context.peek().type === "DOT") {
    context.advance(); // consume el '.'
    const propToken = context.consume(
      "IDENTIFIER",
      "Expected property name after '.'",
    );
    expr = {
      type: "MemberExpression",
      object: expr,
      property: propToken.value,
    };
  }

  return expr;
}

/**
 * Parses primary expressions: literals, identifiers, and parenthesized expressions.
 * @param context The parser context.
 * @returns An ExpressionNode representing the primary expression.
 */
function parsePrimary(context: IParserContext): ExpressionNode {
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
