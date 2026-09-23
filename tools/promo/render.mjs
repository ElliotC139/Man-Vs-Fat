// Renders promo.html to an MP4, one frame at a time.
//
//   node tools/promo/render.mjs                 # 60fps, tools/promo/out/quickcals-promo.mp4
//   node tools/promo/render.mjs --fps 30
//   node tools/promo/render.mjs --stills 1,8.6,10.8   # PNGs of single moments, no video
//
// The soundtrack is out/score.wav (python3 tools/promo/audio/score.py); if it
// exists it's muxed in as AAC, otherwise the video is silent.
//
// Needs Playwright's Chromium and an ffmpeg with libx264: set FFMPEG to its
// path, or have `ffmpeg` on PATH. `pip install imageio-ffmpeg` is the
// quickest way to get one without root:
//   FFMPEG=$(python3 -c "import imageio_ffmpeg as f; print(f.get_ffmpeg_exe())")
//
// The page is never played in real time here. For each frame the renderer
// calls seek(t) and screenshots the result, so a slow machine gives exactly
// the same video as a fast one, just later.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

function loadPlaywright() {
  try {
    return require('playwright');
  } catch {
    // Fall back to a global install.
    const { execSync } = require('node:child_process');
    const root = execSync('npm root -g').toString().trim();
    return require(join(root, 'playwright'));
  }
}

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const fps = Number(opt('fps', 60));
const stills = opt('stills', null);
const outDir = join(here, 'out');
const out = opt('out', join(outDir, 'quickcals-promo.mp4'));
mkdirSync(outDir, { recursive: true });

const { chromium } = loadPlaywright();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
await page.goto(`${pathToFileURL(join(here, 'promo.html')).href}?render`);
await page.evaluate(() => Promise.all([...document.fonts].map((f) => f.load())));
const faces = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family));
if (!faces.length) console.warn('No web fonts loaded — the render will use system fallbacks.');

const seekTo = (t) => page.evaluate((t) => window.seek(t), t);  // resolves once any new frame has decoded

if (stills) {
  for (const s of stills.split(',').map(Number)) {
    await seekTo(s);
    const path = join(outDir, `still-${String(s).replace('.', '_')}.png`);
    await page.screenshot({ path });
    console.log(path);
  }
  await browser.close();
  process.exit(0);
}

const duration = await page.evaluate(() => window.DURATION);
const frames = Math.round(duration * fps);
const score = join(outDir, 'score.wav');
const audio = existsSync(score) ? ['-i', score, '-c:a', 'aac', '-b:a', '192k', '-shortest'] : [];
if (!audio.length) console.warn('No out/score.wav — rendering without sound.');
const ffmpeg = spawn(
  process.env.FFMPEG || 'ffmpeg',
  [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
    ...audio,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p',
    '-profile:v', 'high', '-movflags', '+faststart',
    out,
  ],
  { stdio: ['pipe', 'inherit', 'inherit'] },
);
const done = new Promise((res, rej) => ffmpeg.on('close', (c) => (c === 0 ? res() : rej(new Error(`ffmpeg exited ${c}`)))));

const started = Date.now();
for (let f = 0; f < frames; f++) {
  await seekTo(f / fps);
  const png = await page.screenshot({ type: 'png' });
  if (!ffmpeg.stdin.write(png)) await new Promise((r) => ffmpeg.stdin.once('drain', r));
  if (f % fps === 0) process.stdout.write(`\r${Math.round((f / frames) * 100)}%  ${((Date.now() - started) / 1000).toFixed(0)}s`);
}
ffmpeg.stdin.end();
await done;
await browser.close();
console.log(`\n${out}  (${frames} frames at ${fps}fps)`);
