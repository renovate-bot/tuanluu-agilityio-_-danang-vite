/* ===== Lái xe: điều khiển cảm ứng (src/explore/drive/touch.ts) =====
   Cần gạt ngang, GA, hai ngón độc lập, gộp với đầu vào phím, reset nhả hết. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../src/config.ts';

/* Giả DOM tối thiểu: phần tử lưu các hàm nghe, dispatchEvent gọi lại đúng loại sự kiện */
class FakeEl {
  handlers: Record<string, ((e: any) => void)[]> = {};
  style = { setProperty() {}, transform: '' };
  classes = new Set<string>();
  classList = { toggle: (c: string, on: boolean) => { if (on) this.classes.add(c); else this.classes.delete(c); } };
  offsetWidth = 56;
  addEventListener(type: string, fn: (e: any) => void) { (this.handlers[type] ||= []).push(fn); }
  dispatchEvent(e: any) { (this.handlers[e.type] || []).forEach((fn) => fn(e)); return true; }
  setPointerCapture() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: 180, height: 72 }; }   // cần gạt: tâm x = 90, hành trình (180 − 56) / 2 = 62
}
const els: Record<string, FakeEl> = {};
const root = { style: { setProperty() {} }, addEventListener() {}, querySelector: (s: string) => (els[s] ||= new FakeEl()) };
const win = new FakeEl() as any; win.innerWidth = 800; win.innerHeight = 400;
(globalThis as any).window = win;
(globalThis as any).document = new FakeEl();
(globalThis as any).PointerEvent = class { constructor(public type: string, init: any) { Object.assign(this, init); } };
let now = 0;
Object.defineProperty(globalThis, 'performance', { value: { now: () => now }, configurable: true });
const { drTouchBind, drSteerFromDx } = await import('../../src/explore/drive/touch.ts');

let acts = 0; const looks: number[][] = [];
const t = drTouchBind(root as any, { look(dx: number, dy: number) { looks.push([dx, dy]); }, activity() { acts++; } });
const ev = (sel: string, type: string, id: number, x = 0, y = 0) => els[sel].dispatchEvent({ type, pointerId: id, clientX: x, clientY: y, preventDefault() {} });
const read = (init: Partial<{ gas: number; brake: number; steer: number; hand: boolean }> = {}) => { const o = { gas: 0, brake: 0, steer: 0, hand: false, ...init }; t.read(o); return o; };
const CX = 90, R = 62;

test('cần gạt ngang cho steer −1..1, bỏ thành phần dọc', () => {
  ev('#drSteer', 'pointerdown', 1, CX, 36);
  assert.equal(read().steer, 0, 'ở tâm: trong vùng chết');
  ev('#drSteer', 'pointermove', 1, CX - R, 36);
  assert.equal(read().steer, 1, 'hết cỡ sang trái: steer = +1 (rẽ trái)');
  ev('#drSteer', 'pointermove', 1, CX + R, 36);
  assert.equal(read().steer, -1, 'hết cỡ sang phải: steer = −1');
  ev('#drSteer', 'pointermove', 1, CX + R / 2, 36);
  const half = read().steer;
  assert.ok(half < 0 && half > -1, `nửa hành trình: steer trong (−1, 0): ${half}`);
  ev('#drSteer', 'pointermove', 1, CX + R / 2, 2000);   // lệch dọc rất lớn không đổi kết quả
  assert.equal(read().steer, half, 'bỏ thành phần dọc');
  ev('#drSteer', 'pointermove', 1, CX - 999, 36);
  assert.equal(read().steer, 1, 'kẹp ở +1');
  ev('#drSteer', 'pointerup', 1);
  assert.equal(read().steer, 0, 'nhấc tay: về 0');
  assert.equal(els['#drKnob'].style.transform, '', 'núm về tâm');
});

test('vùng chết và co giãn', () => {
  const D = CONFIG.drive.touch.dead;
  assert.equal(drSteerFromDx(D * R * 0.99, R), 0);
  assert.ok(Math.abs(drSteerFromDx(R, R) + 1) < 1e-9);
  assert.ok(Math.abs(drSteerFromDx(-R, R) - 1) < 1e-9);
});

test('giữ GA cho gas = 1, PHANH cho brake = 1; nhả thì 0', () => {
  ev('#drGas', 'pointerdown', 5);
  const o = read(); assert.equal(o.gas, 1); assert.equal(o.brake, 0);
  assert.ok(els['#drGas'].classes.has('on'));
  ev('#drGas', 'pointerup', 5);
  assert.equal(read().gas, 0);
  assert.ok(!els['#drGas'].classes.has('on'));
  ev('#drBrake', 'pointerdown', 6);
  assert.equal(read().brake, 1);
  ev('#drBrake', 'pointercancel', 6);
  assert.equal(read().brake, 0);
});

test('hai ngón độc lập: A trên cần gạt, B trên GA; nhấc B thì gas = 0, steer giữ nguyên', () => {
  ev('#drSteer', 'pointerdown', 1, CX, 36);
  ev('#drSteer', 'pointermove', 1, CX - R, 36);
  ev('#drGas', 'pointerdown', 2);
  let o = read(); assert.equal(o.gas, 1); assert.equal(o.steer, 1);
  ev('#drGas', 'pointerup', 2);
  o = read(); assert.equal(o.gas, 0); assert.equal(o.steer, 1, 'steer giữ nguyên');
  ev('#drGas', 'pointerup', 1);   // con trỏ lạ không nhả cần gạt
  assert.equal(read().steer, 1);
  ev('#drSteer', 'pointermove', 1, CX - 5000, 5000);   // A trượt ra rất xa ngoài vùng vẫn giữ lái
  assert.equal(read().steer, 1);
  ev('#drSteer', 'pointerup', 1);
  assert.equal(read().steer, 0);
});

test('chỉ con trỏ đã chạm vào vùng mới điều khiển vùng đó', () => {
  ev('#drGas', 'pointerdown', 7);
  ev('#drBrake', 'pointerup', 7);            // cùng id nhưng không phải bàn đạp của nó
  assert.equal(read().gas, 1);
  ev('#drGas', 'pointerup', 7);
});

test('gộp với đầu vào phím: lấy giá trị có độ lớn lớn hơn, không xóa phím', () => {
  assert.deepEqual(read({ gas: 1, brake: 0, steer: 1, hand: true }), { gas: 1, brake: 0, steer: 1, hand: true }, 'không giữ gì: không đổi');
  ev('#drGas', 'pointerdown', 2);
  assert.equal(read({ brake: 1 }).brake, 1, 'phím phanh vẫn còn khi cảm ứng đạp GA');
  ev('#drGas', 'pointerup', 2);
  ev('#drSteer', 'pointerdown', 1, CX, 36);
  ev('#drSteer', 'pointermove', 1, CX + R / 2, 36);   // cảm ứng nhẹ sang phải
  const light = read().steer;
  assert.equal(read({ steer: 1 }).steer, 1, 'phím trái hết cỡ lớn hơn cảm ứng nhẹ: giữ phím');
  assert.equal(read({ steer: -0.1 }).steer, light, 'cảm ứng lớn hơn: lấy cảm ứng');
  ev('#drSteer', 'pointerup', 1);
});

test('reset nhả hết', () => {
  ev('#drSteer', 'pointerdown', 1, CX, 36);
  ev('#drSteer', 'pointermove', 1, CX - R, 36);
  ev('#drGas', 'pointerdown', 2);
  ev('#drBrake', 'pointerdown', 3);
  t.reset();
  assert.deepEqual(read(), { gas: 0, brake: 0, steer: 0, hand: false });
  assert.equal(els['#drKnob'].style.transform, '');
  assert.ok(!els['#drGas'].classes.has('on') && !els['#drBrake'].classes.has('on'));
  ev('#drSteer', 'pointermove', 1, CX - R, 36);   // sau reset con trỏ cũ không còn điều khiển
  assert.equal(read().steer, 0);
});

test('blur cửa sổ nhả hết', () => {
  ev('#drGas', 'pointerdown', 2);
  win.dispatchEvent({ type: 'blur' });
  assert.equal(read().gas, 0);
});

test('vuốt vùng trống chuyển cho look; báo còn đó khi giữ yên', () => {
  ev('#drLook', 'pointerdown', 9, 100, 100);
  ev('#drLook', 'pointermove', 9, 90, 110);
  assert.deepEqual(looks.at(-1), [-10, 10]);
  ev('#drLook', 'pointermove', 8, 0, 0);   // con trỏ lạ
  assert.equal(looks.length, 1);
  ev('#drLook', 'pointerup', 9);
  now = 1000; ev('#drGas', 'pointerdown', 2);
  const a0 = acts;
  now += CONFIG.drive.touch.activityMs; read();
  assert.equal(acts, a0 + 1);
  read(); assert.equal(acts, a0 + 1, 'đọc lại ngay không báo thêm');
  ev('#drGas', 'pointerup', 2);
});
