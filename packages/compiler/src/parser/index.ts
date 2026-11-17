import type { Token, TokenType } from "../lexer/tokens";
import {
  DEFAULT_EDITION,
  SUPPORTED_EDITIONS,
  type ASTNode,
  type ProgramNode,
  type SamEdition,
} from "./ast";
import { parseAgent } from "./parsers/parseAgent";
import { parseFlow } from "./parsers/parseFlow";
import { parseProvider } from "./parsers/parseProvider";
import { parseSchema } from "./parsers/parseSchema";
import type { IParserContext } from "./types";
import { validateProgram } from "./validator";

export class Parser implements IParserContext {
  private tokens: Token[];
  private current: number;
  public edition: SamEdition;

  constructor(tokens: Token[], edition: SamEdition = DEFAULT_EDITION) {
    this.tokens = tokens;
    this.edition = edition;
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

    switch (this.peek().type) {
      case "EDITION":
        this.edition = this.parseHeaderEdition();
        break;
      default:
        this.edition = DEFAULT_EDITION; // Default to 2026 if no edition is specified
    }

    while (!this.isAtEnd()) {
      const token = this.peek();

      switch (token.type) {
        case "EDITION":
          throw new Error(
            `SyntaxError: 'edition' directive must appear only once at the top of the file (line ${token.line}, column ${token.column})`,
          );
        case "SCHEMA":
          body.push(parseSchema(this));
          break;
        case "AGENT":
          body.push(parseAgent(this));
          break;
        case "FLOW":
        case "PRIVATE":
          body.push(parseFlow(this));
          break;
        case "PROVIDER":
          body.push(parseProvider(this));
          break;
        default:
          throw new Error(
            `SyntaxError: Unexpected token '${token.value}' at line ${token.line}, column ${token.column}`,
          );
      }
    }

    const programNode: ProgramNode = {
      type: "Program",
      edition: this.edition,
      body,
    };

    validateProgram(programNode);
    return programNode;
  }

  private parseHeaderEdition(): SamEdition {
    const editionToken = this.peek();
    if (editionToken.type === "EDITION") {
      this.advance(); // Consume the "EDITION" token
      const editionValueToken = this.consume(
        "STRING",
        'Expected a string value for the edition (e.g., edition "2026")',
      );

      const editionValue = editionValueToken.value;
      if (!SUPPORTED_EDITIONS.includes(editionValue as SamEdition)) {
        throw new Error(
          `SyntaxError: Unsupported edition '${editionValue}' at line ${editionValueToken.line}, column ${editionValueToken.column}. Supported editions: ${SUPPORTED_EDITIONS.join(", ")}`,
        );
      }
      return editionValue as SamEdition;
    }
    return DEFAULT_EDITION; // Default to 2026 if no edition is specified
  }
}
