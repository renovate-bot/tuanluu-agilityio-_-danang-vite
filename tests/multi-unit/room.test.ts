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
  assert.deepEqual(c, [{ to: 'a', msg: { t: 'lobby', flyers: [] } }]);
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
