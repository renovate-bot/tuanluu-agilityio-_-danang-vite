/* ===== Lái xe: test va chạm thân xe (src/explore/drive/collide.ts) =====
   Trượt dọc tường, không sang tầng khác, lên dốc liền, chặn khi lao vào xe tự động, xe tự động chồng sẵn thì lái ra được,
   vật cản thêm lúc chạy vẫn vào chỉ mục lưới, drSegClear theo tầng. Mạng tự dựng nhỏ, không cần cảnh. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../src/config.ts';
import { drMakeNet, drAddSolids, type DrPad, type DrSolid } from '../../src/explore/drive/net.ts';
import { drFits, drMove, drSegClear, type DrPose, type DrBox } from '../../src/explore/drive/collide.ts';

const HL = CONFIG.drive.car.length / 2, HW = CONFIG.drive.car.width / 2;
const pad = (id: string, x0: number, x1: number, z0: number, z1: number, y: number | ((x: number, z: number) => number)): DrPad =>
  ({ id, kind: 'road', x0, x1, z0, z1, y: typeof y === 'number' ? () => y : y });
const wall = (x0: number, x1: number, z0: number, z1: number, y0: number, y1: number): DrSolid => ({ kind: 'rect', x0, x1, z0, z1, y0, y1 });
const pose = (x: number, y: number, z: number, yaw: number): DrPose => ({ x, y, z, yaw });
const NONE: DrBox[] = [], IGN = new Uint8Array(8);

test('trượt dọc tường', () => {
  const net = drMakeNet([pad('a', 0, 100, 0, 40, 2.6)], [wall(0, 100, 30, 31, 2.6, 4)]);
  const yaw = -20 * Math.PI / 180;                                    // mũi xe chéo 20° về phía tường (+z)
  const p = pose(20, 2.6, 27, yaw), out = pose(0, 0, 0, 0);
  assert.ok(drFits(net, p, NONE, 0, IGN));
  const f = drMove(net, p, 10, 0, NONE, 0, out);
  assert.ok(f < 1, 'phải chạm tường');
  assert.ok(f > 0.5, `trượt chứ không đứng hẳn (f = ${f})`);
  assert.ok(out.x > 20 + 5, `tọa độ dọc tường tăng (x = ${out.x})`);
  assert.ok(drFits(net, out, NONE, 0, IGN), 'không xuyên tường');
  const zMax = out.z + HL * Math.sin(-yaw) + HW * Math.cos(yaw);
  assert.ok(zMax <= 30 + 1e-6, `góc xe không lấn tường (zMax = ${zMax})`);
});

test('không sang tầng khác', () => {
  const net = drMakeNet([pad('duoi', 0, 20, 0, 20, 2.6), pad('tren', 20, 40, 0, 20, 5.3)], []);
  const out = pose(0, 0, 0, 0);
  const f = drMove(net, pose(10, 2.6, 10, 0), 15, 0, NONE, 0, out);
  assert.ok(f < 1);
  assert.ok(out.x + HL <= 20 + 1e-6, `dừng ở mép ô dưới (x = ${out.x})`);
  assert.equal(out.y, 2.6);
  assert.ok(drFits(net, out, NONE, 0, IGN));
});

test('lên dốc liền', () => {
  const slope = (x: number) => 2.6 + (x - 20) * (10 - 2.6) / 71;
  const net = drMakeNet([pad('bang', 0, 20, 0, 20, 2.6), pad('doc', 20, 91, 0, 20, (x) => slope(x)), pad('dinh', 91, 130, 0, 20, 10)], []);
  let p = pose(10, 2.6, 10, 0); const out = pose(0, 0, 0, 0);
  let yPrev = p.y;
  for (let i = 0; i < 20; i++) {
    const f = drMove(net, p, 5, 0, NONE, 0, out);
    assert.equal(f, 1, `bước ${i} đi trọn`);
    assert.ok(out.y >= yPrev - 1e-9, 'y không giảm');
    if (out.x > 20 && out.x < 91) assert.ok(Math.abs(out.y - slope(out.x)) < 1e-9, 'y bám mặt dốc');
    yPrev = out.y; p = { ...out };
  }
  assert.ok(Math.abs(p.x - 110) < 1e-6);
  assert.equal(p.y, 10);
});

test('lao vào xe tự động thì bị chặn', () => {
  const net = drMakeNet([pad('a', 0, 60, 0, 40, 2.6)], []);
  const boxes: DrBox[] = [{ x: 30, y: 2.6, z: 20, yaw: 0, hl: 2, hw: 0.9 }];
  const out = pose(0, 0, 0, 0);
  // đâm đuôi: đi dọc +x tới hộp
  let f = drMove(net, pose(15, 2.6, 20, 0), 20, 0, boxes, 1, out);
  assert.ok(f < 1);
  assert.ok(out.x + HL <= 28 + 1e-6, `dừng sau đuôi (x = ${out.x})`);
  // đâm hông: đi dọc −z (yaw = π/2 ⇒ hướng (0, −1)) từ phía Nam
  f = drMove(net, pose(30, 2.6, 30, Math.PI / 2), 20, 0, boxes, 1, out);
  assert.ok(f < 1);
  assert.ok(out.z - HL >= 20.9 - 1e-6, `dừng bên hông (z = ${out.z})`);
  // xe tự động ở tầng khác (dưới gầm cầu) thì không chặn
  const low: DrBox[] = [{ x: 30, y: -3, z: 20, yaw: 0, hl: 2, hw: 0.9 }];
  assert.equal(drMove(net, pose(15, 2.6, 20, 0), 30, 0, low, 1, out), 1);
});

test('xe tự động chồng sẵn thì không chặn và lái ra được theo cả bốn hướng', () => {
  const net = drMakeNet([pad('a', 0, 60, 0, 60, 2.6)], []);
  const boxes: DrBox[] = [{ x: 30.5, y: 2.6, z: 30.3, yaw: 0.3, hl: 2, hw: 0.9 }];
  const start = pose(30, 2.6, 30, 0), out = pose(0, 0, 0, 0);
  assert.ok(!drFits(net, start, boxes, 1, new Uint8Array(1)), 'tư thế xuất phát đang chồng hộp');
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) for (const d of [6, -6]) {
    const f = drMove(net, { ...start, yaw }, d, 0, boxes, 1, out);
    assert.equal(f, 1, `yaw ${yaw.toFixed(2)}, d ${d}: lái ra được`);
    assert.ok(Math.hypot(out.x - 30, out.z - 30) > 5.9);
  }
  // đã ra ngoài thì lùi lại vào hộp bị chặn
  drMove(net, start, 6, 0, boxes, 1, out);
  assert.ok(drFits(net, out, boxes, 1, new Uint8Array(1)));
  const back = pose(0, 0, 0, 0);
  assert.ok(drMove(net, { ...out }, -6, 0, boxes, 1, back) < 1);
});

/* Xe mũi +x, đầu xe chồng 0,5 m vào khối (x 30..40) */
const embed = () => ({ net: drMakeNet([pad('a', 0, 100, 0, 40, 2.6)], [wall(30, 40, 0, 40, 2.6, 4)]), p: pose(30 + 0.5 - HL, 2.6, 20, 0) });

test('chồng sẵn vật cản tĩnh vẫn lái ra được', () => {
  const { net, p } = embed(), out = pose(0, 0, 0, 0);
  assert.ok(!drFits(net, p, NONE, 0, IGN), 'tư thế xuất phát đang chồng vật cản');
  let cur = { ...p }, ok = false;
  for (let i = 0; i < 5 && !ok; i++) {
    const f = drMove(net, cur, -0.3, 0, NONE, 0, out);
    assert.ok(f > 0, `lượt ${i}: lùi được`);
    cur = { ...out }; ok = drFits(net, cur, NONE, 0, IGN);
  }
  assert.ok(ok, `đã ra khỏi vật cản (x = ${cur.x})`);
  assert.ok(drMove(net, cur, 2, 0, NONE, 0, out) < 1 && out.x + HL <= 30 + 1e-6, 'ra rồi thì luật cũ: tiến lại bị chặn ở mép');
  /* lùi kèm xoay cũng thoát được */
  const g = drMove(net, p, -2, -0.3, NONE, 0, out);
  assert.ok(g > 0 && drFits(net, out, NONE, 0, IGN), 'lùi chéo ra được');
});

test('đường thoát không thành lối xuyên', () => {
  const { net, p } = embed(), out = pose(0, 0, 0, 0);
  for (const [d, dy] of [[1, 0], [5, 0], [3, 0.3], [3, -0.3]] as const) {
    drMove(net, p, d, dy, NONE, 0, out);
    assert.ok(out.x <= p.x + 1e-6, `tiến ${d}, xoay ${dy}: không tiến sâu thêm (x = ${out.x})`);
  }
  /* nhiều lượt liền cũng không xuyên qua được khối */
  let cur = { ...p };
  for (let i = 0; i < 50; i++) { drMove(net, cur, 1, 0, NONE, 0, out); cur = { ...out }; }
  assert.ok(cur.x <= p.x + 1e-6, `x = ${cur.x}`);
});

test('vật cản thêm lúc chạy vẫn chặn (chỉ mục lưới cập nhật)', () => {
  const net = drMakeNet([pad('a', 0, 100, 0, 40, 2.6)], [wall(80, 81, 0, 40, 2.6, 4)]);
  const p = pose(50, 2.6, 20, 0);
  assert.ok(drFits(net, p, NONE, 0, IGN));                            // dựng lưới
  drAddSolids(net, [{ kind: 'circle', cx: 51, cz: 20.5, r: 0.5, y0: 2.6, y1: 6 }, wall(-500, 500, 39, 40, 0, 9)]);
  assert.ok(!drFits(net, p, NONE, 0, IGN));
  assert.ok(drFits(net, pose(40, 2.6, 20, 0), NONE, 0, IGN));
  assert.ok(!drFits(net, pose(40, 2.6, 38.5, 0), NONE, 0, IGN), 'vật cản lớn (nhiều ô lưới) vẫn chặn');
});

test('vật cản tầng khác không chặn thân xe', () => {
  const net = drMakeNet([pad('a', 0, 100, 0, 40, 2.6)], [wall(40, 60, 0, 40, 8, 9), wall(40, 60, 0, 40, 0, 2.65)]);
  const out = pose(0, 0, 0, 0);
  assert.equal(drMove(net, pose(20, 2.6, 20, 0), 50, 0, NONE, 0, out), 1);
});

test('drSegClear: vướng cùng tầng < 1, tầng khác = 1', () => {
  const net = drMakeNet([pad('a', -50, 50, -50, 50, 2.6)], [wall(10, 11, -5, 5, 2.6, 4), { kind: 'circle', cx: 0, cz: 20, r: 1, y0: 2.6, y1: 4 }]);
  const t = drSegClear(net, 0, 3.5, 0, 20, 3.5, 0);
  assert.ok(Math.abs(t - 0.5) < 1e-9, `t = ${t}`);
  assert.equal(drSegClear(net, 0, 8, 0, 20, 8, 0), 1);                // đi trên đỉnh vật cản
  assert.equal(drSegClear(net, 0, 3.5, 10, 20, 3.5, 10), 1);          // không cắt
  const tc = drSegClear(net, 0, 3, 10, 0, 3, 30);
  assert.ok(Math.abs(tc - 0.45) < 1e-9, `hình tròn t = ${tc}`);
  assert.equal(drSegClear(net, 0, 6, 10, 0, 6, 30), 1);
});
