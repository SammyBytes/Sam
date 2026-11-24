import type {
  AgentNode,
  ASTNode,
  FlowNode,
  ProgramNode,
  SchemaNode,
  TypeAnnotation,
} from "./ast";

const PRIMITIVE_TYPES = new Set(["string", "number", "boolean"]);

function formatTypeAnnotation(type: TypeAnnotation): string {
  return type.kind === "BaseType"
    ? type.name
    : `${formatTypeAnnotation(type.elementType)}[]`;
}

function validateTypeAnnotation(
  type: TypeAnnotation,
  schemas: Set<string>,
  contextLabel: string,
): void {
  if (type.kind === "ArrayType") {
    validateTypeAnnotation(type.elementType, schemas, contextLabel);
    return;
  }

  if (!PRIMITIVE_TYPES.has(type.name) && !schemas.has(type.name)) {
    throw new Error(
      `SemanticError: ${contextLabel} uses an undeclared type '${type.name}'.`,
    );
  }
}

export function validateProgram(program: ProgramNode): void {
  const declaredSymbols = new Map<string, string>(); // Name -> Type ("Schema", "Agent", "Provider", "Flow")

  const providers = new Set<string>();
  const usedProviders = new Set<string>();
  const agents: AgentNode[] = [];
  const flows: FlowNode[] = [];
  const schemasNames = new Set<string>();
  const schemas: SchemaNode[] = [];

  // Detect duplicate declarations and collect providers, agents, and flows
  for (const node of program.body) {
    const kind = node.type.replace("Declaration", ""); // e.g., "SchemaDeclaration" -> "Schema"
    if (declaredSymbols.has(node.name)) {
      const existingKind = declaredSymbols.get(node.name);
      throw new Error(
        `SemanticError: Duplicate identifier '${node.name}'. Already declared as ${existingKind}.`,
      );
    }
    declaredSymbols.set(node.name, kind);

    if (node.type === "ProviderDeclaration") {
      providers.add(node.name);
    }
    if (node.type === "AgentDeclaration") {
      agents.push(node);
    }
    if (node.type === "FlowDeclaration") {
      flows.push(node);
    }

    if (node.type === "SchemaDeclaration") {
      schemasNames.add(node.name);
      schemas.push(node);
    }
  }

  // Validate that all agents reference declared providers
  for (const agent of agents) {
    const providerProp = agent.properties.find(
      (prop) => prop.name === "provider",
    );

    if (!providerProp) continue; // No provider property, skip validation for this agent

    const providerName = String(providerProp.value.value);
    if (!providers.has(providerName)) {
      throw new Error(
        `SemanticError: Agent '${agent.name}' references an undeclared provider '${providerName}'.`,
      );
    }
    usedProviders.add(providerName);
  }

  for (const schema of schemas) {    
    for (const field of schema.fields) {

      if(field.fieldType.kind === "BaseType" && !PRIMITIVE_TYPES.has(field.fieldType.name) && !schemasNames.has(field.fieldType.name)) {
        throw new Error(
          `SemanticError: Schema '${schema.name}' field '${field.name}' uses an undeclared type '${field.fieldType.name}'.`,
        );
      }

      const typeName = field.fieldType;
      validateTypeAnnotation(
        typeName,
        schemasNames,
        `Schema '${schema.name}' field '${field.name}'`,
      );
    }
  }

  for (const flow of flows) {
    for (const param of flow.params) {
      const typeName = param.type;
      validateTypeAnnotation(
        typeName,
        schemasNames,
        `Flow '${flow.name}' parameter '${param.name}'`,
      );
    }
  }

  // Zero providers declared but agents exist
  for (const provider of providers) {
    if (!usedProviders.has(provider)) {
      throw new Error(
        `SemanticError: Provider '${provider}' declared but not used by any agent.`,
      );
    }
  }
}
