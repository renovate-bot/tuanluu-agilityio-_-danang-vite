/* ===== Đi dạo: test chuyển động nhân vật (src/explore/stroll/motion.ts) =====
   Bản đồ thật (stBuildStaticMap) cộng 300 nhà chữ nhật giả sinh bằng rng trong hai vùng bờ. Fuzz 300 000 khung kiểm điểm cuối bằng oracle viết riêng ở đây
   (quét tuyến tính mọi vùng / vật cản cao, không dùng lưới của map.ts). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../src/config.ts';
import { rng } from '../../src/common/math.ts';
import { deckY } from '../../src/bridges/dragon/profile.ts';
import { SH } from '../../src/bridges/song-han/profile.ts';
import { stValid, stSetGate, stAddSolids, stGroundY, type StMap, type StSolid } from '../../src/explore/stroll/map.ts';
import { ST_GATE_SWING, stBuildStaticMap, stSpawn } from '../../src/explore/stroll/mapData.ts';
import { stCreate, stStep, stPhotoPose, type StState, type StInput } from '../../src/explore/stroll/motion.ts';

const C = CONFIG.stroll, R = C.radius, SHZ = CONFIG.songHan.z;
const DT = 1 / 60;

/* bản đồ có nhà giả: mỗi lần gọi dựng mới (cổng đóng / mở không dây sang test khác) */
function makeMap(): StMap {
  const map = stBuildStaticMap();
  const r = rng(4242), sp = { x: 0, z: 0 }, houses: StSolid[] = [];
  stSpawn(map, -1, sp);
  for (let i = 0; i < 300; i++) {
    const west = r() < 0.5, x0 = (west ? -1 : 1) * (270 + r() * 120), z0 = -1290 + r() * 1500, w = 8 + r() * 30, d = 8 + r() * 30;
    const h: StSolid = { kind: 'rect', x0: west ? x0 - w : x0, x1: west ? x0 : x0 + w, z0, z1: z0 + d };
    if (h.z1 > -22 && h.z0 < 22 || h.z1 > SHZ - 10 && h.z0 < SHZ + 10) continue;   // nhà thật không đè đường nối cầu
    if (sp.x > h.x0 - 3 && sp.x < h.x1 + 3 && sp.z > h.z0 - 3 && sp.z < h.z1 + 3) continue;   // bỏ nhà đè điểm xuất phát
    houses.push(h);
  }
  stAddSolids(map, houses);
  return map;
}
const IDLE: StInput = { mx: 0, mz: 0, run: false, jump: false, camYaw: 0 };
const inp = (o: Partial<StInput>): StInput => ({ ...IDLE, ...o });
function at(map: StMap, x: number, z: number): StState {
  const s = stCreate(map, -1); s.x = x; s.z = z; s.y = stGroundY(map, x, z); return s;
}

test('đi thẳng 10 s: đi 3,5 m/s, chạy 10 m/s', () => {
  for (const run of [false, true]) {
    const map = makeMap(), s = stCreate(map, -1), x0 = s.x;
    for (let i = 0; i < 600; i++) stStep(s, inp({ mz: 1, run }), map, DT);
    const v = run ? C.run : C.walk;
    assert.ok(Math.abs(s.speed - v) <= (run ? 0.1 : 0.05), `tốc độ ${s.speed}`);
    assert.ok(Math.abs(s.x - x0 - 10 * v) <= (run ? 2 : 1.5), `quãng đường ${s.x - x0}`);
  }
});

test('hướng theo camYaw', () => {
  const map = makeMap();
  let s = at(map, 0, 17.4);
  for (let i = 0; i < 30; i++) stStep(s, inp({ mz: 1, camYaw: 0 }), map, DT);
  assert.ok(s.x > 1 && Math.abs(s.z - 17.4) < 0.01, 'camYaw 0, tới → x tăng');
  s = at(map, 0, 0 + 3.5);   // dải phân cách có thân rồng chỉ ở đầu / cuối: x = 0 trống
  const z0 = s.z;
  for (let i = 0; i < 30; i++) stStep(s, inp({ mz: 1, camYaw: Math.PI / 2 }), map, DT);
  assert.ok(s.z < z0 - 1, 'camYaw π/2, tới → z giảm');
  s = at(map, 0, 17.4); const z1 = s.z;
  for (let i = 0; i < 30; i++) stStep(s, inp({ mx: 1, camYaw: 0 }), map, DT);
  assert.ok(s.z > z1 + 0.1, 'camYaw 0, sang phải → z tăng (lề hẹp, bị lan can chặn)');
  s = at(map, 0, 5); const z2 = s.z;
  for (let i = 0; i < 30; i++) stStep(s, inp({ mx: 1, camYaw: 0 }), map, DT);
  assert.ok(s.z > z2 + 1, 'camYaw 0, sang phải → z tăng (chỗ rộng)');
});

test('nhảy: đỉnh 1,2 m, pose 3 trên không, giữ nút không nhảy lần hai', () => {
  const map = makeMap(), s = at(map, 0, 5), g = s.y;
  let peak = 0, airFrames = 0, landed = -1;
  for (let i = 0; i < 120; i++) {
    stStep(s, inp({ jump: true }), map, 1 / 120);
    peak = Math.max(peak, s.y - g);
    if (s.air) { airFrames++; assert.equal(s.pose, 3); }
    else if (landed < 0 && i > 2) landed = i;
  }
  assert.ok(Math.abs(peak - C.jumpHeight) <= 0.05, `đỉnh ${peak}`);
  assert.ok(airFrames > 0);
  /* một cú nhảy: thời gian bay = 2 v / g ≈ 0,69 s = 83 khung; sau đó (còn giữ) mới nhảy lần nữa, không có đỉnh thứ hai trước khi chạm */
  const s2 = at(map, 0, 5); let rises = 0, prevVy = 0, hit = false;
  for (let i = 0; i < 80; i++) {
    stStep(s2, inp({ jump: true }), map, 1 / 120);
    if (s2.vy > prevVy + 1e-9) rises++;
    prevVy = s2.vy; if (!s2.air) hit = true;
  }
  assert.equal(rises, 1, 'vy chỉ tăng đúng một lần (lúc bật)');
  assert.ok(!hit, 'chưa chạm đất trong 80 khung 1/120 s');
});

test('cao độ: đi dọc Cầu Rồng bám mặt cầu + bậc', () => {
  const map = makeMap(), s = at(map, -300, 17.4);
  let worst = 0, minx = s.x;
  for (let i = 0; i < 6000 && s.x < 300; i++) {
    stStep(s, inp({ mz: 1, run: true }), map, DT);
    const ground = stGroundY(map, s.x, s.z);
    worst = Math.max(worst, Math.abs(s.y - ground));
    assert.ok(Math.abs(s.y - (deckY(s.x) + (Math.abs(s.z) <= 3 ? 0.3 : Math.abs(s.z) < 16.075 ? 0.02 : 0.25))) <= 0.02, `x=${s.x}`);
  }
  assert.ok(s.x >= 300, `đi tới x ${s.x}`);
  assert.ok(worst <= 0.02);
});

test('pose: 0 đứng, 1 đi, 2 chạy, 4 chụp ảnh rồi hết photoHold về 0', () => {
  const map = makeMap(), s = at(map, 0, 17.4);
  stStep(s, IDLE, map, DT); assert.equal(s.pose, 0);
  for (let i = 0; i < 40; i++) stStep(s, inp({ mz: 1 }), map, DT);
  assert.equal(s.pose, 1);
  for (let i = 0; i < 60; i++) stStep(s, inp({ mz: 1, run: true }), map, DT);
  assert.equal(s.pose, 2);
  for (let i = 0; i < 60; i++) stStep(s, IDLE, map, DT);
  assert.equal(s.pose, 0);
  stPhotoPose(s); assert.equal(s.photo, C.photoHold);
  stStep(s, IDLE, map, DT); assert.equal(s.pose, 4);
  for (let i = 0; i < Math.ceil(C.photoHold / DT) + 2; i++) stStep(s, IDLE, map, DT);
  assert.equal(s.pose, 0); assert.equal(s.photo, 0);
});

test('dt = 2 s lúc chạy vào lan can Cầu Rồng: không vọt xa, không lọt', () => {
  const map = makeMap(), s = at(map, 0, 17.4);
  for (let i = 0; i < 60; i++) stStep(s, inp({ mx: 1, run: true, camYaw: 0 }), map, DT);   // chạy sang phải = +z, tới lan can phía Nam
  const before = { x: s.x, z: s.z };
  stStep(s, inp({ mx: 1, run: true }), map, 2);
  assert.ok(Math.hypot(s.x - before.x, s.z - before.z) <= C.run * C.dtMax + 0.01);
  assert.ok(stValid(map, s.x, s.z, 0));
  /* chạy thẳng dọc, rồi một khung 2 s đâm vào mép đầu cầu: vẫn hợp lệ */
  const t = at(map, 0, 17.4);
  for (let i = 0; i < 90; i++) stStep(t, inp({ mz: 1, run: true, camYaw: 0 }), map, DT);
  for (let k = 0; k < 5; k++) { const p = { x: t.x, z: t.z }; stStep(t, inp({ mz: 1, mx: 1, run: true, camYaw: 0 }), map, 2); assert.ok(Math.hypot(t.x - p.x, t.z - p.z) <= C.run * C.dtMax + 0.01); assert.ok(stValid(map, t.x, t.z, Infinity)); }
});

test('gờ chắn xe Cầu Rồng: đi ngang bị chặn, chạy + nhảy thì qua', () => {
  const map = makeMap();
  /* từ lề Nam (z 17,4) đi về dải Bắc (−z): camYaw π/2 → tới = −z */
  let s = at(map, 100, 17.4);
  for (let i = 0; i < 120; i++) stStep(s, inp({ mz: 1, camYaw: Math.PI / 2 }), map, DT);
  assert.ok(s.z > 16.25, `đi bị gờ chặn, z = ${s.z}`);
  s = at(map, 100, 17.4);
  let crossed = false, jumped = false;
  for (let i = 0; i < 90; i++) {
    stStep(s, inp({ mz: 1, run: true, camYaw: Math.PI / 2, jump: !jumped && i >= 3 }), map, DT);
    if (s.air) jumped = true;
    if (s.z < 15.5) { crossed = true; break; }
  }
  assert.ok(crossed, `chạy + nhảy qua gờ, z = ${s.z}`);
});

test('đóng cổng shSwing dưới chân: sơ tán về nhịp cố định rồi trả điều khiển', () => {
  const map = makeMap(), s = at(map, 5, SHZ + 3);
  assert.ok(stValid(map, s.x, s.z, 0));
  stSetGate(map, ST_GATE_SWING, true);
  let frames = 0, prev = { x: s.x, z: s.z }, evacSeen = false;
  const dt = 1 / 30;
  while (frames < 300) {
    stStep(s, inp({ mz: -1, camYaw: 0 }), map, dt);   // đầu vào ngược chiều: phải bị bỏ qua khi sơ tán
    const d = Math.hypot(s.x - prev.x, s.z - prev.z);
    assert.ok(d <= C.run * dt + 0.01, `bước ${d}`);
    prev = { x: s.x, z: s.z }; frames++;
    if (s.evac) evacSeen = true;
    if (evacSeen && !s.evac) break;
  }
  assert.ok(evacSeen);
  assert.ok(!s.evac, 'xong sơ tán');
  assert.ok(frames * dt <= 8, `mất ${frames * dt} s`);
  assert.ok(Math.abs(s.x) >= SH.fixedStart - 1e-9, `x = ${s.x}`);
  assert.ok(stValid(map, s.x, s.z, 0));
  for (let i = 0; i < 30; i++) stStep(s, inp({ mz: 1, camYaw: 0 }), map, dt);
  assert.ok(!s.evac && s.speed > 1, 'đầu vào có tác dụng lại');
});

/* ---- fuzz ---- */
const BRIDGE = new Set(['shSwing', 'songHanW', 'songHanE', 'dragon', 'love']);
function oracle(map: StMap, x: number, z: number): string | null {
  let zone: string | null = null;
  for (const zn of map.zones) {
    if (zn.gate && map.closed.has(zn.gate)) continue;
    if (x >= zn.x0 && x <= zn.x1 && z >= zn.z0 && z <= zn.z1) { zone = zn.id; if (BRIDGE.has(zn.id)) break; }
  }
  if (zone === null) return 'ngoài vùng mở';
  if (!BRIDGE.has(zone) && Math.abs(x) < 262 - R) return 'giữa sông ngoài cầu';
  const B = C.bounds;
  if (x < B.x0 || x > B.x1 || z < B.z0 || z > B.z1) return 'ngoài bounds';
  for (const s of map.solids) {
    if (s.top !== undefined) continue;
    let d: number;
    if (s.kind === 'circle') d = Math.hypot(x - s.cx, z - s.cz) - s.r;
    else { const dx = Math.max(s.x0 - x, 0, x - s.x1), dz = Math.max(s.z0 - z, 0, z - s.z1); d = Math.hypot(dx, dz); }
    if (d < R - 1e-6) return 'gần vật cản cao';
  }
  return null;
}

test('fuzz 300 000 khung: không lọt tường, không ra khỏi vùng', () => {
  const map = makeMap(), r = rng(99), starts: [number, number][] = [[-240, 17.4], [0, 5], [100, -5], [-100, 3.5], [200, 17], [-5, SHZ + 2], [100, SHZ - 3], [-150, SHZ], [300, SHZ + 1], [250, -78]];
  while (starts.length < 20) {
    const x = (r() * 2 - 1) * 400, z = -1300 + r() * 1520;
    if (stValid(map, x, z, 0) && stGroundY(map, x, z) === stGroundY(map, x, z)) starts.push([x, z]);
  }
  const per = 15000;
  let viol = 0, total = 0, airN = 0, runN = 0;
  for (const [sx, sz] of starts) {
    const s = at(map, sx, sz);
    assert.equal(oracle(map, s.x, s.z), null, `điểm xuất phát ${sx},${sz}`);
    const i2: StInput = { mx: 0, mz: 0, run: false, jump: false, camYaw: 0 };
    let left = 0;
    for (let f = 0; f < per; f++) {
      if (left <= 0) {
        left = 0.2 + r() * 1.8;
        const a = r() * Math.PI * 2, m = r() < 0.15 ? 0 : 0.3 + 0.7 * r();
        i2.mx = Math.cos(a) * m; i2.mz = Math.sin(a) * m; i2.run = r() < 0.5; i2.camYaw = r() * 6.28 - 3.14; i2.jump = r() < 0.3;
      }
      const dt = 1 / 120 + r() * (0.5 - 1 / 120) * (r() < 0.1 ? 1 : 0.05);
      left -= dt; if (r() < 0.2) i2.jump = r() < 0.3;
      stStep(s, i2, map, dt);
      total++; if (s.air) airN++; if (s.pose === 2) runN++;
      const v = oracle(map, s.x, s.z);
      if (v && viol++ < 5) console.log('vi phạm:', v, s.x, s.z, 'từ', sx, sz, 'khung', f);
    }
  }
  assert.equal(total, 300000);
  assert.ok(airN > 10000 && runN > 10000, `fuzz phải có nhảy và chạy: nhảy ${airN}, chạy ${runN}`);
  assert.equal(viol, 0);
});
