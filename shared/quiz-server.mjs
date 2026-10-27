import { renderContent as renderQuizContent } from './quiz-render.mjs';

// Claude Opus 5.5 原創四套圖形與動作；Codex整合，原型中的題目線索改為中性文字。
const quizFeedbackMotion = (function () {
  'use strict';

  var STAR_D = 'M0 -14 L3.5 -4.9 L13.3 -4.3 L5.7 1.9 L8.2 11.3 L0 6 L-8.2 11.3 L-5.7 1.9 L-13.3 -4.3 L-3.5 -4.9 Z';
  var SENTINEL = '<rect class="qfm-sentinel" x="0" y="0" width="1" height="1" fill="none"/>';

  function wrap(inner, label) {
    return '<svg viewBox="0 0 240 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">' + inner + SENTINEL + '</svg>';
  }
  function mouth(result, y, color) {
    return result === 'correct'
      ? '<path d="M111 ' + y + ' Q120 ' + (y + 12) + ' 129 ' + y + ' Z" fill="' + color + '" stroke="' + color + '" stroke-width="2" stroke-linejoin="round"/>'
      : '<path d="M113 ' + (y + 1) + ' Q120 ' + (y + 7) + ' 127 ' + (y + 1) + '" stroke="' + color + '" stroke-width="3" fill="none" stroke-linecap="round"/>';
  }

  /* ---------- 1. 星光夥伴 ---------- */
  function svgStar(result) {
    var c = '' +
      '<ellipse cx="120" cy="185" rx="46" ry="6" fill="#ebe6f8"/>' +
      '<g class="qfm-whole">' +
        '<g class="qfm-ear qfm-ear-l"><path d="M86 104 L92 64 L116 92 Z" fill="#7b86e8" stroke="#7b86e8" stroke-width="8" stroke-linejoin="round"/><path d="M93 92 L95 77 L104 88 Z" fill="#ffc9de"/></g>' +
        '<g class="qfm-ear qfm-ear-r"><path d="M154 104 L148 64 L124 92 Z" fill="#7b86e8" stroke="#7b86e8" stroke-width="8" stroke-linejoin="round"/><path d="M147 92 L145 77 L136 88 Z" fill="#ffc9de"/></g>' +
        '<ellipse cx="104" cy="181" rx="11" ry="5" fill="#6570d4"/><ellipse cx="136" cy="181" rx="11" ry="5" fill="#6570d4"/>' +
        '<ellipse cx="120" cy="134" rx="48" ry="47" fill="#7b86e8"/>' +
        '<ellipse cx="120" cy="153" rx="27" ry="22" fill="#e3e7ff"/>' +
        '<circle cx="94" cy="139" r="5.5" fill="#ffb3cf" opacity=".75"/><circle cx="146" cy="139" r="5.5" fill="#ffb3cf" opacity=".75"/>' +
        '<g class="qfm-eyes"><g class="qfm-lid"><ellipse cx="104" cy="124" rx="6" ry="7.5" fill="#2d2a4a"/><circle cx="106" cy="121" r="2" fill="#fff"/></g><g class="qfm-lid"><ellipse cx="136" cy="124" rx="6" ry="7.5" fill="#2d2a4a"/><circle cx="138" cy="121" r="2" fill="#fff"/></g></g>' +
        mouth(result, 137, '#2d2a4a') +
        '<g class="qfm-arm qfm-arm-l"><rect x="71" y="122" width="14" height="32" rx="7" fill="#6570d4"/><circle cx="78" cy="152" r="7.5" fill="#6570d4"/></g>' +
        '<g class="qfm-arm qfm-arm-r"><rect x="155" y="122" width="14" height="32" rx="7" fill="#6570d4"/><circle cx="162" cy="152" r="7.5" fill="#6570d4"/></g>' +
      '</g>';
    var p = result === 'correct'
      ? '<g class="qfm-spark"><path d="M174 76 l-6 -8 M187 70 l0 -11 M200 74 l6 -8" stroke="#ffcc3d" stroke-width="3.5" stroke-linecap="round" fill="none"/></g>' +
        '<g class="qfm-palm"><rect x="198" y="96" width="20" height="18" rx="6" fill="#c9b8f5"/><path d="M188 98 C184 84 188 72 197 72 C206 72 209 80 208 88 L212 82 C217 79 221 84 217 90 L209 102 C202 108 192 106 188 98 Z" fill="#ffe3c2" stroke="#e8b98a" stroke-width="2" stroke-linejoin="round"/></g>' +
        '<g transform="translate(96 150)"><g class="qfm-star"><path d="' + STAR_D + '" fill="#ffcc3d" stroke="#f2a81d" stroke-width="2.5" stroke-linejoin="round"/><circle cx="-3" cy="-3" r="1.6" fill="#fff"/></g></g>'
      : '<g class="qfm-clue"><rect x="176" y="150" width="46" height="30" rx="7" fill="#ffffff" stroke="#cfc6f2" stroke-width="2"/><text x="199" y="170" text-anchor="middle" font-size="13" font-weight="700" fill="#5a4fb0" font-family="system-ui,sans-serif">線索</text></g>' +
        '<g class="qfm-ring"><circle cx="199" cy="165" r="24" fill="none" stroke="#ffcc3d" stroke-width="3" stroke-dasharray="5 5"/></g>' +
        '<g class="qfm-mag"><line x1="186" y1="141" x2="191" y2="150" stroke="#5a4fb0" stroke-width="6" stroke-linecap="round"/><circle cx="199" cy="161" r="13" fill="#ffffff" fill-opacity=".5" stroke="#5a4fb0" stroke-width="4"/><path d="M192 156 q4 -5 10 -4" stroke="#ffffff" stroke-width="2.5" fill="none" stroke-linecap="round"/></g>';
    return wrap(c + p);
  }

  /* ---------- 2. 小小花園 ---------- */
  function svgGarden(result) {
    var c = '' +
      '<ellipse cx="120" cy="185" rx="44" ry="6" fill="#e5f1e2"/>' +
      '<g class="qfm-whole">' +
        '<g class="qfm-ear qfm-ear-l"><path d="M112 84 C97 80 86 66 88 50 C103 54 114 67 112 84 Z" fill="#4fae66"/><path d="M110 80 C103 72 97 64 92 56" stroke="#3b8f51" stroke-width="2" fill="none" stroke-linecap="round"/></g>' +
        '<g class="qfm-ear qfm-ear-r"><path d="M128 84 C143 80 154 66 152 50 C137 54 126 67 128 84 Z" fill="#4fae66"/><path d="M130 80 C137 72 143 64 148 56" stroke="#3b8f51" stroke-width="2" fill="none" stroke-linecap="round"/></g>' +
        '<ellipse cx="104" cy="181" rx="11" ry="5" fill="#5fb873"/><ellipse cx="136" cy="181" rx="11" ry="5" fill="#5fb873"/>' +
        '<path d="M120 78 C152 78 166 112 166 140 C166 168 146 182 120 182 C94 182 74 168 74 140 C74 112 88 78 120 78 Z" fill="#7cc98a"/>' +
        '<ellipse cx="120" cy="155" rx="25" ry="21" fill="#e8f6e4"/>' +
        '<circle cx="95" cy="141" r="5.5" fill="#ffb3a8" opacity=".7"/><circle cx="145" cy="141" r="5.5" fill="#ffb3a8" opacity=".7"/>' +
        '<g class="qfm-eyes"><g class="qfm-lid"><circle cx="106" cy="126" r="6.5" fill="#23402b"/><circle cx="108" cy="123" r="2" fill="#fff"/></g><g class="qfm-lid"><circle cx="134" cy="126" r="6.5" fill="#23402b"/><circle cx="136" cy="123" r="2" fill="#fff"/></g></g>' +
        mouth(result, 139, '#23402b') +
        '<g class="qfm-arm qfm-arm-l"><rect x="76" y="128" width="12" height="30" rx="6" fill="#5fb873"/><circle cx="82" cy="156" r="7" fill="#5fb873"/></g>' +
        '<g class="qfm-arm qfm-arm-r"><rect x="152" y="128" width="12" height="30" rx="6" fill="#5fb873"/><circle cx="158" cy="156" r="7" fill="#5fb873"/></g>' +
      '</g>';
    var p = result === 'correct'
      ? '<path d="M204 174 L228 174 L225 190 L207 190 Z" fill="#d99a6c"/><rect x="202" y="169" width="28" height="7" rx="3" fill="#c8875a"/>' +
        '<g class="qfm-stem"><path d="M216 170 L216 152" stroke="#4fae66" stroke-width="4" stroke-linecap="round"/><path d="M216 164 C208 164 204 158 205 154 C212 154 216 158 216 164 Z" fill="#7cc98a"/></g>' +
        '<g class="qfm-bloom"><circle cx="216" cy="140" r="6" fill="#ffb3cf"/><circle cx="223.6" cy="145.5" r="6" fill="#ffb3cf"/><circle cx="220.7" cy="154.5" r="6" fill="#ffb3cf"/><circle cx="211.3" cy="154.5" r="6" fill="#ffb3cf"/><circle cx="208.4" cy="145.5" r="6" fill="#ffb3cf"/><circle cx="216" cy="148" r="5" fill="#ffd35a"/></g>' +
        '<g class="qfm-drops"><ellipse cx="206" cy="132" rx="2" ry="3" fill="#7db7e8"/><ellipse cx="211" cy="127" rx="2" ry="3" fill="#7db7e8"/><ellipse cx="209" cy="138" rx="2" ry="3" fill="#7db7e8"/></g>' +
        '<g class="qfm-can"><path d="M174 168 q7 -9 14 0" stroke="#5a97cc" stroke-width="3" fill="none"/><rect x="170" y="166" width="22" height="18" rx="4" fill="#7db7e8"/><path d="M191 172 L203 163" stroke="#7db7e8" stroke-width="4" stroke-linecap="round"/><circle cx="204" cy="162" r="3" fill="#5a97cc"/></g>'
      : '<path d="M166 186 Q184 168 202 186 Z" fill="#c89a72"/>' +
        '<path d="M184 180 L184 166" stroke="#4fae66" stroke-width="3" stroke-linecap="round"/>' +
        '<path d="M184 172 C177 172 173 167 174 163 C180 163 184 167 184 172 Z" fill="#7cc98a"/>' +
        '<g class="qfm-newleaf"><path d="M184 169 C191 169 195 164 194 160 C188 160 184 164 184 169 Z" fill="#a6e095"/></g>';
    return wrap(c + p);
  }

  /* ---------- 3. 拼圖發現 ---------- */
  function svgPuzzle(result) {
    var c = '' +
      '<ellipse cx="120" cy="185" rx="48" ry="6" fill="#f6eadd"/>' +
      '<g class="qfm-whole">' +
        '<g class="qfm-ear qfm-ear-l"><circle cx="88" cy="98" r="15" fill="#f2a65a"/><circle cx="88" cy="98" r="8" fill="#ffd6ab"/></g>' +
        '<g class="qfm-ear qfm-ear-r"><circle cx="152" cy="98" r="15" fill="#f2a65a"/><circle cx="152" cy="98" r="8" fill="#ffd6ab"/></g>' +
        '<ellipse cx="102" cy="181" rx="12" ry="5" fill="#e08f45"/><ellipse cx="138" cy="181" rx="12" ry="5" fill="#e08f45"/>' +
        '<rect x="72" y="92" width="96" height="90" rx="26" fill="#f2a65a"/>' +
        '<rect x="96" y="140" width="48" height="32" rx="12" fill="#ffe8cf"/>' +
        '<circle cx="92" cy="143" r="5" fill="#ff9e9e" opacity=".55"/><circle cx="148" cy="143" r="5" fill="#ff9e9e" opacity=".55"/>' +
        '<g class="qfm-eyes"><g class="qfm-lid"><ellipse cx="104" cy="126" rx="4.5" ry="7.5" fill="#3a2a1f"/><circle cx="105.5" cy="123" r="1.6" fill="#fff"/></g><g class="qfm-lid"><ellipse cx="136" cy="126" rx="4.5" ry="7.5" fill="#3a2a1f"/><circle cx="137.5" cy="123" r="1.6" fill="#fff"/></g></g>' +
        mouth(result, 138, '#3a2a1f') +
        '<g class="qfm-arm qfm-arm-l"><rect x="73" y="128" width="14" height="28" rx="7" fill="#e08f45"/><circle cx="80" cy="154" r="7.5" fill="#e08f45"/></g>' +
        '<g class="qfm-arm qfm-arm-r"><rect x="153" y="128" width="14" height="28" rx="7" fill="#e08f45"/><circle cx="160" cy="154" r="7.5" fill="#e08f45"/></g>' +
      '</g>';
    var p = result === 'correct'
      ? '<g class="qfm-joined"><rect x="88" y="38" width="64" height="38" rx="8" fill="none" stroke="#ffcc3d" stroke-width="3" stroke-dasharray="4 4"/></g>' +
        '<g class="qfm-piece-a"><path d="M94 44 H120 V52 C128 50 128 62 120 60 V70 H94 Z" fill="#9b86e6" stroke="#7c66cc" stroke-width="2" stroke-linejoin="round"/></g>' +
        '<g class="qfm-piece-b"><path d="M120 44 H146 V70 H120 V60 C128 62 128 50 120 52 Z" fill="#5cc3b8" stroke="#3fa398" stroke-width="2" stroke-linejoin="round"/></g>' +
        '<g class="qfm-click"><path d="M120 30 v-8 M138 34 l6 -6 M102 34 l-6 -6" stroke="#ffcc3d" stroke-width="3.5" stroke-linecap="round" fill="none"/></g>'
      : '<g class="qfm-slot"><rect x="12" y="138" width="44" height="42" rx="7" fill="#fff7ee" stroke="#e6c59f" stroke-width="2"/><path d="M23 147 H45 V169 H39 C41 177 27 177 29 169 H23 Z" fill="none" stroke="#b49be8" stroke-width="2.2" stroke-dasharray="4 3" stroke-linejoin="round"/></g>' +
        '<g class="qfm-turn-arrow"><path d="M206 94 A22 22 0 0 1 212 128" stroke="#b49be8" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M205 124 L212 130 L216 122" stroke="#b49be8" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>' +
        '<g transform="translate(186 114)"><g class="qfm-piece-turn"><path d="M-13 -13 H13 V-5 C21 -7 21 5 13 3 V13 H-13 Z" fill="#5cc3b8" stroke="#3fa398" stroke-width="2" stroke-linejoin="round"/></g></g>';
    return wrap(c + p);
  }

  /* ---------- 4. 紙飛機探索 ---------- */
  function svgPlane(result) {
    var c = '' +
      '<ellipse cx="120" cy="185" rx="44" ry="6" fill="#e2f1f9"/>' +
      '<g class="qfm-whole">' +
        '<g class="qfm-ear qfm-ear-l"><ellipse cx="102" cy="80" rx="10" ry="27" fill="#5bb7e6" transform="rotate(-12 102 104)"/><ellipse cx="102" cy="83" rx="5" ry="18" fill="#cdeefc" transform="rotate(-12 102 104)"/></g>' +
        '<g class="qfm-ear qfm-ear-r"><ellipse cx="138" cy="80" rx="10" ry="27" fill="#5bb7e6" transform="rotate(12 138 104)"/><ellipse cx="138" cy="83" rx="5" ry="18" fill="#cdeefc" transform="rotate(12 138 104)"/></g>' +
        '<ellipse cx="104" cy="181" rx="11" ry="5" fill="#4aa3d3"/><ellipse cx="136" cy="181" rx="11" ry="5" fill="#4aa3d3"/>' +
        '<ellipse cx="120" cy="138" rx="44" ry="44" fill="#5bb7e6"/>' +
        '<ellipse cx="120" cy="164" rx="22" ry="13" fill="#e5f6fd"/>' +
        '<path d="M84 146 Q120 162 156 146 L156 155 Q120 171 84 155 Z" fill="#ffd35a"/><path d="M138 158 L148 177 L139 175 L132 160 Z" fill="#f5c043"/>' +
        '<circle cx="93" cy="137" r="5" fill="#ffb3cf" opacity=".7"/><circle cx="147" cy="137" r="5" fill="#ffb3cf" opacity=".7"/>' +
        '<g class="qfm-eyes"><g class="qfm-lid"><circle cx="105" cy="124" r="6" fill="#1f3a4d"/><circle cx="107" cy="121.5" r="2" fill="#fff"/></g><g class="qfm-lid"><circle cx="135" cy="124" r="6" fill="#1f3a4d"/><circle cx="137" cy="121.5" r="2" fill="#fff"/></g></g>' +
        mouth(result, 134, '#1f3a4d') +
        '<g class="qfm-arm qfm-arm-l"><rect x="78" y="134" width="12" height="28" rx="6" fill="#4aa3d3"/><circle cx="84" cy="160" r="7" fill="#4aa3d3"/></g>' +
        '<g class="qfm-arm qfm-arm-r"><rect x="150" y="134" width="12" height="28" rx="6" fill="#4aa3d3"/><circle cx="156" cy="160" r="7" fill="#4aa3d3"/></g>' +
      '</g>';
    var p = result === 'correct'
      ? '<g class="qfm-trail"><path d="M172 104 C182 70 196 60 206 44" stroke="#b9c7e6" stroke-width="2.5" fill="none" stroke-dasharray="4 6" stroke-linecap="round"/></g>' +
        '<g transform="translate(214 36)"><g class="qfm-plane"><path d="M-18 2 L18 -8 L-4 6 Z" fill="#ffffff" stroke="#7a8fb8" stroke-width="1.6" stroke-linejoin="round"/><path d="M-4 6 L18 -8 L0 14 Z" fill="#e3e9f7" stroke="#7a8fb8" stroke-width="1.6" stroke-linejoin="round"/></g></g>'
      : '<g class="qfm-map"><rect x="168" y="118" width="62" height="50" rx="5" fill="#fff6dc" stroke="#e0c58a" stroke-width="2"/>' +
          '<path d="M189 120 V166 M209 120 V166" stroke="#efdcae" stroke-width="1.5"/>' +
          '<circle cx="178" cy="158" r="3.5" fill="#5bb7e6"/>' +
          '<path class="qfm-route" d="M178 158 Q190 134 204 146 T220 130" pathLength="100" stroke="#7a63d6" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-dasharray="100"/>' +
          '<g class="qfm-flag"><path d="M220 130 V114" stroke="#7a63d6" stroke-width="2" stroke-linecap="round"/><path d="M220 114 L231 118 L220 122 Z" fill="#ffcc3d"/></g>' +
          '<text x="199" y="183" text-anchor="middle" font-size="11" font-weight="700" fill="#7a63d6" font-family="system-ui,sans-serif">下一步</text></g>';
    return wrap(c + p);
  }

  var variants = {
    star: {
      id: 'star', name: '星光夥伴',
      duration: { correct: 2000, incorrect: 2000 },
      sentinel: { selector: '.qfm-sentinel', animation: 'qfm-end-star' },
      motions: { correct: '接住落下的星星，再和朋友擊掌', incorrect: '拿放大鏡掃過去，找到一個線索' },
      messages: {
        correct: ['你接住答案 63 了！你想怎麼說明自己的想法？'],
        incorrect: ['先找一個線索，你想從哪一步再看看？']
      },
      svg: svgStar
    },
    garden: {
      id: 'garden', name: '小小花園',
      duration: { correct: 2200, incorrect: 2200 },
      sentinel: { selector: '.qfm-sentinel', animation: 'qfm-end-garden' },
      motions: { correct: '澆水讓花開，再開心伸展', incorrect: '照顧幼苗，低頭看新芽慢慢長出來' },
      messages: {
        correct: ['答案和每一步都對得上。你想用什麼方式，把這個方法說給別人聽？'],
        incorrect: ['新芽要慢慢看。你想先檢查個位，還是十位的進位？']
      },
      svg: svgGarden
    },
    puzzle: {
      id: 'puzzle', name: '拼圖發現',
      duration: { correct: 1900, incorrect: 2000 },
      sentinel: { selector: '.qfm-sentinel', animation: 'qfm-end-puzzle' },
      motions: { correct: '兩塊拼圖從兩邊靠近、拼合', incorrect: '轉動拼圖片，換個方向看看' },
      messages: {
        correct: ['個位和十位拼在一起了。你是怎麼確定進位要加到十位的？'],
        incorrect: ['換個方向看看這一塊：個位加起來超過 10 時，你打算怎麼處理？']
      },
      svg: svgPuzzle
    },
    plane: {
      id: 'plane', name: '紙飛機探索',
      duration: { correct: 2000, incorrect: 2100 },
      sentinel: { selector: '.qfm-sentinel', animation: 'qfm-end-plane' },
      motions: { correct: '送出紙飛機，看著它飛遠再揮手', incorrect: '攤開小地圖，指出下一步' },
      messages: {
        correct: ['答案送到目的地了。下一題，你想沿用這個方法，還是換一種試試？'],
        incorrect: ['先在地圖上標出下一步：你想從個位開始，再看一次嗎？']
      },
      svg: svgPlane
    }
  };
  var order = ['star', 'garden', 'puzzle', 'plane'];

  var handlers = new WeakMap();
  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  function emit(el, type, detail) {
    el.dispatchEvent(new CustomEvent(type, { bubbles: true, detail: detail }));
  }
  function getDef(el) {
    return el && el.classList && el.classList.contains('qfm-actor') ? variants[el.getAttribute('data-variant')] : null;
  }

  function create(opts) {
    var def = variants[opts && opts.variant];
    var result = opts && opts.result;
    if (!def) throw new Error('QuizFeedbackMotion：未知的 variant');
    if (result !== 'correct' && result !== 'incorrect') throw new Error('QuizFeedbackMotion：result 需為 correct 或 incorrect');
    var el = document.createElement('div');
    el.className = 'qfm-actor qfm-v-' + def.id + ' qfm-r-' + result;
    el.setAttribute('data-variant', def.id);
    el.setAttribute('data-result', result);
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', def.name + '：' + def.motions[result]);
    el.style.setProperty('--qfm-dur', def.duration[result] + 'ms');
    var tpl = document.createElement('template');
    tpl.innerHTML = def.svg(result); /* 只使用本檔作者撰寫的靜態 SVG 字串，不含任何使用者輸入 */
    el.appendChild(tpl.content);
    return el;
  }

  function finish(el, reason) {
    var h = handlers.get(el);
    if (h) { el.removeEventListener('animationend', h); handlers.delete(el); }
    var was = el.classList.contains('qfm-playing');
    el.classList.remove('qfm-playing');
    if (was) emit(el, 'qfm:end', { reason: reason });
    return was;
  }

  function stop(el) {
    if (!getDef(el)) return false;
    return finish(el, 'stopped');
  }

  function play(el, opts) {
    var def = getDef(el);
    if (!def) return false;
    stop(el);
    var reduced = !!(opts && opts.reduced) || !!(mq && mq.matches) || document.hidden;
    if (reduced) { emit(el, 'qfm:end', { reason: document.hidden ? 'hidden' : 'reduced' }); return false; }
    var sentinel = el.querySelector(def.sentinel.selector);
    if (!sentinel) return false;
    var onEnd = function (e) {
      if (e.target !== sentinel || e.animationName !== def.sentinel.animation) return; /* 忽略子部位較早結束的冒泡事件 */
      finish(el, 'complete');
    };
    handlers.set(el, onEnd);
    el.addEventListener('animationend', onEnd);
    void el.getBoundingClientRect(); /* 重新觸發同一元素的動畫 */
    el.classList.add('qfm-playing');
    emit(el, 'qfm:start', { variant: def.id, result: el.getAttribute('data-result') });
    return true;
  }

  function stopAll(reason) {
    var list = document.querySelectorAll('.qfm-actor.qfm-playing');
    for (var i = 0; i < list.length; i++) finish(list[i], reason);
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) stopAll('hidden'); });
  if (mq) {
    var onMq = function () { if (mq.matches) stopAll('reduced'); };
    if (mq.addEventListener) mq.addEventListener('change', onMq); else if (mq.addListener) mq.addListener(onMq);
  }

  function register(def, position) {
    if (!def || typeof def.id !== 'string' || !/^[a-z][a-z0-9-]{1,30}$/.test(def.id)) throw new Error('register：id 格式不正確');
    if (variants[def.id]) throw new Error('register：id 已存在');
    if (typeof def.svg !== 'function' || !def.duration || !def.sentinel || !def.messages || !def.motions) throw new Error('register：欄位不完整');
    if (def.duration.correct > 2400 || def.duration.incorrect > 2400) throw new Error('register：每段最長 2400ms');
    variants[def.id] = def;
    var pos = typeof position === 'number' ? Math.max(0, Math.min(order.length, position)) : order.length;
    order.splice(pos, 0, def.id);
    return def.id;
  }

  return { variants: variants, create: create, play: play, stop: stop, order: order, register: register };
})();

// 首輪Opus原型的完整紫色角色，作為第五套；靜態SVG無使用者輸入。
quizFeedbackMotion.register({
  id: 'original', name: '紫色小夥伴',
  duration: { correct: 1300, incorrect: 1400 },
  sentinel: { selector: '.qfm-sentinel', animation: 'qfm-end-original' },
  motions: { correct: '輕跳落地與揮手', incorrect: '好奇眼神與友善點頭' },
  messages: { correct: ['想想自己的解題方法。'], incorrect: ['一起找一個新線索。'] },
  svg: () => "<svg class=\"qfm-o-mascot\" viewBox=\"0 0 120 120\" aria-hidden=\"true\" focusable=\"false\">\n    <ellipse class=\"qfm-o-m-shadow\" cx=\"60\" cy=\"108\" rx=\"28\" ry=\"4.5\"/>\n    <g class=\"qfm-o-m-hop\">\n      <g class=\"qfm-o-m-lean\">\n        <g class=\"qfm-o-m-body\">\n          <g class=\"qfm-o-m-ear qfm-o-m-ear-l\">\n            <path class=\"qfm-o-m-ear-out\" d=\"M34 42C26 30 26 18 32 12C40 16 44 28 44 38Z\"/>\n            <path class=\"qfm-o-m-ear-in\" d=\"M35.5 35C32 28 31.5 22 33.5 18C37.5 22 39.5 28 39.5 33Z\"/>\n          </g>\n          <g class=\"qfm-o-m-ear qfm-o-m-ear-r\">\n            <path class=\"qfm-o-m-ear-out\" d=\"M86 42C94 30 94 18 88 12C80 16 76 28 76 38Z\"/>\n            <path class=\"qfm-o-m-ear-in\" d=\"M84.5 35C88 28 88.5 22 86.5 18C82.5 22 80.5 28 80.5 33Z\"/>\n          </g>\n          <rect class=\"qfm-o-m-torso\" x=\"26\" y=\"32\" width=\"68\" height=\"70\" rx=\"26\"/>\n          <ellipse class=\"qfm-o-m-belly\" cx=\"60\" cy=\"90\" rx=\"20\" ry=\"9\"/>\n          <g class=\"qfm-o-m-arm qfm-o-m-arm-l\"><ellipse cx=\"23\" cy=\"74\" rx=\"6.5\" ry=\"10\"/></g>\n          <g class=\"qfm-o-m-arm qfm-o-m-arm-r\"><ellipse cx=\"97\" cy=\"74\" rx=\"6.5\" ry=\"10\"/></g>\n          <g class=\"qfm-o-m-face\">\n            <g class=\"qfm-o-m-eyes\">\n              <ellipse class=\"qfm-o-m-eye-white\" cx=\"47\" cy=\"60\" rx=\"7\" ry=\"8\"/>\n              <ellipse class=\"qfm-o-m-eye-white\" cx=\"73\" cy=\"60\" rx=\"7\" ry=\"8\"/>\n              <g class=\"qfm-o-m-pupils\">\n                <circle cx=\"47\" cy=\"61\" r=\"4\"/><circle cx=\"73\" cy=\"61\" r=\"4\"/>\n                <circle class=\"qfm-o-m-glint\" cx=\"48.6\" cy=\"59.2\" r=\"1.3\"/><circle class=\"qfm-o-m-glint\" cx=\"74.6\" cy=\"59.2\" r=\"1.3\"/>\n              </g>\n            </g>\n            <g class=\"qfm-o-m-eyes-happy\"><path d=\"M40 62Q47 53 54 62\"/><path d=\"M66 62Q73 53 80 62\"/></g>\n            <g class=\"qfm-o-m-cheeks\"><ellipse cx=\"37\" cy=\"72\" rx=\"5.5\" ry=\"3.2\"/><ellipse cx=\"83\" cy=\"72\" rx=\"5.5\" ry=\"3.2\"/></g>\n            <path class=\"qfm-o-m-mouth\" d=\"M53 74Q60 80.5 67 74\"/>\n            <path class=\"qfm-o-m-mouth-big\" d=\"M51.5 72.5Q60 85 68.5 72.5Z\"/>\n          </g>\n        </g>\n      </g>\n      <g class=\"qfm-o-m-clue\">\n        <g class=\"qfm-o-m-clue-rays\"><path d=\"M106 8V4\"/><path d=\"M115 13l3-2.5\"/><path d=\"M97 13l-3-2.5\"/></g>\n        <circle class=\"qfm-o-m-bulb\" cx=\"106\" cy=\"20\" r=\"7\"/>\n        <rect class=\"qfm-o-m-bulb-base\" x=\"103\" y=\"26.5\" width=\"6\" height=\"4.5\" rx=\"1.5\"/>\n      </g>\n    </g>\n    <g class=\"qfm-o-m-sparks\">\n      <path class=\"qfm-o-m-spark s1\" style=\"--dx:-10px;--dy:-12px\" d=\"M22 24l1.8 4.2 4.2 1.8-4.2 1.8-1.8 4.2-1.8-4.2-4.2-1.8 4.2-1.8z\"/>\n      <circle class=\"qfm-o-m-spark s2\" style=\"--dx:0px;--dy:-14px\" cx=\"60\" cy=\"22\" r=\"3\"/>\n      <path class=\"qfm-o-m-spark s3\" style=\"--dx:10px;--dy:-12px\" d=\"M98 24l1.8 4.2 4.2 1.8-4.2 1.8-1.8 4.2-1.8-4.2-4.2-1.8 4.2-1.8z\"/>\n      <circle class=\"qfm-o-m-spark s4\" style=\"--dx:-10px;--dy:-4px\" cx=\"15\" cy=\"52\" r=\"2.6\"/>\n      <circle class=\"qfm-o-m-spark s5\" style=\"--dx:10px;--dy:-6px\" cx=\"105\" cy=\"50\" r=\"2.6\"/>\n    </g>\n  <rect class=\"qfm-sentinel\" width=\"1\" height=\"1\" opacity=\"0\"/></svg>"
});


// 第二批Opus五套原創角色，沿用同一播放／取消生命週期。
(function () {
  function o(x, y) { return ' style="transform-origin:' + x + 'px ' + y + 'px"'; }
  function eye(cx, cy, rx, ry, col, extra) {
    return '<g class="qfm2-lid' + (extra || '') + '"' + o(cx, cy) + '>' +
      '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="' + col + '"/>' +
      '<circle cx="' + (cx + rx * 0.35).toFixed(1) + '" cy="' + (cy - ry * 0.4).toFixed(1) + '" r="' + (rx * 0.38).toFixed(1) + '" fill="#ffffff"/></g>';
  }
  /* 表情：ma＝開始時的嘴形，mb＝最後姿勢的嘴形 */
  function mouths(result, x, y, col) {
    if (result === 'correct') {
      return '<g class="qfm2-ma"><path d="M' + (x - 7) + ' ' + y + ' Q' + x + ' ' + (y + 6) + ' ' + (x + 7) + ' ' + y + '" stroke="' + col + '" stroke-width="3" fill="none" stroke-linecap="round"/></g>' +
        '<g class="qfm2-mb"><path d="M' + (x - 10) + ' ' + (y - 1) + ' Q' + x + ' ' + (y + 14) + ' ' + (x + 10) + ' ' + (y - 1) + ' Z" fill="' + col + '" stroke="' + col + '" stroke-width="2" stroke-linejoin="round"/></g>';
    }
    return '<g class="qfm2-ma"><ellipse cx="' + x + '" cy="' + (y + 2) + '" rx="3.5" ry="4" fill="none" stroke="' + col + '" stroke-width="3"/></g>' +
      '<g class="qfm2-mb"><path d="M' + (x - 6) + ' ' + (y + 1) + ' Q' + x + ' ' + (y + 6) + ' ' + (x + 6) + ' ' + (y + 1) + '" stroke="' + col + '" stroke-width="3" fill="none" stroke-linecap="round"/></g>';
  }
  function spikes(cx, cy, ri, ro, a0, a1, n) {
    var pts = [], i, a, r;
    for (i = 0; i <= n * 2; i++) {
      a = (a0 + (a1 - a0) * i / (n * 2)) * Math.PI / 180;
      r = i % 2 ? ro : ri;
      pts.push((cx + r * Math.cos(a)).toFixed(1) + ' ' + (cy - r * Math.sin(a)).toFixed(1));
    }
    return 'M' + cx + ' ' + cy + ' L' + pts.join(' L') + ' Z';
  }
  function wrap(inner) {
    return '<svg viewBox="0 0 240 224" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">' + inner +
      '<rect class="qfm2-sentinel" x="0" y="0" width="1" height="1" fill="none"/></svg>';
  }
  var SPIKES = spikes(104, 150, 46, 64, -22, 202, 12);

  /* ---------- 1. 刺蝟小畫家 ---------- */
  function svgPainter(r) {
    var s = '<ellipse cx="124" cy="208" rx="92" ry="7" fill="#f1e8dc"/>' +
      '<path d="M191 92 L170 205 M191 92 L214 205" stroke="#b98a5e" stroke-width="5" stroke-linecap="round" fill="none"/>' +
      '<rect x="158" y="80" width="66" height="54" rx="4" fill="#fffdf8" stroke="#b98a5e" stroke-width="3"/>' +
      '<rect x="154" y="134" width="74" height="7" rx="3" fill="#b98a5e"/>';
    if (r === 'correct') {
      s += '<path class="qfm2-pt-stroke" d="M162.1 101.3 A50.2 50.2 0 0 1 195.5 128.8" pathLength="100" stroke-dasharray="100" stroke="#ff8a5c" stroke-width="7" fill="none" stroke-linecap="round"/>' +
        '<g class="qfm2-pt-sun"' + o(212, 96) + '><circle cx="212" cy="96" r="7.5" fill="#ffcf4a"/></g>';
    } else {
      s += '<path d="M168 122 Q178 110 190 122" stroke="#ff8a5c" stroke-width="6" fill="none" stroke-linecap="round"/>' +
        '<path class="qfm2-pt-guide" d="M168 100 Q190 86 214 102" stroke="#6c9ce8" stroke-width="4" fill="none" stroke-linecap="round" stroke-dasharray="6 6"/>';
    }
    s += '<g class="qfm2-whole"' + o(104, 204) + '>' +
      '<ellipse cx="88" cy="201" rx="12" ry="6" fill="#7a4f34"/><ellipse cx="124" cy="201" rx="12" ry="6" fill="#7a4f34"/>' +
      '<g class="qfm2-spikes"' + o(104, 150) + '><path d="' + SPIKES + '" fill="#7a4f34" stroke="#7a4f34" stroke-width="4" stroke-linejoin="round"/></g>' +
      '<circle cx="104" cy="150" r="50" fill="#9b6b4a"/>' +
      '<circle cx="80" cy="118" r="8" fill="#f0c9a0"/><circle cx="136" cy="116" r="8" fill="#f0c9a0"/>' +
      '<ellipse cx="108" cy="160" rx="38" ry="33" fill="#f8e4c8"/>' +
      '<circle cx="86" cy="167" r="5.5" fill="#ffb3a8" opacity=".75"/><circle cx="132" cy="167" r="5.5" fill="#ffb3a8" opacity=".75"/>' +
      '<g class="qfm2-eyes">' + eye(97, 150, 5.5, 7, '#2e221b') + eye(121, 150, 5.5, 7, '#2e221b', ' qfm2-lid-r') + '</g>' +
      '<ellipse cx="109" cy="162" rx="5" ry="4" fill="#2e221b"/>' +
      mouths(r, 109, 171, '#2e221b') +
      '<g class="qfm2-hat"' + o(104, 102) + '><path d="M76 102 Q80 84 104 84 Q128 84 132 102 Z" fill="#e85d75"/><ellipse cx="104" cy="101" rx="30" ry="6" fill="#d24a63"/><circle cx="104" cy="81" r="4.5" fill="#e85d75"/></g>' +
      '<g class="qfm2-arm-l"' + o(64, 150) + '><rect x="57" y="146" width="14" height="30" rx="7" fill="#8a5c3e"/>' +
        '<ellipse cx="48" cy="187" rx="20" ry="12" fill="#f3d9a8" stroke="#d8b680" stroke-width="2"/>' +
        '<circle cx="38" cy="187" r="3.5" fill="#ff8a5c"/><circle cx="48" cy="181" r="3.5" fill="#6c9ce8"/><circle cx="58" cy="188" r="3.5" fill="#ffcf4a"/>' +
        '<circle cx="64" cy="178" r="7.5" fill="#f0c9a0"/></g>' +
      '<g class="qfm2-arm-r"' + o(150, 150) + '><rect x="143" y="146" width="14" height="30" rx="7" fill="#8a5c3e"/>' +
        '<path d="M150 178 L190 135" stroke="#b98a5e" stroke-width="5" stroke-linecap="round"/>' +
        '<ellipse cx="195.5" cy="130" rx="7" ry="4" fill="' + (r === 'correct' ? '#ff8a5c' : '#6c9ce8') + '" transform="rotate(-47 195.5 130)"/>' +
        '<circle cx="150" cy="178" r="7.5" fill="#f0c9a0"/></g>' +
      '</g>';
    return wrap(s);
  }

  /* ---------- 2. 章魚小廚師 ---------- */
  function svgChef(r) {
    var s = '<ellipse cx="124" cy="207" rx="94" ry="7" fill="#fbe9e4"/>' +
      '<ellipse cx="196" cy="165" rx="27" ry="6.5" fill="#4b3d57"/>';
    if (r === 'correct') {
      s += '<g class="qfm2-ch-steam"><path d="M188 150 q-6 -8 0 -15 q6 -8 0 -15 M201 146 q-6 -8 0 -15 q6 -8 0 -15 M214 150 q-6 -8 0 -15 q6 -8 0 -15" stroke="#cfc8dd" stroke-width="3.5" fill="none" stroke-linecap="round"/></g>';
    }
    s += '<g class="qfm2-whole"' + o(104, 204) + '>' +
      '<g class="qfm2-ch-skirt"' + o(104, 200) + '><path d="M54 146 L54 184 Q54 200 67 200 Q80 200 80 188 Q80 200 92 200 Q104 200 104 188 Q104 200 116 200 Q128 200 128 188 Q128 200 141 200 Q154 200 154 184 L154 146 Z" fill="#f47a66"/>' +
        '<circle cx="67" cy="192" r="3" fill="#ffc2b5"/><circle cx="92" cy="193" r="3" fill="#ffc2b5"/><circle cx="116" cy="193" r="3" fill="#ffc2b5"/><circle cx="141" cy="192" r="3" fill="#ffc2b5"/></g>' +
      '<ellipse cx="104" cy="124" rx="52" ry="46" fill="#ff8f7a"/>' +
      '<circle cx="74" cy="110" r="5" fill="#ffb3a3"/><circle cx="136" cy="104" r="4" fill="#ffb3a3"/>' +
      '<g class="qfm2-hat"' + o(104, 84) + '><circle cx="86" cy="62" r="14" fill="#ffffff" stroke="#e3d6d0" stroke-width="2"/><circle cx="122" cy="62" r="14" fill="#ffffff" stroke="#e3d6d0" stroke-width="2"/><circle cx="104" cy="54" r="16" fill="#ffffff" stroke="#e3d6d0" stroke-width="2"/><rect x="80" y="70" width="48" height="16" rx="5" fill="#ffffff" stroke="#e3d6d0" stroke-width="2"/></g>' +
      '<circle cx="78" cy="134" r="5.5" fill="#ff6f86" opacity=".45"/><circle cx="130" cy="134" r="5.5" fill="#ff6f86" opacity=".45"/>' +
      '<g class="qfm2-eyes">' + eye(90, 120, 6, 7, '#3b2230') + eye(118, 120, 6, 7, '#3b2230') + '</g>' +
      mouths(r, 104, 138, '#3b2230') +
      '<g class="qfm2-arm-l"' + o(60, 138) + '><path d="M62 136 Q40 146 40 164" stroke="#f47a66" stroke-width="13" fill="none" stroke-linecap="round"/></g>' +
      '<g class="qfm2-arm-r"' + o(148, 138) + '><path d="M146 136 Q166 140 176 152" stroke="#f47a66" stroke-width="13" fill="none" stroke-linecap="round"/>' +
        '<path d="M176 152 L200 172" stroke="#c9b39b" stroke-width="5" stroke-linecap="round"/><ellipse cx="202" cy="174" rx="8" ry="5" fill="#d8c3aa"/></g>' +
      '</g>' +
      '<path d="M168 165 Q196 177 224 165 L220 194 Q218 202 208 202 L184 202 Q174 202 172 194 Z" fill="#6c8fd6"/>' +
      '<path d="M168 165 Q196 177 224 165" stroke="#4f6fb8" stroke-width="4" fill="none"/>' +
      '<rect x="160" y="170" width="10" height="6" rx="3" fill="#4f6fb8"/><rect x="221" y="170" width="9" height="6" rx="3" fill="#4f6fb8"/>';
    if (r === 'correct') {
      s += '<g class="qfm2-ch-heart"' + o(212, 103) + '><path d="M212 110 C204 104 204 96 209 96 C211 96 212 98 212 99 C212 98 213 96 215 96 C220 96 220 104 212 110 Z" fill="#ff9fb4"/></g>';
    } else {
      s += '<g class="qfm2-ch-card"' + o(34, 140) + '><rect x="12" y="92" width="44" height="56" rx="6" fill="#fffaf0" stroke="#e0c9a8" stroke-width="2"/>' +
          '<rect x="20" y="100" width="28" height="5" rx="2.5" fill="#d9b88c"/>' +
          '<circle cx="21" cy="115" r="4" fill="#7cc98a"/><rect x="28" y="113" width="20" height="4" rx="2" fill="#c9b6a0"/>' +
          '<circle cx="21" cy="127" r="4" fill="none" stroke="#a99bc8" stroke-width="2"/><rect x="28" y="125" width="20" height="4" rx="2" fill="#c9b6a0"/>' +
          '<circle cx="21" cy="139" r="4" fill="none" stroke="#a99bc8" stroke-width="2"/><rect x="28" y="137" width="16" height="4" rx="2" fill="#c9b6a0"/>' +
          '<g class="qfm2-ch-mark"><rect x="14.5" y="120" width="39" height="14" rx="5" fill="none" stroke="#7a63d6" stroke-width="2.2" stroke-dasharray="4 3"/></g></g>' +
        '<g class="qfm2-ch-arrow"><path d="M220 144 Q204 130 189 143" stroke="#7a63d6" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M186 135 L188 145 L197 142" stroke="#7a63d6" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>';
    }
    return wrap(s);
  }

  /* ---------- 3. 貓頭鷹讀書會 ---------- */
  function svgReader(r) {
    var pupils = '<g class="qfm2-eyes">' + eye(92, 124, 8, 8.5, '#22303a') + eye(128, 124, 8, 8.5, '#22303a') + '</g>';
    var s = '<ellipse cx="114" cy="207" rx="80" ry="7" fill="#e3f2ed"/>' +
      '<g class="qfm2-whole"' + o(110, 204) + '>' +
      '<ellipse cx="96" cy="201" rx="10" ry="5" fill="#f4a340"/><ellipse cx="124" cy="201" rx="10" ry="5" fill="#f4a340"/>' +
      '<g class="qfm2-tufts"' + o(110, 98) + '><path d="M78 100 L80 64 L102 86 Z" fill="#3e9384" stroke="#3e9384" stroke-width="6" stroke-linejoin="round"/><path d="M142 100 L140 64 L118 86 Z" fill="#3e9384" stroke="#3e9384" stroke-width="6" stroke-linejoin="round"/></g>' +
      '<ellipse cx="110" cy="140" rx="50" ry="58" fill="#4fae9e"/>' +
      '<ellipse cx="110" cy="170" rx="32" ry="26" fill="#d8f0e8"/>' +
      '<path d="M98 160 l4 4 l4 -4 M114 160 l4 4 l4 -4 M106 172 l4 4 l4 -4" stroke="#9fd3c4" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle cx="92" cy="122" r="19" fill="#fff6e6"/><circle cx="128" cy="122" r="19" fill="#fff6e6"/>' +
      (r === 'correct'
        ? '<g class="qfm2-ma">' + pupils + '</g><g class="qfm2-mb"><path d="M83 127 Q92 115 101 127 M119 127 Q128 115 137 127" stroke="#22303a" stroke-width="4.5" fill="none" stroke-linecap="round"/></g>'
        : pupils) +
      '<g class="qfm2-glasses"' + o(110, 122) + '><circle cx="92" cy="122" r="21" fill="none" stroke="#6b4fb3" stroke-width="3.5"/><circle cx="128" cy="122" r="21" fill="none" stroke="#6b4fb3" stroke-width="3.5"/><path d="M106 118 Q110 114 114 118" stroke="#6b4fb3" stroke-width="3.5" fill="none"/></g>' +
      '<path d="M104 140 L116 140 L110 151 Z" fill="#f4a340" stroke="#f4a340" stroke-width="3" stroke-linejoin="round"/>' +
      '<circle cx="76" cy="144" r="5" fill="#ffb3cf" opacity=".7"/><circle cx="144" cy="144" r="5" fill="#ffb3cf" opacity=".7"/>' +
      '<g class="qfm2-wing-l"' + o(64, 126) + '><path d="M64 120 Q46 150 58 180 Q70 162 72 128 Z" fill="#3e9384"/></g>' +
      '<g class="qfm2-wing-r"' + o(156, 126) + '><path d="M156 120 Q174 150 162 180 Q150 162 148 128 Z" fill="#3e9384"/></g>' +
      '</g>';
    var lpage = '<path d="M110 162 Q90 156 70 160 L70 194 Q90 190 110 196 Z" fill="#ffffff" stroke="#c9c3d6" stroke-width="2" stroke-linejoin="round"/><path d="M78 168 L102 170 M78 176 L102 178 M84 184 L102 186" stroke="#d6d0e6" stroke-width="2.5" stroke-linecap="round"/>';
    var rpage = '<path d="M110 162 Q130 156 150 160 L150 194 Q130 190 110 196 Z" fill="#ffffff" stroke="#c9c3d6" stroke-width="2" stroke-linejoin="round"/><path d="M118 170 L142 168 M118 178 L142 176 M118 186 L136 185" stroke="#d6d0e6" stroke-width="2.5" stroke-linecap="round"/>';
    if (r === 'correct') {
      s += '<g class="qfm2-rd-book"' + o(110, 178) + '>' +
          '<g class="qfm2-rd-lpage"' + o(110, 178) + '>' + lpage + '</g>' + rpage +
          '<g class="qfm2-rd-cover"' + o(110, 178) + '><path d="M110 159 Q131 153 153 157 L153 197 Q131 193 110 199 Z" fill="#e8805e"/><path d="M122 168 L142 166" stroke="#ffd2b8" stroke-width="3" stroke-linecap="round"/></g>' +
        '</g>' +
        '<g class="qfm2-rd-bulb"' + o(186, 80) + '><path d="M180 92 L192 92 L191 99 L181 99 Z" fill="#c9c3d6"/><circle cx="186" cy="78" r="13" fill="#ffd35a" stroke="#f2b622" stroke-width="2.5"/><path d="M182 81 Q186 74 190 81" stroke="#f2b622" stroke-width="2" fill="none"/>' +
          '<path d="M186 58 L186 52 M200 63 L205 59 M172 63 L167 59 M205 78 L211 78 M167 78 L161 78" stroke="#ffc53d" stroke-width="3" stroke-linecap="round"/></g>';
    } else {
      s += '<g class="qfm2-rd-bookmark"><path d="M139 150 L148 150 L148 170 L143.5 166 L139 170 Z" fill="#e85d75"/></g>' +
        lpage + rpage +
        '<g class="qfm2-rd-flip"' + o(110, 178) + '>' + rpage + '</g>' +
        '<g class="qfm2-rd-hl"' + o(130, 178) + '><ellipse cx="130" cy="177" rx="17" ry="7.5" fill="none" stroke="#7a63d6" stroke-width="2.5" stroke-dasharray="4 3"/></g>';
    }
    return wrap(s);
  }

  /* ---------- 4. 企鵝木琴手 ---------- */
  function svgXylo(r) {
    var s = '<ellipse cx="120" cy="208" rx="96" ry="7" fill="#e6ecf6"/>' +
      '<path d="M152 196 L148 205 M218 196 L222 205" stroke="#a8754e" stroke-width="4" stroke-linecap="round"/>' +
      '<rect x="144" y="184" width="82" height="12" rx="4" fill="#c58a5c"/>' +
      '<rect x="148" y="136" width="12" height="50" rx="3" fill="#ff8a8a"/>' +
      '<g class="qfm2-xy-bar2"><rect x="163" y="142" width="12" height="44" rx="3" fill="#ffb35c"/></g>' +
      '<g class="qfm2-xy-bar3"><rect x="178" y="148" width="12" height="38" rx="3" fill="#ffd84d"/></g>' +
      '<rect x="193" y="154" width="12" height="32" rx="3" fill="#7ed49a"/>' +
      '<rect x="208" y="160" width="12" height="26" rx="3" fill="#7db7e8"/>';
    var beak = r === 'correct'
      ? '<g class="qfm2-ma"><path d="M88 124 L104 124 L96 133 Z" fill="#f4a340" stroke="#f4a340" stroke-width="2" stroke-linejoin="round"/></g>' +
        '<g class="qfm2-mb"><path d="M87 122 L105 122 L96 128 Z" fill="#f4a340" stroke="#f4a340" stroke-width="2" stroke-linejoin="round"/><path d="M90 131 L102 131 L96 137 Z" fill="#e8892a" stroke="#e8892a" stroke-width="2" stroke-linejoin="round"/></g>'
      : '<g class="qfm2-ma"><path d="M89 122 L103 122 L96 127 Z" fill="#f4a340" stroke="#f4a340" stroke-width="2" stroke-linejoin="round"/><path d="M92 131 L100 131 L96 135 Z" fill="#e8892a" stroke="#e8892a" stroke-width="2" stroke-linejoin="round"/></g>' +
        '<g class="qfm2-mb"><path d="M88 124 L104 124 L96 133 Z" fill="#f4a340" stroke="#f4a340" stroke-width="2" stroke-linejoin="round"/></g>';
    s += '<g class="qfm2-whole"' + o(96, 206) + '>' +
      '<ellipse cx="82" cy="203" rx="11" ry="5" fill="#f4a340"/><ellipse cx="112" cy="203" rx="11" ry="5" fill="#f4a340"/>' +
      '<ellipse cx="96" cy="142" rx="44" ry="60" fill="#34425e"/>' +
      '<ellipse cx="96" cy="160" rx="30" ry="38" fill="#ffffff"/>' +
      '<ellipse cx="96" cy="117" rx="31" ry="24" fill="#ffffff"/>' +
      '<circle cx="73" cy="125" r="5" fill="#ffb3cf" opacity=".8"/><circle cx="119" cy="125" r="5" fill="#ffb3cf" opacity=".8"/>' +
      '<g class="qfm2-eyes">' + eye(84, 112, 5, 6.5, '#1f2638') + eye(108, 112, 5, 6.5, '#1f2638') + '</g>' +
      beak +
      '<g class="qfm2-hat"' + o(96, 82) + '><path d="M64 88 Q64 56 96 56 Q128 56 128 88 Z" fill="#e85d75"/><rect x="60" y="82" width="72" height="11" rx="5.5" fill="#ffb3c1"/><circle cx="96" cy="52" r="8" fill="#ffd1da"/></g>' +
      '<g class="qfm2-arm-l"' + o(58, 124) + '><path d="M60 116 Q36 146 42 176 Q56 160 64 130 Z" fill="#26324a"/></g>' +
      '<g class="qfm2-arm-r"' + o(134, 124) + '><path d="M132 116 Q156 146 150 176 Q136 160 128 130 Z" fill="#26324a"/>' +
        '<path d="M148 168 L176 143" stroke="#b98a5e" stroke-width="4.5" stroke-linecap="round"/><circle cx="179" cy="140" r="6.5" fill="#e85d75"/></g>' +
      '</g>';
    if (r === 'correct') {
      s += '<g class="qfm2-xy-note1"' + o(198, 108) + '><ellipse cx="194" cy="114" rx="6" ry="4.5" fill="#6b4fb3" transform="rotate(-20 194 114)"/><path d="M199.5 112 L199.5 94 Q206 98 208 104" stroke="#6b4fb3" stroke-width="3" fill="none" stroke-linecap="round"/></g>' +
        '<g class="qfm2-xy-note2"' + o(214, 86) + '><ellipse cx="212" cy="92" rx="6" ry="4.5" fill="#e85d75" transform="rotate(-20 212 92)"/><path d="M217.5 90 L217.5 72 Q224 76 226 82" stroke="#e85d75" stroke-width="3" fill="none" stroke-linecap="round"/></g>';
    } else {
      s += '<g class="qfm2-xy-card"' + o(192, 88) + '><rect x="160" y="66" width="64" height="42" rx="8" fill="#fffaf0" stroke="#d9cfee" stroke-width="2"/>' +
          '<path d="M168 99 H216" stroke="#e3dcf3" stroke-width="2"/>' +
          '<circle cx="172" cy="92" r="4" fill="#6b4fb3"/><circle cx="186" cy="86" r="4" fill="#6b4fb3"/><circle cx="200" cy="80" r="4" fill="#6b4fb3"/><circle cx="212" cy="88" r="4" fill="none" stroke="#6b4fb3" stroke-width="2"/>' +
          '<g class="qfm2-xy-ring"><circle cx="212" cy="88" r="8.5" fill="none" stroke="#7a63d6" stroke-width="2" stroke-dasharray="3 3"/></g></g>' +
        '<g class="qfm2-xy-mark"><rect x="189" y="149" width="20" height="41" rx="5" fill="none" stroke="#7a63d6" stroke-width="2.5" stroke-dasharray="5 4"/></g>';
    }
    return wrap(s);
  }

  /* ---------- 5. 烏龜小建築師 ---------- */
  function svgBuilder(r) {
    var s = '<ellipse cx="124" cy="208" rx="96" ry="7" fill="#eaf3e3"/>' +
      '<rect x="166" y="166" width="40" height="36" rx="4" fill="#ff9f5a" stroke="#e07f3a" stroke-width="2.5"/>' +
      '<rect x="170" y="132" width="32" height="34" rx="4" fill="#6cb6e8" stroke="#4a96cc" stroke-width="2.5"/>';
    if (r === 'correct') {
      s += '<path d="M180 202 L180 187 Q186 180 192 187 L192 202 Z" fill="#c8662a"/>' +
        '<g class="qfm2-bd-win"' + o(186, 149) + '><circle cx="186" cy="149" r="6.5" fill="#fff6d8" stroke="#4a96cc" stroke-width="2"/></g>';
    } else {
      s += '<g class="qfm2-bd-outline"><rect x="170" y="98" width="32" height="32" rx="4" fill="none" stroke="#7a63d6" stroke-width="2.5" stroke-dasharray="5 4"/></g>';
    }
    s += '<g class="qfm2-whole"' + o(96, 206) + '>' +
      '<ellipse cx="72" cy="200" rx="13" ry="7" fill="#7cc36a"/><ellipse cx="120" cy="200" rx="13" ry="7" fill="#7cc36a"/>' +
      '<path d="M34 172 Q34 98 96 98 Q158 98 158 172 Z" fill="#4f8f47"/>' +
      '<path d="M44 150 l8 -6 l8 6 l0 10 l-8 6 l-8 -6 Z M132 150 l8 -6 l8 6 l0 10 l-8 6 l-8 -6 Z M54 118 l8 -6 l8 6 l0 10 l-8 6 l-8 -6 Z M122 118 l8 -6 l8 6 l0 10 l-8 6 l-8 -6 Z" fill="#6aac5c"/>' +
      '<ellipse cx="96" cy="164" rx="36" ry="36" fill="#f2dc8f"/>' +
      '<path d="M70 152 H122 M66 168 H126 M72 184 H120" stroke="#ddc070" stroke-width="2.5" stroke-linecap="round"/>' +
      '<g class="qfm2-head"' + o(96, 118) + '><circle cx="96" cy="94" r="27" fill="#8fd07a"/>' +
        '<circle cx="79" cy="104" r="5" fill="#ffb3a8" opacity=".8"/><circle cx="113" cy="104" r="5" fill="#ffb3a8" opacity=".8"/>' +
        '<g class="qfm2-eyes">' + eye(86, 93, 5, 6, '#21361c') + eye(106, 93, 5, 6, '#21361c') + '</g>' +
        mouths(r, 96, 105, '#21361c') +
        '<path d="M70 82 Q70 58 96 58 Q122 58 122 82 Z" fill="#ffcc3d"/><rect x="92" y="58" width="8" height="24" rx="3" fill="#ffe27a"/><rect x="64" y="78" width="64" height="8" rx="4" fill="#f2b622"/></g>' +
      '<g class="qfm2-arm-l"' + o(62, 140) + '><path d="M64 138 Q46 150 48 170" stroke="#7cc36a" stroke-width="14" fill="none" stroke-linecap="round"/></g>' +
      '<g class="qfm2-arm-r"' + o(130, 140) + '><path d="M128 138 Q146 150 146 166" stroke="#7cc36a" stroke-width="14" fill="none" stroke-linecap="round"/></g>' +
      '</g>';
    if (r === 'correct') {
      s += '<g class="qfm2-bd-roof"' + o(186, 132) + '><path d="M164 132 L208 132 L186 104 Z" fill="#ffd35a" stroke="#e0ae2a" stroke-width="3" stroke-linejoin="round"/></g>';
    } else {
      s += '<g class="qfm2-bd-tape"' + o(174, 148) + '><rect x="174" y="146" width="30" height="5" fill="#ffe27a" stroke="#e0b52a" stroke-width="1"/><path d="M180 146 v3 M186 146 v3 M192 146 v3 M198 146 v3" stroke="#9a7a1a" stroke-width="1"/></g>' +
        '<g class="qfm2-bd-case"><rect x="158" y="141" width="16" height="15" rx="4" fill="#ffcc3d" stroke="#e0ae2a" stroke-width="2"/><circle cx="166" cy="148.5" r="3" fill="#e0ae2a"/></g>';
    }
    return wrap(s);
  }

  function sentinelFor(id) { return { selector: '.qfm2-sentinel', animation: 'qfm2-end-' + id }; }

  var variants = {
    painter: {
      id: 'painter', name: '刺蝟小畫家', character: '戴貝雷帽的刺蝟、畫架、畫筆與調色盤',
      duration: { correct: 2100, incorrect: 2000 }, sentinel: sentinelFor('painter'),
      motions: { correct: '揮筆畫出一道彩虹弧線，轉身舉起調色盤分享', incorrect: '退一步歪頭，舉筆比一比，換藍色畫出下一筆的虛線' },
      messages: {
        correct: ['你把想法畫出來了！願意說說你是用什麼方法想到的嗎？'],
        incorrect: ['退一步看看，換一種方法試試。你想從哪一步重新畫起？']
      },
      svg: svgPainter
    },
    chef: {
      id: 'chef', name: '章魚小廚師', character: '戴廚師帽的章魚、湯鍋與湯匙、食譜卡',
      duration: { correct: 2200, incorrect: 2100 }, sentinel: sentinelFor('chef'),
      motions: { correct: '攪拌湯鍋冒出熱氣，舉起湯匙邀大家一起嚐', incorrect: '拿出食譜卡圈出下一步，換個方向慢慢攪拌' },
      messages: {
        correct: ['完成囉！要不要把你的步驟分享給夥伴，一起嚐嚐看？'],
        incorrect: ['看看食譜的下一步。你想先確認哪一個步驟？']
      },
      svg: svgChef
    },
    reader: {
      id: 'reader', name: '貓頭鷹讀書會', character: '戴圓眼鏡的貓頭鷹、圖畫書與書籤',
      duration: { correct: 2000, incorrect: 2000 }, sentinel: sentinelFor('reader'),
      motions: { correct: '翻開書冒出點子燈泡，把書舉高給大家看', incorrect: '推推眼鏡、翻一頁，用翅膀指出要再讀的那一行' },
      messages: {
        correct: ['你找到線索了！想用自己的話，說說是怎麼找到的嗎？'],
        incorrect: ['翻到下一頁看看。題目裡哪一句話，你想再讀一次？']
      },
      svg: svgReader
    },
    xylo: {
      id: 'xylo', name: '企鵝木琴手', character: '戴毛線帽的企鵝、彩色木琴與琴槌、樂譜卡',
      duration: { correct: 2000, incorrect: 2100 }, sentinel: sentinelFor('xylo'),
      motions: { correct: '敲響兩根琴鍵飄出音符，揮手邀朋友一起來', incorrect: '看樂譜卡想一想，圈出下一個要試的琴鍵' },
      messages: {
        correct: ['旋律接起來了！想邀請誰聽聽你的做法？'],
        incorrect: ['換一個音試試看。你想先改哪一個地方？']
      },
      svg: svgXylo
    },
    builder: {
      id: 'builder', name: '烏龜小建築師', character: '戴工程帽的烏龜、積木小屋、捲尺',
      duration: { correct: 2100, incorrect: 2100 }, sentinel: sentinelFor('builder'),
      motions: { correct: '放上屋頂讓小屋完成，窗戶亮起後伸頭揮手', incorrect: '拉出捲尺量一量，抬頭看下一塊積木可以放哪裡' },
      messages: {
        correct: ['小屋蓋好了！你覺得哪一個步驟最重要？可以說給夥伴聽。'],
        incorrect: ['先量一量再放。下一塊積木，你打算放在哪裡？']
      },
      svg: svgBuilder
    }
  };
  Object.values(variants).forEach(def => quizFeedbackMotion.register(def));
})();

import {celebrateQuizLeaf,quizReadingWarning,stopQuizLeafCelebration} from './quiz-leaf-celebration.mjs';
// 選用後端模式不接收答案資料，不執行前端評分，不呼叫舊進度儲存。
export function initServerQuiz({ selectors, server }) {
  if (!server?.request || !server?.sessionId) throw new Error('缺少測驗場次或後端連線。');
  const el = key => typeof selectors?.[key] === 'string' ? document.getElementById(selectors[key]) : selectors?.[key];
  const root = el('container'), lock = el('lock'), content = el('content');
  const renderContent = (target, c) => renderQuizContent(target, {
    ...c,
    text: c?.text?.trim() === '書商未提供這一題的詳細解析。'
      ? '這一題目前沒有詳細解析，可以先核對正確答案。' : c?.text,
    media: (c?.media || []).map(media => ({ ...media,
      alt: media.alt === '書商原圖' ? '圖片'
        : media.alt === '書商原版聽力音檔' ? '聽力音檔' : media.alt,
    })),
  }, { imageLoading: 'eager' });
  let userId = null, generation = 0, state = null, cursor = 0, pending = null, selected = '', busy = false, loadError = '', showFullReview = false;
  let feedbackAnimation = null;
  let seenQuestion=null;
  // 依鼓勵原則撰寫的原創短句，不是阿德勒名言，也不推測孩子是否努力或用了哪個方法。
  const encouragement = {
    correct: [
      '你想怎麼說明自己的答案？用自己的話試試看。',
      '看看解析，找找和你的想法相同的地方。',
      '這一題完成了。你想帶走哪一個解題線索？',
      '你可以自己決定：先核對想法，或準備挑戰下一題。',
      '想一想：下次遇到相似的題目，你會怎麼開始？'
    ],
    incorrect: [
      '先看看解析，你想從哪一步重新想一想？',
      '這次答案不同。我們一起從解析找一個新線索。',
      '可以慢慢來，先找解析裡一個看得懂的地方。',
      '一題的結果不代表全部。你可以選一個步驟再想想。',
      '你願意試試另一種想法嗎？解析可以陪你找方向。'
    ]
  };
  const make = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
  const button = (text, fn, cls = '') => { const b = make('button', text, cls); b.type = 'button'; b.addEventListener('click', fn); return b; };
  const answered = q => Object.hasOwn(state?.responses || {}, q.id);
  const firstUnanswered = () => state.document.questions.findIndex(q => !answered(q));
  function stopAudio() { root.querySelectorAll('audio').forEach(a => a.pause()); }
  function say(text, error = false) { const n = root.querySelector('[role="status"]'); if (n) { n.textContent = text; n.dataset.error = String(error); } }
  function renderReview(article, q) {
    const review = state.reviews.find(r => r.question_id === q.id);
    if (!review) { article.append(make('p', '已儲存；正解與解析會在符合本場次揭答條件後顯示。', 'notice')); return; }
    const box = make('div', undefined, 'answer-preview');
    box.dataset.correct = String(review.correct);
    box.tabIndex = -1;
    const intro = make('div', undefined, 'feedback-intro');
    const character = make('div', undefined, 'feedback-character'); character.setAttribute('aria-hidden', 'true');
    const index = Math.max(0, state.document.questions.findIndex(item => item.id === q.id));
    // 同一題的套別固定；前五套加新增五套共十套，不因回看、重整或對錯而改變。
    const variant = quizFeedbackMotion.order[index % quizFeedbackMotion.order.length];
    let actor = null;
    box.dataset.motionVariant = variant || 'original';
    if (variant) {
      actor = quizFeedbackMotion.create({ variant, result: review.correct ? 'correct' : 'incorrect' });
      if (['painter', 'chef', 'reader', 'xylo', 'builder'].includes(variant)) actor.classList.add('qfm-second');
      character.classList.add('qfm-character'); character.append(actor);
    } else {
      const face = document.querySelector('.quiz-mascot svg');
      if (face) character.append(face.cloneNode(true));
      else character.append(make('span', review.correct ? '✓' : '♡', 'feedback-symbol'));
      character.append(make('span', '', 'feedback-spark spark-one'), make('span', '', 'feedback-spark spark-two'), make('span', '', 'feedback-spark spark-three'));
    }
    const message = make('div', undefined, 'feedback-message');
    message.append(make('strong', review.correct ? '這題答對了 ✓' : '這題還沒答對，一起看看解題想法。'));
    const phrases = review.correct ? encouragement.correct : encouragement.incorrect;
    message.append(make('p', phrases[Math.max(0, index) % phrases.length], 'feedback-encouragement'));
    intro.append(character, message); box.append(intro);
    const animate = !showFullReview && feedbackAnimation === q.id;
    if (animate) { box.classList.add('feedback-fresh'); feedbackAnimation = null; }
    box.append(make('p', q.type === 'single'
      ? `正確選項：${String.fromCharCode(65 + q.options.findIndex(o => o.id === review.answer.option_id))}`
      : `可接受答案：${review.answer.accepted.join('、')}`));
    renderContent(box, review.explanation); article.append(box);
    if (animate && actor) quizFeedbackMotion.play(actor);
  }
  function render() {
    stopAudio(); root.querySelectorAll('.qfm-actor').forEach(quizFeedbackMotion.stop); root.replaceChildren();
    const status = make('p', ''); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); root.append(status);
    if (!userId) return;
    if (!state) {
      say(loadError || '正在確認場次與作答紀錄…', Boolean(loadError));
      if (loadError) root.append(button('重新加入', () => load('join')));
      return;
    }
    const questions = state.document.questions;
    const count = Object.keys(state.responses).length;
    const heading = make('div', undefined, 'quiz-heading');
    heading.append(make('h2', state.document.title), make('p', `已作答 ${count} / ${questions.length} 題`, 'progress-label'));
    const progress = make('progress'); progress.max = questions.length; progress.value = count; progress.setAttribute('aria-label', '測驗作答進度');
    heading.append(progress); root.append(heading);
    if(state.complete&&state.leaf?.reason!=='not_eligible'){
     const messages={short_paper:'這份少於10題，不計葉片。',accuracy:'完成至少10題、正確率達60%，可長出1片葉子。先核對這次的解析，再繼續練習。',timing_unverified:'作答紀錄已保留；本次閱讀時間紀錄不完整，不追溯計葉。',same_content_already_earned:'這組題目已領過葉片，複習不重複計葉。'};
     if(state.leaf?.earned)root.append(make('p','🌿 努力樹已長出1片葉子！','quiz-leaf-state'));
     else if(messages[state.leaf?.reason])root.append(make('p',messages[state.leaf.reason],'quiz-leaf-state'));
    }
    root.classList.toggle('is-review', state.complete && showFullReview);
    if (state.status === 'closed') root.append(make('p', '老師已結束本場次。已儲存紀錄仍可查看。', 'notice'));
    if (state.complete && showFullReview) {
      root.append(make('p', '你已完成整份測驗，可以依自己的步調回看題目與解析。', 'notice'));
      root.append(button('回看最後一題', () => { showFullReview = false; cursor = questions.length - 1; render(); }, 'secondary'));
      for (const [index, q] of questions.entries()) {
        const article = make('article', undefined, 'question'); article.dataset.questionId = q.id;
        article.append(make('h3', `第 ${index + 1} 題 / ${questions.length} 題`));
        renderContent(article, q.material); renderContent(article, q.prompt);
        article.append(make('p', `你的答案：${q.type === 'single' ? String.fromCharCode(65 + q.options.findIndex(o => o.id === state.responses[q.id])) : state.responses[q.id]}`));
        if (q.type === 'single') q.options.forEach((o, i) => { const row = make('div', undefined, 'preview-option'); row.append(make('strong', `${String.fromCharCode(65 + i)}. `)); renderContent(row, o.content); article.append(row); });
        renderReview(article, q); root.append(article);
      }
      return;
    }
    if (state.complete) root.append(make('p', '所有答案已儲存。先確認這一題的結果，再查看整份作答與解析。', 'notice'));
    cursor = Math.min(cursor, questions.length - 1);
    const q = questions[cursor], saved = answered(q);
    if(!saved&&state.status==='open'&&seenQuestion!==q.id){seenQuestion=q.id;const g=generation;server.request('view_question',{session_id:server.sessionId,question_id:q.id}).catch(()=>{if(g===generation)seenQuestion=null;});}
    const review = state.reviews.find(r => r.question_id === q.id);
    const article = make('article', undefined, 'question'); article.dataset.questionId = q.id;
    article.append(make('h3', `第 ${cursor + 1} 題 / ${questions.length} 題`));
    if (q.material.text || q.material.media.length) {
      const material = make('section', undefined, 'material'); material.append(make('h4', '共用材料')); renderContent(material, q.material); article.append(material);
    }
    renderContent(article, q.prompt);
    const inputs = make('fieldset');
    // 鎖住作答控制項，保留已作答選項內圖片的燈箱操作。
    const choicesLocked = saved || Boolean(pending) || busy || state.status === 'closed';
    inputs.dataset.locked = String(choicesLocked);
    inputs.className = 'quiz-choices';
    // 長文、表格或複雜圖文選項使用整列，避免四格擠壓閱讀空間。
    inputs.classList.toggle('long-options', q.type !== 'single' || q.options.some(o => o.content.text.length > 34 || o.content.layout?.some(p => p.type === 'table') || o.content.media.length > 1));
    const legend = make('legend', q.type === 'single' ? '選擇一個答案' : '填入你的答案'); inputs.append(legend);
    if (q.type === 'single') {
      q.options.forEach((o, i) => {
        const label = make('label', undefined, 'student-option'); const input = make('input'); input.type = 'radio'; input.name = `q-${q.id}`; input.value = o.id;
        input.disabled = choicesLocked;
        input.checked = (saved ? state.responses[q.id] : pending?.response ?? selected) === o.id;
        input.addEventListener('change', () => { selected = o.id; });
        const body = make('div', undefined, 'option-body'); renderContent(body, o.content);
        const badge = make('strong', String.fromCharCode(65 + i), 'option-badge');
        label.append(input, badge, body);
        if (saved && review && q.type === 'single') {
          const correctOption = o.id === review.answer.option_id;
          label.dataset.result = correctOption ? 'correct' : input.checked ? 'incorrect' : 'other';
          if (correctOption || input.checked) label.append(make('span', correctOption ? (input.checked ? '✓ 你的答案・答對了' : '✓ 正確答案') : '× 你的答案', 'option-result'));
        }
        inputs.append(label);
      });
    } else {
      const input = make('textarea'); input.setAttribute('aria-label', '簡答內容'); input.maxLength = 2000;
      input.disabled = choicesLocked;
      input.value = saved ? state.responses[q.id] : pending?.response ?? selected;
      input.addEventListener('input', () => { selected = input.value; }); inputs.append(input);
    }
    article.append(inputs);
    const actions = make('div', undefined, 'toolbar quiz-actions');
    if (saved) renderReview(article, q);
    else if (state.status === 'open') {
      const submitButton = button(busy ? '正在儲存…' : pending ? '以相同答案重試儲存' : '送出答案', submit, 'quiz-primary'); submitButton.disabled = busy; submitButton.id = 'server-submit'; actions.append(submitButton);
    }
    if (cursor > 0 && !pending) actions.append(button('回看前一題', () => { cursor--; selected = ''; render(); }, 'secondary'));
    if (saved && cursor < questions.length - 1) actions.append(button('下一題', () => { cursor++; selected = ''; render(); root.querySelector('.question')?.scrollIntoView({ block: 'start' }); }, 'quiz-primary'));
    if (state.complete) actions.append(button('查看整份作答與解析', () => { showFullReview = true; render(); }, 'quiz-primary'));
    actions.append(button('更新儲存狀態', () => load('resume', true), 'secondary quiz-refresh')); article.append(actions); root.append(article);
    if (pending) say('這次答案的儲存狀態尚未確認，請以相同答案重試或更新狀態。', true);
  }
  async function load(action, preserveCursor = false) {
    if (busy || !userId) return;
    const token = generation; busy = true; say('正在讀取儲存紀錄…');
    try {
      const next = await server.request(action, { session_id: server.sessionId });
      if (generation !== token) return;
      state = next; loadError = ''; busy = false;
      if (pending && Object.hasOwn(state.responses, pending.question_id)) pending = null;
      if (!preserveCursor) { const index = firstUnanswered(); cursor = index < 0 ? state.document.questions.length - 1 : index; selected = ''; }
      render();
    } catch (e) {
      if (generation === token) { loadError = e.message; if (!state) render(); else say(e.message, true); }
    } finally { if (generation === token) { busy = false; const b = root.querySelector('#server-submit'); if (b) b.disabled = false; } }
  }
  async function submit() {
    if (busy || !state || !userId) return;
    const q = state.document.questions[cursor];
    if (answered(q)) return;
    if (!pending) {
      if (!selected.trim()) return say('請先選擇選項或填入答案。', true);
      pending = { question_id: q.id, response: selected, request_id: crypto.randomUUID() };
    }
    const token = generation; busy = true; render(); say('正在儲存答案…');
    try {
      const next = await server.request('submit', { session_id: server.sessionId, ...pending });
      if (generation !== token) return;
      // 只在送答成功、後端允許揭答後播放；回看、重整與整卷檢視不反覆播放。
      feedbackAnimation = next.reviews.some(r => r.question_id === q.id) ? q.id : null;
      state = next; pending = null; busy = false; render(); say('答案已儲存。');
      if(next.leaf?.earned_now)celebrateQuizLeaf();
      root.querySelector('.answer-preview')?.focus();
    } catch (e) { if (generation === token) { busy = false;if(e.code==='answer_too_fast'){pending=null;quizReadingWarning();} render(); say(e.message, true); } }
    finally { if (generation === token) { busy = false; const b = root.querySelector('#server-submit'); if (b) b.disabled = false; } }
  }
  async function handleAuthChange(session) {
    const id = session?.user?.id || null;
    if (id === userId) return;
    stopQuizLeafCelebration();
    generation++; userId = id; busy = false; state = null; selected = ''; pending = null; loadError = ''; cursor = 0; showFullReview = false; feedbackAnimation = null;seenQuestion=null;
    if (lock) { lock.hidden = Boolean(id); lock.classList.toggle('hidden', Boolean(id)); }
    if (content) { content.hidden = !id; content.classList.toggle('hidden', !id); }
    render(); if (id) await load('join');
  }
  return { handleAuthChange, render, submit, refresh: () => load('resume', true), destroy: () => handleAuthChange(null) };
}
