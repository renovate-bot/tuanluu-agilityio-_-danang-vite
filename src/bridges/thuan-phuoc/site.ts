import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from '../../config';
import { MAT } from '../../core/materials';
import { rng } from '../../common/math';
import { shadowed, zPlane } from '../../common/geometry';
import { TP } from './profile';
import { passLodAdd } from '../../core/passLod';
import { trShadeTrunkGeo, trShadeCrownLodGeo, trYaw } from '../../common/trees/shapes';
import { drCutBoxes } from '../../environment/driveRoadGeo';
import type { ThuanPhuocBridge } from './ThuanPhuocBridge';

/* Mở rộng địa hình cửa sông quanh cầu: bờ đất, kè, đường ven sông, nhà, cây.
   Chỉ thêm khối mới, không sửa đất/đường hiện có của khu Cầu Rồng. Tọa độ cục bộ (z quanh 0 = tim cầu). */
export function tpBuildSite(bridge: ThuanPhuocBridge) {
  const z0 = TP.z, Y = CONFIG.landY, B = CONFIG.bankX, rnd = rng(1965);
  const wN = -3250 - z0, eN = -3700 - z0;                 // bờ biển phía Bắc (Tây / Đông), cục bộ
  const wS = -2600 - z0, eS = -2300 - z0;                 // mép đất hiện có
  const box = (x0: number, x1: number, za: number, zb: number, y0: number, y1: number) => { const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, zb - za); g.translate((x0 + x1) / 2, (y0 + y1) / 2, (za + zb) / 2); return g; };
  bridge.group.add(shadowed(new THREE.Mesh(mergeGeometries([
    box(-14000, -B, wN, wS, -6, Y), box(B, 1480, eN, eS, -6, Y)
  ]), MAT.land), false, true));
  bridge.group.add(shadowed(new THREE.Mesh(box(1480, 1600, eN, eS, -6, 1.2), MAT.sand), false, true));
  bridge.group.add(shadowed(new THREE.Mesh(mergeGeometries([
    box(-B - 2, -B, wN, wS, -3, Y + 0.5), box(B, B + 2, eN, eS, -3, Y + 0.5),
    box(-3200, -B, wN - 2, wN, -3, Y + 0.5), box(B, 1480, eN - 2, eN, -3, Y + 0.5)
  ]), MAT.stone), false, true));
  bridge.group.add(shadowed(new THREE.Mesh(mergeGeometries([
    box(-B - 26, -B - 2, wN, wS, Y, Y + 0.05), box(B + 2, B + 26, eN, eS, Y, Y + 0.05)
  ]), MAT.paver), false, true));
  // đường ven sông nối dài: Như Nguyệt / Bạch Đằng (Tây), Trần Hưng Đạo (Đông)
  const roads = [], med = [];
  for (const [xc, za, zb] of [[-299, wN + 40, wS], [299, eN + 40, eS]]) {
    for (const s of [-1, 1]) {
      const g = zPlane(zb - za, 9, xc + s * 6, Y + 0.02, (za + zb) / 2, s < 0);
      const p = g.attributes.position, uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setX(i, p.getZ(i) / 12);
      roads.push(g);
    }
    med.push(...drCutBoxes(xc - 1.5, xc + 1.5, za, zb, Y, Y + 0.3, z0));   // mở dải giữa ở chỗ quay đầu cuối đường (chế độ lái, D-034)
  }
  const sr = shadowed(new THREE.Mesh(mergeGeometries(roads), MAT.road2), false, true);
  const sm = shadowed(new THREE.Mesh(mergeGeometries(med), MAT.grass), false, true);
  bridge.group.add(sr, sm); bridge.noReflect.push(sr, sm);
  // nhà thấp tầng / trung tầng quanh hai đầu cầu (ngoài hành lang cầu)
  const list: [number, number, number, number, number][] = [];
  const place = (xa: number, xb: number, za: number, zb: number, hMax: number) => {
    for (let x = xa; x < xb; x += 34) for (let z = za; z < zb; z += 34) {
      if (Math.abs(z) < 42 || rnd() < 0.3) continue;
      list.push([x + (rnd() - 0.5) * 8, z + (rnd() - 0.5) * 8, 12 + rnd() * 14, 12 + rnd() * 14, 8 + rnd() * hMax]);
    }
  };
  place(-1700, -360, wN + 60, wS - 20, 40);
  place(360, 1380, -400, eS - 20, 28);
  const bm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), bridge.mats.building, list.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
  const palette = [0xf3f0e7, 0xeae2cf, 0xdadcdc, 0xcfe0e7, 0xe6dccb, 0xf6f6f2];
  list.forEach(([x, z, w, d, h], i) => {
    bm.setMatrixAt(i, m.compose(v.set(x, Y, z), q, sc.set(w, h, d)));
    bm.setColorAt(i, col.setHex(palette[Math.floor(rnd() * palette.length)]));
  });
  bm.castShadow = bm.receiveShadow = true; bm.name = 'tp-houses';
  bridge.group.add(bm); bridge.noReflect.push(bm); bridge.houses = bm;   // drClearRoads (environment/driveRoads.ts) thu nhà nằm trên đường dọc mới về scale 0
  // cây dọc kè mới
  const trees: [number, number][] = [];
  for (const [xs, za, zb] of [[-1, wN + 10, wS], [1, eN + 10, eS]]) for (let z = za; z < zb; z += 15) {
    if (Math.abs(z) < 26) continue;
    trees.push([xs * (B + 9 + rnd() * 12), z]);
  }
  // cây bóng mát (G1), cùng quy ước ma trận với environment/trees.ts: thân (r, h + 0,6r, r), tán giữ tâm / tỉ lệ cũ, xoay theo chỉ số
  const trunks = new THREE.InstancedMesh(trShadeTrunkGeo(), MAT.trunk, trees.length);
  const crownLod = trShadeCrownLodGeo();   // hình học gộp [đầy đủ | thưa] cho lượt bóng / phản chiếu (src/core/passLod.ts)
  const crowns = new THREE.InstancedMesh(crownLod.geo, MAT.leaf, trees.length);
  trees.forEach(([x, z], i) => {
    const h = 3 + rnd() * 2.5, r = 2.4 + rnd() * 1.8;
    q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, trYaw(i, CONFIG.trees.shade.seed + 3));
    trunks.setMatrixAt(i, m.compose(v.set(x, Y, z), q, sc.set(r, h + r * 0.6, r)));
    crowns.setMatrixAt(i, m.compose(v.set(x, Y + h + r * 0.6, z), q, sc.set(r, r * 0.85, r)));
    crowns.setColorAt(i, col.setHSL(0.27 + rnd() * 0.06, 0.45, 0.35 + rnd() * 0.12));
  });
  passLodAdd(crowns, crownLod.fullCount, crownLod.lodCount);
  trunks.name = 'tp-trees-trunk'; crowns.name = 'tp-trees-crown';
  trunks.castShadow = crowns.castShadow = true;
  bridge.details.add(trunks, crowns);
}
