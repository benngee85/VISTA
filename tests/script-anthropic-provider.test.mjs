import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const {
  anthropicMessagesUrl,
  createAnthropicProvider,
  buildProviderRequest,
  parseProviderResponse,
  isTokenLimited,
} = require(
  '../scripts/lib/anthropic-messages.cjs'
);

test(
  'derives a configurable Anthropic messages endpoint',
  () => {
    assert.equal(
      anthropicMessagesUrl(
        'http://127.0.0.1:1234'
      ),
      'http://127.0.0.1:1234/v1/messages',
    );

    assert.equal(
      anthropicMessagesUrl(
        'https://example.invalid/custom/path'
      ),
      'https://example.invalid/v1/messages',
    );

    assert.equal(
      anthropicMessagesUrl('file:///tmp/model'),
      '',
    );

    assert.equal(
      anthropicMessagesUrl('not a URL'),
      '',
    );
  },
);

test(
  'reads the shared Anthropic module variables',
  () => {
    const before = {
      ANTHROPIC_BASE_URL:
        process.env.ANTHROPIC_BASE_URL,
      ANTHROPIC_MODEL:
        process.env.ANTHROPIC_MODEL,
    };

    try {
      process.env.ANTHROPIC_BASE_URL =
        'http://127.0.0.1:1234';
      process.env.ANTHROPIC_MODEL =
        'test-model';

      const provider =
        createAnthropicProvider();

      assert.equal(
        provider.name,
        'anthropic',
      );

      assert.equal(
        provider.protocol,
        'anthropic',
      );

      assert.equal(
        provider.envKey,
        'ANTHROPIC_API_KEY',
      );

      assert.equal(
        provider.apiUrlFn(),
        'http://127.0.0.1:1234/v1/messages',
      );

      assert.equal(
        provider.model(),
        'test-model',
      );
    } finally {
      for (
        const [key, value] of
        Object.entries(before)
      ) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    }
  },
);

test(
  'translates Anthropic requests and responses',
  () => {
    const provider = {
      protocol: 'anthropic',
    };

    const body = buildProviderRequest(
      provider,
      {
        model: 'qwen36',
        systemPrompt: 'System rules',
        userPrompt: 'User request',
        maxTokens: 250,
        temperature: 0.2,
      },
    );

    assert.deepEqual(body, {
      model: 'qwen36',
      system: 'System rules',
      messages: [{
        role: 'user',
        content: 'User request',
      }],
      max_tokens: 250,
      temperature: 0.2,
    });

    const parsed = parseProviderResponse(
      provider,
      {
        model: 'qwen36',
        stop_reason: 'max_tokens',
        content: [{
          type: 'text',
          text: 'Local result',
        }],
        usage: {
          input_tokens: 10,
          output_tokens: 5,
        },
      },
    );

    assert.equal(
      parsed.text,
      'Local result',
    );

    assert.equal(
      parsed.model,
      'qwen36',
    );

    assert.equal(
      parsed.usage.tokensTotal,
      15,
    );

    assert.equal(
      isTokenLimited(provider, parsed),
      true,
    );
  },
);

test(
  'relay and common chain prefer Anthropic',
  () => {
    const relay = readFileSync(
      new URL(
        '../scripts/ais-relay.cjs',
        import.meta.url,
      ),
      'utf8',
    );

    const chain = readFileSync(
      new URL(
        '../scripts/lib/llm-chain.cjs',
        import.meta.url,
      ),
      'utf8',
    );

    for (const source of [relay, chain]) {
      assert.match(
        source,
        /createAnthropicProvider\(\{/,
      );

      assert.doesNotMatch(
        source,
        /10\.1\.24\.100/,
      );

      assert.doesNotMatch(
        source,
        /local-lm-studio/,
      );
    }

    assert.match(
      relay,
      /provider\.protocol \|\| 'openai'/,
    );

    assert.match(
      chain,
      /buildProviderRequest\(provider,/,
    );
  },
);
