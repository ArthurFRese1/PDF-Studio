import { icon } from './icons.js';
import { chrome } from './chrome.js';
import { toast } from './toast.js';

const $ = (s) => document.querySelector(s);

// Área principal: tela vazia, carregando, avisos, barra flutuante e comportamento da barra superior.
// A decisão "tem documento ou não" vem SEMPRE do store; o PDF é desenhado pelo renderer.
export function initViewer({ renderer, store, settings, search, onOpenFolder, onOpenFiles }) {
  const area = $('#viewerArea');
  const container = $('#viewerContainer');
  const empty = $('#emptyState');
  const loading = $('#loadingOverlay');
  const loadingText = $('#loadingText');
  const noticesEl = $('#notices');
  const floatbar = $('#floatbar');
  const pageLabel = $('#pageLabel');
  const zoomLabel = $('#zoomLabel');
  const btnMode = $('#btnMode');

  let shownId = null;
  let lastTop = 0;

  $('#emptyOpenFolder').addEventListener('click', onOpenFolder);
  $('#emptyOpenFiles').addEventListener('click', onOpenFiles);

  // ---- barra flutuante
  $('#fbPrev').addEventListener('click', () => renderer.prevPage());
  $('#fbNext').addEventListener('click', () => renderer.nextPage());
  $('#fbZoomIn').addEventListener('click', () => renderer.zoomIn());
  $('#fbZoomOut').addEventListener('click', () => renderer.zoomOut());
  $('#fbFit').addEventListener('click', () => renderer.toggleFit());
  btnMode.addEventListener('click', () => {
    settings.set({ viewMode: renderer.getMode() === 'single' ? 'continuous' : 'single' });
  });

  function updateFloat() {
    const tab = store.getActive();
    floatbar.hidden = !tab;
    if (!tab) return;
    const s = renderer.getState();
    const pages = s.pages || tab.numPages;
    pageLabel.textContent = `${s.page || tab.page} / ${pages}`;
    zoomLabel.textContent = s.scale ? `${Math.round(s.scale * 100)}%` : '';
    const single = s.mode === 'single';
    btnMode.innerHTML = icon(single ? 'single' : 'rows');
    btnMode.title = single ? 'Página individual (clique para rolagem contínua)' : 'Rolagem contínua (clique para página individual)';
  }
  renderer.subscribe(updateFloat);

  // ---- avisos (XFA, assinatura, senha…)
  function renderNotices(tab) {
    noticesEl.replaceChildren();
    area.classList.toggle('readonly', !!tab?.readOnly);
    if (!tab) return;
    for (const n of tab.notices) {
      if (tab.dismissed.has(n.id)) continue;
      const el = document.createElement('div');
      el.className = `notice ${n.level}`;
      const text = document.createElement('span');
      text.textContent = n.text;
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'notice-close';
      close.setAttribute('aria-label', 'Dispensar aviso');
      close.textContent = '×';
      close.addEventListener('click', () => {
        tab.dismissed.add(n.id);
        renderNotices(store.getActive());
      });
      el.append(text, close);
      noticesEl.append(el);
    }
  }

  // ---- sincronização com o store (único ponto de verdade)
  function sync() {
    const tab = store.getActive();
    loading.hidden = !store.isLoading();
    loadingText.textContent = store.loadingText;
    empty.hidden = !!tab; // "Nenhum documento aberto" some assim que há documento

    if (!tab) {
      if (shownId !== null) {
        renderer.clear();
        shownId = null;
        chrome.show();
      }
      renderNotices(null);
      updateFloat();
      return;
    }

    if (shownId !== tab.id) {
      shownId = tab.id;
      try {
        renderer.show(tab);
      } catch (err) {
        console.error(err);
        toast(`Falha ao exibir "${tab.name}": ${err?.message || err}`, 'error');
      }
      lastTop = 0;
      chrome.show();
      search.refresh();
    }
    renderNotices(tab);
    updateFloat();
  }

  // ---- barra superior dinâmica
  const isInteracting = () => {
    const ae = document.activeElement;
    return !!ae && ae !== document.body && !!ae.matches?.('input, textarea, select, [contenteditable="true"]');
  };

  container.addEventListener(
    'scroll',
    () => {
      const top = container.scrollTop;
      if (!settings.get().autoHideToolbar || chrome.locked() || isInteracting()) {
        lastTop = top;
        return;
      }
      const delta = top - lastTop;
      if (Math.abs(delta) < 10) return;
      if (delta > 0 && top > 80) chrome.setHidden(true);
      else if (delta < 0) chrome.setHidden(false);
      lastTop = top;
    },
    { passive: true }
  );

  container.addEventListener('click', (e) => {
    if (!settings.get().autoHideToolbar || !store.getActive()) return;
    // Nunca esconder ao interagir com campos, links ou anotações.
    if (e.target.closest('input, textarea, select, button, a, .annotationLayer section, .popupWrapper')) return;
    if (isInteracting()) return;
    if (String(window.getSelection?.() || '').length > 0) return; // selecionando texto
    chrome.setHidden(!chrome.isHidden());
  });

  // Teclado: setas / PageUp / PageDown no modo de página individual.
  document.addEventListener('keydown', (e) => {
    if (e.target.matches?.('input, textarea, select') || !store.getActive()) return;
    if (renderer.getMode() !== 'single') return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') {
      e.preventDefault();
      renderer.nextPage();
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      e.preventDefault();
      renderer.prevPage();
    }
  });

  return { sync };
}
