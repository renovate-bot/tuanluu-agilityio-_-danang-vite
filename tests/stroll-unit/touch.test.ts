/* ===== Đi dạo: cần gạt cảm ứng giữ yên vẫn báo "còn đó", đổi cỡ khung nhìn nhẹ không thả cần gạt (src/explore/stroll/touch.ts) ===== */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../src/config.ts';

/* Giả DOM tối thiểu: phần tử lưu các hàm nghe, dispatchEvent gọi lại đúng loại sự kiện */
class FakeEl {
  handlers: Record<string, ((e: any) => void)[]> = {};
  style = { setProperty() {}, transform: '' };
  addEventListener(type: string, fn: (e: any) => void) { (this.handlers[type] ||= []).push(fn); }
  dispatchEvent(e: any) { (this.handlers[e.type] || []).forEach((fn) => fn(e)); return true; }
  setPointerCapture() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: 120, height: 120 }; }
}
const els: Record<string, FakeEl> = {};
const root = { style: { setProperty() {} }, querySelector: (s: string) => (els[s] ||= new FakeEl()) };
const win = new FakeEl() as any; win.innerWidth = 400; win.innerHeight = 800;
(globalThis as any).window = win;
(globalThis as any).document = new FakeEl();
(globalThis as any).PointerEvent = class { constructor(public type: string, init: any) { Object.assign(this, init); } };
let now = 0;
Object.defineProperty(globalThis, 'performance', { value: { now: () => now }, configurable: true });
const { stTouchBind } = await import('../../src/explore/stroll/touch.ts');

let acts = 0;
const t = stTouchBind(root as any, { look() {}, photo() {}, activity() { acts++; } });
const out = { mx: 0, mz: 0, run: false, camYaw: 0 };
const down = () => els['#stPad'].dispatchEvent({ type: 'pointerdown', pointerId: 1, clientX: 60, clientY: 10, preventDefault() {} });
const resize = () => win.dispatchEvent({ type: 'resize' });
const held = () => { out.mz = 0; t.read(out); return out.mz !== 0 || out.mx !== 0; };

test('giữ yên cần gạt: báo còn đó thưa, mỗi activityMs một lần', () => {
  now = 5000; down();
  const a0 = acts;
  for (let i = 0; i < 20; i++) { now += 16; t.read(out); }   // 320 ms: chưa tới hạn
  assert.equal(acts, a0, 'chưa tới activityMs thì chưa báo');
  now += CONFIG.stroll.stick.activityMs; t.read(out);
  assert.equal(acts, a0 + 1);
  t.read(out);
  assert.equal(acts, a0 + 1, 'đọc lại ngay không báo thêm');
  now += CONFIG.stroll.stick.activityMs; t.read(out);
  assert.equal(acts, a0 + 2);
  t.reset();
});

test('không giữ cần gạt: read không báo', () => {
  const a0 = acts; now += 10000; t.read(out);
  assert.equal(acts, a0);
});

test('đổi bề cao nhẹ (thanh địa chỉ) không thả cần gạt; đổi bề rộng hoặc bề cao lớn thì thả', () => {
  down(); assert.equal(held(), true);
  win.innerHeight = 800 - 40; resize();   // 5 % < resizeKeep
  assert.equal(held(), true, 'đổi 5 % bề cao: vẫn giữ');
  win.innerHeight = 800 - 200; resize();   // 25 %
  assert.equal(held(), false, 'đổi 25 % bề cao: thả');
  win.innerHeight = 800; down(); assert.equal(held(), true);
  win.innerWidth = 401; resize();
  assert.equal(held(), false, 'đổi bề rộng: thả');
  win.innerWidth = 400; down(); assert.equal(held(), true);
  win.dispatchEvent({ type: 'orientationchange' });
  assert.equal(held(), false, 'xoay màn hình: luôn thả');
});
