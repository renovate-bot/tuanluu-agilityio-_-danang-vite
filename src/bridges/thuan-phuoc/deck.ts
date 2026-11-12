import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { extrudeAlongX, roadStrip, bentBox, prepColored } from '../../common/geometry';
import { addDeckEdges, addJoints, addLampPosts } from '../../common/deck';
import { flatY } from '../dragon/profile';
import { TP, tpRoadY } from './profile';
import type { ThuanPhuocBridge } from './ThuanPhuocBridge';
import { drCutAlongX } from '../../environment/driveRoadGeo';

/* [deck] dầm hộp thép khí động, mặt đường 4 làn, dải phân cách, lề, lan can, cột đèn */
export function tpBuildDeck(bridge: ThuanPhuocBridge) {
  const M = bridge.mats, A = TP.anchorX, E = TP.endX, R = TP.embankment, hw = TP.deckWidth / 2;
  // Dầm hộp thép khí động: mặt trên phẳng, mũi vát hai bên, đáy phẳng (tiết diện ước lượng)
  const tip = TP.girderTip, d = TP.girderDepth;
  const girder = extrudeAlongX([[-hw, 0], [hw, 0], [tip, -0.9], [8.0, -d], [-8.0, -d], [-tip, -0.9]], -A, A, 260, tpRoadY);
  const gm = new THREE.Mesh(girder, M.steel); gm.name = 'tp-girder'; gm.castShadow = gm.receiveShadow = true;
  bridge.group.add(gm);
  // 69 đốt dầm: gân nối đốt ở đáy (chi tiết nhỏ)
  const seg = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 0.07, 15.6), M.joint, TP.girderSegments - 1);
  const m = new THREE.Matrix4();
  for (let i = 1; i < TP.girderSegments; i++) {
    const x = -A + i * (2 * A / TP.girderSegments);
    seg.setMatrixAt(i - 1, m.makeTranslation(x, tpRoadY(x) - d - 0.03, 0));
  }
  bridge.details.add(seg);

  // Mặt đường 4 làn + đoạn nối trên bờ (Nguyễn Tất Thành phía Tây, Hoàng Sa – Trường Sa phía Đông)
  const car = 2 * TP.laneWidth, zc = TP.median / 2 + car / 2, x0 = -1500, x1 = 1480;
  const road = mergeGeometries([
    roadStrip(x0, x1, car, zc, 0.03, 900, tpRoadY),
    roadStrip(x0, x1, car, -zc, 0.03, 900, tpRoadY, true)
  ]);
  const rm = new THREE.Mesh(road, M.road); rm.receiveShadow = true; bridge.group.add(rm); bridge.noReflect.push(rm);

  // Dải phân cách (riêng cầu này); lề, gờ, lan can, khe co giãn, cột đèn dùng chung [common]
  const conc = [bentBox(2 * (E + R), 0.45, TP.median, 0, 0.22, 0, 700, tpRoadY)];
  for (const [xa, xb] of [[x0, -E - R], [E + R, x1]]) conc.push(...drCutAlongX(xa, xb, TP.z, TP.median / 2, 4, (len, xc, n) => bentBox(len, 0.3, TP.median, xc, 0.15, 0, n, flatY))); // phân cách trên bờ, mở tại nút giao chế độ lái (D-034)
  bridge.concreteParts.push(...conc.map((g) => prepColored(g, () => 0.9)));
  addDeckEdges(bridge, { x0: -E - R, x1: E + R, segs: 700, profile: tpRoadY, hw, sidewalk: TP.sidewalk });
  addJoints(bridge, { xs: [-E, -A, -TP.towerX, TP.towerX, A, E], profile: tpRoadY, width: TP.deckWidth - 0.6, mat: M.joint });
  const xs = []; for (let x = -E + 15; x <= E - 15; x += TP.lampSpacing) xs.push(x);
  const zl = hw - TP.sidewalk + 0.45;
  addLampPosts(bridge, { xs, profile: tpRoadY, rows: [{ z: -zl, s: -1 }, { z: zl, s: 1 }] });
}
