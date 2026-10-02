// Engine: render graph (sim -> scene -> feedback -> bloom -> post) and the three run modes:
//   real-time player (default), offline render (?render=1), review sheet (?sheet=1&times=...)
(function () {
  if (!window.TL) return; // no analysis data yet (see index.html)
  const q = new URLSearchParams(location.search);
  const MODE = q.get('render') === '1' ? 'render' : q.get('sheet') === '1' ? 'sheet' : 'play';
  const canvas = document.getElementById('c');
  const log = (m) => { console.log(m); if (MODE !== 'play') fetch('/log', { method: 'POST', body: String(m) }).catch(() => {}); };
  window.onerror = (m, s, l, c, e) => log('ERROR ' + m + ' @' + l + ':' + c + ' ' + (e && e.stack));

  let W = +q.get('w') || 1920, H = +q.get('h') || 1080;
  if (MODE === 'play') {
    const scale = +q.get('scale') || 1;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.round(Math.min(1920, window.innerWidth * dpr) * scale); H = Math.round(W * 9 / 16);
  }
  canvas.width = W; canvas.height = H;

  const G = new TGL(canvas), gl = G.gl;
  const hud = new Hud(document.createElement('canvas'));
  const SCENES = ['sky', 'eye', 'plague', 'tunnel', 'feed', 'parade', 'blast', 'reactor', 'propaganda', 'cult'];
  const P = {};
  for (const n of SCENES) P[n] = G.program(n, SH[n]);
  for (const n of ['sim', 'comp', 'bright', 'down', 'up', 'post']) P[n] = G.program(n, SH[n]);

  // ------------------------------------------------------------ resources
  const SIMW = 480, SIMH = 270;
  const simFmt = G.floatOK && G.floatLinear ? 'f32' : 'f16';
  let simA = G.target(SIMW, SIMH, simFmt), simB = G.target(SIMW, SIMH, simFmt);
  let scene, compA, compB, bl = [], outT = null;
  function alloc() {
    [scene, compA, compB, outT, ...bl].forEach((t) => G.free(t));
    scene = G.target(W, H, 'f16'); compA = G.target(W, H, 'f16'); compB = G.target(W, H, 'f16');
    bl = [];
    let w = W >> 1, h = H >> 1;
    for (let i = 0; i < 5; i++) { bl.push(G.target(Math.max(2, w), Math.max(2, h), 'f16')); w >>= 1; h >>= 1; }
    outT = MODE === 'play' ? null : G.target(W, H, 'u8');
  }
  alloc();
  const specTex = gl.createTexture(), waveTex = gl.createTexture();
  for (const [tx, n] of [[specTex, 32], [waveTex, 128]]) {
    gl.bindTexture(gl.TEXTURE_2D, tx);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, n, 1, 0, gl.RED, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  const hudTex = G.texture(1920, 1080, 'linear'), textTex = G.texture(1024, 576, 'linear');
  let hudOn = q.get('hud') !== '0';

  function uploadCanvas(tex, cnv) {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cnv);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  }
  function resetSim() {
    for (const t of [simA, simB]) G.draw(P.sim, t, { uState: hudTex, uText: textTex, uSimRes: [SIMW, SIMH], uF: 0, uK: 0, uDt: 1, uReset: 1, uTextSeed: 0, uDrift: 0, uSeeds: new Float32Array(24) });
  }
  function clearFeedback() {
    for (const t of [compA, compB]) { gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); }
  }
  resetSim();

  // ------------------------------------------------------------ one frame
  function frame(t, prevT, dtScale = 1) {
    const S = TL.direct(t, prevT);
    // HUD + scene text
    hud.draw(S);
    if (hudOn) uploadCanvas(hudTex, hud.c);
    if (hud.textDirty) { uploadCanvas(textTex, hud.textCanvas); hud.textDirty = false; }
    gl.bindTexture(gl.TEXTURE_2D, specTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 32, 1, gl.RED, gl.UNSIGNED_BYTE, TL.specRow(t));
    gl.bindTexture(gl.TEXTURE_2D, waveTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 128, 1, gl.RED, gl.UNSIGNED_BYTE, TL.waveRow(t));

    // reaction–diffusion
    if (S.sim) {
      const sim = S.sim;
      if (sim.reset) resetSim();
      const seeds = new Float32Array(24);
      sim.seeds.slice(0, 6).forEach((s, i) => seeds.set(s, i * 4));
      const iters = Math.round(sim.iters * dtScale);
      for (let i = 0; i < iters; i++) {
        G.draw(P.sim, simB, { uState: simA.tex, uText: textTex, uSimRes: [SIMW, SIMH], uF: sim.F, uK: sim.k, uDt: 1,
          uReset: 0, uTextSeed: i === 0 ? sim.textSeed : 0, uDrift: i === 0 ? sim.drift : 0, uSeeds: i === 0 ? seeds : new Float32Array(24) });
        [simA, simB] = [simB, simA];
      }
    }

    // scene
    const u = {
      uTime: t, uBeat: S.beat, uBar: S.bar, uSecT: S.secT, uSecP: S.secP,
      uKick: S.kick, uSnare: S.snare, uHat: S.hat, uAcc: S.acc, uLow: S.low, uMid: S.mid, uHigh: S.high, uRms: S.rms, uFlux: S.flux,
      uBeatPulse: S.beatPulse, uBarPulse: S.barPulse, uVar: S.variant, uCut: S.cut, uEnergy: S.energy,
      uCue: S.cue, uCue2: S.cue2, uCue3: S.cue3, uSpec: specTex, uWave: waveTex, uSim: simA.tex, uText: textTex, uSimRes: [SIMW, SIMH],
    };
    G.draw(P[S.scene] || P.sky, scene, u);

    // feedback composite
    const fb = S.fb;
    G.draw(P.comp, compB, { uScene: scene.tex, uPrev: compA.tex, uTime: t, uFb: Math.pow(fb.amt, dtScale), uFbZoom: fb.zoom * dtScale,
      uFbRot: fb.rot * dtScale, uFbShift: fb.shift, uMosh: fb.mosh, uMoshProb: fb.moshProb, uDrip: fb.drip });
    [compA, compB] = [compB, compA];

    // bloom
    G.draw(P.bright, bl[0], { uSrc: compA.tex, uTexel: [1 / W, 1 / H], uThresh: 0.62 });
    for (let i = 1; i < bl.length; i++) G.draw(P.down, bl[i], { uSrc: bl[i - 1].tex, uTexel: [1 / bl[i - 1].w, 1 / bl[i - 1].h] });
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    for (let i = bl.length - 1; i > 0; i--) G.draw(P.up, bl[i - 1], { uSrc: bl[i].tex, uTexel: [1 / bl[i].w, 1 / bl[i].h], uGain: 1 });
    gl.disable(gl.BLEND);

    // post
    const p = S.post;
    G.draw(P.post, outT, {
      uComp: compA.tex, uBloom: bl[0].tex, uHud: hudTex, uTime: t,
      uGlitch: Math.min(1, p.glitch), uChroma: p.chroma, uInvert: p.invert, uFlash: Math.min(1, p.flash), uGrain: p.grain, uScan: p.scan,
      uVig: p.vig, uHue: p.hue, uSat: p.sat, uPoster: p.poster, uPixel: p.pixel * (W / 1920), uTile: p.tile, uKaleido: p.kaleido,
      uOff: p.off, uZoom: p.zoom, uBloomAmt: p.bloom, uStatic: p.stat, uExposure: p.exposure, uHudZoom: hudOn ? p.hudZoom : 0,
      uTear: Math.min(1, p.tear), uFlip: p.flip, uShake: p.shake, uTint: p.tint,
    });
    if (!hudOn) { /* hud texture keeps last content cleared below */ }
    return S;
  }
  if (!hudOn) { const c = document.createElement('canvas'); c.width = 4; c.height = 4; uploadCanvas(hudTex, c); }

  // ------------------------------------------------------------ modes
  async function waitFonts() {
    try {
      await Promise.all(['700 64px Bahnschrift', '900 64px Bahnschrift', '700 40px "Microsoft YaHei"', '600 20px Consolas'].map((f) => document.fonts.load(f, 'AZ毒音')));
    } catch (e) {}
  }

  async function runRender() {
    await waitFonts();
    const fps = +q.get('fps') || 60, start = +q.get('start') || 0, end = +q.get('end') || TL.DUR;
    const frames = Math.round((end - start) * fps);
    await fetch('/begin', { method: 'POST', body: JSON.stringify({ w: W, h: H, fps, frames, start, end, renderer: G.renderer }) });
    let prevT = null;
    for (let t = Math.max(0, start - 3); t < start - 1e-6; t += 1 / fps) { frame(t, prevT); prevT = t; }
    const buf = new Uint8Array(W * H * 4);
    const t0 = performance.now();
    for (let i = 0; i < frames; i++) {
      const t = start + i / fps;
      frame(t, prevT, 60 / fps); prevT = t;
      gl.bindFramebuffer(gl.FRAMEBUFFER, outT.fb);
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      await fetch('/frame', { method: 'POST', body: buf });
      if (i % 600 === 0) log(`frame ${i}/${frames} t=${t.toFixed(2)} ${((performance.now() - t0) / (i + 1)).toFixed(1)} ms/f`);
    }
    await fetch('/done', { method: 'POST' });
  }

  async function runSheet() {
    await waitFonts();
    const times = (q.get('times') || '10,40,60').split(',').map(Number);
    const cols = +q.get('cols') || 4;
    const tw = +q.get('tw') || 480, th = Math.round(tw * 9 / 16);
    const rows = Math.ceil(times.length / cols);
    const sheet = document.createElement('canvas');
    sheet.width = cols * tw; sheet.height = rows * th;
    const sg = sheet.getContext('2d');
    sg.fillStyle = '#000'; sg.fillRect(0, 0, sheet.width, sheet.height);
    const warm = +q.get('warm') || 1.5;
    for (let k = 0; k < times.length; k++) {
      const T = times[k];
      clearFeedback(); resetSim();
      let prevT = null;
      for (let t = Math.max(0, T - warm); t < T - 1e-6; t += 1 / 60) { frame(t, prevT); prevT = t; }
      frame(T, prevT);
      const px = new Uint8Array(W * H * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, outT.fb);
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const id = new ImageData(W, H);
      for (let y = 0; y < H; y++) id.data.set(px.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
      const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H;
      tmp.getContext('2d').putImageData(id, 0, 0);
      const x = (k % cols) * tw, y = Math.floor(k / cols) * th;
      sg.drawImage(tmp, x, y, tw, th);
      sg.fillStyle = 'rgba(0,0,0,.6)'; sg.fillRect(x, y, 90, 22);
      sg.fillStyle = '#0f0'; sg.font = '16px Consolas'; sg.fillText(T.toFixed(2) + 's', x + 4, y + 16);
    }
    const blob = await new Promise((r) => sheet.toBlob(r, 'image/png'));
    await fetch('/save?name=' + encodeURIComponent(q.get('name') || 'sheet.png'), { method: 'POST', body: blob });
    await fetch('/quit', { method: 'POST' });
  }

  function runPlay() {
    const au = document.getElementById('au');
    const ui = document.getElementById('ui');
    let playing = false, lastT = null, anchorA = 0, anchorP = 0;
    const cur = () => (playing ? anchorA + (performance.now() - anchorP) / 1000 : au.currentTime);
    const resync = () => { anchorA = au.currentTime; anchorP = performance.now(); };
    au.addEventListener('playing', () => { playing = true; resync(); });
    au.addEventListener('pause', () => { playing = false; });
    au.addEventListener('seeked', () => { resync(); lastT = null; clearFeedback(); });
    const start = () => { ui.classList.add('hide'); au.play(); };
    ui.addEventListener('click', start);
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') { e.preventDefault(); if (au.paused) start(); else au.pause(); }
      else if (e.code === 'ArrowRight') au.currentTime = Math.min(TL.DUR - 0.1, au.currentTime + 5);
      else if (e.code === 'ArrowLeft') au.currentTime = Math.max(0, au.currentTime - 5);
      else if (e.code === 'KeyF') { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); }
      else if (e.code === 'KeyH') { hudOn = !hudOn; if (!hudOn) { const c = document.createElement('canvas'); c.width = 4; c.height = 4; uploadCanvas(hudTex, c); } }
    });
    if (q.get('t')) au.currentTime = +q.get('t');
    let lastSync = 0;
    function loop(now) {
      requestAnimationFrame(loop);
      if (playing && now - lastSync > 500) {
        const drift = cur() - au.currentTime;
        if (Math.abs(drift) > 0.04) resync();
        lastSync = now;
      }
      const t = Math.min(TL.DUR, Math.max(0, cur()));
      const dt = lastT == null ? 1 / 60 : Math.max(0, t - lastT);
      if (lastT != null && (t < lastT || t - lastT > 0.5)) { lastT = null; clearFeedback(); }
      if (!playing && lastT != null && Math.abs(t - lastT) < 1e-4) return;
      frame(t, lastT, Math.min(2, Math.max(0.25, dt * 60)));
      lastT = t;
    }
    requestAnimationFrame(loop);
  }

  log(`mode=${MODE} ${W}x${H} gl="${G.renderer}" float=${G.floatOK} floatLinear=${G.floatLinear}`);
  if (MODE === 'render') runRender().catch((e) => log('ERROR ' + e.stack));
  else if (MODE === 'sheet') runSheet().catch((e) => log('ERROR ' + e.stack));
  else runPlay();
})();
