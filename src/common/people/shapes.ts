import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from '../../config';

/* =====================================================================
   HÌNH HỌC NGƯỜI ĐI BỘ — một hình gộp cho mọi kiểu người (spec G5, G8): thân, đầu, tóc, hai tay (bắp tay áo cộc + cẳng tay),
   hai chân (đùi + ống quần + giày), nón lá, ba lô. Theo personGeo của bản dựng thử, bớt cạnh để ≤ CONFIG.people.maxVerts đỉnh.
   Mét, tỉ lệ 1: cao ≈ 1,65 m (≈ 1,79 m tính chóp nón), mặt hướng +X, rộng theo Z, chân chạm y = 0. Có index, không uv.
   Thuộc tính đỉnh (shader ở material.ts đọc):
   - aPart: 0 thân/đầu/tóc, 1 chân trái (−Z, vì mặt hướng +X), 2 chân phải (+Z), 3 tay trái, 4 tay phải, 5 nón lá, 6 ba lô (5, 6 bật theo cờ instance)
   - aSeg: 0 đoạn trên, 1 đoạn dưới khớp (quay thêm quanh aPivot2); aPivot: cao độ hông / vai; aPivot2: cao độ gối / khuỷu
   - aMask: 0 màu cố định aFix, 1 áo (instanceColor), 2 quần (aPants); aFix: màu cố định tuyến tính (da, tóc, giày, nón, ba lô)
   ===================================================================== */
export const PP_HIP = 0.86, PP_KNEE = 0.46, PP_SHOULDER = 1.37, PP_ELBOW = 1.1;   // m — cao độ khớp ở tỉ lệ 1
export enum PpPart { Body = 0, LegL = 1, LegR = 2, ArmL = 3, ArmR = 4, Hat = 5, Pack = 6 }
export enum PpMask { Fixed = 0, Shirt = 1, Pants = 2 }

const C = CONFIG.people.palette;
const cap = (r: number, l: number) => new THREE.CapsuleGeometry(r, l, 2, 6);   // tay chân: 6 cạnh, nắp 2 đoạn

/* Gắn thuộc tính khớp và màu cho một bộ phận; bỏ uv để mọi phần gộp được */
function ppTag(g: THREE.BufferGeometry, part: PpPart, pivot: number, fix: number, mask: PpMask, seg = 0, pivot2 = 0): THREE.BufferGeometry {
  if (g.getAttribute('uv')) g.deleteAttribute('uv'); g.clearGroups();
  const n = g.getAttribute('position').count, col = new THREE.Color(fix), F = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { F[i * 3] = col.r; F[i * 3 + 1] = col.g; F[i * 3 + 2] = col.b; }
  const fill = (v: number) => new THREE.BufferAttribute(new Float32Array(n).fill(v), 1);
  g.setAttribute('aPart', fill(part)); g.setAttribute('aSeg', fill(seg)); g.setAttribute('aPivot', fill(pivot)); g.setAttribute('aPivot2', fill(pivot2));
  g.setAttribute('aMask', fill(mask)); g.setAttribute('aFix', new THREE.BufferAttribute(F, 3));
  return g;
}

/* Dựng mới mỗi lần gọi (không cache): bên gọi giữ một bản dùng chung cho mọi hệ người nếu muốn */
export function ppBuildGeometry(): THREE.BufferGeometry {
  const parts = [
    ppTag(cap(0.15, 0.3).scale(0.78, 1, 1.18).translate(0, 1.12, 0), PpPart.Body, 0, C.skin, PpMask.Shirt),                     // thân (áo)
    ppTag(new THREE.SphereGeometry(0.115, 8, 6).translate(0, 1.54, 0), PpPart.Body, 0, C.skin, PpMask.Fixed),                    // đầu
    ppTag(new THREE.SphereGeometry(0.123, 8, 4, 0, Math.PI * 2, 0, 1.75).translate(-0.018, 1.553, 0), PpPart.Body, 0, C.hair, PpMask.Fixed),   // tóc (chỏm cầu, lệch ra sau)
    ppTag(new THREE.ConeGeometry(0.31, 0.17, 10).translate(0, 1.7, 0), PpPart.Hat, 0, C.hat, PpMask.Fixed),                      // nón lá
    ppTag(new THREE.BoxGeometry(0.13, 0.32, 0.25).translate(-0.18, 1.17, 0), PpPart.Pack, 0, C.pack, PpMask.Fixed)               // ba lô sau lưng (−X)
  ];
  for (const [side, leg, arm] of [[-1, PpPart.LegL, PpPart.ArmL], [1, PpPart.LegR, PpPart.ArmR]] as [number, PpPart, PpPart][]) {
    parts.push(ppTag(cap(0.072, 0.28).translate(0, 0.66, side * 0.085), leg, PP_HIP, C.skin, PpMask.Pants));                                    // đùi
    parts.push(ppTag(cap(0.058, 0.3).translate(0, 0.25, side * 0.085), leg, PP_HIP, C.skin, PpMask.Pants, 1, PP_KNEE));                          // ống chân
    parts.push(ppTag(new THREE.BoxGeometry(0.23, 0.07, 0.095).translate(0.045, 0.035, side * 0.085), leg, PP_HIP, C.shoe, PpMask.Fixed, 1, PP_KNEE));   // giày, mũi về +X
    parts.push(ppTag(cap(0.05, 0.18).translate(0, 1.235, side * 0.225), arm, PP_SHOULDER, C.skin, PpMask.Shirt));                                // bắp tay (áo cộc tay)
    parts.push(ppTag(cap(0.042, 0.2).translate(0, 0.96, side * 0.225), arm, PP_SHOULDER, C.skin, PpMask.Fixed, 1, PP_ELBOW));                    // cẳng tay
  }
  const g = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  return g;
}
