// Hình học ba loại xe: siêu xe, buýt nhỏ, xe tay ga + người lái (spec G1–G4; plan Task 1)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CONFIG } from '../../src/config.ts';
import { VEHICLE_TYPES, Role, vhBuildTypeGeometry, vhBuildFleetGeometry, vhLoft, CAR_BODY } from '../../src/common/vehicles/shapes.ts';

const roles = (g: THREE.BufferGeometry) => Array.from(g.getAttribute('aRole').array as ArrayLike<number>);
const pos = (g: THREE.BufferGeometry) => g.getAttribute('position');

/* Duyệt từng tam giác theo index: pháp tuyến theo chiều quấn, tâm tam giác, pháp tuyến thuộc tính trung bình */
function triangles(g: THREE.BufferGeometry) {
  const p = pos(g), nAttr = g.getAttribute('normal'), idx = g.index!.array, out: { n: THREE.Vector3; c: THREE.Vector3; attr: THREE.Vector3 }[] = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < idx.length; i += 3) {
    a.fromBufferAttribute(p, idx[i]); b.fromBufferAttribute(p, idx[i + 1]); c.fromBufferAttribute(p, idx[i + 2]);
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    if (n.lengthSq() < 1e-12) continue;   // tam giác suy biến (không có)
    const attr = new THREE.Vector3();
    for (let k = 0; k < 3; k++) attr.add(new THREE.Vector3().fromBufferAttribute(nAttr, idx[i + k]));
    out.push({ n: n.normalize(), c: new THREE.Vector3().add(a).add(b).add(c).divideScalar(3), attr });
  }
  return out;
}

test('mỗi loại khớp kích thước config (sai số 6 %) và đứng trên mặt đường', () => {
  for (const t of VEHICLE_TYPES) {
    const g = vhBuildTypeGeometry(t); g.computeBoundingBox(); const b = g.boundingBox!, T = CONFIG.vehicles.types[t];
    assert.ok(Math.abs((b.max.x - b.min.x) / T.len - 1) < 0.06, `${t} dài ${b.max.x - b.min.x}`);
    assert.ok(Math.abs((b.max.z - b.min.z) / T.w - 1) < 0.12, `${t} rộng ${b.max.z - b.min.z}`);
    assert.ok(Math.abs(b.max.y / T.h - 1) < 0.06, `${t} cao ${b.max.y}`);
    assert.ok(Math.abs(b.min.y) < 0.02, `${t} chạm đường ${b.min.y}`);
    assert.ok(Math.abs(b.max.x + b.min.x) < 0.1 && Math.abs(b.max.z + b.min.z) < 0.02, `${t} tâm`);
  }
});

test('có index, đủ thuộc tính, không uv', () => {
  for (const t of VEHICLE_TYPES) {
    const g = vhBuildTypeGeometry(t);
    assert.ok(g.index, `${t} không có index`);
    for (const [a, size] of [['position', 3], ['normal', 3], ['color', 3], ['aRole', 1]] as const) assert.equal(g.getAttribute(a)?.itemSize, size, `${t} thiếu ${a}`);
    assert.equal(g.getAttribute('uv'), undefined, `${t} có uv`);
    for (const r of new Set(roles(g))) assert.ok(Number.isInteger(r) && r >= Role.Fixed && r <= Role.Helmet, `${t}: aRole ${r}`);
  }
});

test('đèn pha ở nửa đầu xe (+X), đèn hậu ở nửa đuôi', () => {
  for (const t of VEHICLE_TYPES) {
    const g = vhBuildTypeGeometry(t), r = roles(g), p = pos(g);
    let head = 0, tail = 0;
    for (let i = 0; i < r.length; i++) {
      if (r[i] === Role.Head) { head++; assert.ok(p.getX(i) > 0, `${t}: đèn pha x = ${p.getX(i)}`); }
      if (r[i] === Role.Tail) { tail++; assert.ok(p.getX(i) < 0, `${t}: đèn hậu x = ${p.getX(i)}`); }
    }
    assert.ok(head > 0 && tail > 0, `${t} thiếu đèn`);
  }
});

test('siêu xe và xe tay ga có đỉnh Paint; xe tay ga có Accent và Helmet; buýt không có Paint', () => {
  const s = (t: 'car' | 'bus' | 'bike') => new Set(roles(vhBuildTypeGeometry(t)));
  assert.ok(s('car').has(Role.Paint), 'car thiếu Paint');
  const bike = s('bike');
  for (const k of [Role.Paint, Role.Accent, Role.Helmet]) assert.ok(bike.has(k), `bike thiếu role ${k}`);
  assert.ok(!s('bus').has(Role.Paint), 'bus có Paint');
  assert.ok(!s('car').has(Role.Accent) && !s('car').has(Role.Helmet), 'car có người lái');
});

test('hình học gộp ≤ maxVerts, aPart đúng 3 giá trị 0,1,2', () => {
  const f = vhBuildFleetGeometry(), n = pos(f).count;
  assert.ok(n <= CONFIG.vehicles.maxVerts, `${n} đỉnh`);
  assert.equal(n, VEHICLE_TYPES.reduce((s, t) => s + pos(vhBuildTypeGeometry(t)).count, 0));
  assert.ok(f.index, 'fleet không có index');
  assert.equal(f.getAttribute('uv'), undefined);
  const part = Array.from(f.getAttribute('aPart').array as ArrayLike<number>);
  assert.deepEqual([...new Set(part)].sort(), [0, 1, 2]);
  let start = 0;   // aPart theo đúng thứ tự VEHICLE_TYPES
  VEHICLE_TYPES.forEach((t, k) => { const c = pos(vhBuildTypeGeometry(t)).count; assert.ok(part.slice(start, start + c).every((v) => v === k), t); start += c; });
  assert.equal(vhBuildFleetGeometry(), f, 'không cache');
  assert.equal(vhBuildTypeGeometry('car'), vhBuildTypeGeometry('car'), 'không cache loại');
});

test('mặt hướng ra ngoài: pháp tuyến mỗi tam giác của thân loft không chỉ vào tâm khối', () => {
  const body = vhLoft(CAR_BODY); body.computeBoundingBox(); const ctr = body.boundingBox!.getCenter(new THREE.Vector3());
  const tris = triangles(body), out = tris.filter((t) => t.n.dot(t.c.clone().sub(ctr)) > 0).length;
  assert.ok(tris.length > 0 && out / tris.length >= 0.95, `${out}/${tris.length} tam giác hướng ra`);
});

test('pháp tuyến phẳng khớp chiều quấn tam giác ở mọi loại (FrontSide nhìn thấy mặt ngoài)', () => {
  for (const t of VEHICLE_TYPES) {
    const tris = triangles(vhBuildTypeGeometry(t));
    const bad = tris.filter((x) => x.n.dot(x.attr) < 2.9).length;   // 3 pháp tuyến đỉnh đều trùng pháp tuyến mặt ⇒ tổng dot ≈ 3
    assert.equal(bad, 0, `${t}: ${bad}/${tris.length} tam giác có pháp tuyến lệch chiều quấn`);
  }
});
