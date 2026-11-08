/* ============================ Tự khám phá: mô hình bay dù lượn ============================
   Thuần toán học, không đụng cảnh. Hướng bay (cos yaw, 0, −sin yaw), cùng quy ước với `walk` trong views/camera.ts:
   yaw tăng là rẽ trái, bank > 0 là nghiêng trái. Mọi thông số ở CONFIG.explore. */
import * as THREE from 'three';
import { CONFIG } from '../config';

const C = CONFIG.explore;

export interface GliderState { pos: THREE.Vector3; yaw: number; bank: number }
export interface GliderInput { turn: -1 | 0 | 1; climb: -1 | 0 | 1 }

/* Trạng thái ban đầu tại điểm cất cánh */
export function exCreate(): GliderState {
  return { pos: new THREE.Vector3(C.takeoff[0], C.takeoff[1], C.takeoff[2]), yaw: C.takeoffYaw, bank: 0 };
}

const wrapPi = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/* Lái về tâm khung khi sát mép: trả hướng rẽ hiệu lực (−1..1) thay cho phím người chơi */
function exTurnEff(s: GliderState, turn: number): number {
  const b = C.bounds, m = C.returnMargin;
  const d = Math.min(s.pos.x - b.x0, b.x1 - s.pos.x, s.pos.z - b.z0, b.z1 - s.pos.z);   // khoảng cách ngắn nhất tới mép khung
  if (d >= m) return turn;
  const tx = (b.x0 + b.x1) / 2 - s.pos.x, tz = (b.z0 + b.z1) / 2 - s.pos.z, tl = Math.hypot(tx, tz) || 1;
  const dot = (Math.cos(s.yaw) * tx - Math.sin(s.yaw) * tz) / tl;   // hướng bay · hướng tới tâm
  if (dot >= 0.3) return turn;   // đang bay vào trong: giữ phím người chơi
  const delta = wrapPi(Math.atan2(-tz, tx) - s.yaw);   // yaw hướng tâm − yaw hiện tại
  const sg = delta >= 0 ? 1 : -1;
  if (d <= 0.25 * m) return sg;
  const w = 1 - d / m;
  return turn + (sg - turn) * w;
}

/* Một bước mô phỏng: không cấp phát */
export function exStep(s: GliderState, inp: GliderInput, dt: number): void {
  const turn = exTurnEff(s, inp.turn);
  s.bank += (turn * C.bankMax - s.bank) * Math.min(1, C.bankRate * dt);
  s.yaw += C.turnRate * (s.bank / C.bankMax) * dt;
  s.pos.x += Math.cos(s.yaw) * C.speed * dt;
  s.pos.z -= Math.sin(s.yaw) * C.speed * dt;
  s.pos.y = Math.min(C.ceiling, Math.max(C.floor, s.pos.y + inp.climb * C.climbRate * dt));
  const b = C.bounds;   // kẹp cứng: không bao giờ vượt khung
  s.pos.x = Math.min(b.x1, Math.max(b.x0, s.pos.x));
  s.pos.z = Math.min(b.z1, Math.max(b.z0, s.pos.z));
}

/* Phím giữ → đầu vào lái: A/← trái, D/→ phải, W/↑ lên, S/↓ xuống; hai phím ngược nhau triệt tiêu */
export function exInputFromKeys(keys: Set<string>, out: GliderInput = { turn: 0, climb: 0 }): GliderInput {   // out: đối tượng tái dùng cho đường khung hình (không cấp phát)
  const turn = (keys.has('a') || keys.has('arrowleft') ? 1 : 0) - (keys.has('d') || keys.has('arrowright') ? 1 : 0);
  const climb = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0);
  out.turn = turn as -1 | 0 | 1; out.climb = climb as -1 | 0 | 1;
  return out;
}
