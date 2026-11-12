// Bosma — точка входа: склеивает бланк, гранки, архив, роутинг и нижнюю панель.
import { createStore } from './store.js';
import { getHealth } from './api.js';
import { errorText } from './core/messages.js';
import { createForm } from './ui/form.js';
import { createVariants } from './ui/variants.js';
import { createArchive } from './ui/archive.js';
import { createToast } from './ui/toast.js';
import * as motion from './ui/motion.js';

const root = document.documentElement;
const primary = document.getElementById('primary');
const dock = document.getElementById('dock');
const banner = document.getElementById('banner');
const live = document.getElementById('live');
const archiveCount = document.getElementById('archive-count');
const screens = {
  create: document.getElementById('screen-create'),
  archive: document.getElementById('screen-archive'),
};

const DARK_PAPER = { telegram: '#0C1B28', instagram: '#26101C', youtube: '#26100F' };

const store = createStore();
const toast = createToast();

function announce(text) {
  live.textContent = '';
  requestAnimationFrame(() => (live.textContent = text));
}

// ---------- краска площадки ----------
function applyPlatform(platform) {
  root.dataset.platform = platform;
  document.getElementById('favicon').href = `/favicon-${platform}.svg`;
  const dark = document.querySelector('meta[name="theme-color"][media*="dark"]');
  if (dark) dark.content = DARK_PAPER[platform];
}

// ---------- бланк и гранки ----------
const form = createForm({
  store,
  onPlatformChange: (platform, point) => motion.inkFlood(point.x, point.y, () => applyPlatform(platform)),
  onSubmit: () => submit(),
  onToggle: () => updateDock(),
});
applyPlatform(form.platform());

const variants = createVariants({
  resultsEl: document.getElementById('results'),
  stackEl: document.getElementById('stack'),
  tabsEl: document.getElementById('tabs'),
  store,
  announce,
  toast,
  onChange: () => updateDock(),
});

createArchive({ store, toast, announce });

function updateCount() {
  archiveCount.textContent = String(store.history().length);
}
store.subscribe(updateCount);
updateCount();

// ---------- нижняя панель ----------
function updateDock() {
  const streaming = variants.isStreaming();
  primary.classList.toggle('btn--stop', streaming);
  if (streaming) primary.textContent = 'Остановить';
  else if (variants.hasResults() && form.isCollapsed()) primary.textContent = 'Переписать все';
  else primary.textContent = 'Написать 3 варианта';
  primary.disabled = !streaming && navigator.onLine === false;
}

function submit() {
  if (variants.isStreaming()) {
    variants.stopAll();
    return;
  }
  const invalid = form.validate();
  if (invalid) {
    form.setCollapsed(false);
    invalid.focus();
    invalid.scrollIntoView({ block: 'center', behavior: motion.reduced() ? 'auto' : 'smooth' });
    return;
  }
  if (navigator.onLine === false) {
    toast(errorText('offline'));
    return;
  }
  form.setCollapsed(true);
  variants.generateAll(form.values());
  window.scrollTo({ top: 0, behavior: motion.reduced() ? 'auto' : 'smooth' });
  updateDock();
}
primary.addEventListener('click', submit);

// ---------- роутинг: бланк ↔ архив (D9) ----------
function currentRoute() {
  return location.hash.startsWith('#/archive') ? 'archive' : 'create';
}

function showRoute(route) {
  screens.create.hidden = route !== 'create';
  screens.archive.hidden = route !== 'archive';
  dock.hidden = route !== 'create';
  document.body.classList.toggle('no-dock', route !== 'create');
  document.title = route === 'archive' ? 'Архив — Bosma' : 'Bosma — посты для соцсетей';
  window.scrollTo(0, 0);
}

let route = currentRoute();
showRoute(route);
addEventListener('hashchange', () => {
  const next = currentRoute();
  if (next === route) return;
  const cls = next === 'archive' ? 'vt-forward' : 'vt-back';
  route = next;
  motion.viewTransition(() => showRoute(next), cls);
  const heading = next === 'archive' ? document.getElementById('archive-title') : null;
  if (heading) {
    heading.tabIndex = -1;
    requestAnimationFrame(() => heading.focus({ preventScroll: true }));
  }
});

// ---------- плашки: демо-режим и нет сети ----------
let demo = false;
function updateBanner() {
  const parts = [];
  if (navigator.onLine === false) parts.push(errorText('offline'));
  if (demo) parts.push('Демо-режим: посты-заглушки, ИИ не подключён.');
  banner.textContent = parts.join(' ');
  banner.hidden = parts.length === 0;
  updateDock();
}
addEventListener('online', updateBanner);
addEventListener('offline', updateBanner);
getHealth().then((h) => {
  demo = h?.mode === 'mock';
  updateBanner();
});
updateBanner();

if (!store.available) toast('Архив не сохраняется в этом режиме браузера.', { duration: 4000 });
