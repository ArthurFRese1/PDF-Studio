import { exportPdf } from '../core/pdf-editor.js';
import { store } from '../core/tab-manager.js';
import { toast } from '../components/toast.js';

const baseName = (name) => name.replace(/\.pdf$/i, '');

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}

function markClean(tab) {
  try {
    tab.pdfDocument.annotationStorage.resetModified?.();
  } catch {
    /* ignore */
  }
  store.update(tab.id, { dirty: false });
}

// Salvar: grava no arquivo original apenas se o navegador deu acesso (handle) e o usuário confirmou.
export async function saveToOriginal(tab) {
  if (!tab) return;

  if (tab.readOnly) {
    toast('Documento em modo somente leitura. Use "Salvar cópia" para exportar o arquivo.', 'warn', 6500);
    return;
  }
  if (!tab.handle || typeof tab.handle.createWritable !== 'function') {
    toast(
      'Este navegador não deu acesso para gravar no arquivo original (comum no Android e em seleções via input). Use "Salvar cópia" para exportar o PDF modificado.',
      'warn',
      8000
    );
    return;
  }

  try {
    // Permissão primeiro, enquanto o gesto do usuário ainda é válido.
    if (tab.handle.queryPermission) {
      let perm = await tab.handle.queryPermission({ mode: 'readwrite' });
      if (perm !== 'granted') perm = await tab.handle.requestPermission({ mode: 'readwrite' });
      if (perm !== 'granted') throw new Error('permissão de escrita negada.');
    }

    const sig = tab.hasSignature ? '\n\nAtenção: este PDF tem assinatura digital, que pode ser invalidada.' : '';
    if (!window.confirm(`Sobrescrever o arquivo original "${tab.name}" com as alterações?${sig}`)) return;

    const bytes = await exportPdf(tab);
    const writable = await tab.handle.createWritable();
    await writable.write(bytes);
    await writable.close();
    markClean(tab);
    toast(`"${tab.name}" salvo no arquivo original.`, 'ok');
  } catch (err) {
    console.error(err);
    toast(`Não foi possível salvar no original: ${err?.message || err}. Use "Salvar cópia".`, 'error', 8000);
  }
}

// Salvar cópia: o usuário escolhe onde salvar (quando suportado) ou baixa o arquivo.
export async function saveCopy(tab) {
  if (!tab) return;
  const suggestedName = `${baseName(tab.name)} (cópia).pdf`;

  try {
    // O seletor precisa ser aberto logo, enquanto o gesto do usuário ainda vale.
    if (typeof window.showSaveFilePicker === 'function') {
      let handle = null;
      try {
        handle = await window.showSaveFilePicker({
          suggestedName,
          types: [{ description: 'Documento PDF', accept: { 'application/pdf': ['.pdf'] } }],
        });
      } catch (e) {
        if (e?.name === 'AbortError') return;
        console.warn('showSaveFilePicker falhou; usando download:', e);
      }
      if (handle) {
        const bytes = tab.readOnly ? new Uint8Array(await tab.file.arrayBuffer()) : await exportPdf(tab);
        const writable = await handle.createWritable();
        await writable.write(bytes);
        await writable.close();
        toast('Cópia salva.', 'ok');
        return;
      }
    }

    const bytes = tab.readOnly ? new Uint8Array(await tab.file.arrayBuffer()) : await exportPdf(tab);
    download(new Blob([bytes], { type: 'application/pdf' }), suggestedName);
    toast('Download da cópia iniciado.', 'ok');
  } catch (err) {
    console.error(err);
    toast(`Não foi possível salvar a cópia: ${err?.message || err}`, 'error', 8000);
  }
}
