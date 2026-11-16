import { Scanner } from "./scanner";
import {
  KEYWORDS,
  SINGLE_CHAR_TOKENS,
  TWO_CHAR_TOKENS,
  type Token,
  type TokenType,
} from "./tokens";

export type { Token, TokenType };

export function tokenize(input: string): Token[] {
  const scanner = new Scanner(input);
  const tokens: Token[] = [];

  while (!scanner.isAtEnd) {
    const char = scanner.peek();

    // Skip whitespace
    if (/\s/.test(char)) {
      scanner.advance();
      continue;
    }

    const line = scanner.line;
    const column = scanner.column;

    // Delimiters and operators that consist of two characters are checked first.
    // If the current character and the next character form a valid two-character token, it is added to the tokens list with its corresponding type, and the scanner advances to the next character.
    const twoChar = char + scanner.peek(1);
    if (TWO_CHAR_TOKENS[twoChar]) {
      scanner.advance();
      scanner.advance();
      tokens.push({
        type: TWO_CHAR_TOKENS[twoChar],
        value: twoChar,
        line,
        column,
      });
      continue;
    }

    // Delimiters and operators that consist of a single character are checked next.
    // If the current character matches one of these, it is added to the tokens list with its corresponding type, and the scanner advances to the next character.
    if (SINGLE_CHAR_TOKENS[char]) {
      scanner.advance();
      tokens.push({
        type: SINGLE_CHAR_TOKENS[char],
        value: char,
        line,
        column,
      });
      continue;
    }

    if (char === "`") {
      tokens.push(...scanTemplateLiteral(scanner, line, column));
      continue;
    }

    // If the current character is a quote (either single or double), it indicates the start of a string literal.
    // The scanString function is called to handle the string tokenization, and the resulting token is added to the tokens list.
    if (char === '"' || char === "'") {
      tokens.push(scanString(scanner, line, column));
      continue;
    }

    if (isDigit(char)) {
      tokens.push(scanNumber(scanner, line, column));
      continue;
    }

    if (isAlpha(char)) {
      tokens.push(scanIdentifier(scanner, line, column));
      continue;
    }

    throw new Error(
      `Unexpected character '${char}' at line ${line}, column${column}`,
    );
  }

  tokens.push({
    type: "EOF",
    value: "",
    line: scanner.line,
    column: scanner.column,
  });
  return tokens;
}

// Helper functions for scanning different types of tokens

function scanString(scanner: Scanner, line: number, column: number): Token {
  const quoteType = scanner.advance(); // Consume the opening quote
  let value = "";

  while (!scanner.isAtEnd && scanner.peek() !== quoteType) {
    if (scanner.peek() === "\n") {
      throw new Error(`Unterminated string at line ${line}, column ${column}`);
    }
    // Handle escape sequences "\" or "\n" or "\t" within the string literal. If an escape character is encountered, the next character is processed accordingly.
    if (scanner.peek() === "\\") {
      scanner.advance();
      const escaped = scanner.advance();
      value += escaped === "n" ? "\n" : escaped === "t" ? "\t" : escaped;
      continue;
    }

    value += scanner.advance();
  }

  if (scanner.isAtEnd) {
    throw new Error(`Unterminated string at line ${line}, column ${column}`);
  }

  scanner.advance(); // Consume the closing quote

  return {
    type: "STRING",
    value,
    line,
    column,
  };
}

function scanTemplateLiteral(
  scanner: Scanner,
  startLine: number,
  startColumn: number,
): Token[] {
  const tokens: Token[] = [];
  let chunk = "";
  let chunkLine = startLine;
  let chunkColumn = startColumn;
  let hasInterpolation = false;

  scanner.advance(); // Consume the opening backtick

  while (!scanner.isAtEnd) {
    const char = scanner.peek();

    if (char === "`") {
      scanner.advance(); // Consume the closing backtick
      tokens.push({
        type: hasInterpolation ? "TEMPLATE_TAIL" : "STRING",
        value: chunk,
        line: chunkLine,
        column: chunkColumn,
      });
      return tokens;
    }

    if (char === "$" && scanner.peek(1) === "{") {
      tokens.push({
        type: hasInterpolation ? "TEMPLATE_MIDDLE" : "TEMPLATE_HEAD",
        value: chunk,
        line: chunkLine,
        column: chunkColumn,
      });

      hasInterpolation = true;
      scanner.advance(); // Consume '$'
      scanner.advance(); // Consume '{'
      chunk = ""; 
      
      // Extract and tokenize the inner expression as real code
      const exprStart = scanner.position;
      const exprLine = scanner.line;
      const exprColumn = scanner.column;
      let braceDepth = 1;

      while (!scanner.isAtEnd && braceDepth > 0) {
        const c = scanner.peek();
        if (c === '"' || c === "'") {
          scanString(scanner, scanner.line, scanner.column);
          continue;
        }
        if (c === "{") braceDepth++;
        if (c === "}") {
          braceDepth--;
          if (braceDepth === 0) break;
        }
        scanner.advance();
      }

      if (braceDepth !== 0) {
        throw new Error(
          `Unclosed template interpolation at line ${startLine}, column ${startColumn}`,
        );
      }

      const rawExpr = scanner.sliceFrom(exprStart);
      scanner.advance(); // Consume the '}' that closes the ${...}

      const innerTokens = tokenize(rawExpr)
        .filter((t) => t.type !== "EOF")
        .map((t) => ({
          ...t,
          line: t.line + exprLine - 1,
          column: t.line === 1 ? t.column + exprColumn - 1 : t.column,
        }));

      tokens.push(...innerTokens);

      chunkLine = scanner.line;
      chunkColumn = scanner.column;
      continue;
    }

    // Escape sequences (\n, \t, \`, \$)
    if (char === "\\") {
      scanner.advance();
      const escaped = scanner.advance();
      chunk += escaped === "n" ? "\n" : escaped === "t" ? "\t" : escaped;
      continue;
    }

    chunk += scanner.advance();
  }

  throw new Error(
    `Unterminated template literal at line ${startLine}, column ${startColumn}`,
  );
}

function scanNumber(scanner: Scanner, line: number, column: number): Token {
  const start = scanner.position;
  let hasDot = false;

  while (!scanner.isAtEnd) {
    if (isDigit(scanner.peek())) {
      scanner.advance();
    } else if (scanner.peek() === "." && !hasDot && isDigit(scanner.peek(1))) {
      hasDot = true;
      scanner.advance();
    } else {
      break;
    }
  }

  return {
    type: "NUMBER",
    value: scanner.sliceFrom(start),
    line,
    column,
  };
}

function scanIdentifier(scanner: Scanner, line: number, column: number): Token {
  const start = scanner.position;

  while (!scanner.isAtEnd && isAlphaNumeric(scanner.peek())) {
    scanner.advance();
  }

  const value = scanner.sliceFrom(start);
  const type: TokenType = KEYWORDS[value] ?? "IDENTIFIER";

  return {
    type,
    value,
    line,
    column,
  };
}

const isDigit = (c: string): boolean => c >= "0" && c <= "9";
const isAlpha = (c: string): boolean =>
  (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_";
const isAlphaNumeric = (c: string): boolean => isAlpha(c) || isDigit(c);
