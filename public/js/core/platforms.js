// Правила площадок, лимиты и форматы копирования. Общий код клиента и сервера (SPEC §3.3).

export const PLATFORMS = {
  telegram: {
    label: 'Telegram',
    limits: { title: 120, titleLevel: 'soft', total: { target: 1000, hard: 4096 } },
    hashtags: { min: 0, max: 3 },
    rules: [
      'Пост для Telegram-канала.',
      'Заголовок — одна короткая строка без эмодзи в начале, до 120 символов.',
      'Текст — короткие абзацы по 1–3 предложения, можно списки с эмодзи-маркерами.',
      'Весь пост вместе с CTA и хэштегами — не длиннее 1000 символов, чтобы поместиться в подпись к фото.',
      'Хэштеги: 0–3, только если они уместны.',
      'CTA: подписаться, написать в личные сообщения или перейти по ссылке.',
    ],
    format: (p) => joinBlocks([p.title && `**${p.title}**`, p.body, p.cta, p.hashtags.join(' ')]),
  },
  instagram: {
    label: 'Instagram',
    limits: { title: 125, titleLevel: 'soft', total: { target: 1500, hard: 2200 } },
    hashtags: { min: 3, max: 5 },
    rules: [
      'Подпись к посту или Reels в Instagram.',
      'Заголовок — цепляющий хук до 125 символов: только он виден до «ещё».',
      'Текст — живой, короткие абзацы, эмодзи умеренно.',
      'Весь пост — не длиннее 1500 символов.',
      'Хэштеги: 3–5, релевантные нише и городу, если он указан.',
      'Ссылки в подписи не кликабельны: CTA — «ссылка в профиле» или «пишите в Direct».',
    ],
    format: (p) => joinBlocks([p.title, p.body, p.cta, p.hashtags.length ? '.\n.' : '', p.hashtags.join(' ')]),
  },
  youtube: {
    label: 'YouTube',
    limits: { title: 100, titleLevel: 'hard', total: { target: 1500, hard: 5000 } },
    hashtags: { min: 3, max: 5 },
    rules: [
      'Название и описание видео на YouTube.',
      'Заголовок — название видео до 100 символов, ключевые слова в начале, без обманного кликбейта.',
      'Текст — описание видео: первые 2 строки — о чём видео и зачем смотреть, дальше — подробности.',
      'Описание — не длиннее 1500 символов.',
      'Хэштеги: 3–5.',
      'CTA: подписаться, поставить лайк, написать комментарий.',
    ],
    format: (p) => joinBlocks([p.title && `Заголовок: ${p.title}`, p.body && `Описание:\n${p.body}`, p.cta, p.hashtags.join(' ')]),
  },
};

export const LANGUAGES = { ru: 'Русский', uz: 'O‘zbek (бета)', en: 'English' };
export const TONES = {
  auto: 'Подберите сами',
  friendly: 'Дружелюбный',
  expert: 'Экспертный',
  selling: 'Продающий',
  neutral: 'Нейтральный',
};
export const ANGLES = ['benefit', 'story', 'engagement'];
export const ANGLE_LABELS = { benefit: 'Выгода', story: 'История', engagement: 'Вовлечение' };
export const TWEAKS = {
  shorter: 'Короче',
  longer: 'Длиннее',
  more_emoji: 'Больше эмодзи',
  no_emoji: 'Без эмодзи',
  new_cta: 'Другой призыв',
};
export const FIELDS = ['title', 'body', 'cta', 'hashtags'];

export function joinBlocks(blocks) {
  return blocks.map((b) => (b || '').trim()).filter(Boolean).join('\n\n');
}

/** Длина в кодпоинтах: эмодзи считается 1–2, как в редакторах соцсетей. */
export function countChars(s) {
  return [...(s || '')].length;
}

export function emptyPost() {
  return { title: '', body: '', cta: '', hashtags: [] };
}

export function coercePost(p) {
  const src = p && typeof p === 'object' ? p : {};
  return {
    title: typeof src.title === 'string' ? src.title : '',
    body: typeof src.body === 'string' ? src.body : '',
    cta: typeof src.cta === 'string' ? src.cta : '',
    hashtags: Array.isArray(src.hashtags) ? src.hashtags.filter((h) => typeof h === 'string') : [],
  };
}

export function formatForCopy(post, platform) {
  return PLATFORMS[platform].format(coercePost(post));
}

/** Предупреждения о длине (SPEC §5.5). Текст никогда не обрезается. */
export function checkLimits(post, platform) {
  const cfg = PLATFORMS[platform];
  const p = coercePost(post);
  const warnings = [];
  const total = countChars(formatForCopy(p, platform));
  if (total > cfg.limits.total.hard) {
    warnings.push({ field: 'total', level: 'hard', limit: cfg.limits.total.hard, actual: total });
  } else if (total > cfg.limits.total.target) {
    warnings.push({ field: 'total', level: 'soft', limit: cfg.limits.total.target, actual: total });
  }
  const title = countChars(p.title);
  if (title > cfg.limits.title) {
    warnings.push({ field: 'title', level: cfg.limits.titleLevel, limit: cfg.limits.title, actual: title });
  }
  if (p.hashtags.length < cfg.hashtags.min) {
    warnings.push({ field: 'hashtags', level: 'soft', limit: cfg.hashtags.min, actual: p.hashtags.length });
  }
  return warnings;
}

/** Человекочитаемый текст предупреждения (DESIGN §8.6). */
export function warningText(w, platform) {
  const name = PLATFORMS[platform].label;
  if (w.field === 'total' && w.level === 'hard') {
    return `Не поместится в ${name}: ${w.actual} из ${w.limit}. Нажмите «Короче».`;
  }
  if (w.field === 'total') return `Длиннее рекомендованного для ${name}: ${w.actual} из ${w.limit}.`;
  if (w.field === 'title' && w.level === 'hard') {
    return `Заголовок длиннее лимита ${name}: ${w.actual} из ${w.limit}.`;
  }
  if (w.field === 'title') return `Заголовок длинноват: ${w.actual} из ${w.limit}.`;
  return `Хэштегов меньше рекомендованного: ${w.actual} из ${w.limit}.`;
}
