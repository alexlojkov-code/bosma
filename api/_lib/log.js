// Одна строка JSON на запрос. Тексты, IP и ключ не логируются (SPEC §11).
export function logRequest(entry) {
  if (process.env.NODE_ENV === 'test' || process.env.SPG_SILENT) return;
  console.log(JSON.stringify({ t: new Date().toISOString(), ...entry }));
}
