import { chrome } from '../components/chrome.js';

const $ = (s) => document.querySelector(s);

// Busca no documento da aba selecionada, usando o PDFFindController do PDF.js
// (destaque, contador e navegação entre ocorrências).
export function initSearch({ renderer, store, settings }) {
  const bar = $('#searchbar');
  const input = $('#searchInput');
  const count = $('#searchCount');
  const bus = renderer.eventBus;
  let timer = null;

  function setCount(text, none = false) {
    count.textContent = text;
    count.classList.toggle('none', none);
  }

  function clearResults() {
    bus.dispatch('findbarclose', { source: renderer });
    setCount('');
  }

  function find(type = '', findPrevious = false) {
    const query = input.value;
    if (!query) return clearResults();
    const prefs = settings.get();
    bus.dispatch('find', {
      source: renderer,
      type,
      query,
      caseSensitive: prefs.searchCaseSensitive,
      entireWord: false,
      highlightAll: prefs.highlightAll,
      findPrevious,
      matchDiacritics: true,
    });
  }

  function render(matches, state) {
    if (!input.value) return setCount('');
    if (state === 3) return setCount('Buscando…');
    if (matches && matches.total > 0) return setCount(`${matches.current} de ${matches.total}`);
    if (state === 1 || (matches && matches.total === 0)) return setCount('Nenhuma ocorrência', true);
  }

  bus.on('updatefindmatchescount', ({ matchesCount }) => render(matchesCount, null));
  bus.on('updatefindcontrolstate', ({ state, matchesCount }) => render(matchesCount, state));

  function open() {
    if (!store.getActive()) return;
    bar.hidden = false;
    chrome.show();
    input.focus();
    input.select();
    if (input.value) find('');
  }
  function close() {
    bar.hidden = true;
    clearResults();
  }

  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => find(''), 250);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(timer);
      find('again', e.shiftKey);
    } else if (e.key === 'Escape') {
      close();
    }
  });
  $('#searchNext').addEventListener('click', () => find('again', false));
  $('#searchPrev').addEventListener('click', () => find('again', true));
  $('#searchClose').addEventListener('click', close);

  return {
    open,
    close,
    toggle: () => (bar.hidden ? open() : close()),
    // Chamado quando a aba selecionada muda: a busca passa a valer para o novo documento.
    refresh() {
      setCount('');
      if (!store.getActive()) {
        bar.hidden = true;
        return;
      }
      if (!bar.hidden && input.value) find('');
    },
  };
}
