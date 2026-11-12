/* ===== Lái xe: test truy vấn xe tự động (src/common/trafficQuery.ts) =====
   Hai xe khu phố giả (trục X và trục Z, đặt ma trận đúng cách environment/traffic.ts updateTraffic làm), xe ẩn (scale 0, như vhHide),
   ngoài bán kính, nhóm cha đang ẩn, ma trận thế giới của nhóm cầu, mảng out tái dùng. Không cần cảnh. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CONFIG, type VehicleTypeId } from '../../src/config.ts';
import { trFleetSampler, trRegister, trNearby, type TrFleetSrc } from '../../src/common/trafficQuery.ts';
import type { DrBox } from '../../src/explore/drive/collide.ts';

const KINDS: VehicleTypeId[] = ['car', 'bus', 'bike'];          // thứ tự như common/vehicles/shapes.ts VEHICLE_TYPES
const T = CONFIG.vehicles.types;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), ONE = new THREE.Vector3(1, 1, 1), HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

/* Đội xe giả: mỗi xe [x, y, z, yaw, pitch, loại] hoặc null (ẩn) */
function fleet(cars: ([number, number, number, number, number, number] | null)[], world = new THREE.Matrix4()): TrFleetSrc & { visible: boolean } {
  const m = new Float32Array(cars.length * 16), type = new Float32Array(cars.length);
  cars.forEach((c, i) => {
    if (!c) { HIDDEN.toArray(m, i * 16); return; }
    _q.setFromEuler(_e.set(0, c[3], c[4], 'YZX'));
    _m.compose(new THREE.Vector3(c[0], c[1], c[2]), _q, ONE).toArray(m, i * 16);
    type[i] = c[5];
  });
  const src = { m, type, count: cars.length, world: world.elements, visible: true, shown: () => src.visible };
  return src;
}
const near = (a: number, b: number, eps = 1e-4) => Math.abs(a - b) <= eps;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

test('xe khu phố trục X và trục Z cho đúng tâm, hướng, cao độ', () => {
  /* như updateTraffic: trục X chiều −1 → yaw π, có dốc; trục Z (Bạch Đằng x = −299) chiều +1 → yaw −π/2, cao độ roadY + 0,03 */
  const y0 = CONFIG.roadY + 0.03;
  const src = fleet([[12, 5.4, -8.625, Math.PI, 0.05, 0], [-299 + 3.5, y0, 6, -Math.PI / 2, 0, 1]]);
  const out: DrBox[] = [], n = trFleetSampler(src, KINDS)(0, 0, 400, out, 0);
  assert.equal(n, 2);
  const [a, b] = out;
  assert.ok(near(a.x, 12) && near(a.z, -8.625) && near(a.y, 5.4), `xe trục X: ${JSON.stringify(a)}`);
  assert.ok(near(wrap(a.yaw - Math.PI), 0), `yaw trục X ${a.yaw}`);
  assert.ok(near(a.hl, T.car.len / 2) && near(a.hw, T.car.w / 2));
  assert.ok(near(b.x, -295.5) && near(b.z, 6) && near(b.y, y0), `xe trục Z: ${JSON.stringify(b)}`);
  /* quy ước hướng của chế độ lái: tiến = (cos yaw, −sin yaw); xe chiều +1 trên trục Z đi về +z */
  assert.ok(near(Math.cos(b.yaw), 0) && near(-Math.sin(b.yaw), 1), `yaw trục Z ${b.yaw}`);
  assert.ok(near(b.hl, T.bus.len / 2) && near(b.hw, T.bus.w / 2));
});

test('xe ẩn không có mặt', () => {
  const src = fleet([[0, 2.6, 5, 0, 0, 0], null, [3, 2.6, 5, 0, 0, 2]]);
  const out: DrBox[] = [];
  assert.equal(trFleetSampler(src, KINDS)(0, 0, 40, out, 0), 2, 'xe scale 0 (vhHide) bỏ');
  assert.ok(near(out[1].x, 3) && near(out[1].hl, T.bike.len / 2), 'xe máy sau xe ẩn');
  src.visible = false;                                         // nhóm cha đang ẩn (tắt "Xe cộ", ngoài tầm vẽ của hầm)
  assert.equal(trFleetSampler(src, KINDS)(0, 0, 40, out, 0), 0);
});

test('ngoài bán kính không có mặt', () => {
  const src = fleet([[39, 2.6, 0, 0, 0, 0], [0, 2.6, 41, 0, 0, 0], [30, 2.6, 30, 0, 0, 0]]);
  const out: DrBox[] = [];
  const n = trFleetSampler(src, KINDS)(0, 0, 40, out, 0);
  assert.equal(n, 1);
  assert.ok(near(out[0].x, 39));
});

test('nhóm cầu dời theo z: tọa độ thế giới; trNearby nối các nguồn, out tái dùng', () => {
  const world = new THREE.Matrix4().makeTranslation(0, 0, -1080);      // group Cầu sông Hàn
  const bridge = fleet([[10, 9.5, 2.775, 0, 0, 0]], world), city = fleet([[20, 2.6, -1075, Math.PI, 0, 1]]);
  trRegister(trFleetSampler(bridge, KINDS)); trRegister(trFleetSampler(city, KINDS));
  const out: DrBox[] = [];
  assert.equal(trNearby(0, -1080, 40, out), 2);
  assert.ok(near(out[0].x, 10) && near(out[0].z, -1077.225) && near(out[0].y, 9.5), `cầu: ${JSON.stringify(out[0])}`);
  assert.ok(near(out[1].z, -1075));
  const first = out[0];
  assert.equal(trNearby(0, -1080, 40, out), 2);
  assert.equal(out[0], first, 'đối tượng hộp được tái dùng');
  assert.equal(out.length, 2);
  assert.equal(trNearby(0, 0, 40, out), 0);
});
