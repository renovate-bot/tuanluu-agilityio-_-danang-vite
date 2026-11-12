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
   - Sơ tán (drEvacStep): cổng nhịp quay Cầu sông Hàn đóng (cầu rời CLOSED) mà thân xe còn chạm ô nhịp quay thì người chơi mất điều khiển,
     xe trượt thẳng (nội suy đều vị trí, hướng) tới chỗ đậu ngoài barie gần nhất, đi xuyên xe tự động đang xếp hàng; xong thì trả điều khiển.
     Không đi qua drMove: thân xe thiếu mặt đường ở cả 9 điểm mẫu thì đường thoát của drMove (số điểm thiếu không tăng) để xe lái tự do
     trên không. Thời gian trượt theo evac.speed, nhưng gói trong phần thời gian còn lại trước khi nhịp xoay (budget, do index.ts tính).
   Không cấp phát mỗi khung (D-018). Không import three. */
import { CONFIG } from '../../config';
import { drGround, type DrNet } from './net';
import { drSpawnPose } from './roadData';
import { drMove, drFits, type DrPose, type DrBox } from './collide';
import { SH } from '../../bridges/song-han/profile';

export interface DrState extends DrPose { pitch: number; v: number; steer: number; wheel: number; braking: boolean; evac: number; slide?: number; touch?: number; ex?: number; ey?: number; ez?: number; eyaw?: number }   // v: m/s có dấu; steer: rad; wheel: góc quay bánh tích lũy (rad); evac: s còn lại của lần sơ tán (0 = không sơ tán); slide: phần tốc độ còn giữ trong lần chạm vật cản hiện tại (1 = không chạm, mặc định); touch: s còn coi là đang chạm (mặc định 0); ex, ey, ez, eyaw: tư thế đích của lần sơ tán
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

/* ===== Sơ tán khỏi nhịp quay ===== */
const EV = CONFIG.drive.evac, HL = CAR.length / 2, HW = CAR.width / 2;
const EV_POSE: DrPose = { x: 0, y: 0, z: 0, yaw: 0 }, EV_NONE: DrBox[] = [], EV_IGN = new Uint8Array(0);
const EV_DZ = 4, EV_DX = 10, EV_STEP = 0.25;                         // m — tìm chỗ đậu: lệch ngang tối đa, lùi xa barie tối đa, bước tìm

/* Thân xe còn chạm ô mang cổng đang đóng: một trong 9 điểm mẫu nằm trong ô đó (cùng tầng) mà không có mặt đường mở nào cùng tầng */
function drOnClosedGate(net: DrNet, s: DrState): boolean {
  if (net.closed.size === 0) return false;
  const c = Math.cos(s.yaw), sn = Math.sin(s.yaw), pads = net.pads, step = CONFIG.drive.stepMax;
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const px = s.x + i * HL * c + j * HW * sn, pz = s.z - i * HL * sn + j * HW * c;
    if (!Number.isNaN(drGround(net, px, pz, s.y))) continue;
    for (let k = 0; k < pads.length; k++) {
      const p = pads[k];
      if (p.gate === undefined || !net.closed.has(p.gate) || px < p.x0 || px > p.x1 || pz < p.z0 || pz > p.z1) continue;
      if (Math.abs(p.y(px, pz) - s.y) <= step) return true;
    }
  }
  return false;
}
/* Chỗ đậu sau sơ tán, ghi vào s.ex / ey / ez / eyaw: ngoài barie gần nhất (đuôi xe cách barie evac.gap), hướng dọc cầu gần hướng xe nhất;
   thân xe phải có mặt đường đủ 9 điểm và không chồng vật cản tĩnh (hộp xe tự động không tính: đã chồng thì drMove bỏ qua).
   Lệch ngang dần tới EV_DZ, lùi xa dần tới EV_DX; bên gần không được thì thử bên kia. Không ở đâu được thì false */
function drEvacTarget(net: DrNet, s: DrState): boolean {
  const yaw = Math.cos(s.yaw) >= 0 ? 0 : Math.PI, first = s.x >= 0 ? 1 : -1;
  for (let side = first, t = 0; t < 2; t++, side = -side) {
    for (let dx = 0; dx <= EV_DX; dx += 1) for (let k = 0; k <= 2 * EV_DZ / EV_STEP; k++) {
      const x = side * (SH.barrierX + HL + EV.gap + dx), z = s.z + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * EV_STEP;
      const y = drGround(net, x, z, s.y);
      if (Number.isNaN(y)) continue;
      EV_POSE.x = x; EV_POSE.y = y; EV_POSE.z = z; EV_POSE.yaw = yaw;
      if (!drFits(net, EV_POSE, EV_NONE, 0, EV_IGN)) continue;
      s.ex = x; s.ey = y; s.ez = z; s.eyaw = yaw;
      return true;
    }
  }
  return false;
}
/* Một khung sơ tán. Chưa sơ tán: bắt đầu nếu thân xe chạm ô có cổng đóng (budget: s còn lại tới lúc nhịp bắt đầu xoay, bỏ trống = không hạn).
   Đang sơ tán: bỏ qua đầu vào, xe đứng (v = 0), nội suy đều tới chỗ đậu, hết s.evac thì tới đúng chỗ. Trả true khi khung này dành cho sơ tán */
export function drEvacStep(s: DrState, net: DrNet, dt: number, budget?: number): boolean {
  if (!(s.evac > 0)) {
    if (!drOnClosedGate(net, s)) return false;
    if (!drEvacTarget(net, s)) {                                     // không có chỗ đậu (dữ liệu sai): về chỗ xuất phát
      const c = drCreate(net, -1);
      s.x = c.x; s.y = c.y; s.z = c.z; s.yaw = c.yaw; s.pitch = c.pitch;
      s.v = 0; s.steer = 0; s.braking = false; s.slide = 1; s.touch = 0;
      return true;
    }
    const d = Math.hypot(s.ex - s.x, s.ez - s.z), want = Math.max(d / EV.speed, EV.minTime);
    s.evac = Math.max(1e-3, budget > 0 ? Math.min(want, budget * EV.share) : want);
  }
  s.v = 0; s.steer = 0; s.braking = false; s.slide = 1; s.touch = 0;
  if (!(dt > 0)) return true;
  const f = dt >= s.evac ? 1 : dt / s.evac, ox = s.x, oz = s.z;
  let dy = (s.eyaw - s.yaw) % (2 * Math.PI);
  if (dy > Math.PI) dy -= 2 * Math.PI; else if (dy < -Math.PI) dy += 2 * Math.PI;
  s.x += (s.ex - s.x) * f; s.z += (s.ez - s.z) * f; s.yaw += dy * f;
  const g = drGround(net, s.x, s.z, s.y);
  s.y = Number.isNaN(g) ? s.y + (s.ey - s.y) * f : g;               // trên ô đã đóng: nội suy cao độ
  s.evac -= dt;
  if (s.evac <= 0) { s.evac = 0; s.x = s.ex; s.y = s.ey; s.z = s.ez; s.yaw = s.eyaw; }
  s.wheel += ((s.x - ox) * Math.cos(s.yaw) - (s.z - oz) * Math.sin(s.yaw)) / (CAR.wheelDia / 2);   // bánh lăn theo quãng dọc thân xe
  drPitch(s, net);
  return true;
}

/* Bước mô phỏng cho khung dài dt (s). Đang / cần sơ tán khỏi nhịp quay thì khung dành cho sơ tán, đầu vào bỏ qua */
export function drStep(s: DrState, inp: DrInput, net: DrNet, boxes: DrBox[], nBoxes: number, dt: number): void {
  if (drEvacStep(s, net, dt)) return;
  let rem = dt;
  for (let k = 0; k < SIM.steps && rem > 1e-6; k++) {
    const h = rem < SIM.dt ? rem : SIM.dt;
    drStep1(s, inp, net, boxes, nBoxes, h);
    rem -= h;
  }
}
