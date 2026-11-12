// Лимиты запросов по IP в памяти функции (SPEC §4.3).
// У каждого экземпляра функции своя память, поэтому лимит приблизительный.

const MINUTE = 60_000;
const DAY = 86_400_000;
const MAX_IPS = 10_000;

export function createLimiter({ perMin, perDay, now = () => Date.now() }) {
  const hits = new Map(); // ip → number[] (метки времени, по возрастанию)

  function check(ip) {
    const t = now();
    const list = (hits.get(ip) || []).filter((x) => t - x < DAY);
    const inMinute = list.filter((x) => t - x < MINUTE);

    if (inMinute.length >= perMin) {
      hits.set(ip, list);
      return { ok: false, retryAfter: Math.ceil((inMinute[0] + MINUTE - t) / 1000) };
    }
    if (list.length >= perDay) {
      hits.set(ip, list);
      return { ok: false, retryAfter: Math.ceil((list[0] + DAY - t) / 1000) };
    }

    list.push(t);
    hits.delete(ip); // переставляем в конец: Map хранит порядок вставки
    hits.set(ip, list);
    while (hits.size > MAX_IPS) hits.delete(hits.keys().next().value);
    return { ok: true };
  }

  return { check, size: () => hits.size };
}

export function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()) return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}
