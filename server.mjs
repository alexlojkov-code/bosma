// Локальный сервер: раздаёт public/ и вызывает функции из api/ (как Vercel).
// Запуск: node server.mjs   (переменные берутся из .env, если он есть)
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const root = here('./public/');
try { process.loadEnvFile(here('./.env')); } catch { /* .env нет — ок */ }

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.json': 'application/json',
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  const api = url.pathname.match(/^\/api\/([\w-]+)$/);
  if (api) {
    const file = here(`./api/${api[1]}.js`);
    if (!existsSync(file)) { res.statusCode = 404; return res.end('Not found'); }
    let raw = '';
    for await (const chunk of req) { raw += chunk; if (raw.length > 100000) break; }
    req.body = raw;
    const { default: handler } = await import(pathToFileURL(file).href);
    return handler(req, res);
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
server.listen(port, '127.0.0.1', () => console.log(`social-posts-generator → http://localhost:${port}`));
