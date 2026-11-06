// Copia CMaps e fontes padrão do PDF.js para public/pdfjs, para que o app
// funcione sem nenhum serviço externo (fontes CJK e PDFs com fontes não embutidas).
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = resolve(root, 'node_modules', 'pdfjs-dist');
const dest = resolve(root, 'public', 'pdfjs');

for (const dir of ['cmaps', 'standard_fonts']) {
  const from = resolve(src, dir);
  if (!existsSync(from)) {
    console.warn(`[pdf-studio] pasta ${dir} não encontrada em pdfjs-dist; pulando.`);
    continue;
  }
  mkdirSync(dest, { recursive: true });
  cpSync(from, resolve(dest, dir), { recursive: true });
  console.log(`[pdf-studio] copiado: ${dir}`);
}
