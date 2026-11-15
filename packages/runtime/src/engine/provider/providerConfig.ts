import type { ProviderProtocolKind } from "../../types";

export type ProviderConfig = {
  name: string;
  protocol: ProviderProtocolKind;
  apiKey?: string;
  baseUrl: string;
};
