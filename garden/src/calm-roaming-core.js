/*
 * 小貓悠閒散步：純路線核心（無相依、無 DOM、無 wall-clock、無 storage、無 Math.random）。
 * CommonJS：const core = require('./calm-roaming-core.js')
 * 瀏覽器：<script src="calm-roaming-core.js"></script> → window.CalmRoamingCore
 *
 * makePlan(seed, durationSeconds) 以明確種子建立有限、可重現的狀態計畫；
 * stateAt(plan, timeMs) 純查表，可任意前後 seek。
 * 座標沿用 roaming-v1：960×740 舞台，位置是腳底基準點。
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CalmRoamingCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = 'calm-core-1';

  var C = Object.freeze({
    STAGE_W: 960, STAGE_H: 740, HORIZON_Y: 560, ROOT_Y: 690, FRONT_Y: 712, BACK_Y: 648, BACK_SCALE: 0.86,
    BEHIND_Y: 690,                      // 腳底 y 小於此值（較遠）＝畫在樹後
    GROUND: Object.freeze({ xMin: 100, xMax: 810, yMin: 630, yMax: 716 }),
    FRONT_LANE: Object.freeze({ yMin: 694, yMax: 716 }),
    BACK_LANE: Object.freeze({ yMin: 636, yMax: 660 }),
    HIDE: Object.freeze({ x: 410, y: 648 }),  // roaming-v1 已驗證的樹幹後藏身點（朝左時約露出 12%）
    PEEK: Object.freeze({ x: 448, y: 664 }),  // roaming-v1 已驗證的探頭位置（身體露出 2.7%）
    SPEED_MIN: 45, SPEED_MAX: 55,       // 前景峰值速度（單位／秒）；樹後依深度等比例變慢
    ACCEL_S: 1.0, DECEL_S: 1.3,         // 緩加速、緩減速秒數（餘弦曲線）
    STRIDE_CANDIDATE: 65,               // 前景一個步態循環的步幅：候選值，尚未從新圖量測
    GAIT_FRAMES: 8,
    MAX_SLOPE: 0.35,
    REST_MIN: 3, REST_MAX: 5, STAND_S: 0.6,
    STOP_MIN: 2, STOP_MAX: 5,
    TURN_MIN: 1.4, TURN_MAX: 1.8, TURN_FRONT_WEIGHT: 0.6,
    PEEK_MIN: 2.5, PEEK_MAX: 4.5, PEEK_CHANCE: 0.75, HIDE_S: 0.5,
    REST_CHANCE: 0.25, CHAIN_CHANCE: 0.55, MAX_LEG_EDGES: 3,
    BLINK_MS: 150,
    DURATION_MIN: 10, DURATION_MAX: 3600, MAX_SEGMENTS: 4000,
    SAMPLES_PER_EDGE: 48
  });

  // 路點：前景 6 點、樹後 3 點。前後只靠右側淺斜通道 F5–B1 相連（斜率 64/220 ≈ 0.29）。
  var NODES = Object.freeze({
    F0: Object.freeze({ x: 140, y: 708, lane: 'front', label: '左前休息點' }),
    F1: Object.freeze({ x: 265, y: 700, lane: 'front', label: '左前草地' }),
    F2: Object.freeze({ x: 395, y: 711, lane: 'front', label: '樹根正前方' }),
    F3: Object.freeze({ x: 520, y: 699, lane: 'front', label: '樹根右前方' }),
    F4: Object.freeze({ x: 640, y: 707, lane: 'front', label: '右前草地' }),
    F5: Object.freeze({ x: 750, y: 712, lane: 'front', label: '右前角（通道入口）' }),
    B0: Object.freeze({ x: 410, y: 648, lane: 'back', label: '樹幹後藏身點' }),
    B1: Object.freeze({ x: 530, y: 648, lane: 'back', label: '樹後右側' }),
    B2: Object.freeze({ x: 690, y: 650, lane: 'back', label: '樹後遠處' })
  });
  var EDGES = Object.freeze([
    ['F0', 'F1', 'front'], ['F1', 'F2', 'front'], ['F2', 'F3', 'front'], ['F3', 'F4', 'front'], ['F4', 'F5', 'front'],
    ['F5', 'B1', 'channel'], ['B1', 'B0', 'back'], ['B1', 'B2', 'back']
  ]);
  var NEXT_WEIGHT = { B0: 1.6 };  // 稍微偏好走向藏身點，讓探頭偶爾出現

  var LABELS = Object.freeze({
    rest: '坐著休息', stand: '起身站好', walk: '慢慢走', stop: '停下張望', turn: '原地轉身',
    hide: '在樹後躲一下', peek: '歪頭探出臉和小爪'
  });

  var ADJ = {};
  EDGES.forEach(function (e) {
    (ADJ[e[0]] = ADJ[e[0]] || []).push(e[1]);
    (ADJ[e[1]] = ADJ[e[1]] || []).push(e[0]);
  });

  // ---------------- 種子亂數 ----------------
  function hashSeed(str) {
    var h = 1779033703 ^ str.length;
    for (var i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  }
  function mulberry32(a) {
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function normalizeSeed(seed) {
    if (typeof seed === 'number') {
      if (!isFinite(seed)) throw new TypeError('seed 必須是有限數字或非空字串');
      return String(seed);
    }
    if (typeof seed === 'string' && seed.length > 0 && seed.length <= 200) return seed;
    throw new TypeError('seed 必須是有限數字或 1–200 字元的字串');
  }

  // ---------------- 幾何 ----------------
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function scaleAtY(y) {
    var t = (C.FRONT_Y - y) / (C.FRONT_Y - C.BACK_Y);
    return clamp(1 - t * (1 - C.BACK_SCALE), 0.84, 1.01);
  }
  function quad(p0, p1, p2, t) {
    var u = 1 - t;
    return { x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x, y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y };
  }
  function quadSlope(p0, p1, p2, t) {
    var dx = 2 * (1 - t) * (p1.x - p0.x) + 2 * t * (p2.x - p1.x);
    var dy = 2 * (1 - t) * (p1.y - p0.y) + 2 * t * (p2.y - p1.y);
    return Math.abs(dx) < 1e-9 ? Infinity : Math.abs(dy / dx);
  }
  function laneOk(kind, p) {
    var G = C.GROUND;
    if (p.x < G.xMin || p.x > G.xMax || p.y < G.yMin || p.y > G.yMax) return false;
    if (kind === 'front') return p.y >= C.FRONT_LANE.yMin && p.y <= C.FRONT_LANE.yMax;
    if (kind === 'back') return p.y >= C.BACK_LANE.yMin && p.y <= C.BACK_LANE.yMax;
    return true;
  }

  /** 每條邊在建計畫時抽一次淺彎度；違反界線或斜率就把彎度減半，最後退回直線。 */
  function buildEdge(e, rng) {
    var a = NODES[e[0]], b = NODES[e[1]], kind = e[2];
    var dx = b.x - a.x, dy = b.y - a.y, len = Math.sqrt(dx * dx + dy * dy);
    var nx = -dy / len, ny = dx / len;
    var maxBulge = kind === 'front' ? 14 : kind === 'back' ? 8 : 0;
    var bulge = (rng() * 2 - 1) * maxBulge;
    var ctrl, samples;
    for (var attempt = 0; attempt < 6; attempt++) {
      var bb = attempt === 5 ? 0 : bulge;
      ctrl = { x: (a.x + b.x) / 2 + nx * bb, y: (a.y + b.y) / 2 + ny * bb };
      samples = [];
      var ok = true;
      for (var i = 0; i <= C.SAMPLES_PER_EDGE; i++) {
        var t = i / C.SAMPLES_PER_EDGE, p = quad(a, ctrl, b, t);
        if (!laneOk(kind, p) || quadSlope(a, ctrl, b, t) > C.MAX_SLOPE) ok = false;
        samples.push(p);
      }
      if (ok) { bulge = bb; break; }
      bulge /= 2;
    }
    var cum = [0];
    for (var j = 1; j < samples.length; j++) {
      var ddx = samples[j].x - samples[j - 1].x, ddy = samples[j].y - samples[j - 1].y;
      cum.push(cum[j - 1] + Math.sqrt(ddx * ddx + ddy * ddy));
    }
    return { id: e[0] + '-' + e[1], from: e[0], to: e[1], kind: kind, ctrl: ctrl, bulge: bulge, samples: samples, cum: cum, length: cum[cum.length - 1] };
  }

  /** 把一串邊（含方向）組成以弧長參數化的路徑點，附上累積步態循環數。 */
  function buildLegPoints(edgeMap, steps) {
    var pts = [];
    var d = 0, g = 0;
    steps.forEach(function (st, k) {
      var E = edgeMap[st.id];
      var n = E.samples.length;
      for (var i = 0; i < n; i++) {
        var idx = st.forward ? i : n - 1 - i;
        if (k > 0 && i === 0) continue;  // 與上一條邊的終點重複
        var p = E.samples[idx];
        if (pts.length) {
          var q = pts[pts.length - 1];
          var seg = Math.sqrt((p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y));
          var sMid = scaleAtY((p.y + q.y) / 2);
          d += seg;
          g += seg / (C.STRIDE_CANDIDATE * sMid);  // 遠處角色較小，步幅等比例變短
        }
        pts.push({ x: p.x, y: p.y, d: d, g: g });
      }
    });
    return pts;
  }

  function pointAt(pts, d) {
    if (d <= 0) return pts[0];
    var last = pts[pts.length - 1];
    if (d >= last.d) return last;
    var lo = 0, hi = pts.length - 1;
    while (hi - lo > 1) {
      var mid = (lo + hi) >> 1;
      if (pts[mid].d <= d) lo = mid; else hi = mid;
    }
    var a = pts[lo], b = pts[hi], f = (d - a.d) / (b.d - a.d || 1);
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, d: d, g: a.g + (b.g - a.g) * f };
  }

  // ---------------- 速度曲線：餘弦緩加速 → 等速 → 餘弦緩減速 ----------------
  function walkDist(s, ts) {
    var v = s.v, ta = s.ta, tc = s.tc, td = s.td;
    if (ts <= 0) return 0;
    if (ts < ta) return v * (ts / 2 - ta / (2 * Math.PI) * Math.sin(Math.PI * ts / ta));
    var d1 = v * ta / 2;
    if (ts < ta + tc) return d1 + v * (ts - ta);
    var u = Math.min(ts - ta - tc, td);
    return Math.min(s.length, d1 + v * tc + v * (u / 2 + td / (2 * Math.PI) * Math.sin(Math.PI * u / td)));
  }
  function walkSpeed(s, ts) {
    if (ts <= 0 || ts >= s.ta + s.tc + s.td) return 0;
    if (ts < s.ta) return s.v * (1 - Math.cos(Math.PI * ts / s.ta)) / 2;
    if (ts < s.ta + s.tc) return s.v;
    return s.v * (1 + Math.cos(Math.PI * (ts - s.ta - s.tc) / s.td)) / 2;
  }

  // ---------------- 建立計畫 ----------------
  function makePlan(seed, durationSeconds) {
    var seedStr = normalizeSeed(seed);
    var dur = durationSeconds === undefined ? 180 : durationSeconds;
    if (typeof dur !== 'number' || !isFinite(dur) || dur < C.DURATION_MIN || dur > C.DURATION_MAX) {
      throw new RangeError('durationSeconds 必須是 ' + C.DURATION_MIN + '–' + C.DURATION_MAX + ' 之間的數字');
    }
    var hash = hashSeed(seedStr);
    var rng = mulberry32(hash);
    var range = function (a, b) { return a + (b - a) * rng(); };

    var edgeMap = {};
    EDGES.forEach(function (e) { var E = buildEdge(e, rng); edgeMap[E.id] = E; });
    function edgeBetween(a, b) {
      if (edgeMap[a + '-' + b]) return { id: a + '-' + b, forward: true };
      return { id: b + '-' + a, forward: false };
    }

    var segs = [], t = 0, walked = 0;
    var node = 'F0', prev = null, facing = 1;
    var route = ['F0'];

    function push(s, seconds) {
      s.index = segs.length;
      s.id = s.kind + '#' + segs.length;
      s.t0 = t * 1000;
      t += seconds;
      s.t1 = t * 1000;
      s.walk0 = walked;
      segs.push(s);
      return s;
    }
    function at(n) { return { x: NODES[n].x, y: NODES[n].y, node: n }; }
    function rest(seconds) {
      var blinks = [], b = range(1.0, 2.0);
      while (b < seconds - 0.3) { blinks.push(Math.round(b * 1000)); b += range(2.0, 3.5); }
      push({ kind: 'rest', pos: at(node), facing: facing, blinks: blinks }, seconds);
    }

    rest(range(3, 4));
    push({ kind: 'stand', pos: at(node), facing: facing }, C.STAND_S);

    function pick(options) {
      var total = 0, i;
      for (i = 0; i < options.length; i++) total += NEXT_WEIGHT[options[i]] || 1;
      var r = rng() * total;
      for (i = 0; i < options.length; i++) {
        r -= NEXT_WEIGHT[options[i]] || 1;
        if (r < 0) return options[i];
      }
      return options[options.length - 1];
    }
    function dirOf(a, b) { return NODES[b].x > NODES[a].x ? 1 : -1; }

    while (t < dur && segs.length < C.MAX_SEGMENTS) {
      // 選路：路口不走回頭路（死路例外）
      var opts = ADJ[node].filter(function (n) { return n !== prev; });
      if (!opts.length) opts = ADJ[node].slice();
      var first = pick(opts);
      var legDir = dirOf(node, first);
      var chain = [[node, first]];
      var cur = first, from = node;
      while (chain.length < C.MAX_LEG_EDGES && cur !== 'B0' && rng() < C.CHAIN_CHANCE) {
        var more = ADJ[cur].filter(function (n) { return n !== from && dirOf(cur, n) === legDir; });
        if (!more.length) break;
        var nx = pick(more);
        chain.push([cur, nx]);
        from = cur; cur = nx;
      }

      // 方向相反才轉身（停穩後原地播真轉身圖）
      if (legDir !== facing) {
        var tf = rng() < C.TURN_FRONT_WEIGHT ? 'turn_front' : 'turn_rear';
        push({ kind: 'turn', pos: at(node), pose: tf, facingFrom: facing, facingTo: legDir }, range(C.TURN_MIN, C.TURN_MAX));
        facing = legDir;
      }

      var steps = chain.map(function (c) { return edgeBetween(c[0], c[1]); });
      var pts = buildLegPoints(edgeMap, steps);
      var L = pts[pts.length - 1].d;
      var depth = chain.reduce(function (acc, c) { return acc + (scaleAtY(NODES[c[0]].y) + scaleAtY(NODES[c[1]].y)) / 2; }, 0) / chain.length;
      var v = range(C.SPEED_MIN, C.SPEED_MAX) * depth;  // 樹後依深度等比例變慢
      var ta = C.ACCEL_S, td = C.DECEL_S;
      if (v * (ta + td) / 2 > L) { var k = L / (v * (ta + td) / 2); ta *= k; td *= k; }
      var tc = Math.max(0, (L - v * (ta + td) / 2) / v);
      push({ kind: 'walk', facing: facing, edges: steps.map(function (s) { return s.id; }), nodes: [node].concat(chain.map(function (c) { return c[1]; })),
        pts: pts, length: L, v: v, ta: ta, tc: tc, td: td }, ta + tc + td);
      walked += L;
      prev = chain[chain.length - 1][0];
      node = chain[chain.length - 1][1];
      chain.forEach(function (c) { route.push(c[1]); });

      if (node === 'B0') {
        // 樹幹後：完全遮擋中才切換姿勢、方向；探頭為可選分支
        var hide = at('B0');
        if (rng() < C.PEEK_CHANCE) {
          push({ kind: 'hide', pos: hide, facing: facing }, C.HIDE_S);
          push({ kind: 'peek', pos: { x: C.PEEK.x, y: C.PEEK.y, node: 'B0' }, facing: 1 }, range(C.PEEK_MIN, C.PEEK_MAX));
          facing = 1;
          push({ kind: 'hide', pos: hide, facing: facing, occludedFacingSwitch: true }, C.HIDE_S);
        } else {
          push({ kind: 'hide', pos: hide, facing: facing }, range(0.8, 1.6));
          facing = 1;
          push({ kind: 'hide', pos: hide, facing: facing, occludedFacingSwitch: true }, C.HIDE_S);
        }
      } else {
        push({ kind: 'stop', pos: at(node), facing: facing }, range(C.STOP_MIN, C.STOP_MAX));
        if (NODES[node].lane === 'front' && rng() < C.REST_CHANCE) {
          rest(range(C.REST_MIN, C.REST_MAX));
          push({ kind: 'stand', pos: at(node), facing: facing }, C.STAND_S);
        }
      }
    }

    return {
      version: VERSION, seed: seedStr, seedHash: hash, requestedMs: dur * 1000, totalMs: t * 1000,
      segments: segs, route: route, walkDistance: walked,
      edges: Object.keys(edgeMap).map(function (id) {
        var E = edgeMap[id];
        return { id: id, kind: E.kind, from: E.from, to: E.to, ctrl: { x: +E.ctrl.x.toFixed(2), y: +E.ctrl.y.toFixed(2) }, bulge: +E.bulge.toFixed(2), length: +E.length.toFixed(2) };
      })
    };
  }

  // ---------------- 查詢狀態（純函式，可任意 seek） ----------------
  function findSegment(plan, t) {
    var segs = plan.segments, lo = 0, hi = segs.length - 1;
    if (t >= segs[hi].t0) return segs[hi];
    while (lo < hi) {
      var mid = (lo + hi + 1) >> 1;
      if (segs[mid].t0 <= t) lo = mid; else hi = mid - 1;
    }
    return segs[lo];
  }
  function round2(v) { return Math.round(v * 100) / 100; }

  function stateAt(plan, timeMs) {
    if (!plan || !plan.segments || !plan.segments.length) throw new TypeError('plan 必須是 makePlan 的回傳值');
    if (typeof timeMs !== 'number' || !isFinite(timeMs)) throw new TypeError('timeMs 必須是有限數字');
    var t = clamp(timeMs, 0, plan.totalMs);
    var s = findSegment(plan, t);
    var ts = (t - s.t0) / 1000;
    var out = { t: t, total: plan.totalMs, segmentId: s.id, segmentIndex: s.index, phase: s.kind, label: LABELS[s.kind],
      speed: 0, walkDistance: s.walk0, frame: 0, turnFrom: null, turnTo: null, occluded: false };
    var x, y, scale, facing = s.facing;

    if (s.kind === 'walk') {
      var d = walkDist(s, ts), p = pointAt(s.pts, d);
      x = p.x; y = p.y; scale = scaleAtY(y);
      out.pose = 'walk';
      out.frame = Math.floor((p.g - Math.floor(p.g)) * C.GAIT_FRAMES) % C.GAIT_FRAMES;
      out.speed = round2(walkSpeed(s, ts));
      out.walkDistance = round2(s.walk0 + d);
      out.edges = s.edges;
    } else if (s.kind === 'turn') {
      x = s.pos.x; y = s.pos.y; scale = scaleAtY(y);
      out.pose = s.pose;
      var f = Math.min(C.GAIT_FRAMES - 1, Math.floor(ts / ((s.t1 - s.t0) / 1000) * C.GAIT_FRAMES));
      out.frame = s.facingFrom > 0 ? f : C.GAIT_FRAMES - 1 - f;  // 右→左播 0→7，左→右播 7→0
      out.turnFrom = s.facingFrom; out.turnTo = s.facingTo;
      facing = s.facingFrom;
    } else if (s.kind === 'peek') {
      x = s.pos.x; y = s.pos.y; scale = C.BACK_SCALE;
      out.pose = 'peek'; out.occluded = true;  // 只露出頭與小爪，身體在樹幹後
    } else if (s.kind === 'hide') {
      x = s.pos.x; y = s.pos.y; scale = C.BACK_SCALE;
      out.pose = 'stand'; out.occluded = true;
      out.occludedFacingSwitch = !!s.occludedFacingSwitch;
    } else if (s.kind === 'rest') {
      x = s.pos.x; y = s.pos.y; scale = scaleAtY(y);
      out.pose = 'idle';
      var ms = t - s.t0;
      for (var i = 0; i < s.blinks.length; i++) if (ms >= s.blinks[i] && ms < s.blinks[i] + C.BLINK_MS) out.frame = 1;
    } else {  // stand, stop
      x = s.pos.x; y = s.pos.y; scale = scaleAtY(y);
      out.pose = 'stand';
    }
    out.x = round2(x); out.y = round2(y); out.scale = Math.round(scale * 1000) / 1000;
    out.behind = y < C.BEHIND_Y;
    out.layer = out.behind ? 'behind' : 'front';
    out.facing = facing;
    // 只有走路與坐姿朝左時鏡像（光源會變右上，已知取捨）；
    // 站姿用正面轉身圖的第 1／8 格（真朝右／真朝左），轉身與探頭圖也都不鏡像
    out.mirror = (out.pose === 'walk' || out.pose === 'idle') && facing < 0;
    return out;
  }

  // ---------------- 檢查與摘要（供 Node property 測試） ----------------
  function summarize(plan) {
    var by = {}, turns = { turn_front: 0, turn_rear: 0 }, peeks = 0;
    plan.segments.forEach(function (s) {
      by[s.kind] = (by[s.kind] || 0) + 1;
      if (s.kind === 'turn') turns[s.pose] += 1;
      if (s.kind === 'peek') peeks += 1;
    });
    return { version: plan.version, seed: plan.seed, totalMs: Math.round(plan.totalMs), segments: plan.segments.length, byPhase: by,
      turns: turns, peeks: peeks, walkDistance: Math.round(plan.walkDistance), route: plan.route.join('→') };
  }

  /** 以固定間隔取樣檢查核心規則，回傳違規清單（空陣列＝通過）。 */
  function checkPlan(plan, stepMs) {
    var step = stepMs === undefined ? 100 : stepMs;
    if (typeof step !== 'number' || !isFinite(step) || step < 10 || step > 1000) throw new RangeError('stepMs 必須在 10–1000 之間');
    var out = [], prev = null, G = C.GROUND, maxWalkStep = 0;
    var limit = 6.5 * step / 100;
    for (var t = 0; t <= plan.totalMs; t += step) {
      var s = stateAt(plan, t);
      if (s.x < G.xMin || s.x > G.xMax || s.y < G.yMin || s.y > G.yMax) out.push({ t: t, rule: '超出地面範圍', x: s.x, y: s.y });
      if (s.behind !== (s.y < C.BEHIND_Y)) out.push({ t: t, rule: '圖層與深度不符' });
      if (s.phase === 'walk' && s.speed > C.SPEED_MAX + 1e-6) out.push({ t: t, rule: '超過最高速度', speed: s.speed });
      if (prev) {
        var dx = s.x - prev.x, dy = s.y - prev.y, dist = Math.sqrt(dx * dx + dy * dy);
        if (s.phase === 'walk' && prev.phase === 'walk') {
          maxWalkStep = Math.max(maxWalkStep, dist);
          if (dist > limit) out.push({ t: t, rule: '行走位移過大', dist: round2(dist) });
        } else if (dist > 0.5) {
          var occludedSwap = (s.phase === 'peek' || s.phase === 'hide') && (prev.phase === 'peek' || prev.phase === 'hide');
          if (!occludedSwap) out.push({ t: t, rule: '非遮擋中的瞬移', from: prev.phase, to: s.phase, dist: round2(dist) });
        }
        if (s.phase === 'turn' && prev.phase === 'turn' && s.segmentId === prev.segmentId && dist > 0) out.push({ t: t, rule: '轉身時位移' });
        if (s.phase === 'turn' && prev.phase === 'walk' && prev.speed > 0.5) out.push({ t: t, rule: '未停穩就轉身', speed: prev.speed });
      }
      prev = s;
    }
    return { ok: out.length === 0, violations: out, maxWalkStep: round2(maxWalkStep), samples: Math.floor(plan.totalMs / step) + 1 };
  }

  return Object.freeze({
    VERSION: VERSION, constants: C, nodes: NODES, edges: EDGES, labels: LABELS,
    makePlan: makePlan, stateAt: stateAt, summarize: summarize, checkPlan: checkPlan,
    _internal: Object.freeze({ hashSeed: hashSeed, mulberry32: mulberry32, scaleAtY: scaleAtY, walkDist: walkDist, walkSpeed: walkSpeed })
  });
});
