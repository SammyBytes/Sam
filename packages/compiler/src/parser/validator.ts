import type { AgentNode, ASTNode, FlowNode, ProgramNode } from "./ast";

export function validateProgram(program: ProgramNode): void {
  const declaredSymbols = new Map<string, string>(); // Name -> Type ("Schema", "Agent", "Provider", "Flow")

  const providers = new Set<string>();
  const usedProviders = new Set<string>();
  const agents: AgentNode[] = [];
  const flows: FlowNode[] = [];

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

  // Zero providers declared but agents exist
  for (const provider of providers) {
    if (!usedProviders.has(provider)) {
      throw new Error(
        `SemanticError: Provider '${provider}' declared but not used by any agent.`,
      );
    }
  }
}
