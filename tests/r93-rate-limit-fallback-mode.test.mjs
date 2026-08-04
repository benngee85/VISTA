import assert from 'node:assert/strict';
import test from 'node:test';

const moduleUrl = new URL(
  '../api/_rate-limit-fallback.js',
  import.meta.url,
);

async function importFresh(label) {
  return import(
    `${moduleUrl.href}?case=${encodeURIComponent(label)}-${Date.now()}`
  );
}

test('self-hosted redis-rest defaults to transactional mode', async () => {
  const previous = {
    CACHE_REST_URL: process.env.CACHE_REST_URL,
    CACHE_REST_LUA_MODE: process.env.CACHE_REST_LUA_MODE,
  };

  try {
    process.env.CACHE_REST_URL = 'http://redis-rest:8080';
    delete process.env.CACHE_REST_LUA_MODE;

    const module = await importFresh('self-hosted-default');

    assert.equal(
      module.getRateLimitFallbackMode(),
      'transactional-fixed-window',
    );
  } finally {
    if (previous.CACHE_REST_URL == null) {
      delete process.env.CACHE_REST_URL;
    } else {
      process.env.CACHE_REST_URL = previous.CACHE_REST_URL;
    }

    if (previous.CACHE_REST_LUA_MODE == null) {
      delete process.env.CACHE_REST_LUA_MODE;
    } else {
      process.env.CACHE_REST_LUA_MODE =
        previous.CACHE_REST_LUA_MODE;
    }
  }
});

test('explicit enabled mode retains Lua path', async () => {
  const previous = {
    CACHE_REST_URL: process.env.CACHE_REST_URL,
    CACHE_REST_LUA_MODE: process.env.CACHE_REST_LUA_MODE,
  };

  try {
    process.env.CACHE_REST_URL = 'http://redis-rest:8080';
    process.env.CACHE_REST_LUA_MODE = 'enabled';

    const module = await importFresh('explicit-enabled');

    assert.equal(
      module.getRateLimitFallbackMode(),
      'lua-sliding-window',
    );
  } finally {
    if (previous.CACHE_REST_URL == null) {
      delete process.env.CACHE_REST_URL;
    } else {
      process.env.CACHE_REST_URL = previous.CACHE_REST_URL;
    }

    if (previous.CACHE_REST_LUA_MODE == null) {
      delete process.env.CACHE_REST_LUA_MODE;
    } else {
      process.env.CACHE_REST_LUA_MODE =
        previous.CACHE_REST_LUA_MODE;
    }
  }
});
