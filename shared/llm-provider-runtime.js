import {
  OPENROUTER_PROVIDER_ROUTING,
} from '../scripts/_llm-model-timeouts.mjs';

export const LLM_PROVIDER_CHAIN = Object.freeze([
  'ollama',
  'openrouter',
  'groq',
  'generic',
]);

export const LLM_PROVIDER_SET = new Set(LLM_PROVIDER_CHAIN);

const OLLAMA_HOST_ALLOWLIST = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '[::1]',
  'host.docker.internal',
]);

function isLocalDeployment() {
  const mode =
    typeof process !== 'undefined'
      ? process.env?.LOCAL_API_MODE || ''
      : '';

  return mode.includes('sidecar') || mode.includes('docker');
}

export function resolveProviderChain({
  forcedProvider,
  providerOrder,
} = {}) {
  if (forcedProvider) {
    return LLM_PROVIDER_SET.has(forcedProvider)
      ? [forcedProvider]
      : [];
  }

  if (!Array.isArray(providerOrder) || providerOrder.length === 0) {
    return [...LLM_PROVIDER_CHAIN];
  }

  const seen = new Set();
  const providers = [];

  for (const rawProvider of providerOrder) {
    const provider = String(rawProvider || '')
      .trim()
      .toLowerCase();

    if (!LLM_PROVIDER_SET.has(provider) || seen.has(provider)) {
      continue;
    }

    seen.add(provider);
    providers.push(provider);
  }

  return providers.length > 0
    ? providers
    : [...LLM_PROVIDER_CHAIN];
}

export function parseProviderOrder(raw) {
  if (Array.isArray(raw)) {
    const seen = new Set();
    const providers = [];

    for (const item of raw) {
      const provider = String(item || '')
        .trim()
        .toLowerCase();

      if (!LLM_PROVIDER_SET.has(provider) || seen.has(provider)) {
        continue;
      }

      seen.add(provider);
      providers.push(provider);
    }

    return providers;
  }

  if (typeof raw !== 'string' || !raw.trim()) {
    return [];
  }

  return parseProviderOrder(raw.split(','));
}

export function getProviderCredentials(
  provider,
  overrides = {},
) {
  if (provider === 'ollama') {
    const baseUrl = process.env.OLLAMA_API_URL;
    if (!baseUrl) return null;

    if (!isLocalDeployment()) {
      try {
        const hostname = new URL(baseUrl).hostname;

        if (!OLLAMA_HOST_ALLOWLIST.has(hostname)) {
          console.warn(
            `[llm] Ollama blocked: hostname "${hostname}" not in allowlist`,
          );
          return null;
        }
      } catch {
        return null;
      }
    }

    const headers = {
      'Content-Type': 'application/json',
    };

    const apiKey = process.env.OLLAMA_API_KEY;
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    return {
      apiUrl: new URL(
        '/v1/chat/completions',
        baseUrl,
      ).toString(),
      model:
        overrides.model
        || process.env.OLLAMA_MODEL
        || 'llama3.1:8b',
      headers,
      extraBody: {
        think: false,
      },
    };
  }

  if (provider === 'groq') {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return null;

    return {
      apiUrl:
        'https://api.groq.com/openai/v1/chat/completions',
      model:
        overrides.model
        || 'llama-3.3-70b-versatile',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    };
  }

  if (provider === 'openrouter') {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return null;

    return {
      apiUrl:
        'https://openrouter.ai/api/v1/chat/completions',
      model:
        overrides.model
        || 'deepseek/deepseek-v4-flash',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://worldmonitor.app',
        'X-Title': 'World Monitor',
      },
      extraBody: {
        ...(overrides.enableReasoning
          ? {}
          : {
              reasoning: {
                enabled: false,
              },
            }),
        provider: OPENROUTER_PROVIDER_ROUTING,
      },
    };
  }

  if (provider === 'generic') {
    const apiUrl = process.env.LLM_API_URL;
    const apiKey = process.env.LLM_API_KEY;

    if (!apiUrl || !apiKey) {
      return null;
    }

    return {
      apiUrl,
      model:
        overrides.model
        || process.env.LLM_MODEL
        || 'gpt-3.5-turbo',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    };
  }

  return null;
}

export function stripThinkingTags(text) {
  let value = String(text || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(
      /<\|thinking\|>[\s\S]*?<\|\/thinking\|>/gi,
      '',
    )
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
    .replace(/<reflection>[\s\S]*?<\/reflection>/gi, '')
    .replace(
      /<\|begin_of_thought\|>[\s\S]*?<\|end_of_thought\|>/gi,
      '',
    )
    .trim();

  value = value
    .replace(/<think>[\s\S]*/gi, '')
    .replace(/<\|thinking\|>[\s\S]*/gi, '')
    .replace(/<reasoning>[\s\S]*/gi, '')
    .replace(/<reflection>[\s\S]*/gi, '')
    .replace(/<\|begin_of_thought\|>[\s\S]*/gi, '')
    .trim();

  return value;
}
