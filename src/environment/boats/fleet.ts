import * as THREE from 'three';
import type { BoatTypeId } from '../../config';
import { btBuildFleetGeometry, BOAT_TYPES } from './hulls';
import { btFleetMaterial, btDepthMaterial } from './material';

/* =====================================================================
   ĐỘI TÀU (fleet) — một InstancedMesh cho mỗi nhóm tàu = 1 lệnh vẽ (thay 3 khối hộp thân / cabin / mái).
   Hình học gộp các kiểu nhóm cần; aBoat (instance) chọn kiểu, biến thể, màu LED, tên.
   ===================================================================== */
export interface BoatInfo { type: BoatTypeId; variant: number; led: number; name: number }
export interface BoatFleet { mesh: THREE.InstancedMesh; types: BoatTypeId[]; info: THREE.InstancedBufferAttribute }

export const btFleets: BoatFleet[] = [];   // để test (__app.boats.fleets)
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

export function btCreateFleet(capacity: number, types: BoatTypeId[], parent: THREE.Object3D, name: string): BoatFleet {
  const geo = btBuildFleetGeometry(types), info = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
  geo.setAttribute('aBoat', info);
  const mesh = new THREE.InstancedMesh(geo, btFleetMaterial, capacity);
  mesh.name = name; mesh.customDepthMaterial = btDepthMaterial; mesh.frustumCulled = false; mesh.castShadow = true;
  for (let i = 0; i < capacity; i++) mesh.setMatrixAt(i, HIDDEN);
  parent.add(mesh);
  const f = { mesh, types, info }; btFleets.push(f);
  return f;
}
/* Gán kiểu / biến thể / LED / tên — chỉ gọi lúc dựng */
export function btSetInfo(f: BoatFleet, i: number, b: BoatInfo) {
  f.info.setXYZW(i, BOAT_TYPES.indexOf(b.type), b.variant, b.led, b.name); f.info.needsUpdate = true;
}
const _m = new THREE.Matrix4(), _s = new THREE.Vector3();
/* Đặt tàu i: base = điểm mặt nước dưới tâm tàu, q = hướng + tròng trành, len = chiều dài (m; hình học dài 1) */
export function btSetBoat(f: BoatFleet, i: number, base: THREE.Vector3, q: THREE.Quaternion, len: number) {
  f.mesh.setMatrixAt(i, _m.compose(base, q, _s.setScalar(len)));
}
export function btHideBoat(f: BoatFleet, i: number) { f.mesh.setMatrixAt(i, HIDDEN); }
export function btCommit(f: BoatFleet) { f.mesh.instanceMatrix.needsUpdate = true; }
