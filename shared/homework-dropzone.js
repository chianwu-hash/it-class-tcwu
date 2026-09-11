// Keep the native file input for keyboard, touch and file-picker support.
export function createHomeworkDropzone(input, { isLocked, maxBytes }) {
  const zone = document.createElement('div');
  zone.className = 'homework-dropzone';
  const title = document.createElement('strong');
  title.textContent = '把作品拖曳到這裡';
  const hint = document.createElement('span');
  hint.textContent = '也可以點這裡選擇檔案・每次一個作品';
  const selection = document.createElement('span');
  selection.className = 'dropzone-selection';
  const notice = document.createElement('span');
  notice.className = 'dropzone-notice';
  notice.id = `${input.id}-notice`;
  notice.setAttribute('role', 'status');
  input.setAttribute('aria-describedby', notice.id);
  zone.append(title, hint, selection, notice, input);
  let depth = 0;
  const resetDrag = () => { depth = 0; zone.classList.remove('is-dragging'); };
  const errorFor = file => {
    if (!file.size || file.size > maxBytes()) return `請選擇非空白且不超過 ${Math.floor(maxBytes() / 1048576)} MB 的檔案。`;
    if (!input.accept.split(',').some(ext => file.name.toLowerCase().endsWith(ext.trim()))) return '這個檔案格式不支援，請選擇圖片、影片、文件或 Scratch 等作品。';
    return '';
  };
  input.addEventListener('change', () => {
    const file = input.files[0];
    const error = file ? errorFor(file) : '';
    if (error) input.value = '';
    selection.textContent = file && !error ? `已選擇：${file.name}（${(file.size / 1048576).toFixed(2)} MB）` : '';
    notice.textContent = error || (file ? '選好了！請按下方按鈕上傳。' : '');
  });
  zone.addEventListener('dragenter', event => {
    event.preventDefault();
    if (!isLocked()) { depth++; zone.classList.add('is-dragging'); }
  });
  zone.addEventListener('dragover', event => {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = isLocked() ? 'none' : 'copy';
  });
  zone.addEventListener('dragleave', event => {
    event.preventDefault();
    if (--depth <= 0) resetDrag();
  });
  zone.addEventListener('drop', event => {
    event.preventDefault();
    resetDrag();
    if (isLocked()) return;
    const files = event.dataTransfer?.files;
    const retained = input.files.length ? ' 原本選好的檔案仍保留。' : '';
    if (files?.length !== 1) { notice.textContent = '一次請拖入一個作品檔案。' + retained; return; }
    const error = errorFor(files[0]);
    if (error) { notice.textContent = error + retained; return; }
    const transfer = new DataTransfer();
    transfer.items.add(files[0]);
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  return zone;
}
