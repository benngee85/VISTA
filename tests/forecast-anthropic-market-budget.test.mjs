import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const names = [
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_MODEL',
  'ANTHROPIC_API_KEY',
  'OPENROUTER_API_KEY',
  'GROQ_API_KEY',
  'FORECAST_ANTHROPIC_TIMEOUT_MS',
  'FORECAST_MARKET_ANTHROPIC_TIMEOUT_MS',
];

function restoreEnvironment(previous) {
  for (const name of names) {
    if (previous[name] === undefined) delete process.env[name];
    else process.env[name] = previous[name];
  }
}

test('trial Anthropic windows remain bounded and lock-safe', async () => {
  const previous = Object.fromEntries(
    names.map(name => [name, process.env[name]]),
  );

  try {
    process.env.ANTHROPIC_BASE_URL = 'http://127.0.0.1:1234';
    process.env.ANTHROPIC_MODEL = 'test-model';
    process.env.ANTHROPIC_API_KEY = 'test-only';
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.FORECAST_ANTHROPIC_TIMEOUT_MS;
    delete process.env.FORECAST_MARKET_ANTHROPIC_TIMEOUT_MS;

    const forecast = await import(
      new URL(
        `../scripts/seed-forecasts.mjs?local-profile=${Date.now()}`,
        import.meta.url,
      ),
    );

    const combined = forecast.resolveForecastLlmProviders(
      forecast.getForecastLlmCallOptions('combined'),
    );
    const market = forecast.resolveForecastLlmProviders(
      forecast.getForecastLlmCallOptions('market_implications'),
    );

    assert.equal(combined[0].name, 'anthropic');
    assert.equal(combined[0].timeout, 300_000);
    assert.equal(combined[0].failFastOnTimeout, true);

    assert.equal(market[0].name, 'anthropic');
    assert.equal(market[0].timeout, 600_000);
    assert.equal(market[0].failFastOnTimeout, true);

    assert.equal(
      forecast.FORECAST_LLM_STAGE_BUDGET_MS,
      660_000,
    );
    assert.equal(
      forecast.FORECAST_LLM_RUN_BUDGET_MS,
      1_500_000,
    );
    assert.equal(
      forecast.FORECAST_SEED_LOCK_TTL_MS,
      1_800_000,
    );

    const reservation =
      forecast.getMarketImplicationsMinRunBudgetMs({
        providerOrder: ['anthropic'],
        timeoutOverrides: { anthropic: 600_000 },
      });

    assert.equal(reservation, 605_000);
    assert.ok(
      forecast.FORECAST_LLM_RUN_BUDGET_MS - reservation >=
        895_000,
    );
    assert.ok(
      forecast.FORECAST_SEED_LOCK_TTL_MS -
        forecast.FORECAST_LLM_RUN_BUDGET_MS >=
        300_000,
    );

    process.env.FORECAST_ANTHROPIC_TIMEOUT_MS = '999999';
    assert.equal(
      forecast.getForecastAnthropicTimeoutMs(),
      600_000,
    );

    process.env.FORECAST_ANTHROPIC_TIMEOUT_MS = '1';
    assert.equal(
      forecast.getForecastAnthropicTimeoutMs(),
      60_000,
    );

    process.env.FORECAST_MARKET_ANTHROPIC_TIMEOUT_MS =
      '999999';
    assert.equal(
      forecast.getForecastMarketAnthropicTimeoutMs(),
      900_000,
    );

    process.env.FORECAST_MARKET_ANTHROPIC_TIMEOUT_MS = '1';
    assert.equal(
      forecast.getForecastMarketAnthropicTimeoutMs(),
      120_000,
    );
  } finally {
    restoreEnvironment(previous);
  }
});

test('cloud-only deployments retain their original budgets', async () => {
  const previous = Object.fromEntries(
    names.map(name => [name, process.env[name]]),
  );

  try {
    for (const name of names) delete process.env[name];

    const forecast = await import(
      new URL(
        `../scripts/seed-forecasts.mjs?cloud-profile=${Date.now()}`,
        import.meta.url,
      ),
    );

    assert.equal(
      forecast.FORECAST_LLM_STAGE_BUDGET_MS,
      120_000,
    );
    assert.equal(
      forecast.FORECAST_LLM_RUN_BUDGET_MS,
      200_000,
    );
    assert.equal(
      forecast.FORECAST_SEED_LOCK_TTL_MS,
      240_000,
    );

    assert.deepEqual(
      forecast.getForecastLlmCallOptions('combined')
        .providerOrder,
      ['openrouter', 'groq'],
    );
  } finally {
    restoreEnvironment(previous);
  }
});

test('environment example declares the isolated trial profile', () => {
  const example = fs.readFileSync(
    new URL('../.env.example', import.meta.url),
    'utf8',
  );

  assert.match(
    example,
    /^FORECAST_ANTHROPIC_TIMEOUT_MS=300000$/m,
  );
  assert.match(
    example,
    /^FORECAST_MARKET_ANTHROPIC_TIMEOUT_MS=600000$/m,
  );
  assert.match(
    example,
    /only when ANTHROPIC_BASE_URL, ANTHROPIC_MODEL and ANTHROPIC_API_KEY/,
  );
});

test('forecast seeder remains independently deployed', () => {
  const services = JSON.parse(
    fs.readFileSync(
      new URL('../scripts/railway-services.json', import.meta.url),
      'utf8',
    ),
  );

  const forecast = services.find(
    service => service.entry === 'scripts/seed-forecasts.mjs',
  );

  assert.ok(forecast);
  assert.equal(forecast.service, 'seed-forecasts');
  assert.equal(forecast.deployMode, 'nixpacks-root-scripts');
});
