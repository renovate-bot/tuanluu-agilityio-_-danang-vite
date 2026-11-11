/* ============================ Đi dạo: điều khiển cảm ứng ============================
   Ba con trỏ độc lập trên #stHud: cần gạt #stPad (ngón trái), vuốt #stLook (nửa phải, dưới các nút), nút #stJump; #stPhoto là nút bấm thường (cả máy tính).
   - Mỗi vùng chỉ theo con trỏ đã chạm vào nó (pointerId riêng + setPointerCapture), nên giữ cần gạt, vuốt camera và chạm Nhảy cùng lúc không lẫn nhau.
   - Nhảy theo cạnh: một lần chạm gọi jump() một lần (stStep nhảy lại ngay khi chạm đất nếu jump còn giữ).
   - Thả tay, pointercancel, lostpointercapture, blur, ẩn tab, xoay màn hình, đổi cỡ khung nhìn đáng kể: reset() — cần gạt về giữa, nhân vật dừng (Review Focus 2).
   - read(out) chỉ ghi đè mx / mz / run khi cần gạt đang được giữ (cảm ứng ưu tiên phím) và, khi đang giữ, báo activity() mỗi activityMs (giữ yên ngón tay không phát sự kiện); mỗi khung không cấp phát (D-018). */
import { CONFIG } from '../../config';
import { stStick } from './stick';
import type { StInput } from './motion';

export interface StTouchHandlers { look(dxPx: number, dyPx: number): void; jump(): void; photo(): void; activity(): void }

export function stTouchBind(root: HTMLElement, h: StTouchHandlers): { read(out: StInput): void; reset(): void } {
  const pad = root.querySelector<HTMLElement>('#stPad'), knob = root.querySelector<HTMLElement>('#stKnob');
  const look = root.querySelector<HTMLElement>('#stLook'), jump = root.querySelector<HTMLElement>('#stJump'), photo = root.querySelector<HTMLElement>('#stPhoto');
  const size = CONFIG.stroll.stick.size;
  root.style.setProperty('--st-pad', size + 'px');   // đường kính cần gạt lấy từ CONFIG
  let padId = -1, cx = 0, cy = 0, dx = 0, dy = 0, r = size / 2;   // cần gạt: con trỏ, tâm (px màn hình, chốt lúc chạm), độ lệch núm
  let padW = 0, padH = 1, lastAct = 0;                             // cỡ khung nhìn lúc chạm cần gạt, lần báo "còn đó" gần nhất (ms)
  let lookId = -1, lx = 0, ly = 0;                               // vuốt camera: con trỏ, vị trí trước
  let jumpId = -1;
  const own = (el: HTMLElement, e: PointerEvent) => { try { el.setPointerCapture(e.pointerId); } catch { /* con trỏ không còn hoạt động (sự kiện giả) */ } };

  const knobTo = (x: number, y: number) => { if (knob) knob.style.transform = x === 0 && y === 0 ? '' : `translate(${x}px,${y}px)`; };
  const reset = () => { padId = -1; lookId = -1; jumpId = -1; dx = 0; dy = 0; knobTo(0, 0); };

  if (pad) {
    pad.addEventListener('pointerdown', (e) => {
      if (padId >= 0) return;
      e.preventDefault();
      const b = pad.getBoundingClientRect();
      cx = b.left + b.width / 2; cy = b.top + b.height / 2; r = b.width / 2 || size / 2;
      padId = e.pointerId; padW = window.innerWidth; padH = window.innerHeight; lastAct = performance.now(); own(pad, e); h.activity();
      pad.dispatchEvent(new PointerEvent('pointermove', { pointerId: e.pointerId, clientX: e.clientX, clientY: e.clientY }));   // núm theo ngón ngay lúc chạm
    });
    pad.addEventListener('pointermove', (e) => {
      if (e.pointerId !== padId) return;
      dx = e.clientX - cx; dy = e.clientY - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > r) { dx = dx / d * r; dy = dy / d * r; }   // núm không ra khỏi vòng
      knobTo(dx, dy); h.activity();
    });
    const padEnd = (e: PointerEvent) => { if (e.pointerId === padId) { padId = -1; dx = 0; dy = 0; knobTo(0, 0); } };
    pad.addEventListener('pointerup', padEnd);
    pad.addEventListener('pointercancel', padEnd);
    pad.addEventListener('lostpointercapture', padEnd);
  }

  if (look) {
    look.addEventListener('pointerdown', (e) => {
      if (lookId >= 0) return;
      e.preventDefault();
      lookId = e.pointerId; lx = e.clientX; ly = e.clientY; own(look, e); h.activity();
    });
    look.addEventListener('pointermove', (e) => {
      if (e.pointerId !== lookId) return;
      h.look(e.clientX - lx, e.clientY - ly); h.activity();
      lx = e.clientX; ly = e.clientY;
    });
    const lookEnd = (e: PointerEvent) => { if (e.pointerId === lookId) lookId = -1; };
    look.addEventListener('pointerup', lookEnd);
    look.addEventListener('pointercancel', lookEnd);
    look.addEventListener('lostpointercapture', lookEnd);
  }

  if (jump) {
    jump.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (jumpId < 0) { jumpId = e.pointerId; own(jump, e); h.jump(); h.activity(); }   // một lần chạm một lần nhảy
    });
    const jumpEnd = (e: PointerEvent) => { if (e.pointerId === jumpId) jumpId = -1; };
    jump.addEventListener('pointerup', jumpEnd);
    jump.addEventListener('pointercancel', jumpEnd);
    jump.addEventListener('lostpointercapture', jumpEnd);
  }

  if (photo) photo.addEventListener('click', () => { h.activity(); h.photo(); });   // chuột và chạm đều ra click

  window.addEventListener('blur', reset);
  document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
  window.addEventListener('orientationchange', reset);
  /* Thanh địa chỉ điện thoại co giãn làm đổi innerHeight nhẹ: chỉ thả cần gạt khi bề rộng đổi hoặc bề cao đổi quá resizeKeep */
  window.addEventListener('resize', () => {
    if (padId < 0 || window.innerWidth !== padW || Math.abs(window.innerHeight - padH) > padH * CONFIG.stroll.stick.resizeKeep) reset();
  });

  return {
    read(out: StInput): void {
      if (padId < 0) return;
      stStick(dx, dy, r, out);
      const now = performance.now();   // giữ yên cần gạt không phát sự kiện: báo "còn đó" thưa, không cấp phát
      if (now - lastAct >= CONFIG.stroll.stick.activityMs) { lastAct = now; h.activity(); }
    },
    reset
  };
}
