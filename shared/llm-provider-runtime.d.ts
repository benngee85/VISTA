export type LlmProviderName =
  | 'ollama'
  | 'openrouter'
  | 'groq'
  | 'generic';

export interface ProviderCredentialOverrides {
  model?: string;
  enableReasoning?: boolean;
}

export interface ProviderCredentials {
  apiUrl: string;
  model: string;
  headers: Record<string, string>;
  extraBody?: Record<string, unknown>;
}

export const LLM_PROVIDER_CHAIN:
  readonly LlmProviderName[];

export const LLM_PROVIDER_SET:
  Set<LlmProviderName>;

export function resolveProviderChain(options?: {
  forcedProvider?: string;
  providerOrder?: string[];
}): string[];

export function parseProviderOrder(
  raw?: string | string[],
): string[];

export function getProviderCredentials(
  provider: string,
  overrides?: ProviderCredentialOverrides,
): ProviderCredentials | null;

export function stripThinkingTags(
  text: string,
): string;
