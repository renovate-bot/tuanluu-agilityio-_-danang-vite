// Ảnh tự xem Giai đoạn 2 của Vòng quay Mặt Trời (hình học tĩnh), cùng góc với ảnh tham chiếu docs/superpowers/specs/tham-chieu/sun-wheel/
// (a1/a2 flycam từ Nam Đông Nam, n1 chính diện, n2 chân nhìn lên, n3 nhìn nghiêng) + đếm draw call phần vòng quay.
//
//   npm run build && node tests/sunwheel-gd2-shots.mjs      → tests/screens/sunwheel-gd2/*.png
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { serveDir, launch, openApp, frames, pickView } from './lib.mjs';

const OUT = fileURLToPath(new URL('./screens/sunwheel-gd2/', import.meta.url));
fs.mkdirSync(OUT, { recursive: true });
const srv = await serveDir(fileURLToPath(new URL('../dist/', import.meta.url)));
const browser = await launch();
const { page, errors } = await openApp(browser, srv.url, { width: 960, height: 600 });
const SHOTS_ONLY = process.argv.includes('--shots-only');   // chỉ chụp ảnh, bỏ phần đếm draw call
await page.addStyleTag({ content: '.panel, #hud, .hud, #tourCaption { display: none !important; }' });   // ẩn bảng điều khiển để thấy cảnh
const shot = async (name) => { await frames(page, 3); await page.screenshot({ path: `${OUT}${name}.png` }); };
async function setNight(v) {
  await page.evaluate((v) => { window.__app.dayNight.target = v; window.__app.dayNight.night = v; }, v);
  await page.waitForFunction((v) => Math.abs(window.__app.dayNight.night - v) < 1e-6, v, { timeout: 60000 });
  await frames(page, 3);
}
/* đặt camera theo hệ cục bộ của vòng quay */
const camLocal = (p, t) => page.evaluate(([p, t]) => {
  const { camera, controls, sunWheel: W, THREE } = window.__app;
  W.group.updateMatrixWorld(true);
  controls.maxPolarAngle = Math.PI * 0.97;
  camera.position.copy(W.group.localToWorld(new THREE.Vector3(...p))); controls.target.copy(W.group.localToWorld(new THREE.Vector3(...t))); controls.update();
}, [p, t]);
/* draw call có / không có vòng quay (trung vị 3 khung) */
const delta = () => page.evaluate(async () => {
  const { renderer, sunWheel: W } = window.__app;
  const f = () => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
  const med = async () => { const xs = []; for (let i = 0; i < 3; i++) { await f(); xs.push(renderer.info.render.calls); } return xs.sort((a, b) => a - b)[1]; };
  const on = await med(); W.group.visible = false; const off = await med(); W.group.visible = true; await f();
  return { on, off, d: on - off, details: W.details.visible };
});

const VIEWS = {
  a1: [[-90, 110, 220], [0, 50, 0]], n1: [[0, 8, 230], [0, 55, 0]], n2: [[8, 17.5, 26], [0, 72, 0]], n3: [[-200, 10, 120], [0, 50, 0]],
  top: [[0, 140, 160], [0, 60, 0]]
};
const res = {};
try {
  for (const night of [0, 1]) {
    await setNight(night);
    const tag = night ? 'dem' : 'ngay';
    for (const [k, [p, t]] of Object.entries(VIEWS)) { await camLocal(p, t); await shot(`${k}-${tag}`); if (!SHOTS_ONLY) res[`${k}|${tag}`] = await delta(); }
    if (SHOTS_ONLY) continue;
    for (const [b, v] of [['ttl', 'ttlBoth'], ['sh', 'shOverview'], ['dragon', 'bird'], ['tp', 'tpBay']]) {
      await pickView(page, b, v); await frames(page, 4);
      if (!night && v === 'ttlBoth') await shot(`old-${v}-${tag}`);
      res[`${v}|${tag}`] = await delta();
    }
  }
  res.stats = await page.evaluate(() => window.__app.sunWheel.stats);
} finally { await browser.close(); srv.close(); }
console.log(JSON.stringify(res, null, 1));
console.log('lỗi console:', errors);
