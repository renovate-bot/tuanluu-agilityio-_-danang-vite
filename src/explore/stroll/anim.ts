/* ============================ Đi dạo: chọn và trộn đoạn chuyển động của nhân vật có xương (thuần) ============================
   Từ dáng (pose) và tốc độ mặt bằng (m/s) tính trọng số năm đoạn idle / walk / jog / sprint / photo và hệ số tua `rate` cho đoạn di chuyển.
   Thuần: không import three, không đụng DOM, không cấp phát (gọi mỗi khung cho từng nhân vật, D-018): kết quả ghi vào `out` do bên gọi giữ.
   - Di chuyển (pose 1, 2 và 3 khi còn tốc độ ngang): trộn theo tốc độ, walk (≤ walkTo) → jog (jogAt) → sprint (≥ sprintFrom), tuyến tính giữa các mốc; dáng đi / chạy chỉ cho biết đang di chuyển.
   - rate = tốc độ thật / tốc độ tự nhiên của đoạn trộn, kẹp [rateMin, rateMax]: chân chạm đất gần đúng không trượt.
   - Dáng lạ (khách bản cũ, số ngoài 0..4, NaN) và rơi không còn tốc độ ngang: đứng yên (idle). Khách bản cũ gửi dáng 3 khi nhảy; người đó hiện đứng yên. */
import { CONFIG } from '../../config';
import { ST_POSE_WALK, ST_POSE_RUN, ST_POSE_FALL, ST_POSE_PHOTO } from './motion';

export const ST_CLIPS = ['idle', 'walk', 'jog', 'sprint', 'photo'] as const;
export type StClip = typeof ST_CLIPS[number];

export interface StClipMix {
  w: Float32Array;   // 5 trọng số theo thứ tự ST_CLIPS, tổng = 1
  rate: number;      // hệ số tua đoạn di chuyển
  loco: boolean;     // đang di chuyển (walk / jog / sprint có trọng số)
}

const A = CONFIG.stroll.anim;

export function stClipMix(pose: number, speed: number, natural: ArrayLike<number>, out: StClipMix): void {
  const w = out.w, v = speed > 0 ? speed : 0;
  w[0] = 0; w[1] = 0; w[2] = 0; w[3] = 0; w[4] = 0;
  out.rate = 1; out.loco = false;
  if (pose === ST_POSE_PHOTO) { w[4] = 1; return; }
  const move = pose === ST_POSE_WALK || pose === ST_POSE_RUN || (pose === ST_POSE_FALL && v >= A.fallMin);
  if (!move) { w[0] = 1; return; }
  out.loco = true;
  if (v <= A.walkTo) w[1] = 1;
  else if (v < A.jogAt) { const t = (v - A.walkTo) / (A.jogAt - A.walkTo); w[1] = 1 - t; w[2] = t; }
  else if (v < A.sprintFrom) { const t = (v - A.jogAt) / (A.sprintFrom - A.jogAt); w[2] = 1 - t; w[3] = t; }
  else w[3] = 1;
  const nat = w[1] * natural[1] + w[2] * natural[2] + w[3] * natural[3];
  const r = nat > 1e-6 ? v / nat : 1;
  out.rate = r < A.rateMin ? A.rateMin : r > A.rateMax ? A.rateMax : r;
}

/* Mô hình của slot: mình luôn mô hình 0; người khác dùng 1..others theo slot (slot âm vẫn trong khoảng) */
export function stModelFor(slot: number, isSelf: boolean): number {
  if (isSelf) return 0;
  const n = A.others;
  return 1 + (((slot % n) + n) % n);
}
