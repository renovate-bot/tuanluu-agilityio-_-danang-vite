import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config';
import { scene } from '../core/renderer';
import { MAT } from '../core/materials';
import { bentPlane, zPlane, shadowed } from '../common/geometry';
import { flatY } from '../bridges/dragon/profile';
import { drRoadGeos } from './driveRoads';
import { drCutBoxes } from './driveRoadGeo';

/* ============================ Đường phố ============================
   Mặt đường được gom chung (cả mặt Cầu Rồng) để giảm draw call: ROADS3 = 3 làn/chiều, ROADS2 = 2 làn/chiều */
export const ROADS3: THREE.BufferGeometry[] = [], ROADS2: THREE.BufferGeometry[] = [];
const MEDIANS: THREE.BufferGeometry[] = [];

export function buildStreets() {
  const y = CONFIG.roadY + 0.03, med = CONFIG.median / 2, car = CONFIG.lanesPerDir * CONFIG.laneWidth + CONFIG.shoulder;
  // Trục cầu nối dài trên bờ: Nguyễn Văn Linh (Tây) – Võ Văn Kiệt (Đông)
  for (const [x0, x1] of [[-1900, -333], [333, 1480]]) {
    const len = x1 - x0, xc = (x0 + x1) / 2;
    ROADS3.push(bentPlane(len, car, xc, 0.03, med + car / 2, 1, flatY));
    ROADS3.push(bentPlane(len, car, xc, 0.03, -(med + car / 2), 1, flatY, true));
    // dải giữa, vỉa hè: chia đoạn tại các ô nút giao / đường mới của chế độ lái (chỗ mở dải giữa, đường dọc mới cắt ngang vỉa hè)
    MEDIANS.push(...drCutBoxes(x0, x1, -med, med, CONFIG.roadY, CONFIG.roadY + 0.3));
    for (const s of [-1, 1]) MEDIANS.push(...drCutBoxes(x0, x1, s * 18.2 - 1.5, s * 18.2 + 1.5, CONFIG.roadY, CONFIG.roadY + 0.2));
  }
  // Đường ven sông: Bạch Đằng (Tây), Trần Hưng Đạo (Đông) — 2 làn mỗi chiều
  for (const [xc, z0, z1] of [[-299, -2600, 2600], [299, -2300, 2600]]) {
    const len = z1 - z0, zc = (z0 + z1) / 2;
    ROADS2.push(zPlane(len, 9, xc + 6, y - 0.01, zc, false));
    ROADS2.push(zPlane(len, 9, xc - 6, y - 0.01, zc, true));
    MEDIANS.push(...drCutBoxes(xc - 1.5, xc + 1.5, z0, z1, CONFIG.roadY, CONFIG.roadY + 0.3));   // mở tại nút giao, nhánh rẽ, quay đầu
  }
  // Đường mới của chế độ lái xe (D-034): đường dọc, nhánh rẽ, đường nối, mặt đường nút giao — gộp vào ROADS2 / MEDIANS, không thêm lưới
  const dr = drRoadGeos();
  ROADS2.push(...dr.roads2); MEDIANS.push(...dr.medians);
}
export function finalizeRoads() {
  const tex3 = MAT.road.map, tex2 = MAT.road2.map;
  tex3.repeat.set(1, 1); tex2.repeat.set(1, 1);
  // Chuẩn hoá UV theo mét để vạch kẻ đều (chu kỳ 12 m)
  const fixUV = (g: THREE.BufferGeometry) => {
    const p = g.attributes.position, uv = g.attributes.uv;
    const along = (p.getX(1) - p.getX(0)) !== 0 && Math.abs(p.getZ(1) - p.getZ(0)) < 1e-3 ? 'x' : 'z';
    for (let i = 0; i < uv.count; i++) uv.setX(i, (along === 'x' ? p.getX(i) : p.getZ(i)) / 12);
    uv.needsUpdate = true; return g;
  };
  scene.add(shadowed(new THREE.Mesh(mergeGeometries(ROADS3.map(fixUV)), MAT.road), false, true));
  scene.add(shadowed(new THREE.Mesh(mergeGeometries(ROADS2.map(fixUV)), MAT.road2), false, true));
  scene.add(shadowed(new THREE.Mesh(mergeGeometries(MEDIANS), MAT.grass), false, true));
}
