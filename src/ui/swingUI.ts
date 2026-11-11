import { CONFIG } from '../config';
import { camera, controls } from '../core/renderer';
import { t } from '../i18n';
import { audio } from '../audio';
import type { SongHanBridge } from '../bridges/song-han';
import type { SwingState } from '../bridges/song-han/SwingController';
import { VIEWS, type ViewPreset } from '../views/presets';
import { cam } from '../views/state';
import { flyTo } from '../views/camera';
import { exitTour, setTourSwingHook } from '../views/tour';
import type { Toggle } from './panel';

/* Cầu sông Hàn: nút quay, tốc độ, trạng thái, camera theo dõi, lịch tự quay theo giờ Việt Nam */
export let swingRender = () => {};
export function setupSwingUI(songHan: SongHanBridge, toggle: Toggle) {
  const ctrl = songHan.ctrl;
  const btn = document.getElementById('btnSwing') as HTMLButtonElement, stateEl = document.getElementById('swingState'), speedSel = document.getElementById('swingSpeed') as HTMLSelectElement;
  let follow = true, saved: ViewPreset | null = null;
  swingRender = () => {
    stateEl.textContent = t('st_' + ctrl.state);
    btn.textContent = t(ctrl.state === 'CLOSED' ? 'swingBtn' : ctrl.state === 'OPEN' ? 'swingClose' : 'swingBusy');
    btn.disabled = !(ctrl.state === 'CLOSED' || ctrl.state === 'OPEN');
  };
  btn.addEventListener('click', () => { if (ctrl.state === 'CLOSED') ctrl.start(Number(speedSel.value)); else ctrl.requestClose(); });
  speedSel.addEventListener('change', () => { ctrl.speed = Number(speedSel.value); });
  toggle('btnSwingFollow', (on) => { follow = on; });
  toggle('btnShLife', (on) => songHan.setLifeVisible(on));
  toggle('btnShPeople', (on) => songHan.setPeopleVisible(on));
  ctrl.addEventListener('stateChange', (e) => {
    const s = (e as CustomEvent<SwingState>).detail;
    swingRender(); audio.motor(s === 'ROTATING_OPEN' || s === 'ROTATING_CLOSE');
    if (s === 'OPEN' && ctrl.fromTour) ctrl.requestClose();    // trong Tour: đóng ngay khi tàu buồm qua hết luồng
    if (s === 'CLOSED') ctrl.fromTour = false;
  });
  // Tour Cầu sông Hàn tới điểm "trên trụ quay" thì tự quay cầu ở 30×
  setTourSwingHook(() => { if (ctrl.state === 'CLOSED') { speedSel.value = '30'; ctrl.fromTour = true; if (!ctrl.start(30)) ctrl.fromTour = false; } });
  // Bão: không quay cầu (cấm theo thông báo của thành phố) — hiện lý do vài giây rồi trả lại dòng trạng thái
  let blockedT = 0;
  ctrl.addEventListener('swingBlocked', () => {
    if (ctrl.fromTour) { const tx = document.getElementById('tourText'); tx.textContent = `${tx.textContent} ${t('wxSwingTour')}`; }   // Tour: bỏ bước quay, ghi chú thích
    stateEl.textContent = t('swingWeather'); clearTimeout(blockedT); blockedT = window.setTimeout(swingRender, 4000); });
  ctrl.addEventListener('swingStart', () => {
    audio.horn();
    if (follow && cam.mode !== 'tour' && cam.mode !== 'glider' && cam.mode !== 'stroll' && cam.flight.then !== 'tour') {
      saved = { pos: camera.position.toArray(), target: controls.target.toArray() }; exitTour(); flyTo(VIEWS.shSwingCam);
    }
  });
  ctrl.addEventListener('swingClosed', () => { audio.horn(); if (follow && saved && cam.mode !== 'tour' && cam.mode !== 'glider' && cam.mode !== 'stroll') flyTo(saved); saved = null; });   // đang bay dù / đi dạo: không kéo camera (cầu có thể đã quay trước khi vào dù)
  // tự quay lúc 23:00 thứ Bảy, Chủ nhật theo giờ Việt Nam (UTC+7) nếu trang đang mở; chạy tốc độ thật 1×
  let lastAuto = '';
  setInterval(() => {
    const A = CONFIG.songHan.autoSchedule, now = new Date(Date.now() + A.utcOffset * 3600e3), key = now.toISOString().slice(0, 10);
    if (A.days.includes(now.getUTCDay()) && now.getUTCHours() === A.hour && now.getUTCMinutes() < 10 && lastAuto !== key && ctrl.state === 'CLOSED' && cam.mode !== 'glider') {
      lastAuto = key; speedSel.value = '1'; ctrl.start(1);
    }
  }, 20000);
  swingRender();
}
