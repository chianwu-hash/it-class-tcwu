/*
 * 樹後小窩 v5（狗兔）：由 garden-pets-homes-v4 複製後替狗加斜向步態；舊檔保留不動。兔子分支的姿勢輸出和 v4 相同。
 * 純邏輯：不讀 DOM、不畫圖、不用 Math.random、不用系統時間、不連網路或 storage；只靠 update(dt) 前進。
 * CommonJS：require('./garden-pets-homes-v5.js')；瀏覽器：先載入 garden-pets-v2.js → window.GardenPetsHomesV5；可用 opts.v2 注入。
 *
 * 平常播放 v2 計畫（t 可凍結）；要做別的事時，先走到安全接點（站姿或完整步態循環的結尾），
 * 記下離開點，再跑一串「腳本」；腳本結束會走回離開點，從同一個 t 接回原路。
 *
 * 規則：
 *  - 原地序列 x/y 不動；只有 side（側走／短跳）、diag（斜向步態）與 gait（低姿背面／正面步態）會移動。
 *  - 狗有斜向圖時，戶外每段算 r = |dy/dx|：r >= diagThreshold 用 rear3qwalk／front3qwalk，否則側走；繞樹也一樣，不再低姿爬。
 *  - 狗沒有斜向圖、或兔子：繞樹與 v4 相同。
 *  - 低姿圖（crouch、away、rearwalk、frontwalk、lowturn）在進出窩時只能出現在門前到屋內。
 *  - 換層只發生在根外、原地：低姿繞樹在 T（窄身格），其他在 homeT（正常站姿）；不會邊走邊換層。
 *  - turn 格不鏡像；換方向一律經過 turn 0..2，不直接翻面。
 *  - 缺素材的功能回報 assets-pending，不用別的圖代替。
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./garden-pets-v2.js'));
  else root.GardenPetsHomesV5 = factory(root.GardenPetsV2);
})(typeof self !== 'undefined' ? self : this, function (defaultV2) {
  'use strict';

  var VERSION = 'garden-pets-homes-v5-1';
  /** v3 新增的姿勢組與格數；walk、stand、sniff、turn、hop、ears 仍從 v2 讀。兔子下一輪用同樣的組名。 */
  var GROUPS = Object.freeze({
    crouch: 2, away: 3, rearwalk: 4, frontwalk: 4, lowturn: 3, peek: 3,
    lie: 3, rest: 3, wake: 3, sit: 2, wave: 2, shake: 2, yawn: 2
  });
  /** v5 斜向步態：只有狗；兩組都到齊才開。 */
  var DIAGONAL_GROUPS = Object.freeze({ rear3qwalk: 8, front3qwalk: 8 });
  var FEATURE_GROUPS = Object.freeze({
    behind: ['crouch', 'away', 'rearwalk', 'frontwalk', 'lowturn'],
    peek: ['crouch', 'away', 'rearwalk', 'frontwalk', 'lowturn', 'peek'],
    enter: ['crouch', 'away', 'rearwalk', 'frontwalk', 'lowturn', 'lie', 'rest'],
    insideTap: ['lie', 'rest', 'wake'],
    tap: ['sit']
  });
  var TAP_KINDS = Object.freeze(['wave', 'shake', 'yawn']);
  // 候選值，要看真圖與實際播放才定；都可用 opts.timing 覆寫。
  var TIMING = Object.freeze({
    gaitFrameMs: 200, gaitSpeed: 20, crouchMs: 260, awayMs: 260, lowturnMs: 260, turnMs: 240, standMs: 180,
    lieMs: 360, lazyMs: 5000, breathMs: 1700, lazyAgainEvery: 8, lazyAgainMs: 3000, dryStableMs: 8000,
    excursionMinMs: 25000, excursionMaxMs: 50000, tapWaitMs: 2500, behindHoldMs: 1200,
    diagThreshold: 0.25, diagMinLen: 20, diagFrameMs: 200, diagForeshorten: 0.65, diagHoldMs: 200, diagRamp: 0.18
  });
  // 舞台座標。S：前景走道上的根外點；T：根外的換層點（沿用小貓已驗的 755,694 附近）；P：樹幹右緣後方的探頭點。
  // 都是候選值，樹根範圍要用新圖的 visibleBoxes 與樹 alpha 核對。
  // T.x 由 755 右移到 762：away 2 在樹 B 還有 4 個重疊像素；仍是原地換層，要用兩棵樹的 alpha 再量。
  // homeS／homeQ／homeT 只給站姿路線用：站姿比低姿寬，不能沿用 T 換層；低姿繞樹與探頭仍走 S、T。
  var POINTS = Object.freeze({ S: { x: 768, y: 745 }, T: { x: 762, y: 694 }, P: { x: 572, y: 702 }, laneY: 750, homeS: { x: 738, y: 745 }, homeQ: { x: 790, y: 711 }, homeT: { x: 764, y: 694 } });
  // 窩在樹後的候選框；實際比例與門洞都由 manifest 的 cabin 計算，不寫死任何舊尺寸。
  var HOME_FRAME = Object.freeze({ w: 260, right: 865, base: 680 });
  var HOME_SCALE = 0.66;   // 門前與屋內的自然比例（候選 0.63～0.7）
  /**
   * 兔子的 rearwalk／frontwalk 是低姿短跳，一循環就是一跳：伏低與著地時不動，蹬地與騰空才前進。
   * from／to 是這一跳的位移比例，相鄰格的 to 與 from 必須相同；狗仍是等速步態，不用這張表。
   */
  var RABBIT_GAIT_TABLE = Object.freeze([
    Object.freeze({ index: 0, ms: 200, from: 0, to: 0, label: '伏低蓄力' }),
    Object.freeze({ index: 1, ms: 110, from: 0, to: 0.2, label: '後腳蹬地' }),
    Object.freeze({ index: 2, ms: 170, from: 0.2, to: 1, air: true, label: '低騰空' }),
    Object.freeze({ index: 3, ms: 200, from: 1, to: 1, label: '前腳著地、後腳前收' })
  ]);
  var RABBIT_GAIT_MS = RABBIT_GAIT_TABLE.reduce(function (a, h) { return a + h.ms; }, 0);
  var RABBIT_GAIT_HOP = 16;   // 候選值：每跳的縱深位移（舞台單位），要依真圖調，可用 motion.gaitHopAdvance 覆寫

  function hashSeed(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    return h >>> 0;
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function round1(v) { return Math.round(v * 10) / 10; }
  /** 比例只由腳底 y 決定：y >= 740 是 1，y <= farY 是 far，中間線性。走到哪就是多大，不會突然變小。 */
  function depthAt(y, farY, far) { return far + (1 - far) * clamp((y - farY) / (740 - farY), 0, 1); }
  /** 起訖平滑、中段等速；u 與回傳值都在 0..1。 */
  function rampEase(u, a) {
    var v = 1 / (1 - a);
    if (u <= 0) return 0;
    if (u >= 1) return 1;
    if (u < a) return v * u * u / (2 * a);
    if (u > 1 - a) return 1 - v * (1 - u) * (1 - u) / (2 * a);
    return v * (u - a / 2);
  }

  /**
   * 由 manifest 的 cabin（{ size, opening }）與畫面框算門洞。cabin 缺少時回傳 null，呼叫端要回報素材準備中。
   */
  function homeGeometry(cabin, frame) {
    if (!cabin || !cabin.size || !cabin.opening || cabin.opening.length !== 4) return null;
    var f = frame || HOME_FRAME, s = f.w / cabin.size[0], h = cabin.size[1] * s, x0 = f.right - f.w, y0 = f.base - h;
    var o = cabin.opening.map(function (p) { return { x: x0 + p[0] * s, y: y0 + p[1] * s }; });
    function lerpY(a, b, x) { var t = clamp((x - a.x) / ((b.x - a.x) || 1), 0, 1); return a.y + (b.y - a.y) * t; }
    var left = Math.max(o[0].x, o[3].x), right = Math.min(o[1].x, o[2].x), insideX = (left + right) / 2 + (f.insideOffsetX || 0);  // 舞台單位；腳底依偏移後的 x 算
    var bottom = lerpY(o[3], o[2], insideX), midY = bottom - 1;
    return { scale: s, rect: { x: x0, y: y0, w: f.w, h: h }, opening: o, left: left, right: right, insideX: insideX, midY: midY, insideY: midY,
      topAt: function (x) { return lerpY(o[0], o[1], x); }, bottomAt: function (x) { return lerpY(o[3], o[2], x); } };
  }

  function headingOf(group, index, mirror) {
    var side = mirror ? 'left' : 'right';
    if (group === 'rearwalk') return 'away';
    if (group === 'rear3qwalk') return side + '-rear-3/4';
    if (group === 'front3qwalk') return side + '-front-3/4';
    if (group === 'frontwalk' || group === 'peek' || group === 'sit' || group === 'wave' || group === 'shake' || group === 'yawn') return 'toward';
    if (group === 'away') return index === 2 ? 'away' : side + (index === 0 ? '-rear-3/4' : '-rear-near');
    if (group === 'lowturn') return ['right-front-3/4', 'toward', 'left-front-3/4'][index];
    if (group === 'turn') return ['right-front-3/4', 'toward', 'left-front-3/4'][index];
    return side;
  }

  /**
   * opts：{ v2, available: 可用組名陣列, motion, points, home: manifest 的 cabin, homeFrame, homeScale, timing, bounds, weather }
   * 沒有 home 時 enter 能力為 false（窩的素材準備中），其他動作照常。
   */
  function create(species, seed, opts) {
    var o = opts || {}, V2 = o.v2 || defaultV2;
    if (!V2) throw new Error('需要 GardenPetsV2');
    if (!V2.GROUPS[species]) throw new TypeError('species 必須是 dog 或 rabbit');
    if (seed === undefined || seed === null || seed === '') throw new TypeError('seed 必須是數字或非空字串');
    var seedStr = String(seed), T_ = Object.assign({}, TIMING, o.timing || {}), PT = Object.assign({}, POINTS, o.points || {});
    var M = Object.assign({}, V2.MOTION[species], species === 'rabbit' ? { gaitHopAdvance: RABBIT_GAIT_HOP } : {}, o.motion || {}), geo = homeGeometry(o.home, o.homeFrame), homeScale = o.homeScale || HOME_SCALE;
    var avail = o.available || Object.keys(V2.GROUPS[species]);
    var s = null;

    function has(g) { return avail.indexOf(g) >= 0; }
    function cap(feature) { return FEATURE_GROUPS[feature].every(has); }
    function tapKinds() { return TAP_KINDS.filter(has); }
    /** 只有狗、而且兩組都到齊才走斜向；兔子永遠是 false，所以 v4 的路徑一行都不變。 */
    var useDiag = species === 'dog' && Object.keys(DIAGONAL_GROUPS).every(has);
    function capabilities() {
      return { roam: true, behind: cap('behind'), peek: cap('peek'), enter: !!geo && cap('enter'), insideTap: !!geo && cap('insideTap'), tap: cap('tap') && tapKinds().length > 0 };
    }
    /** 這隻寵物在腳底 y 的比例。T 那條線以後（門前與屋內）都是 homeScale。 */
    function depthOf(y) { return depthAt(y, PT.T.y, homeScale); }
    function isWet() { return s.weather === 'downpour' || s.weather === 'thunder'; }
    function rngInt(tag, n) { return hashSeed(species + '#' + seedStr + '#' + tag) % n; }
    function note(text) { s.log.push(text); if (s.log.length > 20) s.log.shift(); }
    /** 這段該用什麼圖：同一條規則給所有戶外段。 */
    function classify(a, z) {
      var dx = z.x - a.x, dy = z.y - a.y, L = Math.hypot(dx, dy), r = Math.abs(dy) / Math.max(Math.abs(dx), 1e-6);
      var diag = useDiag && L >= T_.diagMinLen && r >= T_.diagThreshold;
      return { r: r, L: L, diag: diag, kind: diag ? (dy < 0 ? 'rear' : 'front') : 'side', dir: Math.abs(dx) > 0.5 ? (dx > 0 ? 1 : -1) : 0 };
    }

    function newPlan(start) {
      s.planN += 1;
      var pl = { seconds: 180, motion: M };
      if (start) pl.start = start;
      if (o.bounds) pl.bounds = o.bounds;
      s.plan = V2.makePlan(species, seedStr + (s.planN > 1 ? '#' + s.planN : ''), pl);
      s.planT = 0;
    }
    function blank(weather) {
      return { mode: 'roam', weather: weather || 'day', plan: null, planT: 0, planN: 0, roamClock: 0, nextExcursion: 0, excursionN: 0, force: null,
               tapPending: false, tapMs: 0, tapN: 0, lastTap: '', forcedTap: null, ignoredReason: '', dryFor: 0, resume: null,
               script: null, ops: null, opIdx: 0, opT: 0, cur: null, insidePhase: 'lazy', insideT: 0, reduced: false, log: [] };
    }
    function scheduleExcursion() {
      s.excursionN += 1;
      s.nextExcursion = s.roamClock + T_.excursionMinMs + rngInt('trip' + s.excursionN, Math.max(1, T_.excursionMaxMs - T_.excursionMinMs));
    }
    function roamState() { return V2.stateAt(s.plan, s.planT); }
    function leavePoint() {
      var st = roamState();
      return { x: st.x, y: st.y, facing: st.facing < 0 ? -1 : 1, planT: s.planT };
    }

    // ---------- 腳本：先把每一步排好，每步都知道自己的起點 ----------
    function builder(start, facing) {
      var ops = [], pos = { x: start.x, y: start.y }, face = facing, orient = 'side';
      var b = {
        pos: function () { return { x: pos.x, y: pos.y }; }, facing: function () { return face; }, setFacing: function (f) { face = f; return b; }, ops: ops,
        step: function (group, index, mirror, ms, label) { return { group: group, index: index, mirror: !!mirror, ms: ms, label: label || '' }; },
        seq: function (stage, steps, layer, inside) {
          ops.push({ kind: 'seq', stage: stage, steps: steps, x: pos.x, y: pos.y, layer: layer || 'front', inside: !!inside, depth: depthOf(pos.y),
                     ms: steps.reduce(function (a, st) { return a + st.ms; }, 0) });
          return b;
        },
        /** 從斜向的站姿回到側面站姿；已是側面就不動。 */
        toSide: function (layer) {
          var m = face < 0;
          if (orient === 'rear') b.seq('diagToSide', [b.step('rear3qwalk', 0, m, T_.diagHoldMs, '落腳'), b.step('stand', 0, m, T_.standMs, '轉回側面')], layer);
          else if (orient === 'front') b.seq('diagToSide', [b.step('turn', m ? 2 : 0, false, T_.turnMs, '落腳'), b.step('stand', 0, m, T_.standMs, '轉回側面')], layer);
          orient = 'side';
          return b;
        },
        /** 站姿原地換方向：stand → turn 0..2 → 鏡像 stand（反向倒著播）。 */
        turnTo: function (dir, layer) {
          b.toSide(layer);
          if (dir === face) return b;
          var order = face > 0 ? [0, 1, 2] : [2, 1, 0], t = T_.turnMs;
          b.seq('standTurn', [b.step('stand', 0, face < 0, T_.standMs, '站穩'), b.step('turn', order[0], false, t, '轉向鏡頭'), b.step('turn', order[1], false, t, '正面'),
                              b.step('turn', order[2], false, t, '轉向另一側'), b.step('stand', 0, dir < 0, T_.standMs, '站好')], layer);
          face = dir;
          return b;
        },
        /** 同一走道上的側走（狗）或短跳（兔）：起訖都是 stand，整數循環。 */
        side: function (to, layer) {
          var L = Math.hypot(to.x - pos.x, to.y - pos.y);
          if (L < 1) { pos = { x: to.x, y: to.y }; return b; }
          b.toSide(layer);
          if (Math.abs(to.x - pos.x) > 0.5) b.turnTo(to.x > pos.x ? 1 : -1, layer);
          var from = { x: pos.x, y: pos.y };
          if (species === 'dog') {
            var d = depthOf((from.y + to.y) / 2), n = Math.max(1, Math.round(L / (M.strideUnits * d)));
            ops.push({ kind: 'side', stage: 'side', from: from, to: { x: to.x, y: to.y }, ms: n * 8 * M.walkFrameMs, frameMs: M.walkFrameMs, mirror: face < 0, layer: layer || 'front', cycles: n });
          } else {
            var hops = Math.max(1, Math.round(L / (M.hopAdvance * depthOf(from.y))));
            for (var i = 0; i < hops; i++) {
              var a = { x: from.x + (to.x - from.x) * i / hops, y: from.y + (to.y - from.y) * i / hops };
              var z = { x: from.x + (to.x - from.x) * (i + 1) / hops, y: from.y + (to.y - from.y) * (i + 1) / hops };
              ops.push({ kind: 'hop', stage: 'side', from: a, to: z, ms: V2.HOP_MS, mirror: face < 0, layer: layer || 'front' });
              ops.push({ kind: 'seq', stage: 'side', steps: [b.step('stand', 0, face < 0, 200, '落地停穩')], x: z.x, y: z.y, layer: layer || 'front', inside: false, depth: depthOf(z.y), ms: 200 });
            }
          }
          pos = { x: to.x, y: to.y };
          return b;
        },
        /** 斜向步態（只有狗）：先用真圖轉到位，走整數循環，起訖平滑。 */
        diag: function (to, layer, c) {
          var dir = c.dir || face, kind = c.kind, t = T_.turnMs;
          if (orient === kind && face === dir) { /* 同方向接著走 */ }
          else if (orient === 'front' && kind === 'front') {  // 前 3/4 換邊：經過真正面，最短的路
            b.seq('diagTurnFront', [b.step('turn', face < 0 ? 2 : 0, false, t, '落腳'), b.step('turn', 1, false, t, '正面'), b.step('turn', dir < 0 ? 2 : 0, false, t, '轉向新方向')], layer);
            face = dir;
          } else if (kind === 'front' && orient === 'side' && dir !== face) {  // 由側面轉到另一邊的前 3/4
            b.seq('diagTurnFront', [b.step('stand', 0, face < 0, T_.standMs, '站穩'), b.step('turn', face < 0 ? 2 : 0, false, t, '轉向鏡頭'), b.step('turn', 1, false, t, '正面'), b.step('turn', dir < 0 ? 2 : 0, false, t, '前 3/4')], layer);
            face = dir;
          } else {
            // 後 3/4 換邊沒有站姿正背面，只能回側面繞過正面（turnTo 內含 toSide）
            b.turnTo(dir, layer);
            if (kind === 'rear') b.seq('diagTurnRear', [b.step('stand', 0, face < 0, T_.standMs, '站穩')], layer);
            else b.seq('diagTurnFront', [b.step('stand', 0, face < 0, T_.standMs, '站穩'), b.step('turn', face < 0 ? 2 : 0, false, t, '前 3/4')], layer);
          }
          var d = depthOf((pos.y + to.y) / 2), n = Math.max(1, Math.round(c.L / (M.strideUnits * d * T_.diagForeshorten)));
          ops.push({ kind: 'diag', stage: kind === 'rear' ? 'diagRear' : 'diagFront', group: kind + '3qwalk', from: { x: pos.x, y: pos.y }, to: { x: to.x, y: to.y }, ms: n * 8 * T_.diagFrameMs, frameMs: T_.diagFrameMs, mirror: face < 0, layer: layer || 'front', cycles: n });
          pos = { x: to.x, y: to.y };
          orient = kind;
          return b;
        },
        /** 戶外移動：依 r 決定斜向或側走。兔子與沒有斜向圖的狗永遠走 side。 */
        move: function (to, layer) {
          var L = Math.hypot(to.x - pos.x, to.y - pos.y);
          if (L >= 1 && useDiag) { var c = classify(pos, to); if (c.diag) return b.diag(to, layer, c); }
          return b.side(to, layer);
        },
        /** 真背面／正面步態：沿縱深移動，步幅隨比例縮。door=true 走門中央：越過門檻線才畫到門框後。 */
        gait: function (group, to, opt) {
          var L = Math.hypot(to.x - pos.x, to.y - pos.y), g = opt || {}, hops = 0, gd = depthOf((pos.y + to.y) / 2);
          if (species === 'rabbit') hops = Math.max(1, Math.round(L / (M.gaitHopAdvance * gd)));  // 整數跳，距離平均分給每一跳
          ops.push({ kind: 'gait', stage: g.stage || group, group: group, from: { x: pos.x, y: pos.y }, to: { x: to.x, y: to.y }, ms: hops ? hops * RABBIT_GAIT_MS : Math.max(1, L / (T_.gaitSpeed * gd) * 1000), frameMs: T_.gaitFrameMs,
                     layer: g.layer || 'front', door: !!g.door, hops: hops });
          pos = { x: to.x, y: to.y };
          return b;
        },
        call: function (fn) { ops.push({ kind: 'call', fn: fn, stage: 'decide', ms: 0 }); return b; }
      };
      return b;
    }
    function run(scriptName, b) {
      s.mode = 'script'; s.script = scriptName; s.ops = b.ops; s.opIdx = 0; s.opT = 0; s.cur = null;
      runCalls();
    }
    /** 腳本中段接續：把後面的步驟換成新的。 */
    function replaceRest(b) { s.ops = b.ops; s.opIdx = 0; s.opT = 0; runCalls(); }
    function runCalls() {
      while (s.mode === 'script' && s.ops && s.opIdx < s.ops.length && s.ops[s.opIdx].kind === 'call') {
        var op = s.ops[s.opIdx]; s.opIdx += 1; s.opT = 0;
        op.fn();
      }
    }
    function backToRoam(reason) {
      var r = s.resume;
      s.mode = 'roam'; s.script = null; s.ops = null; s.cur = null; s.opT = 0;
      if (r) s.planT = r.planT;
      s.resume = null;
      if (reason) note(reason);
    }
    /** 走回離開點、轉回原方向，再接回原路。 */
    function tailToResume(b, layer) {
      var r = s.resume;
      if (r) { b.move({ x: r.x, y: r.y }, layer); b.turnTo(r.facing, layer); }
      b.call(function () { backToRoam('接回原路'); });
      return b;
    }

    // ---------- 繞樹 ----------
    /** 樹後的表演：探頭，或停一下再轉回來。站姿與低姿兩條路線共用。 */
    function behindAct(b2, withPeek) {
      // 探頭：雨來了就不探，直接往回走
      if (withPeek && has('peek') && !isWet()) {
        b2.seq('peek', [b2.step('stand', 0, true, T_.standMs, '站穩'), b2.step('turn', 2, false, T_.turnMs, '轉向鏡頭'), b2.step('turn', 1, false, T_.turnMs, '正面'),
                        b2.step('peek', 0, false, 320, '探出身體'), b2.step('peek', 1, false, 900, '探頭看鏡頭'), b2.step('peek', 2, false, 500, '眨眼'), b2.step('peek', 1, false, 400, '探頭看鏡頭'),
                        b2.step('peek', 0, false, 260, '縮回'), b2.step('turn', 1, false, T_.turnMs, '正面'), b2.step('turn', 0, false, T_.turnMs, '轉向右'), b2.step('stand', 0, false, T_.standMs, '站好')], 'behind');
      } else {
        b2.seq('behindHold', [b2.step('stand', 0, true, isWet() ? 200 : T_.behindHoldMs, '在樹後停一下')], 'behind');
        b2.turnTo(1, 'behind');
      }
    }
    /**
     * 狗的站姿繞樹：不再低姿爬。homeS → homeT 用後 3/4 正常走，站姿原地換層；回程用前 3/4。
     * 沒有站姿正背面，所以方向只是接近，不是完全對齊；這段的 r 約 2，比圖的角度陡。
     */
    function standTreeScript(withPeek) {
      var r = s.resume, b = builder(r, r.facing), Sh = PT.homeS, H = PT.homeT, P = PT.P;
      b.move(Sh, 'front');
      b.move(H, 'front');
      b.toSide('front');
      b.seq('treeSwapBehind', [b.step('stand', 0, b.facing() < 0, T_.standMs, '在根外換到樹後')], 'behind');
      b.turnTo(-1, 'behind');
      b.call(function () {
        var b2 = builder(H, -1);
        b2.side(P, 'behind');
        behindAct(b2, withPeek);
        var back = builder(P, 1);
        back.side(H, 'behind');
        back.seq('treeSwapFront', [back.step('stand', 0, back.facing() < 0, T_.standMs, '在根外回到前景')], 'front');
        back.move(Sh, 'front');
        back.toSide('front');
        var tail = builder(Sh, back.facing());
        tailToResume(tail, 'front');
        replaceRest({ ops: b2.ops.concat(back.ops, tail.ops) });
      });
      note(withPeek ? '站姿繞到樹後探頭' : '站姿繞到樹後');
      run(withPeek ? 'peek' : 'behind', b);
    }
    function treeScript(withPeek) {
      if (useDiag) { standTreeScript(withPeek); return; }
      var r = s.resume, b = builder(r, r.facing), S = PT.S, Tp = PT.T, P = PT.P, c = T_.crouchMs, a = T_.awayMs, l = T_.lowturnMs;
      b.side(S, 'front');
      b.turnTo(1, 'front');
      // 根外原地：伏低 → 轉背；真背面步態斜向走到 T（還在前層）
      b.seq('treeTurnBack', [b.step('stand', 0, false, T_.standMs, '站穩'), b.step('crouch', 0, false, c, '半低'), b.step('crouch', 1, false, c, '伏低'),
                             b.step('away', 0, false, a, '轉向右後'), b.step('away', 1, false, a, '幾乎背對'), b.step('away', 2, false, a, '背對')], 'front');
      b.gait('rearwalk', Tp, { stage: 'treeRear', layer: 'front' });
      // T 在根外：背對這一格才換到樹後，接著原地轉成朝左、起身
      b.seq('treeSwapBehind', [b.step('away', 2, false, a, '在根外換到樹後')], 'behind');
      b.seq('treeFaceLeft', [b.step('away', 1, true, a, '轉向左後'), b.step('away', 0, true, a, '轉向左'), b.step('crouch', 1, true, c, '低姿朝左'),
                             b.step('crouch', 0, true, c, '起身'), b.step('stand', 0, true, T_.standMs, '站好')], 'behind');
      b.call(function () {
        var b2 = builder(Tp, -1);
        b2.side(P, 'behind');
        behindAct(b2, withPeek);
        // 走回 T（還在樹後）；T 原地轉成面向鏡頭，正面這格換回前層；走回走道
        var back = builder(P, 1);
        back.side(Tp, 'behind');
        back.seq('treeTurnFront', [back.step('stand', 0, false, T_.standMs, '站穩'), back.step('crouch', 0, false, c, '半低'), back.step('crouch', 1, false, c, '伏低'), back.step('lowturn', 0, false, l, '轉向鏡頭')], 'behind');
        back.seq('treeSwapFront', [back.step('lowturn', 1, false, l, '在根外回到前景')], 'front');
        back.gait('frontwalk', S, { stage: 'treeFront', layer: 'front' });
        // 狗的 lowturn 2 比 crouch 1 高，略過 crouch 1 才不會先高後低；兔等真素材再看
        back.seq('treeRise', [back.step('lowturn', 1, false, l, '停步'), back.step('lowturn', 2, false, l, '轉向左')].concat(species === 'dog' ? [] : [back.step('crouch', 1, true, c, '低姿朝左')],
                              [back.step('crouch', 0, true, c, '起身'), back.step('stand', 0, true, T_.standMs, '站好')]), 'front');
        var tail = builder(S, -1);
        tailToResume(tail, 'front');
        replaceRest({ ops: b2.ops.concat(back.ops, tail.ops) });
      });
      note(withPeek ? '繞到樹後探頭' : '繞到樹後');
      run(withPeek ? 'peek' : 'behind', b);
    }

    // ---------- 避雨：窩在樹後，要先從根外的 T 繞到樹後，才走到門前 ----------
    function downToBack(b, m, layer) {
      var c = T_.crouchMs, a = T_.awayMs;
      b.seq('doorCrouch', [b.step('stand', 0, m, T_.standMs, '站穩'), b.step('crouch', 0, m, c, '半低'), b.step('crouch', 1, m, c, '伏低'),
                           b.step('away', 0, m, a, '轉向後'), b.step('away', 1, m, a, '幾乎背對'), b.step('away', 2, m, a, '背對門口')], layer);
    }
    function inside() { return { x: geo.insideX, y: geo.insideY }; }
    /** 門前點：和 homeT 同一條線，只需橫移；比例已是 homeScale。 */
    function lane() { return { x: geo.insideX, y: PT.homeT.y }; }
    function doorInFrom(b) {
      b.gait('rearwalk', inside(), { stage: 'rearIn', door: true, layer: 'behind' });
      var a = T_.awayMs, ls = T_.lieMs;
      b.seq('insideTurnBack', [b.step('away', 2, false, a, '屋內停步'), b.step('away', 1, false, a, '轉回'), b.step('away', 0, false, a, '轉回'), b.step('crouch', 1, false, T_.crouchMs, '低姿朝右'),
                               b.step('lie', 0, false, ls, '放低身體'), b.step('lie', 1, false, ls, '趴下'), b.step('lie', 2, false, ls, '頭放低')], 'mid', true);
      b.call(function () { s.mode = 'inside'; s.script = null; s.ops = null; s.cur = null; s.insidePhase = 'lazy'; s.insideT = 0; s.opT = 0; note('進到屋內'); });
    }
    /**
     * 離開點與 homeT 之間要經過的中繼點（不含 homeT）：
     * 太靠近 S 或已在 S 右邊時略過 S；已在根外遠處時直接到 homeT。
     */
    function outdoorPath(r) {
      var S = PT.homeS, Q = PT.homeQ, H = PT.homeT, path = [];
      function steep(a, z) { return Math.abs(z.y - a.y) > Math.abs(z.x - a.x) * 2 / 3; }
      if (r.y <= Q.y && r.x >= PT.T.x - 20 && !steep(r, H)) return path;
      if (!steep(r, S) && !(r.x > S.x && !steep(r, Q))) path.push(S);
      path.push(Q);
      return path;
    }
    /** 給快照：這次進出窩戶外每一段的判定。 */
    function routeSegments(r) {
      if (!r || !geo) return null;
      var pts = [{ x: r.x, y: r.y }].concat(outdoorPath(r), [PT.homeT, lane()]), out = [];
      for (var i = 0; i + 1 < pts.length; i++) {
        var c = classify(pts[i], pts[i + 1]);
        out.push({ from: pts[i], to: pts[i + 1], r: Math.round(c.r * 1000) / 1000, group: c.diag ? c.kind + '3qwalk' : species === 'dog' ? 'walk' : 'hop', mirror: c.dir < 0 });
      }
      return out;
    }
    /** 從離開點到 homeT：戶外走路／短跳 → 回到側面站姿 → 原地換到樹後層。 */
    function frontToHomeT(b) {
      outdoorPath(s.resume).forEach(function (p) { b.move(p, 'front'); });
      b.move(PT.homeT, 'front');
      b.toSide('front');
      b.seq('homeSwapBehind', [b.step('stand', 0, b.facing() < 0, T_.standMs, '在根外換到樹後')], 'behind');
    }
    /** 從門前回前景（已起身）：側走／短跳到 homeT → 站姿換回前層 → 反向走回離開點。 */
    function laneToFront(b) {
      b.side(PT.homeT, 'behind');
      b.seq('homeSwapFront', [b.step('stand', 0, b.facing() < 0, T_.standMs, '在根外回到前景')], 'front');
      (s.resume ? outdoorPath(s.resume) : [PT.homeS, PT.homeQ]).reverse().forEach(function (p) { b.move(p, 'front'); });
      tailToResume(b, 'front');
    }
    function enterScript() {
      var r = s.resume, b = builder(r, r.facing);
      frontToHomeT(b);
      b.side(lane(), 'behind');
      b.call(function () {
        var here = lane(), f = b.facing();
        if (!isWet()) { var back = builder(here, f); laneToFront(back); note('到門口時雨停：走回'); replaceRest(back); return; }
        var d = builder(here, f);
        downToBack(d, f < 0, 'behind');
        doorInFrom(d);
        note('門前伏低轉背');
        replaceRest(d);
      });
      note('下大雨：繞到樹後走向窩');
      run('enter', b);
    }
    function exitScript() {
      var b = builder(inside(), 1), ls = T_.lieMs, c = T_.crouchMs, l = T_.lowturnMs;
      b.seq('wakeRise', [b.step('rest', 0, false, 500, '醒來'), b.step('lie', 2, false, ls, '抬頭'), b.step('lie', 1, false, ls, '撐起'), b.step('lie', 0, false, ls, '起身'),
                         b.step('crouch', 1, false, c, '低姿朝右'), b.step('lowturn', 0, false, l, '轉向鏡頭'), b.step('lowturn', 1, false, l, '面向鏡頭')], 'mid', true);
      b.gait('frontwalk', lane(), { stage: 'frontOut', door: true, layer: 'behind' });
      b.call(function () {
        var here = lane();
        if (isWet()) {  // 剛出到門前又下大雨：原地轉回背對再進屋
          var again = builder(here, 1), a = T_.awayMs;
          again.seq('reenterTurn', [again.step('lowturn', 1, false, l, '停步'), again.step('lowturn', 0, false, l, '轉向右'), again.step('crouch', 1, false, c, '低姿朝右'),
                                    again.step('away', 0, false, a, '轉向後'), again.step('away', 1, false, a, '幾乎背對'), again.step('away', 2, false, a, '背對門口')], 'behind');
          doorInFrom(again);
          note('又下大雨：轉回背對再進屋');
          replaceRest(again);
          return;
        }
        // 門前原地轉向 homeT 那一側、起身，之後都用正常姿勢
        var dir = PT.homeT.x >= here.x ? 1 : -1, m = dir < 0, d = builder(here, dir);
        d.seq('doorRise', [d.step('lowturn', 1, false, l, '停步'), d.step('lowturn', m ? 2 : 0, false, l, '轉向 homeT'), d.step('crouch', 1, m, c, '低姿'),
                           d.step('crouch', 0, m, c, '起身'), d.step('stand', 0, m, T_.standMs, '站好')], 'behind');
        laneToFront(d);
        replaceRest(d);
      });
      note('雨停 8 秒：出屋');
      run('exit', b);
    }

    // ---------- 點擊 ----------
    function pickTap() {
      var kinds = tapKinds().filter(function (k) { return k !== s.lastTap; });
      if (!kinds.length) kinds = tapKinds();
      if (s.forcedTap && tapKinds().indexOf(s.forcedTap) >= 0) { var f = s.forcedTap; s.forcedTap = null; return f; }
      return kinds[hashSeed(species + '#' + seedStr + '#tap#' + (s.tapN + 1)) % kinds.length];
    }
    function actSteps(b, kind) {
      if (kind === 'wave') return [b.step('wave', 0, false, 220, '抬手'), b.step('wave', 1, false, 300, '招手'), b.step('wave', 0, false, 240, '招手'), b.step('wave', 1, false, 300, '招手'), b.step('wave', 0, false, 240, '放下')];
      if (kind === 'shake') return [b.step('shake', 0, false, 190, '搖頭'), b.step('sit', 1, false, 110, '頭回正'), b.step('shake', 1, false, 190, '搖頭'), b.step('sit', 1, false, 110, '頭回正'),
                                    b.step('shake', 0, false, 190, '搖頭'), b.step('sit', 1, false, 110, '頭回正'), b.step('shake', 1, false, 190, '搖頭')];
      return [b.step('yawn', 0, false, 320, '嘴微開'), b.step('yawn', 1, false, 1000, '打哈欠'), b.step('yawn', 0, false, 320, '嘴快合上')];
    }
    function tapScript() {
      var r = s.resume, b = builder(r, r.facing), kind = pickTap(), m = r.facing < 0, side = m ? 2 : 0, t = T_.turnMs;
      s.tapN += 1; s.lastTap = kind;
      b.seq('tapIn', [b.step('stand', 0, m, T_.standMs, '停穩'), b.step('turn', side, false, t, '轉向鏡頭'), b.step('turn', 1, false, t, '正面'), b.step('sit', 0, false, 260, '半坐'), b.step('sit', 1, false, 300, '坐好')], 'front');
      b.seq('tap-' + kind, actSteps(b, kind), 'front');
      b.seq('tapOut', [b.step('sit', 1, false, 300, '坐好'), b.step('sit', 0, false, 240, '起身'), b.step('turn', 1, false, t, '正面'), b.step('turn', side, false, t, '轉回'), b.step('stand', 0, m, T_.standMs, '站好')], 'front');
      b.call(function () { backToRoam('點擊動作結束'); });
      note('點擊：' + kind);
      run('tap', b);
    }
    function insideTapScript() {
      var b = builder(inside(), 1), ls = T_.lieMs;
      s.tapN += 1;
      b.seq('insideTapUp', [b.step('rest', 0, false, 300, '醒來'), b.step('lie', 2, false, ls, '抬頭'), b.step('lie', 1, false, ls, '撐起')], 'mid', true);
      b.seq('insideShake', [b.step('wake', 0, false, 220, '搖頭'), b.step('lie', 1, false, 120, '頭回正'), b.step('wake', 1, false, 220, '搖頭'), b.step('lie', 1, false, 120, '頭回正'),
                            b.step('wake', 0, false, 220, '搖頭'), b.step('lie', 1, false, 120, '頭回正'), b.step('wake', 1, false, 220, '搖頭'), b.step('lie', 1, false, 200, '頭回正')], 'mid', true);
      b.seq('insideYawn', [b.step('wake', 2, false, 1100, '打哈欠'), b.step('lie', 1, false, 300, '嘴合上')], 'mid', true);
      b.seq('insideTapDown', [b.step('lie', 2, false, ls, '頭放低'), b.step('rest', 0, false, 400, '想睡')], 'mid', true);
      b.call(function () { s.mode = 'inside'; s.script = null; s.ops = null; s.cur = null; s.insidePhase = 'sleep'; s.insideT = 0; s.opT = 0; note('屋內點擊結束：趴睡'); });
      note('屋內點擊');
      run('insideTap', b);
    }

    // ---------- 平常：走到安全接點才接別的事 ----------
    function stopAtSafe(dt) {
      var st = roamState();
      if (st.group === 'stand') return true;
      if (st.group === 'walk') {
        var seg = s.plan.segments[st.segmentIndex], cyc = 8 * seg.frameMs, local = s.planT - seg.t0, k = Math.ceil(local / cyc - 1e-9), edge = seg.t0 + k * cyc;
        if (s.planT + dt >= edge) { s.planT = Math.min(edge, s.plan.totalMs); return true; }
      }
      s.planT = Math.min(s.planT + dt, s.plan.totalMs);
      return false;
    }
    function updateRoam(dt) {
      s.roamClock += dt;
      var caps = capabilities(), wet = isWet() && caps.enter;
      if (s.tapPending) {
        s.tapMs += dt;
        if (wet || s.tapMs > T_.tapWaitMs) { s.tapPending = false; s.ignoredReason = wet ? 'rain-first' : 'no-safe-pose'; }
      }
      var treeDue = !isWet() && (s.force === 'behind' || s.force === 'peek' || (caps.behind && s.roamClock >= s.nextExcursion));
      if (!wet && !s.tapPending && !treeDue) {
        s.planT += dt;
        if (s.planT >= s.plan.totalMs) newPlan(s.plan.end);
        return;
      }
      if (!stopAtSafe(dt)) return;
      s.resume = leavePoint();
      if (wet) { s.force = null; enterScript(); return; }
      if (s.tapPending) { s.tapPending = false; s.tapMs = 0; tapScript(); return; }
      var withPeek = s.force === 'peek' || (s.force === null && caps.peek);
      s.force = null;
      treeScript(withPeek);
      scheduleExcursion();
    }
    function updateScript(dt) {
      var op = s.ops[s.opIdx];
      if (!op) { backToRoam('腳本結束'); return; }
      s.opT += dt;
      if (s.opT >= op.ms) {
        var extra = s.opT - op.ms;
        s.cur = op;
        s.opIdx += 1; s.opT = 0;
        runCalls();
        if (s.mode === 'script' && s.opIdx < s.ops.length) s.opT = Math.min(extra, 50);
      }
    }
    function updateInside(dt) {
      s.insideT += dt;
      if (s.dryFor >= T_.dryStableMs && cap('behind')) { exitScript(); return; }
      if (s.insidePhase === 'lazy' && s.insideT >= T_.lazyMs) { s.insidePhase = 'sleep'; s.insideT = 0; }
      else if (s.insidePhase === 'lazyAgain' && s.insideT >= T_.lazyAgainMs) { s.insidePhase = 'sleep'; s.insideT = 0; }
      else if (s.insidePhase === 'sleep' && Math.floor(s.insideT / (2 * T_.breathMs)) >= T_.lazyAgainEvery) { s.insidePhase = 'lazyAgain'; s.insideT = 0; }
    }

    // ---------- 目前要畫的圖 ----------
    function poseOfOp(op, t) {
      var p = null;
      if (op.kind === 'seq') {
        var acc = 0, st = op.steps[op.steps.length - 1];
        for (var i = 0; i < op.steps.length; i++) { if (t < acc + op.steps[i].ms) { st = op.steps[i]; break; } acc += op.steps[i].ms; }
        p = { group: st.group, index: st.index, mirror: st.mirror, x: op.x, y: op.y, depth: op.depth, layer: op.layer, inside: op.inside, label: st.label, moving: false };
      } else if (op.kind === 'side') {
        var u = clamp(t / op.ms, 0, 1), y = op.from.y + (op.to.y - op.from.y) * u;
        p = { group: 'walk', index: Math.min(op.cycles * 8 - 1, Math.floor(t / op.frameMs)) % 8, mirror: op.mirror, x: op.from.x + (op.to.x - op.from.x) * u, y: y, depth: depthOf(y), layer: op.layer, inside: false, label: '走路', moving: true };
      } else if (op.kind === 'diag') {
        var e = rampEase(t / op.ms, T_.diagRamp), dy = op.from.y + (op.to.y - op.from.y) * e;
        p = { group: op.group, index: Math.min(op.cycles * 8 - 1, Math.floor(t / op.frameMs)) % 8, mirror: op.mirror, x: op.from.x + (op.to.x - op.from.x) * e, y: dy, depth: depthOf(dy), layer: op.layer, inside: false, label: op.group === 'rear3qwalk' ? '斜後方走' : '斜前方走', moving: true, diagonalGait: true };
      } else if (op.kind === 'hop') {
        var a2 = 0, h = V2.HOP_TABLE[V2.HOP_TABLE.length - 1];
        for (var j = 0; j < V2.HOP_TABLE.length; j++) { if (t < a2 + V2.HOP_TABLE[j].ms) { h = V2.HOP_TABLE[j]; break; } a2 += V2.HOP_TABLE[j].ms; }
        var f = h.from + (h.to - h.from) * clamp((t - a2) / h.ms, 0, 1), hy = op.from.y + (op.to.y - op.from.y) * f;
        p = { group: 'hop', index: h.index, mirror: op.mirror, x: op.from.x + (op.to.x - op.from.x) * f, y: hy, depth: depthOf(hy), layer: op.layer, inside: false, label: h.label, moving: h.from !== h.to, airborne: !!h.air };
      } else if (op.kind === 'gait') {
        var g = clamp(t / op.ms, 0, 1), gIndex = Math.floor(t / op.frameMs) % 4, gMoving = true, gAir = false, gLabel = op.group === 'rearwalk' ? '背對走' : '面向鏡頭走';
        if (op.hops) {
          var hopI = Math.min(op.hops - 1, Math.floor(t / RABBIT_GAIT_MS)), hopT = t - hopI * RABBIT_GAIT_MS, a3 = 0, gh = RABBIT_GAIT_TABLE[RABBIT_GAIT_TABLE.length - 1];
          for (var q = 0; q < RABBIT_GAIT_TABLE.length; q++) { if (hopT < a3 + RABBIT_GAIT_TABLE[q].ms) { gh = RABBIT_GAIT_TABLE[q]; break; } a3 += RABBIT_GAIT_TABLE[q].ms; }
          if (gh === RABBIT_GAIT_TABLE[RABBIT_GAIT_TABLE.length - 1] && hopT >= a3 + gh.ms) a3 = RABBIT_GAIT_MS - gh.ms;
          g = (hopI + gh.from + (gh.to - gh.from) * clamp((hopT - a3) / gh.ms, 0, 1)) / op.hops;
          gIndex = gh.index; gMoving = gh.from !== gh.to; gAir = !!gh.air; gLabel = gh.label;
        }
        var gy = op.from.y + (op.to.y - op.from.y) * g, inDoor = op.door && geo && gy <= geo.midY + 1e-6;
        p = { group: op.group, index: gIndex, mirror: false, x: op.from.x + (op.to.x - op.from.x) * g, y: gy, depth: depthOf(gy), layer: inDoor ? 'mid' : op.layer, inside: !!inDoor, label: gLabel, moving: gMoving, airborne: gAir };
      }
      return p;
    }
    function pose() {
      var p;
      if (s.reduced) {
        if (s.mode === 'inside' || (isWet() && capabilities().enter)) p = { group: 'rest', index: 1, mirror: false, x: geo.insideX, y: geo.insideY, depth: depthOf(geo.insideY), layer: 'mid', inside: true, label: '屋內趴睡（減少動態）', moving: false };
        else { var rp = s.resume || leavePoint(); p = { group: 'stand', index: 0, mirror: rp.facing < 0, x: rp.x, y: rp.y, depth: depthOf(rp.y), layer: 'front', inside: false, label: '靜止（減少動態）', moving: false }; }
      } else if (s.mode === 'roam') {
        var st = roamState();
        p = { group: st.group, index: st.index, mirror: st.mirror, x: st.x, y: st.y, depth: st.depth, layer: 'front', inside: false, label: st.label, moving: st.moving, airborne: st.airborne };
      } else if (s.mode === 'inside') {
        var idx = s.insidePhase === 'sleep' ? 1 + Math.floor(s.insideT / T_.breathMs) % 2 : 0;
        p = { group: 'rest', index: idx, mirror: false, x: geo.insideX, y: geo.insideY, depth: depthOf(geo.insideY), layer: 'mid', inside: true, label: s.insidePhase === 'sleep' ? '趴睡' : '慵懶', moving: false };
      } else {
        var op = s.ops[s.opIdx] || s.cur;
        p = op && op.kind !== 'call' ? poseOfOp(op, s.opT) : null;
        if (!p) { var c = s.resume || leavePoint(); p = { group: 'stand', index: 0, mirror: c.facing < 0, x: c.x, y: c.y, depth: depthOf(c.y), layer: 'front', inside: false, label: '', moving: false }; }
      }
      p.footY = p.y;
      p.heading = headingOf(p.group, p.index, p.mirror);
      return p;
    }
    function phase() {
      if (s.reduced) return 'reduced';
      if (s.mode === 'roam') return roamState().phase;
      if (s.mode === 'inside') return s.insidePhase;
      var op = s.ops && s.ops[s.opIdx];
      return op ? op.stage : (s.script || 'script');
    }

    // ---------- 對外 ----------
    var api = {
      species: species, seed: seedStr, geometry: geo, points: PT, homeScale: homeScale, depthOf: depthOf, diagonal: useDiag, timing: T_,
      update: function (dt) {
        if (!(dt > 0)) return;
        s.dryFor = isWet() ? 0 : s.dryFor + dt;
        if (s.reduced) return;
        if (s.mode === 'roam') updateRoam(dt);
        else if (s.mode === 'script') updateScript(dt);
        else updateInside(dt);
      },
      pose: pose,
      /** 回傳 { ok, reason }。不排隊：表演或轉層中的點擊直接丟棄。 */
      tap: function (kind) {
        var fail = function (why) { s.ignoredReason = why; return { ok: false, reason: why }; };
        if (s.reduced) return fail('reduced-motion');
        if (s.mode === 'inside') {
          if (!cap('insideTap')) return fail('assets-pending');
          insideTapScript();
          s.ignoredReason = '';
          return { ok: true, state: 'inside' };
        }
        if (s.mode === 'script') return fail(s.script === 'tap' || s.script === 'insideTap' ? 'busy' : 'in-transition');
        var caps = capabilities();
        if (!caps.tap) return fail('assets-pending');
        if (isWet() && caps.enter) return fail('rain-first');
        if (s.tapPending) return fail('busy');
        s.tapPending = true; s.tapMs = 0; s.ignoredReason = '';
        if (kind) s.forcedTap = kind;
        return { ok: true, state: 'pending' };
      },
      setWeather: function (kind) {
        s.weather = String(kind);
        // 減少動態沒有轉場：雨停就直接回到離開點
        if (s.reduced && !isWet() && s.mode === 'inside') backToRoam('減少動態：雨停');
        return s.weather;
      },
      /** 減少動態：只給靜止圖，不轉場；關掉後從靜止點接回原路。 */
      setReduced: function (v) {
        var on = !!v;
        if (on === s.reduced) return on;
        s.reduced = on;
        s.tapPending = false; s.force = null;
        if (on) {
          if (s.mode === 'script') {
            var keepInside = s.script === 'insideTap' || (s.script === 'exit' && isWet());
            if (keepInside) { s.mode = 'inside'; s.script = null; s.ops = null; s.cur = null; s.insidePhase = 'sleep'; s.insideT = 0; }
            else if (s.resume) backToRoam('減少動態');
            else { s.mode = 'roam'; s.script = null; s.ops = null; s.cur = null; }
          }
          if (s.mode === 'roam' && isWet() && capabilities().enter) { s.resume = leavePoint(); s.mode = 'inside'; s.insidePhase = 'sleep'; s.insideT = 0; }
        }
        return on;
      },
      reset: function () { var w = s.weather, r = s.reduced; s = blank(w); s.reduced = r; newPlan(); scheduleExcursion(); },
      /** 示範（只供預覽）。缺素材時回報，不假裝。 */
      demo: function (kind) {
        var caps = capabilities();
        function resetRoam(w) { var keep = s.reduced; s = blank(w); s.reduced = keep; newPlan(); scheduleExcursion(); }
        function inHouse(which) { resetRoam('downpour'); s.resume = leavePoint(); s.mode = 'inside'; s.insidePhase = which; s.insideT = 0; }
        if (kind === 'roam') { resetRoam('day'); return { ok: true, kind: kind }; }
        if (kind === 'behind' || kind === 'peek') {
          if (!caps[kind]) return { ok: false, reason: 'assets-pending', kind: kind };
          resetRoam('day'); s.force = kind; return { ok: true, kind: kind };
        }
        if (kind === 'enter') {
          if (!caps.enter) return { ok: false, reason: 'assets-pending', kind: kind };
          resetRoam('downpour'); return { ok: true, kind: kind };
        }
        if (kind === 'sleep' || kind === 'exit') {
          if (!caps.enter) return { ok: false, reason: 'assets-pending', kind: kind };
          inHouse('sleep');
          if (kind === 'exit') { s.weather = 'day'; s.dryFor = T_.dryStableMs; }
          return { ok: true, kind: kind };
        }
        if (kind === 'tap') {
          if (!caps.tap) return { ok: false, reason: 'assets-pending', kind: kind };
          resetRoam('day'); return Object.assign({ kind: kind }, api.tap());
        }
        return { ok: false, reason: 'unknown-demo', kind: kind };
      },
      capabilities: capabilities,
      /** 窩只在大雨、雷雨或避雨流程中出現，出完才收。窩一定畫在樹後，繞樹途中顯示也不會擋到寵物。 */
      cabinVisible: function () {
        if (!geo) return false;
        if (s.mode === 'inside' || s.script === 'enter' || s.script === 'exit' || s.script === 'insideTap') return true;
        return isWet() && capabilities().enter;
      },
      snapshot: function () {
        var p = pose(), op = s.mode === 'script' && s.ops ? s.ops[s.opIdx] : null;
        return { version: VERSION, species: species, seed: seedStr, mode: s.mode, script: s.script, phase: phase(), weather: s.weather, wet: isWet(), reduced: s.reduced,
                 capabilities: capabilities(), pose: p, heading: p.heading, diagonalGait: !!p.diagonalGait, feet: { x: round1(p.x), y: round1(p.y) }, layer: p.layer, inside: p.inside, planT: Math.round(s.planT), dryForMs: Math.round(s.dryFor),
                 tap: { pending: s.tapPending, n: s.tapN, last: s.lastTap, ignoredReason: s.ignoredReason }, resume: s.resume, nextExcursionInMs: Math.round(s.nextExcursion - s.roamClock),
                 depth: p.depth, homeScale: homeScale, route: { points: PT, diagonalGait: useDiag, treeSwapPoint: useDiag ? PT.homeT : PT.T, segments: routeSegments(s.resume), homePoints: { S: PT.homeS, Q: PT.homeQ, T: PT.homeT, lane: geo ? lane() : null }, outdoorPath: s.resume ? outdoorPath(s.resume) : null, inside: geo ? inside() : null, lane: geo ? lane() : null, midY: geo ? geo.midY : null },
                 op: op ? { kind: op.kind, stage: op.stage, index: s.opIdx, total: s.ops.length, t: Math.round(s.opT), ms: Math.round(op.ms), len: op.from ? Math.hypot(op.to.x - op.from.x, op.to.y - op.from.y) : 0 } : null,
                 cabinVisible: api.cabinVisible(), log: s.log.slice() };
      }
    };

    s = blank(o.weather);
    newPlan();
    scheduleExcursion();
    return api;
  }

  /**
   * 跑一段時間並檢查規則（給 Node 測試）。這只驗邏輯，不驗美術或自然與否。
   * events：[{ at: ms, weather }, { at: ms, tap: true }, { at: ms, demo: 'peek' }]
   */
  function audit(ctrl, ms, opts) {
    var o = opts || {}, dt = o.dt || 16, ev = (o.events || []).slice().sort(function (a, b) { return a.at - b.at; }), out = [], prev = null, seen = {}, swaps = [];
    var SIDE = { walk: 1, stand: 1, sniff: 1, crouch: 1, hop: 1, ears: 1, rear3qwalk: 1, front3qwalk: 1 }, PT2 = ctrl.points;
    for (var t = 0; t <= ms; t += dt) {
      while (ev.length && ev[0].at <= t) {
        var e = ev.shift();
        if (e.weather) ctrl.setWeather(e.weather);
        if (e.tap) ctrl.tap(e.kind);
        if (e.demo) { ctrl.demo(e.demo); prev = null; }
      }
      ctrl.update(dt);
      var p = ctrl.pose(), snap = ctrl.snapshot();
      seen[snap.phase] = (seen[snap.phase] || 0) + 1;
      if (p.group === 'turn' && p.mirror) out.push({ t: t, rule: 'turn 格不可鏡像' });
      if (prev) {
        var d = Math.hypot(p.x - prev.x, p.y - prev.y);
        if (d > 0.5 * dt && !o.allowJump) out.push({ t: t, rule: '位置跳動', dist: round1(d), from: prev.group, to: p.group, phase: snap.phase });
        if (d > 0.01 && !p.moving && !prev.moving) out.push({ t: t, rule: '原地動作卻有位移', phase: snap.phase, dist: round1(d) });
        if (p.group === 'walk' && Math.abs(p.y - prev.y) > Math.abs(p.x - prev.x) / 1.5 + 0.01) out.push({ t: t, rule: '側面圖沿縱深移動', phase: snap.phase });
        if (p.group === 'hop' && snap.phase === 'side' && Math.abs(p.y - prev.y) > Math.abs(p.x - prev.x) / 1.5 + 0.01) out.push({ t: t, rule: '側面短跳沿縱深移動', phase: snap.phase });
        var homeTrip = snap.script === 'enter' || snap.script === 'exit', laneP = snap.route.lane;
        var standTree = ctrl.diagonal && (snap.script === 'behind' || snap.script === 'peek');
        var LOW = /^(crouch|away|rearwalk|frontwalk|lowturn)$/.test(p.group);
        if (homeTrip && laneP && LOW && !p.inside && (Math.abs(p.x - laneP.x) > 0.5 || p.y > laneP.y + 0.5)) out.push({ t: t, rule: '戶外出現低姿圖', group: p.group, x: round1(p.x), y: round1(p.y) });
        if (standTree && LOW) out.push({ t: t, rule: '站姿繞樹出現低姿圖', group: p.group, x: round1(p.x), y: round1(p.y) });
        // 有斜向圖時，戶外夠長的段不可再用側面圖走斜線
        if (ctrl.diagonal && (homeTrip || standTree) && p.group === 'walk' && prev.group === 'walk' && d > 0.01 && snap.op && snap.op.len >= ctrl.timing.diagMinLen && Math.abs(p.y - prev.y) >= ctrl.timing.diagThreshold * Math.abs(p.x - prev.x) + 1e-6) out.push({ t: t, rule: '斜向段仍用側面圖', r: round1(Math.abs(p.y - prev.y) / Math.max(Math.abs(p.x - prev.x), 1e-6)), phase: snap.phase });
        if (/3qwalk$/.test(prev.group) && prev.moving && p.group !== prev.group && prev.index !== 7) out.push({ t: t, rule: '斜向步態半個循環就切圖', from: prev.group, index: prev.index, to: p.group });
        if (ctrl.species === 'rabbit' && /3qwalk$/.test(p.group)) out.push({ t: t, rule: '兔子不可用斜向步態', group: p.group });
        if (ctrl.species === 'rabbit' && (p.group === 'rearwalk' || p.group === 'frontwalk')) {
          var gRow = RABBIT_GAIT_TABLE[p.index];
          if (p.moving !== (gRow.from !== gRow.to)) out.push({ t: t, rule: '兔子步態 moving 與表不同步', index: p.index });
          if (prev.group === p.group && prev.index === p.index && !p.moving && d > 0.01) out.push({ t: t, rule: '兔子伏低或著地時滑動', index: p.index, dist: round1(d) });
        }
        if (p.group === 'rearwalk' && p.y > prev.y + 1e-6) out.push({ t: t, rule: 'rearwalk 往鏡頭移動' });
        if (p.group === 'frontwalk' && p.y < prev.y - 1e-6) out.push({ t: t, rule: 'frontwalk 往遠處移動' });
        if (p.group === 'rear3qwalk' && p.y > prev.y + 1e-6) out.push({ t: t, rule: 'rear3qwalk 往鏡頭移動' });
        if (p.group === 'front3qwalk' && p.y < prev.y - 1e-6) out.push({ t: t, rule: 'front3qwalk 往遠處移動' });
        if (SIDE[p.group] && SIDE[prev.group] && p.mirror !== prev.mirror) out.push({ t: t, rule: '沒有經過轉向格就翻面', from: prev.group, to: p.group });
        if (p.layer !== prev.layer) {
          swaps.push({ t: t, from: prev.layer, to: p.layer, x: round1(p.x), y: round1(p.y), group: p.group, index: p.index });
          // 前景與樹後之間：低姿繞樹只能在 T 換，進出窩與站姿繞樹只能在 homeT 換；門前（behind）進到屋內（mid）是另一回事
          var behindSwap = (p.layer === 'behind' && prev.layer === 'front') || (p.layer === 'front' && prev.layer === 'behind');
          var swapPt = homeTrip || standTree ? PT2.homeT : PT2.T;
          if (behindSwap && Math.hypot(p.x - swapPt.x, p.y - swapPt.y) > 0.5) out.push({ t: t, rule: homeTrip ? '進出窩換層不在 homeT' : standTree ? '站姿繞樹換層不在 homeT' : '樹後換層不在 T 點', x: round1(p.x), y: round1(p.y) });
          if (behindSwap && (homeTrip || standTree) && p.group !== 'stand') out.push({ t: t, rule: '換層不是正常站姿', group: p.group });
          if (behindSwap && p.moving) out.push({ t: t, rule: '移動中換層' });
        }
      }
      prev = p;
    }
    return { ok: out.length === 0, violations: out.slice(0, 50), count: out.length, phases: seen, layerSwaps: swaps };
  }

  return Object.freeze({ VERSION: VERSION, GROUPS: GROUPS, DIAGONAL_GROUPS: DIAGONAL_GROUPS, FEATURE_GROUPS: FEATURE_GROUPS, TAP_KINDS: TAP_KINDS, TIMING: TIMING, POINTS: POINTS, HOME_FRAME: HOME_FRAME, HOME_SCALE: HOME_SCALE, RABBIT_GAIT_TABLE: RABBIT_GAIT_TABLE, RABBIT_GAIT_MS: RABBIT_GAIT_MS, RABBIT_GAIT_HOP: RABBIT_GAIT_HOP,
    create: create, homeGeometry: homeGeometry, depthAt: depthAt, rampEase: rampEase, headingOf: headingOf, audit: audit });
});
