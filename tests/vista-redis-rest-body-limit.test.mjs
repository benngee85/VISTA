import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const proxy = readFileSync('docker/redis-rest-proxy.mjs', 'utf8');
const compose = readFileSync('docker-compose.yml', 'utf8');

test('self-hosted REST bridge accepts bounded legitimate seeded payloads', () => {
  assert.match(proxy, /DEFAULT_MAX_BODY_BYTES = 16 \* 1024 \* 1024/);
  assert.match(proxy, /HARD_MAX_BODY_BYTES = 64 \* 1024 \* 1024/);
  assert.match(proxy, /process\.env\.SRH_MAX_BODY_BYTES/);
  assert.match(compose, /VISTA_VALKEY_REST_MAX_BODY_BYTES:-16777216/);
});

test('oversized requests receive HTTP 413 without destroying the socket', () => {
  assert.match(proxy, /new HttpError\(413,/);
  assert.match(proxy, /Number\.isInteger\(err\?\.statusCode\)/);
  assert.doesNotMatch(proxy, /req\.destroy\(\)/);
});
