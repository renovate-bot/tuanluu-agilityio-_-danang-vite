import { CONFIG } from '../config';
import { device } from './device';
import { sun, setShadowQuality, stepShadows } from './lights';
import { reflectState } from './water';
import { clouds } from './sky';
import { bloomState, setPixelRatio, onResize } from './postprocessing';
import { lightsWarming } from './prewarm';
import { rainShowing } from '../environment/weather/rain';

/* =====================================================================
   CHẤT LƯỢNG HÌNH (D-018) — thang bậc ở CONFIG.perf.steps (0 = cảnh gốc). Chế độ:
   - 'auto': đo thời gian khung trung bình; chậm (> downMs) thì hạ một bậc, nhanh (< upMs) đủ lâu thì nâng một bậc.
   - 'high' | 'medium' | 'low': đứng yên ở bậc tương ứng (CONFIG.perf.manual).
   Khi chạy chỉ đổi những thứ không làm biên dịch lại shader: pixelRatio, cỡ shadow map, chu kỳ vẽ bóng / phản chiếu, độ phân giải bloom, số tấm mây.
   ?test: luôn bậc 0 và không tự đổi (bảng draw call chuẩn), trừ khi test gọi set().
   ===================================================================== */
export type QualityMode = 'auto' | 'high' | 'medium' | 'low';
type Step = (typeof CONFIG.perf.steps)[number];
const P = CONFIG.perf, STORE = 'dn3d-quality';

const loadMode = (): QualityMode => {
  if (device.test) return 'high';
  try { const v = localStorage.getItem(STORE); if (v === 'auto' || v === 'high' || v === 'medium' || v === 'low') return v; } catch { /* trình duyệt chặn lưu trữ */ }
  return 'auto';
};
const startStep = (mode: QualityMode) => mode === 'auto' ? (device.phone ? P.start.phone : device.weak ? P.start.weak : 0) : P.manual[mode];

let busy: () => boolean = () => false;
let winSum = 0, winN = 0, winT = 0, fastT = 0, lastChange = 0, last = 0;
let appliedStep: Step | null = null, appliedRatio = 0;

export const quality = {
  mode: loadMode(),
  step: 0,
  changes: 0,                // số lần đã đổi bậc (test)
  adapt: { ...P.adapt },     // bản sao chỉnh được (test rút ngắn cửa sổ / thời gian giữ)
  simulateMs: 0,             // > 0: thay thời gian khung đo được bằng số này (test giả lập máy chậm / nhanh; bật cả khi ?test)
  /* Gọi một lần lúc khởi động, TRƯỚC prewarm: điện thoại ở bậc Thấp thì tắt castShadow từ đầu (đỡ lấy mẫu bóng; xem lights.ts) */
  init(isBusy?: () => boolean) {
    if (isBusy) busy = isBusy;
    this.step = startStep(this.mode);
    if (device.phone && P.steps[this.step].shadow === 0) sun.castShadow = false;
    this.apply(true);
  },
  /* Đổi chế độ (ô chọn / test). Lưu lựa chọn (trừ ?test) */
  set(mode: QualityMode) {
    this.mode = mode;
    if (!device.test) try { localStorage.setItem(STORE, mode); } catch { /* bỏ qua */ }
    this.step = startStep(mode); fastT = 0; winSum = winN = 0; winT = 0;
    this.apply(true);
  },
  current(): Step { return P.steps[this.step]; },
  /* Áp bậc hiện tại (pixelRatio có tính giới hạn khi mưa) */
  apply(force = false) {
    const s = P.steps[this.step], rainCap = rainShowing() ? P.rainMaxRatio : Infinity;
    const ratio = Math.min(window.devicePixelRatio || 1, s.ratio, rainCap);
    if (!force && s === appliedStep && ratio === appliedRatio) return;   // so sánh trực tiếp: hàm chạy mỗi khung, không tạo chuỗi
    appliedStep = s; appliedRatio = ratio; this.changes++;
    setShadowQuality(s.shadow, s.shadowEvery);
    reflectState.every = s.reflectEvery;
    clouds.count = Math.min(s.clouds, clouds.instanceMatrix.count);
    const bloomChanged = bloomState.scale !== s.bloom;
    bloomState.scale = s.bloom;
    setPixelRatio(ratio);
    if (bloomChanged) onResize();   // cỡ bloom theo bloomState.scale
  },
  /* Mỗi khung, trước khi vẽ. now = performance.now() */
  update(now: number) {
    const dtMs = last ? now - last : 0; last = now;
    this.apply();   // mưa bật/tắt đổi giới hạn pixelRatio
    stepShadows();
    const A = this.adapt, ms = this.simulateMs || dtMs;
    if (this.mode !== 'auto' || (device.test && !this.simulateMs) || !ms || ms > (lightsWarming() ? Math.min(A.ignoreMs, P.lightWarmIgnoreMs) : A.ignoreMs) || document.hidden) return;
    winSum += ms; winN++; winT += ms / 1000;
    if (winT < A.window) return;
    const avg = winSum / winN, sinceChange = (now - lastChange) / 1000;
    winSum = winN = 0; winT = 0;
    fastT = avg < A.upMs ? fastT + A.window : 0;
    if (busy() || sinceChange < A.cooldown) return;
    let next = this.step;
    if (avg > A.downMs && this.step < P.steps.length - 1) next = this.step + 1;
    else if (fastT >= A.upHold && this.step > 0) { next = this.step - 1; fastT = 0; }
    if (next === this.step) return;
    this.step = next; lastChange = now; this.apply();
  }
};
