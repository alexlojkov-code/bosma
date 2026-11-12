// POST /api/generate — генерирует ОДИН вариант поста и стримит его в SSE (SPEC §4.2).
import { validateRequest } from '../public/js/core/validate.js';
import { errorText } from '../public/js/core/messages.js';
import { getConfig } from './_lib/config.js';
import { AppError } from './_lib/errors.js';
import { openStream, sendJson } from './_lib/sse.js';
import { createLimiter, clientIp } from './_lib/ratelimit.js';
import { buildPrompt } from './_lib/prompt.js';
import { streamGemini } from './_lib/gemini.js';
import { streamMock } from './_lib/mock.js';
import { postprocess } from './_lib/postprocess.js';
import { logRequest } from './_lib/log.js';

const MAX_BODY = 16 * 1024;

function readBody(req) {
  // На Vercel req.body уже разобран (getter может бросить на невалидном JSON),
  // в локальном server.mjs — строка.
  let body;
  try {
    body = req.body;
  } catch {
    return { error: true };
  }
  if (body === undefined || body === null || body === '') return { error: true };
  if (Buffer.isBuffer(body)) body = body.toString('utf8');
  if (typeof body === 'string') {
    if (Buffer.byteLength(body) > MAX_BODY) return { error: true, tooLarge: true };
    try {
      return { value: JSON.parse(body) };
    } catch {
      return { error: true };
    }
  }
  if (Buffer.byteLength(JSON.stringify(body)) > MAX_BODY) return { error: true, tooLarge: true };
  return { value: body };
}

function originAllowed(req, cfg) {
  const origin = req.headers.origin;
  if (!origin) return true; // не браузер (curl, тесты) — защищаемся лимитами
  let url;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (cfg.allowedOrigins.includes(origin)) return true;
  if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return true;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return Boolean(host) && url.host === host;
}

const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function createHandler(deps = {}) {
  const env = deps.env || process.env;
  const fetchImpl = deps.fetchImpl || ((...a) => fetch(...a));
  const sleep = deps.sleep || defaultSleep;
  const mockSpeed = deps.mockSpeed ?? 1;
  let limiter = deps.limiter || null;
  let limiterKey = '';

  return async function handler(req, res) {
    const started = Date.now();
    const rid = `r_${Math.random().toString(36).slice(2, 8)}`;
    const cfg = getConfig(env);
    const base = { rid, mode: cfg.mode };

    if (!deps.limiter && limiterKey !== `${cfg.perMin}/${cfg.perDay}`) {
      limiter = createLimiter({ perMin: cfg.perMin, perDay: cfg.perDay });
      limiterKey = `${cfg.perMin}/${cfg.perDay}`;
    }

    const reject = (status, data, headers) => {
      logRequest({ ...base, status: 'rejected', code: data.code, http: status });
      sendJson(res, status, data, headers);
    };

    if (req.method !== 'POST') return reject(405, { code: 'method_not_allowed', message: 'Только POST.' }, { Allow: 'POST' });
    if (!originAllowed(req, cfg)) return reject(403, { code: 'forbidden', message: errorText('forbidden') });

    const body = readBody(req);
    if (body.error) {
      return reject(400, { code: 'invalid_input', field: null, message: body.tooLarge ? 'Запрос слишком большой.' : 'Запрос не в формате JSON.' });
    }
    const v = validateRequest(body.value);
    if (!v.ok) return reject(400, { code: 'invalid_input', field: v.field, message: v.message });
    const input = v.value;

    const limit = limiter.check(clientIp(req));
    if (!limit.ok) {
      return reject(
        429,
        { code: 'rate_limited', retryAfter: limit.retryAfter, message: errorText('rate_limited', limit.retryAfter) },
        { 'Retry-After': String(limit.retryAfter) },
      );
    }

    // ---- стрим ----
    const ctrl = new AbortController();
    let clientGone = false;
    res.on('close', () => {
      if (!res.writableFinished) {
        clientGone = true;
        ctrl.abort();
      }
    });

    const stream = openStream(res);
    stream.send('start', { requestId: rid });
    const ping = setInterval(() => stream.ping(), 15000);

    let text = '';
    let sentDelta = false;
    let ttfb = null;
    let retry = 0;
    let usage = { in: 0, out: 0, thoughts: 0 };
    const meta = { platform: input.platform, lang: input.language, angle: input.angle, tweak: input.tweak };

    const onText = (t) => {
      if (!t) return;
      text += t;
      if (!sentDelta) {
        sentDelta = true;
        ttfb = Date.now() - started;
      }
      stream.send('delta', { text: t });
    };

    try {
      let result;
      for (;;) {
        try {
          if (cfg.mode === 'mock') {
            result = await streamMock({ input, signal: ctrl.signal, onText, speed: mockSpeed });
          } else {
            const { system, user } = buildPrompt(input);
            result = await streamGemini({ apiKey: cfg.apiKey, model: cfg.model, system, user, signal: ctrl.signal, timeoutMs: cfg.timeoutMs, onText, fetchImpl });
          }
          break;
        } catch (e) {
          // Один повтор — только пока клиенту не ушёл ни один delta (SPEC §5.3).
          if (e instanceof AppError && e.retryable && !sentDelta && retry === 0 && !clientGone) {
            retry++;
            text = '';
            await sleep(1000);
            continue;
          }
          throw e;
        }
      }
      usage = result.usage || usage;

      let raw;
      try {
        raw = JSON.parse(text);
      } catch {
        throw new AppError(result.finishReason === 'MAX_TOKENS' ? 'truncated' : 'bad_output', { message: 'json parse failed' });
      }
      const { post, warnings } = postprocess(raw, input.platform);
      stream.send('done', { post, warnings, usage });
      logRequest({ ...base, ...meta, status: 'done', code: null, ttfb_ms: ttfb, total_ms: Date.now() - started, ...usage, retry });
    } catch (e) {
      const err = e instanceof AppError ? e : new AppError('upstream_error', { cause: e });
      if (err.code === 'aborted' || clientGone) {
        logRequest({ ...base, ...meta, status: 'aborted', code: null, ttfb_ms: ttfb, total_ms: Date.now() - started, retry });
      } else {
        const payload = { code: err.code, message: errorText(err.code, err.retryAfter) };
        if (err.retryAfter) payload.retryAfter = err.retryAfter;
        stream.send('error', payload);
        logRequest({ ...base, ...meta, status: 'error', code: err.code, upstream: err.status ?? null, detail: err.code === 'upstream_error' ? String(err.message).slice(0, 120) : undefined, ttfb_ms: ttfb, total_ms: Date.now() - started, retry });
      }
    } finally {
      clearInterval(ping);
      stream.end();
    }
  };
}

export default createHandler();
