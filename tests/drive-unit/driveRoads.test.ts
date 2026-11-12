/* ===== Lái xe: test hình học đường mới (src/environment/driveRoadGeo.ts, dùng qua environment/driveRoads.ts) =====
   Mặt đường mới phủ tâm mọi ô nhánh rẽ, ô đường dọc mới (tim x = westX / eastX) và ô đường nối, đúng cao độ; không phủ lại đường cũ
   (dải Bạch Đằng chỉ có hình học trong ô nút giao); dải giữa cũ của streets.ts / site.ts mở ở mọi ô; không gọi rand(). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CONFIG } from '../../src/config.ts';
import { rand, rng } from '../../src/common/math.ts';
import { drBuildPads } from '../../src/explore/drive/roadData.ts';
import { drRoadGeos, drCutRects, drNewRects } from '../../src/environment/driveRoadGeo.ts';

const R = CONFIG.drive.roads;
const pads = drBuildPads();
const geos = drRoadGeos();

/* Tam giác mặt trên (pháp tuyến hướng lên) của các hình học, tọa độ thế giới */
type Tri = [THREE.Vector3, THREE.Vector3, THREE.Vector3];
function tris(list: THREE.BufferGeometry[]): Tri[] {
  const out: Tri[] = [];
  for (const g of list) {
    const p = g.attributes.position, idx = g.index;
    const n = idx ? idx.count : p.count, at = (k: number) => new THREE.Vector3().fromBufferAttribute(p, idx ? idx.getX(k) : k);
    for (let k = 0; k < n; k += 3) out.push([at(k), at(k + 1), at(k + 2)]);
  }
  return out;
}
const roadTris = tris(geos.roads2);
/* Tam giác chứa (x, z) trên mặt bằng; trả cao độ nội suy hoặc NaN */
function yAt(t: Tri, x: number, z: number): number {
  const [a, b, c] = t, d = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
  if (Math.abs(d) < 1e-9) return NaN;
  const l1 = ((b.z - c.z) * (x - c.x) + (c.x - b.x) * (z - c.z)) / d, l2 = ((c.z - a.z) * (x - c.x) + (a.x - c.x) * (z - c.z)) / d, l3 = 1 - l1 - l2;
  return l1 >= -1e-6 && l2 >= -1e-6 && l3 >= -1e-6 ? l1 * a.y + l2 * b.y + l3 * c.y : NaN;
}

test('hình học phủ đúng ô mới', () => {
  /* ô đường dọc mới: chạy dọc z, tim tuyến x = westX / eastX */
  const isVert = (p: (typeof pads)[number]) => p.kind === 'road' && p.z1 - p.z0 > p.x1 - p.x0 && [R.westX, R.eastX].some((c) => Math.abs((p.x0 + p.x1) / 2 - c) <= R.median / 2 + R.half);
  const want = pads.filter((p) => p.kind === 'slip' || isVert(p) || /^link[WE]\./.test(p.id));
  assert.equal(want.filter((p) => p.kind === 'slip').length, 8);
  assert.equal(want.filter((p) => /^(west|east)\./.test(p.id)).length, 20);
  assert.equal(want.filter((p) => /^link[WE]\./.test(p.id)).length, 4);
  for (const p of want) {
    const x = (p.x0 + p.x1) / 2, z = (p.z0 + p.z1) / 2, py = p.y(x, z);
    const ys = roadTris.map((t) => yAt(t, x, z)).filter((y) => !Number.isNaN(y));
    assert.ok(ys.some((y) => Math.abs(y - py) <= 0.05), `${p.id}: không có tam giác mặt đường ở tâm (${x}, ${z}) cao ${py} ± 0,05 (có: ${ys.join(', ')})`);
  }
});

test('không phủ lại đường cũ', () => {
  const jcts = pads.filter((p) => p.kind === 'junction');
  const inJct = (x: number, z: number) => jcts.some((j) => x >= j.x0 - 1e-6 && x <= j.x1 + 1e-6 && z >= j.z0 - 1e-6 && z <= j.z1 + 1e-6);
  const bx0 = -R.riverX - 10.5, bx1 = -R.riverX + 10.5;        // −309,5 / −288,5 — dải Bạch Đằng
  const bad = roadTris.filter((t) => t.every((v) => v.x >= bx0 - 1e-6 && v.x <= bx1 + 1e-6) && !inJct((t[0].x + t[1].x + t[2].x) / 3, (t[0].z + t[1].z + t[2].z) / 3));
  assert.equal(bad.length, 0, `${bad.length} tam giác mặt đường mới nằm trên Bạch Đằng ngoài ô nút giao`);
  /* ô đường cũ (trục ngang, đường ven sông) đã có mặt đường: không sinh mảnh mới nào trong chúng */
  const old = pads.filter((p) => p.kind === 'road' && /^(dragon|songHan|ttl|tunnel|thuanPhuoc|bachDang|tranHungDao)\./.test(p.id));
  for (const r of drNewRects()) for (const p of old) {
    const ov = Math.min(r.x1, p.x1) - Math.max(r.x0, p.x0), oz = Math.min(r.z1, p.z1) - Math.max(r.z0, p.z0);
    assert.ok(ov <= 1e-6 || oz <= 1e-6, `mảnh mới (${r.x0}..${r.x1}, ${r.z0}..${r.z1}) chồng ô đường cũ ${p.id}`);
  }
});

test('dải giữa cũ mở ở mọi ô, dải giữa mới không lấn ô nào', () => {
  const open = pads.filter((p) => p.kind !== 'bridge' && p.kind !== 'tunnel');
  /* dải giữa Bạch Đằng (streets.ts) cắt ra phải tránh mọi ô, gồm ô quay đầu và chỗ nhánh rẽ Cầu Rồng */
  const pieces = drCutRects({ x0: -R.riverX - 1.5, x1: -R.riverX + 1.5, z0: -2600, z1: 2600 });
  assert.ok(pieces.length > 1, 'dải giữa Bạch Đằng phải bị chia đoạn');
  for (const r of pieces) for (const p of open) {
    const ov = Math.min(r.x1, p.x1) - Math.max(r.x0, p.x0), oz = Math.min(r.z1, p.z1) - Math.max(r.z0, p.z0);
    assert.ok(ov <= 1e-6 || oz <= 1e-6, `dải giữa còn chắn ô ${p.id}`);
  }
  /* ô nút giao Bạch Đằng – nhánh rẽ Cầu Rồng: dải giữa mở và có mặt đường ở tim */
  const j = pads.find((p) => p.id === 'jct.bachDang.dragon.S');
  const ys = roadTris.map((t) => yAt(t, -R.riverX, (j.z0 + j.z1) / 2)).filter((y) => !Number.isNaN(y));
  assert.ok(ys.some((y) => Math.abs(y - CONFIG.roadY) <= 0.05), 'chỗ mở dải giữa Bạch Đằng không có mặt đường');
  /* dải giữa đường mới (MEDIANS) không lấn ô nào */
  for (const g of geos.medians) {
    g.computeBoundingBox(); const b = g.boundingBox;
    for (const p of open) {
      const ov = Math.min(b.max.x, p.x1) - Math.max(b.min.x, p.x0), oz = Math.min(b.max.z, p.z1) - Math.max(b.min.z, p.z0);
      assert.ok(ov <= 1e-3 || oz <= 1e-3, `dải giữa mới lấn ô ${p.id}`);   // đỉnh float32
    }
  }
  assert.equal(geos.medians.length, 12, 'dải giữa mới: 5 đoạn mỗi đường dọc + 1 mỗi đường nối');
});

test('không dùng rand', () => {
  const ref = rng(20130329);                                        // cùng hạt giống với rand() (common/math.ts)
  let used = 0;
  const next = () => { used++; return rand(); };
  /* rand() có thể đã bị module khác dùng lúc import: đồng bộ bằng cách dò số lần đã gọi (≤ 100 000) */
  const first = next(); let k = 0, v = ref(); while (v !== first && k < 100000) { v = ref(); k++; }
  assert.equal(v, first, 'không đồng bộ được với chuỗi rand()');
  drRoadGeos();
  assert.equal(next(), ref(), 'drRoadGeos() lần 1 đã gọi rand()');
  drRoadGeos(); drCutRects({ x0: -1900, x1: -333, z0: -3, z1: 3 }); drNewRects();
  assert.equal(next(), ref(), 'drRoadGeos() lần 2 đã gọi rand()');
  assert.equal(used, 3);
});
