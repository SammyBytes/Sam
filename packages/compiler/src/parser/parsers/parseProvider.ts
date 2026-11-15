import { ProviderProtocol, type ProviderProtocolKind } from "@sam-lang/runtime";
import type { ProviderNode, ProviderPropertyNode, ProviderTypes } from "../ast";
import type { IParserContext } from "../types";
import type { Token } from "../../lexer/tokens";

export function parseProvider(context: IParserContext): ProviderNode {
  context.consume("PROVIDER", "Expected 'provider' keyword");

  const nameToken = context.consume("IDENTIFIER", "Expected provider name");

  context.consume("LBRACE", "Expected '{' after provider name");

  const properties: ProviderPropertyNode[] = [];
  const propertiesNameSet = new Set<string>();

  while (!context.isAtEnd() && context.peek().type !== "RBRACE") {
    const propertyNameToken = context.consume(
      "IDENTIFIER",
      "Expected property name",
    );

    if (propertiesNameSet.has(propertyNameToken.value)) {
      throw new Error(
        `SyntaxError: Duplicate property name '${propertyNameToken.value}' at line ${propertyNameToken.line}, column ${propertyNameToken.column}. Each property name must be unique within a provider declaration.`,
      );
    }

    propertiesNameSet.add(propertyNameToken.value);

    context.consume("COLON", "Expected ':' after property name");

    const valueToken = context.peek();
    let value: ProviderTypes;

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
        value = parseProviderKind(valueToken.value);
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
          `SyntaxError: Unexpected token '${valueToken.value}' of type '${valueToken.type}' at line ${valueToken.line}, column ${valueToken.column}. Expected a string, number, boolean, identifier, or environment variable.`,
        );
    }

    properties.push({
      type: "ProviderProperty",
      name: propertyNameToken.value,
      value,
    });

    if (context.peek().type === "COMMA") {
      context.advance(); // Consume the comma
    }
  }

  context.consume("RBRACE", "Expected '}' after provider properties");

  // Validate required properties
  validateProviderProperties(nameToken, properties);

  return {
    type: "ProviderDeclaration",
    name: nameToken.value,
    properties,
  };
}

function parseProviderKind(identifier: string): ProviderTypes {
  const isValidKind = Object.values(ProviderProtocol).includes(
    identifier as ProviderProtocolKind,
  );

  if (!isValidKind) {
    throw new Error(
      `SyntaxError: Invalid provider kind '${identifier}'. Expected one of: ${Object.values(ProviderProtocol).join(", ")}`,
    );
  }

  return { type: "Identifier", value: identifier as ProviderProtocolKind };
}

function validateProviderProperties(
  providerName: Token,
  properties: ProviderPropertyNode[],
): void {
  const allowedProperties = new Set(["protocol", "base_url", "api_key"]);
  const presentProperties = new Set<string>();

  for (const property of properties) {
    if (!allowedProperties.has(property.name)) {
      throw new Error(
        `SyntaxError: Invalid property name '${property.name}' in provider '${providerName}'. Allowed properties are: ${Array.from(
          allowedProperties,
        ).join(", ")}`,
      );
    }
    presentProperties.add(property.name);

    if (property.name === "protocol") {
      const protocolValue = property.value;

      const isStringOrIdentifier =
        protocolValue.type === "StringLiteral" ||
        protocolValue.type === "Identifier";

      const isValidProtocol =
        isStringOrIdentifier &&
        Object.values(ProviderProtocol).includes(
          protocolValue.value as ProviderProtocolKind,
        );

      if (!isValidProtocol) {
        throw new Error(
          `SyntaxError: Invalid value '${protocolValue.value}' for 'protocol' in provider '${providerName.value}' at line ${providerName.line}, column ${providerName.column}. Expected one of: ${Object.values(
            ProviderProtocol,
          ).join(", ")}`,
        );
      }
    }

    if (
      property.name === "api_key" ||
      (property.name === "base_url" &&
        property.value.type !== "StringLiteral" &&
        property.value.type !== "EnvLiteral")
    ) {
      throw new Error(
        `SyntaxError: Invalid value for '${property.name}' in provider '${providerName.value}' at line ${providerName.line}, column ${providerName.column}. Expected a string literal or an environment variable.`,
      );
    }
  }

  const requiredProperties = ["protocol", "base_url"];
  const missingProperties = requiredProperties.filter(
    (prop) => !presentProperties.has(prop),
  );

  if (missingProperties.length > 0) {
    throw new Error(
      `SyntaxError: Missing required properties ${missingProperties.join(
        ", ",
      )} in provider '${providerName.value}'.`,
    );
  }
}
