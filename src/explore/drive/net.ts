/* ============================ Lái xe: mạng đường nhiều tầng (DrNet) ============================
   Mạng đường là danh sách ô mặt đường chữ nhật thẳng trục, mỗi ô có hàm cao độ riêng. Ô chồng nhau trên mặt bằng
   (đường ven sông dưới dốc cầu, đường trên hầm) tách tầng nhờ so cao độ với cao độ hiện tại của xe (± stepMax).
   Thuần toán học: chỉ import CONFIG; không dựng cảnh, không đụng DOM. Dữ liệu ô sinh ở roadData.ts. */
import { CONFIG } from '../../config';

export interface DrPad { id: string; kind: 'road' | 'bridge' | 'tunnel' | 'slip' | 'junction'; x0: number; x1: number; z0: number; z1: number; y: (x: number, z: number) => number; gate?: string }
export interface DrSolid { kind: 'rect' | 'circle'; x0?: number; x1?: number; z0?: number; z1?: number; cx?: number; cz?: number; r?: number; y0: number; y1: number }   // y0..y1: cao độ tuyệt đối (m) mà vật cản chiếm
export interface DrNet { pads: DrPad[]; solids: DrSolid[]; closed: Set<string> }

const REACH_STEP = 2;                                               // m — bước lưới mẫu của drReach: ô hẹp nhất 3,35 m nên ô nào cũng có điểm mẫu; khe hẹp hơn bước (dải giữa Thuận Phước 1,0 m) có thể bị bước qua, nên drReach chỉ để kiểm liên thông

export function drMakeNet(pads: DrPad[], solids: DrSolid[]): DrNet {
  return { pads, solids: solids.slice(), closed: new Set() };
}
export function drAddSolids(net: DrNet, more: DrSolid[]): void {
  for (const s of more) net.solids.push(s);
}
/* Đóng / mở cổng: ô mang cổng đang đóng coi như không có (nhịp quay Cầu sông Hàn khi cầu quay) */
export function drSetGate(net: DrNet, gate: string, closed: boolean): void {
  if (closed) net.closed.add(gate); else net.closed.delete(gate);
}

/* Chỉ số ô chứa (x, z) có cao độ gần yRef nhất trong ± stepMax; −1 nếu không có. Duyệt tuyến tính, không cấp phát */
function drPadAt(net: DrNet, x: number, z: number, yRef: number): number {
  const pads = net.pads, step = CONFIG.drive.stepMax;
  let best = -1, bestD = Infinity;
  for (let i = 0; i < pads.length; i++) {
    const p = pads[i];
    if (x < p.x0 || x > p.x1 || z < p.z0 || z > p.z1) continue;
    if (p.gate !== undefined && net.closed.has(p.gate)) continue;
    const d = Math.abs(p.y(x, z) - yRef);
    if (d <= step && d < bestD) { best = i; bestD = d; }
  }
  return best;
}
/* Cao độ mặt đường tại (x, z) ở tầng gần yRef nhất; NaN nếu không có ô nào cùng tầng */
export function drGround(net: DrNet, x: number, z: number, yRef: number): number {
  const i = drPadAt(net, x, z, yRef);
  return i < 0 ? NaN : net.pads[i].y(x, z);
}

/* Khung bao mặt bằng và cao độ của mọi ô (cao độ lấy mẫu mỗi ≤ 2 m theo hai trục) */
export function drBounds(net: DrNet): { x0: number; x1: number; z0: number; z1: number; yMin: number; yMax: number } {
  const b = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity, yMin: Infinity, yMax: -Infinity };
  for (const p of net.pads) {
    b.x0 = Math.min(b.x0, p.x0); b.x1 = Math.max(b.x1, p.x1); b.z0 = Math.min(b.z0, p.z0); b.z1 = Math.max(b.z1, p.z1);
    const nx = Math.ceil((p.x1 - p.x0) / 2), nz = Math.ceil((p.z1 - p.z0) / 2);
    for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) {
      const y = p.y(p.x0 + (p.x1 - p.x0) * i / nx, p.z0 + (p.z1 - p.z0) * j / nz);
      if (y < b.yMin) b.yMin = y; if (y > b.yMax) b.yMax = y;
    }
  }
  return b;
}

/* Id các ô tới được từ (x, z, y): loang 4 hướng trên lưới mẫu 2 m neo tại điểm xuất phát; mỗi bước tra drGround từ cao độ điểm trước,
   nên chỉ đổi tầng ở chỗ hai ô nối nhau cùng cao độ. Trạng thái = (điểm lưới, ô). Dùng cho test và kiểm dữ liệu, không gọi mỗi khung */
export function drReach(net: DrNet, x: number, z: number, y: number): Set<string> {
  const out = new Set<string>();
  const p0 = drPadAt(net, x, z, y);
  if (p0 < 0) return out;
  const NP = net.pads.length, OFF = 1 << 14, SPAN = 1 << 15;    // chỉ số lưới ±16 384 bước (±32 km)
  const key = (i: number, j: number, p: number) => ((i + OFF) * SPAN + (j + OFF)) * NP + p;
  const seen = new Set<number>(), qi: number[] = [0], qj: number[] = [0], qp: number[] = [p0];
  seen.add(key(0, 0, p0)); out.add(net.pads[p0].id);
  const DI = [1, -1, 0, 0], DJ = [0, 0, 1, -1];
  for (let h = 0; h < qi.length; h++) {
    const i = qi[h], j = qj[h], pad = net.pads[qp[h]];
    const cx = x + i * REACH_STEP, cz = z + j * REACH_STEP, cy = pad.y(cx, cz);
    for (let d = 0; d < 4; d++) {
      const ni = i + DI[d], nj = j + DJ[d];
      const np = drPadAt(net, x + ni * REACH_STEP, z + nj * REACH_STEP, cy);
      if (np < 0) continue;
      const k = key(ni, nj, np);
      if (seen.has(k)) continue;
      seen.add(k); qi.push(ni); qj.push(nj); qp.push(np); out.add(net.pads[np].id);
    }
  }
  return out;
}
