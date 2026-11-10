// Hình học từng kiểu tàu (spec G1, G2, G7; plan Task 2)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { btBuildTypeGeometry, btBuildFleetGeometry, Glow } from '../../src/environment/boats/hulls.ts';

const TYPES = ['A', 'B', 'C', 'D', 'E'] as const;
const glows = (g: THREE.BufferGeometry) => new Set(Array.from(g.getAttribute('aGlow').array as ArrayLike<number>));
const box = (g: THREE.BufferGeometry) => { g.computeBoundingBox(); return g.boundingBox!; };

test('mọi kiểu có đủ thuộc tính, aGlow là số nguyên trong bảng Glow', () => {
  for (const t of TYPES) {
    const g = btBuildTypeGeometry(t);
    for (const a of ['position', 'normal', 'color', 'uv', 'aGlow']) assert.ok(g.getAttribute(a), `${t} thiếu ${a}`);
    for (const v of glows(g)) assert.ok(Number.isInteger(v) && v >= 0 && v <= Glow.Stripe, `${t}: aGlow ${v}`);
  }
});

test('kích thước chuẩn: dài 1 theo Z, đáy không sâu quá 0,05', () => {
  for (const t of TYPES) {
    const b = box(btBuildTypeGeometry(t));
    assert.ok(Math.abs(b.max.z - b.min.z - 1) < 0.02, `${t}: dài ${b.max.z - b.min.z}`);
    assert.ok(b.min.y >= -0.05, `${t}: đáy ${b.min.y}`);
  }
});

test('có đèn: A, B, C có LED, cửa sổ, biển tên; D có cửa sổ và đèn mạn đỏ', () => {
  for (const t of ['A', 'B', 'C'] as const) { const s = glows(btBuildTypeGeometry(t)); for (const k of [Glow.Led, Glow.Window, Glow.Plate]) assert.ok(s.has(k), `${t} thiếu glow ${k}`); }
  const d = glows(btBuildTypeGeometry('D')); assert.ok(d.has(Glow.Window) && d.has(Glow.NavRed));
  assert.ok(glows(btBuildTypeGeometry('C')).has(Glow.Lantern));
});

test('vừa phải: mỗi kiểu ≤ 4000 đỉnh', () => {
  for (const t of TYPES) assert.ok(btBuildTypeGeometry(t).getAttribute('position').count <= 4000, t);
});

test('fleet gộp đúng số đỉnh và aPart theo thứ tự A..E', () => {
  const f = btBuildFleetGeometry(['A', 'B', 'C']);
  const n = ['A', 'B', 'C'].reduce((s, t) => s + btBuildTypeGeometry(t as 'A').getAttribute('position').count, 0);
  assert.equal(f.getAttribute('position').count, n);
  assert.deepEqual([...new Set(Array.from(f.getAttribute('aPart').array as ArrayLike<number>))].sort(), [0, 1, 2]);
  const e = btBuildFleetGeometry(['E']);
  assert.deepEqual([...new Set(Array.from(e.getAttribute('aPart').array as ArrayLike<number>))], [4]);
});

test('khác dáng: A, B, C khác nhau rõ về tỉ lệ cao/dài hoặc rộng/dài', () => {
  const r = (t: 'A' | 'B' | 'C') => { const b = box(btBuildTypeGeometry(t)); return [(b.max.y - b.min.y), (b.max.x - b.min.x)]; };
  const [a, b, c] = [r('A'), r('B'), r('C')];
  for (const [p, q, n] of [[a, b, 'A-B'], [a, c, 'A-C'], [b, c, 'B-C']] as const)
    assert.ok(Math.max(Math.abs(p[0] - q[0]), Math.abs(p[1] - q[1])) > 0.03, `${n} quá giống`);
});
