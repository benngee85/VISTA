import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  fetchLlmProvider,
} from '../server/_shared/llm-anthropic-adapter.ts';

const originalFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('translates OpenAI-shaped calls to Anthropic messages', async () => {
  let capturedBody: Record<string, unknown> = {};
  let capturedHeaders: HeadersInit | undefined;

  globalThis.fetch = (async (
    _input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    capturedBody = JSON.parse(
      String(init?.body || '{}'),
    );
    capturedHeaders = init?.headers;

    return new Response(JSON.stringify({
      type: 'message',
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: 'LOCAL_OK',
        },
      ],
      model: 'qwen36',
      stop_reason: 'end_turn',
      usage: {
        input_tokens: 12,
        output_tokens: 3,
      },
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }) as typeof fetch;

  const response = await fetchLlmProvider(
    'anthropic',
    'http://llm.example/v1/messages',
    {
      method: 'POST',
      headers: {
        'x-api-key': 'adapter-key',
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen36',
        messages: [
          {
            role: 'system',
            content: 'System policy',
          },
          {
            role: 'user',
            content: 'Question',
          },
        ],
        max_tokens: 64,
        temperature: 0,
      }),
    },
  );

  const result = await response.json();

  assert.equal(capturedBody.system, 'System policy');
  assert.deepEqual(capturedBody.messages, [
    {
      role: 'user',
      content: 'Question',
    },
  ]);

  assert.equal(
    (capturedHeaders as Record<string, string>)
      ['x-api-key'],
    'adapter-key',
  );

  assert.equal(
    result.choices[0].message.content,
    'LOCAL_OK',
  );

  assert.equal(result.choices[0].finish_reason, 'end_turn');
  assert.equal(result.usage.total_tokens, 15);
});

test('translates Anthropic streaming deltas to OpenAI SSE', async () => {
  const encoder = new TextEncoder();

  globalThis.fetch = (async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(
          'event: content_block_delta\n' +
          'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"LOCAL"}}\n\n' +
          'event: content_block_delta\n' +
          'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"_STREAM"}}\n\n' +
          'event: message_stop\n' +
          'data: {"type":"message_stop"}\n\n',
        ));
        controller.close();
      },
    });

    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
      },
    });
  }) as typeof fetch;

  const response = await fetchLlmProvider(
    'anthropic',
    'http://llm.example/v1/messages',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen36',
        stream: true,
        messages: [
          {
            role: 'user',
            content: 'Question',
          },
        ],
      }),
    },
  );

  const text = await response.text();

  assert.match(text, /"content":"LOCAL"/);
  assert.match(text, /"content":"_STREAM"/);
  assert.match(text, /data: \[DONE\]/);
});

test('tracked source contains no deployment-specific local LLM address', () => {
  const files = [
    'server/_shared/llm.ts',
    'server/_shared/llm-health.ts',
    'server/_shared/llm-anthropic-adapter.ts',
    'scripts/ais-relay.cjs',
    'compose.yaml',
  ];

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');

    assert.doesNotMatch(
      source,
      /10\.1\.24\.100/,
      `${file} must source the address from ANTHROPIC_BASE_URL`,
    );

    assert.doesNotMatch(
      source,
      /local-lm-studio/,
      `${file} must source the adapter key from ANTHROPIC_API_KEY`,
    );
  }
});

test(
  'Compose injects the same three-variable module into app and relay',
  () => {
    const compose = readFileSync(
      new URL('../compose.yaml', import.meta.url),
      'utf8',
    );

    for (const name of [
      'ANTHROPIC_BASE_URL',
      'ANTHROPIC_MODEL',
      'ANTHROPIC_API_KEY',
    ]) {
      const needle = `${name}: "\${${name}:-}"`;
      const count = compose.split(needle).length - 1;

      assert.ok(
        count >= 2,
        `${name} must be injected into both services`,
      );
    }
  },
);
