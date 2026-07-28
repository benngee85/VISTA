import assert from 'node:assert/strict';
import test from 'node:test';

const originalNodeEnv = process.env.NODE_ENV;
const originalConfiguredOrigins = process.env.SELF_HOSTED_ALLOWED_ORIGINS;

process.env.NODE_ENV = 'production';
process.env.SELF_HOSTED_ALLOWED_ORIGINS = [
  'http://127.0.0.1:3001',
  'http://localhost:3001',
  'https://user:password@example.invalid',
  'https://example.invalid/path',
  '*',
  'file:///tmp/worldmonitor',
].join(',');

const configured = await import('../api/_cors.js?r4-configured-origin');

function request(origin) {
  return {
    headers: new Headers(origin ? { Origin: origin } : {}),
  };
}

test('accepts only explicitly configured exact self-hosted origins', () => {
  assert.equal(configured.isDisallowedOrigin(request('http://127.0.0.1:3001')), false);
  assert.equal(configured.isDisallowedOrigin(request('http://localhost:3001')), false);
  assert.equal(configured.isDisallowedOrigin(request('http://127.0.0.1:3002')), true);
  assert.equal(configured.isDisallowedOrigin(request('https://example.invalid')), true);
  assert.equal(configured.isDisallowedOrigin(request('file:///tmp/worldmonitor')), true);
  assert.equal(configured.isDisallowedOrigin(request()), false);
});

delete process.env.SELF_HOSTED_ALLOWED_ORIGINS;
const defaults = await import('../api/_cors.js?r4-default-origin');

test('production defaults remain closed when no self-hosted origins are configured', () => {
  assert.equal(defaults.isDisallowedOrigin(request('http://127.0.0.1:3001')), true);
  assert.equal(defaults.isDisallowedOrigin(request('http://localhost:3001')), true);
  assert.equal(defaults.isDisallowedOrigin(request('https://worldmonitor.app')), false);
});

if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
else process.env.NODE_ENV = originalNodeEnv;
if (originalConfiguredOrigins === undefined) delete process.env.SELF_HOSTED_ALLOWED_ORIGINS;
else process.env.SELF_HOSTED_ALLOWED_ORIGINS = originalConfiguredOrigins;
