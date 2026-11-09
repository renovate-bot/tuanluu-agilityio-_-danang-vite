/* ============================ Tự khám phá: camera bám đuôi ============================
   Camera đích = pos − forward·back + up·up; trễ mũ theo CONFIG.explore.chase.lag; nhìn vào pos + forward·look. */
import * as THREE from 'three';
import { CONFIG } from '../config';
import type { GliderState } from './flight';

const K = CONFIG.explore.chase;
const _want = new THREE.Vector3();

export function exChase(camera: THREE.PerspectiveCamera, target: THREE.Vector3, s: GliderState, dt: number, snap = false): void {
  const fx = Math.cos(s.yaw), fz = -Math.sin(s.yaw);
  _want.set(s.pos.x - fx * K.back, s.pos.y + K.up, s.pos.z - fz * K.back);
  if (snap) camera.position.copy(_want);
  else camera.position.lerp(_want, 1 - Math.exp(-dt / (K.lag * Math.min(1, K.lagSpeed / s.speed))));   // khoảng tụt ≈ tốc độ × trễ: bay nhanh giảm trễ để giữ khung hình
  target.set(s.pos.x + fx * K.look, s.pos.y - K.lookDown, s.pos.z + fz * K.look);
  camera.lookAt(target);
}
