/* ============================ Lái xe: chuyển động theo số liệu VF 3 ============================
   Mô hình "xe đạp" động học trên mặt bằng (spec §5.2): vị trí, hướng, tốc độ dọc có dấu, góc lái; không mô phỏng lốp, treo, trượt.
   - Tăng tốc: a = a0 không đổi tới 50 km/h (a0 = 50 km/h / t50, qua đúng mốc thứ nhất), sau đó a = a0 · v50 / v · (1 − u^k)
     với u = (v − v50) / (vMax − v50): giảm theo công suất không đổi và về 0 tại vMax. Số mũ k giải một lần (chia đôi) sao cho tới
     99 % vMax (27,5 m/s ≈ 100 km/h, vì đường cong chỉ tiệm cận vMax) đúng t100.
   - Lái: góc lái lớn nhất asin(wheelbase / turnRadius) (bán kính quay vòng tính ở tâm trục trước); tốc độ cao thì giới hạn thêm
     sao cho gia tốc ngang v² · tan(góc) / wheelbase ≤ latMax. Góc lái tiến về đích theo steerRate, tự trả về 0 theo steerReturn
     (cả hai là phần góc lái lớn nhất mỗi giây).
   - Phanh / lùi: phanh khi đang tiến; |v| < sim.revV mà giữ phanh, không ga thì lùi dần tới reverseMax; đang lùi mà đạp ga thì phanh
     về 0 rồi mới tiến. Nhả hết thì chậm dần theo coast, không tự lùi. Phanh tay hãm handBrake, không trượt. Dốc không đổi gia tốc.
   - drStep chia dt thành bước ≤ sim.dt (tối đa sim.steps bước, phần dư bỏ); mỗi bước dời thân xe bằng drMove (collide.ts);
     bị chặn thì mất phần tốc độ hướng vào vật cản một lần (đâm thẳng thì đứng hẳn, cọ chéo còn phần chiếu dọc vật cản),
     đang cọ thì hãm thêm perf.scrape (m/s²); kết quả không phụ thuộc tần số khung.
   Không cấp phát mỗi khung (D-018). Không import three. */
import { CONFIG } from '../../config';
import { drGround, type DrNet } from './net';
import { drSpawnPose } from './roadData';
import { drMove, type DrPose, type DrBox } from './collide';

export interface DrState extends DrPose { pitch: number; v: number; steer: number; wheel: number; braking: boolean; evac: number; slide?: number; touch?: number }   // v: m/s có dấu; steer: rad; wheel: góc quay bánh tích lũy (rad); slide: phần tốc độ còn giữ trong lần chạm vật cản hiện tại (1 = không chạm, mặc định); touch: s còn coi là đang chạm (mặc định 0)
export interface DrInput { gas: number; brake: number; steer: number; hand: boolean }   // gas, brake: 0..1; steer: −1..1

const CAR = CONFIG.drive.car, P = CONFIG.drive.perf, SIM = CONFIG.drive.sim;
const L = CAR.wheelbase;
const V50 = 50 / 3.6;                                                // m/s — mốc 0–50 km/h của t50
const STEER_GEOM = Math.asin(L / P.turnRadius);                     // rad — góc lái lớn nhất theo hình học

/* ===== Đường cong tăng tốc ===== */
let A0 = NaN, KEXP = NaN;                                            // a0 (m/s²) và số mũ k, giải lười ở lần gọi đầu
function drAccelK(v: number, k: number): number {
  if (v <= V50) return A0;
  if (v >= P.vMax) return 0;
  const u = (v - V50) / (P.vMax - V50);
  return A0 * V50 / v * (1 - Math.pow(u, k));
}
/* Thời gian 0 → 0,99 vMax với số mũ k (tích phân dv / a, điểm giữa) */
function drT100(k: number): number {
  const vt = 0.99 * P.vMax, N = 2000, h = (vt - V50) / N;
  let t = V50 / A0;
  for (let i = 0; i < N; i++) t += h / drAccelK(V50 + (i + 0.5) * h, k);
  return t;
}
function drFitAccel(): void {
  A0 = V50 / P.t50;
  let lo = 0.2, hi = 50;                                             // k nhỏ ⇒ hãm sớm ⇒ chậm hơn: drT100 giảm theo k
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (drT100(m) > P.t100) lo = m; else hi = m; }
  KEXP = (lo + hi) / 2;
}
/* m/s² khi đạp hết ga ở tốc độ v ≥ 0 */
export function drAccel(v: number): number {
  if (Number.isNaN(KEXP)) drFitAccel();
  return drAccelK(v, KEXP);
}

/* rad — góc lái lớn nhất ở tốc độ v (dấu bỏ qua) */
export function drSteerMax(v: number): number {
  const a = Math.abs(v);
  if (a < 1e-6) return STEER_GEOM;
  const lim = Math.atan(L * P.latMax / (a * a));
  return lim < STEER_GEOM ? lim : STEER_GEOM;
}

const drToward0 = (v: number, d: number): number => v > 0 ? (v > d ? v - d : 0) : (v < -d ? v + d : 0);

/* Dốc dọc từ cao độ mặt đường tại trục trước / sau; giữ giá trị cũ nếu một trục không có mặt đường cùng tầng */
function drPitch(s: DrState, net: DrNet): void {
  const fx = Math.cos(s.yaw) * L / 2, fz = -Math.sin(s.yaw) * L / 2;
  const yf = drGround(net, s.x + fx, s.z + fz, s.y), yr = drGround(net, s.x - fx, s.z - fz, s.y);
  if (!Number.isNaN(yf) && !Number.isNaN(yr)) s.pitch = Math.atan2(yf - yr, L);
}

/* Xe mới ở chỗ xuất phát của slot, đứng yên trên mặt đường cao nhất tại đó (mặt cầu) */
export function drCreate(net: DrNet, slot: number): DrState {
  const sp = drSpawnPose(slot);
  let y = -Infinity;
  for (const p of net.pads) {
    if (sp.x < p.x0 || sp.x > p.x1 || sp.z < p.z0 || sp.z > p.z1) continue;
    if (p.gate !== undefined && net.closed.has(p.gate)) continue;
    y = Math.max(y, p.y(sp.x, sp.z));
  }
  const s: DrState = { x: sp.x, y: Number.isFinite(y) ? y : CONFIG.roadY, z: sp.z, yaw: sp.yaw, pitch: 0, v: 0, steer: 0, wheel: 0, braking: false, evac: 0, slide: 1, touch: 0 };
  drPitch(s, net);
  return s;
}

const MOVED: DrPose = { x: 0, y: 0, z: 0, yaw: 0 };

/* Một bước h ≤ sim.dt */
function drStep1(s: DrState, inp: DrInput, net: DrNet, boxes: DrBox[], nBoxes: number, h: number): void {
  const g = inp.gas > 0 ? (inp.gas < 1 ? inp.gas : 1) : 0, b = inp.brake > 0 ? (inp.brake < 1 ? inp.brake : 1) : 0;
  let v = s.v, braking = false;
  /* tốc độ */
  if (inp.hand) { v = drToward0(v, P.handBrake * h); braking = true; }
  else if (b > 0 && g === 0) {
    if (v >= SIM.revV) { v = Math.max(0, v - b * P.brake * h); braking = true; }                       // đang tiến: phanh
    else v = Math.max(-P.reverseMax, v - b * (v > 0 ? P.brake : drAccel(-v)) * h);                   // gần đứng / đang lùi: lùi dần
  } else if (g > 0 && b === 0) {
    if (v < 0) { v = Math.min(0, v + g * P.brake * h); braking = true; }                             // đang lùi: phanh về 0 rồi mới tiến
    else v = Math.min(P.vMax, v + g * drAccel(v) * h);
  } else if (g > 0 && b > 0) { v = drToward0(v, b * P.brake * h); braking = true; }
  else v = drToward0(v, P.coast * h);
  /* góc lái */
  const lim = drSteerMax(v), want = inp.steer > 1 ? 1 : inp.steer < -1 ? -1 : inp.steer;
  let st = s.steer;
  if (want === 0) st = drToward0(st, P.steerReturn * STEER_GEOM * h);
  else {
    const tgt = want * lim, back = Math.abs(tgt) < Math.abs(st) || tgt * st < 0;
    const d = (back ? Math.max(P.steerRate, P.steerReturn) : P.steerRate) * STEER_GEOM * h;
    st = st < tgt ? Math.min(tgt, st + d) : Math.max(tgt, st - d);
  }
  if (st > lim) st = lim; else if (st < -lim) st = -lim;
  /* dời thân xe */
  const dist = v * h, f = drMove(net, s, dist, dist * Math.tan(st) / L, boxes, nBoxes, MOVED);
  s.x = MOVED.x; s.y = MOVED.y; s.z = MOVED.z; s.yaw = MOVED.yaw;
  /* va chạm: phần quãng f là cos² góc giữa hướng trượt và hướng xe, nên √f là phần tốc độ chiếu theo hướng trượt.
     Chỉ mất phần hướng vào vật cản khi √f xuống dưới mức nhỏ nhất đã mất trong lần chạm này (slide), không lặp lại mỗi bước
     khi vẫn tì vào; đang cọ thì hãm thêm perf.scrape; không bị chặn quá sim.touch giây thì coi như đã rời vật cản. */
  let slide = s.slide ?? 1, touch = s.touch ?? 0;
  if (f < 1) {
    if (touch > 0) v = drToward0(v, P.scrape * h);                   // đang cọ: hãm thêm
    const q = f > 0 ? Math.sqrt(f) : 0;
    if (q === 0) v = 0;                                              // đứng hẳn: đâm thẳng, hoặc tì thẳng vào mà vẫn đạp ga
    else if (q < slide) v *= q / slide;
    if (q < slide) slide = q;
    touch = SIM.touch;
  } else if (touch > 0) { touch -= h; if (touch <= 0) { touch = 0; slide = 1; } }
  s.slide = slide; s.touch = touch;
  s.v = v; s.steer = st; s.braking = braking;
  s.wheel += dist * f / (CAR.wheelDia / 2);
  drPitch(s, net);
}

/* Bước mô phỏng cho khung dài dt (s) */
export function drStep(s: DrState, inp: DrInput, net: DrNet, boxes: DrBox[], nBoxes: number, dt: number): void {
  let rem = dt;
  for (let k = 0; k < SIM.steps && rem > 1e-6; k++) {
    const h = rem < SIM.dt ? rem : SIM.dt;
    drStep1(s, inp, net, boxes, nBoxes, h);
    rem -= h;
  }
}
