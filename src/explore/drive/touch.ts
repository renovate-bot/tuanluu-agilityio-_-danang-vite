/* ============================ Lái xe: điều khiển cảm ứng ============================
   Bốn con trỏ độc lập trên #drHud: cần gạt ngang #drSteer (ngón trái), nút GA #drGas và PHANH #drBrake (ngón phải), vuốt #drLook (vùng trống) xoay camera.
   - Mỗi vùng chỉ theo con trỏ đã chạm vào nó (pointerId riêng + setPointerCapture), nên giữ cần gạt, đạp GA và vuốt camera cùng lúc không lẫn nhau;
     ngón trượt ra ngoài vùng vẫn giữ cho tới khi nhấc.
   - Cần gạt chỉ ngang: lấy thành phần x, bỏ thành phần dọc. Đầu ra theo quy ước của lái xe: ngón sang trái = steer > 0 (rẽ trái).
   - Thả tay, pointercancel, lostpointercapture, blur, ẩn tab, xoay màn hình, đổi cỡ khung nhìn đáng kể: reset() (Review Focus 2).
   - read(out) GỘP với đầu vào đã có (phím): lấy giá trị có độ lớn lớn hơn cho gas / brake / steer, không xóa đầu vào phím (máy lai có cả phím lẫn cảm ứng).
   - Giữ yên ngón tay không phát sự kiện nên read báo activity() mỗi activityMs khi đang giữ gì đó; mỗi khung không cấp phát (D-018). */
import { CONFIG } from '../../config';
import type { DrInput } from './motion';

export interface DrTouchHandlers { look(dxPx: number, dyPx: number): void; activity(): void }

/* Độ lệch núm dx (px, phải +) trên cần gạt bán kính hành trình r → steer (−1..1, trái +): vùng chết rồi co giãn về ±1; dx < 0 (ngón sang trái) cho steer dương */
export function drSteerFromDx(dx: number, r: number): number {
  const k = r > 0 ? Math.max(-1, Math.min(1, dx / r)) : 0, a = Math.abs(k), D = CONFIG.drive.touch.dead;
  if (a <= D) return 0;
  return -Math.sign(k) * (a - D) / (1 - D);
}

export function drTouchBind(root: HTMLElement, h: DrTouchHandlers): { read(out: DrInput): void; reset(): void } {
  const pad = root.querySelector<HTMLElement>('#drSteer'), knob = root.querySelector<HTMLElement>('#drKnob');
  const gas = root.querySelector<HTMLElement>('#drGas'), brake = root.querySelector<HTMLElement>('#drBrake'), look = root.querySelector<HTMLElement>('#drLook');
  const T = CONFIG.drive.touch;
  const sp = (k: string, v: number) => root.style.setProperty(k, v + 'px');   // kích thước các nút lấy từ CONFIG
  sp('--dr-pad-w', T.padW); sp('--dr-pad-h', T.padH); sp('--dr-knob', T.knob);
  sp('--dr-gas-w', T.gasW); sp('--dr-gas-h', T.gasH); sp('--dr-brake-w', T.brakeW); sp('--dr-brake-h', T.brakeH);
  let padId = -1, cx = 0, dx = 0, r = (T.padW - T.knob) / 2;          // cần gạt: con trỏ, tâm x (px màn hình, chốt lúc chạm), độ lệch núm, hành trình núm
  let padW = 0, padH = 1, lastAct = 0;                                  // cỡ khung nhìn lúc chạm cần gạt hoặc bàn đạp, lần báo "còn đó" gần nhất (ms)
  let gasId = -1, brakeId = -1, lookId = -1, lx = 0, ly = 0;          // hai bàn đạp, vuốt camera (vị trí trước)
  const own = (el: HTMLElement, e: PointerEvent) => { try { el.setPointerCapture(e.pointerId); } catch { /* con trỏ không còn hoạt động (sự kiện giả) */ } };
  const lit = (el: HTMLElement | null, on: boolean) => { if (el) el.classList.toggle('on', on); };
  const knobTo = (x: number) => { if (knob) knob.style.transform = x === 0 ? '' : `translateX(${x}px)`; };
  const reset = () => { padId = -1; gasId = -1; brakeId = -1; lookId = -1; dx = 0; knobTo(0); lit(gas, false); lit(brake, false); };

  if (pad) {
    pad.addEventListener('pointerdown', (e) => {
      if (padId >= 0) return;
      e.preventDefault();
      const b = pad.getBoundingClientRect();
      cx = b.left + b.width / 2; r = Math.max(1, (b.width - (knob ? knob.offsetWidth || T.knob : T.knob)) / 2);
      padId = e.pointerId; padW = window.innerWidth; padH = window.innerHeight; lastAct = performance.now(); own(pad, e); h.activity();
      pad.dispatchEvent(new PointerEvent('pointermove', { pointerId: e.pointerId, clientX: e.clientX, clientY: e.clientY }));   // núm theo ngón ngay lúc chạm
    });
    pad.addEventListener('pointermove', (e) => {
      if (e.pointerId !== padId) return;
      dx = Math.max(-r, Math.min(r, e.clientX - cx));   // chỉ thành phần ngang; núm không ra khỏi hành trình
      knobTo(dx); h.activity();
    });
    const padEnd = (e: PointerEvent) => { if (e.pointerId === padId) { padId = -1; dx = 0; knobTo(0); } };
    pad.addEventListener('pointerup', padEnd);
    pad.addEventListener('pointercancel', padEnd);
    pad.addEventListener('lostpointercapture', padEnd);
  }

  /* Bàn đạp: giữ là 1, nhả là 0 */
  const pedal = (el: HTMLElement | null, get: () => number, set: (v: number) => void) => {
    if (!el) return;
    el.addEventListener('pointerdown', (e) => {
      if (get() >= 0) return;
      e.preventDefault();
      set(e.pointerId); padW = window.innerWidth; padH = window.innerHeight; lastAct = performance.now(); own(el, e); lit(el, true); h.activity();
    });
    const end = (e: PointerEvent) => { if (e.pointerId === get()) { set(-1); lit(el, false); } };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('lostpointercapture', end);
  };
  pedal(gas, () => gasId, (v) => { gasId = v; });
  pedal(brake, () => brakeId, (v) => { brakeId = v; });

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

  root.addEventListener('contextmenu', (e) => e.preventDefault());   // giữ lâu không bật menu ngữ cảnh
  window.addEventListener('blur', reset);
  document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
  window.addEventListener('orientationchange', reset);
  /* Thanh địa chỉ điện thoại co giãn làm đổi innerHeight nhẹ: chỉ thả khi bề rộng đổi hoặc bề cao đổi quá resizeKeep (cùng ngưỡng với đi dạo) */
  window.addEventListener('resize', () => {
    if (padId < 0 && gasId < 0 && brakeId < 0) return;
    if (window.innerWidth !== padW || Math.abs(window.innerHeight - padH) > padH * CONFIG.stroll.stick.resizeKeep) reset();
  });

  return {
    read(out: DrInput): void {
      const held = padId >= 0 || gasId >= 0 || brakeId >= 0;
      if (!held) return;
      if (gasId >= 0) out.gas = 1;
      if (brakeId >= 0) out.brake = 1;
      if (padId >= 0) { const s = drSteerFromDx(dx, r); if (Math.abs(s) > Math.abs(out.steer)) out.steer = s; }
      const now = performance.now();   // giữ yên không phát sự kiện: báo "còn đó" thưa
      if (now - lastAct >= T.activityMs) { lastAct = now; h.activity(); }
    },
    reset
  };
}
