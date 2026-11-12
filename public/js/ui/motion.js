// Сцены движения (DESIGN §9). Только WAAPI, CSS и View Transitions — без библиотек.

const mq = matchMedia('(prefers-reduced-motion: reduce)');
export const reduced = () => mq.matches;

const SPRING = 'cubic-bezier(.34, 1.56, .64, 1)';
const OUT = 'cubic-bezier(.22, 1, .36, 1)';

function rotOf(el) {
  return getComputedStyle(el).getPropertyValue('--rot').trim() || '0deg';
}

function done(anim) {
  return anim ? anim.finished.catch(() => {}) : Promise.resolve();
}

/** Обёртка над View Transitions с классом-сценой на <html>. */
export function viewTransition(update, cls) {
  if (!document.startViewTransition || reduced() || document.hidden) {
    update();
    return null;
  }
  const root = document.documentElement;
  if (cls) root.classList.add(cls);
  const t = document.startViewTransition(update);
  // Переход может быть прерван (вкладка скрыта, новый переход) — это не ошибка.
  t.ready.catch(() => {});
  t.finished.catch(() => {}).finally(() => cls && root.classList.remove(cls));
  return t;
}

/** D2: новая краска растекается кругом из точки касания. */
export function inkFlood(x, y, update) {
  const t = viewTransition(update, 'vt-ink');
  if (!t) return;
  const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  t.ready
    .then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 480, easing: OUT, pseudoElement: '::view-transition-new(root)' },
      );
    })
    .catch(() => {});
}

/** D5: листы выезжают снизу один за другим с перелётом. */
export function sheetsIn(sheets) {
  if (reduced()) {
    sheets.forEach((s) => s.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150 }));
    return;
  }
  sheets.forEach((s, i) => {
    const rot = rotOf(s);
    s.animate(
      [
        { transform: 'translateY(70px) rotate(0deg)', opacity: 0 },
        { transform: `translateY(0) rotate(${rot})`, opacity: 1 },
      ],
      { duration: 480, delay: i * 70, easing: SPRING, fill: 'backwards' },
    );
  });
}

/** D3: новый кусок текста проявляется краской и темнеет до основного цвета. */
export function typeIn(span, inkColor) {
  if (reduced()) return Promise.resolve();
  const a = span.animate(
    [
      { opacity: 0, color: inkColor },
      { opacity: 1, color: inkColor, offset: 0.4 },
      { opacity: 1 },
    ],
    { duration: 170, easing: 'linear' },
  );
  return done(a);
}

/** D3: приводка совпала — второй слой встаёт на место, поле «прижимается». */
export function settle(fieldEl, textEl, from) {
  if (reduced() || !from || from === 'none') return;
  textEl.animate([{ textShadow: from }, { textShadow: from.replace(/-?[\d.]+px\s+-?[\d.]+px/, '0px 0px') }], {
    duration: 420,
    easing: SPRING,
  });
  fieldEl.animate([{ transform: 'scale(1.015)' }, { transform: 'scale(1)' }], { duration: 260, easing: OUT });
}

/** D6: штамп опускается на лист, лист вздрагивает. */
export function stamp(stampEl, sheet) {
  const base = 'translate(-50%, -50%) rotate(-8deg)';
  if (reduced()) {
    return done(stampEl.animate([{ opacity: 1 }, { opacity: 1, offset: 0.85 }, { opacity: 0 }], { duration: 1200 }));
  }
  const rot = rotOf(sheet);
  sheet.animate(
    [
      { transform: `rotate(${rot})` },
      { transform: `rotate(${rot}) translate(2px, 2px)` },
      { transform: `rotate(${rot}) translate(-1px, 0)` },
      { transform: `rotate(${rot})` },
    ],
    { duration: 200, delay: 300, easing: 'linear' },
  );
  return done(
    stampEl.animate(
      [
        { opacity: 0, transform: `${base} scale(1.7)` },
        { opacity: 1, transform: `${base} scale(0.94)`, offset: 0.3 },
        { opacity: 1, transform: `${base} scale(1)`, offset: 0.4 },
        { opacity: 1, transform: `${base} scale(1)`, offset: 0.85 },
        { opacity: 0, transform: `${base} scale(1)` },
      ],
      { duration: 1550, easing: 'cubic-bezier(.3, 0, .2, 1)' },
    ),
  );
}

/** D7: корректорский знак красным карандашом, затем лист переворачивается на ребро. */
export async function proofmark(svg, d, sheet, onMidpoint) {
  const path = svg.querySelector('path');
  const box = svg.getBoundingClientRect();
  svg.setAttribute('viewBox', `0 0 ${Math.max(1, box.width)} ${Math.max(1, box.height)}`);
  path.setAttribute('d', d);
  svg.style.visibility = 'visible';
  if (reduced()) {
    await new Promise((r) => setTimeout(r, 250));
    svg.style.visibility = 'hidden';
    onMidpoint();
    return;
  }
  const len = path.getTotalLength();
  path.style.strokeDasharray = `${len}`;
  await done(path.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 400, easing: OUT, fill: 'forwards' }));
  const rot = rotOf(sheet);
  await done(sheet.animate([{ transform: `perspective(900px) rotate(${rot}) rotateY(0deg)` }, { transform: `perspective(900px) rotate(${rot}) rotateY(88deg)` }], { duration: 150, easing: 'cubic-bezier(.5,0,1,1)' }));
  svg.style.visibility = 'hidden';
  path.getAnimations().forEach((a) => a.cancel());
  onMidpoint();
  sheet.animate([{ transform: `perspective(900px) rotate(${rot}) rotateY(-88deg)` }, { transform: `perspective(900px) rotate(${rot}) rotateY(0deg)` }], { duration: 220, easing: OUT });
}

/** D8: лист снимается со стопки, на его место ложится чистый. */
export async function swapSheet(sheet, onMidpoint) {
  if (reduced()) {
    onMidpoint();
    return;
  }
  const rot = rotOf(sheet);
  await done(sheet.animate([{ transform: `rotate(${rot})`, opacity: 1 }, { transform: `translate(40px, -10px) rotate(5deg)`, opacity: 0 }], { duration: 160, easing: 'cubic-bezier(.5,0,1,1)' }));
  onMidpoint();
  sheet.animate([{ transform: `translateY(30px) rotate(0deg)`, opacity: 0 }, { transform: `rotate(${rot})`, opacity: 1 }], { duration: 320, easing: SPRING });
}

/** D10: строка архива сжимается по высоте. */
export function collapse(el) {
  if (reduced()) return Promise.resolve();
  const h = el.getBoundingClientRect().height;
  return done(el.animate([{ height: `${h}px`, opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 240, easing: OUT }));
}
