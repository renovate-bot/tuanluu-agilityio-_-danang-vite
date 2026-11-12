/* ===== Lái xe nhiều người: bộ quản lý xe (drCars) và xe của người lái cùng (exDrivers) =====
   Node, không GPU, như car.test.ts: bộ nạp giả trả cảnh dựng tay cùng cấu trúc vf3.glb. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CONFIG } from '../../src/config.ts';
import { drCarSetLoader, drWheels } from '../../src/explore/drive/car.ts';
import { drCars } from '../../src/explore/drive/cars.ts';
import { exDrivers } from '../../src/explore/multi/remoteDrive.ts';
import { multiParams as P } from '../../src/explore/multi/params.ts';

const R = CONFIG.drive.car.wheelDia / 2, DELAY = P.interpSends * 1000 / P.sendHz;
const mat = (name: string): THREE.MeshStandardMaterial => { const m = new THREE.MeshStandardMaterial(); m.name = name; return m; };

/* Cảnh giả giống vf3.glb (như car.test.ts) */
function fakeScene(): THREE.Object3D {
  const root = new THREE.Group(); root.name = 'vf3';
  const body = new THREE.Group(); body.name = 'body';
  const map = new THREE.DataTexture(new Uint8Array([255, 0, 0, 255]), 1, 1);
  for (const n of ['lamp_head', 'paint', 'DEN_NHAM', 'Material.002', 'lamp_tail']) { const m = mat(n); if (n === 'lamp_tail') m.map = map; body.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), m)); }
  root.add(body);
  const wm = ['BANH', 'DEN_NHAM', 'Material.003'].map((n) => mat(n));
  const wg = new THREE.CylinderGeometry(R, R, 0.2, 12).rotateX(Math.PI / 2);
  for (const [n, x, z, flip] of [['wheel_fl', 1.097, -0.869, false], ['wheel_fr', 1.097, 0.869, true], ['wheel_rl', -1.097, -0.869, false], ['wheel_rr', -1.097, 0.869, true]] as [string, number, number, boolean][]) {
    const w = new THREE.Group(); w.name = n; w.position.set(x, 0.344, z);
    if (flip) w.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
    wm.forEach((m) => w.add(new THREE.Mesh(wg, m)));
    root.add(w);
  }
  return root;
}
const tick = () => new Promise((r) => setTimeout(r, 0));
const carNodes = () => drCars.group.children.filter((c) => c.name === 'drive-car');
function fresh(): void { exDrivers.clear(); drCars.clear(); drCarSetLoader(async () => fakeScene()); exDrivers.onCars = () => {}; }

/* Đèn phanh của xe (nút đầu tiên): vật liệu đèn hậu bản phanh có userData.lampBrake > 1 (car.ts drLampPatch). Chỉ có khi xe đã đổi sang mô hình thật */
function braking(g: THREE.Object3D): boolean {
  let b = false;
  g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.material && ((m.material as THREE.Material).userData.lampBrake ?? 0) > 1) b = true; });
  return b;
}

/* Xe người khác chạy thẳng +X với v cố định: gói d = [slot, x, y, z, yaw, v, st, giờ gửi] mỗi 200 ms */
function pk(slot: number, v: number, t0: number, n: number, y = 2.6, st = 0): number[][] {
  return Array.from({ length: n }, (_, k) => { const ts = t0 + k * 1000 / P.sendHz; return [slot, 100 + v * ts / 1000, y, 5, 0, v, st, ts]; });
}

/* Phát lại các gói theo đồng hồ khách: gói tới lúc ts + trễ, mỗi khung (dt ms) gọi exDrivers.update rồi cb(t); vòng đệm chỉ giữ 8 mẫu nên không nạp trước */
function play(pkts: number[][], lag: number, from: number, to: number, dt: number, cb: (t: number) => void = () => {}): void {
  let i = 0;
  for (let t = from; t <= to; t += dt) {
    while (i < pkts.length && pkts[i][7] + lag <= t) { exDrivers.onPos([pkts[i]], pkts[i][7] + lag); i++; }
    exDrivers.update(t, dt / 1000);
    cb(t);
  }
}

test('drCars: count / show / remove theo slot; sync thêm và bớt xe theo danh sách slot', () => {
  fresh();
  assert.equal(drCars.count, 0);
  drCars.sync([{ slot: 1 }, { slot: 3 }]);
  assert.equal(drCars.count, 2); assert.equal(carNodes().length, 2);
  drCars.show(3, false);
  assert.equal(carNodes().filter((c) => !c.visible).length, 1, 'xe slot 3 ẩn');
  drCars.show(3, true);
  drCars.remove(1);
  assert.equal(drCars.count, 1);
  drCars.sync([{ slot: 3 }, { slot: 4 }, { slot: 0 }]);
  assert.equal(drCars.count, 3);
  drCars.sync([]);
  assert.equal(drCars.count, 0); assert.equal(carNodes().length, 0);
});

test('thêm xe rồi bớt hết thì group không còn xe nào, callback onCars(0) gỡ group khỏi cảnh', () => {
  fresh();
  const seen: number[] = []; exDrivers.onCars = (n) => seen.push(n);
  exDrivers.sync([{ slot: 1, name: 'An' }, { slot: 2, name: 'Binh' }], -1);
  assert.equal(carNodes().length, 2); assert.equal(seen[seen.length - 1], 2);
  exDrivers.sync([], -1);
  assert.equal(carNodes().length, 0, 'không còn con nào mang tên drive-car');
  assert.equal(drCars.count, 0);
  assert.equal(seen[seen.length - 1], 0, 'onCars(0) để gỡ group khỏi cảnh');
  assert.deepEqual(drCars.group.children.map((c) => c.name), ['drive-wheels']);
});

test('gói ngừng tới: v dùng quay bánh về 0 khi mẫu cuối cũ hơn staleMs (xe đứng, bánh thôi quay)', () => {
  fresh();
  exDrivers.sync([{ slot: 2, name: 'Binh' }], -1);
  play(pk(2, 20, 0, 8), 0, 600, 1400, 50);
  assert.ok(Math.abs(exDrivers.slotState(2)!.v - 20) < 1e-9, 'còn gói tới thì v giữ nguyên');
  const last = 7 * 1000 / P.sendHz, S = CONFIG.drive.remote.staleMs;
  exDrivers.update(last + S - 50, 0.05);
  assert.ok(Math.abs(exDrivers.slotState(2)!.v - 20) < 1e-9, 'chưa quá staleMs thì chưa đổi');
  exDrivers.update(last + S + 50, 0.05);
  assert.equal(exDrivers.slotState(2)!.v, 0, 'quá staleMs: v về 0');
});

test('exDrivers.sync: dựng xe theo danh sách trừ slot của mình, báo số xe qua onCars; trống thì 0', () => {
  fresh();
  const seen: number[] = []; exDrivers.onCars = (n) => seen.push(n);
  exDrivers.sync([{ slot: 0, name: 'An' }, { slot: 2, name: 'Binh' }], 0);   // mình ở slot 0: chỉ có xe của Binh
  assert.equal(drCars.count, 1);
  assert.equal(exDrivers.name(2), 'Binh'); assert.equal(exDrivers.name(0), null);
  exDrivers.setSelf(0);                                                       // thêm xe của mình
  assert.equal(drCars.count, 2);
  exDrivers.sync([{ slot: 0, name: 'An' }], 0);
  assert.equal(drCars.count, 1, 'Binh rời: còn xe của mình');
  exDrivers.setSelf(-1);
  assert.equal(drCars.count, 0);
  assert.equal(seen[seen.length - 1], 0, 'onCars(0) khi hết xe để gỡ group khỏi cảnh');
  assert.ok(seen.includes(2));
});

test('xe người khác: ẩn tới khi có mẫu, rồi nội suy vị trí và tốc độ theo giờ gửi', () => {
  fresh();
  exDrivers.sync([{ slot: 2, name: 'Binh' }], -1);
  exDrivers.update(1000, 0.016);
  assert.equal(exDrivers.slotState(2), null, 'chưa có mẫu thì chưa hiện');
  assert.equal(carNodes()[0].visible, false);
  const V = 20;
  let shown = 0;
  play(pk(2, V, 0, 12), 30, 800, 2400, 50, (t) => {
    const s = exDrivers.slotState(2);
    if (!s) return;
    shown++;
    assert.equal(carNodes()[0].visible, true);
    assert.ok(Math.abs(s.x - (100 + V * (t - DELAY - 30) / 1000)) < 0.6 + V * 0.05, `x nội suy ${s.x} tại ${t}`);
    assert.ok(Math.abs(s.v - V) < 1e-9);
  });
  assert.ok(shown > 20);
  assert.ok(Math.abs(carNodes()[0].position.y - 2.6) < 1e-6);
});

test('đèn phanh: |v| giảm nhanh hơn brakeDecel thì sáng, nhả ga (giảm chậm) thì không', async () => {
  const run = async (decel: number): Promise<boolean> => {
    fresh();
    await tick(); await tick();
    exDrivers.sync([{ slot: 1, name: 'Chi' }], -1);
    await tick(); await tick();   // xe đổi sang mô hình thật (có đèn hậu)
    let any = false;
    const pkts: number[][] = []; let x = 0;
    for (let k = 0; k < 12; k++) { const v = 20 - decel * (k * 0.2); x += v * 0.2; pkts.push([1, x, 2.6, 0, 0, v, 0, k * 200]); }
    play(pkts, 0, 600, 2000, 20, () => { if (exDrivers.slotState(1)) any = any || braking(carNodes()[0]); });
    return any;
  };
  assert.equal(await run(8), true, 'giảm 8 m/s²');
  assert.equal(await run(1.5), false, 'giảm 1,5 m/s² (nhả ga)');
});

test('xe người khác lên dốc: nghiêng mũi lên theo dốc 10 %', () => {
  fresh();
  exDrivers.sync([{ slot: 4, name: 'Dung' }], -1);
  const V = 15;
  play(Array.from({ length: 20 }, (_, k) => { const ts = k * 200, x = V * ts / 1000; return [4, x, 2.6 + 0.1 * x, 0, 0, V, 0, ts]; }), 0, 800, 3000, 20);
  const e = new THREE.Euler().setFromQuaternion(carNodes()[0].quaternion, 'YXZ');
  assert.ok(e.z > 0.07 && e.z < 0.13, `độ nghiêng ${e.z.toFixed(3)} rad (dốc 10 % ≈ 0,0997)`);
});

test('xe người khác đổi chủ slot: xe cũ gỡ, xe mới ẩn tới khi có mẫu đầu của nó', () => {
  fresh();
  exDrivers.sync([{ slot: 3, name: 'Em' }], -1);
  play(pk(3, 10, 0, 8), 0, 600, 1200, 50);
  assert.ok(exDrivers.slotState(3));
  exDrivers.sync([{ slot: 3, name: 'Gia' }], -1);
  assert.equal(exDrivers.slotState(3), null, 'chủ mới chưa có mẫu');
  assert.equal(carNodes().length, 1); assert.equal(carNodes()[0].visible, false);
});

test('gói của slot mình, slot trống hoặc ngoài khoảng bị bỏ; dots() chỉ có xe đã hiện, tái dùng mảng', () => {
  fresh();
  exDrivers.sync([{ slot: 0, name: 'Tui' }, { slot: 1, name: 'Ban' }], 0);
  exDrivers.onPos([[0, 1, 2, 3, 0, 5, 0, 100], [2, 1, 2, 3, 0, 5, 0, 100], [9, 1, 2, 3, 0, 5, 0, 100]], 130);
  for (let k = 0; k <= 6; k++) exDrivers.onPos([[1, 50 + k, 2.6, 7, 0, 5, 0, 100 + 200 * k]], 130 + 200 * k);
  exDrivers.update(1300, 0.02);
  const d = exDrivers.dots();
  assert.equal(d.length, 1);
  assert.equal(d[0].color, P.colors[1]);
  assert.equal(exDrivers.dots(), d, 'cùng một mảng');
  assert.equal(exDrivers.slotState(0), null);
});

test('dots(except): bỏ chấm của xe đang được xem (bản đồ nhỏ đã vẽ mũi tên cho xe đó)', () => {
  fresh();
  exDrivers.sync([{ slot: 1, name: 'Ban' }, { slot: 2, name: 'Chi' }], -1);
  play([...pk(1, 5, 0, 8), ...pk(2, 5, 0, 8)].sort((a, b) => a[7] - b[7]), 0, 600, 1400, 50);
  assert.equal(exDrivers.dots().length, 2);
  const w = exDrivers.slotState(1)!;
  const d = exDrivers.dots(w);
  assert.equal(d.length, 1);
  assert.equal(d[0].color, P.colors[2]);
});
