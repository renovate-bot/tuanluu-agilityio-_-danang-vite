/* ===== Đi dạo: test cần gạt ảo (src/explore/stroll/stick.ts) ===== */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stStick } from '../../src/explore/stroll/stick.ts';

const R = 60;
const out = { mx: 9, mz: 9, run: true };

test('tâm cần gạt: đứng yên', () => {
  stStick(0, 0, R, out);
  assert.deepEqual(out, { mx: 0, mz: 0, run: false });
});

test('lệch 0,1 bán kính: trong vùng chết', () => {
  stStick(0.1 * R, 0, R, out);
  assert.deepEqual(out, { mx: 0, mz: 0, run: false });
});

test('đẩy lên 0,5 bán kính: tiến thẳng, chưa chạy', () => {
  stStick(0, -0.5 * R, R, out);
  assert.ok(Math.abs(out.mz - 1) < 1e-9 && Math.abs(out.mx) < 1e-9 && out.run === false);
});

test('đẩy lên 0,9 bán kính: chạy', () => {
  stStick(0, -0.9 * R, R, out);
  assert.ok(Math.abs(out.mz - 1) < 1e-9 && out.run === true);
});

test('kéo quá xa (3 bán kính) sang phải: kẹp, mx = 1, chạy', () => {
  stStick(3 * R, 0, R, out);
  assert.ok(Math.abs(out.mx - 1) < 1e-9 && Math.abs(out.mz) < 1e-9 && out.run === true);
});

test('chéo: hướng có độ dài 1', () => {
  stStick(0.5 * R, -0.5 * R, R, out);
  assert.ok(Math.abs(Math.hypot(out.mx, out.mz) - 1) < 1e-9);
  assert.ok(out.mx > 0 && out.mz > 0);
});

test('kéo xuống: lùi (mz âm)', () => {
  stStick(0, 0.5 * R, R, out);
  assert.ok(out.mz < 0);
});
