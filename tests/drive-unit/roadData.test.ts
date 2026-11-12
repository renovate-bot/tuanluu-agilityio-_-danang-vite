/* ===== Lái xe: test dữ liệu mạng đường (src/explore/drive/roadData.ts) =====
   Mạng liền, tới được năm công trình (cả hai ống hầm), gầm Cầu Rồng đóng, đường ven sông chui dưới dốc Trần Thị Lý,
   dải giữa chặn trừ ở nút giao, hai đường dọc mới trong hành lang không nhà, ô cùng tầng không chồng nhau, chỗ xuất phát. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../src/config.ts';
import { deckY } from '../../src/bridges/dragon/profile.ts';
import { ttlRoadY } from '../../src/bridges/tran-thi-ly/profile.ts';
import { drMakeNet, drGround, drReach, type DrPad } from '../../src/explore/drive/net.ts';
import { DR_GATE_SWING, drBuildPads, drSpawnPose } from '../../src/explore/drive/roadData.ts';

const D = CONFIG.drive, R = D.roads;
const pads = drBuildPads();
const net = drMakeNet(pads, []);
const sp = drSpawnPose(0);
const reach = drReach(net, sp.x, sp.z, deckY(sp.x));
const reached = pads.filter((p) => reach.has(p.id));
const ROAD = CONFIG.roadY;

test('id ô là duy nhất, ô có diện tích, dưới 200 ô', () => {
  assert.equal(new Set(pads.map((p) => p.id)).size, pads.length);
  for (const p of pads) assert.ok(p.x1 > p.x0 && p.z1 > p.z0, p.id);
  assert.ok(pads.length < 200, `${pads.length} ô`);
});

test('mạng liền', () => {
  const miss = pads.filter((p) => !reach.has(p.id)).map((p) => p.id);
  assert.deepEqual(miss, []);
});

test('tới được từng công trình', () => {
  const near = (p: DrPad, z: number, tol: number) => p.z0 - tol <= z && p.z1 + tol >= z;
  for (const z of [0, CONFIG.songHan.z, CONFIG.tranThiLy.z, CONFIG.thuanPhuoc.z]) {           // mỗi cầu: ô cầu của cả hai chiều (tim cầu là dải giữa)
    for (const s of [-1, 1]) assert.ok(reached.some((p) => p.kind === 'bridge' && near(p, z + s * 4, 1)), `cầu z = ${z}, chiều ${s}`);
  }
  const HR = CONFIG.hanTunnel;
  for (const s of [-1, 1]) assert.ok(reached.some((p) => p.kind === 'tunnel' && near(p, HR.z + s * HR.tubeCenter, 0)), `ống hầm ${s}`);
  assert.ok(reached.some((p) => p.gate === DR_GATE_SWING), 'nhịp quay Cầu sông Hàn có cổng');
});

test('gầm Cầu Rồng đóng', () => {
  assert.ok(Number.isNaN(drGround(net, -305, 0, ROAD)));
  assert.ok(Number.isNaN(drGround(net, 293, 0, ROAD)));
  for (const x of [-305, -293, 293, 305]) for (const z of [-15, -8.5, 8.5, 15]) assert.ok(Number.isNaN(drGround(net, x, z, ROAD)), `(${x}, ${z})`);
});

test('đường ven sông không lên được dốc cầu', () => {
  assert.equal(drGround(net, -305, 1300, ROAD), ROAD);
  assert.ok(Math.abs(ttlRoadY(-305) - ROAD) > D.stepMax);
  const z = CONFIG.tranThiLy.z - 8;                                   // làn chiều Bắc trên cầu (tim cầu là dải giữa)
  assert.equal(drGround(net, -305, z, ROAD), ROAD);
  assert.ok(Math.abs(drGround(net, -305, z, ttlRoadY(-305)) - ttlRoadY(-305)) < 1e-9);       // tầng trên vẫn là mặt cầu
});

test('dải giữa chặn', () => {
  assert.ok(Number.isNaN(drGround(net, -299, -600, ROAD)));
  assert.ok(Number.isNaN(drGround(net, R.westX, -600, ROAD)));
  assert.ok(Number.isNaN(drGround(net, -600, 0, ROAD)));
  assert.equal(drGround(net, -299, CONFIG.songHan.z, ROAD), ROAD);    // nút giao Cầu sông Hàn
  assert.equal(drGround(net, R.westX, 0, ROAD), ROAD);                // nút giao đường dọc Tây – trục Cầu Rồng
  assert.equal(drGround(net, -340, 0, ROAD), ROAD);                   // chỗ đổi phía ngay ngoài chân Cầu Rồng
});

test('đường dọc mới nằm trong hành lang', () => {
  const H = R.half + R.median / 2;
  for (const [x, lo, hi] of [[R.westX, -1082.5, -1045.5], [R.eastX, 1077.5, 1114.5]]) {
    const on = pads.filter((p) => Math.abs((p.x0 + p.x1) / 2 - x) <= H && p.z1 >= -1800 && p.z0 <= 1800);
    assert.ok(on.length > 5, `x = ${x}`);
    for (const p of on) assert.ok(p.x0 >= lo && p.x1 <= hi, `${p.id} [${p.x0}; ${p.x1}]`);
  }
});

test('ô cùng tầng không chồng nhau', () => {
  for (let i = 0; i < pads.length; i++) for (let j = i + 1; j < pads.length; j++) {
    const a = pads[i], b = pads[j];
    const x0 = Math.max(a.x0, b.x0), x1 = Math.min(a.x1, b.x1), z0 = Math.max(a.z0, b.z0), z1 = Math.min(a.z1, b.z1);
    if (x1 - x0 <= 1e-6 || z1 - z0 <= 1e-6) continue;
    const x = (x0 + x1) / 2, z = (z0 + z1) / 2;
    assert.ok(Math.abs(a.y(x, z) - b.y(x, z)) > D.stepMax, `${a.id} chồng ${b.id}`);
  }
});

test('5 chỗ xuất phát không chồng nhau, đều có mặt đường', () => {
  const C = D.car, poses = [0, 1, 2, 3, 4].map((k) => drSpawnPose(k));
  for (const p of poses) {
    const y = deckY(p.x), fx = Math.cos(p.yaw), fz = -Math.sin(p.yaw);
    for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1], [0, 0]]) {
      const x = p.x + fx * a * C.length / 2 - fz * b * C.width / 2, z = p.z + fz * a * C.length / 2 + fx * b * C.width / 2;
      assert.ok(!Number.isNaN(drGround(net, x, z, y)), `slot (${p.x}, ${p.z}) góc ${a},${b}`);
    }
  }
  for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) {
    assert.ok(Math.hypot(poses[i].x - poses[j].x, poses[i].z - poses[j].z) >= C.length + 2, `${i}–${j}`);
  }
});
