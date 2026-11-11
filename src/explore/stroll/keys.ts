/* ============================ Đi dạo: đầu vào từ bàn phím (thuần) ============================
   W/↑ tới, S/↓ lùi, A/← trái, D/→ phải theo hướng camera; chéo chuẩn hóa về độ dài 1; Shift chạy; Space nhảy.
   Nhảy ở đây chỉ phản ánh phím đang giữ: index.ts biến nó thành một lần nhảy mỗi lần bấm (stStep nhảy mỗi khung jump = true khi chạm đất).
   Không cấp phát (gọi mỗi khung). */
import type { StInput } from './motion';

export function stInputFromKeys(keys: Set<string>, camYaw: number, out: StInput): StInput {
  let f = 0, r = 0;
  if (keys.has('w') || keys.has('arrowup')) f += 1;
  if (keys.has('s') || keys.has('arrowdown')) f -= 1;
  if (keys.has('d') || keys.has('arrowright')) r += 1;
  if (keys.has('a') || keys.has('arrowleft')) r -= 1;
  const len = Math.sqrt(f * f + r * r);
  if (len > 1) { f /= len; r /= len; }
  out.mz = f; out.mx = r; out.run = keys.has('shift'); out.jump = keys.has(' '); out.camYaw = camYaw;
  return out;
}
