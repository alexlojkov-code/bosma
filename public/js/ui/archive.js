// Экран «Архив»: поиск, фильтры, отметки, удаление с отменой, копирование (SPEC §9.5, DESIGN §7.3).
import { PLATFORMS, ANGLE_LABELS, formatForCopy } from '../core/platforms.js';
import { copyText } from '../clipboard.js';
import * as motion from './motion.js';

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const COPY_ICON = 'M8 8h12v12H8z M4 16V4h12';

function icon(d) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', d);
  svg.append(p);
  return svg;
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function formatDate(iso) {
  const d = new Date(iso);
  const now = new Date();
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const sameDay = d.toDateString() === now.toDateString();
  const day = sameDay ? 'сегодня' : `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return { day, time, label: sameDay ? `сегодня, ${time}` : `${d.getDate()} ${MONTHS[d.getMonth()]}, ${time}` };
}

export function createArchive({ store, toast, announce }) {
  const list = document.getElementById('archive-list');
  const empty = document.getElementById('archive-empty');
  const emptyText = document.getElementById('archive-empty-text');
  const search = document.getElementById('archive-search');
  const filters = document.getElementById('archive-filters');
  const clearBtn = document.getElementById('archive-clear');
  const open = new Set();
  let filter = 'all';
  let query = '';

  let searchTimer = 0;
  search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      query = search.value.trim().toLocaleLowerCase();
      render();
    }, 150);
  });

  filters.addEventListener('click', (e) => {
    const b = e.target.closest('[data-filter]');
    if (!b) return;
    filter = b.dataset.filter;
    filters.querySelectorAll('[data-filter]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    render();
  });

  clearBtn.addEventListener('click', () => {
    const ok = confirm('Удалить все посты из архива, включая отмеченные? Отменить это будет нельзя.');
    if (!ok) return;
    store.clear();
    open.clear();
    toast('Архив очищен');
  });

  function matches(item) {
    if (filter === 'starred' && !item.starred) return false;
    if (filter !== 'all' && filter !== 'starred' && item.platform !== filter) return false;
    if (!query) return true;
    const p = item.post;
    return [p.title, p.body, p.cta, item.idea].join('\n').toLocaleLowerCase().includes(query);
  }

  async function copy(item) {
    const r = await copyText(formatForCopy(item.post, item.platform));
    if (r === 'ok') {
      navigator.vibrate?.(10);
      toast('Скопировано');
    }
  }

  async function remove(item, li) {
    await motion.collapse(li);
    const removed = store.remove(item.id);
    if (!removed) return;
    open.delete(item.id);
    toast('Удалено', {
      actionLabel: 'Вернуть',
      duration: 5000,
      onAction: () => {
        store.restore(removed.item, removed.index);
        announce('Пост возвращён');
      },
    });
  }

  function entry(item) {
    const li = el('li', 'entry');
    li.dataset.platform = item.platform;
    li.dataset.id = item.id;
    const date = formatDate(item.createdAt);
    const isOpen = open.has(item.id);

    const row = el('div', 'entry-row');
    const dateEl = el('span', 'entry-date');
    dateEl.append(date.day, document.createElement('br'), date.time);
    const bar = el('span', 'entry-bar');
    bar.setAttribute('aria-hidden', 'true');

    const openBtn = el('button', 'entry-open');
    openBtn.type = 'button';
    openBtn.setAttribute('aria-expanded', String(isOpen));
    const title = el('span', 'entry-title');
    if (item.starred) {
      const star = el('span', 'entry-star', '★ ');
      star.setAttribute('aria-label', 'Отмечено: ');
      title.append(star);
    }
    title.append(item.post.title || 'Без заголовка');
    openBtn.append(
      title,
      el('span', 'entry-preview', item.post.body),
      el('span', 'entry-meta', `${PLATFORMS[item.platform]?.label || item.platform}, ${ANGLE_LABELS[item.angle] || ''}`.replace(/, $/, '')),
    );
    openBtn.addEventListener('click', () => {
      if (open.has(item.id)) open.delete(item.id);
      else open.add(item.id);
      render();
      list.querySelector(`[data-id="${CSS.escape(item.id)}"] .entry-open`)?.focus();
    });

    const copyBtn = el('button', 'entry-copy');
    copyBtn.type = 'button';
    copyBtn.setAttribute('aria-label', `Копировать пост «${item.post.title}»`);
    copyBtn.append(icon(COPY_ICON));
    copyBtn.addEventListener('click', () => copy(item));

    row.append(dateEl, bar, openBtn, copyBtn);
    li.append(row);

    if (isOpen) {
      const full = el('div', 'entry-full');
      full.append(el('pre', '', formatForCopy(item.post, item.platform)));
      const actions = el('div', 'entry-actions');
      const star = el('button', 'btn-text', item.starred ? 'Снять отметку' : 'Отметить');
      star.type = 'button';
      star.setAttribute('aria-pressed', String(Boolean(item.starred)));
      star.addEventListener('click', () => store.update(item.id, { starred: !item.starred }));
      const del = el('button', 'btn-text danger', 'Удалить');
      del.type = 'button';
      del.addEventListener('click', () => remove(item, li));
      const cp = el('button', 'btn btn--primary btn--small', 'Копировать');
      cp.type = 'button';
      cp.addEventListener('click', () => copy(item));
      actions.append(cp, star, del);
      full.append(actions);
      li.append(full);
    }
    return li;
  }

  function render() {
    const all = store.history();
    const items = all.filter(matches);
    list.replaceChildren(...items.map(entry));
    const none = items.length === 0;
    empty.hidden = !none;
    empty.querySelector('.empty-word').hidden = all.length > 0;
    empty.querySelector('.btn').hidden = all.length > 0;
    emptyText.textContent = all.length === 0
      ? (store.available ? 'Здесь будут все написанные посты.' : 'Архив не сохраняется в этом режиме браузера.')
      : 'Ничего не нашлось. Измените поиск или фильтр.';
    clearBtn.hidden = all.length === 0;
  }

  store.subscribe(render);
  render();
  return { render, focus: () => search.focus() };
}
