import type { SchemaNode } from "../../parser/ast";

const TYPE_MAPPING: Record<string, string> = {
  string: "z.string()",
  number: "z.number()",
  boolean: "z.boolean()",
};

export function generateSchema(schemaNode: SchemaNode): string {
  const fieldsCode = schemaNode.fields
    .map((field) => {
      const zodType = TYPE_MAPPING[field.fieldType] || `z.unknown()`;
      return `  ${field.name}: ${zodType},`;
    })
    .join("\n");

  const schemaConst = `export const ${schemaNode.name}Schema = z.object({\n${fieldsCode}\n});`;
  const typeExport = `export type ${schemaNode.name} = z.infer<typeof ${schemaNode.name}Schema>;`;

  return `${schemaConst}\n\n${typeExport}`;
}
