const $ = (s) => document.querySelector(s);

export function initTabs({ store, onClose }) {
  const nav = $('#tabs');

  function render() {
    const tabs = store.getTabs();
    const activeId = store.getActive()?.id;
    nav.hidden = tabs.length === 0;
    nav.replaceChildren();

    for (const tab of tabs) {
      const active = tab.id === activeId;
      const el = document.createElement('div');
      el.className = `tab${active ? ' active' : ''}`;
      el.setAttribute('role', 'tab');
      el.setAttribute('aria-selected', String(active));
      el.dataset.id = tab.id;
      el.title = tab.path;
      el.tabIndex = 0;

      const name = document.createElement('span');
      name.className = 'tab-name';
      name.textContent = tab.name;

      const mod = document.createElement('span');
      mod.className = 'tab-mod';
      mod.hidden = !tab.dirty;
      mod.title = 'Alterações não salvas';
      mod.textContent = '●';

      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'tab-close';
      close.setAttribute('aria-label', `Fechar ${tab.name}`);
      close.textContent = '×';

      el.append(name, mod, close);
      nav.append(el);
    }
    nav.querySelector('.tab.active')?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }

  nav.addEventListener('click', (e) => {
    const el = e.target.closest('.tab');
    if (!el) return;
    if (e.target.closest('.tab-close')) onClose(el.dataset.id);
    else store.activate(el.dataset.id);
  });
  nav.addEventListener('auxclick', (e) => {
    const el = e.target.closest('.tab');
    if (el && e.button === 1) {
      e.preventDefault();
      onClose(el.dataset.id);
    }
  });
  nav.addEventListener('keydown', (e) => {
    const el = e.target.closest('.tab');
    if (el && (e.key === 'Enter' || e.key === ' ') && e.target === el) {
      e.preventDefault();
      store.activate(el.dataset.id);
    }
  });

  store.subscribe(render);
  render();
}
