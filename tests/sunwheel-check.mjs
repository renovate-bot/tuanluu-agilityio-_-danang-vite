// Kiểm tra Vòng quay Mặt Trời (xem docs/superpowers/specs/2026-10-22-vong-quay-mat-troi-design.md, mục 8). Mở rộng dần theo giai đoạn.
// Giai đoạn 1 (khung): vị trí, hướng mặt phẳng, kích thước dẫn xuất, dọn nền không đụng nhà/cây ngoài nền, không lỗi console.
// Giai đoạn 2 (hình học): đủ mesh, 64 cabin đứng thẳng, đỉnh cabin 115 m, không chạm hành lang Hầm, lớp 1 + không đổ bóng, LOD,
// draw call do vòng quay thêm vào (góc cũ ≤ 2, gần ≤ 6, ngày = đêm; mục 9 của đặc tả).
//
//   npm run build && node tests/sunwheel-check.mjs
import { fileURLToPath } from 'node:url';
import { serveDir, launch, openApp, frames, pickView } from './lib.mjs';

const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); return ok; };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

const srv = await serveDir(fileURLToPath(new URL('../dist/', import.meta.url)));
const browser = await launch();
const { page, errors } = await openApp(browser, srv.url, { width: 480, height: 270 });
try {
  await frames(page, 3);
  const R = await page.evaluate(() => {
    const { sunWheel: W, scene, THREE } = window.__app;
    scene.updateMatrixWorld(true);
    const o = W.group.localToWorld(new THREE.Vector3(0, 0, 0)), ex = W.group.localToWorld(new THREE.Vector3(1, 0, 0)).sub(o), ez = W.group.localToWorld(new THREE.Vector3(0, 0, 1)).sub(o);
    const SW = W.cfg;
    return {
      inScene: !!W.group.parent, o: o.toArray(), ex: ex.toArray(), ez: ez.toArray(), yaw: W.group.rotation.y,
      hubY: SW.hubY, topY: SW.topY, landY: 2.5,   // landY: mặt đất (copilot-instructions mục 4)
      site: SW.site, cabins: SW.cabins, center: W.center.toArray(),
      stats: W.stats, lodDistance: W.lodDistance, children: W.group.children.map((c) => c.name)
    };
  });
  console.log('sunWheel:', JSON.stringify(R));

  // 1. Có trong cảnh, đặt đúng chỗ
  check(R.inScene, 'SunWheel chưa nằm trong scene');
  check(near(R.o[0], -440, 0.01) && near(R.o[2], 2280, 0.01), `tâm bệ lệch: ${R.o}`);
  // 2. Hướng: phương vị 83° → trục X cục bộ = (sin83°, 0, −cos83°); mặt Nam Đông Nam (+Z cục bộ) = (sin7°, 0, cos7°)
  const az = 83 * Math.PI / 180;
  check(near(R.ex[0], Math.sin(az), 1e-6) && near(R.ex[2], -Math.cos(az), 1e-6), `mặt phẳng không theo phương vị 83°: ${R.ex}`);
  check(R.ez[2] > 0.99 && R.ez[0] > 0, `mặt chính không quay về Nam Đông Nam: ${R.ez}`);
  check(near(R.yaw, 7 * Math.PI / 180, 1e-6), `yaw = ${R.yaw}`);
  // 3. Kích thước: đỉnh cabin 115 m so với mặt đất, trục cao theo suy dẫn
  check(near(R.topY - R.landY, 115, 1e-6), `đỉnh cabin cao ${R.topY - R.landY} m, cần 115`);
  check(near(R.hubY - R.landY, 64, 1e-6), `trục cao ${R.hubY - R.landY} m so với mặt đất`);
  check(R.cabins === 64, `số cabin ${R.cabins}`);
  // 4. Nền không chạm hành lang Hầm |z + 1700| < 30 và nằm trên bờ Tây (x < −262)
  check(R.site.z0 > -1670 && R.site.x1 < -262, `nền ngoài bờ Tây hoặc chạm hầm: ${JSON.stringify(R.site)}`);
  // 5. Dọn nền: khu vực này vốn không có nhà (khu phố |z| < 1 800); cây/đèn kè chỉ tới z = 2 300
  check(R.stats.clearedBuildings === 0, `dọn ${R.stats.clearedBuildings} nhà ở nơi không có nhà`);
  console.log(`dọn nền: nhà ${R.stats.clearedBuildings}, cây/đèn ${R.stats.clearedPlants}`);
  // 6. (GĐ1: khung rỗng → từ GĐ2) group chỉ có phần tĩnh + phần quay, ngoài details/life
  check(['sw-static', 'sw-wheel'].every((n) => R.children.includes(n)) && R.children.every((n) => /details|life|sw-static|sw-wheel/.test(n)), `mesh của vòng quay: ${R.children}`);

  // ---- Giai đoạn 2 ----
  const G = await page.evaluate(() => {
    const { sunWheel: W, scene, THREE } = window.__app;
    scene.updateMatrixWorld(true);
    const cab = W.cabins, m = new THREE.Matrix4(), up = new THREE.Vector3(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    cab.geometry.computeBoundingBox();
    let maxTilt = 0, top = -Infinity;
    for (let i = 0; i < cab.count; i++) {
      cab.getMatrixAt(i, m); m.premultiply(cab.matrixWorld); m.decompose(p, q, s);
      up.set(0, 1, 0).applyQuaternion(q); maxTilt = Math.max(maxTilt, up.angleTo(new THREE.Vector3(0, 1, 0)));
      top = Math.max(top, p.y + cab.geometry.boundingBox.max.y * s.y);
    }
    const box = new THREE.Box3().setFromObject(W.group);
    const meshes = []; W.group.traverse((o) => { if (o.isMesh) meshes.push({ name: o.name, layer0: o.layers.isEnabled(0), cast: o.castShadow }); });
    return { count: cab.count, maxTilt: maxTilt * 180 / Math.PI, top, z0: box.min.z, z1: box.max.z, meshes, inDetails: [cab.parent === W.details, W.sign.parent === W.details], landY: 2.5 };
  });
  console.log('GĐ2:', JSON.stringify(G));
  check(G.count === 64, `số cabin instance ${G.count}`);
  check(G.inDetails.every(Boolean), 'cabin / biển hiệu phải nằm trong details (LOD)');
  check(G.maxTilt <= 2, `cabin nghiêng ${G.maxTilt.toFixed(2)}° (≤ 2°)`);
  check(near(G.top - G.landY, 115, 1), `đỉnh cabin cao nhất ${(G.top - G.landY).toFixed(2)} m so với mặt đất, cần 115 ± 1`);
  check(G.z0 > -1670 || G.z1 < -1730, `vòng quay chạm hành lang Hầm: z ${G.z0}..${G.z1}`);
  check(G.meshes.length >= 4, `chỉ có ${G.meshes.length} mesh`);
  check(G.meshes.every((o) => !o.layer0 && !o.cast), `mesh phải ở lớp 1 (không phản chiếu) và không đổ bóng: ${JSON.stringify(G.meshes)}`);

  /* draw call do vòng quay thêm vào: bật/tắt group, trung vị 3 khung */
  const delta = () => page.evaluate(async () => {
    const { renderer, sunWheel: W } = window.__app;
    const f = () => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
    const fl = () => !!window.__app.weather?.lightning?.flashing?.();
    // Tia chớp (bão) cộng 1 draw call lúc nháy, không thuộc vòng quay: bỏ mẫu có chớp, đo lại tới khi cả hai cửa sổ sạch
    const med = async () => { const xs = []; let flash = false; for (let i = 0; i < 3; i++) { await f(); flash = flash || fl(); xs.push(renderer.info.render.calls); flash = flash || fl(); } return { m: xs.sort((a, b) => a - b)[1], flash }; };
    let on = 0, off = 0;
    for (let k = 0; k < 40; k++) {
      let r = await med(); on = r.m; let bad = r.flash;
      W.group.visible = false; r = await med(); off = r.m; bad = bad || r.flash; W.group.visible = true; await f();
      if (!bad) break;
    }
    return { d: on - off, details: W.details.visible };
  });
  const camLocal = (p, t) => page.evaluate(([p, t]) => {
    const { camera, controls, sunWheel: W, THREE } = window.__app;
    controls.maxPolarAngle = Math.PI * 0.97;
    camera.position.copy(W.group.localToWorld(new THREE.Vector3(...p))); controls.target.copy(W.group.localToWorld(new THREE.Vector3(...t))); controls.update();
  }, [p, t]);
  const setNight = async (v) => {
    await page.evaluate((v) => { window.__app.dayNight.target = v; window.__app.dayNight.night = v; }, v);
    await page.waitForFunction((v) => Math.abs(window.__app.dayNight.night - v) < 1e-6, v, { timeout: 60000 });
    await frames(page, 3);
  };
  // góc cũ có vòng quay trong khung hình (đều xa hơn lodDistance) và camera gần (chính diện, flycam, trên cao)
  const OLD = [['ttl', 'ttlBoth'], ['sh', 'shOverview'], ['dragon', 'bird'], ['tp', 'tpBay']];
  const NEAR = { front: [[0, 8, 230], [0, 55, 0]], fly: [[-150, 150, 320], [0, 45, 0]], top: [[0, 140, 160], [0, 60, 0]] };
  const D = {};
  for (const night of [0, 1]) {
    await setNight(night);
    for (const [b, v] of OLD) { await pickView(page, b, v); await frames(page, 4); D[`${v}|${night}`] = await delta(); }
    for (const [k, [p, t]] of Object.entries(NEAR)) { await camLocal(p, t); await frames(page, 3); D[`${k}|${night}`] = await delta(); }
  }
  console.log('draw call vòng quay:', JSON.stringify(D));
  for (const [, v] of OLD) for (const n of [0, 1]) {
    check(D[`${v}|${n}`].d <= 2, `${v} ${n ? 'đêm' : 'ngày'}: vòng quay thêm ${D[`${v}|${n}`].d} draw call (≤ 2)`);
    check(!D[`${v}|${n}`].details, `${v}: chi tiết (cabin) phải ẩn ở xa`);
  }
  for (const k of Object.keys(NEAR)) for (const n of [0, 1]) {
    check(D[`${k}|${n}`].d <= 6, `${k} ${n ? 'đêm' : 'ngày'}: vòng quay thêm ${D[`${k}|${n}`].d} draw call (≤ 6)`);
    check(D[`${k}|${n}`].details, `${k}: chi tiết phải hiện ở gần`);
  }
  for (const k of [...OLD.map(([, v]) => v), ...Object.keys(NEAR)]) check(D[`${k}|0`].d === D[`${k}|1`].d, `${k}: draw call vòng quay ngày ${D[`${k}|0`].d} ≠ đêm ${D[`${k}|1`].d}`);
  // ---- Giai đoạn 3: quay, cabin đứng thẳng, tốc độ, góc nhìn sw* (mục 3, 9, 11) ----
  // 1. Chu kỳ: tích phân deterministic W.advance(giây); page.evaluate chạy đồng bộ nên vòng lặp thật không chen vào
  const M = await page.evaluate(() => {
    const { sunWheel: W } = window.__app, TAU = Math.PI * 2, out = {};
    const wrap = (d) => ((d % TAU) + TAU) % TAU;
    W.setSpeed(1); W.advance(30); out.speed1 = W.speedNow();                       // đã ở ×1 từ đầu
    W.setAngle(0); W.advance(90); out.a90 = W.angle();                              // ×1, 90 s → 2π/10
    W.setSpeed(60); W.advance(5); out.mid = W.speedNow(); W.advance(10); out.speed60 = W.speedNow();   // đổi tốc độ mượt: 1 → 60 mất ≈ 9,8 s
    W.setAngle(0); W.advance(10); out.a60 = W.angle();                              // ×60, 10 s → 2π·600/900 = 4π/3
    W.setSpeed(10); W.advance(10); W.setAngle(0); W.advance(30); out.a10 = W.angle();   // ×10, 30 s → 2π/3
    W.setSpeed(60); W.advance(12); W.setSpeed(0); W.advance(5); out.stopMid = W.speedNow(); W.advance(6); out.stopped = W.speedNow(); const a = W.angle(); W.advance(20); out.stopDrift = wrap(W.angle() - a);
    W.setSpeed(1); W.advance(1);
    out.omega = W.cfg.omega; out.accel = W.cfg.speedAccel;
    return out;
  });
  console.log('GĐ3 chu kỳ:', JSON.stringify(M));
  const TAU = 2 * Math.PI;
  check(near(M.speed1, 1, 1e-9), `tốc độ mặc định ${M.speed1}, cần 1`);
  check(near(M.a90 / (TAU / 10), 1, 0.01), `×1 sau 90 s góc ${M.a90} rad, cần ${TAU / 10} (sai ≤ 1 %)`);
  check(near(M.mid, 1 + 5 * M.accel, 1e-6) && M.speed60 === 60, `đổi tốc độ không mượt: sau 5 s ${M.mid}, sau 15 s ${M.speed60}`);
  check(near(M.a60 / (TAU * 600 / 900), 1, 0.01), `×60 sau 10 s góc ${M.a60}, cần ${TAU * 600 / 900} (60 lần ×1)`);
  check(near(M.a10 / (TAU * 30 * 10 / 900), 1, 0.01), `×10 sau 30 s góc ${M.a10}, cần ${TAU * 300 / 900}`);
  check(near(M.stopMid, 60 - 5 * M.accel, 1e-6) && M.stopped === 0 && M.stopDrift === 0, `dừng: giữa chừng ${M.stopMid}, cuối ${M.stopped}, trôi ${M.stopDrift}`);
  // 2–3. Cabin đứng thẳng, bám vành, đỉnh cabin 115 m ở mọi góc
  const C = await page.evaluate(() => {
    const { sunWheel: W, scene, THREE } = window.__app, SW = W.cfg;
    scene.updateMatrixWorld(true);
    const hub = W.group.localToWorld(new THREE.Vector3(0, SW.hubY, 0)), up = new THREE.Vector3(), p = new THREE.Vector3(), q = new THREE.Vector3();
    W.cabins.geometry.computeBoundingBox(); const halfH = W.cabins.geometry.boundingBox.max.y;
    let maxTilt = 0, ringErr = 0, lockErr = 0, top = -Infinity, topMin = Infinity, zMin = Infinity, zMax = -Infinity, stepErr = 0;
    for (const th of [0, 0.7, 2.1, 3.9, 5.5]) {
      W.setAngle(th);
      // điểm vành ở góc th trong khung của group quay → cabin 0 phải ở cùng hướng từ trục
      W.wheel.updateWorldMatrix(true, false);
      const rim = W.wheel.localToWorld(new THREE.Vector3(SW.rimR, 0, 0)).sub(hub).normalize();
      for (let i = 0; i < SW.cabins; i++) {
        W.cabinUp(i, up); maxTilt = Math.max(maxTilt, up.angleTo(new THREE.Vector3(0, 1, 0)));
        W.cabinWorld(i, p); const d = p.clone().sub(hub);
        ringErr = Math.max(ringErr, Math.abs(d.length() - SW.cabinR), Math.abs(d.dot(W.group.localToWorld(new THREE.Vector3(0, 0, 1)).sub(W.group.localToWorld(new THREE.Vector3())))));
        zMin = Math.min(zMin, p.z); zMax = Math.max(zMax, p.z);
        if (i === 0) lockErr = Math.max(lockErr, d.clone().normalize().angleTo(rim));
        if (i > 0) { W.cabinWorld(i - 1, q); stepErr = Math.max(stepErr, Math.abs(q.distanceTo(p) - 2 * SW.cabinR * Math.sin(SW.cabinStep / 2))); }
      }
    }
    for (let k = 0; k < 126; k++) {   // đỉnh cabin cao nhất theo từng góc (cabin ở giờ 12 khi θ + i·bước = π/2)
      W.setAngle(k * 0.05); let t = -Infinity; for (let i = 0; i < SW.cabins; i++) t = Math.max(t, W.cabinWorld(i, p).y + halfH);
      top = Math.max(top, t); topMin = Math.min(topMin, t);
    }
    W.setAngle(0);
    return { maxTilt: maxTilt * 180 / Math.PI, ringErr, lockErr: lockErr * 180 / Math.PI, stepErr, top, topMin, zMin, zMax, landY: 2.5 };
  });
  console.log('GĐ3 cabin:', JSON.stringify(C));
  check(C.maxTilt <= 2, `cabin nghiêng ${C.maxTilt.toFixed(3)}° khi quay (≤ 2°)`);
  check(C.ringErr < 1e-3, `cabin lệch khỏi vòng bán kính cabinR hoặc ra ngoài mặt phẳng: ${C.ringErr}`);
  check(C.stepErr < 1e-3, `khoảng cách giữa hai cabin liền kề không đều: ${C.stepErr}`);
  check(C.lockErr < 0.01, `cabin 0 không bám đúng điểm vành (lệch ${C.lockErr.toFixed(4)}°)`);
  check(near(C.top - C.landY, 115, 1) && near(C.topMin - C.landY, 115, 4.5), `đỉnh cabin cao nhất ${(C.top - C.landY).toFixed(2)} m (min theo góc ${(C.topMin - C.landY).toFixed(2)} m), cần 115 ± 1`);
  check(C.zMin > -1670 || C.zMax < -1730, `cabin vào hành lang Hầm: z ${C.zMin}..${C.zMax}`);
  // Ngưỡng 1e-4 m: ma trận instance là float32 (ulp ở y≈115 m ≈ 7,6e-6 m, đo được 1,8e-6 m); ma trận trễ một bước placeEps (1e-4 rad × cabinR ≈ 4,6e-3 m) vẫn bị bắt
  const SYNC_TOL = 1e-4;
  // Đường cập nhật theo khung: ma trận instance (đọc thô, không ép dựng lại) bám đúng góc khi nhìn gần; ở xa thì được phép trễ, quay lại gần thì đúng ngay
  const sync = (label) => page.evaluate((label) => {
    const { sunWheel: W, THREE } = window.__app, SW = W.cfg, m = new THREE.Matrix4(), p = new THREE.Vector3();
    W.cabins.getMatrixAt(0, m); p.setFromMatrixPosition(m);
    const th = W.angle(), ex = Math.cos(th) * SW.cabinR, ey = SW.hubY + Math.sin(th) * SW.cabinR;
    return { label, err: Math.hypot(p.x - ex, p.y - ey), details: W.details.visible, th };
  }, label);
  await camLocal(...NEAR.front); await page.evaluate(() => window.__app.sunWheel.setSpeed(60)); await frames(page, 6);
  const S1 = await sync('gần'); check(S1.details && S1.err < SYNC_TOL, `gần: cabin không bám góc vòng quay (lệch ${S1.err} m, details ${S1.details})`);
  await page.evaluate(() => { const { camera, controls } = window.__app; camera.position.set(0, 300, -3000); controls.target.set(0, 0, -2900); controls.update(); }); await frames(page, 4);
  const far0 = await page.evaluate(() => ({ th: window.__app.sunWheel.angle(), vis: window.__app.sunWheel.details.visible }));
  await frames(page, 6);
  const far1 = await page.evaluate(() => ({ th: window.__app.sunWheel.angle(), vis: window.__app.sunWheel.details.visible }));
  check(!far1.vis && Math.abs(far1.th - far0.th) > 1e-3, `ở xa vòng quay vẫn phải quay (góc ${far0.th} → ${far1.th}, details ${far1.vis})`);
  await camLocal(...NEAR.front); await frames(page, 4);
  const S2 = await sync('quay lại gần'); check(S2.details && S2.err < SYNC_TOL, `quay lại gần: cabin chưa bám góc (lệch ${S2.err} m)`);
  await page.evaluate(() => window.__app.sunWheel.setSpeed(1));

  // 6. Draw call ở các góc nhìn sw* (≤ 6, ngày = đêm, quay không đổi số draw call); chọn góc xong mới đặt ngày/đêm vì swNight tự chuyển sang đêm
  const SWV = ['swOverview', 'swFront', 'swBase', 'swFromTTL', 'swNight', 'swTop'];
  const DS = {};
  for (const speed of [0, 60]) for (const night of [0, 1]) for (const v of SWV) {
    await pickView(page, 'sw', v); await setNight(night); await page.evaluate((s) => window.__app.sunWheel.setSpeed(s), speed); await frames(page, 4);
    DS[`${v}|${night}|${speed}`] = await delta();
  }
  await page.evaluate(() => window.__app.sunWheel.setSpeed(1));
  console.log('draw call góc sw*:', JSON.stringify(DS));
  for (const v of SWV) {
    for (const n of [0, 1]) for (const s of [0, 60]) check(DS[`${v}|${n}|${s}`].d <= 6, `${v} ${n ? 'đêm' : 'ngày'} ×${s}: vòng quay thêm ${DS[`${v}|${n}|${s}`].d} draw call (≤ 6)`);
    check(DS[`${v}|0|0`].d === DS[`${v}|1|0`].d && DS[`${v}|0|60`].d === DS[`${v}|1|60`].d, `${v}: draw call ngày ≠ đêm (${DS[`${v}|0|0`].d}/${DS[`${v}|1|0`].d})`);
    check(DS[`${v}|0|0`].d === DS[`${v}|0|60`].d, `${v}: quay làm đổi draw call (${DS[`${v}|0|0`].d} → ${DS[`${v}|0|60`].d})`);
  }
  // Góc nhìn sw*: camera trên mặt đất, đích nhìn vào vòng quay, mọi góc đã có nút
  const V = await page.evaluate(async (list) => {
    const { camera, controls } = window.__app, out = {};
    for (const v of list) { document.querySelector(`button[data-view="${v}"]`).click(); await new Promise((ok) => setTimeout(ok, 50)); out[v] = { btn: !!document.querySelector(`[data-list="sw"] button[data-view="${v}"]`) }; }
    return out;
  }, SWV);
  for (const v of SWV) check(V[v].btn, `thiếu nút góc nhìn ${v} trong nhóm sw`);

  // UI: nút công trình, ô tốc độ, bảng thông số
  const U = await page.evaluate(async () => {
    const sel = document.getElementById('swSpeed'), out = {};
    const list = document.querySelector('[data-list="sw"]'), others = [...document.querySelectorAll('[data-list]')].filter((l) => l !== list);
    document.querySelector('button[data-bridge="sw"]').click();
    out.listShown = !list.hidden && others.every((l) => l.hidden);
    out.opts = [...sel.options].map((o) => o.value);
    for (const v of ['10', '0', '60', '1']) { sel.value = v; sel.dispatchEvent(new Event('change')); out['g' + v] = window.__app.sunWheel.speedTarget(); }
    out.note = document.getElementById('specNote').textContent; out.span = document.getElementById('specSpanVal').textContent;
    return out;
  });
  check(U.listShown, 'chọn Vòng quay phải hiện danh sách góc nhìn sw và ẩn nhóm khác');
  check(U.opts.join() === '0,1,10,60', `ô tốc độ: ${U.opts}`);
  check(U.g10 === 10 && U.g0 === 0 && U.g60 === 60 && U.g1 === 1, `ô tốc độ không đặt đúng tốc độ đích: ${JSON.stringify(U)}`);
  check(U.note.length > 40 && !/^sw[A-Z]/.test(U.note) && /2025/.test(U.note), `bảng thông số chưa có ghi chú hiện trạng: ${U.note}`);
  // ---- Giai đoạn 5: ngồi cabin (mục 5, 11.4, 9) ----
  // Camera gắn cabin: SunWheel.update đặt tư thế ngay sau advance(), nên giữa hai khung hình camera luôn đúng bằng mắt của cabin (kể cả khi quay ×60)
  const RS = {
    snap: () => page.evaluate(() => {
      const { camera, controls, cam, swRide: R } = window.__app;
      return { mode: cam.mode, enabled: controls.enabled, maxPolar: controls.maxPolarAngle, pos: camera.position.toArray(), target: controls.target.toArray(), fwd: camera.getWorldDirection(new window.__app.THREE.Vector3()).toArray(), blend: R.blend, cabin: R.cabin, yaw: R.yaw, pitch: R.pitch,
        pressed: document.querySelector('button[data-view="swRide"]').getAttribute('aria-pressed'), hint: !document.getElementById('swRideHint').hidden, hintText: document.getElementById('swRideHint').textContent };
    }),
    /* sai lệch giữa camera và (tâm cabin đang ngồi + eyeUp) trong khung hình hiện tại */
    err: () => page.evaluate(() => {
      const { camera, sunWheel: W, swRide: R, THREE } = window.__app, p = new THREE.Vector3();
      W.cabinWorld(R.cabin, p); p.y += W.cfg.ride.eyeUp;
      return p.distanceTo(camera.position);
    }),
    flightDone: async () => { await page.evaluate(() => { const f = window.__app.cam.flight; if (window.__app.cam.mode === 'fly') f.t = Math.max(f.t, 0.999); }); await page.waitForFunction(() => window.__app.cam.mode !== 'fly', null, { timeout: 240000 }); await frames(page, 2); }
  };
  const rideClick = () => page.evaluate(() => document.querySelector('button[data-view="swRide"]').click());   // click DOM thật (cùng bộ xử lý như người bấm), không phụ thuộc cuộn của bảng ở màn nhỏ
  const near3 = (a, b, tol) => a.every((v, i) => Math.abs(v - b[i]) <= tol);
  const rideMeshes0 = await page.evaluate(() => { let n = 0; window.__app.sunWheel.group.traverse((o) => { if (o.isMesh) n++; }); return n; });

  await pickView(page, 'sw', 'swFront');
  await page.evaluate(() => { const W = window.__app.sunWheel; W.setSpeed(0); W.advance(2); W.setAngle(0.3); });
  await frames(page, 2);
  const B = await RS.snap();
  check(B.mode === 'orbit' && B.enabled && B.pressed === 'false' && !B.hint, `trước khi lên cabin: ${JSON.stringify({ m: B.mode, e: B.enabled, p: B.pressed, h: B.hint })}`);

  // 4a. Lên cabin bằng nút Ngồi cabin
  await rideClick();
  const E0 = await RS.snap();
  check(E0.mode === 'swRide' && !E0.enabled, `lên cabin: mode ${E0.mode}, OrbitControls enabled = ${E0.enabled} (cần swRide / false)`);
  check(E0.pressed === 'true' && E0.hint, `lên cabin: nút aria-pressed ${E0.pressed}, dòng hướng dẫn hiện ${E0.hint}`);
  check(E0.hintText.length > 20 && !/^swRide/.test(E0.hintText), `dòng hướng dẫn chưa dịch: ${E0.hintText}`);
  // cabin lên là cabin ở đáy vòng quay (góc gần −π/2 nhất)
  const board = await page.evaluate(() => {
    const { sunWheel: W, swRide: R } = window.__app, TAU = Math.PI * 2, th = W.angle();
    let best = 0, bd = 9; for (let i = 0; i < W.cfg.cabins; i++) { const a = th + i * W.cfg.cabinStep + Math.PI / 2, d = Math.abs(Math.atan2(Math.sin(a), Math.cos(a))); if (d < bd) { bd = d; best = i; } }
    return { best, got: R.cabin, off: bd };
  });
  check(board.got === board.best && board.off <= Math.PI / 64 + 1e-9, `cabin lên không phải cabin ở đáy: ${JSON.stringify(board)}`);
  // có chặng bay vào cabin (blend < 1 ngay sau khi bấm), rồi bám cabin
  check(E0.blend < 1, `lên cabin không có chặng bay vào (blend ${E0.blend})`);
  await page.evaluate(() => { window.__app.swRide.blend = 1; }); await frames(page, 3);
  const e1 = await RS.err(); check(e1 < 1e-3, `ngồi cabin ×0: camera lệch tâm cabin + eyeUp ${e1} m`);
  // hướng nhìn mặc định: về Bắc (−Z cục bộ), hơi cúi
  const L0 = await RS.snap();
  const sy = Math.sin(7 * Math.PI / 180), cy = Math.cos(7 * Math.PI / 180);
  const horiz = Math.hypot(L0.fwd[0], L0.fwd[2]);
  check((L0.fwd[0] * -sy + L0.fwd[2] * -cy) / horiz > 0.999, `hướng nhìn mặc định không về Bắc (−Z cục bộ): ${L0.fwd}`);
  check(near(L0.fwd[1], Math.sin(L0.pitch), 1e-6), `độ cúi ${L0.fwd[1]} ≠ sin(pitch) ${Math.sin(L0.pitch)}`);
  // camera theo cabin ở nhiều góc vòng quay (×0); thêm hai góc đưa cabin đang ngồi lên đỉnh (π/2) và xuống đáy (−π/2): ở đỉnh mắt cao ≈ 115 m
  const ride = await page.evaluate(async () => {
    const { camera, sunWheel: W, swRide: R } = window.__app, SW = W.cfg, out = { err: 0, maxY: -Infinity, minY: Infinity };
    const angles = Array.from({ length: 24 }, (_, k) => k * Math.PI / 12); angles.push(Math.PI / 2 - R.cabin * SW.cabinStep, -Math.PI / 2 - R.cabin * SW.cabinStep);
    for (const th of angles) {
      W.setAngle(th); await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
      const e = W.cabinWorld(R.cabin); e.y += SW.ride.eyeUp; out.err = Math.max(out.err, e.distanceTo(camera.position));
    }
    W.setAngle(Math.PI / 2 - R.cabin * SW.cabinStep); await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))); out.maxY = camera.position.y;
    W.setAngle(-Math.PI / 2 - R.cabin * SW.cabinStep); await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))); out.minY = camera.position.y;
    out.topExpect = SW.hubY + SW.cabinR + SW.ride.eyeUp; out.botExpect = SW.hubY - SW.cabinR + SW.ride.eyeUp;
    return out;
  });
  console.log('GĐ5 ride ×0:', JSON.stringify(ride));
  check(ride.err < 1e-3, `ngồi cabin ×0: camera lệch cabin tới ${ride.err} m khi đổi góc`);
  check(near(ride.maxY, ride.topExpect, 0.05) && near(ride.minY, ride.botExpect, 0.05), `mắt cao ${ride.minY.toFixed(2)}..${ride.maxY.toFixed(2)} m, cần ${ride.botExpect.toFixed(2)}..${ride.topExpect.toFixed(2)}`);
  check(ride.maxY - 2.5 > 100, `ở đỉnh vòng quay mắt chỉ cao ${(ride.maxY - 2.5).toFixed(1)} m so với mặt đất (cần ~115 m)`);

  // quay ×60: camera đi theo cabin liên tục, sai lệch giữa các khung = 0 (cùng khung hình), và thật sự di chuyển
  const fast = await page.evaluate(async () => {
    const { camera, sunWheel: W, swRide: R } = window.__app, out = { err: 0, maxY: -Infinity, minY: Infinity, th0: 0, th1: 0 };
    W.setSpeed(60); W.advance(12); out.th0 = W.angle();
    await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));   // advance() tay làm góc nhảy: chờ vòng lặp thật kéo camera theo rồi mới so
    for (let k = 0; k < 14; k++) {
      await new Promise((ok) => requestAnimationFrame(ok));
      const e = W.cabinWorld(R.cabin).clone(); e.y += W.cfg.ride.eyeUp; out.err = Math.max(out.err, e.distanceTo(camera.position));
      out.maxY = Math.max(out.maxY, camera.position.y); out.minY = Math.min(out.minY, camera.position.y);
    }
    out.th1 = W.angle(); W.setSpeed(0); W.advance(2);
    return out;
  });
  console.log('GĐ5 ride ×60:', JSON.stringify(fast));
  check(fast.err < 1e-3, `ngồi cabin ×60: camera lệch cabin tới ${fast.err} m (phải cùng khung hình)`);
  check(Math.abs(fast.th1 - fast.th0) > 0.05 && fast.maxY - fast.minY > 3, `×60: vòng quay không quay hoặc camera không đi theo (Δθ ${fast.th1 - fast.th0}, Δy ${fast.maxY - fast.minY})`);

  // kéo chuột để nhìn quanh: đổi hướng nhìn, KHÔNG làm di chuyển camera (OrbitControls đã tắt)
  const pt = await page.evaluate(() => { const c = document.getElementById('scene'); for (let y = 20; y < 260; y += 10) for (let x = 20; x < 470; x += 10) if (document.elementFromPoint(x, y) === c) return [x, y]; return null; });
  check(!!pt, 'không có điểm nào trên canvas để thử kéo chuột');
  if (pt) {
    const before = await RS.snap();
    await page.mouse.move(pt[0], pt[1]); await page.mouse.down(); await page.mouse.move(pt[0] + 60, pt[1] + 20); await page.mouse.up(); await frames(page, 2);
    const after = await RS.snap();
    check(near(after.yaw - before.yaw, 60 * 0.005, 0.02) && near(after.pitch - before.pitch, 20 * 0.005, 0.02), `kéo (60, 20) px: yaw ${after.yaw - before.yaw}, pitch ${after.pitch - before.pitch} (cần 0,3 / 0,1)`);
    check(!near3(after.fwd, before.fwd, 1e-3), 'kéo chuột không đổi hướng nhìn');
    check((await RS.err()) < 1e-3, 'kéo chuột làm camera rời cabin');
    await page.mouse.move(pt[0], pt[1]); await page.mouse.down(); await page.mouse.move(pt[0], pt[1] + 4000); await page.mouse.up(); await frames(page, 2);
    const lim = await RS.snap(); const pm = await page.evaluate(() => window.__app.sunWheel.cfg.ride.pitchMax);
    check(near(lim.pitch, pm, 1e-9), `giới hạn cúi/ngẩng: pitch ${lim.pitch}, cần ${pm}`);
  }

  // draw call khi ngồi cabin: ≤ 6, ngày = đêm, quay không đổi (không thêm mesh/đèn)
  // Cắt khung hình phụ thuộc hướng nhìn (ngẩng hết cỡ thì biển hiệu ở quảng trường nằm ngoài khung → bớt 1 draw call), nên mỗi mẫu đo cùng hướng nhìn mặc định
  // và vòng quay đã đạt hẳn tốc độ đích (advance 15 s > thời gian tăng/giảm tốc 10 s), không đo lúc đang giảm tốc với camera đang chạy theo cabin.
  const lookAt = (pitch) => page.evaluate((p) => { const R = window.__app.swRide; R.yaw = 0; R.pitch = p === null ? window.__app.sunWheel.cfg.ride.pitch0 : window.__app.sunWheel.cfg.ride.pitchMax; }, pitch);
  const settleWheel = (s) => page.evaluate((s) => { const W = window.__app.sunWheel; W.setSpeed(s); W.advance(15); if (s === 0) W.setAngle(0.3); }, s);
  const DR = {};
  for (const speed of [0, 60]) for (const night of [0, 1]) {
    await lookAt(null); await setNight(night); await settleWheel(speed); await frames(page, 4);
    DR[`${night}|${speed}`] = await delta();
  }
  // ngẩng hết cỡ (pitchMax), vòng quay dừng cùng một góc: ngày = đêm, vẫn ≤ 6
  const DRup = {};
  for (const night of [0, 1]) { await lookAt('max'); await setNight(night); await settleWheel(0); await frames(page, 4); DRup[night] = await delta(); }
  console.log('draw call ngồi cabin, ngẩng hết cỡ:', JSON.stringify(DRup));
  for (const n of [0, 1]) check(DRup[n].d <= 6 && DRup[n].details, `ngồi cabin ngẩng hết cỡ (${n ? 'đêm' : 'ngày'}): vòng quay thêm ${DRup[n].d} draw call (≤ 6), details ${DRup[n].details}`);
  check(DRup[0].d === DRup[1].d, `ngồi cabin ngẩng hết cỡ: draw call ngày ${DRup[0].d} ≠ đêm ${DRup[1].d}`);
  await lookAt(null);
  console.log('draw call ngồi cabin:', JSON.stringify(DR));
  for (const k of Object.keys(DR)) check(DR[k].d <= 6 && DR[k].details, `ngồi cabin (${k}): vòng quay thêm ${DR[k].d} draw call (≤ 6), details ${DR[k].details}`);
  check(DR['0|0'].d === DR['1|0'].d && DR['0|60'].d === DR['1|60'].d, `ngồi cabin: draw call ngày ≠ đêm (${DR['0|0'].d}/${DR['1|0'].d})`);
  check(DR['0|0'].d === DR['0|60'].d, `ngồi cabin: quay làm đổi draw call (${DR['0|0'].d} → ${DR['0|60'].d})`);
  const rideMeshes1 = await page.evaluate(() => { let n = 0; window.__app.sunWheel.group.traverse((o) => { if (o.isMesh) n++; }); return n; });
  check(rideMeshes1 === rideMeshes0, `ngồi cabin thêm mesh vào vòng quay: ${rideMeshes0} → ${rideMeshes1}`);
  await page.evaluate(() => { window.__app.sunWheel.setSpeed(0); window.__app.sunWheel.advance(2); window.__app.sunWheel.setAngle(0.3); }); await setNight(0); await frames(page, 2);

  // 4b. Xuống cabin bằng Esc: bay về chỗ cũ, OrbitControls trả như cũ
  const checkRestored = async (how) => {
    const s = await RS.snap();
    check(s.mode === 'fly', `${how}: sau khi xuống mode ${s.mode}, cần fly (bay về chỗ cũ)`);
    check(s.pressed === 'false' && !s.hint, `${how}: nút ${s.pressed}, dòng hướng dẫn hiện ${s.hint}`);
    await RS.flightDone();
    const r = await RS.snap();
    check(r.mode === 'orbit' && r.enabled, `${how}: sau chuyến bay mode ${r.mode}, OrbitControls enabled ${r.enabled}`);
    check(near(r.maxPolar, B.maxPolar, 1e-9), `${how}: maxPolarAngle ${r.maxPolar} ≠ ${B.maxPolar}`);
    check(near3(r.pos, B.pos, 1e-3) && near3(r.target, B.target, 1e-3), `${how}: camera không về chỗ cũ: ${r.pos} / ${r.target} vs ${B.pos} / ${B.target}`);
  };
  await page.keyboard.press('Escape');
  await checkRestored('Esc');
  // OrbitControls dùng lại được: kéo chuột làm camera xoay quanh target
  const o0 = await RS.snap();
  if (pt) { await page.mouse.move(pt[0], pt[1]); await page.mouse.down(); await page.mouse.move(pt[0] + 40, pt[1]); await page.mouse.up(); await frames(page, 3); }
  const o1 = await RS.snap();
  check(!near3(o0.pos, o1.pos, 1e-3), 'sau khi xuống cabin, kéo chuột không xoay được camera (OrbitControls chưa trả)');
  // xuống bằng cách bấm lại nút (hai lần: vào rồi ra)
  await pickView(page, 'sw', 'swFront');
  await rideClick(); await frames(page, 2);
  const B2 = await RS.snap();
  check(B2.mode === 'swRide', 'lần 2: không lên được cabin');
  const sv = await page.evaluate(() => ({ p: window.__app.swRide.saved.pos.toArray(), t: window.__app.swRide.saved.target.toArray() }));
  await rideClick();
  { const s = await RS.snap(); check(s.mode === 'fly' && s.pressed === 'false' && !s.hint, `bấm lại nút: mode ${s.mode}, nút ${s.pressed}, hint ${s.hint}`); }
  await RS.flightDone();
  { const r = await RS.snap(); check(r.mode === 'orbit' && r.enabled && near3(r.pos, sv.p, 1e-3) && near3(r.target, sv.t, 1e-3), `bấm lại nút: không về chỗ cũ (${r.mode}, ${r.enabled})`); }
  // đổi góc nhìn khác: thoát ngay, bay tới góc mới (không bay về chỗ cũ)
  await rideClick(); await frames(page, 2);
  await page.evaluate(() => document.querySelector('button[data-view="swTop"]').click());
  { const s = await RS.snap(); check(s.mode === 'fly' && !s.hint && s.pressed === 'false', `đổi góc nhìn khi ngồi: mode ${s.mode}, hint ${s.hint}`); }
  await RS.flightDone();
  { const r = await RS.snap(); check(r.mode === 'orbit' && r.enabled, `đổi góc nhìn: sau chuyến bay mode ${r.mode}, enabled ${r.enabled}`); }
  // bắt đầu Tour khác: thoát cabin, vào đường bay Tour; Esc thoát Tour và trả OrbitControls
  await rideClick(); await frames(page, 2);
  await page.evaluate(() => document.querySelector('button[data-view="tpTour"]').click());
  { const s = await page.evaluate(() => ({ mode: window.__app.cam.mode, then: window.__app.cam.flight.then, hint: !document.getElementById('swRideHint').hidden })); check(s.mode === 'fly' && s.then === 'tour' && !s.hint, `bắt đầu Tour khi ngồi cabin: ${JSON.stringify(s)}`); }
  await page.keyboard.press('Escape'); await frames(page, 2);
  { const r = await RS.snap(); check(r.mode === 'orbit' && r.enabled, `thoát Tour sau khi rời cabin: mode ${r.mode}, enabled ${r.enabled}`); }
  // Esc khi không ngồi: không làm gì
  await page.keyboard.press('Escape'); await frames(page, 2);
  { const r = await RS.snap(); check(r.mode === 'orbit' && r.enabled && !r.hint, `Esc khi không ngồi cabin đổi trạng thái: ${r.mode}`); }
  await page.evaluate(() => window.__app.sunWheel.setSpeed(1));

  // ---- Giai đoạn 6: thời tiết (mục 6, 11.5, 9) ----
  // Dừng theo `closed` của preset Bão (weatherFx.wheelStopped, không có ngưỡng gió); cabin lắc theo windFx; mặt ướt do option `weather` của bridgePatch.
  const { setWx } = await import('./weather-lib.mjs');
  const fxNow = () => page.evaluate(() => ({ stopped: window.__app.weather.fx().wheelStopped, closed: window.__app.weather.state.current.closed }));
  const cabinTilt = () => page.evaluate(() => {   // góc nghiêng (rad) của 64 cabin so với trục Y, và thành phần ngang của trục lên chiếu theo hướng gió (≤ 0: nghiêng ngược gió, đáy xuôi gió)
    const { sunWheel: W, windFx, THREE } = window.__app, up = new THREE.Vector3(), wl = Math.hypot(windFx.x, windFx.z);
    let max = 0, along = -Infinity, min = Infinity; const ys = [];
    for (let i = 0; i < W.cfg.cabins; i++) {
      W.cabinUp(i, up); const a = Math.acos(Math.min(1, up.y)); max = Math.max(max, a); min = Math.min(min, a); ys.push(a);
      if (wl > 1e-3) along = Math.max(along, (up.x * windFx.x + up.z * windFx.z) / wl);
    }
    return { max, min, along, a0: ys[0], amp: W.sway().amp, wind: wl, maxTilt: W.cfg.storm.sway.maxTilt, stopSec: W.cfg.storm.stopSec };
  });
  const DEG2 = 2 * Math.PI / 180;

  // 5a. `now`: không đổi gì — không dừng, không lắc, cabin đứng thẳng
  await setWx(page, 'now');
  await page.evaluate(() => { const W = window.__app.sunWheel; W.setSpeed(60); W.advance(15); });
  await pickView(page, 'sw', 'swFront'); await camLocal([0, 8, 230], [0, 55, 0]); await frames(page, 4);
  { const f = await fxNow(), t = await cabinTilt();
    check(!f.stopped && !f.closed, `now: wheelStopped ${f.stopped}, closed ${f.closed}`);
    check(t.amp === 0 && t.max <= DEG2, `now: cabin lắc (amp ${t.amp}, nghiêng tối đa ${t.max} rad)`); }

  // 5b. Bão từ ×60: wheelStopped bật, tốc độ giảm tuyến tính và về 0 đúng sau stopSec kể từ lúc bắt đầu dừng; tốc độ người dùng chọn giữ nguyên
  await setWx(page, 'storm'); await frames(page, 3);
  { const f = await fxNow(); check(f.stopped && f.closed, `bão: wheelStopped ${f.stopped}, closed ${f.closed} (cần true)`); }
  const stopAt = (k) => page.evaluate((k) => {
    const W = window.__app.sunWheel, from = W.stopping(), rate = from / W.cfg.storm.stopSec, s0 = W.speedNow();
    const tZero = s0 / rate, out = { k, from, s0, tZero, stopSec: W.cfg.storm.stopSec, goal0: W.speedTarget() };
    W.advance(Math.min(4, tZero / 2)); out.sMid = W.speedNow(); out.expectMid = s0 - rate * Math.min(4, tZero / 2);
    W.advance(tZero - Math.min(4, tZero / 2) - 0.1); out.sBefore = W.speedNow();
    W.advance(0.2); out.sAfter = W.speedNow(); out.a1 = W.angle();
    W.advance(5); out.a2 = W.angle(); out.goal1 = W.speedTarget();
    return out;
  }, k);
  const S60 = await stopAt(60);
  console.log('GĐ6 dừng từ ×60:', JSON.stringify(S60));
  check(near(S60.from, 60, 1e-6) && S60.goal0 === 60 && S60.goal1 === 60, `dừng từ ×60: tốc độ lúc dừng ${S60.from}, đích người dùng ${S60.goal0} → ${S60.goal1} (phải giữ 60)`);
  check(S60.tZero <= S60.stopSec + 1e-6 && S60.tZero >= S60.stopSec - 2, `dừng từ ×60: còn ${S60.tZero} s tới 0, stopSec ${S60.stopSec}`);
  check(near(S60.sMid, S60.expectMid, 1e-6), `dừng từ ×60: giảm tốc không tuyến tính (${S60.sMid} vs ${S60.expectMid})`);
  check(S60.sBefore > 0 && S60.sAfter === 0, `dừng từ ×60: trước mốc ${S60.sBefore}, sau mốc ${S60.sAfter} (cần > 0 rồi đúng 0)`);
  check(S60.a2 === S60.a1, `dừng từ ×60: vòng quay vẫn trôi sau khi dừng (${S60.a1} → ${S60.a2})`);
  // bão từ ×1 cũng dừng đúng stopSec
  await setWx(page, 'now'); await frames(page, 3);
  await page.evaluate(() => { const W = window.__app.sunWheel; W.setSpeed(1); W.advance(15); });
  await setWx(page, 'storm'); await frames(page, 3);
  const SP1 = await stopAt(1);
  console.log('GĐ6 dừng từ ×1:', JSON.stringify(SP1));
  check(near(SP1.from, 1, 1e-6) && SP1.tZero <= SP1.stopSec + 1e-6 && SP1.tZero >= SP1.stopSec - 2 && SP1.sBefore > 0 && SP1.sAfter === 0 && SP1.a2 === SP1.a1, `dừng từ ×1 không đúng thời gian: ${JSON.stringify(SP1)}`);

  // 5c. Cabin lắc theo gió trong bão: có nghiêng, ≤ maxTilt, đáy xuôi gió, đổi theo thời gian; vẫn không thêm mesh
  await frames(page, 3);
  const T1 = await cabinTilt();
  console.log('GĐ6 cabin lắc:', JSON.stringify(T1));
  check(T1.wind > 1 && T1.amp > 0, `bão: gió ${T1.wind} m/s, biên độ lắc ${T1.amp} rad (cần > 0)`);
  check(T1.max > DEG2 && T1.max <= T1.maxTilt + 1e-6, `bão: cabin nghiêng tối đa ${T1.max} rad, cần trong (2°; ${T1.maxTilt}]`);
  check(T1.along <= 1e-6, `bão: cabin nghiêng về phía gió (thành phần ${T1.along}), đáy phải xuôi gió`);
  const T2 = await page.evaluate(() => { const W = window.__app.sunWheel, up = new window.__app.THREE.Vector3(); W.cabinUp(0, up); const a = Math.acos(up.y); W.advance(0.7); W.cabinUp(0, up); return { a, b: Math.acos(up.y) }; });
  check(Math.abs(T2.a - T2.b) > 1e-3, `bão: cabin 0 không đung đưa theo thời gian (${T2.a} → ${T2.b})`);
  { const m = await page.evaluate(() => { let n = 0; window.__app.sunWheel.group.traverse((o) => { if (o.isMesh) n++; }); return n; });
    check(m === rideMeshes0, `bão thêm mesh vào vòng quay: ${rideMeshes0} → ${m}`); }

  // 5d. Draw call do vòng quay trong bão = lúc `now` (cùng góc nhìn, ban ngày)
  const DW = {};
  for (const [b, v] of OLD) { await pickView(page, b, v); await frames(page, 4); DW[v] = await delta(); }
  for (const [k, [p, t]] of Object.entries(NEAR)) { await camLocal(p, t); await frames(page, 3); DW[k] = await delta(); }
  for (const v of SWV.filter((x) => x !== 'swNight')) { await pickView(page, 'sw', v); await frames(page, 4); DW[v] = await delta(); }   // swNight tự chuyển sang đêm nên không đo ở đây
  console.log('draw call vòng quay trong bão:', JSON.stringify(DW));
  for (const [, v] of OLD) check(DW[v].d === D[`${v}|0`].d && DW[v].d <= 2, `bão ${v}: vòng quay ${DW[v].d} draw call, lúc now ${D[`${v}|0`].d} (phải bằng, ≤ 2)`);
  for (const k of Object.keys(NEAR)) check(DW[k].d === D[`${k}|0`].d && DW[k].d <= 6, `bão ${k}: vòng quay ${DW[k].d} draw call, lúc now ${D[`${k}|0`].d} (phải bằng, ≤ 6)`);
  for (const v of SWV.filter((x) => x !== 'swNight')) check(DW[v].d === DS[`${v}|0|0`].d && DW[v].d <= 6, `bão ${v}: vòng quay ${DW[v].d} draw call, lúc now ${DS[`${v}|0|0`].d} (phải bằng, ≤ 6)`);

  // 5e. Mặt ướt: ba vật liệu có nhánh `weather` (uWet) và có uniform ướt khi mưa
  const WET = await page.evaluate(() => { const W = window.__app.sunWheel; return { ks: ['concrete', 'steel', 'cabin'].map((n) => W.mats[n].customProgramCacheKey()), wet: window.__app.weather.state.wet }; });
  check(WET.ks.every((k) => /-w-swled-/.test(k)) && WET.wet > 0.5, `mặt ướt: khoá vật liệu ${WET.ks}, wet ${WET.wet}`);

  // 5f. Đang ngồi cabin khi bão tới: vòng quay dừng, cabin vẫn lắc, camera bám cabin nghiêng, hiện dòng thông báo; hết bão thì ẩn
  await setWx(page, 'now'); await frames(page, 3);
  await page.evaluate(() => { const W = window.__app.sunWheel; W.setSpeed(10); W.advance(15); });
  await pickView(page, 'sw', 'swFront'); await frames(page, 2);
  await rideClick(); await frames(page, 2);
  await page.evaluate(() => { window.__app.swRide.blend = 1; });
  await frames(page, 2);
  const note = () => page.evaluate(() => { const e = document.getElementById('swStormNote'); return { hidden: e.hidden, text: e.textContent }; });
  check((await note()).hidden, 'ngồi cabin lúc now: dòng thông báo bão đang hiện');
  await setWx(page, 'storm'); await frames(page, 4);
  { const n = await note(); check(!n.hidden && n.text.length > 30 && !/^swStorm/.test(n.text), `ngồi cabin khi bão: dòng thông báo hidden ${n.hidden}, chữ "${n.text}"`); }
  const rideStorm = await page.evaluate(() => {
    const { swRide: R, sunWheel: W, camera, THREE } = window.__app, out = { err: 0, tilt: 0 }, e = new THREE.Vector3(), plain = new THREE.Quaternion(), ang = [];
    W.advance(12);   // vòng quay đã dừng hẳn (stopSec = 10)
    out.speed = W.speedNow(); out.a0 = W.angle();
    for (let k = 0; k < 8; k++) {
      W.advance(0.4); R.update(0);   // lắc tiếp, dựng lại tư thế camera
      R.eye(e); out.err = Math.max(out.err, e.distanceTo(camera.position));
      plain.setFromEuler(new THREE.Euler(R.pitch, W.cfg.yaw + R.yaw, 0, 'YXZ')); out.tilt = Math.max(out.tilt, camera.quaternion.angleTo(plain));
    }
    out.a1 = W.angle(); out.maxTilt = W.cfg.storm.sway.maxTilt; out.mode = window.__app.cam.mode;
    return out;
  });
  console.log('GĐ6 ngồi cabin trong bão:', JSON.stringify(rideStorm));
  check(rideStorm.mode === 'swRide' && rideStorm.speed === 0 && rideStorm.a1 === rideStorm.a0, `ngồi cabin khi bão: mode ${rideStorm.mode}, tốc độ ${rideStorm.speed}, góc ${rideStorm.a0} → ${rideStorm.a1} (phải đứng yên)`);
  check(rideStorm.err < 1e-3, `ngồi cabin khi bão: camera lệch mắt cabin ${rideStorm.err} m`);
  check(rideStorm.tilt > 1e-3 && rideStorm.tilt <= rideStorm.maxTilt + 1e-3, `ngồi cabin khi bão: camera nghiêng ${rideStorm.tilt} rad theo cabin, cần trong (1e-3; ${rideStorm.maxTilt}]`);
  await setWx(page, 'now'); await frames(page, 4);
  check((await note()).hidden, 'hết bão: dòng thông báo vẫn hiện');
  await page.evaluate(() => { const W = window.__app.sunWheel; W.advance(15); });
  { const r = await page.evaluate(() => { const W = window.__app.sunWheel; return { s: W.speedNow(), g: W.speedTarget(), st: W.stopping() }; });
    check(r.s === 10 && r.g === 10 && r.st === -1, `hết bão: tốc độ ${r.s} (cần quay lại 10), đích ${r.g}, stopFrom ${r.st}`); }
  { const t = await cabinTilt(); check(t.amp === 0 && t.max <= DEG2, `hết bão: cabin vẫn nghiêng (amp ${t.amp}, ${t.max} rad)`); }
  await page.keyboard.press('Escape'); await frames(page, 2);
  check((await note()).hidden, 'xuống cabin: dòng thông báo bão vẫn hiện');
  await RS.flightDone();
  await setWx(page, 'now');
  await page.evaluate(() => window.__app.sunWheel.setSpeed(1));

  // ---- Giai đoạn 7: Tour Vòng quay Mặt Trời (mục 7, 9, 11) ----
  // Đường bay mở 6 điểm; điểm 4 ('ride') lên cabin và tua nhanh tới đỉnh, điểm 5 ('top') ngắm 4 cầu từ đỉnh, điểm 6 ('night') xuống cabin + đêm + show LED;
  // thoát Tour (Esc / hết hành trình / đổi góc nhìn) trả tốc độ quay, ngày/đêm, kiểu show như cũ. Camera trong cabin do ride.ts đặt (cam.mode vẫn 'tour').
  const { readFile } = await import('node:fs/promises');
  const viJson = JSON.parse(await readFile(new URL('../src/i18n/locales/vi.json', import.meta.url), 'utf8'));
  const swTourInfo = await page.evaluate(() => {
    const T = window.__app.tours.sw, c = window.__app.sunWheel.cfg.tour;
    return T ? { n: T.stops.length, loop: T.loop, durs: [...T.durs], flags: T.stops.map((s) => s.sw ?? null), bridge0: T.stops[0].bridge ?? null, minSec: T.stops.map((s) => s.minSec ?? 0), view: T.view, key: T.key, c } : null;
  });
  console.log('GĐ7 Tour:', JSON.stringify(swTourInfo));
  if (check(!!swTourInfo, 'chưa có Tour sw trong window.__app.tours')) {
    const I = swTourInfo;
    check(I.n === 6 && I.loop === false && I.view === 'swTour' && I.key === 'swStops', `Tour sw: ${I.n} điểm, loop ${I.loop}, view ${I.view}, key ${I.key} (cần 6 điểm, đường bay mở)`);
    check(JSON.stringify(I.flags) === JSON.stringify([null, null, null, 'ride', 'top', 'night']) && I.bridge0 === 'sw', `cờ điểm dừng: ${JSON.stringify(I.flags)}, bridge ${I.bridge0}`);
    check(I.minSec[3] === I.c.climbSec && I.minSec[4] === I.c.topSec, `minSec điểm 4/5: ${I.minSec[3]}/${I.minSec[4]}, config ${I.c.climbSec}/${I.c.topSec}`);
    // chỗ trống của điểm k = 0,45·durs[k−1] + 0,55·durs[k] phải ≥ minSec + 1,1 (kể cả khi tắt giọng, dùng thời lượng hiện tại)
    for (const k of [3, 4]) check(0.45 * I.durs[k - 1] + 0.55 * I.durs[k] >= I.minSec[k] + 1.1, `điểm ${k + 1}: chỗ trống ${(0.45 * I.durs[k - 1] + 0.55 * I.durs[k]).toFixed(1)} s < minSec ${I.minSec[k]} + 1,1`);
    check(await page.$('button[data-bridge="sw"]') && await page.$('[data-list="sw"] button[data-view="swTour"]'), 'thiếu nút Tour trong nhóm sw');
  }
  const swSeek = async (i) => {   // tua tới lúc điểm i hiện (55 % đoạn trước)
    await page.evaluate((i) => { const d = window.__app.tours.sw.durs; window.__app.tour.t = i === 0 ? 0.01 : d.slice(0, i - 1).reduce((a, x) => a + x, 0) + 0.6 * d[i - 1]; }, i);
    await frames(page, 3);
  };
  const swTourStart = async () => { await pickView(page, 'sw', 'swTour'); await frames(page, 2); };
  const swState = () => page.evaluate(() => {
    const { cam, swRide: R, sunWheel: W, dayNight, camera, THREE } = window.__app, f = camera.getWorldDirection(new THREE.Vector3()), s = W.cfg.yaw;
    return { mode: cam.mode, on: R.tour.on, climbing: R.tour.climbing, out: R.tour.out, touched: R.tour.touched, active: R.active(), goal: W.speedTarget(), speed: W.speedNow(), show: W.show(), night: dayNight.target,
      selShow: document.getElementById('swShow').value, step: document.getElementById('tourStep').textContent, title: document.getElementById('tourTitle').textContent,
      north: f.x * -Math.sin(s) + f.z * -Math.cos(s) };   // thành phần hướng nhìn theo phía Bắc cục bộ (−Z cục bộ)
  });
  const swReset = async () => {   // trạng thái người dùng trước mỗi kịch bản: ban ngày, show trắng, tốc độ ×10, không Tour
    await page.keyboard.press('Escape'); await frames(page, 2);
    await page.evaluate(() => { const W = window.__app.sunWheel; W.setSpeed(10); W.advance(15); W.setShow('white'); document.getElementById('swShow').value = 'white'; });
    await setNight(0);
  };

  // 7a. Bắt đầu Tour: chế độ tour, chú thích "1/6", đủ 6 điểm đúng tiêu đề (vi), không trùng
  await swReset();
  await swTourStart();
  { const s = await swState();
    check(s.mode === 'tour' && s.step.includes('1/6') && s.title === viJson.swStops[0][0], `bắt đầu Tour sw: mode ${s.mode}, "${s.step}", "${s.title}"`);
    check(!s.on && !s.touched && s.goal === 10, `trước điểm 4 Tour chưa đụng tới vòng quay: on ${s.on}, touched ${s.touched}, tốc độ đích ${s.goal}`); }
  const titles7 = [];
  for (const i of [1, 2]) { await swSeek(i); const s = await swState(); titles7.push(s.title); check(s.step.includes(`${i + 1}/6`) && s.title === viJson.swStops[i][0] && !s.on, `điểm ${i + 1}: "${s.step}" "${s.title}" on ${s.on}`); }

  // 7b. Điểm 4: lên cabin — camera ghi đè bởi cabin (mode vẫn 'tour'), tua nhanh climbSpeed, cabin đáy leo tới đỉnh
  await swSeek(3);
  { const s = await swState(); titles7.push(s.title);
    check(s.mode === 'tour' && s.on && s.climbing && s.active && s.touched, `điểm 4: ${JSON.stringify(s)}`);
    check(s.goal === swTourInfo.c.climbSpeed && s.title === viJson.swStops[3][0], `điểm 4: tốc độ đích ${s.goal} (cần ${swTourInfo.c.climbSpeed}), tiêu đề "${s.title}"`); }
  await page.evaluate(() => { window.__app.swRide.blend = 1; }); await frames(page, 3);
  { const e = await RS.err(); check(e < 1e-3, `Tour trong cabin: camera lệch mắt cabin ${e} m`); }
  const climb = await page.evaluate(() => {   // mô phỏng deterministic (không lẫn vòng lặp thật): lên tới đỉnh rồi giảm tốc về topSpeed
    const { sunWheel: W, swRide: R } = window.__app, c = W.cfg.tour, p = W.cabinWorld(R.cabin), out = { y0: p.y, cabin: R.cabin, peak: 0 };
    let t = 0;
    while (t < 90 && (R.tour.climbing || W.speedNow() > c.topSpeed + 1e-6)) { W.advance(0.1); R.update(0.1); t += 0.1; out.peak = Math.max(out.peak, W.speedNow()); }
    W.cabinWorld(R.cabin, p);
    return { ...out, t, y1: p.y, top: W.cfg.hubY + W.cfg.cabinR, speed: W.speedNow(), goal: W.speedTarget(), climbing: R.tour.climbing, climbSec: c.climbSec, topSpeed: c.topSpeed, climbSpeed: c.climbSpeed };
  });
  console.log('GĐ7 lên đỉnh:', JSON.stringify(climb));
  check(climb.y0 < climb.top - 40, `điểm 4: cabin ban đầu không ở đáy vòng quay (y ${climb.y0})`);
  check(climb.y1 >= climb.top - 0.1, `lên đỉnh: cabin ở y ${climb.y1}, đỉnh ${climb.top} (thấp hơn 0,1 m)`);
  check(climb.t > 8 && climb.t <= climb.climbSec, `lên đỉnh mất ${climb.t.toFixed(1)} s, cần trong (8; ${climb.climbSec}] s`);
  check(climb.peak >= climb.climbSpeed * 0.95 && climb.speed <= climb.topSpeed + 1e-3 && !climb.climbing && climb.goal === climb.topSpeed, `lên đỉnh: tốc độ tối đa ${climb.peak}, cuối ${climb.speed}, đích ${climb.goal}`);

  // 7c. Điểm 5: ngắm 4 cầu — đang ở cabin, quay chậm topSpeed, nhìn về Bắc; draw call ngày = đêm, ≤ 6
  await swSeek(4);
  { const s = await swState(); titles7.push(s.title);
    check(s.mode === 'tour' && s.on && !s.climbing && s.goal === swTourInfo.c.topSpeed && s.title === viJson.swStops[4][0], `điểm 5: ${JSON.stringify(s)}`);
    check(s.north > 0.95, `điểm 5: hướng nhìn lệch Bắc (thành phần ${s.north}, cần > 0,95)`); }
  await page.evaluate(() => { window.__app.swRide.blend = 1; }); await frames(page, 2);
  const DT7 = {};
  for (const night of [0, 1]) { await setNight(night); DT7[night] = await delta(); }
  console.log('GĐ7 draw call vòng quay khi Tour ở cabin:', JSON.stringify(DT7));
  check(DT7[0].d === DT7[1].d && DT7[0].d <= 6, `Tour ở cabin: vòng quay ${DT7[0].d} (ngày) / ${DT7[1].d} (đêm) draw call, cần bằng nhau và ≤ 6`);
  { const m = await page.evaluate(() => { let n = 0; window.__app.sunWheel.group.traverse((o) => { if (o.isMesh) n++; }); return n; }); check(m === rideMeshes0, `Tour thêm mesh vào vòng quay: ${rideMeshes0} → ${m}`); }
  await setNight(0);

  // 7d. Điểm 6: rời cabin (camera trộn về đường bay), bật đêm + kiểu show của Tour
  await swSeek(5);
  { const s = await swState(); titles7.push(s.title);
    check(s.mode === 'tour' && !s.on && !s.climbing && s.title === viJson.swStops[5][0] && s.step.includes('6/6'), `điểm 6: ${JSON.stringify(s)}`);
    check(s.night === 1 && s.show === swTourInfo.c.show && s.selShow === swTourInfo.c.show, `điểm 6: đêm ${s.night}, show ${s.show}, ô chọn ${s.selShow} (cần 1 / ${swTourInfo.c.show})`);
    check(s.touched, 'điểm 6: Tour chưa đánh dấu đã đổi tốc độ / show (touched)'); }
  { const o = await page.evaluate(() => { const R = window.__app.swRide, o0 = R.tour.out; for (let k = 0; k < 40 && R.tour.out >= 0; k++) R.update(0.1); return { o0, o1: R.tour.out }; });   // trộn 1,6 s: chạy bằng dt cố định (SwiftShader khung rất chậm)
    check(o.o0 >= 0 && o.o0 < 1 && o.o1 === -1, `rời cabin: trộn camera từ ${o.o0} → ${o.o1} (cần bắt đầu trong [0; 1) và kết thúc −1)`); }
  await frames(page, 3);   // camera về đường bay do updateTour đặt trong khung thật (vòng R.update ở trên không chạy updateTour)
  { const e = await RS.err(); check(e > 5, `sau khi rời cabin camera vẫn dính cabin (cách ${e} m)`); }
  check(new Set(titles7).size === titles7.length, 'có tiêu đề điểm dừng Tour sw bị trùng');

  // 7e. Hết hành trình (đường bay mở): trả orbit và trả lại tốc độ ×10, ban ngày, show trắng
  await page.evaluate(() => { window.__app.tour.t = window.__app.tours.sw.total; }); await frames(page, 3);
  { const s = await swState();
    check(s.mode === 'orbit' && !s.on && !s.touched && !s.active, `hết Tour: ${JSON.stringify(s)}`);
    check(s.goal === 10 && s.night === 0 && s.show === 'white' && s.selShow === 'white', `hết Tour chưa trả trạng thái: tốc độ ${s.goal} (10), đêm ${s.night} (0), show ${s.show}/${s.selShow} (white)`); }

  // 7f. Esc giữa lúc ngồi cabin của Tour: thoát Tour, trả tốc độ; tua thẳng tới điểm 5 (bỏ qua điểm 4) vẫn vào cabin
  await swReset(); await swTourStart();
  await swSeek(4);
  { const s = await swState(); check(s.on && !s.climbing && s.touched && s.goal === swTourInfo.c.topSpeed, `tua thẳng tới điểm 5: ${JSON.stringify(s)}`); }
  await page.keyboard.press('Escape'); await frames(page, 3);
  { const s = await swState(); check(s.mode === 'orbit' && !s.on && !s.touched && s.goal === 10, `Esc giữa cabin Tour: ${JSON.stringify(s)}`); }
  // 7g. Đổi góc nhìn giữa Tour (setView không gọi exitTour): vòng quay vẫn được trả tốc độ cũ, kể cả điểm 6 đã đổi sang đêm / show hồng
  await swReset(); await swTourStart();
  await swSeek(3); await swSeek(5);
  { const s = await swState(); check(s.touched && s.night === 1 && s.show === swTourInfo.c.show, `chuẩn bị 7g: ${JSON.stringify(s)}`); }
  await pickView(page, 'sw', 'swFront'); await frames(page, 4);
  { const s = await swState(); check(!s.on && !s.touched && !s.active && s.goal === 10 && s.night === 0 && s.show === 'white', `đổi góc nhìn giữa Tour: ${JSON.stringify(s)}`); }
  await RS.flightDone();
  await page.evaluate(() => window.__app.sunWheel.setSpeed(1));
  await setNight(0);

  // 7. i18n: 14 khóa mới đủ ở cả 9 locale, không rỗng
  const KEYS = ['swStormNote','bridgeSw', 'vSwFront', 'vSwBase', 'vSwFromTTL', 'vSwNight', 'vSwTop', 'swWheelSpeed', 'swWheelStop', 'swWheelReal', 'swLengthVal', 'swWidthVal', 'swSpan', 'swSpanVal', 'swNote', 'vSwRide', 'swRideHint'];
  for (const code of ['vi', 'en', 'ko', 'ja', 'zh', 'th', 'ar', 'hi', 'ru']) {
    const j = JSON.parse(await readFile(new URL(`../src/i18n/locales/${code}.json`, import.meta.url), 'utf8'));
    const miss = KEYS.filter((k) => typeof j[k] !== 'string' || !j[k].trim());
    check(miss.length === 0, `locale ${code} thiếu khóa Vòng quay: ${miss}`);
    check(/2025/.test(j.swNote || ''), `locale ${code}: swNote thiếu ghi chú hiện trạng (9/2025)`);
    const st = j.swStops;   // GĐ7: Tour 6 điểm, mỗi điểm [tên, lời]; điểm 3 (lịch sử) ghi hiện trạng
    check(Array.isArray(st) && st.length === 6 && st.every((p) => Array.isArray(p) && p.length === 2 && p.every((x) => typeof x === 'string' && x.trim())), `locale ${code}: swStops phải có 6 cặp [tên, lời]`);
    check(Array.isArray(st) && /2025/.test(st[2]?.[1] || '') && new Set(st.map((p) => p[0])).size === 6, `locale ${code}: swStops điểm 3 thiếu hiện trạng 9/2025 hoặc tên điểm trùng`);
  }
  // 8. GĐ8 (tài liệu và đo đạc): mọi góc sw* đều có trong VIEWS của drawcalls.mjs và trong bảng KET-QUA.md; README có mục vòng quay
  const SW_VIEWS = ['swOverview', 'swFront', 'swBase', 'swFromTTL', 'swNight', 'swTop', 'swRide', 'swTour'];
  const drawSrc = await readFile(new URL('./drawcalls.mjs', import.meta.url), 'utf8');
  const ketSrc = await readFile(new URL('./KET-QUA.md', import.meta.url), 'utf8');
  const readmeSrc = await readFile(new URL('../README.md', import.meta.url), 'utf8');
  check(SW_VIEWS.every((v) => drawSrc.includes(`'${v}'`)), `drawcalls.mjs thiếu góc sw*: ${SW_VIEWS.filter((v) => !drawSrc.includes(`'${v}'`))}`);
  check(SW_VIEWS.every((v) => new RegExp(`^\\| ${v} \\|`, 'm').test(ketSrc)), `KET-QUA.md thiếu dòng draw call của: ${SW_VIEWS.filter((v) => !new RegExp(`^\\| ${v} \\|`, 'm').test(ketSrc))}`);
  check(readmeSrc.includes('sun-wheel/'), 'README mục Cấu trúc thiếu src/bridges/sun-wheel/');
  // 7. Console sạch
  check(errors.length === 0, `lỗi console: ${errors.join(' | ')}`);
} finally { await browser.close(); srv.close(); }

if (problems.length) { console.error('sunwheel-check: LỖI\n - ' + problems.join('\n - ')); process.exit(1); }
console.log('sunwheel-check: đạt');
