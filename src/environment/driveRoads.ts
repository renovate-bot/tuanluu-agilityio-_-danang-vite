/* ============================ Lái xe: đường mới trong cảnh (D-034) ============================
   Hai đường dọc mới (x = −1064 / +1096), nhánh rẽ chân Cầu Rồng / Trần Thị Lý, hai đường nối phía Bắc, chỗ mở dải giữa và quay đầu
   ở mọi nút giao (spec §4.2). Hình học dựng ở driveRoadGeo.ts (thuần, có test đơn vị) và gộp vào ROADS2 / MEDIANS của streets.ts:
   không thêm lưới, không thêm lệnh vẽ. Hiện ở mọi chế độ vì là một phần của cảnh.
   drClearRoads: dọn nhà (LOD của buildCity, cả near lẫn far; nhà quanh Thuận Phước), cây, cột đèn lấn mặt đường mới + lề,
   bằng ma trận scale 0 sau khi cảnh đã dựng (mẫu han-tunnel/corridor.ts). KHÔNG gọi rand() / rng. */
import * as THREE from 'three';
import { CONFIG } from '../config';
import { MAT } from '../core/materials';
import { drNewRects } from './driveRoadGeo';

export { drRoadGeos, driveView } from './driveRoadGeo';

const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _zero = new THREE.Matrix4().makeScale(0, 0, 0);

/* Gọi một lần sau buildRiverfront() (main.ts). tpHouses: InstancedMesh nhà quanh Thuận Phước (site.ts); cây Thuận Phước (tp-trees-*) dùng MAT.trunk / MAT.leaf
   nên được dọn cùng cây khu phố. Trả số nhà (level near + Thuận Phước), số cây (theo thân), số cột đèn đã thu về 0 */
export function drClearRoads(tpHouses: THREE.InstancedMesh): { houses: number; trees: number; lamps: number } {
  let root: THREE.Object3D = tpHouses;
  while (root.parent) root = root.parent;                         // scene (không import core/renderer)
  root.updateMatrixWorld(true);
  const rects = drNewRects(), mg = CONFIG.drive.roads.clearMargin;
  const hit = (x: number, z: number, hw: number, hd: number) => rects.some((r) => x + hw > r.x0 - mg && x - hw < r.x1 + mg && z + hd > r.z0 - mg && z - hd < r.z1 + mg);
  const plants = new Set<THREE.Material>([MAT.trunk, MAT.leaf, MAT.palm, MAT.lampPole, MAT.bulb]);
  const out = { houses: 0, trees: 0, lamps: 0 };
  root.traverse((obj) => {
    const o = obj as THREE.InstancedMesh;
    if (!o.isInstancedMesh) return;
    const lod = !!o.parent && (o.parent as THREE.LOD).isLOD, building = lod || o === tpHouses;
    if (!building && !plants.has(o.material as THREE.Material)) return;
    const counted = o === tpHouses || (lod && (o.parent as THREE.LOD).levels[0]?.object === o);   // nhà: đếm một lần (level near)
    let changed = false;
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, _m); _m.decompose(_p, _q, _s);
      if (_s.x < 1e-6) continue;
      _p.applyMatrix4(o.matrixWorld);
      if (!hit(_p.x, _p.z, building ? _s.x / 2 : 1.5, building ? _s.z / 2 : 1.5)) continue;
      o.setMatrixAt(i, _zero); changed = true;
      if (building) { if (counted) out.houses++; } else if (o.material === MAT.trunk) out.trees++; else if (o.material === MAT.lampPole) out.lamps++;
    }
    if (changed) o.instanceMatrix.needsUpdate = true;
  });
  return out;
}
