import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeHashtags } from '../public/js/core/hashtags.js';

test('добавляет #, убирает пробелы и знаки', () => {
  assert.deepEqual(normalizeHashtags(['кофе', '#ташкент', 'утро в городе', '#100%']), ['#кофе', '#ташкент', '#утро', '#в', '#городе', '#100']);
});

test('дубли без учёта регистра', () => {
  assert.deepEqual(normalizeHashtags(['#Кофе', 'кофе', '#КОФЕ']), ['#Кофе']);
});

test('узбекская латиница и подчёркивание', () => {
  assert.deepEqual(normalizeHashtags(['o‘quv_markaz', 'Toshkent']), ['#oquv_markaz', '#Toshkent']);
});

test('несколько тегов в одной строке и обрезка до max', () => {
  assert.deepEqual(normalizeHashtags(['#a #b, #c', '#d'], 3), ['#a', '#b', '#c']);
});

test('мусор игнорируется', () => {
  assert.deepEqual(normalizeHashtags(['#', '  ', 5, null, '!!!']), []);
  assert.deepEqual(normalizeHashtags('не массив'), []);
});
