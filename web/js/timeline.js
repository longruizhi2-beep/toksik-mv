// Timeline + director: turns song time into every visual parameter. Pure function of time
// (plus the previous frame time, used only to detect grid events for the simulation).
(function () {
  const A = window.TOKSIK_AUDIO;
  if (!A) return; // web/data.js missing: run analysis/analyze.py
  const dec = (s) => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
  const ENV = {}; for (const k in A.env) ENV[k] = dec(A.env[k]);
  const GRID = {}; for (const k of ['kick', 'snare', 'hat', 'acc']) GRID[k] = dec(A.grid16[k]);
  const SPEC = dec(A.spec.data), WAVE = dec(A.wave.data);
  const P = A.period, PH = A.phase, DB = A.downbeat, FPS = A.fps, NF = A.frames, DUR = A.duration;
  const P16 = P / 4;

  // ---------------------------------------------------------------- math helpers
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, x) => a + (b - a) * x;
  const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
  const easeOutExpo = (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp(x)));
  const easeOutCubic = (x) => 1 - Math.pow(1 - clamp(x), 3);
  const easeOutBack = (x) => { x = clamp(x); const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  const hash = (n) => { let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
  const win = (t, a, b) => t >= a && t < b;
  const ramp = (t, a, b) => clamp((t - a) / (b - a));
  const decay = (t, t0, tau) => (t < t0 ? 0 : Math.exp(-(t - t0) / tau));

  // ---------------------------------------------------------------- grid
  const beatF = (t) => (t - PH) / P;
  const beatT = (b) => PH + b * P;
  const barT = (k) => PH + (DB + 4 * k) * P;
  const barF = (t) => (beatF(t) - DB) / 4;
  const snap16 = (t) => PH + Math.round((t - PH) / P16) * P16;
  const snapBeat = (t) => PH + Math.round((t - PH) / P) * P;

  function envAt(name, t) {
    const f = t * FPS;
    const i = Math.max(0, Math.min(NF - 2, Math.floor(f)));
    const a = ENV[name][i], b = ENV[name][i + 1];
    return (a + (b - a) * clamp(f - i)) / 255;
  }
  // decaying envelope from grid-quantised hits
  function hitEnv(name, t, tau, thr) {
    const g = (t - PH) / P16;
    const gi = Math.floor(g + 1e-6);
    let e = 0;
    for (let k = 0; k < 10; k++) {
      const i = gi - k;
      if (i < 0) break;
      const s = GRID[name][i] / 255;
      if (s < thr) continue;
      const dt = t - (PH + i * P16);
      e = Math.max(e, ((s - thr) / (1 - thr)) * Math.exp(-dt / tau));
    }
    return clamp(e * 1.4);
  }
  function hitsBetween(name, t0, t1, thr) {
    const out = [];
    const a = Math.floor((t0 - PH) / P16) + 1, b = Math.floor((t1 - PH) / P16);
    for (let i = Math.max(0, a); i <= b; i++) if (GRID[name][i] / 255 >= thr) out.push({ i, s: GRID[name][i] / 255, t: PH + i * P16 });
    return out;
  }
  function frameIndex(t) { return Math.max(0, Math.min(NF - 1, Math.round(t * FPS))); }

  // ---------------------------------------------------------------- lyrics prep
  const LY = window.TOKSIK_LYRICS.map((l, i, arr) => ({ ...l, i, next: i + 1 < arr.length ? arr[i + 1].t : DUR }));
  const syll = (w) => {
    w = w.toLowerCase().replace(/[^a-z]/g, '');
    if (!w) return 1;
    const m = w.match(/[aeiouy]+/g);
    let n = m ? m.length : 1;
    if (w.length > 3 && w.endsWith('e') && !w.endsWith('le') && n > 1) n--;
    return Math.max(1, n);
  };
  for (const l of LY) {
    l.ts = snap16(l.t);
    const words = l.en.split(/\s+/);
    const sy = words.map(syll);
    const tot = sy.reduce((a, b) => a + b, 0);
    const rate = l.kind === 'rap' ? 0.13 : l.kind === 'chorus' ? 0.2 : 0.19;
    l.dur = Math.max(0.35, Math.min(l.next - l.t - 0.08, tot * rate + 0.15));
    let acc = 0;
    l.words = words.map((w, k) => { const wt = l.t + (l.dur * acc) / tot; acc += sy[k]; return { w, t: snap16(wt) }; });
    if (l.echo) l.echoT = snapBeat(l.t + 1.45);
    if (l.key) {
      const first = l.key.split(/\s+/)[0].toUpperCase();
      const w = l.words.find((x) => x.w.toUpperCase().replace(/[^A-Z'’!?…–]/g, '').includes(first.replace(/[^A-Z'’!?…–]/g, '')));
      l.keyT = w ? w.t : l.ts;
    }
    l.cut = snapBeat(l.t); // visual variant switches land on the nearest beat
  }
  const lineAt = (t, kind) => { let r = null; for (const l of LY) { if (l.t - 0.05 <= t) { if (!kind || l.kind === kind) r = l; } else break; } return r; };
  const lineCutAt = (t) => { let r = null; for (const l of LY) { if (l.cut <= t) r = l; else break; } return r; };

  // ---------------------------------------------------------------- sections
  const SEC = [
    { id: 'intro', t0: 0, t1: barT(0), scene: 'sky', zh: '接收信号', en: 'INCOMING TRANSMISSION' },
    { id: 'v1a', b: [0, 8], scene: 'sky', zh: '燃烧的天空', en: 'THE SKY IS BURNING' },
    { id: 'v1b', b: [8, 16], scene: 'eye', zh: '心智猎取', en: 'THEY COME FOR YOUR MIND' },
    { id: 'pre', b: [16, 24], scene: 'plague', zh: '感染扩散', en: 'SPREADING' },
    { id: 'ch1', b: [24, 39], scene: 'tunnel', zh: '放射性', en: 'RADIOACTIVE' },
    { id: 'tok1', b: [39, 48], scene: 'feed', zh: '毒音', en: 'TOKSIK' },
    { id: 'v2a', b: [48, 56], scene: 'parade', zh: '愚人游行', en: 'FOOLS ON PARADE' },
    { id: 'v2b', b: [56, 63], scene: 'blast', zh: '爆炸半径', en: 'ZONE OF THE BLAST' },
    { id: 'ch2', b: [63, 79], scene: 'tunnel', zh: '放射性', en: 'RADIOACTIVE' },
    { id: 'tok2', b: [79, 88], scene: 'feed', zh: '毒音', en: 'TOKSIK' },
    { id: 'melt', b: [88, 96], scene: 'reactor', zh: '堆芯熔毁', en: 'MELTDOWN' },
    { id: 'rap', b: [96, 114], scene: 'propaganda', zh: '洗脑宣传', en: 'PROPAGANDA' },
    { id: 'cult', b: [114, 130], scene: 'cult', zh: '邪教', en: "YOU'RE IN A CULT" },
    { id: 'quiet', b: [130, 138], scene: 'plague', zh: '无形瘟疫', en: "A PLAGUE YOU CAN'T SEE" },
    { id: 'ch3', b: [138, 153], scene: 'tunnel', zh: '临界', en: 'CRITICAL' },
    { id: 'out', b: [153, 162], scene: 'feed', zh: '毒音', en: 'TOKSIK' },
    { id: 'end', t0: barT(162), t1: DUR + 1, scene: 'feed', zh: '传输终止', en: 'END OF TRANSMISSION' },
  ];
  SEC.forEach((s, i) => { if (s.b) { s.t0 = barT(s.b[0]); s.t1 = barT(s.b[1]); } s.n = i; });
  const secAt = (t) => { for (const s of SEC) if (t < s.t1) return s; return SEC[SEC.length - 1]; };

  // impacts: big accents that get flashes / shock
  const IMPACTS = [
    { t: barT(24), s: 1 }, { t: barT(63), s: 1 }, { t: barT(114), s: 1 }, { t: beatT(491), s: 1.3 },
    { t: barT(138), s: 1 }, { t: barT(96), s: .8 }, { t: barT(8), s: .6 }, { t: barT(16), s: .6 }, { t: barT(48), s: .6 },
    { t: 81.452, s: 1.2 },
  ];
  for (const l of LY) if (l.kind === 'shout') IMPACTS.push({ t: l.ts, s: 1 });
  IMPACTS.sort((a, b) => a.t - b.t);
  const impactEnv = (t, tau = 0.25) => { let e = 0; for (const im of IMPACTS) { if (im.t > t) break; e = Math.max(e, im.s * decay(t, im.t, tau)); } return e; };
  // glitch bursts: section starts and lyric-line cuts
  const BURSTS = [];
  for (const s of SEC) BURSTS.push({ t: s.t0, s: 1 });
  for (const l of LY) BURSTS.push({ t: l.cut, s: l.kind === 'verse' ? .35 : .6 });
  BURSTS.sort((a, b) => a.t - b.t);
  const burstEnv = (t) => { let e = 0; for (const b of BURSTS) { if (b.t - 0.04 > t) break; e = Math.max(e, b.s * decay(t, b.t - 0.04, 0.16)); } return e; };

  // ---------------------------------------------------------------- per-frame state
  function baseState(t) {
    const bF = beatF(t);
    return {
      t, beat: bF, bar: barF(t), beatPulse: Math.exp(-(bF - Math.floor(bF)) * 5),
      barPulse: Math.exp(-(barF(t) - Math.floor(barF(t))) * 4 * 2.2),
      kick: hitEnv('kick', t, 0.12, 0.3), snare: hitEnv('snare', t, 0.1, 0.34), hat: hitEnv('hat', t, 0.05, 0.3), acc: hitEnv('acc', t, 0.1, 0.3),
      low: envAt('low', t), mid: envAt('mid', t), high: envAt('high', t), rms: envAt('rms', t), flux: envAt('flux', t),
      cue: [0, 0, 0, 0], cue2: [0, 0, 0, 0], cue3: [0, 0, 0, 0], variant: 0, cut: 0, energy: 0.6,
      fb: { amt: 0.0, zoom: 0.0, rot: 0, shift: [0, 0], mosh: 0, moshProb: 0, drip: 0 },
      post: { glitch: 0, chroma: 1, invert: 0, flash: 0, grain: 0.05, scan: 0.12, vig: 0.55, hue: 0, sat: 1.08, poster: 0, pixel: 0,
        tile: 1, kaleido: 0, off: 0, zoom: 0, bloom: 0.85, stat: 0, exposure: 1, hudZoom: 0, tear: 0, flip: 0, shake: [0, 0], tint: [1, 1, 1] },
      sim: null, text: null, scene: 'sky',
    };
  }

  const rollSnap = (t, perBar = Math.PI / 3) => { const b = barF(t); const k = Math.floor(b); return (k + easeOutBack((b - k) * 2.2)) * perBar; };
  const beatStep = (t, x = 4) => { const b = beatF(t); const k = Math.floor(b); return k + easeOutExpo((b - k) * x); };

  function tunnelCues(S, t, sec, line, palette) {
    const st = sec.t0;
    const bs = beatF(t) - beatF(st);
    const k = Math.floor(bs);
    S.cue2[1] = 2 * (k + easeOutCubic((bs - k) * 1.6)) + 8 * sec.n;
    S.cue2[0] = rollSnap(t) * (sec.id === 'ch2' ? -1 : 1);
    S.cue[1] = palette + Math.floor(barF(t)) * 0.07;
    S.cue2[2] = S.kick * 0.8;
    const key = line ? line.key : 'RADIOACTIVE';
    const since = line ? t - line.cut : 99;
    S.fb.amt = 0.45; S.fb.zoom = 0.02;
    switch (key) {
      case 'CRAZY':
        S.post.hue = Math.floor(beatF(t)) * (Math.PI / 3); S.cue[3] = 0.25; break;
      case 'OVER REACTIVE':
        S.post.invert = S.snare > 0.45 ? 1 : 0; S.post.flash += S.snare * 0.25; S.cue2[2] = 1; break;
      case 'PLAGUE':
        S.fb.mosh = 1; S.fb.moshProb = 0.12 + 0.25 * S.kick; S.post.tint = [0.75, 1.15, 0.7]; S.post.hue = -0.25; break;
      case 'MELTDOWN':
        S.cue[2] = 0.35 + 0.4 * smooth(since / 2); S.cue2[3] = smooth(since / 0.8); S.fb.drip = 1; S.fb.amt = 0.7; break;
      case 'TURNING':
        S.cue[0] = 1.2 * smooth(since / 1.2); S.cue2[0] += since * 1.1; break;
      case 'NARCISSISTIC':
        S.post.kaleido = 6; S.post.flip = Math.floor(beatF(t)) % 2; break;
      case 'SICK':
        S.cue[3] = 1; S.post.sat = 0.75; S.post.tint = [0.85, 1.2, 0.6]; S.post.chroma = 3; S.fb.amt = 0.75; S.fb.rot = 0.02; break;
      default: break;
    }
  }

  function direct(t, prevT) {
    const S = baseState(t);
    const sec = secAt(t);
    S.sec = sec;
    S.secT = t - sec.t0;
    S.secP = clamp((t - sec.t0) / (sec.t1 - sec.t0));
    S.scene = sec.scene;
    S.variant = 0;
    S.cut = Math.floor(barF(t));
    const line = lineCutAt(t);
    S.line = line;
    const dt = Math.max(0, t - (prevT == null ? t - 1 / 60 : prevT));
    // defaults driven by the beat
    let energy = 0.7;
    const post = S.post;

    switch (sec.id) {
      case 'intro': {
        S.cue[2] = 0; S.cue[3] = 0.2;
        post.off = 1 - easeOutCubic(ramp(t, 0.1, 0.75));
        post.stat = 1 - smooth(ramp(t, 0.3, 1.1));
        post.tear = 1; energy = 0.3;
        break;
      }
      case 'v1a': {
        S.cue[2] = rollSnap(t);
        S.cue[3] = 0.2 + 0.8 * smooth(ramp(t, 4.5, 6.0));
        S.cue2[0] = win(t, 7.1, 9.7) ? 0.7 * (1 - ramp(t, 7.1, 9.7)) : 0;
        S.cue[0] = decay(t, 10.85, 0.9);
        S.cue[1] = smooth(ramp(t, barT(7), barT(8)));
        S.fb.amt = 0.55; S.fb.zoom = 0.004;
        post.flash += 0.35 * decay(t, 10.85, 0.3);
        energy = 0.35 + 0.4 * S.cue[1];
        break;
      }
      case 'v1b': {
        const bF = beatF(t), b = Math.floor(bF), f = bF - b;
        const sac = (n) => [hash(n * 7 + 1) * 2 - 1, hash(n * 13 + 5) * 2 - 1];
        const a0 = sac(b - 1), a1 = sac(b), k = easeOutExpo(f * 7);
        S.cue[0] = lerp(a0[0], a1[0], k) * 0.8; S.cue[1] = lerp(a0[1], a1[1], k) * 0.7;
        let open = easeOutBack(ramp(t, 12.9, 13.5));
        const bl = (barF(t) % 2) - 1.8; // blink at the end of every other bar
        if (bl > 0 && bl < 0.12) open *= Math.abs(bl - 0.06) / 0.06;
        S.cue[2] = open;
        S.cue[3] = 0.2 + 0.5 * S.kick + 0.5 * decay(t, 14.4, 0.6);
        S.cue2[0] = smooth(ramp(t, 15.7, 17.4)) * (1 - smooth(ramp(t, 18.4, 19.0)));
        S.cue2[2] = smooth(ramp(t, 19.7, 21.0));
        const hillsT = snapBeat(22.152);
        S.cue2[1] = t >= hillsT ? 1 : 0;
        S.cue2[3] = t - hillsT;
        S.cue3[0] = 0.2 * S.secP;
        S.fb.amt = 0.4; S.fb.zoom = 0.006 + 0.02 * S.cue2[0]; S.fb.rot = 0.03 * S.cue2[0];
        energy = 0.7;
        break;
      }
      case 'pre':
      case 'quiet': {
        const quiet = sec.id === 'quiet';
        S.cue[0] = Math.floor(barF(t)) * 0.11 + (quiet ? 0.45 : 0);
        S.cue[3] = 1;
        const stop = !quiet && t >= barT(23);
        const sim = { F: 0.0545, k: 0.062, iters: 30, seeds: [], reset: false, textSeed: 0, drift: 0.15 };
        if (prevT != null && prevT < sec.t0 && t >= sec.t0) sim.reset = true;
        if (quiet) {
          sim.F = 0.0545; sim.k = 0.062; sim.iters = t > barT(137) ? 44 : 26;
          S.cue[1] = 0.4 * (1 - smooth(ramp(t, barT(136), barT(138))));
        } else {
          if (t > 29.2) { sim.iters = 40; }
          if (t > 32.2) { sim.iters = 44; }
        }
        const hits = prevT != null ? hitsBetween('kick', prevT, t, 0.45) : [];
        for (const h of hits.slice(0, 4)) sim.seeds.push([0.1 + 0.8 * hash(h.i * 3), 0.1 + 0.8 * hash(h.i * 5 + 1), 0.025 + 0.03 * h.s, 0.9]);
        if (!quiet && win(t, 26.4, 26.9)) { sim.seeds.push([0.22, 0.5, 0.05, 1]); sim.seeds.push([0.78, 0.5, 0.05, 1]); }
        if (sim.reset) for (let i = 0; i < 6; i++) sim.seeds.push([0.2 + 0.6 * hash(i * 11 + sec.n), 0.2 + 0.6 * hash(i * 17 + sec.n), 0.03, 1]);
        if (!quiet && win(t, 32.2, 32.9)) { sim.textSeed = 0.9; S.text = 'seed:EVERYTHING'; }
        if (stop) { sim.iters = 0; S.fb.amt = 0.97; S.fb.mosh = 1; S.fb.moshProb = 0.35; post.pixel = 2 + 18 * ramp(t, barT(23), barT(24)); post.hue = beatF(t) % 1 < 0.5 ? 0 : Math.PI; post.scan = 0.3; }
        S.sim = sim;
        S.cue[2] = stop ? 0.25 * easeOutCubic(ramp(t, barT(23), barT(24))) : 0.05 * S.secP;
        S.fb.amt = stop ? S.fb.amt : 0.25;
        energy = quiet ? 0.35 + 0.5 * ramp(t, barT(137), barT(138)) : 0.75;
        if (quiet) { post.glitch += 0.6 * ramp(t, barT(137), barT(138)); post.chroma += 3 * ramp(t, barT(137), barT(138)); }
        break;
      }
      case 'ch1':
      case 'ch2': {
        tunnelCues(S, t, sec, line && line.kind === 'chorus' ? line : null, sec.id === 'ch2' ? 0.5 : 0.0);
        energy = sec.id === 'ch2' ? 1 : 0.92;
        break;
      }
      case 'ch3': {
        const key = line ? line.key : 'RADIOACTIVE';
        const since = line ? t - line.cut : 0;
        energy = 1;
        if (key === 'CRAZY') {
          S.scene = 'eye';
          S.cue2[1] = 1; S.cue2[3] = 3 + since; S.cue2[2] = 0.4; S.cue[0] = Math.sin(t * 3) * 0.5; S.cue[1] = 0;
          S.cue3[0] = 0.1 * S.kick; post.hue = Math.floor(beatF(t)) * (Math.PI / 3); S.fb.amt = 0.5;
        } else if (key === 'OVER REACTIVE') {
          S.scene = 'reactor';
          S.cue[0] = 0.4; S.cue[1] = beatF(t) * 0.5; S.cue[2] = t * 0.4; S.cue[3] = S.snare;
          post.invert = S.snare > 0.5 ? 1 : 0; S.fb.amt = 0.5;
        } else if (key === 'PLAGUE') {
          S.scene = 'plague';
          S.cue[0] = beatF(t) * 0.05; S.cue[3] = 0.4; S.cue[2] = 0.08 * S.kick;
          S.fb.mosh = 1; S.fb.moshProb = 0.1 + 0.2 * S.kick;
        } else {
          tunnelCues(S, t, sec, line && line.kind === 'chorus' ? line : null, 0.25);
          if (key === 'SICK') {
            S.scene = 'eye';
            S.cue[2] = 1; S.cue[3] = 0.4 + S.kick; S.cue2[2] = 1; S.cue2[0] = 0.6 * Math.sin(t * 2); S.cue2[1] = 0;
            S.cue[0] = Math.sin(t * 5) * 0.4; S.cue[1] = Math.cos(t * 4) * 0.3;
          }
        }
        // keep the plague alive in the background for the montage
        S.sim = { F: 0.0545, k: 0.062, iters: 30, seeds: [], reset: false, textSeed: 0, drift: 0.2 };
        for (const h of (prevT != null ? hitsBetween('kick', prevT, t, 0.5) : []).slice(0, 3)) S.sim.seeds.push([hash(h.i * 3), hash(h.i * 5 + 1), 0.02, 0.9]);
        break;
      }
      case 'tok1':
      case 'tok2':
      case 'out':
      case 'end': {
        const shout = lineAt(t, 'shout');
        const firstBar = sec.t0 + 4 * P;
        S.cue2[0] = easeOutBack(ramp(t, firstBar - 0.1, firstBar + 0.35));
        const bs = beatF(t) - beatF(sec.t0);
        const k = Math.floor(bs);
        S.cue[0] = sec.id === 'out' || sec.id === 'end' ? (k + easeOutExpo((bs - k) * 5)) * 1 + (bs > 16 ? (bs - 16) * 1.5 : 0) : k + easeOutExpo((bs - k) * 5);
        S.cue[2] = 0.6 + 0.6 * S.low;
        const sT = shout ? t - shout.ts : 99;
        S.cue[3] = sT < 1.6 ? 1 - smooth(ramp(sT, 0.9, 1.6)) : 0.25;
        S.text = 'wordmark';
        if (sec.id === 'tok2') S.cue[1] = smooth(ramp(t, barT(84), barT(88)));
        if (sec.id === 'out' || sec.id === 'end') S.cue[1] = 0.3 + 0.7 * smooth(ramp(t, barT(153), barT(161)));
        S.cue2[1] = sT < 0.4 ? 1 - sT / 0.4 : 0;
        S.fb.mosh = 1; S.fb.moshProb = 0.05 + 0.35 * S.snare; S.fb.amt = 0.3;
        if (sT < 0.6) { post.invert = sT < 0.09 ? 1 : 0; post.flash += 0.6 * decay(sT, 0, 0.12); post.glitch += 0.8 * decay(sT, 0, 0.35); }
        if (sec.id === 'tok2' && t > barT(87)) { post.glitch += 0.6 * ramp(t, barT(87), barT(88)); }
        if (sec.id === 'end') { post.off = easeOutCubic(ramp(t, sec.t0 + 0.1, sec.t0 + 0.7)); post.stat = 0.4 * ramp(t, sec.t0, sec.t0 + 0.4); }
        energy = 0.95;
        break;
      }
      case 'v2a': {
        const bs = beatF(t) - beatF(sec.t0);
        const k = Math.floor(bs);
        S.cue[1] = k + easeOutCubic((bs - k) * 2.2);
        S.cue[0] = smooth(ramp(t, 76.9, 77.5)) * (0.6 + 0.4 * Math.abs(Math.sin(beatF(t) * Math.PI)));
        S.cue[2] = smooth(ramp(t, 74.1, 75.3));
        S.cue[3] = (line ? line.i : 0) * 0.13;
        S.fb.amt = 0.35;
        energy = 0.8;
        break;
      }
      case 'v2b': {
        const det = 81.452;
        S.cue[0] = t >= snap16(det) ? 1 : 0;
        S.cue[1] = t - snap16(det);
        S.cue[2] = smooth(ramp(t, 82.9, 85.6)) * 0.8;
        const stopT = barT(62);
        S.cue[3] = t > 88.5 ? 0.8 * smooth(ramp(t, 88.5, stopT)) * (1 - ramp(t, stopT, stopT + 0.5)) : 0;
        post.flash += 1.2 * decay(t, snap16(det), 0.35);
        const dbl = snapBeat(87.064);
        if (t >= dbl && t < stopT) post.tile = Math.pow(2, Math.min(4, 1 + Math.floor(beatF(t) - beatF(dbl) + 1e-4)));
        if (t >= stopT) { S.fb.amt = 0.97; S.fb.mosh = 1; S.fb.moshProb = 0.4; post.pixel = 3 + 16 * ramp(t, stopT, sec.t1); post.sat = 0.6; post.tile = 1; post.tint = [1.5, 0.45, 0.5]; post.scan = 0.35; post.invert = Math.floor(beatF(t) * 2) % 2 && t > stopT + 2 * P ? 1 : 0; }
        S.fb.amt = Math.max(S.fb.amt, 0.35);
        energy = 0.9;
        break;
      }
      case 'melt': {
        S.cue[0] = smooth(ramp(t, sec.t0, sec.t1));
        S.cue[1] = beatF(t) * 0.25;
        S.cue[2] = t * 0.12;
        S.cue[3] = smooth(ramp(t, barT(95), barT(96))) + 0.2 * S.acc;
        S.fb.amt = 0.6; S.fb.zoom = 0.004;
        post.glitch += 0.4 * ramp(t, barT(95), barT(96));
        post.chroma += 2 * ramp(t, barT(95), barT(96));
        energy = 0.3 + 0.6 * ramp(t, barT(94), barT(96));
        break;
      }
      case 'rap': {
        const li = line && (line.kind === 'rap' || line.kind === 'cult') ? line : null;
        S.cue[0] = li ? li.i : 0;
        S.cue[1] = beatStep(t) * (Math.PI * 2 / 16);
        S.cue[2] = S.kick;
        S.cue[3] = 1;
        S.text = li ? 'word:' + li.key : null;
        S.fb.amt = 0.2;
        if (li && li.key === 'OH MY!') { const b = beatF(t) - beatF(li.cut); post.invert = Math.floor(b) % 2 === 0 && b % 1 < 0.5 ? 1 : 0; }
        if (li && li.key === 'THINK') post.flip = Math.floor(beatF(t)) % 2;
        if (li && li.key === '?') post.stat = 0.1 + 0.1 * S.hat;
        if (li && li.key === '…') post.pixel = 2 + 10 * ramp(t, li.t, li.next);
        // the cult reveal: the sigil takes over before the drop
        if (li && li.kind === 'cult') { S.scene = 'cult'; S.cue2[1] = smooth(ramp(t, li.cut, sec.t1)); S.cue[2] = 0.3 * S.cue2[1]; S.cue[3] = 0.1; S.cue[0] = beatStep(t) * 0.13; S.cue[1] = -1; }
        energy = 0.9;
        break;
      }
      case 'cult': {
        S.cue[0] = beatStep(t, 3) * (Math.PI * 2 / 48);
        let last = sec.t0;
        for (const im of IMPACTS) if (im.t <= t && im.t >= sec.t0) last = im.t;
        const bar0 = barT(Math.floor(barF(t)));
        S.cue[1] = t - (t - bar0 < t - last ? bar0 : last);
        S.cue[2] = easeOutBack(ramp(t, sec.t0, sec.t0 + 0.4));
        S.cue[3] = 0.18 + 0.25 * S.low;
        S.cue2[0] = S.kick;
        S.cue2[1] = 1;
        S.fb.amt = 0.5; S.fb.zoom = 0.012; S.fb.rot = 0.01;
        post.shake = [(hash(Math.floor(t * 60)) - 0.5) * 0.012 * S.kick, (hash(Math.floor(t * 60) + 7) - 0.5) * 0.012 * S.kick];
        const big = beatT(491);
        post.invert = win(t, big, big + P * 0.5) ? 1 : post.invert;
        energy = 1;
        break;
      }
      default: break;
    }

    // ---------------------------------------------------------------- global beat-sync layer
    const burst = burstEnv(t);
    const imp = impactEnv(t);
    S.energy = energy;
    post.zoom += 0.045 * S.kick * energy + 0.06 * imp;
    post.hudZoom = 0.012 * S.kick;
    post.chroma += 1.5 * S.kick * energy + 5 * burst + 3 * imp;
    post.glitch += 0.12 * S.snare * energy + 0.9 * burst + 0.4 * imp + 0.05 * S.hat * energy;
    post.tear += 0.5 * burst + 0.3 * S.snare * energy;
    post.flash += 0.35 * imp;
    post.bloom = 0.8 + 0.5 * S.kick * energy + 0.6 * imp;
    post.grain = 0.022 + 0.018 * S.hat;
    post.exposure = 1 + 0.25 * S.kick * energy;
    if (energy > 0.85 && !post.shake[0]) post.shake = [(hash(Math.floor(t * 60)) - 0.5) * 0.006 * S.kick, (hash(Math.floor(t * 60) + 3) - 0.5) * 0.006 * S.kick];
    return S;
  }

  function specRow(t) { const i = frameIndex(t); return SPEC.subarray(i * 32, i * 32 + 32); }
  function waveRow(t) { const i = frameIndex(t); return WAVE.subarray(i * 128, i * 128 + 128); }

  window.TL = {
    A, P, PH, DB, DUR, FPS, SEC, LY, IMPACTS,
    beatF, beatT, barT, barF, snap16, snapBeat, envAt, hitEnv, specRow, waveRow, direct, secAt, lineAt,
    clamp, lerp, smooth, ramp, decay, easeOutExpo, easeOutCubic, easeOutBack, hash, win,
  };
})();
