import { openPdfFile } from '../core/pdf-manager.js';
import { store } from '../core/tab-manager.js';
import { toast } from '../components/toast.js';

// Detecção de suporte do navegador. Nada é simulado: se o navegador não entrega acesso
// à estrutura da pasta, a biblioteca informa isso em vez de fingir uma leitura recursiva.
export const support = {
  secure: window.isSecureContext,
  directoryPicker: typeof window.showDirectoryPicker === 'function',
  filePicker: typeof window.showOpenFilePicker === 'function',
  webkitDirectory: 'webkitdirectory' in document.createElement('input'),
};

const state = { root: null, mode: null, note: '' };
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());
let inputs = {};

const isPdf = (name) => /\.pdf$/i.test(name);
const dirNode = (name, path) => ({ type: 'dir', name, path, children: [], expanded: false, pdfs: 0 });

function supportNote() {
  if (support.directoryPicker) {
    return 'Acesso completo à pasta: navegue pelas subpastas e escolha os PDFs. "Salvar" pode gravar no arquivo original.';
  }
  if (support.webkitDirectory) {
    return 'Este navegador não tem a API de pastas. Usando o modo compatível (webkitdirectory): leitura e "Salvar cópia". Alguns navegadores Android podem não informar as subpastas.';
  }
  return 'Este navegador não permite selecionar pastas. Use "Abrir PDFs" para escolher arquivos individuais.';
}
state.note = supportNote();

// Ordena (pastas primeiro) e conta PDFs recursivamente.
function finalize(node) {
  if (node.type === 'file') return 1;
  node.children.sort((a, b) =>
    a.type !== b.type ? (a.type === 'dir' ? -1 : 1) : a.name.localeCompare(b.name, 'pt-BR', { numeric: true, sensitivity: 'base' })
  );
  node.pdfs = 0;
  for (const c of node.children) node.pdfs += finalize(c);
  return node.pdfs;
}

// ---- File System Access API (leitura recursiva real)
async function walk(dirHandle, node) {
  const entries = [];
  try {
    for await (const [name, handle] of dirHandle.entries()) entries.push([name, handle]);
  } catch (err) {
    console.warn(`Não foi possível ler "${node.path}":`, err);
    return;
  }
  for (const [name, handle] of entries) {
    if (name.startsWith('.')) continue;
    if (handle.kind === 'directory') {
      const child = dirNode(name, `${node.path}/${name}`);
      node.children.push(child);
      await walk(handle, child);
    } else if (isPdf(name)) {
      node.children.push({ type: 'file', name, path: `${node.path}/${name}`, handle });
    }
  }
}

async function loadFromDirectory(dirHandle) {
  store.beginLoading('Lendo a estrutura da pasta…');
  try {
    const root = dirNode(dirHandle.name, dirHandle.name);
    root.expanded = true;
    await walk(dirHandle, root);
    finalize(root);
    state.root = root;
    state.mode = 'fs';
    state.note = root.pdfs
      ? supportNote()
      : 'Nenhum PDF foi encontrado nesta pasta (as subpastas aparecem na árvore).';
    emit();
    if (!root.pdfs) toast('Nenhum PDF encontrado na pasta selecionada.', 'warn');
  } finally {
    store.endLoading();
  }
}

// ---- Alternativa: <input webkitdirectory>, preservando webkitRelativePath
function loadFromInput(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;

  const withPath = files.filter((f) => f.webkitRelativePath);

  // O navegador não informou a estrutura (comum em alguns Android): não inventamos hierarquia.
  if (!withPath.length) {
    const root = dirNode('Arquivos selecionados', 'Arquivos selecionados');
    root.expanded = true;
    for (const f of files.filter((f) => isPdf(f.name))) {
      root.children.push({ type: 'file', name: f.name, path: `${root.path}/${f.name}`, file: f });
    }
    finalize(root);
    state.root = root;
    state.mode = 'input-flat';
    state.note =
      'O navegador não informou a estrutura de subpastas (limitação do dispositivo/navegador). Mostrando apenas os PDFs recebidos, sem hierarquia.';
    emit();
    toast(
      root.pdfs ? 'O navegador não forneceu as subpastas; PDFs listados sem hierarquia.' : 'Nenhum PDF encontrado na seleção.',
      'warn',
      6500
    );
    return;
  }

  const rootName = withPath[0].webkitRelativePath.split('/')[0];
  const root = dirNode(rootName, rootName);
  root.expanded = true;
  const dirs = new Map([[rootName, root]]);

  for (const f of withPath) {
    const parts = f.webkitRelativePath.split('/');
    parts.shift(); // remove o nome da pasta raiz
    const fileName = parts.pop();
    if (parts.some((p) => p.startsWith('.')) || fileName.startsWith('.')) continue;

    let node = root;
    let path = rootName;
    for (const part of parts) {
      path = `${path}/${part}`;
      let child = dirs.get(path);
      if (!child) {
        child = dirNode(part, path);
        dirs.set(path, child);
        node.children.push(child);
      }
      node = child;
    }
    if (isPdf(fileName)) node.children.push({ type: 'file', name: fileName, path: `${path}/${fileName}`, file: f });
  }

  finalize(root);
  state.root = root;
  state.mode = 'input';
  state.note =
    'Modo compatível: a estrutura vem do navegador. Pastas totalmente vazias não são informadas neste modo. Use "Salvar cópia" para exportar.';
  emit();
  if (!root.pdfs) toast('Nenhum PDF encontrado na pasta selecionada.', 'warn');
}

async function pickFolder() {
  if (support.directoryPicker) {
    let dir = null;
    try {
      dir = await window.showDirectoryPicker({ id: 'pdf-studio', mode: 'readwrite' });
    } catch (e) {
      if (e?.name === 'AbortError') return;
      console.warn('showDirectoryPicker falhou; usando modo compatível:', e);
      toast('A API de pastas não funcionou aqui. Tentando o modo compatível…', 'warn');
    }
    if (dir) {
      try {
        await loadFromDirectory(dir);
      } catch (err) {
        console.error(err);
        toast(`Erro ao ler a pasta: ${err?.message || err}`, 'error');
      }
      return;
    }
  }
  if (support.webkitDirectory && inputs.folder) {
    inputs.folder.value = '';
    inputs.folder.click();
    return;
  }
  state.note = supportNote();
  emit();
  toast('Este navegador não permite selecionar pastas. Use "Abrir PDFs".', 'warn', 6500);
}

async function pickFiles() {
  if (support.filePicker) {
    try {
      const handles = await window.showOpenFilePicker({
        multiple: true,
        types: [{ description: 'Documentos PDF', accept: { 'application/pdf': ['.pdf'] } }],
      });
      for (const handle of handles) {
        const file = await handle.getFile();
        await openPdfFile(file, { handle, path: file.name });
      }
      return;
    } catch (e) {
      if (e?.name === 'AbortError') return;
      console.warn('showOpenFilePicker falhou; usando <input>:', e);
    }
  }
  inputs.files.value = '';
  inputs.files.click();
}

function bindInputs({ folder, files }) {
  inputs = { folder, files };
  folder.addEventListener('change', () => loadFromInput(folder.files));
  files.addEventListener('change', async () => {
    for (const file of Array.from(files.files || [])) {
      if (isPdf(file.name) || file.type === 'application/pdf') await openPdfFile(file, { path: file.name });
    }
  });
}

export const library = {
  support,
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  getState: () => state,
  pickFolder,
  pickFiles,
  bindInputs,
};
