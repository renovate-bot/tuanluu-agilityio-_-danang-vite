import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG, type BoatTypeId } from '../../config';

/* =====================================================================
   HÌNH HỌC TÀU — 5 kiểu (spec §6): A du thuyền hai thân, B tàu gỗ kiểu cũ, C du thuyền 3 tầng, D tàu cá / hàng, E tàu buồm cao.
   Dựng theo mét ở chiều dài danh nghĩa rồi chuẩn hóa: dài 1 theo Z (mũi về +Z), đáy ngay dưới mặt nước y = 0.
   Fleet scale đều theo len ⇒ mọi tỉ lệ cao/rộng giữ theo kiểu.
   Mỗi đỉnh: color (màu ban ngày), uv (biển tên → ô atlas 0, phần khác → ô trắng), aGlow (loại đèn đêm, xem Glow).
   ===================================================================== */
export enum Glow { None = 0, Window = 1, Led = 2, NavRed = 3, NavGreen = 4, Plate = 5, Lantern = 6, Stripe = 7 }   // Stripe: sọc thân, không phát sáng, đổi màu theo biến thể
export const BOAT_TYPES: BoatTypeId[] = ['A', 'B', 'C', 'D', 'E'];
export const ATLAS_ROWS = CONFIG.boats.names.length + 1;   // atlas biển tên: mỗi tên một hàng + hàng cuối trắng
const WHITE_V = 1 - 0.5 / ATLAS_ROWS;                      // v giữa hàng trắng

const C = CONFIG.boats.palette;   // màu ban ngày (config.ts)
const LANTERN = C.lanterns;

/* Một bộ phận: bỏ index, gán màu, glow, uv (ô trắng trừ biển tên) */
function part(g: THREE.BufferGeometry, color: number, glow: Glow): THREE.BufferGeometry {
  const p = g.index ? g.toNonIndexed() : g; p.clearGroups();
  const n = p.getAttribute('position').count, col = new THREE.Color(color), c = new Float32Array(n * 3), gl = new Float32Array(n);
  for (let i = 0; i < n; i++) { c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; gl[i] = glow; }
  p.setAttribute('color', new THREE.BufferAttribute(c, 3)); p.setAttribute('aGlow', new THREE.BufferAttribute(gl, 1));
  if (glow !== Glow.Plate) { const uv = new Float32Array(n * 2); for (let i = 0; i < n; i++) { uv[i * 2] = 0.5; uv[i * 2 + 1] = WHITE_V; } p.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); }
  return p;
}

/* Người dựng một kiểu tàu: tích các bộ phận rồi gộp + chuẩn hóa */
class Kit {
  parts: THREE.BufferGeometry[] = [];
  add(g: THREE.BufferGeometry, color: number, glow = Glow.None) { this.parts.push(part(g, color, glow)); }
  box(sx: number, sy: number, sz: number, x: number, y: number, z: number, color: number, glow = Glow.None, rx = 0) {
    const g = new THREE.BoxGeometry(sx, sy, sz); if (rx) g.rotateX(rx); this.add(g.translate(x, y, z), color, glow);
  }
  /* Khối lăng trụ đứng từ mặt bằng (x, z), từ y0 lên y1 — thân tàu, cabin mũi tròn */
  prism(pts: [number, number][], y0: number, y1: number, color: number, glow = Glow.None) {
    const s = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
    const g = new THREE.ExtrudeGeometry(s, { depth: y1 - y0, bevelEnabled: false, curveSegments: 4 }).rotateX(-Math.PI / 2).translate(0, y0, 0);
    this.add(g, color, glow);
  }
  /* Mặt bằng thân: đuôi vuông ở z0, thon dần về mũi nhọn ở z1 (bow = phần dài vuốt) */
  hullPlan(hw: number, z0: number, z1: number, bow: number): [number, number][] {
    const zb = z1 - bow;
    return [[-hw, z0], [hw, z0], [hw, zb], [hw * 0.75, zb + bow * 0.5], [hw * 0.3, z1 - bow * 0.12], [0, z1], [-hw * 0.3, z1 - bow * 0.12], [-hw * 0.75, zb + bow * 0.5], [-hw, zb]];
  }
  /* Cabin mũi bo: chữ nhật, mặt trước tròn */
  cabinPlan(hw: number, z0: number, z1: number, round: number): [number, number][] {
    const pts: [number, number][] = [[-hw, z0], [hw, z0]];
    for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI / 2; pts.push([hw * Math.cos(a), z1 - round + round * Math.sin(a)]); }
    for (let i = 5; i >= 0; i--) { const a = (i / 6) * Math.PI / 2; pts.push([-hw * Math.cos(a), z1 - round + round * Math.sin(a)]); }
    return pts;
  }
  /* Viền LED quanh một tầng (4 cạnh mảnh) */
  ledLoop(hw: number, z0: number, z1: number, y: number, t = 0.12) {
    this.box(t, t, z1 - z0, -hw, y, (z0 + z1) / 2, C.led, Glow.Led); this.box(t, t, z1 - z0, hw, y, (z0 + z1) / 2, C.led, Glow.Led);
    this.box(hw * 2, t, t, 0, y, z0, C.led, Glow.Led); this.box(hw * 2, t, t, 0, y, z1, C.led, Glow.Led);
  }
  /* Dải cửa sổ hai mạn + mặt trước */
  windows(hw: number, z0: number, z1: number, y0: number, h: number, front = true) {
    const y = y0 + h / 2, l = z1 - z0;
    this.box(0.08, h, l, -hw - 0.04, y, (z0 + z1) / 2, C.glass, Glow.Window); this.box(0.08, h, l, hw + 0.04, y, (z0 + z1) / 2, C.glass, Glow.Window);
    if (front) this.box(hw * 1.6, h, 0.08, 0, y, z1 + 0.04, C.glass, Glow.Window);
  }
  /* Lan can: tay vịn hai mạn + đuôi, cột thưa */
  railing(hw: number, z0: number, z1: number, y: number, h = 1.0) {
    const top = y + h, l = z1 - z0;
    this.box(0.08, 0.08, l, -hw, top, (z0 + z1) / 2, C.rail); this.box(0.08, 0.08, l, hw, top, (z0 + z1) / 2, C.rail); this.box(hw * 2, 0.08, 0.08, 0, top, z0, C.rail);
    this.box(0.06, 0.06, l, -hw, y + h / 2, (z0 + z1) / 2, C.rail); this.box(0.06, 0.06, l, hw, y + h / 2, (z0 + z1) / 2, C.rail);
    const n = Math.max(2, Math.round(l / 3.5));
    for (let i = 0; i <= n; i++) { const z = z0 + (l * i) / n; this.box(0.07, h, 0.07, -hw, y + h / 2, z, C.rail); this.box(0.07, h, 0.07, hw, y + h / 2, z, C.rail); }
  }
  /* Lốp chống va treo dọc mạn */
  fenders(hw: number, z0: number, z1: number, y: number, n: number) {
    for (let i = 0; i < n; i++) {
      const z = z0 + ((z1 - z0) * (i + 0.5)) / n;
      for (const s of [-1, 1]) { const g = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 6).rotateZ(Math.PI / 2).translate(s * (hw + 0.15), y, z); this.add(g, C.fender); }
    }
  }
  /* Cờ đỏ sao vàng trên cột nhỏ */
  flag(x: number, y: number, z: number, s = 1) {
    this.box(0.06, 1.6 * s, 0.06, x, y + 0.8 * s, z, C.mast);
    this.box(0.04, 0.6 * s, 0.9 * s, x, y + 1.3 * s, z - 0.45 * s, C.flag);
    const st = new THREE.CircleGeometry(0.18 * s, 5).rotateY(Math.PI / 2).translate(x + 0.03, y + 1.3 * s, z - 0.45 * s); this.add(st, C.star);
    const st2 = new THREE.CircleGeometry(0.18 * s, 5).rotateY(-Math.PI / 2).translate(x - 0.03, y + 1.3 * s, z - 0.45 * s); this.add(st2, C.star);
  }
  /* Biển tên hai mạn (uv chạy đúng chiều đọc ở cả hai mặt) */
  plate(hw: number, zc: number, y: number, len: number, h: number) {
    for (const s of [-1, 1]) {
      const g = new THREE.PlaneGeometry(len, h).rotateY(s * Math.PI / 2).translate(s * (hw + 0.06), y, zc);
      const uv = g.getAttribute('uv') as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) / ATLAS_ROWS);   // hàng 0 của atlas; fleet dịch theo tên
      this.add(g, C.plate, Glow.Plate);
    }
  }
  /* Đèn mạn: đỏ bên trái (+X khi mũi về +Z), xanh bên phải */
  nav(hw: number, y: number, z: number) {
    this.box(0.25, 0.25, 0.25, hw + 0.1, y, z, C.navRed, Glow.NavRed); this.box(0.25, 0.25, 0.25, -hw - 0.1, y, z, C.navGreen, Glow.NavGreen);
  }
  /* Gộp + chuẩn hóa dài 1 theo Z, tâm Z = 0, giữ y = 0 là mặt nước */
  build(): THREE.BufferGeometry {
    const g = mergeGeometries(this.parts, false)!;
    g.computeBoundingBox(); const b = g.boundingBox!, L = b.max.z - b.min.z;
    g.translate(0, 0, -(b.max.z + b.min.z) / 2); g.scale(1 / L, 1 / L, 1 / L);
    g.computeBoundingBox(); g.computeBoundingSphere();
    return g;
  }
}

/* A — du thuyền hai thân: 2 phao thân, sàn, 2 tầng cabin mũi bo, sọc đỏ chéo, mái phẳng (26 m) */
function typeA(k: Kit) {
  for (const s of [-1, 1]) k.prism(k.hullPlan(1.1, -13, 13, 6).map(([x, z]) => [x + s * 2.8, z] as [number, number]), -0.6, 1.4, C.white);
  k.box(7.8, 0.4, 24, 0, 1.6, -0.5, C.white);
  k.box(0.06, 0.35, 22, -3.92, 1.3, -1, C.stripes[0], Glow.Stripe); k.box(0.06, 0.35, 22, 3.92, 1.3, -1, C.stripes[0], Glow.Stripe);
  k.prism(k.cabinPlan(3.5, -11, 9, 2.5), 1.8, 4.2, C.white); k.windows(3.5, -10, 6.5, 2.4, 1.3);
  k.prism(k.cabinPlan(3.2, -9.5, 5, 2.2), 4.2, 6.4, C.white); k.windows(3.2, -8.5, 2.8, 4.8, 1.1);
  for (const s of [-1, 1]) k.box(0.07, 0.6, 9, s * 3.55, 3.4, 1.5, C.stripes[0], Glow.Stripe, -0.28);   // sọc chéo trên mạn tầng 1
  k.box(7.2, 0.3, 17.5, 0, 6.55, -2.5, C.roof); k.railing(3.6, -11, -9.5, 4.2, 0.9);
  k.ledLoop(3.9, -12.5, 11.5, 1.85); k.ledLoop(3.55, -11, 9, 4.2); k.ledLoop(3.6, -11.25, 6.25, 6.72);
  k.plate(3.2, -3, 5.9, 6, 0.7); k.nav(3.3, 5.6, 4.5); k.fenders(3.9, -9, 8, 1.0, 4); k.flag(0, 6.7, -10.5); k.flag(0, 1.8, 11.5, 0.7);
}
/* B — tàu gỗ du lịch kiểu cũ: thân hộp mũi nhọn, tầng 1 kín, tầng 2 mở có cột + mái che, cabin lái, biển tên lớn trên nóc (22 m) */
function typeB(k: Kit) {
  k.prism(k.hullPlan(3.3, -11, 11, 4), -0.6, 1.6, C.white); k.box(0.06, 0.45, 18, -3.32, 1.0, -2, C.stripes[0], Glow.Stripe); k.box(0.06, 0.45, 18, 3.32, 1.0, -2, C.stripes[0], Glow.Stripe);
  k.box(6.2, 2.4, 17.5, 0, 2.8, -1.25, C.white); k.windows(3.1, -9.5, 6.5, 2.3, 1.2);
  k.box(6.4, 0.2, 18, 0, 4.1, -1, C.wood); k.railing(3.2, -10, 8, 4.2, 1.0);
  for (const z of [-9.8, -5, 0, 4.8]) for (const s of [-1, 1]) k.box(0.15, 2.2, 0.15, s * 3.05, 5.3, z, C.darkWood);
  k.box(6.6, 0.2, 15.5, 0, 6.5, -2.4, C.roof); k.box(4.2, 2.1, 3, 0, 5.2, 6.3, C.white); k.windows(2.1, 5, 7.8, 5.4, 0.9);
  k.box(0.15, 1.1, 9, -1.6, 7.15, -2.5, C.darkWood); k.box(0.15, 1.1, 9, 1.6, 7.15, -2.5, C.darkWood); k.plate(1.6, -2.5, 7.15, 8.6, 0.9);
  k.ledLoop(3.25, -10.2, 7.8, 4.05); k.ledLoop(3.35, -10.2, 5.4, 6.65); k.ledLoop(3.3, -11, 9.5, 1.7, 0.1);
  k.nav(2.2, 6.0, 7.2); k.fenders(3.3, -10, 8, 0.9, 7); k.flag(0, 6.6, -10.5); k.flag(0, 1.6, 10.2, 0.7);
}
/* C — du thuyền lớn 3 tầng: tầng 3 phía sau mở, lan can, mái che phía trước, dây đèn lồng (33 m) */
function typeC(k: Kit) {
  k.prism(k.hullPlan(4.3, -16.5, 16.5, 6), -0.8, 1.8, C.white); k.box(0.06, 0.4, 26, -4.32, 1.2, -2, C.stripes[0], Glow.Stripe); k.box(0.06, 0.4, 26, 4.32, 1.2, -2, C.stripes[0], Glow.Stripe);
  k.prism(k.cabinPlan(4.1, -15, 12, 3), 1.8, 4.3, C.white); k.windows(4.1, -14, 9, 2.4, 1.3);
  k.prism(k.cabinPlan(3.9, -14, 10, 3), 4.3, 6.8, C.white); k.windows(3.9, -13, 7, 4.9, 1.3);
  k.box(7.8, 0.2, 24, 0, 6.9, -2, C.wood); k.prism(k.cabinPlan(3.4, -2, 6, 2), 7.0, 9.0, C.white); k.windows(3.4, -1.5, 4, 7.5, 1.0);
  k.box(7.4, 0.25, 10, 0, 9.1, 1.5, C.roof); k.railing(3.9, -14, 10, 7.0, 1.0);
  for (let i = 0; i < 12; i++) { const z = -13.5 + i * 1.05; for (const s of [-1, 1]) k.add(new THREE.OctahedronGeometry(0.22).translate(s * 3.7, 8.4 - 0.25 * Math.sin((i / 11) * Math.PI), z), LANTERN[i % LANTERN.length], Glow.Lantern); }
  k.ledLoop(4.2, -15, 12, 4.3); k.ledLoop(4.0, -14, 10, 6.85); k.ledLoop(3.7, -3.5, 6.5, 9.25); k.ledLoop(4.35, -16, 13, 1.85, 0.1);
  k.plate(3.9, 2, 6.0, 7, 0.8); k.nav(3.5, 8.2, 5.5); k.fenders(4.3, -13, 12, 1.2, 5); k.flag(0, 9.2, 3); k.flag(0, 7.0, -14.5, 0.8);
}
/* D — tàu cá / hàng nhỏ: thân xanh, boong hàng phía trước, cabin lái ở đuôi, cột ngắn (22 m) */
function typeD(k: Kit) {
  k.prism(k.hullPlan(2.65, -11, 11, 5), -0.6, 1.6, C.blueHull); k.box(0.06, 0.3, 17, -2.66, 1.45, -1.5, C.stripes[0], Glow.Stripe); k.box(0.06, 0.3, 17, 2.66, 1.45, -1.5, C.stripes[0], Glow.Stripe);
  k.box(5.0, 0.6, 9, 0, 1.9, 2, C.wood); k.box(4.2, 3.0, 5.5, 0, 3.1, -7, C.white); k.windows(2.1, -9.5, -4.3, 3.3, 0.9);
  k.box(4.6, 0.2, 6, 0, 4.7, -7, C.stripes[0], Glow.Stripe); k.box(0.12, 4.5, 0.12, 0, 6.9, -6, C.mast); k.box(0.12, 3, 0.12, 0, 3.3, 6, C.mast);
  k.nav(2.2, 4.3, -4.5); k.flag(0, 4.8, -9.5, 0.7);
}
/* E — tàu buồm cao: thân gỗ sẫm, nhà boong, cột buồm cao hơn tĩnh không, buồm tam giác hai mặt (30 m) */
function typeE(k: Kit) {
  k.prism(k.hullPlan(3.5, -15, 15, 7), -0.6, 2.2, C.darkWood); k.box(0.06, 0.3, 24, -3.52, 1.9, -2, C.wood, Glow.Stripe); k.box(0.06, 0.3, 24, 3.52, 1.9, -2, C.wood, Glow.Stripe);
  k.box(5, 2.4, 9, 0, 3.4, -6, C.white); k.windows(2.5, -10, -1.6, 3.3, 0.8, false);
  k.add(new THREE.CylinderGeometry(0.22, 0.3, 19, 6).translate(0, 11.7, 2), C.mast);
  const sail = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0, 16), new THREE.Vector2(-9, 0)]);
  k.add(new THREE.ShapeGeometry(sail).rotateY(Math.PI / 2).translate(0.05, 4.2, 2.6), C.sail);
  k.add(new THREE.ShapeGeometry(sail).rotateY(-Math.PI / 2).translate(-0.05, 4.2, 2.6), C.sail);
  k.railing(3.4, -14, 8, 2.2, 0.9); k.nav(2.6, 4.2, -2); k.flag(0, 21.2, 2, 1.2); k.ledLoop(3.5, -14.5, 8.5, 2.3, 0.1);
}
const BUILDERS: Record<BoatTypeId, (k: Kit) => void> = { A: typeA, B: typeB, C: typeC, D: typeD, E: typeE };

const cache = new Map<BoatTypeId, THREE.BufferGeometry>();
export function btBuildTypeGeometry(type: BoatTypeId): THREE.BufferGeometry {
  if (!cache.has(type)) { const k = new Kit(); BUILDERS[type](k); cache.set(type, k.build()); }
  return cache.get(type)!;
}

/* Gộp các kiểu cho một fleet; aPart = chỉ số kiểu trong BOAT_TYPES (vertex shader thu đỉnh khác kiểu về gốc) */
export function btBuildFleetGeometry(types: BoatTypeId[]): THREE.BufferGeometry {
  const parts = types.map((t) => {
    const g = btBuildTypeGeometry(t).clone(), n = g.getAttribute('position').count;
    g.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(n).fill(BOAT_TYPES.indexOf(t)), 1));
    return g;
  });
  const g = mergeGeometries(parts, false)!;
  g.computeBoundingSphere();
  return g;
}
