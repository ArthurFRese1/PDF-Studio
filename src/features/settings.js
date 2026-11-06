// Preferências do visualizador, salvas em IndexedDB (com localStorage como reserva).
// Nunca armazena PDFs.

const DEFAULTS = {
  defaultZoom: 'page-width',
  viewMode: 'continuous',
  autoHideToolbar: true,
  highlightAll: true,
  searchCaseSensitive: false,
};

const DB_NAME = 'pdf-studio';
const STORE = 'settings';
const KEY = 'prefs';
const LS_KEY = 'pdf-studio:prefs';

let prefs = { ...DEFAULTS };
const listeners = new Set();

function openDb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('IndexedDB indisponível'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const r = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  } finally {
    db.close();
  }
}

async function idbPut(key, value) {
  const db = await openDb();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

function sanitize(raw) {
  const out = { ...DEFAULTS };
  if (!raw || typeof raw !== 'object') return out;
  for (const k of Object.keys(DEFAULTS)) {
    if (k in raw && typeof raw[k] === typeof DEFAULTS[k]) out[k] = raw[k];
  }
  return out;
}

async function persist() {
  try {
    await idbPut(KEY, prefs);
  } catch {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(prefs));
    } catch {
      /* sem armazenamento disponível: preferências valem apenas nesta sessão */
    }
  }
}

export const settings = {
  async load() {
    try {
      prefs = sanitize(await idbGet(KEY));
    } catch {
      try {
        prefs = sanitize(JSON.parse(localStorage.getItem(LS_KEY) || 'null'));
      } catch {
        prefs = { ...DEFAULTS };
      }
    }
  },
  get: () => prefs,
  set(patch) {
    prefs = sanitize({ ...prefs, ...patch });
    persist();
    listeners.forEach((fn) => fn(prefs));
  },
  reset() {
    prefs = { ...DEFAULTS };
    persist();
    listeners.forEach((fn) => fn(prefs));
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  // ---- diálogo
  bindDialog() {
    const $ = (s) => document.querySelector(s);
    $('#setZoom').addEventListener('change', (e) => settings.set({ defaultZoom: e.target.value }));
    $('#setMode').addEventListener('change', (e) => settings.set({ viewMode: e.target.value }));
    $('#setAutoHide').addEventListener('change', (e) => settings.set({ autoHideToolbar: e.target.checked }));
    $('#setHighlightAll').addEventListener('change', (e) => settings.set({ highlightAll: e.target.checked }));
    $('#setCase').addEventListener('change', (e) => settings.set({ searchCaseSensitive: e.target.checked }));
    $('#setReset').addEventListener('click', () => {
      settings.reset();
      settings.fillDialog();
    });
  },
  fillDialog() {
    const $ = (s) => document.querySelector(s);
    $('#setZoom').value = String(prefs.defaultZoom);
    $('#setMode').value = prefs.viewMode;
    $('#setAutoHide').checked = prefs.autoHideToolbar;
    $('#setHighlightAll').checked = prefs.highlightAll;
    $('#setCase').checked = prefs.searchCaseSensitive;
  },
  openDialog() {
    settings.fillDialog();
    document.querySelector('#settingsDialog').showModal();
  },
};
