// Kiểm tra người đi bộ thực tế hơn (docs/superpowers/specs/2026-11-11-cay-va-nguoi-thuc-te-design.md, Task 5 của plan).
//  1. systems: đúng 3 hệ ttl-people 80, sh-people 76, dragon-people 70; mỗi hệ đúng 1 InstancedMesh, cùng một vật liệu peopleWalk;
//     có instanceColor (màu áo) đủ số người, aVar / aPants là thuộc tính instance.
//  2. noOldShape: không còn lưới người nào ≤ 200 đỉnh (ống trụ + cầu cũ).
//  3. moving: sau 60 khung, ≥ 60 % instance đã đổi vị trí; số instance đứng yên khớp số người 'stand' (±1);
//     mọi người thẳng đứng, người đang đi quay mặt (+X của hình) theo chiều đi.
//  4. insideSidewalk: mọi instance hiện nằm trong dải lề của cầu mình, chân đúng mặt lề (không lơ lửng, không chìm);
//     clearLamps: người Cầu Rồng có tâm ở |z| ∈ [17,3; 18,58] (ngoài hàng cột đèn |z| 17, trong lan can); standOverRiver: người đứng Cầu Rồng ở |x| ≤ 255.
//  5. stormClear: bão ⇒ giữa chừng 0 < hiện < tổng, hết thời gian dọn 0 ở cả 3 hệ; hết bão ⇒ hiện đủ.
//  6. toggleBack: bấm #btnTtlPeople hai lần (click()) ⇒ nhóm ẩn rồi hiện lại đủ 80.
//  7. dragonLod: camera xa tim Cầu Rồng 2 000 m ⇒ nhóm dragon-people ẩn; về 300 m ⇒ hiện.
//     dragonCull: gần Trần Thị Lý / Cầu sông Hàn (< 1 500 m), quay lưng lại Cầu Rồng ⇒ lưới không vẽ; nhìn vào cầu ⇒ vẽ.
//  8. randKept: speed 7 tàu chạy chung trùng main (người Cầu Rồng không chạm rand()).
//  9. Không lỗi console (kể cả lỗi biên dịch shader).
// 10. Ảnh (bỏ bằng --no-shots) tests/screens/people-*.png: lề Cầu Rồng gần ~10 m (ngày), người đứng gần đầu rồng, người chạy,
//     lề Trần Thị Lý, lề Cầu sông Hàn, Bạch Đằng, và lề Cầu Rồng ban đêm.
//
//   npm run build && npm run test:people [-- --no-shots]
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { serveDir, launch, openApp, frames } from './lib.mjs';
import { setWx } from './weather-lib.mjs';

const NO_SHOTS = process.argv.includes('--no-shots');
const SCREENS = fileURLToPath(new URL('./screens/', import.meta.url));
mkdirSync(SCREENS, { recursive: true });
const problems = [];
const check = (ok, msg) => { console.log(`${ok ? 'ĐẠT ' : 'LỖI '} ${msg}`); if (!ok) problems.push(msg); return ok; };

// Mốc đo trên main 43cec90 (chép từ tests/traffic-check.mjs): speed của 7 tàu chạy chung
const MAIN_BOAT_SPEEDS = [4.834048458375037, 3.4622229826636612, 3.367667659651488, 4.561683705076575, 4.302534147165716, 3.222870459780097, 4.6476020980626345];
const COUNTS = { 'ttl-people': 80, 'sh-people': 76, 'dragon-people': 70 };
const NAMES = Object.keys(COUNTS);
/* Dải lề theo tọa độ cục bộ của cầu (chép từ src/config.ts):
   Cầu Rồng: width 37,5, sidewalk 2,5 ⇒ |z| ∈ [16,25; 18,75]. Trần Thị Lý: deckWidth 34,5 ⇒ hw 17,25, sidewalk 3,25 ⇒ |z| ∈ [14; 17,25];
   cầu Nguyễn Văn Trỗi: nvtZ −65, nvtWidth 9 ⇒ z ∈ [−69,5; −60,5]. Cầu sông Hàn: deckWidth 12,9 ⇒ hw 6,45, sidewalk 2 ⇒ |z| ∈ [4,45; 6,45];
   Bạch Đằng (trục z): x ∈ [−286; −262] (mép kè x = −262). */
const inBand = (name, p) => {
  const az = Math.abs(p.z);
  if (name === 'dragon-people') return az >= 16.25 && az <= 18.75;
  if (name === 'ttl-people') return p.i < 46 ? az >= 14 && az <= 17.25 : p.z >= -69.5 && p.z <= -60.5;
  return p.i < 36 ? az >= 4.45 && az <= 6.45 : p.x >= -286 && p.x <= -262;
};

const srv = await serveDir(fileURLToPath(new URL('../dist/', import.meta.url)));
const browser = await launch();
const { page, errors } = await openApp(browser, srv.url, { width: 960, height: 540 });

const setNight = async (v) => {
  await page.evaluate((v) => { window.__app.dayNight.target = v; window.__app.dayNight.night = v; }, v);
  await page.waitForFunction((v) => Math.abs(window.__app.dayNight.night - v) < 1e-6, v, { timeout: 60000 });
  await frames(page, 3);
};
const hideUi = (on) => page.evaluate((on) => document.querySelectorAll('body *').forEach((e) => { if (!e.matches('canvas') && !e.querySelector('canvas')) e.style.visibility = on ? 'hidden' : ''; }), on);
const setCam = (pos, tgt) => page.evaluate(([p, t]) => { const { camera, controls } = window.__app; camera.position.set(p[0], p[1], p[2]); controls.target.set(t[0], t[1], t[2]); controls.update(); }, [pos, tgt]);
const systems = () => page.evaluate(() => window.__app.people?.systems() ?? []);
const positions = (name) => page.evaluate((n) => window.__app.people?.positions(n) ?? [], name);
// Chỗ camera thấy cả 3 cầu trong tầm cập nhật người: cách tâm Trần Thị Lý ≈ 1 310 m (< 1 500), Cầu sông Hàn ≈ 1 100 m (< 1 200), Cầu Rồng 200 m
const ALL_CAM = [[0, 200, 0], [0, 0, 100]];

try {
  await setNight(0);
  await setCam(...ALL_CAM); await frames(page, 3);

  /* ---------- 1. systems ---------- */
  const sy = await systems();
  check(sy.map((s) => s.name).join(',') === NAMES.join(','), `systems: đủ 3 hệ người (${sy.map((s) => s.name).join(',') || 'không có __app.people'})`);
  for (const n of NAMES) {
    const s = sy.find((x) => x.name === n);
    check(!!s && s.count === COUNTS[n] && s.meshes === 1, `systems: ${n} ${s?.count} người (mốc ${COUNTS[n]}), ${s?.meshes} InstancedMesh`);
    check(!!s && s.colors === COUNTS[n] && s.shirtKinds >= 4 && s.instAttrs, `systems: ${n} có instanceColor đủ ${s?.colors} người, ${s?.shirtKinds} màu áo, aVar/aPants là thuộc tính instance (${s?.instAttrs})`);
  }
  check(sy.length === 3 && new Set(sy.map((s) => s.material)).size === 1 && sy[0]?.materialName === 'peopleWalk', `systems: 3 hệ cùng một vật liệu peopleWalk (${sy.map((s) => s.materialName).join(',')})`);

  /* ---------- 2. noOldShape ---------- */
  const old = await page.evaluate(() => { const out = []; window.__app.scene.traverse((o) => { if (o.isMesh && /-people$/.test(o.parent?.name ?? '') && o.geometry.attributes.position.count <= 200) out.push(`${o.parent.name}:${o.geometry.attributes.position.count}`); }); return out; });
  check(old.length === 0, `noOldShape: không còn lưới người ≤ 200 đỉnh (${old.join(', ')})`);
  check(sy.length === 3 && sy.every((s) => s.verts > 200 && s.verts <= 900), `noOldShape: hình người ${sy.map((s) => s.verts).join('/')} đỉnh (≤ 900)`);

  /* ---------- 3. moving ---------- */
  const p0 = {}; for (const n of NAMES) p0[n] = await positions(n);
  await frames(page, 60);
  for (const n of NAMES) {
    const a = p0[n], b = await positions(n);
    if (!a.length || a.length !== b.length) { check(false, `moving: ${n} không đọc được vị trí`); continue; }
    let moved = 0, still = 0, badHead = 0, tilted = 0;
    const stands = b.filter((p) => p.kind === 'stand').length;
    b.forEach((p, i) => {
      const dx = p.x - a[i].x, dz = p.z - a[i].z, d = Math.hypot(dx, dz);
      if (d > 0.01) moved++; else still++;
      if (p.upY < 0.999) tilted++;
      if (d > 0.01 && d < 10 && (p.fwd[0] * dx + p.fwd[2] * dz) / d < 0.95) badHead++;   // bỏ qua người vừa quay vòng về đầu dải
    });
    check(moved >= 0.6 * b.length, `moving: ${n} ${moved}/${b.length} người đã đổi vị trí sau 60 khung`);
    check(Math.abs(still - stands) <= 1, `moving: ${n} ${still} người đứng yên, ${stands} người kiểu 'stand'`);
    check(tilted === 0 && badHead === 0, `moving: ${n} mọi người thẳng đứng (${tilted} nghiêng), quay mặt theo chiều đi (${badHead} sai hướng)`);
  }

  /* ---------- 4. insideSidewalk ---------- */
  for (const n of NAMES) {
    const ps = (await positions(n)).filter((p) => p.scale > 0);
    const out = ps.filter((p) => !inBand(n, p)), off = ps.filter((p) => p.y < p.ground - 1e-4 || p.y > p.ground + 1e-3);
    check(ps.length === COUNTS[n] && out.length === 0, `insideSidewalk: ${n} ${ps.length} người, ${out.length} ngoài dải lề (${out.slice(0, 3).map((p) => `#${p.i} x ${p.x.toFixed(1)} z ${p.z.toFixed(2)}`).join('; ')})`);
    check(off.length === 0, `insideSidewalk: ${n} chân đúng mặt lề (${off.length} lệch: ${off.slice(0, 3).map((p) => `#${p.i} y ${p.y.toFixed(3)} / ${p.ground.toFixed(3)}`).join('; ')})`);
  }
  /* Cầu Rồng: cột đèn ở |z| = 17,0 (bán kính ≤ 0,14), mặt trong lan can |z| ≈ 18,58 ⇒ tâm người phải ở |z| ∈ [17,3; 18,58];
     người đứng chỉ trên phần cầu qua sông (|x| ≤ 255, mép kè 262) */
  const dps = (await positions('dragon-people')).filter((p) => p.scale > 0);
  const nearLamp = dps.filter((p) => Math.abs(p.z) < 17.3 || Math.abs(p.z) > 18.58), standLand = dps.filter((p) => p.kind === 'stand' && Math.abs(p.x) > 255);
  check(dps.length === 70 && nearLamp.length === 0, `clearLamps: dragon-people ${dps.length} người, ${nearLamp.length} người lấn hàng cột đèn / lan can (${nearLamp.slice(0, 3).map((p) => `#${p.i} ${p.kind} z ${p.z.toFixed(2)}`).join('; ')}); |z| ${Math.min(...dps.map((p) => Math.abs(p.z))).toFixed(2)}…${Math.max(...dps.map((p) => Math.abs(p.z))).toFixed(2)}`);
  check(standLand.length === 0, `standOverRiver: dragon-people ${standLand.length} người đứng trên phần cầu qua đất (|x| > 255) (${standLand.slice(0, 3).map((p) => `#${p.i} x ${p.x.toFixed(1)}`).join('; ')})`);

  /* ---------- 8. randKept ---------- */
  const rk = await page.evaluate(() => (window.__app.boats?.running() ?? []).map((b) => b.speed));
  check(rk.length === 7 && rk.every((s, i) => Math.abs(s - MAIN_BOAT_SPEEDS[i]) < 1e-12), `randKept: speed 7 tàu trùng main (${rk.map((s) => s.toFixed(3)).join(', ')})`);

  /* ---------- 5. stormClear ---------- */
  await setWx(page, 'storm');
  await page.waitForFunction(() => window.__app.weather.fx().clear >= 0.45, null, { timeout: 600000, polling: 100 });
  const mid = await systems(), midK = await page.evaluate(() => window.__app.weather.fx().clear);
  check(mid.length === 3 && mid.every((s) => s.visible > 0 && s.visible < s.count), `stormClear: giữa chừng (clear ${midK.toFixed(2)}) ${mid.map((s) => `${s.name} ${s.visible}/${s.count}`).join(', ')}`);
  await page.waitForFunction(() => window.__app.weather.fx().clear >= 1, null, { timeout: 600000 }); await frames(page, 2);
  const gone = await systems();
  check(gone.length === 3 && gone.every((s) => s.visible === 0), `stormClear: bão đóng cầu ⇒ ${gone.map((s) => `${s.name} ${s.visible}`).join(', ')} người còn hiện`);
  await setWx(page, 'now');
  await page.waitForFunction(() => window.__app.weather.fx().clear <= 0, null, { timeout: 600000 }); await frames(page, 3);
  const back = await systems();
  check(back.length === 3 && back.every((s) => s.visible === s.count), `stormClear: hết bão ⇒ ${back.map((s) => `${s.name} ${s.visible}/${s.count}`).join(', ')}`);

  /* ---------- 6. toggleBack ---------- */
  const ttlState = async () => (await systems()).find((s) => s.name === 'ttl-people');
  // nút nằm trong bảng Trần Thị Lý (ẩn khi chưa chọn cầu này) ⇒ bấm bằng click() như traffic-check (#btnTtlLife)
  const ttlBtn = () => page.evaluate(() => document.getElementById('btnTtlPeople').click());
  await ttlBtn(); await frames(page, 3);
  const tOff = await ttlState();
  await ttlBtn(); await frames(page, 3);
  const tOn = await ttlState();
  check(tOff?.groupVisible === false && tOn?.groupVisible === true && tOn?.visible === 80, `toggleBack: tắt ⇒ nhóm ẩn (${tOff?.groupVisible}), bật lại ⇒ hiện ${tOn?.visible}/80 (${tOn?.groupVisible})`);

  /* ---------- 7. dragonLod ---------- */
  const dragonVis = async (pos) => { await setCam(pos, [0, 8, 0]); await frames(page, 3); return page.evaluate(() => ({ v: window.__app.scene.getObjectByName('dragon-people')?.visible, d: window.__app.camera.position.length() })); };
  const far = await dragonVis([0, 300, 1980]), near = await dragonVis([0, 120, 270]);
  check(far.v === false && near.v === true, `dragonLod: camera cách ${far.d.toFixed(0)} m ⇒ ẩn (${far.v}); ${near.d.toFixed(0)} m ⇒ hiện (${near.v})`);

  /* ---------- 7b. dragonCull: trong tầm 1 500 m nhưng quay lưng lại Cầu Rồng ⇒ lưới người Cầu Rồng không vẽ (cắt theo khung nhìn); nhìn vào cầu ⇒ vẽ.
     Cờ "đã vẽ khung này" = onAfterRender của InstancedMesh (renderer chỉ gọi khi thực sự vẽ đối tượng) ---------- */
  const dragonDrawn = async (pos, tgt) => {
    await setCam(pos, tgt); await frames(page, 2);
    await page.evaluate(() => { const m = window.__app.scene.getObjectByName('dragon-people').children.find((o) => o.isInstancedMesh); window.__ppDrawn = 0; m.onAfterRender = () => { window.__ppDrawn++; }; });
    await frames(page, 3);
    return page.evaluate(() => { const g = window.__app.scene.getObjectByName('dragon-people'), m = g.children.find((o) => o.isInstancedMesh); m.onAfterRender = () => {}; return { drawn: window.__ppDrawn, group: g.visible, culled: m.frustumCulled, d: window.__app.camera.position.distanceTo(new window.__app.THREE.Vector3(0, 8, 0)) }; });
  };
  const awayTtl = await dragonDrawn([0, 60, 1380], [0, 20, 1800]), awaySh = await dragonDrawn([0, 60, -1080], [0, 20, -1500]), look = await dragonDrawn([0, 120, 270], [0, 8, 0]);
  check(awayTtl.group && awayTtl.drawn === 0, `dragonCull: gần Trần Thị Lý (cách ${awayTtl.d.toFixed(0)} m), quay lưng lại Cầu Rồng ⇒ nhóm hiện (${awayTtl.group}), lưới vẽ ${awayTtl.drawn} lần (frustumCulled ${awayTtl.culled})`);
  check(awaySh.group && awaySh.drawn === 0, `dragonCull: gần Cầu sông Hàn (cách ${awaySh.d.toFixed(0)} m), quay lưng lại Cầu Rồng ⇒ nhóm hiện (${awaySh.group}), lưới vẽ ${awaySh.drawn} lần`);
  check(look.group && look.drawn > 0, `dragonCull: nhìn vào Cầu Rồng (cách ${look.d.toFixed(0)} m) ⇒ lưới vẽ ${look.drawn} lần`);

  /* ---------- 10. ảnh ---------- */
  if (!NO_SHOTS) {
    await hideUi(true);
    const shot = async (name) => { await frames(page, 3); await page.screenshot({ path: `${SCREENS}people-${name}.png` }); };
    /* Đặt camera theo người i của hệ (tọa độ thế giới): off = lệch camera (m), lookY = nhìn cao hơn chân */
    const aim = (name, i, off, lookY = 1) => page.evaluate(([name, i, off, lookY]) => {
      const a = window.__app, T = a.THREE, m = a.scene.getObjectByName(name).children.find((o) => o.isInstancedMesh), M = new T.Matrix4(), P = new T.Vector3();
      m.updateWorldMatrix(true, false); m.getMatrixAt(i, M); M.premultiply(m.matrixWorld); P.setFromMatrixPosition(M);
      a.camera.position.set(P.x + off[0], P.y + off[1], P.z + off[2]); a.controls.target.set(P.x, P.y + lookY, P.z); a.controls.update();
    }, [name, i, off, lookY]);
    /* Người đầu tiên thỏa điều kiện (theo vị trí cục bộ hiện tại) */
    const find = async (name, fn) => (await positions(name)).find(fn)?.i ?? 0;
    const dWalk = await find('dragon-people', (p) => p.kind === 'walk' && p.z > 0 && Math.abs(p.x) < 200);
    const dRun = await find('dragon-people', (p) => p.kind === 'run');
    const dHead = await find('dragon-people', (p) => p.kind === 'stand' && p.x > 150);
    const tWalk = await find('ttl-people', (p) => p.i < 46 && p.kind !== 'stand' && p.x > -200 && p.x < 200);
    const sWalk = await find('sh-people', (p) => p.i < 36 && p.kind !== 'stand');
    const bWalk = await find('sh-people', (p) => p.i >= 36 && p.kind === 'stand');
    await aim('dragon-people', dWalk, [6, 3, -8]); await shot('cau-rong-ngay');
    await aim('dragon-people', dRun, [5, 2.5, -7]); await shot('cau-rong-chay');
    await aim('dragon-people', dHead, [-6, 3, -9]); await shot('cau-rong-dau-rong');
    await aim('ttl-people', tWalk, [7, 3, -9]); await shot('tran-thi-ly');
    await aim('sh-people', sWalk, [7, 3, -8]); await shot('cau-song-han');
    await aim('sh-people', bWalk, [-9, 4, 8]); await shot('bach-dang');
    await setNight(1);
    await aim('dragon-people', dWalk, [6, 3, -8]); await shot('cau-rong-dem');
    await setNight(0);
    await hideUi(false);
  }

  check(errors.length === 0, `không lỗi console, kể cả lỗi biên dịch shader (${errors.join(' | ')})`);
} finally {
  await browser.close(); srv.close();
}
console.log(problems.length ? `\n${problems.length} mục LỖI` : '\nTất cả ĐẠT');
process.exit(problems.length ? 1 : 0);
