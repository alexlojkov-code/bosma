// Настройки и архив в localStorage (SPEC §8). Любое обращение — в try/catch.

export const PREFS_KEY = 'spg.prefs.v1';
export const HISTORY_KEY = 'spg.history.v1';
export const HISTORY_LIMIT = 200;

export function createStore(storage = safeStorage()) {
  const listeners = new Set();
  let available = Boolean(storage);
  let history = readHistory();

  function readJson(key) {
    if (!storage) return { ok: false };
    try {
      const raw = storage.getItem(key);
      if (raw === null) return { ok: true, value: null };
      return { ok: true, value: JSON.parse(raw), raw };
    } catch (e) {
      if (e instanceof SyntaxError) return { ok: false, corrupt: true };
      available = false;
      return { ok: false };
    }
  }

  function readHistory() {
    const r = readJson(HISTORY_KEY);
    if (r.ok && Array.isArray(r.value)) return r.value.filter(isItem);
    if (r.ok && r.value === null) return [];
    if (r.corrupt || (r.ok && !Array.isArray(r.value))) {
      try {
        storage.setItem('spg.history.corrupt', storage.getItem(HISTORY_KEY));
      } catch { /* не важно */ }
    }
    return [];
  }

  function writeHistory(list) {
    if (!storage) return { ok: false, reason: 'unavailable' };
    try {
      storage.setItem(HISTORY_KEY, JSON.stringify(list));
      return { ok: true };
    } catch (e) {
      if (isQuota(e)) return { ok: false, reason: 'quota' };
      available = false;
      return { ok: false, reason: 'unavailable' };
    }
  }

  function evict(list, n) {
    // Удаляем n самых старых без звёздочки (список — новые в начале).
    const out = [...list];
    for (let i = out.length - 1; i >= 0 && n > 0; i--) {
      if (!out[i].starred) {
        out.splice(i, 1);
        n--;
      }
    }
    return out;
  }

  function commit(next) {
    let list = next;
    if (list.length > HISTORY_LIMIT) list = evict(list, list.length - HISTORY_LIMIT);
    let r = writeHistory(list);
    if (!r.ok && r.reason === 'quota') {
      list = evict(list, 20);
      r = writeHistory(list);
    }
    if (r.ok || !storage) history = list;
    else if (r.reason === 'unavailable') history = list; // работаем в памяти до перезагрузки
    emit();
    return r;
  }

  function emit() {
    for (const fn of listeners) fn(history);
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key === HISTORY_KEY) {
        history = readHistory();
        emit();
      }
    });
  }

  return {
    get available() {
      return available;
    },
    loadPrefs() {
      const r = readJson(PREFS_KEY);
      return r.ok && r.value && typeof r.value === 'object' ? r.value : {};
    },
    savePrefs(prefs) {
      if (!storage) return false;
      try {
        storage.setItem(PREFS_KEY, JSON.stringify(prefs));
        return true;
      } catch {
        return false;
      }
    },
    history: () => history,
    add(item) {
      return commit([item, ...history]);
    },
    update(id, patch) {
      return commit(history.map((h) => (h.id === id ? { ...h, ...patch } : h)));
    },
    remove(id) {
      const index = history.findIndex((h) => h.id === id);
      if (index === -1) return null;
      const item = history[index];
      commit(history.filter((h) => h.id !== id));
      return { item, index };
    },
    restore(item, index) {
      const next = [...history];
      next.splice(Math.min(index, next.length), 0, item);
      return commit(next);
    },
    clear() {
      return commit([]);
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

function isItem(x) {
  return x && typeof x === 'object' && typeof x.id === 'string' && x.post && typeof x.post === 'object';
}

function isQuota(e) {
  return e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014);
}

function safeStorage() {
  try {
    const s = globalThis.localStorage;
    const k = '__spg_probe__';
    s.setItem(k, '1');
    s.removeItem(k);
    return s;
  } catch {
    return null;
  }
}
