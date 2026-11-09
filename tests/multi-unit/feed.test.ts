/* Mô phỏng đường đi gói vị trí: người gửi → máy chủ (SkyRoom) → người xem (ExTrack.feed), có trễ mạng ngẫu nhiên.
   Dù bay thẳng đều thì vị trí nội suy lấy mẫu mỗi 50 ms phải tăng đều; trước bản sửa, mẫu lặp lại vị trí cũ làm dù đứng rồi vọt. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SkyRoom } from '../../server/multi/src/room.ts';
import { ExTrack } from '../../src/explore/multi/interp.ts';
import { multiParams as P } from '../../src/explore/multi/params.ts';

const V = 15, STEP = 50, DELAY = P.interpSends * 1000 / P.sendHz;   // m/s; ms giữa hai lần lấy mẫu; ms trễ nội suy như remote.ts

function lcg(seed: number) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }

/* Máy chủ trước bản sửa: giữ vị trí cuối mọi slot, phát tất cả khi cách lần trước >= broadcastMs, không kèm giờ */
class OldServer {
  last = new Map<number, number[]>(); lb = -Infinity;
  pos(slot: number, m: any, now: number): number[][] | null {
    this.last.set(slot, [slot, m.x, m.y, m.z, m.yaw, m.bank]);
    if (now - this.lb < P.broadcastMs) return null;
    this.lb = now; return [...this.last.values()];
  }
}

/* senders: số người gửi (slot 0 là người được theo dõi); server 'new' | 'old'; client 'new' (feed) | 'old' (push giờ nhận). Trả các bước dịch chuyển mỗi STEP ms */
function simulate(server: 'new' | 'old', client: 'new' | 'old', senders = 3, seed = 7): number[] {
  const rnd = lcg(seed), period = 1000 / P.sendHz;
  const room = new SkyRoom(), old = new OldServer();
  for (let i = 0; i < senders; i++) { room.connect('s' + i, 0); room.message('s' + i, JSON.stringify({ t: 'join', name: 'S' + i }), 0); }
  // Gói tới máy chủ: mỗi người gửi một nhịp lệch pha + rung ±15 ms, trễ lên 20–60 ms (giữ thứ tự từng kết nối)
  const arrive: { t: number; i: number; m: any }[] = [];
  for (let i = 0; i < senders; i++) {
    const phase = rnd() * period; let prev = 0;
    for (let k = 0; k < 40; k++) {
      const ts = Math.round(500 + phase + k * period + (rnd() - 0.5) * 30);
      const t = Math.max(prev + 1, ts + 20 + rnd() * 40); prev = t;
      arrive.push({ t, i, m: { t: 'pos', x: (i === 0 ? V * ts / 1000 : i * 100), y: 100, z: 0, yaw: 0, bank: 0, ts } });
    }
  }
  arrive.sort((a, b) => a.t - b.t);
  // Gói từ máy chủ tới người xem: trễ 20–60 ms, giữ thứ tự
  const deliver: { t: number; f: number[][] }[] = []; let prevD = 0;
  for (const a of arrive) {
    let f: number[][] | null = null;
    if (server === 'new') { const o = room.message('s' + a.i, JSON.stringify(a.m), a.t).find(x => x.msg.t === 'pos'); if (o) f = (o.msg as any).f; }
    else f = old.pos(a.i, a.m, a.t);
    if (!f) continue;
    prevD = Math.max(prevD + 0.1, a.t + 20 + rnd() * 40);
    deliver.push({ t: prevD, f: f.map(e => e.slice()) });
  }
  const tr = new ExTrack(), out = { x: 0, y: 0, z: 0, yaw: 0, bank: 0 };
  const xs: number[] = []; let d = 0;
  for (let t = 0; t <= 7500; t += 5) {
    while (d < deliver.length && deliver[d].t <= t) {
      for (const e of deliver[d].f) if (e[0] === 0) { if (client === 'new') tr.feed(e, deliver[d].t, P.clockRelax, P.clockSlewMs); else tr.push(deliver[d].t, e[1], e[2], e[3], e[4], e[5]); }
      d++;
    }
    if (t >= 2500 && t <= 7000 && t % STEP === 0) { tr.sample(t - DELAY, out); xs.push(out.x); }
  }
  return xs.slice(1).map((x, k) => x - xs[k]);
}
const dev = (ds: number[]) => Math.max(...ds.map(d => Math.abs(d - V * STEP / 1000)));
const sd = (ds: number[]) => { const m = ds.reduce((a, b) => a + b, 0) / ds.length; return Math.sqrt(ds.reduce((a, b) => a + (b - m) ** 2, 0) / ds.length); };

test('khách mới + máy chủ mới: dù bay thẳng đều thì bước nội suy gần như không đổi', () => {
  for (const seed of [1, 7, 42]) {
    const ds = simulate('new', 'new', 3, seed);
    assert.ok(dev(ds) < 0.1, `seed ${seed}: lệch tối đa ${dev(ds).toFixed(3)} m / ${STEP} ms (đúng ${V * STEP / 1000}); bước: ${ds.map(x => x.toFixed(2)).join(' ')}`);
  }
});

test('khách mới + máy chủ cũ: không đứng yên, không giật hơn khách cũ', () => {
  for (const seed of [1, 7, 42]) {
    const nw = simulate('old', 'new', 3, seed), od = simulate('old', 'old', 3, seed);
    assert.ok(Math.min(...nw) > 0.05, `seed ${seed}: có bước đứng yên: ${nw.map(x => x.toFixed(2)).join(' ')}`);
    assert.ok(sd(nw) < sd(od), `seed ${seed}: độ lệch chuẩn ${sd(nw).toFixed(3)} (khách mới) ≥ ${sd(od).toFixed(3)} (khách cũ)`);
  }
});

test('khách cũ + máy chủ mới: không đứng yên, không giật hơn khách cũ + máy chủ cũ', () => {
  for (const seed of [1, 7, 42]) {
    const nw = simulate('new', 'old', 3, seed), od = simulate('old', 'old', 3, seed);
    assert.ok(Math.min(...nw) > 0.05, `seed ${seed}: có bước đứng yên: ${nw.map(x => x.toFixed(2)).join(' ')}`);
    assert.ok(sd(nw) < sd(od), `seed ${seed}: độ lệch chuẩn ${sd(nw).toFixed(3)} (máy chủ mới) ≥ ${sd(od).toFixed(3)} (máy chủ cũ)`);
  }
});
