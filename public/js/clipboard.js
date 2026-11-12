// Копирование с запасными способами (SPEC §9.7). → 'ok' | 'manual'

export async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return 'ok';
    }
  } catch { /* пробуем дальше */ }

  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    document.body.append(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    ta.remove();
    if (ok) return 'ok';
  } catch { /* дальше — вручную */ }

  const dialog = document.getElementById('copy-dialog');
  const area = document.getElementById('copy-dialog-text');
  area.value = text;
  dialog.showModal();
  area.focus();
  area.select();
  return 'manual';
}
