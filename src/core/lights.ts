import * as THREE from 'three';
import { CONFIG } from '../config';
import { scene, renderer } from './renderer';
import { deckY } from '../bridges/dragon/profile';
import { device } from './device';

/* ============================ Ánh sáng ============================ */
export const sun = new THREE.DirectionalLight(0xfff1dc, 3.0);
export const hemi = new THREE.HemisphereLight(0xcfe6ff, 0x6b6a55, 0.9);
export const moon = new THREE.DirectionalLight(0x8fa8ff, 0);
export const bridgeLights: THREE.PointLight[] = [];
export let fireLight: THREE.PointLight;
/* 6 đèn Cầu Rồng + đèn lửa chung một nhóm ở gốc tọa độ (vị trí thế giới = vị trí riêng): bộ đèn (D-031) ẩn / hiện cả nhóm một lần */
export const pointLights = new THREE.Group();

export function buildLights() {
  sun.castShadow = true;
  sun.shadow.mapSize.set(CONFIG.shadowMapSize, CONFIG.shadowMapSize);
  const s = sun.shadow.camera; s.left = -470; s.right = 470; s.top = 470; s.bottom = -470; s.near = 10; s.far = 2200;
  sun.shadow.camera.layers.enable(1);
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6;
  scene.add(sun, hemi, moon, sun.target);
  moon.position.set(-600, 900, -400);
  // Đèn chiếu dọc Cầu Rồng ban đêm: vàng ấm xen xanh lam
  const xs = [-215, -130, -45, 45, 130, 215];
  xs.forEach((x, i) => {
    const l = new THREE.PointLight(i % 2 ? 0x4a8cff : 0xffb556, 0, 90, 1.6);
    l.position.set(x, deckY(x) + 10, i % 2 ? 9 : -9);
    l.userData.base = 350; l.userData.phase = i * 1.3;
    pointLights.add(l); bridgeLights.push(l);
  });
  fireLight = new THREE.PointLight(0xff7a2a, 0, 160, 1.5);
  pointLights.add(fireLight);
  pointLights.name = 'point-lights';
  scene.add(pointLights);
}

/* Bộ đèn theo trạng thái (D-031). three bỏ đèn ẩn (visible = false) khỏi trạng thái đèn ⇒ shader không tính đèn đó cho từng điểm ảnh,
   và không vẽ shadow map khi sun ẩn. Đèn cường độ 0 vẫn tốn như đèn sáng (đo Intel Arc: 7 PointLight + moon ≈ 5 ms/khung ban ngày; bóng ban đêm ≈ 5,6 ms).
   Đổi bộ làm đổi số đèn trong program key: mỗi vật liệu giữ sẵn program của từng bộ (materialProperties.programs) nên chỉ là tra bảng,
   với điều kiện bộ đó đã biên dịch + vẽ hâm (core/prewarm.ts: lightState.ready; mặc định hâm nền sau khung đầu). Ngoại lệ có kiểm soát của quy tắc D-018 "không đổi program key khi đang chạy":
   chỉ ba bộ cố định dưới đây; mọi cách đổi số đèn khác vẫn cấm.
   - day:   sun hiện, moon + 7 PointLight ẩn — khi sun.intensity > 0, moon.intensity = 0 và mọi PointLight cường độ 0
   - night: sun ẩn (không lượt bóng, không lấy mẫu bóng), moon + 7 PointLight hiện — khi sun.intensity = 0 (đêm ≥ 0,87)
   - full:  tất cả hiện — còn lại: đang chuyển ngày ↔ đêm, rồng phun lửa ban ngày */
export type LightSet = 'day' | 'night' | 'full';
export const LIGHT_SETS: readonly LightSet[] = ['day', 'night', 'full'];
/* set: bộ đang dùng (lúc dựng mọi đèn đều hiện); mode: device.lightSets ('off' nếu trình duyệt không biên dịch song song được);
   ready: bộ đã biên dịch xong — stepLights chỉ chuyển sang bộ đã sẵn sàng, chưa thì ở 'full' (hình như nhau, chỉ chậm hơn). 'full' sẵn sàng sau prewarm */
export const lightState = { set: 'full' as LightSet, mode: device.lightSets, ready: { day: false, night: false, full: true } as Record<LightSet, boolean> };
export function applyLightSet(set: LightSet) {
  lightState.set = set;
  sun.visible = set !== 'night';
  moon.visible = set !== 'day';
  pointLights.visible = set !== 'day';
}
/* Mỗi khung: sau mọi chỗ ghi cường độ đèn (applyNight, updateWeather, updateEffects), trước khi vẽ; chỉ ghi visible khi bộ đổi */
export function stepLights() {
  let set: LightSet = 'full';
  if (sun.intensity <= 0) set = 'night';
  else if (moon.intensity <= 0) {
    let dark = true;
    const ls = pointLights.children;
    for (let i = 0; i < ls.length; i++) if ((ls[i] as THREE.PointLight).intensity > 0) { dark = false; break; }
    if (dark) set = 'day';
  }
  if (lightState.mode === 'off' || !lightState.ready[set]) set = 'full';
  if (set !== lightState.set) applyLightSet(set);
}

/* Bóng đổ (D-018). Hai nguồn: nút "Bóng đổ" của người dùng (user) và bộ quản lý chất lượng (size = 0 là tắt, every = vẽ lại mỗi n khung).
   Không đổi sun.castShadow khi đang chạy: đổi nó làm số bóng trong define đổi ⇒ mọi vật liệu có ánh sáng biên dịch lại (giật hàng giây).
   Tắt: ngừng vẽ shadow map và xoá nó về trắng (độ sâu 1 = không vật nào che) ⇒ mặt nhận bóng sáng như khi không có bóng.
   Ngoại lệ: điện thoại khởi động ở bậc Thấp thì castShadow = false ngay từ đầu (đỡ lấy mẫu bóng mỗi điểm ảnh); bật lại sau đó thì biên dịch lại một lần.
   Bộ đèn night ẩn sun: three tự bỏ lượt bóng và lấy mẫu bóng; shadowState / stepShadows giữ nguyên nghĩa (map cũ còn đó, không ai đọc tới khi sun hiện lại). */
export const shadowState = { user: true, size: CONFIG.shadowMapSize, every: 1 };
const clearTmp = new THREE.Color();
let frame = 0, cleared = false;
function clearShadowMap() {
  const map = sun.shadow.map;
  if (!map) return;
  const rt = renderer.getRenderTarget(), alpha = renderer.getClearAlpha();
  renderer.getClearColor(clearTmp);
  renderer.setRenderTarget(map); renderer.setClearColor(0xffffff, 1); renderer.clear();
  renderer.setRenderTarget(rt); renderer.setClearColor(clearTmp, alpha);
}
/* Nút người dùng */
export function setShadows(on: boolean) { shadowState.user = on; }
/* Bộ quản lý chất lượng: cạnh shadow map (0 = tắt) và chu kỳ vẽ lại */
export function setShadowQuality(size: number, every: number) {
  shadowState.every = Math.max(1, every);
  if (size > 0 && size !== sun.shadow.mapSize.x) {
    sun.shadow.mapSize.set(size, size);
    if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }   // three tạo lại map đúng cỡ ở lần vẽ bóng kế tiếp (cỡ map là uniform: không biên dịch lại)
  }
  shadowState.size = size;
  if (size > 0 && !sun.castShadow) sun.castShadow = true;   // chỉ xảy ra khi khởi động ở bậc Thấp trên điện thoại
}
/* Mỗi khung, trước khi vẽ */
export function stepShadows() {
  const on = shadowState.user && shadowState.size > 0 && sun.castShadow;
  if (on) {
    cleared = false;
    renderer.shadowMap.autoUpdate = shadowState.every <= 1;
    if (shadowState.every > 1) renderer.shadowMap.needsUpdate = !sun.shadow.map || frame % shadowState.every === 0;
    frame++;
    return;
  }
  renderer.shadowMap.autoUpdate = false;
  if (!cleared && sun.shadow.map) { clearShadowMap(); cleared = true; }
}
