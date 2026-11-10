import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG, type VehicleTypeId } from '../../config';

/* =====================================================================
   HÌNH HỌC XE CỘ — 3 loại (spec G1–G4): siêu xe, buýt nhỏ vàng, xe tay ga có người lái.
   Dựng theo mét, không chuẩn hóa: mũi xe về +X, rộng theo Z, mặt đường y = 0, tâm x = 0, z = 0.
   Số đo các bộ phận lấy từ bản dựng thử docs/superpowers/specs/tham-chieu/xe-co/xe-dung-thu.html (bỏ chi tiết không thấy ở 10 m).
   Mỗi đỉnh: position, normal (phẳng theo mặt), color (màu cố định ban ngày), aRole (xem Role). Có index, không uv, không texture.
   Mặt quấn ngược chiều kim đồng hồ nhìn từ ngoài (vật liệu FrontSide).
   ===================================================================== */
export enum Role { Fixed = 0, Paint = 1, Accent = 2, Head = 3, Tail = 4, Helmet = 5 }   // Paint: aPaint của instance; Accent: aAccent (áo); Helmet: aAccent.brg; Head/Tail: đèn; Fixed: color của đỉnh
export const VEHICLE_TYPES: VehicleTypeId[] = ['car', 'bus', 'bike'];

const C = CONFIG.vehicles.palette;   // màu cố định (config.ts)
export type Sec = { x: number; w: number; y0: number; ym: number; y1: number; t?: number };   // mặt cắt loft: x, nửa rộng w, đáy y0, vai ym, nóc y1, nóc hẹp còn w·t

/* Tập mặt đa giác lồi, mỗi mặt có đỉnh riêng ⇒ pháp tuyến phẳng; mặt tự lật để hướng ra xa điểm "inside" */
class Faces {
  p: number[] = []; n: number[] = []; idx: number[] = [];
  face(pts: THREE.Vector3[], inside: THREE.Vector3) {
    const nm = new THREE.Vector3(), ctr = new THREE.Vector3();
    for (let i = 0; i < pts.length; i++) {   // pháp tuyến Newell (đúng cả với tứ giác hơi vênh)
      const a = pts[i], b = pts[(i + 1) % pts.length];
      nm.x += (a.y - b.y) * (a.z + b.z); nm.y += (a.z - b.z) * (a.x + b.x); nm.z += (a.x - b.x) * (a.y + b.y); ctr.add(a);
    }
    ctr.divideScalar(pts.length);
    if (nm.dot(ctr.sub(inside)) < 0) { pts = [...pts].reverse(); nm.negate(); }
    nm.normalize();
    const base = this.p.length / 3;
    for (const v of pts) { this.p.push(v.x, v.y, v.z); this.n.push(nm.x, nm.y, nm.z); }
    for (let k = 1; k < pts.length - 1; k++) this.idx.push(base, base + k, base + k + 1);
  }
  geo(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3)); g.setIndex(this.idx);
    return g;
  }
}
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/* Vỏ lượn theo các mặt cắt dọc xe: mỗi mặt cắt là lục giác (đáy, vai, nóc hẹp), nối bằng tứ giác 4 đỉnh, bịt hai đầu */
export function vhLoft(st: Sec[]): THREE.BufferGeometry {
  const f = new Faces();
  const ring = (s: Sec) => { const t = s.t ?? 0.8; return [[-s.w, s.y0], [-s.w, s.ym], [-s.w * t, s.y1], [s.w * t, s.y1], [s.w, s.ym], [s.w, s.y0]].map(([z, y]) => V(s.x, y, z)); };
  const mid = (s: Sec) => V(s.x, (s.y0 + s.y1) / 2, 0), R = st.map(ring);
  for (let i = 0; i < R.length - 1; i++) {
    const inside = mid(st[i]).add(mid(st[i + 1])).multiplyScalar(0.5);
    for (let j = 0; j < 6; j++) { const k = (j + 1) % 6; f.face([R[i][j], R[i + 1][j], R[i + 1][k], R[i][k]], inside); }
  }
  f.face(R[0], mid(st[1])); f.face(R[R.length - 1], mid(st[st.length - 2]));
  return f.geo();
}

/* Một bộ phận: bỏ uv + nhóm, gán màu đỉnh (null ⇒ trắng, màu thật lấy theo instance) và aRole */
function part(g: THREE.BufferGeometry, color: number | null, role: Role): THREE.BufferGeometry {
  if (g.getAttribute('uv')) g.deleteAttribute('uv'); g.clearGroups();
  const n = g.getAttribute('position').count, col = color === null ? new THREE.Color(1, 1, 1) : new THREE.Color(color), c = new Float32Array(n * 3), r = new Float32Array(n).fill(role);
  for (let i = 0; i < n; i++) { c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.setAttribute('aRole', new THREE.BufferAttribute(r, 1));
  return g;
}

/* Người dựng một loại xe: tích các bộ phận rồi gộp, đặt tâm x, z về 0 (không co giãn) */
class Kit {
  parts: THREE.BufferGeometry[] = [];
  add(g: THREE.BufferGeometry, color: number | null, role = Role.Fixed) { this.parts.push(part(g, color, role)); }
  box(sx: number, sy: number, sz: number, x: number, y: number, z: number, color: number | null, role = Role.Fixed, rz = 0) {
    const g = new THREE.BoxGeometry(sx, sy, sz); if (rz) g.rotateZ(rz); this.add(g.translate(x, y, z), color, role);
  }
  loft(st: Sec[], color: number | null, role = Role.Fixed) { this.add(vhLoft(st), color, role); }
  /* Bánh trụ 8 cạnh nằm phẳng trên đường (cạnh đáy cách tâm đúng r); chỉ mặt lốp + mặt ngoài (z = 0 ⇒ cả hai mặt) */
  wheel(r: number, w: number, x: number, z: number) {
    const f = new Faces(), R = r / Math.cos(Math.PI / 8), c = V(x, r, z);
    const ring = (dz: number) => Array.from({ length: 8 }, (_, i) => { const a = Math.PI / 8 + (i * Math.PI) / 4; return V(x + R * Math.cos(a), r + R * Math.sin(a), z + dz); });
    const A = ring(-w / 2), B = ring(w / 2);
    for (let i = 0; i < 8; i++) { const j = (i + 1) % 8; f.face([A[i], A[j], B[j], B[i]], c); }
    if (z >= 0) f.face(B, c); if (z <= 0) f.face(A, c);
    this.add(f.geo(), C.tyre);
  }
  /* Vòm thấp (mũ bảo hiểm): 6 múi × 2 tầng tới góc 0,55π từ đỉnh, bịt đáy */
  dome(r: number, x: number, y: number, z: number, color: number | null, role: Role) {
    const f = new Faces(), c = V(x, y, z), top = V(x, y + r, z), N = 6;
    const ring = (phi: number) => Array.from({ length: N }, (_, j) => { const a = (j * 2 * Math.PI) / N; return V(x + r * Math.sin(phi) * Math.cos(a), y + r * Math.cos(phi), z + r * Math.sin(phi) * Math.sin(a)); });
    const A = ring(0.275 * Math.PI), B = ring(0.55 * Math.PI);
    for (let j = 0; j < N; j++) { const k = (j + 1) % N; f.face([top, A[j], A[k]], c); f.face([A[j], B[j], B[k], A[k]], c); }
    f.face(B, top);
    this.add(f.geo(), color, role);
  }
  /* Tấm mỏng một mặt áp sát hông xe ở z = s·d (dải sơn, cửa kính): pts là (x, y) */
  side(s: number, d: number, pts: [number, number][], color: number | null, role = Role.Fixed) {
    const f = new Faces(), cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    f.face(pts.map(([x, y]) => V(x, y, s * d)), V(cx, cy, 0)); this.add(f.geo(), color, role);
  }
  /* Tấm phẳng một mặt vuông góc trục X ở x (kính sau): pts là (z, y), hướng ra xa tâm xe */
  end(x: number, pts: [number, number][], color: number | null) {
    const f = new Faces(); f.face(pts.map(([z, y]) => V(x, y, z)), V(0, 1.5, 0)); this.add(f.geo(), color);
  }
  build(): THREE.BufferGeometry {
    const g = mergeGeometries(this.parts, false)!;
    g.computeBoundingBox(); const b = g.boundingBox!;
    g.translate(-(b.max.x + b.min.x) / 2, 0, -(b.max.z + b.min.z) / 2);
    g.computeBoundingBox(); g.computeBoundingSphere();
    return g;
  }
}

/* Siêu xe (~4,5 m): thân 7 mặt cắt, khoang kính giọt nước, nắp máy sau, mái, 4 bánh, đèn pha ở chóp chắn bùn, dải đèn hậu, cánh gió trước / sau, khuếch tán */
export const CAR_BODY: Sec[] = [
  { x: -2.25, w: 0.84, y0: 0.36, ym: 0.74, y1: 0.84 }, { x: -1.9, w: 0.97, y0: 0.17, ym: 0.72, y1: 0.9 },
  { x: -0.6, w: 0.98, y0: 0.14, ym: 0.68, y1: 0.86 }, { x: 0.5, w: 0.97, y0: 0.14, ym: 0.62, y1: 0.74 },
  { x: 1.5, w: 0.95, y0: 0.14, ym: 0.5, y1: 0.58 }, { x: 2.1, w: 0.86, y0: 0.16, ym: 0.37, y1: 0.43 }, { x: 2.27, w: 0.7, y0: 0.2, ym: 0.29, y1: 0.33 }
];
function vhCar(k: Kit) {
  k.loft(CAR_BODY, null, Role.Paint);
  k.loft([
    { x: -0.8, w: 0.7, y0: 0.78, ym: 1.0, y1: 1.12, t: 0.66 }, { x: -0.5, w: 0.72, y0: 0.78, ym: 1.0, y1: 1.14, t: 0.66 },
    { x: 0.1, w: 0.73, y0: 0.7, ym: 0.98, y1: 1.15, t: 0.64 }, { x: 1.0, w: 0.66, y0: 0.6, ym: 0.66, y1: 0.7, t: 0.8 }
  ], C.glass);
  k.loft([{ x: -2.0, w: 0.6, y0: 0.8, ym: 0.86, y1: 0.9, t: 0.7 }, { x: -0.78, w: 0.73, y0: 0.78, ym: 1.02, y1: 1.14, t: 0.66 }], null, Role.Paint);   // nắp máy sau
  k.box(0.95, 0.05, 0.98, -0.32, 1.145, 0, null, Role.Paint);                                                   // mái
  for (const x of [1.38, -1.4]) for (const z of [0.9, -0.9]) k.wheel(0.34, 0.3, x, z);
  for (const z of [0.69, -0.69]) k.box(0.2, 0.05, 0.2, 2.02, 0.43, z, C.headDay, Role.Head, -0.18);         // đèn pha ở chóp chắn bùn
  k.box(0.06, 0.07, 1.5, -2.26, 0.72, 0, C.tailDay, Role.Tail);                                                 // dải đèn hậu
  k.box(0.12, 0.2, 1.5, -2.22, 0.45, 0, C.dark);                                                                // khuếch tán sau
  k.box(0.3, 0.05, 1.7, 2.12, 0.16, 0, C.dark);                                                                 // cánh gió trước
  k.box(0.34, 0.04, 1.7, -2.05, 0.98, 0, C.dark); k.box(0.1, 0.14, 0.12, -2.0, 0.91, 0, C.dark);               // cánh gió sau + một chân giữa
}

/* Buýt nhỏ vàng (~7 m): thân 5 mặt cắt (kính lái nghiêng trên đoạn 2,3 → 3,3 m), dải cửa sổ tối + dải chéo xanh viền trắng hai bên, điều hòa nóc, 4 bánh */
function vhBus(k: Kit) {
  k.loft([
    { x: -3.5, w: 1.0, y0: 0.5, ym: 2.5, y1: 2.66, t: 0.86 }, { x: -3.3, w: 1.05, y0: 0.4, ym: 2.52, y1: 2.7, t: 0.86 },
    { x: 2.3, w: 1.05, y0: 0.4, ym: 2.52, y1: 2.7, t: 0.86 }, { x: 3.3, w: 1.03, y0: 0.4, ym: 1.15, y1: 1.25, t: 0.86 }, { x: 3.5, w: 0.95, y0: 0.45, ym: 0.9, y1: 1.0, t: 0.86 }
  ], C.busBody);
  k.box(1.62, 0.03, 1.72, 2.83, 2.0, 0, C.glass, Role.Fixed, -0.967);                                            // kính lái
  // dải chéo: thấp ở đầu xe, cao dần về đuôi; mỗi dải 2 tứ giác gãy ở x = −1,175 (theo texture bản dựng thử)
  const band = (r: [number, number], m: [number, number], f: [number, number]): [number, number][][] => [
    [[-3.3, r[1]], [-1.175, m[1]], [-1.175, m[0]], [-3.3, r[0]]], [[-1.175, m[1]], [2.3, f[1]], [2.3, f[0]], [-1.175, m[0]]]
  ];
  for (const s of [1, -1]) {
    for (const q of band([2.23, 1.53], [1.49, 0.99], [1.32, 0.74])) k.side(s, 1.06, q, C.busStripeEdge);         // viền trắng (rộng hơn)
    for (const q of band([2.12, 1.64], [1.39, 1.09], [1.22, 0.84])) k.side(s, 1.068, q, C.busStripe);            // dải xanh
    k.side(s, 1.076, [[-2.9, 1.43], [2.275, 1.43], [2.275, 2.39], [-2.9, 2.39]], C.busWindow);                  // dải cửa sổ tối
    k.side(s, 1.076, [[2.32, 1.5], [2.7, 1.5], [2.7, 1.9], [2.32, 2.4]], C.glass);                              // kính cửa lái, mép trên theo dốc kính lái
    k.box(0.06, 0.2, 0.36, 3.5, 0.8, s * 0.62, C.headDay, Role.Head);                                           // đèn pha
    k.box(0.05, 0.7, 0.14, -3.51, 1.5, s * 0.86, C.tailDay, Role.Tail);                                         // đèn hậu đứng
  }
  k.end(-3.51, [[-0.75, 1.6], [0.75, 1.6], [0.75, 2.4], [-0.75, 2.4]], C.glass);                                // kính sau
  k.box(1.6, 0.16, 1.3, -1.0, 2.76, 0, C.busAc);                                                                // điều hòa nóc
  for (const x of [2.3, -1.9]) for (const z of [0.93, -0.93]) k.wheel(0.4, 0.3, x, z);
}

/* Xe tay ga + người lái (~1,8 m, cao tới đỉnh mũ ~1,6 m): bánh, thân sau, sàn, yếm, chắn bùn, phuộc, ghi đông, đèn, yên; người lái áo / mũ theo instance */
function vhBike(k: Kit) {
  for (const x of [0.6, -0.58]) k.wheel(0.24, 0.11, x, 0);
  k.loft([
    { x: -0.9, w: 0.11, y0: 0.46, ym: 0.6, y1: 0.68, t: 0.7 }, { x: -0.56, w: 0.2, y0: 0.3, ym: 0.6, y1: 0.74, t: 0.7 },
    { x: -0.1, w: 0.19, y0: 0.27, ym: 0.55, y1: 0.72, t: 0.7 }, { x: 0.06, w: 0.16, y0: 0.25, ym: 0.3, y1: 0.34, t: 0.9 }
  ], null, Role.Paint);                                                                                          // thân sau
  k.box(0.4, 0.06, 0.34, 0.22, 0.29, 0, null, Role.Paint);                                                      // sàn để chân
  k.box(0.07, 0.72, 0.4, 0.44, 0.64, 0, null, Role.Paint, 0.2);                                                 // yếm nghiêng
  k.box(0.42, 0.07, 0.15, 0.6, 0.52, 0, null, Role.Paint, -0.1);                                                // chắn bùn trước
  k.box(0.06, 0.5, 0.06, 0.54, 0.5, 0, C.dark, Role.Fixed, 0.2);                                                // phuộc
  k.box(0.12, 0.1, 0.3, 0.4, 1.02, 0, null, Role.Paint); k.box(0.05, 0.05, 0.7, 0.36, 1.03, 0, C.dark);        // đầu xe + ghi đông
  k.box(0.05, 0.09, 0.14, 0.47, 1.0, 0, C.headDay, Role.Head);                                                  // đèn pha
  k.box(0.72, 0.09, 0.3, -0.42, 0.78, 0, C.seat);                                                               // yên
  k.box(0.05, 0.08, 0.14, -0.92, 0.6, 0, C.tailDay, Role.Tail);                                                 // đèn hậu
  // người lái
  k.box(0.24, 0.56, 0.36, -0.27, 1.12, 0, null, Role.Accent, -0.12);                                            // thân áo
  k.box(0.17, 0.17, 0.16, -0.18, 1.46, 0, C.skin);                                                              // mặt
  k.dome(0.13, -0.21, 1.5, 0, null, Role.Helmet);                                                               // mũ bảo hiểm
  for (const z of [0.2, -0.2]) k.box(0.68, 0.08, 0.08, 0.1, 1.2, z, null, Role.Accent, -0.49);                  // tay tới ghi đông
  for (const z of [0.13, -0.13]) { k.box(0.46, 0.13, 0.13, -0.1, 0.86, z, C.trouser, Role.Fixed, -0.1); k.box(0.11, 0.48, 0.11, 0.15, 0.58, z, C.trouser, Role.Fixed, -0.2); }   // đùi + ống chân
}
const BUILDERS: Record<VehicleTypeId, (k: Kit) => void> = { car: vhCar, bus: vhBus, bike: vhBike };

const cache = new Map<VehicleTypeId, THREE.BufferGeometry>();
export function vhBuildTypeGeometry(type: VehicleTypeId): THREE.BufferGeometry {
  if (!cache.has(type)) { const k = new Kit(); BUILDERS[type](k); cache.set(type, k.build()); }
  return cache.get(type)!;
}

/* Gộp 3 loại thành một hình học; aPart = chỉ số loại trong VEHICLE_TYPES (vertex shader thu đỉnh khác loại về gốc) */
let fleet: THREE.BufferGeometry | null = null;
export function vhBuildFleetGeometry(): THREE.BufferGeometry {
  if (fleet) return fleet;
  const parts = VEHICLE_TYPES.map((t, i) => {
    const g = vhBuildTypeGeometry(t).clone(), n = g.getAttribute('position').count;
    g.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(n).fill(i), 1));
    return g;
  });
  fleet = mergeGeometries(parts, false)!; fleet.computeBoundingBox(); fleet.computeBoundingSphere();
  return fleet;
}
