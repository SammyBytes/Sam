import type { ProgramNode } from "../parser/ast";
import { generateSchema } from "./generators/generateSchema";

export const generateCode = (programNode: ProgramNode): string => {
    const parts: string[] = [];

    for (const node of programNode.body) {
        if (node.type === "SchemaDeclaration") {
            const schemaCode = generateSchema(node);
            parts.push(schemaCode);
        }
    }

    if (parts.length === 0) {
        return "";
    }

    return `import { z } from "zod";\n\n${parts.join("\n\n")}`;
}