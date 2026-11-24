import type { SchemaNode, TypeAnnotation } from "../../parser/ast";

const TYPE_MAPPING: Record<string, string> = {
  string: "z.string()",
  number: "z.number()",
  boolean: "z.boolean()",
};

function emitZodType(type: TypeAnnotation): string {
  if (type.kind === "ArrayType") {
    return `z.array(${emitZodType(type.elementType)})`;
  }

  return TYPE_MAPPING[type.name] ?? `${type.name}Schema`;
}

export function generateSchema(schemaNode: SchemaNode): string {
  const fieldsCode = schemaNode.fields
    .map((field) => {
      const zodType = emitZodType(field.fieldType);
      return `  ${field.name}: ${zodType},`;
    })
    .join("\n");

  const schemaConst = `export const ${schemaNode.name}Schema = z.object({\n${fieldsCode}\n});`;
  const typeExport = `export type ${schemaNode.name} = z.infer<typeof ${schemaNode.name}Schema>;`;

  return `${schemaConst}\n\n${typeExport}`;
}
