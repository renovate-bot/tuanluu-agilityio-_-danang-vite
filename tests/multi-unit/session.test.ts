import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MultiSession } from '../../src/explore/multi/session.ts';
import type { Transport } from '../../src/explore/multi/client.ts';

class Fake implements Transport {
  sent: any[] = []; closed = false;
  onMessage: (m: any) => void = () => {}; onClose: () => void = () => {};
  send(m: any) { this.sent.push(m); }
  close() { this.closed = true; }
}
const fl = (...slots: number[]) => slots.map(s => ({ slot: s, name: 'P' + s }));
async function make(pick = (n: number) => 0) {
  const t = new Fake();
  const s = new MultiSession(() => Promise.resolve(t), pick);
  let changes = 0; s.onChange = () => { changes++; };
  s.open();
  await Promise.resolve(); await Promise.resolve();
  return { t, s, changes: () => changes };
}
const lobby = (t: Fake, ...slots: number[]) => t.onMessage({ t: 'lobby', flyers: fl(...slots) });

test('kết nối lỗi: phase solo, notice offline', async () => {
  const s = new MultiSession(() => Promise.reject(new Error('x')));
  s.open(); assert.equal(s.phase, 'connecting');
  await new Promise(r => setTimeout(r, 0));
  assert.equal(s.phase, 'solo'); assert.equal(s.notice, 'offline');
});

test('lobby đầu có 5 flyers: watching, watched thuộc 5 slot đó', async () => {
  const { t, s } = await make(n => n - 1);
  lobby(t, 0, 1, 2, 3, 4);
  assert.equal(s.phase, 'watching'); assert.equal(s.watched, 4); assert.equal(s.invite, false);
});

test('lobby đầu < 5: phase lobby', async () => {
  const { t, s } = await make(); lobby(t, 1, 2);
  assert.equal(s.phase, 'lobby'); assert.equal(s.flyers.length, 2);
});

test('join → joined: flying, mySlot đúng', async () => {
  const { t, s } = await make(); lobby(t, 1);
  s.join('An'); assert.deepEqual(t.sent.at(-1), { t: 'join', name: 'An' }); assert.equal(s.name, 'An');
  t.onMessage({ t: 'joined', slot: 3 });
  assert.equal(s.phase, 'flying'); assert.equal(s.mySlot, 3);
});

test('rejected full ở lobby: watching, giữ name', async () => {
  const { t, s } = await make(); lobby(t, 0, 1, 2, 3);
  s.join('An'); lobby(t, 0, 1, 2, 3, 4); t.onMessage({ t: 'rejected', why: 'full' });
  assert.equal(s.phase, 'watching'); assert.equal(s.name, 'An');
});

test('rejected name: phase giữ nguyên, notice nameBad', async () => {
  const { t, s } = await make(); lobby(t);
  s.join('x'); t.onMessage({ t: 'rejected', why: 'name' });
  assert.equal(s.phase, 'lobby'); assert.equal(s.notice, 'nameBad');
});

test('watching, flyers < 5: invite true; join rồi rejected full: notice late', async () => {
  const { t, s } = await make(); lobby(t, 0, 1, 2, 3, 4);
  lobby(t, 0, 1, 2, 3); assert.equal(s.invite, true);
  s.join('An'); t.onMessage({ t: 'rejected', why: 'full' });
  assert.equal(s.notice, 'late'); assert.equal(s.phase, 'watching');
});

test('người đang xem rời đi: watched đổi; không còn ai: -1, invite true', async () => {
  const { t, s } = await make(); lobby(t, 0, 1, 2, 3, 4);
  assert.equal(s.watched, 0);
  lobby(t, 1, 2, 3, 4); assert.notEqual(s.watched, 0); assert.ok([1, 2, 3, 4].includes(s.watched));
  lobby(t); assert.equal(s.watched, -1); assert.equal(s.invite, true);
});

test('flyers đổi nhưng người đang xem còn: watched không đổi', async () => {
  const { t, s } = await make(n => n - 1); lobby(t, 0, 1, 2, 3, 4);
  assert.equal(s.watched, 4); lobby(t, 1, 4); assert.equal(s.watched, 4);
});

test('đóng kết nối khi flying: solo, lost, flyers rỗng, mySlot -1', async () => {
  const { t, s } = await make(); lobby(t, 1); s.join('An'); t.onMessage({ t: 'joined', slot: 2 });
  t.onClose();
  assert.equal(s.phase, 'solo'); assert.equal(s.notice, 'lost'); assert.equal(s.flyers.length, 0); assert.equal(s.mySlot, -1);
});

test('đóng kết nối khi watching: notice lost, phase solo', async () => {
  const { t, s } = await make(); lobby(t, 0, 1, 2, 3, 4); t.onClose();
  assert.equal(s.phase, 'solo'); assert.equal(s.notice, 'lost');
});

test('released khi flying: watching, notice released', async () => {
  const { t, s } = await make(); lobby(t, 1); s.join('An'); t.onMessage({ t: 'joined', slot: 2 });
  t.onMessage({ t: 'released' });
  assert.equal(s.phase, 'watching'); assert.equal(s.notice, 'released'); assert.equal(s.mySlot, -1);
});

test('leave khi flying: gửi leave, chuyển watching, không chọn xem chính mình', async () => {
  const { t, s } = await make(); lobby(t, 1); s.join('An'); t.onMessage({ t: 'joined', slot: 2 });
  lobby(t, 1, 2); s.leave();
  assert.deepEqual(t.sent.at(-1), { t: 'leave' });
  assert.equal(s.phase, 'watching'); assert.equal(s.mySlot, -1); assert.equal(s.watched, 1);
  assert.equal(s.notice, 'released');   // rời máy: cùng thông báo với khi máy chủ thu hồi chỗ
});

test('sendPos ngoài flying không gửi; heartbeat chỉ khi flying', async () => {
  const { t, s } = await make(); lobby(t, 1);
  s.sendPos(1, 2, 3, 0, 0); s.heartbeat(); assert.equal(t.sent.length, 0);
  s.join('An'); t.onMessage({ t: 'joined', slot: 2 }); t.sent.length = 0;
  s.sendPos(1, 2, 3, 0.5, 0.1); s.heartbeat();
  assert.deepEqual(t.sent, [{ t: 'pos', x: 1, y: 2, z: 3, yaw: 0.5, bank: 0.1 }, { t: 'hb' }]);
});

test('pos chuyển cho onPos; dispose đóng và bỏ qua tin sau đó', async () => {
  const { t, s } = await make(); let got: any = null; s.onPos = f => { got = f; };
  t.onMessage({ t: 'pos', f: [[1, 0, 0, 0, 0, 0]] }); assert.deepEqual(got, [[1, 0, 0, 0, 0, 0]]);
  s.dispose(); assert.equal(t.closed, true); t.onClose(); assert.notEqual(s.notice, 'lost');
});
