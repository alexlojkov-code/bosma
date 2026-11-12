// GET /api/health → {ok, mode, model}. Ключ не раскрывается.
import { getConfig } from './_lib/config.js';

export default function handler(req, res) {
  const cfg = getConfig();
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify({ ok: true, mode: cfg.mode, model: cfg.model }));
}
