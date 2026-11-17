import type { ProgramNode } from "../parser/ast";
import { generateFlow } from "./generators/flow/generateFlow";
import { generateAgent } from "./generators/generateAgent";
import { generateProvider } from "./generators/generateProvider";
import { generateSchema } from "./generators/generateSchema";

export interface CodegenOptions {
  zodImportPath?: string;
  runtimeImportPath?: string;
  useGlobalRuntime?: boolean;
  /**
   * Absolute directory of the `.sb` source file. Required when an agent uses
   * `system_prompt_file` so the path can be resolved safely relative to it.
   */
  sourceDir?: string;
}

export const generateCode = (
  programNode: ProgramNode,
  options?: CodegenOptions,
): string => {
  const schemas: string[] = [];
  const agents: string[] = [];
  const providers: string[] = [];
  const flows: string[] = [];
  const flowNames: Set<string> = new Set();
  const providerNames: Set<string> = new Set();

  for (const node of programNode.body) {
    if (node.type === "FlowDeclaration") {
      if (flowNames.has(node.name)) {
        throw new Error(`Duplicate flow name: ${node.name}`);
      }
      flowNames.add(node.name);
    }

    if (node.type === "ProviderDeclaration") {
      if (providerNames.has(node.name)) {
        throw new Error(`Duplicate provider name: ${node.name}`);
      }
      providerNames.add(node.name);
    }
  }

  for (const node of programNode.body) {
    switch (node.type) {
      case "SchemaDeclaration": {
        const schemaCode = generateSchema(node);
        schemas.push(schemaCode);
        break;
      }

      case "AgentDeclaration": {
        const agentCode = generateAgent(node, options);
        agents.push(agentCode);
        break;
      }

      case "FlowDeclaration": {
        const flowCode = generateFlow(node, flowNames);
        flows.push(flowCode);
        break;
      }

      case "ProviderDeclaration": {
        const providerCode = generateProvider(node);
        providers.push(providerCode);
        break;
      }

      default:
        break;
    }
  }

  if (
    schemas.length === 0 &&
    agents.length === 0 &&
    flows.length === 0 &&
    providers.length === 0
  ) {
    return "";
  }

  const imports: string[] = [];

  // Determine if we need to import zod or runtime based on the presence of schemas, agents, flows, or providers
  const needsRuntime =
    agents.length > 0 || flows.length > 0 || providers.length > 0;

  if (options?.useGlobalRuntime) {
    if (schemas.length > 0) {
      imports.push(
        `const { z } = globalThis as unknown as { z: typeof import("zod").z };`,
      );
    }
    if (needsRuntime) {
      imports.push(
        `const { createRuntime } = globalThis as unknown as { createRuntime: typeof import("@sam-lang/runtime").createRuntime };`,
      );
    }
  } else {
    const zodSpecifier = options?.zodImportPath ?? "zod";
    const runtimeSpecifier = options?.runtimeImportPath ?? "@sam-lang/runtime";

    if (schemas.length > 0) {
      imports.push(`import { z } from ${JSON.stringify(zodSpecifier)};`);
    }
    if (needsRuntime) {
      imports.push(
        `import { createRuntime } from ${JSON.stringify(runtimeSpecifier)};`,
      );
    }
  }

  const sections: string[] = [];

  if (imports.length > 0) {
    sections.push(imports.join("\n"));
  }

  if (schemas.length > 0) {
    sections.push(schemas.join("\n\n"));
  }

  if (providers.length > 0) {
    const providersBody = `\n  ${providers.join(",\n  ")}\n`;
    sections.push(`const providers = [${providersBody}];`);
  }

  if (needsRuntime) {
    const agentsBody = agents.length > 0 ? `\n  ${agents.join(",\n  ")}\n` : "";
    const runtimeArgs =
      providers.length > 0 ? `[${agentsBody}], providers` : `[${agentsBody}]`;
    sections.push(`const sam = createRuntime(${runtimeArgs});`);
  }

  if (flows.length > 0) {
    sections.push(flows.join("\n\n"));
  }

  return sections.join("\n\n");
};
