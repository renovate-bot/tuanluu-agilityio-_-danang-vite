/* ============================ Đi dạo: đầu vào từ bàn phím (thuần) ============================
   W/↑ tới, S/↓ lùi, A/← trái, D/→ phải theo hướng camera; chéo chuẩn hóa về độ dài 1; Shift chạy. Space không điều khiển gì (đã bỏ nhảy, D-030); index.ts chỉ chặn hành vi mặc định của nó.
   Không cấp phát (gọi mỗi khung). */
import type { StInput } from './motion';

/* Tên phím chuẩn theo vị trí vật lý (e.code) để bố cục không Latin (ru, ar, th, hi) vẫn dùng được WASD / P / Shift / Space; không có code thì dùng e.key. Chỉ đi dạo dùng, phím dù lượn giữ nguyên. */
const ST_CODE_KEY: Record<string, string> = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', KeyP: 'p', ShiftLeft: 'shift', ShiftRight: 'shift', Space: ' ' };
export function stKeyName(e: { key: string; code?: string }): string {
  return (e.code && ST_CODE_KEY[e.code]) || e.key.toLowerCase();
}

export function stInputFromKeys(keys: Set<string>, camYaw: number, out: StInput): StInput {
  let f = 0, r = 0;
  if (keys.has('w') || keys.has('arrowup')) f += 1;
  if (keys.has('s') || keys.has('arrowdown')) f -= 1;
  if (keys.has('d') || keys.has('arrowright')) r += 1;
  if (keys.has('a') || keys.has('arrowleft')) r -= 1;
  const len = Math.sqrt(f * f + r * r);
  if (len > 1) { f /= len; r /= len; }
  out.mz = f; out.mx = r; out.run = keys.has('shift'); out.camYaw = camYaw;
  return out;
}
