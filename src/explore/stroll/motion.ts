/* ============================ Đi dạo: chuyển động nhân vật (thuần) ============================
   Mỗi khung: đọc đầu vào, đổi tốc độ / hướng mặt, đi qua stMove (va chạm), bám cao độ đứng, chọn dáng (pose).
   Thuần: không import three, không đụng DOM. stStep chạy mỗi khung nên không cấp phát (D-018): dùng đối tượng tạm cấp module.
   - dt kẹp về dtMax: khung rất dài (tab ẩn rồi quay lại) không làm nhân vật vọt qua tường, chỉ chậm đi một khung.
   - Hướng: tới = (cos yaw, 0, −sin yaw), yaw tăng là quay trái (như flight.ts).
   - Cổng nhịp quay đóng dưới chân (vị trí không còn hợp lệ): stMove đóng băng khi điểm xuất phát không hợp lệ, nên sơ tán KHÔNG dùng stMove:
     tính một lần điểm hợp lệ gần nhất (stNearestValid, đắt), rồi đi thẳng tới đó với tốc độ chạy, bỏ qua đầu vào; tới nơi thì trả điều khiển. */
import { CONFIG } from '../../config';
import { stMove, stValid, stGroundY, stNearestValid, type StMap } from './map';
import { stSpawn } from './mapData';

export const ST_POSE_IDLE = 0, ST_POSE_WALK = 1, ST_POSE_RUN = 2, ST_POSE_FALL = 3, ST_POSE_PHOTO = 4;   // 3 = rơi (trên mạng giữ giá trị cũ của dáng nhảy; khách bản cũ còn gửi 3 khi nhảy)

export interface StState {
  x: number; y: number; z: number;   // y: cao độ chân tuyệt đối, m
  yaw: number; speed: number;        // speed: tốc độ mặt bằng, m/s
  vy: number; air: boolean;          // vy: vận tốc đứng, m/s
  pose: number; evac: boolean;
  photo: number;                     // giây còn giơ tay chụp
  tx: number; tz: number;            // điểm sơ tán đã tính (chỉ có nghĩa khi evac)
}
export interface StInput { mx: number; mz: number; run: boolean; camYaw: number }

const EPS_STEP = 1e-3;      // dung sai khi so bậc cao độ với stepMax (bậc Cầu Rồng lề ↔ bờ đo 0,3500083), m
const V_STOP = 0.1;         // m/s — dưới mức này coi là đứng yên
const _mv = { x: 0, z: 0 };      // kết quả stMove
const _near = { x: 0, z: 0 };    // kết quả stNearestValid

export function stCreate(map: StMap, slot: number): StState {
  const p = { x: 0, z: 0 };
  stSpawn(map, slot, p);
  const g = stGroundY(map, p.x, p.z);
  return { x: p.x, y: g === g ? g : CONFIG.roadY, z: p.z, yaw: CONFIG.stroll.spawnYaw, speed: 0, vy: 0, air: false, pose: ST_POSE_IDLE, evac: false, photo: 0, tx: p.x, tz: p.z };
}

export function stPhotoPose(s: StState): void { s.photo = CONFIG.stroll.photoHold; }

/* quay yaw về đích theo đường ngắn nhất, tốc độ mũ turn (1/s) */
function stTurn(yaw: number, target: number, turn: number, dt: number): number {
  let d = (target - yaw) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI; else if (d < -Math.PI) d += 2 * Math.PI;
  const k = turn * dt;
  return yaw + d * (k < 1 ? k : 1);
}

/* Sơ tán: đi thẳng tới (tx, tz) với tốc độ chạy, mỗi khung không quá run × dt */
function stEvacStep(s: StState, map: StMap, dt: number): void {
  const C = CONFIG.stroll, dx = s.tx - s.x, dz = s.tz - s.z, dist = Math.sqrt(dx * dx + dz * dz), step = C.run * dt;
  s.photo = 0; s.speed = C.run; s.pose = ST_POSE_RUN;
  if (dist > 1e-9) s.yaw = stTurn(s.yaw, Math.atan2(-dz, dx), C.turn, dt);
  if (dist <= step) { s.x = s.tx; s.z = s.tz; s.evac = false; s.speed = 0; s.pose = ST_POSE_IDLE; }
  else { s.x += dx / dist * step; s.z += dz / dist * step; }
  const g = stGroundY(map, s.x, s.z);
  if (g === g) s.y = g;                                  // ngoài mọi vùng (cổng đóng): giữ cao độ cũ
  s.air = false; s.vy = 0;
}

export function stStep(s: StState, inp: StInput, map: StMap, dt: number): void {
  const C = CONFIG.stroll;
  if (!(dt > 0)) return;
  if (dt > C.dtMax) dt = C.dtMax;

  /* 1) vị trí không còn hợp lệ với tường cao / vùng (tường thấp không tính: đáp xuống giữa tường thấp là chuyện của stMove) */
  if (!s.evac && !stValid(map, s.x, s.z, Infinity)) {
    s.evac = true;
    if (!stNearestValid(map, s.x, s.z, _near)) stSpawn(map, -1, _near);
    s.tx = _near.x; s.tz = _near.z;
  }
  if (s.evac) { stEvacStep(s, map, dt); return; }

  /* 2) hướng đi và tốc độ đích */
  const sc = Math.sin(inp.camYaw), cc = Math.cos(inp.camYaw);
  const dx = inp.mz * cc + inp.mx * sc, dz = -inp.mz * sc + inp.mx * cc;
  let len = Math.sqrt(dx * dx + dz * dz);
  const moving = len > 1e-6;
  if (len > 1) len = 1;
  const target = moving ? (inp.run ? C.run : C.walk) * len : 0;
  const da = C.accel * dt;
  if (s.speed < target) s.speed = s.speed + da < target ? s.speed + da : target;
  else s.speed = s.speed - da > target ? s.speed - da : target;
  let hx: number, hz: number;                            // hướng di chuyển: theo đầu vào; thả tay thì trượt theo hướng mặt đang hãm
  if (moving) { hx = dx / Math.sqrt(dx * dx + dz * dz); hz = dz / Math.sqrt(dx * dx + dz * dz); s.yaw = stTurn(s.yaw, Math.atan2(-hz, hx), C.turn, dt); }
  else { hx = Math.cos(s.yaw); hz = -Math.sin(s.yaw); }

  /* 3) đi (feet: độ cao chân trên cao độ đứng chỗ đang đứng) */
  const g0 = stGroundY(map, s.x, s.z);
  const feet = s.air && g0 === g0 ? Math.max(0, s.y - g0) : 0;
  const dist = s.speed * dt;
  stMove(map, s.x, s.z, hx * dist, hz * dist, feet, _mv);
  s.x = _mv.x; s.z = _mv.z;

  /* 4) cao độ */
  const g = stGroundY(map, s.x, s.z);
  if (s.air) {
    const ny = s.y + s.vy * dt - 0.5 * C.gravity * dt * dt;
    s.vy -= C.gravity * dt;
    if (g === g && ny <= g) {                            // chạm đất
      s.y = g; s.vy = 0; s.air = false;
      if (!stValid(map, s.x, s.z, 0) && stNearestValid(map, s.x, s.z, _near)) { s.x = _near.x; s.z = _near.z; const g2 = stGroundY(map, s.x, s.z); if (g2 === g2) s.y = g2; }   // đáp giữa tường thấp: đẩy ra mép gần nhất
    } else s.y = ny;
  } else if (g === g) {
    if (s.y - g > C.stepMax + EPS_STEP) { s.air = true; s.vy = 0; }   // bước xuống quá bậc: rơi
    else s.y = g;
  }

  /* 5) dáng */
  if (s.photo > 0) { if (moving || s.air) s.photo = 0; else { s.photo -= dt; if (s.photo < 0) s.photo = 0; } }
  const still = s.speed < V_STOP && !moving;
  if (s.air) s.pose = ST_POSE_FALL;
  else if (s.photo > 0 && still) s.pose = ST_POSE_PHOTO;
  else if (s.speed < V_STOP) s.pose = ST_POSE_IDLE;
  else s.pose = s.speed > (C.walk + C.run) * 0.5 ? ST_POSE_RUN : ST_POSE_WALK;
}
