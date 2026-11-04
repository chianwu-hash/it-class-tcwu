/*
 * 散步 v3 對照層：沿用 CalmRoamingCore 的路線計畫（不改核心），只換「每個時間點用哪一張圖」的規則。
 * CommonJS：require('./roaming-v3.js')（會自動 require 同目錄的 calm-roaming-core.js）
 * 瀏覽器：先載入 calm-roaming-core.js，再載入本檔 → window.RoamingV3
 *
 * v3 規則（依 docs/roaming-v3-research.md）：
 *  1. 相位接續：每一段走路從「站姿格」起步、也剛好在「站姿格」停下（整數個步態循環，步幅依段長微調）。
 *  2. 停下、藏身、原本的坐下休息，一律停在同一張站姿步態格（不換成另一批畫的站姿圖、不坐下）。
 *  3. 轉身只用量測上與站姿格最吻合的那一張轉身圖。
 *  4. 可選步態順序：原順序，或依腿部輪廓最相近的實驗順序。
 * v2 規則保留作對照（與 preview/roaming-calm.html 相同）。
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./calm-roaming-core.js'));
  else root.RoamingV3 = factory(root.CalmRoamingCore);
})(typeof self !== 'undefined' ? self : this, function (core) {
  'use strict';
  if (!core) throw new Error('需要先載入 CalmRoamingCore');
  var BASE_STRIDE_IN_CORE = core.constants.STRIDE_CANDIDATE;  // 核心累積步態循環所用的步幅

  function gAt(pts, d) {
    if (d <= 0) return 0;
    var last = pts[pts.length - 1];
    if (d >= last.d) return last.g;
    var lo = 0, hi = pts.length - 1;
    while (hi - lo > 1) {
      var mid = (lo + hi) >> 1;
      if (pts[mid].d <= d) lo = mid; else hi = mid;
    }
    var a = pts[lo], b = pts[hi];
    return a.g + (b.g - a.g) * ((d - a.d) / (b.d - a.d || 1));
  }

  /**
   * options: { mode: 'v3'|'v2', standFrame: 0–7, turn: 'turn_rear'|'turn_front', order: [8 個 0-based 格號], stride: 數字或 null }
   * 回傳 { state, sprite: { g, k, mirror }, cycles?, legCycles? }
   */
  function frameAt(plan, timeMs, options) {
    var o = options || {};
    var st = core.stateAt(plan, timeMs);
    if (o.mode === 'v2') return { state: st, sprite: v2Sprite(st) };

    var stand = o.standFrame | 0;
    var order = o.order && o.order.length === 8 ? o.order : [0, 1, 2, 3, 4, 5, 6, 7];
    var startPos = order.indexOf(stand);
    if (startPos < 0) startPos = 0;
    var stride = o.stride || BASE_STRIDE_IN_CORE;
    var out = { state: st };

    if (st.phase === 'walk') {
      var seg = plan.segments[st.segmentIndex];
      var ts = (Math.max(0, Math.min(plan.totalMs, timeMs)) - seg.t0) / 1000;
      var d = core._internal.walkDist(seg, ts);
      var gTotal = seg.pts[seg.pts.length - 1].g;
      var legCycles = Math.max(1, Math.round(gTotal * BASE_STRIDE_IN_CORE / stride));  // 整數循環：起停都落在站姿格
      var phase = gAt(seg.pts, d) / gTotal * legCycles;
      var step = Math.floor(phase * 8 + 1e-9);
      if (d >= seg.length - 1e-6) step = legCycles * 8;  // 終點剛好回到站姿格
      out.sprite = { g: 'walk', k: order[(startPos + step) % 8], mirror: st.facing < 0 };
      out.cycles = Math.round(phase * 1000) / 1000;
      out.legCycles = legCycles;
      out.effectiveStride = Math.round(gTotal * BASE_STRIDE_IN_CORE / legCycles * 10) / 10;
    } else if (st.phase === 'turn') {
      out.sprite = { g: o.turn || 'turn_rear', k: st.frame, mirror: false };
    } else if (st.phase === 'peek') {
      out.sprite = { g: 'peek', k: 0, mirror: false };
    } else {  // rest、stand、stop、hide：同一張站姿步態格，不坐下、不換畫
      out.sprite = { g: 'walk', k: stand, mirror: st.facing < 0 };
    }
    return out;
  }

  function v2Sprite(st) {
    if (st.pose === 'stand') return { g: 'turn_front', k: st.facing < 0 ? 7 : 0, mirror: false };
    if (st.pose === 'walk') return { g: 'walk', k: st.frame, mirror: st.facing < 0 };
    if (st.pose === 'idle') return { g: 'idle', k: st.frame, mirror: st.facing < 0 };
    return { g: st.pose, k: st.frame, mirror: false };
  }

  /** 統計換圖次數與「換成不同畫風來源」的次數，供對照（每 stepMs 取樣）。 */
  function compare(plan, options, stepMs) {
    var step = stepMs || 50, prev = null, stats = { swaps: 0, groupSwitches: 0, samples: 0 };
    for (var t = 0; t <= plan.totalMs; t += step) {
      var s = frameAt(plan, t, options).sprite;
      if (prev && (prev.g !== s.g || prev.k !== s.k || prev.mirror !== s.mirror)) {
        stats.swaps += 1;
        if (prev.g !== s.g) stats.groupSwitches += 1;
      }
      prev = s; stats.samples += 1;
    }
    return stats;
  }

  return Object.freeze({ makePlan: core.makePlan, summarize: core.summarize, checkPlan: core.checkPlan, frameAt: frameAt, compare: compare, core: core });
});
