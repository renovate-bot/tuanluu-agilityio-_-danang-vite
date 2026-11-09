// Kiểm tra ánh đèn đêm trên tòa nhà (docs/superpowers/specs/2026-11-09-den-dem-toa-nha-design.md).
// 1. dayDiff: ban ngày giống mốc chuẩn chụp từ bản chưa sửa (dung sai vì nước, xe chuyển động).
// 2. warmDominant, coolSeen, ledSeen: đêm có vàng ấm áp đảo, thấy tháp xanh, thấy viền LED.
// 3. landmark: địa danh giữ khóa shader cũ, nhà khu phố dùng biến thể mới.
// 4. corridor: instance đã thu về scale 0 (hành lang Hầm) vẫn vô hình về đêm.
//
//   npm run build && node tests/citynight-check.mjs [--baseline] [--no-shots]
import { fileURLToPath } from 'node:url';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { serveDir, launch, openApp, frames } from './lib.mjs';

const BASELINE = process.argv.includes('--baseline'), NO_SHOTS = process.argv.includes('--no-shots');
const SCREENS = fileURLToPath(new URL('./screens/', import.meta.url));
mkdirSync(SCREENS, { recursive: true });
const problems = [];
const check = (ok, msg) => { console.log(`${ok ? 'ĐẠT ' : 'LỖI '} ${msg}`); if (!ok) problems.push(msg); return ok; };

const srv = await serveDir(fileURLToPath(new URL('../dist/', import.meta.url)));
const browser = await launch();
const { page, errors } = await openApp(browser, srv.url, { width: 960, height: 540 });

export const setNight = async (v) => {
  await page.evaluate((v) => { window.__app.dayNight.target = v; window.__app.dayNight.night = v; }, v);
  await page.waitForFunction((v) => Math.abs(window.__app.dayNight.night - v) < 1e-6, v, { timeout: 60000 });
  await frames(page, 3);
};
export const aim = async (pos, target) => {
  await page.evaluate(([p, t]) => { const a = window.__app; a.camera.position.set(...p); a.controls.target.set(...t); a.controls.update(); }, [pos, target]);
  await frames(page, 3);
};
const shot = async (name) => (await page.screenshot(name ? { path: `${SCREENS}${name}.png` } : {})).toString('base64');
/* Thống kê một vùng ảnh (tỉ lệ 0..1): nhóm màu, độ sáng trung bình, độ lệch chuẩn */
export const sample = (b64, rect, refB64) => page.evaluate(async ([b64, r, refB64]) => {
  const load = async (b) => { const bm = await createImageBitmap(await (await fetch(`data:image/png;base64,${b}`)).blob()); const c = new OffscreenCanvas(bm.width, bm.height), g = c.getContext('2d'); g.drawImage(bm, 0, 0); return g.getImageData(0, 0, bm.width, bm.height); };
  const a = await load(b64), ref = refB64 ? await load(refB64) : null;
  const x0 = Math.floor(r[0] * a.width), y0 = Math.floor(r[1] * a.height), x1 = Math.floor(r[2] * a.width), y1 = Math.floor(r[3] * a.height);
  let n = 0, bright = 0, warm = 0, cool = 0, led = 0, sum = 0, sq = 0, diff = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * a.width + x) * 4, R = a.data[i], G = a.data[i + 1], B = a.data[i + 2], l = (R + G + B) / 3; n++; sum += l; sq += l * l;
    if (ref) diff += (Math.abs(R - ref.data[i]) + Math.abs(G - ref.data[i + 1]) + Math.abs(B - ref.data[i + 2])) / 3;
    if (Math.max(R, G, B) > 150) bright++;
    if (R > 150 && B < 0.75 * R) warm++;
    if (B > 150 && R < 0.7 * B) cool++;
    if (R > 150 && B > 130 && G < 0.65 * Math.min(R, B)) led++;
  }
  const mean = sum / n;
  return { n, bright, warm, cool, led, mean, std: Math.sqrt(Math.max(0, sq / n - mean * mean)), diff: diff / n };
}, [b64, rect, refB64]);

const VIEW = [[0, 28, 500], [0, 30, -1200]], TOP = [0, 0, 1, 0.5], ALL = [0, 0, 1, 1];
const base = (n) => `${SCREENS}citynight-base-${n}.png`;
try {
  // Ẩn giao diện để chỉ đo khung cảnh
  await page.evaluate(() => document.querySelectorAll('body *').forEach((e) => { if (!e.matches('canvas') && !e.querySelector('canvas')) e.style.visibility = 'hidden'; }));
  await aim(...VIEW);
  await setNight(0); const day = await shot(NO_SHOTS || BASELINE ? null : 'citynight-day');
  await setNight(1); const night = await shot(NO_SHOTS || BASELINE ? null : 'citynight-night');
  if (BASELINE) {
    writeFileSync(base('day'), Buffer.from(day, 'base64')); writeFileSync(base('night'), Buffer.from(night, 'base64'));
    console.log('Đã lưu mốc chuẩn ngày/đêm');
  } else {
    if (!existsSync(base('day'))) throw new Error('Thiếu mốc chuẩn: chạy --baseline trên bản chưa sửa');
    const d = await sample(day, ALL, readFileSync(base('day')).toString('base64'));
    check(d.diff < 3, `dayDiff: ban ngày chênh ${d.diff.toFixed(2)}/255 (cần < 3)`);
    const t = await sample(night, TOP);
    console.log('đêm:', JSON.stringify(t));
    const colored = t.warm + t.cool + t.led;   // chỉ so giữa các nhóm màu đèn: sao trời, cầu, địa danh trắng không thuộc phạm vi
    check(colored > 0 && t.warm / colored >= 0.6, `warmDominant: vàng ấm ${(100 * t.warm / colored).toFixed(1)} % số pixel có màu đèn (cần ≥ 60 %)`);
    check(t.cool / t.n >= 0.001, `coolSeen: xanh ${(100 * t.cool / t.n).toFixed(3)} % (cần ≥ 0,1 %)`);
    check(t.led / t.n >= 0.0005, `ledSeen: LED ${(100 * t.led / t.n).toFixed(3)} % (cần ≥ 0,05 %)`);
    const keys = await page.evaluate(() => {
      const a = window.__app; let lm = null, city = null;
      a.scene.traverse((o) => { if (o.name === 'rf-landmarks') lm = o.material.customProgramCacheKey(); if (!city && o.isLOD && o.levels[0].object.isInstancedMesh) city = o.levels[0].object.material.customProgramCacheKey(); });
      return { lm, city };
    });
    check(keys.lm === 'windows', `landmark: khóa địa danh "${keys.lm}"`);
    check(keys.city === 'windows-city', `landmark: khóa nhà khu phố "${keys.city}"`);
    await aim([-500, 120, -1700], [-500, 0, -1699]);
    const c = await sample(await shot(null), [0.45, 0.45, 0.55, 0.55]);
    check(c.warm === 0, `corridor: hành lang Hầm có ${c.warm} pixel đèn (cần 0)`);
  }
  check(errors.length === 0, `console không lỗi (${errors.length}): ${errors.slice(0, 3).join(' | ')}`);
} finally {
  await browser.close(); srv.close();
}
if (problems.length) { console.log(`\nKHÔNG ĐẠT: ${problems.length} mục`); process.exit(1); }
console.log('\nĐẠT tất cả');
process.exit(0);
