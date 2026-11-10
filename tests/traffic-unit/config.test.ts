// Bất biến §3.3: mọi thông số xe (kể cả màu) ở src/config.ts (spec G2, G3, G4; plan Task 1)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { CONFIG } from '../../src/config.ts';

test('file trong src/common/vehicles không có hằng màu 0xRRGGBB', () => {
  const dir = new URL('../../src/common/vehicles/', import.meta.url), files = readdirSync(dir).filter((f) => f.endsWith('.ts'));
  assert.ok(files.length > 0, 'thư mục rỗng');
  for (const f of files) assert.deepEqual(readFileSync(new URL(f, dir), 'utf8').match(/0x[0-9a-fA-F]{6}/g) ?? [], [], f);
});

test('buýt vừa khoảng xếp hàng 7,5 m của Cầu sông Hàn', () => assert.ok(CONFIG.vehicles.types.bus.len <= 7.5));

test('carColors ≥ 8, shirtColors ≥ 6, bikeColors = 5 màu cũ', () => {
  const V = CONFIG.vehicles;
  assert.ok(V.carColors.length >= 8 && new Set(V.carColors).size === V.carColors.length, 'carColors');
  assert.ok(V.shirtColors.length >= 6 && new Set(V.shirtColors).size === V.shirtColors.length, 'shirtColors');
  assert.deepEqual(V.bikeColors, [0xc0272d, 0x1f2a44, 0xe9e9e6, 0x2f7d4f, 0x2a2a2a]);
});

test('đèn giữ đúng giá trị MAT.headLamp / MAT.tailLamp và ngưỡng đêm 0,3', () => {
  assert.deepEqual(CONFIG.vehicles.lamp, { head: [2.2, 2.1, 1.8], tail: [2.0, 0.1, 0.05], nightOn: 0.3 });
});
