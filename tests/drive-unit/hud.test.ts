/* ===== Lái xe: HUD thuần (src/explore/drive/hud.ts): chiếu bản đồ nhỏ, đổi m/s sang km/h ===== */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drMapProject, drKmh } from '../../src/explore/drive/hud.ts';

const B = { x0: -1900, x1: 1480, z0: -3660, z1: 1400 };   // cỡ mạng đường thật (rộng 3 380 m, cao 5 060 m)

test('drMapProject đặt góc Tây Bắc về (0, 0) và giữ tỉ lệ', () => {
  const o = { u: 9, v: 9 };
  drMapProject(B, 200, 300, B.x0, B.z0, o);
  assert.deepEqual(o, { u: 0, v: 0 });
  const a = { u: 0, v: 0 }, b = { u: 0, v: 0 };   // Bắc (−Z) ở trên: z nhỏ hơn thì v nhỏ hơn
  drMapProject(B, 200, 300, 0, -1000, a); drMapProject(B, 200, 300, 0, 1000, b);
  assert.ok(a.v < b.v, 'Bắc ở trên');
  const p = { u: 0, v: 0 }, q = { u: 0, v: 0 };   // cùng tỉ lệ hai trục: 500 m theo x và 500 m theo z cho cùng số px
  drMapProject(B, 200, 300, 0, 0, p); drMapProject(B, 200, 300, 500, 500, q);
  assert.ok(Math.abs((q.u - p.u) - (q.v - p.v)) < 1e-9, 'giữ tỉ lệ');
  const c = { u: 0, v: 0 };                         // góc Đông Nam không vượt khung và vừa khít một chiều
  drMapProject(B, 200, 300, B.x1, B.z1, c);
  assert.ok(c.u <= 200 + 1e-9 && c.v <= 300 + 1e-9);
  assert.ok(Math.abs(c.u - 200) < 1e-9 || Math.abs(c.v - 300) < 1e-9, 'vừa khít một chiều');
});

test('Đông ở bên phải: x lớn hơn thì u lớn hơn', () => {
  const a = { u: 0, v: 0 }, b = { u: 0, v: 0 };
  drMapProject(B, 200, 300, -500, 0, a); drMapProject(B, 200, 300, 500, 0, b);
  assert.ok(a.u < b.u);
});

test('27,78 m/s hiện 100 km/h; lùi cũng hiện số dương', () => {
  assert.equal(drKmh(27.78), 100);
  assert.equal(drKmh(0), 0);
  assert.equal(drKmh(-5.56), 20);
  assert.equal(drKmh(13.9), 50);
});
