/* ============================ Đi dạo: vật cản thu từ cảnh đã dựng ============================
   Gọi MỘT lần, lần đầu vào chế độ (sau khi mọi bước dọn nhà đã chạy): chỉ đọc cảnh, không đụng chuỗi rand() hay thứ tự dựng (spec §6).
   - Nhà đang hiện (collectBuildings: level gần của THREE.LOD, bỏ instance scale 0) có chân đế chạm khung CONFIG.stroll.bounds: chữ nhật thẳng trục (nhà không xoay, city.ts).
   - Chân đế địa danh và pano ven sông (riverfront footprints), trừ chân đế có tâm trong vùng `love`: Cầu Tình Yêu đi được, lan can / tượng đã dựng riêng ở mapData.ts.
   Vật cản hỏng (số không hữu hạn, rộng ≤ 0) thì bỏ và đếm: lõi bản đồ không lập chỉ mục được nhưng stSegClear vẫn thấy, nên không được lọt vào. */
import { CONFIG } from '../../config';
import { collectBuildings, type Rect } from '../../environment/riverfront/clearance';
import { getRiverfront } from '../../environment/riverfront';
import { stAddSolids, type StMap, type StSolid } from './map';

export const stSceneStats = { buildings: 0, footprints: 0, skipped: 0 };

const stGood = (r: Rect): boolean => Number.isFinite(r.x0) && Number.isFinite(r.x1) && Number.isFinite(r.z0) && Number.isFinite(r.z1) && r.x1 > r.x0 && r.z1 > r.z0;

export function stCollectRuntime(map: StMap): number {
  const B = CONFIG.stroll.bounds, out: StSolid[] = [];
  let nb = 0, nf = 0, bad = 0;
  for (const b of collectBuildings()) {
    const r = { x0: b.x - b.w / 2, x1: b.x + b.w / 2, z0: b.z - b.d / 2, z1: b.z + b.d / 2 };
    if (!stGood(r)) { bad++; continue; }
    if (r.x1 < B.x0 || r.x0 > B.x1 || r.z1 < B.z0 || r.z0 > B.z1) continue;
    out.push({ kind: 'rect', ...r }); nb++;
  }
  const love = map.zones.find((z) => z.id === 'love');
  for (const f of getRiverfront()?.footprints ?? []) {
    if (!stGood(f)) { bad++; continue; }
    const cx = (f.x0 + f.x1) / 2, cz = (f.z0 + f.z1) / 2;
    if (love && cx >= love.x0 && cx <= love.x1 && cz >= love.z0 && cz <= love.z1) continue;
    out.push({ kind: 'rect', x0: f.x0, x1: f.x1, z0: f.z0, z1: f.z1 }); nf++;
  }
  if (bad) console.warn(`[stroll] bỏ ${bad} vật cản hỏng khi thu từ cảnh`);
  stSceneStats.buildings = nb; stSceneStats.footprints = nf; stSceneStats.skipped = bad;
  stAddSolids(map, out);
  return out.length;
}
