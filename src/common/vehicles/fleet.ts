import * as THREE from 'three';
import { CONFIG, type VehicleTypeId } from '../../config';
import { vhBuildFleetGeometry, VEHICLE_TYPES } from './shapes';
import { vhMaterial, vhDepthMaterial } from './material';

/* =====================================================================
   ĐỘI XE (fleet) — một InstancedMesh cho mỗi hệ xe = 1 lệnh vẽ (thay 4 khối hộp thân / cabin / đèn pha / đèn hậu).
   Mọi fleet dùng chung các BufferAttribute + index của vhBuildFleetGeometry() (cùng buffer GPU); mỗi fleet chỉ thêm 3 thuộc tính instance:
   aType (chỉ số loại trong VEHICLE_TYPES), aPaint (màu thân, tuyến tính), aAccent (màu áo người lái, tuyến tính).
   ===================================================================== */
export interface VehicleFleet { mesh: THREE.InstancedMesh; type: THREE.InstancedBufferAttribute; paint: THREE.InstancedBufferAttribute; accent: THREE.InstancedBufferAttribute }

export const vhFleets: VehicleFleet[] = [];   // để test (__app.traffic.fleets)
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
const SHIRTS = CONFIG.vehicles.shirtColors;

export function vhCreateFleet(capacity: number, parent: THREE.Object3D, name: string): VehicleFleet {
  const src = vhBuildFleetGeometry(), geo = new THREE.BufferGeometry();
  for (const k of Object.keys(src.attributes)) geo.setAttribute(k, src.getAttribute(k));   // dùng chung đối tượng thuộc tính (không sao chép)
  geo.setIndex(src.index); geo.boundingBox = src.boundingBox; geo.boundingSphere = src.boundingSphere;
  const type = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1), paint = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3), accent = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
  geo.setAttribute('aType', type); geo.setAttribute('aPaint', paint); geo.setAttribute('aAccent', accent);
  const mesh = new THREE.InstancedMesh(geo, vhMaterial, capacity);
  mesh.name = name; mesh.customDepthMaterial = vhDepthMaterial; mesh.frustumCulled = false; mesh.castShadow = true;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  for (let i = 0; i < capacity; i++) mesh.setMatrixAt(i, HIDDEN);   // mọi xe khởi đầu ẩn (scale 0) tới lần đặt đầu tiên
  parent.add(mesh);
  const f = { mesh, type, paint, accent }; vhFleets.push(f);
  return f;
}
const _c = new THREE.Color();
/* Gán loại + màu thân (hex) cho xe i; màu áo chọn theo chỉ số (không dùng rand) — chỉ gọi lúc dựng */
export function vhSetInfo(f: VehicleFleet, i: number, type: VehicleTypeId, paint: number) {
  f.type.setX(i, VEHICLE_TYPES.indexOf(type));
  _c.setHex(paint); f.paint.setXYZ(i, _c.r, _c.g, _c.b);
  _c.setHex(SHIRTS[(i * 7 + 3) % SHIRTS.length]); f.accent.setXYZ(i, _c.r, _c.g, _c.b);
  f.type.needsUpdate = f.paint.needsUpdate = f.accent.needsUpdate = true;
}
const _m = new THREE.Matrix4(), _one = new THREE.Vector3(1, 1, 1);
/* Đặt xe i: base = điểm mặt đường dưới tâm xe, q = hướng (mũi xe +X của hình học) + dốc; kích thước thật nên scale 1 */
export function vhSetVehicle(f: VehicleFleet, i: number, base: THREE.Vector3, q: THREE.Quaternion) {
  f.mesh.setMatrixAt(i, _m.compose(base, q, _one));
}
export function vhHide(f: VehicleFleet, i: number) { f.mesh.setMatrixAt(i, HIDDEN); }
export function vhCommit(f: VehicleFleet) { f.mesh.instanceMatrix.needsUpdate = true; }
