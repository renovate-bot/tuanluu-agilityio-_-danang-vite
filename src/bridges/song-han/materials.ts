import * as THREE from 'three';
import { canvasTex } from '../../core/textures';
import { makeLaneTexture } from '../../common/textures';
import { bridgePatch } from '../../common/shaders';
import { SH } from './profile';
import { registerWet } from '../../environment/weather/wetness';

/* [materials] LED qua bridgePatch(); đèn tín hiệu / hàng hải dùng màu theo instance */
export function shMaterials() {
  const stripe = canvasTex(256, 16, (g, _w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f4f4f0' : '#d42a20'; g.fillRect(i * 32, 0, 32, h); } });
  const M = {
    concrete: bridgePatch(new THREE.MeshStandardMaterial({ color: 0xe6e3dc, roughness: 0.85, metalness: 0, vertexColors: true }), { noise: true, wet: true, weather: true }),
    blueSteel: bridgePatch(new THREE.MeshStandardMaterial({ color: 0x1f5fbf, roughness: 0.4, metalness: 0.7 }),
      { led: 0.9, mode: 1, palette: 'sea', floodTop: SH.deckY + SH.mastHeight + 2, floodBase: SH.deckY, weather: true }),
    girder: new THREE.MeshStandardMaterial({ color: 0x1d58b0, roughness: 0.42, metalness: 0.7 }),
    deckSlab: bridgePatch(new THREE.MeshStandardMaterial({ color: 0xdcd9d2, roughness: 0.85, vertexColors: true }), { noise: true, weather: true }),
    stay: bridgePatch(new THREE.MeshStandardMaterial({ color: 0xc4573c, roughness: 0.5, metalness: 0.3 }),
      { led: 2.4, mode: 0, palette: 'rainbow', originX: 0, originZ: SH.z, sway: 'sh' }),   // dây văng lắc theo gió (weather/wind.ts)
    ledStrip: bridgePatch(new THREE.MeshStandardMaterial({ color: 0x23406e, roughness: 0.5, metalness: 0.3 }),
      { led: 2.0, mode: 0, palette: 'sea', originX: 0, originZ: SH.z }),
    mech: new THREE.MeshStandardMaterial({ color: 0x3a3632, roughness: 0.62, metalness: 0.75 }),    // thép tối, gỉ dầu mỡ
    steel: new THREE.MeshStandardMaterial({ color: 0x8d949a, roughness: 0.4, metalness: 0.8 }),
    crown: new THREE.MeshStandardMaterial({ color: 0xf1e2b8, roughness: 0.35, metalness: 0.6, emissive: 0xffffff, emissiveIntensity: 0 }),
    drumLight: new THREE.MeshStandardMaterial({ color: 0x3b2a55, roughness: 0.5, emissive: 0xa060ff, emissiveIntensity: 0 }),
    porthole: new THREE.MeshStandardMaterial({ color: 0x1e2a33, roughness: 0.3, metalness: 0.4, emissive: 0xffd9a0, emissiveIntensity: 0 }),
    fender: new THREE.MeshStandardMaterial({ color: 0x2f2b28, roughness: 0.9 }),
    white: new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.6 }),
    marker: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }),
    barrier: new THREE.MeshStandardMaterial({ map: stripe, roughness: 0.5 }),
    housing: new THREE.MeshStandardMaterial({ color: 0xe8b923, roughness: 0.5, metalness: 0.2 }),
    lamp: new THREE.MeshBasicMaterial({ color: 0xffffff }),           // đèn tín hiệu / hàng hải (màu theo instance)
    road: registerWet(new THREE.MeshStandardMaterial({ map: makeLaneTexture(1), roughness: 0.93 })),   // mặt ướt khi mưa (weather/wetness.ts)
    sail: new THREE.MeshStandardMaterial({ color: 0xf4efe3, roughness: 0.8, side: THREE.DoubleSide }),
    textures: [] as THREE.Texture[]
  };
  M.textures = [stripe, M.road.map];
  return M;
}
export type ShMaterials = ReturnType<typeof shMaterials>;
