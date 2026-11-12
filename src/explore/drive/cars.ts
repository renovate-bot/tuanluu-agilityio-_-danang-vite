/* ===== Lái xe: bộ quản lý xe của các người chơi (D-034) =====
   - drCars.group: gồm xe của từng slot (DrCar.group) và bánh dùng chung (drWheels.group); chưa có xe thì không có gì để vẽ.
   - sync(peers): tạo xe cho slot mới (màu theo multiParams.colors[slot]), gỡ xe của slot không còn. place / pos theo slot. */
import * as THREE from 'three';
import { multiParams } from '../multi/params';
import { DrCar, drCarDisposeShared, drWheels, type DrPlace } from './car';

const cars = new Map<number, DrCar>();
const group = new THREE.Group();
group.name = 'drive-cars';
group.add(drWheels.group);

export const drCars = {
  group,
  sync(peers: { slot: number }[]): void {
    const want = new Set<number>();
    for (const p of peers) {
      want.add(p.slot);
      if (cars.has(p.slot)) continue;
      const c = new DrCar(multiParams.colors[((p.slot % multiParams.colors.length) + multiParams.colors.length) % multiParams.colors.length]);
      cars.set(p.slot, c); group.add(c.group);
    }
    for (const [s, c] of cars) if (!want.has(s)) { c.dispose(); cars.delete(s); }
  },
  place(slot: number, p: DrPlace): void { cars.get(slot)?.place(p); },
  /* Vị trí xe của slot vào out; false nếu không có xe */
  pos(slot: number, out: THREE.Vector3): boolean {
    const c = cars.get(slot);
    if (!c) return false;
    out.copy(c.group.position);
    return true;
  },
  clear(): void { for (const c of cars.values()) c.dispose(); cars.clear(); },
  /* Gỡ hết, kể cả vật liệu / bánh dùng chung (rời chế độ hẳn) */
  dispose(): void { this.clear(); drCarDisposeShared(); }
};
