// Kiểm tra chế độ tự khám phá bằng dù lượn (kế hoạch feature/explore-du-luon).
//   Mục 1–2: mô hình bay thuần, dù, camera bám (src/explore/*) qua móc window.__app.exFlight.
//   Mục 3: điều phối chế độ bay, phím, ?explore=glider qua window.__app.explore.
//
//   npm run build && npm run test:explore
import { fileURLToPath } from 'node:url';
import { serveDir, launch, openApp, frames } from './lib.mjs';

const problems = [];
const check = (name, ok) => { if (!ok) problems.push(name); console.log(`${ok ? 'đạt ' : 'LỖI '} ${name}`); return ok; };

const srv = await serveDir(fileURLToPath(new URL('../dist/', import.meta.url)));
const browser = await launch();
try {
  // Mục 1 — mô hình bay thuần
  const P = await openApp(browser, srv.url);
  await frames(P.page, 2);
  const has = await P.page.evaluate(() => !!(window.__app && window.__app.exFlight));
  check('có __app.exFlight', has);
  if (has) {
    const r = await P.page.evaluate(() => {
      const { exCreate, exStep, exInputFromKeys, CONFIG_explore: C } = window.__app.exFlight;
      const dt = 1 / 60, out = {};
      const run = (s, inp, sec, each) => { for (let i = 0; i < Math.round(sec * 60); i++) { exStep(s, inp, dt); if (each) each(s); } };
      // 1a tốc độ ngang không đổi
      let ok = true, last = null;
      for (const [turn, climb] of [[1, 1], [-1, -1], [1, -1], [0, 0]]) {
        const s = exCreate(); last = null;
        run(s, { turn, climb }, 30, (s) => { if (last) { const v = Math.hypot(s.pos.x - last.x, s.pos.z - last.z) / dt; if (v < 24.99 || v > 25.01) ok = false; } last = { x: s.pos.x, z: s.pos.z }; });
      }
      out.a = ok;
      // 1b rẽ trái / phải
      let s = exCreate(); let y0 = s.yaw; run(s, { turn: 1, climb: 0 }, 3); out.bL = s.yaw - y0;
      s = exCreate(); y0 = s.yaw; run(s, { turn: -1, climb: 0 }, 3); out.bR = s.yaw - y0;
      // 1c lên/xuống
      s = exCreate(); run(s, { turn: 0, climb: 1 }, 200); out.cUp = s.pos.y;
      s = exCreate(); run(s, { turn: 0, climb: -1 }, 200); out.cDown = s.pos.y;
      // 1d thả phím
      s = exCreate(); run(s, { turn: 1, climb: 0 }, 2); run(s, { turn: 0, climb: 0 }, 2.5); const yb = s.yaw; run(s, { turn: 0, climb: 0 }, 0.5);
      out.dBank = s.bank; out.dYaw = s.yaw - yb;
      // 1e ranh giới khi bay thẳng
      s = exCreate(); ok = true;
      run(s, { turn: 0, climb: 0 }, 600, (s) => { if (s.pos.x < C.bounds.x0 || s.pos.x > C.bounds.x1 || s.pos.z < C.bounds.z0 || s.pos.z > C.bounds.z1) ok = false; });
      out.e = ok;
      // 1f giữ A ở góc, hướng ra ngoài
      s = exCreate(); s.pos.set(C.bounds.x1 - 50, 300, C.bounds.z0 + 50); s.yaw = Math.PI / 4; s.bank = 0; ok = true;
      let flips = 0, prev = 0;
      const t = [0];
      for (let i = 0; i < 600 * 60; i++) {
        exStep(s, { turn: 1, climb: 0 }, dt);
        if (s.pos.x < C.bounds.x0 || s.pos.x > C.bounds.x1 || s.pos.z < C.bounds.z0 || s.pos.z > C.bounds.z1) ok = false;
        if (i >= 540 * 60) { const sg = Math.sign(s.bank); if (sg !== 0 && prev !== 0 && sg !== prev) flips++; if (sg !== 0) prev = sg; }
      }
      out.f = ok; out.fFlips = flips;
      // 1g phím
      const k = (...a) => exInputFromKeys(new Set(a));
      out.g = [k('a').turn === 1, k('arrowright').turn === -1, k('a', 'd').turn === 0, k('w').climb === 1, k('s', 'arrowup').climb === 0, k().turn === 0 && k().climb === 0];
      // 1h
      s = exCreate();
      out.h = s.pos.x === C.takeoff[0] && s.pos.y === C.takeoff[1] && s.pos.z === C.takeoff[2] && s.yaw === C.takeoffYaw && s.bank === 0;
      return out;
    });
    check('1a tốc độ ngang luôn 25 m/s', r.a);
    check(`1b A rẽ trái (+${r.bL.toFixed(2)}), D rẽ phải (${r.bR.toFixed(2)})`, r.bL > 0.5 && r.bR < -0.5);
    check(`1c W lên tới 800, S xuống tới 30 (${r.cUp}, ${r.cDown})`, r.cUp === 800 && r.cDown === 30);
    check(`1d thả phím tự cân bằng (bank ${r.dBank.toExponential(1)}, Δyaw ${r.dYaw.toExponential(1)})`, Math.abs(r.dBank) < 0.01 && Math.abs(r.dYaw) < 0.005);
    check('1e bay thẳng 600 s không ra khỏi khung', r.e);
    check(`1f giữ A ở góc không vượt khung, bank đổi dấu ${r.fFlips} lần (≤ 2)`, r.f && r.fFlips <= 2);
    check('1g exInputFromKeys', r.g.every(Boolean));
    check('1h exCreate tại điểm cất cánh', r.h);
  }
  // Mục 2 — mô hình dù và camera bám
  {
    const hasB = await P.page.evaluate(() => !!(window.__app.exFlight && window.__app.exFlight.exBuildGlider));
    check('có exBuildGlider/exPlaceGlider/exChase', hasB);
    if (hasB) {
      const setNight = async (v) => {
        await P.page.evaluate((v) => { window.__app.dayNight.target = v; window.__app.dayNight.night = v; }, v);
        await P.page.waitForFunction((v) => Math.abs(window.__app.dayNight.night - v) < 1e-6, v, { timeout: 60000 });
        await frames(P.page, 3);   // để applyNight ghi shared.uNight
      };
      const r2 = await P.page.evaluate(() => {
        const { exCreate, exBuildGlider, exPlaceGlider, exChase } = window.__app.exFlight;
        const { THREE, scene, camera, renderer, shared } = window.__app;
        const out = {};
        const g = exBuildGlider();
        let meshes = 0; g.traverse((o) => { if (o.isMesh) { meshes++; out.cast = o.castShadow; } });
        const bb = new THREE.Box3().setFromObject(g); out.meshes = meshes; out.width = bb.max.x - bb.min.x; out.wz = bb.max.z - bb.min.z; out.wy = bb.max.y - bb.min.y;
        out.notInScene = !scene.getObjectByName('ex-glider');
        // 2c draw call
        const s = exCreate(), tgt = new THREE.Vector3();
        exChase(camera, tgt, s, 1 / 60, true); exPlaceGlider(g, s);
        const calls = () => { renderer.render(scene, camera); renderer.info.reset(); renderer.render(scene, camera); return renderer.info.render.calls; };   // autoReset tắt: dựng hai lần, lần đầu cập nhật LOD theo camera mới, đo lần hai
        const c0 = calls(); scene.add(g); const c1 = calls(); scene.remove(g);
        out.dCalls = c1 - c0;
        // 2d bank
        const sb = exCreate(); sb.bank = 0.45; exPlaceGlider(g, sb); out.roll = -g.rotation.x; out.gyaw = g.rotation.y; out.syaw = sb.yaw;
        // 2e snap
        const s2 = exCreate(); s2.yaw = 0.7; s2.pos.set(100, 400, -300);
        exChase(camera, tgt, s2, 1 / 60, true);
        const fx = Math.cos(s2.yaw), fz = -Math.sin(s2.yaw);
        out.dist = camera.position.distanceTo(s2.pos); out.dh = camera.position.y - s2.pos.y;
        out.behind = (s2.pos.x - camera.position.x) * fx + (s2.pos.z - camera.position.z) * fz;
        out.tgt = Math.hypot(tgt.x - (s2.pos.x + fx * 30), tgt.z - (s2.pos.z + fz * 30));
        // 2f trễ
        s2.pos.x += fx * 20; s2.pos.z += fz * 20;
        const wantNew = new THREE.Vector3(s2.pos.x - fx * 18, s2.pos.y + 6, s2.pos.z - fz * 18);
        exChase(camera, tgt, s2, 1 / 60); out.lag1 = camera.position.distanceTo(wantNew);
        for (let i = 1; i < 180; i++) exChase(camera, tgt, s2, 1 / 60);
        out.lag3 = camera.position.distanceTo(wantNew);
        return out;
      });
      check(`2a đúng 1 Mesh, castShadow false, rộng ${r2.wz.toFixed(2)} m`, r2.meshes === 1 && r2.cast === false && r2.wz >= 10 && r2.wz <= 12);
      check('2b chưa bay: scene không có ex-glider', r2.notInScene);
      check(`2c ngày: thêm dù +${r2.dCalls} draw call`, r2.dCalls >= 1 && r2.dCalls <= 2);
      check(`2d bank 0.45 → góc cuộn ${r2.roll.toFixed(4)}, yaw giữ ${r2.gyaw === r2.syaw}`, Math.abs(r2.roll - 0.45) < 1e-3 && Math.abs(r2.gyaw - r2.syaw) < 1e-6);
      check(`2e snap: cách ${r2.dist.toFixed(3)}, cao ${r2.dh.toFixed(3)}, sau ${r2.behind.toFixed(1)}, target lệch ${r2.tgt.toExponential(1)}`, Math.abs(r2.dist - Math.hypot(18, 6)) < 0.01 && Math.abs(r2.dh - 6) < 0.01 && r2.behind > 0 && r2.tgt < 1e-6);
      check(`2f trễ: sau 1 bước còn ${r2.lag1.toFixed(2)} m, sau 3 s còn ${r2.lag3.toFixed(4)} m`, r2.lag1 > 0 && r2.lag3 < 0.05);
      await setNight(1);
      const r2n = await P.page.evaluate(() => {
        const { exCreate, exBuildGlider, exPlaceGlider, exChase } = window.__app.exFlight;
        const { THREE, scene, camera, renderer, shared } = window.__app;
        const g = exBuildGlider(), s = exCreate(), tgt = new THREE.Vector3();
        exChase(camera, tgt, s, 1 / 60, true); exPlaceGlider(g, s);
        const calls = () => { renderer.render(scene, camera); renderer.info.reset(); renderer.render(scene, camera); return renderer.info.render.calls; };   // autoReset tắt: dựng hai lần, lần đầu cập nhật LOD theo camera mới, đo lần hai
        const c0 = calls(); scene.add(g); const c1 = calls(); scene.remove(g);
        return { d: c1 - c0, em: g.children[0].material.emissiveIntensity, un: shared.uNight.value };
      });
      check(`2c đêm: thêm dù +${r2n.d} draw call (= ngày ${r2.dCalls})`, r2n.d === r2.dCalls);
      check(`2g đêm emissiveIntensity ${r2n.em} = uNight ${r2n.un}`, r2n.em === 1 && r2n.un === 1);
      await setNight(0);
      const em0 = await P.page.evaluate(() => { const { exCreate, exBuildGlider, exPlaceGlider } = window.__app.exFlight; const g = exBuildGlider(); exPlaceGlider(g, exCreate()); return g.children[0].material.emissiveIntensity; });
      check(`2g ngày emissiveIntensity ${em0} = 0`, em0 === 0);
    }
  }
  check('console sạch', P.errors.length === 0);
  if (P.errors.length) console.log(P.errors.join('\n'));
  await P.page.close();
  // Mục 3 — điều phối, phím, ?explore=glider
  {
    const G = await openApp(browser, srv.url + '?explore=glider');
    await frames(G.page, 3);
    const st = () => G.page.evaluate(() => { const e = window.__app.explore; return e.state ? { yaw: e.state.yaw, bank: e.state.bank, y: e.state.pos.y } : null; });
    const a3 = await G.page.evaluate(() => { const a = window.__app; return { mode: a.cam.mode, en: a.controls.enabled, cls: document.body.classList.contains('explore'), obj: !!a.scene.getObjectByName('ex-glider'), act: a.explore.active() }; });
    check('3a mode glider, controls tắt, body.explore, scene có ex-glider', a3.mode === 'glider' && a3.en === false && a3.cls && a3.obj && a3.act);
    // 3b giữ A → yaw tăng; thả → hết tăng sau quá độ
    await G.page.focus('canvas');
    const y0 = (await st()).yaw;
    await G.page.keyboard.down('a'); await G.page.waitForFunction((y) => Math.abs(window.__app.explore.state.yaw - y) > 0.01, y0, { timeout: 240000 });   // SwiftShader chậm: chờ tới khi yaw đổi thay vì chờ theo giờ
    const y1 = (await st()).yaw;
    await G.page.keyboard.up('a');
    await G.page.waitForFunction(() => Math.abs(window.__app.explore.state.bank) < 0.01, null, { timeout: 240000 });
    const y2 = (await st()).yaw; await G.page.waitForTimeout(1000); const y3 = (await st()).yaw;
    check(`3b giữ A: yaw ${y0.toFixed(3)} → ${y1.toFixed(3)}; thả: ổn định (${y2.toFixed(3)} → ${y3.toFixed(3)})`, y1 > y0 + 0.001 && Math.abs(y3 - y2) < 0.005);
    // 3c mất focus (blur) khi giữ A
    await G.page.keyboard.down('a'); await G.page.waitForTimeout(800);
    await G.page.evaluate(() => window.dispatchEvent(new Event('blur')));
    const c = await G.page.evaluate(() => ({ n: window.__app.keys ? window.__app.keys.size : -1 }));
    await G.page.waitForFunction(() => Math.abs(window.__app.explore.state.bank) < 0.01, null, { timeout: 240000 });
    check(`3c blur → keys rỗng (${c.n}), bank về ~0`, c.n === 0);
    await G.page.keyboard.up('a');
    // 3d phím mũi tên trên #qualitySel không lái dù
    await G.page.evaluate(() => { window.__app.ui.reveal(document.getElementById('qualitySel')); });
    await G.page.waitForFunction(() => Math.abs(window.__app.explore.state.bank) < 0.01, null, { timeout: 240000 });
    await G.page.focus('#qualitySel');
    const d0 = await st(), v0 = await G.page.$eval('#qualitySel', (e) => e.value);
    for (let i = 0; i < 3; i++) { await G.page.keyboard.press('ArrowDown'); await G.page.waitForTimeout(300); }
    const d1 = await st(), v1 = await G.page.$eval('#qualitySel', (e) => e.value);
    check(`3d select nhận phím (${v0} → ${v1}), dù không đổi độ cao (${d0.y} → ${d1.y}), bank ${d1.bank.toExponential(1)}`, v0 !== v1 && d0.y === d1.y && Math.abs(d1.bank) < 0.01);
    // 3e controls.target bám điểm nhìn
    await G.page.evaluate(() => window.__app.explore.step(1 / 60, { turn: 1, climb: 0 }));
    await frames(G.page, 2);
    const e3 = await G.page.evaluate(() => { const a = window.__app, s = a.explore.state, t = a.controls.target; const fx = Math.cos(s.yaw), fz = -Math.sin(s.yaw); return Math.hypot(t.x - (s.pos.x + fx * 30), t.y - s.pos.y, t.z - (s.pos.z + fz * 30)); });
    check(`3e controls.target bám pos + forward·30 (lệch ${e3.toFixed(3)} m)`, e3 < 1);
    // 3f Esc → tải lại, bỏ tham số explore
    await G.page.keyboard.press('Escape');
    await G.page.waitForURL((u) => !u.href.includes('explore='), { timeout: 240000, waitUntil: 'commit' });   // chỉ cần điều hướng bắt đầu; tải lại bằng SwiftShader rất chậm
    check('3f Esc thoát: URL không còn explore=', true);
    check('console sạch (mục 3)', G.errors.length === 0);
    if (G.errors.length) console.log(G.errors.join('\n'));
    await G.page.close();
    // 3g không tham số: không bay
    const N = await openApp(browser, srv.url);
    await frames(N.page, 2);
    const g3 = await N.page.evaluate(() => ({ mode: window.__app.cam.mode, obj: !!window.__app.scene.getObjectByName('ex-glider'), cls: document.body.classList.contains('explore'), act: window.__app.explore.active() }));
    check('3g không ?explore: orbit, không ex-glider, không body.explore', g3.mode === 'orbit' && !g3.obj && !g3.cls && !g3.act);
    await N.page.close();
  }
} catch (e) {
  problems.push('ngoại lệ: ' + e); console.log(e);
} finally {
  await browser.close(); srv.close();
}
console.log(problems.length ? `explore-check: LỖI (${problems.length}): ${problems.join('; ')}` : 'explore-check: đạt');
process.exit(problems.length ? 1 : 0);
