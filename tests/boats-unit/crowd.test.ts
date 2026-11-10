// Tàu tụ tập ban đêm (docs/superpowers/specs/2026-11-10-tau-thuyen-song-han-design.md, G5, G6, §5)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../src/config.ts';
import { btCrowdSlots, btInExclusion, btCrowdAlpha } from '../../src/environment/boats/crowd.ts';

test('slots đủ số: 8 quanh Cầu Rồng, 7 quanh Cầu sông Hàn', () => {
  const s = btCrowdSlots();
  assert.equal(s.length, 15);
  assert.equal(s.filter((b) => Math.abs(b.z) < 300).length, 8);
  assert.equal(s.filter((b) => Math.abs(b.z + 1080) < 300).length, 7);
});

test('slots ngoài vùng cấm', () => {
  for (const b of btCrowdSlots()) assert.equal(btInExclusion(b.x, b.z, b.len / 2), false, `tàu ở (${b.x.toFixed(1)}, ${b.z.toFixed(1)}) nằm trong vùng cấm`);
});

test('slots cách nhau ít nhất minGap', () => {
  const s = btCrowdSlots(), g = CONFIG.boats.crowd.minGap;
  for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) assert.ok(Math.hypot(s[i].x - s[j].x, s[i].z - s[j].z) >= g, `tàu ${i} và ${j} quá gần`);
});

test('slots tất định', () => {
  assert.deepEqual(btCrowdSlots(), btCrowdSlots());
});

test('slots nhiều kiểu, không hai tàu giống hệt trong một cụm', () => {
  const s = btCrowdSlots();
  for (const group of [s.filter((b) => Math.abs(b.z) < 300), s.filter((b) => Math.abs(b.z + 1080) < 300)]) {
    assert.ok(new Set(group.map((b) => b.type)).size >= 2);
    for (const b of group) assert.ok(['A', 'B', 'C'].includes(b.type));
    const keys = group.map((b) => `${b.type}|${b.variant}|${b.led}`);
    assert.equal(new Set(keys).size, keys.length);
  }
});

test('exclusion biên', () => {
  assert.equal(btInExclusion(0, -1700, 5), true);      // hành lang hầm
  assert.equal(btInExclusion(-22, 400, 10), true);     // làn tàu chạy
  assert.equal(btInExclusion(0, -1080, 10), true);     // vòng quay Cầu sông Hàn
  assert.equal(btInExclusion(250, 100, 10), true);     // sát kè
  assert.equal(btInExclusion(-150, 120, 12), false);   // mặt nước trống phía Tây Cầu Rồng
});

test('alpha: ngày 0, đêm 1, bão 0', () => {
  for (let i = 0; i < 15; i++) {
    assert.equal(btCrowdAlpha(i, 15, 0, 0), 0);
    assert.equal(btCrowdAlpha(i, 15, 1, 0), 1);
    assert.equal(btCrowdAlpha(i, 15, 1, 1), 0);
  }
});

test('alpha không giảm khi trời tối dần', () => {
  for (let i = 0; i < 15; i++) {
    let prev = 0;
    for (let k = 0; k <= 100; k++) { const a = btCrowdAlpha(i, 15, k / 100, 0); assert.ok(a >= prev - 1e-9, `tàu ${i} giảm ở night ${k / 100}`); prev = a; }
  }
});

test('alpha so le giữa hai ngưỡng đêm', () => {
  const [n0, n1] = CONFIG.boats.crowd.nightOn, mid = (n0 + n1) / 2;
  const a = Array.from({ length: 15 }, (_, i) => btCrowdAlpha(i, 15, mid, 0));
  assert.ok(a.some((x) => x > 0 && x < 1));
  assert.ok(new Set(a.map((x) => x.toFixed(4))).size > 1);
});
