import type { AgentNode, AgentPropertyNode, AgentPropertyType } from "../ast";
import type { IParserContext } from "../types";

export function parseAgent(context: IParserContext): AgentNode {
  context.consume("AGENT", "Expected 'agent' keyword");

  const nameToken = context.consume("IDENTIFIER", "Expected agent name");

  context.consume("LBRACE", "Expected '{' after agent name");

  const properties: AgentPropertyNode[] = [];

  while (!context.isAtEnd() && context.peek().type !== "RBRACE") {
    const propertyNameToken = context.consume(
      "IDENTIFIER",
      "Expected property name",
    );
    context.consume("COLON", "Expected ':' after property name");

    const valueToken = context.peek();
    let value: AgentPropertyType;

    switch (valueToken.type) {
      case "STRING":
        value = { type: "StringLiteral", value: valueToken.value };
        break;
      case "NUMBER":
        value = { type: "NumberLiteral", value: parseFloat(valueToken.value) };
        break;
      case "BOOLEAN":
        value = { type: "BooleanLiteral", value: valueToken.value === "true" };
        break;
      case "IDENTIFIER":
        value = { type: "Identifier", value: valueToken.value };
        break;
      case "ENV":
        value = { type: "EnvLiteral", value: valueToken.value };
        break;
      default:
        throw new Error(
          `SyntaxError: Unexpected token '${valueToken.value}' at line ${valueToken.line}, column ${valueToken.column}. Expected a value for property '${propertyNameToken.value}'.`,
        );
    }

    context.advance(); // Consume the value token

    properties.push({
      type: "AgentProperty",
      name: propertyNameToken.value,
      value,
    });

    if (context.peek().type === "COMMA") {
      context.advance(); // Consume the comma
    }
  }

  context.consume("RBRACE", "Expected '}' after agent properties");

  return {
    type: "AgentDeclaration",
    name: nameToken.value,
    properties,
  };
}
