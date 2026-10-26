export const content = (text = '', media = []) => ({ text, media });
export const newQuestion = (type = 'single') => ({
  id: crypto.randomUUID(), type, prompt: content('請輸入題目'), explanation: content(),
  ...(type === 'single' ? {
    options: [{ id: 'a', content: content('選項一') }, { id: 'b', content: content('選項二') }],
    answer: { option_id: 'a' },
  } : { answer: { accepted: ['請輸入可接受答案'] } }),
});
export const newDocument = () => ({ schema: 1, title: '未命名測驗', catalog: {
  school_year: '115', subject: '', publisher: '', volume: '', unit: '', learning_performance: '', learning_content: '',
}, blocks: [{ id: crypto.randomUUID(), material: content(), questions: [newQuestion()] }] });

// 匯入前先完整驗證，避免新檔案破壞正在編輯的草稿；後端仍另行強制驗證。
export function validateDocument(doc) {
  const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const id = x => typeof x === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(x);
  const fail = text => { throw new Error(`題庫格式錯誤：${text}`); };
  const checkContent = c => {
    if (!object(c) || typeof c.text !== 'string' || c.text.length > 20000 || !Array.isArray(c.media) || c.media.length > 8
      || Object.keys(c).some(k => !['text', 'media', 'layout'].includes(k))) fail('文字與媒體內容不完整。');
    for (const m of c.media) {
      if (!object(m) || !['image', 'audio'].includes(m.kind) || typeof m.url !== 'string' || !/^https:\/\/[^\s<>]+$/.test(m.url)
        || m.url.length > 2000 || typeof m.alt !== 'string' || m.alt.length > 500 || Object.keys(m).some(k => !['kind', 'url', 'alt'].includes(k))) fail('請確認圖片／音檔的 HTTPS 網址與說明。');
    }
    if (c.layout !== undefined) {
      let totalText = 0;
      const checkRuns = runs => {
        if (!Array.isArray(runs) || runs.length > 200) fail('圖文段落格式不完整。');
        for (const run of runs) {
          if (!object(run)) fail('圖文段落格式不完整。');
          if (run.type === 'text') {
            if (typeof run.text !== 'string' || Object.keys(run).some(k => !['type', 'text'].includes(k))) fail('圖文文字格式不完整。');
            totalText += run.text.length;
          } else if (run.type === 'image') {
            if (!Number.isInteger(run.media_index) || run.media_index < 0 || c.media[run.media_index]?.kind !== 'image'
              || !Number.isFinite(run.width) || run.width < 12 || run.width > 800
              || Object.keys(run).some(k => !['type', 'media_index', 'width'].includes(k))) fail('圖文圖片對應不完整。');
          } else fail('不支援此圖文格式。');
        }
      };
      if (!Array.isArray(c.layout) || !c.layout.length || c.layout.length > 100) fail('圖文內容格式不完整。');
      for (const part of c.layout) {
        if (!object(part)) fail('圖文內容格式不完整。');
        if (part.type === 'paragraph') {
          if (Object.keys(part).some(k => !['type', 'runs'].includes(k))) fail('圖文段落欄位不完整。');
          checkRuns(part.runs);
        } else if (part.type === 'table') {
          if (Object.keys(part).some(k => !['type', 'rows'].includes(k)) || !Array.isArray(part.rows) || !part.rows.length || part.rows.length > 30) fail('表格格式不完整。');
          let columns;
          for (const row of part.rows) {
            if (!Array.isArray(row) || !row.length || row.length > 12 || (columns !== undefined && row.length !== columns)) fail('表格欄數不一致。');
            columns = row.length;
            for (const cell of row) checkRuns(cell);
          }
        } else fail('不支援此圖文區塊。');
      }
      if (totalText > 20000) fail('圖文文字過長。');
    }
  };
  if (!object(doc) || doc.schema !== 1 || typeof doc.title !== 'string' || !doc.title.trim() || doc.title.length > 200
    || !object(doc.catalog) || JSON.stringify(doc.catalog).length > 4000 || !Array.isArray(doc.blocks) || !doc.blocks.length || doc.blocks.length > 100) fail('測驗標題、編目或區塊不完整。');
  for (const key of Object.keys(newDocument().catalog)) {
    if (doc.catalog[key] !== undefined && typeof doc.catalog[key] !== 'string') fail('編目欄位需使用文字。');
  }
  const blocks = new Set(), questions = new Set();
  for (const b of doc.blocks) {
    if (!object(b) || !id(b.id) || blocks.has(b.id) || !Array.isArray(b.questions) || !b.questions.length || b.questions.length > 30) fail('區塊識別碼或子題不完整。');
    blocks.add(b.id); checkContent(b.material);
    for (const q of b.questions) {
      if (!object(q) || !id(q.id) || questions.has(q.id) || !object(q.answer)
        || Object.keys(q).some(k => !['id', 'type', 'prompt', 'explanation', 'options', 'answer'].includes(k))) fail('題目識別碼、答案或欄位不完整。');
      questions.add(q.id); checkContent(q.prompt); checkContent(q.explanation);
      if (!q.prompt.text.trim()) fail('請填入題幹。');
      if (q.type === 'single') {
        if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 8) fail('選擇題需有 2～8 個選項。');
        const options = new Set();
        for (const o of q.options) {
          if (!object(o) || !id(o.id) || options.has(o.id)) fail('選項識別碼不能重複。');
          options.add(o.id); checkContent(o.content);
        }
        if (!options.has(q.answer.option_id)) fail('正解必須對應一個選項。');
      } else if (q.type === 'short') {
        if ('options' in q || !Array.isArray(q.answer.accepted) || !q.answer.accepted.length || q.answer.accepted.length > 20
          || q.answer.accepted.some(a => typeof a !== 'string' || !a.trim() || a.length > 2000)) fail('請填入簡答題可接受答案。');
      } else fail('僅支援選擇題與簡答題。');
    }
  }
  if (questions.size > 200) fail('每份測驗上限為 200 題。');
  return doc;
}

// 沿用既有 Wayground Markdown 的題號、A-D 選項、答案與圖片格式，
// 另保留「依據／解析」；不 import 會啟動 CDP 的舊 CLI。
export function importQuestionBank(markdown) {
  const title = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const matches = [...markdown.matchAll(/^(\d+)\.\s+(.+)(?:\r?\n|$)/gm)];
  if (!title || !matches.length) throw new Error('找不到題庫標題或編號題目。');
  const seen = new Set();
  const blocks = matches.map((match, index) => {
    if (seen.has(match[1])) throw new Error(`第 ${match[1]} 題題號重複。`);
    seen.add(match[1]);
    const body = markdown.slice(match.index + match[0].length, matches[index + 1]?.index ?? markdown.length);
    const lines = body.split(/\r?\n/);
    const opts = []; const stem = [match[2]]; const explanation = []; const media = [];
    let current = stem; let metadata = false; let answer;
    for (const raw of lines) {
      const line = raw.trim(); if (!line) continue;
      const am = line.match(/^答案[:：]\s*([A-D])\s*$/);
      const om = line.match(/^([A-D])\.\s*(.*)$/);
      const im = line.match(/^(?:圖片|image)[:：]\s*(https:\/\/\S+)$/i);
      if (am) { answer = am[1].toLowerCase(); metadata = true; }
      else if (im) media.push({ kind: 'image', url: im[1], alt: `第 ${match[1]} 題附圖` });
      else if (om && !metadata) { const value = []; opts.push({ id: om[1].toLowerCase(), value }); current = value; value.push(om[2]); }
      else if (/^(依據|解析)[:：]/.test(line)) { explanation.push(line.replace(/^(依據|解析)[:：]\s*/, '')); metadata = true; }
      else if (/^(Bloom|難度|難易度|圖表需求|驗算|出題狀態)[:：]/.test(line) || /^##|^---/.test(line)) metadata = true;
      else if (!metadata) current.push(line);
    }
    if (!answer || opts.length !== 4 || new Set(opts.map(o => o.id)).size !== 4 || !opts.some(o => o.id === answer)) {
      throw new Error(`第 ${match[1]} 題需有 A-D 四個選項及一個答案；尚未匯入任何題目。`);
    }
    return { id: crypto.randomUUID(), material: content(), questions: [{
      id: crypto.randomUUID(), type: 'single', prompt: content(stem.join('\n'), media),
      options: opts.map(o => ({ id: o.id, content: content(o.value.join('\n')) })),
      answer: { option_id: answer }, explanation: content(explanation.join('\n')),
    }] };
  });
  return { ...newDocument(), title, blocks };
}
