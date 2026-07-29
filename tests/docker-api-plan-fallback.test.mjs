import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('Docker cloud fallback requires an explicit gate and a server-side wm key', () => {
  const sidecar = fs.readFileSync('src-tauri/sidecar/local-api-server.mjs', 'utf8');
  assert.match(sidecar, /LOCAL_API_CLOUD_FALLBACK_ALLOW_DOCKER/);
  assert.match(sidecar, /hasWorldMonitorApiKey/);
  assert.match(sidecar, /readConfiguredWorldMonitorApiKey/);
  assert.doesNotMatch(sidecar, /VITE_WORLDMONITOR_API_KEY/);
});

test('Compose keeps the API credential server-side', () => {
  const files = fs.readdirSync('.')
    .filter((name) => /^docker-compose.*\.ya?ml$/.test(name))
    .filter((name) => fs.readFileSync(name, 'utf8').includes('LOCAL_API_MODE'));
  assert.ok(files.length > 0);
  const compose = files.map((name) => fs.readFileSync(name, 'utf8')).join('\n');
  assert.match(compose, /WORLDMONITOR_API_KEY/);
  assert.match(compose, /LOCAL_API_CLOUD_FALLBACK_ALLOW_DOCKER/);
  assert.doesNotMatch(compose, /VITE_WORLDMONITOR_API_KEY/);
});
