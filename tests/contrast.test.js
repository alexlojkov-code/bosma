// Контраст пар текст/фон и запрет фиолетового (DESIGN §5.2, §12).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../public/css/tokens.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** Разбирает tokens.css на светлые и тёмные блоки: селектор → {переменная: #hex}. */
function parse(source) {
  const out = { light: [], dark: [] };
  const walk = (text, theme) => {
    const re = /([^{}]+)\{/g;
    let m;
    while ((m = re.exec(text))) {
      const selector = m[1].trim();
      let depth = 1;
      let j = re.lastIndex;
      while (depth && j < text.length) {
        if (text[j] === '{') depth++;
        else if (text[j] === '}') depth--;
        j++;
      }
      const body = text.slice(re.lastIndex, j - 1);
      re.lastIndex = j;
      if (selector.startsWith('@media (prefers-color-scheme: dark)')) walk(body, 'dark');
      else if (selector.startsWith('@')) continue;
      else if (selector.startsWith(':root')) {
        const vars = {};
        for (const v of body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)) vars[v[1]] = v[2];
        out[theme].push({ selector, vars });
      }
    }
  };
  walk(source, 'light');
  return out;
}

function themeFor(blocks, platform) {
  const vars = {};
  for (const b of blocks) {
    const m = b.selector.match(/data-platform="(\w+)"/);
    if (b.selector === ':root' || (m && m[1] === platform)) Object.assign(vars, b.vars);
  }
  return vars;
}

function lum(hex) {
  const c = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function ratio(a, b) {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
function hsl(hex) {
  const [r, g, b] = [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (!d) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return { h, s, l };
}

const blocks = parse(css);
const PLATFORMS = ['telegram', 'instagram', 'youtube'];

// [текст, фон, минимум]
const PAIRS = [
  ['black', 'paper', 4.5],
  ['black', 'sheet', 4.5],
  ['black-soft', 'paper', 4.5],
  ['black-soft', 'sheet', 4.5],
  ['ink-text', 'paper', 4.5],
  ['ink-text', 'sheet', 4.5],
  ['on-ink', 'ink', 4.5],
  ['on-marker', 'marker', 4.5],
  ['paper', 'black', 4.5], // текст основной кнопки
  ['danger', 'paper', 4.5],
  ['danger', 'sheet', 4.5],
];

for (const theme of ['light', 'dark']) {
  for (const platform of PLATFORMS) {
    test(`контраст: ${theme}, ${platform}`, () => {
      const v = { ...themeFor(blocks.light, platform), ...(theme === 'dark' ? themeFor(blocks.dark, platform) : {}) };
      for (const [fg, bg, min] of PAIRS) {
        assert.ok(v[fg] && v[bg], `нет токена ${fg} или ${bg}`);
        const r = ratio(v[fg], v[bg]);
        assert.ok(r >= min, `${fg} ${v[fg]} на ${bg} ${v[bg]}: ${r.toFixed(2)} < ${min}`);
      }
      // Банки с краской: контур/текст невыбранной банки и текст на залитой
      for (const p of PLATFORMS) {
        assert.ok(ratio(v[`ct-${p}`], v.paper) >= 3, `контур банки ${p} на бумаге`);
        assert.ok(ratio(v[`con-${p}`], v[`c-${p}`]) >= 4.5, `текст на банке ${p}`);
      }
    });
  }
}

test('в токенах нет фиолетовых оттенков (250–300°)', () => {
  for (const theme of ['light', 'dark']) {
    for (const b of blocks[theme]) {
      for (const [name, hex] of Object.entries(b.vars)) {
        const { h, s } = hsl(hex);
        assert.ok(!(s > 0.12 && h >= 250 && h <= 300), `--${name} ${hex} (${Math.round(h)}°) в ${b.selector}`);
      }
    }
  }
});
