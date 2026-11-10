// Kiểm tra cây bóng mát và cây dừa (docs/superpowers/specs/2026-11-11-cay-va-nguoi-thuc-te-design.md, Task 2 của plan).
//  1. meshCount: đúng 6 lưới cây theo tên (khu phố 4, Thuận Phước 2); không còn SphereGeometry / ConeGeometry nào dùng vật liệu tán.
//  2. posKept: số instance và tổng kiểm vị trí [x, z] khớp mốc đo trên code chưa sửa; tán dừa nằm trên đỉnh thân (lệch ngang ≤ độ cong).
//  3. randKept: speed 7 tàu chạy chung trùng main (cây dựng trước xe và tàu ⇒ lệch rand() là lộ ngay).
//  4. trisBudget: số tam giác mỗi lưới ≤ trần CONFIG.trees.maxTris.
//  5. pairs: số cặp thân–tán mà fallen.ts tìm thấy bằng mốc.
//  6. fallenRestore: đổ cây rồi dựng lại ⇒ ma trận thân/tán trùng tuyệt đối bản đầu.
//  7. clearedStayZero: số tán đã dọn (scale 0) bằng mốc; thân cùng chỉ số cũng scale 0.
//  8. windAttached: preset Bão ⇒ treeLean > 0, không lỗi shader.
//  9. Không lỗi console.
// 11. tunnelPalms: nhóm hầm giữ nguyên số InstancedMesh / Mesh con; lưới hr-concrete tăng số tam giác (dừa mới hơn cặp thân + nón cũ).
// 10. Ảnh (bỏ bằng --no-shots) tests/screens/trees-*.png: gần ~20 m bờ Bạch Đằng (ngày), toàn cảnh mặc định, dải đi bộ đêm, kè Thuận Phước, bờ sông khi bão.
//
//   npm run build && npm run test:trees [-- --no-shots]
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { serveDir, launch, openApp, frames, pickView } from './lib.mjs';
import { setWx } from './weather-lib.mjs';

const NO_SHOTS = process.argv.includes('--no-shots');
const SCREENS = fileURLToPath(new URL('./screens/', import.meta.url));
mkdirSync(SCREENS, { recursive: true });
const problems = [];
const check = (ok, msg) => { console.log(`${ok ? 'ĐẠT ' : 'LỖI '} ${msg}`); if (!ok) problems.push(msg); return ok; };

// Mốc đo trên code CHƯA sửa (8c56cdd, cây quả cầu / nón): số instance và tổng kiểm Σ(x·31 + z) của vị trí [x, z] (gồm cả instance đã dọn ở (0, 0)).
// Tán dừa không có ở đây vì vị trí của nó dời lên đỉnh thân cong (kiểm riêng theo thân dừa).
const MAIN_TREE_POS = {"trees-shade-trunk":{"count":890,"sum":-3857311.434},"trees-shade-crown":{"count":890,"sum":-3857311.434},"trees-palm-trunk":{"count":246,"sum":1318102.245},"tp-trees-trunk":{"count":128,"sum":420346.507},"tp-trees-crown":{"count":128,"sum":420346.507}};
// Mốc đo trên code CHƯA sửa hầm (88ff1e5): số InstancedMesh, Mesh con của hr.group và số tam giác của hr-concrete
const MAIN_TUNNEL = { inst: 0, mesh: 4, tris: 25104 };
const MAIN_PAIRS = 3;             // __app.weather.fallen.state().pairs
const MAIN_CLEARED = { "trees-shade-crown": 26, "trees-palm-crown": 2, "tp-trees-crown": 0 };        // { tên lưới tán: số instance scale 0 }
// Mốc đo trên main 43cec90 (chép từ tests/traffic-check.mjs): speed của 7 tàu chạy chung
const MAIN_BOAT_SPEEDS = [4.834048458375037, 3.4622229826636612, 3.367667659651488, 4.561683705076575, 4.302534147165716, 3.222870459780097, 4.6476020980626345];
const NAMES = ['trees-shade-trunk', 'trees-shade-crown', 'trees-palm-trunk', 'trees-palm-crown', 'tp-trees-trunk', 'tp-trees-crown'];
const POS_NAMES = NAMES.filter((n) => n !== 'trees-palm-crown');
const PAIRS = [['trees-shade-trunk', 'trees-shade-crown'], ['trees-palm-trunk', 'trees-palm-crown'], ['tp-trees-trunk', 'tp-trees-crown']];
const CAP = { 'trees-shade-trunk': 'shadeTrunk', 'trees-shade-crown': 'shadeCrown', 'trees-palm-trunk': 'palmTrunk', 'trees-palm-crown': 'palmCrown', 'tp-trees-trunk': 'shadeTrunk', 'tp-trees-crown': 'shadeCrown' };

const srv = await serveDir(fileURLToPath(new URL('../dist/', import.meta.url)));
const browser = await launch();
const { page, errors } = await openApp(browser, srv.url, { width: 960, height: 540 });

const setNight = async (v) => {
  await page.evaluate((v) => { window.__app.dayNight.target = v; window.__app.dayNight.night = v; }, v);
  await page.waitForFunction((v) => Math.abs(window.__app.dayNight.night - v) < 1e-6, v, { timeout: 60000 });
  await frames(page, 3);
};
const hideUi = (on) => page.evaluate((on) => document.querySelectorAll('body *').forEach((e) => { if (!e.matches('canvas') && !e.querySelector('canvas')) e.style.visibility = on ? 'hidden' : ''; }), on);
/* Chỉ số instance có scale 0 (cột X của ma trận bằng 0) của một lưới theo tên */
const zeroIdx = (name) => page.evaluate((name) => {
  const o = window.__app.scene.getObjectByName(name), a = o.instanceMatrix.array, out = [];
  for (let i = 0; i < o.count; i++) if (Math.abs(a[i * 16]) + Math.abs(a[i * 16 + 1]) + Math.abs(a[i * 16 + 2]) < 1e-9) out.push(i);
  return out;
}, name);

try {
  await setNight(0);

  /* ---------- 1. meshCount ---------- */
  const mc = await page.evaluate((NAMES) => {
    const a = window.__app, list = a.trees.meshes(), crownMats = new Set(NAMES.filter((n) => n.endsWith('crown')).map((n) => a.scene.getObjectByName(n)?.material).filter(Boolean)), old = [];
    a.scene.traverse((o) => { if (o.isMesh && crownMats.has(o.material) && (o.geometry.type === 'SphereGeometry' || o.geometry.type === 'ConeGeometry')) old.push(`${o.name || o.uuid}:${o.geometry.type}`); });
    return { names: list.map((m) => m.name).join(','), inst: list.every((m) => a.scene.getObjectByName(m.name).isInstancedMesh), old };
  }, NAMES);
  check(mc.names === NAMES.join(',') && mc.inst, `meshCount: đủ 6 lưới cây là InstancedMesh (${mc.names})`);
  check(mc.old.length === 0, `meshCount: không còn quả cầu / nón dùng vật liệu tán (${mc.old.join(', ')})`);

  /* ---------- 2. posKept ---------- */
  const pos = {};
  for (const n of NAMES) {
    const p = await page.evaluate((n) => window.__app.trees.positions(n), n);
    let sum = 0; for (let i = 0; i < p.length; i += 2) sum += p[i] * 31 + p[i + 1];
    pos[n] = { count: p.length / 2, sum: Math.round(sum * 1000) / 1000, p };
  }
  const got = Object.fromEntries(POS_NAMES.map((n) => [n, { count: pos[n].count, sum: pos[n].sum }]));
  if (!MAIN_TREE_POS) console.log('MỐC MAIN_TREE_POS =', JSON.stringify(got));
  else for (const n of POS_NAMES) check(got[n].count === MAIN_TREE_POS[n].count && Math.abs(got[n].sum - MAIN_TREE_POS[n].sum) < 0.01, `posKept: ${n} ${got[n].count} instance, tổng kiểm ${got[n].sum} (mốc ${MAIN_TREE_POS[n].count}, ${MAIN_TREE_POS[n].sum})`);
  const t = pos['trees-palm-trunk'].p, c = pos['trees-palm-crown'].p; let far = 0;
  for (let i = 0; i < t.length; i += 2) if (Math.hypot(c[i] - t[i], c[i + 1] - t[i + 1]) > 0.35 * 0.8 + 0.002) far++;   // = CONFIG.trees.palm.bend (0,35) × CONFIG.trees.palm.trunkWidth (0,8); __app không lộ CONFIG nên giữ số, đổi config thì đổi ở đây
  check(c.length === t.length && far === 0, `posKept: ${c.length / 2} tán dừa nằm trên đỉnh thân cùng chỉ số (${far} lệch quá độ cong)`);

  /* ---------- 3. randKept ---------- */
  const rk = await page.evaluate(() => (window.__app.boats?.running() ?? []).map((b) => b.speed));
  check(rk.length === 7 && rk.every((s, i) => Math.abs(s - MAIN_BOAT_SPEEDS[i]) < 1e-12), `randKept: speed 7 tàu trùng main (${rk.map((s) => s.toFixed(3)).join(', ')})`);

  /* ---------- 4. trisBudget ---------- */
  const tb = await page.evaluate(() => ({ list: window.__app.trees.meshes(), cap: window.__app.trees.maxTris }));
  if (!tb.cap) check(false, 'trisBudget: __app.trees.maxTris chưa có');
  else for (const m of tb.list) check(m.tris <= tb.cap[CAP[m.name]], `trisBudget: ${m.name} ${m.tris} tam giác ≤ ${tb.cap[CAP[m.name]]}`);

  /* ---------- 5. pairs ---------- */
  const pr = await page.evaluate(() => window.__app.weather.fallen.state().pairs);
  if (MAIN_PAIRS === null) console.log('MỐC MAIN_PAIRS =', pr);
  else check(pr === MAIN_PAIRS, `pairs: ${pr} cặp thân–tán (mốc ${MAIN_PAIRS})`);

  /* ---------- 7. clearedStayZero (trước khi đổ cây) ---------- */
  const cleared = {};
  for (const [tn, cn] of PAIRS) {
    const zc = await zeroIdx(cn), zt = new Set(await zeroIdx(tn));
    cleared[cn] = zc.length;
    const zcs = new Set(zc), crownOnly = zc.filter((i) => !zt.has(i)).length, trunkOnly = [...zt].filter((i) => !zcs.has(i)).length;
    check(crownOnly === 0 && trunkOnly === 0, `clearedStayZero: ${cn} ${zc.length} tán đã dọn, tập chỉ số scale 0 của thân trùng tập của tán (${crownOnly} thân còn, ${trunkOnly} tán còn)`);
  }
  if (!MAIN_CLEARED) console.log('MỐC MAIN_CLEARED =', JSON.stringify(cleared));
  else for (const [, cn] of PAIRS) check(cleared[cn] === MAIN_CLEARED[cn], `clearedStayZero: ${cn} số tán dọn ${cleared[cn]} (mốc ${MAIN_CLEARED[cn]})`);

  /* ---------- 6. fallenRestore ---------- */
  await page.evaluate(() => { const { camera, controls } = window.__app; camera.position.set(-240, 30, 260); controls.target.set(-275, 3, 200); controls.update(); });
  await frames(page, 2);
  const before = await page.evaluate(() => window.__app.weather.fallen.snapshot());
  await page.evaluate(() => { const w = window.__app.weather; w.fallen.fell(); w.setParams({ wind: 3 }, true); });
  await page.waitForFunction(() => { const s = window.__app.weather.fallen.state(); return s.down > 0 && s.angle > 1.39; }, null, { timeout: 600000, polling: 1000 });
  const fs = await page.evaluate(() => window.__app.weather.fallen.state());
  await page.evaluate(() => window.__app.weather.fallen.stand());
  const after = await page.evaluate(() => window.__app.weather.fallen.snapshot());
  const same = before.length === after.length && before.every((a, i) => a.length === after[i].length && a.every((x, j) => x === after[i][j]));
  check(fs.down > 0 && same, `fallenRestore: ${fs.down} cây đổ tới ${fs.angle.toFixed(3)} rad, dựng lại trùng ma trận gốc (${same})`);
  await page.evaluate(() => window.__app.weather.setParams({ wind: 0 }, true));
  await setWx(page, 'now');

  /* ---------- 8. windAttached ---------- */
  await setWx(page, 'storm'); await frames(page, 30);
  const sw = await page.evaluate(() => window.__app.weather.sway());
  check(sw.treeLean > 0, `windAttached: bão ⇒ treeLean ${sw.treeLean.toFixed(4)} m/m, treeSway ${sw.treeSway.toFixed(4)} m/m`);
  check(!errors.some((e) => /shader|program/i.test(e)), 'windAttached: không lỗi biên dịch shader');
  await setWx(page, 'now'); await frames(page, 3);

  /* ---------- 11. tunnelPalms ---------- */
  const tn = await page.evaluate(() => {
    const g = window.__app.hr.group, k = g.children, conc = g.getObjectByName('hr-concrete'), gg = conc.geometry;
    return { inst: k.filter((o) => o.isInstancedMesh).length, mesh: k.filter((o) => o.isMesh && !o.isInstancedMesh).length, tris: (gg.index ? gg.index.count : gg.attributes.position.count) / 3 };
  });
  {
    const want = MAIN_TUNNEL.tris + 224 * 138;   // 224 dừa cửa hầm × 138 tam giác tĩnh mỗi cây
    check(tn.inst === MAIN_TUNNEL.inst && tn.mesh === MAIN_TUNNEL.mesh, `tunnelPalms: nhóm hầm ${tn.inst} InstancedMesh, ${tn.mesh} Mesh con (mốc ${MAIN_TUNNEL.inst}, ${MAIN_TUNNEL.mesh})`);
    check(tn.tris === want, `tunnelPalms: hr-concrete ${tn.tris} tam giác = ${want} (mốc ${MAIN_TUNNEL.tris} + 224 × 138)`);
  }

  /* ---------- 10. ảnh ---------- */
  if (!NO_SHOTS) {
    const shot = async (name) => { await frames(page, 4); await page.screenshot({ path: `${SCREENS}trees-${name}.png` }); };
    /* Đặt camera theo instance i của lưới (tọa độ thế giới): off = lệch camera (m), lookY = nhìn cao hơn gốc cây */
    const aim = (name, i, off, lookY) => page.evaluate(([name, i, off, lookY]) => {
      const a = window.__app, T = a.THREE, o = a.scene.getObjectByName(name), M = new T.Matrix4(), P = new T.Vector3();
      o.updateWorldMatrix(true, false); o.getMatrixAt(i, M); M.premultiply(o.matrixWorld); P.setFromMatrixPosition(M);
      a.camera.position.set(P.x + off[0], P.y + off[1], P.z + off[2]); a.controls.target.set(P.x, P.y + lookY, P.z); a.controls.update();
    }, [name, i, off, lookY]);
    /* Dừa bờ Tây gần z0 (chưa dọn) có cây bóng mát cạnh bên */
    const palmNear = (z0) => page.evaluate((z0) => { const p = window.__app.trees.positions('trees-palm-trunk'); let b = -1, d = 1e9; for (let i = 0; i < p.length; i += 2) if (p[i] < -262 && p[i] > -300 && Math.abs(p[i + 1] - z0) < d) { d = Math.abs(p[i + 1] - z0); b = i / 2; } return b; }, z0);
    const pi = await palmNear(230);
    await page.evaluate(() => window.__app.weather.fallen.stand());   // bão ở mục 8 rồi về 'now' ⇒ aftermath đã đổ cây quanh điểm nhìn; dựng lại cho ảnh gọn
    await pickView(page, 'dragon', 'overview'); await hideUi(true);
    await shot('toan-canh-ngay');
    await aim('trees-palm-trunk', pi, [17, 3, 10], 6); await shot('gan-bach-dang-ngay');
    await aim('trees-palm-trunk', pi, [22, 9, -14], 4); await shot('gan-bach-dang-ngay-2');
    const tpi = await page.evaluate(() => { const p = window.__app.trees.positions('tp-trees-trunk'); const n = p.length / 2; for (let k = 0; k < n; k++) { const i = (Math.floor(n / 3) + k) % n; if (p[i * 2] !== 0 || p[i * 2 + 1] !== 0) return i; } return 0; });
    await aim('tp-trees-trunk', tpi, [-25, 14, 30], 3); await shot('ke-thuan-phuoc');
    await page.evaluate(() => { const { camera, controls } = window.__app; camera.position.set(800, 11, -1692); controls.target.set(585, 2.5, -1700); controls.update(); });   // như góc hrPortalE (UI đang ẩn nên không bấm nút được)
    await shot('tunnel-portal');
    await setNight(1);
    const pn = await palmNear(-430);
    await aim('trees-palm-trunk', pn, [26, 8, 30], 4); await shot('di-bo-dem');
    await setNight(0);
    await setWx(page, 'storm'); await frames(page, 30);
    await aim('trees-palm-trunk', pi, [30, 6, 18], 6); await shot('bo-song-bao');
    await setWx(page, 'now');
    await hideUi(false);
  }

  check(errors.length === 0, `không lỗi console (${errors.join(' | ')})`);
} finally {
  await browser.close(); srv.close();
}
console.log(problems.length ? `\n${problems.length} mục LỖI` : '\nTất cả ĐẠT');
process.exit(problems.length ? 1 : 0);
