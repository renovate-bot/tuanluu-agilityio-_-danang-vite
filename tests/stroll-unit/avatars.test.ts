/* ===== Đi dạo: test nhân vật hiển thị (src/explore/stroll/avatars.ts, rig.ts, blocky.ts) =====
   Node, không GPU: bộ nạp giả qua stAvatars.__setLoader trả nguồn dựng tay (một Group có "xương" Bip01_Pelvis, 5 đoạn VectorKeyframeTrack).
   Kiểm hình tạm khi chưa nạp / nạp lỗi (Review Focus 1), slot đổi chủ khi đang nạp (Review Focus 2), dt kẹp + đồng pha (Review Focus 3), quy tắc mô hình theo slot. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CONFIG } from '../../src/config.ts';
import { ppAmp } from '../../src/common/people/gait.ts';
import { PP_FLAG } from '../../src/common/people/kinds.ts';
import { ExTrack } from '../../src/explore/multi/interp.ts';
import { stAvatars, stAvatarVar } from '../../src/explore/stroll/avatars.ts';
import { stBlocky } from '../../src/explore/stroll/blocky.ts';
import { StRig, stRigSource, type StRigSource } from '../../src/explore/stroll/rig.ts';
import { ST_CLIPS } from '../../src/explore/stroll/anim.ts';
import { ST_POSE_IDLE, ST_POSE_WALK, ST_POSE_RUN, ST_POSE_FALL, ST_POSE_PHOTO, type StState } from '../../src/explore/stroll/motion.ts';

const DUR = [2, 1.2, 0.8, 0.6, 0.8];         // thời lượng giả từng đoạn, s
const NAT = { idle: 0, walk: 1.05, jog: 2.88, sprint: 5.84, photo: 0 };

/* Nguồn giả: Group → Object3D 'Bip01_Pelvis' + Mesh (để kiểm lớp / bóng / vật liệu) */
function fakeSource(): StRigSource {
  const scene = new THREE.Group();
  const pelvis = new THREE.Object3D(); pelvis.name = 'Bip01_Pelvis'; scene.add(pelvis);
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ metalness: 0.5, roughness: 0.2 })); mesh.castShadow = true; scene.add(mesh);
  const hair = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ alphaTest: 0.5, transparent: true })); scene.add(hair);
  const clips = ST_CLIPS.map((n, i) => new THREE.AnimationClip(n, DUR[i], [new THREE.VectorKeyframeTrack('Bip01_Pelvis.position', [0, DUR[i]], [0, 0, 0, i, 0, 0])]));
  return stRigSource(scene, clips, NAT, 1.8, (o) => o.clone());
}

/* Bộ nạp giả điều khiển được: mỗi mô hình một promise, test tự resolve */
function deferredLoader() {
  const calls: number[] = [], res = new Map<number, (v: StRigSource | null) => void>();
  const fn = (m: number) => { calls.push(m); return new Promise<StRigSource | null>((r) => res.set(m, r)); };
  return { fn, calls, resolve: (m: number, v: StRigSource | null) => res.get(m)!(v) };
}

const tick = () => new Promise((r) => setTimeout(r, 0));
const st = (pose = 0, speed = 0): StState => ({ x: 1, y: 2.6, z: 3, yaw: 0.5, speed, vy: 0, air: false, pose, evac: false, photo: 0, tx: 0, tz: 0 });
const rigs = () => stAvatars.build().children.filter((c) => c.name === 'stroll-rig');
const W = (slot: number, name: string) => ({ slot, name });
/* Người khác ở slot i có một mẫu vị trí (pose 1) rồi update */
function other(i: number, now: number): void { stAvatars.onPos([[i, 10 * i, 2.6, 0, 0, 1, now]], now); stAvatars.update(now); }

function fresh(loader: ((m: number) => Promise<StRigSource | null>) | null): void { stAvatars.clear(); stAvatars.__setLoader(loader); }

test('build trả Group tên stroll-people, gọi hai lần trả cùng một đối tượng', () => {
  const g = stAvatars.build();
  assert.ok(g instanceof THREE.Group); assert.equal(g.name, 'stroll-people');
  assert.equal(stAvatars.build(), g); assert.equal(stAvatars.mesh, g);
  assert.ok(g.children.some((c) => c.name === 'stroll-blocky'), 'có hình khối làm hình tạm');
});

test('setSelf khi chưa nạp: hình khối hiện, debug(slot).real === false, model 0', () => {
  const L = deferredLoader(); fresh(L.fn);
  stAvatars.setSelf(0, st(), 0.016);
  const d = stAvatars.debug(0)!;
  assert.equal(d.real, false); assert.equal(d.model, 0);
  assert.equal(stBlocky.shown(0), true); assert.equal(stBlocky.mesh!.visible, true);
  assert.deepEqual(L.calls, [0], 'nạp đúng mô hình 0, một lần');
  stAvatars.setSelf(0, st(), 0.016); assert.deepEqual(L.calls, [0], 'không nạp lại khi đang chờ');
});

test('nạp xong: real === true, hình khối của slot ẩn', async () => {
  const L = deferredLoader(); fresh(L.fn);
  stAvatars.setSelf(0, st(), 0.016);
  L.resolve(0, fakeSource()); await tick();
  stAvatars.setSelf(0, st(), 0.016);
  const d = stAvatars.debug(0)!;
  assert.equal(d.real, true); assert.equal(d.model, 0);
  assert.equal(stBlocky.shown(0), false); assert.equal(stBlocky.mesh!.visible, false, 'không slot nào cần hình khối: không tốn lệnh vẽ');
  assert.equal(rigs().length, 1);
  const r = rigs()[0];
  assert.ok(Math.abs(r.position.x - 1) < 1e-9 && Math.abs(r.position.y - 2.6) < 1e-9 && Math.abs(r.rotation.y - 0.5) < 1e-9, 'đặt theo vị trí và yaw');
  r.traverse((o) => {
    assert.equal(o.layers.mask, 2, `${o.name || o.type} ở lớp 1`);
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    assert.equal(m.castShadow, false); assert.equal(m.receiveShadow, false); assert.equal(m.frustumCulled, false);
    const mat = m.material as THREE.MeshStandardMaterial;
    assert.equal(mat.metalness, 0); assert.equal(mat.roughness, 0.85); assert.equal(mat.transparent, false);
  });
});

test('nạp lỗi (loader trả null): vẫn hình khối, không ném, không unhandledRejection', async () => {
  const bad: unknown[] = []; const h = (e: unknown) => bad.push(e);
  process.on('unhandledRejection', h);
  try {
    for (const fn of [async () => null, () => Promise.reject(new Error('mạng')), () => { throw new Error('đồng bộ'); }]) {
      fresh(fn as (m: number) => Promise<StRigSource | null>);
      assert.doesNotThrow(() => stAvatars.setSelf(0, st(ST_POSE_RUN, 10), 0.016));
      await tick(); await tick();
      assert.doesNotThrow(() => stAvatars.setSelf(0, st(ST_POSE_RUN, 10), 0.016));
      assert.equal(stAvatars.debug(0)!.real, false); assert.equal(stBlocky.shown(0), true);
      assert.equal(rigs().length, 0);
    }
    assert.doesNotThrow(() => stAvatars.preload(3));
    await tick();
  } finally { process.off('unhandledRejection', h); }
  assert.deepEqual(bad, []);
});

test('slot đổi chủ trong lúc đang nạp: kết quả cũ bị bỏ, nhóm không có con thừa', async () => {
  const L = deferredLoader(); fresh(L.fn);
  stAvatars.sync([W(1, 'An')], -1); other(1, 1000);
  assert.equal(stAvatars.debug(1)!.model, 2); assert.deepEqual(L.calls, [2]);
  stAvatars.sync([], -1);                     // An rời đi khi mô hình 2 còn đang nạp
  L.resolve(2, fakeSource()); await tick();
  stAvatars.update(1100);
  assert.equal(stAvatars.debug(1), null); assert.equal(rigs().length, 0);
  /* slot 1 thành của mình (mô hình 0) đúng lúc mô hình 2 vừa về: không gắn mô hình 2 */
  stAvatars.sync([W(1, 'Bình')], -1); other(1, 1200); assert.equal(stAvatars.debug(1)!.real, true);
  stAvatars.sync([W(1, 'Tôi')], 1); stAvatars.setSelf(1, st(), 0.016);
  assert.equal(rigs().length, 0, 'bản sao của người khác đã gỡ');
  assert.equal(stAvatars.debug(1)!.model, 0); assert.equal(stAvatars.debug(1)!.real, false);
  /* rời chế độ trong lúc mô hình 0 đang nạp: về sau cũng không hiện gì */
  stAvatars.clear(); L.resolve(0, fakeSource()); await tick();
  stAvatars.update(1300);
  assert.equal(rigs().length, 0); assert.equal(stAvatars.mesh!.visible, false);
  assert.equal(stBlocky.mesh!.visible, false);
});

test('người khác slot 0..4 dùng model 1,2,3,4,1; mình ở slot 3 dùng model 0', async () => {
  fresh(async () => fakeSource());
  stAvatars.sync([0, 1, 2, 3, 4].map((i) => W(i, `N${i}`)), -1);
  for (let i = 0; i < 5; i++) other(i, 2000);
  await tick();
  stAvatars.update(2050);
  assert.deepEqual([0, 1, 2, 3, 4].map((i) => stAvatars.debug(i)!.model), [1, 2, 3, 4, 1]);
  assert.ok([0, 1, 2, 3, 4].every((i) => stAvatars.debug(i)!.real), 'cả năm đã là nhân vật thật');
  assert.equal(rigs().length, 5);
  stAvatars.sync([0, 1, 2, 3, 4].map((i) => W(i, `N${i}`)), 3); stAvatars.setSelf(3, st(), 0.016);
  await tick(); stAvatars.setSelf(3, st(), 0.016);
  assert.equal(stAvatars.debug(3)!.model, 0); assert.equal(stAvatars.debug(3)!.real, true);
  assert.equal(stAvatars.self, 3);
  assert.equal(rigs().length, 5, 'slot 3 đổi mô hình: bản sao cũ gỡ, không thừa');
});

test('clear() gỡ hết nhân vật thật khỏi nhóm', async () => {
  fresh(async () => fakeSource());
  stAvatars.sync([W(1, 'An'), W(2, 'Bình')], 0); stAvatars.setSelf(0, st(), 0.016);
  other(1, 3000); other(2, 3000); await tick();
  stAvatars.setSelf(0, st(), 0.016); stAvatars.update(3050);
  assert.equal(rigs().length, 3);
  stAvatars.clear();
  assert.equal(rigs().length, 0); assert.equal(stAvatars.mesh!.visible, false);
  for (let i = 0; i < 5; i++) assert.equal(stAvatars.debug(i), null);
});

test('StRig: khung rất dài bị kẹp dtMax, walk và jog đang trộn cùng pha', () => {
  const r = new StRig(fakeSource());
  r.pose(ST_POSE_WALK, 2.65, 0);                 // giữa walkTo và jogAt: walk 0,5 + jog 0,5
  assert.ok(Math.abs(r.w[1] - 0.5) < 1e-6 && Math.abs(r.w[2] - 0.5) < 1e-6, `${r.w[1]} ${r.w[2]}`);
  r.pose(ST_POSE_WALK, 2.65, 100);               // tab ẩn rồi quay lại: dt = 100 s
  const dur = (DUR[1] + DUR[2]) / 2, maxPhase = CONFIG.stroll.dtMax * r.rate / dur;
  assert.ok(r.phase > 0 && r.phase <= maxPhase + 1e-9, `pha ${r.phase} > ${maxPhase}`);
  const walk = r.actions[1], jog = r.actions[2];
  assert.ok(Math.abs(walk.time / DUR[1] - jog.time / DUR[2]) < 1e-9, 'cùng pha');
  for (let k = 0; k < 50; k++) r.pose(ST_POSE_RUN, 4 + k * 0.1, 1 / 30);
  assert.ok(Math.abs(r.actions[2].time / DUR[2] - r.actions[3].time / DUR[3]) < 1e-9, 'jog / sprint cùng pha');
  let s = 0; for (const x of r.w) { assert.ok(x >= 0); s += x; } assert.ok(Math.abs(s - 1) < 1e-6, `tổng ${s}`);
  r.pose(ST_POSE_RUN, 5, NaN); r.pose(ST_POSE_RUN, 5, -1);   // dt hỏng: không lùi pha, không NaN
  assert.ok(Number.isFinite(r.phase));
  r.dispose();
});

test('StRig: đổi dáng làm mượt theo fade; chụp ảnh phát lại từ đầu mỗi lần', () => {
  const r = new StRig(fakeSource());
  r.pose(ST_POSE_IDLE, 0, 0); assert.equal(r.w[0], 1);
  const d = 0.05;
  r.pose(ST_POSE_PHOTO, 0, d);   // làm mượt mũ: w = 1 − e^(−dt / fade)
  assert.ok(Math.abs(r.w[4] - (1 - Math.exp(-d / CONFIG.stroll.anim.fade))) < 1e-6, `photo ${r.w[4]}`);
  assert.ok(Math.abs(r.w[0] + r.w[4] - 1) < 1e-6, 'tổng vẫn 1 khi đang trộn chéo');
  const ph = r.actions[4];
  assert.equal(ph.loop, THREE.LoopOnce); assert.equal(ph.clampWhenFinished, true);
  for (let k = 0; k < 60; k++) r.pose(ST_POSE_PHOTO, 0, 1 / 30);
  assert.ok(Math.abs(ph.time - DUR[4]) < 1e-6, `giữ khung cuối: ${ph.time}`);
  r.pose(ST_POSE_IDLE, 0, 1 / 30); r.pose(ST_POSE_PHOTO, 0, 1 / 30);
  assert.ok(ph.time < 0.1, `phát lại từ đầu: ${ph.time}`);
  r.pose(ST_POSE_FALL, 0, 1 / 30);   // rơi đứng yên: về idle
  r.dispose();
});

test('StRig.dispose: giải phóng skeleton của bản sao (mỗi cái một lần), không dispose geometry / vật liệu dùng chung', () => {
  const scene = new THREE.Group();
  const bone = new THREE.Bone(); bone.name = 'Bip01_Pelvis'; scene.add(bone);
  const geo = new THREE.BufferGeometry(), mat = new THREE.MeshStandardMaterial();
  const a = new THREE.SkinnedMesh(geo, mat), b = new THREE.SkinnedMesh(geo, mat);
  a.bind(new THREE.Skeleton([bone])); b.bind(new THREE.Skeleton([bone])); scene.add(a, b);
  const clips = ST_CLIPS.map((n, i) => new THREE.AnimationClip(n, DUR[i], [new THREE.VectorKeyframeTrack('Bip01_Pelvis.position', [0, DUR[i]], [0, 0, 0, i, 0, 0])]));
  /* bản sao giả kiểu SkeletonUtils.clone: geometry / vật liệu dùng chung, skeleton mới; a và b của bản sao dùng chung một skeleton để kiểm "mỗi cái một lần" */
  const shared = new THREE.Skeleton([bone]);
  const r = new StRig(stRigSource(scene, clips, NAT, 1.8, () => {
    const g = new THREE.Group(), ca = new THREE.SkinnedMesh(geo, mat), cb = new THREE.SkinnedMesh(geo, mat);
    ca.bind(shared); cb.bind(shared); g.add(ca, cb); return g;
  }));
  let sk = 0, gd = 0, md = 0;
  shared.dispose = () => { sk++; };
  geo.dispose = () => { gd++; }; mat.dispose = () => { md++; };
  stAvatars.build().add(r.root);
  r.dispose();
  assert.equal(sk, 1, 'skeleton chung của hai SkinnedMesh dispose đúng một lần');
  assert.equal(gd, 0, 'không dispose geometry'); assert.equal(md, 0, 'không dispose vật liệu');
  assert.equal(r.root.parent, null, 'đã gỡ khỏi nhóm');
});

test('StRig: fade = 0 chuyển tức thì, không NaN', () => {
  const A = CONFIG.stroll.anim as { fade: number }, old = A.fade;
  A.fade = 0;
  try {
    const r = new StRig(fakeSource());
    r.pose(ST_POSE_IDLE, 0, 0); r.pose(ST_POSE_PHOTO, 0, 0);
    assert.equal(r.w[4], 1); assert.equal(r.w[0], 0);
    for (const x of r.w) assert.ok(Number.isFinite(x));
    r.dispose();
  } finally { A.fade = old; }
});

test('mất kết nối khi đang đi (sync với mySlot = -1): giữ nguyên bản sao của mình, không phát lại từ đầu', async () => {
  fresh(async () => fakeSource());
  stAvatars.sync([W(2, 'Tôi'), W(3, 'An')], 2); stAvatars.setSelf(2, st(ST_POSE_WALK, 1.2), 0.016);
  await tick(); stAvatars.setSelf(2, st(ST_POSE_WALK, 1.2), 0.016);
  for (let k = 0; k < 10; k++) stAvatars.setSelf(2, st(ST_POSE_WALK, 1.2), 1 / 30);
  const r0 = rigs().find((o) => Math.abs(o.position.x - 1) < 1e-9)!;
  assert.ok(r0, 'bản sao của mình');
  stAvatars.sync([], -1);                        // phiên sang 'solo' (lost): danh sách trống, mySlot = -1
  assert.equal(stAvatars.self, 2); assert.equal(stAvatars.debug(2)!.real, true, 'không mất khung nào');
  assert.equal(stAvatars.debug(3), null, 'người khác biến mất');
  stAvatars.setSelf(2, st(ST_POSE_WALK, 1.2), 1 / 30);
  assert.ok(rigs().includes(r0), 'cùng bản sao, không dựng lại'); assert.equal(rigs().length, 1);
  /* bị thu chỗ: sync(-1) rồi setSelf(null) như stroll/index.ts */
  stAvatars.setSelf(2, null);
  assert.equal(stAvatars.self, -1); assert.equal(stAvatars.debug(2), null); assert.equal(rigs().length, 0);
});

/* ===== Hình khối (hình tạm) và nội suy dáng bậc thang: giữ từ bản trước ===== */
const cap = CONFIG.stroll.cadenceMax * CONFIG.people.run.cadence;
const v = () => ({ amp: -1, cadence: -1, flags: -1 });

test('stAvatarVar: 5 dáng cho đúng biên độ và cờ', () => {
  const o = v();
  stAvatarVar(ST_POSE_IDLE, 0, o); assert.equal(o.amp, 0); assert.equal(o.flags, 0);
  stAvatarVar(ST_POSE_WALK, CONFIG.stroll.walk, o); assert.equal(o.amp, ppAmp('walk')); assert.equal(o.flags, 0);
  stAvatarVar(ST_POSE_RUN, CONFIG.stroll.run, o); assert.equal(o.amp, ppAmp('run')); assert.equal(o.flags, 0);
  stAvatarVar(ST_POSE_FALL, CONFIG.stroll.walk, o); assert.equal(o.amp, 0); assert.equal(o.flags, 0);
  stAvatarVar(ST_POSE_PHOTO, 0, o); assert.equal(o.amp, 0); assert.equal(o.flags & PP_FLAG.photo, PP_FLAG.photo);
});

test('hình khối 10 m/s: nhịp = cadenceMax × run.cadence (bị kẹp)', () => {
  const o = v(); stAvatarVar(ST_POSE_RUN, 10, o);
  assert.ok(Math.abs(o.cadence - cap) < 1e-9, `${o.cadence} ≠ ${cap}`);
});

test('ExTrack.sample(step = true): dáng 1 rồi 4 trả 1 ở giữa khoảng, 4 từ mẫu sau', () => {
  const t = new ExTrack(); t.push(0, 0, 0, 0, 0, 1); t.push(100, 10, 0, 0, 0, 4);
  const o = { x: 0, y: 0, z: 0, yaw: 0, bank: 0 };
  assert.equal(t.sample(50, o, true), true); assert.equal(o.bank, 1); assert.ok(Math.abs(o.x - 5) < 1e-9, 'vị trí vẫn nội suy');
  t.sample(99.9, o, true); assert.equal(o.bank, 1);
  t.sample(100, o, true); assert.equal(o.bank, 4);
  t.sample(150, o, true); assert.equal(o.bank, 4);
  t.sample(50, o); assert.ok(Math.abs(o.bank - 2.5) < 1e-9, 'mặc định vẫn nội suy tuyến tính');
});
