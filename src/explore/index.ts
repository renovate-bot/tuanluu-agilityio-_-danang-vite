/* ============================ Tự khám phá: điều phối chế độ bay dù lượn ============================
   Nối flight (mô hình), glider (dù), chase (camera) với vòng animate, phím và URL.
   `?explore=glider` bay thẳng; không tham số (hoặc `?test&chooser`) hiện màn chọn; Esc tải lại trang không còn tham số explore. Camera do explore.update đặt sau updateCamera. */
import * as THREE from 'three';
import { scene, camera, controls } from '../core/renderer';
import { cam, keys } from '../views/state';
import { exCreate, exStep, exInputFromKeys, type GliderState, type GliderInput } from './flight';
import { exBuildGlider, exPlaceGlider } from './glider';
import { exChase } from './chase';
import { exShowChooser } from './chooser';

const _inp: GliderInput = { turn: 0, climb: 0 };   // đầu vào tái dùng mỗi khung

let glider: THREE.Group | null = null;
let state: GliderState | null = null;

const active = () => cam.mode === 'glider' && state !== null;

/* Một bước: mô phỏng, đặt dù, đặt camera bám */
function advance(dt: number, inp: GliderInput): void {
  exStep(state!, inp, dt);
  exPlaceGlider(glider!, state!);
  exChase(camera, controls.target, state!, dt);
}

export const explore = {
  active,
  get state() { return state; },
  get glider() { return glider; },
  start(): void {
    state = exCreate();
    if (!glider) glider = exBuildGlider();
    if (!glider.parent) scene.add(glider);
    cam.flight.then = null; cam.mode = 'glider'; controls.enabled = false;
    exPlaceGlider(glider, state);
    exChase(camera, controls.target, state, 0, true);
    document.body.classList.add('explore');
  },
  update(dt: number): void {
    if (!active()) return;
    advance(dt, exInputFromKeys(keys, _inp));
  },
  /* Cho test: như update nhưng nhận đầu vào trực tiếp */
  step(dt: number, inp: GliderInput): void {
    if (active()) advance(dt, inp);
  },
  exit(): void {
    const u = new URL(location.href);
    u.searchParams.delete('explore'); u.searchParams.delete('chooser');
    if (u.href === location.href) location.reload();   // URL chỉ khác phần #ngôn-ngữ: replace chỉ là điều hướng fragment, không tải lại
    else location.replace(u.toString());
  },
};

export function setupExplore(): void {
  window.addEventListener('keydown', (e) => {
    if (!active()) return;
    if (e.key === 'Escape') { explore.exit(); return; }   // Esc thoát kể cả khi đang focus ô chọn
    if (e.ctrlKey || e.metaKey || e.altKey) return;   // phím tắt trình duyệt (Cmd+S...) không lái dù, tránh kẹt phím
    const t = e.target as HTMLElement | null;
    if (t && /^(SELECT|INPUT|TEXTAREA)$/.test(t.tagName)) return;   // phím trong ô chọn/nhập không lái dù
    const k = e.key.toLowerCase(); keys.add(k);
    if (k.startsWith('arrow')) e.preventDefault();
  });
  /* Chọn ngôn ngữ / chất lượng bằng chuột xong thì bỏ focus, nếu không mũi tên và WASD sau đó đổi cài đặt thay vì lái dù. Dùng Tab + bàn phím thì giữ nguyên. */
  for (const id of ['langSelect', 'qualitySel']) {
    const sel = document.getElementById(id); if (!sel) continue;
    let byMouse = false;
    sel.addEventListener('pointerdown', () => { byMouse = true; });
    sel.addEventListener('keydown', () => { byMouse = false; });
    sel.addEventListener('change', () => { if (byMouse && active()) sel.blur(); byMouse = false; });
  }
  const q = new URLSearchParams(location.search);
  if (q.has('test')) document.body.classList.add('ex-test');   // giữ HUD khi bay để test đo draw call
  document.getElementById('btnExExit')?.addEventListener('click', () => explore.exit());
  if (q.get('explore') === 'glider') { explore.start(); return; }
  if (!q.has('test') || q.has('chooser')) exShowChooser((choice) => { if (choice === 'glider') explore.start(); });   // 'guided': màn chọn tự ẩn, giao diện cũ
}
