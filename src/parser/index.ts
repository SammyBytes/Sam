import type { Token, TokenType } from "../lexer";
import type { ASTNode, ProgramNode } from "./ast";
import { parseSchema } from "./parsers/parseSchema";
import type { IParserContext } from "./types";

export class Parser implements IParserContext {
  private tokens: Token[];
  private current: number;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
    this.current = 0;
  }

  public peek(): Token {
    return (
      this.tokens[this.current] || {
        type: "EOF",
        value: "",
        line: -1,
        column: -1,
      }
    );
  }

  public advance(): Token {
    if (!this.isAtEnd()) {
      this.current++;
    }
    return (
      this.tokens[this.current - 1] || {
        type: "EOF",
        value: "",
        line: -1,
        column: -1,
      }
    );
  }
  isAtEnd(): boolean {
    return this.current >= this.tokens.length || this.peek().type === "EOF";
  }
  public consume(type: TokenType, errorMessage: string): Token {
    const token = this.peek();
    if (token.type === type) {
      this.advance();
      return token;
    }
    throw new Error(
      `SyntaxError: ${errorMessage} at line ${token.line}, column ${token.column}`,
    );
  }

  public parse(): ProgramNode {
    const body: ASTNode[] = [];

    while (!this.isAtEnd()) {
      const token = this.peek();
      switch (token.type) {
        case "SCHEMA":
          body.push(parseSchema(this));
          break;
        default:
          throw new Error(
            `SyntaxError: Unexpected token '${token.value}' at line ${token.line}, column ${token.column}`,
          );
      }
    }

    return {
      type: "Program",
      body,
    };
  }
}
