export function toast(message, kind = 'info', ms = 4800) {
  const host = document.getElementById('toasts');
  if (!host) {
    console.log(message);
    return;
  }
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = message;
  host.appendChild(el);
  while (host.children.length > 4) host.firstChild.remove();
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 250);
  }, ms);
}
