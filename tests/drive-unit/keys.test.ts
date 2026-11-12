/* ===== Lái xe: bàn phím → DrInput (src/explore/drive/keys.ts) =====
   Từng phím cho đúng trường, hai phím trái phải triệt nhau, mất tiêu điểm thì nhả hết phím (Review Focus 2). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drInputFromKeys, drBindDrop } from '../../src/explore/drive/keys.ts';
import type { DrInput } from '../../src/explore/drive/motion.ts';

const out = (): DrInput => ({ gas: 0.5, brake: 0.5, steer: 0.5, hand: true });   // giá trị rác: hàm phải ghi đè mọi trường
const read = (...codes: string[]): DrInput => drInputFromKeys(new Set(codes), out());

test('từng phím cho đúng trường', () => {
  assert.deepEqual(read(), { gas: 0, brake: 0, steer: 0, hand: false });
  assert.deepEqual(read('KeyW'), { gas: 1, brake: 0, steer: 0, hand: false });
  assert.deepEqual(read('ArrowUp'), { gas: 1, brake: 0, steer: 0, hand: false });
  assert.deepEqual(read('KeyS'), { gas: 0, brake: 1, steer: 0, hand: false });
  assert.deepEqual(read('ArrowDown'), { gas: 0, brake: 1, steer: 0, hand: false });
  assert.deepEqual(read('KeyA'), { gas: 0, brake: 0, steer: 1, hand: false });
  assert.deepEqual(read('ArrowLeft'), { gas: 0, brake: 0, steer: 1, hand: false });
  assert.deepEqual(read('KeyD'), { gas: 0, brake: 0, steer: -1, hand: false });
  assert.deepEqual(read('ArrowRight'), { gas: 0, brake: 0, steer: -1, hand: false });
  assert.deepEqual(read('Space'), { gas: 0, brake: 0, steer: 0, hand: true });
  assert.deepEqual(read('KeyW', 'KeyA', 'Space'), { gas: 1, brake: 0, steer: 1, hand: true });
});

test('hai phím trái phải cùng lúc thì steer = 0', () => {
  assert.equal(read('KeyA', 'KeyD').steer, 0);
  assert.equal(read('ArrowLeft', 'KeyD').steer, 0);
  assert.equal(read('KeyA', 'ArrowRight').steer, 0);
});

test('không biết gì về lùi: S khi đứng yên vẫn chỉ là brake = 1', () => {
  const r = read('KeyS');
  assert.equal(r.brake, 1); assert.equal(r.gas, 0);
});

test('mất tiêu điểm thì nhả hết phím', () => {
  const win = new EventTarget(), doc = Object.assign(new EventTarget(), { hidden: false });
  const keys = new Set(['KeyW', 'KeyA', 'Space']);
  const drop = drBindDrop(win, doc, keys);
  win.dispatchEvent(new Event('blur'));
  assert.equal(keys.size, 0);
  assert.deepEqual(drInputFromKeys(keys, out()), { gas: 0, brake: 0, steer: 0, hand: false });
  /* ẩn tab cũng nhả; hiện lại thì không đụng phím đang giữ */
  keys.add('KeyW'); doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(keys.size, 1);
  doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(keys.size, 0);
  /* hàm trả về là chính hàm xử lý */
  keys.add('KeyS'); drop();
  assert.equal(keys.size, 0);
});
