/* =====================================================================
   Đà Nẵng 3D — điểm vào: khởi tạo theo thứ tự, rồi chạy vòng animate.
   Thứ tự dựng cảnh giữ nguyên như bản một file: chuỗi ngẫu nhiên có hạt giống (common/math.ts → rand)
   được dùng lần lượt, đổi thứ tự sẽ đổi vị trí nhà, cây, xe.
   ===================================================================== */
import * as THREE from 'three';
import { initI18n } from './i18n';
import { renderer, scene, camera, controls } from './core/renderer';
import { shared, windFx } from './core/shared';
import { buildLights } from './core/lights';
import { buildSky, shadowCenter } from './core/sky';
import { buildWater, water, reflectState } from './core/water';
import { applyNight, stepNight, dayNight } from './core/dayNight';
import { renderFrame, onResize, scheduleResize } from './core/postprocessing';
import { perf } from './core/perf';
import { prewarm } from './core/prewarm';
import { quality } from './core/quality';
import { buildRiverBanks } from './environment/river';
import { buildMountains } from './environment/mountains';
import { buildStreets, finalizeRoads } from './environment/streets';
import { buildCity } from './environment/city';
import { buildTrees, buildStreetLamps, treesTest } from './environment/trees';
import { buildTraffic, buildBoats, updateTraffic, updateBoats, boatsTest, trafficTest } from './environment/traffic';
import {
  buildBridgeDeck, buildPiers, buildDragonBody, buildScales, buildHangers, buildDragonHead,
  createFire, createWaterJet, updateShow, updateEffects, show, showLabel, mouthW
} from './bridges/dragon';
import { ThuanPhuocBridge } from './bridges/thuan-phuoc';
import { TranThiLyBridge } from './bridges/tran-thi-ly';
import { SongHanBridge } from './bridges/song-han';
import { HanTunnel } from './bridges/han-tunnel';
import { SunWheel, swRide } from './bridges/sun-wheel';
import { buildRiverfront, updateRiverfront } from './environment/riverfront';
import { buildDragonPeople, updateDragonPeople, peopleTest } from './environment/pedestrians';
import { buildWeather, updateWeather } from './environment/weather';
import { updateCamera, hrDrive } from './views/camera';
import { cam, keys } from './views/state';
import { TOURS, tour } from './views/tour';
import { exCreate, exStep, exInputFromKeys } from './explore/flight';
import { exBuildGlider, exPlaceGlider } from './explore/glider';
import { exChase } from './explore/chase';
import { explore, setupExplore } from './explore';
import { stroll } from './explore/stroll';
import { stValid, stGroundY, stMove } from './explore/stroll/map';
import { stCamPlace } from './explore/stroll/camera';
import { stAvatars } from './explore/stroll/avatars';
import { exMulti } from './explore/multi';
import { exRemotes } from './explore/multi/remote';
import { CONFIG } from './config';
import { audio } from './audio';
import { narration } from './audio/narration';
import { setupUI } from './ui/setupUI';
import { setupQualityUI } from './ui/qualityUI';
import { setupCompactUI, ui as compactState, openSheet, closeSheets, reveal } from './ui/compactUI';
import { updateHrUI } from './ui/hrUI';

initI18n();
void narration.init();
window.addEventListener('resize', scheduleResize); window.addEventListener('orientationchange', scheduleResize);

/* ============================ Khởi tạo ============================ */
buildLights();
buildSky();
buildWater();
buildRiverBanks();
buildMountains();
buildBridgeDeck();
buildPiers();
buildDragonBody();
buildScales();
buildHangers();
buildDragonHead();
buildStreets();
finalizeRoads();
buildCity();
buildTrees();
buildStreetLamps();
buildTraffic();
buildBoats();
const thuanPhuoc = new ThuanPhuocBridge();
scene.add(thuanPhuoc.group);
const tranThiLy = new TranThiLyBridge();
scene.add(tranThiLy.group);
const songHan = new SongHanBridge();
scene.add(songHan.group);
const hanTunnel = new HanTunnel();     // sau mọi lệnh dựng có dùng rand(): chỉ dọn nhà, cây trên tuyến bằng cách thu nhỏ instance
scene.add(hanTunnel.group);
const riverfront = buildRiverfront();    // sau HanTunnel: dọn nhà bị đè bằng scale 0, không đụng chuỗi rand()
const sunWheel = new SunWheel();         // sau buildRiverfront, trước buildWeather: dọn nền bằng scale 0, không đụng chuỗi rand()
scene.add(sunWheel.group);
buildDragonPeople();                     // sau mọi lệnh dùng rand(), trước buildWeather: người Cầu Rồng dùng rng riêng
const weather = buildWeather();          // sau buildRiverfront (sau mọi rand()): chụp giá trị gốc khí quyển/đường, dựng mưa (ẩn), điều biến sau applyNight
weather.attachSwing(songHan.ctrl);       // bão: Cầu sông Hàn không quay (SwingController.canStart)
const bridges = [thuanPhuoc, tranThiLy, songHan, hanTunnel, sunWheel];
const bridgeKeys = ['tp', 'ttl', 'sh', 'hr', 'sw'];   // tên bước khi đo hiệu năng (constructor.name bị đổi khi build)
createFire();
createWaterJet();
const ui = setupUI({ thuanPhuoc, tranThiLy, songHan, hanTunnel, sunWheel });
onResize();
applyNight(0, 0);
quality.init(() => cam.mode === 'fly');   // bậc chất lượng ban đầu (theo thiết bị / lựa chọn đã lưu); không đổi bậc giữa chuyến bay camera
setupQualityUI();
setupCompactUI();
setupExplore(songHan.ctrl);

/* Móc kiểm thử: chỉ bật khi URL có ?test (dùng cho tests/*.mjs đo draw call và chạy Tour) */
/* Chỉ các lớp three mà tests/*.mjs dùng: đưa cả namespace THREE vào một object làm Rollup giữ lại mọi export của three (D-018) */
const TEST_THREE = { Vector3: THREE.Vector3, Quaternion: THREE.Quaternion, Matrix4: THREE.Matrix4, Euler: THREE.Euler, Box3: THREE.Box3, Raycaster: THREE.Raycaster };
/* ?test&perf: bật đo thời gian CPU từng bước trong vòng animate (tests/perf-check.mjs) */
const query = new URLSearchParams(location.search);
/* Cho test nhiều người (Task 5; sảnh thật là Task 6): mở phiên, vào phòng bằng tên, bay khi được cấp slot */
const multiTest = {
  url: () => exMulti.url(), get session() { return exMulti.session; }, remotes: exRemotes,
  fly(name: string): boolean {
    return exMulti.begin(() => {
      exMulti.onChange = () => { if (exMulti.session!.phase === 'flying' && !explore.active()) explore.start(); };
      exMulti.session!.join(name);
    });
  }
};
if (query.has('test')) {
  perf.on = query.has('perf');
  (window as unknown as { __app: unknown }).__app = { reflectState, renderer, scene, camera, controls, cam, shared, songHan, hr: hanTunnel, sunWheel, riverfront, weather, hrDrive, swRide, windFx, THREE: TEST_THREE, dayNight, tours: TOURS, tour, narration, audio, perf, quality, ui: { ...ui, ui: compactState, openSheet, closeSheets, reveal }, explore, keys, multi: multiTest, exFlight: { exCreate, exStep, exInputFromKeys, exBuildGlider, exPlaceGlider, exChase, CONFIG_explore: CONFIG.explore }, boats: boatsTest, traffic: trafficTest, trees: treesTest, people: peopleTest,
    stroll: { stroll, stValid, stGroundY, stMove, stCamPlace, CONFIG_stroll: CONFIG.stroll, avatars: stAvatars } };
}

/* ============================ Vòng lặp ============================ */
const clock = new THREE.Clock();
const fpsEl = document.getElementById('fps'), callsEl = document.getElementById('calls'), showEl = document.getElementById('showState'), ftimeEl = document.getElementById('ftime');
let frames = 0, fpsT = 0, fpsLast = performance.now(), firstFrame = true;
function animate() {
  requestAnimationFrame(animate);
  const now0 = performance.now();
  perf.tick(now0);
  const dt = Math.min(clock.getDelta(), 0.05), time = clock.elapsedTime;
  let pt = perf.start();
  shared.uTime.value = time;
  shadowCenter.set(Math.round(controls.target.x / 8) * 8, 0, Math.round(controls.target.z / 8) * 8);
  stepNight(dt);
  applyNight(dayNight.night, time); pt = perf.lap('night', pt);
  updateWeather(dt, time, dayNight.night, camera);         // điều biến sau applyNight (D-009); camera: mưa quanh camera, tắt trong hầm
  water.material.uniforms.time.value += dt * 0.6 * windFx.waveSpeed;   // sóng trôi nhanh hơn theo gió (mặc định ×1)
  pt = perf.lap('weather', pt);
  updateShow(dt);
  updateEffects(dt, time); pt = perf.lap('effects', pt);
  updateTraffic(dt); updateDragonPeople(dt, time, camera); pt = perf.lap('traffic', pt);
  updateBoats(dt, time); pt = perf.lap('boats', pt);
  updateCamera(dt); explore.update(dt); stroll.update(dt); pt = perf.lap('camera', pt);
  for (let k = 0; k < bridges.length; k++) { bridges[k].update(dt, time, camera); pt = perf.lap(bridgeKeys[k], pt); }
  hanTunnel.holdBoats(songHan.boats.list);
  updateHrUI(camera);
  updateRiverfront(dt, time); pt = perf.lap('riverfront', pt);
  audio.setSwingDistance(camera.position.distanceTo(songHan.center));
  audio.update(dayNight.night, show.fireOn, show.waterOn, camera.position.distanceTo(mouthW)); pt = perf.lap('audio', pt);
  quality.update(now0);                                     // bậc chất lượng (tự hạ khi lag), bóng đổ, giới hạn pixelRatio khi mưa
  renderer.info.reset();
  renderFrame(dayNight.night, dt); stroll.afterRender(); perf.lap('render', pt);   // gồm cả biên dịch shader lần đầu (đồng bộ trên luồng chính)
  frames++; const now = performance.now(); fpsT = (now - fpsLast) / 1000;
  if (fpsT >= 0.5) {
    fpsEl.textContent = String(Math.round(frames / fpsT)); fpsLast = now; callsEl.textContent = String(renderer.info.render.calls);
    const fs = perf.stats(); ftimeEl.textContent = `${fs.avg.toFixed(1)} · p95 ${fs.p95.toFixed(0)} · max ${fs.max.toFixed(0)}`;
    showEl.textContent = showLabel(); frames = 0; fpsT = 0;
  }
  if (firstFrame) { firstFrame = false; document.getElementById('loading').classList.add('done'); }
}
await prewarm();   // biên dịch sẵn shader + upload texture trong lúc còn màn hình chờ (D-018)
animate();
