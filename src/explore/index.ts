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
import { exNight, exNightBind, exNightStep } from './nightShows';
import { exMulti } from './multi';
import { stroll, setupStroll } from './stroll';
import { stAvatars } from './stroll/avatars';
import { exWatchShow, exWatchHide, exWatchRender, exFlyNotice } from './multi/watch';
import { CONFIG } from '../config';
import type { SwingController } from '../bridges/song-han/SwingController';

const _inp: GliderInput = { turn: 0, climb: 0, throttle: 0 };   // đầu vào tái dùng mỗi khung

let glider: THREE.Group | null = null;
let state: GliderState | null = null;
let watching = false;   // đang xem người khác bay (hết chỗ hoặc vừa nhường chỗ): không có dù của mình, không đọc phím
let chased = false;     // camera đã bám người được xem lần nào chưa (lần đầu đặt thẳng, không trượt từ xa)
let readout = '';   // chữ đang hiện ở #exSpeed: chỉ ghi DOM khi đổi

const active = () => cam.mode === 'glider' && state !== null;
const inGlider = () => active() || watching;   // Esc và giao diện bay áp cho cả chế độ xem

/* Mỗi khung khi xem: dù người khác, nhãn, danh sách; camera bám dù đang xem (không có người thì giữ nguyên) */
function watchStep(dt: number): void {
  exMulti.update(dt, performance.now(), null);
  const st = exMulti.watchState();
  if (st) { exChase(camera, controls.target, st, dt, !chased); chased = true; }
  exNightStep(dt);
}

/* Đổi phiên khi đang xem hoặc bay: vào bay, mất kết nối, bị thu hồi chỗ */
function onMultiChange(): void {
  const s = exMulti.session; if (!s) return;
  if (watching) {
    if (s.phase === 'flying') { explore.start(); return; }   // chấp nhận lời mời: cất cánh mới như bay thường
    if (s.phase === 'solo') { try { sessionStorage.setItem('exMpNotice', 'lost'); } catch { /* bộ nhớ bị chặn */ } explore.exit(); return; }   // màn chọn đọc cờ này và hiện exMpLost
    exWatchRender();
  } else if (active()) {
    if (s.phase === 'watching') { state = null; if (glider) glider.visible = false; explore.startWatching(true); return; }   // chỗ bị thu hồi: sang xem, camera giữ nguyên
    if (s.phase === 'solo' && s.notice === 'lost') exFlyNotice(s, 'exMpLost');   // vẫn bay, người khác đã biến mất
  }
}

/* Đồng hồ tốc độ (km/h) và độ cao (m): chỉ số và đơn vị nên không cần dịch */
function exShowSpeed(): void {
  const t = `${Math.round(state!.speed * 3.6)} km/h · ${Math.round(state!.pos.y)} m`;
  if (t === readout) return;
  readout = t;
  const el = document.getElementById('exSpeed'); if (el) el.textContent = t;
}

/* Một bước: mô phỏng, đặt dù, đặt camera bám */
function advance(dt: number, inp: GliderInput): void {
  exStep(state!, inp, dt);
  exPlaceGlider(glider!, state!);
  exChase(camera, controls.target, state!, dt);
  exShowSpeed();
  exNightStep(dt);
  exMulti.update(dt, performance.now(), state);   // dù người khác, nhãn tên, gửi vị trí (không làm gì khi bay một mình)
}

export const explore = {
  active,
  nightShows: exNight,
  get state() { return state; },
  get glider() { return glider; },
  get watching() { return watching; },
  start(): void {
    if (watching) { watching = false; document.body.classList.remove('ex-watching'); exWatchHide(); }
    exMulti.onChange = onMultiChange;
    state = exCreate();
    const slot = exMulti.session ? exMulti.session.mySlot : -1;
    if (slot >= 0) state.pos.z += CONFIG.explore.multi.spawnSpread * (slot - 2);   // mỗi slot cất cánh lệch một đoạn để không chồng nhau
    if (!glider) glider = exBuildGlider();
    if (!glider.parent) scene.add(glider);
    glider.visible = true;
    cam.flight.then = null; cam.mode = 'glider'; controls.enabled = false;
    exPlaceGlider(glider, state);
    exChase(camera, controls.target, state, 0, true);
    exShowSpeed();
    document.body.classList.add('explore');
  },
  /* Chế độ xem: cam.mode = 'glider' nhưng không có state/dù của mình; carry = true khi vừa nhường chỗ (camera đang ở sau dù cũ) */
  startWatching(carry = false): void {
    const s = exMulti.session; if (!s) return;
    watching = true; chased = carry;
    keys.clear();
    cam.flight.then = null; cam.mode = 'glider'; controls.enabled = false;
    document.body.classList.add('explore', 'ex-watching');
    exMulti.onChange = onMultiChange;
    exWatchShow(s);
  },
  update(dt: number): void {
    if (watching) { watchStep(dt); return; }
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

export function setupExplore(ctrl: SwingController): void {
  exNightBind(ctrl);
  setupStroll(ctrl, () => explore.exit());
  window.addEventListener('keydown', (e) => {
    if (!inGlider() && !stroll.inMode()) return;
    if (e.key === 'Escape') { explore.exit(); return; }   // Esc thoát kể cả khi đang focus ô chọn (bay dù, đi dạo và hai chế độ xem)
    if (watching || stroll.inMode()) return;   // xem: không lái; đi dạo: phím do stroll/index.ts ghi
    if (e.ctrlKey || e.metaKey || e.altKey) return;   // phím tắt trình duyệt (Cmd+S...) không lái dù, tránh kẹt phím
    const t = e.target as HTMLElement | null;
    if (t && /^(SELECT|INPUT|TEXTAREA)$/.test(t.tagName)) return;   // phím trong ô chọn/nhập không lái dù
    exMulti.activity();   // phím điều khiển (kể cả tự lặp) tính là còn đó
    const k = e.key.toLowerCase(); keys.add(k);
    if (k.startsWith('arrow')) e.preventDefault();
  });
  /* Chọn ngôn ngữ / chất lượng bằng chuột xong thì bỏ focus, nếu không mũi tên và WASD sau đó đổi cài đặt thay vì lái dù. Dùng Tab + bàn phím thì giữ nguyên. */
  for (const id of ['langSelect', 'qualitySel']) {
    const sel = document.getElementById(id); if (!sel) continue;
    let byMouse = false;
    sel.addEventListener('pointerdown', () => { byMouse = true; });
    sel.addEventListener('keydown', () => { byMouse = false; });
    sel.addEventListener('change', () => { if (byMouse && (active() || stroll.active())) sel.blur(); byMouse = false; });
  }
  const q = new URLSearchParams(location.search);
  exNight.enabled = !q.has('test');   // test bật tường minh qua __app.explore.nightShows
  if (q.has('test')) document.body.classList.add('ex-test');   // giữ HUD khi bay để test đo draw call
  document.getElementById('btnExExit')?.addEventListener('click', () => explore.exit());
  if (q.get('explore') === 'glider') { explore.start(); return; }
  if (q.get('explore') === 'stroll') { stroll.start(); return; }   // đi dạo một mình, không qua slot
  if (!q.has('test') || q.has('chooser')) {
    document.querySelector('button[data-pick="walk"]')?.addEventListener('click', () => stAvatars.preload(0));   // chọn thẻ Đi dạo: nạp nhân vật của mình ngay, trong lúc ở sảnh
    exShowChooser((choice) => { if (choice === 'glider') explore.start(); else if (choice === 'walk') stroll.start(); },
      (choice) => { if (choice === 'walk') stroll.startWatching(); else explore.startWatching(); });   // 'guided': màn chọn tự ẩn, giao diện cũ
  }
}
