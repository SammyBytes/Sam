import { AgentRunner, type AgentRunnerKind } from "@sam-lang/runtime";
import type { AgentNode, AgentPropertyNode, AgentPropertyType } from "../ast";
import type { IParserContext } from "../types";

export function parseAgent(context: IParserContext): AgentNode {
  context.consume("AGENT", "Expected 'agent' keyword");

  const nameToken = context.consume("IDENTIFIER", "Expected agent name");

  context.consume("LBRACE", "Expected '{' after agent name");

  const properties: AgentPropertyNode[] = [];
  const propertiesNameSet = new Set<string>();

  while (!context.isAtEnd() && context.peek().type !== "RBRACE") {
    const propertyNameToken = context.consume(
      "IDENTIFIER",
      "Expected property name",
    );

    if (propertiesNameSet.has(propertyNameToken.value)) {
      throw new Error(
        `SyntaxError: Duplicate property name '${propertyNameToken.value}' at line ${propertyNameToken.line}, column ${propertyNameToken.column}. Each property name must be unique within an agent declaration.`,
      );
    }

    propertiesNameSet.add(propertyNameToken.value);

    context.consume("COLON", "Expected ':' after property name");

    const valueToken = context.peek();
    let value: AgentPropertyType;

    switch (valueToken.type) {
      case "STRING":
        value = { type: "StringLiteral", value: valueToken.value };
        context.advance(); // Consume the string token
        break;
      case "NUMBER":
        value = { type: "NumberLiteral", value: parseFloat(valueToken.value) };
        context.advance(); // Consume the number token
        break;
      case "BOOLEAN":
        value = { type: "BooleanLiteral", value: valueToken.value === "true" };
        context.advance(); // Consume the boolean token
        break;
      case "IDENTIFIER":
        value = parseAgentKind(valueToken.value);
        context.advance(); // Consume the identifier token
        break;
      case "ENV":
        context.advance(); // Consume the 'ENV' token
        context.consume("LPAREN", "Expected '(' after 'env'");
        const envVarToken = context.consume(
          "STRING",
          "Expected environment variable name inside 'env()'",
        );
        context.consume(
          "RPAREN",
          "Expected ')' after environment variable name",
        );
        value = { type: "EnvLiteral", value: envVarToken.value };
        break;
      default:
        throw new Error(
          `SyntaxError: Unexpected token '${valueToken.value}' at line ${valueToken.line}, column ${valueToken.column}. Expected a value for property '${propertyNameToken.value}'.`,
        );
    }

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

  // Validate required properties
  validateAgentProperties(nameToken.value, propertiesNameSet);

  return {
    type: "AgentDeclaration",
    name: nameToken.value,
    properties,
  };
}

function parseAgentKind(value: string): AgentPropertyType {
  const isValidKind = Object.values(AgentRunner).includes(
    value as AgentRunnerKind,
  );
  if (!isValidKind) {
    throw new Error(
      `SyntaxError: Invalid agent runner kind '${value}'. Expected one of: ${Object.values(
        AgentRunner,
      ).join(", ")}`,
    );
  }
  return { type: "Identifier", value: value as AgentRunnerKind };
}

function validateAgentProperties(agentName: string, keys: Set<string>) {
  if (!keys.has("runner")) {
    throw new Error(
      `ValidationError in agent '${agentName}': Missing required property 'runner'`,
    );
  }

  if (!keys.has("workspace")) {
    throw new Error(
      `ValidationError in agent '${agentName}': Missing required property 'workspace'`,
    );
  }

  if (keys.has("system_prompt") && keys.has("system_prompt_file")) {
    throw new Error(
      `ValidationError in agent '${agentName}': 'system_prompt' and 'system_prompt_file' are mutually exclusive`,
    );
  }
}
