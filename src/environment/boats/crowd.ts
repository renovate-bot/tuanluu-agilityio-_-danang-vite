import { CONFIG, type BoatTypeId } from '../../config';
import { rng, clamp } from '../../common/math';

/* =====================================================================
   TÀU TỤ TẬP BAN ĐÊM — logic thuần (không three, chạy được trong unit test)
   Khoảng 15 du thuyền đậu / trôi chậm quanh Cầu Rồng và Cầu sông Hàn khi trời tối (spec G5, G6).
   Vị trí tất định từ rng(CONFIG.boats.crowd.seed): không đụng chuỗi rand() dùng chung (bất biến §3.1).
   ===================================================================== */
export interface CrowdSlot { x: number; z: number; yaw: number; type: BoatTypeId; len: number; variant: number; led: number; name: number; phase: number }

const B = CONFIG.boats;

/* Vùng cấm cho tâm tàu có nửa chiều dài halfLen (tàu có thể xoay ngang nên lấy halfLen cho cả hai trục) */
export function btInExclusion(x: number, z: number, halfLen: number): boolean {
  const E = B.exclusion;
  if (Math.abs(z - E.tunnelZ) < E.tunnelHalf + halfLen) return true;                                   // hành lang Hầm
  if (E.bridgeZ.some((bz) => Math.abs(z - bz) < E.bridgeHalf + halfLen)) return true;                   // dưới mặt cầu
  if (Math.abs(z - E.swingZ) < E.swingHalfZ && Math.abs(x) < E.swingHalfX + halfLen) return true;      // vòng quay + luồng Cầu sông Hàn
  if (E.lanes.some((lx) => Math.abs(x - lx) < E.laneHalf + halfLen)) return true;                      // làn tàu chạy
  return Math.abs(x) > E.bankX - E.bankMargin - halfLen;                                               // sát kè
}

/* Rải tàu bằng thử–loại trong từng cụm; kiểu / biến thể / màu LED lấy từ danh sách tổ hợp đã xáo để không trùng trong một cụm */
export function btCrowdSlots(cfg = B.crowd): CrowdSlot[] {
  const rnd = rng(cfg.seed), out: CrowdSlot[] = [];
  const E = B.exclusion, xMax = E.bankX - E.bankMargin;
  for (const g of cfg.groups) {
    const combos: [BoatTypeId, number, number][] = [];
    for (const t of ['A', 'B', 'C'] as BoatTypeId[]) for (let v = 0; v < B.variants; v++) for (let l = 0; l < B.led.colors.length; l++) combos.push([t, v, l]);
    for (let i = combos.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [combos[i], combos[j]] = [combos[j], combos[i]]; }
    const first = out.length;
    for (let k = 0, tries = 0; k < g.n; tries++) {
      if (tries > 5000) throw new Error(`btCrowdSlots: không đủ chỗ cho cụm ${g.name}`);
      const [type, variant, led] = combos[k], [lo, hi] = B.types[type].len, len = lo + rnd() * (hi - lo);
      const x = (rnd() * 2 - 1) * xMax, z = g.zMin + rnd() * (g.zMax - g.zMin);
      if (btInExclusion(x, z, len / 2)) continue;
      if (out.slice(first).some((o) => Math.hypot(o.x - x, o.z - z) < cfg.minGap)) continue;
      const yaw = (rnd() < 0.5 ? 0 : Math.PI) + (rnd() * 2 - 1) * cfg.yawSpread;
      out.push({ x, z, yaw, type, len, variant, led, name: Math.floor(rnd() * B.names.length), phase: rnd() * Math.PI * 2 });
      k++;
    }
  }
  return out;
}

/* Hiện / về bến (spec G6): một mức chung 0..1 tiến về mục tiêu với tốc độ giới hạn (1 / spreadSec mỗi giây),
   tàu k hiện khi mức vượt ngưỡng riêng (so le như vanished()) — tàu hiện đủ kích thước, lần lượt trong ≥ spreadSec */
export function btCrowdTarget(night: number, boatAway: number): number {
  const [n0, n1] = B.crowd.nightOn;
  return clamp((night - n0) / (n1 - n0), 0, 1) * (1 - boatAway);
}
export function btCrowdLevel(level: number, target: number, dt: number): number {
  const step = dt / B.crowd.spreadSec;
  return target > level ? Math.min(target, level + step) : Math.max(target, level - step);
}
export function btCrowdShown(k: number, level: number): boolean {
  return level > 0.02 + ((k * 0.6180339887) % 1) * 0.96;
}
