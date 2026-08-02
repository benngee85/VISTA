import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const alpine = readFileSync('Dockerfile.relay', 'utf8');
const rocky = readFileSync('docker/Dockerfile.rocky9-relay', 'utf8');
const compose = readFileSync('docker-compose.rocky9.yml', 'utf8');

test('Rocky relay retains every reviewed runtime source copy', () => {
  const sourceCopies = alpine
    .split(/\r?\n/)
    .filter(line => /^COPY (scripts|shared|data)\//.test(line));
  for (const line of sourceCopies) {
    if (line.includes('scripts/package.json scripts/package-lock.json')) continue;
    assert.match(rocky, new RegExp(
      line.replace(/[|\\{}()[\]^$+*?.-]/g, '\\$&'),
    ));
  }
});

test('Rocky relay uses Node 24, direct PID 1 and no runtime package manager', () => {
  assert.match(rocky, /module enable nodejs:24/);
  assert.equal(
    (
      rocky.match(
        /FROM quay\.io\/rockylinux\/rockylinux:9\.8-minimal@sha256:[a-f0-9]{64}/g,
      ) || []
    ).length,
    2,
  );
  assert.doesNotMatch(rocky, /FROM \$\{/);
  assert.match(rocky, /CMD \["node", "scripts\/ais-relay\.cjs"\]/);
  assert.match(rocky, /! command -v npm/);
  assert.match(rocky, /! command -v npx/);
  assert.match(rocky, /! command -v corepack/);
});

test('Rocky relay carries the validated Kubernetes-oriented controls', () => {
  assert.match(compose, /ais-relay-rocky9:/);
  assert.match(compose, /user: "1000710000:0"/);
  assert.match(compose, /read_only: true/);
  assert.match(compose, /mem_reservation: 384m/);
  assert.match(compose, /mem_limit: 768m/);
  assert.match(compose, /WORLDMONITOR_API_BASE_URL: "http:\/\/vista-api-rocky9:46123"/);
});

test('Rocky API resolves the parallel relay without removing Alpine rollback', () => {
  assert.match(compose, /WS_RELAY_URL: "http:\/\/ais-relay-rocky9:3004"/);
  assert.doesNotMatch(compose, /^\s{2}ais-relay:\s*$/m);
});
