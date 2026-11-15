import type { ProviderNode } from "../../parser/ast";

export function generateProvider(providerNode: ProviderNode): string {
  const props = new Map(
    providerNode.properties.map((prop) => [prop.name, prop]),
  );

  const protocolProp = props.get("protocol");
  const baseUrlProp = props.get("base_url");
  const apiKeyProp = props.get("api_key");

  const configFields: string[] = [
    `name: ${JSON.stringify(providerNode.name)}`,
    `protocol: ${JSON.stringify(protocolProp?.value.value)}`,
    `baseUrl: ${JSON.stringify(baseUrlProp?.value.value)}`,
  ];

  if (apiKeyProp !== undefined) {
    configFields.push(`apiKey: ${JSON.stringify(apiKeyProp.value.value)}`);
  }

  return `{ ${configFields.join(", ")} }`;
}
