import type { Token, TokenType } from "../lexer";

export interface IParserContext {
  peek(): Token;
  advance(): Token;
  isAtEnd(): boolean;
  consume(type: TokenType, errorMessage: string): Token;
}
