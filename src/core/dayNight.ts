import * as THREE from 'three';
import { scene, renderer } from './renderer';
import { shared } from './shared';
import { MAT } from './materials';
import { sun, hemi, moon, bridgeLights } from './lights';
import { setSun, stars, clouds } from './sky';
import { water } from './water';
import { lerp, clamp } from '../common/math';
import { vHead, vTail } from '../environment/traffic';

/* ============================ Ngày / đêm ============================ */
/* night: giá trị hiện tại (0 ngày → 1 đêm), target: giá trị người xem chọn; night tiến dần về target */
export const dayNight = { night: 0, target: 0 };

const C_FOG_DAY = new THREE.Color(0xcfdde6), C_FOG_NIGHT = new THREE.Color(0x0b1424);
const C_HEMI_DAY = new THREE.Color(0xcfe6ff), C_HEMI_NIGHT = new THREE.Color(0x2a3a66);
const C_WATER_DAY = new THREE.Color(0x2c5a4f), C_WATER_NIGHT = new THREE.Color(0x08181b);
const C_BULB_DAY = new THREE.Color(0x9a9890), C_BULB_NIGHT = new THREE.Color(2.4, 1.9, 1.1);

export function applyNight(m: number, time: number) {
  shared.uNight.value = m;
  setSun(lerp(40, -7, m), 205);
  sun.intensity = 3.0 * clamp(1 - m * 1.15, 0, 1);
  moon.intensity = 0.35 * m;
  hemi.intensity = lerp(0.9, 0.22, m);
  hemi.color.copy(C_HEMI_DAY).lerp(C_HEMI_NIGHT, m);
  (scene.fog as THREE.FogExp2).color.copy(C_FOG_DAY).lerp(C_FOG_NIGHT, m);
  scene.environmentIntensity = lerp(1, 0.14, m);
  renderer.toneMappingExposure = lerp(0.55, 0.8, m);
  water.material.uniforms.waterColor.value.copy(C_WATER_DAY).lerp(C_WATER_NIGHT, m);
  water.material.uniforms.sunColor.value.setRGB(lerp(1, 0.25, m), lerp(1, 0.3, m), lerp(1, 0.45, m));
  stars.material.opacity = clamp((m - 0.4) / 0.6, 0, 1);
  clouds.material.opacity = lerp(0.85, 0.12, m);
  MAT.bulb.color.copy(C_BULB_DAY).lerp(C_BULB_NIGHT, m);
  MAT.pupil.emissiveIntensity = m * 2.5;
  MAT.eye.emissiveIntensity = 0.05 + m * 0.4;
  vHead.visible = vTail.visible = m > 0.3;
  // Đèn dọc cầu nhấp nháy nhẹ theo sin(time)
  bridgeLights.forEach((l) => { l.intensity = l.userData.base * m * (0.82 + 0.18 * Math.sin(time * 2.2 + l.userData.phase)); });
}
/* Một bước chuyển ngày ↔ đêm mỗi khung hình */
export function stepNight(dt: number) {
  dayNight.night += (dayNight.target - dayNight.night) * Math.min(1, dt * 1.6);
  if (Math.abs(dayNight.target - dayNight.night) < 0.001) dayNight.night = dayNight.target;
}
