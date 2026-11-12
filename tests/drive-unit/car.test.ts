/* ===== Lái xe: test hình xe (src/explore/drive/car.ts, cars.ts) =====
   Node, không GPU: bộ nạp giả (drCarSetLoader) trả cảnh dựng tay cùng cấu trúc vf3.glb (vf3 → body 5 lưới + 4 nút bánh, bánh phải xoay 180 độ quanh Y,
   lưới bánh 3 vật liệu). Mô hình thật chưa được nạp bằng GLTFLoader ở đây (xem tests/drive-unit/glb.test.ts cho dữ liệu glb). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CONFIG } from '../../src/config.ts';
import { DrCar, drCarLoad, drCarSetLoader, drCarSetWarm, drWheels } from '../../src/explore/drive/car.ts';
import { drCars } from '../../src/explore/drive/cars.ts';

const R = CONFIG.drive.car.wheelDia / 2;
const mat = (name: string, extra: Partial<THREE.MeshStandardMaterial> = {}): THREE.MeshStandardMaterial => { const m = new THREE.MeshStandardMaterial(); m.name = name; Object.assign(m, extra); return m; };

/* Cảnh giả giống vf3.glb */
function fakeScene(): THREE.Object3D {
  const root = new THREE.Group(); root.name = 'vf3';
  const body = new THREE.Group(); body.name = 'body';
  const map = new THREE.DataTexture(new Uint8Array([255, 0, 0, 255]), 1, 1);
  for (const n of ['lamp_head', 'paint', 'DEN_NHAM', 'Material.002', 'lamp_tail']) body.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat(n, n === 'lamp_tail' ? { map } : {})));
  root.add(body);
  const wm = ['BANH', 'DEN_NHAM', 'Material.003'].map((n) => mat(n));
  const wg = new THREE.CylinderGeometry(R, R, 0.2, 12).rotateX(Math.PI / 2);
  const P: [string, number, number, boolean][] = [['wheel_fl', 1.097, -0.869, false], ['wheel_fr', 1.097, 0.869, true], ['wheel_rl', -1.097, -0.869, false], ['wheel_rr', -1.097, 0.869, true]];
  for (const [n, x, z, flip] of P) {
    const w = new THREE.Group(); w.name = n; w.position.set(x, 0.344, z);
    if (flip) w.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
    wm.forEach((m) => w.add(new THREE.Mesh(wg, m)));
    root.add(w);
  }
  return root;
}
const tick = () => new Promise((r) => setTimeout(r, 0));
const place = (o: Partial<Parameters<DrCar['place']>[0]> = {}) => ({ x: 10, y: 2.6, z: 3, yaw: 0, pitch: 0, steer: 0, wheel: 0, braking: false, ...o });
const meshes = (o: THREE.Object3D): THREE.Mesh[] => { const a: THREE.Mesh[] = []; o.traverse((c) => { if ((c as THREE.Mesh).isMesh) a.push(c as THREE.Mesh); }); return a; };
const cars = () => drCars.group.children.filter((c) => c.name === 'drive-car').length;
function fresh(fn: (() => Promise<THREE.Object3D>) | null): void { drCars.clear(); drCarSetLoader(fn); }

test('có hình tạm ngay khi tạo: một Mesh gộp đúng cỡ + tấm bóng, chưa là mô hình thật', () => {
  fresh(() => new Promise(() => { /* không bao giờ xong */ }));
  const c = new DrCar('#ff0000');
  assert.equal(c.real, false);
  const ms = meshes(c.group);
  assert.equal(ms.length, 2, 'hình tạm 1 + bóng 1 = 2 lệnh vẽ');
  const s = new THREE.Box3().setFromObject(ms[0]).getSize(new THREE.Vector3());
  assert.ok(Math.abs(s.x - CONFIG.drive.car.length) < 0.01, `dài ${s.x}`);
  assert.ok(Math.abs(s.z - CONFIG.drive.car.width) < 0.01, `rộng ${s.z}`);
  assert.ok(Math.abs(s.y - CONFIG.drive.car.height) < 0.01, `cao ${s.y}`);
  assert.ok(ms[0].geometry.attributes.color, 'màu theo slot qua màu đỉnh');
  c.dispose();
});

test('tải xong thì đổi sang mô hình thật, vị trí giữ nguyên; trần lệnh vẽ', async () => {
  fresh(async () => fakeScene());
  const c = new DrCar('#00ff00');
  c.place(place({ x: 12, y: 3, z: -4, yaw: 0.7, pitch: 0.05 }));
  assert.equal(c.real, false);
  await tick(); await tick();
  assert.equal(c.real, true);
  assert.ok(Math.abs(c.group.position.x - 12) < 1e-9 && Math.abs(c.group.position.z + 4) < 1e-9 && Math.abs(c.group.position.y - 3) < 1e-9, 'vị trí giữ nguyên');
  const f = new THREE.Vector3(1, 0, 0).applyQuaternion(c.group.quaternion);
  assert.ok(Math.abs(f.x - Math.cos(0.7) * Math.cos(0.05)) < 1e-6 && Math.abs(f.z + Math.sin(0.7) * Math.cos(0.05)) < 1e-6, 'mũi theo yaw: (cos, −sin)');
  assert.equal(meshes(c.group).length, 6, 'thân 5 + bóng 1 = 6 lệnh vẽ mỗi xe');
  assert.equal(drWheels.meshes.length, 3, 'bánh: 3 InstancedMesh dùng chung');
  assert.equal(meshes(c.group).every((m) => m.layers.isEnabled(1) && !m.layers.isEnabled(0)), true, 'lớp 1: không vào phản chiếu');
  c.dispose();
});

test('tải lỗi hoặc quá giờ thì giữ hình tạm, không ném lỗi', async () => {
  const warn = console.warn; console.warn = () => {};
  try {
    fresh(() => Promise.reject(new Error('mạng')));
    const c = new DrCar('#fff');
    c.place(place());
    await tick(); await tick();
    assert.equal(c.real, false); assert.equal(meshes(c.group).length, 2);
    assert.equal(await drCarLoad(), null);
    c.dispose();
    fresh(async () => new THREE.Group());   // thiếu nút body
    assert.equal(await drCarLoad(), null);
    const old = CONFIG.drive.model.timeoutMs; CONFIG.drive.model.timeoutMs = 20;
    try { fresh(() => new Promise(() => {})); assert.equal(await drCarLoad(), null, 'quá giờ → null'); } finally { CONFIG.drive.model.timeoutMs = old; }
  } finally { console.warn = warn; }
});

test('làm nóng shader phủ thân, bánh instanced, hình tạm và tấm bóng', async () => {
  const seen: THREE.Object3D[] = [];
  drCarSetWarm(async (o) => { o.traverse((c) => seen.push(c)); });
  try {
    fresh(async () => fakeScene());
    const scene = await drCarLoad();
    const ims = seen.filter((o) => (o as THREE.InstancedMesh).isInstancedMesh) as THREE.InstancedMesh[];
    assert.deepEqual(ims.map((m) => (m.material as THREE.Material).name).sort(), ['BANH', 'DEN_NHAM', 'Material.003'], 'mỗi vật liệu bánh một InstancedMesh (biến thể USE_INSTANCING)');
    const names = new Set(seen.filter((o) => (o as THREE.Mesh).isMesh).map((o) => ((o as THREE.Mesh).material as THREE.Material).name));
    for (const n of ['paint', 'lamp_head', 'lamp_tail', 'driveTemp', 'driveShadow']) assert.ok(names.has(n), `có ${n}`);
    assert.equal(scene!.parent, null, 'cảnh nguồn trả về không còn cha');
  } finally { drCarSetWarm(null); }
});

test('tải xong muộn hơn timeoutMs: drCarLoad trả null nhưng xe đang có vẫn đổi sang mô hình thật', async () => {
  const warn = console.warn; console.warn = () => {};
  const old = CONFIG.drive.model.timeoutMs; CONFIG.drive.model.timeoutMs = 20;
  try {
    let done: (o: THREE.Object3D) => void = () => {};
    fresh(() => new Promise((r) => { done = r; }));
    const c = new DrCar('#123456');
    assert.equal(await drCarLoad(), null, 'quá giờ → null');
    assert.equal(c.real, false);
    done(fakeScene());
    await tick(); await tick(); await tick();
    assert.equal(c.real, true, 'tải xong muộn vẫn đổi');
    c.dispose();
  } finally { CONFIG.drive.model.timeoutMs = old; console.warn = warn; }
});

test('nạp một lần, nhớ đệm', async () => {
  let n = 0; fresh(async () => { n++; return fakeScene(); });
  const a = await drCarLoad(), b = await drCarLoad();
  assert.equal(a, b); assert.equal(n, 1);
});

/* Ma trận instance của bánh i (xe có chỗ base) trong lưới bánh đầu tiên */
const wheelM = (base: number, i: number): THREE.Matrix4 => { const m = new THREE.Matrix4(); drWheels.meshes[0].getMatrixAt(base + i, m); return m; };

test('bánh trước xoay theo steer, cả bốn bánh quay theo wheel, bánh phải lăn cùng chiều bánh trái', async () => {
  fresh(async () => fakeScene());
  const c = new DrCar('#00f');
  await tick(); await tick();
  const top = new THREE.Vector3(0, R, 0);
  const at = (steer: number, wheel: number) => { c.place(place({ x: 0, y: 0, z: 0, steer, wheel })); return [0, 1, 2, 3].map((i) => wheelM(0, i)); };
  // steer: trục bánh (cột Z) lệch sin(steer) ở bánh trước, thẳng ở bánh sau
  const st = at(0.3, 0);
  for (const i of [0, 1]) { const z = new THREE.Vector3().setFromMatrixColumn(st[i], 2); assert.ok(Math.abs(Math.abs(z.x) - Math.sin(0.3)) < 1e-6, `bánh trước ${i} lệch trục`); }
  for (const i of [2, 3]) { const z = new THREE.Vector3().setFromMatrixColumn(st[i], 2); assert.ok(Math.abs(z.x) < 1e-6, `bánh sau ${i} thẳng`); }
  // hướng lăn của bánh trái (cột X) và bánh phải (−cột X) trùng nhau, rẽ trái = cùng chiều yaw (z âm khi x dương)
  const dirL = new THREE.Vector3().setFromMatrixColumn(st[0], 0), dirR = new THREE.Vector3().setFromMatrixColumn(st[1], 0).negate();
  assert.ok(dirL.distanceTo(dirR) < 1e-6, 'hai bánh trước cùng hướng lăn');
  assert.ok(Math.abs(dirL.z + Math.sin(0.3)) < 1e-6, 'steer > 0 là rẽ trái');
  // wheel tăng: đỉnh bánh đi về +X ở CẢ BỐN bánh
  const a = at(0, 0), b = at(0, 0.1);
  for (let i = 0; i < 4; i++) {
    const p0 = top.clone().applyMatrix4(a[i]), p1 = top.clone().applyMatrix4(b[i]);
    assert.ok(p1.x - p0.x > 0.5 * R * 0.1, `bánh ${i}: đỉnh phải đi về +X (dx = ${p1.x - p0.x})`);
  }
  const full = at(0, 2 * Math.PI);   // một vòng trả về chỗ cũ
  for (let i = 0; i < 4; i++) assert.ok(top.clone().applyMatrix4(full[i]).distanceTo(top.clone().applyMatrix4(a[i])) < 1e-6);
  c.dispose();
});

test('bánh theo xe: yaw của xe nhân vào, bánh ra khỏi cảnh khi xe gỡ', async () => {
  fresh(async () => fakeScene());
  const c = new DrCar('#fff'); await tick(); await tick();
  c.place(place({ x: 5, y: 1, z: 2, yaw: Math.PI / 2 }));
  const p = new THREE.Vector3().setFromMatrixPosition(wheelM(0, 0));   // bánh trái trước (1,097; 0,344; −0,869) xoay 90 độ quanh Y
  assert.ok(Math.abs(p.x - (5 - 0.869)) < 0.01 && Math.abs(p.z - (2 - 1.097)) < 0.01 && Math.abs(p.y - 1.344) < 0.01, `vị trí bánh ${p.toArray()}`);
  assert.equal(drWheels.group.visible, true);
  assert.equal(drWheels.meshes[0].count, 4);
  c.dispose();
  assert.equal(drWheels.group.visible, false, 'hết xe thì bánh không vẽ');
  assert.equal(drWheels.meshes[0].count, 0);
});

test('màu sơn theo slot, hai xe hai màu, vật liệu đèn dùng chung', async () => {
  fresh(async () => fakeScene());
  const a = new DrCar('#ff0000'), b = new DrCar('#0000ff');
  await tick(); await tick();
  const by = (c: DrCar, n: string) => meshes(c.group).find((m) => (m.material as THREE.Material).name === n)!;
  const pa = by(a, 'paint').material as THREE.MeshStandardMaterial, pb = by(b, 'paint').material as THREE.MeshStandardMaterial;
  assert.notEqual(pa, pb); assert.equal(pa.color.getHexString(), 'ff0000'); assert.equal(pb.color.getHexString(), '0000ff');
  assert.equal(pa.roughness, CONFIG.drive.model.paintRough);
  assert.equal(by(a, 'lamp_head').material, by(b, 'lamp_head').material, 'đèn pha chung vật liệu');
  assert.equal(by(a, 'lamp_tail').material, by(b, 'lamp_tail').material, 'đèn hậu chung vật liệu');
  assert.equal(by(a, 'DEN_NHAM').material, by(b, 'DEN_NHAM').material);
  assert.equal(by(a, 'paint').geometry, by(b, 'paint').geometry, 'chung hình học');
  a.dispose(); b.dispose();
});

test('đang phanh thì đèn hậu dùng vật liệu sáng, nhả phanh thì về như cũ; cùng program', async () => {
  fresh(async () => fakeScene());
  const a = new DrCar('#f00'), b = new DrCar('#00f');
  await tick(); await tick();
  const tail = (c: DrCar) => meshes(c.group).find((m) => m.material !== undefined && /lamp_tail/.test((m.material as THREE.Material).name))!;
  const m0 = tail(a).material as THREE.Material;
  a.place(place({ braking: true }));
  const mb = tail(a).material as THREE.Material;
  assert.notEqual(mb, m0); assert.equal(mb.userData.lampBrake, CONFIG.drive.model.tailBrake); assert.equal(m0.userData.lampBrake, 0);
  assert.equal(mb.customProgramCacheKey(), m0.customProgramCacheKey(), 'không đổi khóa program lúc chạy');
  assert.equal(tail(b).material, m0, 'xe kia vẫn đèn thường');
  a.place(place({ braking: false }));
  assert.equal(tail(a).material, m0);
  a.dispose(); b.dispose();
});

test('drCars: sync tạo / gỡ theo slot, pos, clear', async () => {
  fresh(async () => fakeScene());
  drCars.sync([{ slot: 0 }, { slot: 2 }]);
  assert.equal(cars(), 2);
  drCars.place(2, place({ x: 7, z: 9 }));
  const v = new THREE.Vector3();
  assert.equal(drCars.pos(2, v), true); assert.equal(v.x, 7); assert.equal(v.z, 9);
  assert.equal(drCars.pos(1, v), false);
  drCars.sync([{ slot: 2 }]);
  assert.equal(drCars.pos(0, v), false); assert.equal(cars(), 1);
  await tick(); await tick();
  drCars.clear();
  assert.equal(drCars.pos(2, v), false);
  assert.equal(cars(), 0);
  assert.equal(drWheels.group.visible, false);
});

test('5 xe: 6 lệnh vẽ mỗi xe cộng 3 lệnh bánh chung', async () => {
  fresh(async () => fakeScene());
  drCars.sync([0, 1, 2, 3, 4].map((slot) => ({ slot })));
  await tick(); await tick();
  assert.equal(meshes(drCars.group).length, 5 * 6 + 3, '33 lệnh vẽ cho 5 xe');
  assert.equal(drWheels.meshes[0].count, 20);
  drCars.clear();
});

/* Sửa cuối D-034 (review mục E): đèn phanh ban đêm hồng nhạt vì emissive trắng nhân ảnh dán nhạt ⇒ nhuộm đỏ (model.tailTint), hệ số phanh vượt ngưỡng bloom;
   kính Material.002 nhám 0 cho điểm chói trăng xanh sau kính hậu ⇒ model.glassRough. Màu thật vẫn phải xem bằng mắt */
test('đèn hậu phát sáng đỏ (cả bản phanh, chung program), kính có độ nhám theo CONFIG', async () => {
  fresh(async () => fakeScene());
  const c = new DrCar('#fff');
  await tick(); await tick();
  const ms = meshes(c.group), M = CONFIG.drive.model;
  const tail = ms.find((m) => (m.material as THREE.Material).name === 'lamp_tail')!.material as THREE.MeshStandardMaterial;
  assert.ok(tail.emissive.r > 4 * tail.emissive.g && tail.emissive.r > 4 * tail.emissive.b, `emissive đèn hậu phải đỏ: ${tail.emissive.getHexString()}`);
  assert.deepEqual(tail.emissive.toArray(), new THREE.Color(M.tailTint).toArray(), 'màu phát sáng lấy từ model.tailTint');
  c.place(place({ braking: true }));
  const brake = ms.find((m) => (m.material as THREE.Material).name === 'lamp_tail')!.material as THREE.MeshStandardMaterial;
  assert.notEqual(brake, tail);
  assert.ok(brake.emissive.equals(tail.emissive), 'bản phanh cùng màu phát sáng');
  assert.equal(brake.customProgramCacheKey(), tail.customProgramCacheKey(), 'không đổi khóa program lúc chạy');
  assert.ok(M.tailBrake >= 4, `hệ số phanh ${M.tailBrake} phải đủ lớn để vượt ngưỡng bloom`);
  const glass = ms.find((m) => (m.material as THREE.Material).name === 'Material.002')!.material as THREE.MeshStandardMaterial;
  assert.equal(glass.roughness, M.glassRough, 'kính Material.002 lấy độ nhám model.glassRough');
  assert.ok(M.glassRough > 0, 'kính không còn nhám 0 (điểm chói trăng)');
  c.dispose();
});
