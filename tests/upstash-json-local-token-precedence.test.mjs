import assert from 'node:assert/strict';
import {
  after,
  before,
  describe,
  it,
} from 'node:test';

import {
  readJsonFromUpstash,
  readRawJsonFromUpstash,
} from '../api/_upstash-json.js';

const originalFetch =
  globalThis.fetch;

const originalEnvironment = {
  UPSTASH_REDIS_REST_URL:
    process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN:
    process.env.UPSTASH_REDIS_REST_TOKEN,
  CACHE_REST_URL:
    process.env.CACHE_REST_URL,
  CACHE_REST_TOKEN:
    process.env.CACHE_REST_TOKEN,
  REDIS_REST_URL:
    process.env.REDIS_REST_URL,
  REDIS_TOKEN:
    process.env.REDIS_TOKEN,
};

const observedRequests = [];

before(() => {
  process.env.UPSTASH_REDIS_REST_URL =
    'http://redis-rest:8080';

  process.env.UPSTASH_REDIS_REST_TOKEN =
    'stale-upstash-token';

  process.env.CACHE_REST_URL =
    'http://redis-rest:8080';

  process.env.CACHE_REST_TOKEN =
    'valid-cache-token';

  process.env.REDIS_TOKEN =
    'valid-redis-token';

  globalThis.fetch =
    async (requestUrl, requestOptions) => {
      observedRequests.push({
        url:
          String(requestUrl),
        authorization:
          new Headers(
            requestOptions?.headers,
          ).get(
            'authorization',
          ),
      });

      return new Response(
        JSON.stringify({
          result:
            JSON.stringify({
              source:
                'local-redis-rest',
            }),
        }),
        {
          status: 200,
          headers: {
            'content-type':
              'application/json',
          },
        },
      );
    };
});

after(() => {
  globalThis.fetch =
    originalFetch;

  for (
    const [
      variableName,
      originalValue,
    ]
    of Object.entries(
      originalEnvironment,
    )
  ) {
    if (originalValue === undefined) {
      delete process.env[
        variableName
      ];
    } else {
      process.env[
        variableName
      ] =
        originalValue;
    }
  }
});

describe(
  'self-hosted Redis REST single-read credentials',
  () => {
    it(
      'uses CACHE_REST_TOKEN instead of a stale UPSTASH token for envelope-aware reads',
      async () => {
        const value =
          await readJsonFromUpstash(
            'intelligence:gpsjam:v2',
          );

        assert.deepEqual(
          value,
          {
            source:
              'local-redis-rest',
          },
        );

        assert.equal(
          observedRequests.at(-1)
            ?.authorization,
          'Bearer valid-cache-token',
        );
      },
    );

    it(
      'uses the same credential resolver for raw reads',
      async () => {
        const value =
          await readRawJsonFromUpstash(
            'supply_chain:hormuz_tracker:v1',
          );

        assert.deepEqual(
          value,
          {
            source:
              'local-redis-rest',
          },
        );

        assert.equal(
          observedRequests.at(-1)
            ?.authorization,
          'Bearer valid-cache-token',
        );
      },
    );

    it(
      'targets the configured local Redis REST origin',
      () => {
        assert.equal(
          observedRequests.length,
          2,
        );

        for (
          const observedRequest
          of observedRequests
        ) {
          assert.match(
            observedRequest.url,
            /^http:\/\/redis-rest:8080\/get\//u,
          );
        }
      },
    );
  },
);
