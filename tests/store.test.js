import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, HISTORY_KEY, HISTORY_LIMIT } from '../public/js/store.js';

function memoryStorage({ quotaAt = Infinity } = {}) {
  const data = new Map();
  return {
    data,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem(k, v) {
      if (String(v).length > quotaAt) {
        const e = new Error('quota');
        e.name = 'QuotaExceededError';
        throw e;
      }
      data.set(k, String(v));
    },
    removeItem: (k) => data.delete(k),
  };
}

const item = (i, extra = {}) => ({ id: `id${i}`, createdAt: new Date(2026, 10, 12, 0, i).toISOString(), platform: 'telegram', post: { title: `t${i}`, body: 'b', cta: 'c', hashtags: [] }, starred: false, ...extra });

test('новые записи — в начале, переживают пересоздание стора', () => {
  const s = memoryStorage();
  const a = createStore(s);
  a.add(item(1));
  a.add(item(2));
  assert.deepEqual(a.history().map((h) => h.id), ['id2', 'id1']);
  assert.deepEqual(createStore(s).history().map((h) => h.id), ['id2', 'id1']);
});

test(`больше ${HISTORY_LIMIT} → удаляются самые старые без звёздочки`, () => {
  const st = createStore(memoryStorage());
  st.add(item(0, { starred: true })); // самая старая, но отмечена
  for (let i = 1; i <= HISTORY_LIMIT; i++) st.add(item(i));
  const h = st.history();
  assert.equal(h.length, HISTORY_LIMIT);
  assert.ok(h.some((x) => x.id === 'id0'), 'отмеченная осталась');
  assert.ok(!h.some((x) => x.id === 'id1'), 'самая старая без звёздочки удалена');
});

test('QuotaExceededError → удаляем 20 старых и пробуем ещё раз', () => {
  const s = memoryStorage();
  const st = createStore(s);
  for (let i = 0; i < 40; i++) st.add(item(i));
  const size = s.getItem(HISTORY_KEY).length;
  s.setItem = ((orig) => (k, v) => {
    if (String(v).length > size) {
      const e = new Error('quota');
      e.name = 'QuotaExceededError';
      throw e;
    }
    orig(k, v);
  })(s.setItem.bind(s));
  const r = st.add(item(99));
  assert.equal(r.ok, true);
  assert.equal(st.history()[0].id, 'id99');
  assert.equal(st.history().length, 21);
});

test('испорченный JSON → пустой архив, копия сохранена', () => {
  const s = memoryStorage();
  s.setItem(HISTORY_KEY, '{не json');
  const st = createStore(s);
  assert.deepEqual(st.history(), []);
  assert.equal(s.getItem('spg.history.corrupt'), '{не json');
});

test('удаление и возврат на прежнее место', () => {
  const st = createStore(memoryStorage());
  [1, 2, 3].forEach((i) => st.add(item(i)));
  const removed = st.remove('id2');
  assert.deepEqual(st.history().map((h) => h.id), ['id3', 'id1']);
  st.restore(removed.item, removed.index);
  assert.deepEqual(st.history().map((h) => h.id), ['id3', 'id2', 'id1']);
});

test('без хранилища всё работает в памяти', () => {
  const st = createStore(null);
  assert.equal(st.available, false);
  st.add(item(1));
  assert.equal(st.history().length, 1);
  assert.deepEqual(st.loadPrefs(), {});
});
