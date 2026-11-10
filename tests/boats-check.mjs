// Kiểm tra tàu thuyền sông Hàn (docs/superpowers/specs/2026-11-10-tau-thuyen-song-han-design.md).
// Ngày: fleetOnly (không còn khối hộp cũ, 5 đội tàu), depthPatched (bóng không vẽ chồng kiểu), randKept (chuỗi rand() giữ nguyên), dayShots.
// Đêm: crowdDay, crowdNight, crowdRamp, crowdStorm (tàu tụ tập G5/G6), ledBright (LED nhiều màu + vệt trên sông), noFlicker, nightShots.
//
//   npm run build && node tests/boats-check.mjs [--no-shots]
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { serveDir, launch, openApp, frames } from './lib.mjs';
import { setWx } from './weather-lib.mjs';

const NO_SHOTS = process.argv.includes('--no-shots');
const SCREENS = fileURLToPath(new URL('./screens/', import.meta.url));
mkdirSync(SCREENS, { recursive: true });
const problems = [];
const check = (ok, msg) => { console.log(`${ok ? 'ĐẠT ' : 'LỖI '} ${msg}`); if (!ok) problems.push(msg); return ok; };

// Mốc đo trên main 43cec90: speed của 7 tàu chạy chung (2 lời gọi rand() mỗi tàu: speed rồi len)
const MAIN_SPEEDS = [4.834048458375037, 3.4622229826636612, 3.367667659651488, 4.561683705076575, 4.302534147165716, 3.222870459780097, 4.6476020980626345];
const MAIN_LEN_R = [22.991304574068636, 24.96401322260499, 22.650000368710607, 24.13506194204092, 22.176610487047583, 19.504561596084386, 26.657041946426034].map((l) => (l - 18) / 10);

const srv = await serveDir(fileURLToPath(new URL('../dist/', import.meta.url)));
const browser = await launch();
const { page, errors } = await openApp(browser, srv.url, { width: 960, height: 540 });

const setNight = async (v) => {
  await page.evaluate((v) => { window.__app.dayNight.target = v; window.__app.dayNight.night = v; }, v);
  await page.waitForFunction((v) => Math.abs(window.__app.dayNight.night - v) < 1e-6, v, { timeout: 60000 });
  await frames(page, 3);
};
/* Vị trí thế giới của instance i trong đội tàu f */
const boatPos = (f, i) => page.evaluate(([f, i]) => {
  const a = window.__app, T = a.THREE, m = a.boats.fleets().find((x) => x.mesh.name === f).mesh, M = new T.Matrix4(); m.updateWorldMatrix(true, false);
  m.getMatrixAt(i, M); M.premultiply(m.matrixWorld); const p = new T.Vector3().setFromMatrixPosition(M); return [p.x, p.y, p.z];
}, [f, i]);
const aimAt = async (p, off) => {
  await page.evaluate(([p, o]) => { const a = window.__app; a.camera.position.set(p[0] + o[0], p[1] + o[1], p[2] + o[2]); a.controls.target.set(p[0], p[1] + 3, p[2]); a.controls.update(); }, [p, off]);
  await frames(page, 3);
};

try {
  await page.evaluate(() => document.querySelectorAll('body *').forEach((e) => { if (!e.matches('canvas') && !e.querySelector('canvas')) e.style.visibility = 'hidden'; }));
  await setNight(0);

  /* ---------- fleetOnly ---------- */
  const fo = await page.evaluate(() => {
    const a = window.__app, legacy = [];
    a.scene.traverse((o) => { if (o.isInstancedMesh && o.geometry.type === 'BoxGeometry' && ['f4f1ea', '2f6f8f', 'c23b2a'].includes(o.material.color?.getHexString())) legacy.push(o.name || o.uuid); });
    const fleets = a.boats?.fleets() ?? [];
    return { legacy: legacy.length, fleets: fleets.length, allFleetMat: fleets.every((f) => f.mesh.material.name === 'boatFleet'), inScene: fleets.every((f) => { let p = f.mesh; while (p.parent) p = p.parent; return p === a.scene; }) };
  });
  check(fo.legacy === 0, `fleetOnly: không còn InstancedMesh khối hộp tàu cũ (còn ${fo.legacy})`);
  check(fo.fleets === 5 && fo.allFleetMat && fo.inScene, `fleetOnly: 5 đội tàu dùng vật liệu boatFleet, đều trong scene (${fo.fleets})`);
  const names = await page.evaluate(() => (window.__app.boats?.fleets() ?? []).map((f) => f.mesh.name).sort().join(','));
  check(names === 'boats-river,sh-boats,sh-tall-ship-boat,tp-boats,ttl-boats', `fleetOnly: tên đội tàu (${names})`);

  /* ---------- depthPatched ---------- */
  await frames(page, 4);
  const dp = await page.evaluate(() => (window.__app.boats?.fleets() ?? []).map((f) => ({ depth: !!f.mesh.customDepthMaterial, vs: f.mesh.customDepthMaterial?.userData.vs ?? '', mvs: f.mesh.material.userData.vs ?? '' })));
  check(dp.length === 5 && dp.every((d) => d.depth && d.vs.includes('aPart') && d.mvs.includes('aPart')), 'depthPatched: mọi đội tàu có customDepthMaterial, shader cả hai đều có aPart');

  /* ---------- randKept ---------- */
  const rk = await page.evaluate(() => (window.__app.boats?.running() ?? []).map((b) => ({ speed: b.speed, len: b.len, type: b.type })));
  check(rk.length === 7 && rk.every((b, i) => Math.abs(b.speed - MAIN_SPEEDS[i]) < 1e-12), `randKept: speed 7 tàu trùng main (${rk.map((b) => b.speed.toFixed(3)).join(', ')})`);
  const lenOk = await page.evaluate(([rk, R]) => { const T = window.__app.boats.types; return rk.every((b, i) => Math.abs(b.len - (T[b.type].len[0] + R[i] * (T[b.type].len[1] - T[b.type].len[0]))) < 1e-9); }, [rk, MAIN_LEN_R]);
  check(lenOk, 'randKept: len = min + r·(max − min) với r lấy từ rand() như main');

  /* ---------- dayShots ---------- */
  if (!NO_SHOTS) for (const [f, name] of [['boats-river', 'dragon'], ['sh-boats', 'songhan'], ['tp-boats', 'tp'], ['ttl-boats', 'ttl']]) {
    await aimAt(await boatPos(f, 0), [24, 9, 30]);
    await page.screenshot({ path: `${SCREENS}boats-day-${name}.png` });
  }

  check(errors.length === 0, `không lỗi console (${errors.join(' | ')})`);
} finally {
  await browser.close(); srv.close();
}
console.log(problems.length ? `\n${problems.length} mục LỖI` : '\nTất cả ĐẠT');
process.exit(problems.length ? 1 : 0);
