import { AgentRunner, type AgentRunnerKind } from "@sam-lang/runtime";
import type { AgentNode, AgentPropertyNode, AgentPropertyType } from "../ast";
import type { IParserContext } from "../types";
import type { Token } from "../../lexer/tokens";

type AgentPropertyValidator = (
  value: AgentPropertyType,
  agentToken: Token,
) => void;

const AGENT_PROPERTY_VALIDATORS: Record<string, AgentPropertyValidator> = {
  name: validateString,
  provider: validateProviderRef,
  runner: validateRunnerKind,
  model: validateString,
  workspace: validateString,
  system_prompt: validateString,
  system_prompt_file: validateString,
  timeout: validateNumber,
  temperature: validateNumber,
};

export function parseAgent(context: IParserContext): AgentNode {
  context.consume("AGENT", "Expected 'agent' keyword");

  const nameToken = context.consume("IDENTIFIER", "Expected agent name");

  context.consume("LBRACE", "Expected '{' after agent name");

  const properties: AgentPropertyNode[] = [];
  const propertiesNameSet = new Set<string>();

  while (!context.isAtEnd() && context.peek().type !== "RBRACE") {
   const propertyNameToken = consumeAgentPropertyName(context);

    if (propertiesNameSet.has(propertyNameToken.value)) {
      throw new Error(
        `SyntaxError: Duplicate property name '${propertyNameToken.value}' at line ${propertyNameToken.line}, column ${propertyNameToken.column}. Each property name must be unique within an agent declaration.`,
      );
    }

    propertiesNameSet.add(propertyNameToken.value);

    context.consume("COLON", "Expected ':' after property name");

    const value = parseAgentPropertyValue(context, propertyNameToken.value);

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
  validateAgentProperties(nameToken, properties);

  return {
    type: "AgentDeclaration",
    name: nameToken.value,
    properties,
  };
}

// --- Parsing logic for agent property values ---
function parseAgentPropertyValue(
  context: IParserContext,
  propertyName: string,
): AgentPropertyType {
  const valueToken = context.peek();

  switch (valueToken.type) {
    case "STRING":
      context.advance();
      return { type: "StringLiteral", value: valueToken.value };
    case "NUMBER":
      context.advance();
      return { type: "NumberLiteral", value: parseFloat(valueToken.value) };
    case "BOOLEAN":
      context.advance();
      return { type: "BooleanLiteral", value: valueToken.value === "true" };
    case "IDENTIFIER":
      context.advance();
      // Save the free Identifier; the validator checks if it's runner or provider
      return { type: "Identifier", value: valueToken.value };
    case "ENV": {
      context.advance();
      context.consume("LPAREN", "Expected '(' after 'env'");
      const envVarToken = context.consume(
        "STRING",
        "Expected environment variable name inside 'env()'",
      );
      context.consume("RPAREN", "Expected ')' after environment variable name");
      return { type: "EnvLiteral", value: envVarToken.value };
    }
    default:
      throw new Error(
        `SyntaxError: Unexpected token '${valueToken.value}' at line ${valueToken.line}, column ${valueToken.column} for property '${propertyName}'.`,
      );
  }
}

// --- Orchestration and validation logic for agent properties ---
function validateAgentProperties(
  agentToken: Token,
  properties: AgentPropertyNode[],
): void {
  const present = new Set<string>();

  for (const prop of properties) {
    const validator = AGENT_PROPERTY_VALIDATORS[prop.name];

    if (!validator) {
      throw new Error(
        `ValidationError in agent '${agentToken.value}' (line ${agentToken.line}): Unknown property '${prop.name}'.`,
      );
    }

    validator(prop.value, agentToken);
    present.add(prop.name);
  }

  validateExecutionTarget(agentToken, present);
  validatePromptExclusivity(agentToken, present);
}

// --- Business logic validators for specific properties ---
function validateExecutionTarget(
  agentToken: Token,
  present: Set<string>,
): void {
  const hasProvider = present.has("provider");
  const hasRunner = present.has("runner");

  if (hasProvider && hasRunner) {
    throw new Error(
      `ValidationError in agent '${agentToken.value}' (line ${agentToken.line}): 'provider' and 'runner' are mutually exclusive.`,
    );
  }

  if (!hasProvider && !hasRunner) {
    throw new Error(
      `ValidationError in agent '${agentToken.value}' (line ${agentToken.line}): Agent must specify either 'provider' or 'runner'.`,
    );
  }

  if (hasProvider) {
    if (present.has("workspace")) {
      throw new Error(
        `ValidationError in agent '${agentToken.value}' (line ${agentToken.line}): 'workspace' is not allowed when using an HTTP 'provider'.`,
      );
    }
    if (!present.has("model")) {
      throw new Error(
        `ValidationError in agent '${agentToken.value}' (line ${agentToken.line}): 'model' is required when using a 'provider'.`,
      );
    }
  }

  if (hasRunner && !present.has("workspace")) {
    throw new Error(
      `ValidationError in agent '${agentToken.value}' (line ${agentToken.line}): Missing required property 'workspace' for local runner.`,
    );
  }
}

function validatePromptExclusivity(
  agentToken: Token,
  present: Set<string>,
): void {
  if (present.has("system_prompt") && present.has("system_prompt_file")) {
    throw new Error(
      `ValidationError in agent '${agentToken.value}' (line ${agentToken.line}): 'system_prompt' and 'system_prompt_file' are mutually exclusive.`,
    );
  }
}

// --- Type-specific validators ---
function validateRunnerKind(value: AgentPropertyType, token: Token): void {
  if (
    value.type !== "Identifier" ||
    !Object.values(AgentRunner).includes(value.value as AgentRunnerKind)
  ) {
    throw new Error(
      `ValidationError in agent '${token.value}' (line ${token.line}): Invalid 'runner'. Expected one of: ${Object.values(AgentRunner).join(", ")}`,
    );
  }
}

function validateProviderRef(value: AgentPropertyType, token: Token): void {
  if (value.type !== "Identifier") {
    throw new Error(
      `ValidationError in agent '${token.value}' (line ${token.line}): 'provider' must be an identifier referencing a declared provider (e.g., provider: Groq).`,
    );
  }
}

function validateString(value: AgentPropertyType, token: Token): void {
  if (value.type !== "StringLiteral") {
    throw new Error(
      `ValidationError in agent '${token.value}' (line ${token.line}): Expected a string value.`,
    );
  }
}

function validateNumber(value: AgentPropertyType, token: Token): void {
  if (value.type !== "NumberLiteral") {
    throw new Error(
      `ValidationError in agent '${token.value}' (line ${token.line}): Expected a numeric value.`,
    );
  }
}

function consumeAgentPropertyName(context: IParserContext): Token {
  const token = context.peek();
  if (token.type === "IDENTIFIER" || token.type === "PROVIDER") {
    return context.advance();
  }
  throw new Error(
    `SyntaxError: Expected property name at line ${token.line}, column ${token.column}`,
  );
}