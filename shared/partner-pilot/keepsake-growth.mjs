// Presentation only: draws and animates the partner keepsake growth scene.
// Counts come straight from the server award ({leaves, flowers}); nothing here decides,
// claims or stores rewards. The markup's natural state IS the finished pose, so a
// cancelled / reduced-motion / un-animated scene always shows the complete keepsake.
// Leaf and flower shapes reuse partnerKeepsakeSvg() geometry so they match the effort tree.

const GOLD = '#b88632', CREAM = '#fff4cc', STEM = '#6f9e6a';
const LEAF_L = 'M3 37Q0 1 33 4Q39 29 3 37Z', LEAF_R = 'M29 39Q24 8 60 5Q64 36 29 39Z';
const PETALS = ['#f9b7c7', '#c1c6f5', '#f9b7c7', '#b1e4d3', '#ffe6a0'];
const HEART = 'M22 32q5-11 10 0q5-11 10 0q-3 7-10 11q-7-4-10-11';
const STAR = 'M0-5L1.3-1.3L5 0L1.3 1.3L0 5L-1.3 1.3L-5 0L-1.3-1.3Z';
const SLOT = 64, H = 104, GROUND = 94;

const clampCount = (n, max) => Math.max(0, Math.min(max, Number.isInteger(n) ? n : 0));
const star = (x, y, s, fill = '#f3c652') =>
 `<g transform="translate(${x} ${y}) scale(${s})"><path data-kg="star" d="${STAR}" fill="${fill}" opacity="0"/></g>`;

function leafSprig(x, i) {
 // Each sprig leans a little differently so two leaves read as a pair, not a copy.
 const lean = i % 2 ? 7 : -6, top = i % 2 ? 40 : 34, tipX = x + lean;
 const stem = `M${x} ${GROUND}C${x - lean * .6} ${GROUND - 20} ${tipX + lean * .4} ${top + 22} ${tipX + .32} ${top - 9.12}`;
 return `<g data-kg-item="leaf">
  <circle data-kg="seed" cx="${x}" cy="${GROUND}" r="3" fill="#d9a441" stroke="${GOLD}" stroke-width="1"/>
  <path data-kg="stem" d="${stem}" pathLength="1" stroke-dasharray="1" stroke-dashoffset="0" fill="none" stroke="${STEM}" stroke-width="3" stroke-linecap="round"/>
  <g transform="translate(${tipX - 22} ${top - 30}) scale(.72)">
   <g data-kg="leaf-l"><path d="${LEAF_L}" fill="#8ed3b0" stroke="${GOLD}" stroke-width="2.4"/></g>
   <g data-kg="leaf-r"><path d="${LEAF_R}" fill="#4caeaa" stroke="${GOLD}" stroke-width="2.4"/></g>
   <path data-kg="vein" d="M7 34L27 10M31 35L54 11" stroke="${CREAM}" stroke-width="2" stroke-linecap="round"/>
   <path data-kg="glint" d="${LEAF_L}" pathLength="1" fill="none" stroke="#fff1b8" stroke-width="3.2" stroke-linecap="round" stroke-dasharray=".18 .82" opacity="0"/>
   <path data-kg="glint" d="${LEAF_R}" pathLength="1" fill="none" stroke="#fff1b8" stroke-width="3.2" stroke-linecap="round" stroke-dasharray=".18 .82" opacity="0"/>
   <circle data-kg="node" cx="31" cy="29" r="6" fill="${CREAM}" stroke="${GOLD}" stroke-width="2"/>
  </g>
  ${star(tipX - 24, top - 24, .9)}${star(tipX + 26, top - 30, .7, '#ffe6a0')}${star(tipX + 22, top + 14, .55)}
 </g>`;
}

function flowerSprig(x) {
 const head = 30, stem = `M${x} ${GROUND}C${x + 6} ${GROUND - 22} ${x - 6} ${head + 34} ${x} ${head + 14}`;
 const petals = PETALS.map((c, i) => `<g transform="rotate(${i * 72} 32 32)"><ellipse data-kg="petal" cx="32" cy="19" rx="11" ry="17" fill="${c}" stroke="${GOLD}" stroke-width="2"/></g>`).join('');
 return `<g data-kg-item="flower">
  <circle data-kg="seed" cx="${x}" cy="${GROUND}" r="3" fill="#d9a441" stroke="${GOLD}" stroke-width="1"/>
  <path data-kg="stem" d="${stem}" pathLength="1" stroke-dasharray="1" stroke-dashoffset="0" fill="none" stroke="${STEM}" stroke-width="3" stroke-linecap="round"/>
  <g transform="translate(${x - 15} ${head + 34}) rotate(-28) scale(.34)"><g data-kg="sepal"><path d="${LEAF_R}" fill="#8ed3b0" stroke="${GOLD}" stroke-width="4"/></g></g>
  <g transform="translate(${x - 22} ${head - 22}) scale(.69)"><g data-kg="bloom">
   <circle data-kg="halo" cx="32" cy="32" r="30" fill="#fff0b8" opacity="0"/>
   ${petals}
   <path data-kg="bud" d="M32 14C22 22 22 36 32 42C42 36 42 22 32 14Z" fill="#f9b7c7" stroke="${GOLD}" stroke-width="2" opacity="0"/>
   <circle data-kg="core" cx="32" cy="32" r="12" fill="#fff7dd" stroke="${GOLD}" stroke-width="2"/>
   <path data-kg="heart" d="${HEART}" fill="#dfad45"/>
  </g></g>
  ${star(x - 27, head - 18, 1)}${star(x + 28, head - 12, .75, '#ffe6a0')}${star(x + 25, head + 26, .55)}${star(x - 25, head + 22, .5, '#f9b7c7')}
 </g>`;
}

/** Composed scene markup for one server award. Only {leaves, flowers} are read. */
export function keepsakeGrowthSvg(award, {label = ''} = {}) {
 const leaves = clampCount(award?.leaves, 2), flowers = clampCount(award?.flowers, 1);
 const items = [...Array(leaves).fill('leaf'), ...Array(flowers).fill('flower')];
 if (!items.length) return '';
 const w = items.length * SLOT + 12;
 const body = items.map((kind, i) => {
  const x = 6 + SLOT * i + SLOT / 2;
  return kind === 'flower' ? flowerSprig(x) : leafSprig(x, i);
 }).join('');
 const a11y = label ? `role="img" aria-label="${label.replace(/[&<>"]/g, '')}"` : 'aria-hidden="true"';
 return `<svg class="keepsake-growth" data-keepsake-growth data-leaves="${leaves}" data-flowers="${flowers}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${H}" ${a11y} focusable="false">
 <ellipse data-kg="ground" cx="${w / 2}" cy="${GROUND + 2}" rx="${w / 2 - 6}" ry="6" fill="#dcebc6"/>
 <path data-kg="ground-line" d="M10 ${GROUND + 1}Q${w / 2} ${GROUND - 5} ${w - 10} ${GROUND + 1}" pathLength="1" stroke-dasharray="1" stroke-dashoffset="0" fill="none" stroke="#a9c98b" stroke-width="2" stroke-linecap="round"/>
 ${body}
</svg>`;
}

const SPRING = 'cubic-bezier(.34,1.45,.55,1)', SOFT = 'cubic-bezier(.22,.8,.3,1)';

// One storyboard per item. t = ms offset of this item. Every keyframe list ends at the
// element's natural (final) look; `fill:'backwards'` only holds the first frame during delay.
function leafTimeline(g, t) {
 return [
  ['seed', [{transform: 'scale(0)', opacity: 0}, {transform: 'scale(1.35)', opacity: 1, offset: .6}, {transform: 'scale(1)'}], 0, 420, SPRING, '50% 50%'],
  ['stem', [{strokeDashoffset: 1}, {strokeDashoffset: 0}], 220, 900, SOFT],
  ['leaf-l', [{transform: 'scale(0) rotate(-35deg)', opacity: 0}, {transform: 'scale(1.07) rotate(4deg)', opacity: 1, offset: .7}, {transform: 'scale(1) rotate(0)'}], 950, 760, SOFT, '0% 100%'],
  ['leaf-r', [{transform: 'scale(0) rotate(30deg)', opacity: 0}, {transform: 'scale(1.07) rotate(-4deg)', opacity: 1, offset: .7}, {transform: 'scale(1) rotate(0)'}], 1150, 760, SOFT, '10% 100%'],
  ['vein', [{opacity: 0}, {opacity: 1}], 1650, 420, 'ease-out'],
  ['node', [{transform: 'scale(0)'}, {transform: 'scale(1.3)', offset: .6}, {transform: 'scale(1)'}], 1750, 420, SPRING, '50% 50%'],
  ['glint', [{strokeDashoffset: .2, opacity: 0}, {opacity: 1, offset: .2}, {opacity: 1, offset: .75}, {strokeDashoffset: -.8, opacity: 0}], 2050, 900, 'ease-in-out', null, 140],
  ['star', [{transform: 'scale(0) rotate(0)', opacity: 0}, {transform: 'scale(1) rotate(45deg)', opacity: 1, offset: .45}, {transform: 'scale(.6) rotate(90deg)', opacity: 0}], 2350, 900, 'ease-out', '50% 50%', 160]
 ].map(step => ({g, t, step}));
}
function flowerTimeline(g, t) {
 return [
  ['seed', [{transform: 'scale(0)', opacity: 0}, {transform: 'scale(1.35)', opacity: 1, offset: .6}, {transform: 'scale(1)'}], 0, 420, SPRING, '50% 50%'],
  ['stem', [{strokeDashoffset: 1}, {strokeDashoffset: 0}], 220, 950, SOFT],
  ['sepal', [{transform: 'scale(0)', opacity: 0}, {transform: 'scale(1)', opacity: 1}], 850, 600, SPRING, '10% 100%'],
  ['bud', [{transform: 'scale(0)', opacity: 0}, {transform: 'scale(1)', opacity: 1, offset: .35}, {transform: 'scale(1.08)', opacity: 1, offset: .7}, {transform: 'scale(.6)', opacity: 0}], 1050, 900, SOFT, '50% 100%'],
  ['core', [{transform: 'scale(0)'}, {transform: 'scale(1)'}], 1250, 500, SPRING, '50% 50%'],
  ['petal', [{transform: 'scale(.12,.25)', opacity: 0}, {transform: 'scale(1.08,1.1)', opacity: 1, offset: .72}, {transform: 'scale(1)'}], 1550, 680, SOFT, '50% 88%', 170],
  ['heart', [{opacity: .2, transform: 'scale(.7)'}, {opacity: .35, transform: 'scale(.7)', offset: .3}, {opacity: 1, transform: 'scale(1.15)', offset: .75}, {opacity: 1, transform: 'scale(1)'}], 2350, 700, 'ease-out', '50% 60%'],
  ['halo', [{opacity: 0, transform: 'scale(.6)'}, {opacity: .75, transform: 'scale(1)', offset: .35}, {opacity: 0, transform: 'scale(1.12)'}], 2550, 1000, 'ease-out', '50% 50%'],
  ['bloom', [{transform: 'scale(1)'}, {transform: 'scale(1.045)', offset: .5}, {transform: 'scale(1)'}], 3050, 1100, 'ease-in-out', '50% 50%'],
  ['star', [{transform: 'scale(0) rotate(0)', opacity: 0}, {transform: 'scale(1) rotate(45deg)', opacity: 1, offset: .45}, {transform: 'scale(.6) rotate(90deg)', opacity: 0}], 2600, 950, 'ease-out', '50% 50%', 150]
 ].map(step => ({g, t, step}));
}

export function prefersReducedKeepsakeMotion() {
 return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Plays the growth scene inside `root` once and leaves it in its finished pose.
 * Returns {stop, finished}. stop() cancels instantly (scene stays complete).
 * No timers: delays live inside the Web Animations; nothing loops.
 */
export function createKeepsakeGrowth() {
 let running = [], activeSvg = null, unwatch = () => {};
 function stop() {
  const old = running; running = [];
  for (const a of old) a.cancel();
  if (activeSvg?.dataset.growth === 'playing') activeSvg.dataset.growth = 'static';
  activeSvg = null; unwatch(); unwatch = () => {};
 }
 function play(root, {reduced = prefersReducedKeepsakeMotion()} = {}) {
  stop();
  const svg = root?.matches?.('[data-keepsake-growth]') ? root : root?.querySelector?.('[data-keepsake-growth]');
  if (!svg) return {stop, finished: Promise.resolve('none')};
  if (reduced || (typeof document !== 'undefined' && document.hidden) || typeof svg.animate !== 'function') {
   svg.dataset.growth = 'static';
   return {stop, finished: Promise.resolve('static')};
  }
  svg.dataset.growth = 'playing';
  const plan = [...svg.querySelectorAll('[data-kg-item]')].flatMap((g, i) =>
   (g.dataset.kgItem === 'flower' ? flowerTimeline : leafTimeline)(g, 200 + i * 520));
  plan.unshift({g: svg, t: 0, step: ['ground-line', [{strokeDashoffset: 1}, {strokeDashoffset: 0}], 0, 700, SOFT]});
  const mine = [];
  for (const {g, t, step: [part, frames, delay, duration, easing, origin, stagger = 0]} of plan) {
   const scope = g === svg ? svg : g;
   const nodes = part === 'ground-line' ? svg.querySelectorAll('[data-kg="ground-line"]') : scope.querySelectorAll(`[data-kg="${part}"]`);
   nodes.forEach((el, n) => {
    if (origin) { el.style.transformBox = 'fill-box'; el.style.transformOrigin = origin; }
    mine.push(el.animate(frames, {delay: t + delay + n * stagger, duration, easing, fill: 'backwards'}));
   });
  }
  running = mine; activeSvg = svg;
  const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  const onReduced = () => { if (mq?.matches) stop(); };
  const onHidden = () => { if (document.hidden) stop(); };
  if (mq?.addEventListener) mq.addEventListener('change', onReduced); else mq?.addListener?.(onReduced);
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onHidden);
  unwatch = () => {
   if (mq?.removeEventListener) mq.removeEventListener('change', onReduced); else mq?.removeListener?.(onReduced);
   if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onHidden);
  };
  const finished = Promise.all(mine.map(a => a.finished)).then(() => {
   if (running === mine) { svg.dataset.growth = 'done'; running = []; activeSvg = null; unwatch(); unwatch = () => {}; }
   return 'done';
  }, () => 'cancelled');
  return {stop, finished};
 }
 return {play, stop};
}
