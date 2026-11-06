import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument, PDFName, PDFDict } from 'pdf-lib';
import { store } from './tab-manager.js';
import { toast } from '../components/toast.js';

// pdf_viewer.mjs lê o PDF.js de globalThis; precisa existir antes dele ser importado.
globalThis.pdfjsLib = pdfjsLib;
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const assetUrl = (p) => new URL(`${import.meta.env.BASE_URL}${p}`, document.baseURI).href;
const pending = new Set();

function friendlyError(e) {
  switch (e?.name) {
    case 'InvalidPDFException':
      return 'o arquivo está corrompido ou não é um PDF válido.';
    case 'MissingPDFException':
      return 'o arquivo não foi encontrado.';
    case 'PasswordException':
      return 'senha incorreta ou não informada.';
    default:
      return e?.message || 'erro desconhecido.';
  }
}

function loadPdf(data, name) {
  let needed = false;
  let cancelled = false;
  const task = pdfjsLib.getDocument({
    data,
    cMapUrl: assetUrl('pdfjs/cmaps/'),
    cMapPacked: true,
    standardFontDataUrl: assetUrl('pdfjs/standard_fonts/'),
    isEvalSupported: false,
    enableXfa: false,
  });
  task.onPassword = (updatePassword, reason) => {
    needed = true;
    const msg =
      reason === 2
        ? 'Senha incorreta. Tente novamente:'
        : `"${name}" é protegido por senha. Digite a senha (o documento será aberto somente para leitura):`;
    const pw = window.prompt(msg);
    if (pw === null) {
      cancelled = true;
      task.destroy();
    } else {
      updatePassword(pw);
    }
  };
  return task.promise
    .then((pdf) => ({ pdf, needed }))
    .catch((e) => {
      if (cancelled) throw new Error('abertura cancelada.');
      throw e;
    });
}

// Abre um File como nova aba. Se já estiver aberto, apenas seleciona a aba existente.
export async function openPdfFile(file, { handle = null, path = file.name, libraryPath = null } = {}) {
  const key = `${path}|${file.size}|${file.lastModified}`;

  const existing = store.findByKey(key);
  if (existing) {
    store.activate(existing.id);
    toast(`"${existing.name}" já está aberto.`);
    return existing;
  }
  if (pending.has(key)) return null;
  pending.add(key);
  store.beginLoading(`Abrindo ${file.name}…`);

  try {
    const buffer = await file.arrayBuffer();
    const head = new TextDecoder('latin1').decode(new Uint8Array(buffer, 0, Math.min(1024, buffer.byteLength)));
    if (!head.includes('%PDF-')) throw new Error('o arquivo não parece ser um PDF válido.');

    const { pdf, needed } = await loadPdf(new Uint8Array(buffer), file.name);

    let readOnly = needed;
    const notices = [];
    if (needed) {
      notices.push({ id: 'pwd', level: 'warn', text: 'Documento protegido por senha: aberto somente para leitura.' });
    } else {
      try {
        const perms = await pdf.getPermissions();
        if (perms) {
          readOnly = true;
          notices.push({
            id: 'perm',
            level: 'warn',
            text: 'Este PDF tem restrições de permissão: aberto somente para leitura, pois não é possível editar com segurança.',
          });
        }
      } catch {
        /* sem informação de permissões */
      }
    }

    const tab = store.add({
      key,
      name: file.name,
      path,
      libraryPath,
      file,
      handle,
      pdfDocument: pdf,
      numPages: pdf.numPages,
      readOnly,
      notices,
    });

    pdf.annotationStorage.onSetModified = () => {
      if (!tab.dirty) store.update(tab.id, { dirty: true });
    };

    detectExtras(tab); // assíncrono, não bloqueia a abertura
    return tab;
  } catch (e) {
    console.error(e);
    toast(`Não foi possível abrir "${file.name}": ${friendlyError(e)}`, 'error', 7000);
    return null;
  } finally {
    pending.delete(key);
    store.endLoading();
  }
}

function addNotice(tab, notice) {
  if (!store.get(tab.id)) return;
  store.update(tab.id, { notices: [...tab.notices, notice] });
}

// Detecta assinaturas digitais e formulários XFA (não suportados) sem travar a abertura.
async function detectExtras(tab) {
  try {
    const fields = await tab.pdfDocument.getFieldObjects();
    if (fields) {
      tab.hasForm = true;
      if (Object.values(fields).flat().some((f) => f.type === 'signature')) {
        tab.hasSignature = true;
        addNotice(tab, {
          id: 'sig',
          level: 'warn',
          text: 'Este PDF contém assinatura digital. Qualquer modificação pode invalidá-la.',
        });
      }
    }
  } catch {
    /* documento fechado ou sem campos */
  }

  try {
    if (tab.file.size > 60 * 1024 * 1024) return;
    const buf = await tab.file.arrayBuffer();
    const lib = await PDFDocument.load(buf, { ignoreEncryption: true, updateMetadata: false, throwOnInvalidObject: false });
    const acro = lib.catalog.lookupMaybe(PDFName.of('AcroForm'), PDFDict);
    if (acro && acro.has(PDFName.of('XFA'))) {
      addNotice(tab, {
        id: 'xfa',
        level: 'warn',
        text: 'Este documento usa formulários XFA, que não são suportados. Campos AcroForm (se existirem) funcionam normalmente; os campos XFA não serão exibidos nem editados.',
      });
    }
  } catch {
    /* detecção é apenas informativa */
  }
}

export function closeTab(id) {
  const tab = store.get(id);
  if (!tab) return;
  if (tab.dirty && !window.confirm(`"${tab.name}" tem alterações não salvas. Fechar mesmo assim?`)) return;
  store.remove(id); // seleciona outra aba (ou tela vazia) e o visualizador acompanha
  // Libera memória do worker depois que o visualizador já trocou de documento.
  setTimeout(() => {
    try {
      tab.pdfDocument.destroy();
    } catch {
      /* já destruído */
    }
  }, 0);
}
