import { PDFDocument, PDFTextField, PDFCheckBox, PDFRadioGroup, PDFDropdown, PDFOptionList } from 'pdf-lib';

// Gera os bytes do PDF com os valores dos campos preenchidos.
// 1) Caminho principal: PDF.js grava o annotationStorage (fiel ao que o usuário vê).
// 2) Alternativa: pdf-lib aplica os valores diretamente nos campos AcroForm.
export async function exportPdf(tab) {
  try {
    const data = await tab.pdfDocument.saveDocument();
    return new Uint8Array(data);
  } catch (err) {
    console.warn('saveDocument falhou, usando pdf-lib:', err);
    return exportWithPdfLib(tab);
  }
}

async function exportWithPdfLib(tab) {
  const source = await tab.file.arrayBuffer();
  const pdf = await PDFDocument.load(source, { updateMetadata: false });
  const form = pdf.getForm();

  const serializable = tab.pdfDocument.annotationStorage.serializable;
  const map = serializable instanceof Map ? serializable : serializable?.map instanceof Map ? serializable.map : new Map();

  const objects = (await tab.pdfDocument.getFieldObjects()) || {};
  const byId = new Map();
  for (const [name, list] of Object.entries(objects)) {
    for (const obj of list) byId.set(obj.id, { name, obj });
  }

  for (const [id, val] of map) {
    const ref = byId.get(id);
    if (!ref || !val) continue;
    let field;
    try {
      field = form.getField(ref.name);
    } catch {
      continue;
    }
    try {
      const v = val.value;
      if (field instanceof PDFTextField) {
        field.setText(v == null || v === '' ? undefined : String(v));
      } else if (field instanceof PDFCheckBox) {
        if (v) field.check();
        else field.uncheck();
      } else if (field instanceof PDFRadioGroup) {
        if (v && ref.obj.exportValue != null) field.select(String(ref.obj.exportValue));
      } else if (field instanceof PDFDropdown || field instanceof PDFOptionList) {
        const arr = Array.isArray(v) ? v : [v];
        field.select(arr.filter((x) => x != null).map(String));
      }
    } catch (err) {
      console.warn(`Campo "${ref.name}" não pôde ser aplicado:`, err);
    }
  }

  return pdf.save();
}
