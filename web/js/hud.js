// HUD + typography layer (Canvas2D, virtual 1920x1080). Composited in the post pass so it
// shares zoom punches, glitch displacement and RGB split with the image.
(function () {
  const W = 1920, H = 1080;
  const EN = 'Bahnschrift, "Arial Narrow", "Segoe UI", sans-serif';
  const ZH = '"Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif';
  const MONO = 'Consolas, "Courier New", monospace';
  const POOL_EN = '#%&@$*+=<>/\\|01ΔΞΣΨΩ▮▯';
  const POOL_ZH = '毒辐射核疫蚀熔毁病狂邪教眼燃烧腐变异灾';
  const C = { white: '#ffffff', acid: '#e6ff1a', toxic: '#8dff2e', mag: '#ff1f9a', cyan: '#19e6ff', uv: '#7a2cff', orange: '#ff6a10', red: '#ff2340' };
  let T = null; // timeline

  function Hud(canvas) {
    this.c = canvas; this.x = canvas.getContext('2d');
    canvas.width = W; canvas.height = H;
    this.textCanvas = document.createElement('canvas');
    this.textCanvas.width = 1024; this.textCanvas.height = 576;
    this.tx = this.textCanvas.getContext('2d');
    this.textKey = null; this.textDirty = false;
    T = window.TL;
  }

  // ------------------------------------------------------------ helpers
  const H_ = (n) => window.TL.hash(n);
  function font(ctx, px, weight = 700, fam = EN, stretch = 'condensed') {
    ctx.font = `${weight} ${px}px ${fam}`;
    try { ctx.fontStretch = stretch; } catch (e) {}
  }
  function spacing(ctx, px) { try { ctx.letterSpacing = px + 'px'; } catch (e) {} }
  function scramble(str, t, t0, dur, pool, seed, lead = 0.22) {
    let out = '';
    const n = str.length;
    const q = Math.floor(t * 30);
    for (let i = 0; i < n; i++) {
      const ch = str[i];
      if (ch === ' ') { out += ' '; continue; }
      const rt = t0 + dur * (i / Math.max(1, n));
      if (t >= rt) out += ch;
      else if (t >= rt - lead) out += pool[Math.floor(H_(i * 31 + q * 7 + seed) * pool.length)];
      else out += ' ';
    }
    return out;
  }
  function splitText(ctx, s, x, y, off, main, a = 1) {
    ctx.globalAlpha = a;
    if (off > 0.3) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,20,150,.9)'; ctx.fillText(s, x - off, y);
      ctx.fillStyle = 'rgba(20,220,255,.9)'; ctx.fillText(s, x + off, y);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.fillStyle = main; ctx.fillText(s, x, y);
    ctx.globalAlpha = 1;
  }
  function fitFont(ctx, s, px, maxW, weight, fam) {
    font(ctx, px, weight, fam);
    const w = ctx.measureText(s).width;
    if (w > maxW) { px = Math.floor(px * maxW / w); font(ctx, px, weight, fam); }
    return px;
  }
  // draw a string split into horizontal slices with jitter (glitch in/out)
  function slicedText(ctx, s, x, y, px, amt, seed, main) {
    if (amt < 0.02) { splitText(ctx, s, x, y, 2 + amt * 10, main); return; }
    const n = 7, top = y - px * 0.85, h = px * 1.05;
    for (let i = 0; i < n; i++) {
      ctx.save();
      ctx.beginPath(); ctx.rect(-2 * W, top + (h * i) / n, 5 * W, h / n + 1); ctx.clip();
      const dx = (H_(seed + i * 13) - 0.5) * 140 * amt;
      splitText(ctx, s, x + dx, y, 3 + amt * 14, main);
      ctx.restore();
    }
  }

  // ------------------------------------------------------------ scene text layer
  Hud.prototype.setText = function (key) {
    if (key === this.textKey) return;
    this.textKey = key; this.textDirty = true;
    const g = this.tx, w = 1024, h = 576;
    g.clearRect(0, 0, w, h);
    if (!key) return;
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff';
    spacing(g, 0);
    if (key === 'wordmark') {
      font(g, 250, 900); spacing(g, -6);
      g.fillText('TOKSIK', w / 2, h * 0.33);
      g.lineWidth = 6; g.strokeStyle = '#fff'; g.strokeText('TOKSIK', w / 2, h * 0.76);
      spacing(g, 0);
    } else if (key.startsWith('word:')) {
      const s = key.slice(5);
      fitFont(g, s, 320, 980, 900, EN);
      g.fillText(s, w / 2, h * 0.5);
    } else if (key.startsWith('seed:')) {
      const s = key.slice(5);
      fitFont(g, s, 150, 900, 900, EN);
      g.fillText(s, w / 2, h * 0.5);
    }
  };

  // ------------------------------------------------------------ frame chrome
  Hud.prototype.chrome = function (S) {
    const g = this.x, t = S.t;
    const a = S.sec.id === 'intro' ? T.ramp(t, 0.5, 1.0) : S.sec.id === 'end' ? 1 - T.ramp(t, S.sec.t0 + 0.2, S.sec.t0 + 0.8) : 1;
    if (a <= 0) return;
    g.globalAlpha = a * 0.9;
    g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 2;
    const m = 44, L = 46;
    for (const [x, y, sx, sy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]) {
      g.beginPath(); g.moveTo(x, y + sy * L); g.lineTo(x, y); g.lineTo(x + sx * L, y); g.stroke();
    }
    // top-left: transmission clock + beat grid
    font(g, 20, 600, MONO, 'normal'); spacing(g, 2);
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    const blink = Math.floor(t * 2) % 2 === 0;
    g.fillStyle = blink ? C.red : 'rgba(255,40,60,.35)';
    g.beginPath(); g.arc(78, 83, 7, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff';
    const mm = Math.floor(t / 60), ss = (t % 60).toFixed(2).padStart(5, '0');
    g.fillText(`REC  STARSET//TOKSIK  ${String(mm).padStart(2, '0')}:${ss}`, 94, 90);
    const bi = Math.floor(S.beat), bar = Math.floor(S.bar), inBar = ((bi - T.DB) % 4 + 4) % 4;
    g.fillStyle = 'rgba(255,255,255,.7)';
    g.fillText(`${T.A.bpm.toFixed(0)} BPM  BAR ${String(Math.max(0, bar + 1)).padStart(3, '0')}.${inBar + 1}`, 72, 120);
    for (let k = 0; k < 4; k++) {
      const on = k === inBar;
      g.fillStyle = on ? (k === 0 ? C.acid : C.toxic) : 'rgba(255,255,255,.18)';
      const s = on ? 18 + 8 * S.beatPulse : 18;
      g.fillRect(380 + k * 30 - (s - 18) / 2, 104 - (s - 18) / 2, s, s);
    }
    // top-right: radiation meter
    const lvl = T.clamp(0.25 * S.rms + 0.5 * S.energy * S.rms + 0.4 * S.kick);
    const dose = (0.02 + t * t * 0.0004 + lvl * 3).toFixed(2);
    g.textAlign = 'right';
    g.fillStyle = '#fff';
    g.fillText(`☢ RAD ${dose} μSv/h`, W - 72, 90);
    const n = 24;
    for (let k = 0; k < n; k++) {
      const on = k / n < lvl;
      g.fillStyle = on ? (k > n * 0.75 ? C.red : k > n * 0.5 ? C.acid : C.toxic) : 'rgba(255,255,255,.14)';
      g.fillRect(W - 72 - (n - k) * 13, 106, 9, 16);
    }
    // bottom-left: chapter
    const sec = S.sec;
    const ct = t - sec.t0;
    font(g, 20, 600, MONO, 'normal');
    g.textAlign = 'left';
    const label = `[${String(sec.n).padStart(2, '0')}] ${sec.en}`;
    g.fillStyle = 'rgba(255,255,255,.8)';
    g.fillText(scramble(label, t, sec.t0, 0.5, POOL_EN, sec.n * 99), 72, H - 70);
    font(g, 20, 700, ZH, 'normal');
    g.fillStyle = C.toxic;
    g.fillText(scramble(sec.zh, t, sec.t0 + 0.1, 0.4, POOL_ZH, sec.n * 77), 72, H - 100);
    if (ct < 2.2 && sec.id !== 'intro' && sec.id !== 'end') {
      g.globalAlpha = a * (1 - T.ramp(ct, 1.6, 2.2));
      g.fillStyle = C.acid; g.fillRect(72, H - 142, 260 * T.easeOutExpo(ct * 2), 4);
    }
    g.globalAlpha = 1;
    spacing(g, 0);
  };

  // ------------------------------------------------------------ lyrics
  Hud.prototype.lyrics = function (S) {
    const t = S.t;
    const LY = T.LY;
    // active = last line started (with 0.1s lead for decrypt), plus the previous one fading
    let cur = null;
    for (const l of LY) { if (l.ts - 0.12 <= t) cur = l; else break; }
    if (!cur) return;
    if (S.sec.id === 'end' && t > S.sec.t0 + 0.6) return;
    const end = Math.min(cur.next, cur.t + cur.dur + (cur.kind === 'shout' ? 1.3 : 1.6));
    if (t > end + 0.25) return;
    const out = T.ramp(t, end, end + 0.25);
    if (cur.kind === 'shout') return this.shout(S, cur, out);
    if (cur.kind === 'chorus' && !cur.quiet) return this.chorus(S, cur, out);
    if (cur.kind === 'rap') return this.rap(S, cur, out);
    if (cur.kind === 'cult') return this.cult(S, cur, out);
    return this.verse(S, cur, out);
  };

  Hud.prototype.band = function (y0, y1, a) {
    const g = this.x;
    const gr = g.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.35, `rgba(4,0,10,${0.55 * a})`);
    gr.addColorStop(0.7, `rgba(4,0,10,${0.55 * a})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, y0, W, y1 - y0);
  };

  Hud.prototype.verse = function (S, l, out) {
    const g = this.x, t = S.t;
    const a = T.ramp(t, l.ts - 0.12, l.ts + 0.05) * (1 - out);
    const yOff = (1 - T.easeOutCubic(T.ramp(t, l.ts - 0.12, l.ts + 0.2))) * 14;
    this.band(800, 1010, a);
    const en = l.en.toUpperCase();
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    font(g, 64, 700); spacing(g, 3);
    let px = 64;
    if (g.measureText(en).width > 1640) { px = Math.floor(64 * 1640 / g.measureText(en).width); font(g, px, 700); }
    const s = scramble(en, t, l.t, Math.max(0.3, l.dur * 0.85), POOL_EN, l.i * 57);
    const jit = out > 0 ? (H_(l.i + Math.floor(t * 40)) - 0.5) * 60 * out : 0;
    g.globalAlpha = a;
    splitText(g, s, 960 + jit, 912 + yOff, 2 + 5 * S.kick + 10 * out, '#fff', a);
    // key word highlight: redraw key in acid over itself
    if (l.key && t >= l.keyT) {
      const idx = en.indexOf(l.key.toUpperCase());
      if (idx >= 0) {
        const full = g.measureText(en).width;
        const pre = g.measureText(en.slice(0, idx)).width;
        g.textAlign = 'left';
        g.fillStyle = C.acid; g.globalAlpha = a;
        g.fillText(l.key.toUpperCase(), 960 - full / 2 + pre + jit, 912 + yOff);
        g.textAlign = 'center';
      }
    }
    font(g, 42, 700, ZH, 'normal'); spacing(g, 8);
    const z = scramble(l.zh, t, l.t + 0.05, Math.max(0.3, l.dur * 0.8), POOL_ZH, l.i * 91);
    splitText(g, z, 960 - jit, 978 + yOff, 1.5 + 3 * S.kick, C.toxic, a);
    spacing(g, 0);
    g.globalAlpha = 1;
  };

  Hud.prototype.chorus = function (S, l, out) {
    const g = this.x, t = S.t;
    const a = T.ramp(t, l.ts - 0.12, l.ts + 0.05) * (1 - out);
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    this.band(300, 800, a * 0.7);
    // full line, spaced out, decrypting
    font(g, 40, 600); spacing(g, 12);
    const en = l.en.toUpperCase();
    splitText(g, scramble(en, t, l.t, l.dur * 0.8, POOL_EN, l.i * 13), 960, 400, 2 + 4 * S.kick, 'rgba(255,255,255,.92)', a);
    spacing(g, 0);
    // giant key word
    if (t >= l.keyT - 0.02) {
      const kt = t - l.keyT;
      const key = l.key;
      const punch = 1 + 0.45 * Math.exp(-kt / 0.07);
      const px = fitFont(g, key, 200, 1700, 900, EN);
      g.save();
      g.translate(960, 600); g.scale(punch, punch);
      const stut = kt < T.P / 2 ? Math.floor(kt / (T.P / 4)) : 3;
      const col = stut % 2 === 0 && kt < T.P / 2 ? C.mag : C.acid;
      slicedText(g, key, 0, 0, px, Math.max(out, Math.exp(-kt / 0.12) * 0.6), l.i * 7 + stut, col);
      g.restore();
      font(g, 70, 900, ZH, 'normal'); spacing(g, 18);
      splitText(g, scramble(l.zh, t, l.keyT, 0.25, POOL_ZH, l.i * 5), 960, 720, 3 + 6 * S.kick, '#fff', a);
      spacing(g, 0);
    }
    // echo answer
    if (l.echo && t >= l.echoT - 0.02) {
      const et = t - l.echoT;
      const ea = T.ramp(et, 0, 0.05) * (1 - T.ramp(et, 1.1, 1.4)) * (1 - out);
      if (ea > 0) {
        g.save();
        g.translate(1330, 860); g.rotate(-0.07); g.scale(1 + 0.25 * Math.exp(-et / 0.08), 1 + 0.25 * Math.exp(-et / 0.08));
        const ek = `(${l.echo.en.toUpperCase()})`;
        fitFont(g, ek, 96, 1000, 900, EN);
        g.globalAlpha = ea; g.lineWidth = 3; g.strokeStyle = C.cyan; g.strokeText(ek, 0, 0);
        g.globalAlpha = ea * 0.25; g.fillStyle = C.cyan; g.fillText(ek, 0, 0);
        font(g, 40, 700, ZH, 'normal'); spacing(g, 10);
        g.globalAlpha = ea; g.fillStyle = C.mag; g.fillText(`（${l.echo.zh}）`, 0, 60);
        spacing(g, 0);
        g.restore();
        g.globalAlpha = 1;
      }
    }
  };

  Hud.prototype.shout = function (S, l, out) {
    const g = this.x, t = S.t;
    const kt = t - l.ts;
    if (kt < -0.02) return;
    const a = 1 - out;
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    const scales = [1.35, 1.15, 1.05, 1];
    const step = Math.min(3, Math.floor(kt / (T.P / 4)));
    const sc = scales[step] * (1 + 0.1 * S.kick);
    g.save();
    g.translate(960, 620); g.scale(sc, sc);
    font(g, 330, 900); spacing(g, -8);
    slicedText(g, 'TOKSIK', 0, 0, 330, Math.max(out * 1.5, step < 3 ? 0.5 : 0.08 + 0.3 * S.snare), l.i * 17 + step, step % 2 ? C.acid : '#fff');
    spacing(g, 0);
    g.restore();
    font(g, 120, 900, ZH, 'normal'); spacing(g, 40);
    splitText(g, '毒音', 960, 820, 4 + 10 * S.kick, C.toxic, a * T.ramp(kt, 0.1, 0.2));
    font(g, 22, 600, MONO, 'normal'); spacing(g, 10);
    splitText(g, 'TOXIC // TRANSMISSION', 960, 880, 1, 'rgba(255,255,255,.8)', a * T.ramp(kt, 0.2, 0.3));
    spacing(g, 0);
  };

  Hud.prototype.rap = function (S, l, out) {
    const g = this.x, t = S.t;
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    const words = l.words;
    const px = l.en.length > 48 ? 70 : 86;
    font(g, px, 900); spacing(g, 1);
    // layout in centred rows
    const maxW = 1560, gap = px * 0.32;
    const rows = [[]]; let w = 0;
    for (const wd of words) {
      const ww = g.measureText(wd.w.toUpperCase()).width;
      if (w + ww > maxW && rows[rows.length - 1].length) { rows.push([]); w = 0; }
      rows[rows.length - 1].push({ ...wd, ww }); w += ww + gap;
    }
    const lh = px * 1.12;
    const y0 = 560 - (rows.length - 1) * lh / 2;
    this.band(y0 - lh * 1.2, y0 + rows.length * lh + 120, (1 - out) * 0.8);
    rows.forEach((row, r) => {
      const rw = row.reduce((a, b) => a + b.ww, 0) + gap * (row.length - 1);
      let x = 960 - rw / 2;
      for (const wd of row) {
        const wt = t - wd.t;
        if (wt >= -0.01) {
          const k = Math.exp(-wt / 0.06);
          const sc = 1 + 0.6 * k;
          const rot = (H_(l.i * 100 + x) - 0.5) * 0.12;
          const up = wd.w.toUpperCase();
          const isKey = l.key && up.replace(/[^A-Z]/g, '').length > 2 && l.key.toUpperCase().includes(up.replace(/[^A-Z]/g, ''));
          const col = isKey ? C.acid : (H_(l.i * 7 + x) > 0.7 ? C.mag : '#fff');
          g.save();
          g.translate(x + wd.ww / 2, y0 + r * lh); g.rotate(rot * (1 - k * 0.5)); g.scale(sc, sc);
          g.textAlign = 'center';
          if (isKey) { g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(-wd.ww / 2 - 10, -px * 0.8, wd.ww + 20, px * 0.95); }
          splitText(g, up, (H_(Math.floor(t * 40) + x) - 0.5) * 30 * out, 0, 3 + 6 * k + 4 * S.kick, col, 1 - out);
          g.restore();
        }
        x += wd.ww + gap;
      }
    });
    spacing(g, 0);
    g.textAlign = 'center';
    font(g, 46, 800, ZH, 'normal'); spacing(g, 6);
    const zy = y0 + (rows.length - 1) * lh + 110;
    splitText(g, scramble(l.zh, t, l.t, Math.max(0.3, l.dur * 0.7), POOL_ZH, l.i * 3), 960, zy, 2 + 4 * S.kick, C.toxic, (1 - out) * T.ramp(t, l.ts - 0.1, l.ts));
    spacing(g, 0);
  };

  Hud.prototype.cult = function (S, l, out) {
    const g = this.x, t = S.t;
    const a = 1 - out;
    const kt = t - l.ts;
    // background repetition rows
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    font(g, 54, 900); spacing(g, 4);
    for (let r = 0; r < 9; r++) {
      const y = 120 + r * 110;
      const dir = r % 2 ? 1 : -1;
      const off = ((t * 180 * dir) % 900 + 900) % 900;
      g.globalAlpha = a * 0.13 * T.ramp(kt, r * 0.03, r * 0.03 + 0.1);
      g.fillStyle = r % 3 === 0 ? C.mag : '#fff';
      for (let x = -900 + off; x < W; x += 900) g.fillText("YOU'RE IN A CULT • 你深陷邪教 • ", x, y);
    }
    g.globalAlpha = 1;
    spacing(g, 0);
    g.textAlign = 'center';
    const en = l.en.toUpperCase();
    const px = fitFont(g, en, 130, 1700, 900, EN);
    const punch = 1 + 0.4 * Math.exp(-kt / 0.08);
    g.save(); g.translate(960, 600); g.scale(punch, punch);
    slicedText(g, en, 0, 0, px, Math.max(out, 0.5 * Math.exp(-kt / 0.15)), l.i * 3, l.key === 'OH' ? C.mag : C.acid);
    g.restore();
    font(g, 68, 900, ZH, 'normal'); spacing(g, 14);
    splitText(g, l.zh, 960, 730, 3 + 8 * S.kick, '#fff', a * T.ramp(kt, 0.05, 0.12));
    spacing(g, 0);
  };

  // ------------------------------------------------------------ section overlays
  Hud.prototype.overlays = function (S) {
    const g = this.x, t = S.t, id = S.sec.id;
    g.textBaseline = 'alphabetic';
    if (id === 'intro' || (id === 'v1a' && t < 1.9)) this.title(S);
    if (S.scene === 'eye' && id === 'v1b') this.eyeHud(S);
    if (id === 'pre') this.plagueHud(S);
    if (S.scene === 'feed') this.phoneHud(S);
    if (id === 'v2b') this.blastHud(S);
    if (id === 'melt') this.reactorHud(S);
    if (id === 'rap') this.rapHud(S);
    if (id === 'end') this.endCard(S);
  };

  Hud.prototype.title = function (S) {
    const g = this.x, t = S.t;
    const a = T.ramp(t, 0.35, 0.55) * (1 - T.ramp(t, 1.45, 1.75));
    if (a <= 0) return;
    g.textAlign = 'center';
    font(g, 26, 600, MONO, 'normal'); spacing(g, 14);
    splitText(g, scramble('INCOMING TRANSMISSION', t, 0.35, 0.4, POOL_EN, 5), 960, 430, 2, C.toxic, a);
    font(g, 180, 900); spacing(g, -4);
    slicedText(g, 'TOKSIK', 960, 600, 180, 0.3 + 0.5 * (1 - T.ramp(t, 0.5, 0.9)), Math.floor(t * 20), '#fff');
    font(g, 36, 700, ZH, 'normal'); spacing(g, 30);
    splitText(g, 'STARSET · 毒音', 960, 670, 2, C.acid, a);
    spacing(g, 0);
  };

  Hud.prototype.endCard = function (S) {
    const g = this.x, t = S.t - S.sec.t0;
    const a = T.ramp(t, 0.72, 0.85);
    if (a <= 0) return;
    g.textAlign = 'center';
    font(g, 30, 600, MONO, 'normal'); spacing(g, 12);
    splitText(g, scramble('END OF TRANSMISSION', S.t, S.sec.t0 + 0.72, 0.3, POOL_EN, 9), 960, 520, 2, '#fff', a);
    font(g, 34, 700, ZH, 'normal'); spacing(g, 20);
    splitText(g, '传输终止', 960, 580, 2, C.toxic, a);
    spacing(g, 0);
  };

  Hud.prototype.eyeHud = function (S) {
    const g = this.x, t = S.t;
    const a = T.ramp(t, 13.2, 13.6) * (1 - T.ramp(t, 22.0, 22.2));
    if (a > 0) {
      g.globalAlpha = a; g.strokeStyle = C.toxic; g.lineWidth = 2;
      const cx = 960 + S.cue[0] * 0.38 * 0.6 * 540, cy = 540 - S.cue[1] * 0.22 * 0.6 * 540;
      const r = 150 + 10 * S.kick;
      g.beginPath();
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { g.moveTo(cx + sx * r, cy + sy * (r - 30)); g.lineTo(cx + sx * r, cy + sy * r); g.lineTo(cx + sx * (r - 30), cy + sy * r); }
      g.stroke();
      font(g, 20, 600, MONO, 'normal'); spacing(g, 2); g.textAlign = 'left'; g.fillStyle = C.toxic;
      const pct = Math.min(99.9, (t - 13.2) * 9).toFixed(1);
      g.fillText(`SUBJECT: YOU`, cx + r + 16, cy - r + 20);
      g.fillText(`MIND ACCESS ${pct}%`, cx + r + 16, cy - r + 46);
      font(g, 20, 700, ZH, 'normal'); g.fillText('心智入侵中', cx + r + 16, cy - r + 74);
      if (t > 19.7) { g.fillStyle = C.red; font(g, 20, 600, MONO, 'normal'); g.fillText('STATUS: TOXIFIED', cx + r + 16, cy - r + 102); }
      g.globalAlpha = 1; spacing(g, 0);
    }
    if (S.cue2[1] > 0.5) {
      font(g, 22, 600, MONO, 'normal'); spacing(g, 3); g.textAlign = 'right'; g.fillStyle = C.mag;
      const n = Math.min(27, Math.floor(S.cue2[3] * 24));
      g.fillText(`EYES DETECTED: ${String(n).padStart(2, '0')}`, W - 72, 170);
      spacing(g, 0);
    }
  };

  Hud.prototype.plagueHud = function (S) {
    const g = this.x, t = S.t;
    font(g, 22, 600, MONO, 'normal'); spacing(g, 3); g.textAlign = 'right';
    const inf = Math.min(100, 2 + 98 * Math.pow(S.secP, 1.6));
    g.fillStyle = C.toxic; g.fillText(`INFECTION ${inf.toFixed(1)}%`, W - 72, 170);
    font(g, 20, 700, ZH, 'normal'); g.fillText('感染率', W - 72, 200);
    if (t > 26.45 && t < 29.3) {
      const a = T.ramp(t, 26.45, 26.6) * (1 - T.ramp(t, 29.0, 29.3));
      g.globalAlpha = a; g.textAlign = 'center';
      for (const [x, en, zh] of [[0.22, 'YOU', '你'], [0.78, 'ME', '我']]) {
        const cx = x * W, cy = 540;
        g.strokeStyle = C.mag; g.lineWidth = 2;
        g.beginPath(); g.arc(cx, cy, 70 + 30 * (t - 26.45), 0, Math.PI * 2); g.stroke();
        font(g, 44, 900); spacing(g, 6); g.fillStyle = '#fff'; g.fillText(en, cx, cy - 110);
        font(g, 32, 900, ZH, 'normal'); g.fillStyle = C.mag; g.fillText(zh, cx, cy - 150);
      }
      g.globalAlpha = 1;
    }
    spacing(g, 0);
  };

  Hud.prototype.phoneHud = function (S) {
    const g = this.x, t = S.t;
    const s = S.cue2[0];
    if (s < 0.05) return;
    const hw = 0.2075 * 1080 * s, hh = 0.45 * 1080 * s;
    const cx = 960, cy = 540;
    const x0 = cx - hw, y0 = cy - hh, x1 = cx + hw, y1 = cy + hh;
    g.save();
    g.beginPath(); g.rect(x0, y0, hw * 2, hh * 2); g.clip();
    // top bar
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x0, y0, hw * 2, 64 * s);
    font(g, 22 * s, 700, EN, 'normal'); spacing(g, 3); g.textAlign = 'center'; g.fillStyle = '#fff';
    g.fillText('FEED  ☢  LIVE', cx, y0 + 42 * s);
    // right rail
    const rx = x1 - 46 * s;
    const likes = Math.floor(66600 * Math.exp((t - S.sec.t0) * 0.35));
    const fmt = (n) => (n > 1e6 ? (n / 1e6).toFixed(1) + 'M' : n > 1e3 ? (n / 1e3).toFixed(1) + 'K' : '' + n);
    const heartPulse = 1 + 0.35 * S.snare;
    g.fillStyle = C.mag;
    g.save(); g.translate(rx, cy + 20 * s); g.scale(heartPulse * s, heartPulse * s);
    g.beginPath(); g.moveTo(0, 14); g.bezierCurveTo(-30, -8, -14, -30, 0, -14); g.bezierCurveTo(14, -30, 30, -8, 0, 14); g.fill();
    g.restore();
    font(g, 20 * s, 700, EN, 'normal'); g.fillStyle = '#fff';
    g.fillText(fmt(likes), rx, cy + 62 * s);
    g.strokeStyle = '#fff'; g.lineWidth = 3 * s;
    g.beginPath(); g.ellipse(rx, cy + 110 * s, 20 * s, 16 * s, 0, 0, Math.PI * 2); g.stroke();
    g.fillText(fmt(Math.floor(likes / 37)), rx, cy + 152 * s);
    g.beginPath(); g.moveTo(rx - 16 * s, cy + 205 * s); g.lineTo(rx + 18 * s, cy + 190 * s); g.lineTo(rx - 4 * s, cy + 176 * s); g.stroke();
    g.fillText('SHARE', rx, cy + 236 * s);
    // floating hearts on snares
    for (let k = 0; k < 6; k++) {
      const bt = Math.floor(S.beat) - k;
      const age = S.beat - bt;
      const hx = rx - 10 * s - age * 40 * s * (T.hash(bt) - 0.3), hy = cy - age * 120 * s;
      g.globalAlpha = Math.max(0, 1 - age / 6);
      g.fillStyle = [C.mag, C.acid, C.cyan][bt % 3 < 0 ? 0 : bt % 3];
      g.save(); g.translate(hx, hy); g.scale(0.6 * s, 0.6 * s);
      g.beginPath(); g.moveTo(0, 14); g.bezierCurveTo(-30, -8, -14, -30, 0, -14); g.bezierCurveTo(14, -30, 30, -8, 0, 14); g.fill();
      g.restore();
    }
    g.globalAlpha = 1;
    // caption
    g.textAlign = 'left';
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x0, y1 - 150 * s, hw * 2, 150 * s);
    font(g, 26 * s, 800, EN, 'normal'); g.fillStyle = '#fff';
    g.fillText('@patient_zero', x0 + 22 * s, y1 - 110 * s);
    font(g, 21 * s, 700, ZH, 'normal'); g.fillStyle = C.acid;
    g.fillText('#放射性 #熔毁 #毒音 #radioactive', x0 + 22 * s, y1 - 76 * s);
    font(g, 20 * s, 600, MONO, 'normal'); g.fillStyle = 'rgba(255,255,255,.85)';
    const tick = '♫ STARSET — TokSik · original sound · ';
    const off = (t * 60) % 400;
    g.fillText(tick + tick, x0 + 22 * s - off * s, y1 - 40 * s);
    // progress bar per post (one post per beat)
    g.fillStyle = C.toxic; g.fillRect(x0, y1 - 6 * s, hw * 2 * (S.beat % 1), 6 * s);
    g.restore();
    spacing(g, 0);
  };

  Hud.prototype.blastHud = function (S) {
    const g = this.x, t = S.t;
    g.textAlign = 'center';
    if (t < 81.45) {
      font(g, 26, 600, MONO, 'normal'); spacing(g, 10);
      splitText(g, scramble('EARTH ▸ IDIOCRACY  //  CHANNEL OPEN', t, 80.3, 0.5, POOL_EN, 3), 960, 180, 2, C.cyan, 1);
      spacing(g, 0);
      return;
    }
    const cx = 960, cy = 470;
    if (t > 82.9 && t < 88.74) {
      const a = T.ramp(t, 82.9, 83.1);
      g.globalAlpha = a; g.strokeStyle = C.red; g.lineWidth = 2;
      const pulse = 1 + 0.05 * S.kick;
      for (let k = 1; k <= 4; k++) { g.setLineDash(k % 2 ? [] : [10, 10]); g.beginPath(); g.arc(cx, cy, k * 110 * pulse, 0, Math.PI * 2); g.stroke(); }
      g.setLineDash([]);
      g.beginPath(); g.moveTo(cx - 520, cy); g.lineTo(cx + 520, cy); g.moveTo(cx, cy - 480); g.lineTo(cx, cy + 480); g.stroke();
      font(g, 22, 600, MONO, 'normal'); spacing(g, 3); g.fillStyle = C.red; g.textAlign = 'left';
      g.fillText('GROUND ZERO', cx + 14, cy - 14);
      g.fillText(`BLAST RADIUS ${(3.7 + (t - 82.9) * 1.9).toFixed(1)} KM`, cx + 450 * 0.5, cy - 230);
      g.fillStyle = '#fff'; g.fillText('▸ YOU ARE HERE', cx - 330, cy + 150);
      font(g, 22, 700, ZH, 'normal'); g.fillText('你就在这里', cx - 330, cy + 180);
      g.globalAlpha = 1;
    }
    if (t > 85.6 && t < 87.05) {
      g.textAlign = 'right'; font(g, 22, 600, MONO, 'normal'); spacing(g, 3);
      g.fillStyle = Math.floor(t * 6) % 2 ? C.red : '#fff';
      g.fillText('SIGNAL: NO RESPONSE', W - 72, 170);
      for (let k = 0; k < 5; k++) { g.strokeStyle = '#fff'; g.strokeRect(W - 200 + k * 26, 230 - k * 12, 16, 16 + k * 12); }
    }
    if (t > 87.0 && t < 88.74) {
      g.textAlign = 'right'; font(g, 64, 900); spacing(g, 4); g.fillStyle = C.acid;
      g.fillText('×' + S.post.tile, W - 80, 240);
    }
    if (t > 88.4) {
      const p = T.clamp((t - 88.4) / (T.barT(63) - 88.4));
      g.textAlign = 'center'; font(g, 24, 600, MONO, 'normal'); spacing(g, 6);
      g.fillStyle = '#fff'; g.fillText('HYPO', 760, 250);
      g.strokeStyle = C.red; g.lineWidth = 4; g.beginPath(); g.moveTo(715, 243); g.lineTo(805, 243); g.stroke();
      g.fillText('CRITICAL MASS  ' + (90 + p * 10).toFixed(1) + '%', 1010, 250);
      g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(660, 270, 600, 22);
      g.fillStyle = p > 0.9 ? C.red : C.acid; g.fillRect(663, 273, 594 * (0.9 + p * 0.1), 16);
    }
    spacing(g, 0);
  };

  Hud.prototype.reactorHud = function (S) {
    const g = this.x, t = S.t;
    const endT = S.sec.t1;
    const left = Math.max(0, endT - t);
    g.textAlign = 'center';
    const a = T.ramp(t, S.sec.t0 + 0.8, S.sec.t0 + 1.4);
    g.globalAlpha = a;
    g.strokeStyle = S.cue[3] > 0.2 && Math.floor(t * 8) % 2 ? C.red : C.acid; g.lineWidth = 3;
    g.strokeRect(610, 160, 700, 150);
    font(g, 24, 600, MONO, 'normal'); spacing(g, 8); g.fillStyle = '#fff';
    g.fillText('⚠ CORE TEMPERATURE CRITICAL', 960, 205);
    font(g, 24, 700, ZH, 'normal'); g.fillStyle = C.acid; g.fillText('堆芯温度临界 · 熔毁倒计时', 960, 240);
    font(g, 44, 700, MONO, 'normal'); spacing(g, 6); g.fillStyle = left < 3 ? C.red : '#fff';
    g.fillText(`T-${left.toFixed(2).padStart(5, '0')}`, 960, 292);
    g.globalAlpha = 1; spacing(g, 0);
    // geiger ticks on hats
    const n = 40;
    for (let k = 0; k < n; k++) {
      const v = T.hitEnv('hat', t - k * 0.02, 0.03, 0.3);
      g.fillStyle = `rgba(141,255,46,${0.15 + 0.85 * v})`;
      g.fillRect(760 + k * 10, 340, 6, 4 + 30 * v);
    }
  };

  Hud.prototype.rapHud = function (S) {
    const g = this.x, t = S.t;
    const l = S.line;
    if (!l) return;
    const lt = t - l.t, ld = l.next - l.t;
    const p = T.clamp(lt / ld);
    g.lineCap = 'round';
    if (l.key === 'DUNNING–KRUGER') {
      const x0 = 120, y0 = 820, w = 520, h = 420;
      g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x0, y0 - h); g.lineTo(x0, y0); g.lineTo(x0 + w, y0); g.stroke();
      const f = (x) => { const a = Math.exp(-Math.pow((x - 0.12) / 0.07, 2)) * 0.95; const b = 0.1 + 0.75 * Math.pow(Math.max(0, x - 0.3) / 0.7, 1.4); return Math.max(a, b * T.smooth((x - 0.22) / 0.2)) ; };
      g.strokeStyle = C.toxic; g.lineWidth = 5; g.beginPath();
      const N = 80, lim = Math.floor(N * T.easeOutCubic(p * 1.5));
      let lx = x0, ly = y0;
      for (let k = 0; k <= lim; k++) { const x = k / N; lx = x0 + x * w; ly = y0 - f(x) * h; k ? g.lineTo(lx, ly) : g.moveTo(lx, ly); }
      g.stroke();
      g.fillStyle = C.mag; g.beginPath(); g.arc(lx, ly, 10 + 5 * S.kick, 0, Math.PI * 2); g.fill();
      font(g, 20, 600, MONO, 'normal'); spacing(g, 2); g.textAlign = 'left'; g.fillStyle = '#fff';
      g.fillText('MOUNT STUPID', x0 + 0.12 * w - 30, y0 - 0.95 * h - 20);
      g.fillText('VALLEY OF DESPAIR', x0 + 0.28 * w, y0 - 0.08 * h + 40);
      font(g, 20, 700, ZH, 'normal'); g.fillStyle = C.acid;
      g.fillText('愚昧之巅', x0 + 0.12 * w - 30, y0 - 0.95 * h - 48);
      g.fillText('绝望之谷', x0 + 0.28 * w, y0 - 0.08 * h + 68);
      font(g, 18, 600, MONO, 'normal'); g.fillStyle = 'rgba(255,255,255,.7)';
      g.fillText('CONFIDENCE', x0 + 10, y0 - h - 12); g.fillText('COMPETENCE ▸', x0 + w - 150, y0 + 30);
    } else if (l.key === 'PRODUCT') {
      const x0 = 1380, y0 = 660;
      g.fillStyle = '#fff'; g.fillRect(x0 - 20, y0 - 20, 460, 330); g.save(); g.globalAlpha = 1;
      let x = x0;
      for (let k = 0; x < x0 + 420; k++) { const bw = 2 + Math.floor(T.hash(k + 70) * 4) * 2; if (k % 2 === 0) { g.fillStyle = '#000'; g.fillRect(x, y0, bw, 210 * T.easeOutCubic(p * 4)); } x += bw; }
      font(g, 26, 600, MONO, 'normal'); spacing(g, 6); g.fillStyle = '#000'; g.textAlign = 'left';
      g.fillText('YOU  #7-170-0000', x0, y0 + 250);
      font(g, 22, 700, ZH, 'normal'); g.fillText('商品：你   售价：$0.00', x0, y0 + 285);
      if (lt > ld * 0.55) {
        g.save(); g.translate(x0 + 210, y0 + 130); g.rotate(-0.2);
        const sc = 1 + 0.5 * Math.exp(-(lt - ld * 0.55) / 0.07); g.scale(sc, sc);
        g.strokeStyle = C.red; g.lineWidth = 6; g.strokeRect(-200, -55, 400, 110);
        font(g, 44, 900); spacing(g, 4); g.fillStyle = C.red; g.textAlign = 'center';
        g.fillText('BUYER BEWARE', 0, 8); font(g, 26, 900, ZH, 'normal'); g.fillText('买 者 自 负', 0, 42);
        g.restore();
      }
      g.restore();
    } else if (l.key === 'HANDS OVER EYES') {
      const cy = 300;
      for (const cx of [760, 1160]) {
        g.fillStyle = '#fff'; g.beginPath(); g.ellipse(cx, cy, 130, 60, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = C.uv; g.beginPath(); g.arc(cx, cy, 48, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#000'; g.beginPath(); g.arc(cx, cy, 20, 0, Math.PI * 2); g.fill();
      }
      const k = T.easeOutExpo(lt * 6);
      g.fillStyle = '#000'; g.fillRect(560 - (1 - k) * 800, cy - 80, 800, 160);
      font(g, 40, 900); spacing(g, 16); g.fillStyle = '#fff'; g.textAlign = 'center';
      g.fillText('CENSORED · 已屏蔽', 960 - (1 - k) * 800, cy + 14);
    } else if (l.key === 'AT BAY') {
      for (const [ang, oy] of [[-0.18, 250], [0.14, 830]]) {
        g.save(); g.translate(960, oy); g.rotate(ang);
        const k = T.easeOutExpo(lt * 5);
        g.fillStyle = '#ffd400'; g.fillRect(-1200, -40, 2400 * k, 80);
        g.fillStyle = '#000';
        for (let x = -1200; x < -1200 + 2400 * k; x += 80) { g.beginPath(); g.moveTo(x, 40); g.lineTo(x + 40, -40); g.lineTo(x + 70, -40); g.lineTo(x + 30, 40); g.fill(); }
        g.fillStyle = '#ffd400'; g.fillRect(-300, -30, 600, 60);
        font(g, 34, 900); spacing(g, 8); g.fillStyle = '#000'; g.textAlign = 'center'; g.fillText('KEEP OUT ☢ 禁止靠近', 0, 12);
        g.restore();
      }
    } else if (l.key === 'RELIGION' || l.key === 'QUESTION' || l.key === '?' || l.key === '…') {
      // the sigil assembles over four lines
      const a0 = T.LY.find((x) => x.key === 'RELIGION').t;
      const cultT = T.LY.find((x) => x.kind === 'cult').t;
      const q = T.clamp((t - a0) / (cultT - a0));
      g.save(); g.translate(960, 330); g.strokeStyle = C.acid; g.lineWidth = 4; g.globalAlpha = 0.85;
      const r = 190;
      const pts = [0, 1, 2].map((k) => [Math.cos(-Math.PI / 2 + k * 2 * Math.PI / 3) * r, Math.sin(-Math.PI / 2 + k * 2 * Math.PI / 3) * r]);
      const seg = q * 3;
      g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
      for (let k = 0; k < 3; k++) {
        const f = T.clamp(seg - k);
        if (f <= 0) break;
        const a = pts[k], b = pts[(k + 1) % 3];
        g.lineTo(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f);
      }
      g.stroke();
      g.beginPath(); g.arc(0, 0, r * 0.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * T.clamp(q * 1.5 - 0.2)); g.stroke();
      g.restore(); g.globalAlpha = 1;
      if (l.key === 'QUESTION') {
        font(g, 40, 900); spacing(g, 14); g.textAlign = 'center'; g.fillStyle = '#fff';
        g.fillText('QUESTION · 质疑', 960, 170);
        const k = T.easeOutExpo((lt - ld * 0.4) * 4);
        if (k > 0) { g.strokeStyle = C.red; g.lineWidth = 8; g.beginPath(); g.moveTo(760, 158); g.lineTo(760 + 400 * k, 158); g.stroke(); }
      }
      if (l.key === '…') {
        font(g, 22, 600, MONO, 'normal'); spacing(g, 6); g.textAlign = 'center'; g.fillStyle = '#fff';
        g.fillText('RECALLING MEMORY · 记忆读取中', 960, 170);
        g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(710, 190, 500, 18);
        g.fillStyle = C.acid; g.fillRect(713, 193, 494 * Math.min(0.99, p * 1.4), 12);
      }
    }
    spacing(g, 0);
    g.lineCap = 'butt';
  };

  // ------------------------------------------------------------ main draw
  Hud.prototype.draw = function (S) {
    const g = this.x;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, H);
    this.setText(S.text);
    this.overlays(S);
    this.lyrics(S);
    this.chrome(S);
  };

  window.Hud = Hud;
})();
