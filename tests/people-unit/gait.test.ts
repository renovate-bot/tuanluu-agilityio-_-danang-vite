// Dáng đi / dáng chạy người đi bộ: nhịp bước không trượt, góc khớp (spec §5, G6, G7; plan Task 4)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../src/config.ts';
import { ppCadence, ppStride, ppAngles } from '../../src/common/people/gait.ts';

const P = CONFIG.people, TAU = Math.PI * 2;
const phases = Array.from({ length: 72 }, (_, i) => (i / 72) * TAU);

test('đi bộ không trượt: nhịp · bước / 2π ≈ tốc độ (sai số 1 %)', () => {
  for (const v of [1.05, 1.2, 1.35]) for (const s of [0.6, 1, 1.08]) {
    const got = (ppCadence('walk', v, s) * ppStride('walk', s)) / TAU;
    assert.ok(Math.abs(got / v - 1) < 0.01, `v = ${v}, s = ${s}: ${got}`);
  }
});

test('chạy ≈ 1,4 chu kỳ/giây ở tỉ lệ 1; đứng = 0', () => {
  const hz = ppCadence('run', 2.8, 1) / TAU;
  assert.ok(Math.abs(hz - 1.4) < 0.05, `chạy ${hz} Hz`);
  assert.equal(ppCadence('stand', 0, 1), 0);
  assert.equal(ppStride('stand', 1), 0);
});

test('chân trái và chân phải lệch pha π', () => {
  for (const amp of [P.walk.amp, P.run.amp]) for (const f of phases) {
    const l = ppAngles('legL', amp, f + Math.PI), r = ppAngles('legR', amp, f);
    assert.ok(Math.abs(l.root - r.root) < 1e-9 && Math.abs(l.joint - r.joint) < 1e-9, `amp ${amp}, φ ${f}`);
  }
});

test('gối luôn ≤ 0 (gập về sau), khi đi hông dao động ≤ 0,4 rad', () => {
  for (const amp of [0, P.walk.amp, P.run.amp]) for (const leg of ['legL', 'legR'] as const) for (const f of phases)
    assert.ok(ppAngles(leg, amp, f).joint <= 0, `${leg} amp ${amp} φ ${f}`);
  for (const f of phases) assert.ok(Math.abs(ppAngles('legL', P.walk.amp, f).root) <= 0.4, `hông ${f}`);
});

test('khi chạy gối gập sâu nhất ≥ 1,5 rad', () => {
  const deepest = Math.max(...phases.map((f) => -ppAngles('legL', P.run.amp, f).joint));
  assert.ok(deepest >= 1.5, `${deepest}`);
});

test('tay ngược dấu chân cùng bên ở φ = π/2', () => {
  for (const amp of [P.walk.amp, P.run.amp]) {
    const f = Math.PI / 2;
    assert.ok(ppAngles('legL', amp, f).root * ppAngles('armL', amp, f).root < 0, `trái amp ${amp}`);
    assert.ok(ppAngles('legR', amp, f).root * ppAngles('armR', amp, f).root < 0, `phải amp ${amp}`);
  }
});

test('đứng yên: không vung hông, gối thẳng', () => {
  for (const f of phases) { const a = ppAngles('legL', 0, f); assert.ok(Math.abs(a.root) < 1e-12 && Math.abs(a.joint) < 1e-12, `φ ${f}`); }
});
