// Разбор незаконченного JSON во время стриминга (SPEC §7.2).

const KEY_RE = /(?<!\\)"(title|body|cta|hashtags)"\s*:/g;

/** Достраивает префикс JSON до валидного текста или возвращает null. */
export function completeJson(text) {
  const s = String(text).trimStart();
  if (!s.startsWith('{')) return null;

  const stack = [];
  let inStr = false;
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{' || c === '[') stack.push(c);
    else if (c === '}' || c === ']') stack.pop();
  }

  let out = s;
  if (inStr) {
    if (esc) out = out.slice(0, -1); // одинокий «\» в конце
    else out = out.replace(/\\u[0-9a-fA-F]{0,3}$/, ''); // незаконченный \uXXXX
    out += '"';
  }

  const top = stack[stack.length - 1];
  out = out.replace(/[\s,]+$/, '');
  if (/:\s*$/.test(out)) {
    // «"body":» без значения — убираем ключ целиком
    out = out.replace(/,?\s*"(?:[^"\\]|\\.)*"\s*:\s*$/, '');
  } else if (top === '{') {
    // «{"title":"x","bo» — ключ без двоеточия
    out = out.replace(/([{,])\s*"(?:[^"\\]|\\.)*"$/, '$1');
  }
  out = out.replace(/[\s,]+$/, '');

  for (let i = stack.length - 1; i >= 0; i--) out += stack[i] === '{' ? '}' : ']';
  return out;
}

/**
 * → { value, key } где value — разобранный объект, key — поле, которое сейчас пишется.
 * null, если префикс пока не разбирается.
 */
export function parsePartial(text) {
  const completed = completeJson(text);
  if (completed === null) return null;
  let value;
  try {
    value = JSON.parse(completed);
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  let key = null;
  for (const m of String(text).matchAll(KEY_RE)) key = m[1];
  return { value, key };
}
