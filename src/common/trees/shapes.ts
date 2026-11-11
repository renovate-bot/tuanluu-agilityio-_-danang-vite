import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from '../../config';
import { rng, clamp } from '../math';

/* =====================================================================
   HÌNH HỌC CÂY — cây bóng mát (spec G1) và cây dừa (spec G2), thuần (không DOM, không texture).
   Dựng theo bản thử docs/superpowers/specs/tham-chieu/cay-va-nguoi/cay-va-nguoi-dung-thu.html nhưng giản lược theo trần tam giác CONFIG.trees.maxTris.
   Mọi hình: không index, đủ position / normal / uv / color; mặt quấn ngược chiều kim đồng hồ nhìn từ ngoài.
   Không gian chuẩn hóa (instance nhân cỡ thật):
   - thân bóng mát: gốc y = 0, đầu cành cao nhất y = 1; ngang tính theo bán kính tán (đầu cành tỏa ≈ 0,7);
   - tán bóng mát: trong khối cầu đơn vị tâm gốc tọa độ, color = độ sáng tương đối (màu xanh lấy từ instanceColor);
   - thân dừa: cao 1, bán kính đáy 0,35 / đỉnh 0,2 (trước khi instance nhân CONFIG.trees.palm.trunkWidth), đỉnh lệch palm.bend theo +X;
   - tán dừa: gốc tọa độ là đỉnh thân, tỉ lệ đều (instance nhân crownScale × h).
   Ngẫu nhiên dùng rng(seed) riêng — không gọi rand() chung.
   ===================================================================== */
const T = CONFIG.trees;
type RGB = [number, number, number];
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/* Hướng xoay cây (rad, quanh Y) theo chỉ số instance + hạt riêng (G4: cây cùng loại không như bản sao) — không gọi rand() chung */
export const trYaw = (i: number, seed: number) => rng(seed * 7919 + i)() * Math.PI * 2;

/* Gói mảng thành BufferGeometry không index */
function trGeo(p: number[], n: number[], uv: number[], c: number[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  return g;
}

/* Gán màu đỉnh theo hàm vị trí; bỏ index để gộp được với các phần khác */
function trPaint(g: THREE.BufferGeometry, fn: (x: number, y: number, z: number) => RGB): THREE.BufferGeometry {
  if (g.index) g = g.toNonIndexed();
  const p = g.getAttribute('position'), c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) c.set(fn(p.getX(i), p.getY(i), p.getZ(i)), i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

/* Ống hở hai đầu theo đường gấp khúc: mỗi điểm có bán kính và màu vòng.
   flat = true: vòng nằm ngang (thân đứng, kể cả khi cong) ⇒ đáy đúng y = 0, đỉnh đúng cao độ điểm cuối; ngược lại vòng vuông góc với hướng ống (cành). */
function trTube(path: { p: THREE.Vector3; r: number; c: RGB }[], sides: number, flat = false): THREE.BufferGeometry {
  const P: number[] = [], N: number[] = [], UV: number[] = [], C: number[] = [];
  const rings = path.map((s, i) => {
    let A = V(1, 0, 0), B = V(0, 0, 1);
    if (!flat) {
      const t = path[Math.min(i + 1, path.length - 1)].p.clone().sub(path[Math.max(i - 1, 0)].p).normalize();
      A = new THREE.Vector3().crossVectors(t, Math.abs(t.y) < 0.9 ? V(0, 1, 0) : V(1, 0, 0)).normalize(); B = new THREE.Vector3().crossVectors(t, A);
    } else { B = V(0, 0, -1); }   // vòng ngang: (A, B, +Y) thuận tay phải để mặt quấn ra ngoài
    return Array.from({ length: sides + 1 }, (_, j) => { const a = (j / sides) * Math.PI * 2, d = A.clone().multiplyScalar(Math.cos(a)).addScaledVector(B, Math.sin(a)); return { p: s.p.clone().addScaledVector(d, s.r), n: d, u: j / sides, v: i / (path.length - 1), c: s.c }; });
  });
  const put = (q: { p: THREE.Vector3; n: THREE.Vector3; u: number; v: number; c: RGB }) => { P.push(q.p.x, q.p.y, q.p.z); N.push(q.n.x, q.n.y, q.n.z); UV.push(q.u, q.v); C.push(...q.c); };
  for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < sides; j++) {
    const a = rings[i][j], b = rings[i][j + 1], c = rings[i + 1][j + 1], d = rings[i + 1][j];
    put(a); put(b); put(c); put(a); put(c); put(d);
  }
  return trGeo(P, N, UV, C);
}

/* ---------- Cây bóng mát: thân + cành ---------- */
/* Gốc xòe, thân thẳng tới chỗ tách (fork), 1 cành giữa gần thẳng đứng + các cành tỏa hình vòng cung; mỗi cành 2 đoạn */
export function trShadeTrunkGeo(): THREE.BufferGeometry {
  const S = T.shade, r = rng(S.seed), bark = (y: number): RGB => { const k = 0.82 + 0.18 * Math.sin(y * 23); return [0.46 * k, 0.4 * k, 0.34 * k]; };   // nâu xám, vằn nhẹ theo cao
  const parts = [trTube([[0, 0.17], [0.06, 0.11], [0.2, 0.09], [S.fork + 0.02, 0.075]].map(([y, rr]) => ({ p: V(0, y, 0), r: rr, c: bark(y) })), S.sides, true)];
  for (let i = 0; i < S.branches; i++) {
    const centre = i === 0, yaw = (i - 1) * (Math.PI * 2 / (S.branches - 1)) + r() * 0.5;
    const reach = centre ? 0.1 : S.reach * (0.86 + r() * 0.14), top = centre ? 1 : 0.84 + r() * 0.1, dx = Math.cos(yaw), dz = Math.sin(yaw);
    const a = V(dx * 0.02, S.fork - 0.04, dz * 0.02), b = V(dx * reach * 0.42, S.fork + (top - S.fork) * 0.62, dz * reach * 0.42), c = V(dx * reach, top, dz * reach);
    parts.push(trTube([{ p: a, r: 0.055, c: bark(a.y) }, { p: b, r: 0.035, c: bark(b.y) }, { p: c, r: 0.014, c: bark(c.y) }], S.sides));
  }
  const g = mergeGeometries(parts); g.computeBoundingBox();
  g.scale(1, 1 / g.boundingBox!.max.y, 1);   // đầu cành cao nhất đúng y = 1 (vòng đầu cành giữa hơi nghiêng)
  return g;
}

/* ---------- Cây bóng mát: tán ---------- */
/* Các cụm lá khối 20 mặt chia 1 lần (80 tam giác) nhiễu nhẹ, xếp vành ngoài thấp + vành giữa + đỉnh như bản thử.
   Pháp tuyến hướng từ tâm cụm (bóng mềm); color = độ sáng: sáng ở trên ≈ 1, sẫm ở dưới và trong khe giữa các cụm ≈ 0,4.
   detail = mức chia của khối 20 mặt (1 = bản đầy đủ 640 tam giác, 0 = bản thưa 160 tam giác cho lượt bóng / phản chiếu); bố cục cụm và chuỗi rng không phụ thuộc detail. */
export function trShadeCrownGeo(detail = 1): THREE.BufferGeometry {
  const S = T.shade, r = rng(S.seed + 1), blobs: { c: THREE.Vector3; s: THREE.Vector3 }[] = [];
  const add = (a: number, rr: number, y: number, s: number) => blobs.push({ c: V(Math.cos(a) * rr, y, Math.sin(a) * rr), s: V(s, s * 0.85, s) });
  for (let i = 0; i < S.blobs.outer; i++) add(i * (Math.PI * 2 / S.blobs.outer) + (r() - 0.5) * 0.3, 0.52 + r() * 0.05, -0.37 + r() * 0.06, 0.41 + r() * 0.04);   // vành ngoài, thấp
  for (let i = 0; i < S.blobs.mid; i++) add(i * (Math.PI * 2 / S.blobs.mid) + 0.6 + r() * 0.4, 0.26 + r() * 0.06, 0.1 + r() * 0.06, 0.47 + r() * 0.04);   // vành giữa
  for (let i = 0; i < S.blobs.top; i++) add(r() * 6.28, 0.06, 0.38 + r() * 0.04, 0.48);                                                                  // đỉnh
  const inside = (q: THREE.Vector3, skip: number) => blobs.some((b, k) => k !== skip && q.clone().sub(b.c).divide(b.s).length() < 1.05);
  const parts = blobs.map((b, k) => {
    const g = new THREE.IcosahedronGeometry(1, detail), p = g.getAttribute('position'), n = g.getAttribute('normal'), sd = r() * 20, q = new THREE.Vector3(), d = new THREE.Vector3();
    const c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      d.fromBufferAttribute(p, i).normalize();
      const kk = 1 + 0.09 * Math.sin(d.x * 3.1 + sd) * Math.sin(d.y * 2.7 + sd * 1.7) * Math.sin(d.z * 2.9 + sd * 0.6) + 0.04 * Math.sin(d.x * 7 + sd) * Math.sin(d.y * 8 + d.z * 6 + sd);
      q.copy(d).multiplyScalar(kk).multiply(b.s).add(b.c);
      if (q.length() > 1.1) q.setLength(1.1);   // giữ trong cầu đơn vị (khế ước với instance)
      p.setXYZ(i, q.x, q.y, q.z);
      const nm = V(d.x / b.s.x, d.y / b.s.y, d.z / b.s.z).normalize(); n.setXYZ(i, nm.x, nm.y, nm.z);
      const h = clamp((q.y + 0.75) / 1.6, 0, 1), up = clamp(0.5 + 0.5 * nm.y, 0, 1);
      let s = 0.4 + 0.6 * (0.55 * h + 0.45 * up);
      if (inside(q, k)) s = 0.4 + (s - 0.4) * 0.35;   // khe giữa các cụm: sẫm
      c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = s;
    }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    return g;
  });
  return mergeGeometries(parts);
}

/* Tán gộp [bản đầy đủ | bản thưa] trong một buffer: lượt chính vẽ đỉnh [0, fullCount), lượt bóng / phản chiếu vẽ [fullCount, fullCount + lodCount) (src/core/passLod.ts).
   Hình học không index nên đơn vị đếm là đỉnh (đúng đơn vị drawRange). */
export function trShadeCrownLodGeo(): { geo: THREE.BufferGeometry; fullCount: number; lodCount: number } {
  const full = trShadeCrownGeo(1), lod = trShadeCrownGeo(T.shade.lodDetail);
  const fullCount = full.getAttribute('position').count, lodCount = lod.getAttribute('position').count;
  return { geo: mergeGeometries([full, lod]), fullCount, lodCount };
}

/* ---------- Cây dừa: thân ---------- */
/* Cao 1, vòng ngang (không nghiêng theo độ cong) để đỉnh đúng y = 1; gốc phình; cong x = bend · y²; vòng sẹo = màu vòng sáng / sẫm xen kẽ */
const PALM_RINGS = 10, PALM_SIDES = 6;   // 10 đoạn × 6 cạnh × 2 = 120 tam giác
export function trPalmTrunkGeo(): THREE.BufferGeometry {
  const path = Array.from({ length: PALM_RINGS + 1 }, (_, i) => {
    const y = Math.pow(i / PALM_RINGS, 1.25), rr = 0.2 + 0.08 * (1 - y) + 0.07 * Math.pow(Math.max(0, 1 - y / 0.12), 2), k = i % 2 ? 0.74 : 1;   // vòng dày ở gốc cho chỗ phình
    return { p: V(T.palm.bend * y * y, y, 0), r: rr, c: [0.6 * k, 0.55 * k, 0.48 * k] as RGB };
  });
  return trTube(path, PALM_SIDES, true);
}

/* Một tàu lá dừa: sống giữa + hai mép võng xuống, 3 đỉnh mỗi mặt cắt; elev là góc ngẩng ở gốc, droop là độ rũ thêm tới ngọn.
   uv: u ngang tàu (0 / 0,5 / 1), v dọc tàu trong [0,1; 1] — vùng v < 0,1 dành cho ô đặc của texture */
function trFrond(L: number, elev: number, droop: number, yaw: number, W: number, segs: number, tone: RGB): THREE.BufferGeometry {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  let rr = 0.03, y = 0.02;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, a = elev - droop * Math.pow(t, 1.35), w = W * Math.pow(Math.sin(Math.PI * (0.08 + 0.86 * t)), 0.6), sag = w * 0.5, v = 0.1 + 0.9 * t;
    pos.push(rr, y - sag, -w, rr, y, 0, rr, y - sag, w); uv.push(0, v, 0.5, v, 1, v);
    rr += (Math.cos(a) * L) / segs; y += (Math.sin(a) * L) / segs;
    if (i < segs) { const o = i * 3; idx.push(o, o + 1, o + 3, o + 1, o + 4, o + 3, o + 1, o + 2, o + 4, o + 2, o + 5, o + 4); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  g.computeVertexNormals(); g.rotateY(yaw);
  return trPaint(g, () => tone);
}

/* Búi ngọn + quả: hình khối thấp, uv trỏ vào ô đặc [0, 0,06]² của texture tàu lá ⇒ màu chỉ từ color */
function trSolid(g: THREE.BufferGeometry, col: RGB): THREE.BufferGeometry {
  g = trPaint(g, () => col); const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.015, 0.015);   // sát góc (texture kẹp mép) để mipmap xa vẫn đặc
  return g;
}

/* ---------- Cây dừa: tán ---------- */
/* Tàu non (đầu danh sách) dựng đứng, ngắn; tàu già vươn ngang rồi rũ xuống quá búi ngọn; xoay theo góc vàng cho đủ hướng */
export function trPalmCrownGeo(): THREE.BufferGeometry {
  const P = T.palm, r = rng(P.seed), parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < P.fronds; i++) {
    const t = i / (P.fronds - 1), k = 0.66 + 0.34 * (1 - t * 0.5) + r() * 0.08;
    const L = Math.min(1.15, 0.75 + 0.4 * Math.min(1, t * 1.6) + (r() - 0.5) * 0.06);
    parts.push(trFrond(Math.max(0.75, L), 1.35 - 1.45 * t + (r() - 0.5) * 0.15, 0.3 + 0.9 * t + r() * 0.15, i * 2.4 + r() * 0.3, 0.13, P.frondSegs, [0.62 * k, 0.9 * k, 0.3 * k]));
  }
  parts.push(trSolid(new THREE.IcosahedronGeometry(1, 0).scale(0.09, 0.13, 0.09).translate(0, -0.03, 0), [0.36, 0.29, 0.18]));   // búi ngọn
  for (let i = 0; i < 5; i++) {   // quả dừa
    const a = i * 1.26 + r() * 0.4;
    parts.push(trSolid(new THREE.OctahedronGeometry(0.045, 0).translate(Math.cos(a) * 0.085, -0.09 - r() * 0.04, Math.sin(a) * 0.085), i % 2 ? [0.42, 0.5, 0.18] : [0.5, 0.42, 0.2]));
  }
  return mergeGeometries(parts);
}

/* ---------- Cây dừa tĩnh cho lưới bê tông gộp của hầm ---------- */
/* Mét thật: thân cao h (5 cạnh × 6 đoạn) + staticFronds tàu lá dạng dải thuôn hai mặt (mỗi tam giác có bản đảo chiều, pháp tuyến ngược) + búi ngọn.
   Lưới gộp không có texture trong suốt nên tàu lá là hình học thuần; uv không có nghĩa (0). */
export function trPalmStaticGeo(h: number): THREE.BufferGeometry {
  const P = T.palm, wk = P.trunkWidth, r = rng(P.seed + 7), S = P.crownScale * h, top = V(P.bend * wk, h, 0);
  const trunk = trTube(Array.from({ length: 7 }, (_, i) => {
    const y = Math.pow(i / 6, 1.25), k = i % 2 ? 0.8 : 1;
    return { p: V(P.bend * wk * y * y, y * h, 0), r: wk * (0.2 + 0.08 * (1 - y) + 0.07 * Math.pow(Math.max(0, 1 - y / 0.12), 2)), c: [0.58 * k, 0.53 * k, 0.46 * k] as RGB };
  }), 5, true);
  const husk = trSolid(new THREE.OctahedronGeometry(1, 0).scale(0.09 * S, 0.12 * S, 0.09 * S).translate(top.x, top.y, top.z), [0.36, 0.29, 0.18]);
  const p: number[] = [], n: number[] = [], c: number[] = [], e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  const tri = (a: THREE.Vector3, b: THREE.Vector3, d: THREE.Vector3, col: RGB) => {
    const f = e1.subVectors(b, a).cross(e2.subVectors(d, a)).normalize();
    for (const q of [a, b, d]) { p.push(q.x, q.y, q.z); n.push(f.x, f.y, f.z); c.push(...col); }        // mặt trên
    for (const q of [a, d, b]) { p.push(q.x, q.y, q.z); n.push(-f.x, -f.y, -f.z); c.push(...col); }     // mặt dưới (đảo chiều quấn)
  };
  for (let i = 0; i < P.staticFronds; i++) {
    const t = i / (P.staticFronds - 1), yaw = i * 2.4 + r() * 0.3, L = S * (0.8 + 0.3 * t), elev = 0.9 - 1.0 * t, droop = 0.4 + 0.8 * t, W = 0.11 * S, k = 0.8 + r() * 0.2;
    const col: RGB = [0.32 * k, 0.52 * k, 0.18 * k], dir = V(Math.cos(yaw), 0, -Math.sin(yaw)), side = V(Math.sin(yaw), 0, Math.cos(yaw));
    const L4: THREE.Vector3[] = [], R4: THREE.Vector3[] = []; let rr = 0.05 * S, y = 0, tip = new THREE.Vector3();
    for (let s = 0; s <= 4; s++) {
      const u = s / 4, a = elev - droop * Math.pow(u, 1.35), w = W * Math.sin(Math.PI * (0.12 + 0.88 * u) * 0.999), spine = top.clone().addScaledVector(dir, rr).setY(top.y + y);
      if (s === 4) tip = spine; else { L4.push(spine.clone().addScaledVector(side, -w).setY(spine.y - w * 0.4)); R4.push(spine.clone().addScaledVector(side, w).setY(spine.y - w * 0.4)); }
      rr += (Math.cos(a) * L) / 4; y += (Math.sin(a) * L) / 4;
    }
    for (let s = 0; s < 3; s++) { tri(L4[s], R4[s], R4[s + 1], col); tri(L4[s], R4[s + 1], L4[s + 1], col); }
    tri(L4[3], R4[3], tip, col);
  }
  return mergeGeometries([trunk, husk, trGeo(p, n, new Array((p.length / 3) * 2).fill(0), c)]);
}
