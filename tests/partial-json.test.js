import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePartial, completeJson } from '../public/js/core/partial-json.js';

const full = JSON.stringify({
  title: 'Скидка 20% — «до конца» ноября 🔥',
  body: 'Строка 1\nСтрока 2 \\ слэш и символ',
  cta: 'Пишите в Direct',
  hashtags: ['#кофе', '#ташкент'],
});

test('каждый префикс полного JSON либо разбирается, либо null — и никогда не бросает', () => {
  let last = null;
  for (let i = 1; i <= full.length; i++) {
    const r = parsePartial(full.slice(0, i));
    if (r) {
      assert.equal(typeof r.value, 'object');
      last = r;
    }
  }
  assert.deepEqual(last.value, JSON.parse(full));
});

test('обрыв внутри строки значения', () => {
  const r = parsePartial('{"title":"Скидка 20%","body":"Только в ноя');
  assert.deepEqual(r.value, { title: 'Скидка 20%', body: 'Только в ноя' });
  assert.equal(r.key, 'body');
});

test('обрыв внутри ключа и после двоеточия', () => {
  assert.deepEqual(parsePartial('{"title":"x","bo').value, { title: 'x' });
  assert.deepEqual(parsePartial('{"title":"x","body":').value, { title: 'x' });
  assert.deepEqual(parsePartial('{"title":"x",').value, { title: 'x' });
  assert.deepEqual(parsePartial('{"title"').value, {});
  assert.equal(parsePartial('{"title":"x","bo').key, 'title');
});

test('обрыв внутри массива хэштегов', () => {
  assert.deepEqual(parsePartial('{"hashtags":["#a","#b').value, { hashtags: ['#a', '#b'] });
  assert.deepEqual(parsePartial('{"hashtags":["#a",').value, { hashtags: ['#a'] });
  assert.deepEqual(parsePartial('{"hashtags":[').value, { hashtags: [] });
});

test('незаконченные escape-последовательности', () => {
  assert.deepEqual(parsePartial('{"title":"a\\').value, { title: 'a' });
  assert.deepEqual(parsePartial('{"title":"a\\u04').value, { title: 'a' });
  assert.deepEqual(parsePartial('{"title":"a\\"b').value, { title: 'a"b' });
  assert.deepEqual(parsePartial('{"title":"a\\n').value, { title: 'a\n' });
});

test('ключ внутри текста не путается с настоящим', () => {
  const r = parsePartial('{"title":"x","body":"Пишем \\"cta\\": так');
  assert.equal(r.key, 'body');
});

test('мусор → null', () => {
  assert.equal(parsePartial(''), null);
  assert.equal(parsePartial('hello'), null);
  assert.equal(completeJson('[1,2'), null);
});

test('эмодзи и суррогатные пары не ломают разбор', () => {
  const s = JSON.stringify({ title: '👩‍💻 Работа 🚀' });
  for (let i = 1; i <= s.length; i++) parsePartial(s.slice(0, i));
  assert.equal(parsePartial(s).value.title, '👩‍💻 Работа 🚀');
});
