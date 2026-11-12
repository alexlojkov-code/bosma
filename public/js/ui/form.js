// Бланк: поля-строки, счётчики, подсказки, площадка, язык, тон (SPEC §9.2, DESIGN §7.1, §8.1–8.4).
import { INPUT_LIMITS, fieldError } from '../core/validate.js';
import { PLATFORMS, LANGUAGES, TONES, countChars } from '../core/platforms.js';

export function createForm({ store, onPlatformChange, onSubmit, onToggle }) {
  const form = document.getElementById('brief');
  const summary = document.getElementById('summary');
  const summaryText = document.getElementById('summary-text');
  const fields = {
    business: document.getElementById('business'),
    idea: document.getElementById('idea'),
  };
  const ideaClear = document.getElementById('idea-clear');
  const language = document.getElementById('language');
  const tone = document.getElementById('tone');
  const radios = [...form.querySelectorAll('input[name="platform"]')];
  const touched = new Set();
  let lastPoint = null;

  // ---- восстановление настроек ----
  const prefs = store.loadPrefs();
  if (typeof prefs.business === 'string') fields.business.value = prefs.business;
  if (typeof prefs.ideaDraft === 'string') fields.idea.value = prefs.ideaDraft;
  if (Object.hasOwn(LANGUAGES, prefs.language)) language.value = prefs.language;
  if (Object.hasOwn(TONES, prefs.tone)) tone.value = prefs.tone;
  const platform0 = Object.hasOwn(PLATFORMS, prefs.platform) ? prefs.platform : 'telegram';
  radios.forEach((r) => (r.checked = r.value === platform0));

  let saveTimer = 0;
  function savePrefs() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const v = values();
      store.savePrefs({ business: v.business, ideaDraft: fields.idea.value, platform: v.platform, language: v.language, tone: v.tone });
    }, 500);
  }

  // ---- поля ----
  function autoresize(ta) {
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight + 2}px`;
  }

  function updateCounter(name) {
    const el = document.getElementById(`${name}-count`);
    const n = countChars(fields[name].value.trim());
    const { max } = INPUT_LIMITS[name];
    el.textContent = `${n} / ${max}`;
    el.classList.toggle('is-over', n > max);
  }

  function showError(name) {
    const err = fieldError(name, fields[name].value);
    const errEl = document.getElementById(`${name}-err`);
    errEl.textContent = err || '';
    fields[name].setAttribute('aria-invalid', String(Boolean(err)));
    return err;
  }

  for (const [name, ta] of Object.entries(fields)) {
    ta.addEventListener('input', () => {
      autoresize(ta);
      updateCounter(name);
      if (touched.has(name)) showError(name);
      if (name === 'idea') ideaClear.hidden = !ta.value;
      savePrefs();
    });
    ta.addEventListener('blur', () => {
      if (ta.value.trim()) {
        touched.add(name);
        showError(name);
      }
    });
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onSubmit();
      }
    });
    updateCounter(name);
  }
  ideaClear.hidden = !fields.idea.value;
  requestAnimationFrame(() => Object.values(fields).forEach(autoresize));

  ideaClear.addEventListener('click', () => {
    fields.idea.value = '';
    fields.idea.dispatchEvent(new Event('input'));
    fields.idea.focus();
  });

  // ---- подсказки идеи: шаблон, курсор на «…» ----
  form.querySelectorAll('.chip[data-template]').forEach((chip) =>
    chip.addEventListener('click', () => {
      const ta = fields.idea;
      const tpl = chip.dataset.template;
      ta.value = ta.value.trim() ? `${ta.value.trimEnd()}\n${tpl}` : tpl;
      ta.dispatchEvent(new Event('input'));
      ta.focus();
      const i = ta.value.lastIndexOf('…');
      ta.setSelectionRange(i, i + 1);
    }),
  );

  // ---- площадка: смена краски из точки касания ----
  form.querySelectorAll('.can').forEach((label) => {
    label.addEventListener('pointerdown', (e) => (lastPoint = { x: e.clientX, y: e.clientY }));
  });
  radios.forEach((r) =>
    r.addEventListener('change', () => {
      if (!r.checked) return;
      let point = lastPoint;
      if (!point) {
        const rect = r.closest('.can').getBoundingClientRect();
        point = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      }
      lastPoint = null;
      onPlatformChange(r.value, point);
      savePrefs();
    }),
  );
  language.addEventListener('change', savePrefs);
  tone.addEventListener('change', savePrefs);

  // ---- свёрнутый вид ----
  summary.addEventListener('click', () => {
    setCollapsed(false);
    fields.idea.focus();
  });

  function values() {
    return {
      business: fields.business.value.trim(),
      idea: fields.idea.value.trim(),
      platform: radios.find((r) => r.checked)?.value || 'telegram',
      language: language.value,
      tone: tone.value,
    };
  }

  function setCollapsed(collapsed) {
    const v = values();
    const idea = [...v.idea.replace(/\s+/g, ' ')];
    summaryText.textContent = `${PLATFORMS[v.platform].label}, ${idea.length > 48 ? `${idea.slice(0, 48).join('')}…` : idea.join('')}`;
    form.hidden = collapsed;
    summary.hidden = !collapsed;
    summary.setAttribute('aria-expanded', String(!collapsed));
    if (!collapsed) requestAnimationFrame(() => Object.values(fields).forEach(autoresize));
    onToggle?.(collapsed);
  }

  return {
    values,
    platform: () => values().platform,
    /** Проверяет все поля, показывает ошибки. → первое неверное поле или null. */
    validate() {
      let first = null;
      for (const name of ['business', 'idea']) {
        touched.add(name);
        if (showError(name) && !first) first = fields[name];
      }
      return first;
    },
    setCollapsed,
    isCollapsed: () => form.hidden,
  };
}
