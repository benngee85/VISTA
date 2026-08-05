import assert from 'node:assert/strict';
import {
  afterEach,
  describe,
  it,
} from 'node:test';

import {
  readJsonFromUpstash,
  readJsonFromUpstashWithStatus,
  readRawJsonFromUpstash,
} from '../api/_upstash-json.js';

const ORIGINAL_FETCH =
  globalThis.fetch;

const ORIGINAL_URL =
  process.env.UPSTASH_REDIS_REST_URL;

const ORIGINAL_TOKEN =
  process.env.UPSTASH_REDIS_REST_TOKEN;

function configureResponse(result) {
  process.env.UPSTASH_REDIS_REST_URL =
    'http://redis-rest.example.test';

  process.env.UPSTASH_REDIS_REST_TOKEN =
    'test-token';

  globalThis.fetch =
    async () =>
      new Response(
        JSON.stringify({
          result,
        }),
        {
          status: 200,
          headers: {
            'content-type':
              'application/json',
          },
        },
      );
}

afterEach(() => {
  globalThis.fetch =
    ORIGINAL_FETCH;

  if (ORIGINAL_URL === undefined) {
    delete process.env
      .UPSTASH_REDIS_REST_URL;
  } else {
    process.env
      .UPSTASH_REDIS_REST_URL =
      ORIGINAL_URL;
  }

  if (ORIGINAL_TOKEN === undefined) {
    delete process.env
      .UPSTASH_REDIS_REST_TOKEN;
  } else {
    process.env
      .UPSTASH_REDIS_REST_TOKEN =
      ORIGINAL_TOKEN;
  }
});

describe(
  'Upstash JSON compatibility with decoded REST proxy results',
  () => {
    const payload = {
      fetchedAt:
        '2026-08-05T08:57:31.128Z',
      records: [
        {
          id: 'sample',
        },
      ],
    };

    const envelope = {
      _seed: {
        fetchedAt:
          1785920251128,
        recordCount: 1,
        state: 'OK',
      },
      data: payload,
    };

    it(
      'readJsonFromUpstash accepts a JSON string result',
      async () => {
        configureResponse(
          JSON.stringify(envelope),
        );

        assert.deepEqual(
          await readJsonFromUpstash(
            'test:key',
          ),
          payload,
        );
      },
    );

    it(
      'readJsonFromUpstash accepts an already-decoded object result',
      async () => {
        configureResponse(envelope);

        assert.deepEqual(
          await readJsonFromUpstash(
            'test:key',
          ),
          payload,
        );
      },
    );

    it(
      'readRawJsonFromUpstash accepts a JSON string result',
      async () => {
        configureResponse(
          JSON.stringify(envelope),
        );

        assert.deepEqual(
          await readRawJsonFromUpstash(
            'test:key',
          ),
          envelope,
        );
      },
    );

    it(
      'readRawJsonFromUpstash accepts an already-decoded object result',
      async () => {
        configureResponse(envelope);

        assert.deepEqual(
          await readRawJsonFromUpstash(
            'test:key',
          ),
          envelope,
        );
      },
    );

    it(
      'status-aware reads accept an already-decoded envelope',
      async () => {
        configureResponse(envelope);

        assert.deepEqual(
          await readJsonFromUpstashWithStatus(
            'test:key',
          ),
          {
            status: 'hit',
            value: payload,
          },
        );
      },
    );

    it(
      'preserves a genuine cache miss',
      async () => {
        configureResponse(null);

        assert.equal(
          await readJsonFromUpstash(
            'test:key',
          ),
          null,
        );

        assert.equal(
          await readRawJsonFromUpstash(
            'test:key',
          ),
          null,
        );
      },
    );
  },
);
