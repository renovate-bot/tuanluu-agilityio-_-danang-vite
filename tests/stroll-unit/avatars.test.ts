/* ===== Đi dạo: test nhân vật hiển thị (src/explore/stroll/avatars.ts) và nội suy dáng bậc thang (ExTrack.sample step) ===== */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../src/config.ts';
import { ppAmp } from '../../src/common/people/gait.ts';
import { PP_FLAG } from '../../src/common/people/kinds.ts';
import { ExTrack } from '../../src/explore/multi/interp.ts';
import { stAvatarVar } from '../../src/explore/stroll/avatars.ts';
import { ST_POSE_IDLE, ST_POSE_WALK, ST_POSE_RUN, ST_POSE_JUMP, ST_POSE_PHOTO } from '../../src/explore/stroll/motion.ts';

const cap = CONFIG.stroll.cadenceMax * CONFIG.people.run.cadence;
const v = () => ({ amp: -1, cadence: -1, flags: -1 });

test('stAvatarVar: 5 dáng cho đúng biên độ và cờ', () => {
  const o = v();
  stAvatarVar(ST_POSE_IDLE, 0, o); assert.equal(o.amp, 0); assert.equal(o.flags, 0);
  stAvatarVar(ST_POSE_WALK, CONFIG.stroll.walk, o); assert.equal(o.amp, ppAmp('walk')); assert.equal(o.flags, 0);
  stAvatarVar(ST_POSE_RUN, CONFIG.stroll.run, o); assert.equal(o.amp, ppAmp('run')); assert.equal(o.flags, 0);
  stAvatarVar(ST_POSE_JUMP, CONFIG.stroll.walk, o); assert.equal(o.flags & PP_FLAG.jump, PP_FLAG.jump); assert.equal(o.flags & PP_FLAG.photo, 0);
  stAvatarVar(ST_POSE_PHOTO, 0, o); assert.equal(o.amp, 0); assert.equal(o.flags & PP_FLAG.photo, PP_FLAG.photo); assert.equal(o.flags & PP_FLAG.jump, 0);
  assert.equal(PP_FLAG.jump, 8);
});

test('tốc độ 10 m/s: nhịp = cadenceMax × run.cadence (bị kẹp)', () => {
  const o = v(); stAvatarVar(ST_POSE_RUN, 10, o);
  assert.ok(Math.abs(o.cadence - cap) < 1e-9, `${o.cadence} ≠ ${cap}`);
});

test('tốc độ 3,5 m/s: nhịp ≤ trần và > 0', () => {
  for (const pose of [ST_POSE_WALK, ST_POSE_RUN]) {
    const o = v(); stAvatarVar(pose, 3.5, o);
    assert.ok(o.cadence > 0 && o.cadence <= cap + 1e-9, `pose ${pose}: ${o.cadence}`);
  }
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
