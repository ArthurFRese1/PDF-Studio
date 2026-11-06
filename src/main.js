import './style.css';

import { store } from './core/tab-manager.js';
import { openPdfFile, closeTab } from './core/pdf-manager.js';
import { createRenderer } from './core/pdf-renderer.js';

import { settings } from './features/settings.js';
import { library } from './features/file-library.js';
import { initSearch } from './features/search.js';
import { saveToOriginal, saveCopy } from './features/save.js';

import { applyIcons } from './components/icons.js';
import { initHeader } from './components/header.js';
import { initTabs } from './components/tabs.js';
import { initViewer } from './components/viewer.js';
import { initSidebar } from './components/sidebar.js';
import { chrome } from './components/chrome.js';
import { toast } from './components/toast.js';

const $ = (s) => document.querySelector(s);

async function boot() {
  applyIcons();
  await settings.load();
  settings.bindDialog();

  const app = $('#app');
  const isNarrow = () => window.matchMedia('(max-width: 800px)').matches;
  const setSidebar = (open) => app.classList.toggle('sidebar-open', open);
  setSidebar(!isNarrow());

  const renderer = await createRenderer($('#viewerContainer'), $('#viewer'), () => settings.get());

  library.bindInputs({ folder: $('#inputFolder'), files: $('#inputFiles') });

  const openFolder = () => library.pickFolder();
  const openFiles = () => library.pickFiles();

  const openLibraryNode = async (node) => {
    try {
      const file = node.handle ? await node.handle.getFile() : node.file;
      await openPdfFile(file, { handle: node.handle || null, path: node.path, libraryPath: node.path });
      if (isNarrow()) setSidebar(false);
    } catch (err) {
      console.error(err);
      toast(`Não foi possível abrir "${node.name}": ${err?.message || err}`, 'error');
    }
  };

  const search = initSearch({ renderer, store, settings });

  initHeader({
    store,
    onToggleSidebar: () => setSidebar(!app.classList.contains('sidebar-open')),
    onSearch: () => search.toggle(),
    onSave: () => saveToOriginal(store.getActive()),
    onSaveCopy: () => saveCopy(store.getActive()),
    onSettings: () => settings.openDialog(),
  });
  initTabs({ store, onClose: closeTab });
  initSidebar({
    library,
    store,
    onOpenFolder: openFolder,
    onOpenFiles: openFiles,
    onOpenNode: openLibraryNode,
    onClose: () => setSidebar(false),
  });
  $('#backdrop').addEventListener('click', () => setSidebar(false));

  const viewer = initViewer({ renderer, store, settings, search, onOpenFolder: openFolder, onOpenFiles: openFiles });

  // Estado único: toda mudança (abrir, fechar, trocar aba) passa por aqui.
  store.subscribe(viewer.sync);
  viewer.sync();

  // Preferências aplicadas ao vivo.
  let lastMode = settings.get().viewMode;
  settings.subscribe((prefs) => {
    if (prefs.viewMode !== lastMode) {
      lastMode = prefs.viewMode;
      renderer.setMode(prefs.viewMode);
    }
    if (!prefs.autoHideToolbar) chrome.show();
  });

  window.addEventListener('beforeunload', (e) => {
    if (store.getTabs().some((t) => t.dirty)) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f' && store.getActive()) {
      e.preventDefault();
      search.open();
    }
  });
}

boot().catch((err) => {
  console.error(err);
  document.body.innerHTML = `<pre style="color:#ffb4c6;padding:20px;white-space:pre-wrap">Falha ao iniciar o PDF-Studio:\n${String(err?.stack || err)}</pre>`;
});
