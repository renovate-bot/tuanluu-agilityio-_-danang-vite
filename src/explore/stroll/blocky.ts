/* ===== Đi dạo: hình người khối (hình tạm khi mô hình có xương chưa nạp xong hoặc nạp lỗi) =====
   Một InstancedMesh 5 instance (chỉ số = slot đi dạo; đi một mình dùng 0), hình người đi bộ có sẵn (ppBuildGeometry) và vật liệu dùng chung (ppMaterial):
   tay chân vung trong shader theo aVar, nên đổi dáng chỉ là ghi 4 số của instance. Lớp 1 (không vào phản chiếu nước), không đổ bóng: thêm đúng 1 lệnh vẽ khi có instance hiện.
   Áo màu multiParams.colors[slot] (như cánh dù), quần một màu tối CONFIG.stroll.pants. Instance không hiện thu về scale 0; không instance nào hiện thì mesh.visible = false.
   Không có dáng nhảy (D-030); dáng rơi (3) đứng yên như bản cũ. avatars.ts quyết slot nào hiện hình khối. Không cấp phát mỗi khung (D-018). */
import * as THREE from 'three';
import { CONFIG } from '../../config';
import { shared } from '../../core/shared';
import { ppBuildGeometry } from '../../common/people/shapes';
import { ppMaterial } from '../../common/people/material';
import { ppAmp, ppCadence, ppStride } from '../../common/people/gait';
import { PP_FLAG } from '../../common/people/kinds';
import { ST_POSE_WALK, ST_POSE_RUN, ST_POSE_PHOTO } from './motion';

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

let mesh: THREE.InstancedMesh | null = null, aVar: THREE.InstancedBufferAttribute | null = null;
const shown = new Uint8Array(N);                       // instance đang hiện
const cur = new Float32Array(N * 3).fill(-1);          // amp, cadence, flags đang ghi (để biết khi nào phải ghi lại aVar)
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _one = new THREE.Vector3(1, 1, 1), _zero = new THREE.Matrix4().makeScale(0, 0, 0), _up = new THREE.Vector3(0, 1, 0);
const _var = { amp: 0, cadence: 0, flags: 0 };

export const stBlocky = {
  get mesh(): THREE.InstancedMesh | null { return mesh; },
  /* Instance i có đang hiện không (cho test / debug) */
  shown(i: number): boolean { return shown[i] === 1; },

  /* Dựng lần đầu gọi (avatars.ts thêm vào nhóm stroll-people); các lần sau trả lại mesh cũ */
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
    mesh.name = 'stroll-blocky';
    for (let i = 0; i < N; i++) { mesh.setColorAt(i, col.set(M.colors[i % M.colors.length])); mesh.setMatrixAt(i, _zero); }   // setColorAt bắt buộc (USE_INSTANCING_COLOR)
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.layers.set(1); mesh.castShadow = false; mesh.receiveShadow = false; mesh.frustumCulled = false;
    shown.fill(0); cur.fill(-1); mesh.visible = false;
    return mesh;
  },

  /* Instance i: hiện tại (x, y, z) hướng yaw với dáng pose (speed cho nhịp bước), hoặc ẩn (st = null) */
  place(i: number, st: { x: number; y: number; z: number; yaw: number; pose: number } | null, speed: number): void {
    if (!mesh || !aVar) return;
    if (!st) {
      if (!shown[i]) return;
      shown[i] = 0; mesh.setMatrixAt(i, _zero); mesh.instanceMatrix.needsUpdate = true;
      return;
    }
    shown[i] = 1;
    mesh.setMatrixAt(i, _m.compose(_p.set(st.x, st.y, st.z), _q.setFromAxisAngle(_up, st.yaw), _one));   // hình hướng +X: quay yaw quanh Y ra (cos yaw, 0, −sin yaw)
    mesh.instanceMatrix.needsUpdate = true;
    stAvatarVar(st.pose, speed, _var);
    const c = i * 3;
    if (_var.amp === cur[c] && _var.cadence === cur[c + 1] && _var.flags === cur[c + 2]) return;
    const a = aVar.array as Float32Array, o = i * 4, now = shared.uTime.value;
    const ph = now * a[o + 3] + a[o];   // giữ pha liền khi đổi nhịp: φ(now) không nhảy
    a[o] = (((ph - now * _var.cadence) % TAU) + TAU) % TAU; a[o + 1] = _var.amp; a[o + 2] = _var.flags; a[o + 3] = _var.cadence;
    cur[c] = _var.amp; cur[c + 1] = _var.cadence; cur[c + 2] = _var.flags;
    aVar.needsUpdate = true;
  },

  /* Ẩn cả mesh khi không instance nào hiện (không tốn lệnh vẽ) */
  refresh(): void {
    if (!mesh) return;
    let any = false;
    for (let i = 0; i < N; i++) if (shown[i]) { any = true; break; }
    mesh.visible = any;
  }
};
