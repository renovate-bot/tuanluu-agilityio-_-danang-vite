import * as THREE from 'three';
import { CONFIG } from '../config';
import { scene } from '../core/renderer';
import { rand, clamp } from '../common/math';
import { patchWindows, patchFarGlow } from '../common/shaders';

/* ============================ Đô thị ============================ */
export function buildCity() {
  const items: { x: number; z: number; w: number; d: number; h: number; c: number }[] = [];
  const palette = [0xf3f0e7, 0xeae2cf, 0xdadcdc, 0xcfe0e7, 0xdde8df, 0xc8ced4, 0xf6f6f2, 0xe6dccb];
  const avoid = (_x: number, z: number) => Math.abs(z) < 48 || Math.abs(z - CONFIG.ttl.z) < 40;
  const place = (x0: number, x1: number, near: number, beach: boolean) => {
    const step = 36;
    for (let gx = x0; gx < x1; gx += step) for (let gz = -1800; gz < 1800; gz += step) {
      const ix = Math.round(gx / step), iz = Math.round(gz / step);
      if (ix % 5 === 0 || iz % 5 === 0) continue;  // chừa đường phố
      if (avoid(gx, gz) || rand() < 0.16) continue;
      const nearR = 1 - clamp((Math.abs(gx - near)) / 900, 0, 1);
      let h = 9 + rand() * 26 + nearR * rand() * 65 + (rand() < 0.05 ? 55 : 0);
      if (beach && gx > 1290) h = 45 + rand() * 115; // khách sạn ven biển Mỹ Khê
      items.push({ x: gx + (rand() - 0.5) * 6, z: gz + (rand() - 0.5) * 6, w: 14 + rand() * 15, d: 14 + rand() * 15, h, c: palette[Math.floor(rand() * palette.length)] });
    }
  };
  place(-2000, -330, -330, false); // bờ Tây — trung tâm Hải Châu
  place(340, 1450, 340, true);      // bờ Đông — Sơn Trà
  // Gom thành cụm, mỗi cụm là một LOD (gần: có cửa sổ; xa: khối trơn)
  const cell = 900, clusters = new Map<string, typeof items>();
  for (const b of items) { const key = `${Math.floor(b.x / cell)}_${Math.floor(b.z / cell)}`; if (!clusters.has(key)) clusters.set(key, []); clusters.get(key).push(b); }
  const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const nearMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, metalness: 0.05 });
  patchWindows(nearMat, { perBuilding: true });
  const farMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
  patchFarGlow(farMat);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3(), col = new THREE.Color();
  for (const list of clusters.values()) {
    const cx = list.reduce((a, b) => a + b.x, 0) / list.length, cz = list.reduce((a, b) => a + b.z, 0) / list.length;
    const near = new THREE.InstancedMesh(geo, nearMat, list.length), far = new THREE.InstancedMesh(geo, farMat, list.length);
    list.forEach((b, i) => {
      m.compose(v.set(b.x - cx, CONFIG.landY, b.z - cz), q, s.set(b.w, b.h, b.d));
      near.setMatrixAt(i, m); far.setMatrixAt(i, m); col.setHex(b.c); near.setColorAt(i, col); far.setColorAt(i, col.multiplyScalar(0.92));
    });
    near.castShadow = true; near.receiveShadow = true;
    const lod = new THREE.LOD(); lod.position.set(cx, 0, cz);
    lod.addLevel(near, 0); lod.addLevel(far, 2200); lod.addLevel(new THREE.Object3D(), 8000);
    scene.add(lod);
  }
}
