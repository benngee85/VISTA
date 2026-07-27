import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(
  new URL('../scripts/seed-forecasts.mjs', import.meta.url),
  'utf8',
);

test('forecast seeder integrates the centralized Anthropic adapter', () => {
  assert.match(
    source,
    /import anthropicMessages from '\.\/lib\/anthropic-messages\.cjs'/,
  );
  assert.match(source, /createAnthropicProvider\(\{/);
  assert.match(source, /buildProviderRequest\(provider,/);
  assert.match(source, /parseProviderResponse\(provider, json\)/);

  assert.doesNotMatch(
    source,
    /10\.1\.24\.100:1234/,
    'deployment-specific local endpoint must not be hardcoded',
  );
  assert.doesNotMatch(
    source,
    /local-lm-studio/,
    'deployment credential placeholder must remain environment-owned',
  );
});

test('legacy forecast order is unchanged when Anthropic is unconfigured', async () => {
  const names = [
    'ANTHROPIC_BASE_URL',
    'ANTHROPIC_MODEL',
    'ANTHROPIC_API_KEY',
    'FORECAST_LLM_PROVIDER_ORDER',
    'FORECAST_LLM_CRITICAL_PROVIDER_ORDER',
    'FORECAST_LLM_MARKET_IMPLICATIONS_PROVIDER_ORDER',
  ];

  const previous = Object.fromEntries(
    names.map(name => [name, process.env[name]])
  );

  for (const name of names) delete process.env[name];

  try {
    const moduleUrl = new URL(
      `../scripts/seed-forecasts.mjs?legacy-order=${Date.now()}`,
      import.meta.url,
    );
    const forecast = await import(moduleUrl);

    assert.deepEqual(
      forecast.getForecastLlmCallOptions('combined').providerOrder,
      ['openrouter', 'groq'],
    );

    assert.deepEqual(
      forecast.getForecastLlmCallOptions('critical_signals').providerOrder,
      ['groq', 'openrouter'],
    );

    assert.deepEqual(
      forecast.getForecastLlmCallOptions('market_implications').providerOrder,
      ['openrouter'],
    );
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
});

test('Anthropic is first in default and protected forecast stages', async () => {
  const previous = {
    base: process.env.ANTHROPIC_BASE_URL,
    model: process.env.ANTHROPIC_MODEL,
    key: process.env.ANTHROPIC_API_KEY,
    globalOrder: process.env.FORECAST_LLM_PROVIDER_ORDER,
    criticalOrder: process.env.FORECAST_LLM_CRITICAL_PROVIDER_ORDER,
    marketOrder:
      process.env.FORECAST_LLM_MARKET_IMPLICATIONS_PROVIDER_ORDER,
  };

  process.env.ANTHROPIC_BASE_URL = 'http://127.0.0.1:1234';
  process.env.ANTHROPIC_MODEL = 'qwen36';
  process.env.ANTHROPIC_API_KEY = 'test-only';
  delete process.env.FORECAST_LLM_PROVIDER_ORDER;
  delete process.env.FORECAST_LLM_CRITICAL_PROVIDER_ORDER;
  delete process.env.FORECAST_LLM_MARKET_IMPLICATIONS_PROVIDER_ORDER;

  try {
    const moduleUrl = new URL(
      `../scripts/seed-forecasts.mjs?anthropic-test=${Date.now()}`,
      import.meta.url,
    );
    const forecast = await import(moduleUrl);

    const regular = forecast.getForecastLlmCallOptions('combined');
    assert.equal(regular.providerOrder[0], 'anthropic');

    const critical =
      forecast.getForecastLlmCallOptions('critical_signals');
    assert.deepEqual(
      critical.providerOrder,
      ['anthropic', 'groq', 'openrouter'],
    );

    const market =
      forecast.getForecastLlmCallOptions('market_implications');
    assert.deepEqual(
      market.providerOrder,
      ['anthropic', 'openrouter'],
    );

    const resolved =
      forecast.resolveForecastLlmProviders(regular);
    assert.equal(resolved[0].name, 'anthropic');
    assert.equal(
      resolved[0].apiUrl,
      'http://127.0.0.1:1234/v1/messages',
    );
    assert.equal(resolved[0].model, 'qwen36');

    process.env.FORECAST_LLM_CRITICAL_PROVIDER_ORDER = 'groq';
    const explicit =
      forecast.getForecastLlmCallOptions('critical_signals');
    assert.deepEqual(
      explicit.providerOrder,
      ['groq'],
      'explicit stage override must remain authoritative',
    );
  } finally {
    const restore = (name, value) => {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    };

    restore('ANTHROPIC_BASE_URL', previous.base);
    restore('ANTHROPIC_MODEL', previous.model);
    restore('ANTHROPIC_API_KEY', previous.key);
    restore(
      'FORECAST_LLM_PROVIDER_ORDER',
      previous.globalOrder,
    );
    restore(
      'FORECAST_LLM_CRITICAL_PROVIDER_ORDER',
      previous.criticalOrder,
    );
    restore(
      'FORECAST_LLM_MARKET_IMPLICATIONS_PROVIDER_ORDER',
      previous.marketOrder,
    );
  }
});
