export type LlmWireProtocol = 'openai' | 'anthropic';

interface OpenAiMessage {
  role: string;
  content: string;
}

interface OpenAiRequest {
  model?: string;
  messages?: OpenAiMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  [key: string]: unknown;
}

function anthropicRequestBody(
  openAiBody: OpenAiRequest,
): Record<string, unknown> {
  const messages = Array.isArray(openAiBody.messages)
    ? openAiBody.messages
    : [];

  const system = messages
    .filter(message => message.role === 'system')
    .map(message => String(message.content || ''))
    .filter(Boolean)
    .join('\n\n');

  const conversational = messages
    .filter(message => message.role !== 'system')
    .map(message => ({
      role: message.role === 'assistant'
        ? 'assistant'
        : 'user',
      content: String(message.content || ''),
    }));

  return {
    model: openAiBody.model,
    max_tokens: openAiBody.max_tokens,
    temperature: openAiBody.temperature,
    stream: openAiBody.stream === true,
    ...(system ? { system } : {}),
    messages: conversational,
  };
}

function transformAnthropicMessage(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const blocks = Array.isArray(payload.content)
    ? payload.content
    : [];

  const content = blocks
    .filter(block =>
      block &&
      typeof block === 'object' &&
      (block as Record<string, unknown>).type === 'text',
    )
    .map(block =>
      String(
        (block as Record<string, unknown>).text || '',
      ),
    )
    .join('');

  const usage =
    payload.usage &&
    typeof payload.usage === 'object'
      ? payload.usage as Record<string, unknown>
      : {};

  const promptTokens =
    Number(usage.input_tokens || 0);

  const completionTokens =
    Number(usage.output_tokens || 0);

  return {
    choices: [
      {
        message: {
          role: 'assistant',
          content,
        },
        finish_reason:
          typeof payload.stop_reason === 'string'
            ? payload.stop_reason
            : null,
      },
    ],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
    },
    model: payload.model,
  };
}

function transformAnthropicStream(
  source: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = source.getReader();
      let buffer = '';
      let doneSent = false;

      const emit = (value: string) => {
        controller.enqueue(encoder.encode(value));
      };

      const processBlock = (block: string) => {
        const dataLines = block
          .split(/\r?\n/)
          .filter(line => line.startsWith('data:'))
          .map(line => line.slice(5).trim())
          .filter(Boolean);

        for (const dataLine of dataLines) {
          let event: Record<string, unknown>;

          try {
            event = JSON.parse(dataLine);
          } catch {
            continue;
          }

          if (
            event.type === 'content_block_delta' &&
            event.delta &&
            typeof event.delta === 'object'
          ) {
            const text = String(
              (event.delta as Record<string, unknown>)
                .text || '',
            );

            if (text) {
              emit(
                `data: ${JSON.stringify({
                  choices: [
                    {
                      delta: { content: text },
                      finish_reason: null,
                    },
                  ],
                })}\n\n`,
              );
            }
          }

          if (
            event.type === 'message_stop' &&
            !doneSent
          ) {
            doneSent = true;
            emit('data: [DONE]\n\n');
          }
        }
      };

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, {
            stream: true,
          });

          while (true) {
            const match = buffer.match(/\r?\n\r?\n/);

            if (!match || match.index == null) break;

            const block = buffer.slice(0, match.index);
            buffer = buffer.slice(
              match.index + match[0].length,
            );

            processBlock(block);
          }
        }

        if (buffer.trim()) processBlock(buffer);

        if (!doneSent) {
          emit('data: [DONE]\n\n');
        }

        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        try {
          await reader.cancel();
        } catch {}
      }
    },
  });
}

export async function fetchLlmProvider(
  protocol: LlmWireProtocol,
  url: string,
  init: RequestInit,
): Promise<Response> {
  if (protocol !== 'anthropic') {
    return fetch(url, init);
  }

  const openAiBody = JSON.parse(
    String(init.body || '{}'),
  ) as OpenAiRequest;

  const response = await fetch(url, {
    ...init,
    body: JSON.stringify(
      anthropicRequestBody(openAiBody),
    ),
  });

  if (!response.ok) return response;

  if (openAiBody.stream === true) {
    if (!response.body) return response;

    return new Response(
      transformAnthropicStream(response.body),
      {
        status: response.status,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-store',
        },
      },
    );
  }

  const payload =
    await response.json() as Record<string, unknown>;

  return new Response(
    JSON.stringify(transformAnthropicMessage(payload)),
    {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    },
  );
}
