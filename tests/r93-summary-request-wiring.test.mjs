import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(
  new URL(
    '../src/services/summarization.ts',
    import.meta.url,
  ),
  'utf8',
);

test(
  'summary generation coalesces by canonical cache key',
  () => {
    assert.match(
      source,
      /summaryRequestController\.coalesce\(\s*cacheKey,/s,
    );
  },
);

test(
  'server summary dispatch uses the shared limiter',
  () => {
    assert.match(
      source,
      /summaryRequestController\.runServer\(/,
    );

    assert.match(
      source,
      /maxConcurrentServerRequests:\s*2/,
    );
  },
);

test(
  '429 and degraded 503 responses arm suppression',
  () => {
    assert.match(
      source,
      /response\.status === 429/,
    );

    assert.match(
      source,
      /response\.status === 503/,
    );

    assert.match(
      source,
      /X-RateLimit-Mode/,
    );

    assert.match(
      source,
      /parseSummarizeRetryAfterMs/,
    );

    assert.match(
      source,
      /retryAfterMs === null[\s\S]*suppressServerSummarization\(\)/,
    );

    assert.match(
      source,
      /SUMMARY_DEGRADED_FALLBACK_RETRY_MS = 5_000/,
    );
  },
);
