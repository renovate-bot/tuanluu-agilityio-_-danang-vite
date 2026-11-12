/* ===== Lái xe: test lõi mạng đường DrNet (src/explore/drive/net.ts) =====
   Tra cao độ theo tầng (hai ô chồng mặt bằng), ngoài mọi ô, cổng đóng / mở, khung bao, loang tìm vùng tới được. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drMakeNet, drGround, drSetGate, drBounds, drReach, drAddSolids, type DrPad } from '../../src/explore/drive/net.ts';

const flat = (y: number) => () => y;
const pad = (id: string, x0: number, x1: number, z0: number, z1: number, y: number, gate?: string): DrPad => {
  const p: DrPad = { id, kind: 'road', x0, x1, z0, z1, y: flat(y) }; if (gate) p.gate = gate; return p;
};

test('drGround tách tầng', () => {
  const net = drMakeNet([pad('duoi', 0, 20, 0, 20, 2.6), pad('tren', 0, 20, 0, 20, 5.3)], []);
  assert.equal(drGround(net, 10, 10, 2.6), 2.6);
  assert.equal(drGround(net, 10, 10, 5.2), 5.3);
  assert.ok(Number.isNaN(drGround(net, 10, 10, 4.0)));
});

test('ngoài mọi ô là NaN', () => {
  const net = drMakeNet([pad('a', 0, 20, 0, 20, 2.6)], []);
  assert.ok(Number.isNaN(drGround(net, 25, 10, 2.6)));
  assert.ok(Number.isNaN(drGround(net, 10, -0.5, 2.6)));
  assert.equal(drGround(net, 20, 20, 2.6), 2.6);                     // mép ô tính là trong ô
});

test('cổng đóng thì ô biến mất, mở lại thì có', () => {
  const net = drMakeNet([pad('a', 0, 20, 0, 20, 2.6), pad('nhip', 20, 40, 0, 20, 2.6, 'g')], []);
  assert.equal(drGround(net, 30, 10, 2.6), 2.6);
  drSetGate(net, 'g', true);
  assert.ok(Number.isNaN(drGround(net, 30, 10, 2.6)));
  assert.equal(drGround(net, 10, 10, 2.6), 2.6);                     // ô không cổng vẫn còn
  drSetGate(net, 'g', false);
  assert.equal(drGround(net, 30, 10, 2.6), 2.6);
});

test('khung bao gồm cả cao độ', () => {
  const net = drMakeNet([pad('a', -5, 20, 0, 20, 2.6), { id: 'doc', kind: 'bridge', x0: 20, x1: 40, z0: -3, z1: 20, y: (x) => 2.6 + (x - 20) * 0.1 }], []);
  const b = drBounds(net);
  assert.deepEqual([b.x0, b.x1, b.z0, b.z1], [-5, 40, -3, 20]);
  assert.equal(b.yMin, 2.6);
  assert.ok(Math.abs(b.yMax - 4.6) < 1e-9);
});

test('drReach đi theo tầng, không nhảy tầng, không qua cổng đóng', () => {
  const pads = [
    pad('a', 0, 20, 0, 10, 2.6), pad('b', 20, 40, 0, 10, 2.6),        // hai ô liền nhau cùng tầng
    pad('cao', 0, 40, 0, 10, 8),                                      // tầng trên cùng mặt bằng, không nối
    pad('xa', 50, 60, 0, 10, 2.6),                                    // cách khe 10 m
    pad('d', 30, 50, 10, 20, 2.6), pad('c', 30, 50, 20, 30, 2.6, 'g')  // d chung cạnh z = 10 với b; c sau cổng
  ];
  const net = drMakeNet(pads, []);
  assert.deepEqual([...drReach(net, 5, 5, 2.6)].sort(), ['a', 'b', 'c', 'd']);
  drSetGate(net, 'g', true);
  assert.deepEqual([...drReach(net, 5, 5, 2.6)].sort(), ['a', 'b', 'd']);
  assert.deepEqual([...drReach(net, 5, 5, 8)].sort(), ['cao']);
  assert.equal(drReach(net, 45, 5, 2.6).size, 0);                    // điểm xuất phát ngoài mọi ô
});

test('drAddSolids nối thêm vật cản', () => {
  const net = drMakeNet([pad('a', 0, 20, 0, 20, 2.6)], [{ kind: 'circle', cx: 1, cz: 1, r: 1, y0: 0, y1: 5 }]);
  drAddSolids(net, [{ kind: 'rect', x0: 0, x1: 1, z0: 0, z1: 1, y0: 2.6, y1: 3.5 }]);
  assert.equal(net.solids.length, 2);
});
