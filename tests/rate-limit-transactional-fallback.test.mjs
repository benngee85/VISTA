import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  afterEach,
  beforeEach,
  describe,
  it,
} from 'node:test';

import {
  redisMultiExec,
} from '../api/_upstash-json.js';

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key];
  }

  Object.assign(process.env, originalEnv);
}

describe('redisMultiExec', () => {
  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL =
      'https://redis-rest.example';
    process.env.UPSTASH_REDIS_REST_TOKEN =
      'transaction-test-token';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    restoreEnv();
  });

  it('posts the complete command set to /multi-exec', async () => {
    const calls = [];

    globalThis.fetch = async (input, init) => {
      calls.push({
        input: String(input),
        init,
      });

      return new Response(
        JSON.stringify([
          { result: 1 },
          { result: 1 },
          { result: 60 },
        ]),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    };

    const commands = [
      ['INCR', 'rl:test'],
      ['EXPIRE', 'rl:test', '60', 'NX'],
      ['TTL', 'rl:test'],
    ];

    const result = await redisMultiExec(commands, 1234);

    assert.deepEqual(result, [
      { result: 1 },
      { result: 1 },
      { result: 60 },
    ]);

    assert.equal(calls.length, 1);
    assert.equal(
      calls[0].input,
      'https://redis-rest.example/multi-exec',
    );
    assert.equal(calls[0].init.method, 'POST');
    assert.equal(
      calls[0].init.headers.Authorization,
      'Bearer transaction-test-token',
    );
    assert.equal(
      calls[0].init.headers['Content-Type'],
      'application/json',
    );
    assert.deepEqual(
      JSON.parse(calls[0].init.body),
      commands,
    );
  });

  it('returns null when credentials are absent', async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    globalThis.fetch = async () => {
      throw new Error('fetch must not be called');
    };

    assert.equal(
      await redisMultiExec([['PING']]),
      null,
    );
  });

  it('returns null on HTTP, transport and invalid-shape failures', async () => {
    globalThis.fetch = async () =>
      new Response('unavailable', { status: 503 });

    assert.equal(
      await redisMultiExec([['PING']]),
      null,
    );

    globalThis.fetch = async () => {
      throw new Error('connection refused');
    };

    assert.equal(
      await redisMultiExec([['PING']]),
      null,
    );

    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({ result: 'not-an-array' }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

    assert.equal(
      await redisMultiExec([['PING']]),
      null,
    );
  });
});

describe('transactional fixed-window source contract', () => {
  const fallbackSource = fs.readFileSync(
    new URL('../api/_rate-limit-fallback.js', import.meta.url),
    'utf8',
  );

  const proxySource = fs.readFileSync(
    new URL(
      '../docker/redis-rest-proxy.mjs',
      import.meta.url,
    ),
    'utf8',
  );

  it('uses MULTI/EXEC rather than a non-atomic pipeline', () => {
    assert.match(
      fallbackSource,
      /redisMultiExec\(\s*\[\s*\['INCR', key\],\s*\['EXPIRE', key, String\(windowSeconds\), 'NX'\],\s*\['TTL', key\]/s,
    );

    assert.doesNotMatch(
      fallbackSource,
      /redisPipeline\(/,
    );
  });

  it('keeps Lua blocked by the self-hosted proxy', () => {
    assert.match(
      proxySource,
      /Blocks dangerous operations like FLUSHALL, CONFIG SET, EVAL/,
    );

    const allowlistMatch = proxySource.match(
      /const ALLOWED_COMMANDS = new Set\(\[([\s\S]*?)\]\);/,
    );

    assert.ok(allowlistMatch, 'proxy command allowlist must exist');
    assert.doesNotMatch(
      allowlistMatch[1],
      /['"]EVAL(?:SHA)?['"]/,
    );
    assert.doesNotMatch(
      allowlistMatch[1],
      /['"]SCRIPT['"]/,
    );
  });

  it('documents hosted and self-hosted semantic separation', () => {
    const helperSource = fs.readFileSync(
      new URL('../api/_upstash-json.js', import.meta.url),
      'utf8',
    );

    assert.match(
      helperSource,
      /hosted Upstash rate limiter does not call this helper/i,
    );
    assert.match(
      fallbackSource,
      /Atomic non-Lua fixed-window fallback/,
    );
  });
});
