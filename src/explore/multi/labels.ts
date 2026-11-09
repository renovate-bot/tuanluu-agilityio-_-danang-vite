/* ===== Dù lượn nhiều người: nhãn tên nổi dưới cánh dù người khác =====
   Một div cho mỗi slot trong #exMpLabels. Điểm đặt nhãn thấp hơn dù labelBelow m (tên nằm dưới cánh, không che dù), ẩn khi sau camera hoặc slot chưa hiện.
   Chỉ ghi DOM khi chữ đổi (tên + khoảng cách, làm tươi ≤ 5 lần/s) hoặc vị trí lệch quá 1 px. Không cấp phát mỗi khung (D-018). */
import * as THREE from 'three';
import { CONFIG } from '../../config';
import type { exRemotes } from './remote';

const M = CONFIG.explore.multi;
interface Lab { el: HTMLElement; txt: string; x: number; y: number; shown: boolean; tMs: number }
let labs: Lab[] | null = null;
const _v = new THREE.Vector3();

function init(): Lab[] | null {
  const box = document.getElementById('exMpLabels');
  if (!box) return null;
  return Array.from({ length: M.slots }, () => {
    const el = document.createElement('div'); el.className = 'ex-mp-label'; el.hidden = true; box.appendChild(el);
    return { el, txt: '', x: -1e9, y: -1e9, shown: false, tMs: -1e9 };
  });
}

// Khoảng cách làm tròn: < 1000 m ghi "NNN m", còn lại "N.N km"
const dist = (d: number) => d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(1)} km`;

export function exLabelsUpdate(camera: THREE.Camera, remotes: typeof exRemotes, nowMs: number): void {
  if (!labs && !(labs = init())) return;
  const w = window.innerWidth, h = window.innerHeight;
  for (let i = 0; i < labs.length; i++) {
    const L = labs[i], st = remotes.slotState(i);
    let vis = false;
    if (st) {
      _v.set(st.pos.x, st.pos.y - M.labelBelow, st.pos.z).applyMatrix4(camera.matrixWorldInverse);
      if (-_v.z > 0.1) {   // trước camera
        _v.applyMatrix4(camera.projectionMatrix);
        const px = (_v.x * 0.5 + 0.5) * w, py = (-_v.y * 0.5 + 0.5) * h;
        if (px > -80 && px < w + 80 && py > -40 && py < h + 40) {
          vis = true;
          if (nowMs - L.tMs >= 200) {
            L.tMs = nowMs;
            const txt = `${remotes.name(i)} · ${dist(Math.hypot(st.pos.x - camera.position.x, st.pos.y - camera.position.y, st.pos.z - camera.position.z))}`;
            if (txt !== L.txt) { L.txt = txt; L.el.textContent = txt; }
          }
          if (Math.abs(px - L.x) > 1 || Math.abs(py - L.y) > 1) { L.x = px; L.y = py; L.el.style.transform = `translate(${px.toFixed(0)}px,${py.toFixed(0)}px) translateX(-50%)`; }
        }
      }
    }
    if (vis !== L.shown) { L.shown = vis; L.el.hidden = !vis; }
  }
}

/* Ẩn hết nhãn (rời phòng) */
export function exLabelsClear(): void {
  if (!labs) return;
  for (const L of labs) { L.shown = false; L.el.hidden = true; L.x = L.y = -1e9; }
}
