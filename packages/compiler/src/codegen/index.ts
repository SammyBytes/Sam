import type { ProgramNode } from "../parser/ast";
import { generateFlow } from "./generators/flow/generateFlow";
import { generateAgent } from "./generators/generateAgent";
import { generateSchema } from "./generators/generateSchema";

export interface CodegenOptions {
  zodImportPath?: string;
  runtimeImportPath?: string;
  useGlobalRuntime?: boolean;
}

export const generateCode = (
  programNode: ProgramNode,
  options?: CodegenOptions
): string => {
  const schemas: string[] = [];
  const agents: string[] = [];
  const flows: string[] = [];
  const flowNames: Set<string> = new Set();

  for (const node of programNode.body) {
    if (node.type === "FlowDeclaration") {
      if (flowNames.has(node.name)) {
        throw new Error(`Duplicate flow name: ${node.name}`);
      }
      flowNames.add(node.name);
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
        const agentCode = generateAgent(node);
        agents.push(agentCode);
        break;
      }

      case "FlowDeclaration": {
        const flowCode = generateFlow(node, flowNames);
        flows.push(flowCode);
        break;
      }

      default:
        break;
    }
  }

  if (schemas.length === 0 && agents.length === 0 && flows.length === 0) {
    return "";
  }

  const imports: string[] = [];

  if (options?.useGlobalRuntime) {
    if (schemas.length > 0) {
      imports.push(
        `const { z } = globalThis as unknown as { z: typeof import("zod").z };`
      );
    }
    if (agents.length > 0 || flows.length > 0) {
      imports.push(
        `const { createRuntime } = globalThis as unknown as { createRuntime: typeof import("@sam-lang/runtime").createRuntime };`
      );
    }
  } else {
    const zodSpecifier = options?.zodImportPath ?? "zod";
    const runtimeSpecifier = options?.runtimeImportPath ?? "@sam-lang/runtime";

    if (schemas.length > 0) {
      imports.push(`import { z } from ${JSON.stringify(zodSpecifier)};`);
    }
    if (agents.length > 0 || flows.length > 0) {
      imports.push(
        `import { createRuntime } from ${JSON.stringify(runtimeSpecifier)};`
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

  if (agents.length > 0 || flows.length > 0) {
    const agentsBody =
      agents.length > 0 ? `\n  ${agents.join(",\n  ")}\n` : "";
    sections.push(`const sam = createRuntime([${agentsBody}]);`);
  }

  if (flows.length > 0) {
    sections.push(flows.join("\n\n"));
  }

  return sections.join("\n\n");
};