/* ============================ Đi dạo: camera sau lưng ============================
   Camera quay quanh tâm xoay ở độ cao `cam.height` trên chân nhân vật, lùi `dist` theo yaw / pitch người chơi chọn (không tự quay theo nhân vật),
   nhìn vào điểm `cam.look` trên chân. Tâm xoay trễ `lag` giây theo nhân vật cho chuyển động mềm.
   Tránh vật cản bằng bản đồ 2D (spec §3 mục 4): đoạn mặt bằng từ TÂM NHÂN VẬT (vị trí thật, luôn hợp lệ) tới chỗ camera muốn đứng cắt bởi stSegClear
   (tường cao vô hạn + mép vùng đi được), lùi thêm `gap`. Tường là cao vô hạn nên camera bị kéo lại gần thì nâng lên cho khoảng cách 3D tới tâm xoay
   vẫn ≥ minDist (= max(minDist, dist × phần đi được) của plan, tính theo 3D): camera không bao giờ ra ngoài đoạn đã kiểm, nên không chui vào nhà.
   Khoảng mặt bằng cho phép co lại ngay, nở ra theo `lag` (không giật khi vừa thoát góc tường).
   Cuối cùng kẹp độ cao: ≥ cao độ đứng tại chỗ camera + 0,3 m, ngoài vùng thì ≥ landY. Không cấp phát (D-018). */
import * as THREE from 'three';
import { CONFIG } from '../../config';
import { stSegClear, stGroundY, type StMap } from './map';

export interface StCam { yaw: number; pitch: number }

const ST_CAM_FLOOR = 0.3;   // m — camera cao hơn cao độ đứng tại chỗ nó ít nhất chừng này (plan Task 6)
const piv = { x: 0, y: 0, z: 0, ok: false };   // tâm xoay đã trễ
let reach = Infinity;                           // khoảng mặt bằng camera đang được phép lùi, m

export function stCamPlace(camera: THREE.PerspectiveCamera, target: THREE.Vector3, s: { x: number; y: number; z: number }, c: StCam, map: StMap, dt: number, snap?: boolean): void {
  const K = CONFIG.stroll.cam;
  /* 1) tâm xoay trễ theo nhân vật */
  const hy = s.y + K.height;
  if (snap || !piv.ok) { piv.x = s.x; piv.y = hy; piv.z = s.z; piv.ok = true; }
  else if (dt > 0) { const k = 1 - Math.exp(-dt / K.lag); piv.x += (s.x - piv.x) * k; piv.y += (hy - piv.y) * k; piv.z += (s.z - piv.z) * k; }
  /* 2) chỗ camera muốn đứng: lùi dist theo yaw / pitch */
  const cp = Math.cos(c.pitch), sp = Math.sin(c.pitch), fx = Math.cos(c.yaw), fz = -Math.sin(c.yaw);
  const bx = piv.x - fx * K.dist * cp, bz = piv.z - fz * K.dist * cp;
  let cy = piv.y + K.dist * sp;
  /* 3) cắt theo bản đồ từ tâm nhân vật */
  let dx = bx - s.x, dz = bz - s.z;
  const L = Math.sqrt(dx * dx + dz * dz);
  if (L > 1e-6) { dx /= L; dz /= L; } else { dx = -fx; dz = -fz; }
  const t = L > 1e-6 ? stSegClear(map, s.x, s.z, bx, bz) : 1;
  let allow = t >= 1 ? L : L * t - K.gap;
  if (allow < 0) allow = 0;
  if (snap || allow < reach || !(dt > 0)) reach = allow;
  else reach += (allow - reach) * (1 - Math.exp(-dt / K.lag));
  const h = reach < L ? reach : L;
  const cx = s.x + dx * h, cz = s.z + dz * h;
  /* 4) khoảng cách 3D tới tâm xoay thật ≥ minDist: thiếu thì nâng camera (không lùi thêm vào tường) */
  const up = cy - hy;
  if (h * h + up * up < K.minDist * K.minDist) { const need = Math.sqrt(K.minDist * K.minDist - h * h); if (up < need) cy = hy + need; }
  /* 5) không thấp hơn mặt đứng tại chỗ camera / mặt đất */
  const g = stGroundY(map, cx, cz);
  const floor = g === g ? g + ST_CAM_FLOOR : CONFIG.landY;
  if (cy < floor) cy = floor;
  camera.position.set(cx, cy, cz);
  target.set(piv.x, piv.y - K.height + K.look, piv.z);
  camera.lookAt(target);
}

/* Kéo chuột / vuốt: sang phải quay camera sang phải (yaw giảm), kéo xuống nâng camera nhìn xuống (pitch tăng) */
export function stCamDrag(c: StCam, dxPx: number, dyPx: number, sens: number): void {
  const K = CONFIG.stroll.cam;
  c.yaw -= dxPx * sens;
  c.pitch += dyPx * sens;
  if (c.pitch < K.pitchMin) c.pitch = K.pitchMin; else if (c.pitch > K.pitchMax) c.pitch = K.pitchMax;
}
