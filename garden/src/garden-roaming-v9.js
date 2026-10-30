/*
 * 花園散步 v9 純核心：沿用 CalmRoamingCore 的種子路點與計畫（不修改原檔），只重排時間給 v9 十格等時步態用。
 * CommonJS：require('./garden-roaming-v9.js')（會 require 同目錄的 calm-roaming-core.js）
 * 瀏覽器：先載入 calm-roaming-core.js，再載入本檔 → window.GardenRoamingV9
 *
 * 規則：
 *  - 每段走路放慢約 1.25 倍，並向上取整成完整的 2125ms 循環（10 格 × 212.5ms）。
 *  - 走路從標籤「6」（索引 5）起步，整數循環後剛好回到「6」，停下時直接停在這一格，不換另一批貓。
 *  - 走路段以「新時間在段內的進度」換算回原計畫的時間，再呼叫 core.stateAt，保留原本的位置與緩加減速。
 *  - 其他段（停留、轉向、藏身、探看、休息）維持原秒數；沒有轉身、坐姿、探頭的同角色素材，一律用「6」站姿。
 *  - 全部由種子決定，不在每一幀抽亂數。
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./calm-roaming-core.js'));
  else root.GardenRoamingV9 = factory(root.CalmRoamingCore);
})(typeof self !== 'undefined' ? self : this, function (core) {
  'use strict';
  if (!core) throw new Error('需要先載入 CalmRoamingCore');

  var FRAME_MS = 212.5;
  var FRAMES = 10;
  var CYCLE_MS = FRAME_MS * FRAMES;  // 2125
  var SLOW = 1.25;
  var STAND_INDEX = 5;               // 標籤「6」
  var LABELS = ['1', '2', '3', '4', '5', '6', '6A', '6B', '7', '8'];

  function makePlan(seed, seconds) {
    var base = core.makePlan(seed, seconds === undefined ? 180 : seconds);
    var t = 0;
    var segs = base.segments.map(function (s) {
      var dur = s.t1 - s.t0, nd = dur, cycles = 0;
      if (s.kind === 'walk') {
        cycles = Math.max(1, Math.ceil(dur * SLOW / CYCLE_MS));
        nd = cycles * CYCLE_MS;
      }
      var seg = { index: s.index, phase: s.kind, t0: t, t1: t + nd, baseT0: s.t0, baseT1: s.t1, cycles: cycles };
      t += nd;
      return seg;
    });
    return { version: 'garden-v9-1', seed: base.seed, base: base, segments: segs, totalMs: t };
  }

  function findSeg(plan, t) {
    var a = plan.segments, lo = 0, hi = a.length - 1;
    if (t >= a[hi].t0) return a[hi];
    while (lo < hi) {
      var mid = (lo + hi + 1) >> 1;
      if (a[mid].t0 <= t) lo = mid; else hi = mid - 1;
    }
    return a[lo];
  }

  function stateAt(plan, timeMs) {
    if (!plan || !plan.segments) throw new TypeError('plan 必須是 makePlan 的回傳值');
    if (typeof timeMs !== 'number' || !isFinite(timeMs)) throw new TypeError('timeMs 必須是有限數字');
    var t = Math.max(0, Math.min(plan.totalMs, timeMs));
    var seg = findSeg(plan, t);
    var local = t - seg.t0, dur = seg.t1 - seg.t0;
    var baseDur = seg.baseT1 - seg.baseT0;
    var baseTime, frameIndex = STAND_INDEX, walkSpeed = 0;

    if (seg.phase === 'walk') {
      var p = dur > 0 ? local / dur : 0;
      baseTime = seg.baseT0 + Math.min(p * baseDur, baseDur - 1e-3);  // 不越界到下一段
      if (t >= plan.totalMs) baseTime = seg.baseT0 + p * baseDur;
      var step = Math.floor(local / FRAME_MS + 1e-9);
      frameIndex = (STAND_INDEX + step) % FRAMES;
    } else {
      baseTime = seg.baseT0 + Math.min(local, baseDur);
    }
    var st = core.stateAt(plan.base, baseTime);
    if (seg.phase === 'walk') walkSpeed = Math.round(st.speed * (baseDur / dur) * 100) / 100;

    var facing = st.facing;
    if (seg.phase === 'turn') {
      // 沒有同角色的轉身素材：先停穩，在段落中點直接換方向（硬切）
      facing = local < dur / 2 ? st.turnFrom : st.turnTo;
    }
    return {
      phase: seg.phase, label: {rest:'站著休息',stand:'站好準備',walk:'慢慢散步',stop:'停下張望',turn:'停下換方向',hide:'在樹後躲一下',peek:'從樹後探看'}[seg.phase], segmentIndex: seg.index,
      x: st.x, y: st.y, depth: st.scale, behind: st.behind, occluded: !!st.occluded,
      facing: facing, mirror: facing < 0,
      frameIndex: frameIndex, frameLabel: LABELS[frameIndex],
      cycleMs: CYCLE_MS, frameMs: FRAME_MS, cycles: seg.cycles, walkSpeed: walkSpeed,
      t: t, total: plan.totalMs
    };
  }

  function summarize(plan) {
    var by = {};
    plan.segments.forEach(function (s) { by[s.phase] = (by[s.phase] || 0) + 1; });
    return {
      version: plan.version, seed: plan.seed, totalMs: plan.totalMs, baseTotalMs: Math.round(plan.base.totalMs), byPhase: by,
      route: plan.base.route.join('→'),
      segments: plan.segments.map(function (s) {
        return { index: s.index, phase: s.phase, t0: s.t0, t1: s.t1, cycles: s.cycles };
      })
    };
  }

  return Object.freeze({
    FRAME_MS: FRAME_MS, CYCLE_MS: CYCLE_MS, FRAMES: FRAMES, STAND_INDEX: STAND_INDEX, LABELS: LABELS, SLOW: SLOW,
    makePlan: makePlan, stateAt: stateAt, summarize: summarize, core: core
  });
});
