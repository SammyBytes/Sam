//------------------------------------------------------------------
// AST Node Types for Schema and Agent Declarations
//------------------------------------------------------------------

import type { AgentRunnerKind } from "@sam-lang/runtime";

// ------------------------------------------------------------------
// Schema Types (v0.1.0)
// ------------------------------------------------------------------
export interface FieldNode {
  type: "FieldDefinition";
  name: string; // e.g., "active", "name"
  fieldType: string; // e.g., "string", "number", "boolean"
}

export interface SchemaNode {
  type: "SchemaDeclaration";
  name: string; // e.g., "TestSchema"
  fields: FieldNode[]; // Array of field definitions within the schema example: [{ name: "active", fieldType: "boolean" }]
}

// ------------------------------------------------------------------
// Agent Types (v0.2.0)
// ------------------------------------------------------------------

export type AgentPropertyType =
  | { type: "Identifier"; value: AgentRunnerKind } // e.g., "claude_code", "opencode"
  | { type: "StringLiteral"; value: string } // e.g., "./src"
  | { type: "NumberLiteral"; value: number } // e.g., 42
  | { type: "BooleanLiteral"; value: boolean } // e.g., true
  | { type: "EnvLiteral"; value: string }; // e.g., "MY_ENV_VAR"

export interface AgentPropertyNode {
  type: "AgentProperty";
  name: string; // e.g., "name", "version"
  value: AgentPropertyType; // The value of the property, which can be one of the defined types
}

export interface AgentNode {
  type: "AgentDeclaration";
  name: string; // e.g., "MyAgent"
  properties: AgentPropertyNode[]; // Array of agent properties
}

//------------------------------------------------------------------
// AST Node Types
//------------------------------------------------------------------

export type ASTNode = SchemaNode | AgentNode;

export interface ProgramNode {
  type: "Program";
  body: ASTNode[]; // Array of AST nodes, which can include schema declarations and other constructs
}
