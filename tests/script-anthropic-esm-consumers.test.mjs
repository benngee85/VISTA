import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const consumers = [
  ['scripts/seed-insights.mjs', './lib/anthropic-messages.cjs'],
  ['scripts/regional-snapshot/narrative.mjs', '../lib/anthropic-messages.cjs'],
  ['scripts/regional-snapshot/weekly-brief.mjs', '../lib/anthropic-messages.cjs'],
];

for (const [file, importPath] of consumers) {
  test(`${file} uses the shared local Anthropic adapter first`, () => {
    const source = fs.readFileSync(file, 'utf8');
    assert.ok(source.includes(`import anthropicMessages from '${importPath}';`));
    assert.match(source, /buildProviderRequest\(provider,/);
    assert.match(source, /parseProviderResponse\(provider,/);
    const local = source.indexOf('createAnthropicProvider({');
    const cloud = source.indexOf("name: 'openrouter'");
    assert.ok(local >= 0);
    assert.ok(cloud < 0 || local < cloud);
    assert.doesNotMatch(source, /10\.1\.24\.100|qwen36|local-lm-studio/);
  });
}

test('the shared adapter owns all local module variables', () => {
  const source = fs.readFileSync('scripts/lib/anthropic-messages.cjs', 'utf8');
  assert.match(source, /ANTHROPIC_BASE_URL/);
  assert.match(source, /ANTHROPIC_MODEL/);
  assert.match(source, /ANTHROPIC_API_KEY/);
  assert.match(source, /v1\/messages/);
});
