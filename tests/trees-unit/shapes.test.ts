// Hình học cây bóng mát và cây dừa (spec G1, G2, §6; plan Task 1)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CONFIG } from '../../src/config.ts';
import { trShadeTrunkGeo, trShadeCrownGeo, trPalmTrunkGeo, trPalmCrownGeo, trPalmStaticGeo } from '../../src/common/trees/shapes.ts';

const tris = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.getAttribute('position').count) / 3;
const pts = (g: THREE.BufferGeometry) => { const p = g.getAttribute('position'), out: THREE.Vector3[] = []; for (let i = 0; i < p.count; i++) out.push(new THREE.Vector3().fromBufferAttribute(p, i)); return out; };
const bbox = (g: THREE.BufferGeometry) => { g.computeBoundingBox(); return g.boundingBox!; };
const hr = (v: THREE.Vector3) => Math.hypot(v.x, v.z);   // bán kính ngang
const ALL = () => ({ shadeCrown: trShadeCrownGeo(), shadeTrunk: trShadeTrunkGeo(), palmCrown: trPalmCrownGeo(), palmTrunk: trPalmTrunkGeo(), palmStatic: trPalmStaticGeo(10) });

test('số tam giác trong trần', () => {
  const M = CONFIG.trees.maxTris;
  for (const [k, g] of Object.entries(ALL())) assert.ok(tris(g) <= M[k as keyof typeof M], `${k}: ${tris(g)} > ${M[k as keyof typeof M]}`);
});

test('đủ thuộc tính position/normal/uv/color, không NaN', () => {
  for (const [k, g] of Object.entries(ALL())) {
    const n = g.getAttribute('position').count;
    for (const [a, size] of [['position', 3], ['normal', 3], ['uv', 2], ['color', 3]] as [string, number][]) {
      const at = g.getAttribute(a); assert.ok(at, `${k} thiếu ${a}`); assert.equal(at.itemSize, size, `${k}.${a} itemSize`); assert.equal(at.count, n, `${k}.${a} count`);
      for (const v of at.array as ArrayLike<number>) assert.ok(Number.isFinite(v), `${k}.${a} có NaN`);
    }
    const nm = g.getAttribute('normal');
    for (let i = 0; i < n; i++) assert.ok(Math.abs(new THREE.Vector3().fromBufferAttribute(nm, i).length() - 1) < 0.02, `${k} pháp tuyến ${i} không đơn vị`);
    assert.ok(tris(g) >= 1 && Number.isInteger(tris(g)), `${k} số tam giác`);
  }
});

test('tán bóng mát nằm trong cầu đơn vị và dẹt rộng', () => {
  const g = trShadeCrownGeo(), b = bbox(g);
  for (const v of pts(g)) assert.ok(v.length() <= 1.12, `đỉnh ngoài cầu: ${v.length()}`);
  assert.ok(b.max.x - b.min.x >= 1.7, `rộng X ${b.max.x - b.min.x}`);
  assert.ok(b.min.y <= -0.6, `đáy tán ${b.min.y}`);
  assert.ok(b.max.x - b.min.x > b.max.y - b.min.y, 'tán phải rộng hơn cao');
  const c = g.getAttribute('color'); let lo = 1, hi = 0;
  for (let i = 0; i < c.count; i++) { lo = Math.min(lo, c.getY(i)); hi = Math.max(hi, c.getY(i)); }
  assert.ok(hi >= 0.9 && lo <= 0.5 && lo >= 0.3, `độ sáng tán ${lo}..${hi}`);
});

test('tán có ≥ 8 cụm: mép không tròn trơn', () => {
  const N = 24, mx = new Array(N).fill(0);
  for (const v of pts(trShadeCrownGeo())) { const s = Math.floor(((Math.atan2(v.z, v.x) + Math.PI) / (2 * Math.PI)) * N) % N; mx[s] = Math.max(mx[s], hr(v)); }
  const hi = Math.max(...mx), lo = Math.min(...mx);
  assert.ok(lo > 0, 'có hướng không có đỉnh');
  assert.ok((hi - lo) / hi >= 0.12, `mép dao động ${((hi - lo) / hi).toFixed(3)}`);
});

test('thân bóng mát cao đúng 1, có cành tỏa', () => {
  const g = trShadeTrunkGeo(), b = bbox(g), P = pts(g);
  assert.ok(Math.abs(b.min.y) < 0.01 && Math.abs(b.max.y - 1) < 0.01, `cao ${b.min.y}..${b.max.y}`);
  assert.ok(P.some(v => v.y > 0.8 && hr(v) >= 0.5), 'không có cành tỏa ở y > 0,8');
  for (const v of P) if (v.y < 0.3) assert.ok(hr(v) <= 0.3, `gốc quá rộng ${hr(v)} ở y ${v.y}`);
  const c = g.getAttribute('color');
  for (let i = 0; i < c.count; i++) assert.ok(c.getX(i) >= c.getZ(i) && c.getX(i) < 0.8, 'vỏ phải nâu xám');
});

test('thân dừa cao 1, đỉnh lệch đúng palm.bend', () => {
  const g = trPalmTrunkGeo(), b = bbox(g), top = pts(g).filter(v => v.y > 0.98);
  assert.ok(Math.abs(b.min.y) < 0.01 && Math.abs(b.max.y - 1) < 0.01, `cao ${b.min.y}..${b.max.y}`);
  assert.ok(top.length >= 3, 'thiếu vòng đỉnh');
  const cx = top.reduce((s, v) => s + v.x, 0) / top.length, cz = top.reduce((s, v) => s + v.z, 0) / top.length;
  assert.ok(Math.abs(cx - CONFIG.trees.palm.bend) <= 0.03 && Math.abs(cz) <= 0.03, `đỉnh lệch ${cx}, ${cz}`);
  const bot = pts(g).filter(v => v.y < 0.01);
  assert.ok(Math.abs(Math.max(...bot.map(hr)) - 0.35) < 0.02 && Math.abs(Math.max(...top.map(v => Math.hypot(v.x - cx, v.z - cz))) - 0.2) < 0.02, 'bán kính đáy 0,35 / đỉnh 0,2');
  const c = g.getAttribute('color'), ys = new Map<number, number>();   // vòng sẹo: độ sáng theo cao độ xen kẽ
  for (let i = 0; i < c.count; i++) ys.set(Math.round(g.getAttribute('position').getY(i) * 1000), c.getX(i));
  const lum = [...ys.entries()].sort((a, b) => a[0] - b[0]).map(e => e[1]);
  assert.ok(lum.length >= 11, `chỉ ${lum.length} vòng`);
  let flips = 0; for (let i = 2; i < lum.length; i++) if (Math.sign(lum[i] - lum[i - 1]) !== Math.sign(lum[i - 1] - lum[i - 2])) flips++;
  assert.ok(flips >= 6, `vòng sẹo không xen kẽ (${flips})`);
});

test('tàu dừa: có tàu dựng lên và tàu rũ xuống', () => {
  const g = trPalmCrownGeo(), b = bbox(g), P = pts(g);
  assert.ok(b.max.y >= 0.6, `tàu non cao ${b.max.y}`);
  assert.ok(b.min.y <= -0.25, `tàu già rũ ${b.min.y}`);
  assert.ok(Math.max(...P.map(hr)) >= 0.75, 'tàu vươn chưa đủ xa');
  const uv = g.getAttribute('uv'); let solid = 0, frond = 0;   // uv: tàu lá v ≥ 0,1; búi ngọn và quả trong ô đặc [0, 0,06]²
  for (let i = 0; i < uv.count; i++) { const u = uv.getX(i), v = uv.getY(i); if (u <= 0.06 && v <= 0.06) solid++; else { assert.ok(v >= 0.1 && v <= 1 && u >= 0 && u <= 1, `uv tàu lá ${u}, ${v}`); frond++; } }
  assert.ok(solid > 0 && frond > 0, 'thiếu búi ngọn/quả hoặc tàu lá');
});

test('cây dừa tĩnh cao h, đứng trên y = 0, hai mặt', () => {
  for (const h of [8, 10, 12]) {
    const g = trPalmStaticGeo(h), b = bbox(g);
    assert.equal(g.index, null, 'lưới dừa tĩnh phải không index');
    assert.ok(Math.abs(b.min.y) < 0.02, `h ${h}: chân ${b.min.y}`);
    assert.ok(b.max.y >= h && b.max.y <= h * 1.45, `h ${h}: đỉnh ${b.max.y}`);
    const p = g.getAttribute('position'), c = g.getAttribute('color'), key = (i: number) => `${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}`;
    const set = new Set<string>(); for (let i = 0; i < p.count; i += 3) set.add([key(i), key(i + 1), key(i + 2)].join('|'));
    let leaf = 0;
    for (let i = 0; i < p.count; i += 3) {
      if (!(c.getY(i) > c.getX(i) + 0.1)) continue;   // tam giác tàu lá (màu xanh)
      leaf++;
      const rev = [key(i), key(i + 2), key(i + 1)], ok = [0, 1, 2].some(s => set.has([rev[s], rev[(s + 1) % 3], rev[(s + 2) % 3]].join('|')));
      assert.ok(ok, `h ${h}: tam giác tàu lá ${i / 3} không có bản đảo chiều`);
    }
    assert.ok(leaf >= 8 * 2 * 2, `h ${h}: chỉ ${leaf} tam giác tàu lá`);
  }
});
