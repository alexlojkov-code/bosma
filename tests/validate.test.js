import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRequest, fieldError, cleanText } from '../public/js/core/validate.js';

const ok = {
  business: 'Кофейня у метро, своя обжарка, завтраки',
  idea: 'Осеннее меню',
  platform: 'instagram',
  language: 'ru',
  tone: 'auto',
  angle: 'benefit',
  tweak: null,
  previous: null,
};

test('валидный запрос проходит', () => {
  const r = validateRequest(ok);
  assert.equal(r.ok, true);
  assert.equal(r.value.platform, 'instagram');
});

test('границы длины business: 19 нельзя, 20 можно, 1500 можно, 1501 нельзя', () => {
  assert.equal(validateRequest({ ...ok, business: 'я'.repeat(19) }).ok, false);
  assert.equal(validateRequest({ ...ok, business: 'я'.repeat(20) }).ok, true);
  assert.equal(validateRequest({ ...ok, business: 'я'.repeat(1500) }).ok, true);
  const r = validateRequest({ ...ok, business: 'я'.repeat(1501) });
  assert.equal(r.ok, false);
  assert.equal(r.field, 'business');
});

test('trim учитывается при подсчёте', () => {
  assert.equal(validateRequest({ ...ok, idea: '   abcd   ' }).ok, false);
  assert.equal(validateRequest({ ...ok, idea: '   abcde  ' }).value.idea, 'abcde');
});

test('управляющие символы удаляются, переводы строк нормализуются', () => {
  assert.equal(cleanText('a\u0000b\r\nc\u0007'), 'ab\nc');
});

test('неизвестные значения enum отклоняются', () => {
  for (const [k, v] of [['platform', 'tiktok'], ['language', 'de'], ['tone', 'angry'], ['angle', 'x'], ['tweak', 'bigger']]) {
    const r = validateRequest({ ...ok, [k]: v });
    assert.equal(r.ok, false, k);
    assert.equal(r.field, k);
  }
});

test('tweak без previous отклоняется', () => {
  const r = validateRequest({ ...ok, tweak: 'shorter' });
  assert.equal(r.ok, false);
  assert.equal(r.field, 'previous');
});

test('previous проверяется по формату', () => {
  const prev = { title: 't', body: 'b', cta: 'c', hashtags: ['#a'] };
  assert.equal(validateRequest({ ...ok, tweak: 'shorter', previous: prev }).ok, true);
  assert.equal(validateRequest({ ...ok, previous: { ...prev, hashtags: 'x' } }).ok, false);
  assert.equal(validateRequest({ ...ok, previous: { ...prev, body: 'я'.repeat(5001) } }).ok, false);
});

test('fieldError даёт понятные тексты', () => {
  assert.match(fieldError('business', ''), /Заполните/);
  assert.match(fieldError('business', 'коротко'), /хотя бы 20/);
  assert.equal(fieldError('idea', 'нормальная идея'), null);
});

test('не объект → ошибка', () => {
  assert.equal(validateRequest(null).ok, false);
  assert.equal(validateRequest([1]).ok, false);
});
