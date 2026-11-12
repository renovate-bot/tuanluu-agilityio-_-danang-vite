import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MAT } from '../../core/materials';
import { prepColored, extrudeAlongX, roadStrip, bentBox, shadowed } from '../../common/geometry';
import { addDeckEdges, addJoints, addLampPosts } from '../../common/deck';
import { flatY } from '../dragon/profile';
import { TTL, ttlRoadY } from './profile';
import type { TranThiLyBridge } from './TranThiLyBridge';
import { drCutAlongX } from '../../environment/driveRoadGeo';

/* [deck] dầm hộp 34,5 m, 6 làn, dải phân cách 5,5 m, lề, lan can, đèn, dải LED */
export function ttlBuildDeck(bridge: TranThiLyBridge) {
  const M = bridge.mats, hw = TTL.hw, W = TTL.westEnd, E = TTL.eastEnd, xr0 = -470, xr1 = 450;
  // Dầm hộp BTCT: bản mặt rộng 34,5 m, cánh hẫng mỏng dần hai bên, hộp giữa sườn vát (tiết diện ước lượng)
  const sec = [[-hw, 0], [hw, 0], [hw, -0.35], [11, -0.75], [9, -TTL.girderDepth], [-9, -TTL.girderDepth], [-11, -0.75], [-hw, -0.35]];
  bridge.concreteParts.push(prepColored(extrudeAlongX(sec, W, E, 320, ttlRoadY)));
  // Mặt đường 6 làn (3 làn mỗi chiều) + đường nối trên bờ hai đầu
  const car = TTL.lanesPerDir * TTL.laneWidth, zc = TTL.median / 2 + car / 2;
  const road = new THREE.Mesh(mergeGeometries([
    roadStrip(-1900, 1480, car, zc, 0.03, 1000, ttlRoadY),
    roadStrip(-1900, 1480, car, -zc, 0.03, 1000, ttlRoadY, true)
  ]), M.road);
  road.receiveShadow = true; bridge.group.add(road); bridge.noReflect.push(road); bridge.farHide.push(road);
  // Dải phân cách giữa 5,5 m (mang tháp và neo dây trước) + phân cách trên bờ
  bridge.concreteParts.push(prepColored(bentBox(xr1 - xr0, 0.35, TTL.median, (xr0 + xr1) / 2, 0.17, 0, 500, ttlRoadY), () => 0.88));
  const med = [bentBox(xr1 - xr0, 0.06, TTL.median - 0.8, (xr0 + xr1) / 2, 0.37, 0, 500, ttlRoadY)];
  for (const [a, b] of [[-1900, xr0], [xr1, 1480]]) med.push(...drCutAlongX(a, b, TTL.z, TTL.median / 2, 4, (len, xc, n) => bentBox(len, 0.3, TTL.median, xc, 0.15, 0, n, flatY)));   // mở tại nút giao chế độ lái (D-034)
  const mm = shadowed(new THREE.Mesh(mergeGeometries(med), MAT.grass), false, true); bridge.group.add(mm); bridge.noReflect.push(mm); bridge.farHide.push(mm);
  // Lề, gờ, lan can, khe co giãn modular, cột đèn trên dải phân cách (hệ dùng chung common/)
  addDeckEdges(bridge, { x0: xr0, x1: xr1, segs: 500, profile: ttlRoadY, hw, sidewalk: TTL.sidewalk });
  addJoints(bridge, { xs: [W, TTL.pylonX - 120, TTL.mainEnd, E], profile: ttlRoadY, width: TTL.deckWidth - 0.6, mat: M.joint });
  const xs = [];
  for (let x = xr0 + 15; x <= xr1 - 15; x += TTL.lampSpacing) if (Math.abs(x - TTL.pylonX) > 18) xs.push(x);
  addLampPosts(bridge, { xs, profile: ttlRoadY, rows: [{ z: -2.0, s: 1 }, { z: 2.0, s: -1 }] });
  // Dải LED mặt cầu: mép ngoài dầm và mép dải phân cách
  const strips = [];
  for (const s of [-1, 1]) {
    strips.push(bentBox(E - W, 0.14, 0.08, (W + E) / 2, -0.22, s * (hw + 0.04), 400, ttlRoadY));
    strips.push(bentBox(xr1 - xr0, 0.06, 0.06, (xr0 + xr1) / 2, 0.37, s * (TTL.median / 2 - 0.03), 500, ttlRoadY));
  }
  const ls = new THREE.Mesh(mergeGeometries(strips), M.ledStrip); bridge.group.add(ls); bridge.farHide.push(ls);
}
