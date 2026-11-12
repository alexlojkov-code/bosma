// Тост внизу экрана: короткое сообщение и необязательное действие.
export function createToast() {
  const box = document.getElementById('toast');
  const text = document.getElementById('toast-text');
  const action = document.getElementById('toast-action');
  let timer = 0;
  let handler = null;

  action.addEventListener('click', () => {
    const fn = handler;
    hide();
    fn?.();
  });

  function hide() {
    clearTimeout(timer);
    box.hidden = true;
    handler = null;
  }

  return function show(message, { actionLabel, onAction, duration = 2500 } = {}) {
    clearTimeout(timer);
    text.textContent = message;
    handler = onAction || null;
    action.hidden = !actionLabel;
    action.textContent = actionLabel || '';
    box.hidden = false;
    box.animate?.([{ transform: 'translateY(12px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 200, easing: 'cubic-bezier(.22,1,.36,1)' });
    timer = setTimeout(hide, duration);
  };
}
