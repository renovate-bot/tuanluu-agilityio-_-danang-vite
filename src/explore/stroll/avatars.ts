/* ===== Đi dạo: nhân vật hiển thị (mình + tối đa 4 người khác) =====
   Một InstancedMesh 5 instance (chỉ số = slot đi dạo; đi một mình dùng 0), hình người đi bộ có sẵn (ppBuildGeometry) và vật liệu dùng chung (ppMaterial):
   tay chân vung trong shader theo aVar, nên đổi dáng chỉ là ghi 4 số của instance. Lớp 1 (không vào phản chiếu nước), không đổ bóng: thêm đúng 1 lệnh vẽ.
   Áo màu multiParams.colors[slot] (như cánh dù), quần một màu tối CONFIG.stroll.pants. Instance trống thu về scale 0; không ai hiện thì mesh.visible = false.
   Người khác nội suy bằng ExTrack như remote.ts (trường thứ 6 chở pose, lấy mẫu bậc thang step = true); slot đổi chủ thì xóa mẫu và ẩn tới mẫu đầu.
   build() chỉ dựng (lần đầu gọi, không lúc dựng cảnh), bên gọi tự thêm vào scene. Không cấp phát mỗi khung (D-018). */
import * as THREE from 'three';
import { CONFIG } from '../../config';
import { shared } from '../../core/shared';
import { ppBuildGeometry } from '../../common/people/shapes';
import { ppMaterial } from '../../common/people/material';
import { ppAmp, ppCadence, ppStride } from '../../common/people/gait';
import { PP_FLAG } from '../../common/people/kinds';
import { ExTrack, type ExPose } from '../multi/interp';
import type { Flyer } from '../multi/protocol';
import { ST_POSE_WALK, ST_POSE_RUN, ST_POSE_PHOTO, type StState } from './motion';

const M = CONFIG.explore.multi, C = CONFIG.stroll, N = M.stroll.slots, TAU = Math.PI * 2;

/* Thuần: dáng (pose) + tốc độ (m/s) → biên độ hông, nhịp (rad/s của φ), cờ instance (khớp aVar của material.ts).
   Nhịp theo tốc độ cho chân trụ không trượt (đi: bước đi; chạy: bước chạy, không chậm hơn nhịp chạy bộ), kẹp ≤ cadenceMax × run.cadence vì 3,5 / 10 m/s nhanh hơn người thật */
export function stAvatarVar(pose: number, speed: number, out: { amp: number; cadence: number; flags: number }): void {
  const cap = C.cadenceMax * CONFIG.people.run.cadence, v = Math.max(0, speed);
  out.amp = 0; out.cadence = 0; out.flags = 0;
  if (pose === ST_POSE_WALK) { out.amp = ppAmp('walk'); out.cadence = Math.min(cap, ppCadence('walk', v, 1)); }
  else if (pose === ST_POSE_RUN) { out.amp = ppAmp('run'); out.cadence = Math.min(cap, Math.max(ppCadence('run', v, 1), (TAU * v) / ppStride('run', 1))); }
  else if (pose === ST_POSE_PHOTO) out.flags = PP_FLAG.photo;
}

interface StSlot {
  who: 0 | 1 | 2;             // 0 trống, 1 mình, 2 người khác
  name: string | null;        // tên người khác (từ sync); null = không có
  track: ExTrack;
  pose: ExPose;               // đệm lấy mẫu (bank chở pose)
  st: { x: number; y: number; z: number; yaw: number; pose: number };   // trạng thái trả cho slotState
  live: boolean;              // đang hiện
  amp: number; cadence: number; flags: number;   // aVar đang ghi (để biết khi nào phải ghi lại)
}

const slots: StSlot[] = Array.from({ length: N }, () => ({
  who: 0 as const, name: null, track: new ExTrack(), pose: { x: 0, y: 0, z: 0, yaw: 0, bank: 0 },
  st: { x: 0, y: 0, z: 0, yaw: 0, pose: 0 }, live: false, amp: -1, cadence: -1, flags: -1
}));
let mesh: THREE.InstancedMesh | null = null, aVar: THREE.InstancedBufferAttribute | null = null, me = -1;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _one = new THREE.Vector3(1, 1, 1), _zero = new THREE.Matrix4().makeScale(0, 0, 0), _up = new THREE.Vector3(0, 1, 0);
const _var = { amp: 0, cadence: 0, flags: 0 };

/* Ghi ma trận và aVar của slot i theo s.st (hoặc thu về scale 0 nếu không hiện); speed cho nhịp bước */
function stPlace(i: number, speed: number): void {
  const s = slots[i];
  if (!mesh || !aVar) return;
  if (!s.live) { mesh.setMatrixAt(i, _zero); mesh.instanceMatrix.needsUpdate = true; return; }
  const t = s.st;
  mesh.setMatrixAt(i, _m.compose(_p.set(t.x, t.y, t.z), _q.setFromAxisAngle(_up, t.yaw), _one));   // hình hướng +X: quay yaw quanh Y ra (cos yaw, 0, −sin yaw)
  mesh.instanceMatrix.needsUpdate = true;
  stAvatarVar(t.pose, speed, _var);
  if (_var.amp === s.amp && _var.cadence === s.cadence && _var.flags === s.flags) return;
  const a = aVar.array as Float32Array, o = i * 4, now = shared.uTime.value;
  const ph = now * a[o + 3] + a[o];   // giữ pha liền khi đổi nhịp: φ(now) không nhảy
  a[o] = (((ph - now * _var.cadence) % TAU) + TAU) % TAU; a[o + 1] = _var.amp; a[o + 2] = _var.flags; a[o + 3] = _var.cadence;
  s.amp = _var.amp; s.cadence = _var.cadence; s.flags = _var.flags;
  aVar.needsUpdate = true;
}

function stHide(i: number): void {
  const s = slots[i];
  s.track.reset(); s.live = false;
  stPlace(i, 0);
}

function stRefreshVisible(): void {
  if (!mesh) return;
  let any = false;
  for (const s of slots) if (s.live) { any = true; break; }
  mesh.visible = any;
}

/* Tốc độ danh định theo dáng cho người khác (gói vị trí không có tốc độ) */
const stPoseSpeed = (pose: number) => (pose === ST_POSE_RUN ? C.run : pose === ST_POSE_WALK ? C.walk : 0);

export const stAvatars = {
  get mesh(): THREE.InstancedMesh | null { return mesh; },
  get self(): number { return me; },   // slot nhân vật của mình, -1 nếu không có (nhãn tên bỏ qua slot này)

  /* Dựng lần đầu gọi (lười, ngoài thứ tự dựng cảnh), các lần sau trả lại mesh cũ. Bên gọi thêm vào scene */
  build(): THREE.InstancedMesh {
    if (mesh) return mesh;
    const geo = ppBuildGeometry(), col = new THREE.Color();
    aVar = new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4); aVar.setUsage(THREE.DynamicDrawUsage);
    const pants = new Float32Array(N * 3);
    col.setHex(C.pants);
    for (let i = 0; i < N; i++) pants.set([col.r, col.g, col.b], i * 3);   // Color chuyển hex sRGB → tuyến tính
    geo.setAttribute('aVar', aVar);
    geo.setAttribute('aPants', new THREE.InstancedBufferAttribute(pants, 3));
    mesh = new THREE.InstancedMesh(geo, ppMaterial(), N);
    mesh.name = 'stroll-people';
    for (let i = 0; i < N; i++) { mesh.setColorAt(i, col.set(M.colors[i % M.colors.length])); mesh.setMatrixAt(i, _zero); }   // setColorAt bắt buộc (USE_INSTANCING_COLOR)
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.layers.set(1); mesh.castShadow = false; mesh.receiveShadow = false; mesh.frustumCulled = false;
    for (const s of slots) s.amp = s.cadence = s.flags = -1;
    for (let i = 0; i < N; i++) stPlace(i, 0);
    stRefreshVisible();
    return mesh;
  },

  /* Nhân vật của mình ở slot (đi một mình: 0); s = null thì bỏ hiện slot đó */
  setSelf(slot: number, s: StState | null): void {
    if (s === null) {
      if (me >= 0 && slots[me]?.who === 1) { slots[me].who = 0; stHide(me); }
      me = -1; stRefreshVisible(); return;
    }
    const x = slots[slot];
    if (!x) return;
    if (me !== slot && me >= 0 && slots[me]?.who === 1) { slots[me].who = 0; stHide(me); }
    me = slot; x.who = 1; x.track.reset();
    const t = x.st;
    t.x = s.x; t.y = s.y; t.z = s.z; t.yaw = s.yaw; t.pose = s.pose;
    x.live = true;
    stPlace(slot, s.speed);
    stRefreshVisible();
  },

  /* Danh sách người đi dạo đổi (sảnh, vào, ra): slot đổi chủ thì xóa mẫu, ẩn tới mẫu đầu; slot trống thì ẩn. Slot của mình do setSelf lo */
  sync(walkers: Flyer[], mySlot: number): void {
    if (mySlot !== me && me >= 0 && slots[me]?.who === 1) { slots[me].who = 0; stHide(me); me = -1; }   // đổi slot của mình: setSelf sẽ đặt lại
    for (let i = 0; i < N; i++) {
      const s = slots[i];
      let name: string | null = null;
      for (const w of walkers) if (w.slot === i) { name = w.name; break; }
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

  /* Mỗi khung: đặt người khác theo mẫu nội suy (pose bậc thang) */
  update(nowMs: number): void {
    const t = nowMs - M.interpSends * 1000 / M.sendHz;
    for (let i = 0; i < N; i++) {
      const s = slots[i];
      if (s.who !== 2) continue;
      if (!s.track.sample(t, s.pose, true)) { if (s.live) { s.live = false; stPlace(i, 0); } continue; }
      const p = s.pose, st = s.st;
      st.x = p.x; st.y = p.y; st.z = p.z; st.yaw = p.yaw; st.pose = Math.round(p.bank);
      s.live = true;
      stPlace(i, stPoseSpeed(st.pose));
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

  /* Rời chế độ / rời phòng: ẩn hết, quên tên (mesh giữ lại để tái dùng) */
  clear(): void {
    me = -1;
    for (let i = 0; i < N; i++) { const s = slots[i]; s.who = 0; s.name = null; stHide(i); }
    stRefreshVisible();
  }
};
