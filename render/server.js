// TokSik MV — local server.
//   node server.js                      -> serve the real-time player on http://localhost:8765
//   node server.js --render out.mp4     -> headless offline render (frames piped into ffmpeg)
//        [--w 1920 --h 1080 --fps 60 --start 0 --end <dur> --crf 19 --preset slow --headful]
//   node server.js --shot "times=10,40,60&cols=4"   -> render a review contact sheet to out/review/
// Environment overrides: FFMPEG (ffmpeg binary), BROWSER (Chrome / Edge / Chromium binary)
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const WEB = path.resolve(__dirname, '..', 'web');

function findFfmpeg() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  if (spawnSync('ffmpeg', ['-version']).status === 0) return 'ffmpeg';
  for (const py of ['python', 'python3', 'py']) { // fall back to the imageio-ffmpeg bundled binary
    const r = spawnSync(py, ['-c', 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())'], { encoding: 'utf8' });
    if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
  }
  throw new Error('ffmpeg not found: install it, set FFMPEG, or `pip install imageio-ffmpeg`');
}

function findBrowser() {
  if (process.env.BROWSER) return process.env.BROWSER;
  const pf = process.env['ProgramFiles'] || 'C:\\Program Files', pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const local = process.env.LOCALAPPDATA || '';
  const candidates = [
    path.join(pf, 'Google\\Chrome\\Application\\chrome.exe'), path.join(pf86, 'Google\\Chrome\\Application\\chrome.exe'),
    path.join(local, 'Google\\Chrome\\Application\\chrome.exe'),
    path.join(pf86, 'Microsoft\\Edge\\Application\\msedge.exe'), path.join(pf, 'Microsoft\\Edge\\Application\\msedge.exe'),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge',
  ];
  const hit = candidates.find((c) => c && fs.existsSync(c));
  if (!hit) throw new Error('No Chrome/Edge found: set BROWSER to a Chromium-based browser binary');
  return hit;
}

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const flag = (k) => args.includes('--' + k);
const PORT = +opt('port', 8765);
const OUT = opt('render', null);

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css',
  '.flac': 'audio/flac', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2' };

function serveStatic(req, res) {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const file = path.join(WEB, path.normalize(p));
  if (!file.startsWith(WEB) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); return res.end('not found');
  }
  const size = fs.statSync(file).size;
  const type = MIME[path.extname(file)] || 'application/octet-stream';
  const range = req.headers.range;
  if (range) { // media seeking needs byte ranges
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const start = m[1] ? +m[1] : 0, end = m[2] ? +m[2] : size - 1;
    res.writeHead(206, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1,
      'Content-Range': `bytes ${start}-${end}/${size}`, 'Cache-Control': 'no-cache' });
    return fs.createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
}

// ------------------------------------------------------------------ render sink
let ff = null, framesIn = 0, t0 = 0, total = 0, edge = null;
function startFfmpeg(w, h, fps, start, end) {
  const crf = opt('crf', '19'), preset = opt('preset', 'slow');
  const a = ['-y', '-hide_banner', '-loglevel', 'warning',
    '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${w}x${h}`, '-r', String(fps), '-i', 'pipe:0',
    '-ss', String(start), '-t', String(end - start), '-i', path.join(WEB, 'audio', 'toksik.flac'),
    '-map', '0:v', '-map', '1:a',
    '-vf', 'vflip,format=yuv420p',
    '-c:v', 'libx264', '-preset', preset, '-crf', crf, '-maxrate', opt('maxrate', '45M'), '-bufsize', '90M', '-profile:v', 'high',
    '-x264-params', 'keyint=120:min-keyint=1:aq-mode=3',
    '-c:a', 'aac', '-b:a', '320k', '-movflags', '+faststart', '-shortest', OUT];
  ff = spawn(findFfmpeg(), a, { stdio: ['pipe', 'inherit', 'inherit'] });
  ff.on('exit', (code) => {
    console.log(`\nffmpeg exited (${code}) -> ${OUT}`);
    if (edge) try { edge.kill(); } catch (e) {}
    process.exit(code || 0);
  });
  t0 = Date.now();
}

function handlePost(req, res) {
  const url = new URL(req.url, 'http://x');
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    if (url.pathname === '/log') {
      console.log('[page]', body.toString());
      res.end('ok');
    } else if (url.pathname === '/begin') {
      const j = JSON.parse(body.toString());
      total = j.frames;
      console.log(`render begin: ${j.w}x${j.h}@${j.fps} frames=${j.frames} gl="${j.renderer}"`);
      if (OUT && !ff) startFfmpeg(j.w, j.h, j.fps, j.start, j.end);
      res.end('ok');
    } else if (url.pathname === '/frame') {
      if (!ff) { res.end('no-sink'); return; }
      framesIn++;
      const ok = ff.stdin.write(body);
      const reply = () => res.end('ok');
      if (ok) reply(); else ff.stdin.once('drain', reply);
      if (framesIn % 60 === 0) {
        const el = (Date.now() - t0) / 1000, fps = framesIn / el;
        process.stdout.write(`\rframe ${framesIn}/${total}  ${fps.toFixed(1)} fps  eta ${((total - framesIn) / fps / 60).toFixed(1)} min   `);
      }
    } else if (url.pathname === '/save') {
      const name = path.basename(url.searchParams.get('name') || 'shot.png');
      const dir = path.resolve(__dirname, '..', 'out', 'review');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, name), body);
      console.log('saved', path.join(dir, name));
      res.end('ok');
    } else if (url.pathname === '/quit') {
      res.end('ok');
      setTimeout(() => { if (edge) try { edge.kill(); } catch (e) {} process.exit(0); }, 200);
    } else if (url.pathname === '/done') {
      console.log(`\nall ${framesIn} frames received, finalising…`);
      res.end('ok');
      if (ff) ff.stdin.end();
    } else { res.writeHead(404); res.end(); }
  });
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST') return handlePost(req, res);
  serveStatic(req, res);
});
server.listen(PORT, () => {
  console.log(`TokSik MV server on http://localhost:${PORT}/`);
  const shot = opt('shot', null);
  if (!OUT && !shot) return;
  const w = opt('w', '1920'), h = opt('h', '1080'), fps = opt('fps', '60');
  const q = shot ? `sheet=1&w=${w}&h=${h}&${shot}`
    : `render=1&w=${w}&h=${h}&fps=${fps}&start=${opt('start', '0')}` + (opt('end') ? `&end=${opt('end')}` : '');
  if (shot) setTimeout(() => { console.log('shot timeout'); if (edge) edge.kill(); process.exit(2); }, +opt('timeout', '240') * 1000);
  const profile = path.join(require('os').tmpdir(), 'toksik-browser-profile');
  const eargs = [
    flag('headful') ? `--window-size=640,400` : '--headless=new',
    '--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-unsafe-swiftshader',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows', '--autoplay-policy=no-user-gesture-required',
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--mute-audio',
    `--user-data-dir=${profile}`, `http://localhost:${PORT}/index.html?${q}`];
  edge = spawn(findBrowser(), eargs, { stdio: 'ignore' });
  console.log(shot ? 'launched headless browser for review sheet' : 'launched headless browser for offline render');
});
