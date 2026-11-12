// Tiện ích chung cho các script kiểm tra: server tĩnh + mở trang bằng Chromium (Playwright).
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const THREE_DIR = fileURLToPath(new URL('../node_modules/three/', import.meta.url));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.png': 'image/png' };

/** Server tĩnh tối giản cho một thư mục (theo symlink). Trả về { url, close }. */
export function serveDir(dir) {
  const root = path.resolve(dir);
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    let file = path.join(root, p);
    if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
    // Bản gốc nạp three từ /three/… : nếu thư mục không có thì lấy từ node_modules/three của project
    if (p.startsWith('/three/') && !fs.existsSync(file)) file = path.join(THREE_DIR, p.slice('/three/'.length));
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok({ url: `http://127.0.0.1:${server.address().port}/`, close: () => server.close() })));
}

export async function launch() {
  return chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
  });
}

/** Mở trang với ?test, chặn font Google (không cần cho kiểm tra), chờ khung hình đầu.
    before(page): chạy trước khi mở trang (gắn route / lắng nghe yêu cầu, console từ lúc đầu). */
export async function openApp(browser, url, { width = 480, height = 270, mobile = false, before = null } = {}) {
  const page = await browser.newPage(mobile ? { viewport: { width, height }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width, height } });
  const errors = []; page.setDefaultTimeout(240000);
  if (before) await before(page);
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)|ERR_FAILED|net::/.test(m.text())) errors.push(m.text()); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto(url + (url.includes('?') ? '&' : '?') + 'test', { waitUntil: 'load', timeout: 180000 });
  await page.waitForFunction(() => window.__app && document.getElementById('loading')?.classList.contains('done'), null, { timeout: 180000 });
  return { page, errors };
}

/** Chờ n khung hình. */
export const frames = (page, n = 2) => page.evaluate((n) => new Promise((ok) => { let i = 0; const f = () => (++i >= n ? ok() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);

/** Chờ hiệu ứng bay camera (flyTo) kết thúc. */
// Phần mềm dựng hình (SwiftShader) rất chậm nên tua nhanh: đẩy tiến độ bay gần tới đích để khung hình kế tiếp hoàn tất.
export async function waitFlight(page) {
  await page.evaluate(() => { const f = window.__app.cam.flight; if (window.__app.cam.mode === 'fly') f.t = Math.max(f.t, 0.999); });
  await page.waitForFunction(() => window.__app.cam.mode !== 'fly', null, { timeout: 240000 });
}

/** Bấm một phần tử: ở chế độ gọn thì mở đúng tờ chứa nó trước (reveal), chờ 1 khung, rồi bấm. */
export async function tap(page, sel) {
  await page.evaluate((s) => window.__app.ui?.reveal(document.querySelector(s)), sel);
  await frames(page, 1);
  await page.click(sel);
}

/** Như tap nhưng cho ô chọn (select). */
export async function pick(page, sel, value) {
  await page.evaluate((s) => window.__app.ui?.reveal(document.querySelector(s)), sel);
  await frames(page, 1);
  await page.selectOption(sel, value);
}

/** Chọn cầu rồi bấm nút góc nhìn. */
export async function pickView(page, bridge, view) {
  await tap(page, `button[data-bridge="${bridge}"]`);
  await waitFlight(page);
  await tap(page, `button[data-view="${view}"]`);
  await waitFlight(page);
}
