/* ===== Lái xe: test vật cản cứng tĩnh (src/explore/drive/solids.ts) =====
   Thân rồng chặn đúng tầng mặt cầu; làn xe bốn cầu và hai ống hầm thông suốt; tường ống hầm chặn; lề cầu chặn ngay ngoài mép ô;
   trụ Cầu Rồng (x = −294) và trụ Trần Thị Lý trên dải giữa đường ven sông có mặt nhưng không lấn ô nào; không vật cản nào trong ô nhánh rẽ. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../src/config.ts';
import { deckY } from '../../src/bridges/dragon/profile.ts';
import { SH, shRoadY } from '../../src/bridges/song-han/profile.ts';
import { TTL, ttlRoadY } from '../../src/bridges/tran-thi-ly/profile.ts';
import { TP, tpRoadY } from '../../src/bridges/thuan-phuoc/profile.ts';
import { HR, hrRoadY } from '../../src/bridges/han-tunnel/profile.ts';
import type { DrSolid } from '../../src/explore/drive/net.ts';
import { drBuildPads } from '../../src/explore/drive/roadData.ts';
import { drBuildSolids, DR_BARRIER_W, DR_BARRIER_E, DR_BARRIER_X } from '../../src/explore/drive/solids.ts';

const solids = drBuildSolids();
const pads = drBuildPads();

/* Điểm (x, z) ở cao độ y có nằm trong vật cản s không */
function inside(s: DrSolid, x: number, z: number, y: number): boolean {
  if (y < s.y0 || y > s.y1) return false;
  if (s.kind === 'circle') return (x - s.cx) ** 2 + (z - s.cz) ** 2 <= s.r * s.r;
  return x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1;
}
const hits = (x: number, z: number, y: number) => solids.filter((s) => inside(s, x, z, y));
/* Vật cản có chiếm khoảng cao độ [ya, yb] tại (x, z) không */
const hitsBand = (x: number, z: number, ya: number, yb: number) => solids.filter((s) => s.y1 >= ya && s.y0 <= yb && inside(s, x, z, Math.min(Math.max(ya, s.y0), s.y1)));

test('vật cản hợp lệ: số hữu hạn, có bề rộng và chiều cao', () => {
  assert.ok(solids.length > 0);
  for (const s of solids) {
    assert.ok(Number.isFinite(s.y0) && Number.isFinite(s.y1) && s.y1 > s.y0, JSON.stringify(s));
    if (s.kind === 'circle') assert.ok(Number.isFinite(s.cx) && Number.isFinite(s.cz) && s.r > 0, JSON.stringify(s));
    else assert.ok([s.x0, s.x1, s.z0, s.z1].every(Number.isFinite) && s.x1 > s.x0 && s.z1 > s.z0, JSON.stringify(s));
  }
});

test('thân rồng chặn ở tầng mặt cầu, không chặn đường ven sông bên dưới', () => {
  assert.ok(hits(0, 0, deckY(0) + 1).length > 0, 'giữa nhịp chính, trên dải giữa');
  assert.deepEqual(hitsBand(-305, 30, 2.6, 4.3), []);
});

/* Thân xe đầy đủ (rộng ±width/2, từ y+0,1 tới y+height) quét tại (x, z) có chạm vật cản nào không */
function bodyHits(x: number, z: number, y: number): DrSolid[] {
  const hw = CONFIG.drive.car.width / 2, ya = y + 0.1, yb = y + CONFIG.drive.car.height;
  return solids.filter((s) => {
    if (s.y1 < ya || s.y0 > yb) return false;
    if (s.kind === 'circle') return (x - s.cx) ** 2 + Math.max(0, Math.abs(z - s.cz) - hw) ** 2 <= s.r * s.r;
    return x >= s.x0 && x <= s.x1 && z + hw >= s.z0 && z - hw <= s.z1;
  });
}

test('mỗi làn xe của mỗi cầu và hầm thông suốt cho thân xe đầy đủ', () => {
  const lanes = (inner: number, w: number, n: number) => Array.from({ length: n }, (_, i) => inner + w * (i + 0.5));
  const tun = pads.filter((p) => p.kind === 'tunnel');
  assert.ok(tun.length > 0);
  const cases: { name: string; z: number; offs: number[]; x0: number; x1: number; y: (x: number) => number }[] = [
    { name: 'Cầu Rồng', z: 0, offs: lanes(CONFIG.median / 2, CONFIG.laneWidth, CONFIG.lanesPerDir), x0: -CONFIG.length / 2, x1: CONFIG.length / 2, y: deckY },
    { name: 'Cầu sông Hàn', z: SH.z, offs: [SH.lane], x0: -290, x1: 290, y: shRoadY },
    { name: 'Trần Thị Lý', z: TTL.z, offs: TTL.laneOffsets, x0: -470, x1: 450, y: ttlRoadY },
    { name: 'Thuận Phước', z: TP.z, offs: lanes(TP.median / 2, TP.laneWidth, 2), x0: -(TP.endX + TP.embankment), x1: TP.endX + TP.embankment, y: tpRoadY },
    { name: 'Hầm', z: HR.z, offs: HR.laneOffsets, x0: Math.min(...tun.map((p) => p.x0)), x1: Math.max(...tun.map((p) => p.x1)), y: hrRoadY }
  ];
  for (const c of cases) for (const o of c.offs) for (const s of [-1, 1]) {
    for (let x = c.x0; x <= c.x1; x += 1) {
      const h = bodyHits(x, c.z + s * o, c.y(x));
      assert.deepEqual(h, [], `${c.name} làn ${s * o} tại x = ${x}`);
    }
  }
});

test('lề cầu chặn ngay ngoài mép ô làn ngoài', () => {
  const out: [string, number, number, (x: number) => number][] = [
    ['Cầu Rồng', 0, CONFIG.median / 2 + CONFIG.lanesPerDir * CONFIG.laneWidth + CONFIG.shoulder - 0.35, deckY],
    ['Cầu sông Hàn', SH.z, SH.lane + SH.laneWidth / 2, shRoadY],
    ['Trần Thị Lý', TTL.z, TTL.median / 2 + TTL.lanesPerDir * TTL.laneWidth, ttlRoadY],
    ['Thuận Phước', TP.z, TP.median / 2 + 2 * TP.laneWidth, tpRoadY]
  ];
  for (const [name, zc, edge, y] of out) for (const s of [-1, 1]) for (const x of [-100, 30, 150]) {
    assert.ok(hits(x, zc + s * (edge + 0.1), y(x) + 0.3).length > 0, `${name} chiều ${s} x = ${x}`);
  }
});

test('tường hầm', () => {
  const half = (HR.shoulder * 2 + HR.laneWidth * HR.lanesPerDir) / 2, y = hrRoadY(0) + 0.8;
  for (const s of [-1, 1]) for (const d of [-1, 1]) {
    const z = HR.z + s * (HR.tubeCenter + d * (half + 0.05));
    assert.ok(hits(0, z, y).length > 0, `ống ${s}, phía ${d}`);
  }
  for (const x of [-600, 600]) for (const s of [-1, 1]) {           // hầm hở: tường ngoài và dải giữa
    assert.ok(hits(x, HR.z + s * (HR.tubeFar + 0.3), hrRoadY(x) + 0.8).length > 0, `tường hầm hở x = ${x}`);
    assert.ok(hits(x, HR.z + s * (HR.tubeNear - 0.3), hrRoadY(x) + 0.8).length > 0, `dải giữa hầm hở x = ${x}`);
  }
  assert.deepEqual(hitsBand(-CONFIG.drive.roads.riverX - 6, HR.z + HR.tubeCenter, CONFIG.roadY, CONFIG.roadY + 1.7), [], 'đường ven sông trên hầm');
});

test('trụ Cầu Rồng trên Bạch Đằng có mặt, không vật cản nào trong ô nhánh rẽ', () => {
  for (const z of [-8.5, 8.5]) assert.ok(hits(-294, z, CONFIG.roadY + 1).length > 0, `trụ z = ${z}`);
  const slips = pads.filter((p) => p.kind === 'slip');
  assert.ok(slips.length >= 8);
  for (const p of slips) for (const s of solids) {
    if (s.y1 < CONFIG.roadY || s.y0 > CONFIG.roadY + CONFIG.drive.car.height) continue;
    const [x0, x1, z0, z1] = s.kind === 'circle' ? [s.cx - s.r, s.cx + s.r, s.cz - s.r, s.cz + s.r] : [s.x0, s.x1, s.z0, s.z1];
    assert.ok(!(x1 > p.x0 && x0 < p.x1 && z1 > p.z0 && z0 < p.z1), `${p.id} chứa ${JSON.stringify(s)}`);
  }
});

test('không vật cản nào lấn ô cùng tầng quá 0,1 m', () => {
  /* cho phép: gờ chắn bánh lấn 0,005 m, hộp barie Cầu sông Hàn lấn làn 0,075 m (đúng hình vẽ) */
  for (const p of pads) for (const s of solids) {
    const [x0, x1, z0, z1] = s.kind === 'circle' ? [s.cx - s.r, s.cx + s.r, s.cz - s.r, s.cz + s.r] : [s.x0, s.x1, s.z0, s.z1];
    const ox = Math.min(x1, p.x1) - Math.max(x0, p.x0), oz = Math.min(z1, p.z1) - Math.max(z0, p.z0);
    if (ox <= 0.1 || oz <= 0.1) continue;
    const y = p.y((Math.max(x0, p.x0) + Math.min(x1, p.x1)) / 2, (Math.max(z0, p.z0) + Math.min(z1, p.z1)) / 2);
    assert.ok(s.y1 < y + 0.1 || s.y0 > y + CONFIG.drive.car.height, `${p.id} bị lấn ${ox.toFixed(2)} × ${oz.toFixed(2)} m bởi ${JSON.stringify(s)}`);
  }
});

test('trụ Trần Thị Lý trên dải giữa đường ven sông, không lấn ô đường', () => {
  for (const x of [-CONFIG.drive.roads.riverX, CONFIG.drive.roads.riverX]) {
    assert.ok(hits(x, TTL.z, CONFIG.roadY + 1).length > 0, `trụ x = ${x}`);
    for (const p of pads) {                                         // ô cùng tầng mặt đất quanh trụ
      if (Math.abs(p.y(x, TTL.z) - CONFIG.roadY) > 0.1) continue;
      for (const s of hits(x, TTL.z, CONFIG.roadY + 1)) assert.ok(!(s.x1 > p.x0 && s.x0 < p.x1 && s.z1 > p.z0 && s.z0 < p.z1), `${p.id} lấn trụ`);
    }
  }
});

test('barie Cầu sông Hàn: tên cổng và vị trí', () => {
  assert.notEqual(DR_BARRIER_W, DR_BARRIER_E);
  assert.equal(DR_BARRIER_X[DR_BARRIER_W], -SH.barrierX);
  assert.equal(DR_BARRIER_X[DR_BARRIER_E], SH.barrierX);
  for (const x of [-SH.barrierX, SH.barrierX]) assert.ok(hits(x, SH.z + SH.hw - SH.sidewalk + 0.15, shRoadY(x) + 0.8).length > 0, `hộp barie x = ${x}`);
});
