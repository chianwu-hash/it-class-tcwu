import {createSketchEditor, sketchImage} from './sketch/editor.mjs';
import {validateSketch} from './sketch/contract.mjs';

const originals = {
  'hlg3m_00ce7fd0_grouping_v1': ['ef26594fe0d9766a77fc6a983dc6cc93d5676154b2008dfb05246c9c28e03364', 343, 344],
  'hlg3m_01220388_grouping_v1': ['82d565409fa10092f25623b6b6ea0c5f60e6244cdae4686d68b4f57c3a6bc220', 2400, 855],
  'hlg3m_0262d7c8_grouping_v1': ['3d43ee914fa34b9013476c2f36568b3f7cc941921001857b3e012146fc9b0c85', 594, 162],
  'hlg3m_028342b7_grouping_v1': ['b7458492741a68908bbc32e4b6cfa4e9d283ff9c035e8a3b53a6a06478398272', 2400, 1374],
};

export function groupingDrawingPlan(question) {
  if (question?.type !== 'fields' || question.work?.input !== 'sketch' ||
      question.fields?.length !== 2 || question.fields.some(field => field.input !== 'math') ||
      !Object.hasOwn(originals, question.id)) return null;
  const prompt = question.prompt;
  const [sha, width, height] = originals[question.id];
  const image = prompt?.media?.[0];
  if (prompt?.layout || prompt?.media?.length !== 1 || image.kind !== 'image' ||
      !image.url?.startsWith('https://quiz-media.invalid/') || !image.url.endsWith('/' + sha)) return null;
  return {image, width, height, passage: {text: prompt.text, media: []}};
}

export function renderGroupingDrawing(host, plan, {value, onChange, locked, renderContent}) {
  const doc = host.ownerDocument;
  const art = doc.createElement('div');
  renderContent(art, {text: '', media: [plan.image]});
  const image = art.querySelector('img');
  if (!image) return null;
  const figure = image.closest('figure');
  if (figure) figure.style.margin = '0';
  const board = doc.createElement('div');
  board.className = 'quiz-grouping-drawing';
  Object.assign(board.style, {
    position: 'relative', width: 'min(100%, 620px)', aspectRatio: plan.width + '/' + plan.height,
  });
  image.before(board);
  board.append(image);
  const cover = {position: 'absolute', inset: '0', width: '100%', height: '100%',
    maxHeight: 'none', margin: '0', padding: '0', border: '0', borderRadius: '0'};
  Object.assign(image.style, cover, {objectFit: 'fill'});

  let overlay, editor, tools;
  if (locked) {
    try {
      overlay = sketchImage(validateSketch(value));
      overlay.setAttribute('aria-label', '已保存的分組圈畫');
      overlay.style.pointerEvents = 'none';
    } catch {
      const notice = doc.createElement('p');
      notice.textContent = '這份作答沒有可顯示的圈畫。';
      host.append(notice);
    }
  } else {
    tools = doc.createElement('div');
    const drawing = doc.createElement('div');
    editor = createSketchEditor(drawing, {
      value: Array.isArray(value?.strokes) ? value : undefined, onChange, toolbarHost: tools,
      messages: {boardLabel: '分組圈畫作答區', drawHint: '用滑鼠或手指在圖上圈出每一組。'},
    });
    tools.classList.add('sketch-editor');
    tools.querySelector('.sketch-palette').style.display = 'none';
    overlay = drawing.querySelector('.camp-sketch-board');
    board.classList.add('sketch-editor');
    tools.append(drawing.querySelector('[role="status"]'));
    host.append(tools);
  }
  if (overlay) {
    overlay.setAttribute('preserveAspectRatio', 'none');
    Object.assign(overlay.style, cover, {aspectRatio: 'auto', background: 'transparent'});
    const update = () => {
      overlay.style.visibility = image.complete && image.naturalWidth === plan.width ? 'visible' : 'hidden';
    };
    image.addEventListener('load', update);
    image.addEventListener('error', update);
    update();
    board.append(overlay);
  }
  host.append(art);
  return editor ? {...editor, destroy() { editor.destroy(); overlay.remove(); tools.remove(); }} : null;
}
