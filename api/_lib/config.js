// Переменные окружения (SPEC §3.1). Читаются при каждом запросе — удобно для тестов.
export function getConfig(env = process.env) {
  const apiKey = env.GEMINI_API_KEY || '';
  const forcedMock = env.GEMINI_MODE === 'mock';
  return {
    apiKey,
    model: env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
    mode: forcedMock || !apiKey ? 'mock' : 'live',
    timeoutMs: Number(env.GEMINI_TIMEOUT_MS) || 30000,
    perMin: Number(env.RATE_LIMIT_PER_MIN) || 30,
    perDay: Number(env.RATE_LIMIT_PER_DAY) || 300,
    allowedOrigins: (env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  };
}
