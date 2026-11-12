import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SkyRoom } from '../../server/multi/src/room.ts';
import { exSanitizeName } from '../../src/explore/multi/protocol.ts';
import { multiParams as P } from '../../src/explore/multi/params.ts';
import { CONFIG } from '../../src/config.ts';

const J = (o: any) => JSON.stringify(o);
const join = (r: SkyRoom, id: string, name: string, now = 0) => r.message(id, J({ t: 'join', name }), now);
const has = (outs: any[], pred: (o: any) => boolean) => outs.filter(pred);
const pos = (r: SkyRoom, id: string, o: any, now: number) => r.message(id, J({ t: 'pos', y: 50, z: 0, yaw: 0, bank: 0, ...o }), now);

test('sáu người join: 5 joined, người thứ sáu rejected full', () => {
  const r = new SkyRoom();
  const res: any[][] = [];
  for (let i = 0; i < 6; i++) { r.connect('c' + i, 0); res.push(join(r, 'c' + i, 'P' + i)); }
  for (let i = 0; i < 5; i++) assert.equal(has(res[i], o => o.msg.t === 'joined').length, 1);
  assert.deepEqual(res[5].map(o => o.msg), [{ t: 'rejected', why: 'full' }]);
});

test('connect nhận lobby; chỉ người gửi nhận joined; all nhận lobby mới', () => {
  const r = new SkyRoom();
  const c = r.connect('a', 0)!;
  assert.deepEqual(c, [{ to: 'a', msg: { t: 'lobby', flyers: [], walkers: [], drivers: [] } }]);
  const o = join(r, 'a', 'An');
  const j = has(o, x => x.msg.t === 'joined');
  assert.equal(j.length, 1); assert.equal(j[0].to, 'a'); assert.equal(j[0].msg.slot, 0);
  const l = has(o, x => x.msg.t === 'lobby');
  assert.equal(l[0].to, 'all'); assert.deepEqual(l[0].msg.flyers, [{ slot: 0, name: 'An' }]);
});

test('slot nhỏ nhất đang trống; leave rồi join lại; người leave vẫn nhận lobby và pos', () => {
  const r = new SkyRoom();
  for (let i = 0; i < 3; i++) { r.connect('c' + i, 0); join(r, 'c' + i, 'P' + i); }
  const lv = r.message('c1', J({ t: 'leave' }), 0);
  assert.equal(r.slotOf('c1'), -1);
  assert.equal(lv[0].to, 'all'); assert.equal(lv[0].msg.t, 'lobby'); // c1 còn kết nối nên nằm trong 'all'
  const o = join(r, 'c1', 'Lai');
  assert.equal(has(o, x => x.msg.t === 'joined')[0].msg.slot, 1);
  r.message('c0', J({ t: 'leave' }), 0);
  const out = pos(r, 'c1', { x: 0 }, 1000);
  assert.equal(out[0].to, 'all');
  assert.equal(r.slotOf('c0'), -1);
});

test('pos phát all khi cách lần trước >= broadcastMs, gói mới nhất mọi slot', () => {
  const r = new SkyRoom();
  r.connect('a', 0); r.connect('b', 0); join(r, 'a', 'A'); join(r, 'b', 'B');
  const o1 = pos(r, 'a', { x: 10 }, 1000);
  assert.equal(o1.length, 1);
  assert.deepEqual((o1[0].msg as any).f.map((e: number[]) => e[0]), [0]);
  assert.deepEqual(pos(r, 'b', { x: 20 }, 1000 + P.broadcastMs - 1), []);
  const o3 = pos(r, 'a', { x: 11 }, 1000 + P.broadcastMs);
  const f = (o3[0].msg as any).f;
  assert.deepEqual(f.map((e: number[]) => e[0]), [0, 1]);
  assert.equal(f[0][1], 11); assert.equal(f[1][1], 20);
});

test('pos không slot / quá tốc độ / NaN bị bỏ; kẹp bounds và y', () => {
  const r = new SkyRoom();
  r.connect('a', 0); r.connect('z', 0); join(r, 'a', 'A');
  assert.deepEqual(pos(r, 'z', { x: 0 }, 0), []);
  assert.equal(pos(r, 'a', { x: 0 }, 0).length, 1);
  assert.deepEqual(pos(r, 'a', { x: null }, 500), []);
  assert.deepEqual(pos(r, 'a', { x: '1' }, 500), []);
  assert.deepEqual(r.message('a', '{"t":"pos","x":1e999,"y":50,"z":0,"yaw":0,"bank":0}', 500), []); // 1e999 -> Infinity
  const e = (pos(r, 'a', { x: 99999, y: -5 }, 1000)[0].msg as any).f[0];
  assert.equal(e[1], P.bounds.x1); assert.equal(e[2], P.floor);
  const e2 = (pos(r, 'a', { y: 99999, z: -99999, x: 0 }, 1200)[0].msg as any).f[0];
  assert.equal(e2[2], P.ceiling); assert.equal(e2[3], P.bounds.z0);
  // quá posMaxPerSec trong 1 s
  const r3 = new SkyRoom(); r3.connect('a', 0); join(r3, 'a', 'A');
  for (let i = 0; i < P.posMaxPerSec; i++) pos(r3, 'a', { x: i }, 10000 + i);
  assert.deepEqual(pos(r3, 'a', { x: 5 }, 10500), []);
  const later = pos(r3, 'a', { x: 777 }, 11200);
  assert.equal((later[0].msg as any).f[0][1], 777);
});

test('raw quá dài hoặc JSON hỏng: trả []', () => {
  const r = new SkyRoom(); r.connect('a', 0);
  assert.deepEqual(r.message('a', 'x'.repeat(P.maxMsgBytes + 1), 0), []);
  assert.deepEqual(r.message('a', J({ t: 'join', name: 'a'.repeat(300) }), 0), []);
  assert.deepEqual(r.message('a', '{hỏng', 0), []);
  assert.deepEqual(r.message('a', 'null', 0), []);
  assert.deepEqual(r.message('nope', J({ t: 'hb' }), 0), []);
});

test('join tên xấu: rejected name; join khi đã có slot: bỏ qua', () => {
  const r = new SkyRoom(); r.connect('a', 0);
  assert.deepEqual(join(r, 'a', '').map(o => o.msg), [{ t: 'rejected', why: 'name' }]);
  assert.deepEqual(join(r, 'a', 'Đụ má').map(o => o.msg), [{ t: 'rejected', why: 'name' }]);
  assert.deepEqual(join(r, 'a', 'fuck').map(o => o.msg), [{ t: 'rejected', why: 'name' }]);
  join(r, 'a', 'An');
  assert.deepEqual(join(r, 'a', 'Binh'), []);
  assert.equal(r.slotOf('a'), 0);
});

test('exSanitizeName', () => {
  assert.equal(exSanitizeName('  An  '), 'An');
  assert.equal(exSanitizeName(''), null);
  assert.equal(exSanitizeName('1234567890'), null);
  assert.equal(exSanitizeName('Nguyễn Anh'), null);
  assert.equal(exSanitizeName('Đặng Thị A'), null);
  assert.equal(exSanitizeName('Trường'), 'Trường');
  const fam = '👨\u200D👩\u200D👧'.repeat(9);
  assert.equal(exSanitizeName(fam), fam);
  assert.equal(exSanitizeName('a\u202Eb'), 'ab');
  assert.equal(exSanitizeName('<b>x</b>'), '<b>x</b>');
});

test('sweep: quá slotTimeoutMs trả slot và gửi released; hb làm mới', () => {
  const r = new SkyRoom();
  r.connect('a', 0); r.connect('b', 0); join(r, 'a', 'A', 0); join(r, 'b', 'B', 0);
  r.message('b', J({ t: 'hb' }), 9000);
  const o = r.sweep(P.slotTimeoutMs + 1);
  assert.equal(has(o, x => x.msg.t === 'released' && x.to === 'a').length, 1);
  assert.equal(has(o, x => x.msg.t === 'released' && x.to === 'b').length, 0);
  assert.equal(r.slotOf('a'), -1); assert.equal(r.slotOf('b'), 1);
  const l = has(o, x => x.msg.t === 'lobby')[0];
  assert.deepEqual(l.msg.flyers, [{ slot: 1, name: 'B' }]);
  assert.equal(r.hasFlyers(), true);
  r.disconnect('b');
  assert.equal(r.hasFlyers(), false);
});

test('connect thứ maxConns+1 trả null; restore', () => {
  const r = new SkyRoom();
  for (let i = 0; i < P.maxConns; i++) assert.ok(r.connect('c' + i, 0));
  assert.equal(r.connect('extra', 0), null);
  const r2 = new SkyRoom();
  r2.restore([{ id: 'x', slot: 2, name: 'Xa' }], 0);
  assert.equal(r2.slotOf('x'), 2);
  assert.equal(r2.hasFlyers(), true);
});

test('multiParams.bounds, floor, ceiling khớp CONFIG.explore', () => {
  assert.deepEqual(P.bounds, CONFIG.explore.bounds);
  assert.equal(P.floor, CONFIG.explore.floor);
  assert.equal(P.ceiling, CONFIG.explore.ceiling);
  assert.equal(CONFIG.explore.multi, P);
});

test('pos chỉ phát slot có vị trí mới; mục kèm giờ gửi (e[6])', () => {
  const r = new SkyRoom();
  r.connect('a', 0); r.connect('b', 0); join(r, 'a', 'A'); join(r, 'b', 'B');
  pos(r, 'a', { x: 1 }, 1000);
  const o = pos(r, 'b', { x: 2 }, 1100);
  const m = o[0].msg as any;
  assert.deepEqual(m.f.map((e: number[]) => e[0]), [1], 'slot 0 không có vị trí mới thì không phát lại');
  assert.equal(m.f[0][6], 1100, 'khách cũ không gửi ts: giờ máy chủ nhận');
  const o2 = pos(r, 'a', { x: 3, ts: 98765 }, 1300);
  assert.equal((o2[0].msg as any).f[0][6], 98765, 'khách mới gửi ts: chuyển nguyên');
  const o3 = pos(r, 'a', { x: 4, ts: 1.79e308 }, 1500);
  assert.equal((o3[0].msg as any).f[0][6], 1500, 'ts quá lớn (> 2^53): coi như không gửi, dùng giờ máy chủ');
});

test('pos bị hãm trong cửa sổ broadcastMs vẫn được phát ở lần sau, kể cả lần sau là hb', () => {
  const r = new SkyRoom();
  r.connect('a', 0); r.connect('b', 0); join(r, 'a', 'A'); join(r, 'b', 'B');
  pos(r, 'a', { x: 1 }, 1000);
  assert.deepEqual(pos(r, 'b', { x: 2 }, 1050), []);
  const o = r.message('a', J({ t: 'hb' }), 1200);
  assert.equal(o.length, 1);
  const f = (o[0].msg as any).f;
  assert.deepEqual(f.map((e: number[]) => [e[0], e[1], e[6]]), [[1, 2, 1050]]);
  assert.deepEqual(r.message('a', J({ t: 'hb' }), 1400), [], 'không còn gì mới: hb không phát');
});

test('pos: yaw quấn về ±π, bank kẹp theo bankMax', () => {
  const r = new SkyRoom(); r.connect('a', 0); join(r, 'a', 'A');
  const e = (pos(r, 'a', { x: 0, yaw: 3 * Math.PI + 0.5, bank: 9 }, 1000)[0].msg as any).f[0];
  assert.ok(Math.abs(e[4] - (0.5 - Math.PI)) < 1e-9, 'yaw ' + e[4]);
  assert.equal(e[5], P.bankMax);
  const e2 = (pos(r, 'a', { x: 0, yaw: -1e6, bank: -9 }, 1200)[0].msg as any).f[0];
  assert.ok(e2[4] >= -Math.PI && e2[4] <= Math.PI); assert.equal(e2[5], -P.bankMax);
  assert.equal(P.bankMax, CONFIG.explore.bankMax);
});

test('restore sau hibernation: không có tin thì slot hết hạn; người còn bay gửi hb thì giữ', () => {
  const T = P.slotTimeoutMs, H = P.heartbeatMs, t0 = 50000;
  const r = new SkyRoom();
  r.restore([{ id: 'dead', slot: 0, name: 'D' }, { id: 'live', slot: 1, name: 'L' }], t0);
  r.message('live', J({ t: 'hb' }), t0 + H - 500);
  const o = r.sweep(t0 + H + 1);
  assert.equal(r.slotOf('dead'), -1, 'người im lặng bị thu hồi chỉ sau một chu kỳ nhịp sống');
  assert.equal(has(o, x => x.msg.t === 'released' && x.to === 'dead').length, 1);
  assert.equal(r.slotOf('live'), 1);
  r.message('live', J({ t: 'hb' }), t0 + T);
  r.sweep(t0 + T + H);
  assert.equal(r.slotOf('live'), 1);
  // seen đã lưu trong attachment: dùng đúng mốc đó
  const r2 = new SkyRoom();
  r2.restore([{ id: 'x', slot: 2, name: 'X', seen: t0 - T - 1 }], t0);
  r2.sweep(t0); assert.equal(r2.slotOf('x'), -1);
  assert.equal(r2.seenOf('x'), -1);
  const r3 = new SkyRoom(); r3.connect('y', 0); join(r3, 'y', 'Y', 700);
  assert.equal(r3.seenOf('y'), 700);
});

test('exSanitizeName: tên toàn ký tự vô hình bị từ chối; dấu chồng bị giới hạn', () => {
  for (const bad of ['\u200D', '\u200D\u200D', '\u3164', '\u2800\u2800', '\u3164 \u2800', '\u115F\u1160', '\uFFA0', '\u00A0', '\u2003', '\u034F'])
    assert.equal(exSanitizeName(bad), null, JSON.stringify(bad));
  assert.equal(exSanitizeName('a' + '\u0301'.repeat(240)), null, 'một grapheme mang 240 dấu');
  assert.equal(exSanitizeName('Nguyễn'), 'Nguyễn');
  assert.equal(exSanitizeName('Trường'), 'Trường');
  assert.equal(exSanitizeName('👨\u200D👩\u200D👧'), '👨\u200D👩\u200D👧');
  assert.equal(exSanitizeName('🇻🇳'), '🇻🇳');
  assert.equal(exSanitizeName('สมชาย'), 'สมชาย');
  assert.equal(exSanitizeName('नमस्ते'), 'नमस्ते');
  assert.equal(exSanitizeName('مرحبا'), 'مرحبا');
  assert.equal(exSanitizeName('!!'), '!!');
  assert.equal(exSanitizeName('a\u3164b'), 'a\u3164b');
  assert.equal(exSanitizeName(('a' + '\u0301'.repeat(5)).repeat(9)), null, '9 grapheme × 6 code point = 54 > nameCpMax');
  assert.equal(exSanitizeName('👨\u200D👩\u200D👧\u200D👦'), '👨\u200D👩\u200D👧\u200D👦');
});

/* ===== Chế độ đi dạo: nhóm 5 slot riêng với nhóm bay ===== */
const joinW = (r: SkyRoom, id: string, name: string, now = 0) => r.message(id, J({ t: 'join', name, kind: 'walk' }), now);
const posW = (r: SkyRoom, id: string, o: any, now: number) => r.message(id, J({ t: 'pos', x: 0, y: 3, z: 0, yaw: 0, pose: 1, ...o }), now);

test('năm người bay và năm người đi dạo cùng lúc: cả mười joined; người bay thứ sáu rejected full; người đi dạo thứ sáu rejected full kèm kind walk', () => {
  const r = new SkyRoom();
  const fly: any[][] = [], walk: any[][] = [];
  for (let i = 0; i < 6; i++) { r.connect('f' + i, 0); fly.push(join(r, 'f' + i, 'F' + i)); }
  for (let i = 0; i < 6; i++) { r.connect('w' + i, 0); walk.push(joinW(r, 'w' + i, 'W' + i)); }
  for (let i = 0; i < 5; i++) {
    assert.equal(has(fly[i], o => o.msg.t === 'joined').length, 1);
    const j = has(walk[i], o => o.msg.t === 'joined')[0];
    assert.deepEqual(j.msg, { t: 'joined', slot: i, kind: 'walk' });
  }
  assert.deepEqual(fly[5].map(o => o.msg), [{ t: 'rejected', why: 'full' }]);
  assert.deepEqual(walk[5].map(o => o.msg), [{ t: 'rejected', why: 'full', kind: 'walk' }]);
});

test('lobby: flyers chỉ gồm người bay, walkers chỉ gồm người đi dạo; lobby luôn có walkers', () => {
  const r = new SkyRoom();
  assert.deepEqual(r.connect('a', 0), [{ to: 'a', msg: { t: 'lobby', flyers: [], walkers: [], drivers: [] } }]);
  r.connect('b', 0);
  join(r, 'a', 'Bay');
  const l = has(joinW(r, 'b', 'Di'), x => x.msg.t === 'lobby')[0].msg;
  assert.deepEqual(l.flyers, [{ slot: 0, name: 'Bay' }]);
  assert.deepEqual(l.walkers, [{ slot: 0, name: 'Di' }]);
  assert.equal(r.slotOf('b'), -1); assert.equal(r.walkSlotOf('b'), 0);
  assert.equal(r.slotOf('a'), 0); assert.equal(r.walkSlotOf('a'), -1);
  assert.equal(r.kindOf('a'), 'fly'); assert.equal(r.kindOf('b'), 'walk'); assert.equal(r.kindOf('zz'), null);
});

test('join kind walk khi năm chỗ bay đã đầy vẫn được chỗ đi dạo, và ngược lại', () => {
  const r = new SkyRoom();
  for (let i = 0; i < 5; i++) { r.connect('f' + i, 0); join(r, 'f' + i, 'F' + i); }
  r.connect('w', 0);
  assert.equal(has(joinW(r, 'w', 'W'), o => o.msg.t === 'joined').length, 1);
  const r2 = new SkyRoom();
  for (let i = 0; i < 5; i++) { r2.connect('w' + i, 0); joinW(r2, 'w' + i, 'W' + i); }
  r2.connect('f', 0);
  assert.equal(has(join(r2, 'f', 'F'), o => o.msg.t === 'joined').length, 1);
});

test('pos của người đi dạo: phát trong w, không có trong f; f vẫn có mặt và là mảng rỗng', () => {
  const r = new SkyRoom();
  r.connect('a', 0); joinW(r, 'a', 'A');
  const o = posW(r, 'a', { x: 10, yaw: 1, pose: 2, ts: 777 }, 1000);
  assert.equal(o.length, 1);
  const m = o[0].msg as any;
  assert.deepEqual(m.f, []);
  assert.deepEqual(m.w, [[0, 10, 3, 0, 1, 2, 777]]);
  assert.deepEqual(posW(r, 'a', { x: 11 }, 1010), [], 'hãm trong cửa sổ broadcastMs');
  const m2 = (r.message('a', J({ t: 'hb' }), 1200)[0].msg as any);
  assert.equal(m2.w[0][1], 11); assert.equal(m2.w[0][6], 1010, 'không gửi ts: giờ máy chủ nhận');
});

test('một lần phát gộp cả f và w', () => {
  const r = new SkyRoom();
  r.connect('a', 0); r.connect('b', 0); join(r, 'a', 'A'); joinW(r, 'b', 'B');
  pos(r, 'a', { x: 1 }, 1000);
  const o = posW(r, 'b', { x: 2 }, 1100);
  assert.equal(o.length, 1);
  const m = o[0].msg as any;
  assert.deepEqual(m.f, []); assert.equal(m.w.length, 1);
  const o2 = pos(r, 'a', { x: 3 }, 1200);
  assert.equal((o2[0].msg as any).f.length, 1);
  assert.equal((o2[0].msg as any).w, undefined, 'không có người đi dạo cử động thì không có w');
});

test('pos đi dạo bị kẹp: x, z, y, pose; pose NaN bỏ gói; bank bị bỏ qua', () => {
  const r = new SkyRoom(); r.connect('a', 0); joinW(r, 'a', 'A');
  const e = (posW(r, 'a', { x: 9999, z: -9999, y: 500, pose: 7 }, 1000)[0].msg as any).w[0];
  assert.equal(e[1], 400); assert.equal(e[3], -1300); assert.equal(e[2], 20); assert.equal(e[5], 4);
  const e2 = (posW(r, 'a', { x: -9999, z: 9999, y: -5, pose: 2.6 }, 1200)[0].msg as any).w[0];
  assert.equal(e2[1], -400); assert.equal(e2[3], 220); assert.equal(e2[2], 2); assert.equal(e2[5], 3);
  assert.deepEqual(r.message('a', '{"t":"pos","x":0,"y":3,"z":0,"yaw":0,"pose":null}', 1400), []);
  assert.deepEqual(posW(r, 'a', { pose: 'x' }, 1400), []);
  assert.deepEqual(r.message('a', '{"t":"pos","x":0,"y":3,"z":0,"yaw":0}', 1400), [], 'thiếu pose');
  const e3 = (posW(r, 'a', { pose: -3, bank: 9 }, 1600)[0].msg as any).w[0];
  assert.equal(e3.length, 7); assert.equal(e3[5], 0);
});

test('multiParams.stroll: khung kẹp đúng giá trị của brief', () => {
  assert.deepEqual(P.stroll, { slots: 5, bounds: { x0: -400, x1: 400, z0: -1300, z1: 220 }, yMin: 2, yMax: 20, poseMax: 4 });
});

test('người bay gửi pos: định dạng f như trước (7 phần tử, kẹp floor 7 / ceiling 800); pos thiếu bank bị bỏ', () => {
  const r = new SkyRoom(); r.connect('a', 0); join(r, 'a', 'A');
  const m = pos(r, 'a', { x: 0, y: 1 }, 1000)[0].msg as any;
  assert.equal(m.f[0].length, 7); assert.equal(m.f[0][2], P.floor); assert.equal(m.w, undefined);
  assert.equal((pos(r, 'a', { x: 0, y: 5000 }, 1200)[0].msg as any).f[0][2], P.ceiling);
  assert.deepEqual(r.message('a', '{"t":"pos","x":0,"y":50,"z":0,"yaw":0,"pose":1}', 1400), []);
});

test('leave / disconnect / sweep trả đúng chỗ đi dạo và phát lobby mới', () => {
  const r = new SkyRoom();
  for (let i = 0; i < 3; i++) { r.connect('w' + i, 0); joinW(r, 'w' + i, 'W' + i); }
  const lv = r.message('w1', J({ t: 'leave' }), 0);
  assert.equal(lv[0].msg.t, 'lobby'); assert.deepEqual((lv[0].msg as any).walkers.map((w: any) => w.slot), [0, 2]);
  assert.equal(r.walkSlotOf('w1'), -1);
  assert.equal(has(joinW(r, 'w1', 'Lai'), o => o.msg.t === 'joined')[0].msg.slot, 1);
  const d = r.disconnect('w0');
  assert.deepEqual((d[0].msg as any).walkers.map((w: any) => w.slot), [1, 2]);
  r.message('w2', J({ t: 'hb' }), 9000);
  const s = r.sweep(P.slotTimeoutMs + 1);
  assert.equal(has(s, x => x.msg.t === 'released' && x.to === 'w1').length, 1);
  assert.deepEqual((has(s, x => x.msg.t === 'lobby')[0].msg as any).walkers, [{ slot: 2, name: 'W2' }]);
  assert.equal(r.hasFlyers(), true);
  r.disconnect('w2');
  assert.equal(r.hasFlyers(), false);
});

test('restore với kind walk dựng lại đúng nhóm; phần tử không có kind là người bay', () => {
  const r = new SkyRoom();
  r.restore([{ id: 'f', slot: 1, name: 'F' }, { id: 'w', slot: 1, name: 'W', kind: 'walk' }], 0);
  assert.equal(r.slotOf('f'), 1); assert.equal(r.walkSlotOf('f'), -1); assert.equal(r.kindOf('f'), 'fly');
  assert.equal(r.slotOf('w'), -1); assert.equal(r.walkSlotOf('w'), 1); assert.equal(r.kindOf('w'), 'walk');
  const r2 = new SkyRoom();
  r2.restore([{ id: 'w', slot: 0, name: 'W', kind: 'walk' }], 50000);
  assert.equal(r2.hasFlyers(), true);
  assert.equal(r2.seenOf('w') >= 0, true);
});

test('khách cũ (join không kind, pos có bank) giữa phòng có người đi dạo: slot bay, tin nhận về parse được theo ServerMsg cũ', () => {
  const r = new SkyRoom();
  for (let i = 0; i < 5; i++) { r.connect('w' + i, 0); joinW(r, 'w' + i, 'W' + i); }
  r.connect('old', 0);
  const jo = join(r, 'old', 'Cu');
  assert.deepEqual(jo[0].msg, { t: 'joined', slot: 0 });
  const lob = has(jo, o => o.msg.t === 'lobby')[0].msg as any;
  assert.deepEqual(lob.flyers, [{ slot: 0, name: 'Cu' }]);
  posW(r, 'w0', { x: 5 }, 1000);
  const m = pos(r, 'old', { x: 3, bank: 0.2 }, 1100)[0].msg as any;
  assert.equal(m.f.length, 1); assert.equal(m.f[0].length, 7); assert.equal(m.f[0][0], 0);
  assert.equal(JSON.parse(JSON.stringify(m)).t, 'pos');
  assert.equal(r.walkSlotOf('old'), -1);
});

/* ===== Chế độ lái xe (D-034): nhóm 5 slot thứ ba, gói pos {x, y, z, yaw, v, st}, phát nhóm d 8 phần tử ===== */
const joinD = (r: SkyRoom, id: string, name: string, now = 0) => r.message(id, J({ t: 'join', name, kind: 'drive' }), now);
const posD = (r: SkyRoom, id: string, o: any, now: number) => r.message(id, J({ t: 'pos', x: 0, y: 2.6, z: 0, yaw: 0, v: 10, st: 0.1, ...o }), now);

test('5 bay + 5 đi dạo + 5 lái cùng lúc, người lái thứ 6 bị từ chối full với kind drive', () => {
  const r = new SkyRoom();
  const fly: any[][] = [], walk: any[][] = [], drive: any[][] = [];
  for (let i = 0; i < 5; i++) { r.connect('f' + i, 0); fly.push(join(r, 'f' + i, 'F' + i)); }
  for (let i = 0; i < 5; i++) { r.connect('w' + i, 0); walk.push(joinW(r, 'w' + i, 'W' + i)); }
  for (let i = 0; i < 6; i++) { r.connect('d' + i, 0); drive.push(joinD(r, 'd' + i, 'D' + i)); }
  for (let i = 0; i < 5; i++) {
    assert.deepEqual(has(fly[i], o => o.msg.t === 'joined')[0].msg, { t: 'joined', slot: i });
    assert.deepEqual(has(walk[i], o => o.msg.t === 'joined')[0].msg, { t: 'joined', slot: i, kind: 'walk' });
    assert.deepEqual(has(drive[i], o => o.msg.t === 'joined')[0].msg, { t: 'joined', slot: i, kind: 'drive' });
    assert.equal(r.kindOf('d' + i), 'drive'); assert.equal(r.driveSlotOf('d' + i), i);
    assert.equal(r.slotOf('d' + i), -1); assert.equal(r.walkSlotOf('d' + i), -1);
  }
  assert.deepEqual(drive[5].map(o => o.msg), [{ t: 'rejected', why: 'full', kind: 'drive' }]);
  r.connect('f5', 0); assert.deepEqual(join(r, 'f5', 'F5').map(o => o.msg), [{ t: 'rejected', why: 'full' }]);
  r.connect('x', 0); assert.deepEqual(joinD(r, 'x', 'fuck').map(o => o.msg), [{ t: 'rejected', why: 'name', kind: 'drive' }]);
  assert.deepEqual(joinD(r, 'd0', 'Lai'), [], 'đang giữ chỗ lái: join lần nữa bị bỏ qua');
  assert.deepEqual(join(r, 'd0', 'Lai'), [], 'đang giữ chỗ lái: không giành thêm chỗ bay');
});

test('lobby có drivers: flyers / walkers / drivers tách riêng; lobby luôn có drivers', () => {
  const r = new SkyRoom();
  assert.deepEqual(r.connect('a', 0), [{ to: 'a', msg: { t: 'lobby', flyers: [], walkers: [], drivers: [] } }]);
  r.connect('b', 0); r.connect('c', 0);
  join(r, 'a', 'Bay'); joinW(r, 'b', 'Di');
  const l = has(joinD(r, 'c', 'Lai'), x => x.msg.t === 'lobby')[0].msg as any;
  assert.deepEqual(l.flyers, [{ slot: 0, name: 'Bay' }]);
  assert.deepEqual(l.walkers, [{ slot: 0, name: 'Di' }]);
  assert.deepEqual(l.drivers, [{ slot: 0, name: 'Lai' }]);
});

test('pos của người lái bị kẹp vào khung, v và st bị kẹp', () => {
  const r = new SkyRoom(); r.connect('a', 0); joinD(r, 'a', 'A');
  const D = P.drive;
  const e = (posD(r, 'a', { x: 99999, z: -99999, y: 500, v: 99, st: 9, yaw: 3 * Math.PI + 0.5 }, 1000)[0].msg as any).d[0];
  assert.deepEqual(e.slice(0, 4), [0, D.bounds.x1, D.yMax, D.bounds.z0]);
  assert.ok(Math.abs(e[4] - (0.5 - Math.PI)) < 1e-9, 'yaw quấn về ±π ' + e[4]);
  assert.equal(e[5], D.vMax); assert.equal(e[6], D.steerMax);
  const e2 = (posD(r, 'a', { x: -99999, z: 99999, y: -500, v: -99, st: -9 }, 1200)[0].msg as any).d[0];
  assert.deepEqual(e2.slice(1, 4), [D.bounds.x0, D.yMin, D.bounds.z1]);
  assert.equal(e2[5], -D.vMax, 'lùi: tốc độ có dấu'); assert.equal(e2[6], -D.steerMax);
  const e3 = (posD(r, 'a', { x: 12.5, y: 2.6, z: -30, v: -3.2, st: 0.25 }, 1400)[0].msg as any).d[0];
  assert.deepEqual(e3.slice(1, 7), [12.5, 2.6, -30, 0, -3.2, 0.25], 'trong khung: giữ nguyên');
  // kiểu sai / không hữu hạn / thiếu trường: bỏ cả gói
  for (const bad of [{ v: null }, { v: '1' }, { st: 'x' }, { st: null }, { x: true }, { yaw: [] }])
    assert.deepEqual(posD(r, 'a', bad, 1600), [], JSON.stringify(bad));
  assert.deepEqual(r.message('a', '{"t":"pos","x":0,"y":2.6,"z":0,"yaw":0,"v":1e999,"st":0}', 1600), [], 'v = Infinity');
  assert.deepEqual(r.message('a', '{"t":"pos","x":0,"y":2.6,"z":0,"yaw":0,"v":1}', 1600), [], 'thiếu st');
  assert.deepEqual(r.message('a', '{"t":"pos","x":0,"y":2.6,"z":0,"yaw":0,"bank":0.1}', 1600), [], 'gói kiểu bay từ người lái');
  assert.deepEqual(r.message('a', '{"t":"pos","x":0,"y":2.6,"z":0,"yaw":0,"pose":1}', 1600), [], 'gói kiểu đi dạo từ người lái');
  // tần suất như các loại khác
  const r2 = new SkyRoom(); r2.connect('a', 0); joinD(r2, 'a', 'A');
  for (let i = 0; i < P.posMaxPerSec; i++) posD(r2, 'a', { x: i }, 10000 + i);
  assert.deepEqual(posD(r2, 'a', { x: 5 }, 10500), []);
});

test('gói pos phát có nhóm d 8 phần tử, không lẫn sang f / w', () => {
  const r = new SkyRoom();
  r.connect('a', 0); r.connect('b', 0); r.connect('c', 0);
  join(r, 'a', 'A'); joinW(r, 'b', 'B'); joinD(r, 'c', 'C');
  const o = posD(r, 'c', { x: 10, yaw: 1, v: 5, st: -0.2, ts: 777 }, 1000);
  assert.equal(o.length, 1); assert.equal(o[0].to, 'all');
  const m = o[0].msg as any;
  assert.deepEqual(m.f, [], 'f luôn có (khách cũ đọc m.f)'); assert.equal(m.w, undefined);
  assert.deepEqual(m.d, [[0, 10, 2.6, 0, 1, 5, -0.2, 777]]);
  assert.deepEqual(posD(r, 'c', { x: 11 }, 1010), [], 'hãm trong cửa sổ broadcastMs');
  const m2 = r.message('c', J({ t: 'hb' }), 1200)[0].msg as any;
  assert.equal(m2.d[0][1], 11); assert.equal(m2.d[0][7], 1010, 'không gửi ts: giờ máy chủ nhận');
  const m2b = posD(r, 'c', { x: 12, ts: 1.79e308 }, 1400)[0].msg as any;
  assert.equal(m2b.d[0][7], 1400, 'ts quá lớn: dùng giờ máy chủ');
  // cả ba loại cùng cử động: mỗi loại ở đúng nhóm của mình
  assert.deepEqual(pos(r, 'a', { x: 1 }, 1410), []); assert.deepEqual(posW(r, 'b', { x: 2 }, 1420), []);   // hãm trong cửa sổ, đi chung gói sau
  const m3 = posD(r, 'c', { x: 3 }, 1600)[0].msg as any;
  assert.equal(m3.f.length, 1); assert.equal(m3.f[0].length, 7); assert.equal(m3.f[0][1], 1);
  assert.equal(m3.w.length, 1); assert.equal(m3.w[0].length, 7); assert.equal(m3.w[0][1], 2);
  assert.equal(m3.d.length, 1); assert.equal(m3.d[0].length, 8); assert.equal(m3.d[0][1], 3);
  const m4 = pos(r, 'a', { x: 4 }, 1800)[0].msg as any;
  assert.equal(m4.d, undefined, 'không người lái nào cử động thì không có d');
  // người bay gửi gói kiểu lái: thiếu bank, bị bỏ (phân loại theo slot của kết nối, không theo trường)
  assert.deepEqual(r.message('a', J({ t: 'pos', x: 0, y: 50, z: 0, yaw: 0, v: 1, st: 0 }), 2000), []);
});

test('leave / disconnect / sweep trả đúng chỗ lái; hasFlyers tính cả người lái', () => {
  const r = new SkyRoom();
  for (let i = 0; i < 3; i++) { r.connect('d' + i, 0); joinD(r, 'd' + i, 'D' + i); }
  const lv = r.message('d1', J({ t: 'leave' }), 0);
  assert.deepEqual((lv[0].msg as any).drivers.map((w: any) => w.slot), [0, 2]);
  assert.equal(r.driveSlotOf('d1'), -1); assert.equal(r.kindOf('d1'), null);
  assert.equal(has(joinD(r, 'd1', 'Lai'), o => o.msg.t === 'joined')[0].msg.slot, 1);
  const d = r.disconnect('d0');
  assert.deepEqual((d[0].msg as any).drivers.map((w: any) => w.slot), [1, 2]);
  r.message('d2', J({ t: 'hb' }), 9000);
  assert.equal(r.seenOf('d2'), 9000);
  const s = r.sweep(P.slotTimeoutMs + 1);
  assert.equal(has(s, x => x.msg.t === 'released' && x.to === 'd1').length, 1);
  assert.deepEqual((has(s, x => x.msg.t === 'lobby')[0].msg as any).drivers, [{ slot: 2, name: 'D2' }]);
  assert.equal(r.hasFlyers(), true);
  r.disconnect('d2');
  assert.equal(r.hasFlyers(), false);
});

test('khôi phục sau hibernation giữ slot lái; slot ngoài khoảng bị bỏ', () => {
  const r = new SkyRoom();
  r.restore([{ id: 'f', slot: 1, name: 'F' }, { id: 'w', slot: 1, name: 'W', kind: 'walk' }, { id: 'd', slot: 1, name: 'D', kind: 'drive', seen: 400 }, { id: 'e', slot: 9, name: 'E', kind: 'drive' }], 1000);
  assert.equal(r.kindOf('f'), 'fly'); assert.equal(r.kindOf('w'), 'walk'); assert.equal(r.kindOf('d'), 'drive');
  assert.equal(r.driveSlotOf('d'), 1); assert.equal(r.slotOf('d'), -1); assert.equal(r.walkSlotOf('d'), -1);
  assert.equal(r.seenOf('d'), 400); assert.equal(r.kindOf('e'), null);
  const m = posD(r, 'd', { x: 5 }, 2000)[0].msg as any;
  assert.deepEqual(m.d.map((e: number[]) => e[0]), [1]);
  const r2 = new SkyRoom();
  r2.restore([{ id: 'd', slot: 0, name: 'D', kind: 'drive' }], 50000);
  assert.equal(r2.hasFlyers(), true);
  r2.sweep(50000 + P.heartbeatMs + 1); assert.equal(r2.driveSlotOf('d'), -1, 'không có seen: một chu kỳ nhịp sống như người bay');
});

test('khách cũ (bay, đi dạo) giữa phòng đầy người lái: vẫn được chỗ của họ, gói pos vẫn có f', () => {
  const r = new SkyRoom();
  for (let i = 0; i < 5; i++) { r.connect('d' + i, 0); joinD(r, 'd' + i, 'D' + i); }
  r.connect('old', 0); r.connect('oldw', 0);
  assert.deepEqual(join(r, 'old', 'Cu')[0].msg, { t: 'joined', slot: 0 });
  assert.deepEqual(joinW(r, 'oldw', 'Cu2')[0].msg, { t: 'joined', slot: 0, kind: 'walk' });
  const m = posD(r, 'd3', { x: 5 }, 1000)[0].msg as any;
  assert.ok(Array.isArray(m.f)); assert.equal(m.d[0][0], 3);
});
