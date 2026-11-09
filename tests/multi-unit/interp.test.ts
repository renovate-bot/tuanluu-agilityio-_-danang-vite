import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ExTrack } from '../../src/explore/multi/interp.ts';

const out = () => ({ x: 0, y: 0, z: 0, yaw: 0, bank: 0 });

test('giữa hai mẫu trả trung điểm', () => {
  const t = new ExTrack(); t.push(0, 0, 10, 0, 0, 0); t.push(100, 10, 20, -10, 0.2, 0.4);
  const o = out(); assert.equal(t.sample(50, o), true);
  assert.ok(Math.abs(o.x - 5) < 1e-9 && Math.abs(o.y - 15) < 1e-9 && Math.abs(o.z + 5) < 1e-9);
  assert.ok(Math.abs(o.yaw - 0.1) < 1e-9 && Math.abs(o.bank - 0.2) < 1e-9);
});
test('yaw 3.1 và -3.1 đi đường ngắn qua ±π', () => {
  const t = new ExTrack(); t.push(0, 0, 0, 0, 3.1, 0); t.push(100, 0, 0, 0, -3.1, 0);
  const o = out(); t.sample(50, o);
  const d = Math.abs(Math.atan2(Math.sin(o.yaw - Math.PI), Math.cos(o.yaw - Math.PI)));
  assert.ok(d < 1e-9, 'giữa phải là ±π, không phải 0, được ' + o.yaw);
});
test('t quá mẫu cuối giữ mẫu cuối', () => {
  const t = new ExTrack(); t.push(0, 0, 0, 0, 0, 0); t.push(100, 10, 20, 30, 1, 0.5);
  const o = out(); assert.equal(t.sample(999, o), true);
  assert.deepEqual(o, { x: 10, y: 20, z: 30, yaw: 1, bank: 0.5 });
});
test('chưa có mẫu trả false', () => {
  assert.equal(new ExTrack().sample(0, out()), false);
});
test('reset xong trả false, mẫu mới không nội suy từ vị trí cũ', () => {
  const t = new ExTrack(); t.push(0, 0, 0, 0, 0, 0); t.push(100, 100, 0, 0, 0, 0);
  t.reset(); assert.equal(t.sample(50, out()), false);
  t.push(200, 500, 0, 0, 0, 0);
  const o = out(); assert.equal(t.sample(150, o), true);
  assert.equal(o.x, 500);
  assert.equal(t.sample(250, o), true); assert.equal(o.x, 500);
});
test('push 100 lần không vượt 8 mẫu', () => {
  const t = new ExTrack();
  for (let i = 0; i < 100; i++) t.push(i * 10, i, 0, 0, 0, 0);
  assert.ok(t.count <= 8);
  const o = out(); t.sample(985, o);          // nằm trong cửa sổ 8 mẫu cuối (930..990)
  assert.ok(Math.abs(o.x - 98.5) < 1e-9);
  t.sample(0, o); assert.equal(o.x, 92);      // trước mẫu cũ nhất còn giữ: kẹp mẫu đầu của cửa sổ
});
