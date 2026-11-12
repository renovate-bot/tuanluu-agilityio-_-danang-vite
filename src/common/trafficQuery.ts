/* ============================ Truy vấn vị trí xe tự động (cho chế độ lái) ============================
   Chế độ lái (explore/drive) cần hộp các xe tự động gần xe người chơi để chặn (spec §6, "Xe tự động"). Hàm này CHỈ ĐỌC:
   không đổi cách các hệ xe chạy, không gọi rand() / rnd() (chuỗi seed giữ nguyên).
   - Mỗi hệ xe đăng ký một bộ lấy mẫu (trRegister) lúc dựng; trNearby gọi lần lượt các bộ lấy mẫu, chỉ khi đang lái
     (không ai gọi thì không tốn gì).
   - trFleetSampler đọc thẳng ma trận instance của đội xe (common/vehicles/fleet.ts) nhân ma trận thế giới của lưới: vị trí đã gồm
     mọi luật sẵn có (xếp hàng trước barie Cầu sông Hàn, dốc cầu). Xe ẩn (vhHide: bão, tắt làn, vanished) có ma trận scale 0 nên bỏ;
     lưới hoặc nhóm cha đang ẩn (tắt "Xe cộ", ngoài tầm vẽ của hầm: ma trận không còn được cập nhật) thì bỏ cả hệ.
   - Hộp: tâm = điểm mặt đường dưới tâm xe, hướng theo trục +X của hình học xe, nửa dài / nửa rộng theo CONFIG.vehicles.types.
   Thuần: không import three. Mỗi lần gọi không cấp phát, trừ khi mảng out phải nới (thêm phần tử mới, giữ lại cho lần sau). */
import { CONFIG, type VehicleTypeId } from '../config';
import type { DrBox } from '../explore/drive/collide';

/* Ghi các hộp xe đang HIỆN trong bán kính r (m, theo mặt bằng) quanh (x, z) vào out từ chỉ số n; trả n mới */
export type TrSampler = (x: number, z: number, r: number, out: DrBox[], n: number) => number;

/* Nguồn của một đội xe: m = ma trận instance (16 số mỗi xe, cột trước), type = chỉ số loại trong kinds, count = số xe,
   world = ma trận thế giới của lưới (16 số, cột trước), shown = lưới và mọi nhóm cha đang hiện */
export interface TrFleetSrc { m: ArrayLike<number>; type: ArrayLike<number>; count: number; world: ArrayLike<number>; shown: () => boolean }

const SAMPLERS: TrSampler[] = [];

export function trRegister(fn: TrSampler): void { SAMPLERS.push(fn); }

/* Mọi xe tự động đang hiện quanh (x, z); trả số hộp đã ghi vào out (out tái dùng giữa các khung) */
export function trNearby(x: number, z: number, r: number, out: DrBox[]): number {
  let n = 0;
  for (let i = 0; i < SAMPLERS.length; i++) n = SAMPLERS[i](x, z, r, out, n);
  return n;
}

/* Bộ lấy mẫu từ ma trận instance của một đội xe; kinds[i] là loại xe ứng với chỉ số i của thuộc tính type */
export function trFleetSampler(src: TrFleetSrc, kinds: readonly VehicleTypeId[]): TrSampler {
  const T = CONFIG.vehicles.types;
  const HL = kinds.map((k) => T[k].len / 2), HW = kinds.map((k) => T[k].w / 2);   // nửa dài, nửa rộng theo chỉ số loại, m
  return (x, z, r, out, n) => {
    if (!src.shown()) return n;
    const m = src.m, W = src.world, r2 = r * r;
    for (let i = 0; i < src.count; i++) {
      const o = i * 16, a = m[o], b = m[o + 1], c = m[o + 2];
      if (a * a + b * b + c * c < 1e-12) continue;                 // scale 0: xe đang ẩn
      const tx = m[o + 12], ty = m[o + 13], tz = m[o + 14];
      const wx = W[0] * tx + W[4] * ty + W[8] * tz + W[12], wz = W[2] * tx + W[6] * ty + W[10] * tz + W[14];
      const dx = wx - x, dz = wz - z;
      if (dx * dx + dz * dz > r2) continue;
      const fx = W[0] * a + W[4] * b + W[8] * c, fz = W[2] * a + W[6] * b + W[10] * c;   // trục +X của xe trong hệ thế giới
      const k = src.type[i] | 0;
      let bx = out[n];
      if (!bx) { bx = { x: 0, y: 0, z: 0, yaw: 0, hl: 0, hw: 0 }; out[n] = bx; }
      bx.x = wx; bx.z = wz; bx.y = W[1] * tx + W[5] * ty + W[9] * tz + W[13];
      bx.yaw = Math.atan2(-fz, fx);                                // quy ước hướng: tiến = (cos yaw, −sin yaw)
      bx.hl = HL[k] ?? HL[0]; bx.hw = HW[k] ?? HW[0];
      n++;
    }
    return n;
  };
}
