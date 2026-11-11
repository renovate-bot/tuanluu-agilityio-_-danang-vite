/* ===== Đi dạo: nhân vật hiển thị (mình + tối đa 4 người khác) =====
   Nhóm 'stroll-people' (THREE.Group): mỗi slot đi dạo (đi một mình dùng 0) hiện bằng một nhân vật có xương (rig.ts, mô hình theo stModelFor: mình luôn 0, người khác 1 + slot mod 4).
   Mô hình chưa nạp xong hoặc nạp lỗi: slot hiện bằng hình khối (blocky.ts, InstancedMesh con của nhóm) nên lỗi mạng không bao giờ làm mất nhân vật.
   - Nạp lười: lần đầu một slot đang hiện cần mô hình k thì gọi bộ nạp (stRigLoad, test thay bằng __setLoader); kết quả chỉ vào bộ đệm sources[k].
     Bản sao chỉ tạo trong vòng khung (stPlace) cho slot đang hiện và đúng mô hình lúc đó, nên kết quả về muộn (slot đã đổi chủ, đã trống, đã rời chế độ) không bao giờ gắn nhầm (Review Focus 2).
   - Slot đổi chủ / đổi mô hình / clear(): gỡ bản sao khỏi nhóm, bỏ mixer (StRig.dispose; geometry / texture của nguồn dùng chung giữ lại).
   - dt cho mixer: mình nhận dt của bước chuyển động qua setSelf; người khác dùng hiệu nowMs giữa hai lần update; StRig kẹp ≤ stroll.dtMax (Review Focus 3).
   - Người khác nội suy bằng ExTrack như remote.ts (trường thứ 6 chở pose, lấy mẫu bậc thang step = true); slot đổi chủ thì xóa mẫu và ẩn tới mẫu đầu.
   Lớp 1, không đổ bóng (rig.ts, blocky.ts). build() chỉ dựng (lần đầu gọi, không lúc dựng cảnh), bên gọi tự thêm vào scene. Không cấp phát mỗi khung (D-018). */
import * as THREE from 'three';
import { CONFIG } from '../../config';
import { ExTrack, type ExPose } from '../multi/interp';
import type { Flyer } from '../multi/protocol';
import { ST_POSE_WALK, ST_POSE_RUN, type StState } from './motion';
import { stModelFor } from './anim';
import { stBlocky } from './blocky';
import { stRigLoad, StRig, type StRigSource } from './rig';

export { stAvatarVar } from './blocky';

const M = CONFIG.explore.multi, C = CONFIG.stroll, N = M.stroll.slots;

interface StSlot {
  who: 0 | 1 | 2;             // 0 trống, 1 mình, 2 người khác
  name: string | null;        // tên người khác (từ sync); null = không có
  track: ExTrack;
  pose: ExPose;               // đệm lấy mẫu (bank chở pose)
  st: { x: number; y: number; z: number; yaw: number; pose: number };   // trạng thái trả cho slotState
  live: boolean;              // đang hiện
  rig: StRig | null;          // nhân vật có xương đang gắn (null: hình khối)
  model: number;              // mô hình của rig
}

const slots: StSlot[] = Array.from({ length: N }, () => ({
  who: 0 as const, name: null, track: new ExTrack(), pose: { x: 0, y: 0, z: 0, yaw: 0, bank: 0 },
  st: { x: 0, y: 0, z: 0, yaw: 0, pose: 0 }, live: false, rig: null, model: -1
}));
let group: THREE.Group | null = null, me = -1, lastNow = -1;

/* Bộ đệm mô hình: undefined = chưa có kết quả, null = nạp lỗi (giữ hình khối, không thử lại), còn lại = nguồn */
let loader: (model: number) => Promise<StRigSource | null> = stRigLoad;
let sources: (StRigSource | null | undefined)[] = [];
let asked = new Set<number>();
let gen = 0;   // thế hệ bộ nạp: __setLoader tăng để kết quả của bộ nạp cũ bị bỏ

/* Nguồn của mô hình k nếu đã nạp xong; chưa thì bắt đầu nạp (một lần) và trả null. Không ném */
function stNeed(model: number): StRigSource | null {
  const s = sources[model];
  if (s !== undefined) return s;
  if (!asked.has(model)) {
    asked.add(model);
    const g = gen;
    const done = (r: StRigSource | null) => { if (g === gen) sources[model] = r; };
    try { loader(model).then(done, () => done(null)); } catch { done(null); }
  }
  return null;
}

/* Gỡ nhân vật thật của slot i (đổi chủ, đổi mô hình, rời chế độ) */
function stDrop(i: number): void {
  const s = slots[i];
  if (!s.rig) return;
  s.rig.dispose(); s.rig = null; s.model = -1;
}

/* Đặt slot i theo s.st: nhân vật thật nếu mô hình đã có, không thì hình khối. speed (m/s) chọn đoạn / nhịp bước, dt (s) cho mixer */
function stPlace(i: number, speed: number, dt: number): void {
  const s = slots[i];
  if (!group) return;
  if (!s.live) { stBlocky.place(i, null, 0); if (s.rig) s.rig.root.visible = false; return; }
  const model = stModelFor(i, s.who === 1);
  if (s.rig && s.model !== model) stDrop(i);
  if (!s.rig) {
    const src = stNeed(model);
    if (src) { s.rig = new StRig(src); s.model = model; group.add(s.rig.root); }
  }
  const t = s.st;
  if (!s.rig) { stBlocky.place(i, t, speed); return; }
  stBlocky.place(i, null, 0);
  const r = s.rig.root;
  r.visible = true;
  r.position.set(t.x, t.y, t.z); r.rotation.set(0, t.yaw, 0);   // mô hình hướng +X như hình khối: yaw quanh Y
  s.rig.pose(t.pose, speed, dt);
}

function stHide(i: number): void {
  const s = slots[i];
  s.track.reset(); s.live = false;
  stDrop(i);
  stPlace(i, 0, 0);
}

function stRefreshVisible(): void {
  if (!group) return;
  let any = false;
  for (const s of slots) if (s.live) { any = true; break; }
  group.visible = any;
  stBlocky.refresh();
}

/* Tốc độ danh định theo dáng cho người khác (gói vị trí không có tốc độ) */
const stPoseSpeed = (pose: number) => (pose === ST_POSE_RUN ? C.run : pose === ST_POSE_WALK ? C.walk : 0);

export const stAvatars = {
  get mesh(): THREE.Group | null { return group; },
  get self(): number { return me; },   // slot nhân vật của mình, -1 nếu không có (nhãn tên bỏ qua slot này)

  /* Dựng lần đầu gọi (lười, ngoài thứ tự dựng cảnh), các lần sau trả lại nhóm cũ. Bên gọi thêm vào scene */
  build(): THREE.Group {
    if (group) return group;
    group = new THREE.Group();
    group.name = 'stroll-people';
    group.add(stBlocky.build());
    group.visible = false;
    return group;
  },

  /* Bắt đầu nạp mô hình (mặc định 0, nhân vật của mình) trước khi cần, vd. lúc chọn thẻ Đi dạo. Không ném */
  preload(model = 0): void { stNeed(model); },

  /* Nhân vật của mình ở slot (đi một mình: 0); s = null thì bỏ hiện slot đó. dt (s): bước chuyển động vừa chạy, cho mixer */
  setSelf(slot: number, s: StState | null, dt = 0): void {
    if (s === null) {
      if (me >= 0 && slots[me]?.who === 1) { slots[me].who = 0; stHide(me); }
      me = -1; stRefreshVisible(); return;
    }
    const x = slots[slot];
    if (!x) return;
    if (me !== slot && me >= 0 && slots[me]?.who === 1) { slots[me].who = 0; stHide(me); }
    if (x.who !== 1) stDrop(slot);   // slot vừa thành của mình: bản sao người khác (nếu còn) bỏ
    me = slot; x.who = 1; x.track.reset();
    const t = x.st;
    t.x = s.x; t.y = s.y; t.z = s.z; t.yaw = s.yaw; t.pose = s.pose;
    x.live = true;
    stPlace(slot, s.speed, dt);
    stRefreshVisible();
  },

  /* Danh sách người đi dạo đổi (sảnh, vào, ra): slot đổi chủ thì xóa mẫu, ẩn tới mẫu đầu; slot trống thì ẩn. Slot của mình do setSelf lo */
  sync(walkers: Flyer[], mySlot: number): void {
    /* Được cấp slot khác: bỏ nhân vật ở slot cũ, setSelf sẽ đặt lại. mySlot < 0 (mất kết nối → đi một mình, bị thu chỗ → xem) thì giữ nguyên:
       đi tiếp một mình vẫn setSelf cùng slot (không gỡ rồi dựng lại bản sao, chuyển động không phát lại từ đầu); sang xem thì stroll gọi setSelf(null) */
    if (mySlot >= 0 && mySlot !== me && me >= 0 && slots[me]?.who === 1) { slots[me].who = 0; stHide(me); me = -1; }
    for (let i = 0; i < N; i++) {
      const s = slots[i];
      let name: string | null = null;
      for (const w of walkers) if (w.slot === i) { name = w.name; break; }
      if (i === me) { s.name = name; continue; }   // nhân vật của mình: chỉ setSelf đổi
      if (i === mySlot) { s.name = name; if (s.who === 2) { s.who = 0; stHide(i); } continue; }   // slot vừa thành của mình: bỏ người khác cũ, chờ setSelf
      if (name === null) { s.name = null; if (s.who === 2) { s.who = 0; stHide(i); } continue; }
      if (name !== s.name || s.who !== 2) { s.name = name; s.who = 2; stHide(i); }
    }
    stRefreshVisible();
  },

  /* Gói vị trí gộp: w = [slot, x, y, z, yaw, pose, giờ gửi?]; chỉ nhận slot người khác đã biết chủ */
  onPos(w: number[][], nowMs: number): void {
    for (const e of w) {
      const i = e[0], s = slots[i];
      if (!s || i === me || s.who !== 2) continue;
      s.track.feed(e, nowMs, M);
    }
  },

  /* Mỗi khung: đặt người khác theo mẫu nội suy (pose bậc thang); dt mixer = hiệu nowMs giữa hai lần gọi (StRig kẹp dtMax) */
  update(nowMs: number): void {
    const dt = lastNow < 0 ? 0 : (nowMs - lastNow) / 1000;
    lastNow = nowMs;
    const t = nowMs - M.interpSends * 1000 / M.sendHz;
    for (let i = 0; i < N; i++) {
      const s = slots[i];
      if (s.who !== 2) continue;
      if (!s.track.sample(t, s.pose, true)) { if (s.live) { s.live = false; stPlace(i, 0, 0); } continue; }
      const p = s.pose, st = s.st;
      st.x = p.x; st.y = p.y; st.z = p.z; st.yaw = p.yaw; st.pose = Math.round(p.bank);
      s.live = true;
      stPlace(i, stPoseSpeed(st.pose), dt);
    }
    stRefreshVisible();
  },

  /* Trạng thái đang hiện của slot (cho nhãn tên, camera dù lượn); null nếu trống hoặc chưa có mẫu */
  slotState(slot: number): { x: number; y: number; z: number; yaw: number; pose: number } | null {
    const s = slots[slot];
    return s && s.live ? s.st : null;
  },

  /* Tên người ở slot (theo sync, cả slot của mình); null nếu trống hoặc đi một mình */
  name(slot: number): string | null { const s = slots[slot]; return s ? s.name : null; },

  /* Rời chế độ / rời phòng: gỡ hết nhân vật thật, ẩn hình khối, quên tên (nhóm và bộ đệm mô hình giữ lại để tái dùng) */
  clear(): void {
    me = -1; lastNow = -1;
    for (let i = 0; i < N; i++) { const s = slots[i]; s.who = 0; s.name = null; stHide(i); }
    stRefreshVisible();
  },

  /* Cho test (stroll-check, multi-check): slot trống → null; real = đang hiện bằng nhân vật có xương; mix = trọng số ST_CLIPS đang dùng */
  debug(slot: number): { model: number; real: boolean; mix: number[]; rate: number } | null {
    const s = slots[slot];
    if (!s || s.who === 0) return null;
    const r = s.rig, real = !!r && s.live && r.root.visible;
    return { model: r ? s.model : stModelFor(slot, s.who === 1), real, mix: r ? Array.from(r.w) : [], rate: r ? r.rate : 0 };
  },

  /* Chỉ dùng trong unit test: thay bộ nạp (null = stRigLoad thật) và quên bộ đệm mô hình */
  __setLoader(fn: ((model: number) => Promise<StRigSource | null>) | null): void {
    loader = fn || stRigLoad; gen++;
    sources = []; asked = new Set();
  }
};
