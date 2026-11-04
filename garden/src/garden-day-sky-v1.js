/*
 * 晴日天空 v1：一個靜止的柔和小太陽，加三朵慢慢飄的雲。只在晴日白天畫，樹永遠是主角。
 * 瀏覽器：window.GardenDaySkyV1；CommonJS：require('./garden-day-sky-v1.js')。
 *
 * 舞台座標 960×760，實際可見 x 80..880。頁面要在畫樹之前呼叫 draw。
 * 不開 RAF、不用 timer、不監聽事件、不讀系統時間：時間全部來自 timeMs，頁面暫停它就停。
 * 太陽與雲各畫一次到快取 canvas（第一次 draw 才建立），之後每幀只有 drawImage，沒有 blur。
 * snapshot 不碰 document，Node 也能跑。
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GardenDaySkyV1 = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var CLIP = Object.freeze({ left: 80, right: 880 });
  var WRAP_PAD = 12;       // 整朵雲離開可見範圍再多這麼遠才換邊
  var SPRITE_SCALE = 2;    // 快取圖的解析度倍數
  var SUN = Object.freeze({ x: 795, y: 90, radius: 24, haloRadius: 70 });
  // 候選值，要在畫面上確認。x0 是 timeMs = 0 的中心，也是減少動態時的固定位置；
  // 三朵都放在樹冠外的上方角落附近，避開太陽正下方。
  var CLOUDS = Object.freeze([
    Object.freeze({ id: 'a', x0: 148, y: 96, w: 122, speed: 2.1, alpha: 0.9,
      puffs: [[0.2, 0.68, 0.14], [0.38, 0.56, 0.18], [0.58, 0.52, 0.22], [0.78, 0.66, 0.15], [0.5, 0.66, 0.16]] }),
    Object.freeze({ id: 'b', x0: 826, y: 166, w: 94, speed: 3.2, alpha: 0.82,
      puffs: [[0.22, 0.66, 0.15], [0.44, 0.52, 0.21], [0.66, 0.58, 0.19], [0.82, 0.7, 0.12]] }),
    Object.freeze({ id: 'c', x0: 296, y: 62, w: 74, speed: 1.6, alpha: 0.76,
      puffs: [[0.24, 0.64, 0.16], [0.5, 0.5, 0.23], [0.76, 0.64, 0.17]] })
  ]);
  var CLOUD_ASPECT = 0.5;  // 雲的高 ÷ 寬

  function isVisible(opts) { var o = opts || {}; return o.scene === 'day' && o.isDay !== false; }
  function clock(timeMs) { return Number.isFinite(timeMs) ? timeMs : 0; }
  function mod(v, n) { return ((v % n) + n) % n; }

  /** 雲的純幾何。換邊點都在可見範圍外，所以 x 在畫面內永遠連續。 */
  function cloudAt(c, timeMs, reduced) {
    var h = c.w * CLOUD_ASPECT, xMin = CLIP.left - c.w / 2 - WRAP_PAD, xMax = CLIP.right + c.w / 2 + WRAP_PAD;
    var moved = reduced ? 0 : c.speed * clock(timeMs) / 1000;
    var x = xMin + mod(c.x0 + moved - xMin, xMax - xMin);
    return { id: c.id, x: x, y: c.y, w: c.w, h: h, speed: reduced ? 0 : c.speed, alpha: c.alpha, wrapMin: xMin, wrapMax: xMax,
             onScreen: x + c.w / 2 > CLIP.left && x - c.w / 2 < CLIP.right };
  }

  /** 給 Codex 用 Node 驗證。不可見時 sun 是 null、clouds 是空的。 */
  function snapshot(timeMs, opts) {
    var visible = isVisible(opts), reduced = !!(opts && opts.reduced);
    return {
      visible: visible, reduced: reduced, clip: { left: CLIP.left, right: CLIP.right },
      sun: visible ? { x: SUN.x, y: SUN.y, radius: SUN.radius, haloRadius: SUN.haloRadius } : null,
      clouds: visible ? CLOUDS.map(function (c) { return cloudAt(c, timeMs, reduced); }) : []
    };
  }

  // ---------- 快取圖：只建立一次 ----------
  var sprites = null;
  function makeCanvas(w, h) {
    if (typeof document !== 'undefined') { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
    return typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : null;
  }
  /** 一張放射漸層同時畫日面與光暈：日面邊緣柔和，光暈很淡。 */
  function makeSun() {
    var R = SUN.haloRadius * SPRITE_SCALE, cv = makeCanvas(R * 2, R * 2);
    if (!cv) return null;
    var g = cv.getContext('2d'), edge = SUN.radius / SUN.haloRadius, grad = g.createRadialGradient(R, R, 0, R, R, R);
    grad.addColorStop(0, 'rgba(255,247,214,1)');
    grad.addColorStop(edge * 0.8, 'rgba(255,233,160,1)');
    grad.addColorStop(edge, 'rgba(255,225,140,0.92)');
    grad.addColorStop(edge * 1.12, 'rgba(255,232,170,0.34)');
    grad.addColorStop(0.62, 'rgba(255,238,190,0.12)');
    grad.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, R * 2, R * 2);
    return cv;
  }
  /** 幾個邊緣柔和的圓疊成蓬鬆雲團，底部帶一點冷色陰影，再把底緣收淡。 */
  function makeCloud(c) {
    var W = Math.ceil(c.w * SPRITE_SCALE), H = Math.ceil(c.w * CLOUD_ASPECT * SPRITE_SCALE), cv = makeCanvas(W, H);
    if (!cv) return null;
    var g = cv.getContext('2d');
    c.puffs.forEach(function (p) {
      var x = p[0] * W, y = p[1] * H, r = p[2] * W, grad = g.createRadialGradient(x, y - r * 0.2, 0, x, y, r);
      grad.addColorStop(0, 'rgba(255,254,250,1)');
      grad.addColorStop(0.68, 'rgba(255,253,248,0.94)');
      grad.addColorStop(1, 'rgba(255,253,248,0)');
      g.fillStyle = grad;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    });
    g.globalCompositeOperation = 'source-atop';
    var shade = g.createLinearGradient(0, 0, 0, H);
    shade.addColorStop(0.45, 'rgba(204,220,234,0)');
    shade.addColorStop(1, 'rgba(196,214,230,0.55)');
    g.fillStyle = shade;
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'destination-out';
    var base = g.createLinearGradient(0, H * 0.82, 0, H);
    base.addColorStop(0, 'rgba(0,0,0,0)');
    base.addColorStop(1, 'rgba(0,0,0,1)');
    g.fillStyle = base;
    g.fillRect(0, H * 0.82, W, H * 0.18);
    return cv;
  }
  function ensureSprites() {
    if (sprites) return sprites;
    var sun = makeSun();
    if (!sun) return null;
    var clouds = {};
    CLOUDS.forEach(function (c) { clouds[c.id] = makeCloud(c); });
    sprites = { sun: sun, clouds: clouds };
    return sprites;
  }

  /**
   * opts：{ scene, isDay, reduced }。只在 scene === 'day' 且 isDay !== false 時畫。
   * 回傳有沒有畫。不動頁面的 ctx.filter；其他繪圖狀態都會還原。
   */
  function draw(ctx, timeMs, opts) {
    if (!ctx || !isVisible(opts)) return false;
    var sp = ensureSprites();
    if (!sp) return false;
    var reduced = !!opts.reduced, R = SUN.haloRadius;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.drawImage(sp.sun, SUN.x - R, SUN.y - R, R * 2, R * 2);
    CLOUDS.forEach(function (c) {
      var q = cloudAt(c, timeMs, reduced);
      if (!q.onScreen) return;
      ctx.globalAlpha = q.alpha;
      ctx.drawImage(sp.clouds[c.id], q.x - q.w / 2, q.y - q.h / 2, q.w, q.h);
    });
    ctx.restore();
    return true;
  }

  return Object.freeze({ draw: draw, snapshot: snapshot, SUN: SUN, CLOUDS: CLOUDS, CLIP: CLIP });
});
