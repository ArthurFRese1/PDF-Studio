import { icon } from './icons.js';

const $ = (s) => document.querySelector(s);

// Biblioteca: árvore de pastas/subpastas com os PDFs. Clicar em um PDF abre SÓ aquele arquivo.
export function initSidebar({ library, store, onOpenFolder, onOpenFiles, onOpenNode, onClose }) {
  const tree = $('#tree');
  const title = $('#libraryTitle');
  const note = $('#libraryNote');
  const fileEls = new Map();

  $('#btnOpenFolder').addEventListener('click', onOpenFolder);
  $('#btnOpenFiles').addEventListener('click', onOpenFiles);
  $('#btnCloseSidebar').addEventListener('click', onClose);

  const el = (tag, cls) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  };

  function renderFile(node, depth) {
    const li = el('li', 'node');
    li.setAttribute('role', 'treeitem');
    const row = el('button', 'row file');
    row.type = 'button';
    row.style.setProperty('--d', depth);
    row.title = node.path;
    const spacer = el('span', 'caret');
    const ico = el('span', 'ico-wrap');
    ico.innerHTML = icon('file', 16);
    const name = el('span', 'nm');
    name.textContent = node.name;
    row.append(spacer, ico, name);
    row.addEventListener('click', () => onOpenNode(node));
    li.append(row);
    fileEls.set(node.path, row);
    return li;
  }

  function renderDir(node, depth) {
    const li = el('li', 'node');
    li.setAttribute('role', 'treeitem');

    const row = el('button', 'row dir');
    row.type = 'button';
    row.style.setProperty('--d', depth);
    const caret = el('span', 'caret');
    const ico = el('span', 'ico-wrap');
    const name = el('span', 'nm');
    name.textContent = node.name;
    const cnt = el('span', 'cnt');
    cnt.textContent = String(node.pdfs);
    cnt.title = `${node.pdfs} PDF(s) nesta pasta e subpastas`;
    row.append(caret, ico, name, cnt);

    const kids = el('ul');
    kids.setAttribute('role', 'group');
    let built = false;

    const build = () => {
      if (built) return;
      built = true;
      if (!node.children.length) {
        const e = el('li', 'empty-note');
        e.textContent = '(pasta vazia)';
        e.style.setProperty('--d', depth + 1);
        kids.append(e);
      }
      for (const c of node.children) kids.append(c.type === 'dir' ? renderDir(c, depth + 1) : renderFile(c, depth + 1));
      applyOpen();
    };

    const sync = () => {
      kids.hidden = !node.expanded;
      li.setAttribute('aria-expanded', String(node.expanded));
      caret.innerHTML = icon(node.expanded ? 'chevron-down' : 'chevron-right', 14);
      ico.innerHTML = icon(node.expanded ? 'folder-open' : 'folder', 16);
      if (node.expanded) build();
    };

    row.addEventListener('click', () => {
      node.expanded = !node.expanded;
      sync();
    });
    sync();
    li.append(row, kids);
    return li;
  }

  function applyOpen() {
    const open = new Set(store.getTabs().map((t) => t.libraryPath).filter(Boolean));
    const activePath = store.getActive()?.libraryPath;
    for (const [path, row] of fileEls) {
      row.classList.toggle('open', open.has(path));
      row.classList.toggle('active', path === activePath);
    }
  }

  function build() {
    const { root, note: text } = library.getState();
    tree.replaceChildren();
    fileEls.clear();
    note.textContent = text;

    if (!root) {
      title.textContent = 'Biblioteca';
      const hint = el('p', 'tree-hint');
      hint.textContent = 'Nenhuma pasta aberta. Use "Abrir pasta" para navegar pela sua coleção.';
      tree.append(hint);
      return;
    }
    title.textContent = `${root.name} · ${root.pdfs} PDF${root.pdfs === 1 ? '' : 's'}`;
    const ul = el('ul', 'tree-list');
    ul.setAttribute('role', 'group');
    ul.append(renderDir(root, 0));
    tree.append(ul);
  }

  library.subscribe(build);
  store.subscribe(applyOpen);
  build();
}
