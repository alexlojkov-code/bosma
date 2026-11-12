// Три гранки: параллельные запросы, перегенерация, правки, остановка (SPEC §7.5).
import { ANGLES, ANGLE_LABELS } from '../core/platforms.js';
import { errorText } from '../core/messages.js';
import { streamGenerate } from '../api.js';
import { Sheet } from './sheet.js';
import * as motion from './motion.js';

function uuid() {
  return crypto.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createVariants({ resultsEl, stackEl, tabsEl, store, announce, toast, onChange }) {
  const sheets = new Map();
  const runs = new Map();
  let input = null;
  let generationId = null;

  const handlers = {
    onRegen: (sheet) => {
      if (!input) return;
      const previous = sheet.post && sheet.post.title ? sheet.post : null;
      motion.swapSheet(sheet.el, () => run(sheet, { previous }));
    },
    onRetry: (sheet) => run(sheet, sheet.lastExtra || {}),
    onTweak: (sheet, tweak) => {
      const previous = sheet.currentPost();
      if (!input || !previous.title) return;
      motion.proofmark(sheet.proofSvg, sheet.proofPath(tweak), sheet.el, () => run(sheet, { tweak, previous }));
    },
    onAnnounce: (t) => announce(t),
  };

  ANGLES.forEach((angle, i) => {
    const sheet = new Sheet({ angle, index: i, handlers });
    sheets.set(angle, sheet);
    stackEl.append(sheet.el);

    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'tab';
    tab.id = `tab-${angle}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', sheet.el.id);
    tab.setAttribute('aria-selected', String(i === 0));
    tab.textContent = ANGLE_LABELS[angle];
    tab.addEventListener('click', () => scrollToSheet(angle));
    tabsEl.append(tab);
  });

  function scrollToSheet(angle) {
    const el = sheets.get(angle).el;
    const gutter = parseFloat(getComputedStyle(stackEl).scrollPaddingInlineStart) || 16;
    stackEl.scrollTo({ left: el.offsetLeft - gutter, behavior: motion.reduced() ? 'auto' : 'smooth' });
    selectTab(angle);
  }

  function selectTab(angle) {
    tabsEl.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-selected', String(t.id === `tab-${angle}`)));
  }

  let scrollRaf = 0;
  stackEl.addEventListener('scroll', () => {
    if (scrollRaf) return;
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = 0;
      let best = null;
      let bestDist = Infinity;
      for (const [angle, s] of sheets) {
        const d = Math.abs(s.el.offsetLeft - stackEl.scrollLeft - 16);
        if (d < bestDist) {
          bestDist = d;
          best = angle;
        }
      }
      if (best) selectTab(best);
    });
  }, { passive: true });

  function run(sheet, extra = {}) {
    const angle = sheet.angle;
    const ctrl = new AbortController();
    const old = runs.get(angle);
    runs.set(angle, ctrl);
    old?.abort();

    sheet.lastExtra = extra;
    const payload = { ...input, angle, tweak: extra.tweak || null, previous: extra.previous || null };
    sheet.start(input.platform);
    onChange();

    const snapshot = { ...input };
    const gen = generationId;
    streamGenerate(payload, {
      signal: ctrl.signal,
      onDelta: (t) => {
        if (runs.get(angle) === ctrl) sheet.delta(t);
      },
      onDone: (data) => {
        if (runs.get(angle) !== ctrl) return;
        runs.delete(angle);
        sheet.done(data);
        save(sheet, snapshot, gen);
        announce(`Вариант ${sheet.index + 1} готов`);
        onChange();
      },
      onError: (err) => {
        if (runs.get(angle) !== ctrl) return;
        runs.delete(angle);
        sheet.fail(err);
        if (err.code !== 'aborted') announce(`Вариант ${sheet.index + 1}: ${errorText(err.code, err.retryAfter)}`);
        onChange();
      },
    });
  }

  function save(sheet, snapshot, gen) {
    const r = store.add({
      id: uuid(),
      generationId: gen,
      createdAt: new Date().toISOString(),
      platform: snapshot.platform,
      language: snapshot.language,
      tone: snapshot.tone,
      angle: sheet.angle,
      idea: snapshot.idea,
      post: sheet.post,
      starred: false,
    });
    if (!r.ok && r.reason === 'quota') toast('Память браузера заполнена, удалите часть архива.');
  }

  return {
    generateAll(values) {
      input = { ...values };
      generationId = uuid();
      const first = resultsEl.hidden;
      resultsEl.hidden = false;
      for (const sheet of sheets.values()) run(sheet);
      motion.sheetsIn([...sheets.values()].map((s) => s.el));
      if (first || stackEl.scrollLeft > 0) {
        stackEl.scrollLeft = 0;
        selectTab(ANGLES[0]);
      }
    },
    stopAll() {
      for (const ctrl of runs.values()) ctrl.abort();
    },
    isStreaming: () => runs.size > 0,
    hasResults: () => !resultsEl.hidden,
  };
}
