/*
 * 樹後小窩 v6（小貓）：由 garden-cat-homes-v5 複製後簡化路線；舊檔保留不動。
 * 純邏輯：不讀 DOM、不畫圖、不用 Math.random、不用系統時間；只靠 update(dt) 前進。
 * 瀏覽器：window.GardenCatHomesV6；CommonJS 亦可。
 * v6：入窩 離開點 → homeA → homeT → 門前；出窩 門前 → homeT → homeA，就地落點，不走回離開點。
 *     wet 變 false 就是明確出窩指令，不等 8 秒。回接協定見 resumeAnchor／takeResumeAnchor。
 *
 * 座標一律是舞台畫面座標（960×760）。窩在樹後，比例由腳底 y 連續決定（depthAt）。
 * 每一刻輸出一張真圖格：{ group, frame, mirror, x, footY, depth, layer, inside, heading, diagonalGait }
 *   group：'walk'（原十格）、'front'／'rear'（v10 站姿轉向格）、'rear3qwalk'／'front3qwalk'（斜向走路八格）、
 *          'entry'、'rest'、'turn'（低姿轉身 0..3）、'awayturn'（低姿由朝右轉成背對 0..3）、'rearwalk'、'frontwalk'
 *   layer：'front'（樹前）、'behind'（窩的前框之後、樹之前）、'mid'（窩的後層與前框之間）
 * 規則：
 *  - 戶外每段算 r = |dy/dx|：r >= diagThreshold 用斜向步態，否則側走。cfg.diagonal 沒開時全部側走，行為同 v4。
 *  - 轉身、伏低、起身都原地；前景與樹後只在根外的 homeT、原地、站姿換層。
 *  - 低姿圖（entry、awayturn、rearwalk、frontwalk、turn）只出現在門前到屋內。
 *  - 斜向一段走整數循環，起訖平滑減速；不瞬間鏡像，也不在半步切圖。
 * phase === 'normal'／'waitSafe' 時 pose() 回傳 null，由頁面照原散步計畫畫。
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GardenCatHomesV6 = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var FRAME_MS = 212.5, STAND = 5;
  var DEFAULTS = {
    walkSpeed: 52,          // 候選值，v5 是 40：畫面單位／秒（站姿走路，隨比例變慢）
    walkFrameMs: 190,       // 候選值，原 212.5：十格走路的每格時間
    gaitSpeed: 26,          // 候選值，v5 是 20：rearwalk／frontwalk 縱深速度（隨比例變慢）
    gaitFrameMs: 200,
    crouchMs: [180, 240, 240],   // 候選值：entry 0→1→2
    awayTurnMs: 220,
    backTurnMs: 200,
    standHoldMs: 110,       // 候選值，v5 是 180：轉身與落腳前後的站姿停留
    lieMs: 420,
    wakeMs: [500, 300],
    turnFrameMs: 220,
    riseMs: 240,
    waitBoundMs: 8000,
    lazyMs: 5000,
    breathMs: 1700,
    lazyAgainEvery: 8,
    lazyAgainMs: 3000,
    dryStableMs: 0,         // v5 是 8000：外層傳 wet=false 就是明確出窩指令，不再等
    homeScale: 0.66,        // 門前與屋內的自然比例（候選 0.63～0.7）
    diagonal: false,        // 兩組斜向圖都載到才開
    diagThreshold: 0.25,    // 候選值：r 到這裡才用斜向步態
    diagMinLen: 20,         // 候選值：太短的段走不完一個循環，保留側走
    diagFrameMs: 200,       // manifest 的 frameMs 可覆寫
    diagStride: 85,         // 候選值，v5 是 68：斜向有效步幅放大 1.25 倍，腳滑要看真圖
    diagForeshorten: 0.65,  // 候選值：3/4 角度的步幅縮短，要看真圖才定
    diagBridgeMs: 180,
    diagRamp: 0.18,         // 起訖平滑的比例
    // S、T：小貓日常繞樹的點，本核心不走 S，T 是比例的遠端基準；
    // homeA／homeT 只給進出窩用。homeT 沿用已驗的站姿換層點；homeA 是 v6 新點，走道轉角兼出窩落點，尚待 alpha 驗證。
    // A→T 的 dx 77、dy -51，r 約 0.662，兔的側面短跳也在 2/3 內。
    points: { S: { x: 768, y: 745 }, T: { x: 755, y: 694 }, homeA: { x: 687, y: 745 }, homeT: { x: 764, y: 694 } }
  };

  /** 比例只由腳底 y 決定：y >= 740 是 1，y <= farY 是 far，中間線性。 */
  function depthAt(y, farY, far) {
    var t = (y - farY) / (740 - farY);
    return far + (1 - far) * (t < 0 ? 0 : t > 1 ? 1 : t);
  }
  /** 起訖平滑、中段等速；u 與回傳值都在 0..1。 */
  function rampEase(u, a) {
    var v = 1 / (1 - a);
    if (u <= 0) return 0;
    if (u >= 1) return 1;
    if (u < a) return v * u * u / (2 * a);
    if (u > 1 - a) return 1 - v * (1 - u) * (1 - u) / (2 * a);
    return v * (u - a / 2);
  }
  var AWAY_HEADINGS = ['right', 'right-rear-3/4', 'rear-near', 'away'];
  var TURN_HEADINGS = ['right-front-3/4', 'toward', 'left-front-3/4', 'left'];
  function headingOf(group, frame, mirror) {
    var side = mirror ? 'left' : 'right';
    if (group === 'rearwalk') return 'away';
    if (group === 'frontwalk') return 'toward';
    if (group === 'rear3qwalk' || group === 'rear') return side + '-rear-3/4';
    if (group === 'front3qwalk') return side + '-front-3/4';
    if (group === 'awayturn') return mirror ? AWAY_HEADINGS[frame].replace('right', 'left') : AWAY_HEADINGS[frame];
    if (group === 'turn') return TURN_HEADINGS[frame];
    if (group === 'front') return frame === 1 ? 'toward' : side + '-front-3/4';
    if (group === 'rest') return 'right-lying';
    return side;
  }
  function step(group, frame, mirror, ms, label) { return { group: group, frame: frame, mirror: !!mirror, ms: ms, label: label || '' }; }
  function total(steps) { return steps.reduce(function (a, x) { return a + x.ms; }, 0); }

  /**
   * cfg.opening：{ left, right, topAt(x), bottomAt(x) }（由 manifest 算好）
   * cfg.diagonal：斜向圖都到齊才給 true
   */
  function create(cfg) {
    var C = Object.assign({}, DEFAULTS, cfg || {}), op = C.opening, A_ = C.points.homeA, T = C.points.T, H = C.points.homeT, HOLD = C.standHoldMs;
    var insideX = (op.left + op.right) / 2 + (op.insideOffsetX || 0), midY = op.bottomAt(insideX) - 1, insideY = midY;
    var lane = { x: insideX, y: H.y }, s = null;

    function depthOf(y) { return depthAt(y, T.y, C.homeScale); }
    function blank(phase) {
      return { phase: phase, stage: phase, phaseTime: 0, targetWet: false, dryFor: 0, start: null, pos: { x: 0, y: 0 }, facing: 1,
               ops: null, idx: 0, t: 0, breathCount: 0, waitedMs: 0, waitTimedOut: false, anchor: null, leaving: false, log: [] };
    }
    function note(text) { s.log.push({ phase: s.phase, stage: s.stage, text: text }); if (s.log.length > 20) s.log.shift(); }
    function go(phase) { s.phase = phase; s.stage = phase; s.phaseTime = 0; }
    /** 這段該用什麼圖：同一條規則給所有戶外段。 */
    function classify(a, z) {
      var dx = z.x - a.x, dy = z.y - a.y, L = Math.hypot(dx, dy), r = Math.abs(dy) / Math.max(Math.abs(dx), 1e-6);
      var diag = !!C.diagonal && L >= C.diagMinLen && r >= C.diagThreshold;
      return { r: r, L: L, diag: diag, kind: diag ? (dy < 0 ? 'rear' : 'front') : 'side', dir: Math.abs(dx) > 0.5 ? (dx > 0 ? 1 : -1) : 0 };
    }

    // ---------- 腳本：每一步都知道自己的起點 ----------
    function builder(start, facing, startOrient) {
      var ops = [], pos = { x: start.x, y: start.y }, face = facing, orient = startOrient || 'side';
      var b = {
        ops: ops, pos: function () { return { x: pos.x, y: pos.y }; }, facing: function () { return face; }, setFacing: function (f) { face = f; return b; },
        seq: function (stage, steps, layer, inside) {
          ops.push({ kind: 'seq', stage: stage, steps: steps, x: pos.x, y: pos.y, layer: layer, inside: !!inside, ms: total(steps) });
          return b;
        },
        /** 從斜向的站姿回到側面站姿；已是側面就不動。 */
        toSide: function (layer) {
          var m = face < 0, B = C.diagBridgeMs;
          if (orient === 'rear') b.seq('diagToSide', [step('rear', 1, m, B, '落腳'), step('rear', 0, m, B, '轉回側面'), step('walk', STAND, m, HOLD, '站好')], layer);
          else if (orient === 'front') b.seq('diagToSide', [step('front', 0, m, B, '落腳'), step('walk', STAND, m, HOLD, '站好')], layer);
          orient = 'side';
          return b;
        },
        /** 站姿原地換方向（v10 轉向格），不瞬間翻面。 */
        turnTo: function (dir, layer) {
          b.toSide(layer);
          if (dir === face) return b;
          b.seq('walkTurn', [step('walk', STAND, face < 0, HOLD, '站穩'), step('front', 0, face < 0, 200, '轉向鏡頭'), step('front', 1, false, 200, '正面站'),
                             step('front', 0, dir < 0, 200, '轉向新方向'), step('walk', STAND, dir < 0, HOLD, '站好')], layer);
          face = dir;
          return b;
        },
        /** 斜向步態：先用真圖轉到位，走整數循環，起訖平滑。 */
        diag: function (to, layer, c) {
          var dir = c.dir || face, kind = c.kind, B = C.diagBridgeMs;
          if (orient === kind && face === dir) { /* 同方向接著走 */ }
          else if (orient === 'front' && kind === 'front') {  // 前 3/4 換邊：經過真正面，最短的路
            b.seq('diagTurnFront', [step('front', 0, face < 0, B, '落腳'), step('front', 1, false, 220, '正面站'), step('front', 0, dir < 0, B, '轉向新方向')], layer);
            face = dir;
          } else if (kind === 'front' && orient === 'side' && dir !== face) {  // 由側面轉到另一邊的前 3/4：不用先站回側面
            b.seq('diagTurnFront', [step('walk', STAND, face < 0, HOLD, '站穩'), step('front', 0, face < 0, 200, '轉向鏡頭'), step('front', 1, false, 200, '正面站'), step('front', 0, dir < 0, 200, '前 3/4')], layer);
            face = dir;
          } else {
            // 後 3/4 換邊沒有站姿正背面，只能回側面繞過正面（turnTo 內含 toSide）
            b.turnTo(dir, layer);
            if (kind === 'rear') b.seq('diagTurnRear', [step('walk', STAND, face < 0, HOLD, '站穩'), step('rear', 0, face < 0, B, '轉向後'), step('rear', 1, face < 0, B, '後 3/4')], layer);
            else b.seq('diagTurnFront', [step('walk', STAND, face < 0, HOLD, '站穩'), step('front', 0, face < 0, B, '前 3/4')], layer);
          }
          var d = depthOf((pos.y + to.y) / 2), n = Math.max(1, Math.round(c.L / (C.diagStride * d * C.diagForeshorten)));
          ops.push({ kind: 'diag', stage: kind === 'rear' ? 'diagRear' : 'diagFront', group: kind + '3qwalk', from: { x: pos.x, y: pos.y }, to: { x: to.x, y: to.y }, ms: n * 8 * C.diagFrameMs, cycles: n, mirror: face < 0, layer: layer });
          pos = { x: to.x, y: to.y };
          orient = kind;
          return b;
        },
        /** 戶外移動：依 r 決定斜向或側走；同一走道的側走速度隨比例變慢。 */
        walk: function (to, layer) {
          var L = Math.hypot(to.x - pos.x, to.y - pos.y);
          if (L < 1) { pos = { x: to.x, y: to.y }; return b; }
          var c = classify(pos, to);
          if (c.diag) return b.diag(to, layer, c);
          b.toSide(layer);
          if (Math.abs(to.x - pos.x) > 0.5) b.turnTo(to.x > pos.x ? 1 : -1, layer);
          var d = depthOf((pos.y + to.y) / 2);
          ops.push({ kind: 'walk', stage: 'walk', from: { x: pos.x, y: pos.y }, to: { x: to.x, y: to.y }, ms: L / (C.walkSpeed * d) * 1000, mirror: face < 0, layer: layer });
          pos = { x: to.x, y: to.y };
          return b;
        },
        /** 真背面／正面步態。door=true 走門中央：越過門檻線才畫到門框後。 */
        gait: function (group, to, layer, door, stage) {
          var L = Math.hypot(to.x - pos.x, to.y - pos.y), d = depthOf((pos.y + to.y) / 2);
          ops.push({ kind: 'gait', stage: stage || group, group: group, from: { x: pos.x, y: pos.y }, to: { x: to.x, y: to.y }, ms: Math.max(1, L / (C.gaitSpeed * d) * 1000), layer: layer, door: !!door });
          pos = { x: to.x, y: to.y };
          return b;
        },
        call: function (fn) { ops.push({ kind: 'call', fn: fn, ms: 0, stage: 'decide' }); return b; }
      };
      return b;
    }
    function run(phase, b) { s.phase = phase; s.phaseTime = 0; s.ops = b.ops; s.idx = 0; s.t = 0; runCalls(); }
    function replaceRest(b) { s.ops = b.ops; s.idx = 0; s.t = 0; runCalls(); }
    function runCalls() {
      while (s.ops && s.idx < s.ops.length && s.ops[s.idx].kind === 'call') { var op2 = s.ops[s.idx]; s.idx += 1; s.t = 0; op2.fn(); }
    }
    function finishTo(phase) { s.ops = null; s.idx = 0; s.t = 0; go(phase); }

    // ---------- 分段 ----------
    function crouchSteps(m) {
      var M = C.crouchMs;
      return [step('walk', STAND, m, 180, '站穩'), step('entry', 0, m, M[0], '停下'), step('entry', 1, m, M[1], '伏低'), step('entry', 2, m, M[2], '低姿')];
    }
    function awaySteps(m) {
      var A = C.awayTurnMs;
      return [step('awayturn', 0, m, A, '低姿側面'), step('awayturn', 1, m, A, '轉向後'), step('awayturn', 2, m, A, '幾乎背對'), step('awayturn', 3, m, A, '背對')];
    }
    /**
     * 離開點與 homeT 之間要經過的中繼點（不含 homeT）。沒有折返：
     * 在 homeA 左邊的先沿走道走到 homeA；已在它右邊就直接斜走到 homeT，不走回頭路。
     * 側走太陡時（沒有斜向圖）才退回 homeA，避免側面圖純縱深滑動。
     */
    function outdoorPath(r) {
      if (r.x < A_.x) return [A_];
      var c = classify(r, H), steep = c.r > 2 / 3 && c.L >= 1;
      return steep && !c.diag ? [A_] : [];
    }
    /** 給快照：這次戶外每一段的判定。 */
    function routeSegments(st) {
      if (!st) return null;
      var pts = [{ x: st.x, y: st.y }].concat(outdoorPath(st), [H, lane]), out = [];
      for (var i = 0; i + 1 < pts.length; i++) {
        var c = classify(pts[i], pts[i + 1]);
        out.push({ from: pts[i], to: pts[i + 1], r: Math.round(c.r * 1000) / 1000, group: c.diag ? c.kind + '3qwalk' : 'walk', mirror: c.dir < 0 });
      }
      return out;
    }
    /** 從離開點到 homeT：戶外走路 → 回到側面站姿 → 原地換到樹後層。 */
    function toBehindAtHomeT(b, start) {
      outdoorPath(start).forEach(function (p) { b.walk(p, 'front'); });
      b.walk(H, 'front');
      b.toSide('front');
      b.seq('homeSwapBehind', [step('walk', STAND, b.facing() < 0, HOLD, '在根外換到樹後')], 'behind');
    }
    function doorIn(b, m) {
      b.gait('rearwalk', { x: insideX, y: insideY }, 'behind', true, 'rearIn');
      var B = C.backTurnMs;
      b.seq('insideTurnBack', [step('awayturn', 3, false, B, '屋內停步'), step('awayturn', 2, false, B, '轉回'), step('awayturn', 1, false, B, '轉回'), step('awayturn', 0, false, B, '朝右側面'),
                               step('entry', 3, false, C.lieMs, '轉身伏臥')], 'mid', true);
      b.call(function () { finishTo('lazy'); s.pos = { x: insideX, y: insideY }; s.facing = 1; note('進到屋內'); });
      void m;
    }
    function enterScript() {
      var st = s.start, b = builder(st, st.facing);
      toBehindAtHomeT(b, st);
      b.walk(lane, 'behind');
      b.call(function () {
        var f = b.facing();
        if (!s.targetWet) { var back = builder(lane, f); laneToFront(back); note('到門口時雨停：走回'); replaceRest(back); return; }
        var d = builder(lane, f);
        d.seq('doorCrouch', crouchSteps(f < 0).concat(awaySteps(f < 0)), 'behind');
        doorIn(d, f < 0);
        note('門前伏低轉背');
        replaceRest(d);
      });
      note(s.waitTimedOut ? '等待逾時，於非落腳格接入' : '在落腳格接入：繞到樹後走向窩');
      run('enter', b);
    }
    /** 就地落點：記下回接點，停在站姿等頁面取走。不跳回舊計畫時間。 */
    function land(b) {
      b.call(function () {
        var p = b.pos();
        s.anchor = { x: p.x, y: p.y, facing: b.facing() < 0 ? -1 : 1, depth: depthOf(p.y), layer: 'front' };
        s.pos = p; s.facing = s.anchor.facing;
        finishTo('landed');
        note('出窩落點：等頁面重建散步');
      });
    }
    /** 從前景目前位置走到落點：還在 homeA 左邊就地落點，其他走到 homeA。 */
    function frontTail(b) {
      if (b.pos().x > A_.x) b.walk(A_, 'front');
      b.toSide('front');
      land(b);
    }
    /** 從門前回前景（已起身）：側走到 homeT → 站姿換回前層 → 走到落點 homeA，不回離開點。 */
    function laneToFront(b) {
      b.walk(H, 'behind');
      b.toSide('behind');
      b.seq('homeSwapFront', [step('walk', STAND, b.facing() < 0, HOLD, '在根外回到前景')], 'front');
      frontTail(b);
    }
    /** 入窩途中還在前景就收到出窩指令：走到整步就停。斜向走完該循環才轉。 */
    function leaveWhileOutdoors() {
      var op = s.ops && s.ops[s.idx];
      if (!op || op.layer !== 'front' || s.leaving) return;
      if (op.kind === 'walk') {
        var cyc = 10 * C.walkFrameMs, k = Math.ceil((s.t + 1) / cyc), edge = k * cyc;
        if (edge < op.ms) {
          var u = edge / op.ms;
          op.to = { x: op.from.x + (op.to.x - op.from.x) * u, y: op.from.y + (op.to.y - op.from.y) * u };
          op.ms = edge;
        }
      } else if (op.kind !== 'diag') return;
      s.leaving = true;
    }
    function leaveAtEdge(op) {
      s.phase = 'exit';
      var b = builder(op.to, op.mirror ? -1 : 1, op.kind === 'diag' ? (op.group === 'rear3qwalk' ? 'rear' : 'front') : 'side');
      frontTail(b);
      note('入窩途中收到出窩指令');
      replaceRest(b);
    }
    function exitScript() {
      var W = C.wakeMs, Tn = C.turnFrameMs, R = C.riseMs, b = builder({ x: insideX, y: insideY }, 1);
      b.seq('wake', [step('rest', 0, false, W[0], '醒來'), step('entry', 3, false, W[1], '撐起'), step('turn', 0, false, Tn, '轉身'), step('turn', 1, false, Tn, '面向鏡頭')], 'mid', true);
      b.gait('frontwalk', lane, 'behind', true, 'frontOut');
      b.call(function () {
        if (s.targetWet) {  // 剛出到門前又下大雨：原地轉回背對再進屋
          var again = builder(lane, 1), A = C.awayTurnMs;
          again.seq('reenterTurn', [step('turn', 1, false, Tn, '停步'), step('turn', 0, false, Tn, '轉向右'), step('awayturn', 0, false, A, '低姿朝右'), step('awayturn', 1, false, A, '轉向後'),
                                    step('awayturn', 2, false, A, '幾乎背對'), step('awayturn', 3, false, A, '背對門口')], 'behind');
          doorIn(again, false);
          note('又下大雨：轉回背對再進屋');
          replaceRest(again);
          return;
        }
        var dir = H.x >= lane.x ? 1 : -1, m = dir < 0, d = builder(lane, dir);
        d.seq('doorRise', (m ? [step('turn', 1, false, Tn, '停步'), step('turn', 2, false, Tn, '轉向左'), step('turn', 3, false, Tn, '朝左')]
                             : [step('turn', 1, false, Tn, '停步'), step('turn', 0, false, Tn, '轉向右'), step('awayturn', 0, false, C.awayTurnMs, '朝右')])
          .concat([step('entry', 1, m, R, '起身'), step('entry', 0, m, R, '站起'), step('walk', STAND, m, HOLD, '站好')]), 'behind');
        laneToFront(d);
        replaceRest(d);
      });
      note('收到出窩指令：出屋');
      run('exit', b);
    }
    function exitIfDry() {
      if (s.targetWet || s.dryFor < C.dryStableMs) return false;
      exitScript();
      return true;
    }

    function poseOfOp(op, t) {
      var p = null;
      if (op.kind === 'seq') {
        var acc = 0, st = op.steps[op.steps.length - 1];
        for (var i = 0; i < op.steps.length; i++) { if (t < acc + op.steps[i].ms) { st = op.steps[i]; break; } acc += op.steps[i].ms; }
        p = { group: st.group, frame: st.frame, mirror: st.mirror, x: op.x, footY: op.y, layer: op.layer, inside: op.inside, label: st.label };
      } else if (op.kind === 'walk') {
        var u = Math.min(1, t / op.ms);
        p = { group: 'walk', frame: (STAND + Math.floor(t / C.walkFrameMs)) % 10, mirror: op.mirror, x: op.from.x + (op.to.x - op.from.x) * u, footY: op.from.y + (op.to.y - op.from.y) * u, layer: op.layer, inside: false, label: '走路' };
      } else if (op.kind === 'diag') {
        var e = rampEase(t / op.ms, C.diagRamp), idx = Math.min(op.cycles * 8 - 1, Math.floor(t / C.diagFrameMs)) % 8;
        p = { group: op.group, frame: idx, mirror: op.mirror, x: op.from.x + (op.to.x - op.from.x) * e, footY: op.from.y + (op.to.y - op.from.y) * e, layer: op.layer, inside: false, label: op.group === 'rear3qwalk' ? '斜後方走' : '斜前方走', diagonalGait: true };
      } else if (op.kind === 'gait') {
        var g = Math.min(1, t / op.ms), gy = op.from.y + (op.to.y - op.from.y) * g, inDoor = op.door && gy <= midY + 1e-6;
        p = { group: op.group, frame: Math.floor(t / C.gaitFrameMs) % 4, mirror: false, x: op.from.x + (op.to.x - op.from.x) * g, footY: gy, layer: inDoor ? 'mid' : op.layer, inside: !!inDoor, label: op.group === 'rearwalk' ? '背對走' : '面向鏡頭走' };
      }
      return p;
    }

    var api = {
      constants: C, points: C.points, inside: { x: insideX, y: insideY }, midY: midY, lane: lane, depthOf: depthOf, diagonal: !!C.diagonal,
      resetNormal: function () { s = blank('normal'); note('回到原散步'); },
      /** 直接屋內初態（初載大雨、seek、減少動態、示範）。start 是之後出屋要接回的原散步位置。 */
      resetInside: function (which, start) {
        s = blank(which === 'lazy' ? 'lazy' : 'sleep'); s.start = start; s.pos = { x: insideX, y: insideY }; s.facing = 1; s.targetWet = true;
        note('直接屋內：' + s.phase);
      },
      setDryFor: function (ms) { s.dryFor = ms; },
      returnToSleep: function () { if (['lazy', 'lazyAgain', 'sleep'].indexOf(s.phase) < 0) return false; go('sleep'); s.breathCount = 0; return true; },

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
              enterScript();
            }
            break;
          case 'enter': case 'exit':
            var op = s.ops && s.ops[s.idx];
            if (!op) break;
            if (s.phase === 'enter' && !s.targetWet) leaveWhileOutdoors();
            s.t += dt;
            if (s.t >= op.ms) {
              var extra = s.t - op.ms;
              s.pos = op.kind === 'seq' ? { x: op.x, y: op.y } : { x: op.to.x, y: op.to.y };
              if (s.leaving && s.phase === 'enter') { s.leaving = false; s.t = 0; leaveAtEdge(op); break; }
              s.idx += 1; s.t = 0;
              runCalls();
              if (s.ops && s.idx < s.ops.length) s.t = Math.min(extra, 50);
            }
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
            if (Math.floor(s.phaseTime / (2 * C.breathMs)) >= C.lazyAgainEvery) { go('lazyAgain'); note('醒來慵懶一下'); }
            break;
        }
      },

      /** 目前要畫的圖；normal／waitSafe 回傳 null（照原散步）。 */
      pose: function () {
        var p = null;
        switch (s.phase) {
          case 'normal': case 'waitSafe': return null;
          case 'landed':  // 等頁面取走回接點；還沒取走就站著，不跳回舊計畫
            p = { group: 'walk', frame: STAND, mirror: s.anchor.facing < 0, x: s.anchor.x, footY: s.anchor.y, layer: 'front', inside: false, label: '站好' };
            break;
          case 'enter': case 'exit':
            var op = s.ops && s.ops[s.idx];
            p = op && op.kind !== 'call' ? poseOfOp(op, s.t) : null;
            break;
          case 'lazy': case 'lazyAgain':
            p = { group: 'rest', frame: 0, mirror: false, x: insideX, footY: insideY, layer: 'mid', inside: true };
            break;
          case 'sleep':
            p = { group: 'rest', frame: 1 + Math.floor(s.phaseTime / C.breathMs) % 2, mirror: false, x: insideX, footY: insideY, layer: 'mid', inside: true };
            break;
        }
        if (p) { p.depth = depthOf(p.footY); p.heading = headingOf(p.group, p.frame, p.mirror); p.diagonalGait = !!p.diagonalGait; }
        return p;
      },
      /** 已離開避雨流程、要接回原散步時回傳原計畫時間；頁面讀到後應呼叫 resetNormal()。 */
      resumePlanT: function () { return null; },  // v6 永遠 null：不回舊計畫，改用下面兩個
      /** 落點資料；還沒落點是 null。只看不取。 */
      resumeAnchor: function () { return s.phase === 'landed' ? Object.assign({}, s.anchor) : null; },
      /** 取走落點並回到 normal。頁面要在同一拍用它重建散步起點。 */
      takeResumeAnchor: function () {
        if (s.phase !== 'landed') return null;
        var a = Object.assign({}, s.anchor);
        s = blank('normal');
        note('頁面取走回接點');
        return a;
      },
      /** 明確出窩：立刻生效。外層下一次 update 也要傳 wet=false，否則會被視為又下雨。 */
      requestLeave: function () {
        s.targetWet = false; s.dryFor = Math.max(s.dryFor, C.dryStableMs);
        if (['lazy', 'lazyAgain', 'sleep'].indexOf(s.phase) >= 0) { exitScript(); return { ok: true, state: 'exit' }; }
        return { ok: true, state: s.phase };
      },
      /** 減少動態用：不播動畫，直接到落點。 */
      instantLeave: function () {
        s.anchor = { x: A_.x, y: A_.y, facing: -1, depth: depthOf(A_.y), layer: 'front' };
        s.ops = null; s.idx = 0; s.t = 0; s.targetWet = false; s.leaving = false;
        go('landed');
        return Object.assign({}, s.anchor);
      },
      frozen: function () { return s.phase !== 'normal' && s.phase !== 'waitSafe'; },
      /** 窩要不要畫：大雨雷雨，或還在避雨流程裡。出完才收。 */
      homeVisible: function (wet) { return !!wet || (s.phase !== 'normal' && s.phase !== 'waitSafe' && s.phase !== 'landed'); },
      snapshot: function () {
        var p = api.pose(), op = s.ops && s.ops[s.idx];
        return { phase: s.phase, stage: op ? op.stage : s.phase, inside: !!(p && p.inside), targetWet: s.targetWet, phaseTime: Math.round(s.phaseTime), dryForMs: Math.round(s.dryFor),
                 frame: p, pose: p ? { group: p.group, frame: p.frame, mirror: p.mirror, layer: p.layer, diagonalGait: p.diagonalGait } : null, heading: p ? p.heading : null, depth: p ? p.depth : null, facing: s.facing,
                 feet: p ? { x: Math.round(p.x * 10) / 10, y: Math.round(p.footY * 10) / 10 } : { x: s.pos.x, y: s.pos.y },
                 route: { start: s.start, points: C.points, diagonalGait: !!C.diagonal, segments: routeSegments(s.start), homePoints: { A: A_, T: H, lane: lane }, anchor: s.anchor, outdoorPath: s.start ? outdoorPath(s.start) : null, lane: lane, inside: { x: insideX, y: insideY }, midY: midY, homeScale: C.homeScale, waitedMs: Math.round(s.waitedMs), waitTimedOut: s.waitTimedOut },
                 op: op ? { kind: op.kind, stage: op.stage, index: s.idx, total: s.ops.length, t: Math.round(s.t), ms: Math.round(op.ms) } : null, log: s.log.slice() };
      }
    };

    api.resetNormal();
    return api;
  }

  return Object.freeze({ create: create, depthAt: depthAt, headingOf: headingOf, rampEase: rampEase, FRAME_MS: FRAME_MS, STAND: STAND, DEFAULTS: DEFAULTS });
});
