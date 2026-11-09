export type TokenType =
  | "SCHEMA"
  | "AGENT"
  | "ENV" // env(...)
  | "IDENTIFIER" // Names (ej: "boolean", "string", "SecurityAlert", "has_security_alerts")
  | "BOOLEAN" // Boolean literals (ej: true, false)
  | "NUMBER" // Numeric literals (ej: 42, 3.14)
  | "STRING" // String literals (ej: '"Hello, World!"')
  | "LBRACE" // "{"
  | "RBRACE" // "}"
  | "LPAREN" // "("
  | "RPAREN" // ")"
  | "COLON" // ":"
  | "COMMA" // ","
  | "EQUALS" // "="
  | "EQUALS_EQUALS" // "=="
  | "EOF";

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

// Define a mapping of keywords to their corresponding token types
// This allows for easy identification of keywords during tokenization
// For example, if the lexer encounters the string "schema", it will recognize it as a "SCHEMA" token type
const KEYWORDS: Record<string, TokenType> = {
  schema: "SCHEMA",
  agent: "AGENT",
  env: "ENV",
  true: "BOOLEAN",
  false: "BOOLEAN",
};

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let line = 1;
  let column = 1;
  let cursor = 0;

  function advance(n: number) {
    for (let i = 0; i < n; i++) {
      if (input[cursor] === "\n") {
        line++;
        column = 1;
      } else {
        column++;
      }
      cursor++;
    }
  }

  while (cursor < input.length) {
    const char = input[cursor];

    if (char === undefined) break;

    // Skip whitespace
    if (/\s/.test(char)) {
      advance(1);
      continue;
    }

    // Delimiters and operators
    if (char === "{") {
      tokens.push({ type: "LBRACE", value: char, line, column });
      advance(1);
      continue;
    }

    if (char === "}") {
      tokens.push({ type: "RBRACE", value: char, line, column });
      advance(1);
      continue;
    }

    if (char === "(") {
      tokens.push({ type: "LPAREN", value: char, line, column });
      advance(1);
      continue;
    }

    if (char === ")") {
      tokens.push({ type: "RPAREN", value: char, line, column });
      advance(1);
      continue;
    }

    if (char === ":") {
      tokens.push({ type: "COLON", value: char, line, column });
      advance(1);
      continue;
    }

    if (char === ",") {
      tokens.push({ type: "COMMA", value: char, line, column });
      advance(1);
      continue;
    }

    if (char === "=") {
      if (input[cursor + 1] === "=") {
        tokens.push({ type: "EQUALS_EQUALS", value: "==", line, column });
        advance(2);
      } else {
        tokens.push({ type: "EQUALS", value: char, line, column });
        advance(1);
      }
      continue;
    }

    // 5. Number Literals (300, 0.2, 4096)
    if (/[0-9]/.test(char)) {
      let start = cursor;
      let startColumn = column;
      let hasDot = false;

      while (cursor < input.length) {
        const nextChar = input[cursor];
        if (/[0-9]/.test(nextChar)) {
          advance(1);
        } else if (
          nextChar === "." &&
          !hasDot &&
          /[0-9]/.test(input[cursor + 1] ?? "")
        ) {
          hasDot = true;
          advance(1);
        } else {
          break;
        }
      }

      const numValue = input.slice(start, cursor);
      tokens.push({
        type: "NUMBER",
        value: numValue,
        line,
        column: startColumn,
      });
      continue;
    }

    if (char === '"' || char === "'") {
      const quoteType = char;
      const startColumn = column;
      advance(1); // Move past the opening quote
      let stringValue = "";
      while (cursor < input.length && input[cursor] !== quoteType) {
        if (input[cursor] === "\n") {
          throw new Error(
            `Unterminated string literal at line ${line}, column ${column}`,
          );
        }
        stringValue += input[cursor];
        advance(1);
      }

      if (cursor >= input.length) {
        throw new Error(
          `Unterminated string literal at line ${line}, column ${column}`,
        );
      }

      advance(1); // Move past the closing quote
      tokens.push({
        type: "STRING",
        value: stringValue,
        line,
        column: startColumn,
      });
      continue;
    }

    if (/[a-zA-Z_]/.test(char)) {
      let start = cursor;
      while (cursor < input.length && /[a-zA-Z0-9_]/.test(input[cursor])) {
        advance(1);
      }
      const value = input.slice(start, cursor);
      const type: TokenType = KEYWORDS[value] ?? "IDENTIFIER";

      tokens.push({
        type,
        value,
        line,
        column: column - (cursor - start),
      });
      continue;
    }

    throw new Error(
      `Unexpected character '${char}' at line ${line}, column ${column}`,
    );
  }

  tokens.push({ type: "EOF", value: "", line, column });
  return tokens;
}
