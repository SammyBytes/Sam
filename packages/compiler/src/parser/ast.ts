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

// ------------------------------------------------------------------
// Flow Types (v0.3.0)
// ------------------------------------------------------------------

export interface FlowNode {
  type: "FlowDeclaration";
  name: string; // e.g., "MyFlow"
  params: Array<{ name: string; type: string }>; // Array of flow parameters with their names and types
  isPrivate: boolean; // Indicates if the flow is private
  body: StatementNode[]; // Array of statements that make up the body of the flow
}

export type StatementNode =
  | { type: "LetStatement"; name: string | string[]; value: ExpressionNode } // e.g., let x = 5;
  | {
      type: "IfStatement";
      condition: ExpressionNode;
      thenBranch: StatementNode[];
      elseBranch?: StatementNode[];
    } // e.g., if (x > 0) { ... } else { ... }
  | { type: "ReturnStatement"; value?: ExpressionNode } // e.g., return x;
  | { type: "ExpressionStatement"; expression: ExpressionNode }; // e.g., use MyAgent<TSchema>("input");

export type ExpressionNode =
  | { type: "Identifier"; name: string } // e.g., x
  | { type: "Literal"; value: string | number | boolean } // e.g., 42, "hello", true
  | {
      type: "BinaryExpression";
      operator: "==" | "!=" | "<" | ">";
      left: ExpressionNode;
      right: ExpressionNode;
    } // e.g., x == 5
  | {
      type: "UnaryExpression";
      operator: "!";
      argument: ExpressionNode;
    }
  | {
      type: "MemberExpression";
      object: ExpressionNode;
      property: string;
    } // e.g., obj.prop
  | {
      type: "CallExpression";
      callee: ExpressionNode;
      arguments: ExpressionNode[];
    }
  | UseExpressionNode
  | {
      type: "ParallelExpression";
      expressions: UseExpressionNode[];
    }; // e.g., parallel(use Agent1<TSchema>("input1"), use Agent2<TSchema>("input2"));

export type UseExpressionNode = {
  type: "UseExpression";
  variant: "safe" | "unsafe";
  agentName: string;
  inputPrompt: ExpressionNode;
  schema?: string;
};

//------------------------------------------------------------------
// AST Node Types
//------------------------------------------------------------------

export type ASTNode = SchemaNode | AgentNode | FlowNode;

export interface ProgramNode {
  type: "Program";
  body: ASTNode[]; // Array of AST nodes, which can include schema declarations and other constructs
}
