/*
 * 木屋避雨 v21：進出屋「面向移動方向」版本（由 v20 複製後修改；v20 保留供比較）。
 * 純邏輯：不讀 DOM、不畫圖、不用 Math.random、不用系統時間；只靠 update(dt) 前進。
 * 瀏覽器：window.GardenShelterV21；CommonJS 亦可。
 *
 * 座標一律是舞台畫面座標（960×760，已經過 routeX 與 groundY 換算）。
 * 每一刻輸出一張真圖格：{ group, frame, mirror, x, footY, layer, inside, heading }
 *   group：'walk'（原十格）、'front'（v10 轉向格）、'entry'、'rest'、'turn'（低姿轉身 0..3）、
 *          'awayturn'（低姿由朝右轉成背對 0..3）、'rearwalk'（背對低姿步行 0..3）、'frontwalk'（面向鏡頭低姿步行 0..3）
 *   layer：'behind'（畫在小屋後面）、'mid'（小屋後層與前門框之間）、'front'（小屋前面）
 * 規則：只有 rearwalk／frontwalk 會沿縱深（y）移動，而且 x 固定在門中央；其他所有轉身、伏低、起身都原地播放，x/y 不動。
 * phase === 'normal'／'waitSafe' 時 pose() 回傳 null，由頁面照原散步計畫畫。
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GardenShelterV21 = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var FRAME_MS = 212.5, STAND = 5;
  var DEFAULTS = {
    walkSpeed: 40,          // 畫面單位／秒（站姿走路，同 v20）
    gaitSpeed: 20,          // rearwalk／frontwalk 縱深速度（候選值，待依實際步幅調）
    gaitFrameMs: 200,       // rearwalk／frontwalk 每格（候選值）
    laneY: 750,             // 門前走道（小屋前緣 745 之前）
    doorGap: 70,            // 屋側外點距門洞左緣
    actorHalfWidth: 112,    // 屋側外點要讓整隻貓的寬度離開小屋
    detourSlope: 1.5,       // 屋側繞行：每 1 單位縱深至少配 1.5 單位橫移，側面走路不做純縱向平移
    crouchMs: [220, 300, 300],   // entry 0→1→2
    awayTurnMs: 260,        // awayturn 0→3（門前原地背轉）
    backTurnMs: 240,        // awayturn 3→0（屋內原地轉回側面）
    insideBridge: false,    // true：屋內轉回側面後多接 turn 0（右前 3/4）再趴下
    lieMs: 420,             // entry 3（轉身伏臥）
    wakeMs: [500, 300],     // rest 0 醒來、entry 3 撐起
    turnFrameMs: 240,       // turn 0..3 每格
    riseMs: 280,            // entry 1、0（鏡像）起身
    waitBoundMs: 8000,      // 等安全接點的上限（樹後時另外繼續等，直到回到前景）
    lazyMs: 5000,
    breathMs: 1700,         // rest1／rest2 各停留
    lazyAgainEvery: 8,      // 每 8 個呼吸循環回到慵懶一次
    lazyAgainMs: 3000,
    dryStableMs: 8000
  };

  var AWAY_HEADINGS = ['right', 'right-rear-3/4', 'rear-near', 'away'];
  var TURN_HEADINGS = ['right-front-3/4', 'toward', 'left-front-3/4', 'left'];
  /** 這一格畫面上的貓面向哪裡（方便驗「位移方向＝面向」）。 */
  function headingOf(group, frame, mirror) {
    var side = mirror ? 'left' : 'right';
    if (group === 'rearwalk') return 'away';
    if (group === 'frontwalk') return 'toward';
    if (group === 'awayturn') return AWAY_HEADINGS[frame];
    if (group === 'turn') return TURN_HEADINGS[frame];
    if (group === 'front') return frame === 1 ? 'toward' : side + '-front-3/4';
    if (group === 'rest') return 'right-lying';
    return side;  // walk、entry
  }

  function step(group, frame, mirror, ms, label) { return { group: group, frame: frame, mirror: !!mirror, ms: ms, label: label }; }
  function turnSeq(from, to) {  // 站姿停穩後經過前 3/4 與正面站換方向（v10 已接受的轉向格）
    return [step('walk', STAND, from < 0, 180, '站穩'), step('front', 0, from < 0, 220, '轉向鏡頭'),
            step('front', 1, false, 220, '正面站'), step('front', 0, to < 0, 220, '轉向新方向'), step('walk', STAND, to < 0, 180, '站好')];
  }

  /**
   * cfg.opening：{ left, right, topAt(x), bottomAt(x), cabinLeft, cabinRight, cabinBase }
   */
  function create(cfg) {
    var C = Object.assign({}, DEFAULTS, cfg || {});
    var op = C.opening;
    // 屋側外點：整隻貓的寬度都要離開小屋，才改變深度
    var doorX = Math.min(op.left - C.doorGap, op.cabinLeft - C.actorHalfWidth - 12);
    var insideX = (op.left + op.right) / 2;
    var midY = op.bottomAt(insideX) - 1;     // 腳底在門中央且不低於此線 → 畫在門框後（mid）
    // The real rear sprites need their paws on the front interior floor, not
    // three units further back/up the drawing. Keep the cat's scale unchanged.
    var insideY = midY;
    var s = null;

    function blank(phase) {
      return { phase: phase, stage: phase, phaseTime: 0, targetWet: false, dryFor: 0, start: null, path: [], pathIdx: 0, walkPhase: null,
               pos: { x: 0, y: 0 }, facing: 1, walkT: 0, walkFrame: STAND, seq: null, seqIdx: 0, seqT: 0, next: null,
               seqLayer: null, seqInside: false, gait: null, gaitFrame: 0, breathCount: 0, waitedMs: 0, waitTimedOut: false, log: [] };
    }
    function note(text) { s.log.push({ phase: s.phase, stage: s.stage, text: text }); if (s.log.length > 20) s.log.shift(); }
    function go(phase, stage) { s.phase = phase; s.stage = stage || phase; s.phaseTime = 0; }
    /** 原地序列：layer／inside 由呼叫端明確指定，序列期間 x/y 不動。 */
    function runSeq(stage, seq, next, layer, inside) {
      s.seq = seq; s.seqIdx = 0; s.seqT = 0; s.next = next; s.seqLayer = layer || null; s.seqInside = !!inside; go('seq', stage);
    }
    function layerAt(x, y) {
      var inCabin = x > op.cabinLeft - 80 && x < op.cabinRight + 20;
      if (y >= op.cabinBase) return 'front';
      return inCabin ? 'behind' : 'front';
    }
    function runFor(dy) { return Math.abs(dy) < 1 ? 0 : C.detourSlope * Math.abs(dy); }

    /**
     * 進屋路徑：原深度往左到屋側外點 → 斜向往左下到走道 → （必要時站姿轉向）→ 沿走道往右到門中央。
     * 側面走路一律帶著橫移改變深度，不做純縱向平移；整段不從小屋本體穿過。
     */
    function approachPath(p0) {
      var pts = [], run = runFor(C.laneY - p0.y);
      if (p0.x > doorX) { pts.push({ x: doorX, y: p0.y }); pts.push({ x: doorX - run, y: C.laneY }); }
      else if (doorX - p0.x >= run) pts.push({ x: doorX, y: C.laneY });   // 已在屋側外：斜向往右下
      else pts.push({ x: p0.x - run, y: C.laneY });                        // 太靠近屋側：先斜向往左下拉開
      pts.push({ x: insideX, y: C.laneY });
      return pts;
    }
    /** 回程：approachPath 的反向，最後回到離開散步的那一點。 */
    function returnPath() {
      var p0 = s.start || { x: doorX, y: C.laneY }, run = runFor(C.laneY - p0.y), pts = [];
      if (p0.x > doorX) { pts.push({ x: doorX - run, y: C.laneY }); pts.push({ x: doorX, y: p0.y }); pts.push({ x: p0.x, y: p0.y }); }
      else if (doorX - p0.x >= run) { pts.push({ x: doorX, y: C.laneY }); pts.push({ x: p0.x, y: p0.y }); }
      else { pts.push({ x: p0.x - run, y: C.laneY }); pts.push({ x: p0.x, y: p0.y }); }
      return pts;
    }
    function startWalk(phase, path) {
      s.walkPhase = phase; s.path = path; s.pathIdx = 0; s.walkT = 0; s.walkFrame = STAND; go(phase);
      checkFlip();
    }
    /** 下一段方向與目前朝向相反 → 先停下、用 v10 轉向格原地轉身，不瞬間翻面。 */
    function checkFlip() {
      var t = s.path[s.pathIdx];
      if (!t) return false;
      var dx = t.x - s.pos.x;
      if (Math.abs(dx) <= .5) return false;
      var want = dx > 0 ? 1 : -1;
      if (want === s.facing) return false;
      s.walkFrame = STAND; s.walkT = 0;
      runSeq('walkTurn', turnSeq(s.facing, want), 'walkOn', null, false); s.facing = want;
      return true;
    }
    function startGait(phase, group, to) {
      s.gait = { group: group, from: { x: s.pos.x, y: s.pos.y }, to: to }; s.gaitFrame = 0; go(phase);
    }

    var api = {
      constants: C, doorX: doorX, inside: { x: insideX, y: insideY }, midY: midY, lane: { x: insideX, y: C.laneY },
      resetNormal: function () { s = blank('normal'); note('回到原散步'); },
      /** 直接屋內初態（初載大雨、seek、減少動態、示範）。start 是之後出屋要接回的原散步位置。 */
      resetInside: function (which, start) {
        s = blank(which === 'lazy' ? 'lazy' : 'sleep'); s.start = start; s.pos = { x: insideX, y: insideY }; s.facing = 1; s.targetWet = true;
        note('直接屋內：' + s.phase);
      },
      setDryFor: function (ms) { s.dryFor = ms; },

      /** input：{ wet, normal: { x, y, facing, safe, behind, planT } } */
      update: function (dt, input) {
        if (!(dt > 0)) dt = 0;
        s.targetWet = !!input.wet;
        s.dryFor = s.targetWet ? 0 : s.dryFor + dt;
        s.phaseTime += dt;
        var n = input.normal;
        switch (s.phase) {
          case 'normal':
            if (s.targetWet) { go('waitSafe'); s.waitedMs = 0; s.waitTimedOut = false; note('下大雨：等安全接點'); }
            break;
          case 'waitSafe':
            if (!s.targetWet) { go('normal'); note('雨變小：繼續散步'); break; }
            s.waitedMs += dt;
            if (s.waitedMs > C.waitBoundMs) s.waitTimedOut = true;
            if (n && !n.behind && (n.safe || s.waitTimedOut)) {
              s.start = { x: n.x, y: n.y, facing: n.facing, planT: n.planT };
              s.pos = { x: n.x, y: n.y }; s.facing = n.facing;
              startWalk('approach', approachPath(s.start));
              note(s.waitTimedOut ? '等待逾時，於非落腳格接入' : '在落腳格接入進屋路徑');
            }
            break;
          case 'approach': case 'returnWalk':
            walk(dt);
            break;
          case 'seq':
            seq(dt);
            break;
          case 'rearIn': case 'frontOut':
            gait(dt);
            break;
          case 'lazy':
            if (exitIfDry()) break;
            if (s.phaseTime >= C.lazyMs) { go('sleep'); s.breathCount = 0; }
            break;
          case 'lazyAgain':
            if (exitIfDry()) break;
            if (s.phaseTime >= C.lazyAgainMs) { go('sleep'); s.breathCount = 0; }
            break;
          case 'sleep':
            if (exitIfDry()) break;
            var cyc = Math.floor(s.phaseTime / (2 * C.breathMs));
            if (cyc >= C.lazyAgainEvery) { go('lazyAgain'); note('醒來慵懶一下'); }
            break;
        }
      },

      /** 目前要畫的圖；normal／waitSafe 回傳 null（照原散步）。 */
      pose: function () {
        var p = null;
        switch (s.phase) {
          case 'normal': case 'waitSafe': return null;
          case 'approach': case 'returnWalk':
            p = { group: 'walk', frame: s.walkFrame, mirror: s.facing < 0, x: s.pos.x, footY: s.pos.y, layer: layerAt(s.pos.x, s.pos.y), inside: false };
            break;
          case 'seq':
            var st = s.seq[s.seqIdx];
            p = { group: st.group, frame: st.frame, mirror: st.mirror, x: s.pos.x, footY: s.pos.y, layer: s.seqLayer || layerAt(s.pos.x, s.pos.y), inside: s.seqInside, label: st.label };
            break;
          case 'rearIn': case 'frontOut':
            // 只有這兩段沿縱深移動；x 固定在門中央，越過門檻線才畫到門框後
            var mid = Math.abs(s.pos.x - insideX) < .01 && s.pos.y <= midY;
            p = { group: s.gait.group, frame: s.gaitFrame, mirror: false, x: s.pos.x, footY: s.pos.y, layer: mid ? 'mid' : 'front', inside: mid };
            break;
          case 'lazy': case 'lazyAgain':
            p = { group: 'rest', frame: 0, mirror: false, x: s.pos.x, footY: s.pos.y, layer: 'mid', inside: true };
            break;
          case 'sleep':
            var b = Math.floor(s.phaseTime / C.breathMs) % 2;
            p = { group: 'rest', frame: 1 + b, mirror: false, x: s.pos.x, footY: s.pos.y, layer: 'mid', inside: true };
            break;
        }
        if (p) p.heading = headingOf(p.group, p.frame, p.mirror);
        return p;
      },
      /** 已離開避雨流程、要接回原散步時回傳原計畫時間；頁面讀到後應呼叫 resetNormal()。 */
      resumePlanT: function () { return s.phase === 'resume' ? (s.start ? s.start.planT : null) : null; },
      frozen: function () { return s.phase !== 'normal' && s.phase !== 'waitSafe'; },
      snapshot: function () {
        var p = api.pose();
        return { phase: s.phase, stage: s.stage, inside: !!(p && p.inside), targetWet: s.targetWet, phaseTime: Math.round(s.phaseTime),
                 dryForMs: Math.round(s.dryFor), frame: p, pose: p ? { group: p.group, frame: p.frame, mirror: p.mirror, layer: p.layer } : null,
                 heading: p ? p.heading : null, facing: s.facing,
                 feet: { x: Math.round(s.pos.x * 10) / 10, y: Math.round(s.pos.y * 10) / 10 },
                 route: { start: s.start, doorX: doorX, laneY: C.laneY, lane: { x: insideX, y: C.laneY }, inside: { x: insideX, y: insideY }, midY: midY,
                          waypoints: s.path.slice(), pathIdx: s.pathIdx, walkPhase: s.walkPhase,
                          gait: s.gait ? { group: s.gait.group, from: s.gait.from, to: s.gait.to } : null,
                          waitedMs: Math.round(s.waitedMs), waitTimedOut: s.waitTimedOut },
                 seq: s.phase === 'seq' ? { stage: s.stage, index: s.seqIdx, length: s.seq.length, next: s.next, layer: s.seqLayer, inside: s.seqInside,
                                            steps: s.seq.map(function (x) { return x.group + '-' + x.frame + (x.mirror ? 'm' : ''); }) } : null,
                 log: s.log.slice() };
      }
    };

    // ---------- 內部步驟 ----------
    function walk(dt) {
      var target = s.path[s.pathIdx];
      if (!target) return arrive();
      var dx = target.x - s.pos.x, dy = target.y - s.pos.y, d = Math.hypot(dx, dy), stepLen = C.walkSpeed * dt / 1000;
      s.walkT += dt;
      while (s.walkT >= FRAME_MS) { s.walkT -= FRAME_MS; s.walkFrame = (s.walkFrame + 1) % 10; }
      if (d <= stepLen) {
        s.pos = { x: target.x, y: target.y }; s.pathIdx += 1;
        if (s.pathIdx >= s.path.length) arrive(); else checkFlip();
      } else { s.pos.x += dx / d * stepLen; s.pos.y += dy / d * stepLen; }
    }
    function arrive() {
      s.walkFrame = STAND;
      if (s.phase === 'approach') {
        if (!s.targetWet) { startWalk('returnWalk', returnPath()); note('到門中央時雨停：原路走回'); return; }
        // 門中央（走道上）：必要時站姿轉向朝右 → 原地伏低 → 原地背轉
        var pre = s.facing < 0 ? turnSeq(-1, 1) : [], A = C.awayTurnMs, M = C.crouchMs;
        s.facing = 1;
        runSeq('crouchAway', pre.concat([
          step('entry', 0, false, M[0], '停下'), step('entry', 1, false, M[1], '伏低'), step('entry', 2, false, M[2], '低姿'),
          step('awayturn', 0, false, A, '低姿朝右'), step('awayturn', 1, false, A, '轉向右後'), step('awayturn', 2, false, A, '幾乎背對'), step('awayturn', 3, false, A, '背對門口')
        ]), 'rearIn', 'front', false);
        note('門中央伏低、原地轉成背對');
      } else {  // returnWalk 結束
        if (s.targetWet) { startWalk('approach', approachPath(s.pos)); note('走回途中又下大雨：再進屋'); return; }
        var want = s.start ? s.start.facing : 1;
        if (want !== s.facing) { runSeq('finalTurn', turnSeq(s.facing, want), 'resume', null, false); s.facing = want; }
        else go('resume');
      }
    }
    function seq(dt) {
      s.seqT += dt;
      while (s.seq && s.seqT >= s.seq[s.seqIdx].ms) {
        s.seqT -= s.seq[s.seqIdx].ms; s.seqIdx += 1;
        if (s.seqIdx >= s.seq.length) { var nx = s.next; s.seq = null; enter(nx); return; }
      }
    }
    function enter(next) {
      if (next === 'rearIn') { startGait('rearIn', 'rearwalk', { x: insideX, y: insideY }); note('背對低姿進屋'); }
      else if (next === 'frontOut') { startGait('frontOut', 'frontwalk', { x: insideX, y: C.laneY }); note('面向鏡頭低姿出屋'); }
      else if (next === 'lazy') { go('lazy'); }
      else if (next === 'returnWalk') { s.facing = -1; startWalk('returnWalk', returnPath()); }
      else if (next === 'walkOn') { go(s.walkPhase); }
      else if (next === 'resume') { go('resume'); }
    }
    function gait(dt) {
      var b = s.gait.to, dx = b.x - s.pos.x, dy = b.y - s.pos.y, d = Math.hypot(dx, dy), stepLen = C.gaitSpeed * dt / 1000;
      s.gaitFrame = Math.floor(s.phaseTime / C.gaitFrameMs) % 4;   // 0→1→2→3 循環，只往前播
      if (d > stepLen) { s.pos.x += dx / d * stepLen; s.pos.y += dy / d * stepLen; return; }
      s.pos = { x: b.x, y: b.y };
      var T = C.turnFrameMs;
      if (s.phase === 'rearIn') {
        // 屋內停穩：awayturn 倒著當「原地轉回側面」→（可選 turn 0）→ entry 3 伏臥
        var B = C.backTurnMs, back = [step('awayturn', 3, false, B, '屋內停步'), step('awayturn', 2, false, B, '轉回'), step('awayturn', 1, false, B, '轉回'), step('awayturn', 0, false, B, '朝右側面')];
        if (C.insideBridge) back.push(step('turn', 0, false, T, '右前 3/4'));
        back.push(step('entry', 3, false, C.lieMs, '轉身伏臥'));
        runSeq('insideTurnBack', back, 'lazy', 'mid', true);
        note('進到屋內、原地轉回側面');
      } else if (s.targetWet) {
        // 剛出到走道又下大雨：正面 → 右前 3/4 → 低姿朝右 → 背轉，再背對進屋（全是原地真轉身）
        var A = C.awayTurnMs;
        runSeq('reenterTurn', [step('turn', 1, false, T, '停步'), step('turn', 0, false, T, '轉向右'),
                               step('awayturn', 0, false, A, '低姿朝右'), step('awayturn', 1, false, A, '轉向右後'), step('awayturn', 2, false, A, '幾乎背對'), step('awayturn', 3, false, A, '背對門口')],
               'rearIn', 'front', false);
        s.facing = 1; note('出到門前又下大雨：轉回背對再進屋');
      } else {
        // 走道上：正面 → 朝左 3/4 → 朝左側面 → 鏡像 entry 1、0 起身 → 沿走道往左
        var R = C.riseMs;
        runSeq('laneTurn', [step('turn', 1, false, T, '停步'), step('turn', 2, false, T, '轉向左'), step('turn', 3, false, T, '朝左'),
                            step('entry', 1, true, R, '起身'), step('entry', 0, true, R, '站起')], 'returnWalk', 'front', false);
        s.facing = -1; note('出到門前、原地轉向左');
      }
    }
    function exitIfDry() {
      if (s.dryFor < C.dryStableMs) return false;
      var W = C.wakeMs, T = C.turnFrameMs;
      // 醒來 → 撐起 → 屋內原地轉成正面（turn 前半）→ 面向鏡頭低姿走出
      runSeq('wake', [step('rest', 0, false, W[0], '醒來'), step('entry', 3, false, W[1], '撐起'),
                      step('turn', 0, false, T, '右前 3/4'), step('turn', 1, false, T, '正面')], 'frontOut', 'mid', true);
      note('雨停 8 秒：出屋');
      return true;
    }

    api.resetNormal();
    return api;
  }

  return Object.freeze({ create: create, FRAME_MS: FRAME_MS, STAND: STAND, DEFAULTS: DEFAULTS, headingOf: headingOf });
});
