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

  /* ---------- crowdDay ---------- */
  const crowdState = () => page.evaluate(() => {
    const a = window.__app, T = a.THREE, f = a.boats.fleets().find((x) => x.mesh.name === 'boats-river').mesh, M = new T.Matrix4(), P = new T.Vector3(), Q = new T.Quaternion(), S = new T.Vector3();
    return a.boats.crowd.map((c, k) => { f.getMatrixAt(a.boats.crowdFirst + k, M); M.decompose(P, Q, S); return { alpha: a.boats.crowdAlpha()[k], scale: S.x, x: P.x, z: P.z, sx: c.x, sz: c.z, ex: a.boats.inExclusion(P.x, P.z, c.len / 2) }; });
  });
  let cs = await crowdState();
  check(cs.length === 15 && cs.every((c) => c.alpha === 0 && c.scale === 0), `crowdDay: ban ngày 15 tàu tụ tập đều ẩn (${cs.filter((c) => c.scale > 0).length} đang hiện)`);

  /* ---------- crowdNight ---------- */
  await setNight(1);
  await page.waitForFunction(() => window.__app.boats.crowdAlpha().every((x) => x === 1), null, { timeout: 600000 }); await frames(page, 2); cs = await crowdState();
  const drift = await page.evaluate(() => window.__app.boats.drift);
  const lens = await page.evaluate(() => window.__app.boats.crowd.map((c) => c.len)), a0len = (c) => lens[cs.indexOf(c)];
  check(cs.length === 15 && cs.every((c) => c.alpha === 1 && Math.abs(c.scale / a0len(c) - 1) < 1e-4), `crowdNight: ban đêm đủ 15 tàu hiện (${cs.filter((c) => c.alpha === 1).length})`);
  check(cs.length === 15 && cs.every((c) => Math.hypot(c.x - c.sx, c.z - c.sz) <= drift + 1), 'crowdNight: tàu ở quanh chỗ đậu (≤ drift + 1 m)');
  check(cs.length === 15 && cs.every((c) => !c.ex), 'crowdNight: không tàu nào trong vùng cấm');

  /* ---------- crowdRamp ---------- */
  await setNight(0);
  await page.waitForFunction(() => window.__app.boats.crowdAlpha().every((x) => x === 0), null, { timeout: 600000 });
  const ramp = await page.evaluate(() => new Promise((ok) => {
    const a = window.__app; a.dayNight.target = 1; let n = 0, mixed = 0, sizes = true;
    const f = () => { const al = a.boats.crowdAlpha(); if (al.some((x) => x > 0) && al.some((x) => x === 0)) mixed++; if (al.some((x) => x !== 0 && x !== 1)) sizes = false; (++n >= 2000 || al.every((x) => x === 1) ? ok({ mixed, n, sizes }) : requestAnimationFrame(f)); };
    requestAnimationFrame(f);
  }));
  check(ramp.mixed >= 40 && ramp.sizes, `crowdRamp: tàu hiện lần lượt, đủ kích thước, trong ≥ 40 khung (${ramp.mixed}/${ramp.n} khung so le)`);

  /* ---------- crowdStorm ---------- */
  await setNight(1);
  await setWx(page, 'storm');
  await page.waitForFunction(() => window.__app.weather.fx().boatAway >= 1, null, { timeout: 600000 }); await frames(page, 2);
  const stormA = await page.evaluate(() => window.__app.boats.crowdAlpha());
  check(stormA.length === 15 && stormA.every((x) => x === 0), `crowdStorm: bão thì mọi tàu tụ tập về bến (${stormA.filter((x) => x > 0).length} còn)`);
  await setWx(page, 'now');
  await page.waitForFunction(() => window.__app.weather.fx().boatAway <= 0 && window.__app.boats.crowdAlpha().every((x) => x === 1), null, { timeout: 600000 }); await frames(page, 2);
  const backA = await page.evaluate(() => window.__app.boats.crowdAlpha());
  check(backA.length === 15 && backA.every((x) => x === 1), `crowdStorm: hết bão thì 15 tàu trở lại (${backA.filter((x) => x === 1).length})`);

  /* ---------- noFlicker ---------- */
  const fs = await page.evaluate(() => window.__app.boats.fleets()[0].mesh.material.userData.fs ?? '');
  check(fs.includes('uNight') && !/uTime|time/i.test(fs.replace(/uNight/g, '')), 'noFlicker: đèn tàu chỉ phụ thuộc uNight, không theo thời gian');

  /* ---------- ledBright + nightShots ---------- */
  await page.evaluate(() => { const a = window.__app; a.camera.position.set(0, 60, 420); a.controls.target.set(0, 0, -100); a.controls.update(); });
  await frames(page, 4);
  const b64 = (await page.screenshot(NO_SHOTS ? {} : { path: `${SCREENS}boats-night-dragon.png` })).toString('base64');
  await page.evaluate(() => { window.__app.boats.fleets().find((x) => x.mesh.name === 'boats-river').mesh.visible = false; }); await frames(page, 2);
  const off64 = (await page.screenshot()).toString('base64');
  await page.evaluate(() => { window.__app.boats.fleets().find((x) => x.mesh.name === 'boats-river').mesh.visible = true; }); await frames(page, 2);
  // chỉ tính điểm ảnh do tàu đóng góp (ảnh có tàu − ảnh ẩn đội tàu chung), để đèn thành phố không làm test đạt hộ
  const led = await page.evaluate(async ([b64, off64]) => {
    const load = async (b) => { const bm = await createImageBitmap(await (await fetch(`data:image/png;base64,${b}`)).blob()); const c = new OffscreenCanvas(bm.width, bm.height), g = c.getContext('2d'); g.drawImage(bm, 0, 0); return g.getImageData(0, 0, bm.width, bm.height); };
    const d = await load(b64), o = await load(off64), W = d.width, H = d.height, y0 = Math.floor(H * 0.3), hues = [0, 0, 0, 0, 0, 0];
    let streak = 0;
    for (let x = 0; x < W; x++) { let run = 0; for (let y = y0; y < H; y++) { const i = (y * W + x) * 4, R = d.data[i], G = d.data[i + 1], B = d.data[i + 2], mx = Math.max(R, G, B), mn = Math.min(R, G, B);
      const boat = Math.abs(R - o.data[i]) + Math.abs(G - o.data[i + 1]) + Math.abs(B - o.data[i + 2]) > 90 && mx > 150;
      if (boat) { run++; streak = Math.max(streak, run); } else run = 0;
      if (boat && mx - mn > 60) { let h = 0; if (mx === R) h = ((G - B) / (mx - mn) + 6) % 6; else if (mx === G) h = (B - R) / (mx - mn) + 2; else h = (R - G) / (mx - mn) + 4; hues[Math.floor(h) % 6]++; } } }
    return { hues, streak };
  }, [b64, off64]);
  check(led.hues.filter((n) => n >= 20).length >= 3, `ledBright: vùng sông có đèn ≥ 3 nhóm màu (${led.hues.join('/')})`);
  check(led.streak >= 15, `ledBright: có vệt sáng dọc ≥ 15 px trên sông (${led.streak})`);
  if (!NO_SHOTS) { await aimAt([0, 0, -1080], [60, 55, 330]); await page.screenshot({ path: `${SCREENS}boats-night-songhan.png` }); }

  check(errors.length === 0, `không lỗi console (${errors.join(' | ')})`);
} finally {
  await browser.close(); srv.close();
}
console.log(problems.length ? `\n${problems.length} mục LỖI` : '\nTất cả ĐẠT');
process.exit(problems.length ? 1 : 0);
