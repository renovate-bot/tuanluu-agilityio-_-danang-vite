import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from '../../config';
import { MAT } from '../../core/materials';
import { prepColored, extrudeAlongX, boxAt, fillBlock, loftOct, loftRings, roadStrip, bentBox, shadowed } from '../../common/geometry';
import { addDeckEdges, addJoints, addLampPosts } from '../../common/deck';
import { flatY } from '../dragon/profile';
import { SH, shRoadY } from './profile';
import type { SongHanBridge } from './SongHanBridge';
import { drCutAlongX } from '../../environment/driveRoadGeo';

/* [fixedSpans] 11 nhịp BTCT 33 m, trụ (InstancedMesh), trụ đón, mố, đường đắp */
export function shBuildFixedSpans(bridge: SongHanBridge) {
  const M = bridge.mats, hw = SH.hw, W = SH.westEnd, E = SH.eastEnd, F = SH.fixedStart, B = CONFIG.bankX;
  const sec = [[-hw, 0], [hw, 0], [hw, -0.35], [4.2, -0.6], [3.6, -SH.fixedDepth], [-3.6, -SH.fixedDepth], [-4.2, -0.6], [-hw, -0.35]];
  bridge.concreteParts.push(prepColored(extrudeAlongX(sec, W, -F, 200, shRoadY)), prepColored(extrudeAlongX(sec, F, E, 170, shRoadY)));
  // mố + đường đắp có kè: Tây ~2 m tới kè rồi dốc qua lề ven sông; Đông ~35 m lấn sông tới kè
  for (const [x, a, b] of [[W, -290, W], [E, E, 290]]) {
    bridge.concreteParts.push(prepColored(boxAt(5, shRoadY(x) + 4, SH.deckWidth + 1, x, shRoadY(x) / 2 - 2.3, 0)));
    bridge.concreteParts.push(prepColored(fillBlock(a, b, SH.deckWidth, 0, -3, (xx) => shRoadY(xx) - 0.05, 30), () => 0.82));
  }
  const rev = [boxAt(B - E, 4.8, 1.2, (E + B) / 2, 0.4, SH.hw + 0.6), boxAt(B - E, 4.8, 1.2, (E + B) / 2, 0.4, -SH.hw - 0.6)];
  const rv = shadowed(new THREE.Mesh(mergeGeometries(rev), MAT.stone), false, true); bridge.group.add(rv); bridge.farHide.push(rv);
  // trụ đón hai bên nhịp quay: xà mũ rộng có gối đỡ đầu cánh (khi đóng) và gối nhịp cố định
  for (const s of [-1, 1]) {
    const x = s * SH.restX;
    bridge.concreteParts.push(prepColored(loftOct([3.0, 3.6], [3.0, 3.6], -3, 9.2, [x, 0], [x, 0], 0.5)));
    bridge.concreteParts.push(prepColored(loftOct([3.0, 3.6], [4.8, 11], 9.2, 11.0, [x, 0], [x, 0], 0.4)));
    for (const z of [-3, 3]) {
      bridge.steelParts.push(boxAt(1.0, 0.5, 1.4, s * 60.9, 11.25, z).toNonIndexed());                 // gối đầu cánh
      bridge.steelParts.push(boxAt(1.0, 0.9, 1.4, s * 63.4, 11.45, z).toNonIndexed());                 // gối nhịp cố định
    }
  }
  // trụ thường (InstancedMesh): thân tròn + xà mũ loe, vệt nước bám qua shader
  const col = new THREE.InstancedMesh(prepColored(new THREE.CylinderGeometry(1, 1, 1, 18).translate(0, 0.5, 0)), M.concrete, SH.piers.length);
  const capGeo = prepColored(loftRings([{ sx: 2.4, sz: 2.4, cx: 0, cz: 0, y: 0, ch: 0.4 }, { sx: 2.8, sz: 5, cx: 0, cz: 0, y: 0.55, ch: 0.4 }, { sx: 3.0, sz: 9.6, cx: 0, cz: 0, y: 1, ch: 0.3 }]));
  const cap = new THREE.InstancedMesh(capGeo, M.concrete, SH.piers.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  SH.piers.forEach((x, i) => {
    const top = shRoadY(x) - SH.fixedDepth, capH = 2.2;
    col.setMatrixAt(i, m.compose(v.set(x, -3, 0), q, sc.set(1.2, top - capH + 3, 1.2)));
    cap.setMatrixAt(i, m.compose(v.set(x, top - capH, 0), q, sc.set(1, capH, 1)));
  });
  col.castShadow = cap.castShadow = true; col.receiveShadow = cap.receiveShadow = true;
  bridge.group.add(col, cap);
  // mặt đường cố định + đường nối (Lê Duẩn phía Tây, Phạm Văn Đồng phía Đông)
  const zc = SH.lane;
  const road = new THREE.Mesh(mergeGeometries([
    roadStrip(-1900, -F, SH.laneWidth, zc, 0.03, 700, shRoadY), roadStrip(-1900, -F, SH.laneWidth, -zc, 0.03, 700, shRoadY, true),
    roadStrip(F, 1480, SH.laneWidth, zc, 0.03, 600, shRoadY), roadStrip(F, 1480, SH.laneWidth, -zc, 0.03, 600, shRoadY, true)
  ]), M.road);
  road.receiveShadow = true; bridge.group.add(road); bridge.noReflect.push(road); bridge.farHide.push(road);
  // dải giữa trên bờ chia đoạn tại các ô nút giao của chế độ lái (D-034): chỗ mở dải giữa lát mặt đường phẳng (environment/driveRoadGeo.ts)
  const cut = (a: number, b: number, segs: number, prof: (x: number) => number) => drCutAlongX(a, b, SH.z, SH.median / 2, segs, (len, xc, n) => bentBox(len, 0.3, SH.median, xc, 0.15, 0, n, prof));
  bridge.concreteParts.push(...cut(W - 30, -F, 200, shRoadY).map((g) => prepColored(g, () => 0.9)));
  bridge.concreteParts.push(...cut(F, E + 63, 200, shRoadY).map((g) => prepColored(g, () => 0.9)));
  const gm = [];
  for (const [a, b] of [[-1900, W - 30], [E + 63, 1480]]) gm.push(...cut(a, b, 4, flatY));
  const gmm = shadowed(new THREE.Mesh(mergeGeometries(gm), MAT.grass), false, true); bridge.group.add(gmm); bridge.noReflect.push(gmm); bridge.farHide.push(gmm);
  // lề, lan can, cột đèn, khe co giãn (phần cố định)
  for (const [a, b] of [[-290, -F], [F, 290]]) addDeckEdges(bridge, { x0: a, x1: b, segs: 160, profile: shRoadY, hw, sidewalk: SH.sidewalk });
  addJoints(bridge, { xs: [W, -F - 0.3, F + 0.3, E], profile: shRoadY, width: SH.deckWidth - 0.6, mat: M.mech });
  const xs = []; for (let x = -285; x <= 285; x += 25) if (Math.abs(x) > F + 4) xs.push(x);
  const zl = hw - SH.sidewalk + 0.45;
  addLampPosts(bridge, { xs, profile: shRoadY, rows: [{ z: -zl, s: -1 }, { z: zl, s: 1 }] });
  // dải LED viền xanh dọc mép dầm cố định
  const strips = [];
  for (const s of [-1, 1]) for (const [a, b] of [[W, -F], [F, E]]) strips.push(bentBox(b - a, 0.16, 0.08, (a + b) / 2, -0.25, s * (hw + 0.04), 120, shRoadY));
  const ls = new THREE.Mesh(mergeGeometries(strips), M.ledStrip); bridge.group.add(ls); bridge.farHide.push(ls);
}
