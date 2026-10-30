/*
 * 木屋避雨 v20：小貓「大雨／雷雨進屋 → 慵懶 → 趴睡 → 雨停出屋」狀態機。
 * 純邏輯：不讀 DOM、不畫圖、不用 Math.random、不用系統時間；只靠 update(dt) 前進。
 * 瀏覽器：window.GardenShelterV20；CommonJS 亦可。
 *
 * 座標一律是舞台畫面座標（960×760，已經過 routeX 與 groundY 換算）。
 * 每一刻輸出一張真圖格：{ group, frame, mirror, x, footY, layer }
 *   group：'walk'（原十格）、'front'（v10 轉向格）、'entry'、'rest'、'crawl'（伏低步行 0..3）、'turn'（屋內低姿轉身 0..3）
 *   layer：'behind'（畫在小屋後面）、'mid'（小屋後層與前門框之間）、'front'（小屋前面）
 * phase === 'normal' 時回傳 null，由頁面照原散步計畫畫。
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GardenShelterV20 = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var FRAME_MS = 212.5, STAND = 5;
  var DEFAULTS = {
    walkSpeed: 40,          // 畫面單位／秒（走路）
    creepSpeed: 22,         // 低姿進出門速度（候選值，步幅是否自然待實測）
    crawlFrameMs: 180,      // crawl 0..3 每格停留（候選值）
    turnFrameMs: 240,       // 屋內低姿轉身 turn 0..3 每格
    laneY: 750,             // 門前走道（在樹根與小屋前緣之前）
    doorGap: 70,            // 門外停點距門洞左緣
    midBelowY: 742,         // 腳底高於此線且在小屋寬度內 → 畫在門框之後
    waitBoundMs: 8000,      // 等安全接點的上限（樹後時另外繼續等，直到回到前景）
    lazyMs: 5000,
    breathMs: 1700,         // rest1／rest2 各停留
    lazyAgainEvery: 8,      // 每 8 個呼吸循環回到慵懶一次
    lazyAgainMs: 3000,
    dryStableMs: 8000
  };

  function step(group, frame, mirror, ms, label) { return { group: group, frame: frame, mirror: !!mirror, ms: ms, label: label }; }
  function turnSeq(from, to) {  // 停穩後經過前 3/4 與正面站換方向（v10 已接受的轉向格）
    return [step('walk', STAND, from < 0, 180, '站穩'), step('front', 0, from < 0, 220, '轉向鏡頭'),
            step('front', 1, false, 220, '正面站'), step('front', 0, to < 0, 220, '轉向新方向'), step('walk', STAND, to < 0, 180, '站好')];
  }

  /**
   * cfg.opening：{ left, right, topAt(x), bottomAt(x), cabinLeft, cabinRight, cabinBase }
   */
  function create(cfg) {
    var C = Object.assign({}, DEFAULTS, cfg || {});
    var op = C.opening;
    // Clear the entire sprite before changing depth around the cabin's side.
    var doorX = Math.min(op.left - C.doorGap, op.cabinLeft - (C.actorHalfWidth || 112) - 12);
    var insideX = (op.left + op.right) / 2;
    var insideY = op.bottomAt(insideX) - 4;
    var s = null;

    function blank(phase) {
      return { phase: phase, phaseTime: 0, targetWet: false, dryFor: 0, start: null, path: [], pathIdx: 0,
               pos: { x: 0, y: 0 }, facing: 1, walkT: 0, walkFrame: STAND, seq: null, seqIdx: 0, seqT: 0, next: null,
               creepFrom: null, creepTo: null, creepPath: [], creepIdx: 0, creepFacing: 1, breathCount: 0, waitedMs: 0, waitTimedOut: false, log: [] };
    }
    function note(text) { s.log.push({ phase: s.phase, text: text }); if (s.log.length > 20) s.log.shift(); }
    function go(phase) { s.phase = phase; s.phaseTime = 0; }
    function runSeq(seq, next) { s.seq = seq; s.seqIdx = 0; s.seqT = 0; s.next = next; go('seq'); }

    function approachPath(p0) {
      var pts = [];
      if (p0.x > doorX) pts.push({ x: doorX, y: p0.y });   // 先在原深度往左走到門外 x，不從小屋中間穿過
      pts.push({ x: pts.length ? doorX : p0.x, y: C.laneY });
      if (!pts.length || pts[pts.length - 1].x !== doorX) pts.push({ x: doorX, y: C.laneY });
      return pts;
    }
    function startWalk(path, after) {
      s.path = path; s.pathIdx = 0; s.walkT = 0; s.walkFrame = STAND; s.afterWalk = after; go(s.phaseName || 'walk');
    }
    function layerAt(x, y) {
      var inCabin = x > op.cabinLeft - 80 && x < op.cabinRight + 20;
      if (y >= C.cabinFrontY) return 'front';
      return inCabin ? 'behind' : 'front';
    }

    var api = {
      constants: C, doorX: doorX, inside: { x: insideX, y: insideY },
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
              s.phaseName = 'approach'; startWalk(approachPath(s.start), 'atDoor');
              note(s.waitTimedOut ? '等待逾時，於非落腳格接入' : '在落腳格接入進屋路徑');
            }
            break;
          case 'approach': case 'returnWalk':
            walk(dt);
            break;
          case 'seq':
            seq(dt);
            break;
          case 'creepIn': case 'creepOut':
            creep(dt);
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
        switch (s.phase) {
          case 'normal': case 'waitSafe': return null;
          case 'approach': case 'returnWalk':
            return { group: 'walk', frame: s.walkFrame, mirror: s.facing < 0, x: s.pos.x, footY: s.pos.y, layer: layerAt(s.pos.x, s.pos.y), inside: false };
          case 'seq':
            var st = s.seq[s.seqIdx];
            return { group: st.group, frame: st.frame, mirror: st.mirror, x: s.pos.x, footY: s.pos.y, layer: s.seqLayer || layerAt(s.pos.x, s.pos.y), inside: !!s.seqInside, label: st.label };
          case 'creepIn': case 'creepOut':
            // Enter through the FRONT opening, never through the left post.
            var mid = Math.abs(s.pos.x - insideX) < .01 && s.pos.y <= op.bottomAt(insideX) - 1;
            // 真正的伏低步行循環 crawl 0..3；朝左（出屋）是整張鏡像，但之前已播完真正的轉身 turn 0..3
            return { group: 'crawl', frame: s.creepFrame, mirror: s.creepFacing < 0, x: s.pos.x, footY: s.pos.y, layer: mid ? 'mid' : 'front', inside: mid };
          case 'lazy': case 'lazyAgain':
            return { group: 'rest', frame: 0, mirror: false, x: s.pos.x, footY: s.pos.y, layer: 'mid', inside: true };
          case 'sleep':
            var b = Math.floor(s.phaseTime / C.breathMs) % 2;
            return { group: 'rest', frame: 1 + b, mirror: false, x: s.pos.x, footY: s.pos.y, layer: 'mid', inside: true };
        }
        return null;
      },
      /** 已離開避雨流程、要接回原散步時回傳原計畫時間；頁面讀到後應呼叫 resetNormal()。 */
      resumePlanT: function () { return s.phase === 'resume' ? (s.start ? s.start.planT : null) : null; },
      frozen: function () { return s.phase !== 'normal' && s.phase !== 'waitSafe'; },
      snapshot: function () {
        return { phase: s.phase, inside: !!(api.pose() && api.pose().inside), targetWet: s.targetWet, phaseTime: Math.round(s.phaseTime),
                 dryForMs: Math.round(s.dryFor), frame: api.pose(),
                 feet: { x: Math.round(s.pos.x * 10) / 10, y: Math.round(s.pos.y * 10) / 10 },
                 route: { start: s.start, doorX: doorX, laneY: C.laneY, inside: { x: insideX, y: insideY }, waypoints: s.path.slice(), pathIdx: s.pathIdx,
                          waitedMs: Math.round(s.waitedMs), waitTimedOut: s.waitTimedOut },
                 seq: s.phase === 'seq' ? { index: s.seqIdx, length: s.seq.length, next: s.next } : null, log: s.log.slice() };
      }
    };

    // ---------- 內部步驟 ----------
    function walk(dt) {
      var target = s.path[s.pathIdx];
      if (!target) return arrive();
      var dx = target.x - s.pos.x, dy = target.y - s.pos.y, d = Math.hypot(dx, dy), stepLen = C.walkSpeed * dt / 1000;
      if (Math.abs(dx) > .5) s.facing = dx > 0 ? 1 : -1;
      s.walkT += dt;
      while (s.walkT >= FRAME_MS) { s.walkT -= FRAME_MS; s.walkFrame = (s.walkFrame + 1) % 10; }
      if (d <= stepLen) { s.pos = { x: target.x, y: target.y }; s.pathIdx += 1; if (s.pathIdx >= s.path.length) arrive(); }
      else { s.pos.x += dx / d * stepLen; s.pos.y += dy / d * stepLen; }
    }
    function arrive() {
      s.walkFrame = STAND;
      if (s.phase === 'approach') {
        if (!s.targetWet) {  // 走完目前這段才決定：雨已停 → 原路走回
          s.phaseName = 'returnWalk'; startWalk(returnPath(), 'resume'); note('到門口時雨停：走回'); return;
        }
        var pre = s.facing < 0 ? turnSeq(-1, 1) : [];
        s.seqLayer = null; s.seqInside = false; s.facing = 1;
        runSeq(pre.concat([step('entry', 0, false, 220, '停下'), step('entry', 1, false, 320, '伏低'), step('entry', 2, false, 320, '低姿')]), 'creepIn');
        note('門外伏低');
      } else {  // returnWalk 結束
        if (s.targetWet) { s.phaseName = 'approach'; startWalk(approachPath(s.pos), 'atDoor'); note('走回途中又下大雨：再進屋'); return; }
        var want = s.start ? s.start.facing : 1;
        s.seqLayer = null; s.seqInside = false;
        if (want !== s.facing) { runSeq(turnSeq(s.facing, want), 'resume'); s.facing = want; }
        else { go('resume'); }
      }
    }
    function returnPath() {
      var p0 = s.start || { x: doorX, y: C.laneY };
      var pts = [];
      if (p0.x > doorX) { pts.push({ x: doorX, y: p0.y }); pts.push({ x: p0.x, y: p0.y }); }
      else { pts.push({ x: p0.x, y: C.laneY }); pts.push({ x: p0.x, y: p0.y }); }
      return pts;
    }
    function seq(dt) {
      s.seqT += dt;
      while (s.seq && s.seqT >= s.seq[s.seqIdx].ms) {
        s.seqT -= s.seq[s.seqIdx].ms; s.seqIdx += 1;
        if (s.seqIdx >= s.seq.length) { var nx = s.next; s.seq = null; enter(nx); return; }
      }
    }
    function enter(next) {
      if (next === 'creepIn') {
        s.creepFrom = { x: s.pos.x, y: s.pos.y };
        s.creepPath = [{ x: insideX, y: C.laneY }, { x: insideX, y: insideY }]; s.creepIdx = 0;
        s.creepTo = s.creepPath[0]; s.creepFacing = 1; s.creepFrame = 0; go('creepIn');
      } else if (next === 'lazy') { go('lazy'); }
      else if (next === 'creepOut') {
        s.creepFrom = { x: s.pos.x, y: s.pos.y };
        s.creepPath = [{ x: insideX, y: C.laneY }, { x: doorX, y: C.laneY }]; s.creepIdx = 0;
        s.creepTo = s.creepPath[0]; s.creepFacing = -1; s.creepFrame = 0; go('creepOut');
      } else if (next === 'rise') {
        s.seqInside = false; s.seqLayer = null; s.facing = -1;
        runSeq([step('entry', 1, true, 280, '起身'), step('entry', 0, true, 280, '站起')], 'returnWalk');
      } else if (next === 'returnWalk') { s.phaseName = 'returnWalk'; startWalk(returnPath(), 'resume'); }
      else if (next === 'resume') { go('resume'); }
    }
    function creep(dt) {
      var a = s.creepFrom, b = s.creepTo, dx = b.x - s.pos.x, dy = b.y - s.pos.y, d = Math.hypot(dx, dy), stepLen = C.creepSpeed * dt / 1000;
      s.creepFrame = Math.floor(s.phaseTime / C.crawlFrameMs) % 4;  // crawl 0→1→2→3 循環
      if (d <= stepLen) {
        s.pos = { x: b.x, y: b.y };
        s.creepIdx += 1;
        if (s.creepIdx < s.creepPath.length) { s.creepTo = s.creepPath[s.creepIdx]; return; }
        if (s.phase === 'creepIn') { s.seqInside = true; s.seqLayer = 'mid'; runSeq([step('entry', 3, false, 420, '轉身伏臥')], 'lazy'); note('進到屋內'); }
        else { enter('rise'); note('出到門外'); }
      } else { s.pos.x += dx / d * stepLen; s.pos.y += dy / d * stepLen; }
      void a;
    }
    function exitIfDry() {
      if (s.dryFor < C.dryStableMs) return false;
      s.seqInside = true; s.seqLayer = 'mid';
      // 醒來 → 由伏臥撐起（entry3 倒用）→ 真正的低姿轉身 turn 0..3（朝右 3/4 → 正面 → 朝左 3/4 → 朝左側面）→ 朝左伏低步行
      var T = C.turnFrameMs;
      runSeq([step('rest', 0, false, 500, '醒來'), step('entry', 3, false, 300, '撐起'),
              step('turn', 0, false, T, '轉身'), step('turn', 1, false, T, '轉身・正面'), step('turn', 2, false, T, '轉身'), step('turn', 3, false, T, '朝左')], 'creepOut');
      note('雨停 8 秒：出屋');
      return true;
    }

    C.cabinFrontY = op.cabinBase;
    api.resetNormal();
    return api;
  }

  return Object.freeze({ create: create, FRAME_MS: FRAME_MS, STAND: STAND, DEFAULTS: DEFAULTS });
});
