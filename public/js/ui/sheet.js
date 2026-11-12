// Одна гранка: набор текста, приводка, состояния, действия (SPEC §7.3–7.4, DESIGN §8.5, D3/D6/D7/D8).
import { parsePartial } from '../core/partial-json.js';
import { FIELDS, ANGLE_LABELS, PLATFORMS, checkLimits, countChars, formatForCopy, coercePost, warningText } from '../core/platforms.js';
import { errorText } from '../core/messages.js';
import { copyText } from '../clipboard.js';
import * as motion from './motion.js';

const STATUS = {
  title: 'Набираю заголовок',
  body: 'Набираю текст',
  cta: 'Набираю призыв',
  hashtags: 'Подбираю хэштеги',
};

const COPIED = {
  title: 'Заголовок скопирован',
  body: 'Текст скопирован',
  cta: 'Призыв скопирован',
  hashtags: 'Хэштеги скопированы',
};

function fieldText(value, field) {
  if (!value) return '';
  if (field === 'hashtags') return Array.isArray(value.hashtags) ? value.hashtags.filter((h) => typeof h === 'string').join(' ') : '';
  return typeof value[field] === 'string' ? value[field] : '';
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export class Sheet {
  constructor({ angle, index, handlers }) {
    const tpl = document.getElementById('sheet-template');
    this.el = tpl.content.firstElementChild.cloneNode(true);
    this.angle = angle;
    this.index = index;
    this.handlers = handlers;
    this.platform = 'telegram';
    this.state = 'idle';
    this.buffer = '';
    this.post = null;
    this.key = null;
    this.raf = 0;
    this.warnKeys = new Set();
    this.countdown = 0;

    const q = (s) => this.el.querySelector(s);
    this.el.classList.add(`sheet--${angle}`);
    this.el.id = `sheet-${angle}`;
    this.el.setAttribute('role', 'tabpanel');
    this.el.setAttribute('aria-labelledby', `tab-${angle}`);
    q('.sheet-angle').textContent = `Вариант ${index + 1}. ${ANGLE_LABELS[angle]}`;

    this.f = {};
    for (const field of FIELDS) {
      const wrap = q(`.field--${field}`);
      this.f[field] = { wrap, text: wrap.querySelector('h3, p'), ink: wrap.querySelector('.ink'), shown: '' };
    }
    this.caret = document.createElement('span');
    this.caret.className = 'caret';
    this.caret.setAttribute('aria-hidden', 'true');

    this.statusEl = q('.sheet-status');
    this.countEl = q('.sheet-count');
    this.warnEl = q('.warnings');
    this.errorBox = q('.sheet-error');
    this.errorTextEl = q('.sheet-error-text');
    this.retryBtn = q('.retry');
    this.copyBtn = q('.copy');
    this.regenBtn = q('.regen');
    this.stampEl = q('.stamp--copied');
    this.paperEl = q('.sheet-paper');
    this.proofSvg = q('.proofmark');

    this.copyBtn.addEventListener('click', () => this.copy());
    this.regenBtn.addEventListener('click', () => this.handlers.onRegen(this));
    this.retryBtn.addEventListener('click', () => this.handlers.onRetry(this));
    this.el.querySelectorAll('[data-tweak]').forEach((b) => b.addEventListener('click', () => this.handlers.onTweak(this, b.dataset.tweak)));
    this.el.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', () => this.copyField(b.dataset.copy)));

    this.setState('idle');
  }

  // ---------- жизненный цикл ----------

  start(platform) {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.stopCountdown();
    this.platform = platform;
    this.buffer = '';
    this.post = null;
    this.key = null;
    for (const field of FIELDS) {
      const f = this.f[field];
      f.ink.textContent = '';
      f.shown = '';
      f.wrap.classList.remove('is-misreg');
    }
    delete this.f.title.text.dataset.q;
    this.caret.remove();
    this.errorBox.hidden = true;
    this.warnEl.replaceChildren();
    this.warnKeys.clear();
    this.countEl.textContent = '';
    this.el.dataset.waiting = '';
    this.statusEl.textContent = STATUS.title;
    this.setState('streaming');
  }

  delta(text) {
    if (this.state !== 'streaming') return;
    this.buffer += text;
    if (!this.raf) {
      this.raf = requestAnimationFrame(() => {
        this.raf = 0;
        this.render();
      });
    }
  }

  render() {
    const r = parsePartial(this.buffer);
    if (!r) return;
    const { value, key } = r;
    let any = false;
    for (const field of FIELDS) {
      const s = fieldText(value, field);
      if (s) any = true;
      this.write(field, s);
    }
    if (any) delete this.el.dataset.waiting;

    if (key !== this.key) {
      if (this.key) this.settleField(this.key);
      this.key = key;
    }
    if (key) {
      this.f[key].wrap.classList.add('is-misreg');
      this.f[key].text.append(this.caret);
      this.statusEl.textContent = STATUS[key];
    }
    this.updateCount(coercePost(value));
  }

  write(field, s) {
    const f = this.f[field];
    if (s === f.shown) return;
    if (s.startsWith(f.shown)) {
      const add = s.slice(f.shown.length);
      const span = document.createElement('span');
      span.textContent = add;
      f.ink.append(span);
      f.shown = s;
      motion.typeIn(span, cssVar('--ink-text')).then(() => {
        if (span.isConnected) {
          span.replaceWith(add);
          f.ink.normalize();
        }
      });
    } else {
      f.ink.textContent = s;
      f.shown = s;
    }
  }

  settleField(field) {
    const f = this.f[field];
    if (!f.wrap.classList.contains('is-misreg')) return;
    const from = getComputedStyle(f.text).textShadow;
    f.wrap.classList.remove('is-misreg');
    motion.settle(f.wrap, f.text, from);
  }

  flush() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.render();
  }

  done({ post, warnings }) {
    if (this.state !== 'streaming') return;
    this.flush();
    this.post = coercePost(post);
    for (const field of FIELDS) {
      const s = fieldText(this.post, field);
      if (this.f[field].shown !== s) {
        this.f[field].ink.textContent = s;
        this.f[field].shown = s;
      }
      this.settleField(field);
    }
    this.key = null;
    this.caret.remove();
    delete this.el.dataset.waiting;
    this.decorate();
    this.renderWarnings(warnings || checkLimits(this.post, this.platform));
    this.updateCount(this.post);
    this.statusEl.textContent = 'Готово';
    this.setState('done');
  }

  fail(err) {
    if (this.state !== 'streaming') return;
    this.flush();
    for (const field of FIELDS) this.settleField(field);
    this.key = null;
    this.caret.remove();
    delete this.el.dataset.waiting;
    const partial = parsePartial(this.buffer);
    this.post = partial ? coercePost(partial.value) : null;

    if (err.code === 'aborted') {
      this.statusEl.textContent = 'Остановлено';
      this.setState('aborted');
      return;
    }
    this.statusEl.textContent = 'Брак';
    this.errorBox.hidden = false;
    this.setState('error');
    if (err.code === 'rate_limited') this.startCountdown(err.retryAfter || 30);
    else this.errorTextEl.textContent = errorText(err.code);
  }

  // ---------- оформление ----------

  decorate() {
    const title = this.f.title;
    if (this.angle === 'benefit') {
      // Крупнее — только «выгодные» числа: проценты и числа со знаком (−20%, +3, 50%). Даты не трогаем.
      const re = /([−+-]\s?\d+(?:[.,]\d+)?\s?%?|\d+(?:[.,]\d+)?\s?%)/g;
      const parts = this.post.title.split(re);
      if (parts.length > 1) {
        // split с одной группой: нечётные элементы — совпадения.
        const nodes = parts.map((p, i) => {
          if (i % 2 === 0) return p ? document.createTextNode(p) : null;
          const s = document.createElement('span');
          s.className = 'num';
          s.textContent = p;
          return s;
        });
        title.ink.replaceChildren(...nodes.filter(Boolean));
      }
    }
    if (this.angle === 'engagement' && /[?？]\s*$/.test(this.post.title)) {
      title.text.dataset.q = '';
      title.ink.textContent = this.post.title.replace(/[?？]\s*$/, '');
    }
  }

  updateCount(post) {
    const n = countChars(formatForCopy(post, this.platform));
    const { target, hard } = PLATFORMS[this.platform].limits.total;
    this.countEl.textContent = n ? `${n} из ${target}` : '';
    this.countEl.classList.toggle('is-over', n > hard);
  }

  renderWarnings(list) {
    const items = list.map((w) => {
      const li = document.createElement('li');
      const k = `${w.field}:${w.level}`;
      li.className = `warn warn--${w.level}`;
      if (!this.warnKeys.has(k)) li.classList.add('is-new');
      li.textContent = warningText(w, this.platform);
      return li;
    });
    this.warnKeys = new Set(list.map((w) => `${w.field}:${w.level}`));
    this.warnEl.replaceChildren(...items);
  }

  setState(state) {
    this.state = state;
    this.el.dataset.state = state;
    this.el.setAttribute('aria-busy', String(state === 'streaming'));
    const hasText = Boolean(this.post && (this.post.title || this.post.body));
    this.copyBtn.disabled = !(state === 'done' || (state === 'aborted' && hasText));
    this.el.querySelectorAll('[data-tweak]').forEach((b) => {
      b.disabled = !(state === 'done' || (state === 'aborted' && hasText));
    });
  }

  // ---------- ошибки: обратный отсчёт для лимита ----------

  startCountdown(seconds) {
    this.stopCountdown();
    let left = Math.max(1, Math.round(seconds));
    const tick = () => {
      this.errorTextEl.textContent = errorText('rate_limited', left);
      this.retryBtn.disabled = left > 0;
      this.retryBtn.textContent = left > 0 ? `Повторить через ${left}` : 'Повторить';
      if (left <= 0) this.stopCountdown();
      left--;
    };
    tick();
    this.countdown = setInterval(tick, 1000);
  }

  stopCountdown() {
    clearInterval(this.countdown);
    this.countdown = 0;
    this.retryBtn.disabled = false;
    this.retryBtn.textContent = 'Повторить';
  }

  // ---------- действия ----------

  currentPost() {
    return this.post || coercePost(parsePartial(this.buffer)?.value);
  }

  async copy() {
    const text = formatForCopy(this.currentPost(), this.platform);
    if (!text) return;
    const r = await copyText(text);
    if (r === 'ok') this.confirmCopied('Скопировано');
  }

  async copyField(field) {
    const post = this.currentPost();
    const text = field === 'hashtags' ? post.hashtags.join(' ') : post[field];
    if (!text) return;
    const r = await copyText(text);
    if (r === 'ok') this.confirmCopied(COPIED[field]);
  }

  confirmCopied(announcement) {
    navigator.vibrate?.(10);
    this.handlers.onAnnounce?.(announcement);
    this.stampEl.getAnimations().forEach((a) => a.cancel());
    motion.stamp(this.stampEl, this.el);
  }

  /** Путь корректорского знака для правки (D7) в координатах .sheet-paper. */
  proofPath(tweak) {
    const base = this.paperEl.getBoundingClientRect();
    const rect = (field) => {
      const r = this.f[field].text.getBoundingClientRect();
      return { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height };
    };
    if (tweak === 'shorter') {
      const b = rect('body');
      const y = b.y + Math.min(b.h / 2, 60);
      let d = `M ${b.x} ${y}`;
      for (let x = b.x, up = true; x < b.x + b.w - 12; x += 14, up = !up) d += ` Q ${x + 7} ${y + (up ? -7 : 7)} ${x + 14} ${y}`;
      return d;
    }
    if (tweak === 'longer') {
      const b = rect('body');
      const x = b.x + Math.min(b.w - 14, b.w * 0.8);
      const y = b.y + b.h + 4;
      return `M ${x - 11} ${y + 2} L ${x} ${y - 14} L ${x + 11} ${y + 2}`;
    }
    if (tweak === 'new_cta') {
      const c = rect('cta');
      return `M ${c.x - 6} ${c.y - 4} L ${c.x + c.w + 6} ${c.y - 6} L ${c.x + c.w + 4} ${c.y + c.h + 5} L ${c.x - 4} ${c.y + c.h + 4} Z`;
    }
    const t = rect('title');
    if (tweak === 'more_emoji') {
      const x = t.x + Math.min(t.w, base.width - 30) + 4;
      const y = t.y + 8;
      return `M ${x - 10} ${y + 16} L ${x} ${y} L ${x + 10} ${y + 16} M ${x} ${y - 12} l 0 -10 M ${x - 6} ${y - 17} l 12 0`;
    }
    // no_emoji: петля удаления вокруг заголовка
    const cx = t.x + t.w / 2;
    const cy = t.y + t.h / 2;
    const rx = t.w / 2 + 8;
    const ry = t.h / 2 + 8;
    return `M ${cx + rx} ${cy} A ${rx} ${ry} 0 1 1 ${cx + rx - 2} ${cy - 6} L ${cx + rx + 18} ${cy - 22}`;
  }
}
