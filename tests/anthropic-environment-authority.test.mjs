import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const runtimeFiles = [
  'scripts/lib/anthropic-messages.cjs',
  'server/_shared/llm.ts',
];

test('Anthropic runtime configuration has no deployment-specific defaults', () => {
  for (const file of runtimeFiles) {
    const source = fs.readFileSync(file, 'utf8');

    assert.doesNotMatch(
      source,
      /10\.1\.24\.100|qwen36|local-lm-studio/,
      `${file} must obtain endpoint, model and credential from environment`,
    );
  }
});

test('tracked Anthropic environment declarations have empty active values', () => {
  const source = fs.readFileSync('.env.example', 'utf8');

  for (const name of [
    'ANTHROPIC_BASE_URL',
    'ANTHROPIC_MODEL',
    'ANTHROPIC_API_KEY',
  ]) {
    const active = source
      .split(/\r?\n/)
      .filter(line => line.startsWith(`${name}=`));

    assert.deepEqual(
      active,
      [`${name}=`],
      `${name} must have one empty active declaration`,
    );
  }
});

test('Compose injects all three Anthropic module variables', () => {
  const compose = fs.readFileSync('docker-compose.yml', 'utf8');

  for (const name of [
    'ANTHROPIC_BASE_URL',
    'ANTHROPIC_MODEL',
    'ANTHROPIC_API_KEY',
  ]) {
    assert.match(
      compose,
      new RegExp(name),
      `Compose must inject ${name}`,
    );
  }
});
