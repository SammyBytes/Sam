export type TokenType =
  | "SCHEMA"
  | "AGENT"
  | "PROVIDER"
  | "EDITION"
  | "FLOW"
  | "PRIVATE"
  | "PARALLEL"
  | "USE"
  | "UNSAFE"
  | "LET"
  | "IF"
  | "ELSE"
  | "RETURN"
  | "ENV"
  | "IDENTIFIER"
  | "BOOLEAN"
  | "NUMBER"
  | "STRING"
  | "LBRACE"
  | "RBRACE"
  | "LPAREN"
  | "RPAREN"
  | "LBRACKET"
  | "RBRACKET"
  | "COLON"
  | "SEMICOLON"
  | "DOT"
  | "COMMA"
  | "EQUALS"
  | "NOT"
  | "NOT_EQUALS"
  | "GREATER_THAN"
  | "LESS_THAN"
  | "EQUALS_EQUALS"
  | "TEMPLATE_HEAD" // `Hi ${
  | "TEMPLATE_MIDDLE" // , had ${
  | "TEMPLATE_TAIL" //  alerts`
  | "EOF";

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

export const KEYWORDS: Record<string, TokenType> = {
  schema: "SCHEMA",
  agent: "AGENT",
  edition: "EDITION",
  provider: "PROVIDER",
  env: "ENV",
  true: "BOOLEAN",
  false: "BOOLEAN",
  flow: "FLOW",
  private: "PRIVATE",
  parallel: "PARALLEL",
  use: "USE",
  unsafe: "UNSAFE",
  let: "LET",
  if: "IF",
  else: "ELSE",
  return: "RETURN",
};

// Define a mapping of two-character tokens to their corresponding token types
// This allows for easy identification of two-character tokens during tokenization
// For example, if the lexer encounters the string "==", it will recognize it as an "EQUALS_EQUALS" token type
export const TWO_CHAR_TOKENS: Record<string, TokenType> = {
  "==": "EQUALS_EQUALS",
  "!=": "NOT_EQUALS",
};

// Define a mapping of single-character tokens to their corresponding token types
// This allows for easy identification of single-character tokens during tokenization
// For example, if the lexer encounters the string "{", it will recognize it as a "LBRACE" token type
export const SINGLE_CHAR_TOKENS: Record<string, TokenType> = {
  "{": "LBRACE",
  "}": "RBRACE",
  "(": "LPAREN",
  ")": "RPAREN",
  "[": "LBRACKET",
  "]": "RBRACKET",

  ":": "COLON",
  ";": "SEMICOLON",
  ".": "DOT",
  ",": "COMMA",
  "=": "EQUALS",
  "!": "NOT",
  ">": "GREATER_THAN",
  "<": "LESS_THAN",
};
