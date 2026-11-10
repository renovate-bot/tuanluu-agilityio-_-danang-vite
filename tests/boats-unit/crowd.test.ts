// Tàu tụ tập ban đêm (docs/superpowers/specs/2026-11-10-tau-thuyen-song-han-design.md, G5, G6, §5)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../src/config.ts';
import { btCrowdSlots, btInExclusion, btCrowdTarget, btCrowdLevel, btCrowdShown } from '../../src/environment/boats/crowd.ts';

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

test('mục tiêu: ngày 0, đêm 1, bão 0', () => {
  assert.equal(btCrowdTarget(0, 0), 0);
  assert.equal(btCrowdTarget(1, 0), 1);
  assert.equal(btCrowdTarget(1, 1), 0);
});

test('mức hiện tiến chậm: từ 0 lên 1 mất ít nhất spreadSec', () => {
  const S = CONFIG.boats.crowd.spreadSec;
  let l = 0, t = 0;
  while (l < 1 && t < 100) { l = btCrowdLevel(l, 1, 0.05); t += 0.05; }
  assert.ok(t >= S - 1e-6, `lên đủ sau ${t.toFixed(2)} s`);
  assert.ok(btCrowdLevel(0.5, 0.2, 0.05) < 0.5 && btCrowdLevel(0.5, 0.2, 0.05) >= 0.5 - 0.05 / S - 1e-9);
});

test('hiện theo mức: 0 không tàu nào, 1 đủ 15, không mất tàu khi mức tăng', () => {
  for (let k = 0; k < 15; k++) { assert.equal(btCrowdShown(k, 0), false); assert.equal(btCrowdShown(k, 1), true); }
  for (let k = 0; k < 15; k++) { let prev = false; for (let i = 0; i <= 100; i++) { const v = btCrowdShown(k, i / 100); assert.ok(!(prev && !v)); prev = v; } }
});

test('so le: bật đêm đột ngột thì tàu đầu và tàu cuối hiện cách nhau ≥ 3 s, mỗi tàu hiện đủ kích thước (không co giãn)', () => {
  let l = 0, t = 0, first = -1, last = -1;
  while (t < 60) {
    l = btCrowdLevel(l, btCrowdTarget(1, 0), 0.05); t += 0.05;
    const n = Array.from({ length: 15 }, (_, k) => btCrowdShown(k, l)).filter(Boolean).length;
    if (n > 0 && first < 0) first = t; if (n === 15) { last = t; break; }
  }
  assert.ok(last - first >= 3, `${first.toFixed(2)} → ${last.toFixed(2)} s`);
});
