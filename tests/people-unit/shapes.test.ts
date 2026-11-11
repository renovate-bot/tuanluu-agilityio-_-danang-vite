// Hình học người đi bộ: trần đỉnh, kích thước, thuộc tính khớp (spec G5, §6; plan Task 4)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CONFIG } from '../../src/config.ts';
import { ppBuildGeometry, PP_HIP, PP_KNEE, PP_SHOULDER, PP_ELBOW } from '../../src/common/people/shapes.ts';

const F32 = Math.fround;   // thuộc tính lưu Float32
const arr = (g: THREE.BufferGeometry, a: string) => Array.from(g.getAttribute(a).array as ArrayLike<number>);

test('số đỉnh ≤ maxVerts', () => {
  const n = ppBuildGeometry().getAttribute('position').count;
  assert.ok(n <= CONFIG.people.maxVerts, `${n} đỉnh`);
});

test('kích thước: cao 1,6–1,9 m (cả nón), chân chạm y = 0, rộng Z ≤ 0,7 m, mặt hướng +X', () => {
  const g = ppBuildGeometry(); g.computeBoundingBox(); const b = g.boundingBox!;
  assert.ok(b.max.y >= 1.6 && b.max.y <= 1.9, `cao ${b.max.y}`);
  assert.ok(Math.abs(b.min.y) < 0.01, `đáy ${b.min.y}`);
  assert.ok(b.max.z - b.min.z <= 0.7, `rộng ${b.max.z - b.min.z}`);
  // ba lô (aPart 6) sau lưng (−X), mũi giày phía trước (+X)
  const p = g.getAttribute('position'), part = arr(g, 'aPart');
  for (let i = 0; i < p.count; i++) if (part[i] === 6) assert.ok(p.getX(i) < 0, `ba lô x = ${p.getX(i)}`);
  let shoeMax = -1; for (let i = 0; i < p.count; i++) if ((part[i] === 1 || part[i] === 2) && p.getY(i) < 0.08) shoeMax = Math.max(shoeMax, p.getX(i));
  assert.ok(shoeMax > 0.1, `mũi giày x = ${shoeMax}`);
});

test('đủ thuộc tính, đủ 7 giá trị aPart, khớp đúng', () => {
  const g = ppBuildGeometry(), n = g.getAttribute('position').count;
  for (const [a, size] of [['position', 3], ['normal', 3], ['aPart', 1], ['aSeg', 1], ['aPivot', 1], ['aPivot2', 1], ['aMask', 1], ['aFix', 3]] as [string, number][]) {
    const at = g.getAttribute(a); assert.ok(at, `thiếu ${a}`); assert.equal(at.itemSize, size, `${a} itemSize`); assert.equal(at.count, n, `${a} count`);
    for (const v of at.array as ArrayLike<number>) assert.ok(Number.isFinite(v), `${a} có NaN`);
  }
  const part = arr(g, 'aPart'), seg = arr(g, 'aSeg'), piv = arr(g, 'aPivot'), piv2 = arr(g, 'aPivot2'), mask = arr(g, 'aMask');
  assert.deepEqual([...new Set(part)].sort(), [0, 1, 2, 3, 4, 5, 6]);
  for (let i = 0; i < n; i++) {
    assert.ok(seg[i] === 0 || seg[i] === 1, `aSeg ${seg[i]}`);
    if (seg[i] === 1) assert.ok(part[i] >= 1 && part[i] <= 4, `aSeg = 1 ở aPart ${part[i]}`);
    if (part[i] === 1 || part[i] === 2) { assert.equal(piv[i], F32(PP_HIP)); if (seg[i] === 1) assert.equal(piv2[i], F32(PP_KNEE)); }
    if (part[i] === 3 || part[i] === 4) { assert.equal(piv[i], F32(PP_SHOULDER)); if (seg[i] === 1) assert.equal(piv2[i], F32(PP_ELBOW)); }
    assert.ok([0, 1, 2].includes(mask[i]), `aMask ${mask[i]}`);
  }
  assert.ok(mask.includes(1) && mask.includes(2), 'thiếu đỉnh áo hoặc quần');
});
