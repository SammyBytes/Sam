import type { Token, TokenType } from "../lexer/tokens";
import type { SamEdition } from "./ast";

export interface IParserContext {
  peek(): Token;
  advance(): Token;
  isAtEnd(): boolean;
  consume(type: TokenType, errorMessage: string): Token;
  readonly edition: SamEdition; // The edition of the Sam language being used
}
