import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getProviderCredentials,
  parseProviderOrder,
  resolveProviderChain,
  stripThinkingTags,
} from '../llm-provider-runtime.js';

test('generic is a supported provider', () => {
  assert.deepEqual(
    parseProviderOrder('generic'),
    ['generic'],
  );
});

test('provider order is deduplicated', () => {
  assert.deepEqual(
    parseProviderOrder(
      'generic,openrouter,generic,groq',
    ),
    ['generic', 'openrouter', 'groq'],
  );
});

test('unknown provider input yields no override', () => {
  assert.deepEqual(
    parseProviderOrder('unknown-provider'),
    [],
  );
});

test('forced provider is isolated', () => {
  assert.deepEqual(
    resolveProviderChain({
      forcedProvider: 'generic',
    }),
    ['generic'],
  );
});

test('generic reads OpenAI-compatible configuration', () => {
  const prior = {
    url: process.env.LLM_API_URL,
    key: process.env.LLM_API_KEY,
    model: process.env.LLM_MODEL,
  };

  process.env.LLM_API_URL =
    'http://localhost:1234/v1/chat/completions';
  process.env.LLM_API_KEY = 'lm-studio';
  process.env.LLM_MODEL = 'qwen/qwen3.6-27b';

  const credentials =
    getProviderCredentials('generic');

  assert.equal(
    credentials?.apiUrl,
    'http://localhost:1234/v1/chat/completions',
  );
  assert.equal(
    credentials?.model,
    'qwen/qwen3.6-27b',
  );

  if (prior.url === undefined) delete process.env.LLM_API_URL;
  else process.env.LLM_API_URL = prior.url;

  if (prior.key === undefined) delete process.env.LLM_API_KEY;
  else process.env.LLM_API_KEY = prior.key;

  if (prior.model === undefined) delete process.env.LLM_MODEL;
  else process.env.LLM_MODEL = prior.model;
});

test('thinking tags are stripped', () => {
  assert.equal(
    stripThinkingTags(
      '<think>hidden</think>{"ok":true}',
    ),
    '{"ok":true}',
  );
});
