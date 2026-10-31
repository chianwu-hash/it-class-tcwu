/*
 * 小狗／小兔動畫 v2 純核心：不讀 DOM、不畫圖、不用 Math.random、不用系統時間、不連網路或 storage。
 * CommonJS：require('./garden-pets-v2.js')；瀏覽器：window.GardenPetsV2。
 *
 * makePlan(species, seed, opts) 以種子建立有限、可重現的計畫；stateAt(plan, t, { reduced }) 純查表，可任意 seek。
 * 暫停由呼叫者凍結 t；reduced 只回傳 stand。座標是 960×760 舞台的腳底點，這一版只走樹前地面（depth 固定 1）。
 *
 * 規則：
 *  - 只有 dog.walk 與 rabbit.hop 會改變位置；sniff、ears、turn、look、stand 全部原地。
 *  - 走路用整數循環，起訖都是 stand；每段長度對齊步幅（strideUnits），不靠改速度遮掩滑步。
 *  - 跳躍位移寫在格上（HOP_TABLE）：蹲、蓄力不動，蹬地與騰空連續走完 0→1，前足著地後停在定點。
 *  - 換方向一律 stand → 右前 3/4 → 正面 → 左前 3/4 → 鏡像 stand（反向就倒過來）；turn 格永不鏡像，不直接翻面。
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GardenPetsV2 = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = 'garden-pets-v2-1';
  var BOUNDS = Object.freeze({ xMin: 200, xMax: 770, yMin: 740, yMax: 750 });
  var MAX_SLOPE = 1 / 1.5;
  var GROUPS = Object.freeze({
    dog: Object.freeze({ stand: 1, walk: 8, sniff: 3, turn: 3 }),
    rabbit: Object.freeze({ stand: 1, hop: 6, ears: 2, turn: 3 })
  });
  // 候選值：已依真素材 contact 目測調整（見 docs），仍要實際播放確認；可用 opts.motion 或 manifest 的 motion 覆寫。
  var MOTION = Object.freeze({
    dog: Object.freeze({ strideUnits: 48, walkFrameMs: 200 }),
    rabbit: Object.freeze({ hopAdvance: 56 })
  });
  /** 一跳六格：from／to 是本次位移的比例，格內線性前進；相鄰格的 to 與 from 必須相同，位置才連續。 */
  var HOP_TABLE = Object.freeze([
    Object.freeze({ index: 0, ms: 120, from: 0, to: 0, label: '壓低' }),
    Object.freeze({ index: 1, ms: 170, from: 0, to: 0, label: '後腿蓄力' }),
    Object.freeze({ index: 2, ms: 90, from: 0, to: 0.15, label: '蹬地伸展' }),
    Object.freeze({ index: 3, ms: 150, from: 0.15, to: 1, air: true, label: '短騰空' }),
    Object.freeze({ index: 4, ms: 100, from: 1, to: 1, label: '前足著地' }),
    Object.freeze({ index: 5, ms: 140, from: 1, to: 1, label: '後腳前收落地' })
  ]);
  var HOP_MS = HOP_TABLE.reduce(function (a, h) { return a + h.ms; }, 0);
  var LABELS = Object.freeze({ stand: '站穩', walk: '四足慢走', sniff: '低頭嗅聞', look: '轉頭看鏡頭', turn: '原地轉向', hop: '短跳', ears: '轉耳觀察', sit: '蹲坐停留', reduced: '靜止（減少動態）' });
  // 樹根外緣與開闊地的候選停點（舞台座標）；樹根 x 範圍是目測，整合時要用 alpha 量測校正。
  var DOG_STOPS = [215, 300, 400, 520, 620, 680, 755];
  var DOG_SNIFF_SPOTS = [300, 680];

  function hashSeed(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function round2(v) { return Math.round(v * 100) / 100; }
  function step(group, index, mirror, ms, label) { return { group: group, index: index, mirror: !!mirror, ms: ms, label: label || '' }; }

  /** 淺二次曲線，取樣後以弧長參數化。控制點留在走道內，曲線就不會超出走道。 */
  function buildArc(a, b, ctrlY) {
    var ctrl = { x: (a.x + b.x) / 2, y: ctrlY }, pts = [], d = 0, n = 32;
    for (var i = 0; i <= n; i++) {
      var u = i / n, v = 1 - u;
      var p = { x: v * v * a.x + 2 * v * u * ctrl.x + u * u * b.x, y: v * v * a.y + 2 * v * u * ctrl.y + u * u * b.y };
      if (pts.length) { var q = pts[pts.length - 1]; d += Math.hypot(p.x - q.x, p.y - q.y); }
      p.d = d;
      pts.push(p);
    }
    return { pts: pts, length: d };
  }
  function arcSlope(arc) {
    var m = 0;
    for (var i = 1; i < arc.pts.length; i++) {
      var a = arc.pts[i - 1], b = arc.pts[i], dx = Math.abs(b.x - a.x);
      m = Math.max(m, dx < 1e-9 ? Infinity : Math.abs(b.y - a.y) / dx);
    }
    return m;
  }
  function pointOn(arc, d) {
    var pts = arc.pts, lo = 0, hi = pts.length - 1;
    if (d <= 0) return pts[0];
    if (d >= arc.length) return pts[hi];
    while (hi - lo > 1) { var m = (lo + hi) >> 1; if (pts[m].d <= d) lo = m; else hi = m; }
    var a = pts[lo], b = pts[hi], f = (d - a.d) / ((b.d - a.d) || 1);
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  }

  function makePlan(species, seed, opts) {
    if (!GROUPS[species]) throw new TypeError('species 必須是 dog 或 rabbit');
    if (seed === undefined || seed === null || seed === '') throw new TypeError('seed 必須是數字或非空字串');
    var o = opts || {}, seedStr = String(seed), rng = mulberry32(hashSeed(species + '#' + seedStr));
    var range = function (a, b) { return a + (b - a) * rng(); };
    var B = Object.assign({}, BOUNDS, o.bounds || {});
    var M = Object.assign({}, MOTION[species], o.motion || {});
    var seconds = o.seconds === undefined ? 180 : o.seconds;
    if (!(seconds >= 10 && seconds <= 3600)) throw new RangeError('seconds 必須在 10–3600 之間');
    var limit = seconds * 1000, segs = [], t = 0;
    var s0 = o.start || {};
    var pos = { x: clamp(s0.x === undefined ? (species === 'dog' ? 300 : 620) : s0.x, B.xMin, B.xMax), y: clamp(s0.y === undefined ? 745 : s0.y, B.yMin, B.yMax) };
    var facing = s0.facing === -1 ? -1 : 1;

    function push(seg, ms) {
      seg.index = segs.length; seg.t0 = t; t += ms; seg.t1 = t; segs.push(seg);
      return seg;
    }
    /** 原地序列：位置固定，每一步指定一張圖。 */
    function hold(phase, steps) {
      var ms = steps.reduce(function (a, s) { return a + s.ms; }, 0);
      push({ kind: 'seq', phase: phase, steps: steps, x: pos.x, y: pos.y, facing: facing }, ms);
    }
    function stand(ms, phase) { hold(phase || 'stand', [step('stand', 0, facing < 0, ms, LABELS[phase || 'stand'])]); }
    function turnTo(dir) {
      if (dir === facing) return;
      var order = facing > 0 ? [0, 1, 2] : [2, 1, 0];
      hold('turn', [step('stand', 0, facing < 0, 180, '站穩'), step('turn', order[0], false, 240, '轉向鏡頭'), step('turn', order[1], false, 260, '正面'),
                    step('turn', order[2], false, 240, '轉向另一側'), step('stand', 0, dir < 0, 200, '站好')]);
      facing = dir;
    }
    function look(ms) {
      var side = facing > 0 ? 0 : 2;
      hold('look', [step('stand', 0, facing < 0, 160, '站穩'), step('turn', side, false, 240, '轉頭'), step('turn', 1, false, ms, '看鏡頭'),
                    step('turn', side, false, 240, '轉回'), step('stand', 0, facing < 0, 200, '站好')]);
    }

    // ---------- 小狗 ----------
    function walkLeg(targetX) {
      var cyc = 8 * M.walkFrameMs, a = { x: pos.x, y: pos.y };
      var y1 = range(B.yMin, B.yMax), ctrlY = range(B.yMin, B.yMax);
      var x1 = clamp(targetX, B.xMin, B.xMax), arc = buildArc(a, { x: x1, y: y1 }, ctrlY);
      var n = Math.max(1, Math.round(arc.length / M.strideUnits));
      // 把弧長校到整數步幅；碰到邊界就少走一個循環
      for (var i = 0; i < 4; i++) {
        var want = n * M.strideUnits, nx = a.x + (x1 - a.x) * (want / arc.length);
        if ((nx < B.xMin || nx > B.xMax) && n > 1) { n -= 1; continue; }
        x1 = clamp(nx, B.xMin, B.xMax);
        arc = buildArc(a, { x: x1, y: y1 }, ctrlY);
      }
      if (arcSlope(arc) > MAX_SLOPE) { y1 = a.y; ctrlY = a.y; arc = buildArc(a, { x: x1, y: y1 }, ctrlY); }
      var dir = x1 >= a.x ? 1 : -1;
      turnTo(dir);
      stand(200);
      push({ kind: 'walk', phase: 'walk', arc: arc, facing: facing, cycles: n, frameMs: M.walkFrameMs }, n * cyc);
      pos = { x: x1, y: y1 };
    }
    function pickDogTarget(prevStop) {
      var minLeg = 140, maxLeg = 380, list = [], total = 0;
      function add(x, w) { list.push({ x: x, w: w }); total += w; }
      DOG_STOPS.forEach(function (raw) {
        var x = clamp(raw, B.xMin, B.xMax), dx = x - pos.x, adx = Math.abs(dx);
        if (adx < minLeg || adx > maxLeg) return;
        if (prevStop !== null && Math.abs(x - prevStop) < 60) return;   // 不直線折返上一個停點
        var w = (dx > 0 ? 1 : -1) === facing ? 3 : 1;
        if (DOG_SNIFF_SPOTS.indexOf(raw) >= 0) w += 1.5;
        add(x, w);
      });
      if (!list.length) return pos.x - B.xMin > B.xMax - pos.x ? Math.max(B.xMin, pos.x - maxLeg) : Math.min(B.xMax, pos.x + maxLeg);
      var r = rng() * total;
      for (var i = 0; i < list.length; i++) { r -= list[i].w; if (r < 0) return list[i].x; }
      return list[list.length - 1].x;
    }
    function sniff() {
      var m = facing < 0, reps = rng() < 0.5 ? 1 : 2, s = [step('stand', 0, m, 160, '站穩'), step('sniff', 0, m, 260, '低頭'), step('sniff', 1, m, 360, '鼻子貼近地面')];
      for (var i = 0; i < reps; i++) s.push(step('sniff', 2, m, 240, '嗅聞'), step('sniff', 1, m, 260, '嗅聞'));
      s.push(step('sniff', 0, m, 260, '抬頭'), step('stand', 0, m, 200, '站好'));
      hold('sniff', s);
    }
    function dogRoutine() {
      var prevStop = null;
      stand(800);
      while (t < limit) {
        var from = pos.x;
        walkLeg(pickDogTarget(prevStop));
        prevStop = from;
        stand(range(300, 700));
        var nearSpot = DOG_SNIFF_SPOTS.some(function (x) { return Math.abs(x - pos.x) < 50; });
        var r = rng();
        if (r < (nearSpot ? 0.75 : 0.5)) {
          sniff();
          if (rng() < 0.35) { stand(250); look(range(700, 1100)); }
        } else if (r < 0.75) look(range(700, 1100));
        stand(range(400, 1200));
      }
    }

    // ---------- 小兔 ----------
    function hop(toX, toY) {
      push({ kind: 'hop', phase: 'hop', x0: pos.x, y0: pos.y, x1: toX, y1: toY, facing: facing }, HOP_MS);
      pos = { x: toX, y: toY };
      stand(range(180, 260));   // 落地停穩才接下一跳
    }
    function ears() {
      var m = facing < 0, r = rng();
      if (r < 0.4) return [step('ears', 0, m, 700, '一耳轉向側面'), step('stand', 0, m, 220, '耳朵回正')];
      if (r < 0.75) return [step('ears', 1, m, 800, '兩耳往後'), step('stand', 0, m, 220, '耳朵回正')];
      return [step('ears', 0, m, 500, '一耳轉向側面'), step('stand', 0, m, 240, '耳朵回正'), step('ears', 1, m, 600, '兩耳往後'), step('stand', 0, m, 220, '耳朵回正')];
    }
    function rabbitRoutine() {
      stand(800, 'sit');
      while (t < limit) {
        var hops = rng() < 0.5 ? 2 : 3, A = M.hopAdvance, dir = facing;
        if (pos.x + dir * hops * A > B.xMax || pos.x + dir * hops * A < B.xMin) {
          if (pos.x + dir * 2 * A <= B.xMax && pos.x + dir * 2 * A >= B.xMin) hops = 2;
          else { dir = -dir; hops = rng() < 0.5 ? 2 : 3; }
        } else if (rng() < 0.18 && pos.x - dir * hops * A <= B.xMax && pos.x - dir * hops * A >= B.xMin) dir = -dir;  // 偶爾換方向，不直線巡邏
        turnTo(dir);
        if (segs[segs.length - 1].phase === 'turn') stand(200, 'sit');
        // 不對稱弧線：每跳的縱深變化不等分
        var targetY = range(B.yMin, B.yMax), weights = [], sum = 0;
        for (var i = 0; i < hops; i++) { var w = range(0.2, 1); weights.push(w); sum += w; }
        var startY = pos.y, acc = 0;
        for (var k = 0; k < hops; k++) {
          acc += weights[k] / sum;
          hop(pos.x + dir * A, clamp(startY + (targetY - startY) * acc, B.yMin, B.yMax));
        }
        // 停 2–5 秒，中間轉耳
        var dwell = range(2000, 5000), lead = dwell * range(0.25, 0.45), eSteps = ears();
        var eMs = eSteps.reduce(function (a, s) { return a + s.ms; }, 0);
        stand(lead, 'sit');
        hold('ears', eSteps);
        stand(Math.max(300, dwell - lead - eMs), 'sit');
        if (rng() < 0.15) { look(range(700, 1000)); stand(300, 'sit'); }
      }
    }

    if (species === 'dog') dogRoutine(); else rabbitRoutine();
    stand(600, species === 'dog' ? 'stand' : 'sit');
    return { version: VERSION, species: species, seed: seedStr, bounds: B, motion: M, segments: segs, totalMs: t, end: { x: pos.x, y: pos.y, facing: facing } };
  }

  // ---------- 查詢 ----------
  function findSeg(plan, t) {
    var a = plan.segments, lo = 0, hi = a.length - 1;
    if (t >= a[hi].t0) return a[hi];
    while (lo < hi) { var m = (lo + hi + 1) >> 1; if (a[m].t0 <= t) lo = m; else hi = m - 1; }
    return a[lo];
  }
  function stateAt(plan, timeMs, opts) {
    if (!plan || !plan.segments || !plan.segments.length) throw new TypeError('plan 必須是 makePlan 的回傳值');
    if (typeof timeMs !== 'number' || !isFinite(timeMs)) throw new TypeError('timeMs 必須是有限數字');
    var t = clamp(timeMs, 0, plan.totalMs), seg = findSeg(plan, t), local = t - seg.t0;
    var out = { species: plan.species, t: t, total: plan.totalMs, segmentIndex: seg.index, phase: seg.phase, depth: 1, layer: 'front', airborne: false, moving: false, label: '' };
    if (seg.kind === 'walk') {
      var d = seg.arc.length * clamp(local / (seg.t1 - seg.t0), 0, 1), p = pointOn(seg.arc, d);
      out.group = 'walk'; out.index = Math.min(seg.cycles * 8 - 1, Math.floor(local / seg.frameMs)) % 8;
      out.x = p.x; out.y = p.y; out.mirror = seg.facing < 0; out.facing = seg.facing; out.moving = true; out.label = LABELS.walk;
    } else if (seg.kind === 'hop') {
      var acc = 0, h = HOP_TABLE[HOP_TABLE.length - 1];
      for (var i = 0; i < HOP_TABLE.length; i++) { if (local < acc + HOP_TABLE[i].ms) { h = HOP_TABLE[i]; break; } acc += HOP_TABLE[i].ms; }
      if (h === HOP_TABLE[HOP_TABLE.length - 1] && local >= acc + h.ms) acc = HOP_MS - h.ms;
      var f = h.from + (h.to - h.from) * clamp((local - acc) / h.ms, 0, 1);
      out.group = 'hop'; out.index = h.index; out.frac = round2(f);
      out.x = seg.x0 + (seg.x1 - seg.x0) * f; out.y = seg.y0 + (seg.y1 - seg.y0) * f;
      out.mirror = seg.facing < 0; out.facing = seg.facing; out.airborne = !!h.air; out.moving = h.from !== h.to; out.label = h.label;
    } else {
      var a2 = 0, st = seg.steps[seg.steps.length - 1];
      for (var k = 0; k < seg.steps.length; k++) { if (local < a2 + seg.steps[k].ms) { st = seg.steps[k]; break; } a2 += seg.steps[k].ms; }
      out.group = st.group; out.index = st.index; out.x = seg.x; out.y = seg.y; out.mirror = st.mirror;
      out.facing = st.group === 'turn' ? seg.facing : (st.mirror ? -1 : 1); out.label = st.label || LABELS[seg.phase] || '';
    }
    if (opts && opts.reduced) {
      // 減少動態：只呈現 stand；跳躍中取最近的著地點，轉身中維持原朝向
      var gx = out.x, gy = out.y;
      if (seg.kind === 'hop') { var near = (out.frac || 0) < 0.5; gx = near ? seg.x0 : seg.x1; gy = near ? seg.y0 : seg.y1; }
      var face = seg.kind === 'seq' && out.group === 'turn' ? seg.facing : out.facing;
      return { species: plan.species, t: t, total: plan.totalMs, segmentIndex: seg.index, phase: 'reduced', group: 'stand', index: 0, x: gx, y: gy, depth: 1, layer: 'front', mirror: face < 0, facing: face, airborne: false, moving: false, label: LABELS.reduced };
    }
    return out;
  }

  // ---------- 檢查與摘要（給 Node 測試） ----------
  function summarize(plan) {
    var by = {}, dist = 0;
    plan.segments.forEach(function (s) {
      by[s.phase] = (by[s.phase] || 0) + 1;
      if (s.kind === 'walk') dist += s.arc.length;
      if (s.kind === 'hop') dist += Math.hypot(s.x1 - s.x0, s.y1 - s.y0);
    });
    return { version: plan.version, species: plan.species, seed: plan.seed, totalMs: Math.round(plan.totalMs), segments: plan.segments.length, byPhase: by, distance: Math.round(dist), end: plan.end };
  }
  /** 取樣檢查核心規則；回傳違規清單（空陣列＝通過）。這只驗計畫邏輯，不驗美術或自然與否。 */
  function checkPlan(plan, stepMs) {
    var dt = stepMs === undefined ? 20 : stepMs, out = [], prev = null, B = plan.bounds, G = GROUPS[plan.species];
    if (!(dt >= 5 && dt <= 100)) throw new RangeError('stepMs 必須在 5–100 之間');
    // 表本身要接得起來：從 0 開始、到 1 結束，相鄰格 to＝from
    HOP_TABLE.forEach(function (h, i) {
      var nx = HOP_TABLE[i + 1];
      if (i === 0 && h.from !== 0) out.push({ rule: 'HOP_TABLE 不是從 0 開始' });
      if (nx ? h.to !== nx.from : h.to !== 1) out.push({ rule: 'HOP_TABLE 位移比例不連續', index: h.index });
    });
    // 邊界前後 0.001ms 的位置差：段落之間與跳躍格之間都不能跳
    var EPS = 0.001, MAX_GAP = 0.01, maxGap = 0;
    function checkGap(at, where, segIndex) {
      var a = stateAt(plan, at - EPS), b = stateAt(plan, at), gap = Math.hypot(b.x - a.x, b.y - a.y);
      maxGap = Math.max(maxGap, gap);
      if (gap > MAX_GAP) out.push({ t: at, rule: '邊界位置不連續', where: where, seg: segIndex, gap: round2(gap) });
    }
    plan.segments.forEach(function (s) {
      if (s.index > 0) checkGap(s.t0, '段落', s.index);
      if (s.kind === 'hop') {
        var edge = s.t0;
        for (var h = 0; h < HOP_TABLE.length - 1; h++) { edge += HOP_TABLE[h].ms; checkGap(edge, 'hop-' + h + '→' + (h + 1), s.index); }
      }
      if (s.kind === 'walk') {
        if (arcSlope(s.arc) > MAX_SLOPE + 1e-6) out.push({ seg: s.index, rule: '走路縱深斜率超過 1/1.5' });
        var slip = Math.abs(s.arc.length - s.cycles * plan.motion.strideUnits) / plan.motion.strideUnits;
        if (slip > 0.34 && s.cycles > 0) out.push({ seg: s.index, rule: '弧長與整數步幅差太多', length: round2(s.arc.length), cycles: s.cycles });
      }
      if (s.kind === 'hop' && Math.abs(s.y1 - s.y0) > Math.abs(s.x1 - s.x0) * MAX_SLOPE + 1e-6) out.push({ seg: s.index, rule: '跳躍縱深斜率超過 1/1.5' });
    });
    for (var t = 0; t <= plan.totalMs; t += dt) {
      var c = stateAt(plan, t);
      if (c.x < B.xMin - 1e-6 || c.x > B.xMax + 1e-6 || c.y < B.yMin - 1e-6 || c.y > B.yMax + 1e-6) out.push({ t: t, rule: '超出安全走區', x: round2(c.x), y: round2(c.y) });
      if (!G[c.group] || c.index < 0 || c.index >= G[c.group]) out.push({ t: t, rule: '圖格索引不存在', group: c.group, index: c.index });
      if (c.group === 'turn' && c.mirror) out.push({ t: t, rule: 'turn 格不可鏡像' });
      if (c.group === 'hop' && c.moving !== (HOP_TABLE[c.index].from !== HOP_TABLE[c.index].to)) out.push({ t: t, rule: 'moving 與 HOP_TABLE 不同步', index: c.index });
      if (prev) {
        var dist = Math.hypot(c.x - prev.x, c.y - prev.y);
        if (prev.group !== 'turn' && c.group !== 'turn' && prev.mirror !== c.mirror) out.push({ t: t, rule: '沒有經過轉向格就翻面', from: prev.group, to: c.group });
        var bothStill = !c.moving && !prev.moving;
        if (bothStill && dist > 0.01) out.push({ t: t, rule: '原地動作卻有位移', phase: c.phase, dist: round2(dist) });
        if (c.group === 'hop' && c.index < 2 && dist > 0.01) out.push({ t: t, rule: '蹬地前就有位移' });
        if (c.group === 'turn' && prev.group === 'turn' && dist > 0) out.push({ t: t, rule: '轉身時位移' });
      }
      prev = c;
    }
    return { ok: out.length === 0, violations: out.slice(0, 50), count: out.length, maxBoundaryGap: Math.round(maxGap * 10000) / 10000 };
  }

  return Object.freeze({ VERSION: VERSION, BOUNDS: BOUNDS, GROUPS: GROUPS, MOTION: MOTION, HOP_TABLE: HOP_TABLE, HOP_MS: HOP_MS, LABELS: LABELS, MAX_SLOPE: MAX_SLOPE,
    makePlan: makePlan, stateAt: stateAt, summarize: summarize, checkPlan: checkPlan });
});
