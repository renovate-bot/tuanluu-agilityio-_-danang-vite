// Kiểm tra Hầm vượt sông Hàn (xem docs/superpowers/specs/2026-10-21-ham-vuot-song-han-design.md):
//  1. Hình học trắc dọc: chiều dài các đoạn 600/380/415 m (tổng 1.670 m), độ dốc từng đoạn, nóc hầm dìm thấp hơn đáy sông ≥ 1 m,
//     lớp phủ hầm kín dưới mặt đất, cao độ liên tục, gờ chắn ngập cao hơn mặt phố ≥ 0,95 m.
//  2. Mặt cắt địa chất: bật/tắt 3 lần, vật liệu nước/đất/… về đúng giá trị gốc (alpha, transparent, depthWrite, clippingPlanes).
//  3. Mắt thích nghi khi lái xuyên hầm: độ phơi sáng giảm trong hầm rồi trả đúng giá trị gốc khi thoát.
//  4. Mô phỏng dìm đốt hầm: đi đủ 6 trạng thái theo thứ tự rồi trả hầm về trạng thái hoàn chỉnh.
//  5. Chụp ảnh ngày/đêm các góc nhìn vào tests/screens/ (bỏ bằng --no-shots).
//  6. Không có lỗi console.
// (Tour hầm — chú thích, mặt cắt từng điểm dừng, mô phỏng dìm, đường bay — được kiểm tra trong tests/tour-check.mjs.)
//
//   npm run build && node tests/tunnel-check.mjs [--no-shots]
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { serveDir, launch, openApp, frames, waitFlight } from './lib.mjs';

const shots = !process.argv.includes('--no-shots');
const SCREENS = fileURLToPath(new URL('./screens/', import.meta.url));
const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); return ok; };

const srv = await serveDir(fileURLToPath(new URL('../dist/', import.meta.url)));
const browser = await launch();
const { page, errors } = await openApp(browser, srv.url, { width: 960, height: 540 });
try {
  // ---- 1. hình học ----
  const G = await page.evaluate(() => {
    const H = window.__app.hr.cfg, R = H.roadY, out = {};
    out.len = { immersed: H.immersedHalf * 2, cover: (H.coverHalf - H.immersedHalf) * 2, ramp: (H.rampHalf - H.coverHalf) * 2, approach: (H.approachHalf - H.rampHalf) * 2 };
    out.total = H.approachHalf * 2;
    out.elements = H.elementEdges.map((e, i, a) => (i ? e - a[i - 1] : 0)).slice(1);
    const grade = { immersed: 0, cover: 0, ramp: 0 };
    let jump = 0, roofMargin = Infinity, landCover = Infinity, peak = -Infinity, peakX = 0;
    for (let x = 0.25; x <= 900; x += 0.25) {
      const g = Math.abs(R(x) - R(x - 0.25)) / 0.25; jump = Math.max(jump, Math.abs(R(x) - R(x - 0.25)));
      if (x <= H.immersedHalf) grade.immersed = Math.max(grade.immersed, g);
      else if (x <= H.coverHalf) grade.cover = Math.max(grade.cover, g);
      else if (x <= 705) grade.ramp = Math.max(grade.ramp, g);
      if (x <= 262) roofMargin = Math.min(roofMargin, H.bedY(x) - H.minCover - (R(x) + H.roofTop));
      if (x <= H.coverHalf) landCover = Math.min(landCover, 2.5 - (R(x) + H.roofTop));
      if (R(x) > peak) { peak = R(x); peakX = x; }
    }
    return { ...out, grade, limit: H.maxGrade, jump, roofMargin, landCover, sill: peak - 2.6, peakX, sym: Math.abs(R(123) - R(-123)) };
  });
  check(G.len.immersed === 600 && G.len.cover === 380 && G.len.ramp === 415 && G.len.approach === 275, `chiều dài các đoạn sai: ${JSON.stringify(G.len)}`);
  check(G.total === 1670, `tổng chiều dài ${G.total} ≠ 1670`);
  check(G.elements.length === 5 && G.elements.every((l) => l === 120), `5 đốt × 120 m sai: ${G.elements}`);
  check(G.grade.immersed <= G.limit.immersed + 1e-9, `dốc đoạn dìm ${(G.grade.immersed * 100).toFixed(2)}% > ${G.limit.immersed * 100}%`);
  check(G.grade.cover <= G.limit.cover + 1e-9, `dốc hầm kín bờ ${(G.grade.cover * 100).toFixed(2)}% > ${G.limit.cover * 100}%`);
  check(G.grade.ramp <= G.limit.ramp + 1e-9, `dốc hầm hở ${(G.grade.ramp * 100).toFixed(2)}% > ${G.limit.ramp * 100}%`);
  check(G.roofMargin >= 0, `nóc hầm dìm vượt giới hạn cách đáy sông ≥ 1 m (thiếu ${(-G.roofMargin).toFixed(2)} m)`);
  check(G.landCover >= 0.8, `lớp phủ hầm kín dưới mặt đất chỉ ${G.landCover.toFixed(2)} m < 0,8 m`);
  check(G.jump <= 0.03, `cao độ nhảy ${G.jump.toFixed(3)} m trong 0,25 m`);
  check(G.sill >= 0.95, `gờ chắn ngập chỉ cao hơn mặt phố ${G.sill.toFixed(2)} m`);
  check(G.sym === 0, 'trắc dọc không đối xứng qua tim sông');
  console.log(`hình học: dốc dìm ${(G.grade.immersed * 100).toFixed(2)}% · hầm kín bờ ${(G.grade.cover * 100).toFixed(2)}% · hầm hở ${(G.grade.ramp * 100).toFixed(2)}% · dư cao độ nóc/đáy sông ${G.roofMargin.toFixed(2)} m · phủ bờ ${G.landCover.toFixed(2)} m · gờ ngập +${G.sill.toFixed(2)} m tại |x|=${G.peakX}`);

  await page.click('button[data-bridge="hr"]'); await waitFlight(page);
  await page.click('button[data-view="hrOverview"]'); await waitFlight(page); await frames(page, 2);

  // ---- 2. mặt cắt: bật/tắt 3 lần ----
  const snap = () => page.evaluate(() => {
    const { scene } = window.__app; let water = null, land = null;
    scene.traverse((o) => {
      if (o.material?.uniforms?.alpha && o.material.uniforms.waterColor) water = o.material;
      if (!land && o.isMesh && o.material?.color?.getHex?.() === 0x9a9f86) land = o.material;
    });
    return { w: [water.transparent, water.depthWrite, water.uniforms.alpha.value, water.uniforms.uCutOn.value], l: [land.clippingPlanes === null, land.clipIntersection], exp: window.__app.renderer.toneMappingExposure, geo: scene.getObjectByName('hr-geology')?.visible, hrBed: window.__app.hr.riverbed.group.visible };
  });
  const base = await snap();
  for (let i = 0; i < 3; i++) {
    await page.click('#btnHrSection'); await frames(page, 2);
    const on = await snap();
    check(on.w[0] && !on.w[1] && on.w[3] === 1 && !on.l[0] && on.l[1] && on.geo && on.hrBed, `bật mặt cắt lần ${i + 1}: trạng thái không đúng ${JSON.stringify(on)}`);
    await page.click('#btnHrSection'); await frames(page, 2);
    const off = await snap();
    check(JSON.stringify(off.w) === JSON.stringify(base.w) && JSON.stringify(off.l) === JSON.stringify(base.l) && !off.geo && !off.hrBed, `tắt mặt cắt lần ${i + 1}: chưa về trạng thái gốc ${JSON.stringify(off)} ≠ ${JSON.stringify(base)}`);
  }

  // ---- 3. mắt thích nghi ----
  await page.evaluate(() => { window.__app.dayNight.target = 0; window.__app.dayNight.night = 0; });
  await page.click('button[data-view="hrDrive"]');
  await page.evaluate(() => { window.__app.hrDrive.x = 0; });
  await page.evaluate(() => new Promise((ok) => { let n = 0; const f = () => (++n > 60 ? ok() : requestAnimationFrame(f)); f(); }));
  const inside = await page.evaluate(() => window.__app.renderer.toneMappingExposure);
  check(inside < 0.55 * 0.8, `độ phơi sáng trong hầm ${inside.toFixed(3)} chưa giảm so với 0,55`);
  await page.click('button[data-view="hrOverview"]'); await waitFlight(page); await frames(page, 2);
  const after = await page.evaluate(() => window.__app.renderer.toneMappingExposure);
  check(after === 0.55, `độ phơi sáng sau khi thoát ${after} ≠ 0,55`);

  // ---- 4. mô phỏng dìm đốt hầm (đẩy thời gian bằng tay, không cần dựng hình) ----
  const sim = await page.evaluate(() => {
    const { hr, camera } = window.__app, c = hr.ctrl, seen = [], samples = {};
    c.addEventListener('stateChange', (e) => seen.push(e.detail));
    const water = (() => { let w = null; window.__app.scene.traverse((o) => { if (o.material?.uniforms?.alpha && o.material.uniforms.waterColor) w = o.material; }); return w; })();
    c.start(400);
    let guard = 0;
    while (c.state !== 'IDLE' && guard++ < 20000) {
      hr.update(0.05, guard * 0.05, camera);
      const s = c.state, mid = hr.bores.mid;
      if (!samples[s]) samples[s] = { lift: mid.group.position.y, z: mid.group.position.z, fit: mid.fit.visible, sim: hr.sim.visible, glass: water.transparent, life: hr.life.visible, rb: hr.riverbed.ribbons[2].visible };
    }
    hr.update(0.05, 0, camera);
    const mid = hr.bores.mid;
    return { seen, samples, final: { pos: mid.group.position.toArray(), fit: mid.fit.visible, sim: hr.sim.visible, glass: water.transparent, rbScale: hr.riverbed.ribbons[2].scale.z, rb: hr.riverbed.ribbons[2].visible }, guard };
  });
  check(JSON.stringify(sim.seen) === JSON.stringify(['FLOAT_IN', 'POSITION', 'BALLAST', 'PULL_JOINT', 'BACKFILL', 'DONE', 'IDLE']), `thứ tự trạng thái dìm sai: ${sim.seen}`);
  check(sim.samples.FLOAT_IN?.lift > 8 && sim.samples.FLOAT_IN.z < -100 && !sim.samples.FLOAT_IN.fit && sim.samples.FLOAT_IN.sim && sim.samples.FLOAT_IN.glass && !sim.samples.FLOAT_IN.life && !sim.samples.FLOAT_IN.rb, `FLOAT_IN không đúng: ${JSON.stringify(sim.samples.FLOAT_IN)}`);
  check(sim.samples.BALLAST?.lift > 0.4 && sim.samples.BALLAST.lift <= 8.4 && sim.samples.BALLAST.z === 0, `BALLAST không đúng: ${JSON.stringify(sim.samples.BALLAST)}`);
  check(sim.final.pos.every((v) => Math.abs(v) < 1e-9) && sim.final.fit && !sim.final.sim && !sim.final.glass && sim.final.rbScale === 1 && sim.final.rb, `hầm chưa trở về trạng thái hoàn chỉnh: ${JSON.stringify(sim.final)}`);
  console.log(`mô phỏng dìm: ${sim.seen.join(' → ')}`);

  // ---- 5. ảnh chụp ----
  if (shots) {
    fs.mkdirSync(SCREENS, { recursive: true });
    const shot = async (name) => { await frames(page, 3); await page.screenshot({ path: `${SCREENS}${name}.png` }); };
    for (const night of [0, 1]) {
      await page.evaluate((v) => { window.__app.dayNight.target = v; window.__app.dayNight.night = v; }, night);
      const tag = night ? 'dem' : 'ngay';
      for (const view of ['hrOverview', 'hrCutaway', 'hrPortalW', 'hrPortalE', 'hrGallery']) {
        await page.click(`button[data-view="${view}"]`); await waitFlight(page); await shot(`hr-${view}-${tag}`);
      }
      await page.click('button[data-view="hrDrive"]');
      for (const [x, name] of [[-640, 'ramp'], [-300, 'trong-ham']]) { await page.evaluate((x) => { window.__app.hrDrive.x = x; }, x); await shot(`hr-hrDrive-${name}-${tag}`); }
      await page.click('button[data-view="hrOverview"]'); await waitFlight(page);
    }
    // một khung giữa mô phỏng dìm (giai đoạn BALLAST)
    await page.evaluate(() => { window.__app.dayNight.target = 0; window.__app.dayNight.night = 0; });
    await page.click('button[data-view="hrOverview"]'); await waitFlight(page);
    await page.evaluate(() => { const c = window.__app.hr.ctrl; c.start(1); c.go('BALLAST'); c.speed = 0.0001; c.t = 50; c.update(0); });
    await shot('hr-dim-dot-ham');
    await page.evaluate(() => { const c = window.__app.hr.ctrl; c.speed = 400; });
    await page.waitForFunction(() => window.__app.hr.ctrl.state === 'IDLE', null, { timeout: 120000 });
    console.log(`đã chụp ảnh vào ${SCREENS}`);
  }
} finally {
  await browser.close(); srv.close();
}
if (errors.length) { console.log('Lỗi console:', errors); problems.push('có lỗi console'); }
if (problems.length) { console.log('\nLỖI:'); problems.forEach((p) => console.log(' - ' + p)); process.exit(1); }
console.log('Hầm vượt sông Hàn: tất cả kiểm tra đạt.');
