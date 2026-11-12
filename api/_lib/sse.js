// Запись Server-Sent Events в ответ (SPEC §4.2).

export function openStream(res) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  let closed = false;
  const write = (chunk) => {
    if (closed || res.writableEnded || res.destroyed) return;
    res.write(chunk);
  };
  return {
    send(event, data) {
      write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    },
    ping() {
      write(': ping\n\n');
    },
    end() {
      if (closed) return;
      closed = true;
      if (!res.writableEnded) res.end();
    },
  };
}

export function sendJson(res, status, data, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(data));
}
