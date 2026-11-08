/* ============================ Tự khám phá: mô hình dù lượn ============================
   Một Mesh duy nhất (cánh vòm + dây + người treo + dải đèn mép cánh), gộp bằng mergeGeometries, vertex color.
   Hệ cục bộ: +X là hướng bay, +Y lên, +Z bên phải. Dải đèn đêm là emissiveMap (canvas 2×1 điểm ảnh), cường độ đọc shared.uNight.
   Mọi thông số nằm ở CONFIG.explore.glider (span, lines = khoảng treo, lineCount, chord, arch, segs). */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config';
import { shared } from '../core/shared';
import type { GliderState } from './flight';

const G = CONFIG.explore.glider;
const UV_DARK = 0.25, UV_LIT = 0.75;         // u trên emissiveMap: nửa tối / nửa sáng

/* Gán uv và màu đỉnh cho hình học không chỉ số */
function exPaint(g: THREE.BufferGeometry, rgb: number[], u: number): THREE.BufferGeometry {
  const n = g.attributes.position.count, col = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) { col.set(rgb, i * 3); uv[i * 2] = u; uv[i * 2 + 1] = 0.5; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

/* Dải cánh vòm giữa hai mặt cắt: lệch x0..x1 theo hướng bay, cong xuống ở hai đầu */
function exWingStrip(chord0: number, chord1: number, rgb: number[], u: number, lift: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const half = G.span / 2;
  for (let i = 0; i < G.segs; i++) {
    const ta = -1 + 2 * i / G.segs, tb = -1 + 2 * (i + 1) / G.segs;
    const pa = (t: number, x: number) => [x, -G.arch * half * t * t + lift, t * half];
    const a0 = pa(ta, chord0), a1 = pa(ta, chord1), b0 = pa(tb, chord0), b1 = pa(tb, chord1);
    pos.push(...a0, ...b0, ...a1, ...a1, ...b0, ...b1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return exPaint(g, rgb, u);
}

/* Hộp mảnh nối hai điểm (dây treo) */
function exLine(a: THREE.Vector3, b: THREE.Vector3): THREE.BufferGeometry {
  const d = b.clone().sub(a), len = d.length();
  const g = new THREE.BoxGeometry(0.03, len, 0.03).toNonIndexed();
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  g.deleteAttribute('uv');
  return exPaint(g, [0.15, 0.15, 0.15], UV_DARK);
}

/* Texture phát sáng: nửa trái đen, nửa phải trắng */
function exGlowMap(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 2; c.height = 1;
  const x = c.getContext('2d')!;
  x.fillStyle = '#000'; x.fillRect(0, 0, 1, 1);
  x.fillStyle = '#fff'; x.fillRect(1, 0, 1, 1);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  return t;
}

export function exBuildGlider(): THREE.Group {
  const parts: THREE.BufferGeometry[] = [];
  /* Cánh: mặt chính + dải đèn hai mép (nhô nhẹ lên trên mặt cánh) */
  const body = exWingStrip(-G.chord / 2, G.chord / 2, [0.95, 0.4, 0.1], UV_DARK, 0);
  parts.push(body);
  parts.push(exWingStrip(G.chord / 2 - 0.12, G.chord / 2, [1, 1, 1], UV_LIT, 0.02));
  parts.push(exWingStrip(-G.chord / 2, -G.chord / 2 + 0.12, [1, 1, 1], UV_LIT, 0.02));   // mép sau: thấy rõ từ camera bám đuôi
  /* Người treo: thân + đầu, cách cánh G.lines mét */
  const torso = new THREE.BoxGeometry(0.5, 1.0, 0.45).toNonIndexed(); torso.deleteAttribute('uv'); torso.translate(0, -G.lines - 0.3, 0);
  parts.push(exPaint(torso, [0.1, 0.12, 0.2], UV_DARK));
  const head = new THREE.BoxGeometry(0.28, 0.28, 0.28).toNonIndexed(); head.deleteAttribute('uv'); head.translate(0.05, -G.lines + 0.4, 0);
  parts.push(exPaint(head, [0.9, 0.75, 0.6], UV_DARK));
  /* Dây: G.lineCount dây mỗi bên, từ cánh xuống vai */
  const half = G.span / 2;
  for (const side of [-1, 1]) {
    for (let i = 0; i < G.lineCount; i++) {
      const t = 0.12 + 0.75 * i / Math.max(1, G.lineCount - 1);
      const x = (i % 2 ? 0.5 : -0.5) * G.chord * 0.6;
      parts.push(exLine(new THREE.Vector3(x, -G.arch * half * t * t, side * t * half), new THREE.Vector3(0, -G.lines, side * 0.2)));
    }
  }
  const geo = mergeGeometries(parts)!;
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide, emissive: 0xffffff, emissiveMap: exGlowMap(), emissiveIntensity: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = false; mesh.receiveShadow = false; mesh.frustumCulled = false;
  const g = new THREE.Group(); g.name = 'ex-glider'; g.add(mesh);
  return g;
}

/* Đặt dù theo trạng thái bay: quay yaw trước, rồi cuộn quanh trục bay (bank > 0: nghiêng trái, cánh trái hạ) */
export function exPlaceGlider(g: THREE.Group, s: GliderState): void {
  g.position.copy(s.pos);
  g.rotation.set(-s.bank, s.yaw, 0, 'YXZ');
  const m = (g.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;
  m.emissiveIntensity = shared.uNight.value;
}
