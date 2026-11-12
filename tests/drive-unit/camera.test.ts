/* ===== Lái xe: camera sau xe (src/explore/drive/camera.ts) =====
   Đặt sau xe đúng khoảng cách, vướng tường thì kéo gần (không dưới cam.minDist), tự về sau returnAfter giây, trong hầm thấp hơn trần. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CONFIG } from '../../src/config.ts';
import { HR, hrRoadY } from '../../src/bridges/han-tunnel/profile.ts';
import { drMakeNet, type DrPad, type DrSolid } from '../../src/explore/drive/net.ts';
import { drBuildPads } from '../../src/explore/drive/roadData.ts';
import { drBuildSolids } from '../../src/explore/drive/solids.ts';
import { drCamPlace, drCamDrag, type DrCam } from '../../src/explore/drive/camera.ts';
import type { DrState } from '../../src/explore/drive/motion.ts';

const K = CONFIG.drive.cam;
const flatPad = (x0: number, x1: number, z0: number, z1: number, y = 2.6): DrPad => ({ id: 'a', kind: 'road', x0, x1, z0, z1, y: () => y });
const state = (x: number, z: number, yaw = 0, y = 2.6): DrState => ({ x, y, z, yaw, pitch: 0, v: 0, steer: 0, wheel: 0, braking: false, evac: 0, slide: 1, touch: 0 });
const cam = (): DrCam => ({ yaw: 0, pitch: 0, idle: 0 });
const wall = (x0: number, x1: number): DrSolid => ({ kind: 'rect', x0, x1, z0: -20, z1: 20, y0: 0, y1: 20 });
const hdist = (c: THREE.PerspectiveCamera, s: DrState) => Math.hypot(c.position.x - s.x, c.position.z - s.z);

test('đặt sau xe đúng khoảng cách', () => {
  const net = drMakeNet([flatPad(-100, 100, -100, 100)], []), c = new THREE.PerspectiveCamera();
  const s = state(0, 0, 0);
  drCamPlace(c, s, cam(), net, 0, true);
  assert.ok(Math.abs(c.position.x + K.dist) < 1e-6, `x ${c.position.x}`);
  assert.ok(Math.abs(c.position.z) < 1e-6);
  assert.ok(Math.abs(c.position.y - (2.6 + K.height)) < 1e-6, `y ${c.position.y}`);
  /* xe quay mũi về −Z (yaw π/2): camera ở phía +Z */
  const s2 = state(10, 5, Math.PI / 2);
  drCamPlace(c, s2, cam(), net, 0, true);
  assert.ok(Math.abs(c.position.x - 10) < 1e-6 && Math.abs(c.position.z - (5 + K.dist)) < 1e-6, `${c.position.x}, ${c.position.z}`);
  /* nhìn về phía trước xe: hướng nhìn có thành phần −Z */
  const d = new THREE.Vector3(); c.getWorldDirection(d);
  assert.ok(d.z < -0.9, `hướng nhìn ${d.z}`);
});

test('lùi xe thì camera không quay ra trước', () => {
  const net = drMakeNet([flatPad(-100, 100, -100, 100)], []), c = new THREE.PerspectiveCamera(), cc = cam();
  const s = state(0, 0, 0);
  drCamPlace(c, s, cc, net, 0, true);
  for (let i = 0; i < 120; i++) { s.x -= 0.05; s.v = -3; drCamPlace(c, s, cc, net, 1 / 60); }
  assert.ok(c.position.x < s.x - K.dist + 0.01, `camera ${c.position.x}, xe ${s.x}`);
});

test('vướng tường thì kéo gần, không dưới 2,5 m', () => {
  const c = new THREE.PerspectiveCamera(), s = state(0, 0, 0);
  const far = drMakeNet([flatPad(-100, 100, -100, 100)], [wall(-5, -4.5)]);
  drCamPlace(c, s, cam(), far, 0, true);
  const d1 = hdist(c, s);
  assert.ok(d1 < 4.5 && d1 >= K.minDist - 1e-9, `tường cách 4,5 m: camera cách ${d1}`);
  const near = drMakeNet([flatPad(-100, 100, -100, 100)], [wall(-1.6, -1.2)]);
  drCamPlace(c, s, cam(), near, 0, true);
  const d2 = hdist(c, s);
  assert.ok(Math.abs(d2 - K.minDist) < 1e-6, `tường cách 1,2 m: camera cách ${d2}`);
  assert.equal(K.minDist, 2.5);
  /* hết vướng thì nở ra dần, không giật */
  const open = drMakeNet([flatPad(-100, 100, -100, 100)], []);
  drCamPlace(c, s, cam(), open, 1 / 60);
  const d3 = hdist(c, s);
  assert.ok(d3 > d2 && d3 < K.dist - 1, `khung đầu sau khi hết vướng: ${d3}`);
});

test('sau returnAfter giây thì lệch về 0', () => {
  const net = drMakeNet([flatPad(-100, 100, -100, 100)], []), c = new THREE.PerspectiveCamera(), s = state(0, 0, 0);
  const cc = cam();
  drCamDrag(cc, -200, 60);
  assert.ok(cc.yaw > 0.5 && cc.pitch > 0.2, `kéo: yaw ${cc.yaw}, pitch ${cc.pitch}`);
  assert.equal(cc.idle, 0);
  const y0 = cc.yaw, p0 = cc.pitch, dt = 0.05;
  drCamPlace(c, s, cc, net, 0, true);
  for (let t = 0; t < K.returnAfter - 0.2; t += dt) drCamPlace(c, s, cc, net, dt);
  assert.equal(cc.yaw, y0); assert.equal(cc.pitch, p0);
  for (let t = 0; t < 5; t += dt) drCamPlace(c, s, cc, net, dt);
  assert.ok(Math.abs(cc.yaw) < 0.01 && Math.abs(cc.pitch) < 0.01, `sau 5 s: yaw ${cc.yaw}, pitch ${cc.pitch}`);
  /* pitch kẹp trong [pitchMin, pitchMax] */
  drCamDrag(cc, 0, 1e6); assert.equal(cc.pitch, K.pitchMax);
  drCamDrag(cc, 0, -1e6); assert.equal(cc.pitch, K.pitchMin);
});

test('trong ô tunnel camera thấp hơn trần hầm', () => {
  const net = drMakeNet(drBuildPads(), drBuildSolids()), c = new THREE.PerspectiveCamera();
  for (const x of [0, -300, 450]) for (const side of [-1, 1]) for (const pitch of [0, K.pitchMax]) {
    const s = state(x, HR.z + side * HR.tubeCenter, side < 0 ? 0 : Math.PI, hrRoadY(x));
    const cc = cam(); cc.pitch = pitch;
    drCamPlace(c, s, cc, net, 0, true);
    for (let i = 0; i < 60; i++) drCamPlace(c, s, cc, net, 1 / 60);
    const roof = hrRoadY(c.position.x) + HR.clear;
    assert.ok(c.position.y < roof, `x ${x}, ống ${side}, pitch ${pitch}: camera y ${c.position.y.toFixed(2)} ≥ trần ${roof.toFixed(2)}`);
    assert.ok(c.position.y > hrRoadY(c.position.x), 'camera trên mặt đường');
    assert.ok(hdist(c, s) <= K.tunnelDist + 1e-6, `camera áp sát xe: ${hdist(c, s)}`);
  }
});
