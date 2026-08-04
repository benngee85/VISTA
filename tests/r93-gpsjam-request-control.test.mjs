import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(
  new URL('../api/gpsjam.js', import.meta.url),
  'utf8',
);

test('GPSJam coalesces concurrent Redis reads', () => {
  assert.match(
    source,
    /let inFlightFetch = null;/,
  );

  assert.match(
    source,
    /if \(inFlightFetch\) return inFlightFetch;/,
  );

  assert.match(
    source,
    /inFlightFetch = loadGpsJamData\(\);/,
  );

  assert.match(
    source,
    /finally \{\s*inFlightFetch = null;\s*\}/s,
  );
});

test('GPSJam unavailable response has bounded retry semantics', () => {
  assert.match(
    source,
    /'Retry-After': '30'/,
  );

  assert.match(
    source,
    /s-maxage=30/,
  );

  assert.match(
    source,
    /'X-Data-Availability': 'temporarily-unavailable'/,
  );

  assert.doesNotMatch(
    source,
    /'Cache-Control': 'no-cache, no-store'/,
  );
});
