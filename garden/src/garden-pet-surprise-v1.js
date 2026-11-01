/*
 * 寵物驚訝回窩 v1：偷偷在窩前散步 → 發現你、驚訝 1 秒 → 交回既有入窩控制器，以 2 倍時間回窩。
 * 純邏輯：不讀 DOM、不畫圖、不用 Math.random、不用系統時間、沒有 timer／RAF；只靠場景 tick 傳入的 dt。
 * 瀏覽器：window.GardenPetSurpriseV1；CommonJS：require('./garden-pet-surprise-v1.js')。
 *
 * 路線：從 homeT 左邊一小段走向 homeT（樹後層，站姿），在 homeT 停下驚訝。homeT 是已驗證的站姿點，
 * 既有控制器從這裡接手時第一步就是原地換層，接著自己轉身走到門前、伏低、穿門，所以不會穿樹或跳進門。
 * 不改既有核心。接法見 docs/pet-surprise-v1.md。
 *
 * 階段：idle → stroll → surprise → handoff → returning → done；cancel() 隨時可到 cancelled。
 * pose() 只在 stroll、surprise、handoff 有值，其他是 null，由既有控制器的 pose 接手。
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GardenPetSurpriseV1 = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PROBABILITY = 0.2, RETURN_SCALE = 2, SURPRISE_MS = 1400;
  var HOME_T = Object.freeze({ x: 764, y: 694 }), HOME_SCALE = 0.66;
  // 候選值：走完一個完整循環才停，所以大約 1 秒多；距離約等於比例 0.66 時的正常步幅。
  var STROLL = Object.freeze({
    cat: Object.freeze({ kind: 'walk', group: 'walk', frames: 10, startFrame: 5, frameMs: 150, distance: 44, stand: ['walk', 5] }),
    dog: Object.freeze({ kind: 'walk', group: 'walk', frames: 8, startFrame: 0, frameMs: 170, distance: 32, stand: ['stand', 0] }),
    rabbit: Object.freeze({ kind: 'hop', group: 'hop', distance: 37, holdMs: 230, stand: ['stand', 0] })
  });
  // 與 garden-pets-v2 的 HOP_TABLE 相同；可用 opts.hopTable 傳入，模組才不必依賴它。
  var HOP_TABLE = Object.freeze([
    Object.freeze({ index: 0, ms: 120, from: 0, to: 0 }), Object.freeze({ index: 1, ms: 170, from: 0, to: 0 }),
    Object.freeze({ index: 2, ms: 90, from: 0, to: 0.15 }), Object.freeze({ index: 3, ms: 150, from: 0.15, to: 1, air: true }),
    Object.freeze({ index: 4, ms: 100, from: 1, to: 1 }), Object.freeze({ index: 5, ms: 140, from: 1, to: 1 })
  ]);
  // 依圖格數分配 1 秒，最後一格（驚訝）停最久
  var SURPRISE_STEPS = Object.freeze({ 2: [250, 1000], 3: [150, 250, 1000], 4: [100, 150, 200, 1000] });

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function sum(list, key) { return list.reduce(function (a, x) { return a + (key ? x[key] : x); }, 0); }

  /**
   * 一次頁面只抽一次：第一次 decide 之後，不論結果都回傳 false。切寵物不會再抽。
   * random 由場景傳入（例如 Math.random），測試可注入固定值。不寫 DB、不改休息偏好。
   */
  function createPageGate(random) {
    var used = false, result = null;
    return {
      /** ctx：{ requestedRest, reduced, assetsReady, canEnter }。 */
      decide: function (ctx) {
        if (used) return false;
        used = true;
        var c = ctx || {};
        if (!c.requestedRest || c.reduced || !c.assetsReady || !c.canEnter) { result = false; return false; }
        result = random() < PROBABILITY;
        return result;
      },
      used: function () { return used; }, result: function () { return result; }
    };
  }

  /**
   * opts：{ species, homeT, homeScale, surpriseFrames, surpriseGroup, hopTable, stroll }
   * surpriseFrames 是實際載到的驚訝圖格數（2～4）。沒有圖就 start 失敗，場景照原本屋內休息。
   */
  function create(opts) {
    var o = opts || {};
    if (!STROLL[o.species]) throw new TypeError('species 必須是 cat、dog 或 rabbit');
    var species = o.species, T = o.homeT || HOME_T, far = o.homeScale || HOME_SCALE, cfg = Object.assign({}, STROLL[species], o.stroll || {});
    var table = o.hopTable || HOP_TABLE, group = o.surpriseGroup || 'surprise', steps = SURPRISE_STEPS[o.surpriseFrames] || null;
    var from = { x: T.x - cfg.distance, y: T.y };
    var strollMs = cfg.kind === 'hop' ? sum(table, 'ms') + cfg.holdMs : cfg.frames * cfg.frameMs;
    var phase = 'idle', t = 0, reason = '', surpriseMs = steps ? sum(steps) : SURPRISE_MS;

    function makePose(g, frame, x, label, moving, airborne) {
      return { group: g, frame: frame, index: frame, mirror: false, x: x, y: T.y, footY: T.y, depth: far, layer: 'behind', inside: false,
               heading: g === group ? 'right-looking-camera' : 'right', label: label, moving: !!moving, airborne: !!airborne, surprise: true };
    }
    function standPose(label) { return makePose(cfg.stand[0], cfg.stand[1], T.x, label, false); }
    function strollPose() {
      if (cfg.kind === 'walk') {
        var u = clamp01(t / strollMs), frame = (cfg.startFrame + Math.floor(t / cfg.frameMs)) % cfg.frames;
        return makePose(cfg.group, frame, from.x + (T.x - from.x) * u, '偷偷散步', true);
      }
      var acc = 0, h = table[table.length - 1];
      if (t >= sum(table, 'ms')) return standPose('落地停穩');
      for (var i = 0; i < table.length; i++) { if (t < acc + table[i].ms) { h = table[i]; break; } acc += table[i].ms; }
      var f = h.from + (h.to - h.from) * clamp01((t - acc) / h.ms);
      return makePose(cfg.group, h.index, from.x + (T.x - from.x) * f, '偷偷跳', h.from !== h.to, h.air);
    }
    function surprisePose() {
      var acc = 0, last = steps.length - 1;
      for (var i = 0; i < last; i++) { acc += steps[i]; if (t < acc) return makePose(group, i, T.x, i ? '發現了' : '停下'); }
      return makePose(group, last, T.x, '驚訝');
    }

    var api = {
      species: species, from: from, to: { x: T.x, y: T.y }, strollMs: strollMs, surpriseMs: surpriseMs, returnScale: RETURN_SCALE,
      /** ctx：{ reduced, canEnter }。回傳 { ok, reason }。失敗時場景照原本屋內休息。 */
      start: function (ctx) {
        var c = ctx || {};
        if (phase !== 'idle') { reason = 'already-started'; return { ok: false, reason: reason }; }
        if (c.reduced) { reason = 'reduced-motion'; phase = 'cancelled'; return { ok: false, reason: reason }; }
        if (!steps) { reason = 'assets-pending'; phase = 'cancelled'; return { ok: false, reason: reason }; }
        if (c.canEnter === false) { reason = 'home-pending'; phase = 'cancelled'; return { ok: false, reason: reason }; }
        phase = 'stroll'; t = 0; reason = '';
        return { ok: true, phase: phase };
      },
      /** 只有 stroll、surprise 會自己前進；到 handoff 就等場景把控制器接上。 */
      update: function (dt) {
        if (!(dt > 0)) return phase;
        if (phase === 'stroll') {
          t += dt;
          if (t >= strollMs) { t -= strollMs; phase = 'surprise'; }  // 餘數留給驚訝，總時間才準
        } else if (phase === 'surprise') {
          t += dt;
          if (t >= surpriseMs) { t = 0; phase = 'handoff'; }
        }
        return phase;
      },
      pose: function () {
        if (phase === 'stroll') return strollPose();
        if (phase === 'surprise') return surprisePose();
        if (phase === 'handoff') return standPose('轉身回窩');
        return null;
      },
      phase: function () { return phase; },
      /** 場景要不要由本模組畫、並暫停一般散步與點擊。 */
      active: function () { return phase === 'stroll' || phase === 'surprise' || phase === 'handoff'; },
      /** 小貓核心 update 的 normal 參數：讓它以為就站在 homeT，從這裡開始入窩。 */
      handoffNormal: function (planT) { return { x: T.x, y: T.y, facing: 1, safe: true, behind: false, planT: planT }; },
      /** 狗兔：wrapV2 用。寵物還在表演時，控制器讀到的散步狀態是站在 homeT。 */
      roamOverride: function () {
        if (!api.active()) return null;
        return { x: T.x, y: T.y, facing: 1, mirror: false, group: 'stand', index: 0, phase: 'surprise', depth: far, label: '驚訝', moving: false, airborne: false, segmentIndex: 0 };
      },
      /** 控制器已經接手（pose 非 null 或 mode 是 script）時呼叫。之後本模組的 pose 是 null。 */
      finish: function () { if (phase === 'handoff') { phase = 'returning'; return true; } return false; },
      /**
       * 控制器 update 要乘的時間倍率。傳入控制器的 snapshot；回到屋內就恢復 1，並把階段設為 done。
       * 小貓看 snap.phase；狗兔看 snap.mode、snap.script。
       */
      controllerDtScale: function (snap) {
        if (phase !== 'handoff' && phase !== 'returning') return 1;
        if (!snap) return RETURN_SCALE;
        var entering = snap.script === 'enter' || snap.mode === 'roam' || snap.phase === 'enter' || snap.phase === 'waitSafe' || snap.phase === 'normal';
        if (entering) return RETURN_SCALE;
        if (phase === 'returning') phase = 'done';
        return 1;
      },
      /** 減少動態、切寵物或重設時用。回傳先前是否還在表演；之後場景照原本流程重建屋內。 */
      cancel: function () { var was = api.active(); if (phase !== 'done') phase = 'cancelled'; return was; },
      state: function () {
        return { species: species, phase: phase, t: Math.round(t), reason: reason, strollMs: strollMs, surpriseMs: surpriseMs, returnScale: RETURN_SCALE, from: from, to: { x: T.x, y: T.y }, depth: far, surpriseFrames: steps ? steps.length : 0, pose: api.pose() };
      }
    };
    return api;
  }

  /** 狗兔控制器的 opts.v2：表演中讓 stateAt 回報站在 homeT，其他照原本。getSurprise 回傳目前的模組或 null。 */
  function wrapV2(V2, getSurprise) {
    return Object.assign({}, V2, {
      stateAt: function (plan, ms) {
        var sp = getSurprise && getSurprise(), st = sp && sp.roamOverride();
        return st || V2.stateAt(plan, ms);
      }
    });
  }

  return Object.freeze({ create: create, createPageGate: createPageGate, wrapV2: wrapV2, PROBABILITY: PROBABILITY, RETURN_SCALE: RETURN_SCALE, SURPRISE_MS: SURPRISE_MS, STROLL: STROLL, HOME_T: HOME_T, SURPRISE_STEPS: SURPRISE_STEPS });
});
