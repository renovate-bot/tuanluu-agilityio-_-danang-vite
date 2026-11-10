// Bất biến §3.3: mọi thông số (kể cả màu) ở src/config.ts — mã tàu không chứa hằng màu hex
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('hulls.ts, material.ts không có hằng màu 0xRRGGBB', () => {
  for (const f of ['hulls.ts', 'material.ts']) {
    const src = readFileSync(new URL(`../../src/environment/boats/${f}`, import.meta.url), 'utf8');
    assert.deepEqual(src.match(/0x[0-9a-fA-F]{6}/g) ?? [], [], f);
  }
});
