# Bosma — посты для соцсетей

Mobile-first веб-приложение: описываете бизнес и идею, выбираете Telegram, Instagram или YouTube — Gemini 3.5 Flash-Lite пишет три разных варианта поста (заголовок, текст, призыв, хэштеги). Текст набирается на глазах, любой вариант можно переписать или поправить («Короче», «Без эмодзи»…), всё написанное хранится в архиве на устройстве и копируется в одно касание.

Документы: [PRD.md](PRD.md) — что и зачем, [SPEC.md](SPEC.md) — как устроено, [DESIGN.md](DESIGN.md) — визуальный язык.

## Структура

- `public/` — сайт без сборки: `index.html`, `css/` (токены, вёрстка, движение), `js/` (ES-модули), `fonts/` (Sofia Sans Extra Condensed, Golos Text — OFL)
- `public/js/core/` — общий код клиента и сервера: правила площадок, проверка ввода, хэштеги, разбор незаконченного JSON
- `api/generate.js` — `POST /api/generate`, стрим одного варианта (SSE); `api/_lib/` — Gemini, mock, промпт, лимиты
- `api/health.js` — `GET /api/health` → режим (`live` / `mock`) и модель
- `server.mjs` — локальный сервер, повторяет Vercel (включая CSP из `vercel.json`)
- `tests/` — `node --test`, без сети; `scripts/spike.mjs` — проверка на настоящем Gemini

## Запуск локально

```bash
node server.mjs
```

Откроется на http://localhost:5220. Без `GEMINI_API_KEY` работает демо-режим: посты-заглушки и плашка сверху. Ключ и остальные переменные — в `.env` (образец в `.env.example`).

Демо-идеи для проверки состояний: `__error__`, `__blocked__`, `__slow__`, `__long__` (работают только в демо-режиме).

## Тесты

```bash
npm test
```

```bash
npm run spike
```

Второй — реальные запросы к Gemini (нужен ключ): время до первого символа, порядок полей, токены.

## Публикация

- GitHub: https://github.com/alexlojkov-code/bosma
- Сайт: https://bosma-posts.vercel.app (Vercel-проект `bosma`, push в `main` публикует сам). Старый адрес social-posts-generator-six.vercel.app тоже работает.
- Чтобы включить ИИ: добавить `GEMINI_API_KEY` в Vercel (Production и Preview) и передеплоить.
