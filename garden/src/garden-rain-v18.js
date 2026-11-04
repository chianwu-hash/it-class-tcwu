/*
 * 雨景 v18：看得見的毛毛雨／大雨／雷雨、分叉閃電、WebAudio 合成雷聲。
 * 依賴：window.GardenWeatherV16（晴日／陰天／雨後／夜晚背景，不修改）。
 * 匯出：window.GardenWeatherV18（背景快取與陰影設定）、window.GardenRainV18（雨與閃電）、window.GardenThunderAudioV18（雷聲）。
 * 原則：
 *  - 雨的位置全部由「雨時鐘 ms」決定，沒有每滴雨的 timer；暫停或分頁隱藏時雨時鐘停，畫面就停。
 *  - 閃電事件由雨時鐘決定（固定間隔＋種子抖動），雷聲在閃電後延遲數百毫秒～2 秒，也是用雨時鐘觸發，
 *    所以暫停、切走都不會留下延遲雷聲，回來也不會補播。
 *  - 雷聲是 WebAudio 即時合成的（雜訊＋濾波＋包絡），不是錄音，也沒有外部音檔。
 */
(function (root) {
  'use strict';
  var base = root.GardenWeatherV16;
  if (!base) throw new Error('需要先載入 GardenWeatherV16');

  // ---------- 種子亂數與粒子池 ----------
  function hash(n) { n = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); n ^= n >>> 13; n = Math.imul(n, 0xc2b2ae35); n ^= n >>> 16; return (n >>> 0) / 4294967296; }
  var seedN = 90173;
  function rnd() { seedN = (Math.imul(seedN, 1664525) + 1013904223) >>> 0; return seedN / 4294967296; }
  var POOL = 1200, drops = [], splashes = [];
  for (var i = 0; i < POOL; i++) drops.push({ x: rnd(), y: rnd(), sp: .78 + rnd() * .44, len: .7 + rnd() * .6, end: rnd(), ph: rnd() });
  for (var j = 0; j < 160; j++) splashes.push({ x: rnd(), y: rnd(), ph: rnd(), sz: .7 + rnd() * .6 });

  // ---------- 三種雨 ----------
  // alpha 是深色雨絲核心；hi 是淺色高光（讓雨在亮天空與深色樹幹上都看得見）。
  var RAIN = {
    drizzle: { count: 300, speed: 300, length: 12, wind: -45, width: 1.25, alpha: .5, hi: .45, splash: 34, splashPeriod: .9, backShare: .45,
      sky: ['#a9b8c2', '#c9d3d6', '#dde3dc'], ground: ['#c3ceba', '#b7c6ae', '#abbca1'], veil: .07, label: '毛毛雨：細密斜雨絲＋地面小漣漪' },
    downpour: { count: 560, speed: 940, length: 36, wind: -230, width: 1.7, alpha: .56, hi: .55, splash: 90, splashPeriod: .45, backShare: .45,
      sky: ['#7b8d9d', '#a3b3bc', '#c7d0cc'], ground: ['#b1c2ad', '#a3b79f', '#97ab92'], veil: .1, label: '大雨：密集長雨絲、斜風、明顯水花' },
    thunder: { count: 660, speed: 1100, length: 42, wind: -320, width: 1.8, alpha: .6, hi: .6, splash: 110, splashPeriod: .4, backShare: .45,
      sky: ['#56687b', '#83969f', '#adbcbd'], ground: ['#a4b6a1', '#96aa92', '#899e86'], veil: .12, label: '雷雨：暴雨＋分叉閃電＋合成雷聲' }
  };
  function isRain(kind) { return !!RAIN[kind]; }
  function factor(viewWidth) { return viewWidth <= 700 ? .72 : 1; }  // 手機降載，仍明顯
  function counts(kind, viewWidth) {
    var p = RAIN[kind]; if (!p) return { back: 0, front: 0, splashes: 0 };
    var total = Math.min(POOL, Math.round(p.count * factor(viewWidth))), back = Math.round(total * p.backShare);
    return { back: back, front: total - back, splashes: Math.min(160, Math.round(p.splash * factor(viewWidth))) };
  }

  // ---------- 背景（1920×1520 快取，每種只畫一次） ----------
  var cache = {};
  var profiles = Object.assign({}, base.profiles);
  Object.keys(RAIN).forEach(function (k) { profiles[k] = { shadow: [.09, .13, .12, .085], spread: 1.3, tint: 'none', shadowColor: '47,66,66' }; });
  function wash(c, x, y, rx, ry, color, alpha) {
    c.save(); c.translate(x, y); c.scale(rx, ry);
    var g = c.createRadialGradient(0, 0, 0, 0, 0, 1); g.addColorStop(0, 'rgba(' + color + ',' + alpha + ')'); g.addColorStop(1, 'rgba(' + color + ',0)');
    c.fillStyle = g; c.fillRect(-1, -1, 2, 2); c.restore();
  }
  // 晴日：V16／V15 沒有 day，v14～v17 是頁內 makeSunnyLayer()。以下逐行照抄 preview/garden-sunny-v14.html 的同一繪法（同色、同弧、同 seed 19437 細紋）。
  function makeSunnyLayer() {
    var layer = document.createElement('canvas'); layer.width=1920;layer.height=1520;
    var c=layer.getContext('2d');c.scale(2,2);
    var sky=c.createLinearGradient(0,0,0,600);
    sky.addColorStop(0,'#dfe8ec');sky.addColorStop(.52,'#f1f0e7');sky.addColorStop(1,'#f6f1e6');
    c.fillStyle=sky;c.fillRect(0,0,960,760);
    var light=c.createRadialGradient(190,170,10,190,170,540);
    light.addColorStop(0,'rgba(255,250,226,.25)');light.addColorStop(1,'rgba(255,250,226,0)');
    c.fillStyle=light;c.fillRect(0,0,960,760);
    function groundPath(){c.beginPath();c.moveTo(0,565);c.bezierCurveTo(220,552,320,554,480,560);c.bezierCurveTo(670,567,800,566,960,559);c.lineTo(960,760);c.lineTo(0,760);c.closePath();}
    var grass=c.createLinearGradient(0,552,0,760);grass.addColorStop(0,'#d9dcc0');grass.addColorStop(.42,'#d0d4b5');grass.addColorStop(1,'#c7cba8');
    c.save();c.filter='blur(9px)';c.fillStyle=grass;groundPath();c.fill();c.restore();
    // Leave the upper feathered edge intact; all walking occurs on this flat band.
    c.save();c.beginPath();c.rect(0,582,960,178);c.clip();c.fillStyle=grass;c.fillRect(0,582,960,178);
    var n=19437;function rand(){n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;}
    for(var i=0;i<4400;i++){var x=rand()*960,y=582+rand()*178;c.fillStyle=i%3?'rgba(101,112,72,.035)':'rgba(255,250,229,.095)';c.beginPath();c.ellipse(x,y,.45+rand()*1.15,.2+rand()*.35,0,0,Math.PI*2);c.fill();}
    c.restore();return layer;
  }
  function layer(kind) {
    if (kind === 'day') return cache.day || (cache.day = makeSunnyLayer());
    if (!isRain(kind)) return base.layer(kind);
    if (cache[kind]) return cache[kind];
    var p = RAIN[kind], cv = document.createElement('canvas'); cv.width = 1920; cv.height = 1520;
    var c = cv.getContext('2d'); c.scale(2, 2);
    var sky = c.createLinearGradient(0, 0, 0, 600); p.sky.forEach(function (col, i) { sky.addColorStop([0, .55, 1][i], col); });
    c.fillStyle = sky; c.fillRect(0, 0, 960, 760);
    // 雲層：上方較暗的厚雲帶
    wash(c, 200, 40, 460, 120, '40,52,64', kind === 'drizzle' ? .1 : .2);
    wash(c, 760, 70, 420, 130, '40,52,64', kind === 'drizzle' ? .08 : .18);
    // 遠處雨幕：靜態淡斜紋，表現遠方也在下雨
    c.save(); c.globalAlpha = kind === 'drizzle' ? .05 : .08; c.strokeStyle = '#3c4c58'; c.lineWidth = 6;
    for (var x = -200; x < 1100; x += 34) { c.beginPath(); c.moveTo(x, 120); c.lineTo(x - 90, 560); c.stroke(); }
    c.restore();
    function path() { c.beginPath(); c.moveTo(0, 565); c.bezierCurveTo(220, 552, 320, 554, 480, 560); c.bezierCurveTo(670, 567, 800, 566, 960, 559); c.lineTo(960, 760); c.lineTo(0, 760); c.closePath(); }
    var grass = c.createLinearGradient(0, 552, 0, 760); p.ground.forEach(function (col, i) { grass.addColorStop([0, .42, 1][i], col); });
    c.save(); c.filter = 'blur(9px)'; c.fillStyle = grass; path(); c.fill(); c.restore();
    c.save(); c.beginPath(); c.rect(0, 582, 960, 178); c.clip(); c.fillStyle = grass; c.fillRect(0, 582, 960, 178);
    // 濕地反光（只在走路帶以外的兩側與遠處，淡淡的）
    wash(c, 210, 612, 200, 10, '232,240,242', .22); wash(c, 760, 640, 170, 9, '232,240,242', .2);
    wash(c, 140, 735, 120, 8, '232,240,242', .16); wash(c, 840, 740, 110, 7, '232,240,242', .16);
    c.restore();
    cache[kind] = cv; return cv;
  }

  // ---------- 閃電事件（由雨時鐘決定） ----------
  var AUTO_FIRST = 4000, AUTO_GAP = 13000, AUTO_JITTER = 5000, FLASH_MS = 900;
  function autoEvent(k) {
    return { t: AUTO_FIRST + k * AUTO_GAP + Math.floor(hash(k * 7 + 1) * AUTO_JITTER), delay: 700 + Math.floor(hash(k * 7 + 2) * 1500),
             strength: .7 + hash(k * 7 + 3) * .3, seed: k * 31 + 5, id: 'auto-' + k, manual: false };
  }
  var manual = [], log = [], lastFlash = null;
  // 已取消的事件 id（已閃電、雷聲尚未響時被暫停／隱藏／seek 等取消）；有界保留最近 16 筆
  var cancelled = [];
  function isCancelled(id) { return cancelled.indexOf(id) >= 0; }
  function uncancel(id) { var i = cancelled.indexOf(id); if (i >= 0) cancelled.splice(i, 1); }
  /** 取消所有「閃電已出現、雷聲還沒響」的事件，並清除手動事件。未來的新閃電不受影響。 */
  function cancelPending(ms) {
    var n = 0;
    eventsNear(ms, true).forEach(function (e) {
      if (!e.manual && e.t <= ms && e.t + e.delay > ms - 1 && !isCancelled(e.id)) { cancelled.push(e.id); n += 1; }
    });
    n += manual.length; manual.length = 0;
    while (cancelled.length > 16) cancelled.shift();
    return n;
  }
  function triggerManual(ms) {
    var e = { t: ms + 120, delay: 900, strength: 1, seed: 7001 + manual.length * 13 + Math.floor(ms) % 97, id: 'manual-' + Math.round(ms), manual: true };
    manual.push(e); if (manual.length > 4) manual.shift(); return e;
  }
  function clearManual() { manual.length = 0; }
  function eventsNear(ms, auto) {
    var out = [];
    if (auto && ms >= AUTO_FIRST - 1) {
      var k = Math.floor((ms - AUTO_FIRST) / AUTO_GAP);
      for (var d = -1; d <= 1; d++) if (k + d >= 0) out.push(autoEvent(k + d));
    }
    return out.concat(manual);
  }
  /** 回傳 (prevMs, ms] 之間該發出的雷聲；seek 或重設時 prevMs 設成同一值，就不會補播。 */
  function update(prevMs, ms, kind, auto) {
    var cues = [];
    if (kind !== 'thunder' || !(ms > prevMs)) return cues;
    eventsNear(ms, auto).forEach(function (e) {
      var at = e.t + e.delay;
      if (e.t > prevMs && e.t <= ms) {  // 閃電真的發生（含 seek 回去後重新發生）：這是新的一次，解除取消
        uncancel(e.id);
        lastFlash = e; log.push({ id: e.id, t: e.t, manual: e.manual }); if (log.length > 12) log.shift();
      }
      if (isCancelled(e.id)) return;
      if (at > prevMs && at <= ms && ms - at < 400) cues.push(e);  // 太久以前的不補
    });
    return cues;
  }
  function flashAt(ms, kind, auto) {
    if (kind !== 'thunder') return null;
    var best = null;
    eventsNear(ms, auto).forEach(function (e) {
      var dt = ms - e.t; if (dt < 0 || dt > FLASH_MS || isCancelled(e.id)) return;
      // 兩次亮起（主閃＋回擊），之後平滑衰減；不是連續頻閃
      var I = dt < 60 ? dt / 60 : dt < 140 ? 1 - (dt - 60) / 80 * .65 : dt < 200 ? .35 + (dt - 140) / 60 * .45 : .8 * Math.exp(-(dt - 200) / 180);
      I *= e.strength;
      if (!best || I > best.intensity) best = { intensity: I, event: e };
    });
    return best;
  }
  var boltCache = {};
  function bolt(seed) {
    if (boltCache[seed]) return boltCache[seed];
    var r = function (n) { return hash(seed * 101 + n); };
    var side = r(1) < .5, x0 = side ? .08 + r(2) * .14 : .78 + r(2) * .14, main = [[x0, 0]], x = x0, y = 0, n = 10 + Math.floor(r(3) * 4);
    for (var i = 1; i <= n; i++) { y = i / n * (.5 + r(4) * .1); x += (r(10 + i) - .5) * .07; main.push([x, y]); }
    var branches = [];
    for (var b = 0; b < 3; b++) {
      var at = 2 + Math.floor(r(30 + b) * (n - 4)), p = main[at], br = [p], bx = p[0], by = p[1], dir = r(40 + b) < .5 ? -1 : 1;
      for (var s = 1; s <= 4; s++) { bx += dir * (.015 + r(50 + b * 5 + s) * .03); by += .025 + r(60 + b * 5 + s) * .02; br.push([bx, by]); }
      branches.push(br);
    }
    return (boltCache[seed] = { main: main, branches: branches });
  }
  function drawBolt(ctx, f, left, width) {
    var b = bolt(f.event.seed), H = 760, a = Math.min(1, f.intensity);
    function line(pts) { ctx.beginPath(); pts.forEach(function (p, i) { var X = left + p[0] * width, Y = p[1] * H; if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }); }
    ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(190,215,255,' + a + ')'; ctx.shadowBlur = 18;
    ctx.strokeStyle = 'rgba(200,222,255,' + (.55 * a) + ')'; ctx.lineWidth = 7; line(b.main); ctx.stroke();
    ctx.shadowBlur = 8; ctx.strokeStyle = 'rgba(255,255,255,' + a + ')'; ctx.lineWidth = 2.4; line(b.main); ctx.stroke();
    ctx.lineWidth = 1.4; b.branches.forEach(function (br) { line(br); ctx.stroke(); });
    ctx.restore();
  }

  // ---------- 繪製 ----------
  function streaks(ctx, ms, kind, o, front, alphaScale) {
    var p = RAIN[kind], c = counts(kind, o.viewWidth), t = ms / 1000;
    var from = front ? c.back : 0, to = front ? c.back + c.front : c.back;
    var W = o.viewWidth + 220, L = o.viewLeft - 110;
    var gust = kind === 'thunder' ? 1 + .25 * Math.sin(t * .5) : kind === 'downpour' ? 1 + .12 * Math.sin(t * .37) : 1;
    var wind = p.wind * gust, path = new Path2D();
    for (var i = from; i < to; i++) {
      var q = drops[i], sp = p.speed * q.sp, len = p.length * q.len * (front ? 1 : .8);
      var fall = (front ? 660 : 600) + q.end * 140;           // 每滴落到地面不同高度
      var span = fall + 80, y = ((q.y * span + t * sp) % span) - 80;
      var x = L + ((q.x * W + (t * sp + q.y * span) * wind / sp) % W + W) % W;
      var dx = wind / sp * len;
      if (front && o.cat) { var r = o.cat; if (x > r.x - 6 && x < r.x + r.w + 6 && y + len > r.y - 6 && y < r.y + r.h + 6) continue; }
      path.moveTo(x, y); path.lineTo(x + dx, y + len);
    }
    ctx.save(); ctx.filter = 'none'; ctx.lineCap = 'round';
    var a = (front ? p.alpha : p.alpha * .75) * alphaScale;
    ctx.strokeStyle = 'rgba(52,74,92,' + a + ')'; ctx.lineWidth = p.width * (front ? 1 : .8); ctx.stroke(path);
    ctx.strokeStyle = 'rgba(236,244,250,' + (p.hi * alphaScale * (front ? 1 : .7)) + ')'; ctx.lineWidth = p.width * .5; ctx.stroke(path);
    ctx.restore();
  }
  function splashLayer(ctx, ms, kind, o, front, alphaScale) {
    var p = RAIN[kind], c = counts(kind, o.viewWidth), t = ms / 1000, W = o.viewWidth - 40;
    ctx.save(); ctx.filter = 'none'; ctx.lineCap = 'round';
    for (var i = 0; i < c.splashes; i++) {
      var s = splashes[i], y = 600 + s.y * 150;
      if (front !== (y >= 690)) continue;
      var ph = ((t / p.splashPeriod) + s.ph) % 1, x = o.viewLeft + 20 + s.x * W, k = s.sz * (y - 560) / 190;
      var a = (1 - ph) * .75 * alphaScale;
      // 漣漪
      ctx.strokeStyle = 'rgba(60,84,96,' + (a * .55) + ')'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(x, y, (2 + ph * 11) * k, (.7 + ph * 2.6) * k, 0, 0, Math.PI * 2); ctx.stroke();
      // 水花皇冠（只在前 40%）
      if (ph < .4 && kind !== 'drizzle') {
        var h = (1 - ph / .4) * 9 * k, w = 5 * k;
        ctx.strokeStyle = 'rgba(240,248,252,' + (a * 1.1) + ')'; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.moveTo(x - 1, y); ctx.lineTo(x - w, y - h); ctx.moveTo(x, y); ctx.lineTo(x, y - h * 1.2); ctx.moveTo(x + 1, y); ctx.lineTo(x + w, y - h); ctx.stroke();
      }
    }
    ctx.restore();
  }
  /** 樹之前畫：閃電照亮天空、分叉閃電、後層雨與遠處水花。o: {animated, auto, viewLeft, viewWidth, cat} */
  function back(ctx, ms, kind, o) {
    if (!isRain(kind)) return;
    var T = o.animated ? ms : 2345, s = o.animated ? 1 : .8;
    var f = o.animated ? flashAt(ms, kind, o.auto) : null;
    if (f && f.intensity > .01) {
      var b = bolt(f.event.seed), bx = o.viewLeft + b.main[0][0] * o.viewWidth;
      ctx.save(); ctx.beginPath(); ctx.rect(o.viewLeft, 0, o.viewWidth, 575); ctx.clip();
      wash(ctx, bx, 120, 420, 340, '226,236,255', .45 * f.intensity);
      wash(ctx, o.viewLeft + o.viewWidth / 2, 160, o.viewWidth * .7, 260, '226,236,255', .18 * f.intensity);
      drawBolt(ctx, f, o.viewLeft, o.viewWidth);
      ctx.restore();
    }
    var p = RAIN[kind];
    ctx.save(); ctx.fillStyle = 'rgba(70,90,104,' + p.veil + ')'; ctx.fillRect(o.viewLeft, 0, o.viewWidth, 600); ctx.restore();
    streaks(ctx, T, kind, o, false, s);
    if (o.animated) splashLayer(ctx, T, kind, o, false, s);
  }
  /** 樹與貓之後畫：前層雨（避開貓）、近處水花、閃電時全場微亮。 */
  function front(ctx, ms, kind, o) {
    if (!isRain(kind)) return;
    var T = o.animated ? ms : 2345, s = o.animated ? 1 : .8;
    streaks(ctx, T, kind, o, true, s);
    if (o.animated) splashLayer(ctx, T, kind, o, true, s);
    var f = o.animated ? flashAt(ms, kind, o.auto) : null;
    if (f && f.intensity > .01) { ctx.save(); ctx.fillStyle = 'rgba(232,240,255,' + (.12 * f.intensity) + ')'; ctx.fillRect(o.viewLeft, 0, o.viewWidth, 760); ctx.restore(); }
  }

  root.GardenWeatherV18 = { profiles: profiles, layer: layer, cachedKinds: function () { return base.cachedKinds().concat(Object.keys(cache)); } };
  root.GardenRainV18 = {
    isRain: isRain, counts: counts, profiles: RAIN, back: back, front: front,
    update: update, flashAt: flashAt, triggerManual: triggerManual, clearManual: clearManual, cancelPending: cancelPending,
    events: function () { return { lastFlash: lastFlash ? { id: lastFlash.id, t: lastFlash.t, manual: lastFlash.manual } : null, log: log.slice(), pendingManual: manual.length,
      cancelled: cancelled.slice(),
      autoSchedule: { firstMs: AUTO_FIRST, gapMs: AUTO_GAP, jitterMs: AUTO_JITTER } }; },
    label: function (kind) { return RAIN[kind] ? RAIN[kind].label : ''; }
  };

  // ---------- 合成雷聲 ----------
  function ThunderAudio() {
    this.ctx = null; this.master = null; this.noise = null; this.enabled = false; this.error = null; this.active = new Set(); this.played = 0; this.volume = .7;
  }
  ThunderAudio.prototype.state = function () {
    return { enabled: this.enabled, contextState: this.ctx ? this.ctx.state : 'none', active: this.active.size, played: this.played, volume: this.volume, error: this.error,
             synthesized: true };
  };
  /** 一定要在使用者點按鈕的事件裡呼叫。成功的條件是 AudioContext 真的進入 running。 */
  ThunderAudio.prototype.enable = function () {
    var self = this;
    try {
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) throw new Error('這個瀏覽器不支援 Web Audio');
      if (!self.ctx) {
        self.ctx = new AC();
        var comp = self.ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(self.ctx.destination);
        self.master = self.ctx.createGain(); self.master.gain.value = self.volume; self.master.connect(comp);
        // 6 秒褐色雜訊（低頻較多），只建一次
        var len = self.ctx.sampleRate * 6, buf = self.ctx.createBuffer(1, len, self.ctx.sampleRate), d = buf.getChannelData(0), last = 0;
        for (var i = 0; i < len; i++) { var w = Math.random() * 2 - 1; last = (last + .02 * w) / 1.02; d[i] = last * 3.5; }
        self.noise = buf;
      }
      return self.ctx.resume().then(function () {
        if (self.ctx.state !== 'running') throw new Error('AudioContext 仍是 ' + self.ctx.state);
        self.enabled = true; self.error = null; return self.state();
      }).catch(function (e) { self.enabled = false; self.error = e.message || String(e); return self.state(); });
    } catch (e) { self.enabled = false; self.error = e.message || String(e); return Promise.resolve(self.state()); }
  };
  ThunderAudio.prototype.disable = function () {
    this.stopAll(); this.enabled = false;
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
    return this.state();
  };
  ThunderAudio.prototype.setVolume = function (v) { this.volume = Math.max(0, Math.min(1, +v || 0)); if (this.master) this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, .05); };
  /** 立即停止並斷開所有發聲節點、清空 active。不依賴 onended（context 若被 suspend，onended 不會到）。可重複呼叫。 */
  ThunderAudio.prototype.stopAll = function () {
    var set = this.active;
    set.forEach(function (n) { n.cleanup(true); });
    set.clear();
  };
  ThunderAudio.prototype._voice = function (filterType, freq, q) {
    var c = this.ctx, src = c.createBufferSource(); src.buffer = this.noise;
    var f = c.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
    var g = c.createGain(); g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(this.master);
    var node = { src: src, filter: f, gain: g, done: false }, set = this.active;
    // 冪等清理：onended 與 stopAll 都可能呼叫
    node.cleanup = function (stopNow) {
      if (node.done) return;
      node.done = true; set.delete(node);
      if (stopNow) { try { g.gain.cancelScheduledValues(0); g.gain.value = 0; } catch (e) { /* 忽略 */ } try { src.stop(0); } catch (e) { /* 尚未開始或已停止 */ } }
      try { src.disconnect(); } catch (e) { /* 忽略 */ }
      try { f.disconnect(); } catch (e) { /* 忽略 */ }
      try { g.disconnect(); } catch (e) { /* 忽略 */ }
    };
    set.add(node);
    src.onended = function () { node.cleanup(false); };
    return node;
  };
  /** 一聲雷：清脆的雷擊（高通短爆）＋低頻滾動隆隆聲（低通、幾段起伏）。 */
  ThunderAudio.prototype.play = function (strength) {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return false;
    var c = this.ctx, now = c.currentTime + .02, s = Math.max(.4, Math.min(1, strength || 1));
    var crack = this._voice('highpass', 700, .7);
    crack.gain.gain.setValueAtTime(0, now); crack.gain.gain.linearRampToValueAtTime(.9 * s, now + .008);
    crack.gain.gain.exponentialRampToValueAtTime(.001, now + .35);
    crack.src.start(now, Math.random() * 4); crack.src.stop(now + .45);
    var dur = 4.2 + Math.random() * 1.6, rum = this._voice('lowpass', 260, .8);
    rum.filter.frequency.setValueAtTime(260, now); rum.filter.frequency.exponentialRampToValueAtTime(70, now + dur);
    var gg = rum.gain.gain; gg.setValueAtTime(0, now); gg.linearRampToValueAtTime(1.0 * s, now + .12);
    var tt = now + .12;
    for (var k = 0; k < 4; k++) { tt += dur * (.12 + Math.random() * .12); gg.linearRampToValueAtTime((.45 + Math.random() * .5) * s * (1 - k * .18), tt); }
    gg.exponentialRampToValueAtTime(.001, now + dur);
    rum.src.start(now, Math.random() * 1.5); rum.src.stop(now + dur + .1);
    this.played += 1;
    return true;
  };
  root.GardenThunderAudioV18 = ThunderAudio;
})(window);
