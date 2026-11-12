import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createHandler } from '../api/generate.js';

process.env.SPG_SILENT = '1';

const servers = [];
after(() => servers.forEach((s) => s.close()));

async function start(handler) {
  const server = http.createServer(async (req, res) => {
    let raw = '';
    for await (const c of req) raw += c;
    req.body = raw;
    await handler(req, res);
  });
  servers.push(server);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return `http://127.0.0.1:${server.address().port}/api/generate`;
}

const input = {
  business: 'Кофейня у метро, своя обжарка, завтраки до полудня',
  idea: 'Осеннее меню с тыквенным латте',
  platform: 'instagram',
  language: 'ru',
  tone: 'auto',
  angle: 'benefit',
  tweak: null,
  previous: null,
};

function parseSse(text) {
  return text
    .split('\n\n')
    .filter((b) => b.startsWith('event:'))
    .map((b) => {
      const [e, d] = b.split('\n');
      return { event: e.slice(7), data: JSON.parse(d.slice(6)) };
    });
}

async function post(url, body = input, headers = {}) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
  return { res, text: await res.text() };
}

/** Ответ Gemini в виде SSE-потока из кусков JSON. */
function geminiStream(chunks, { failAfter } = {}) {
  const enc = new TextEncoder();
  let i = 0;
  const stream = new ReadableStream({
    pull(ctrl) {
      if (failAfter !== undefined && i === failAfter) return ctrl.error(new Error('socket hang up'));
      if (i >= chunks.length) return ctrl.close();
      ctrl.enqueue(enc.encode(`data: ${JSON.stringify(chunks[i++])}\r\n\r\n`));
    },
  });
  return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

const textChunk = (t, extra = {}) => ({ candidates: [{ content: { parts: [{ text: t }] }, ...extra }] });
const goodJson = JSON.stringify({ title: 'Тыквенный латте уже здесь', body: 'Осень пришла в кофейню.', cta: 'Заходите', hashtags: ['кофе', 'осень', 'латте'] });
const split = (s, n = 7) => s.match(new RegExp(`[\\s\\S]{1,${n}}`, 'g'));

const liveEnv = { GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'gemini-3.5-flash-lite' };

test('mock: start → delta… → done в правильном порядке', async () => {
  const url = await start(createHandler({ env: { GEMINI_MODE: 'mock' }, mockSpeed: 0 }));
  const { res, text } = await post(url);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/event-stream/);
  const ev = parseSse(text);
  assert.equal(ev[0].event, 'start');
  assert.equal(ev.at(-1).event, 'done');
  assert.ok(ev.filter((e) => e.event === 'delta').length > 3);
  const joined = ev.filter((e) => e.event === 'delta').map((e) => e.data.text).join('');
  assert.deepEqual(Object.keys(JSON.parse(joined)), ['title', 'body', 'cta', 'hashtags']);
  const { post: p } = ev.at(-1).data;
  assert.ok(p.title && p.body && p.cta);
});

test('405 / 403 / 400 без обращения к модели', async () => {
  let calls = 0;
  const url = await start(createHandler({ env: liveEnv, fetchImpl: async () => { calls++; return geminiStream([]); } }));
  assert.equal((await fetch(url)).status, 405);
  assert.equal((await post(url, input, { Origin: 'https://evil.example' })).res.status, 403);
  const bad = await post(url, { ...input, business: 'коротко' });
  assert.equal(bad.res.status, 400);
  assert.equal(JSON.parse(bad.text).field, 'business');
  assert.equal((await post(url, '{не json')).res.status, 400);
  assert.equal((await post(url, { ...input, business: 'я'.repeat(20000) })).res.status, 400);
  assert.equal(calls, 0);
});

test('свой Origin и localhost разрешены', async () => {
  const url = await start(createHandler({ env: { GEMINI_MODE: 'mock' }, mockSpeed: 0 }));
  const host = new URL(url).host;
  assert.equal((await post(url, input, { Origin: `http://${host}` })).res.status, 200);
  assert.equal((await post(url, input, { Origin: 'http://localhost:5220' })).res.status, 200);
});

test('лимит: третий запрос в минуту → 429 с Retry-After', async () => {
  const url = await start(createHandler({ env: { GEMINI_MODE: 'mock', RATE_LIMIT_PER_MIN: '2' }, mockSpeed: 0 }));
  assert.equal((await post(url)).res.status, 200);
  assert.equal((await post(url)).res.status, 200);
  const { res, text } = await post(url);
  assert.equal(res.status, 429);
  assert.ok(Number(res.headers.get('retry-after')) > 0);
  assert.equal(JSON.parse(text).code, 'rate_limited');
});

test('live: ключ в заголовке, не в URL; поток Gemini превращается в done', async () => {
  let seen;
  const fetchImpl = async (u, init) => {
    seen = { u, init };
    return geminiStream([...split(goodJson).map((t) => textChunk(t)), { candidates: [{ finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 400, thoughtsTokenCount: 0 } }]);
  };
  const url = await start(createHandler({ env: liveEnv, fetchImpl }));
  const ev = parseSse((await post(url)).text);
  assert.ok(!seen.u.includes('test-key'));
  assert.match(seen.u, /gemini-3\.5-flash-lite:streamGenerateContent\?alt=sse$/);
  assert.equal(seen.init.headers['x-goog-api-key'], 'test-key');
  const done = ev.at(-1);
  assert.equal(done.event, 'done');
  assert.deepEqual(done.data.post.hashtags, ['#кофе', '#осень', '#латте']);
  assert.deepEqual(done.data.usage, { in: 900, out: 400, thoughts: 0 });
});

test('части с thought: true не уходят клиенту', async () => {
  const fetchImpl = async () => geminiStream([{ candidates: [{ content: { parts: [{ text: 'размышляю', thought: true }, { text: goodJson }] } }] }]);
  const url = await start(createHandler({ env: liveEnv, fetchImpl }));
  const ev = parseSse((await post(url)).text);
  assert.ok(!ev.some((e) => e.event === 'delta' && e.data.text.includes('размышляю')));
  assert.equal(ev.at(-1).event, 'done');
});

test('повтор при 503 до первого delta', async () => {
  let calls = 0;
  const fetchImpl = async () => (++calls === 1 ? new Response('{}', { status: 503 }) : geminiStream([textChunk(goodJson)]));
  const url = await start(createHandler({ env: liveEnv, fetchImpl, sleep: async () => {} }));
  const ev = parseSse((await post(url)).text);
  assert.equal(calls, 2);
  assert.equal(ev.at(-1).event, 'done');
});

test('нет повтора после первого delta → error upstream_error', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; return geminiStream([textChunk('{"title":"Про'), textChunk('сто')], { failAfter: 1 }); };
  const url = await start(createHandler({ env: liveEnv, fetchImpl, sleep: async () => {} }));
  const ev = parseSse((await post(url)).text);
  assert.equal(calls, 1);
  assert.equal(ev.at(-1).event, 'error');
  assert.equal(ev.at(-1).data.code, 'upstream_error');
});

test('429 от Gemini после повтора → rate_limited', async () => {
  const fetchImpl = async () => new Response('{}', { status: 429 });
  const url = await start(createHandler({ env: liveEnv, fetchImpl, sleep: async () => {} }));
  const last = parseSse((await post(url)).text).at(-1);
  assert.equal(last.data.code, 'rate_limited');
  assert.equal(last.data.retryAfter, 30);
});

test('finishReason SAFETY → blocked_content; MAX_TOKENS + обрыв → truncated; мусор → bad_output', async () => {
  const cases = [
    [[textChunk('{"title":"x"', { finishReason: 'SAFETY' })], 'blocked_content'],
    [[{ promptFeedback: { blockReason: 'OTHER' } }], 'blocked_content'],
    [[textChunk('{"title":"x","body":"дл', { finishReason: 'MAX_TOKENS' })], 'truncated'],
    [[textChunk('не json', { finishReason: 'STOP' })], 'bad_output'],
    [[textChunk('{"title":"","body":"b","cta":"c","hashtags":[]}')], 'bad_output'],
  ];
  for (const [chunks, code] of cases) {
    const url = await start(createHandler({ env: liveEnv, fetchImpl: async () => geminiStream(chunks) }));
    assert.equal(parseSse((await post(url)).text).at(-1).data.code, code, code);
  }
});

test('400 от Gemini (неверный ключ) → upstream_error без повтора', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; return new Response(JSON.stringify({ error: { status: 'INVALID_ARGUMENT' } }), { status: 400 }); };
  const url = await start(createHandler({ env: liveEnv, fetchImpl, sleep: async () => {} }));
  assert.equal(parseSse((await post(url)).text).at(-1).data.code, 'upstream_error');
  assert.equal(calls, 1);
});

test('закрытие соединения клиентом прерывает запрос к Gemini', async () => {
  let upstreamSignal;
  const fetchImpl = async (u, init) => {
    upstreamSignal = init.signal;
    const enc = new TextEncoder();
    return new Response(new ReadableStream({
      start(ctrl) {
        ctrl.enqueue(enc.encode(`data: ${JSON.stringify(textChunk('{"title":"x'))}\n\n`));
        init.signal.addEventListener('abort', () => ctrl.error(new Error('aborted')));
      },
    }));
  };
  const url = await start(createHandler({ env: liveEnv, fetchImpl }));
  const ac = new AbortController();
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal: ac.signal });
  const reader = res.body.getReader();
  await reader.read(); // start
  ac.abort();
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(upstreamSignal.aborted, true);
});
