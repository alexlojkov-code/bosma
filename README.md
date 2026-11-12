# Social Posts Generator

Генератор постов для соцсетей. Сейчас — пустой каркас: страница-заглушка и проверочная функция `/api/health`.

## Структура

- `public/` — статика (отдаётся как сайт)
- `api/` — серверные функции Vercel (`api/health.js` → `/api/health`)
- `server.mjs` — локальный сервер, повторяет поведение Vercel

## Запуск локально

```bash
node server.mjs
```

Откроется на http://localhost:5220. Переменные окружения — в `.env` (образец в `.env.example`).

## Где живёт проект

- GitHub: https://github.com/alexlojkov-code/social-posts-generator
- Vercel: проект `social-posts-generator`, push в `main` публикует сайт сам
