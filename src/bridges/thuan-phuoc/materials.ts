import * as THREE from 'three';
import { makeLaneTexture } from '../../common/textures';
import { bridgePatch, patchWindows } from '../../common/shaders';
import { registerWet } from '../../environment/weather/wetness';

/* [materials] + [lighting]
   LED đổi màu dùng bridgePatch(), bảng màu 'sea': xanh dương → tím → hồng → xanh lá,
   dải màu chạy dọc cầu từ Tây sang Đông ("những cơn gió hướng ra biển"); chỉ sáng ban đêm */
export function tpMaterials() {
  const road = makeLaneTexture(2);
  const M = {
    concrete: bridgePatch(new THREE.MeshStandardMaterial({ color: 0xd6d3cc, roughness: 0.85, metalness: 0, vertexColors: true }), { noise: true, weather: true }),
    tower: bridgePatch(new THREE.MeshStandardMaterial({ color: 0xdedbd4, roughness: 0.84, metalness: 0, vertexColors: true }), { noise: true, led: 0.75, mode: 1, palette: 'sea', weather: true }),
    steel: bridgePatch(new THREE.MeshStandardMaterial({ color: 0xd2d7db, roughness: 0.4, metalness: 0.65 }), { weather: true }),
    cable: bridgePatch(new THREE.MeshStandardMaterial({ color: 0xc8ced3, roughness: 0.36, metalness: 0.75 }), { led: 2.6, palette: 'sea', sag: 'cable' }),   // võng thêm khi nóng (weather/summer.ts)
    hanger: bridgePatch(new THREE.MeshStandardMaterial({ color: 0xc8ced3, roughness: 0.38, metalness: 0.75 }), { led: 1.8, palette: 'sea', sway: 'tp', sag: 'hanger' }),   // hanger lắc theo gió (weather/wind.ts)
    joint: new THREE.MeshStandardMaterial({ color: 0x2c2f33, roughness: 0.5, metalness: 0.7 }),
    road: registerWet(new THREE.MeshStandardMaterial({ map: road, roughness: 0.93 })),   // mặt ướt khi mưa (weather/wetness.ts)
    beacon: new THREE.MeshBasicMaterial({ color: 0xff2a1a }),
    building: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, metalness: 0.05 }),
    textures: [road] as THREE.Texture[]
  };
  patchWindows(M.building, { perBuilding: true });
  return M;
}
export type TpMaterials = ReturnType<typeof tpMaterials>;
