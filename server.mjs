// Локальный сервер: раздаёт public/ и вызывает функции из api/ (как Vercel),
// применяет заголовки из vercel.json (CSP и пр.), чтобы ошибки ловились локально.
// Запуск: node server.mjs   (переменные берутся из .env, если он есть)
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const root = here('./public/');
try { process.loadEnvFile(here('./.env')); } catch { /* .env нет — ок */ }

const vercel = JSON.parse(readFileSync(here('./vercel.json'), 'utf8'));
const headerRules = (vercel.headers || []).map((r) => ({
  re: new RegExp(`^${r.source.replace(/\(\.\*\)/g, '.*')}$`),
  headers: r.headers,
}));

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.json': 'application/json',
  '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.md': 'text/plain; charset=utf-8',
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  for (const rule of headerRules) {
    if (rule.re.test(url.pathname)) for (const h of rule.headers) res.setHeader(h.key, h.value);
  }

  const api = url.pathname.match(/^\/api\/([a-z][\w-]*)$/);
  if (api) {
    const file = here(`./api/${api[1]}.js`);
    if (!existsSync(file)) { res.statusCode = 404; return res.end('Not found'); }
    let raw = '';
    for await (const chunk of req) { raw += chunk; if (raw.length > 100000) break; }
    req.body = raw;
    const { default: handler } = await import(pathToFileURL(file).href);
    try {
      return await handler(req, res);
    } catch (e) {
      console.error(e);
      if (!res.headersSent) res.statusCode = 500;
      return res.end();
    }
  }

  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
  const file = join(root, rel.endsWith('/') ? rel + 'index.html' : rel);
  if (!file.startsWith(root)) { res.statusCode = 403; return res.end(); }
  try {
    const data = await readFile(file);
    res.setHeader('Content-Type', TYPES[extname(file)] || 'application/octet-stream');
    res.end(data);
  } catch {
    res.statusCode = 404;
    res.end('Not found');
  }
});

const port = Number(process.env.PORT) || 5220;
server.listen(port, '127.0.0.1', () => console.log(`Bosma → http://localhost:${port}`));
