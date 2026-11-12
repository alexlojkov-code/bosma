// Клиент API: POST + чтение SSE вручную (EventSource умеет только GET). SPEC §7.1.

function parseBlock(block) {
  let event = 'message';
  const data = [];
  for (const line of block.split('\n')) {
    if (!line || line.startsWith(':')) continue;
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
  }
  if (!data.length) return null;
  try {
    return { event, data: JSON.parse(data.join('\n')) };
  } catch {
    return null;
  }
}

/**
 * Стримит один вариант. Колбэки: onDelta(text), onDone({post, warnings, usage}), onError({code, retryAfter, message}).
 * Ровно один из onDone / onError вызывается всегда.
 */
export async function streamGenerate(payload, { signal, onDelta, onDone, onError }) {
  let res;
  try {
    res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (e) {
    if (e?.name === 'AbortError') return onError({ code: 'aborted' });
    return onError({ code: navigator.onLine === false ? 'offline' : 'upstream_error' });
  }

  if (!res.ok) {
    let data = {};
    try {
      data = await res.json();
    } catch { /* не JSON */ }
    const retryAfter = data.retryAfter ?? (Number(res.headers.get('Retry-After')) || undefined);
    return onError({ code: data.code || 'upstream_error', retryAfter, message: data.message });
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let finished = false;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
      let idx;
      while ((idx = buf.indexOf('\n\n')) !== -1) {
        const ev = parseBlock(buf.slice(0, idx));
        buf = buf.slice(idx + 2);
        if (!ev || finished) continue;
        if (ev.event === 'delta') onDelta(ev.data.text || '');
        else if (ev.event === 'done') {
          finished = true;
          onDone(ev.data);
        } else if (ev.event === 'error') {
          finished = true;
          onError(ev.data);
        }
      }
    }
  } catch (e) {
    if (finished) return;
    return onError({ code: e?.name === 'AbortError' || signal?.aborted ? 'aborted' : 'upstream_error' });
  }
  if (!finished) onError({ code: signal?.aborted ? 'aborted' : 'upstream_error' });
}

export async function getHealth() {
  try {
    const res = await fetch('/api/health', { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
