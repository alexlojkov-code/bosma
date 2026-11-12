// Нормализация хэштегов (SPEC §5.5).

export function normalizeHashtag(raw) {
  const word = String(raw).replace(/[^\p{L}\p{N}_]/gu, '');
  return word ? `#${word}` : '';
}

export function normalizeHashtags(list, max = Infinity) {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(list) ? list : []) {
    if (typeof raw !== 'string') continue;
    // Модель иногда кладёт несколько тегов в одну строку: «#кофе #ташкент».
    for (const part of raw.split(/[\s,]+/)) {
      const tag = normalizeHashtag(part);
      const key = tag.toLocaleLowerCase();
      if (!tag || seen.has(key)) continue;
      seen.add(key);
      out.push(tag);
      if (out.length >= max) return out;
    }
  }
  return out;
}
