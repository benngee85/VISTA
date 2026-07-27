import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(
  new URL('../docker/redis-rest-proxy.mjs', import.meta.url),
  'utf8',
);

test('redis-rest multi-exec uses supported node-redis transaction methods', () => {
  assert.match(
    source,
    /multi\.addCommand\s*\(/,
    'transaction commands must be queued with addCommand',
  );

  assert.doesNotMatch(
    source,
    /multi\.sendCommand\s*\(/,
    'MultiCommand does not expose sendCommand',
  );

  assert.match(
    source,
    /await\s+multi\.exec\s*\(/,
    'queued commands must execute as a transaction',
  );
});
