import type { ProgramNode } from "../parser/ast";
import { generateAgent } from "./generators/generateAgent";
import { generateSchema } from "./generators/generateSchema";

export const generateCode = (programNode: ProgramNode): string => {
  const parts: string[] = [];
  let requiresZod = false;

  for (const node of programNode.body) {
    switch (node.type) {
      case "SchemaDeclaration": {
        const schemaCode = generateSchema(node);
        parts.push(schemaCode);
        requiresZod = true;
        break;
      }

      case "AgentDeclaration": {
        const agentCode = generateAgent(node);
        parts.push(agentCode);
        break;
      }

      default:
        // This case should never happen if the parser is working correctly, but we include it for completeness.
        break;
    }
  }

  if (parts.length === 0) {
    return "";
  }

  const imports = requiresZod ? `import { z } from "zod";\n\n` : "";

  return `${imports}${parts.join("\n\n")}`;
};