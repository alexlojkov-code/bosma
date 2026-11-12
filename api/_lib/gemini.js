// Запрос к Gemini и разбор его SSE (SPEC §5).
import { AppError } from './errors.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// 'json' → responseJsonSchema (порядок ключей схемы), 'openapi' → responseSchema + propertyOrdering.
// Переключается по результатам спайка (SPEC §13.2, риск R1).
export const SCHEMA_FLAVOR = 'json';

const PROPS = {
  title: { type: 'string' },
  body: { type: 'string' },
  cta: { type: 'string' },
  hashtags: { type: 'array', items: { type: 'string' }, maxItems: 10 },
};

const BLOCK_REASONS = new Set(['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII']);

export function buildBody({ system, user }) {
  const generationConfig = {
    responseMimeType: 'application/json',
    maxOutputTokens: 2048,
    thinkingConfig: { thinkingLevel: 'minimal' },
  };
  if (SCHEMA_FLAVOR === 'json') {
    generationConfig.responseJsonSchema = {
      type: 'object',
      properties: PROPS,
      required: ['title', 'body', 'cta', 'hashtags'],
    };
  } else {
    generationConfig.responseSchema = {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING' },
        body: { type: 'STRING' },
        cta: { type: 'STRING' },
        hashtags: { type: 'ARRAY', items: { type: 'STRING' } },
      },
      required: ['title', 'body', 'cta', 'hashtags'],
      propertyOrdering: ['title', 'body', 'cta', 'hashtags'],
    };
  }
  // temperature / topP / topK / candidateCount не передаются (PRD §8.1).
  return {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig,
  };
}

/** Разбирает один JSON-кусок стрима Gemini. */
export function readChunk(chunk, state) {
  if (chunk.promptFeedback?.blockReason) {
    throw new AppError('blocked_content', { message: `prompt blocked: ${chunk.promptFeedback.blockReason}` });
  }
  const cand = chunk.candidates?.[0];
  let text = '';
  for (const part of cand?.content?.parts || []) {
    if (part.thought) continue;
    if (typeof part.text === 'string') text += part.text;
  }
  if (cand?.finishReason) state.finishReason = cand.finishReason;
  if (chunk.usageMetadata) {
    state.usage = {
      in: chunk.usageMetadata.promptTokenCount ?? 0,
      out: chunk.usageMetadata.candidatesTokenCount ?? 0,
      thoughts: chunk.usageMetadata.thoughtsTokenCount ?? 0,
    };
  }
  return text;
}

/**
 * Стримит ответ модели. onText(кусок) вызывается для каждого текстового куска.
 * → { finishReason, usage }. Ошибки — AppError с полем retryable.
 */
export async function streamGemini({ apiKey, model, system, user, signal, timeoutMs = 30000, onText, fetchImpl = fetch }) {
  if (!apiKey) throw new AppError('not_configured');

  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, timeoutMs);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort, { once: true });

  const state = { finishReason: null, usage: { in: 0, out: 0, thoughts: 0 } };
  try {
    let res;
    try {
      res = await fetchImpl(`${BASE}/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(buildBody({ system, user })),
        signal: ctrl.signal,
      });
    } catch (e) {
      throw abortOr(e, signal, timedOut, true);
    }

    if (!res.ok) {
      let detail = '';
      try {
        const j = await res.json();
        detail = j?.error?.status || j?.error?.message || '';
      } catch { /* тело не JSON */ }
      const retryable = res.status === 429 || res.status === 500 || res.status === 503;
      const code = res.status === 429 ? 'rate_limited' : 'upstream_error';
      throw new AppError(code, { status: res.status, retryable, retryAfter: res.status === 429 ? 30 : undefined, message: `gemini ${res.status} ${detail}`.trim() });
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.search(/\r?\n\r?\n/)) !== -1) {
          const raw = buf.slice(0, idx);
          buf = buf.slice(idx).replace(/^\r?\n\r?\n/, '');
          handleEvent(raw, state, onText);
        }
      }
      buf += decoder.decode();
      if (buf.trim()) handleEvent(buf, state, onText);
    } catch (e) {
      if (e instanceof AppError) throw e;
      throw abortOr(e, signal, timedOut, false);
    }

    if (state.finishReason && BLOCK_REASONS.has(state.finishReason)) {
      throw new AppError('blocked_content', { message: `finish ${state.finishReason}` });
    }
    return state;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

function handleEvent(raw, state, onText) {
  const data = raw
    .split(/\r?\n/)
    .filter((l) => l.startsWith('data:'))
    .map((l) => l.slice(5).trimStart())
    .join('\n');
  if (!data) return;
  let chunk;
  try {
    chunk = JSON.parse(data);
  } catch {
    return;
  }
  if (chunk.error) {
    throw new AppError('upstream_error', { message: `gemini stream error ${chunk.error.status || ''}`.trim() });
  }
  const text = readChunk(chunk, state);
  if (text) onText(text);
}

function abortOr(e, signal, timedOut, beforeResponse) {
  if (signal?.aborted) return new AppError('aborted', { cause: e });
  if (timedOut) return new AppError('timeout', { cause: e });
  return new AppError('upstream_error', { retryable: beforeResponse, message: `network: ${e?.message || e}`, cause: e });
}
