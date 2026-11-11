/* ===== Đi dạo: test lõi bản đồ va chạm 2D (src/explore/stroll/map.ts) =====
   Bản đồ tự dựng: hai vùng chữ nhật kề cạnh (A tây, B đông), một vùng có cổng G, một nhà chữ nhật dày 14 m,
   một cột tròn, một tường thấp cao 0,9 m. Fuzz kiểm điểm cuối mỗi stMove bằng oracle viết riêng ở đây (quét tuyến tính, không dùng lưới của map.ts). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stMakeMap, stAddSolids, stSetGate, stZoneAt, stGroundY, stValid, stMove, stNearestValid, stSegClear, type StZone, type StSolid, type StMap } from '../../src/explore/stroll/map.ts';

const R = 0.35;   // bán kính nhân vật, m

/* mulberry32 riêng: map test không kéo three vào */
function mulberry(seed: number) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const HOUSE: StSolid = { kind: 'rect', x0: 10, x1: 24, z0: -5, z1: 5 };          // nhà dày 14 m theo x
const COLUMN: StSolid = { kind: 'circle', cx: -20, cz: 0, r: 1 };                 // cột tròn
const LOW: StSolid = { kind: 'rect', x0: -40, x1: -39.7, z0: -15, z1: 15, top: 0.9 };   // tường thấp 0,9 m

function makeZones(): StZone[] {
  return [
    { id: 'A', x0: -50, x1: 0, z0: -20, z1: 20, y: () => 2.5 },
    { id: 'B', x0: 0, x1: 50, z0: -20, z1: 20, y: (x) => 2.6 + x * 0.001 },
    { id: 'G', x0: 50, x1: 60, z0: -5, z1: 5, y: () => 3, gate: 'span' },
  ];
}
function makeMap(): StMap { return stMakeMap(makeZones(), [HOUSE, COLUMN, LOW], R); }

/* ---- oracle độc lập ---- */
function oInZone(m: StMap, x: number, z: number): boolean {
  for (const zn of m.zones) { if (zn.gate && m.closed.has(zn.gate)) continue; if (x >= zn.x0 && x <= zn.x1 && z >= zn.z0 && z <= zn.z1) return true; }
  return false;
}
function oDist(s: StSolid, x: number, z: number): number {
  if (s.kind === 'circle') return Math.hypot(x - s.cx, z - s.cz) - s.r;
  const dx = Math.max(s.x0 - x, 0, x - s.x1), dz = Math.max(s.z0 - z, 0, z - s.z1);
  return Math.hypot(dx, dz);
}
/* lowToo = true: tính cả tường thấp theo feet */
function oOk(m: StMap, x: number, z: number, feet: number, lowToo: boolean): boolean {
  if (!oInZone(m, x, z)) return false;
  for (const s of m.solids) {
    if (s.top !== undefined && (!lowToo || feet >= s.top)) continue;
    if (oDist(s, x, z) < m.radius - 1e-6) return false;
  }
  return true;
}

const out = { x: 0, z: 0 };

test('stValid: trong vùng xa vật cản, sát mép nhà 0,34 / 0,36 m, ngoài vùng', () => {
  const m = makeMap();
  assert.equal(stValid(m, 5, 10, 0), true);
  assert.equal(stValid(m, 10 - 0.34, 0, 0), false);
  assert.equal(stValid(m, 10 - 0.36, 0, 0), true);
  assert.equal(stValid(m, 24 + 0.34, 0, 0), false);
  assert.equal(stValid(m, 17, 5.36, 0), true);
  assert.equal(stValid(m, -20 + 1.34, 0, 0), false);   // cột tròn
  assert.equal(stValid(m, -20 + 1.36, 0, 0), true);
  assert.equal(stValid(m, 5, 30, 0), false);
  assert.equal(stValid(m, -60, 0, 0), false);
});

test('stZoneAt / stGroundY: vùng đầu tiên theo thứ tự, NaN ngoài vùng', () => {
  const m = makeMap();
  assert.equal(stZoneAt(m, -1, 0)?.id, 'A');
  assert.equal(stZoneAt(m, 0, 0)?.id, 'A');      // cạnh chung: vùng đứng trước thắng
  assert.equal(stZoneAt(m, 40, 0)?.id, 'B');
  assert.equal(stZoneAt(m, 5, 30), null);
  assert.equal(stGroundY(m, -1, 0), 2.5);
  assert.ok(Math.abs(stGroundY(m, 40, 0) - 2.64) < 1e-9);
  assert.ok(Number.isNaN(stGroundY(m, 5, 30)));
});

test('hai vùng kề cạnh: đi thẳng qua cạnh chung không bị chặn', () => {
  const m = makeMap();
  stMove(m, -5, 10, 10, 0, 0, out);
  assert.ok(Math.abs(out.x - 5) < 1e-9 && Math.abs(out.z - 10) < 1e-9, `${out.x},${out.z}`);
  stMove(m, 5, -10, -10, 0, 0, out);
  assert.ok(Math.abs(out.x + 5) < 1e-9 && Math.abs(out.z + 10) < 1e-9, `${out.x},${out.z}`);
});

test('stMove đâm chéo vào tường: trượt dọc tường, thành phần song song giữ nguyên dấu', () => {
  const m = makeMap();
  stMove(m, 8, 0, 4, 2, 0, out);
  assert.ok(out.x <= 10 - R + 1e-9 && out.x > 9.3, `x = ${out.x}`);
  assert.ok(out.z > 1.5 && out.z <= 2 + 1e-9, `z = ${out.z}`);
  stMove(m, 8, 0, 4, -2, 0, out);
  assert.ok(out.x <= 10 - R + 1e-9 && out.z < -1.5, `${out.x},${out.z}`);
  /* áp vào mép trên của vùng: trượt theo x */
  stMove(m, -10, 19, -3, 5, 0, out);
  assert.ok(out.z <= 20 && out.z > 19.5 && out.x < -12.5, `${out.x},${out.z}`);
});

test('stMove với bước 50 m xuyên một nhà dày 14 m: điểm cuối ở phía xuất phát của nhà', () => {
  const m = makeMap();
  stMove(m, 5, 0, 50, 0, 0, out);
  assert.ok(out.x <= 10 - R + 1e-9 && out.x > 9, `x = ${out.x}`);
  stMove(m, 40, 1, -50, 0, 1.2, out);
  assert.ok(out.x >= 24 + R - 1e-9 && out.x < 25, `x = ${out.x}`);
});

test('tường thấp: feet 0 → chặn; feet 1,0 → qua', () => {
  const m = makeMap();
  stMove(m, -38, 0, -5, 0, 0, out);
  assert.ok(out.x >= -39.7 + R - 1e-9 && out.x < -39, `x = ${out.x}`);
  assert.equal(stValid(m, -39.85, 0, 0), false);
  assert.equal(stValid(m, -39.85, 0, 1.0), true);
  stMove(m, -38, 0, -5, 0, 1.0, out);
  assert.ok(Math.abs(out.x + 43) < 1e-9, `x = ${out.x}`);
});

test('tường thấp: đáp xuống giữa tường vẫn bước ra được', () => {
  const m = makeMap();
  stMove(m, -39.85, 0, 2, 0, 0, out);
  assert.ok(out.x > -38.5 && stValid(m, out.x, out.z, 0), `x = ${out.x}`);
});

test('cổng đóng: stValid trong vùng đó → false; mở lại → true', () => {
  const m = makeMap();
  assert.equal(stValid(m, 55, 0, 0), true);
  stSetGate(m, 'span', true);
  assert.equal(stValid(m, 55, 0, 0), false);
  assert.equal(stZoneAt(m, 55, 0), null);
  stMove(m, 45, 0, 10, 0, 0, out);
  assert.ok(out.x <= 50 + 1e-9, `x = ${out.x}`);
  stSetGate(m, 'span', false);
  assert.equal(stValid(m, 55, 0, 0), true);
});

test('stNearestValid từ điểm trong vùng bị đóng trả điểm thuộc vùng mở kề bên', () => {
  const m = makeMap();
  stSetGate(m, 'span', true);
  assert.equal(stNearestValid(m, 55, 0, out), true);
  assert.equal(stValid(m, out.x, out.z, 0), true);
  assert.equal(stZoneAt(m, out.x, out.z)?.id, 'B');
  assert.ok(Math.hypot(out.x - 55, out.z) <= 10 + 1, `${out.x},${out.z}`);
  /* điểm đã hợp lệ thì giữ nguyên */
  assert.equal(stNearestValid(m, 5, 10, out), true);
  assert.ok(out.x === 5 && out.z === 10);
  /* trong nhà: ra mép gần nhất */
  assert.equal(stNearestValid(m, 11, 0, out), true);
  assert.ok(stValid(m, out.x, out.z, 0) && Math.hypot(out.x - 11, out.z) < 1.6, `${out.x},${out.z}`);
  /* xa hơn 80 m mọi vùng → false */
  assert.equal(stNearestValid(m, 300, 300, out), false);
});

test('stSegClear: đoạn xuyên nhà dừng đúng mép nhà, đoạn thông trả 1, ra khỏi vùng dừng ở mép vùng', () => {
  const m = makeMap();
  const t = stSegClear(m, 0, 0, 20, 0);
  assert.ok(t < 1 && Math.abs(t * 20 - 10) <= 0.05, `t = ${t}`);
  const t2 = stSegClear(m, 30, 2, 15, 2);
  assert.ok(Math.abs(t2 * 15 - 6) <= 0.05, `t2 = ${t2}`);
  assert.equal(stSegClear(m, -10, 10, -5, 15), 1);
  assert.equal(stSegClear(m, -10, 10, 10, 10), 1);              // qua cạnh chung A|B
  assert.equal(stSegClear(m, -38, 0, -42, 0), 1);               // tường thấp không chặn camera
  const t3 = stSegClear(m, 40, 10, 70, 10);                     // ra khỏi B ở x = 50
  assert.ok(Math.abs(t3 * 30 - 10) <= 0.05, `t3 = ${t3}`);
  const t4 = stSegClear(m, -25, 0, -15, 0);                     // cột tròn ở x = −21
  assert.ok(Math.abs(t4 * 10 - 4) <= 0.05, `t4 = ${t4}`);
  assert.equal(stSegClear(m, 15, 0, 30, 0), 0);                 // xuất phát trong nhà
});

test('stAddSolids: vật cản thêm sau vẫn được tính (cả vật cản lớn)', () => {
  const m = makeMap();
  assert.equal(stValid(m, -10, 10, 0), true);
  stAddSolids(m, [{ kind: 'rect', x0: -11, x1: -9, z0: 9, z1: 11 }, { kind: 'rect', x0: -50, x1: 50, z0: -20, z1: -18 }]);
  assert.equal(stValid(m, -10, 10, 0), false);
  assert.equal(stValid(m, 30, -18.2, 0), false);
  stMove(m, -5, 10, -10, 0, 0, out);
  assert.ok(out.x >= -9 + R - 1e-9 && out.x < -8, `x = ${out.x}`);
  assert.ok(stSegClear(m, 30, 0, 30, -19) < 1);
});

/* bản đồ fuzz: thêm nhiều nhà / cột ngẫu nhiên để có góc, khe hẹp, chỗ chồng nhau */
function fuzzMap(rnd: () => number): StMap {
  const m = makeMap();
  const more: StSolid[] = [];
  for (let i = 0; i < 60; i++) {
    const x = -50 + rnd() * 110, z = -20 + rnd() * 40;
    if (rnd() < 0.6) { const w = 0.2 + rnd() * 6, d = 0.2 + rnd() * 6; more.push({ kind: 'rect', x0: x, x1: x + w, z0: z, z1: z + d, top: rnd() < 0.2 ? 0.6 + rnd() * 0.3 : undefined }); }
    else more.push({ kind: 'circle', cx: x, cz: z, r: 0.1 + rnd() * 2, top: rnd() < 0.2 ? 0.8 : undefined });
  }
  stAddSolids(m, more);
  return m;
}

function runFuzz(seed: number, steps: number, maxStep: number) {
  const rnd = mulberry(seed);
  const m = fuzzMap(rnd);
  let x = -45, z = 18, heading = 0, bad = 0, badLow = 0, first = '';
  if (!stNearestValid(m, x, z, out)) throw new Error('không có điểm xuất phát');
  x = out.x; z = out.z;
  for (let i = 0; i < steps; i++) {
    if (rnd() < 0.05) heading = rnd() * Math.PI * 2;          // giữ hướng nhiều bước để áp sát và trượt dọc tường
    if (rnd() < 0.002) {                                       // đóng / mở cổng, sơ tán nếu đang đứng trong vùng bị đóng
      stSetGate(m, 'span', !m.closed.has('span'));
      if (!oOk(m, x, z, 0, false)) { assert.ok(stNearestValid(m, x, z, out)); x = out.x; z = out.z; }
    }
    const len = rnd() * maxStep, feet = rnd() < 0.5 ? 0 : 1.2;
    const startOkLow = oOk(m, x, z, feet, true);
    stMove(m, x, z, Math.cos(heading) * len, Math.sin(heading) * len, feet, out);
    if (!oOk(m, out.x, out.z, feet, false)) { bad++; if (!first) first = `bước ${i}: (${x},${z}) + ${len} → (${out.x},${out.z})`; }
    if (startOkLow && !oOk(m, out.x, out.z, feet, true)) { badLow++; if (!first) first = `tường thấp, bước ${i}: (${x},${z}) → (${out.x},${out.z}) feet ${feet}`; }
    if (!stValid(m, out.x, out.z, Infinity) && oOk(m, out.x, out.z, feet, false)) { bad++; if (!first) first = `stValid lệch oracle ở (${out.x},${out.z})`; }
    x = out.x; z = out.z;
  }
  return { bad, badLow, first };
}

test('fuzz 200 000 bước ngẫu nhiên (bước 0–3 m, feet 0 hoặc 1,2): không điểm cuối nào vi phạm', () => {
  const r = runFuzz(20261111, 200000, 3);
  assert.equal(r.bad + r.badLow, 0, r.first);
});

test('fuzz 20 000 bước dài (0–60 m, khung hình rất dài): không điểm cuối nào vi phạm', () => {
  const r = runFuzz(7, 20000, 60);
  assert.equal(r.bad + r.badLow, 0, r.first);
});

/* Oracle điểm cuối không bắt được lọt xuyên tường (điểm cuối bên kia tường vẫn hợp lệ).
   Bản đồ này có 3 tường mỏng 5 cm chắn kín hết bề ngang (cao vô hạn) chia vùng thành 4 ngăn: ngăn của nhân vật không bao giờ được đổi. */
test('fuzz xuyên tường mỏng: bước 0–60 m không bao giờ sang ngăn khác', () => {
  const rnd = mulberry(99);
  const walls: StSolid[] = [-25, 0, 25].map((w) => ({ kind: 'rect' as const, x0: w - 0.025, x1: w + 0.025, z0: -21, z1: 21 }));
  for (let i = 0; i < 30; i++) walls.push({ kind: 'circle', cx: -50 + rnd() * 100, cz: -20 + rnd() * 40, r: 0.02 + rnd() * 0.3 });
  const m = stMakeMap([{ id: 'Z', x0: -50, x1: 50, z0: -20, z1: 20, y: () => 0 }], walls, R);
  const cellOf = (x: number) => Math.floor((x + 50) / 25);
  let crossed = 0, first = '';
  for (let c = 0; c < 4; c++) {
    assert.ok(stNearestValid(m, -37.5 + c * 25, 0, out));
    let x = out.x, z = out.z, heading = 0;
    for (let i = 0; i < 20000; i++) {
      if (rnd() < 0.05) heading = rnd() * Math.PI * 2;
      const len = rnd() < 0.5 ? rnd() * 3 : rnd() * 60;
      stMove(m, x, z, Math.cos(heading) * len, Math.sin(heading) * len, rnd() < 0.5 ? 0 : 1.2, out);
      if (cellOf(out.x) !== c) { crossed++; if (!first) first = `ngăn ${c}: (${x},${z}) → (${out.x},${out.z})`; }
      x = out.x; z = out.z;
    }
  }
  assert.equal(crossed, 0, first);
});
