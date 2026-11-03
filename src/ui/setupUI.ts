import { canvas, controls } from '../core/renderer';
import { CONFIG } from '../config';
import { swRide } from '../bridges/sun-wheel/ride';
import { setShadows, shadowState } from '../core/lights';
import { dayNight } from '../core/dayNight';
import { t, onChange } from '../i18n';
import { show, showLabel } from '../bridges/dragon/effects';
import type { ThuanPhuocBridge } from '../bridges/thuan-phuoc';
import type { TranThiLyBridge } from '../bridges/tran-thi-ly';
import type { SongHanBridge } from '../bridges/song-han';
import type { HanTunnel } from '../bridges/han-tunnel';
import type { SunWheel } from '../bridges/sun-wheel';
import type { BridgeKey } from '../views/presets';
import { cam, keys } from '../views/state';
import { setView, leaveSwRide } from '../views/camera';
import { tour, tourBox, tourHooks, initTourCaption, renderTourCaption, exitTour } from '../views/tour';
import { selectBridge, syncShowLine, toggle } from './panel';
import { setupAudioUI } from './audioUI';
import { setupSwingUI, swingRender } from './swingUI';
import { setupHrUI, hrRender } from './hrUI';
import { setupRiverfrontUI } from './riverfrontUI';
import { setupWeatherUI } from './weatherUI';
import { setupDonateUI } from './donateUI';

/* Gắn mọi bảng điều khiển: ngày/đêm, bóng đổ, trình diễn, chọn cầu, góc nhìn, nút bật/tắt từng cầu, bàn phím */
export function setupUI({ thuanPhuoc, tranThiLy, songHan, hanTunnel, sunWheel }: { thuanPhuoc: ThuanPhuocBridge; tranThiLy: TranThiLyBridge; songHan: SongHanBridge; hanTunnel: HanTunnel; sunWheel: SunWheel }) {
  const donate = setupDonateUI();
  const btnNight = document.getElementById('btnNight'), slider = document.getElementById('timeSlider') as HTMLInputElement;
  const btnShow = document.getElementById('btnShow'), btnShadow = document.getElementById('btnShadow');
  const syncNight = () => {
    const isNight = dayNight.target > 0.5;
    btnNight.setAttribute('aria-pressed', String(isNight));
    btnNight.textContent = t(isNight ? 'toDay' : 'toNight');
  };
  btnNight.addEventListener('click', () => { dayNight.target = dayNight.target > 0.5 ? 0 : 1; slider.value = String(dayNight.target * 100); syncNight(); });
  slider.addEventListener('input', () => { dayNight.target = Number(slider.value) / 100; syncNight(); });
  syncNight();
  setupAudioUI();
  // Đổi ngôn ngữ: cập nhật các chữ do code sinh ra
  onChange(() => {
    syncNight();
    if (!tourBox().hidden && tour.shown >= 0) renderTourCaption(tour.shown);
    document.getElementById('showState').textContent = showLabel();
    swingRender(); hrRender();
  });
  btnShow.addEventListener('click', () => {
    show.on = !show.on; show.t = 0; btnShow.setAttribute('aria-pressed', String(show.on)); syncShowLine();
    if (show.on && dayNight.target < 0.5) { dayNight.target = 1; slider.value = '100'; syncNight(); } // trình diễn diễn ra lúc 21:00
  });
  btnShadow.addEventListener('click', () => {
    setShadows(!shadowState.user); btnShadow.setAttribute('aria-pressed', String(shadowState.user));   // không đổi castShadow (tránh biên dịch lại shader, D-018)
  });
  document.querySelectorAll<HTMLElement>('[data-view]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
  document.querySelectorAll<HTMLElement>('[data-bridge]').forEach((b) => b.addEventListener('click', () => selectBridge(b.dataset.bridge as BridgeKey, true)));
  tourHooks.bridge = (k) => selectBridge(k, false);   // Tour 4 cầu: đổi bảng Thông số theo cầu đang thuyết minh, không bay camera
  // Cầu Thuận Phước
  toggle('btnTpLife', (on) => thuanPhuoc.setLifeVisible(on));
  // Cầu Trần Thị Lý: pattern LED và các phần bật/tắt
  toggle('btnTtlLife', (on) => tranThiLy.setLifeVisible(on));
  toggle('btnTtlPeople', (on) => tranThiLy.setPeopleVisible(on));
  toggle('btnTtlNvt', (on) => tranThiLy.setNvtVisible(on));
  document.getElementById('ttlPatternSel').addEventListener('change', (e) => tranThiLy.setPattern(Number((e.target as HTMLSelectElement).value)));
  // Cầu sông Hàn
  setupSwingUI(songHan, toggle);
  // Hầm vượt sông Hàn
  setupHrUI(hanTunnel, toggle);
  // Hai bờ sông: đèn trái tim, chế độ đối đáp/đồng bộ, quảng cáo; góc nhìn "Trái tim hai bờ" tự chuyển sang đêm
  setupRiverfrontUI(toggle);
  document.querySelector('[data-view="rfHearts"]').addEventListener('click', () => { dayNight.target = 1; slider.value = '100'; syncNight(); });
  // Vòng quay Mặt Trời: tốc độ quay; góc nhìn ban đêm tự chuyển sang đêm
  const swSpeed = document.getElementById('swSpeed') as HTMLSelectElement;
  swSpeed.addEventListener('change', () => sunWheel.setSpeed(Number(swSpeed.value)));
  const swShow = document.getElementById('swShow') as HTMLSelectElement;   // kiểu show LED đêm (GĐ4)
  swShow.addEventListener('change', () => sunWheel.setShow(swShow.value));
  document.querySelector('[data-view="swNight"]').addEventListener('click', () => { dayNight.target = 1; slider.value = '100'; syncNight(); });
  /* Tour Vòng quay (GĐ7): lên cabin / đỉnh / xuống do ride.ts xử lý; ở đây chỉ phần giao diện của điểm 6 (đêm + kiểu show) và trả lại khi thoát Tour */
  let swTourPrev: { night: number; show: string } | null = null;
  swRide.tour.onEnd = () => {
    if (!swTourPrev) return;
    dayNight.target = swTourPrev.night; slider.value = String(swTourPrev.night * 100); syncNight();
    sunWheel.setShow(swTourPrev.show); swShow.value = swTourPrev.show; swTourPrev = null;
  };
  tourHooks.sw = (phase, exit) => {
    if (phase === 'night') {
      swTourPrev ||= { night: dayNight.target, show: sunWheel.show() };
      dayNight.target = 1; slider.value = '100'; syncNight();
      sunWheel.setShow(CONFIG.sunWheel.tour.show); swShow.value = CONFIG.sunWheel.tour.show;
    }
    if (exit) swRide.tourEnd(); else swRide.tourPhase(phase);
  };
  // Thời tiết: preset + cường độ (GĐ2: chỉ khí quyển)
  setupWeatherUI(toggle);
  window.addEventListener('keydown', (e) => {
    if (cam.mode !== 'walk') return;
    const k = e.key.toLowerCase(); keys.add(k);
    if (k.startsWith('arrow')) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());
  controls.addEventListener('start', () => { if (cam.mode === 'fly' && !cam.flight.then) { cam.mode = 'orbit'; controls.enabled = true; } });
  // Tự điều khiển khi đang tour: kéo, cuộn hoặc nhấn Esc
  initTourCaption();
  canvas.addEventListener('pointerdown', exitTour);
  canvas.addEventListener('wheel', exitTour, { passive: true });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') { exitTour(); leaveSwRide(true); } });   // Esc cũng xuống khỏi cabin Vòng quay Mặt Trời
  return { donate };
}
