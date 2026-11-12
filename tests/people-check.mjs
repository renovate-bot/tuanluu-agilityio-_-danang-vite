// Kiểm tra người đi bộ (D-028, spec 2026-11-11-cay-va-nguoi-thuc-te-design.md) và đám đông người thật (D-032, spec 2026-11-12-dam-dong-nguoi-that-design.md §6).
// Một lần gọi mở năm trang, lần lượt:
//   A. Người thật (mặc định) — chạy bộ kiểm 1–9 dưới đây với real = true, chụp ảnh (10).
//   B. ?crowd=off — chạy lại bộ kiểm 1–9 với hình khối như cũ (real = false); trang không gửi yêu cầu nào tới people/crowd.
//   C. Chặn people/crowd.* (route abort), D. crowd.bin trả chậm hơn loadTimeoutMs, E. crowd.jpg không giải mã được:
//      trang vẫn dựng xong, 3 hệ là hình khối (peopleWalk) đủ người và đang hiện, đúng một console.warn "[people]", không lỗi console.
// Bộ kiểm 1–9:
//  1. systems: đúng 3 hệ ttl-people 80, sh-people 76, dragon-people 70; mỗi hệ đúng 1 lưới, cùng một vật liệu.
//     Người thật: real, BatchedMesh, vật liệu peopleCrowd, setColorAt đủ mọi id, ≥ 6 nhân vật mỗi hệ, tam giác ≤ số người × 1 640;
//     mỗi tệp crowd.* chỉ tải một lần (preload dùng lại được). Hình khối: InstancedMesh peopleWalk, instanceColor, aVar / aPants là thuộc tính instance.
//     drawCalls (người thật): bật / tắt lưới của từng hệ làm renderer.info.render.calls đổi đúng 1.
//  2. noOldShape: không còn lưới người ≤ 200 đỉnh; hình khối ≤ 900 đỉnh.
//  3. moving: sau 60 khung ≥ 60 % người đã đổi vị trí; số người đứng yên khớp số người 'stand' (±1); thẳng đứng, quay mặt theo chiều đi.
//     noSlip (người thật): nhịp phát (đọc lại từ texture thông số shader dùng) nằm trong [rateMin, rateMax] (nhân vật trẻ em: trần rateMaxChild); người đi / chạy:
//     tốc độ ÷ (nhịp × tốc độ tự nhiên × tỉ lệ) lệch 1 không quá 10 % (chân không trượt rõ); người đứng / chụp ảnh nhịp 1.
//  4. insideSidewalk: mọi người trong dải lề của cầu mình, gốc hình đúng mặt lề; clearLamps (Cầu Rồng |z| ∈ [17,3; 18,58]); standOverRiver (|x| ≤ 255).
//     feet (người thật): skin lưới trên CPU từ crowd.bin theo đoạn mỗi người dùng — y thấp nhất của lưới × tỉ lệ: đi / đứng mọi khung,
//     chạy chỉ khung chạm đất (có pha bay); lơ lửng ≤ 2 cm, chìm ≤ 3 cm (chìm 2–3 cm chỉ in ra).
//  5. stormClear: bão ⇒ giữa chừng 0 < hiện < tổng, người đi cùng ẩn / hiện cùng người dẫn; hết thời gian dọn 0 ở cả 3 hệ;
//     hết bão ⇒ hiện đủ, ma trận từng người đúng vị trí hiện tại trong danh sách (không giữ chỗ cũ lúc bị ẩn), chân đúng mặt lề.
//  6. toggleBack: bấm #btnTtlPeople hai lần ⇒ nhóm ẩn rồi hiện lại đủ 80.
//  7. dragonLod: camera xa tim Cầu Rồng 2 000 m (> hideDistance) ⇒ nhóm ẩn, 0 lệnh vẽ; về 300 m ⇒ hiện.
//     dragonCull: gần Trần Thị Lý / Cầu sông Hàn, quay lưng lại Cầu Rồng ⇒ 0 lệnh vẽ; nhìn vào cầu ⇒ vẽ.
//  8. randKept: speed 7 tàu chạy chung trùng main.
//  9. Không lỗi console, không cảnh báo shader / program.
// 10. Ảnh (bỏ bằng --no-shots), chỉ trang A: tests/screens/people-*.png — Cầu Rồng ngày / chạy / đầu rồng / đêm, Trần Thị Lý ngày / đêm,
//     Cầu sông Hàn ngày / đêm, Bạch Đằng; mỗi ảnh phải không đen kịt (NaN trong khung, bloom ban đêm lan ra cả màn hình).
//
//   npm run build && npm run test:people [-- --no-shots]
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { serveDir, launch, openApp, frames } from './lib.mjs';
import { setWx } from './weather-lib.mjs';

const NO_SHOTS = process.argv.includes('--no-shots');
const SCREENS = fileURLToPath(new URL('./screens/', import.meta.url));
const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
mkdirSync(SCREENS, { recursive: true });
const problems = [];
let pass = '';
const tally = {};
const check = (ok, msg) => { console.log(`${ok ? 'ĐẠT ' : 'LỖI '} [${pass}] ${msg}`); tally[pass] ??= [0, 0]; tally[pass][ok ? 0 : 1]++; if (!ok) problems.push(`[${pass}] ${msg}`); return ok; };

// Mốc đo trên main 43cec90 (chép từ tests/traffic-check.mjs): speed của 7 tàu chạy chung
const MAIN_BOAT_SPEEDS = [4.834048458375037, 3.4622229826636612, 3.367667659651488, 4.561683705076575, 4.302534147165716, 3.222870459780097, 4.6476020980626345];
const COUNTS = { 'ttl-people': 80, 'sh-people': 76, 'dragon-people': 70 };
const NAMES = Object.keys(COUNTS);
const CROWD = { loadTimeoutMs: 8000, rateMin: 0.6, rateMax: 1.6, rateMaxChild: 2.1, maxTris: 1640 };   // chép từ CONFIG.people.crowd (src/config.ts) và trần tam giác bản nón (plan Task 1)
const CROWD_RE = /people\/crowd\./;
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
// Chỗ camera thấy cả 3 cầu trong tầm cập nhật người: cách tâm Trần Thị Lý ≈ 1 310 m (< 1 500), Cầu sông Hàn ≈ 1 100 m (< 1 200), Cầu Rồng 200 m
const ALL_CAM = [[0, 200, 0], [0, 0, 100]];
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

/* Mở trang, ghi lại cảnh báo console (để đếm "[people]" và tìm cảnh báo shader) và yêu cầu tới people/crowd.* */
async function open(browser, url, route) {
  const warns = [], crowdReqs = [];
  const { page, errors } = await openApp(browser, url, {
    width: 960, height: 540,
    before: async (pg) => {
      pg.on('console', (m) => { if (m.type() === 'warning') warns.push(m.text()); });
      pg.on('request', (r) => { if (CROWD_RE.test(r.url())) crowdReqs.push(r.url()); });
      if (route) await pg.route(/people\/crowd\.(bin|jpg)/, route);
    }
  });
  return { page, errors, warns, crowdReqs };
}
const shaderWarns = (warns) => warns.filter((w) => /shader|program|glsl|ERROR: \d/i.test(w) && !/KHR_parallel_shader_compile/.test(w));

/* ===================== bộ kiểm 1–10 trên một trang ===================== */
async function suite({ page, errors, warns, crowdReqs }, real, shots) {
  const setNight = async (v) => {
    await page.evaluate((v) => { window.__app.dayNight.target = v; window.__app.dayNight.night = v; }, v);
    await page.waitForFunction((v) => Math.abs(window.__app.dayNight.night - v) < 1e-6, v, { timeout: 60000, polling: 200 });
    await frames(page, 3);
  };
  const hideUi = (on) => page.evaluate((on) => document.querySelectorAll('body *').forEach((e) => { if (!e.matches('canvas') && !e.querySelector('canvas')) e.style.visibility = on ? 'hidden' : ''; }), on);
  const setCam = (pos, tgt) => page.evaluate(([p, t]) => { const { camera, controls } = window.__app; camera.position.set(p[0], p[1], p[2]); controls.target.set(t[0], t[1], t[2]); controls.update(); }, [pos, tgt]);
  const systems = () => page.evaluate(() => window.__app.people?.systems() ?? []);
  const positions = (name) => page.evaluate((n) => window.__app.people?.positions(n) ?? [], name);
  /* Đặt camera theo người i của hệ (tọa độ thế giới): off = lệch camera (m), lookY = nhìn cao hơn chân */
  const aim = (name, i, off, lookY = 1) => page.evaluate(([name, i, off, lookY]) => {
    const a = window.__app, T = a.THREE, m = a.scene.getObjectByName(name).children.find((o) => o.isInstancedMesh || o.isBatchedMesh), M = new T.Matrix4(), P = new T.Vector3();
    m.updateWorldMatrix(true, false); m.getMatrixAt(i, M); M.premultiply(m.matrixWorld); P.setFromMatrixPosition(M);
    a.camera.position.set(P.x + off[0], P.y + off[1], P.z + off[2]); a.controls.target.set(P.x, P.y + lookY, P.z); a.controls.update();
  }, [name, i, off, lookY]);
  const find = async (name, fn) => (await positions(name)).find(fn)?.i ?? 0;

  await setNight(0);
  await setCam(...ALL_CAM); await frames(page, 3);

  /* ---------- 1. systems ---------- */
  const sy = await systems();
  check(sy.map((s) => s.name).join(',') === NAMES.join(','), `systems: đủ 3 hệ người (${sy.map((s) => s.name).join(',') || 'không có __app.people'})`);
  for (const n of NAMES) {
    const s = sy.find((x) => x.name === n);
    check(!!s && s.count === COUNTS[n] && s.meshes === 1 && s.real === real, `systems: ${n} ${s?.count} người (mốc ${COUNTS[n]}), ${s?.meshes} lưới, real ${s?.real} (mong ${real})`);
    if (real) {
      check(!!s && s.colors === COUNTS[n] && s.chars >= 6, `systems: ${n} setColorAt đủ ${s?.colors} id, ${s?.chars} nhân vật khác nhau (≥ 6), ${s?.hats} người đội nón, ${s?.shirtKinds} mức sáng`);
      check(!!s && s.tris > 0 && s.tris <= s.count * CROWD.maxTris, `systems: ${n} ${s?.tris} tam giác (≤ ${COUNTS[n]} × ${CROWD.maxTris} = ${COUNTS[n] * CROWD.maxTris})`);
    } else check(!!s && s.colors === COUNTS[n] && s.shirtKinds >= 4 && s.instAttrs, `systems: ${n} có instanceColor đủ ${s?.colors} người, ${s?.shirtKinds} màu áo, aVar/aPants là thuộc tính instance (${s?.instAttrs})`);
  }
  const matName = real ? 'peopleCrowd' : 'peopleWalk';
  check(sy.length === 3 && new Set(sy.map((s) => s.material)).size === 1 && sy.every((s) => s.materialName === matName), `systems: 3 hệ cùng một vật liệu ${matName} (${sy.map((s) => s.materialName).join(',')}; ${new Set(sy.map((s) => s.material)).size} uuid)`);
  if (real) {
    const per = ['crowd.bin', 'crowd.jpg'].map((f) => crowdReqs.filter((u) => u.endsWith(f)).length);
    check(per[0] === 1 && per[1] === 1, `systems: crowd.bin tải ${per[0]} lần, crowd.jpg ${per[1]} lần (mong 1 — preload được fetch dùng lại)`);
  } else check(crowdReqs.length === 0, `systems: ?crowd=off ⇒ ${crowdReqs.length} yêu cầu tới people/crowd.* (${crowdReqs.join(', ')})`);

  /* ---------- 2. noOldShape ---------- */
  const old = await page.evaluate(() => { const out = []; window.__app.scene.traverse((o) => { if (o.isMesh && /-people$/.test(o.parent?.name ?? '') && o.geometry.attributes.position.count <= 200) out.push(`${o.parent.name}:${o.geometry.attributes.position.count}`); }); return out; });
  check(old.length === 0, `noOldShape: không còn lưới người ≤ 200 đỉnh (${old.join(', ')})`);
  if (!real) check(sy.length === 3 && sy.every((s) => s.verts > 200 && s.verts <= 900), `noOldShape: hình người ${sy.map((s) => s.verts).join('/')} đỉnh (≤ 900)`);

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
    if (real) {
      /* noSlip: nhịp phát trong khoảng kẹp; người đi / chạy: tốc độ thật so với tốc độ chân (nhịp × tự nhiên × tỉ lệ) */
      const out = b.filter((p) => !(p.rate >= CROWD.rateMin - 1e-4 && p.rate <= (p.child ? CROWD.rateMaxChild : CROWD.rateMax) + 1e-4));   // nhân vật trẻ em: trần riêng
      const mov = b.filter((p) => p.clip === 'walk' || p.clip === 'jog'), fixed = b.filter((p) => p.clip === 'idle' || p.clip === 'photo');
      const slip = mov.map((p) => ({ p, k: p.speed / (p.rate * p.natural * p.scale) })), bad = slip.filter((s) => Math.abs(s.k - 1) > 0.1);
      const ks = slip.map((s) => s.k);
      check(out.length === 0 && fixed.every((p) => Math.abs(p.rate - 1) < 1e-4), `noSlip: ${n} nhịp phát ${Math.min(...b.map((p) => p.rate)).toFixed(3)}…${Math.max(...b.map((p) => p.rate)).toFixed(3)} trong [${CROWD.rateMin}; ${CROWD.rateMax}] (trẻ em ≤ ${CROWD.rateMaxChild}; ${out.length} ngoài), ${fixed.length} người đứng / chụp ảnh nhịp 1`);
      check(mov.length > 0 && bad.length === 0, `noSlip: ${n} ${mov.length} người đi / chạy, tốc độ ÷ tốc độ chân ${Math.min(...ks).toFixed(3)}…${Math.max(...ks).toFixed(3)} (lệch > 10 %: ${bad.length}${bad.slice(0, 3).map((s) => ` #${s.p.i} ${s.p.clip} ${s.p.speed.toFixed(2)} m/s nhịp ${s.p.rate.toFixed(2)} k ${s.k.toFixed(2)}`).join(';')})`);
    }
  }

  /* ---------- 4. insideSidewalk ---------- */
  const groundCheck = async (tag) => {
    for (const n of NAMES) {
      const ps = (await positions(n)).filter((p) => p.visible);
      const out = ps.filter((p) => !inBand(n, p)), off = ps.filter((p) => p.y < p.ground - 1e-4 || p.y > p.ground + 1e-3);
      check(ps.length === COUNTS[n] && out.length === 0, `${tag}: ${n} ${ps.length} người, ${out.length} ngoài dải lề (${out.slice(0, 3).map((p) => `#${p.i} x ${p.x.toFixed(1)} z ${p.z.toFixed(2)}`).join('; ')})`);
      check(off.length === 0, `${tag}: ${n} gốc hình đúng mặt lề (${off.length} lệch: ${off.slice(0, 3).map((p) => `#${p.i} y ${p.y.toFixed(3)} / ${p.ground.toFixed(3)}`).join('; ')})`);
    }
  };
  await groundCheck('insideSidewalk');
  const dps = (await positions('dragon-people')).filter((p) => p.visible);
  const nearLamp = dps.filter((p) => Math.abs(p.z) < 17.3 || Math.abs(p.z) > 18.58), standLand = dps.filter((p) => p.kind === 'stand' && Math.abs(p.x) > 255);
  check(dps.length === 70 && nearLamp.length === 0, `clearLamps: dragon-people ${dps.length} người, ${nearLamp.length} người lấn hàng cột đèn / lan can (${nearLamp.slice(0, 3).map((p) => `#${p.i} ${p.kind} z ${p.z.toFixed(2)}`).join('; ')}); |z| ${Math.min(...dps.map((p) => Math.abs(p.z))).toFixed(2)}…${Math.max(...dps.map((p) => Math.abs(p.z))).toFixed(2)}`);
  check(standLand.length === 0, `standOverRiver: dragon-people ${standLand.length} người đứng trên phần cầu qua đất (|x| > 255) (${standLand.slice(0, 3).map((p) => `#${p.i} x ${p.x.toFixed(1)}`).join('; ')})`);
  if (real) {
    /* feet: chân thật (skin trên CPU) chạm mặt lề ±0,02 m ở mọi khung của đoạn người đó dùng */
    const feet = await page.evaluate(() => window.__app.people.crowdFeet());
    if (check(Array.isArray(feet) && feet.length === 10, `feet: đọc được bảng chân ${feet?.length} nhân vật`)) for (const f of feet) console.log(`      chân ${f.id.padEnd(16)} ${Object.entries(f.clips).map(([k, [lo, hi]]) => `${k} ${(lo * 100).toFixed(1)}…${(hi * 100).toFixed(1)} cm`).join(' · ')}`);
    /* Chạy (jog) có pha bay (hai chân rời đất) ⇒ chỉ chấm khung chạm đất (y thấp nhất qua các khung); đi / đứng / chụp ảnh luôn có chân chạm đất ⇒ chấm mọi khung.
       Lơ lửng: > +2 cm là lỗi. Chìm: < −3 cm là lỗi (≈ dày đế giày, không thấy từ ≥ 5 m); −3…−2 cm chỉ in ra để người xem quyết */
    for (const n of Array.isArray(feet) ? NAMES : []) {
      const ps = await positions(n), bad = [], sink = [];
      let lo = Infinity, hi = -Infinity;
      for (const p of ps) {
        const [a, b] = feet[p.char].clips[p.clip], l = a * p.scale, h = (p.clip === 'jog' ? a : b) * p.scale, tag = `#${p.i} ${feet[p.char].id} ${p.clip} ${(l * 100).toFixed(1)}…${(h * 100).toFixed(1)} cm`;
        lo = Math.min(lo, l); hi = Math.max(hi, h);
        if (l < -0.03 || h > 0.02) bad.push(tag); else if (l < -0.02) sink.push(tag);
      }
      check(bad.length === 0, `feet: ${n} chân chạm đất ${(lo * 100).toFixed(1)}…${(hi * 100).toFixed(1)} cm so với mặt lề (lơ lửng ≤ 2 cm, chìm ≤ 3 cm; ${bad.length} lệch${bad.length ? ': ' + bad.slice(0, 3).join('; ') : ''})`);
      if (sink.length) console.log(`      (feet ${n}: ${sink.length} người chìm 2–3 cm ở vài khung, không chấm: ${sink.slice(0, 3).join('; ')})`);
    }
  }

  /* ---------- 8. randKept ---------- */
  const rk = await page.evaluate(() => (window.__app.boats?.running() ?? []).map((b) => b.speed));
  check(rk.length === 7 && rk.every((s, i) => Math.abs(s - MAIN_BOAT_SPEEDS[i]) < 1e-12), `randKept: speed 7 tàu trùng main (${rk.map((s) => s.toFixed(3)).join(', ')})`);

  /* ---------- 1b. drawCalls: bật / tắt lưới (không phải nhóm: update của cầu ghi đè group.visible mỗi khung) của từng hệ ⇒ đổi đúng 1 lệnh vẽ.
     Cảnh còn xe / tàu chạy nên lấy trung vị của 4 lần đo mỗi trạng thái, xen kẽ bật / tắt ---------- */
  if (real) {
    const target = { 'dragon-people': await find('dragon-people', (p) => p.kind === 'walk' && Math.abs(p.x) < 200), 'ttl-people': await find('ttl-people', (p) => p.i < 46 && p.kind !== 'stand' && Math.abs(p.x) < 200), 'sh-people': await find('sh-people', (p) => p.i < 36 && p.kind !== 'stand') };
    for (const n of NAMES) {
      await aim(n, target[n], [7, 3, -9]); await frames(page, 3);
      const on = [], off = [];
      const setVis = (v) => page.evaluate(([n, v]) => { window.__app.scene.getObjectByName(n).children.find((o) => o.isBatchedMesh).visible = v; }, [n, v]);
      const calls = () => page.evaluate(() => window.__app.renderer.info.render.calls);
      for (let k = 0; k < 4; k++) { await setVis(true); await frames(page, 2); on.push(await calls()); await setVis(false); await frames(page, 2); off.push(await calls()); }
      await setVis(true); await frames(page, 2);
      check(median(on) - median(off) === 1, `drawCalls: ${n} hiện ${on.join('/')} — ẩn ${off.join('/')} ⇒ trung vị đổi ${median(on) - median(off)} (mong 1)`);
    }
    await setCam(...ALL_CAM); await frames(page, 3);
  }

  /* ---------- 5. stormClear ---------- */
  const leadMismatch = async () => {
    const out = [];
    for (const n of NAMES) { const ps = await positions(n); for (const p of ps) if (p.follow >= 0 && p.visible !== ps[p.follow].visible) out.push(`${n}#${p.i}`); }
    return out;
  };
  await setWx(page, 'storm');
  await page.waitForFunction(() => window.__app.weather.fx().clear >= 0.45, null, { timeout: 600000, polling: 100 });
  const mid = await systems(), midK = await page.evaluate(() => window.__app.weather.fx().clear), midLead = await leadMismatch();
  check(mid.length === 3 && mid.every((s) => s.visible > 0 && s.visible < s.count), `stormClear: giữa chừng (clear ${midK.toFixed(2)}) ${mid.map((s) => `${s.name} ${s.visible}/${s.count}`).join(', ')}`);
  check(midLead.length === 0, `stormClear: giữa chừng người đi cùng ẩn / hiện cùng người dẫn (${midLead.length} lệch: ${midLead.slice(0, 5).join(', ')})`);
  await page.waitForFunction(() => window.__app.weather.fx().clear >= 1, null, { timeout: 600000, polling: 200 }); await frames(page, 2);
  const gone = await systems();
  check(gone.length === 3 && gone.every((s) => s.visible === 0), `stormClear: bão đóng cầu ⇒ ${gone.map((s) => `${s.name} ${s.visible}`).join(', ')} người còn hiện`);
  await setWx(page, 'now');
  await page.waitForFunction(() => window.__app.weather.fx().clear <= 0, null, { timeout: 600000, polling: 200 }); await frames(page, 3);
  const back = await systems();
  check(back.length === 3 && back.every((s) => s.visible === s.count), `stormClear: hết bão ⇒ ${back.map((s) => `${s.name} ${s.visible}/${s.count}`).join(', ')}`);
  for (const n of NAMES) {
    const ps = await positions(n), stale = ps.filter((p) => Math.abs(p.x - p.lx) > 1e-3 || Math.abs(p.z - p.lz) > 1e-3);
    check(ps.length === COUNTS[n] && stale.length === 0, `stormClear: hết bão ⇒ ${n} ma trận trùng vị trí hiện tại (${stale.length} người còn ở chỗ cũ: ${stale.slice(0, 3).map((p) => `#${p.i} x ${p.x.toFixed(1)}/${p.lx.toFixed(1)} z ${p.z.toFixed(1)}/${p.lz.toFixed(1)}`).join('; ')})`);
  }
  await groundCheck('stormClear sau bão');

  /* ---------- 6. toggleBack ---------- */
  const ttlState = async () => (await systems()).find((s) => s.name === 'ttl-people');
  // nút nằm trong bảng Trần Thị Lý (ẩn khi chưa chọn cầu này) ⇒ bấm bằng click() như traffic-check (#btnTtlLife)
  const ttlBtn = () => page.evaluate(() => document.getElementById('btnTtlPeople').click());
  await ttlBtn(); await frames(page, 3);
  const tOff = await ttlState();
  await ttlBtn(); await frames(page, 3);
  const tOn = await ttlState();
  check(tOff?.groupVisible === false && tOn?.groupVisible === true && tOn?.visible === 80, `toggleBack: tắt ⇒ nhóm ẩn (${tOff?.groupVisible}), bật lại ⇒ hiện ${tOn?.visible}/80 (${tOn?.groupVisible})`);

  /* ---------- 7. dragonLod + dragonCull: đếm lệnh vẽ của lưới người Cầu Rồng qua onAfterRender (renderer chỉ gọi khi đối tượng qua cắt cả khối);
     BatchedMesh cắt thêm từng id: lệnh vẽ thật khi _multiDrawCount > 0 (r165 renderMultiDraw bỏ qua khi 0) ---------- */
  const dragonDrawn = async (pos, tgt) => {
    await setCam(pos, tgt); await frames(page, 2);
    await page.evaluate(() => { const m = window.__app.scene.getObjectByName('dragon-people').children.find((o) => o.isInstancedMesh || o.isBatchedMesh); window.__ppDrawn = 0; window.__ppIds = 0; m.onAfterRender = () => { const k = m.isBatchedMesh ? m._multiDrawCount : m.count; if (k > 0) window.__ppDrawn++; window.__ppIds += k; }; });
    await frames(page, 3);
    return page.evaluate(() => { const g = window.__app.scene.getObjectByName('dragon-people'), m = g.children.find((o) => o.isInstancedMesh || o.isBatchedMesh); m.onAfterRender = () => {}; return { drawn: window.__ppDrawn, ids: window.__ppIds, group: g.visible, culled: m.frustumCulled, d: window.__app.camera.position.distanceTo(new window.__app.THREE.Vector3(0, 8, 0)) }; });
  };
  const far = await dragonDrawn([0, 300, 1980], [0, 8, 0]), near = await dragonDrawn([0, 120, 270], [0, 8, 0]);
  check(far.group === false && far.drawn === 0 && near.group === true && near.drawn > 0, `dragonLod: camera cách ${far.d.toFixed(0)} m ⇒ nhóm ẩn (${far.group}), ${far.drawn} lệnh vẽ; ${near.d.toFixed(0)} m ⇒ hiện (${near.group}), ${near.drawn} lệnh vẽ`);
  const awayTtl = await dragonDrawn([0, 60, 1380], [0, 20, 1800]), awaySh = await dragonDrawn([0, 60, -1080], [0, 20, -1500]), look = await dragonDrawn([0, 120, 270], [0, 8, 0]);
  check(awayTtl.group && awayTtl.drawn === 0, `dragonCull: gần Trần Thị Lý (cách ${awayTtl.d.toFixed(0)} m), quay lưng lại Cầu Rồng ⇒ nhóm hiện (${awayTtl.group}), ${awayTtl.drawn} lệnh vẽ, ${awayTtl.ids} người (frustumCulled ${awayTtl.culled})`);
  check(awaySh.group && awaySh.drawn === 0, `dragonCull: gần Cầu sông Hàn (cách ${awaySh.d.toFixed(0)} m), quay lưng lại Cầu Rồng ⇒ nhóm hiện (${awaySh.group}), ${awaySh.drawn} lệnh vẽ, ${awaySh.ids} người`);
  check(look.group && look.drawn > 0, `dragonCull: nhìn vào Cầu Rồng (cách ${look.d.toFixed(0)} m) ⇒ ${look.drawn} lệnh vẽ, ${look.ids} người`);

  /* ---------- 10. ảnh ---------- */
  if (shots && !NO_SHOTS) {
    await hideUi(true);
    /* Ảnh đen kịt (PNG 960×540 một màu ≈ 3 kB, ảnh cảnh thật ≥ 200 kB) = NaN trong khung, ban đêm bloom lan ra cả màn hình (lỗi pháp tuyến 0 của crowd.bin) */
    const shot = async (name) => { await frames(page, 3); const b = await page.screenshot({ path: `${SCREENS}people-${name}.png` }); check(b.length > 50000, `ảnh people-${name}.png không đen kịt (${Math.round(b.length / 1000)} kB)`); };
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
    await aim('ttl-people', tWalk, [7, 3, -9]); await shot('tran-thi-ly-dem');
    await aim('sh-people', sWalk, [7, 3, -8]); await shot('cau-song-han-dem');
    await setNight(0);
    await hideUi(false);
  }

  check(errors.length === 0, `không lỗi console, kể cả lỗi biên dịch shader (${errors.join(' | ')})`);
  const sw = shaderWarns(warns);
  check(sw.length === 0, `không cảnh báo shader / program trong console (${sw.slice(0, 3).join(' | ')})`);
  const other = [...new Set(warns)].filter((w) => !sw.includes(w));
  if (other.length) console.log(`      (cảnh báo khác, không chấm: ${other.slice(0, 5).map((w) => w.slice(0, 120)).join(' | ')})`);
}

/* ===================== trang lùi: tải lỗi / chậm / ảnh hỏng ⇒ hình khối ===================== */
async function fallback(ctx, why) {
  const { page, errors, warns } = ctx;
  await frames(page, 3);
  const sy = await page.evaluate(() => window.__app.people?.systems() ?? []);
  check(sy.length === 3 && sy.every((s) => s.real === false && s.materialName === 'peopleWalk' && s.meshes === 1 && s.count === COUNTS[s.name] && s.visible === s.count),
    `${why}: trang dựng xong, 3 hệ hình khối (${sy.map((s) => `${s.name} ${s.materialName} real ${s.real} ${s.visible}/${s.count}`).join(', ')})`);
  const pw = warns.filter((w) => w.includes('[people]'));
  check(pw.length === 1, `${why}: đúng một console.warn "[people]" (${pw.length}: ${pw.join(' | ')})`);
  check(errors.length === 0, `${why}: không lỗi console (${errors.join(' | ')})`);
  const sw = shaderWarns(warns);
  check(sw.length === 0, `${why}: không cảnh báo shader (${sw.slice(0, 3).join(' | ')})`);
}

const srv = await serveDir(DIST);
const browser = await launch();
const t0 = Date.now();
const lap = (s) => console.log(`\n===== ${s} (${((Date.now() - t0) / 60000).toFixed(1)} phút) =====`);
try {
  pass = 'A người thật'; lap(pass);
  { const c = await open(browser, srv.url); try { await suite(c, true, true); } finally { await c.page.close(); } }

  pass = 'B crowd=off'; lap(pass);
  { const c = await open(browser, srv.url + '?crowd=off'); try { await suite(c, false, false); } finally { await c.page.close(); } }

  pass = 'C chặn tải'; lap(pass);
  { const c = await open(browser, srv.url, (r) => r.abort()); try { await fallback(c, 'chặn people/crowd.*'); } finally { await c.page.close(); } }

  pass = 'D tải chậm'; lap(pass);
  {
    const delay = CROWD.loadTimeoutMs + 4000, tOpen = Date.now();
    const c = await open(browser, srv.url, async (r) => { if (r.request().url().endsWith('.bin')) await new Promise((ok) => setTimeout(ok, delay)); try { await r.continue(); } catch { /* yêu cầu đã bị huỷ (AbortController) */ } });
    try {
      check(Date.now() - tOpen >= CROWD.loadTimeoutMs, `crowd.bin chậm ${delay} ms: trang chờ ${((Date.now() - tOpen) / 1000).toFixed(1)} s (≥ ${CROWD.loadTimeoutMs / 1000} s hạn tải) rồi dựng tiếp, không treo`);
      await fallback(c, `crowd.bin chậm hơn ${CROWD.loadTimeoutMs} ms`);
      const w = c.warns.find((x) => x.includes('[people]')) ?? '';
      check(/quá \d+ ms/.test(w), `crowd.bin chậm: lý do lùi là quá hạn (${w})`);
    } finally { await c.page.close(); }
  }

  pass = 'E ảnh hỏng'; lap(pass);
  {
    const c = await open(browser, srv.url, (r) => (r.request().url().endsWith('.jpg') ? r.fulfill({ status: 200, contentType: 'image/jpeg', body: Buffer.from('khong phai anh jpeg') }) : r.continue()));
    try { await fallback(c, 'crowd.jpg không giải mã được'); } finally { await c.page.close(); }
  }
} catch (e) {
  check(false, `test dừng giữa chừng: ${e?.stack ?? e}`);
} finally {
  await browser.close(); srv.close();
}
console.log(`\nThời gian: ${((Date.now() - t0) / 60000).toFixed(1)} phút`);
for (const [k, [ok, bad]] of Object.entries(tally)) console.log(`  ${k}: ${ok} đạt, ${bad} lỗi`);
console.log(problems.length ? `\n${problems.length} mục LỖI` : '\nTất cả ĐẠT');
process.exit(problems.length ? 1 : 0);
