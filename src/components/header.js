const $ = (s) => document.querySelector(s);

// Cabeçalho ÚNICO. Apenas liga os botões e reflete o estado do store.
export function initHeader({ store, onToggleSidebar, onSearch, onSave, onSaveCopy, onSettings }) {
  const btnSearch = $('#btnSearch');
  const btnSave = $('#btnSave');
  const btnCopy = $('#btnSaveCopy');

  $('#btnSidebar').addEventListener('click', onToggleSidebar);
  btnSearch.addEventListener('click', onSearch);
  btnSave.addEventListener('click', onSave);
  btnCopy.addEventListener('click', onSaveCopy);
  $('#btnSettings').addEventListener('click', onSettings);

  function render() {
    const tab = store.getActive();
    btnSearch.disabled = !tab;
    btnSave.disabled = !tab || tab.readOnly;
    btnSave.title = tab?.readOnly ? 'Documento somente leitura' : 'Salvar no arquivo original';
    btnSave.classList.toggle('dirty', !!tab?.dirty);
    btnCopy.disabled = !tab;
  }
  store.subscribe(render);
  render();
}
