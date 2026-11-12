/* ===== Nhiều người: nhãn tên có cả ba loại (dù, người đi dạo, xe) và dòng đầu danh sách "Lái xe n/5 · Đi dạo n/5 · Bay n/5" =====
   Node: DOM giả tối thiểu (getElementById / createElement), camera three thật. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CONFIG } from '../../src/config.ts';
import { t } from '../../src/i18n/index.ts';
import { exMpKeys, exMpSlots } from '../../src/explore/multi/keys.ts';
import { multiParams as P } from '../../src/explore/multi/params.ts';

interface FakeEl { className: string; hidden: boolean; textContent: string; style: { transform: string }; }
const made: FakeEl[] = [];
(globalThis as any).window = { innerWidth: 1000, innerHeight: 600 };
(globalThis as any).document = {
  getElementById: (id: string) => id === 'exMpLabels' ? { appendChild: (e: FakeEl) => { made.push(e); } } : null,
  createElement: (): FakeEl => ({ className: '', hidden: false, textContent: '', style: { transform: '' } })
};
const { exLabelsUpdate, exLabelsClear } = await import('../../src/explore/multi/labels.ts');

const cam = new THREE.PerspectiveCamera(60, 1000 / 600, 0.1, 5000);
cam.position.set(0, 5, 0); cam.lookAt(0, 5, -100); cam.updateMatrixWorld(true);

/* Điểm (x, y, z) chiếu ra px như labels.ts */
function px(x: number, y: number, z: number): [number, number] {
  const v = new THREE.Vector3(x, y, z).applyMatrix4(cam.matrixWorldInverse).applyMatrix4(cam.projectionMatrix);
  return [Math.round((v.x * 0.5 + 0.5) * 1000), Math.round((-v.y * 0.5 + 0.5) * 600)];
}
const at = (e: FakeEl): [number, number] => { const m = /translate\((-?\d+)px,(-?\d+)px\)/.exec(e.style.transform)!; return [Number(m[1]), Number(m[2])]; };

const remotes: any = { slotState: (i: number) => i === 1 ? { pos: new THREE.Vector3(0, 30, -60) } : null, name: (i: number) => i === 1 ? 'Bay' : null };
const walkers: any = { self: -1, slotState: (i: number) => i === 2 ? { x: 4, y: 2.5, z: -20 } : null, name: (i: number) => i === 2 ? 'Dạo' : null };
const drivers: any = { slotState: (i: number) => i === 3 ? { x: -4, y: 2.6, z: -25, yaw: 0, v: 5 } : null, name: (i: number) => i === 3 ? 'Lái' : null };

test('nhãn có cả ba loại: số nhãn = dù + đi dạo + xe, theo thứ tự đó; mỗi loại đúng điểm đặt', () => {
  exLabelsUpdate(cam, remotes, 1000, walkers, drivers);
  assert.equal(made.length, P.slots + P.stroll.slots + P.drive.slots, 'một div cho mỗi slot của cả ba nhóm');
  const shown = made.filter((e) => !e.hidden);
  assert.equal(shown.length, 3);
  const fly = made[1], walk = made[P.slots + 2], car = made[P.slots + P.stroll.slots + 3];
  assert.ok(fly.textContent.startsWith('Bay · ') && walk.textContent.startsWith('Dạo · ') && car.textContent.startsWith('Lái · '));
  const top = CONFIG.drive.car.height + CONFIG.drive.remote.labelAbove;
  assert.deepEqual(at(car), px(-4, 2.6 + top, -25), 'nhãn xe trên nóc: car.height + 0,6 m');
  assert.deepEqual(at(walk), px(4, 2.5 + CONFIG.stroll.labelAbove, -20));
  assert.deepEqual(at(fly), px(0, 30 - P.labelBelow, -60));
});

test('không truyền người lái (bản gọi cũ) thì nhãn xe luôn ẩn; xe không có mẫu thì ẩn; clear ẩn hết', () => {
  exLabelsUpdate(cam, remotes, 2000, walkers);
  assert.equal(made[P.slots + P.stroll.slots + 3].hidden, true);
  exLabelsUpdate(cam, remotes, 3000, walkers, { slotState: () => null, name: () => null } as any);
  assert.equal(made.filter((e) => !e.hidden).length, 2);
  exLabelsUpdate(cam, remotes, 4000, walkers, drivers);
  assert.equal(made.filter((e) => !e.hidden).length, 3);
  exLabelsClear();
  assert.equal(made.filter((e) => !e.hidden).length, 0);
});

test('xe sau camera không có nhãn', () => {
  const behind: any = { slotState: (i: number) => i === 0 ? { x: 0, y: 2.6, z: 50, yaw: 0, v: 0 } : null, name: () => 'Sau' };
  exLabelsUpdate(cam, { slotState: () => null, name: () => null } as any, 5000, undefined, behind);
  assert.equal(made.filter((e) => !e.hidden).length, 0);
});

test('dòng đầu danh sách đếm đúng n/5 cho ba loại, theo thứ tự Lái xe · Đi dạo · Bay', () => {
  assert.equal(t('drRosterAll', { d: 2, w: 1, f: 3 }), 'Lái xe 2/5 · Đi dạo 1/5 · Bay 3/5');
  assert.deepEqual([exMpSlots('drive'), exMpSlots('walk'), exMpSlots('fly')], [5, 5, 5]);
});

test('bộ chữ theo loại: các khóa của ba loại khác nhau đúng chỗ và có đủ ở cả 9 ngôn ngữ', async () => {
  const { readFileSync } = await import('node:fs');
  const used = new Set<string>();
  for (const k of ['fly', 'walk', 'drive'] as const) for (const v of Object.values(exMpKeys(k))) if (v) used.add(v);
  used.add('drRosterAll');
  for (const l of ['vi', 'en', 'ko', 'ja', 'zh', 'th', 'ar', 'hi', 'ru']) {
    const j = JSON.parse(readFileSync(new URL(`../../src/i18n/locales/${l}.json`, import.meta.url), 'utf8'));
    for (const k of used) assert.equal(typeof j[k], 'string', `${l}.json thiếu ${k}`);
    for (const ph of ['{d}', '{w}', '{f}']) assert.ok(j.drRosterAll.includes(ph), `${l}.drRosterAll thiếu ${ph}`);
    assert.ok(j.drSeats.includes('{n}'), `${l}.drSeats thiếu {n}`);
  }
  assert.equal(exMpKeys('drive').go, 'drGo');
  assert.equal(exMpKeys('walk').full, 'stFull');
  assert.equal(exMpKeys('fly').full, null);
});
