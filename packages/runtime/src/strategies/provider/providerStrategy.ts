import type z from "zod";
import type { ProviderAgentConfig } from "../../engine/agentConfig";
import type { ProviderConfig } from "../../engine/provider/providerConfig";

export interface HttpRequestSpec {
  url: string;
  headers: Record<string, string>;
  body: string | Record<string, unknown> | undefined;
}

export interface IProviderStrategy {
  buildRequest(
    provider: ProviderConfig,
    agent: ProviderAgentConfig,
    inputPrompt: string,
    schema?: z.ZodTypeAny,
  ): HttpRequestSpec;

  extractContent(responseBody: unknown): string | null;
}