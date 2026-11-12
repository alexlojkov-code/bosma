// Спайк этапа 0 (SPEC §13.2): реальные запросы к Gemini, 3 площадки × 3 подхода.
// Запуск: GEMINI_API_KEY=... node scripts/spike.mjs   (или ключ в .env)
// Печатает: время до первого куска, число кусков, порядок полей, разбор префиксов, thought-части, токены.
import { fileURLToPath } from 'node:url';
import { buildPrompt } from '../api/_lib/prompt.js';
import { buildBody, readChunk } from '../api/_lib/gemini.js';
import { parsePartial } from '../public/js/core/partial-json.js';

try { process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url))); } catch { /* нет .env */ }
const key = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
if (!key) {
  console.error('Нужен GEMINI_API_KEY (в окружении или в .env).');
  process.exit(1);
}

const base = {
  business: 'Кофейня у метро Ойбек в Ташкенте, своя обжарка, завтраки до полудня',
  idea: 'Осеннее меню: тыквенный латте и сырники, −20% до 30 ноября',
  language: 'ru',
  tone: 'auto',
  tweak: null,
  previous: null,
};

for (const platform of ['telegram', 'instagram', 'youtube']) {
  for (const angle of ['benefit', 'story', 'engagement']) {
    const input = { ...base, platform, angle };
    const started = Date.now();
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(buildBody(buildPrompt(input))),
    });
    if (!res.ok) {
      console.log(platform, angle, 'HTTP', res.status, (await res.text()).slice(0, 300));
      continue;
    }
    const state = { finishReason: null, usage: {} };
    let text = '';
    let chunks = 0;
    let ttfb = null;
    let thoughtParts = 0;
    let badPrefixes = 0;
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.search(/\r?\n\r?\n/)) !== -1) {
        const raw = buf.slice(0, i);
        buf = buf.slice(i).replace(/^\r?\n\r?\n/, '');
        const line = raw.split(/\r?\n/).find((l) => l.startsWith('data:'));
        if (!line) continue;
        const chunk = JSON.parse(line.slice(5));
        thoughtParts += (chunk.candidates?.[0]?.content?.parts || []).filter((p) => p.thought).length;
        const t = readChunk(chunk, state);
        if (t) {
          if (ttfb === null) ttfb = Date.now() - started;
          chunks++;
          text += t;
          if (!parsePartial(text)) badPrefixes++;
        }
      }
    }
    let keys = '';
    try {
      keys = Object.keys(JSON.parse(text)).join(',');
    } catch {
      keys = 'НЕВАЛИДНЫЙ JSON';
    }
    console.log(JSON.stringify({ platform, angle, ttfb_ms: ttfb, total_ms: Date.now() - started, chunks, keys, badPrefixes, thoughtParts, finish: state.finishReason, usage: state.usage }));
  }
}
