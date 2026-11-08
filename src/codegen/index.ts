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

    return parts.join("\n\n");
}