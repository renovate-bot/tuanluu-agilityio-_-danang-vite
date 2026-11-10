/* ============================ Tự khám phá: mô hình dù lượn ============================
   Một Mesh duy nhất (cánh vòm in cờ đỏ sao vàng + dây + người treo + dải đèn mép cánh), gộp bằng mergeGeometries, vertex color nhân với atlas canvas.
   Hệ cục bộ: +X là hướng bay, +Y lên, +Z bên phải. Atlas: phần trên là mặt cánh, dải dưới là màu trơn; emissiveMap cùng bố cục, cường độ đọc shared.uNight.
   Mọi thông số nằm ở CONFIG.explore.glider (span, lines = khoảng treo, lineCount, chord, arch, segs). */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config';
import { shared } from '../core/shared';
import type { GliderState } from './flight';

const G = CONFIG.explore.glider;
const UV_DARK = 0.25, UV_LIT = 0.75;         // u trong dải màu trơn: nửa tối / nửa sáng
const TILT = Math.tan(G.tilt);               // độ dốc cánh theo hướng bay (mép sau thấp hơn)
const ATLAS_W = 1024, ATLAS_H = 256;         // điểm ảnh atlas
const WING_H = 216, BAND_Y = 224;            // mặt cánh chiếm y 0..WING_H; dải màu trơn từ BAND_Y tới đáy; khoảng giữa để đệm
const V_SOLID = 1 - (BAND_Y + ATLAS_H) / 2 / ATLAS_H, V_WING0 = 1 - WING_H / ATLAS_H;   // v giữa dải màu trơn; v của mép sau cánh

/* Gán uv và màu đỉnh cho hình học không chỉ số */
function exPaint(g: THREE.BufferGeometry, rgb: number[], u: number): THREE.BufferGeometry {
  const n = g.attributes.position.count, col = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) { col.set(rgb, i * 3); uv[i * 2] = u; uv[i * 2 + 1] = V_SOLID; }
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
    const pa = (t: number, x: number) => [x, -G.arch * half * t * t + lift + x * TILT, t * half];
    const a0 = pa(ta, chord0), a1 = pa(ta, chord1), b0 = pa(tb, chord0), b1 = pa(tb, chord1);
    pos.push(...a0, ...b0, ...a1, ...a1, ...b0, ...b1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return exPaint(g, rgb, u);
}

/* Điểm theo hệ người treo: y tính từ móc treo (−G.lines) */
const exP = (x: number, y: number, z: number) => new THREE.Vector3(x, y - G.lines, z);

/* Khối bo tròn nối hai điểm (tay, chân, thân) */
function exLimb(a: THREE.Vector3, b: THREE.Vector3, r: number, rgb: number[]): THREE.BufferGeometry {
  const d = b.clone().sub(a), len = d.length();
  const g = new THREE.CapsuleGeometry(r, len, 3, 8).toNonIndexed();
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return exPaint(g, rgb, UV_DARK);
}

/* Khối elip tại c, bán trục s */
function exBlob(c: THREE.Vector3, s: number[], rgb: number[]): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, 12, 8).toNonIndexed();
  g.scale(s[0], s[1], s[2]); g.translate(c.x, c.y, c.z);
  return exPaint(g, rgb, UV_DARK);
}

/* Người ngồi trong ghế dù, ngả nhẹ ra sau, chân duỗi về trước, tay cầm dây phanh */
function exHuman(parts: THREE.BufferGeometry[]): void {
  const JACKET = [0.16, 0.3, 0.55], PANTS = [0.12, 0.13, 0.17], SEAT = [0.05, 0.05, 0.07], BOOT = [0.3, 0.17, 0.08], SKIN = [0.86, 0.66, 0.5], HELMET = [0.92, 0.92, 0.9], VISOR = [0.05, 0.06, 0.1];
  parts.push(exBlob(exP(-0.22, -0.68, 0), [0.32, 0.2, 0.3], SEAT));                  // ghế dù
  parts.push(exBlob(exP(-0.36, -0.28, 0), [0.14, 0.32, 0.26], SEAT));                // lưng ghế, túi dù dự phòng
  parts.push(exLimb(exP(-0.08, -0.62, 0), exP(-0.16, -0.12, 0), 0.19, JACKET));      // thân
  for (const z of [-1, 1]) {
    parts.push(exLimb(exP(0, 0, z * 0.2), exP(-0.12, -0.3, z * 0.22), 0.025, SEAT));  // đai treo từ móc xuống vai
    parts.push(exLimb(exP(-0.04, -0.68, z * 0.13), exP(0.4, -0.7, z * 0.17), 0.085, PANTS));   // đùi
    parts.push(exLimb(exP(0.4, -0.7, z * 0.17), exP(0.58, -1.08, z * 0.17), 0.065, PANTS));    // cẳng chân
    parts.push(exBlob(exP(0.65, -1.14, z * 0.17), [0.14, 0.06, 0.07], BOOT));         // giày
    parts.push(exLimb(exP(-0.14, -0.12, z * 0.24), exP(-0.06, -0.08, z * 0.46), 0.06, JACKET));  // cánh tay
    parts.push(exLimb(exP(-0.06, -0.08, z * 0.46), exP(0.02, 0.3, z * 0.34), 0.05, JACKET));     // cẳng tay giơ lên
    parts.push(exBlob(exP(0.02, 0.34, z * 0.34), [0.05, 0.06, 0.05], SKIN));          // bàn tay
  }
  parts.push(exBlob(exP(-0.14, 0.17, 0), [0.12, 0.13, 0.11], SKIN));                  // đầu
  parts.push(exBlob(exP(-0.16, 0.22, 0), [0.15, 0.13, 0.135], HELMET));               // mũ bảo hiểm
  parts.push(exBlob(exP(-0.05, 0.17, 0), [0.05, 0.035, 0.09], VISOR));                // kính
}

/* Trải mặt cánh lên atlas: u theo sải, v theo dây cung (mép trước ở đỉnh ảnh, nên đỉnh sao hướng về mép trước) */
function exWingUv(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const p = g.attributes.position, uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getZ(i) / G.span + 0.5), V_WING0 + (1 - V_WING0) * (p.getX(i) / G.chord + 0.5));
  return g;
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

/* Vẽ mặt cánh: nền đỏ, sao vàng 5 cánh một đỉnh hướng lên, đường ô khí. Tính theo mét nên sao không méo. glow: bản phát sáng ban đêm, tối hơn */
function exDrawWing(x: CanvasRenderingContext2D, glow: boolean, wingColor?: string): void {
  const sx = ATLAS_W / G.span, sy = WING_H / G.chord, cx = ATLAS_W / 2, cy = WING_H / 2;
  x.fillStyle = wingColor ?? G.flagRed; x.fillRect(0, 0, ATLAS_W, BAND_Y);
  if (!wingColor) {   // dù của mình: cờ đỏ sao vàng; dù người khác chỉ có nền màu
    x.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = G.starRadius * (i % 2 ? 0.382 : 1), a = -Math.PI / 2 + i * Math.PI / 5;
      x.lineTo(cx + Math.cos(a) * r * sx, cy + Math.sin(a) * r * sy);
    }
    x.closePath(); x.fillStyle = G.flagStar; x.fill();
  }
  x.fillStyle = 'rgba(70,0,0,0.28)';
  for (let i = 0; i <= G.cells; i++) x.fillRect(i * ATLAS_W / G.cells - 1, 0, 2, WING_H);
  x.fillStyle = 'rgba(70,0,0,0.12)';
  for (const k of [0.3, 0.65]) x.fillRect(0, WING_H * k - 1, ATLAS_W, 2);
  if (glow) { x.fillStyle = 'rgba(0,0,0,0.62)'; x.fillRect(0, 0, ATLAS_W, BAND_Y); }
}

function exAtlasTexture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

/* Màu cánh: mặt cánh + dải trơn trắng (nhân với vertex color) */
function exColorMap(wingColor?: string): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = ATLAS_W; c.height = ATLAS_H;
  const x = c.getContext('2d')!;
  exDrawWing(x, false, wingColor);
  x.fillStyle = '#fff'; x.fillRect(0, BAND_Y, ATLAS_W, ATLAS_H - BAND_Y);
  return exAtlasTexture(c);
}

/* Phát sáng ban đêm: cánh sáng dịu để vẫn thấy cờ; dải trơn nửa trái đen, nửa phải trắng */
function exGlowMap(wingColor?: string): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = ATLAS_W; c.height = ATLAS_H;
  const x = c.getContext('2d')!;
  exDrawWing(x, true, wingColor);
  x.fillStyle = '#000'; x.fillRect(0, BAND_Y, ATLAS_W / 2, ATLAS_H - BAND_Y);
  x.fillStyle = '#fff'; x.fillRect(ATLAS_W / 2, BAND_Y, ATLAS_W / 2, ATLAS_H - BAND_Y);
  return exAtlasTexture(c);
}

/* Hình học dùng chung mọi dù (dựng một lần); vật liệu và texture riêng theo màu */
let exGeo: THREE.BufferGeometry | null = null;
const exMaps = new Map<string, { map: THREE.CanvasTexture; glow: THREE.CanvasTexture }>();

function exGliderGeometry(): THREE.BufferGeometry {
  if (exGeo) return exGeo;
  const parts: THREE.BufferGeometry[] = [];
  /* Cánh: mặt chính + dải đèn hai mép (nhô nhẹ lên trên mặt cánh) */
  const body = exWingUv(exWingStrip(-G.chord / 2, G.chord / 2, [1, 1, 1], UV_DARK, 0));
  parts.push(body);
  parts.push(exWingStrip(G.chord / 2 - 0.12, G.chord / 2, [1, 0.42, 0.38], UV_LIT, 0.02));
  parts.push(exWingStrip(-G.chord / 2, -G.chord / 2 + 0.12, [0.75, 0.1, 0.08], UV_LIT, 0.02));   // mép sau: thấy rõ từ camera bám đuôi
  /* Người treo, cách cánh G.lines mét */
  exHuman(parts);
  /* Dây: G.lineCount dây mỗi bên, từ cánh xuống vai */
  const half = G.span / 2;
  for (const side of [-1, 1]) {
    for (let i = 0; i < G.lineCount; i++) {
      const t = 0.12 + 0.75 * i / Math.max(1, G.lineCount - 1);
      const x = (i % 2 ? 0.5 : -0.5) * G.chord * 0.6;
      parts.push(exLine(new THREE.Vector3(x, -G.arch * half * t * t + x * TILT, side * t * half), new THREE.Vector3(0, -G.lines, side * 0.2)));
    }
  }
  const geo = mergeGeometries(parts)!;
  /* Gốc group nằm giữa cánh (trên) và người (dưới): cánh ở +lines·k, người ở −lines·(1−k) */
  geo.translate(0, G.lines * G.originAt, 0);
  return exGeo = geo;
}

/* wingColor bỏ trống: dù cờ đỏ sao vàng của mình. Có wingColor: nền màu đó, không sao, giữ đường ô khí (dù người khác) */
export function exBuildGlider(wingColor?: string): THREE.Group {
  const geo = exGliderGeometry();
  const key = wingColor ?? '';
  let tex = exMaps.get(key);
  if (!tex) exMaps.set(key, tex = { map: exColorMap(wingColor), glow: exGlowMap(wingColor) });
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: tex.map, roughness: G.roughness, side: THREE.DoubleSide, emissive: 0xffffff, emissiveMap: tex.glow, emissiveIntensity: 0 });
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
