'use strict';

const DEFAULT_TIMEOUT_MS = 60_000;

function normalizeAnthropicBaseUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return '';
  }

  if (
    parsed.protocol !== 'http:' &&
    parsed.protocol !== 'https:'
  ) {
    return '';
  }

  parsed.username = '';
  parsed.password = '';
  parsed.hash = '';
  parsed.search = '';

  return parsed.toString().replace(/\/+$/, '');
}

function anthropicMessagesUrl(
  value = process.env.ANTHROPIC_BASE_URL
) {
  const baseUrl = normalizeAnthropicBaseUrl(value);
  if (!baseUrl) return '';

  return new URL(
    '/v1/messages',
    `${baseUrl}/`
  ).toString();
}

function createAnthropicProvider(options = {}) {
  return {
    name: options.name || 'anthropic',
    protocol: 'anthropic',
    envKey: 'ANTHROPIC_API_KEY',
    apiUrlFn: () => anthropicMessagesUrl(),
    model: () => (
      String(process.env.ANTHROPIC_MODEL || '').trim()
      || options.defaultModel
      || ''
    ),
    headers: key => ({
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'User-Agent':
        options.userAgent ||
        'worldmonitor-llm/1.0',
    }),
    timeout: Number.isFinite(options.timeout)
      ? Math.max(
          1,
          Math.floor(options.timeout)
        )
      : DEFAULT_TIMEOUT_MS,
  };
}

function buildProviderRequest(provider, input) {
  const {
    model,
    systemPrompt,
    userPrompt,
    maxTokens,
    temperature,
    extraBody,
  } = input;

  if (provider?.protocol === 'anthropic') {
    return {
      model,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: userPrompt,
      }],
      max_tokens: maxTokens,
      temperature,
    };
  }

  return {
    model,
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ],
    max_tokens: maxTokens,
    temperature,
    ...(extraBody || {}),
  };
}

function parseProviderResponse(provider, payload) {
  if (provider?.protocol === 'anthropic') {
    const text = Array.isArray(payload?.content)
      ? payload.content
          .filter(
            item => item?.type === 'text'
          )
          .map(item => item.text || '')
          .join('')
          .trim()
      : '';

    return {
      text,
      model: payload?.model || '',
      finishReason:
        payload?.stop_reason || '',
      usage: {
        tokensTotal:
          (payload?.usage?.input_tokens || 0) +
          (payload?.usage?.output_tokens || 0),
        tokensPrompt:
          payload?.usage?.input_tokens || 0,
        tokensCompletion:
          payload?.usage?.output_tokens || 0,
      },
    };
  }

  return {
    text:
      payload
        ?.choices?.[0]
        ?.message?.content
        ?.trim() || '',
    model: payload?.model || '',
    finishReason:
      payload?.choices?.[0]?.finish_reason || '',
    usage: {
      tokensTotal:
        payload?.usage?.total_tokens || 0,
      tokensPrompt:
        payload?.usage?.prompt_tokens || 0,
      tokensCompletion:
        payload?.usage?.completion_tokens || 0,
    },
  };
}

function isTokenLimited(provider, parsed) {
  return provider?.protocol === 'anthropic'
    ? parsed?.finishReason === 'max_tokens'
    : parsed?.finishReason === 'length';
}

module.exports = {
  normalizeAnthropicBaseUrl,
  anthropicMessagesUrl,
  createAnthropicProvider,
  buildProviderRequest,
  parseProviderResponse,
  isTokenLimited,
};
