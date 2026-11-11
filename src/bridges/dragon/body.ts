import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from '../../config';
import { scene } from '../../core/renderer';
import { MAT } from '../../core/materials';
import { rand, lerp, smooth } from '../../common/math';
import { taperedTube, segmentMatrix, shadowed, UP } from '../../common/geometry';
import { deckY } from './profile';

/* ============================ Cầu Rồng: thân rồng ============================ */
export let spine: THREE.CatmullRomCurve3;
let spineFrames: { tangents: THREE.Vector3[]; normals: THREE.Vector3[]; binormals: THREE.Vector3[] }, spineLen: number;
const SPINE_SEGS = 1400;
const spineP: THREE.Vector3[] = [];
function spineRadius(u: number) {
  const R = CONFIG.bodyRadius;
  if (u < 0.06) return lerp(0.25, R, smooth(u / 0.06));
  if (u > 0.95) return lerp(R, CONFIG.headRadius, smooth((u - 0.95) / 0.05));
  return R;
}
function spineUp(i: number, out: THREE.Vector3) { // hướng "lên" vuông góc tiếp tuyến
  const T = spineFrames.tangents[i];
  return out.copy(UP).addScaledVector(T, -T.y).normalize();
}
export function buildDragonBody() {
  const pts: THREE.Vector3[] = [];
  const add = (x: number, yr: number) => pts.push(new THREE.Vector3(x, deckY(x) + yr, 0));
  // Đuôi rồng cong vút ở đầu Tây
  add(-366, 11); add(-361, 16); add(-354, 17.5); add(-347, 14); add(-340, 8.5); add(-331, 4.5); add(-316, 3.0); add(-298, 3.4); add(-276, 2.4);
  // 5 nhịp sóng: nhô lên giữa nhịp, lặn xuống dưới mặt cầu tại trụ
  let x0 = -CONFIG.mainTotal / 2; add(x0, -3);
  for (const s of CONFIG.mainSpans) {
    const rise = CONFIG.spanRise[s];
    for (const t of [0.12, 0.28, 0.5, 0.72, 0.88]) add(x0 + s * t, -3 + (rise + 3) * Math.sin(Math.PI * t));
    x0 += s; add(x0, -3);
  }
  // Cổ rồng vươn lên ở đầu Đông
  add(272, 2.4); add(289, 3.0); add(303, 4.6); add(314, 7.4); add(323, 10.4); add(330, 13);
  spine = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  spineLen = spine.getLength();
  spineFrames = spine.computeFrenetFrames(SPINE_SEGS, false);
  for (let i = 0; i <= SPINE_SEGS; i++) spineP.push(spine.getPointAt(i / SPINE_SEGS));

  const body = new THREE.Mesh(taperedTube(spine, SPINE_SEGS, 20, spineRadius, spineFrames), MAT.gold);
  body.name = 'dragon-body';   // tên cho test đi dạo chọn lưới rắn (tests/stroll-check.mjs)
  scene.add(shadowed(body));

  // Đai sườn thép quanh thân
  const ringN = Math.floor(spineLen / 8);
  const ribs = new THREE.InstancedMesh(new THREE.TorusGeometry(1, 0.085, 6, 28), MAT.gold, ringN);
  // Vây lưng
  const finN = Math.floor(spineLen / 2.6);
  const finGeo = new THREE.ConeGeometry(0.55, 1, 5).translate(0, 0.5, 0);
  const fins = new THREE.InstancedMesh(finGeo, MAT.gold, finN);
  const m = new THREE.Matrix4(), rz = new THREE.Matrix4().makeRotationZ(0.5);
  const U = new THREE.Vector3(), S = new THREE.Vector3(), X = new THREE.Vector3(), Z = new THREE.Vector3();
  for (let k = 0; k < ringN; k++) {
    const i = Math.round((k + 0.5) / ringN * SPINE_SEGS), r = spineRadius(i / SPINE_SEGS) * 1.03;
    spineUp(i, U); S.crossVectors(spineFrames.tangents[i], U).normalize();
    m.makeBasis(U, S, spineFrames.tangents[i]).scale(new THREE.Vector3(r, r, r)).setPosition(spineP[i]);
    ribs.setMatrixAt(k, m);
  }
  let used = 0;
  for (let k = 0; k < finN; k++) {
    const i = Math.round((k + 0.5) / finN * SPINE_SEGS), u = i / SPINE_SEGS, r = spineRadius(u);
    const T = spineFrames.tangents[i]; spineUp(i, U); Z.crossVectors(T, U).normalize();
    const len = 1.9 * (r / CONFIG.bodyRadius) * (u < 0.06 ? 1.6 : 1);
    m.makeBasis(T, U, Z).multiply(rz).scale(new THREE.Vector3(1, len, 0.3)).setPosition(X.copy(spineP[i]).addScaledVector(U, r * 0.86));
    fins.setMatrixAt(used++, m);
  }
  fins.count = used;
  scene.add(shadowed(ribs), shadowed(fins));

  // Dải LED hai bên sườn rồng
  const ledGeos = [];
  for (const side of [-1, 1]) {
    const lp = [];
    for (let i = 0; i <= SPINE_SEGS; i += 4) {
      const r = spineRadius(i / SPINE_SEGS); spineUp(i, U); S.crossVectors(spineFrames.tangents[i], U).normalize();
      lp.push(spineP[i].clone().addScaledVector(S, side * r * 0.97).addScaledVector(U, r * 0.22));
    }
    ledGeos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lp), 700, 0.17, 5, false));
  }
  scene.add(new THREE.Mesh(mergeGeometries(ledGeos), MAT.ledRail));

  buildTailFin();
}

/* Vây đuôi xòe như ngọn lửa */
function buildTailFin() {
  const P0 = spine.getPointAt(0), T0 = spine.getTangentAt(0);
  const geo = new THREE.ConeGeometry(1, 1, 4).translate(0, 0.5, 0);
  const fin = new THREE.InstancedMesh(geo, MAT.gold, 9);
  const base = Math.atan2(-T0.y, -T0.x), m = new THREE.Matrix4();
  const Zv = new THREE.Vector3(0, 0, 1), Y = new THREE.Vector3(), X = new THREE.Vector3();
  for (let k = -4; k <= 4; k++) {
    const a = base + k * 0.26; Y.set(Math.cos(a), Math.sin(a), 0); X.crossVectors(Y, Zv);
    m.makeBasis(X, Y, Zv).scale(new THREE.Vector3(1.1, 7.5 - Math.abs(k) * 1.1, 0.22)).setPosition(P0);
    fin.setMatrixAt(k + 4, m);
  }
  scene.add(shadowed(fin));
}

/* Vảy rồng: hàng nghìn tấm hình thoi xếp so le như vảy cá */
function makeScaleGeometry() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([
    0.85, 0.0, 0.0,    0.0, 0.10, 0.88,   -1.05, 0.24, 0.0,   0.0, 0.10, -0.88,   -0.05, 0.22, 0.0
  ], 3));
  g.setIndex([0, 4, 1, 1, 4, 2, 2, 4, 3, 3, 4, 0]);
  g.computeVertexNormals();
  return g;
}
export function buildScales() {
  const rings = Math.floor(spineLen / CONFIG.scaleStep), per = CONFIG.scalesPerRing;
  const mesh = new THREE.InstancedMesh(makeScaleGeometry(), MAT.scale, rings * per);
  const m = new THREE.Matrix4(), U = new THREE.Vector3(), S = new THREE.Vector3(), D = new THREE.Vector3(), Z = new THREE.Vector3(), P = new THREE.Vector3();
  const col = new THREE.Color(), sv = new THREE.Vector3();
  let k = 0;
  for (let r = 0; r < rings; r++) {
    const i = Math.round((r + 0.5) / rings * SPINE_SEGS), u = i / SPINE_SEGS, rad = spineRadius(u);
    if (rad < 0.55) continue;
    const T = spineFrames.tangents[i]; spineUp(i, U); S.crossVectors(T, U).normalize();
    for (let j = 0; j < per; j++) {
      const a = (j + (r % 2) * 0.5) / per * Math.PI * 2;
      D.copy(U).multiplyScalar(Math.cos(a)).addScaledVector(S, Math.sin(a));
      Z.crossVectors(T, D);
      const sc = rad / CONFIG.bodyRadius;
      m.makeBasis(T, D, Z).scale(sv.set(sc, sc, sc)).setPosition(P.copy(spineP[i]).addScaledVector(D, rad * 0.97));
      mesh.setMatrixAt(k, m);
      const v = 0.9 + rand() * 0.18; col.setRGB(0.93 * v, 0.68 * v, 0.24 * v);
      mesh.setColorAt(k, col); k++;
    }
  }
  mesh.count = k;
  scene.add(shadowed(mesh));
}

/* Dây treo (hanger) từ bụng rồng xuống mặt cầu, bố trí đều theo nhịp */
export function buildHangers() {
  const list: [THREE.Vector3, THREE.Vector3][] = [];
  const half = CONFIG.mainTotal / 2, U = new THREE.Vector3();
  let i = 0;
  for (let x = -half + 2.5; x < half; x += CONFIG.hangerStep) {
    while (i < SPINE_SEGS && spineP[i].x < x) i++;
    const r = spineRadius(i / SPINE_SEGS); spineUp(i, U);
    const bottom = spineP[i].clone().addScaledVector(U, -r * 0.9);
    const yd = deckY(x) + 0.3;
    if (bottom.y - yd < 2.5) continue;
    for (const s of [-1, 1]) list.push([new THREE.Vector3(bottom.x, bottom.y, s * 0.7), new THREE.Vector3(x, yd, s * 2.8)]);
  }
  const mesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 6), MAT.cable, list.length);
  const m = new THREE.Matrix4();
  list.forEach(([a, b], k) => mesh.setMatrixAt(k, segmentMatrix(a, b, 0.11, m)));
  mesh.castShadow = true; scene.add(mesh);
}
