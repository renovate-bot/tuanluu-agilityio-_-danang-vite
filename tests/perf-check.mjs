// Đo hiệu năng (kế hoạch tối ưu, D-018). Mở trang với ?test&perf để bật đo CPU từng bước trong vòng animate (src/core/perf.ts).
//  1. Khởi động: thời gian từ lúc điều hướng tới khung hình đầu, số shader program sau khung đầu.
//  2. Giật khựng: với mỗi thao tác (đêm lần đầu, bóng đổ, bay tới công trình lần đầu, mặt cắt Hầm, mưa) ghi số program tăng thêm,
//     thời gian render dài nhất (gồm biên dịch shader đồng bộ) so với render thường ngay trước đó, khung dài nhất.
//  3. CPU mỗi khung: ms trung bình từng bước (night, weather, effects, traffic, …, render) ở 5 góc nhìn, ban ngày.
//  4. Chất lượng hình (GĐ3), bộ đèn (D-031: ngày 'day', đêm 'night'; phun lửa ban ngày 'full' ở mục 2): ?test mặc định bậc 0 (Cao); Thấp / Trung bình không thêm draw call so với Cao (ngày, đêm); đổi bậc không thêm program;
//     chế độ Tự động hạ bậc khi giả lập khung chậm (quality.simulateMs) và nâng lại khi khung nhanh.
//  Kết quả in ra và ghi vào tests/screens/perf/<nhãn>.json; --compare=<file.json> in chênh lệch so với lần đo trước.
//  --strict (từ GĐ1): mọi thao tác ở mục 2 không được thêm program và render dài nhất ≤ CONFIG.perf.maxHitchMs.
//  SwiftShader (CPU) chậm hơn GPU thật nhiều lần: chỉ dùng số đo để so tương đối giữa hai lần chạy trên cùng máy.
//
//   npm run build && node tests/perf-check.mjs [--label=gd0] [--compare=tests/screens/perf/gd0.json] [--strict]
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import { serveDir, launch, openApp, frames, pickView, tap } from './lib.mjs';
import { setWx } from './weather-lib.mjs';

const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const label = arg('label') || 'last', compare = arg('compare'), strict = process.argv.includes('--strict');
const MAX_HITCH = 150;   // = CONFIG.perf.maxHitchMs
const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); return ok; };

const srv = await serveDir(fileURLToPath(new URL('../dist/', import.meta.url)));
const browser = await launch();
const { page, errors } = await openApp(browser, srv.url + '?perf', { width: 480, height: 270 });
const res = { label, date: new Date().toISOString(), startup: {}, hitch: [], cpu: {}, quality: {} };
const programs = () => page.evaluate(() => window.__app.renderer.info.programs.length);
const reset = () => page.evaluate(() => window.__app.perf.reset());
try {
  // ---- 1. Khởi động ----
  res.startup = await page.evaluate(() => ({ firstFrameMs: Math.round(window.__app.perf.firstFrameMs), programs: window.__app.renderer.info.programs.length }));

  // ---- 2. Giật khựng ----
  const hitch = async (name, action) => {
    await frames(page, 3); await reset(); await frames(page, 4);
    const base = await page.evaluate(() => { const P = window.__app.perf; return (P.sums.render || 0) / Math.max(1, P.frames); });
    const p0 = await programs(); await reset();
    await action(); await frames(page, 4);
    const r = await page.evaluate(() => { const P = window.__app.perf; return { render: P.maxs.render || 0, maxFrame: P.maxFrame }; });
    const h = { name, dPrograms: (await programs()) - p0, renderMax: Math.round(r.render), renderBase: Math.round(base), extra: Math.round(r.render - base), maxFrame: Math.round(r.maxFrame) };
    res.hitch.push(h);
    if (strict) {
      check(h.dPrograms <= 0, `${name}: thêm ${h.dPrograms} shader program (cần 0 sau prewarm)`);
      check(h.extra <= MAX_HITCH, `${name}: render dài hơn bình thường ${h.extra} ms (> ${MAX_HITCH} ms)`);
    }
  };
  const setNight = (n) => page.evaluate((n) => { const d = window.__app.dayNight; d.target = d.night = n; }, n);
  const click = (sel) => tap(page, sel);
  await hitch('đêm lần đầu', () => setNight(1));
  await hitch('về ngày', () => setNight(0));
  await hitch('đêm lần 2', () => setNight(1));
  await setNight(0); await frames(page, 3);
  // Rồng phun lửa ban ngày: fireLight sáng ⇒ bộ đèn 'full' (D-031) phải đã biên dịch trước. Nút #btnShow tự chuyển sang đêm (setupUI.ts) nên đặt lại ngày ngay;
  // lửa phun ngay khi bật (show.t = 0). Tắt rồi chờ lửa tắt hẳn (cường độ giảm 1500/s) ⇒ về 'day'
  const lightSet = () => page.evaluate(() => window.__app.lights.set);
  await hitch('phun lửa ban ngày', async () => { await click('#btnShow'); await setNight(0); });
  const fireSet = await lightSet();
  check(fireSet === 'full', `phun lửa ban ngày: bộ đèn phải là 'full' (đang '${fireSet}')`);
  await click('#btnShow'); await setNight(0); await frames(page, 30);
  await hitch('tắt bóng đổ', () => click('#btnShadow'));
  await hitch('bật bóng đổ', () => click('#btnShadow'));
  await hitch('bay tới Thuận Phước', () => pickView(page, 'tp', 'tpBay'));
  await hitch('bay tới Hầm', () => pickView(page, 'hr', 'hrOverview'));
  for (const k of [1, 2]) {
    await hitch(`bật mặt cắt lần ${k}`, () => click('#btnHrSection'));
    await hitch(`tắt mặt cắt lần ${k}`, () => click('#btnHrSection'));
  }
  await hitch('bay tới Vòng quay', () => pickView(page, 'sw', 'swOverview'));
  await hitch('bật mưa', () => setWx(page, 'rain'));
  await hitch('tắt mưa', () => setWx(page, 'now'));
  const setQ = (m) => page.evaluate((m) => window.__app.quality.set(m), m);
  if (await page.evaluate(() => !!window.__app.quality)) {
    await setNight(1); await frames(page, 3);
    await hitch('chất lượng Thấp (đêm)', () => setQ('low'));
    await hitch('chất lượng Trung bình (đêm)', () => setQ('medium'));
    await hitch('chất lượng Cao (đêm)', () => setQ('high'));
    await setNight(0); await frames(page, 3);
  }

  // ---- 4. Chất lượng hình ----
  if (await page.evaluate(() => !!window.__app.quality)) {
    const q0 = await page.evaluate(() => ({ mode: window.__app.quality.mode, step: window.__app.quality.step }));
    check(q0.mode === 'high' && q0.step === 0, `?test phải ở chất lượng Cao, bậc 0 (đang ${JSON.stringify(q0)})`);
    await pickView(page, 'dragon', 'overview');
    const maxCalls = () => page.evaluate(() => new Promise((ok) => { let n = 0, m = 0; const f = () => { m = Math.max(m, window.__app.renderer.info.render.calls); (++n >= 6 ? ok(m) : requestAnimationFrame(f)); }; requestAnimationFrame(f); }));
    for (const night of [0, 1]) {
      await setNight(night); await frames(page, 6); const o = {};
      // Bộ đèn (D-031): ngày chỉ sun; đêm 1 ẩn sun (không lượt bóng), hiện moon + 7 PointLight
      const set = await page.evaluate(() => window.__app.lights.set);
      res.quality[night ? 'đèn đêm' : 'đèn ngày'] = set;
      check(set === (night ? 'night' : 'day'), `bộ đèn ${night ? 'đêm' : 'ngày'} phải là '${night ? 'night' : 'day'}' (đang '${set}')`);
      for (const m of ['high', 'medium', 'low']) { await setQ(m); await frames(page, 3); o[m] = await maxCalls(); }
      res.quality[night ? 'đêm' : 'ngày'] = o;
      check(o.medium <= o.high && o.low <= o.high, `overview ${night ? 'đêm' : 'ngày'}: draw call Trung bình ${o.medium} / Thấp ${o.low} phải ≤ Cao ${o.high}`);
    }
    await setQ('high'); await setNight(0);
    // Tự động: giả lập khung 40 ms ⇒ hạ bậc; 5 ms ⇒ nâng lại (rút ngắn cửa sổ để test nhanh)
    await page.evaluate(() => { const Q = window.__app.quality; Q.set('auto'); Object.assign(Q.adapt, { window: 0.2, cooldown: 0, upHold: 0.4 }); Q.simulateMs = 40; });
    const waitStep = (pred) => page.evaluate((src) => new Promise((ok) => { const p = new Function('q', 'return ' + src); let n = 0; const f = () => (p(window.__app.quality) || ++n > 600 ? ok(window.__app.quality.step) : requestAnimationFrame(f)); requestAnimationFrame(f); }), pred);
    const down = await waitStep('q.step >= 2');
    await page.evaluate(() => { window.__app.quality.simulateMs = 5; });
    const up = await waitStep('q.step === 0');
    res.quality.auto = { down, up };
    check(down >= 2, `Tự động: khung 40 ms phải hạ ít nhất 2 bậc (đang bậc ${down})`);
    check(up === 0, `Tự động: khung 5 ms phải nâng về bậc 0 (đang bậc ${up})`);
    await page.evaluate(() => { const Q = window.__app.quality; Q.simulateMs = 0; Q.set('high'); });
    await frames(page, 3);
  }

  // ---- 3. CPU mỗi khung ----
  for (const [bridge, view] of [['dragon', 'overview'], ['dragon', 'head'], ['hr', 'hrOverview'], ['sw', 'swOverview'], ['tp', 'tpBay']]) {
    await pickView(page, bridge, view); await frames(page, 4); await reset(); await frames(page, 30);
    res.cpu[view] = await page.evaluate(() => {
      const P = window.__app.perf, o = {}; let cpu = 0;
      for (const [k, v] of Object.entries(P.sums)) { o[k] = +(v / P.frames).toFixed(3); if (k !== 'render') cpu += v / P.frames; }
      o.cpu = +cpu.toFixed(3); o.calls = window.__app.renderer.info.render.calls;
      return o;
    });
  }
} finally {
  await browser.close(); srv.close();
}

// ---- In kết quả ----
console.log(`Khởi động: khung đầu ${res.startup.firstFrameMs} ms, ${res.startup.programs} program`);
console.log('Giật khựng (ms; render thường → dài nhất, +program):');
for (const h of res.hitch) console.log(`  ${h.name.padEnd(22)} ${String(h.renderBase).padStart(5)} → ${String(h.renderMax).padStart(6)}  (+${h.extra})  +${h.dPrograms} program  khung dài nhất ${h.maxFrame}`);
if (Object.keys(res.quality).length) console.log('Chất lượng (draw call overview Cao/Trung bình/Thấp; tự động):', JSON.stringify(res.quality));
console.log('CPU mỗi khung (ms trung bình, không gồm render):');
const keys = [...new Set(Object.values(res.cpu).flatMap((o) => Object.keys(o)))];
for (const k of keys) console.log(`  ${k.padEnd(11)} ${Object.keys(res.cpu).map((v) => String(res.cpu[v][k] ?? '–').padStart(9)).join('')}`);
console.log(`  ${''.padEnd(11)} ${Object.keys(res.cpu).map((v) => v.padStart(9).slice(-9)).join('')}`);
if (compare) {
  const old = JSON.parse(await fs.readFile(compare, 'utf8'));
  console.log(`So với ${old.label} (${old.date.slice(0, 10)}):`);
  for (const h of res.hitch) { const o = old.hitch.find((x) => x.name === h.name); if (o) console.log(`  ${h.name.padEnd(22)} render +${o.extra} → +${h.extra} ms, program +${o.dPrograms} → +${h.dPrograms}`); }
  for (const v of Object.keys(res.cpu)) if (old.cpu[v]) console.log(`  ${v.padEnd(11)} CPU ${old.cpu[v].cpu} → ${res.cpu[v].cpu} ms, draw call ${old.cpu[v].calls} → ${res.cpu[v].calls}`);
}
const outDir = new URL('./screens/perf/', import.meta.url);
await fs.mkdir(outDir, { recursive: true });
await fs.writeFile(new URL(`${label}.json`, outDir), JSON.stringify(res, null, 2));
console.log(`Đã ghi tests/screens/perf/${label}.json`);

check(errors.length === 0, `lỗi console: ${errors.join(' | ')}`);
if (problems.length) { console.log('perf-check: LỖI'); for (const p of problems) console.log('  - ' + p); process.exit(1); }
console.log('perf-check: đạt');
