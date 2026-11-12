/* ===== Dù lượn, đi dạo và lái xe nhiều người: nhãn tên nổi cạnh người chơi khác =====
   Một div cho mỗi slot bay, mỗi slot đi dạo và mỗi slot lái xe trong #exMpLabels (theo thứ tự đó). Dù: điểm đặt nhãn thấp hơn dù labelBelow m (tên nằm dưới cánh, không che dù);
   người đi dạo: cao hơn chân CONFIG.stroll.labelAbove m (trên đầu); xe: trên nóc, cao hơn mặt đường car.height + drive.remote.labelAbove m. Ẩn khi sau camera hoặc slot chưa hiện; nhân vật của mình không có nhãn.
   Chỉ ghi DOM khi chữ đổi (tên + khoảng cách, làm tươi ≤ 5 lần/s) hoặc vị trí lệch quá 1 px. Không cấp phát mỗi khung (D-018). */
import * as THREE from 'three';
import { CONFIG } from '../../config';
import type { exRemotes } from './remote';
import type { stAvatars } from '../stroll/avatars';
import type { exDrivers } from './remoteDrive';

const M = CONFIG.explore.multi, NW = M.stroll.slots, ND = M.drive.slots, CAR_TOP = CONFIG.drive.car.height + CONFIG.drive.remote.labelAbove;
interface Lab { el: HTMLElement; txt: string; x: number; y: number; shown: boolean; tMs: number }
let labs: Lab[] | null = null;   // M.slots nhãn dù, NW nhãn người đi dạo rồi ND nhãn xe
const _v = new THREE.Vector3();

function init(): Lab[] | null {
  const box = document.getElementById('exMpLabels');
  if (!box) return null;
  return Array.from({ length: M.slots + NW + ND }, () => {
    const el = document.createElement('div'); el.className = 'ex-mp-label'; el.hidden = true; box.appendChild(el);
    return { el, txt: '', x: -1e9, y: -1e9, shown: false, tMs: -1e9 };
  });
}

// Khoảng cách làm tròn: < 1000 m ghi "NNN m", còn lại "N.N km"
const dist = (d: number) => d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(1)} km`;

/* Đặt một nhãn tại điểm (x, y, z) với tên name; trả true nếu hiện */
function place(L: Lab, camera: THREE.Camera, x: number, y: number, z: number, name: string, nowMs: number, w: number, h: number): boolean {
  _v.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
  if (-_v.z <= 0.1) return false;   // sau camera
  _v.applyMatrix4(camera.projectionMatrix);
  const px = (_v.x * 0.5 + 0.5) * w, py = (-_v.y * 0.5 + 0.5) * h;
  if (px <= -80 || px >= w + 80 || py <= -40 || py >= h + 40) return false;
  if (nowMs - L.tMs >= 200) {
    L.tMs = nowMs;
    const txt = `${name} · ${dist(Math.hypot(x - camera.position.x, y - camera.position.y, z - camera.position.z))}`;
    if (txt !== L.txt) { L.txt = txt; L.el.textContent = txt; }
  }
  if (Math.abs(px - L.x) > 1 || Math.abs(py - L.y) > 1) { L.x = px; L.y = py; L.el.style.transform = `translate(${px.toFixed(0)}px,${py.toFixed(0)}px) translateX(-50%)`; }
  return true;
}

export function exLabelsUpdate(camera: THREE.Camera, remotes: typeof exRemotes, nowMs: number, walkers?: typeof stAvatars, drivers?: typeof exDrivers): void {
  if (!labs && !(labs = init())) return;
  const w = window.innerWidth, h = window.innerHeight;
  for (let i = 0; i < M.slots; i++) {
    const L = labs[i], st = remotes.slotState(i);
    const vis = !!st && place(L, camera, st.pos.x, st.pos.y - M.labelBelow, st.pos.z, remotes.name(i), nowMs, w, h);
    if (vis !== L.shown) { L.shown = vis; L.el.hidden = !vis; }
  }
  for (let i = 0; i < NW; i++) {
    const L = labs[M.slots + i], st = walkers && i !== walkers.self ? walkers.slotState(i) : null, nm = st ? walkers!.name(i) : null;
    const vis = !!st && nm !== null && place(L, camera, st.x, st.y + CONFIG.stroll.labelAbove, st.z, nm, nowMs, w, h);
    if (vis !== L.shown) { L.shown = vis; L.el.hidden = !vis; }
  }
  for (let i = 0; i < ND; i++) {
    const L = labs[M.slots + NW + i], st = drivers ? drivers.slotState(i) : null, nm = st ? drivers!.name(i) : null;   // xe của mình không có trong exDrivers (slotState null)
    const vis = !!st && nm !== null && place(L, camera, st.x, st.y + CAR_TOP, st.z, nm, nowMs, w, h);
    if (vis !== L.shown) { L.shown = vis; L.el.hidden = !vis; }
  }
}

/* Ẩn hết nhãn (rời phòng) */
export function exLabelsClear(): void {
  if (!labs) return;
  for (const L of labs) { L.shown = false; L.el.hidden = true; L.x = L.y = -1e9; }
}
