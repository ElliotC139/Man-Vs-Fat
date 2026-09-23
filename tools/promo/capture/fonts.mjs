// Headless Chromium here can't reach Google Fonts, but curl can, so font
// requests are answered from a local cache that curl fills on first use.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const cache = join(dirname(fileURLToPath(import.meta.url)), '.cache');
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140 Safari/537.36';

export async function serveFonts(context) {
  mkdirSync(cache, { recursive: true });
  await context.route(/fonts\.(googleapis|gstatic)\.com/, (route) => {
    const url = route.request().url();
    const file = join(cache, createHash('sha1').update(url).digest('hex'));
    if (!existsSync(file)) writeFileSync(file, execFileSync('curl', ['-sSf', '-A', UA, url]));
    const css = url.includes('googleapis');
    route.fulfill({
      status: 200,
      contentType: css ? 'text/css' : 'font/woff2',
      headers: { 'access-control-allow-origin': '*' },
      body: readFileSync(file),
    });
  });
}
