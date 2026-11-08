export type TokenType =
  | "SCHEMA"
  | "IDENTIFIER" // Names (ej: "boolean", "string", "SecurityAlert", "has_security_alerts")
  | "LBRACE" // "{"
  | "RBRACE" // "}"
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

    if (char === undefined)
        break;

    if (/\s/.test(char)) {
      advance(1);
      continue;
    }

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

    if (/[a-zA-Z_]/.test(char)) {
      let start = cursor;
      while (cursor < input.length && /[a-zA-Z0-9_]/.test(input[cursor])) {
        advance(1);
      }
      const value = input.slice(start, cursor);
      let type: TokenType = "IDENTIFIER";
      if (value === "schema") {
        type = "SCHEMA";
      }

      tokens.push({
        type: type,
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
