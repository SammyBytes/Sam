import type { FieldNode, SchemaNode } from "../ast";
import type { IParserContext } from "../types";

export function parseSchema(context: IParserContext): SchemaNode {
    context.consume("SCHEMA", "Expected 'schema' keyword");

    const nameToken = context.consume("IDENTIFIER", "Expected schema name");

    context.consume("LBRACE", "Expected '{' after schema name");

    const fields: FieldNode[] = [];

    while (!context.isAtEnd() && context.peek().type !== "RBRACE") {
        const fieldNameToken = context.consume("IDENTIFIER", "Expected field name");
        context.consume("COLON", "Expected ':' after field name");
        const fieldTypeToken = context.consume("IDENTIFIER", "Expected field type");

        fields.push({
            type: "FieldDefinition",
            name: fieldNameToken.value,
            fieldType: fieldTypeToken.value,
        });

        if (context.peek().type === "COMMA") {
            context.advance(); // Consume the comma
        }
    }

    context.consume("RBRACE", "Expected '}' after schema fields");

    return {
        type: "SchemaDeclaration",
        name: nameToken.value,
        fields,
    };
}
