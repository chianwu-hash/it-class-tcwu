import { resolveQuizMedia } from './quiz-media.mjs';
export function renderContent(container, content, { strict = false, loadMedia = true, imageLoading = 'lazy' } = {}) {
  const box = document.createElement('div'); box.className = 'preview-content';
  if (content?.layout) {
    box.classList.add('quiz-rich-content');
    const runs = (parent, values) => {
      for (const run of values) {
        if (run.type === 'text') {
          renderContent(parent, { text: run.text, media: [] }, { strict, loadMedia, imageLoading });
        } else {
          const media = content.media[run.media_index];
          const image = document.createElement('span'); image.className = 'quiz-embedded-image';
          image.style.width = `${run.width}px`;
          renderContent(image, { text: '', media: [media] }, { strict, loadMedia, imageLoading });
          parent.append(image);
        }
      }
    };
    for (const part of content.layout) {
      if (part.type === 'paragraph') {
        const p = document.createElement('div'); p.className = 'quiz-rich-paragraph';
        if (part.runs.some(r => r.type === 'image') && part.runs.every(r => r.type === 'image' || !r.text.trim())) p.classList.add('quiz-image-row');
        runs(p, p.classList.contains('quiz-image-row') ? part.runs.filter(r => r.type === 'image') : part.runs); box.append(p);
      } else {
        const wrapper = document.createElement('div'); wrapper.className = 'quiz-table-wrap';
        const table = document.createElement('table'), body = document.createElement('tbody'); table.className = 'quiz-content-table';
        part.rows.forEach((row, index) => {
          const tr = document.createElement('tr');
          for (const values of row) { const cell = document.createElement(index === 0 ? 'th' : 'td'); if (index === 0) cell.scope = 'col'; runs(cell, values); tr.append(cell); }
          body.append(tr);
        });
        table.append(body); wrapper.append(table); box.append(wrapper);
      }
    }
    container.append(box); return box;
  }
  const text = content?.text || ''; let end = 0;
  const expressions = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
  for (const match of text.matchAll(expressions)) {
    box.append(document.createTextNode(text.slice(end, match.index)));
    const span = document.createElement('span');
    try {
      if (!window.katex) throw new Error('公式元件尚未載入，請重新整理。');
      // 國小題目中的行內分數仍使用完整分子／分母字級，避免縮成難讀小字。
      window.katex.render(`\\displaystyle ${match[1] ?? match[2]}`, span, {
        displayMode: match[1] !== undefined, throwOnError: true, trust: false,
        strict: 'error', maxExpand: 1000, maxSize: 20, output: 'htmlAndMathml',
      });
    } catch (error) {
      if (strict) throw new Error(`公式無法排版：${error.message}`);
      span.textContent = `公式無法排版：${match[0]}`; span.className = 'formula-error';
    }
    box.append(span); end = match.index + match[0].length;
  }
  box.append(document.createTextNode(text.slice(end)));
  for (const media of content?.media || []) {
    const figure = document.createElement('figure');
    let url; try { url = new URL(media.url); } catch { throw new Error('請輸入完整的 HTTPS 圖片或音檔網址。'); }
    if (url.protocol !== 'https:') throw new Error('圖片與音檔必須使用 HTTPS 網址。');
    if (!['image', 'audio'].includes(media.kind)) throw new Error('不支援此媒體格式。');
    if (!loadMedia) continue;
    const element = document.createElement(media.kind === 'image' ? 'img' : 'audio');
    element.dataset.quizMediaUrl = url.href;
    if (media.kind === 'image') { element.alt = media.alt; element.loading = imageLoading; }
    else { element.controls = true; element.preload = 'none'; }
    const failed = () => {
      if (!figure.querySelector('[role="alert"]')) {
        const error = document.createElement('p'); error.setAttribute('role', 'alert');
        error.textContent = `${media.kind === 'image' ? '圖片' : '音檔'}無法載入，請確認網址與存取權限。`; figure.append(error);
        const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = '重新載入媒體';
        retry.addEventListener('click', async () => {
          retry.disabled = true;
          try {
            const src = await resolveQuizMedia(url.href);
            if (!figure.isConnected) return;
            error.remove(); retry.remove(); element.src = src;
            if (media.kind === 'audio') element.load();
          } catch { retry.disabled = false; }
        });
        figure.append(retry);
      }
    };
    element.addEventListener('error', failed);
    const caption = document.createElement('figcaption'); caption.textContent = media.alt;
    figure.append(element, caption); box.append(figure);
    // 不把短效下載網址寫回草稿／固定版本。移除的題目不再啟動媒體。
    resolveQuizMedia(url.href).then(src => { if (figure.isConnected) element.src = src; }).catch(failed);
  }
  container.append(box); return box;
}

export function renderTeacherPreview(container, doc, { strict = false, loadMedia = true } = {}) {
  container.replaceChildren();
  for (const [index, block] of doc.blocks.entries()) {
    const section = document.createElement('section'); section.className = 'block';
    const heading = document.createElement('h3'); heading.textContent = `區塊 ${index + 1}${block.questions.length > 1 ? ' · 共用材料題組' : ''}`;
    section.append(heading); renderContent(section, block.material, { strict, loadMedia });
    for (const [i, q] of block.questions.entries()) {
      const article = document.createElement('article'); article.className = 'question';
      const title = document.createElement('h4'); title.textContent = `${index + 1}-${i + 1}　${q.type === 'single' ? '選擇題' : '簡答題'}`; article.append(title);
      renderContent(article, q.prompt, { strict, loadMedia });
      for (const [j, option] of (q.options || []).entries()) {
        const row = document.createElement('div'); row.className = 'preview-option';
        const label = document.createElement('strong'); label.textContent = `${String.fromCharCode(65 + j)}. `; row.append(label);
        renderContent(row, option.content, { strict, loadMedia }); article.append(row);
      }
      const answer = document.createElement('div'); answer.className = 'answer-preview';
      const label = document.createElement('strong'); label.textContent = q.type === 'single'
        ? `正解：${String.fromCharCode(65 + q.options.findIndex(o => o.id === q.answer.option_id))}`
        : `可接受答案：${q.answer.accepted.join('、')}`;
      answer.append(label); renderContent(answer, q.explanation, { strict, loadMedia }); article.append(answer); section.append(article);
    }
    container.append(section);
  }
}
