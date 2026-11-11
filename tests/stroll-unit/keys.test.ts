/* ===== Đi dạo: tên phím theo vị trí vật lý (src/explore/stroll/keys.ts) — bố cục không Latin vẫn dùng WASD ===== */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stKeyName, stInputFromKeys } from '../../src/explore/stroll/keys.ts';

test('phím theo e.code, bất kể chữ trên phím (ru, ar, th, hi)', () => {
  assert.equal(stKeyName({ key: 'ц', code: 'KeyW' }), 'w');      // ru
  assert.equal(stKeyName({ key: 'ش', code: 'KeyA' }), 'a');      // ar
  assert.equal(stKeyName({ key: 'ห', code: 'KeyS' }), 's');      // th
  assert.equal(stKeyName({ key: 'व', code: 'KeyD' }), 'd');      // hi
  assert.equal(stKeyName({ key: 'з', code: 'KeyP' }), 'p');
  assert.equal(stKeyName({ key: 'Shift', code: 'ShiftRight' }), 'shift');
  assert.equal(stKeyName({ key: ' ', code: 'Space' }), ' ');
});

test('không có code (sự kiện giả) hoặc phím khác: dùng e.key viết thường', () => {
  assert.equal(stKeyName({ key: 'W' }), 'w');
  assert.equal(stKeyName({ key: 'ArrowUp', code: 'ArrowUp' }), 'arrowup');
  assert.equal(stKeyName({ key: 'Shift', code: '' }), 'shift');
});

test('bố cục Nga: phím vật lý W cho đi tới', () => {
  const out = { mx: 0, mz: 0, run: false, jump: false, camYaw: 0 };
  stInputFromKeys(new Set([stKeyName({ key: 'ц', code: 'KeyW' })]), 0, out);
  assert.equal(out.mz, 1);
});
