import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

const compose = readFileSync('docker-compose.yml', 'utf8');
const rocky = readFileSync('docker-compose.rocky9.yml', 'utf8');
const proxy = readFileSync('docker/redis-rest-proxy.mjs', 'utf8');
const seedRunner = readFileSync('scripts/run-seeders.sh', 'utf8');

const valkeyDockerfile = readFileSync(
  'docker/Dockerfile.rocky9-valkey',
  'utf8',
);

const entrypoint = readFileSync(
  'docker/valkey-entrypoint.sh',
  'utf8',
);

test('primary cache service is Rocky 9 Valkey', () => {
  assert.match(compose, /^  valkey:$/m);
  assert.doesNotMatch(compose, /^  redis:$/m);

  assert.match(
    compose,
    /dockerfile: docker\/Dockerfile\.rocky9-valkey/,
  );

  assert.match(compose, /image: vista-valkey:latest/);
  assert.match(compose, /container_name: vista-valkey/);
  assert.match(compose, /valkey-data:\/data/);
  assert.match(valkeyDockerfile, /^FROM rockylinux:9$/m);
  assert.match(valkeyDockerfile, /dnf -y install valkey/);
});

test('Valkey requires authentication and persistence', () => {
  assert.match(entrypoint, /VALKEY_PASSWORD/);
  assert.match(entrypoint, /--requirepass/);
  assert.match(entrypoint, /--appendonly yes/);
  assert.match(entrypoint, /--appendfsync everysec/);

  assert.match(
    compose,
    /REDISCLI_AUTH=\$\$VALKEY_PASSWORD/,
  );
});

test('REST bridge targets Valkey', () => {
  assert.match(compose, /^  valkey-rest:$/m);
  assert.doesNotMatch(compose, /^  redis-rest:$/m);
  assert.match(compose, /@valkey:6379/);
  assert.match(proxy, /redis:\/\/valkey:6379/);
  assert.doesNotMatch(proxy, /redis:\/\/redis:6379/);
  assert.match(compose, /http:\/\/valkey-rest:8080/);
  assert.match(rocky, /http:\/\/valkey-rest:8080/);
});

test('neutral cache variables retain compatibility exports', () => {
  assert.match(seedRunner, /CACHE_REST_URL=/);
  assert.match(seedRunner, /CACHE_REST_TOKEN=/);

  assert.match(
    seedRunner,
    /UPSTASH_REDIS_REST_URL="\$CACHE_REST_URL"/,
  );

  assert.match(
    seedRunner,
    /UPSTASH_REDIS_REST_TOKEN="\$CACHE_REST_TOKEN"/,
  );

  assert.match(
    seedRunner,
    /export CACHE_REST_URL CACHE_REST_TOKEN/,
  );
});

test('all seeders remain behind the REST abstraction', () => {
  const seeders = readdirSync('scripts')
    .filter(name => /^seed-.*\.mjs$/.test(name));

  assert.ok(
    seeders.length >= 61,
    `expected at least 61 seeders, found ${seeders.length}`,
  );

  assert.match(
    seedRunner,
    /for f in "\$SCRIPT_DIR"\/seed-\*\.mjs/,
  );

  for (const file of seeders) {
    const source = readFileSync(`scripts/${file}`, 'utf8');

    assert.doesNotMatch(
      source,
      /redis:\/\/(?:redis|valkey):6379/,
      `${file} bypasses the REST abstraction`,
    );
  }
});

test('cache migration does not rewrite semantic identifiers', () => {
  assert.doesNotMatch(
    seedRunner,
    /replace.*(?:BFO|CCO|NIEM|FMN)/i,
  );
});
