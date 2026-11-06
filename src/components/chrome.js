// Controle da barra superior (cabeçalho + busca + abas), que pode ocultar ao rolar.
let lockUntil = 0;
const el = () => document.getElementById('topchrome');

export const chrome = {
  isHidden: () => el().classList.contains('is-hidden'),
  setHidden(hide) {
    const e = el();
    if (e.classList.contains('is-hidden') === hide) return;
    e.classList.toggle('is-hidden', hide);
    lockUntil = performance.now() + 450; // ignora eventos de scroll causados pela mudança de layout
  },
  show() {
    chrome.setHidden(false);
  },
  locked: () => performance.now() < lockUntil,
};
