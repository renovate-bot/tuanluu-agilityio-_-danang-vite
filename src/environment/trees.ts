import * as THREE from 'three';
import { CONFIG } from '../config';
import { scene } from '../core/renderer';
import { MAT } from '../core/materials';
import { rand } from '../common/math';
import { shadowed } from '../common/geometry';
import { deckY } from '../bridges/dragon/profile';
import { passLodAdd, passLodInfo } from '../core/passLod';
import { trShadeTrunkGeo, trShadeCrownLodGeo, trPalmTrunkGeo, trPalmCrownGeo, trYaw } from '../common/trees/shapes';

/* ============================ Cây xanh & đèn đường ============================ */
export function buildTrees() {
  const round: [number, number][] = [], palms: [number, number][] = [];
  const B = CONFIG.bankX;
  for (let z = -2300; z < 2300; z += 14) {
    if (Math.abs(z) < 26 || Math.abs(z - CONFIG.ttl.z) < 24) continue;
    for (const s of [-1, 1]) {
      const x = s * (B + 9 + rand() * 12);
      ((Math.round(z / 14) % 3 === 0) ? palms : round).push([x, z]);
    }
  }
  for (const [x0, x1] of [[-1880, -345], [345, 1460]]) for (let x = x0; x < x1; x += 16) {
    for (const s of [-1, 1]) (x > 1200 ? palms : round).push([x + rand() * 3, s * 21.5]);
  }
  for (let i = 0; i < 160; i++) { // công viên hai đầu cầu
    const s = i % 2 ? 1 : -1; round.push([s * (345 + rand() * 120), (rand() < 0.5 ? -1 : 1) * (32 + rand() * 120)]);
  }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3(), col = new THREE.Color();
  const T = CONFIG.trees, wk = T.palm.trunkWidth, bendX = T.palm.bend * wk;
  // Cây bóng mát (G1): thân + cành chuẩn hóa (đầu cành cao nhất = tâm tán), tán cụm lá giữ đúng tâm / tỉ lệ quả cầu cũ (fallen.ts, promenade.ts, dọn cây đọc ma trận tán)
  const t1 = new THREE.InstancedMesh(trShadeTrunkGeo(), MAT.trunk, round.length);
  const crownLod = trShadeCrownLodGeo();   // hình học gộp [đầy đủ | thưa]: lượt bóng / phản chiếu vẽ bản thưa (src/core/passLod.ts)
  const c1 = new THREE.InstancedMesh(crownLod.geo, MAT.leaf, round.length);
  round.forEach(([x, z], i) => {
    const h = 3 + rand() * 2.5, r = 2.4 + rand() * 1.8;
    q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, trYaw(i, T.shade.seed + 2));
    m.compose(v.set(x, CONFIG.landY, z), q, s.set(r, h + r * 0.6, r)); t1.setMatrixAt(i, m);
    m.compose(v.set(x, CONFIG.landY + h + r * 0.6, z), q, s.set(r, r * 0.85, r)); c1.setMatrixAt(i, m);
    col.setHSL(0.27 + rand() * 0.06, 0.45, 0.35 + rand() * 0.12); c1.setColorAt(i, col);
  });
  // Cây dừa (G2): thân cong lệch bend theo +X cục bộ ⇒ tán đặt ở đỉnh thân sau khi xoay: (x, landY + h, z) + Ry(yaw)·(bend·trunkWidth, 0, 0)
  const t2 = new THREE.InstancedMesh(trPalmTrunkGeo(), MAT.trunk, palms.length);
  const c2 = new THREE.InstancedMesh(trPalmCrownGeo(), MAT.palm, palms.length);
  palms.forEach(([x, z], i) => {
    const h = 8 + rand() * 4, yaw = trYaw(i, T.palm.seed + 2);
    q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, yaw);
    m.compose(v.set(x, CONFIG.landY, z), q, s.set(wk, h, wk)); t2.setMatrixAt(i, m);
    m.compose(v.set(x + bendX * Math.cos(yaw), CONFIG.landY + h, z - bendX * Math.sin(yaw)), q, s.setScalar(T.palm.crownScale * h)); c2.setMatrixAt(i, m);
  });
  passLodAdd(c1, crownLod.fullCount, crownLod.lodCount);
  t1.name = 'trees-shade-trunk'; c1.name = 'trees-shade-crown'; t2.name = 'trees-palm-trunk'; c2.name = 'trees-palm-crown';
  scene.add(shadowed(t1, true, false), shadowed(c1, true, false), shadowed(t2, true, false), shadowed(c2, true, false));
}

/* API test (gắn vào __app.trees khi ?test): 6 lưới cây theo tên, vị trí [x, z] từng instance */
const TR_NAMES = ['trees-shade-trunk', 'trees-shade-crown', 'trees-palm-trunk', 'trees-palm-crown', 'tp-trees-trunk', 'tp-trees-crown'];
const trMesh = (name: string) => scene.getObjectByName(name) as THREE.InstancedMesh | undefined;
export const treesTest = {
  maxTris: CONFIG.trees.maxTris,
  meshes: () => TR_NAMES.map(trMesh).filter((o): o is THREE.InstancedMesh => !!o && o.isInstancedMesh).map((o) => {
    const g = o.geometry, lod = passLodInfo(g);   // tris = bản đầy đủ (lượt chính), lodTris = bản thưa (lượt bóng / phản chiếu; 0 nếu lưới không có)
    return { name: o.name, count: o.count, tris: lod ? lod.full / 3 : (g.index ? g.index.count : g.getAttribute('position').count) / 3, lodTris: lod ? lod.lod / 3 : 0 };
  }),
  positions(name: string): number[] {
    const o = trMesh(name), out: number[] = [], m = new THREE.Matrix4();
    if (!o) return out;
    for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m); out.push(Math.round(m.elements[12] * 1000) / 1000, Math.round(m.elements[14] * 1000) / 1000); }
    return out;
  }
};
export function buildStreetLamps() {
  const pos: [number, number, number, number][] = [];
  for (let x = -320; x <= 320; x += 32) for (const s of [-1, 1]) pos.push([x, deckY(x) + 0.25, s * 17.0, 8]);
  for (let z = -2300; z < 2300; z += 30) for (const s of [-1, 1]) if (Math.abs(z) > 30) pos.push([s * (CONFIG.bankX + 22), CONFIG.landY, z, 6]);
  for (const [x0, x1] of [[-1880, -345], [345, 1460]]) for (let x = x0; x < x1; x += 40) for (const s of [-1, 1]) pos.push([x, CONFIG.roadY + 0.2, s * 17.5, 8]);
  const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.14, 1, 6).translate(0, 0.5, 0), MAT.lampPole, pos.length);
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.42, 8, 6), MAT.bulb, pos.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
  pos.forEach(([x, y, z, h], i) => {
    m.compose(v.set(x, y, z), q, s.set(1, h, 1)); poles.setMatrixAt(i, m);
    m.compose(v.set(x, y + h + 0.2, z), q, s.set(1, 1, 1)); bulbs.setMatrixAt(i, m);
  });
  poles.castShadow = true; scene.add(poles, bulbs);
}
