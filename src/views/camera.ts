import { CONFIG } from '../config';
import { camera, controls, canvas, renderer } from '../core/renderer';
import { clamp, smooth } from '../common/math';
import { deckY } from '../bridges/dragon/profile';
import { tpRoadY } from '../bridges/thuan-phuoc/profile';
import { hrRoadY } from '../bridges/han-tunnel/profile';
import { VIEWS, type ViewPreset } from './presets';
import { narration } from '../audio/narration';
import { cam, keys } from './state';
import { getWeather } from '../environment/weather';
import { swRide } from '../bridges/sun-wheel/ride';
import { TOUR_VIEWS, activeTour, setActiveTour, tour, tourBox, showTourCaption, startTour, updateTour } from './tour';

/* ============================ Góc nhìn & điều khiển camera ============================ */
const drive = { x: -700 };
const tpDrive = { x: -1300 };
export const hrDrive = { x: -1000 };
const walk = { x: -240, z: 17.4, yaw: 0 };
/* Mắt thích nghi khi lái vào/ra hầm: độ phơi sáng nhân hệ số k, về 0,7 trong hầm (τ ≈ 0,5 s ⇒ ổn định sau ~1,5 s) rồi trả về 1 */
const eye = { k: 1 };

/* Ngồi cabin Vòng quay Mặt Trời (cam.mode = 'swRide'): tư thế camera do SunWheel.update đặt (ride.ts). Mọi đường rời chế độ (flyTo, setView, kịch bản bão) đi qua dropRide() */
const rideHint = () => document.getElementById('swRideHint');
function dropRide() {
  if (cam.mode !== 'swRide') return;
  cam.mode = 'orbit'; controls.enabled = true;
  document.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
  rideHint().hidden = true;
}
export function enterSwRide() {
  if (cam.mode === 'swRide' || !swRide.wheel) return;
  swRide.begin();
  cam.flight.then = null; cam.mode = 'swRide'; controls.enabled = false;
  document.querySelectorAll<HTMLElement>('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === 'swRide')));
  rideHint().hidden = false;
}
/* Xuống cabin: restore = true thì bay về chỗ đã đứng trước khi lên và trả OrbitControls như cũ (Esc, bấm lại nút); false thì giữ nguyên chỗ (đã có chuyến bay khác nối tiếp) */
export function leaveSwRide(restore = true) {
  if (cam.mode !== 'swRide') return;
  const s = swRide.saved;
  if (restore) flyTo({ pos: s.pos.toArray() as [number, number, number], target: s.target.toArray() as [number, number, number], maxPolar: s.maxPolar });
  else dropRide();
}

/* Bay mượt tới một góc nhìn; then = 'tour' để bắt đầu Tour khi tới nơi */
export function flyTo(v: ViewPreset, then: 'tour' | null = null) {
  dropRide();
  const flight = cam.flight;
  flight.then = then;
  controls.maxPolarAngle = v.maxPolar || Math.PI * 0.495;
  flight.fromP.copy(camera.position); flight.fromT.copy(controls.target);
  flight.toP.set(...v.pos); flight.toT.set(...v.target); flight.t = 0; cam.mode = 'fly'; controls.enabled = false;
}
export function setView(name: string) {
  narration.stop();
  if (name === 'swRide' && cam.mode === 'swRide') { leaveSwRide(true); return; }   // bấm lại nút Ngồi cabin = xuống
  dropRide();
  document.querySelectorAll<HTMLElement>('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === name)));
  document.getElementById('hint').hidden = name !== 'walk';
  const tourKey = TOUR_VIEWS[name];
  tourBox().hidden = !tourKey; document.body.classList.toggle('touring', !!tourKey);
  if (tourKey) { setActiveTour(tourKey); showTourCaption(0); tour.shown = 0; flyTo(activeTour.stops[0], 'tour'); return; }
  if (name === 'drive') { cam.mode = 'drive'; controls.enabled = false; drive.x = -700; return; }
  if (name === 'tpDrive') { cam.mode = 'tpDrive'; controls.enabled = false; tpDrive.x = -1300; return; }
  if (name === 'hrDrive') { cam.mode = 'hrDrive'; controls.enabled = false; hrDrive.x = -1000; eye.k = 1; return; }
  if (name === 'swRide') { enterSwRide(); return; }
  if (name === 'walk') { cam.mode = 'walk'; controls.enabled = false; walk.x = -240; walk.z = 17.4; walk.yaw = 0; canvas.focus(); return; }
  flyTo(VIEWS[name]);
}
/* Kịch bản bão nắm camera (chế độ 'storm'): bỏ chọn nút góc nhìn, tắt Tour / lái xe / đi bộ; updateCamera() đọc scenario.pose() mỗi khung */
export function followScenario() {
  dropRide();
  document.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
  document.getElementById('hint').hidden = true;
  tourBox().hidden = true; document.body.classList.remove('touring');
  controls.maxPolarAngle = Math.PI * 0.495;
  cam.flight.then = null; cam.mode = 'storm'; controls.enabled = false;
}
export function updateCamera(dt: number) {
  const flight = cam.flight;
  if (cam.mode !== 'hrDrive') eye.k = 1;
  if (cam.mode === 'fly') {
    flight.t += dt / flight.dur; const k = smooth(Math.min(flight.t, 1));
    camera.position.lerpVectors(flight.fromP, flight.toP, k); controls.target.lerpVectors(flight.fromT, flight.toT, k);
    camera.lookAt(controls.target);
    if (flight.t >= 1) { if (flight.then === 'tour') startTour(); else { cam.mode = 'orbit'; controls.enabled = true; } }
  } else if (cam.mode === 'tour') {
    updateTour(dt);
  } else if (cam.mode === 'swRide') {
    /* tư thế do SunWheel.update đặt (sau khi vòng quay quay, cùng khung hình); không gọi controls.update() */
  } else if (cam.mode === 'glider') {
    /* tư thế do explore.update đặt ngay sau updateCamera; không gọi controls.update() */
  } else if (cam.mode === 'storm') {
    const sc = getWeather()?.scenario;
    if (sc?.running && sc.cameraOwned) { sc.pose(sc.t, camera.position, controls.target); camera.lookAt(controls.target); }
    else { cam.mode = 'orbit'; controls.enabled = true; }          // người xem giành camera hoặc kịch bản hết: trả điều khiển, giữ nguyên chỗ đang nhìn
  } else if (cam.mode === 'drive') {
    drive.x += 15 * dt; if (drive.x > 700) drive.x = -700;
    const z = 8.625, ahead = drive.x + 40;
    camera.position.set(drive.x, deckY(drive.x) + 1.45, z);
    camera.lookAt(ahead, deckY(ahead) + 1.8, z - 1.5);
    controls.target.set(ahead, deckY(ahead), 0);
  } else if (cam.mode === 'tpDrive') {
    tpDrive.x += 16 * dt; if (tpDrive.x > 1300) tpDrive.x = -1300;
    const z = CONFIG.thuanPhuoc.z + CONFIG.thuanPhuoc.median / 2 + CONFIG.thuanPhuoc.laneWidth * 1.5, ahead = tpDrive.x + 45;
    camera.position.set(tpDrive.x, tpRoadY(tpDrive.x) + 1.45, z);
    camera.lookAt(ahead, tpRoadY(ahead) + 2.2, z - 1.6);
    controls.target.set(ahead, tpRoadY(ahead), CONFIG.thuanPhuoc.z);
  } else if (cam.mode === 'hrDrive') {
    const H = CONFIG.hanTunnel;
    hrDrive.x += 18 * dt; if (hrDrive.x > 1000) hrDrive.x = -1000;
    const z = H.z + H.laneOffsets[1], ahead = hrDrive.x + 45;
    camera.position.set(hrDrive.x, hrRoadY(hrDrive.x) + 1.45, z);
    camera.lookAt(ahead, hrRoadY(ahead) + 1.8, z - 0.5);
    controls.target.set(ahead, hrRoadY(ahead), H.z);
    eye.k += ((Math.abs(hrDrive.x) < H.coverHalf ? 0.7 : 1) - eye.k) * Math.min(1, dt / 0.5);
    renderer.toneMappingExposure *= eye.k;                 // applyNight đặt lại độ phơi sáng mỗi khung hình nên không tích lũy
  } else if (cam.mode === 'walk') {
    const speed = keys.has('shift') ? 6 : 2.2;
    if (keys.has('a') || keys.has('arrowleft')) walk.yaw += 1.6 * dt;
    if (keys.has('d') || keys.has('arrowright')) walk.yaw -= 1.6 * dt;
    let mv = 0; if (keys.has('w') || keys.has('arrowup')) mv += 1; if (keys.has('s') || keys.has('arrowdown')) mv -= 1;
    walk.x = clamp(walk.x + Math.cos(walk.yaw) * mv * speed * dt, -400, 400);
    walk.z = clamp(walk.z - Math.sin(walk.yaw) * mv * speed * dt, 16.5, 18.4);
    const y = deckY(walk.x) + 0.25 + 1.7;
    camera.position.set(walk.x, y, walk.z);
    camera.lookAt(walk.x + Math.cos(walk.yaw) * 10, y + 0.6, walk.z - Math.sin(walk.yaw) * 10);
    controls.target.set(walk.x + Math.cos(walk.yaw) * 30, y, walk.z - Math.sin(walk.yaw) * 30);
  } else {
    controls.update();
  }
}
