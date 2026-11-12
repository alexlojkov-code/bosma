// Нормализация поста после генерации (SPEC §5.5).
import { PLATFORMS, checkLimits } from '../../public/js/core/platforms.js';
import { normalizeHashtags } from '../../public/js/core/hashtags.js';
import { AppError } from './errors.js';

function tidy(s) {
  return String(s ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function tidyTitle(s) {
  let t = tidy(s).replace(/\n+/g, ' ');
  t = t.replace(/^\*\*(.*)\*\*$/s, '$1').replace(/^#+\s*/, '');
  t = t.replace(/^["«“„'](.*)["»”'“]$/s, '$1');
  return t.trim();
}

/** raw — объект из JSON модели. → { post, warnings } или AppError('bad_output'). */
export function postprocess(raw, platform) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new AppError('bad_output', { message: 'not an object' });
  const post = {
    title: tidyTitle(raw.title),
    body: tidy(raw.body),
    cta: tidy(raw.cta),
    hashtags: normalizeHashtags(raw.hashtags, PLATFORMS[platform].hashtags.max),
  };
  if (!post.title || !post.body || !post.cta) throw new AppError('bad_output', { message: 'empty required field' });
  return { post, warnings: checkLimits(post, platform) };
}
