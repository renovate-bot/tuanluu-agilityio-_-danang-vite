/* ============================ Lái xe: vật cản thu từ cảnh đã dựng ============================
   Tách khỏi solids.ts vì cần module cảnh (environment/riverfront kéo core/renderer, core/materials vẽ canvas lúc import): test node
   chỉ import solids.ts. Gọi MỘT lần, lần đầu vào chế độ lái (sau mọi bước dọn nhà): chỉ đọc cảnh, không đụng chuỗi rand() hay thứ tự dựng.
   - Nhà đang hiện của khu phố (collectBuildings: level gần của THREE.LOD, bỏ instance scale 0) và nhà quanh Thuận Phước (InstancedMesh
     thường của site.ts, tọa độ cục bộ group cầu): khối hộp thẳng trục từ chân tới mái.
   - Chân đế địa danh và pano ven sông (riverfront footprints): là hình chữ nhật dọn nhà đã nới rộng 2–9 m mỗi phía và không có chiều cao,
     nên phần lấn ô đường bị cắt bỏ (giữ mảnh lớn nhất còn lại), cao CONFIG.drive.solids.footTop.
   - Chỉ giữ vật cách mép ô gần nhất ≤ CONFIG.drive.solids.near (cho thân xe và camera); xa hơn xe không bao giờ tới.
   Nhà lấn ô đường thì vẫn thêm (đúng là có nhà trên đường) và đếm vào drSceneStats.intrude để test trình duyệt / người làm thấy. */
import * as THREE from 'three';
import { CONFIG } from '../../config';
import { collectBuildings, type Rect } from '../../environment/riverfront/clearance';
import { getRiverfront } from '../../environment/riverfront';
import { drAddSolids, type DrNet, type DrPad, type DrSolid } from './net';

export const drSceneStats = { buildings: 0, tpHouses: 0, footprints: 0, intrude: 0, skipped: 0 };

const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
const drGood = (r: Rect): boolean => [r.x0, r.x1, r.z0, r.z1].every(Number.isFinite) && r.x1 > r.x0 && r.z1 > r.z0;
const drOverlap = (r: Rect, p: DrPad): boolean => r.x1 > p.x0 && r.x0 < p.x1 && r.z1 > p.z0 && r.z0 < p.z1;
/* Khoảng cách mặt bằng nhỏ nhất từ r tới ô gần nhất (0 nếu chồng) */
function drPadGap(pads: DrPad[], r: Rect): number {
  let best = Infinity;
  for (const p of pads) {
    const dx = Math.max(0, p.x0 - r.x1, r.x0 - p.x1), dz = Math.max(0, p.z0 - r.z1, r.z0 - p.z1);
    best = Math.min(best, Math.hypot(dx, dz));
  }
  return best;
}
/* Cắt khỏi r phần chồng lên các ô: mỗi lần chồng giữ mảnh lớn nhất trong bốn mảnh trái / phải / trước / sau; null nếu không còn gì */
function drTrim(pads: DrPad[], r: Rect): Rect | null {
  let cur: Rect = { ...r };
  for (const p of pads) {
    if (!drOverlap(cur, p)) continue;
    const parts: Rect[] = [
      { ...cur, x1: Math.min(cur.x1, p.x0) }, { ...cur, x0: Math.max(cur.x0, p.x1) },
      { ...cur, z1: Math.min(cur.z1, p.z0) }, { ...cur, z0: Math.max(cur.z0, p.z1) }
    ].filter(drGood);
    if (!parts.length) return null;
    cur = parts.reduce((a, b) => ((b.x1 - b.x0) * (b.z1 - b.z0) > (a.x1 - a.x0) * (a.z1 - a.z0) ? b : a));
  }
  return cur;
}

/* Thêm nhà đang hiện + chân đế địa danh gần ô đường vào net; trả số vật cản đã thêm */
export function drCollectRuntime(net: DrNet, tpHouses: THREE.InstancedMesh | null): number {
  const C = CONFIG.drive.solids, LAND = CONFIG.landY, pads = net.pads, out: DrSolid[] = [];
  const st = { buildings: 0, tpHouses: 0, footprints: 0, intrude: 0, skipped: 0 };
  const box = (r: Rect, y0: number, y1: number): boolean => {
    if (!drGood(r) || !Number.isFinite(y0) || !Number.isFinite(y1) || y1 <= y0) { st.skipped++; return false; }
    const gap = drPadGap(pads, r);
    if (gap > C.near) return false;
    if (gap === 0 && pads.some((p) => drOverlap(r, p))) st.intrude++;
    out.push({ kind: 'rect', x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1, y0, y1 });
    return true;
  };
  for (const b of collectBuildings()) {                             // collectBuildings đã cập nhật matrixWorld của cảnh; nhà khu phố đặt chân ở landY (city.ts)
    if (box({ x0: b.x - b.w / 2, x1: b.x + b.w / 2, z0: b.z - b.d / 2, z1: b.z + b.d / 2 }, LAND, LAND + b.h)) st.buildings++;
  }
  if (tpHouses) {
    tpHouses.updateWorldMatrix(true, false);
    for (let i = 0; i < tpHouses.count; i++) {
      tpHouses.getMatrixAt(i, _m); _m.decompose(_p, _q, _s);
      if (_s.x < 1e-6) continue;                                    // nhà đã dọn khỏi đường mới (drClearRoads)
      _p.applyMatrix4(tpHouses.matrixWorld);                         // hộp gốc ở chân (site.ts: BoxGeometry dời lên 0,5)
      if (box({ x0: _p.x - _s.x / 2, x1: _p.x + _s.x / 2, z0: _p.z - _s.z / 2, z1: _p.z + _s.z / 2 }, _p.y, _p.y + _s.y)) st.tpHouses++;
    }
  }
  for (const f of getRiverfront()?.footprints ?? []) {
    if (!drGood(f)) { st.skipped++; continue; }
    const r = drTrim(pads, f);
    if (r && box(r, LAND, LAND + C.footTop)) st.footprints++;
  }
  if (st.skipped) console.warn(`[drive] bỏ ${st.skipped} vật cản hỏng khi thu từ cảnh`);
  if (st.intrude) console.warn(`[drive] ${st.intrude} nhà lấn ô đường`);
  Object.assign(drSceneStats, st);
  drAddSolids(net, out);
  return out.length;
}
