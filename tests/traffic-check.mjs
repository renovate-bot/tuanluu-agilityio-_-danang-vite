// Kiểm tra xe cộ thực tế hơn (docs/superpowers/specs/2026-11-10-xe-co-thuc-te-design.md): siêu xe, xe tay ga có người lái, buýt nhỏ vàng.
//  1. fleetOnly: đúng 5 hệ xe (hr-traffic, sh-traffic, tp-traffic, traffic-city, ttl-traffic), đều dùng vật liệu vehicleFleet; không còn InstancedMesh khối hộp cỡ một hệ xe.
//  2. counts: khu phố 536 xe, sh-traffic 52, hr-traffic 348.
//  3. randKept: speed 7 tàu chạy chung trùng main (buildBoats chạy ngay sau buildTraffic ⇒ số lời gọi rand() của xe không đổi).
//  4. depthPatched: mỗi hệ xe có customDepthMaterial, shader cả hai vật liệu đều có aPart (bóng không vẽ chồng 3 loại).
//  5. lamps: đèn bật trong shader theo uNight (step), không còn mesh đèn headLamp / tailLamp riêng.
//  6. cutaway: vật liệu xe có 4 mặt cắt (chế độ mặt cắt hầm bóc được xe).
//  7. moving: sau 30 khung, xe 0 của traffic-city đã chạy, scale 1.
//  8. laneToggle: tắt làn PATHS.ttl (nút #btnTtlLife) ⇒ mọi xe trên làn đó scale 0; bật lại ⇒ scale 1.
//  9. stormClear: bão ⇒ xe trên Cầu Rồng (axis) dọn hết, xe Bạch Đằng vẫn chạy; hết bão ⇒ xe Cầu Rồng trở lại.
// 10. Không lỗi console.
// 11. Ảnh (bỏ bằng --no-shots) tests/screens/traffic-{ngay,dem}-*.png: siêu xe (trước, sau) / xe tay ga / buýt trên Cầu Rồng nhìn gần (~12 m), trung cảnh (~80 m) và toàn cảnh Cầu Rồng, đường Bạch Đằng, Cầu sông Hàn, trong hầm.
//
//   npm run build && npm run test:traffic [-- --no-shots]
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { serveDir, launch, openApp, frames, waitFlight, tap } from './lib.mjs';
import { setWx } from './weather-lib.mjs';

const NO_SHOTS = process.argv.includes('--no-shots');
const SCREENS = fileURLToPath(new URL('./screens/', import.meta.url));
mkdirSync(SCREENS, { recursive: true });
const problems = [];
const check = (ok, msg) => { console.log(`${ok ? 'ĐẠT ' : 'LỖI '} ${msg}`); if (!ok) problems.push(msg); return ok; };

// Mốc đo trên main 43cec90 (chép từ tests/boats-check.mjs): speed của 7 tàu chạy chung
const MAIN_SPEEDS = [4.834048458375037, 3.4622229826636612, 3.367667659651488, 4.561683705076575, 4.302534147165716, 3.222870459780097, 4.6476020980626345];

const srv = await serveDir(fileURLToPath(new URL('../dist/', import.meta.url)));
const browser = await launch();
const { page, errors } = await openApp(browser, srv.url, { width: 960, height: 540 });

const setNight = async (v) => {
  await page.evaluate((v) => { window.__app.dayNight.target = v; window.__app.dayNight.night = v; }, v);
  await page.waitForFunction((v) => Math.abs(window.__app.dayNight.night - v) < 1e-6, v, { timeout: 60000 });
  await frames(page, 3);
};
const hideUi = (on) => page.evaluate((on) => document.querySelectorAll('body *').forEach((e) => { if (!e.matches('canvas') && !e.querySelector('canvas')) e.style.visibility = on ? 'hidden' : ''; }), on);
/* Scale (trục X của ma trận) của các instance trong một hệ xe, lọc theo hàm chọn trên danh sách xe khu phố */
const cityScales = (pathKey) => page.evaluate((k) => {
  const a = window.__app, T = a.THREE, t = a.traffic, m = t.fleets().find((f) => f.mesh.name === 'traffic-city').mesh, M = new T.Matrix4(), P = new T.Vector3(), Q = new T.Quaternion(), S = new T.Vector3();
  return t.city().map((v, i) => [v, i]).filter(([v]) => v.path === t.paths[k]).map(([, i]) => { m.getMatrixAt(i, M); M.decompose(P, Q, S); return S.x; });
}, pathKey);

try {
  await setNight(0);

  /* ---------- 1. fleetOnly ---------- */
  const fo = await page.evaluate(() => {
    // 4 khối hộp cũ của một hệ xe nằm cùng nhóm cha với hệ đó; chỉ xét trong nhóm cha vì cụm nhà khu phố (city.ts) có cụm trùng 348 khối hộp
    const a = window.__app, fleets = a.traffic.fleets(), legacy = [];
    for (const f of fleets) for (const o of f.mesh.parent.children) if (o.isInstancedMesh && o.geometry.type === 'BoxGeometry' && o.count === f.mesh.count) legacy.push(`${f.mesh.name}:${o.name || o.uuid}`);
    const inScene = fleets.every((f) => { let p = f.mesh; while (p.parent) p = p.parent; return p === a.scene; });
    return { names: fleets.map((f) => f.mesh.name).sort().join(','), mat: fleets.every((f) => f.mesh.material.name === 'vehicleFleet'), legacy, inScene };
  });
  check(fo.names === 'hr-traffic,sh-traffic,tp-traffic,traffic-city,ttl-traffic', `fleetOnly: tên 5 hệ xe (${fo.names})`);
  check(fo.mat && fo.inScene, 'fleetOnly: mọi hệ xe dùng vật liệu vehicleFleet, đều trong scene');
  check(fo.legacy.length === 0, `fleetOnly: không còn InstancedMesh khối hộp cỡ một hệ xe (${fo.legacy.join(', ')})`);

  /* ---------- 2. counts ---------- */
  const ct = await page.evaluate(() => { const t = window.__app.traffic, c = (n) => t.fleets().find((f) => f.mesh.name === n)?.mesh.count; return { city: t.city().length, cityMesh: c('traffic-city'), sh: c('sh-traffic'), hr: c('hr-traffic') }; });
  check(ct.city === 536 && ct.cityMesh === 536, `counts: khu phố 536 xe (${ct.city}, mesh ${ct.cityMesh})`);
  check(ct.sh === 52 && ct.hr === 348, `counts: sh-traffic 52 (${ct.sh}), hr-traffic 348 (${ct.hr})`);

  /* ---------- 3. randKept ---------- */
  const rk = await page.evaluate(() => (window.__app.boats?.running() ?? []).map((b) => b.speed));
  check(rk.length === 7 && rk.every((s, i) => Math.abs(s - MAIN_SPEEDS[i]) < 1e-12), `randKept: speed 7 tàu trùng main (${rk.map((s) => s.toFixed(3)).join(', ')})`);

  /* ---------- 4. depthPatched ---------- */
  await frames(page, 4);
  const dp = await page.evaluate(() => window.__app.traffic.fleets().map((f) => ({ name: f.mesh.name, depth: !!f.mesh.customDepthMaterial, vs: f.mesh.customDepthMaterial?.userData.vs ?? '', mvs: f.mesh.material.userData.vs ?? '' })));
  check(dp.length === 5 && dp.every((d) => d.depth && d.vs.includes('aPart') && d.mvs.includes('aPart')), `depthPatched: mọi hệ xe có customDepthMaterial, shader cả hai có aPart (${dp.filter((d) => !(d.depth && d.vs.includes('aPart') && d.mvs.includes('aPart'))).map((d) => d.name).join(', ') || 'đủ'})`);

  /* ---------- 5. lamps ---------- */
  const lp = await page.evaluate(() => {
    const a = window.__app, fs = a.traffic.material.userData.fs ?? '', old = [];
    a.scene.traverse((o) => { const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []; if (ms.some((m) => m.name === 'headLamp' || m.name === 'tailLamp')) old.push(o.name || o.type); });
    return { fs: fs.includes('uNight') && fs.includes('step('), old };
  });
  check(lp.fs, 'lamps: shader xe bật đèn theo uNight bằng step(');
  check(lp.old.length === 0, `lamps: không còn mesh dùng vật liệu headLamp / tailLamp (${lp.old.join(', ')})`);

  /* ---------- 6. cutaway ---------- */
  const cp = await page.evaluate(() => window.__app.traffic.material.clippingPlanes?.length ?? 0);
  check(cp === 4, `cutaway: vật liệu xe có 4 mặt cắt (${cp})`);

  /* ---------- 7. moving ---------- */
  const inst0 = () => page.evaluate(() => {
    const a = window.__app, T = a.THREE, m = a.traffic.fleets().find((f) => f.mesh.name === 'traffic-city').mesh, M = new T.Matrix4(), P = new T.Vector3(), Q = new T.Quaternion(), S = new T.Vector3();
    m.getMatrixAt(0, M); M.decompose(P, Q, S); return { p: P.toArray(), s: S.toArray() };
  });
  const m0 = await inst0(); await frames(page, 30); const m1 = await inst0();
  const moved = Math.hypot(m1.p[0] - m0.p[0], m1.p[1] - m0.p[1], m1.p[2] - m0.p[2]);
  check(moved > 0.1 && m1.s.every((v) => Math.abs(v - 1) < 1e-6), `moving: xe 0 khu phố chạy ${moved.toFixed(2)} m sau 30 khung, scale ${m1.s.map((v) => v.toFixed(3)).join('/')}`);

  /* ---------- 8. laneToggle ---------- */
  // TranThiLyBridge.update() chép lifeOn vào paths.ttl.hidden mỗi khung ⇒ tắt bằng nút thật #btnTtlLife (gán hidden trực tiếp bị ghi đè ngay)
  const ttlBtn = () => page.evaluate(() => document.getElementById('btnTtlLife').click());
  await ttlBtn(); await frames(page, 3);
  const off = await cityScales('ttl'), hid = await page.evaluate(() => window.__app.traffic.paths.ttl.hidden);
  check(hid && off.length > 0 && off.every((s) => s === 0), `laneToggle: tắt làn ttl (hidden = ${hid}) ⇒ ${off.length} xe scale 0 (${off.filter((s) => s !== 0).length} còn hiện)`);
  await ttlBtn(); await frames(page, 3);
  const on = await cityScales('ttl');
  check(on.length > 0 && on.every((s) => Math.abs(s - 1) < 1e-6), `laneToggle: bật lại ⇒ scale 1 (${on.filter((s) => Math.abs(s - 1) >= 1e-6).length} chưa hiện)`);

  /* ---------- 9. stormClear ---------- */
  await setWx(page, 'storm');
  await page.waitForFunction(() => window.__app.weather.fx().clear >= 1, null, { timeout: 600000 }); await frames(page, 2);
  const sAxis = await cityScales('axis'), sBd = await cityScales('bachDang');
  check(sAxis.length > 0 && sAxis.every((s) => s === 0), `stormClear: bão ⇒ ${sAxis.length} xe Cầu Rồng dọn hết (${sAxis.filter((s) => s !== 0).length} còn)`);
  check(sBd.length > 0 && sBd.every((s) => Math.abs(s - 1) < 1e-6), `stormClear: xe Bạch Đằng vẫn chạy (${sBd.filter((s) => Math.abs(s - 1) < 1e-6).length}/${sBd.length})`);
  await setWx(page, 'now');
  await page.waitForFunction(() => window.__app.weather.fx().clear <= 0, null, { timeout: 600000 }); await frames(page, 3);
  const sBack = await cityScales('axis');
  check(sBack.length > 0 && sBack.every((s) => Math.abs(s - 1) < 1e-6), `stormClear: hết bão ⇒ xe Cầu Rồng trở lại (${sBack.filter((s) => Math.abs(s - 1) < 1e-6).length}/${sBack.length})`);

  /* ---------- 11. ảnh ---------- */
  if (!NO_SHOTS) {
    // đứng yên mọi xe khu phố + Cầu sông Hàn để ảnh nhìn gần không trượt khỏi khung (khôi phục sau)
    const saved = await page.evaluate(() => { const a = window.__app, all = [...a.traffic.city(), ...a.songHan.traffic.list], sp = all.map((v) => v.speed); all.forEach((v) => { v.speed = 0; }); return sp; });
    /* Chọn xe gần giữa Cầu Rồng theo loại (chiều +X, làn ngoài cùng có xe loại đó) */
    const pick = (type) => page.evaluate((type) => { const t = window.__app.traffic, l = t.city(); let best = -1, d = 1e9; l.forEach((v, i) => { if (v.path === t.paths.axis && v.type === type && Math.abs(v.s) < d) { d = Math.abs(v.s); best = i; } }); return best; }, type);
    /* Đặt camera theo hệ tọa độ của xe: off = (về mũi xe, lên, sang phải) tính bằng m; nhìn vào giữa thân xe */
    const aimVehicle = (fleet, i, off, lookY = 1) => page.evaluate(([fleet, i, off, lookY]) => {
      const a = window.__app, T = a.THREE, m = a.traffic.fleets().find((f) => f.mesh.name === fleet).mesh, M = new T.Matrix4(), P = new T.Vector3(), Q = new T.Quaternion(), S = new T.Vector3();
      m.updateWorldMatrix(true, false); m.getMatrixAt(i, M); M.premultiply(m.matrixWorld); M.decompose(P, Q, S);
      const o = new T.Vector3(off[0], off[1], off[2]).applyQuaternion(Q);
      a.camera.position.copy(P).add(o); a.controls.target.set(P.x, P.y + lookY, P.z); a.controls.update();
    }, [fleet, i, off, lookY]);
    const shot = async (name) => { await frames(page, 3); await page.screenshot({ path: `${SCREENS}traffic-${name}.png` }); };
    const [car, bike, bus] = [await pick('car'), await pick('bike'), await pick('bus')];
    const bdI = await page.evaluate(() => { const t = window.__app.traffic, l = t.city(); let b = -1, d = 1e9; l.forEach((v, i) => { if (v.path === t.paths.bachDang && v.type === 'car' && Math.abs(v.s - 300) < d) { d = Math.abs(v.s - 300); b = i; } }); return b; });
    const shI = await page.evaluate(() => { const l = window.__app.songHan.traffic.list; let b = 0; l.forEach((v, i) => { if (Math.abs(v.s - 60) < Math.abs(l[b].s - 60)) b = i; }); return b; });
    await hideUi(true);
    for (const [night, tag] of [[0, 'ngay'], [1, 'dem']]) {
      await setNight(night);
      await aimVehicle('traffic-city', car, [7, 3, 9.5], 0.6); await shot(`${tag}-gan-sieu-xe`);
      await aimVehicle('traffic-city', car, [-8, 3.5, -8.5], 0.6); await shot(`${tag}-gan-sieu-xe-sau`);
      await aimVehicle('traffic-city', bike, [5, 2.5, 6], 0.9); await shot(`${tag}-gan-xe-may`);
      await aimVehicle('traffic-city', bus, [8, 4.5, 9], 1.4); await shot(`${tag}-gan-buyt`);
      await aimVehicle('traffic-city', car, [45, 30, 55], 0); await shot(`${tag}-trung-canh-cau-rong`);   // ~80 m: mốc G7 góc cầu gần nhất
      await page.evaluate(() => { const a = window.__app; a.camera.position.set(-90, 55, 150); a.controls.target.set(40, 5, 0); a.controls.update(); }); await shot(`${tag}-toan-canh-cau-rong`);
      await aimVehicle('traffic-city', bdI, [22, 9, -16], 1); await shot(`${tag}-bach-dang`);
      await aimVehicle('sh-traffic', shI, [16, 9, 18], 0.5); await shot(`${tag}-cau-song-han`);
    }
    await page.evaluate((sp) => { const a = window.__app; [...a.traffic.city(), ...a.songHan.traffic.list].forEach((v, i) => { v.speed = sp[i]; }); }, saved);
    // trong hầm: góc lái xe (bấm nút cần hiện giao diện)
    await hideUi(false);
    await tap(page, 'button[data-bridge="hr"]'); await waitFlight(page);
    for (const [night, tag] of [[0, 'ngay'], [1, 'dem']]) {
      await setNight(night);
      await tap(page, 'button[data-view="hrDrive"]'); await page.evaluate(() => { window.__app.hrDrive.x = -300; });
      await hideUi(true); await frames(page, 20); await shot(`${tag}-trong-ham`); await hideUi(false);
      await tap(page, 'button[data-view="hrOverview"]'); await waitFlight(page);
    }
  }

  check(errors.length === 0, `không lỗi console (${errors.join(' | ')})`);
} finally {
  await browser.close(); srv.close();
}
console.log(problems.length ? `\n${problems.length} mục LỖI` : '\nTất cả ĐẠT');
process.exit(problems.length ? 1 : 0);
