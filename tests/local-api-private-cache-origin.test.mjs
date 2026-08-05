import assert from 'node:assert/strict';
import {
  describe,
  it,
} from 'node:test';
import fs from 'node:fs';

const source =
  fs.readFileSync(
    new URL(
      '../src-tauri/sidecar/local-api-server.mjs',
      import.meta.url,
    ),
    'utf8',
  );

describe(
  'local API sidecar private cache-origin registration',
  () => {
    it(
      'registers every supported Redis REST URL environment variable',
      () => {
        for (const name of [
          'UPSTASH_REDIS_REST_URL',
          'CACHE_REST_URL',
          'KV_REST_API_URL',
        ]) {
          assert.match(
            source,
            new RegExp(
              String.raw`['"]${name}['"]`,
            ),
          );
        }
      },
    );

    it(
      'reduces configured cache URLs to exact HTTP origins',
      () => {
        assert.match(
          source,
          /const url = new URL\(value\)/,
        );

        assert.match(
          source,
          /url\.protocol === 'http:' \|\| url\.protocol === 'https:'/,
        );

        assert.match(
          source,
          /origins\.push\(url\.origin\)/,
        );
      },
    );

    it(
      'does not allow malformed configured URLs to broaden the allowlist',
      () => {
        assert.match(
          source,
          /try \{[\s\S]*new URL\(value\)[\s\S]*\} catch \{/,
        );
      },
    );

    it(
      'combines configured cache origins with loopback and explicit origins',
      () => {
        const registration =
          source.match(
            /function registerSidecarAllowedPrivateFetchOrigins[\s\S]*?\n\}/,
          )?.[0];

        assert.ok(
          registration,
          'registration function is missing',
        );

        assert.match(
          registration,
          /http:\/\/127\.0\.0\.1:/,
        );

        assert.match(
          registration,
          /http:\/\/localhost:/,
        );

        assert.match(
          registration,
          /\.\.\.getConfiguredPrivateFetchOrigins\(\)/,
        );

        assert.match(
          registration,
          /\.\.\.extraOrigins/,
        );
      },
    );

    it(
      'keeps the allowlist scoped to exact URL origins',
      () => {
        assert.match(
          source,
          /sidecarAllowedPrivateFetchOrigins\.has\(url\.origin\)/,
        );
      },
    );
  },
);
