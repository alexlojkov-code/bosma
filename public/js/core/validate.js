// Проверка входных данных. Одинаковая на клиенте и сервере (SPEC §4.2).
import { PLATFORMS, LANGUAGES, TONES, ANGLES, TWEAKS, countChars } from './platforms.js';

export const INPUT_LIMITS = {
  business: { min: 20, max: 1500 },
  idea: { min: 5, max: 1000 },
};

const FIELD_NAMES = { business: 'Кто вы', idea: 'О чём пост' };

/** Убирает управляющие символы (кроме \n и \t) и приводит переводы строк к \n. */
export function cleanText(s) {
  return String(s)
    .replace(/\r\n?/g, '\n')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
}

/** Ошибка одного текстового поля формы или null. */
export function fieldError(name, value) {
  const { min, max } = INPUT_LIMITS[name];
  const n = countChars(cleanText(value ?? '').trim());
  if (n === 0) return 'Заполните это поле.';
  if (n < min) return `Слишком коротко: нужно хотя бы ${min} символов.`;
  if (n > max) return `Слишком длинно: максимум ${max} символов.`;
  return null;
}

function bad(field, message) {
  return { ok: false, field, message };
}

function cleanPrevious(prev) {
  if (prev === null || prev === undefined) return { ok: true, value: null };
  if (typeof prev !== 'object' || Array.isArray(prev)) return bad('previous', 'Неверный формат предыдущего варианта.');
  const out = {};
  for (const key of ['title', 'body', 'cta']) {
    const v = prev[key] ?? '';
    if (typeof v !== 'string' || countChars(v) > 5000) return bad('previous', 'Неверный формат предыдущего варианта.');
    out[key] = cleanText(v);
  }
  const tags = prev.hashtags ?? [];
  if (!Array.isArray(tags) || tags.length > 30 || tags.some((t) => typeof t !== 'string' || t.length > 100)) {
    return bad('previous', 'Неверный формат предыдущего варианта.');
  }
  out.hashtags = tags.map(cleanText);
  return { ok: true, value: out };
}

/** Полная проверка тела запроса /api/generate. → {ok:true, value} | {ok:false, field, message} */
export function validateRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return bad(null, 'Пустой запрос.');
  const value = {};

  for (const name of ['business', 'idea']) {
    if (typeof body[name] !== 'string') return bad(name, `Поле «${FIELD_NAMES[name]}»: заполните это поле.`);
    const err = fieldError(name, body[name]);
    if (err) return bad(name, `Поле «${FIELD_NAMES[name]}»: ${err.charAt(0).toLowerCase()}${err.slice(1)}`);
    value[name] = cleanText(body[name]).trim();
  }

  const enums = [
    ['platform', PLATFORMS],
    ['language', LANGUAGES],
    ['tone', TONES],
  ];
  for (const [name, dict] of enums) {
    if (typeof body[name] !== 'string' || !Object.hasOwn(dict, body[name])) return bad(name, `Неизвестное значение поля ${name}.`);
    value[name] = body[name];
  }
  if (!ANGLES.includes(body.angle)) return bad('angle', 'Неизвестный подход.');
  value.angle = body.angle;

  const tweak = body.tweak ?? null;
  if (tweak !== null && (typeof tweak !== 'string' || !Object.hasOwn(TWEAKS, tweak))) return bad('tweak', 'Неизвестная правка.');
  value.tweak = tweak;

  const prev = cleanPrevious(body.previous);
  if (!prev.ok) return prev;
  value.previous = prev.value;
  if (value.tweak && !value.previous) return bad('previous', 'Для правки нужен предыдущий вариант.');

  return { ok: true, value };
}
