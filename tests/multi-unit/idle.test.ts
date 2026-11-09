import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ExIdle } from '../../src/explore/multi/idle.ts';

test('ngưỡng: 59,9 s ok; 60 s warn; 74,9 s warn; 75 s expired', () => {
  const d = new ExIdle(60000, 15000); d.reset(0);
  assert.equal(d.tick(59900), 'ok');
  assert.equal(d.tick(60000), 'warn');
  assert.equal(d.tick(74900), 'warn');
  assert.equal(d.tick(75000), 'expired');
});

test('activity trong lúc warn quay về ok và đếm lại từ đầu', () => {
  const d = new ExIdle(60000, 15000); d.reset(0);
  assert.equal(d.tick(65000), 'warn');
  d.activity(65000);
  assert.equal(d.tick(65000), 'ok');
  assert.equal(d.tick(124900), 'ok');
  assert.equal(d.tick(125000), 'warn');
});

test('remaining làm tròn lên giây, tính tới lúc hết hạn', () => {
  const d = new ExIdle(60000, 15000); d.reset(0);
  assert.equal(d.remaining(60000), 15);
  assert.equal(d.remaining(60001), 15);
  assert.equal(d.remaining(73999), 2);
  assert.equal(d.remaining(74000), 1);
  assert.equal(d.remaining(74900), 1);
  assert.equal(d.remaining(75000), 0);
  assert.equal(d.remaining(90000), 0);
});

test('reset đặt lại mốc: vào bay lại không bị cảnh báo ngay', () => {
  const d = new ExIdle(60000, 15000); d.reset(0);
  assert.equal(d.tick(80000), 'expired');
  d.reset(80000);
  assert.equal(d.tick(80000), 'ok');
});
