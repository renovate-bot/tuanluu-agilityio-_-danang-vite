/* ============================ Tự khám phá: mô hình bay dù lượn ============================
   Thuần toán học, không đụng cảnh. Hướng bay (cos yaw, 0, −sin yaw), cùng quy ước với `walk` trong views/camera.ts:
   yaw tăng là rẽ trái, bank > 0 là nghiêng trái. Mọi thông số ở CONFIG.explore. */
import * as THREE from 'three';
import { CONFIG } from '../config';

const C = CONFIG.explore;

export interface GliderState { pos: THREE.Vector3; yaw: number; bank: number; ret: number; speed: number }   // ret: chiều rẽ đang chốt khi lái về khung (0 = không)
export interface GliderInput { turn: -1 | 0 | 1; climb: -1 | 0 | 1; throttle?: -1 | 0 | 1 }   // throttle: E tăng tốc, Q giảm tốc; bỏ trống = giữ tốc độ

/* Trạng thái ban đầu tại điểm cất cánh */
export function exCreate(): GliderState {
  return { pos: new THREE.Vector3(C.takeoff[0], C.takeoff[1], C.takeoff[2]), yaw: C.takeoffYaw, bank: 0, ret: 0, speed: C.speed };
}

const wrapPi = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/* Lái về trong khung khi sát mép. "Hướng vào" n = tổng pháp tuyến hướng vào của các mép nằm trong returnMargin, trọng số theo độ gần.
   Đang bay ra (hướng bay · n < returnEngage) thì bỏ qua phím và lái cố định về n tới khi hướng bay · n >= returnRelease (trễ, hướng rẽ chốt trong s.ret nên không đổi dấu liên tục).
   Chiều rẽ: theo phím người chơi nếu đủ xa mép (vòng tròn bán kính ≈ speed/turnRate không đi ra quá ~2 bán kính, nên giữ A/D chỉ quay tại chỗ, không rung), sát mép (< returnShort) thì rẽ đường ngắn. */
function exTurnEff(s: GliderState, turn: number): number {
  const b = C.bounds, m = C.returnMargin;
  const dx0 = s.pos.x - b.x0, dx1 = b.x1 - s.pos.x, dz0 = s.pos.z - b.z0, dz1 = b.z1 - s.pos.z;
  const d = Math.min(dx0, dx1, dz0, dz1);   // khoảng cách ngắn nhất tới mép khung
  if (d >= m) { s.ret = 0; return turn; }
  const nx = (dx0 < m ? 1 - dx0 / m : 0) - (dx1 < m ? 1 - dx1 / m : 0);   // +X là vào trong khi gần mép x0
  const nz = (dz0 < m ? 1 - dz0 / m : 0) - (dz1 < m ? 1 - dz1 / m : 0);
  const nl = Math.hypot(nx, nz) || 1;
  const dot = (Math.cos(s.yaw) * nx - Math.sin(s.yaw) * nz) / nl;   // hướng bay · hướng vào
  if (s.ret !== 0) { if (dot >= C.returnRelease) { s.ret = 0; return turn; } return s.ret; }
  else if (dot >= C.returnEngage) return turn;
  else {
    const delta = wrapPi(Math.atan2(-nz, nx) - s.yaw);   // yaw hướng vào − yaw hiện tại (>0: rẽ trái là đường ngắn)
    s.ret = turn !== 0 && d >= C.returnShort ? turn : (delta >= 0 ? 1 : -1);
  }
  return s.ret;
}

/* Một bước mô phỏng: không cấp phát */
export function exStep(s: GliderState, inp: GliderInput, dt: number): void {
  s.speed = Math.min(C.speedMax, Math.max(C.speedMin, s.speed + (inp.throttle ?? 0) * C.speedAccel * dt));
  const turn = exTurnEff(s, inp.turn);
  const sharpen = s.ret !== 0 ? Math.max(1, s.speed / C.returnTurnSpeed) : 1;   // đang tự lái về: bay nhanh vẫn giữ bán kính vòng về, không lao vào mép
  s.bank += (turn * C.bankMax - s.bank) * Math.min(1, C.bankRate * sharpen * dt);
  s.yaw += C.turnRate * sharpen * (s.bank / C.bankMax) * dt;
  s.pos.x += Math.cos(s.yaw) * s.speed * dt;
  s.pos.z -= Math.sin(s.yaw) * s.speed * dt;
  s.pos.y = Math.min(C.ceiling, Math.max(C.floor, s.pos.y + inp.climb * C.climbRate * dt));
  const b = C.bounds;   // kẹp cứng: không bao giờ vượt khung
  s.pos.x = Math.min(b.x1, Math.max(b.x0, s.pos.x));
  s.pos.z = Math.min(b.z1, Math.max(b.z0, s.pos.z));
}

/* Phím giữ → đầu vào lái: A/← trái, D/→ phải, W/↑ lên, S/↓ xuống, E tăng tốc, Q giảm tốc; hai phím ngược nhau triệt tiêu */
export function exInputFromKeys(keys: Set<string>, out: GliderInput = { turn: 0, climb: 0, throttle: 0 }): GliderInput {   // out: đối tượng tái dùng cho đường khung hình (không cấp phát)
  const turn = (keys.has('a') || keys.has('arrowleft') ? 1 : 0) - (keys.has('d') || keys.has('arrowright') ? 1 : 0);
  const climb = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0);
  out.turn = turn as -1 | 0 | 1; out.climb = climb as -1 | 0 | 1; out.throttle = ((keys.has('e') ? 1 : 0) - (keys.has('q') ? 1 : 0)) as -1 | 0 | 1;
  return out;
}
