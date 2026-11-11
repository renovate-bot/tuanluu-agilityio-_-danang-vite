import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from '../../config';
import { MAT } from '../../core/materials';
import { scene } from '../../core/renderer';
import { shared } from '../../core/shared';
import { lerp, rng } from '../../common/math';
import { boxAt, prepColored } from '../../common/geometry';
import type { Atlas } from './adAtlas';
import type { Building } from './clearance';

/* [promenade] Chi tiết dải đi bộ hai bờ (P3): lan can kè, ghế đá, bồn hoa, thùng rác, bến du thuyền (bờ Tây gần Cầu Rồng),
   mái hiên + bảng hiệu cửa hàng tầng trệt, đèn LED quấn cây dọc Bạch Đằng, đèn trái tim Cầu Tình Yêu.
   Chia chunk 600 m, mỗi chunk là một THREE.LOD (ẩn khi camera xa hơn 600 m) với 1 mesh đồ vật (màu đỉnh) + 1 mesh bảng hiệu (atlas).
   Mọi phần ngẫu nhiên dùng rng(seed) riêng, không đụng chuỗi rand() của khu phố. */
const B = CONFIG.bankX, Y = CONFIG.landY, R = CONFIG.riverfront, P = R.promenade;
type C3 = [number, number, number];
const WOOD: C3 = [0.55, 0.38, 0.22], STONE: C3 = [0.78, 0.76, 0.7], STEEL: C3 = [0.78, 0.8, 0.83], GREEN: C3 = [0.2, 0.4, 0.2];
const AWN: C3[] = [[0.85, 0.25, 0.2], [0.2, 0.55, 0.7], [0.95, 0.75, 0.2], [0.3, 0.65, 0.35], [0.9, 0.5, 0.15]];
const col = (g: THREE.BufferGeometry, c: C3) => prepColored(g, () => c);
const bx = (sx: number, sy: number, sz: number, x: number, y0: number, z: number, c: C3) => col(boxAt(sx, sy, sz, x, y0 + sy / 2, z), c);

/* Vùng không đặt đồ vật: chân cầu, hành lang hầm */
const blocked = (z: number, pad = 0) => Math.abs(z) < 34 + pad || Math.abs(z - CONFIG.songHan.z) < 18 + pad || Math.abs(z - CONFIG.ttl.z) < 40 + pad || Math.abs(z - (CONFIG.ttl.z - 65)) < 14 + pad || Math.abs(z - CONFIG.hanTunnel.z) < 28 + pad;

export interface Promenade {
  group: THREE.Group; lights: THREE.InstancedMesh; chunks: THREE.LOD[]; lightCount: number;
  update(): void; setEnabled(on: boolean): void; dispose(): void;
}
interface Tree { x: number; y: number; z: number; r: number; palm: boolean; bx: number; bz: number }   // bx, bz: độ lệch ngọn so với gốc thân (chỉ dừa; thân cong bend·trunkWidth theo hướng xoay)
function collectTrees(): Tree[] {
  scene.updateMatrixWorld(true);
  const out: Tree[] = [], m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  scene.traverse((o) => {
    const im = o as THREE.InstancedMesh;
    if (!im.isInstancedMesh || (im.material !== MAT.leaf && im.material !== MAT.palm)) return;
    for (let i = 0; i < im.count; i++) {
      im.getMatrixAt(i, m); m.decompose(p, q, s);
      if (s.x < 1e-6) continue;
      p.applyMatrix4(im.matrixWorld);
      if (p.x < -290 || p.x > -262 || p.z < -1600 || p.z > 1100) continue;              // Bạch Đằng, bờ Tây
      const pal = im.material === MAT.palm, yaw = 2 * Math.atan2(q.y, q.w), bendX = CONFIG.trees.palm.bend * CONFIG.trees.palm.trunkWidth;
      out.push({ x: p.x, y: p.y, z: p.z, r: s.x, palm: pal, bx: pal ? bendX * Math.cos(yaw) : 0, bz: pal ? -bendX * Math.sin(yaw) : 0 });
    }
  });
  return out;
}

export function buildPromenade(atlas: Atlas, adMat: THREE.Material, buildings: Building[]): Promenade {
  const group = new THREE.Group(); group.name = 'rf-promenade';
  const rnd = rng(5150), z0 = -2600, z1 = 2600, n = Math.ceil((z1 - z0) / P.chunk);
  const furn: THREE.BufferGeometry[][] = Array.from({ length: 2 * n }, () => []), signs: THREE.BufferGeometry[][] = Array.from({ length: 2 * n }, () => []);
  const cid = (sd: number, z: number) => (sd < 0 ? 0 : n) + Math.min(n - 1, Math.max(0, Math.floor((z - z0) / P.chunk)));
  // lan can kè + ghế đá + bồn hoa + thùng rác
  const LG = R.love, lgz0 = LG.z - LG.width / 2 - LG.railGap, lgz1 = LG.z + LG.width / 2 + LG.railGap;
  for (const sd of [-1, 1]) {
    for (let z = (sd < 0 ? -2600 : -2300) + 2; z < z1; z += P.railStep) {
      if (blocked(z, 4)) continue;
      if (sd > 0 && z + P.railStep > lgz0 && z - 0.14 < lgz1) continue;   // bờ Đông: chừa lối vào Cầu Tình Yêu, bỏ cột + đoạn tay vịn [z, z + railStep] chạm bề rộng cầu tàu + railGap (người đi dạo qua đây)
      const f = furn[cid(sd, z)], x = sd * (B + 1);
      f.push(bx(0.28, 1.1, 0.28, x, Y + 0.5, z, STONE), bx(0.1, 0.07, P.railStep, x, Y + 1.5, z + P.railStep / 2, STEEL), bx(0.06, 0.05, P.railStep, x, Y + 1.05, z + P.railStep / 2, STEEL));
    }
    for (let z = (sd < 0 ? -2500 : -2200); z < z1; z += P.benchStep) {
      const zz = z + (rnd() - 0.5) * 6;
      if (blocked(zz, 6)) continue;
      const f = furn[cid(sd, zz)], x = sd * (B + 4.5), tow = -sd;      // ghế quay mặt ra sông
      f.push(bx(0.5, 0.1, 1.8, x, Y + 0.45, zz, WOOD), bx(0.08, 0.5, 1.8, x - tow * 0.25, Y + 0.55, zz, WOOD), bx(0.45, 0.45, 0.12, x, Y, zz - 0.8, STONE), bx(0.45, 0.45, 0.12, x, Y, zz + 0.8, STONE));
      if (rnd() < 0.5) f.push(bx(1.4, 0.55, 1.4, sd * (B + 7), Y, zz + 5, STONE), bx(1.15, 0.25, 1.15, sd * (B + 7), Y + 0.55, zz + 5, [0.25 + rnd() * 0.6, 0.45 + rnd() * 0.3, 0.2 + rnd() * 0.3]));   // bồn hoa
      if (rnd() < 0.3) f.push(col(new THREE.CylinderGeometry(0.26, 0.24, 0.85, 8).translate(sd * (B + 3), Y + 0.43, zz - 4), GREEN));   // thùng rác
    }
  }
  // bến du thuyền sông Hàn (bờ Tây, phía Nam Cầu Rồng): phao nổi, cầu dẫn, mái che, thuyền neo
  const mz = 104, mx = -(B - 8), mf = furn[cid(-1, mz)];
  mf.push(bx(3, 0.5, 46, mx, 0.05, mz, [0.82, 0.82, 0.8]));
  for (let k = 0; k < 5; k++) { const z = mz - 18 + k * 9; mf.push(bx(9, 0.4, 1.6, mx + 6, 0.05, z, [0.8, 0.8, 0.78])); mf.push(bx(2.6, 1.0, 7, mx + 11, 0.05, z + 0.5 * (k % 2), [0.95, 0.95, 0.93]), bx(1.4, 0.6, 3, mx + 11, 1.05, z + 0.5 * (k % 2), [0.25, 0.55, 0.7])); }
  const ramp = boxAt(9, 0.25, 2.2, 0, 0, 0); ramp.rotateZ(Math.atan2(2.45, 9)); ramp.translate(-B + 4.2, 1.7, mz);
  mf.push(col(ramp, [0.75, 0.75, 0.72]));
  for (let k = 0; k < 4; k++) { const z = mz - 15 + k * 10; for (const dz of [-1.6, 1.6]) mf.push(bx(0.15, 3, 0.15, mx - 0.5, 0.3, z + dz, STEEL)); mf.push(bx(3.6, 0.15, 4, mx - 0.5, 3.2, z, [0.2, 0.5, 0.65])); }
  // cửa hàng tầng trệt ở hàng nhà đầu tiên: mái hiên nhiều màu + bảng hiệu nhỏ lấy từ atlas
  const shopSlots = atlas.byKind('shop'); let si = 0;
  for (const b of buildings) {
    const sd = Math.sign(b.x), ax = Math.abs(b.x);
    if (ax < 322 || ax > 362 || Math.abs(b.z) > 1500 || blocked(b.z, 8)) continue;
    const face = -sd, xf = b.x + face * (b.w / 2), f = furn[cid(sd, b.z)], w = Math.min(b.d, 14);
    f.push(col(boxAt(1.9, 0.25, w, xf + face * 0.95, Y + 3.2, b.z), AWN[Math.floor(rnd() * AWN.length)]));
    const s = shopSlots[si++ % shopSlots.length], g = new THREE.PlaneGeometry(4.6, 1.15), [u0, v0, u1, v1] = atlas.rect(s), uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, lerp(u0, u1, uv.getX(i)), lerp(v0, v1, uv.getY(i)));
    g.rotateY(face > 0 ? Math.PI / 2 : -Math.PI / 2); g.translate(xf + face * 0.06, Y + 4.5, b.z);
    signs[cid(sd, b.z)].push(g);
  }
  // dựng từng chunk thành LOD, tọa độ cục bộ quanh tâm chunk
  const lodMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82 });
  const chunks: THREE.LOD[] = [];
  for (let c = 0; c < 2 * n; c++) {
    const sd = c < n ? -1 : 1, zc = z0 + (c % n + 0.5) * P.chunk, cx = sd * (B + 9), detail = new THREE.Group();
    const shift = (g: THREE.BufferGeometry) => g.translate(-cx, 0, -zc);
    if (furn[c].length) { const mm = new THREE.Mesh(mergeGeometries(furn[c].map((g) => shift(g))), lodMat); mm.castShadow = false; mm.name = `rf-furniture-${c}`; detail.add(mm); }
    if (signs[c].length) { const sm = new THREE.Mesh(mergeGeometries(signs[c].map((g) => shift(g))), adMat); sm.name = `rf-shopsigns-${c}`; detail.add(sm); }
    if (!detail.children.length) continue;
    detail.traverse((o) => o.layers.set(1));
    const lod = new THREE.LOD(); lod.position.set(cx, 0, zc); lod.addLevel(detail, 0); lod.addLevel(new THREE.Object3D(), P.lod);
    group.add(lod); chunks.push(lod);
  }
  // đèn LED quấn cây dọc Bạch Đằng + đèn trái tim đỏ trên lan can Cầu Tình Yêu: một InstancedMesh, màu theo instance
  const trees = collectTrees(), pts: [number, number, number, C3][] = [], warm: C3 = [1, 0.74, 0.38];
  for (const t of trees) {
    const k = t.palm ? 6 : 8;
    for (let i = 0; i < k; i++) {
      const a = rnd() * 6.2832, e = t.palm ? 0 : (rnd() - 0.4) * 1.2, rr = t.palm ? 1.9 : t.r * 0.95;
      pts.push([t.x + Math.cos(a) * rr * Math.cos(e), t.y + Math.sin(e) * rr * (t.palm ? 0 : 0.85) - (t.palm ? 0.4 : 0), t.z + Math.sin(a) * rr * Math.cos(e), warm]);
    }
    for (let i = 0; i < 3; i++) {
      const dy = 1 + i * (t.palm ? 3 : 1.4), f = t.palm ? Math.pow(dy / Math.max(t.y - Y, 1), 2) : 0;   // dừa: thân cong theo y² (trPalmTrunkGeo), đèn bám thân theo độ cao
      pts.push([t.x - t.bx * (1 - f) + 0.3, Y + dy, t.z - t.bz * (1 - f), warm]);
    }
  }
  const L = R.love, lx1 = B, lx0 = B - L.length;
  for (let x = lx0 + 1.5; x < lx1 - 1; x += 3) for (const s of [-1, 1]) pts.push([x, Y + 1.5, L.z + s * (L.width / 2 - 0.1), [1, 0.1, 0.2]]);
  const lights = new THREE.InstancedMesh(new THREE.SphereGeometry(0.11, 5, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }), pts.length);
  const m = new THREE.Matrix4(), cc = new THREE.Color();
  pts.forEach(([x, y, z, c], i) => { lights.setMatrixAt(i, m.makeTranslation(x, y, z)); lights.setColorAt(i, cc.setRGB(c[0], c[1], c[2])); });
  lights.name = 'rf-night-lights'; lights.computeBoundingSphere(); lights.layers.set(1); lights.visible = false; group.add(lights);
  const api: Promenade = {
    group, lights, chunks, lightCount: pts.length,
    update() { const nt = shared.uNight.value; lights.visible = nt > 0.05; (lights.material as THREE.MeshBasicMaterial).color.setScalar(nt * 2.6); },
    setEnabled(on) { group.visible = on; },
    dispose() { group.traverse((o) => { const me = o as THREE.Mesh; if (me.geometry) me.geometry.dispose(); }); lodMat.dispose(); (lights.material as THREE.Material).dispose(); group.removeFromParent(); }
  };
  return api;
}
