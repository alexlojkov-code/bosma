import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatForCopy, checkLimits, countChars, warningText } from '../public/js/core/platforms.js';

const post = { title: 'Заголовок', body: 'Текст поста', cta: 'Пишите нам', hashtags: ['#a', '#b'] };

test('формат Telegram: жирный заголовок, хэштеги в конце', () => {
  assert.equal(formatForCopy(post, 'telegram'), '**Заголовок**\n\nТекст поста\n\nПишите нам\n\n#a #b');
});

test('формат Telegram без хэштегов заканчивается CTA', () => {
  assert.equal(formatForCopy({ ...post, hashtags: [] }, 'telegram'), '**Заголовок**\n\nТекст поста\n\nПишите нам');
});

test('формат Instagram: точки-разделители перед хэштегами', () => {
  assert.equal(formatForCopy(post, 'instagram'), 'Заголовок\n\nТекст поста\n\nПишите нам\n\n.\n.\n\n#a #b');
  assert.equal(formatForCopy({ ...post, hashtags: [] }, 'instagram'), 'Заголовок\n\nТекст поста\n\nПишите нам');
});

test('формат YouTube: подписи заголовка и описания', () => {
  assert.equal(formatForCopy(post, 'youtube'), 'Заголовок: Заголовок\n\nОписание:\nТекст поста\n\nПишите нам\n\n#a #b');
});

test('countChars считает кодпоинты', () => {
  assert.equal(countChars('абв'), 3);
  assert.equal(countChars('🔥'), 1);
  assert.equal(countChars(''), 0);
});

test('checkLimits: soft и hard', () => {
  assert.deepEqual(checkLimits(post, 'telegram'), []);
  const soft = checkLimits({ ...post, body: 'я'.repeat(1600) }, 'instagram');
  assert.equal(soft[0].level, 'soft');
  assert.equal(soft[0].limit, 1500);
  const hard = checkLimits({ ...post, body: 'я'.repeat(2300) }, 'instagram');
  assert.equal(hard[0].level, 'hard');
  assert.equal(hard[0].limit, 2200);
  assert.match(warningText(hard[0], 'instagram'), /Не поместится в Instagram/);
});

test('checkLimits: заголовок YouTube — жёсткий лимит, хэштегов меньше минимума', () => {
  const w = checkLimits({ ...post, title: 'я'.repeat(101), hashtags: [] }, 'youtube');
  assert.ok(w.some((x) => x.field === 'title' && x.level === 'hard'));
  assert.ok(w.some((x) => x.field === 'hashtags' && x.level === 'soft'));
});
