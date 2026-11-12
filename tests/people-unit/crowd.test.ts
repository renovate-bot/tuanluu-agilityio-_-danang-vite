// Đám đông người thật: hàm thuần chọn nhân vật / nhịp / khung và dựng BatchedMesh (spec D-032 §4, §5; plan Task 2)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { CONFIG } from '../../src/config.ts';
import { crowdParse, type CrowdData, type CrowdClip } from '../../src/common/people/crowdData.ts';
import { crowdUsable, crowdPick, crowdRate, crowdFrame, crowdBuild, crowdMaterial } from '../../src/common/people/crowd.ts';
import { PP_FLAG } from '../../src/common/people/kinds.ts';
import type { Walker } from '../../src/common/people.ts';

const C = CONFIG.people.crowd;
let cache: CrowdData | null = null;
/* Dữ liệu thật từ public/people/crowd.bin + texture giả (không có DOM trong node) */
const data = (): CrowdData => {
  if (cache) return cache;
  const b = readFileSync('public/people/crowd.bin'), p = crowdParse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer);
  const anim = new THREE.DataTexture(p.animData as Uint16Array<ArrayBuffer>, p.animWidth, p.animHeight, THREE.RGBAFormat, THREE.HalfFloatType);
  return (cache = { ...p, anim, atlas: new THREE.Texture() });
};

test('crowdUsable: cần dữ liệu và WEBGL_multi_draw', () => {
  assert.equal(crowdUsable(null, true), false);
  assert.equal(crowdUsable(data(), false), false);
  assert.equal(crowdUsable(data(), true), true);
});

test('crowdPick: tất định, trẻ em ↔ nhân vật trẻ em, tránh trùng người đi cùng, đủ đa dạng', () => {
  const chars = data().chars;
  for (let i = 0; i < 80; i++) {
    assert.equal(crowdPick(chars, 'ttl-people', i, false, -1), crowdPick(chars, 'ttl-people', i, false, -1));
    assert.equal(chars[crowdPick(chars, 'ttl-people', i, true, -1)].child, true, `người ${i} trẻ em`);
    const a = crowdPick(chars, 'ttl-people', i, false, -1);
    assert.equal(chars[a].child, false, `người ${i} người lớn`);
    assert.notEqual(crowdPick(chars, 'ttl-people', i + 1, false, a), a, `người ${i + 1} trùng người dẫn`);
    const k = crowdPick(chars, 'sh-people', i, true, -1);
    assert.notEqual(crowdPick(chars, 'sh-people', i + 1, true, k), k, 'trẻ em đi cùng trùng (có 2 lựa chọn)');
  }
  const used = new Set(Array.from({ length: 80 }, (_, i) => crowdPick(chars, 'ttl-people', i, false, -1)));
  assert.ok(used.size >= 6, `80 người chỉ dùng ${used.size} nhân vật người lớn`);
  const seq = (s: string) => Array.from({ length: 40 }, (_, i) => crowdPick(chars, s, i, false, -1)).join(',');
  assert.notEqual(seq('ttl-people'), seq('sh-people'));
  // chỉ một lựa chọn: không tránh được, vẫn trả về nhân vật hợp lệ
  assert.equal(crowdPick([{ child: false }, { child: true }], 'x', 3, true, 1), 1);
});

test('crowdRate: tỉ lệ tốc độ, kẹp, natural = 0, tỉ lệ người', () => {
  assert.equal(crowdRate(1.2, 1.2, 1), 1);
  assert.equal(crowdRate(10, 1.2, 1), C.rateMax);
  assert.equal(crowdRate(0.1, 1.2, 1), C.rateMin);
  assert.equal(crowdRate(0, 0, 1), 1);
  assert.equal(crowdRate(1.3, 0, 0.7), 1);
  assert.ok(Math.abs(crowdRate(0.6, 1.0, 0.5) - 2 * crowdRate(0.6, 1.0, 1)) < 1e-12);   // 0,6 → 1,2: chưa chạm trần
});

test('crowdFrame: trong [0, frames), bước đều sau 3 giờ, loop = false giữ khung cuối', () => {
  const walk: CrowdClip = { row: 0, frames: 17, fps: 15, loop: true, speed: 1.1 }, jog: CrowdClip = { row: 0, frames: 21, fps: 30, loop: true, speed: 2.8 };
  for (const clip of [walk, jog]) for (const rate of [0.6, 1, 1.37, 1.6]) for (const ph of [0, 1, 5.9]) {
    for (const t of [0, 1, 10800]) { const f = crowdFrame(t, clip, rate, ph); assert.ok(f >= 0 && f < clip.frames, `khung ${f} tại t = ${t}`); }
    const a = crowdFrame(10800, clip, rate, ph), b = crowdFrame(10800 + 1 / 60, clip, rate, ph);
    const d = (((b - a) % clip.frames) + clip.frames) % clip.frames, want = (clip.fps * rate) / 60;
    assert.ok(Math.abs(d - want) < 0.02, `bước ${d} so với ${want} (fps ${clip.fps}, rate ${rate})`);
  }
  assert.equal(crowdFrame(123.4, { row: 5, frames: 30, fps: 15, loop: false, speed: 0 }, 1, 2), 29);
});

/* Danh sách người giả: đi, chạy, đứng, đứng chụp ảnh, đội nón, người đi cùng (người lớn) và trẻ em */
function walkers(n: number): Walker[] {
  const P = CONFIG.people, list: Walker[] = [];
  for (let i = 0; i < n; i++) {
    const w: Walker = { x: i, z: 0, lo: -50, hi: 50, dir: 1, speed: 1.2, profile: () => 0, kind: 'walk', scale: 1, flags: 0, phase: i * 0.7 };
    if (i % 7 === 1) w.kind = 'run';
    if (i % 7 === 2) { w.kind = 'stand'; w.flags = i % 2 ? PP_FLAG.photo : 0; }
    if (i % 5 === 3) w.flags |= PP_FLAG.hat;
    if (i % 7 === 4) w.follow = i - 1;
    if (i % 7 === 5) { w.follow = i - 1; w.scale = P.childScale; w.flags |= PP_FLAG.hat; }
    list.push(w);
  }
  return list;
}

test('crowdBuild: BatchedMesh một id mỗi người, vật liệu peopleCrowd, nón, trẻ em, người đi cùng', () => {
  const d = data(), list = walkers(30), m = crowdBuild(d, list, 'test-people');
  assert.equal(m.isBatchedMesh, true);
  assert.equal(m.sortObjects, false);
  assert.equal((m.material as THREE.Material).name, 'peopleCrowd');
  assert.equal(m.material, crowdMaterial(d), 'một vật liệu dùng chung');
  const info = m.userData.crowd as { char: Int16Array; hat: Uint8Array; scale: Float32Array };
  assert.equal(info.char.length, list.length);
  const box = new THREE.Box3();
  for (let i = 0; i < list.length; i++) {
    assert.ok(m.getBoundingBoxAt(i, box), `thiếu id ${i}`);
    const w = list[i], ch = d.chars[info.char[i]], child = w.scale === CONFIG.people.childScale;
    assert.equal(ch.child, child, `người ${i}: trẻ em ↔ nhân vật trẻ em`);
    if (w.follow !== undefined && !child) assert.notEqual(info.char[i], info.char[w.follow], `người ${i} trùng người dẫn`);
    const hat = !!(w.flags & PP_FLAG.hat) && !!ch.hat;
    assert.equal(info.hat[i], hat ? 1 : 0);
    if (hat) assert.ok(box.max.y > ch.geometry.boundingBox.max.y + 0.05, `người ${i}: lưới nón không cao hơn`);
    else assert.ok(Math.abs(box.max.y - ch.geometry.boundingBox.max.y) < 1e-6);
    const s = info.scale[i], want = (child ? 1 : (w.scale ?? 1)) * C.heightScale;
    assert.ok(Math.abs(s - want) < 1e-6, `người ${i}: tỉ lệ ${s} so với ${want}`);
    const sp = new THREE.Sphere(); m.getBoundingSphereAt(i, sp);
    assert.ok(sp.radius >= (hat ? ch.hat : ch.geometry).boundingSphere.radius + C.cullPad / s - 1e-6, `người ${i}: khối cầu bao chưa nới`);
  }
  assert.throws(() => m.addGeometry(d.chars[0].geometry), 'đã dùng hết chỗ: đúng một id mỗi người');
});
