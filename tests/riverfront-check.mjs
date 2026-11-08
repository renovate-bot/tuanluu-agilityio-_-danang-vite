// Kiểm tra hai bờ sông Hàn (xem docs/superpowers/specs/2026-10-21-bo-song-han-design.md):
//  1. Không nhà ngẫu nhiên nào còn hiện mà chân đè lên chân địa danh; nhà không bị dọn giữ nguyên ma trận so với trước khi dọn.
//  2. Mặt LED trái tim: pháp tuyến Novotel +X, Vinpearl −X; trục U chạy sang bên phải người nhìn từ sông (chữ "DN" không lật gương).
//  3. Tắt/bật "Đèn trái tim": emissive về 0 rồi trở lại, hoạt cảnh chạy tiếp; bật/tắt 3 lần không rò rỉ geometry/texture.
//  4. Ban ngày độ sáng LED ≤ 5% ban đêm.
//  5. Quảng cáo: đủ số lượng từng loại, màn LED đổi quảng cáo, công tắc "Quảng cáo", không bảng nào đè hành lang hầm.
//  6. Ảnh chụp ngày/đêm vào tests/screens/ (bỏ bằng --no-shots). 7. Không lỗi console.
//
//   npm run build && node tests/riverfront-check.mjs [--no-shots]
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
  // ---- 1. nhà bị dọn ----
  const B = await page.evaluate(() => {
    const { scene, riverfront: RF, THREE } = window.__app, m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    scene.updateMatrixWorld(true);
    let overlap = 0, changed = 0, zeroed = 0, total = 0;
    scene.traverse((o) => {
      if (!o.isInstancedMesh || !o.parent?.isLOD) return;
      const snap = RF.snapshot.get(o); if (!snap) return;
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m); total++;
        const cur = m.elements, was = snap.subarray(i * 16, i * 16 + 16);
        m.decompose(p, q, s);
        if (s.x < 1e-6) { zeroed++; continue; }
        for (let k = 0; k < 16; k++) if (Math.abs(cur[k] - was[k]) > 1e-6) { changed++; break; }
        p.applyMatrix4(o.matrixWorld);
        if (RF.footprints.some((r) => p.x + s.x / 2 > r.x0 && p.x - s.x / 2 < r.x1 && p.z + s.z / 2 > r.z0 && p.z - s.z / 2 < r.z1)) overlap++;
      }
    });
    return { overlap, changed, zeroed, total, cleared: RF.cleared };
  });
  check(B.overlap === 0, `${B.overlap} nhà ngẫu nhiên vẫn đè lên chân địa danh`);
  check(B.changed === 0, `${B.changed} nhà không bị dọn nhưng ma trận đã đổi so với trước khi dọn`);
  check(B.zeroed > 0, 'không dọn nhà nào (kỳ lạ: địa danh phải đè lên nhà ngẫu nhiên)');
  console.log(`dọn nhà: ${B.cleared.buildings} lượt nhà (near+far), ${B.cleared.plants} cây/đèn; ${B.zeroed}/${B.total} instance nhà ở trạng thái scale 0`);

  // ---- 2. hướng mặt LED, không lật gương ----
  const G = await page.evaluate(() => {
    const { riverfront: RF, THREE } = window.__app, g = RF.hearts.mesh.geometry, P = g.attributes.position, up = new THREE.Vector3(0, 1, 0), out = [];
    const v = (i) => new THREE.Vector3(P.getX(i), P.getY(i), P.getZ(i));
    for (let t = 0; t < 2; t++) {
      const a = v(t * 4), b = v(t * 4 + 1), c = v(t * 4 + 2);
      const uAxis = b.clone().sub(a).normalize(), n = c.clone().sub(a).cross(b.clone().sub(a)).normalize();   // mặt trước theo thứ tự đỉnh của PlaneGeometry (a, c, b)
      const right = n.clone().negate().cross(up).normalize();                                                // người nhìn từ sông hướng về tòa nhà: nhìn dọc −n
      out.push({ name: RF.hearts.panels[t].name, n: n.toArray(), uDotRight: uAxis.dot(right) });
    }
    return out;
  });
  const [nv, vp] = G;
  check(nv.name === 'novotel' && nv.n[0] > 0.99, `pháp tuyến Novotel không hướng +X: ${nv.n}`);
  check(vp.name === 'vinpearl' && vp.n[0] < -0.99, `pháp tuyến Vinpearl không hướng −X: ${vp.n}`);
  check(nv.uDotRight > 0.99 && vp.uDotRight > 0.99, `trục U không chạy sang bên phải người nhìn từ sông (${nv.uDotRight.toFixed(2)}, ${vp.uDotRight.toFixed(2)}): chữ DN bị lật gương`);

  // ---- 3 + 4. bật/tắt đèn trái tim, rò rỉ, độ sáng ngày/đêm ----
  const mem = () => page.evaluate(() => { const i = window.__app.renderer.info.memory; return [i.geometries, i.textures]; });
  const step = (n) => page.evaluate((n) => { for (let i = 0; i < n; i++) window.__app.riverfront.hearts.update(0.25); }, n);
  await page.click('button[data-bridge="dragon"]'); await waitFlight(page); await frames(page, 2);
  const m0 = await mem();
  for (let i = 0; i < 3; i++) {
    await page.click('#btnRfHearts'); await step(24);
    const off = await page.evaluate(() => window.__app.riverfront.hearts.material.uniforms.uOn.value);
    check(off === 0, `tắt đèn trái tim lần ${i + 1}: uOn = ${off} ≠ 0`);
    await page.click('#btnRfHearts'); await step(24);
    const on = await page.evaluate(() => window.__app.riverfront.hearts.material.uniforms.uOn.value);
    check(on > 0.99, `bật lại lần ${i + 1}: uOn = ${on} chưa về 1`);
  }
  const t0 = await page.evaluate(() => window.__app.riverfront.hearts.material.uniforms.uTime.value); await frames(page, 3);
  const t1 = await page.evaluate(() => window.__app.riverfront.hearts.material.uniforms.uTime.value);
  check(t1 > t0, 'hoạt cảnh không chạy tiếp sau khi bật lại');
  const m1 = await mem();
  check(JSON.stringify(m0) === JSON.stringify(m1), `rò rỉ bộ nhớ GPU sau 3 lần bật/tắt: [geometry, texture] ${m0} → ${m1}`);
  const lv = await page.evaluate(() => { const h = window.__app.riverfront.hearts; return [h.brightness(0), h.brightness(1)]; });
  check(lv[0] / lv[1] <= 0.05, `độ sáng ban ngày/đêm = ${(lv[0] / lv[1]).toFixed(3)} > 5%`);
  // chế độ đối đáp / đồng bộ: pha hai tòa
  const phase = async (mode) => { await page.selectOption('#rfHeartsMode', mode); return page.evaluate(() => { const a = window.__app.riverfront.hearts.mesh.geometry.attributes.aPhase; return [a.getX(0), a.getX(4)]; }); };
  const duet = await phase('duet'), sync = await phase('sync');
  check(Math.abs(duet[1] - duet[0]) === 12, `Đối đáp phải lệch pha nửa chu kỳ: ${duet}`);
  check(sync[0] === sync[1], `Đồng bộ phải cùng pha: ${sync}`);
  await page.selectOption('#rfHeartsMode', 'duet');
  console.log(`bộ nhớ GPU [geometry, texture] ${m0} → ${m1}; độ sáng ngày/đêm ${(lv[0] / lv[1] * 100).toFixed(1)}%`);

  // ---- 5. quảng cáo ----
  const A = await page.evaluate(() => {
    const RF = window.__app.riverfront, bb = RF.billboards, HRZ = -1700, out = { counts: bb.counts, size: RF.atlas.texture.image.width };
    const cur0 = bb.screens.map((s) => s.cur);
    for (let i = 0; i < 10; i++) bb.update(1);
    out.changed = bb.screens.some((s, i) => s.cur !== cur0[i]);
    out.hrRects = bb.rects.filter((r) => r.z1 > HRZ - 30 && r.z0 < HRZ + 30).length;
    bb.setEnabled(false); out.hidden = !bb.group.visible; bb.setEnabled(true);
    return out;
  });
  check(A.size === 2048, `atlas ${A.size} ≠ 2048`);
  check(A.counts.panos >= 6 && A.counts.roofs >= 4 && A.counts.screens >= 2 && A.counts.banners >= 10, `thiếu bảng quảng cáo: ${JSON.stringify(A.counts)}`);
  check(A.changed, 'màn LED không đổi quảng cáo sau 10 s');
  check(A.hrRects === 0 && A.hidden, `bảng đè hành lang hầm (${A.hrRects}) hoặc công tắc "Quảng cáo" không ẩn được bảng`);
  console.log(`quảng cáo: ${JSON.stringify(A.counts)}`);

  // ---- 6. ảnh chụp ----
  if (shots) {
    fs.mkdirSync(SCREENS, { recursive: true });
    const shot = async (name) => { await frames(page, 3); await page.screenshot({ path: `${SCREENS}${name}.png` }); };
    const freeze = (t) => page.evaluate((t) => { window.__app.riverfront.hearts.material.uniforms.uTime = { value: t }; }, t);
    for (const night of [0, 1]) {
      await page.evaluate((v) => { window.__app.dayNight.target = v; window.__app.dayNight.night = v; }, night);
      const tag = night ? 'dem' : 'ngay';
      for (const [bridge, view] of [['dragon', 'rfHearts'], ['dragon', 'rfBank'], ['dragon', 'overview'], ['sh', 'shOverview'], ['dragon', 'bird']]) {
        await page.click(`button[data-bridge="${bridge}"]`); await waitFlight(page);
        await page.click(`button[data-view="${view}"]`); await waitFlight(page);
        if (night && view === 'rfHearts') { await freeze(14); await page.evaluate(() => { const A = window.__app; A.camera.position.set(60, 70, -760); A.controls.target.set(-352, 80, -1150); A.camera.lookAt(A.controls.target); }); }
        await shot(`rf-${view}-${tag}`);
      }
    }
    console.log(`đã chụp ảnh vào ${SCREENS}`);
  }
} finally {
  await browser.close(); srv.close();
}
if (errors.length) { console.log('Lỗi console:', errors); problems.push('có lỗi console'); }
if (problems.length) { console.log('\nLỖI:'); problems.forEach((p) => console.log(' - ' + p)); process.exit(1); }
console.log('Hai bờ sông Hàn: tất cả kiểm tra đạt.');
