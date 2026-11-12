// Dữ liệu đám đông người thật: đọc public/people/crowd.bin bằng crowdParse (spec D-032 §4, §6; plan Task 1)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { crowdParse, type CrowdParsed } from '../../src/common/people/crowdData.ts';

const BIN = 'public/people/crowd.bin', JPG = 'public/people/crowd.jpg';
const D030 = ['Male_Adult_10', 'Female_Adult_12', 'Male_Adult_01', 'Female_Adult_03', 'Male_Adult_17'];
const CLIPS = ['walk', 'jog', 'idle', 'photo'] as const;
let cache: CrowdParsed | null = null;
const data = (): CrowdParsed => {
  if (!cache) { const b = readFileSync(BIN); cache = crowdParse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer); }
  return cache;
};

test('10 nhân vật: 2 trẻ em, đủ nam nữ, id không trùng, có 5 người của D-030', () => {
  const { chars } = data();
  assert.equal(chars.length, 10);
  assert.equal(chars.filter((c) => c.child).length, 2);
  assert.ok(chars.some((c) => c.female) && chars.some((c) => !c.female));
  assert.equal(new Set(chars.map((c) => c.id)).size, 10);
  for (const id of D030) assert.ok(chars.some((c) => c.id === id), `thiếu ${id}`);
});

test('lưới: attribute, trần tam giác, chân y = 0, chiều cao, mũi giày +X', () => {
  const { chars, bones } = data();
  for (const c of chars) for (const [tag, g] of [['geometry', c.geometry], ['hat', c.hat]] as const) {
    if (!g) continue;
    const what = `${c.id}/${tag}`;
    assert.ok(g.index, `${what}: không có index`);
    assert.ok(g.index.count / 3 <= (tag === 'hat' ? 1640 : 1600), `${what}: ${g.index.count / 3} tam giác`);
    const want = { position: 3, normal: 3, uv: 2, aBones: 2, aW: 1 } as Record<string, number>;
    for (const [n, s] of Object.entries(want)) assert.equal(g.getAttribute(n)?.itemSize, s, `${what}: ${n}`);
    const pos = g.getAttribute('position').array, n = g.getAttribute('position').count;
    for (const name of ['position', 'normal', 'uv', 'aW']) for (const v of g.getAttribute(name).array as ArrayLike<number>) assert.ok(Number.isFinite(v), `${what}: ${name} NaN`);
    for (const b of g.getAttribute('aBones').array as ArrayLike<number>) assert.ok(b < bones, `${what}: xương ${b}`);
    for (const w of g.getAttribute('aW').array as ArrayLike<number>) assert.ok(w >= 0 && w <= 1, `${what}: trọng số ${w}`);
    for (const u of g.getAttribute('uv').array as ArrayLike<number>) assert.ok(u >= 0 && u <= 1, `${what}: uv ${u}`);
    const idx = g.index.array; for (const i of idx as ArrayLike<number>) assert.ok(i < n, `${what}: index ${i}`);
    let y0 = Infinity, y1 = -Infinity, toeX = -Infinity;
    for (let i = 0; i < n; i++) {
      const x = pos[i * 3], y = pos[i * 3 + 1]; y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      if (y < 0.15) toeX = Math.max(toeX, x);
    }
    assert.ok(Math.abs(y0) <= 0.02, `${what}: chân thấp nhất y = ${y0}`);
    if (tag === 'geometry') assert.ok(Math.abs(y1 - c.height) <= 0.03, `${what}: cao lưới ${y1} so với ${c.height}`);
    assert.ok(toeX > 0.1, `${what}: mũi giày x = ${toeX}`);
  }
  for (const c of chars) {
    if (c.child) assert.ok(c.height > 0.9 && c.height < 1.5, `${c.id}: trẻ em cao ${c.height}`);
    else assert.ok(c.height > 1.5 && c.height < 1.95, `${c.id}: người lớn cao ${c.height}`);
  }
});

/* Pháp tuyến dài 0 ⇒ normalize() trong shader ra NaN ⇒ điểm ảnh đen, ban đêm bloom lan NaN ra cả khung (D-032 Task 3: Female_Adult_03 có 5 đỉnh như vậy trong crowd.bin) */
test('pháp tuyến sau khi đọc: mọi đỉnh dài 1 (kể cả đỉnh tệp ghi 0)', () => {
  const { chars } = data();
  for (const c of chars) for (const g of [c.geometry, c.hat]) {
    if (!g) continue;
    const a = g.getAttribute('normal');
    for (let v = 0; v < a.count; v++) { const l = Math.hypot(a.getX(v), a.getY(v), a.getZ(v)); assert.ok(Math.abs(l - 1) < 0.01, `${c.id}: đỉnh ${v} pháp tuyến dài ${l}`); }
  }
});

test('nón lá: người lớn có, trẻ em không; đỉnh nón cao hơn đầu', () => {
  const top = (g) => { const a = g.getAttribute('position').array; let m = -Infinity; for (let i = 1; i < a.length; i += 3) m = Math.max(m, a[i]); return m; };
  for (const c of data().chars) {
    if (c.child) { assert.equal(c.hat, null, c.id); continue; }
    assert.ok(c.hat, `${c.id}: thiếu bản nón`);
    assert.ok(top(c.hat) > top(c.geometry) + 0.02, `${c.id}: nón ${top(c.hat)} không cao hơn đầu ${top(c.geometry)}`);
  }
});

test('texture chuyển động: 22 xương, 3 texel mỗi xương, đủ dữ liệu', () => {
  const d = data();
  assert.equal(d.bones, 22);
  assert.equal(d.animWidth, d.bones * 3);
  assert.equal(d.animData.length, d.animWidth * d.animHeight * 4);
  let vMax = 0, iMax = 0;
  for (const c of d.chars) for (const g of [c.geometry, c.hat]) if (g) { vMax = Math.max(vMax, g.getAttribute('position').count); iMax = Math.max(iMax, g.index.count); }
  assert.equal(d.maxVerts, vMax); assert.equal(d.maxIndices, iMax);
});

test('4 đoạn mỗi nhân vật: hàng không chồng nhau, fps, loop, tốc độ tự nhiên', () => {
  const d = data(), used = new Uint8Array(d.animHeight);
  for (const c of d.chars) {
    for (const n of CLIPS) {
      const k = c.clips[n]; assert.ok(k, `${c.id}: thiếu ${n}`);
      assert.ok(Number.isInteger(k.row) && k.row >= 0 && k.frames >= 2 && k.row + k.frames <= d.animHeight, `${c.id}/${n}: hàng ${k.row}+${k.frames}`);
      for (let r = k.row; r < k.row + k.frames; r++) { assert.equal(used[r], 0, `${c.id}/${n}: hàng ${r} chồng`); used[r] = 1; }
    }
    const { walk, jog, idle, photo } = c.clips;
    assert.equal(walk.fps, 15); assert.equal(jog.fps, 30);
    assert.ok(walk.loop && jog.loop && idle.loop, c.id);
    assert.equal(idle.speed, 0); assert.equal(photo.speed, 0); assert.equal(photo.loop, false);
    assert.ok(walk.speed > 0.5 && walk.speed < 2, `${c.id}: walk ${walk.speed}`);
    assert.ok(jog.speed > 2 && jog.speed < 5, `${c.id}: jog ${jog.speed}`);
  }
});

test('ma trận xương: hữu hạn, khung đầu của walk gần như phép quay thuần (không co giãn)', () => {
  const d = data(), h = (u: number) => { const s = u >> 15 ? -1 : 1, e = (u >> 10) & 31, m = u & 1023; return e === 0 ? s * m * 2 ** -24 : e === 31 ? NaN : s * (1 + m / 1024) * 2 ** (e - 15); };
  for (const v of d.animData) assert.ok(Number.isFinite(h(v)));
  for (const c of d.chars) {
    const row = c.clips.walk.row;
    for (let b = 0; b < d.bones; b++) {
      const at = (j: number, k: number) => h(d.animData[(row * d.animWidth + b * 3 + j) * 4 + k]);
      for (let k = 0; k < 3; k++) { const len = Math.hypot(at(0, k), at(1, k), at(2, k)); assert.ok(Math.abs(len - 1) < 0.02, `${c.id} xương ${b}: cột ${k} dài ${len}`); }
    }
  }
});

test('dung lượng trong trần; atlas là JPEG', () => {
  const b = statSync(BIN).size, j = statSync(JPG).size;
  assert.ok(b <= 1_100_000, `crowd.bin ${b} B`);
  assert.ok(j <= 400_000, `crowd.jpg ${j} B`);
  assert.ok(b + j <= 1_500_000, `tổng ${b + j} B`);
  const head = readFileSync(JPG).subarray(0, 2); assert.equal(head[0], 0xff); assert.equal(head[1], 0xd8);
});

test('tệp sai magic / phiên bản bị từ chối', () => {
  assert.throws(() => crowdParse(new ArrayBuffer(16)));
  const b = readFileSync(BIN), c = new Uint8Array(b); c[4] = 99;   // phiên bản lạ
  assert.throws(() => crowdParse(c.buffer.slice(c.byteOffset, c.byteOffset + c.byteLength) as ArrayBuffer));
});

test('giấy phép ghi tên cả 10 nhân vật', () => {
  const t = readFileSync('public/people/LICENSE-Rocketbox.txt', 'utf8');
  for (const c of data().chars) assert.ok(t.includes(c.id), `thiếu ${c.id}`);
});
