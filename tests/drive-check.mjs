// Kiểm tra chế độ lái xe ô tô VinFast VF 3 trên máy tính (docs/superpowers/plans/2026-11-12-lai-xe-oto.md, Task 12; D-034).
//   Trang A `?explore=drive` (lái một mình, không máy chủ), mọi bước mô phỏng chạy trong MỘT lần evaluate (không có khung hình xen vào) bằng `__app.drive.step(0.1, input)`:
//   Mục 1: vào bằng ?explore=drive (body.explore + body.drive, cam.mode 'car', xe ở drSpawnPose, hướng Đông); trang B `?chooser` bấm thẻ Ô tô (khóa exCar) cũng vào được.
//   Mục 2: lái thẳng suốt từng trục (Cầu Rồng, Cầu sông Hàn, Trần Thị Lý, Hầm, Thuận Phước; hai chiều; xe tự động tạm ẩn): mỗi 0,5 s mô phỏng
//          |y − mặt đường tại chỗ| ≤ 0,05, đủ 9 điểm mẫu có mặt đường cùng tầng, tâm + bốn góc không nằm trong hộp bao nhà nào (oracle độc lập: ma trận instance
//          của cảnh, gồm nhà Thuận Phước); vài điểm đối chiếu thêm bằng tia thẳng xuống vào lưới thật của cảnh. Lái theo điểm qua một chỗ rẽ nút giao đường dọc Đông.
//   Mục 3: đâm 100 km/h vào lan can Cầu Rồng, tường hầm, thân rồng: xe dừng phía trong mép ô đường, không xuyên.
//   Mục 4: Bạch Đằng về phía Nam từ z = −200 bị chặn trước dốc cầu (gầm đóng); đi vòng bằng nhánh rẽ qua z = 0 sang được z > 60.
//   Mục 5: Cầu sông Hàn: ép cầu rời CLOSED (ctrl.state), xe trên nhịp quay được đưa ra ngoài barie trong < 1 s mô phỏng ở tốc độ quay 30×; lái vào barie bị chặn.
//   Mục 6: trong hầm: ảnh không có điểm ảnh màu nước ở nửa trên khung; ghi số lệnh vẽ.
//   Mục 7: đèn: ban đêm đèn pha / đèn hậu phát sáng, ban ngày bằng 0; phanh thì đèn hậu sáng cả ban ngày (đọc vật liệu của xe thật trong cảnh).
//   Mục 9: HUD: số km/h khớp |v| · 3,6; bản đồ nhỏ vẽ được (nhiều màu, có ô hầm); 9 ngôn ngữ đổi chữ HUD; ar không lật (#drHud direction ltr).
//   Mục 8 (trang C, D): chặn **/car/vf3.glb: vẫn lái được bằng hình tạm, không lỗi console; giữ 12 s: hình tạm rồi đổi sang xe thật, không nhảy vị trí.
//   Mục 10 + 11 (trang F `?test` thường): lệnh vẽ góc mặc định (overview, ban ngày) so với số của `main` trong tests/KET-QUA.md; vào lái một mình tăng ≤ 6;
//          rồi thoát lái (drive.stop) và vào Đi dạo: không còn #drHud, ngưỡng ẩn Hầm về cũ, đi dạo chạy bình thường.
//   Mục 12: ảnh xem tay tests/screens/drive-check-*.png (bỏ bằng --no-shots).
//
//   Mỗi mục bọc try / catch riêng (một mục hỏng không làm sập các mục sau), có giới hạn thời gian từng mục và tổng; luôn đóng trình duyệt ở finally.
//   npm run build && npm run test:drive [-- --no-shots]
import { fileURLToPath } from 'node:url';
import { readFileSync, mkdirSync } from 'node:fs';
import { serveDir, launch, openApp, frames, pick, pickView } from './lib.mjs';

const SHOTS = !process.argv.includes('--no-shots');
const SCREENS = fileURLToPath(new URL('./screens/', import.meta.url));
const T0 = Date.now(), TOTAL_MS = 60 * 60 * 1000;
const problems = [];
const check = (name, ok) => { if (!ok) problems.push(name); console.log(`${ok ? 'đạt ' : 'LỖI '} ${name}`); return ok; };
const info = (msg) => console.log(`ghi  ${msg}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rd = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');

/* Thông số lấy từ src/config.ts (đọc chữ, không import TS) để test không chép số tay */
const cfgSrc = rd('../src/config.ts'), drv = cfgSrc.slice(cfgSrc.indexOf('const driveBase'));
const num = (re, from = drv) => { const m = from.match(re); if (!m) throw new Error('không đọc được thông số: ' + re); return Number(m[1]); };
const C = {
  length: num(/length:\s*([\d.]+)/), width: num(/width:\s*([\d.]+)/), height: num(/height:\s*([\d.]+)/), stepMax: num(/stepMax:\s*([\d.]+)/),
  axisX0: num(/axisX0:\s*(-?\d+)/), axisX1: num(/axisX1:\s*(-?\d+)/), tpX0: num(/tpX0:\s*(-?\d+)/),
  spawnX: num(/spawn:\s*\{\s*x:\s*(-?[\d.]+)/), spawnLane: num(/spawn:\s*\{[^}]*lane:\s*([\d.]+)/),
  headNight: num(/headNight:\s*([\d.]+)/), tailNight: num(/tailNight:\s*([\d.]+)/), tailBrake: num(/tailBrake:\s*([\d.]+)/), tunnelFar: num(/tunnelFar:\s*([\d.]+)/)
};
const LANGS = ['vi', 'en', 'ko', 'ja', 'zh', 'th', 'ar', 'hi', 'ru'];
const LOC = Object.fromEntries(LANGS.map((c) => [c, JSON.parse(rd(`../src/i18n/locales/${c}.json`))]));

/* Chạy một mục: lỗi hoặc quá giờ thì in LỖI rồi đi tiếp */
async function section(name, fn, ms = 20 * 60 * 1000) {
  if (Date.now() - T0 > TOTAL_MS) { check(`${name}: bỏ qua vì hết giờ tổng ${TOTAL_MS / 60000} phút`, false); return; }
  let timer;
  try {
    await Promise.race([fn(), new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(`quá giờ mục ${ms / 60000} phút`)), ms); })]);
  } catch (e) { check(`${name}: ngoại lệ ${String(e && e.message || e).split('\n')[0]}`, false); }
  finally { clearTimeout(timer); }
}

/* ======================= Chạy trong trang: bộ công cụ lái theo kịch bản ======================= */
function installHelpers(K) {
  const a = window.__app, D = a.drive, T = a.THREE;
  const HL = K.length / 2, HW = K.width / 2;
  const wrap = (x) => x - 2 * Math.PI * Math.round(x / (2 * Math.PI));
  const pad = (id) => D.net.pads.find((p) => p.id === id) || null;
  /* mặt đường tại (x, z) ở tầng gần yRef nhất trong ± stepMax; NaN nếu không có (cổng đang đóng thì bỏ ô) */
  const ground = (x, z, yRef) => {
    let best = NaN, bd = Infinity;
    for (const p of D.net.pads) {
      if (x < p.x0 || x > p.x1 || z < p.z0 || z > p.z1) continue;
      if (p.gate !== undefined && D.net.closed.has(p.gate)) continue;
      const y = p.y(x, z), d = Math.abs(y - yRef);
      if (d <= K.stepMax && d < bd) { bd = d; best = y; }
    }
    return best;
  };
  const pts = (s, n) => {   // điểm mẫu thân xe: n = 9 (lưới 3 × 3) hoặc 5 (tâm + bốn góc)
    const c = Math.cos(s.yaw), sn = Math.sin(s.yaw), out = [];
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      if (n === 5 && !((i === 0 && j === 0) || (i !== 0 && j !== 0))) continue;
      const lf = i * HL, ln = j * HW;
      out.push([s.x + lf * c + ln * sn, s.z - lf * sn + ln * c]);
    }
    return out;
  };
  /* hộp bao nhà: nhà khu phố (level gần của THREE.LOD) + nhà quanh Thuận Phước (tp-houses), từ ma trận instance và hình học thật của cảnh */
  let boxes = null;
  const buildBoxes = () => {
    const out = [], mi = new T.Matrix4(), mw = new T.Matrix4(), bb = new T.Box3();
    a.scene.updateMatrixWorld(true);
    a.scene.traverse((o) => {
      if (!o.isInstancedMesh) return;
      const near = o.parent && o.parent.isLOD && o.parent.levels[0] && o.parent.levels[0].object === o;
      if (!near && o.name !== 'tp-houses') return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, mi);
        const e = mi.elements; if (Math.hypot(e[0], e[1], e[2]) < 1e-6) continue;   // nhà đã dọn (scale 0)
        mw.multiplyMatrices(o.matrixWorld, mi);
        bb.copy(o.geometry.boundingBox).applyMatrix4(mw);
        out.push(bb.min.x, bb.max.x, bb.min.z, bb.max.z, bb.min.y, bb.max.y);
      }
    });
    boxes = new Float64Array(out);
    return boxes.length / 6;
  };
  const inBuilding = (s) => {
    const P = pts(s, 5), top = s.y + K.height;
    for (let b = 0; b < boxes.length; b += 6) {
      if (!(top > boxes[b + 4] + 0.3 && s.y < boxes[b + 5] - 0.3)) continue;
      for (const [x, z] of P) if (x > boxes[b] + 0.05 && x < boxes[b + 1] - 0.05 && z > boxes[b + 2] + 0.05 && z < boxes[b + 3] - 0.05) return b / 6;
    }
    return -1;
  };
  /* Tia thẳng xuống vào lưới thật (không instance / điểm / đường / xe của chế độ lái) từ trên xe 1 m: cao độ trúng hoặc null */
  const rayY = (x, y, z) => {
    const list = [];
    a.scene.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh) return;
      for (let p = o; p; p = p.parent) if (!p.visible || p.name === 'drive-cars') return;
      const g = o.geometry; if (!g.boundingSphere) g.computeBoundingSphere();
      const sp = g.boundingSphere.clone().applyMatrix4(o.matrixWorld);
      if (Math.hypot(sp.center.x - x, sp.center.z - z) > sp.radius + 1) return;
      list.push(o);
    });
    const rc = new T.Raycaster(); rc.layers.enableAll(); rc.set(new T.Vector3(x, y + 1, z), new T.Vector3(0, -1, 0)); rc.near = 0; rc.far = 12;
    const h = rc.intersectObjects(list, false);
    return h.length ? { y: h[0].point.y, name: h[0].object.name || h[0].object.type } : null;
  };
  const hidden = [];
  const hideTraffic = () => {
    let n = 0;
    for (const f of a.traffic.fleets()) { const m = f.mesh; if (m && m.visible) { m.visible = false; hidden.push(m); n++; } }
    return n;
  };
  const showTraffic = () => { for (const m of hidden.splice(0)) m.visible = true; };

  /* lái thẳng: đặt xe ở (x, z, yaw), ga tới vWant (m/s), kiểm mỗi 0,5 s mô phỏng; rayAt: các tiến độ (m) cần đối chiếu bằng tia */
  const run = (o) => {
    D.placeAt(o.x, o.z, o.yaw);
    const s = D.state, inp = { gas: 0, brake: 0, steer: 0, hand: false }, dirx = Math.cos(o.yaw);
    const res = { tag: o.tag, steps: 0, t: 0, nViol: 0, viol: [], reached: false, vmax: 0, stuck: null, checks: 0, rays: 0, x: s.x };
    const note = (k, msg) => { res.nViol++; if (res.viol.length < 6) res.viol.push(`${k}: ${msg}`); };
    const rayAt = (o.rayAt || []).slice();
    let still = 0;
    for (let i = 0; i < Math.ceil(o.maxT / 0.1); i++) {
      inp.gas = s.v < (o.vWant || 100) ? 1 : 0;
      D.step(0.1, inp);
      res.steps++; res.t += 0.1; if (s.v > res.vmax) res.vmax = s.v;
      const prog = (s.x - o.x) * dirx;
      if (res.steps % 5 === 0) {
        res.checks++;
        const g = ground(s.x, s.z, s.y);
        if (Number.isNaN(g)) note('không có mặt đường tại tâm', `(${s.x.toFixed(1)}, ${s.z.toFixed(1)}) y ${s.y.toFixed(2)}`);
        else if (Math.abs(g - s.y) > 0.05) note('y lệch mặt đường', `${s.y.toFixed(3)} so ${g.toFixed(3)} tại x ${s.x.toFixed(1)}`);
        const bad = pts(s, 9).filter(([x, z]) => Number.isNaN(ground(x, z, s.y))).length;
        if (bad) note('thân xe thiếu mặt đường (drFits sai)', `${bad}/9 điểm tại (${s.x.toFixed(1)}, ${s.z.toFixed(1)})`);
        if (boxes) { const b = inBuilding(s); if (b >= 0) note('xe nằm trong nhà', `nhà #${b} tại (${s.x.toFixed(1)}, ${s.z.toFixed(1)})`); }
      }
      while (rayAt.length && prog >= rayAt[0]) {
        rayAt.shift(); res.rays++;
        const h = rayY(s.x, s.y, s.z);
        if (!h) note('tia xuống không trúng lưới nào', `(${s.x.toFixed(1)}, ${s.z.toFixed(1)})`);
        else if (Math.abs(h.y - s.y) > 0.12) note('mặt trúng của tia lệch y xe', `${h.name} ${h.y.toFixed(3)} so ${s.y.toFixed(3)} tại x ${s.x.toFixed(1)}`);
      }
      if (prog >= o.dist) { res.reached = true; break; }
      still = res.t > 6 && Math.abs(s.v) < 0.3 ? still + 1 : 0;
      if (still > 30) { res.stuck = [+s.x.toFixed(1), +s.z.toFixed(1)]; break; }
    }
    res.x = +s.x.toFixed(1); res.v = +s.v.toFixed(2);
    return res;
  };

  /* đâm thẳng ở v0: o.pad (id ô), o.side ('z0' | 'z1' | 'x0' | 'x1'): độ lấn lớn nhất của tâm + bốn góc ra ngoài cạnh đó, số bước thân xe thiếu mặt đường */
  const crash = (o) => {
    const p = pad(o.pad); if (!p) return { err: 'không có ô ' + o.pad };
    D.placeAt(o.x, o.z, o.yaw);
    const s = D.state, inp = { gas: 1, brake: 0, steer: 0, hand: false };
    s.v = o.v0;
    let worst = -Infinity, invalid = 0, minZ = Infinity;
    for (let i = 0; i < Math.ceil(o.T / 0.1); i++) {
      D.step(0.1, inp);
      for (const [x, z] of pts(s, 5)) {
        const over = o.side === 'z1' ? z - p.z1 : o.side === 'z0' ? p.z0 - z : o.side === 'x1' ? x - p.x1 : p.x0 - x;
        if (over > worst) worst = over;
        if (z < minZ) minZ = z;
      }
      if (pts(s, 9).some(([x, z]) => Number.isNaN(ground(x, z, s.y)))) invalid++;
    }
    return { v: +s.v.toFixed(2), worst: +worst.toFixed(3), invalid, x: +s.x.toFixed(2), z: +s.z.toFixed(2), minZ: +minZ.toFixed(3), pad: [p.x0, p.x1, p.z0, p.z1] };
  };

  /* lái theo điểm (pure pursuit): wp = [[x, z], ...]; ga giữ vWant, kiểm mỗi bước: đủ 9 điểm mẫu có mặt đường */
  const follow = (o) => {
    D.placeAt(o.x, o.z, o.yaw);
    const s = D.state, inp = { gas: 0, brake: 0, steer: 0, hand: false }, wp = o.wp, n = wp.length;
    let k = 0, still = 0, bad = 0, first = null, t = 0, done = false;
    for (let i = 0; i < Math.ceil(o.maxT / 0.1); i++) {
      while (k < n - 1 && Math.hypot(wp[k][0] - s.x, wp[k][1] - s.z) < 2.5) k++;
      const dx = wp[k][0] - s.x, dz = wp[k][1] - s.z;
      const err = wrap(Math.atan2(-dz, dx) - s.yaw);
      inp.steer = Math.max(-1, Math.min(1, 2.2 * err));
      inp.gas = s.v < o.vWant ? 1 : 0; inp.brake = s.v > o.vWant + 2 ? 1 : 0;
      D.step(0.1, inp); t += 0.1;
      if (pts(s, 9).some(([x, z]) => Number.isNaN(ground(x, z, s.y)))) { bad++; if (!first) first = [+s.x.toFixed(1), +s.z.toFixed(1)]; }
      if (k === n - 1 && Math.hypot(wp[k][0] - s.x, wp[k][1] - s.z) < 2.5) { done = true; break; }
      still = t > 6 && Math.abs(s.v) < 0.3 ? still + 1 : 0;
      if (still > 30) break;
    }
    return { done, k, n, bad, first, t: +t.toFixed(1), x: +s.x.toFixed(1), z: +s.z.toFixed(1), v: +s.v.toFixed(2) };
  };

  window.__dr = { pad, ground, pts, buildBoxes, hideTraffic, showTraffic, run, crash, follow, rayY, rect: (id) => { const p = pad(id); return p ? [p.x0, p.x1, p.z0, p.z1] : null; } };
}

/* Cung nửa vòng tròn / vòng tròn: các điểm trên cung tâm (cx, cz) bán kính r từ góc a0 tới a1 (độ), n đoạn */
const arc = (cx, cz, r, a0, a1, n = 12) => Array.from({ length: n + 1 }, (_, i) => { const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180; return [+(cx + r * Math.cos(a)).toFixed(3), +(cz + r * Math.sin(a)).toFixed(3)]; });

/* ===================================== chạy ===================================== */
const srv = await serveDir(fileURLToPath(new URL('../dist/', import.meta.url)));
const browser = await launch();
const allErrors = [];   // [trang, lỗi console]
try {
  if (SHOTS) mkdirSync(SCREENS, { recursive: true });
  let A = null;

  /* ---------------- Trang A: ?explore=drive ---------------- */
  await section('mở trang A', async () => {
    A = await openApp(browser, srv.url + '?explore=drive', { width: 640, height: 360 });
    A.page.setDefaultTimeout(300000);
  }, 15 * 60 * 1000);

  if (A) {
    const P = A.page;
    const shot = async (name) => { if (SHOTS) await P.screenshot({ path: `${SCREENS}drive-check-${name}.png` }); };

    await section('1 (?explore=drive)', async () => {
      await P.waitForFunction(() => window.__app.drive.state && window.__app.cam.mode === 'car', null, { polling: 500 });
      const r = await P.evaluate(() => { const A = window.__app, s = A.drive.state; return { cls: document.body.classList.contains('explore') && document.body.classList.contains('drive'), mode: A.cam.mode, x: s.x, z: s.z, yaw: s.yaw, y: s.y, v: s.v, active: A.drive.active() }; });
      check(`1 ?explore=drive: body.explore + body.drive, cam.mode '${r.mode}' = car, drive.active ${r.active}`, r.cls && r.mode === 'car' && r.active);
      check(`1 xe ở drSpawnPose(lái một mình): (${r.x}, ${r.z}) = (${C.spawnX}, ${C.spawnLane}), yaw ${r.yaw} (hướng Đông), v ${r.v}`, Math.abs(r.x - C.spawnX) < 1e-6 && Math.abs(r.z - C.spawnLane) < 1e-6 && r.yaw === 0 && r.v === 0);
      await frames(P, 2);
      await shot('spawn-ngay');
    });

    await section('2 (lái suốt từng trục)', async () => {
      await P.evaluate(installHelpers, C);
      const nBox = await P.evaluate(() => window.__dr.buildBoxes());
      const nHid = await P.evaluate(() => window.__dr.hideTraffic());
      check(`2 oracle nhà: ${nBox} hộp bao nhà (không rỗng), đã ẩn ${nHid} đội xe tự động để không chặn kịch bản`, nBox > 1000 && nHid >= 1);
      const AX = [['dragon', 'dragon.bridge', C.axisX0], ['songHan', 'songHan.swing', C.axisX0], ['ttl', 'ttl.bridge', C.axisX0], ['tunnel', 'tunnel.tube', C.axisX0], ['thuanPhuoc', 'thuanPhuoc.bridge', C.tpX0]];
      for (const [id, padId, x0] of AX) {
        for (const [side, yaw] of [['S', 0], ['N', Math.PI]]) {
          const rect = await P.evaluate((p) => window.__dr.rect(p), `${padId}.${side}`);
          if (!rect) { check(`2 ${id} ${side}: không có ô ${padId}.${side}`, false); continue; }
          const zc = (rect[2] + rect[3]) / 2, xa = x0 + 30, xb = C.axisX1 - 30, dist = xb - xa;
          const start = yaw === 0 ? xa : xb;
          const r = await P.evaluate((o) => window.__dr.run(o), { tag: `${id}.${side}`, x: start, z: zc, yaw, dist, maxT: dist / 12 + 40, vWant: 100, rayAt: [0.25 * dist, 0.5 * dist, 0.75 * dist] });
          check(`2 ${id} ${yaw === 0 ? 'Đông' : 'Tây'} (z ${zc.toFixed(2)}): tới cuối trục ${r.reached} (x ${r.x}, ${r.t.toFixed(0)} s, vmax ${(r.vmax * 3.6).toFixed(0)} km/h), ${r.checks} lần kiểm, ${r.rays} tia, vi phạm ${r.nViol}${r.stuck ? ', kẹt tại ' + r.stuck : ''}${r.viol.length ? ' | ' + r.viol.join(' | ') : ''}`,
            r.reached && r.nViol === 0 && r.checks > 50 && r.rays >= 3);
        }
      }
      // lái theo điểm: Cầu Rồng → bờ Đông → rẽ phải vào đường dọc Đông (nút giao jct.east.dragon) → xuống phía Nam
      const jc = await P.evaluate(() => window.__dr.rect('jct.east.dragon'));
      if (!jc) check('2 nút giao jct.east.dragon không có', false);
      else {
        const xc = (jc[0] + jc[1]) / 2, R = 6, laneZ = 8.6, laneX = xc - 6;   // tim đường dọc Đông, nửa Tây của mặt cắt (mép trong 1,5 / ngoài 10,5)
        const cx = laneX - R, cz = laneZ + R;                                  // cung rẽ phải Đông → Nam: tâm (cx, cz), từ (cx, laneZ) tới (laneX, cz)
        const way = [[C.spawnX + 300, laneZ], [cx - 20, laneZ], ...arc(cx, cz, R, -90, 0, 12), [laneX, cz + 30], [laneX, cz + 80]];
        const r = await P.evaluate((o) => window.__dr.follow(o), { x: C.spawnX + 200, z: laneZ, yaw: 0, wp: way, vWant: 5, maxT: 400 });
        check(`2 lái theo điểm qua chỗ rẽ nút giao Đông (tâm cung ${cx.toFixed(1)}, ${cz.toFixed(1)}): tới đích ${r.done} (điểm ${r.k + 1}/${r.n}, ${r.t} s, kết thúc (${r.x}, ${r.z})), bước thiếu mặt đường ${r.bad}${r.first ? ' đầu tiên tại ' + r.first : ''}`, r.done && r.bad === 0);
      }
      await P.evaluate(() => window.__dr.showTraffic());
    }, 25 * 60 * 1000);

    await section('3 (đâm 100 km/h)', async () => {
      const V = 27.78;
      const cases = [
        ['lan can Cầu Rồng (gờ chắn)', { pad: 'dragon.bridge.S', side: 'z1', yaw: -Math.PI / 2, xc: 0 }],
        ['tường hầm', { pad: 'tunnel.tube.S', side: 'z1', yaw: -Math.PI / 2, xc: 0 }],
        ['thân rồng (về phía dải giữa)', { pad: 'dragon.bridge.S', side: 'z0', yaw: Math.PI / 2, xc: 0 }]
      ];
      for (const [label, c] of cases) {
        const rect = await P.evaluate((p) => window.__dr.rect(p), c.pad);
        if (!rect) { check(`3 ${label}: không có ô ${c.pad}`, false); continue; }
        const zc = (rect[2] + rect[3]) / 2;
        const r = await P.evaluate((o) => window.__dr.crash(o), { pad: c.pad, side: c.side, x: c.xc, z: zc, yaw: c.yaw, v0: V, T: 6 });
        check(`3 ${label}: lấn ra ngoài mép ô ${r.worst} m (≤ 0,01), v cuối ${r.v} m/s (< 0,5), ${r.invalid} bước thân xe thiếu mặt đường, dừng tại (${r.x}, ${r.z})`, !r.err && r.worst <= 0.01 && Math.abs(r.v) < 0.5 && r.invalid === 0);
      }
      const bb = await P.evaluate(() => { const o = window.__app.scene.getObjectByName('dragon-body'); if (!o) return null; const b = new window.__app.THREE.Box3().setFromObject(o); return [b.min.x, b.max.x, b.min.z, b.max.z]; });
      info(`3 hộp bao thân rồng (scene dragon-body): ${bb ? bb.map((v) => v.toFixed(2)).join(', ') : 'không có'} [x0, x1, z0, z1]`);
      if (bb) {
        const rect = await P.evaluate(() => window.__dr.rect('dragon.bridge.S'));
        const zc = (rect[2] + rect[3]) / 2, xc = Math.max(-300, Math.min(300, (bb[0] + bb[1]) / 2));
        const r = await P.evaluate((o) => window.__dr.crash(o), { pad: 'dragon.bridge.S', side: 'z0', x: xc, z: zc, yaw: Math.PI / 2, v0: V, T: 6 });
        check(`3 thân rồng (oracle hộp cảnh): tâm + góc xe không vào hộp bao thân rồng (z nhỏ nhất ${r.minZ} so cạnh z lớn nhất của thân ${bb[3].toFixed(2)})`, !r.err && r.minZ >= Math.min(bb[3], rect[2]) - 0.02);
      }
    });

    await section('4 (gầm Cầu Rồng đóng)', async () => {
      const ids = ['slip.dragon.W.N', 'slip.dragon.W.S', 'jct.dragon.W'];
      const rc = await P.evaluate((l) => l.map((i) => window.__dr.rect(i)), ids);
      const rb = await P.evaluate(() => window.__app.drive.net.pads.filter((p) => p.id.startsWith('bachDang.') && p.id.endsWith('.W') && p.kind === 'road' && p.z0 < -200 && p.z1 > -60).map((p) => [p.x0, p.x1, p.z0, p.z1])[0] || null);
      if (rc.some((r) => !r) || !rb) { check(`4 thiếu ô: ${ids.join(', ')} / bachDang nửa Tây (${JSON.stringify(rc)} ${JSON.stringify(rb)})`, false); return; }
      const [slN, slS, jc] = rc, laneX = (rb[0] + rb[1]) / 2, zN = (slN[2] + slN[3]) / 2, zS0 = slS[2] + 2.5, R = 6, cxL = jc[0] + 2 + R + 1;
      await P.evaluate(() => window.__dr.hideTraffic());
      // 4a: chạy thẳng về phía Nam từ z = −200: bị chặn trước dốc cầu (hố đường ven sông |z| < 21)
      const cr = await P.evaluate((o) => { const D = window.__app.drive; D.placeAt(o.x, -200, -Math.PI / 2); const s = D.state, inp = { gas: 1, brake: 0, steer: 0, hand: false }; let maxZ = -Infinity; for (let i = 0; i < 900; i++) { D.step(0.1, inp); maxZ = Math.max(maxZ, s.z + o.hl); } return { z: s.z, v: s.v, maxZ }; }, { x: laneX, hl: C.length / 2 });
      check(`4a Bạch Đằng về Nam từ z = −200: dừng tại z ${cr.z.toFixed(2)} (mũi tới ${cr.maxZ.toFixed(2)} ≤ −21: trước dốc cầu), v ${cr.v.toFixed(2)}`, cr.maxZ <= -21 + 0.01 && Math.abs(cr.v) < 0.5 && cr.z > -40);
      // 4b: đi vòng bằng nhánh rẽ: Nam → rẽ phải Tây (nhánh N) → rẽ trái Nam qua z = 0 (ô nút giao) → rẽ trái Đông (nhánh S) → rẽ phải Nam
      const wp = [
        [laneX, -80], ...arc(laneX - R, zN - R, R, 0, 90, 12),                  // Nam → Tây, kết thúc (laneX − R, zN)
        [cxL + 12, zN], ...arc(cxL, zN + R, R, -90, -180, 12),                  // Tây → Nam, kết thúc (cxL − R, zN + R)
        [cxL - R, -3], [cxL - R, 3], [cxL - R, zS0 - R],
        ...arc(cxL, zS0 - R, R, 180, 90, 12),                                   // Nam → Đông, kết thúc (cxL, zS0)
        [laneX - R - 4, zS0],
        ...arc(laneX - R, zS0 + R, R, -90, 0, 12),                              // Đông → Nam, kết thúc (laneX, zS0 + R)
        [laneX, 40], [laneX, 80], [laneX, 95]
      ];
      const r = await P.evaluate((o) => window.__dr.follow(o), { x: laneX, z: -200, yaw: -Math.PI / 2, wp, vWant: 5, maxT: 500 });
      check(`4b đi vòng nhánh rẽ qua z = 0 sang z > 60: tới đích ${r.done} (điểm ${r.k + 1}/${r.n}, ${r.t} s, kết thúc (${r.x}, ${r.z})), bước thiếu mặt đường ${r.bad}${r.first ? ' đầu tiên tại ' + r.first : ''}`, r.done && r.z > 60 && r.bad === 0);
      await P.evaluate(() => window.__dr.showTraffic());
    });

    await section('5 (Cầu sông Hàn: sơ tán và barie)', async () => {
      const rect = await P.evaluate(() => window.__dr.rect('songHan.swing.S'));
      if (!rect) { check('5 không có ô songHan.swing.S', false); return; }
      const zc = (rect[2] + rect[3]) / 2;
      const r = await P.evaluate(({ zc, rect }) => {
        const A = window.__app, D = A.drive, ctrl = A.songHan.ctrl, dr = window.__dr;
        dr.hideTraffic();
        const out = {};
        D.placeAt(0, zc, 0);
        const s = D.state;
        const keep = { state: ctrl.state, t: ctrl.t, speed: ctrl.speed };
        ctrl.state = 'STOP_TRAFFIC'; ctrl.t = 0; ctrl.speed = 30;   // ép trạng thái chặn xe: cổng nhịp quay đóng, tốc độ quay 30×
        const inp = { gas: 0, brake: 0, steer: 0, hand: false };
        let steps = 0, started = false;
        for (; steps < 100; steps++) {
          D.step(0.1, inp);
          if (s.evac > 0) started = true;
          if (started && s.evac === 0) { steps++; break; }
        }
        out.started = started; out.steps = steps; out.simT = +(steps * 0.1).toFixed(1);
        out.x = +s.x.toFixed(2); out.z = +s.z.toFixed(2); out.evac = s.evac;
        out.outside = dr.pts(s, 9).every(([x]) => x < rect[0] || x > rect[1]);
        out.fits = dr.pts(s, 9).every(([x, z]) => !Number.isNaN(dr.ground(x, z, s.y)));
        // lái vào barie: đặt cách barie 30 m phía Đông, đi Tây 100 km/h; cổng vẫn đóng
        D.placeAt(rect[1] + 30, zc, Math.PI); s.v = 27.78;
        let minX = Infinity, bad = 0;
        const inp2 = { gas: 1, brake: 0, steer: 0, hand: false };
        for (let i = 0; i < 60; i++) {
          D.step(0.1, inp2);
          for (const [x, z] of dr.pts(s, 5)) { if (x < minX) minX = x; if (x < rect[1] - 0.01 && z > rect[2] && z < rect[3]) bad++; }
        }
        out.barrier = { minX: +minX.toFixed(2), v: +s.v.toFixed(2), bad, edge: rect[1] };
        ctrl.state = keep.state; ctrl.t = keep.t; ctrl.speed = keep.speed;   // trả lại trạng thái
        dr.showTraffic();
        return out;
      }, { zc, rect });
      check(`5 cầu rời CLOSED, xe trên nhịp quay: sơ tán bắt đầu ${r.started}, xong sau ${r.simT} s mô phỏng (≤ 1 s ở quay 30×), ra tới (${r.x}, ${r.z}) ngoài ô nhịp quay |x| ≤ ${rect[1]}: ${r.outside}, thân xe đủ mặt đường ${r.fits}`, r.started && r.simT <= 1.0 && r.evac === 0 && r.outside && r.fits);
      check(`5 lái 100 km/h vào barie (cổng đóng): mũi xe dừng ở x ${r.barrier.minX} (≥ mép ô nhịp ${r.barrier.edge}), v ${r.barrier.v}, ${r.barrier.bad} điểm lọt vào nhịp`, r.barrier.bad === 0 && r.barrier.minX >= r.barrier.edge - 0.01 && Math.abs(r.barrier.v) < 0.5);
    });

    await section('6 (trong hầm)', async () => {
      await P.evaluate(() => { const A = window.__app; A.dayNight.target = 0; A.dayNight.night = 0; });
      const rect = await P.evaluate(() => window.__dr.rect('tunnel.tube.S'));
      const zc = (rect[2] + rect[3]) / 2;
      await P.evaluate(({ zc }) => { const D = window.__app.drive; D.placeAt(0, zc, 0); D.step(0.1, { gas: 0, brake: 0, steer: 0, hand: false }); for (let i = 0; i < 20; i++) D.step(0.1, { gas: 0, brake: 0, steer: 0, hand: false }); }, { zc });
      await frames(P, 4);
      const cs = []; for (let i = 0; i < 3; i++) { await frames(P, 1); cs.push(await P.evaluate(() => window.__app.renderer.info.render.calls)); }
      cs.sort((x, y) => x - y); const calls = cs[1];
      const b64 = (await P.screenshot(SHOTS ? { path: `${SCREENS}drive-check-ham.png` } : {})).toString('base64');
      const f = await P.evaluate(async (b) => {
        const bm = await createImageBitmap(await (await fetch(`data:image/png;base64,${b}`)).blob());
        const c = new OffscreenCanvas(bm.width, bm.height), g = c.getContext('2d'); g.drawImage(bm, 0, 0);
        const w = bm.width, h = bm.height, x0 = Math.floor(w * 0.25), d = g.getImageData(x0, 0, w - x0, Math.floor(h * 0.4)).data;   // bỏ bản đồ nhỏ (trái) và thân xe (dưới 46 % khung): chúng màu xanh lục
        let water = 0, n = 0, sky = 0;
        for (let i = 0; i < d.length; i += 4) { const r = d[i], gg = d[i + 1], bb = d[i + 2]; n++; if (gg - r > 20 && bb - r > 15 && gg > 50 && gg < 200 && Math.abs(gg - bb) < 35) water++; if (bb > 170 && gg > 150 && r > 120) sky++; }
        return { water, n, sky, w, h };
      }, b64);
      check(`6 trong hầm: ${f.water}/${f.n} điểm ảnh màu nước ở nửa trên khung (${(100 * f.water / f.n).toFixed(2)} %, ngưỡng < 0,5 %); điểm trời ${f.sky}; lệnh vẽ trong hầm ${calls}`, f.n > 1000 && f.water / f.n < 0.005);
      info(`6 lệnh vẽ trong hầm (ban ngày, 640×360, ?test): ${calls}`);
    });

    await section('7 (đèn xe)', async () => {
      // chờ xe thật (vật liệu đèn có userData.lampBrake) thay hình tạm
      await P.evaluate(() => { const D = window.__app.drive; D.placeAt(-150, 8.625, 0); });
      const lampsFn = () => {
        const A = window.__app, g = A.scene.getObjectByName('drive-cars'), out = [];
        if (!g) return out;
        g.traverse((o) => { if (o.isMesh && !o.isInstancedMesh && o.material && o.material.userData && o.material.userData.lampBrake !== undefined) out.push({ name: o.material.name, brake: o.material.userData.lampBrake, emi: o.material.emissive.r + o.material.emissive.g + o.material.emissive.b, map: !!o.material.emissiveMap, k: o.material.emissiveIntensity }); });
        return out;
      };
      await P.waitForFunction(`(${lampsFn.toString()})().length > 0`, null, { polling: 2000, timeout: 180000 });
      const read = async () => P.evaluate(lampsFn);
      const night = (v) => P.evaluate((v) => { const A = window.__app; A.dayNight.target = v; A.dayNight.night = v; }, v);
      const eff = (m, u) => (m.emi > 0 || m.map) ? Math.max(Math.min(1, Math.max(0, u)) * (m.name === 'lamp_head' ? C.headNight : C.tailNight), m.brake) : 0;
      const brakeNow = (on) => P.evaluate((on) => { const D = window.__app.drive; D.state.v = on ? 10 : 0; D.step(0.05, { gas: 0, brake: on ? 1 : 0, steer: 0, hand: false }); return D.state.braking; }, on);
      await night(0); await frames(P, 3);
      await brakeNow(false);
      const uDay = await P.evaluate(() => window.__app.shared.uNight.value);
      const day = await read();
      const head = day.filter((m) => m.name === 'lamp_head'), tail = day.filter((m) => m.name === 'lamp_tail');
      check(`7 xe thật: có vật liệu đèn pha (${head.length}) và đèn hậu (${tail.length}), đều có emissive hoặc emissiveMap: ${[...head, ...tail].every((m) => m.emi > 0 || m.map)}`, head.length >= 1 && tail.length >= 1 && [...head, ...tail].every((m) => m.emi > 0 || m.map));
      check(`7 ban ngày (uNight ${uDay.toFixed(2)}), không phanh: đèn pha ${head.map((m) => eff(m, uDay)).join('/')} = 0, đèn hậu ${tail.map((m) => eff(m, uDay)).join('/')} = 0`, uDay < 0.01 && head.every((m) => eff(m, uDay) === 0) && tail.every((m) => eff(m, uDay) === 0));
      await night(1); await frames(P, 3);
      const uNight = await P.evaluate(() => window.__app.shared.uNight.value);
      const nt = await read();
      check(`7 ban đêm (uNight ${uNight.toFixed(2)}): đèn pha ${nt.filter((m) => m.name === 'lamp_head').map((m) => eff(m, uNight).toFixed(2)).join('/')} > 0, đèn hậu ${nt.filter((m) => m.name === 'lamp_tail').map((m) => eff(m, uNight).toFixed(2)).join('/')} > 0`, uNight > 0.99 && nt.filter((m) => m.name === 'lamp_head').every((m) => eff(m, uNight) > 0) && nt.filter((m) => m.name === 'lamp_tail').every((m) => eff(m, uNight) > 0));
      await shot('dem-den');
      await night(0); await frames(P, 3);
      // bước và đọc trong cùng một lần evaluate: khung thật xen vào giữa sẽ nhả phanh
      const bres = await P.evaluate(`(() => { const D = window.__app.drive; D.state.v = 10; D.step(0.05, { gas: 0, brake: 1, steer: 0, hand: false }); return { braking: D.state.braking, lamps: (${lampsFn.toString()})() }; })()`);
      const braking = bres.braking, bt = bres.lamps;
      const tb = bt.filter((m) => m.name === 'lamp_tail');
      check(`7 phanh (state.braking ${braking}) ban ngày: vật liệu đèn hậu đang dùng có hệ số phanh ${tb.map((m) => m.brake).join('/')} (= ${C.tailBrake}) nên sáng ${tb.map((m) => eff(m, 0).toFixed(2)).join('/')} > 0`, braking === true && tb.length >= 1 && tb.every((m) => Math.abs(m.brake - C.tailBrake) < 1e-6 && eff(m, 0) > 0));
      await brakeNow(false);
      const rel = (await read()).filter((m) => m.name === 'lamp_tail');
      check(`7 nhả phanh: đèn hậu về ${rel.map((m) => eff(m, 0)).join('/')} = 0`, rel.length >= 1 && rel.every((m) => eff(m, 0) === 0));
    });

    await section('9 (HUD)', async () => {
      await P.evaluate(() => { const D = window.__app.drive; D.placeAt(-150, 8.625, 0); });
      const r = await P.evaluate(async () => {
        const D = window.__app.drive, out = [];
        for (const v of [0, 7.3, 13.9, 27.78, -3.2]) {
          D.state.v = v; D.step(0.1, { gas: v < 0 ? 0 : 1, brake: 0, steer: 0, hand: false });
          out.push({ v: D.state.v, txt: document.getElementById('drKmh').textContent });
        }
        return out;
      });
      check(`9 số km/h khớp |v| · 3,6 sau mỗi bước: ${r.map((o) => `${o.v.toFixed(2)} m/s → ${o.txt}`).join('; ')}`, r.every((o) => o.txt === String(Math.round(Math.abs(o.v) * 3.6))));
      await sleep(400);
      await P.evaluate(() => { const D = window.__app.drive; D.state.v = 0; D.step(0.1, { gas: 0, brake: 0, steer: 0, hand: false }); });
      const m = await P.evaluate(() => {
        const c = document.getElementById('drMap'), g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height).data, cols = new Set();
        let tunnel = 0;
        for (let i = 0; i < d.length; i += 4) { cols.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]); if (Math.abs(d[i] - 224) < 14 && Math.abs(d[i + 1] - 138) < 14 && Math.abs(d[i + 2] - 60) < 14) tunnel++; }
        return { w: c.width, h: c.height, colors: cols.size, tunnel, shown: c.getClientRects().length > 0 };
      });
      check(`9 bản đồ nhỏ ${m.w}×${m.h} hiện ${m.shown}: ${m.colors} màu, ${m.tunnel} điểm màu ô hầm (có chấm / ô vẽ)`, m.shown && m.w > 50 && m.h > 50 && m.colors >= 5 && m.tunnel > 0);
      const ids = { drHint: '#drHint', drSpeedUnit: '#drSpeedUnit', drMapTunnel: '#drMapNote', drGas: '#drGas', drBrake: '#drBrake' };
      const seen = {};
      for (const lang of LANGS) {
        await pick(P, '#langSelect', lang); await frames(P, 1);
        const t = await P.evaluate((ids) => Object.fromEntries(Object.entries(ids).map(([k, s]) => [k, document.querySelector(s).textContent.trim()])), ids);
        seen[lang] = t;
      }
      const bad = [];
      for (const lang of LANGS) for (const k of Object.keys(ids)) if (seen[lang][k] !== LOC[lang][k].trim()) bad.push(`${lang}.${k}`);
      check(`9 9 ngôn ngữ đổi chữ HUD (hint, đơn vị, chú thích Hầm, GA, PHANH) khớp locale (lệch: ${bad.join(',') || '-'})`, bad.length === 0);
      const diff = new Set(LANGS.map((l) => seen[l].drHint)).size;
      check(`9 chữ gợi ý khác nhau giữa các ngôn ngữ (${diff}/9 bản khác nhau)`, diff >= 8);
      await pick(P, '#langSelect', 'ar'); await frames(P, 1);
      const ar = await P.evaluate(() => ({ dir: document.documentElement.dir, hud: getComputedStyle(document.getElementById('drHud')).direction, attr: document.getElementById('drHud').dir, tunnel: document.getElementById('drMapNote').textContent.trim() }));
      check(`9 ar: html dir ${ar.dir} (rtl), #drHud direction ${ar.hud} (ltr, bàn đạp / cần gạt không lật), chú thích Hầm "${ar.tunnel}" có chữ`, ar.dir === 'rtl' && ar.hud === 'ltr' && ar.attr === 'ltr' && ar.tunnel.length > 3);
      await pick(P, '#langSelect', 'vi'); await frames(P, 1);
      info('9 bàn đạp cảm ứng (GA / PHANH / cần gạt) ẩn trên máy tính; bố cục cảm ứng và ar kiểm ở test:mobile mục 7');
    });

    allErrors.push(['A', A.errors]);
    await P.close();
  }

  /* ---------------- Trang B: ?chooser → thẻ Ô tô ---------------- */
  await section('1 (thẻ Ô tô, trang B)', async () => {
    const B = await openApp(browser, srv.url + '?chooser', { width: 640, height: 360 });
    B.page.setDefaultTimeout(300000);
    try {
      await B.page.waitForSelector('#chooser', { state: 'visible', timeout: 300000 });
      const card = await B.page.evaluate(() => { const b = document.querySelector('#chooser [data-pick="car"]'); return b ? { disabled: b.disabled, txt: b.textContent } : null; });
      check(`1 thẻ Ô tô (data-pick="car") có, không khóa, chữ "${card && card.txt.trim().slice(0, 40)}" chứa "${LOC.vi.exCar}"`, !!card && !card.disabled && card.txt.includes(LOC.vi.exCar));
      await B.page.click('#chooser [data-pick="car"]');
      await B.page.waitForFunction(() => document.body.classList.contains('drive') && window.__app.cam.mode === 'car' && window.__app.drive.state, null, { polling: 500 });
      const r = await B.page.evaluate(() => { const A = window.__app, s = A.drive.state; return { explore: document.body.classList.contains('explore'), x: s.x, z: s.z, yaw: s.yaw, hid: document.getElementById('chooser').hidden }; });
      check(`1 bấm thẻ Ô tô: body.explore + body.drive, hộp chọn đóng ${r.hid}, xe ở (${r.x}, ${r.z}) hướng ${r.yaw}`, r.explore && r.hid && Math.abs(r.x - C.spawnX) < 1e-6 && Math.abs(r.z - C.spawnLane) < 1e-6 && r.yaw === 0);
    } finally { allErrors.push(['B', B.errors]); await B.page.close(); }
  }, 12 * 60 * 1000);

  /* ---------------- Trang C: chặn vf3.glb ---------------- */
  await section('8a (chặn vf3.glb)', async () => {
    const C8 = await openApp(browser, srv.url + '?explore=drive', { width: 480, height: 270, before: (pg) => pg.route('**/car/vf3.glb', (r) => r.abort()) });
    C8.page.setDefaultTimeout(300000);
    try {
      await C8.page.waitForFunction(() => window.__app.drive.state, null, { polling: 500 });
      await sleep(12000);   // quá model.timeoutMs (8 s): bộ nạp đã bỏ
      const r = await C8.page.evaluate(() => {
        const A = window.__app, D = A.drive, g = A.scene.getObjectByName('drive-cars'), s = D.state;
        const car = g && g.children.find((c) => c.name === 'drive-car');
        let real = false; if (car) car.traverse((o) => { if (o.isMesh && o.material && o.material.userData && o.material.userData.lampBrake !== undefined) real = true; });
        for (const f of A.traffic.fleets()) f.mesh.visible = false;   // xe tự động không chặn kịch bản
        const x0 = s.x; for (let i = 0; i < 100; i++) D.step(0.1, { gas: 1, brake: 0, steer: 0, hand: false });
        return { car: !!car, real, meshes: car ? car.children.length : 0, moved: s.x - x0, v: s.v, py: car ? car.position.x : null, sx: s.x, visible: !!car && car.visible && !!g.parent };
      });
      check(`8a vf3.glb bị chặn: xe hiện bằng hình tạm (có nhóm xe ${r.car}, ${r.meshes} con, mô hình thật ${r.real}), lái được (dời ${r.moved.toFixed(1)} m, v ${r.v.toFixed(1)}), xe trong cảnh ${r.visible} theo sát trạng thái (${r.py && r.py.toFixed(1)} so ${r.sx.toFixed(1)})`, r.car && !r.real && r.meshes >= 1 && r.moved > 30 && r.visible && Math.abs(r.py - r.sx) < 0.01);
      await frames(C8.page, 2);
      check('8a không lỗi console khi chặn vf3.glb', C8.errors.length === 0);
      if (C8.errors.length) console.log(C8.errors.join('\n'));
    } finally { await C8.page.close(); }
  }, 12 * 60 * 1000);

  /* ---------------- Trang D: vf3.glb chậm ---------------- */
  await section('8b (vf3.glb chậm 12 s)', async () => {
    let release; const gate = new Promise((r) => { release = r; });
    const D8 = await openApp(browser, srv.url + '?explore=drive', { width: 480, height: 270, before: (pg) => pg.route('**/car/vf3.glb', async (r) => { await gate; try { await r.continue(); } catch { /* trang đã đóng */ } }) });
    D8.page.setDefaultTimeout(300000);
    try {
      await D8.page.waitForFunction(() => window.__app.drive.state, null, { polling: 500 });
      const probe = () => D8.page.evaluate(() => {
        const A = window.__app, g = A.scene.getObjectByName('drive-cars'), s = A.drive.state;
        const car = g && g.children.find((c) => c.name === 'drive-car');
        let real = false; if (car) car.traverse((o) => { if (o.isMesh && o.material && o.material.userData && o.material.userData.lampBrake !== undefined) real = true; });
        return { car: !!car, real, x: car ? car.position.x : null, z: car ? car.position.z : null, sx: s.x, sz: s.z };
      });
      const t0 = Date.now();
      const early = await probe();
      await sleep(Math.max(0, 12000 - (Date.now() - t0)));
      const mid = await probe();
      check(`8b trong lúc tải chậm (≈ 12 s): xe hiện bằng hình tạm (có xe ${mid.car}, mô hình thật ${mid.real}), tại (${mid.x}, ${mid.z}) = trạng thái (${mid.sx}, ${mid.sz})`, early.car && !early.real && mid.car && !mid.real && Math.abs(mid.x - mid.sx) < 0.01);
      release();
      await D8.page.waitForFunction(() => { const g = window.__app.scene.getObjectByName('drive-cars'); let real = false; if (g) g.traverse((o) => { if (o.isMesh && o.material && o.material.userData && o.material.userData.lampBrake !== undefined) real = true; }); return real; }, null, { polling: 2000, timeout: 240000 });
      const late = await probe();
      check(`8b tải xong: đổi sang mô hình thật (${late.real}), vị trí không nhảy (${late.x}, ${late.z}) = (${late.sx}, ${late.sz})`, late.real && Math.abs(late.x - late.sx) < 0.01 && Math.abs(late.z - late.sz) < 0.01);
      check('8b không lỗi console', D8.errors.length === 0);
      if (D8.errors.length) console.log(D8.errors.join('\n'));
    } finally { release(); await D8.page.close(); }
  }, 12 * 60 * 1000);

  /* ---------------- Trang F: ?test thường — lệnh vẽ, thoát lái, Đi dạo ---------------- */
  await section('10 + 11 (lệnh vẽ, thoát lái, Đi dạo)', async () => {
    const F = await openApp(browser, srv.url);
    F.page.setDefaultTimeout(300000);
    try {
      const P = F.page;
      const calls = async () => { const xs = []; for (let i = 0; i < 5; i++) { await frames(P, 1); xs.push(await P.evaluate(() => window.__app.renderer.info.render.calls)); } xs.sort((a, b) => a - b); return xs[2]; };
      await P.evaluate(() => { const A = window.__app; A.dayNight.target = 0; A.dayNight.night = 0; });
      await frames(P, 3);
      await pickView(P, 'dragon', 'overview');
      await frames(P, 4);
      const base = await calls();
      const kq = rd('./KET-QUA.md').match(/\|\s*overview\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|/);
      const mainDay = kq ? Number(kq[1]) : NaN;
      check(`11 góc mặc định overview, ban ngày, không lái: ${base} lệnh vẽ, mốc main trong tests/KET-QUA.md (bản 113b313) ${mainDay}`, base === mainDay);
      if (base !== mainDay) info(`11 lệnh vẽ lệch mốc: đo ${base} so mốc ${mainDay}; mốc ghi ở bản 113b313, trước D-030 / D-032 (người đi bộ) nên có thể đã cũ`);
      const far0 = await P.evaluate(() => window.__app.hr.farDistance);
      await P.evaluate(() => window.__app.drive.start());
      await frames(P, 4);
      const withCar = await calls();
      const far1 = await P.evaluate(() => window.__app.hr.farDistance);
      const hrVis = await P.evaluate(() => window.__app.hr.group.visible);
      check(`11 vào lái một mình (xe ở chỗ xuất phát): ${withCar} lệnh vẽ, tăng ${withCar - base} so ${base} (mỗi xe ≤ 6)`, withCar - base <= 6);
      info(`11 lệnh vẽ khi lái một mình: ${withCar} (không lái ${base}); Hầm hiện ${hrVis}, ngưỡng xa của Hầm ${far0} → ${far1}`);
      check(`10 đang lái: ngưỡng xa của Hầm nới ×${C.tunnelFar} (${far0} → ${far1})`, Math.abs(far1 / far0 - C.tunnelFar) < 1e-6);
      await P.evaluate(() => window.__app.drive.stop());
      await frames(P, 3);
      await P.evaluate(() => window.__app.stroll.stroll.start());
      await P.waitForFunction(() => window.__app.cam.mode === 'stroll' && window.__app.stroll.stroll.state, null, { polling: 500 });
      await frames(P, 4);
      const r = await P.evaluate(() => {
        const A = window.__app, S = A.stroll, st = S.stroll.state, hud = document.getElementById('drHud'), g = A.scene.getObjectByName('drive-cars');
        return { drive: document.body.classList.contains('drive'), hud: hud.getClientRects().length, stroll: document.body.classList.contains('stroll'), far: A.hr.farDistance, cars: g ? !!g.parent : false,
          valid: S.stValid(S.stroll.map, st.x, st.z, 0), x: st.x, z: st.z, mode: A.cam.mode };
      });
      check(`10 thoát lái rồi vào Đi dạo: body.drive ${r.drive} (false), #drHud ${r.hud} hộp (0), body.stroll ${r.stroll}, nhóm xe còn trong cảnh ${r.cars} (false), ngưỡng xa Hầm ${r.far} = ${far0}, đi dạo ở (${r.x.toFixed(1)}, ${r.z.toFixed(1)}) hợp lệ ${r.valid}`,
        !r.drive && r.hud === 0 && r.stroll && !r.cars && r.far === far0 && r.valid && r.mode === 'stroll');
      allErrors.push(['F', F.errors]);
    } finally { await F.page.close(); }
  }, 20 * 60 * 1000);

  for (const [name, errs] of allErrors) {
    check(`console sạch (trang ${name}, ${errs.length} lỗi)`, errs.length === 0);
    if (errs.length) console.log(errs.join('\n'));
  }
} catch (e) {
  check('ngoại lệ ngoài mục: ' + String(e && e.message || e), false);
} finally {
  try { await browser.close(); } catch { /* bỏ qua */ }
  srv.close();
}
console.log(problems.length ? `drive-check: LỖI (${problems.length}): ${problems.join('; ')}` : 'drive-check: đạt');
process.exit(problems.length ? 1 : 0);
