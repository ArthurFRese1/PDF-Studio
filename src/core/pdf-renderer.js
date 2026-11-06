import 'pdfjs-dist/web/pdf_viewer.css';

const MIN_SCALE = 0.25;
const MAX_SCALE = 5;

const parseZoom = (v) => (v == null ? 'page-width' : Number.isNaN(parseFloat(v)) ? v : parseFloat(v));

// Envolve o PDFViewer do PDF.js. O PDF.js é usado como BIBLIOTECA, renderizando dentro
// da própria interface (sem iframe e sem visualizador embutido com cabeçalho próprio).
export async function createRenderer(container, viewerEl, getPrefs) {
  // Import dinâmico: pdf_viewer.mjs exige globalThis.pdfjsLib (definido em pdf-manager.js).
  const lib = await import('pdfjs-dist/web/pdf_viewer.mjs');

  const eventBus = new lib.EventBus();
  const linkService = new lib.PDFLinkService({
    eventBus,
    externalLinkTarget: 2,
    externalLinkRel: 'noopener noreferrer nofollow',
  });
  const findController = new lib.PDFFindController({ linkService, eventBus });
  const viewer = new lib.PDFViewer({
    container,
    viewer: viewerEl,
    eventBus,
    linkService,
    findController,
    textLayerMode: 1,
    annotationMode: 2, // renderiza e permite editar campos de formulário (AcroForm)
    annotationEditorMode: -1, // editores de anotação desativados
    maxCanvasPixels: 16777216,
  });
  linkService.setViewer(viewer);

  let current = null;
  let mode = getPrefs().viewMode === 'single' ? 'single' : 'continuous';
  const listeners = new Set();
  const notify = () => listeners.forEach((fn) => fn());

  const applyMode = () => {
    viewer.scrollMode = mode === 'single' ? 3 : 0; // 3 = uma página por vez, 0 = rolagem vertical contínua
  };

  eventBus.on('pagesinit', () => {
    if (!current) return;
    applyMode();
    viewer.currentScaleValue = current.scale ?? parseZoom(getPrefs().defaultZoom);
    if (current.page > 1) viewer.currentPageNumber = current.page;
    notify();
  });
  eventBus.on('pagechanging', ({ pageNumber }) => {
    if (current) current.page = pageNumber;
    notify();
  });
  eventBus.on('scalechanging', ({ scale, presetValue }) => {
    if (current) current.scale = presetValue || scale;
    notify();
  });

  // Reaplica o zoom "largura" quando a largura da área muda (girar tela, abrir painel lateral).
  let lastWidth = container.clientWidth;
  let resizeTimer = null;
  new ResizeObserver(() => {
    const w = container.clientWidth;
    if (w === lastWidth) return;
    lastWidth = w;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!current || !viewer.pdfDocument) return;
      const v = viewer.currentScaleValue;
      if (Number.isNaN(parseFloat(v))) viewer.currentScaleValue = v;
      else viewer.update();
    }, 120);
  }).observe(container);

  const setScaleNumber = (n) => {
    if (!viewer.pdfDocument) return;
    viewer.currentScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, n));
  };

  return {
    eventBus,
    viewer,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    // Mostra a aba no visualizador. setDocument é síncrono até trocar o documento.
    show(tab) {
      current = tab;
      viewer.setDocument(tab.pdfDocument);
      linkService.setDocument(tab.pdfDocument, null);
      notify();
    },
    clear() {
      current = null;
      viewer.setDocument(null);
      linkService.setDocument(null, null);
      notify();
    },
    getState() {
      return {
        page: viewer.currentPageNumber,
        pages: viewer.pagesCount,
        scale: viewer.currentScale,
        mode,
      };
    },
    getMode: () => mode,
    setMode(m) {
      mode = m === 'single' ? 'single' : 'continuous';
      if (viewer.pdfDocument) applyMode();
      notify();
    },
    zoomIn: () => setScaleNumber(viewer.currentScale * 1.2),
    zoomOut: () => setScaleNumber(viewer.currentScale / 1.2),
    setZoom(value) {
      if (viewer.pdfDocument) viewer.currentScaleValue = value;
    },
    toggleFit() {
      if (!viewer.pdfDocument) return;
      viewer.currentScaleValue = viewer.currentScaleValue === 'page-width' ? 'page-fit' : 'page-width';
    },
    nextPage: () => viewer.nextPage(),
    prevPage: () => viewer.previousPage(),
  };
}
