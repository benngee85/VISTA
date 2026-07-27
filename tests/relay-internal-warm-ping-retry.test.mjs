import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const relaySource = fs.readFileSync(
  new URL('../scripts/ais-relay.cjs', import.meta.url),
  'utf8',
);

function extractFunction(name) {
  const markers = [
    `async function ${name}(`,
    `function ${name}(`,
  ];

  let start = -1;

  for (const marker of markers) {
    start = relaySource.indexOf(marker);
    if (start >= 0) break;
  }

  assert.notEqual(start, -1, `${name} must exist`);

  const parameterStart = relaySource.indexOf('(', start);
  assert.notEqual(
    parameterStart,
    -1,
    `${name} must have an opening parenthesis`,
  );

  let parameterDepth = 0;
  let parameterQuote = '';
  let parameterEscaped = false;
  let parameterEnd = -1;

  for (let i = parameterStart; i < relaySource.length; i++) {
    const c = relaySource[i];

    if (parameterQuote) {
      if (parameterEscaped) {
        parameterEscaped = false;
      } else if (c === '\\\\') {
        parameterEscaped = true;
      } else if (c === parameterQuote) {
        parameterQuote = '';
      }

      continue;
    }

    if (c === "'" || c === '"' || c === '`') {
      parameterQuote = c;
      continue;
    }

    if (c === '(') parameterDepth++;

    if (c === ')') {
      parameterDepth--;

      if (parameterDepth === 0) {
        parameterEnd = i;
        break;
      }
    }
  }

  assert.notEqual(
    parameterEnd,
    -1,
    `${name} must have a closing parenthesis`,
  );

  const brace = relaySource.indexOf('{', parameterEnd);
  assert.notEqual(brace, -1, `${name} must have an opening brace`);

  let depth = 0;
  let quote = '';
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = brace; i < relaySource.length; i++) {
    const c = relaySource[i];
    const next = relaySource[i + 1];

    if (lineComment) {
      if (c === '\n') lineComment = false;
      continue;
    }

    if (blockComment) {
      if (c === '*' && next === '/') {
        blockComment = false;
        i++;
      }
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (c === '\\') {
        escaped = true;
      } else if (c === quote) {
        quote = '';
      }
      continue;
    }

    if (c === '/' && next === '/') {
      lineComment = true;
      i++;
      continue;
    }

    if (c === '/' && next === '*') {
      blockComment = true;
      i++;
      continue;
    }

    if (c === "'" || c === '"' || c === '`') {
      quote = c;
      continue;
    }

    if (c === '{') depth++;

    if (c === '}') {
      depth--;

      if (depth === 0) {
        return relaySource.slice(start, i + 1);
      }
    }
  }

  throw new Error(`${name} closing brace not found`);
}

const fetchInternalWarmPing = Function(
  `"use strict"; return (${extractFunction('fetchInternalWarmPing')});`,
)();

function response(status, options = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    body: {
      cancel: options.cancel || (async () => {}),
    },
  };
}

test('retries transport failures and eventually returns success', async () => {
  const waits = [];
  const calls = [];
  const headers = {
    'Content-Type': 'application/json',
    'X-WorldMonitor-Key': 'test-relay-key',
  };
  const init = {
    method: 'POST',
    headers,
    body: '{}',
  };

  const fetchImpl = async (url, requestInit) => {
    calls.push({ url, requestInit });

    if (calls.length < 3) {
      throw new TypeError('fetch failed');
    }

    return response(200);
  };

  const result = await fetchInternalWarmPing(
    'http://worldmonitor:8080/api/health',
    init,
    {
      fetchImpl,
      sleep: async delay => waits.push(delay),
      maxAttempts: 5,
      baseDelayMs: 100,
    },
  );

  assert.equal(result.status, 200);
  assert.equal(calls.length, 3);
  assert.deepEqual(waits, [100, 200]);

  for (const call of calls) {
    assert.equal(call.url, 'http://worldmonitor:8080/api/health');
    assert.equal(call.requestInit, init);
    assert.equal(
      call.requestInit.headers['X-WorldMonitor-Key'],
      'test-relay-key',
    );
  }
});

test('retries temporary HTTP failures and cancels discarded bodies', async () => {
  let cancelled = 0;
  let calls = 0;
  const waits = [];

  const result = await fetchInternalWarmPing(
    'http://worldmonitor:8080/api/health',
    {},
    {
      fetchImpl: async () => {
        calls++;

        if (calls === 1) {
          return response(503, {
            cancel: async () => {
              cancelled++;
            },
          });
        }

        return response(200);
      },
      sleep: async delay => waits.push(delay),
      maxAttempts: 3,
      baseDelayMs: 25,
    },
  );

  assert.equal(result.status, 200);
  assert.equal(calls, 2);
  assert.equal(cancelled, 1);
  assert.deepEqual(waits, [25]);
});

test('does not retry permanent authentication failures', async () => {
  let calls = 0;

  const result = await fetchInternalWarmPing(
    'http://worldmonitor:8080/api/health',
    {},
    {
      fetchImpl: async () => {
        calls++;
        return response(401);
      },
      sleep: async () => {
        throw new Error('sleep must not be called');
      },
      maxAttempts: 5,
      baseDelayMs: 10,
    },
  );

  assert.equal(result.status, 401);
  assert.equal(calls, 1);
});

test('throws the final transport error after exhausting its budget', async () => {
  let calls = 0;
  const waits = [];
  const failure = new TypeError('connect ECONNREFUSED');

  await assert.rejects(
    fetchInternalWarmPing(
      'http://worldmonitor:8080/api/health',
      {},
      {
        fetchImpl: async () => {
          calls++;
          throw failure;
        },
        sleep: async delay => waits.push(delay),
        maxAttempts: 4,
        baseDelayMs: 50,
      },
    ),
    error => error === failure,
  );

  assert.equal(calls, 4);
  assert.deepEqual(waits, [50, 100, 200]);
});

test('returns the final retryable HTTP response when budget is exhausted', async () => {
  let calls = 0;
  let cancelled = 0;

  const result = await fetchInternalWarmPing(
    'http://worldmonitor:8080/api/health',
    {},
    {
      fetchImpl: async () => {
        calls++;

        return response(503, {
          cancel: async () => {
            cancelled++;
          },
        });
      },
      sleep: async () => {},
      maxAttempts: 3,
      baseDelayMs: 0,
    },
  );

  assert.equal(result.status, 503);
  assert.equal(calls, 3);
  assert.equal(cancelled, 2);
});

test('active internal warm-pings use the bounded retry helper', () => {
  for (const name of [
    'seedServiceStatuses',
    'seedCiiWarmPing',
    'seedCableHealthWarmPing',
  ]) {
    const body = extractFunction(name);

    assert.match(
      body,
      /\bfetchInternalWarmPing\s*\(/,
      `${name} must use the internal retry helper`,
    );

    assert.doesNotMatch(
      body,
      /(?<!InternalWarmPing)\bfetch\s*\(/,
      `${name} must not bypass the helper`,
    );

    assert.match(
      body,
      /warmPingHeaders\s*\(/,
      `${name} must retain internal authentication`,
    );

    assert.match(
      body,
      /AbortSignal\.timeout\(60_000\)/,
      `${name} must retain its timeout budget`,
    );
  }
});

test('helper scope remains limited to the three internal startup paths', () => {
  const calls =
    relaySource.match(/\bfetchInternalWarmPing\s*\(/g) || [];

  assert.equal(
    calls.length,
    4,
    'one declaration plus exactly three internal warm-ping call sites expected',
  );
});
