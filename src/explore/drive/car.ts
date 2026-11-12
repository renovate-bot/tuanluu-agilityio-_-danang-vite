/* ===== Lái xe: hình chiếc VinFast VF 3 trong cảnh (D-034) =====
   - drCarLoad(): import() động GLTFLoader, nạp public/car/vf3.glb một lần, nhớ đệm. Lỗi bất kỳ hoặc quá model.timeoutMs → console.warn, null; promise không bao giờ bị từ chối.
     Nguồn được chuẩn hóa một lần: lớp 1 (không vào phản chiếu nước), không đổ / nhận bóng; hai vật liệu đèn vá bằng onBeforeCompile (đọc shared.uNight, không PointLight);
     chờ drCarSetWarm (compileAsync theo cảnh chính, ≤ model.warmMs) rồi mới trả nguồn.
   - Đèn: lamp_head có emissive map của nguồn, nhân hệ số theo uNight. lamp_tail không có: phát sáng = màu cơ bản (cả logo trong ảnh dán) nhân hệ số.
     Đèn phanh = bản vật liệu thứ hai cùng program (cùng customProgramCacheKey, chỉ khác uniform uBrake): đổi tham chiếu vật liệu của lưới đèn hậu, không biên dịch lại.
   - DrCar: group có ngay với hình tạm (một Mesh gộp hộp bo + bốn trụ bánh, màu theo slot) và tấm bóng mờ dưới gầm; nạp xong thì đổi sang bản sao `body` của mô hình
     (5 primitive = 5 lệnh vẽ, vật liệu `paint` nhân bản riêng để đặt màu slot). Bốn bánh KHÔNG thuộc group của xe: nằm trong drWheels, mỗi vật liệu của lưới bánh một
     InstancedMesh dùng chung cho mọi xe (3 lệnh vẽ tổng cộng), mỗi xe giữ 4 chỗ liên tiếp. drWheels.group phải nằm trong cảnh (drCars.group chứa sẵn).
     Lệnh vẽ: hình tạm 2 / xe; mô hình thật 5 thân + 1 bóng = 6 / xe, cộng 3 lệnh bánh chung.
   - Quy ước hướng: yaw 0 = mũi +X; steer > 0 rẽ trái (cùng chiều yaw); wheel = góc lăn bánh trái (rad, tăng khi xe tiến). Mô hình: mũi +X, Y lên, đáy lốp y = 0, gốc giữa hai trục.
     Bánh phải dùng chung lưới với bánh trái nên nút xoay 180 độ quanh Y: dấu quay quanh Z cục bộ lấy theo hướng Z cục bộ của bánh trong thế giới.
   Không cấp phát mỗi khung. docs/superpowers/specs/2026-11-12-lai-xe-oto-design.md */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CONFIG } from '../../config';
import { shared } from '../../core/shared';
import { multiParams } from '../multi/params';

const M = CONFIG.drive.model, CAR = CONFIG.drive.car;
const WHEELS = ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr'];   // hai bánh đầu là bánh trước
const CAP = (multiParams.slots + 1) * 4;                           // chỗ bánh: 6 xe × 4

export interface DrPlace { x: number; y: number; z: number; yaw: number; pitch: number; steer: number; wheel: number; braking: boolean }

/* ===== Vật liệu đèn: vá phát sáng theo uNight, hệ số `night`; uBrake > phát sáng nền thì thay bằng uBrake ===== */
function drLampPatch(m: THREE.MeshStandardMaterial, key: string, night: number, brake: number): void {
  const ub = { value: brake };
  m.onBeforeCompile = (s) => {
    s.uniforms.uNight = shared.uNight;
    s.uniforms.uBrake = ub;
    s.fragmentShader = 'uniform float uNight;\nuniform float uBrake;\n' + s.fragmentShader.replace('#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>\ntotalEmissiveRadiance *= max( clamp( uNight, 0.0, 1.0 ) * ${night.toFixed(3)}, uBrake );`);
  };
  m.customProgramCacheKey = () => key;
  m.userData.lampBrake = brake;
}

export interface DrSource {
  scene: THREE.Object3D;                       // cảnh gốc (không thêm vào cảnh; chỉ để sao chép)
  body: THREE.Object3D;                        // nút body
  paint: THREE.MeshStandardMaterial;           // vật liệu sơn gốc (mỗi xe nhân bản)
  tail: THREE.Material; tailBrake: THREE.Material;
  wheels: { pos: THREE.Vector3; quat: THREE.Quaternion; sign: number }[];   // vị trí, xoay nghỉ, dấu quay quanh Z cục bộ (4 bánh theo WHEELS)
  wheelMeshes: THREE.Mesh[];                   // các lưới của wheel_fl (mỗi vật liệu một lưới)
}

/* Chuẩn hóa cảnh đã nạp thành nguồn dùng chung. Thiếu nút / vật liệu thì ném lỗi (drCarLoad bắt, trả null) */
export function drCarSource(scene: THREE.Object3D): DrSource {
  scene.updateMatrixWorld(true);
  const body = scene.getObjectByName('body');
  if (!body) throw new Error('thiếu nút body');
  let paint: THREE.MeshStandardMaterial | null = null, head: THREE.MeshStandardMaterial | null = null, tail: THREE.MeshStandardMaterial | null = null;
  scene.traverse((o) => {
    o.layers.set(1);
    const me = o as THREE.Mesh;
    if (!me.isMesh) return;
    me.castShadow = false; me.receiveShadow = false;
    const mat = me.material as THREE.MeshStandardMaterial;
    if (mat.name === 'paint') paint = mat;
    else if (mat.name === 'lamp_head') head = mat;
    else if (mat.name === 'lamp_tail') tail = mat;
  });
  if (!paint || !head || !tail) throw new Error('thiếu vật liệu paint / lamp_head / lamp_tail');
  const h = head as THREE.MeshStandardMaterial, t = tail as THREE.MeshStandardMaterial;
  drLampPatch(h, 'drLampHead', M.headNight, 0);
  t.emissive.set(0xffffff); t.emissiveMap = t.map; t.emissiveIntensity = 1;   // không emissive map: lấy chính ảnh màu cơ bản
  drLampPatch(t, 'drLampTail', M.tailNight, 0);
  const tb = t.clone(); drLampPatch(tb, 'drLampTail', M.tailNight, M.tailBrake);   // cùng khóa program: chỉ khác uniform
  const wheels: DrSource['wheels'] = [], z = new THREE.Vector3();
  for (const n of WHEELS) {
    const w = scene.getObjectByName(n);
    if (!w) throw new Error(`thiếu nút ${n}`);
    z.set(0, 0, 1).applyQuaternion(w.quaternion);
    wheels.push({ pos: w.position.clone(), quat: w.quaternion.clone(), sign: z.z > 0 ? -1 : 1 });   // bánh tiến: quanh +Z thế giới góc âm
  }
  const wheelMeshes: THREE.Mesh[] = [];
  scene.getObjectByName(WHEELS[0]).traverse((o) => { if ((o as THREE.Mesh).isMesh) wheelMeshes.push(o as THREE.Mesh); });
  if (!wheelMeshes.length) throw new Error('bánh không có lưới');
  return { scene, body, paint: paint as THREE.MeshStandardMaterial, tail: t, tailBrake: tb, wheels, wheelMeshes };
}

/* ===== Nạp (nhớ đệm) ===== */
let warm: ((o: THREE.Object3D) => Promise<unknown>) | null = null;
export function drCarSetWarm(fn: ((o: THREE.Object3D) => Promise<unknown>) | null): void { warm = fn; }
async function drCarWarm(o: THREE.Object3D): Promise<void> {
  if (!warm) return;
  let timer = 0;
  try { await Promise.race([warm(o), new Promise<void>((r) => { timer = setTimeout(r, M.warmMs) as unknown as number; })]); }
  catch { /* biên dịch trước lỗi: lần vẽ đầu tự biên dịch */ }
  finally { clearTimeout(timer); }
}

async function drCarDefaultLoader(): Promise<THREE.Object3D> {
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const gltf = await new GLTFLoader().loadAsync(import.meta.env.BASE_URL + M.url);
  return gltf.scene;
}

let loader: () => Promise<THREE.Object3D> = drCarDefaultLoader;
let cache: Promise<THREE.Object3D | null> | null = null;
let sources = new WeakMap<THREE.Object3D, DrSource>();
let gen = 0;

/* Nạp mô hình xe. Không bao giờ ném / từ chối: lỗi hoặc quá model.timeoutMs → warn một lần, null */
export function drCarLoad(): Promise<THREE.Object3D | null> {
  if (cache) return cache;
  const work = (async () => {
    const scene = await loader();
    const src = drCarSource(scene);
    sources.set(scene, src);
    await drCarWarm(scene);
    return scene as THREE.Object3D | null;
  })();
  let timer = 0;
  const p = Promise.race([work, new Promise<null>((r) => { timer = setTimeout(() => r(null), M.timeoutMs) as unknown as number; })])
    .catch((e) => { console.warn('Lái xe: không nạp được mô hình xe, dùng hình tạm', e); return null; })
    .finally(() => clearTimeout(timer));
  work.catch(() => { /* lỗi đã xử lý ở nhánh race; chặn cảnh báo promise bị bỏ */ });
  cache = p;
  return p;
}

/* Cho test: thay bộ nạp (null: mặc định), xóa đệm, bỏ bánh dùng chung */
export function drCarSetLoader(fn: (() => Promise<THREE.Object3D>) | null): void {
  loader = fn || drCarDefaultLoader; cache = null; sources = new WeakMap(); gen++;
  drWheels.reset();
}

/* ===== Bánh dùng chung: mỗi vật liệu một InstancedMesh, CAP chỗ ===== */
const A = new THREE.Matrix4(), B = new THREE.Matrix4(), Q = new THREE.Quaternion(), Q2 = new THREE.Quaternion(), UNIT = new THREE.Vector3(1, 1, 1), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const AXY = new THREE.Vector3(0, 1, 0), AXZ = new THREE.Vector3(0, 0, 1);

class DrWheelPool {
  readonly group = new THREE.Group();
  meshes: THREE.InstancedMesh[] = [];
  private src: DrSource | null = null;
  private used: boolean[] = new Array(CAP / 4).fill(false);
  constructor() { this.group.name = 'drive-wheels'; this.group.visible = false; }
  /* Dựng 3 InstancedMesh từ lưới bánh của nguồn (một lần cho mỗi nguồn) */
  setup(src: DrSource): void {
    if (this.src === src) return;
    this.reset();
    this.src = src;
    for (const m of src.wheelMeshes) {
      const im = new THREE.InstancedMesh(m.geometry, m.material, CAP);
      im.name = 'drive-wheels-' + (Array.isArray(m.material) ? '' : m.material.name);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      for (let i = 0; i < CAP; i++) im.setMatrixAt(i, ZERO);
      im.count = 0; im.frustumCulled = false; im.castShadow = false; im.receiveShadow = false; im.layers.set(1);
      this.meshes.push(im); this.group.add(im);
    }
  }
  /* Chỗ trống đầu tiên (chỉ số instance đầu của 4 bánh), -1 nếu hết */
  acquire(): number {
    const k = this.used.indexOf(false);
    if (k < 0) return -1;
    this.used[k] = true;
    this.group.visible = true;
    this.fit();
    return k * 4;
  }
  release(base: number): void {
    if (base < 0) return;
    this.used[base / 4] = false;
    for (const im of this.meshes) { for (let i = 0; i < 4; i++) im.setMatrixAt(base + i, ZERO); im.instanceMatrix.needsUpdate = true; }
    this.fit();
  }
  private fit(): void {
    const top = this.used.lastIndexOf(true);
    for (const im of this.meshes) im.count = (top + 1) * 4;
    this.group.visible = top >= 0;
  }
  /* Ma trận 4 bánh của xe có ma trận thế giới `car` */
  set(base: number, car: THREE.Matrix4, steer: number, wheel: number): void {
    const w = this.src!.wheels;
    for (let i = 0; i < 4; i++) {
      const d = w[i];
      Q.setFromAxisAngle(AXY, i < 2 ? steer : 0).multiply(d.quat).multiply(Q2.setFromAxisAngle(AXZ, d.sign * wheel));   // lái (chỉ bánh trước), xoay nghỉ của nút, rồi lăn quanh Z cục bộ
      A.compose(d.pos, Q, UNIT);
      B.multiplyMatrices(car, A);
      for (const im of this.meshes) im.setMatrixAt(base + i, B);
    }
    for (const im of this.meshes) im.instanceMatrix.needsUpdate = true;
  }
  reset(): void {
    for (const im of this.meshes) { this.group.remove(im); im.dispose(); }
    this.meshes = []; this.src = null; this.used.fill(false); this.group.visible = false;
  }
}
const B3 = new THREE.Quaternion();
export const drWheels = new DrWheelPool();

/* ===== Hình tạm và tấm bóng dùng chung ===== */
let tempMat: THREE.MeshStandardMaterial | null = null, shadowMat: THREE.MeshBasicMaterial | null = null, shadowGeo: THREE.PlaneGeometry | null = null, shadowTex: THREE.DataTexture | null = null;

function drTempGeometry(color: string): THREE.BufferGeometry {
  const L = CAR.length, W = CAR.width, H = CAR.height - CAR.clearance, r = CAR.wheelDia / 2, ww = M.temp.wheelWidth;
  const col = new THREE.Color(color), dark = new THREE.Color(0x15151a);
  const paint = (g: THREE.BufferGeometry, c: THREE.Color): THREE.BufferGeometry => {
    const n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    return g;
  };
  const parts: THREE.BufferGeometry[] = [paint(new RoundedBoxGeometry(L, H, W, 2, 0.12).translate(0, CAR.clearance + H / 2, 0), col)];
  const ax = CAR.wheelbase / 2, az = W / 2 - ww / 2;
  for (const sx of [1, -1]) for (const sz of [1, -1]) {
    parts.push(paint(new THREE.CylinderGeometry(r, r, ww, 12).rotateX(Math.PI / 2).translate(sx * ax, r, sz * az), dark));
  }
  const g = mergeGeometries(parts.map((p) => p.index ? p.toNonIndexed() : p))!;   // 1 Mesh gộp
  for (const p of parts) p.dispose();
  return g;
}

function drShadowShared(): void {
  if (shadowMat) return;
  const n = 32, d = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const u = (x + 0.5) / n * 2 - 1, v = (y + 0.5) / n * 2 - 1;
    const e = Math.max(Math.abs(u), Math.abs(v)), a = e >= 1 ? 0 : 1 - e * e * e * e;   // mép mềm hình vuông bo
    d[(y * n + x) * 4 + 3] = Math.round(255 * a);
  }
  shadowTex = new THREE.DataTexture(d, n, n, THREE.RGBAFormat); shadowTex.needsUpdate = true;
  shadowTex.magFilter = shadowTex.minFilter = THREE.LinearFilter;
  shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, map: shadowTex, transparent: true, opacity: M.shadow.opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, fog: false });
  shadowMat.name = 'driveShadow';
  shadowGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
}
function drTempMaterial(): THREE.MeshStandardMaterial {
  if (!tempMat) { tempMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.1 }); tempMat.name = 'driveTemp'; }
  return tempMat;
}
/* Giải phóng vật liệu / bánh dùng chung (rời chế độ hẳn) */
export function drCarDisposeShared(): void {
  drWheels.reset();
  tempMat?.dispose(); tempMat = null;
  shadowMat?.dispose(); shadowGeo?.dispose(); shadowTex?.dispose(); shadowMat = null; shadowGeo = null; shadowTex = null;
}

/* ===== Một xe ===== */
export class DrCar {
  readonly group = new THREE.Group();
  private readonly color: string;
  private temp: THREE.Mesh | null;
  private tempGeo: THREE.BufferGeometry | null;
  private shadow: THREE.Mesh;
  private body: THREE.Object3D | null = null;
  private paint: THREE.MeshStandardMaterial | null = null;
  private tailMeshes: THREE.Mesh[] = [];
  private src: DrSource | null = null;
  private slot = -1;
  private disposed = false;
  private brakingNow = false;
  private last: DrPlace | null = null;

  constructor(color: string) {
    this.color = color;
    this.group.name = 'drive-car';
    this.group.matrixAutoUpdate = true;
    this.tempGeo = drTempGeometry(color);
    this.temp = new THREE.Mesh(this.tempGeo, drTempMaterial());
    this.temp.layers.set(1); this.temp.castShadow = false; this.temp.receiveShadow = false;
    this.group.add(this.temp);
    drShadowShared();
    this.shadow = new THREE.Mesh(shadowGeo!, shadowMat!);
    this.shadow.scale.set(CAR.length + 2 * M.shadow.pad, 1, CAR.width + 2 * M.shadow.pad);
    this.shadow.position.y = M.shadow.lift;
    this.shadow.layers.set(1); this.shadow.castShadow = false; this.shadow.receiveShadow = false; this.shadow.renderOrder = 1;
    this.group.add(this.shadow);
    drCarLoad().then((scene) => { if (scene && !this.disposed) this.swap(sources.get(scene)!); }, () => { /* drCarLoad không từ chối */ });
  }

  get real(): boolean { return this.body !== null; }

  /* Đổi hình tạm sang bản sao mô hình thật, giữ nguyên vị trí */
  private swap(src: DrSource): void {
    if (this.body) return;
    drWheels.setup(src);
    this.slot = drWheels.acquire();
    this.src = src;
    const body = src.body.clone();
    this.paint = src.paint.clone();
    this.paint.color.set(this.color); this.paint.roughness = M.paintRough; this.paint.metalness = M.paintMetal;
    body.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = m.material as THREE.Material;
      if (mat.name === 'paint') m.material = this.paint!;
      else if (mat === src.tail) this.tailMeshes.push(m);
    });
    this.body = body;
    this.group.add(body);
    if (this.temp) { this.group.remove(this.temp); this.temp = null; this.tempGeo!.dispose(); this.tempGeo = null; }
    this.brakingNow = false;
    if (this.last) this.place(this.last);
  }

  place(p: DrPlace): void {
    const l = this.last || (this.last = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, steer: 0, wheel: 0, braking: false });
    l.x = p.x; l.y = p.y; l.z = p.z; l.yaw = p.yaw; l.pitch = p.pitch; l.steer = p.steer; l.wheel = p.wheel; l.braking = p.braking;
    const g = this.group;
    g.position.set(p.x, p.y, p.z);
    g.quaternion.setFromAxisAngle(AXY, p.yaw).multiply(B3.setFromAxisAngle(AXZ, p.pitch));
    if (!this.body) return;
    if (p.braking !== this.brakingNow) {
      this.brakingNow = p.braking;
      const mat = p.braking ? this.src!.tailBrake : this.src!.tail;
      for (const m of this.tailMeshes) m.material = mat;
    }
    if (this.slot >= 0) { g.updateMatrix(); drWheels.set(this.slot, g.matrix, p.steer, p.wheel); }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.group.removeFromParent();
    drWheels.release(this.slot); this.slot = -1;
    this.tempGeo?.dispose(); this.tempGeo = null;
    this.paint?.dispose(); this.paint = null;
    this.body = null; this.temp = null; this.tailMeshes.length = 0;
  }
}

