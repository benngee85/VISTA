import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const gpsSource = readFileSync(
  'src/services/gps-interference.ts',
  'utf8',
);

const nginxSource = readFileSync(
  'docker/nginx.conf',
  'utf8',
);

describe('R94.3 self-host browser degradation controls', () => {
  it('bounds GPSJam retries after unavailable responses', () => {
    assert.match(
      gpsSource,
      /const FAILURE_COOLDOWN = 5 \* 60 \* 1000;/,
    );

    assert.match(
      gpsSource,
      /if \(now < retryAfter\) return cachedData;/,
    );

    assert.match(
      gpsSource,
      /resp\.status === 429[\s\S]*RATE_LIMIT_COOLDOWN/,
    );

    assert.match(
      gpsSource,
      /retryAfter = now \+ FAILURE_COOLDOWN;/,
    );

    assert.match(
      gpsSource,
      /retryAfter = 0;/,
    );
  });

  it('serves a valid self-hosted Vercel Insights no-op', () => {
    assert.match(
      nginxSource,
      /location = \/_vercel\/insights\/script\.js/,
    );

    assert.match(
      nginxSource,
      /default_type application\/javascript;/,
    );

    assert.match(
      nginxSource,
      /return 200 "";/,
    );
  });

  it('proxies the country-boundary override through nginx', () => {
    assert.match(
      nginxSource,
      /location = \/country-boundary-overrides\.geojson/,
    );

    assert.match(
      nginxSource,
      /proxy_pass https:\/\/maps\.worldmonitor\.app\/country-boundary-overrides\.geojson;/,
    );

    assert.match(
      nginxSource,
      /add_header Access-Control-Allow-Origin "\*" always;/,
    );
  });
});
