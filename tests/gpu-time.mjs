// Đo thời gian GPU THẬT (D-031 / spec 2026-11-12-toi-uu-gpu-design.md mục 6.1, 6.3). KHÔNG dùng SwiftShader: số ms phụ thuộc máy nên không chấm đạt / lỗi theo ms.
//  1. Khởi động: thời gian tới khung đầu, số program. Hâm nền bộ đèn (?lightsets=bg): thời gian tới ready.day / ready.night, khung dài nhất, số khung > 100 ms.
//  2. Góc mặc định, ngày và đêm: thời gian GPU mỗi khung (timer query EXT_disjoint_timer_query_webgl2, A/B xen kẽ, trung vị / min / max qua nhiều vòng)
//     cho "bộ đèn thật" và "ép bộ full" (đặt tạm lights.ready.day/night = false ⇒ stepLights ở lại 'full'), kèm lệnh vẽ, tam giác, tên bộ đèn.
//  Ghi tests/screens/gpu/<nhãn>.json. LỖI (exit 1) chỉ khi: lỗi console, ready.night không tới trong 180 s, lệnh vẽ ban ngày bộ thật ≠ bộ full.
//  GPU là SwiftShader / thiếu timer query: in lý do và thoát mã 0. Máy đang bận (test khác chạy) thì số tuyệt đối nhiễu.
//
//   npm run build && node tests/gpu-time.mjs [--label=last] [--w=1920] [--h=1080] [--rounds=5]
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { serveDir, openApp, frames } from './lib.mjs';

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const label = arg('label', 'last'), W = +arg('w', 1920), H = +arg('h', 1080), ROUNDS = Math.max(5, +arg('rounds', 5));
const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); return ok; };

const srv = await serveDir(fileURLToPath(new URL('../dist/', import.meta.url)));
// GPU thật: Windows dùng ANGLE D3D11; nền tảng khác để mặc định. Tắt vsync / giới hạn khung để các khung đo không bị khoá 60 Hz
const args = ['--ignore-gpu-blocklist', '--enable-gpu', '--disable-gpu-vsync', '--disable-frame-rate-limit'];
if (process.platform === 'win32') args.unshift('--use-angle=d3d11');
const browser = await chromium.launch({ headless: true, args });
const t0 = Date.now();
let page, errors;
try {
  ({ page, errors } = await openApp(browser, srv.url + '?perf&lightsets=bg', { width: W, height: H }));
  const openMs = Date.now() - t0;
  const info = await page.evaluate(() => {
    const A = window.__app, gl = A.renderer.getContext(), d = gl.getExtension('WEBGL_debug_renderer_info');
    return { gpu: d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), timer: !!gl.getExtension('EXT_disjoint_timer_query_webgl2'),
      firstFrameMs: Math.round(A.perf.firstFrameMs), programs: A.renderer.info.programs.length, mode: A.lights.mode };
  });
  console.log(`GPU: ${info.gpu} · khung ${W}x${H} · chế độ bộ đèn ${info.mode}`);
  if (/swiftshader|llvmpipe|software/i.test(info.gpu)) { console.log('Bỏ qua: GPU là bộ vẽ phần mềm, không đo được thời gian GPU thật.'); await browser.close(); srv.close(); process.exit(0); }
  if (!info.timer) { console.log('Bỏ qua: trình duyệt không có EXT_disjoint_timer_query_webgl2.'); await browser.close(); srv.close(); process.exit(0); }

  // ---- 1. hâm nền: ghi mỗi khung (khoảng cách, bộ đèn) cho tới khi ready.night ----
  await page.evaluate(() => {
    const A = window.__app, rec = (window.__rec = []); let last = performance.now();
    const f = () => { const t = performance.now(); rec.push([t - last, t]); last = t; if (window.__rec === rec) requestAnimationFrame(f); };
    requestAnimationFrame(f);
  });
  const t = await page.evaluate(() => performance.now());
  const stamp = (which) => page.waitForFunction((w) => window.__app.lights.ready[w] && performance.now(), which, { timeout: 180000, polling: 50 }).then((h) => h.jsonValue());
  let tDay = null, tNight = null;
  if (info.mode === 'bg') {
    try { tDay = await stamp('day'); tNight = await stamp('night'); } catch { check(false, 'ready.night không tới trong 180 s'); }
  }
  const rec = await page.evaluate(() => { const r = window.__rec.slice(); window.__rec = null; return r; });
  const warmRec = tNight ? rec.filter((x) => x[1] <= tNight) : rec;
  const warm = { mode: info.mode, readyDayMs: tDay ? Math.round(tDay - t) : null, readyNightMs: tNight ? Math.round(tNight - t) : null,
    frames: warmRec.length, longestMs: Math.round(Math.max(0, ...warmRec.map((x) => x[0]))), framesOver100: warmRec.filter((x) => x[0] > 100).length };
  console.log(`\nKhởi động: mở trang xong sau ${(openMs / 1000).toFixed(1)} s, khung đầu ${info.firstFrameMs} ms, ${info.programs} program.`);
  console.log(`Hâm nền: ready.day ${warm.readyDayMs ?? '-'} ms, ready.night ${warm.readyNightMs ?? '-'} ms; trong lúc hâm ${warm.frames} khung, dài nhất ${warm.longestMs} ms, ${warm.framesOver100} khung > 100 ms.`);

  // ---- 2. GPU mỗi khung ở góc mặc định ----
  const setNight = (n) => page.evaluate((n) => { const d = window.__app.dayNight; d.target = d.night = n; }, n);
  const force = (full) => page.evaluate((full) => { const L = window.__app.lights; L.ready.day = L.ready.night = !full; }, full);
  const gpu = () => page.evaluate(async () => {
    const A = window.__app, R = A.renderer, gl = R.getContext(), ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms)), draw = () => { R.info.reset(); R.render(A.scene, A.camera); };
    draw(); draw();
    const q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
    for (let i = 0; i < 12; i++) draw();
    gl.endQuery(ext.TIME_ELAPSED_EXT); gl.flush();
    for (let k = 0; k < 400; k++) { await sleep(5); if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break; }
    const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT), ns = gl.getQueryParameter(q, gl.QUERY_RESULT); gl.deleteQuery(q);
    return { ms: disjoint ? -1 : ns / 1e6 / 12, calls: R.info.render.calls, tris: R.info.render.triangles, set: A.lights.set };
  });
  const out = {};
  for (let r = 0; r < ROUNDS; r++) for (const n of [0, 1]) for (const full of [false, true]) {
    await force(full); await setNight(n); await frames(page, 8);
    const k = `${n ? 'đêm' : 'ngày'} ${full ? 'ép full' : 'bộ thật'}`;
    (out[k] ||= []).push(await gpu());
  }
  await force(false);
  const med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
  const rows = {};
  for (const k in out) {
    const ms = out[k].map((x) => x.ms).filter((x) => x >= 0), last = out[k].at(-1);
    rows[k] = { 'GPU trung vị ms': +med(ms).toFixed(2), min: +Math.min(...ms).toFixed(2), max: +Math.max(...ms).toFixed(2), vòng: ms.length, 'lệnh vẽ': last.calls, 'tam giác': last.tris, 'bộ đèn': last.set };
  }
  console.log(`\nGPU mỗi khung, góc mặc định (${ROUNDS} vòng xen kẽ):`);
  console.table(rows);
  check(rows['ngày bộ thật']['lệnh vẽ'] === rows['ngày ép full']['lệnh vẽ'], `lệnh vẽ ban ngày khác nhau: bộ thật ${rows['ngày bộ thật']['lệnh vẽ']} ≠ full ${rows['ngày ép full']['lệnh vẽ']}`);
  check(errors.length === 0, `lỗi console: ${errors.join(' | ')}`);

  const file = fileURLToPath(new URL(`./screens/gpu/${label}.json`, import.meta.url));
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify({ label, date: new Date().toISOString(), gpu: info.gpu, width: W, height: H, startup: { openMs, firstFrameMs: info.firstFrameMs, programs: info.programs }, warm, rows }, null, 2));
  console.log(`\nĐã ghi ${path.relative(process.cwd(), file)}`);
} finally { await browser.close(); srv.close(); }
if (problems.length) { console.log('\nLỖI:\n- ' + problems.join('\n- ')); process.exit(1); }
console.log('\ngpu-time: xong (số ms chỉ để so sánh trên cùng máy, không chấm đạt / lỗi).');
