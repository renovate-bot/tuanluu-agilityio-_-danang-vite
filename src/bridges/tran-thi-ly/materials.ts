import * as THREE from 'three';
import { makeLaneTexture } from '../../common/textures';
import { bridgePatch, type BridgePatchOptions } from '../../common/shaders';
import { TTL, ttlPattern } from './profile';
import { registerWet } from '../../environment/weather/wetness';

/* [materials] LED đổi màu qua bridgePatch(), bảng màu 'sail', 3 pattern */
export function ttlMaterials() {
  const led = (extra: BridgePatchOptions): BridgePatchOptions => ({ palette: 'sail', pattern: ttlPattern, originX: TTL.pylonX, ...extra });
  const M = {
    concrete: bridgePatch(new THREE.MeshStandardMaterial({ color: 0xe2e0da, roughness: 0.8, metalness: 0, vertexColors: true }), { noise: true, wet: true, weather: true }),
    pylon: bridgePatch(new THREE.MeshStandardMaterial({ color: 0xebe9e4, roughness: 0.8, metalness: 0 }),
      { noise: true, weather: true, ...led({ led: 0.95, mode: 1, floodTop: 150, floodBase: 8 }) }),
    stay: bridgePatch(new THREE.MeshStandardMaterial({ color: 0xeceeee, roughness: 0.5, metalness: 0.15 }), led({ led: 2.6, mode: 0, sway: 'ttl' })),   // rung mưa–gió (weather/wind.ts)
    hdpe: new THREE.MeshStandardMaterial({ color: 0xf6f6f2, roughness: 0.55, metalness: 0.05 }),
    ledStrip: bridgePatch(new THREE.MeshStandardMaterial({ color: 0x34383c, roughness: 0.5, metalness: 0.3 }), led({ led: 2.2, mode: 0 })),
    steel: bridgePatch(new THREE.MeshStandardMaterial({ color: 0xb9bfc4, roughness: 0.32, metalness: 0.85 }), { weather: true }),
    joint: new THREE.MeshStandardMaterial({ color: 0x2c2f33, roughness: 0.5, metalness: 0.7 }),
    nvtSteel: new THREE.MeshStandardMaterial({ color: 0x7a8a92, roughness: 0.55, metalness: 0.6 }),
    road: registerWet(new THREE.MeshStandardMaterial({ map: makeLaneTexture(3), roughness: 0.93 })),   // mặt ướt khi mưa (weather/wetness.ts)
    beacon: new THREE.MeshBasicMaterial({ color: 0xff2a1a }),
    textures: [] as THREE.Texture[]
  };
  M.textures = [M.road.map];
  return M;
}
export type TtlMaterials = ReturnType<typeof ttlMaterials>;
