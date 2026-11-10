// Chia kiểu người: đi, chạy, đứng, đi cùng, trẻ em, nón, ba lô, chụp ảnh (spec G8, §5, §7; plan Task 4)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../src/config.ts';
import { ppAssignKinds, PP_FLAG } from '../../src/common/people/kinds.ts';

const M = CONFIG.people.mix;
const near = (got: number, want: number, what: string) => assert.ok(Math.abs(got - want) <= 2, `${what}: ${got} so với ${want.toFixed(1)}`);

test('độ dài và cùng seed cho cùng kết quả', () => {
  const a = ppAssignKinds(80, 1);
  assert.equal(a.length, 80);
  assert.deepEqual(ppAssignKinds(80, 1), a);
  assert.notDeepEqual(ppAssignKinds(80, 2), a);
});

for (const [n, seed] of [[80, 1], [46, 1965], [36, 2903], [70, 4107]] as const) test(`tỉ lệ kiểu trong ±2 người (n = ${n})`, () => {
  const L = ppAssignKinds(n, seed), stand = L.filter((p) => p.kind === 'stand');
  const comp = L.filter((p) => p.follow >= 0);
  near(L.filter((p) => p.kind === 'run').length, n * M.run, 'chạy');
  near(stand.length, n * M.stand, 'đứng');
  near(comp.length, n * M.companion, 'đi cùng');
  near(comp.filter((p) => p.scale === CONFIG.people.childScale).length, n * M.companion * M.child, 'trẻ em');
  near(L.filter((p) => p.flags & PP_FLAG.hat).length, n * M.hat, 'nón');
  near(L.filter((p) => p.flags & PP_FLAG.pack).length, n * M.pack, 'ba lô');
  near(stand.filter((p) => p.flags & PP_FLAG.photo).length, n * M.stand * M.photo, 'chụp ảnh');
});

test('người đi cùng theo đúng người đứng trước, người đó đi bộ một mình', () => {
  for (const seed of [1, 2, 3, 1965, 2903, 4107]) {
    const L = ppAssignKinds(80, seed);
    L.forEach((p, i) => {
      if (p.follow < 0) { assert.equal(p.follow, -1); return; }
      assert.equal(p.follow, i - 1, `${seed}/${i}`);
      assert.equal(p.kind, 'walk');
      assert.equal(L[i - 1].kind, 'walk', `${seed}/${i}: người trước là ${L[i - 1].kind}`);
      assert.equal(L[i - 1].follow, -1, `${seed}/${i}: người trước cũng đi cùng`);
    });
  }
});

test('{ run: false } không có người chạy, số người đứng giữ nguyên', () => {
  for (const seed of [1, 1965]) {
    const L = ppAssignKinds(34, seed, { run: false });
    assert.equal(L.filter((p) => p.kind === 'run').length, 0);
    near(L.filter((p) => p.kind === 'stand').length, 34 * M.stand, 'đứng');
  }
});

test('trẻ em luôn là người đi cùng; chụp ảnh chỉ ở người đứng; tỉ lệ và pha hợp lệ', () => {
  const [a0, a1] = CONFIG.people.adultScale;
  for (const seed of [1, 7, 1965, 2903]) for (const p of ppAssignKinds(80, seed)) {
    if (p.scale === CONFIG.people.childScale) assert.ok(p.follow >= 0, 'trẻ em đi một mình');
    else assert.ok(p.scale >= a0 && p.scale <= a1, `tỉ lệ ${p.scale}`);
    if (p.flags & PP_FLAG.photo) assert.equal(p.kind, 'stand');
    assert.ok(p.phase >= 0 && p.phase < Math.PI * 2, `pha ${p.phase}`);
    assert.ok(Number.isInteger(p.flags) && p.flags >= 0 && p.flags <= 7);
  }
});

test('n nhỏ không lỗi', () => {
  assert.deepEqual(ppAssignKinds(0, 1), []);
  assert.equal(ppAssignKinds(1, 1)[0].follow, -1);
});
