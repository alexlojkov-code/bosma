// Проверка, что серверные функции живы: GET /api/health → {"ok":true}
export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ ok: true, service: 'social-posts-generator' }));
}
