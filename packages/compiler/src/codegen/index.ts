import type { ProgramNode } from "../parser/ast";
import { generateAgent } from "./generators/generateAgent";
import { generateSchema } from "./generators/generateSchema";

export const generateCode = (programNode: ProgramNode): string => {
  const schemas: string[] = [];
  const agents: string[] = [];

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

      default:
        // This case should never happen if the parser is working correctly, but we include it for completeness.
        break;
    }
  }

  if (schemas.length === 0 && agents.length === 0) {
    return "";
  }

  const imports: string[] = [];
  if (schemas.length > 0) {
    imports.push(`import { z } from "zod";`);
  }
  if (agents.length > 0) {
    imports.push(`import { createRuntime } from "@sam-lang/runtime";`);
  }

  const sections: string[] = [];

  if (imports.length > 0) {
    sections.push(imports.join("\n"));
  }

  if (schemas.length > 0) {
    sections.push(schemas.join("\n\n"));
  }
  if (agents.length > 0) {
    sections.push(
      `const sam = createRuntime([\n  ${agents.join(",\n  ")}\n]);`,
    );
  }

  return sections.join("\n\n");
};
