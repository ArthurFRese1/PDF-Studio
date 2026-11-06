// ÚNICA fonte da verdade sobre documentos abertos.
// Abas, visualizador, cabeçalho e biblioteca leem daqui; ninguém mantém estado paralelo.

let counter = 0;
const tabs = new Map();
let order = [];
let activeId = null;
let loading = 0;
const listeners = new Set();

function emit() {
  for (const fn of [...listeners]) {
    try {
      fn();
    } catch (err) {
      console.error(err);
    }
  }
}

export const store = {
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  getTabs() {
    return order.map((id) => tabs.get(id));
  },
  get(id) {
    return tabs.get(id) || null;
  },
  getActive() {
    return activeId ? tabs.get(activeId) || null : null;
  },
  findByKey(key) {
    for (const t of tabs.values()) if (t.key === key) return t;
    return null;
  },
  add(data) {
    const id = `doc-${++counter}`;
    const tab = {
      id,
      page: 1,
      scale: null,
      dirty: false,
      readOnly: false,
      notices: [],
      dismissed: new Set(),
      ...data,
    };
    tabs.set(id, tab);
    order.push(id);
    activeId = id;
    emit();
    return tab;
  },
  activate(id) {
    if (!tabs.has(id) || activeId === id) return;
    activeId = id;
    emit();
  },
  update(id, patch) {
    const tab = tabs.get(id);
    if (!tab) return;
    Object.assign(tab, patch);
    emit();
  },
  // Remove a aba e seleciona o vizinho (ou nenhum, se era a última).
  remove(id) {
    const idx = order.indexOf(id);
    if (idx < 0) return null;
    const tab = tabs.get(id);
    order.splice(idx, 1);
    tabs.delete(id);
    if (activeId === id) activeId = order[idx] ?? order[idx - 1] ?? null;
    emit();
    return tab;
  },
  beginLoading(text) {
    loading += 1;
    store.loadingText = text || 'Carregando…';
    emit();
  },
  endLoading() {
    loading = Math.max(0, loading - 1);
    emit();
  },
  isLoading() {
    return loading > 0;
  },
  loadingText: 'Carregando…',
};
