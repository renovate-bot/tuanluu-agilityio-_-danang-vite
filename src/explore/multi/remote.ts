/* ===== Dù lượn nhiều người: dù của người bay cùng =====
   Mỗi slot một dù màu riêng (multiParams.colors[slot]), dựng lần đầu slot có người (sync) rồi tái dùng; hình học dùng chung, vật liệu riêng.
   Vị trí nhận 5 lần/s được nội suy, lấy mẫu chậm interpSends chu kỳ để luôn có hai mẫu kẹp. Slot đổi chủ (đổi tên, hoặc từ trống sang có người)
   thì xóa mẫu cũ và ẩn dù tới khi có mẫu đầu, nên dù người mới không trượt từ chỗ người cũ. Không cấp phát mỗi khung (D-018). */
import * as THREE from 'three';
import { scene } from '../../core/renderer';
import { CONFIG } from '../../config';
import { exBuildGlider, exPlaceGlider } from '../glider';
import type { GliderState } from '../flight';
import { ExTrack, type ExPose } from './interp';
import type { Flyer } from './protocol';

const M = CONFIG.explore.multi;

interface RemoteSlot {
  name: string | null;        // null = slot trống
  group: THREE.Group | null;
  track: ExTrack;
  pose: ExPose;               // đệm lấy mẫu
  state: GliderState;         // trạng thái trả cho exPlaceGlider và slotState
  live: boolean;              // đã có mẫu và đang hiện
}

const slots: RemoteSlot[] = Array.from({ length: M.slots }, () => ({
  name: null, group: null, track: new ExTrack(), pose: { x: 0, y: 0, z: 0, yaw: 0, bank: 0 },
  state: { pos: new THREE.Vector3(), yaw: 0, bank: 0, ret: 0, speed: 0 }, live: false
}));
let me = -1;

function hide(s: RemoteSlot): void {
  s.track.reset(); s.live = false;
  if (s.group) s.group.visible = false;
}

export const exRemotes = {
  /* Danh sách người bay đổi (sảnh, vào, ra): dựng dù cho slot mới, đặt lại slot đổi chủ, ẩn slot trống */
  sync(flyers: Flyer[], mySlot: number): void {
    me = mySlot;
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      let name: string | null = null;
      if (i !== mySlot) for (const f of flyers) if (f.slot === i) { name = f.name; break; }
      if (name === null) { s.name = null; hide(s); continue; }
      if (name !== s.name) {
        s.name = name; hide(s);
        if (!s.group) { s.group = exBuildGlider(M.colors[i % M.colors.length]); s.group.visible = false; s.group.traverse(o => o.layers.set(1)); scene.add(s.group); }   // lớp 1: không vẽ vào phản chiếu nước, giữ draw call ≈ 1 mỗi dù
      }
    }
  },

  /* Gói vị trí gộp: f = [slot, x, y, z, yaw, bank]; chỉ nhận slot đã biết chủ và không phải của mình */
  onPos(f: number[][], nowMs: number): void {
    for (const e of f) {
      const i = e[0], s = slots[i];
      if (!s || i === me || s.name === null) continue;
      s.track.push(nowMs, e[1], e[2], e[3], e[4], e[5]);
    }
  },

  update(nowMs: number): void {
    const t = nowMs - M.interpSends * 1000 / M.sendHz;
    for (const s of slots) {
      if (s.name === null || !s.group) continue;
      if (!s.track.sample(t, s.pose)) { s.live = false; s.group.visible = false; continue; }
      const p = s.pose;
      s.state.pos.set(p.x, p.y, p.z); s.state.yaw = p.yaw; s.state.bank = p.bank;
      exPlaceGlider(s.group, s.state);
      s.group.visible = s.live = true;
    }
  },

  /* Trạng thái đã nội suy của dù ở slot (cho nhãn tên); null nếu chưa có hoặc slot trống */
  slotState(slot: number): GliderState | null {
    const s = slots[slot];
    return s && s.live ? s.state : null;
  },

  /* Dù và tên của slot (cho nhãn tên và test); null nếu slot trống */
  group(slot: number): THREE.Group | null { const s = slots[slot]; return s && s.name !== null ? s.group : null; },
  name(slot: number): string | null { const s = slots[slot]; return s ? s.name : null; },

  /* Rời phòng: ẩn hết, quên tên (dù đã dựng giữ lại để tái dùng) */
  clear(): void {
    me = -1;
    for (const s of slots) { s.name = null; hide(s); }
  }
};
