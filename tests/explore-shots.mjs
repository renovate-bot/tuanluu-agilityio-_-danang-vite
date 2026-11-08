// Chụp ảnh dù lượn tại điểm cất cánh (ngày/đêm) vào tests/screens/explore/ (không commit).
//   npm run build && node tests/explore-shots.mjs
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { serveDir, launch, openApp, frames } from './lib.mjs';

const out = fileURLToPath(new URL('./screens/explore/', import.meta.url));
mkdirSync(out, { recursive: true });
const srv = await serveDir(fileURLToPath(new URL('../dist/', import.meta.url)));
const browser = await launch();
try {
  const P = await openApp(browser, srv.url, { width: 960, height: 600 });
  await P.page.addStyleTag({ content: 'body > *:not(canvas) { visibility: hidden !important; }' });   // ẩn giao diện để thấy cảnh
  await P.page.evaluate(() => {
    const { exCreate, exBuildGlider, exPlaceGlider, exChase } = window.__app.exFlight;
    const { THREE, scene, camera, controls } = window.__app;
    const s = exCreate(), g = exBuildGlider(), tgt = new THREE.Vector3();
    scene.add(g); exPlaceGlider(g, s); exChase(camera, tgt, s, 1 / 60, true);
    controls.target.copy(tgt); controls.update();
    window.__shot = () => { exPlaceGlider(g, s); exChase(camera, tgt, s, 1 / 60, true); controls.target.copy(tgt); controls.update(); };
  });
  for (const [name, night] of [['takeoff-ngay', 0], ['takeoff-dem', 1]]) {
    await P.page.evaluate((v) => { window.__app.dayNight.target = v; window.__app.dayNight.night = v; }, night);
    await frames(P.page, 4);
    await P.page.evaluate(() => window.__shot());
    await frames(P.page, 3);
    await P.page.screenshot({ path: out + name + '.png' });
    console.log('đã chụp', name);
  }
  if (P.errors.length) console.log(P.errors.join('\n'));
} finally { await browser.close(); srv.close(); }
