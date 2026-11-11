import * as THREE from 'three';
import { scene } from '../../core/renderer';
import { MAT } from '../../core/materials';
import { lerp } from '../../common/math';
import { taperedTube, UP } from '../../common/geometry';
import { spine } from './body';

/* ============================ Đầu rồng ============================ */
export let headGroup: THREE.Group, whiskerGroup: THREE.Group;
export const MOUTH_LOCAL = new THREE.Vector3(13.2, -2.6, 0);
type T3 = [number, number, number];

export function buildDragonHead() {
  headGroup = new THREE.Group(); headGroup.name = 'dragon-head';   // tên cho test đi dạo chọn lưới rắn (tests/stroll-check.mjs)
  const end = spine.getPointAt(1);
  headGroup.position.copy(end).add(new THREE.Vector3(3.2, 0.9, 0));
  headGroup.rotation.z = 0.06;
  const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, p: T3, s?: T3, r?: T3) => {
    const mesh = new THREE.Mesh(geo, mat); mesh.position.set(...p);
    if (s) mesh.scale.set(...s); if (r) mesh.rotation.set(...r);
    mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  };
  const G = MAT.gold, H = headGroup;
  add(H, new THREE.SphereGeometry(4.6, 28, 18), G, [0, 0.8, 0], [1.35, 1, 0.95]);                         // sọ
  add(H, new THREE.CylinderGeometry(2.0, 3.4, 11, 22), G, [8.5, 0.4, 0], [0.75, 1, 0.95], [0, 0, -Math.PI / 2]); // mõm trên
  add(H, new THREE.SphereGeometry(2.3, 20, 14), G, [14, 1.0, 0], [1, 0.8, 1.15]);                          // mũi
  for (const s of [-1, 1]) {
    add(H, new THREE.SphereGeometry(0.45, 10, 8), MAT.mouth, [15.7, 1.6, s * 1.1]);                       // lỗ mũi
    add(H, new THREE.SphereGeometry(1.8, 16, 10), G, [4.6, 3.4, s * 2.6], [1.6, 0.55, 0.9]);              // gờ mày
    add(H, new THREE.SphereGeometry(1.15, 16, 12), MAT.eye, [4.9, 2.5, s * 3.25]);                        // mắt
    add(H, new THREE.SphereGeometry(0.6, 12, 10), MAT.pupil, [5.75, 2.5, s * 3.8]);                       // con ngươi
    add(H, new THREE.ConeGeometry(1.2, 4.5, 6), G, [-1.5, 2.6, s * 4.4], [1, 1, 0.3], [s * 0.5, 0, 1.9]);  // tai/vây má
    // Sừng cong ra sau
    const horn = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.5, 4.3, s * 2.0), new THREE.Vector3(-3, 6.8, s * 2.8), new THREE.Vector3(-6.8, 8.4, s * 3.6), new THREE.Vector3(-10.5, 8.0, s * 4.3)
    ]);
    add(H, taperedTube(horn, 40, 10, (u) => lerp(0.95, 0.12, u)), G, [0, 0, 0]);
    const branch = new THREE.CatmullRomCurve3([new THREE.Vector3(-4.8, 7.6, s * 3.2), new THREE.Vector3(-5.6, 9.6, s * 3.9), new THREE.Vector3(-6.8, 10.6, s * 4.3)]);
    add(H, taperedTube(branch, 20, 8, (u) => lerp(0.45, 0.08, u)), G, [0, 0, 0]);
  }
  // Hàm dưới mở (miệng há)
  const jaw = new THREE.Group(); jaw.position.set(1.5, -2.2, 0); jaw.rotation.z = -0.38; H.add(jaw);
  add(jaw, new THREE.CylinderGeometry(1.3, 2.6, 11, 20), G, [5.5, 0, 0], [0.6, 1, 0.85], [0, 0, -Math.PI / 2]);
  add(jaw, new THREE.SphereGeometry(1.35, 16, 12), G, [11, 0, 0], [1, 0.75, 1]);
  add(jaw, new THREE.SphereGeometry(1, 16, 10), MAT.mouth, [6, 0.55, 0], [4.2, 0.45, 1.15]);           // lưỡi
  // Răng (InstancedMesh)
  const toothGeo = new THREE.ConeGeometry(0.32, 1.2, 6).translate(0, 0.6, 0);
  const upper = new THREE.InstancedMesh(toothGeo, MAT.tooth, 20), lower = new THREE.InstancedMesh(toothGeo, MAT.tooth, 18);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const down = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
  let k = 0;
  for (let i = 0; i < 10; i++) for (const s of [-1, 1]) {
    const x = 5.5 + i * 0.85, big = i === 8 ? 2.0 : 1;
    m.compose(v.set(x, -0.85, s * (1.85 - i * 0.08)), down, sc.set(big, big, big)); upper.setMatrixAt(k++, m);
  }
  k = 0;
  for (let i = 0; i < 9; i++) for (const s of [-1, 1]) {
    const x = 3 + i * 0.9, big = i === 7 ? 1.8 : 1;
    m.compose(v.set(x, 0.75, s * (1.55 - i * 0.07)), q.identity(), sc.set(big, big, big)); lower.setMatrixAt(k++, m);
  }
  H.add(upper); jaw.add(lower);
  // Bờm lửa xòe sau gáy và râu cằm
  const coneGeo = new THREE.ConeGeometry(0.75, 1, 6).translate(0, 0.5, 0);
  const mane = new THREE.InstancedMesh(coneGeo, G, 40);
  const dir = new THREE.Vector3();
  k = 0;
  for (const ring of [{ x: -5.3, r: 3.9, len: 6.5, n: 17 }, { x: -2.2, r: 4.2, len: 4.2, n: 13 }]) {
    for (let i = 0; i < ring.n; i++) {
      const a = -1.95 + i * (3.9 / (ring.n - 1));
      dir.set(-1.5, Math.cos(a), Math.sin(a)).normalize();
      q.setFromUnitVectors(UP, dir);
      const L = ring.len * (0.75 + 0.35 * Math.cos(a));
      m.compose(v.set(ring.x, 0.8 + ring.r * 0.8 * Math.cos(a), ring.r * Math.sin(a)), q, sc.set(1, L, 0.55)); mane.setMatrixAt(k++, m);
    }
  }
  mane.count = k; mane.castShadow = true; H.add(mane);
  const beard = new THREE.InstancedMesh(coneGeo, G, 8);
  for (let i = 0; i < 8; i++) {
    dir.set(-0.55, -1, (i % 2 ? 0.3 : -0.3)).normalize(); q.setFromUnitVectors(UP, dir);
    m.compose(v.set(3.5 + i * 0.9, -2.0, (i % 2 ? 0.5 : -0.5)), q, sc.set(0.9, 3.2 - i * 0.18, 0.5)); beard.setMatrixAt(i, m);
  }
  jaw.add(beard);
  // Râu rồng dài, đung đưa nhẹ
  whiskerGroup = new THREE.Group(); whiskerGroup.position.set(13.5, 0.4, 0); H.add(whiskerGroup);
  for (const s of [-1, 1]) {
    const c = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, s * 2.1), new THREE.Vector3(2.5, -0.6, s * 4.2), new THREE.Vector3(1, -3.6, s * 7.6), new THREE.Vector3(-5, -6.2, s * 9.6), new THREE.Vector3(-11, -5.2, s * 11.2)
    ]);
    add(whiskerGroup, taperedTube(c, 60, 8, (u) => lerp(0.38, 0.06, u)), G, [0, 0, 0]);
  }
  scene.add(headGroup);
}
