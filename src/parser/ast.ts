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

export type ASTNode = SchemaNode;

export interface ProgramNode {
  type: "Program";
  body: ASTNode[]; // Array of AST nodes, which can include schema declarations and other constructs
}