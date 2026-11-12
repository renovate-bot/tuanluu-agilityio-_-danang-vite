/* ============================ Lái xe: camera sau xe ============================
   Camera sau xe `cam.dist`, cao `cam.height` trên mặt đường dưới xe, nhìn vào điểm trước tâm xe `lookAhead`, cao `look` (spec §3 mục 4).
   - Hướng camera bám hướng THÂN xe (không theo vận tốc) với trễ `lag`: lùi xe thì camera vẫn ở sau đuôi, không quay ra trước.
     Vị trí bám thẳng tâm xe (không trễ), để ở 100 km/h camera không tụt xa.
   - Người chơi kéo chuột thêm lệch yaw / pitch (DrCam); thôi kéo `returnAfter` giây thì lệch về 0 theo `returnRate`.
   - Xe trong ô 'tunnel' (cả đoạn hở) thì khoảng lùi `tunnelDist`, độ cao `tunnelHeight`; độ cao kẹp dưới trần ống (hrRoadY + hanTunnel.clear − roof)
     khi xe hoặc camera ở trong ô hầm (drSegClear không biết trần hầm nên kẹp ở đây).
   - Đoạn từ điểm nhìn trên xe tới chỗ camera muốn đứng vướng vật cản (drSegClear < 1): kéo gần (lùi thêm `gap`, không dưới `minDist`)
     và hạ về `tunnelHeight`. Khoảng lùi co lại ngay, nở ra theo `lag` (không giật khi vừa thoát góc tường); độ cao đổi mượt theo `lag`.
   - Không thấp hơn mặt đường tại chỗ camera + `floor` (không có mặt đường cùng tầng thì so với mặt đường dưới xe).
   Gầm cầu (đường ven sông chui dưới dốc Trần Thị Lý) chưa kiểm: vật cản không có mặt cầu. Không cấp phát (D-018). */
import type * as THREE from 'three';
import { CONFIG } from '../../config';
import { HR, hrRoadY } from '../../bridges/han-tunnel/profile';
import { drGround, type DrNet } from './net';
import { drSegClear } from './collide';
import type { DrState } from './motion';

export interface DrCam { yaw: number; pitch: number; idle: number }   // yaw, pitch: lệch do người chơi kéo (rad); idle: giây từ lần kéo cuối

const DR_TUNNEL_DY = 2;                       // m — ô hầm chứa (x, z) được tính khi mặt đường ô lệch cao độ tham chiếu không quá chừng này (đường ven sông chạy trên hầm cách ≥ 10 m)
const cs = { ok: false, head: 0, dist: 0, height: 0 };   // hướng đã trễ, khoảng lùi và độ cao đang dùng
const TAU = Math.PI * 2;
const wrap = (a: number): number => a - TAU * Math.round(a / TAU);

/* (x, z) nằm trong ô 'tunnel' gần cao độ y không (duyệt tuyến tính, không cấp phát) */
function drInTunnel(net: DrNet, x: number, z: number, y: number): boolean {
  const pads = net.pads;
  for (let i = 0; i < pads.length; i++) {
    const p = pads[i];
    if (p.kind !== 'tunnel' || x < p.x0 || x > p.x1 || z < p.z0 || z > p.z1) continue;
    if (Math.abs(p.y(x, z) - y) <= DR_TUNNEL_DY) return true;
  }
  return false;
}

export function drCamPlace(camera: THREE.PerspectiveCamera, s: Pick<DrState, 'x' | 'y' | 'z' | 'yaw'>, c: DrCam, net: DrNet, dt: number, snap?: boolean): void {
  const K = CONFIG.drive.cam;
  /* 1) lệch do kéo tự về sau returnAfter giây */
  if (!snap && dt > 0) {
    c.idle += dt;
    if (c.idle > K.returnAfter) { const k = Math.exp(-K.returnRate * dt); c.yaw *= k; c.pitch *= k; }
  }
  /* 2) hướng bám thân xe, có trễ */
  const tun = drInTunnel(net, s.x, s.z, s.y);
  let dist = tun ? K.tunnelDist : K.dist, height = tun ? K.tunnelHeight : K.height;
  const first = snap || !cs.ok || !(dt > 0), k = first ? 1 : 1 - Math.exp(-K.lag * dt);
  if (first) { cs.head = s.yaw; cs.ok = true; } else cs.head = wrap(cs.head + wrap(s.yaw - cs.head) * k);
  /* 3) chỗ camera muốn đứng, cắt theo vật cản từ điểm nhìn trên xe */
  const yaw = cs.head + c.yaw, cp = Math.cos(c.pitch), sp = Math.sin(c.pitch), fx = Math.cos(yaw), fz = -Math.sin(yaw);
  const ay = s.y + K.look;
  const t = drSegClear(net, s.x, ay, s.z, s.x - fx * dist * cp, s.y + height + dist * sp, s.z - fz * dist * cp);
  if (t < 1) { const d = dist * t - K.gap; dist = d > K.minDist ? d : K.minDist; if (height > K.tunnelHeight) height = K.tunnelHeight; }
  if (first || dist < cs.dist) cs.dist = dist; else cs.dist += (dist - cs.dist) * k;
  if (first) cs.height = height; else cs.height += (height - cs.height) * k;
  const cx = s.x - fx * cs.dist * cp, cz = s.z - fz * cs.dist * cp;
  let cy = s.y + cs.height + cs.dist * sp;
  /* 4) dưới trần ống hầm (xe hoặc camera trong ô hầm) */
  if (tun || drInTunnel(net, cx, cz, s.y)) { const roof = hrRoadY(cx) + HR.clear - K.roof; if (cy > roof) cy = roof; }
  /* 5) trên mặt đường tại chỗ camera */
  const g = drGround(net, cx, cz, s.y), floor = (g === g ? g : s.y) + K.floor;
  if (cy < floor) cy = floor;
  camera.position.set(cx, cy, cz);
  const hx = Math.cos(s.yaw), hz = -Math.sin(s.yaw);
  camera.lookAt(s.x + hx * K.lookAhead, ay, s.z + hz * K.lookAhead);
}

/* Kéo chuột: sang phải quay camera sang phải (yaw giảm), kéo xuống nâng camera nhìn xuống (pitch tăng); đặt lại đồng hồ tự về */
export function drCamDrag(c: DrCam, dxPx: number, dyPx: number): void {
  const K = CONFIG.drive.cam;
  c.yaw = wrap(c.yaw - dxPx * K.mouse);   // trong ±π: tự về theo đường ngắn nhất
  c.pitch += dyPx * K.mouse;
  if (c.pitch < K.pitchMin) c.pitch = K.pitchMin; else if (c.pitch > K.pitchMax) c.pitch = K.pitchMax;
  c.idle = 0;
}
