import type { ProviderNode } from "../../parser/ast";
import { formatStringOrEnv } from "../helper";

export function generateProvider(providerNode: ProviderNode): string {
  const props = new Map(
    providerNode.properties.map((prop) => [prop.name, prop]),
  );

  const protocolProp = props.get("protocol");
  const baseUrlProp = props.get("base_url");
  const apiKeyProp = props.get("api_key");
  const strictSchemaProp = props.get("strict_schema");

  const configFields: string[] = [
    `name: ${JSON.stringify(providerNode.name)}`,
    `protocol: ${JSON.stringify(protocolProp?.value.value)}`,
    `baseUrl: ${formatStringOrEnv(baseUrlProp!.value)}`,
  ];

  if (apiKeyProp) {
    configFields.push(`apiKey: ${formatStringOrEnv(apiKeyProp.value)}`);
  }
  if (strictSchemaProp) {
    configFields.push(`strictSchema: ${strictSchemaProp.value.value}`);
  }

  return `{ ${configFields.join(", ")} }`;
}
