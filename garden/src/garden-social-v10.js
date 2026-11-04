/*
 * 花園社交動作 v10 純時序核心：包裝 GardenRoamingV9，不依賴圖片、不修改 v9。
 * CommonJS：require('./garden-social-v10.js')（會 require 同目錄的 garden-roaming-v9.js）
 * 瀏覽器：依序載入 calm-roaming-core.js、garden-roaming-v9.js、本檔 → window.GardenSocialV10
 *
 * 原則：
 *  - 走路段的長度、位置與十格時序（每格 212.5ms）完全沿用 v9。
 *  - 只有非走路段可以換成社交動作，必要時加長；動作期間位置、深度、前後圖層固定，不平移。
 *  - 每一刻只指定一張圖（spriteGroup／spriteIndex／spriteMirror），由 renderer 照畫。
 *  - 亂數只用種子雜湊（招手次數），不在每一幀抽亂數。
 *
 * 圖片群組（實際素材由 Codex 接）：
 *  walk 0–9（站姿 = walk 5）、front 0 前 3/4 站／1 正面站／2 半坐／3 正面坐（優先用 sit 0）、
 *  sit 0 正面坐姿、wave 0 剛抬／1 胸前／2 臉旁／3 外擺、rear 0–3 斜背面約 15°／30°／45°／60°。
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./garden-roaming-v9.js'));
  else root.GardenSocialV10 = factory(root.GardenRoamingV9);
})(typeof self !== 'undefined' ? self : this, function (v9) {
  'use strict';
  if (!v9) throw new Error('需要先載入 GardenRoamingV9');

  var C = Object.freeze({
    FRAME_MS: v9.FRAME_MS, CYCLE_MS: v9.CYCLE_MS, STAND: v9.STAND_INDEX,
    GREET_EXTRA_MS: 400,          // 前景休息：至少「完整招手序列＋400ms」
    SIT_STOP_MIN_MS: 4000,        // 前景停下：原長度 ≥ 4 秒才坐（不招手）
    REAR_STOP_MIN_MS: 2200,       // 樹後停下：≥ 2.2 秒才轉身望向遠方
    FIRST_HIDE_MIN_MS: 2600       // 走到樹後藏身點的第一個藏身段：延長到至少 2.6 秒
  });
  var ACTION_LABELS = Object.freeze({ greet: '坐下招手', sit: '坐下休息', 'rear-turn': '轉身望向樹後', turn: '停下換方向', none: '' });

  function step(group, index, mirror, ms, label, flex) {
    return { group: group, frameIndex: index, mirror: !!mirror, durationMs: ms, label: label, flex: !!flex };
  }

  // ---------- 序列 ----------
  function sitIn(dir) {  // 只有前 3/4 依到達方向鏡像；正面站、半坐、坐姿不鏡像
    return [step('walk', C.STAND, dir < 0, 220, '先站穩'), step('front', 0, dir < 0, 240, '轉向鏡頭'), step('front', 1, false, 240, '正面站'),
            step('front', 2, false, 240, '半坐'), step('sit', 0, false, 600, '坐好', true)];
  }
  function sitOut(dir) {
    return [step('front', 2, false, 200, '起身'), step('front', 1, false, 200, '正面站'),
            step('front', 0, dir < 0, 200, '轉回側面'), step('walk', C.STAND, dir < 0, 200, '站好')];
  }
  function waves(n) {  // 招手 n 次（1 或 2）；招手爪永遠是畫面右側那隻，不鏡像
    var s = [step('wave', 0, false, 180, '抬爪'), step('wave', 1, false, 180, '抬到胸前'), step('wave', 2, false, 180, '抬到臉旁')];
    for (var i = 0; i < n; i++) s.push(step('wave', 3, false, 240, '招手'), step('wave', 2, false, 240, '招手'));
    s.push(step('wave', 1, false, 180, '放下'), step('wave', 0, false, 180, '放下'), step('sit', 0, false, 180, '坐好'));
    return s;
  }
  function rearTurn(dir) {  // 整組依到達方向鏡像
    var m = dir < 0;
    return [step('walk', C.STAND, m, 220, '先站穩'), step('rear', 0, m, 220, '轉向遠方'), step('rear', 1, m, 220, '轉向遠方'), step('rear', 2, m, 220, '轉向遠方'),
            step('rear', 3, m, 220, '轉向遠方'), step('rear', 3, m, 300, '望向遠方', true),
            step('rear', 2, m, 180, '轉回'), step('rear', 1, m, 180, '轉回'), step('rear', 0, m, 180, '轉回'),
            step('walk', C.STAND, m, 180, '站好')];
  }
  function turnSeq(from, to, totalMs) {  // 停穩後經過前 3/4 與正面站換方向，平均分配原秒數
    var d = totalMs / 5;
    return [step('walk', C.STAND, from < 0, d, '站穩'), step('front', 0, from < 0, d, '轉向鏡頭'),
            step('front', 1, false, d, '正面站'), step('front', 0, to < 0, d, '轉向新方向'), step('walk', C.STAND, to < 0, d, '站好')];
  }
  function sum(s) { return s.reduce(function (a, x) { return a + x.durationMs; }, 0); }
  /** 把多出來的時間加到最後一個可伸縮的步驟（停留），回傳新陣列，不改輸入。 */
  function fill(s, totalMs) {
    var out = s.map(function (x) { return Object.assign({}, x); });
    var extra = totalMs - sum(out);
    if (extra > 0) {
      for (var i = out.length - 1; i >= 0; i--) if (out[i].flex) { out[i].durationMs += extra; break; }
    }
    return out;
  }

  // ---------- 建計畫 ----------
  function makePlan(seed, seconds) {
    var base = v9.makePlan(seed, seconds === undefined ? 180 : seconds);
    var core = v9.core;
    var segs = [], t = 0;
    base.segments.forEach(function (s, i) {
      var dur = s.t1 - s.t0;
      var mid = s.baseT0 + Math.min(1, (s.baseT1 - s.baseT0) / 2);  // 取段內一點，不會映射到下一段
      var cs = core.stateAt(base.base, mid);
      var root = { x: cs.x, y: cs.y, depth: s.phase === 'hide' || s.phase === 'peek' ? core.constants.BACK_SCALE : cs.scale,
                   behind: cs.behind, occluded: !!cs.occluded, facing: cs.facing };
      var prev = base.segments[i - 1], next = base.segments[i + 1];
      var action = 'none', seq = null, nd = dur;

      if (s.phase === 'rest' && !cs.behind) {
        var n = (core._internal.hashSeed(base.seed + '#greet#' + i) % 2) + 1;
        var body = sitIn(cs.facing).concat(waves(n), [step('sit', 0, false, 400, '坐著', true)]);
        var full = next ? body.concat(sitOut(cs.facing)) : body;  // 計畫最後一段：可以一直坐著
        nd = Math.max(dur, sum(full) + C.GREET_EXTRA_MS);
        action = 'greet'; seq = fill(full, nd);
      } else if (s.phase === 'stop' && !cs.behind && dur >= C.SIT_STOP_MIN_MS) {
        var sitOnly = sitIn(cs.facing).concat(next ? sitOut(cs.facing) : []);
        action = 'sit'; seq = fill(sitOnly, dur);
      } else if (s.phase === 'stop' && cs.behind && dur >= C.REAR_STOP_MIN_MS) {
        action = 'rear-turn'; seq = fill(rearTurn(cs.facing), dur);
      } else if (s.phase === 'hide' && prev && prev.phase === 'walk') {
        nd = Math.max(dur, C.FIRST_HIDE_MIN_MS, sum(rearTurn(cs.facing)));
        action = 'rear-turn'; seq = fill(rearTurn(cs.facing), nd);
      } else if (s.phase === 'turn') {
        action = 'turn'; seq = turnSeq(cs.turnFrom, cs.turnTo, dur);
        root.facing = cs.turnFrom; root.turnTo = cs.turnTo;
      }
      segs.push({ index: i, phase: s.phase, action: action, t0: t, t1: t + nd, baseT0: s.t0, baseT1: s.t1,
                  sequence: seq, sequenceMs: seq ? sum(seq) : 0, root: root, cycles: s.cycles });
      t += nd;
    });
    // 原路線有「長停留 → 休息」相鄰段；保持坐著，避免剛坐下又站起再坐一次。
    for (var j = 1; j < segs.length; j++) {
      var a = segs[j - 1], b = segs[j];
      if ((a.action === 'sit' || a.action === 'greet') && (b.action === 'sit' || b.action === 'greet') &&
          a.root.x === b.root.x && a.root.y === b.root.y) {
        var tail = a.sequence.slice(-4), tailMs = sum(tail);
        a.sequence = a.sequence.slice(0, -4).concat([step('sit', 0, false, tailMs, '繼續坐著')]);
        var inMs = sum(b.sequence.slice(0, 4));
        b.sequence = b.sequence.slice(4);
        b.sequence[0].durationMs += inMs;
      }
    }
    return { version: 'garden-social-v10-2', seed: base.seed, base: base, segments: segs, totalMs: t };
  }

  // ---------- 查詢 ----------
  function findSeg(plan, t) {
    var a = plan.segments, lo = 0, hi = a.length - 1;
    if (t >= a[hi].t0) return a[hi];
    while (lo < hi) {
      var m = (lo + hi + 1) >> 1;
      if (a[m].t0 <= t) lo = m; else hi = m - 1;
    }
    return a[lo];
  }

  function stateAt(plan, timeMs) {
    if (!plan || !plan.segments || !plan.base) throw new TypeError('plan 必須是 makePlan 的回傳值');
    if (typeof timeMs !== 'number' || !isFinite(timeMs)) throw new TypeError('timeMs 必須是有限數字');
    var t = Math.max(0, Math.min(plan.totalMs, timeMs));
    var seg = findSeg(plan, t), local = t - seg.t0;

    if (!seg.sequence) {  // 走路與其他沒有社交動作的段：直接用 v9（長度不變）
      var vt = plan.base.segments[seg.index].t0 + Math.min(local, plan.base.segments[seg.index].t1 - plan.base.segments[seg.index].t0);
      if (seg.phase === 'walk' && local >= seg.t1 - seg.t0 && t < plan.totalMs) vt -= 1e-3;
      var s9 = v9.stateAt(plan.base, vt);
      return Object.assign({}, s9, {
        t: t, total: plan.totalMs, segmentIndex: seg.index, action: 'none', actionLabel: '', actionIndex: -1, stepLabel: '',
        spriteGroup: 'walk', spriteIndex: s9.frameIndex, spriteMirror: s9.mirror
      });
    }

    var acc = 0, k = 0, st = seg.sequence[0];
    for (k = 0; k < seg.sequence.length; k++) {
      st = seg.sequence[k];
      if (local < acc + st.durationMs || k === seg.sequence.length - 1) break;
      acc += st.durationMs;
    }
    var r = seg.root;
    var facing = r.facing;
    if (seg.action === 'turn' && local >= (seg.t1 - seg.t0) / 2) facing = r.turnTo;
    return {
      phase: seg.phase, label: ACTION_LABELS[seg.action], segmentIndex: seg.index,
      x: r.x, y: r.y, depth: r.depth, behind: r.behind, occluded: r.occluded,
      facing: facing, mirror: st.mirror,
      frameIndex: C.STAND, frameLabel: v9.LABELS[C.STAND], cycleMs: C.CYCLE_MS, frameMs: C.FRAME_MS, cycles: 0, walkSpeed: 0,
      t: t, total: plan.totalMs,
      action: seg.action, actionLabel: ACTION_LABELS[seg.action], actionIndex: k, stepLabel: st.label,
      spriteGroup: st.group, spriteIndex: st.frameIndex, spriteMirror: st.mirror
    };
  }

  function summarize(plan) {
    var by = {};
    plan.segments.forEach(function (s) { if (s.action !== 'none') by[s.action] = (by[s.action] || 0) + 1; });
    return {
      version: plan.version, seed: plan.seed, totalMs: plan.totalMs, baseTotalMs: plan.base.totalMs, actions: by,
      segments: plan.segments.map(function (s) {
        return { index: s.index, phase: s.phase, action: s.action, t0: s.t0, t1: s.t1, behind: s.root.behind, facing: s.root.facing,
                 sequenceMs: s.sequenceMs, steps: s.sequence ? s.sequence.map(function (x) { return x.group + x.frameIndex + (x.mirror ? 'm' : '') + ':' + Math.round(x.durationMs); }) : null };
      })
    };
  }

  return Object.freeze({ constants: C, ACTION_LABELS: ACTION_LABELS, makePlan: makePlan, stateAt: stateAt, summarize: summarize, v9: v9 });
});
