// Тексты ошибок для пользователя (SPEC §9.6, DESIGN §10.1). Без извинений: что случилось и что нажать.

export const ERROR_TEXT = {
  invalid_input: 'Проверьте поля бланка.',
  forbidden: 'Запрос отклонён.',
  rate_limited: 'Слишком много запросов. Попробуйте через {N} с.',
  blocked_content: 'Этот пост ИИ писать не стал. Перефразируйте идею.',
  truncated: 'Текст оборвался — слишком длинный. Нажмите «Короче».',
  bad_output: 'ИИ ответил некорректно. Нажмите «Повторить».',
  timeout: 'ИИ отвечает слишком долго. Нажмите «Повторить».',
  upstream_error: 'Ответа нет. Нажмите «Повторить».',
  not_configured: 'ИИ не подключён. Нажмите «Повторить» позже.',
  offline: 'Нет соединения. Архив доступен.',
};

export function errorText(code, retryAfter) {
  const t = ERROR_TEXT[code] || ERROR_TEXT.upstream_error;
  return t.replace('{N}', String(Math.max(1, Math.round(retryAfter || 30))));
}
