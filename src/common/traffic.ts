import * as THREE from 'three';
import { CONFIG, type VehicleTypeId } from '../config';
import { weatherFx, vanished } from '../core/shared';
import { rng } from './math';
import type { Profile } from './geometry';
import { vhCreateFleet, vhSetInfo, vhSetVehicle, vhHide, vhCommit, type VehicleFleet } from './vehicles/fleet';

/* ---------- xe cộ dùng chung: kiểu xe + màu ở CONFIG.vehicles, hình + vật liệu ở common/vehicles/ ---------- */
export type VehicleType = VehicleTypeId;
export const _e = new THREE.Euler(), _q = new THREE.Quaternion();

/* ---------- hệ xe của từng cầu ---------- */
export interface LaneSpec { off: number; n: number; speed: number; bike?: number; bus?: number }
export interface BridgeVehicle { lane: number; dir: number; type: VehicleType; s: number; speed: number; color: number; hold?: number }
export interface Traffic { list: BridgeVehicle[]; x0: number; x1: number; fleet: VehicleFleet }
/* lanes: [{ off (m từ tim cầu), n, speed, bike (tỉ lệ xe máy), bus (tỉ lệ xe buýt) }] — mỗi làn chạy cả hai chiều; name: tên InstancedMesh của hệ xe */
export function createTraffic(bridge: { life: THREE.Group }, { seed, x0, x1, lanes, name }: { seed: number; x0: number; x1: number; lanes: LaneSpec[]; name: string }): Traffic {
  const rnd = rng(seed), list: BridgeVehicle[] = [], V = CONFIG.vehicles, colors = V.carColors;
  for (const dir of [1, -1]) lanes.forEach(({ off, n, speed, bike = 0, bus = 0.08 }) => {
    for (let k = 0; k < n; k++) {
      const r = rnd(), type: VehicleType = r < bike ? 'bike' : r < bus ? 'bus' : 'car';
      list.push({ lane: off, dir, type, s: x0 + (k + rnd() * 0.6) * (x1 - x0) / n, speed: speed * (0.85 + rnd() * 0.3),
        color: type === 'bike' ? V.bikeColors[k % V.bikeColors.length] : type === 'bus' ? V.palette.busBody : colors[Math.floor(rnd() * colors.length)] });
    }
  });
  const T: Traffic = { list, x0, x1, fleet: vhCreateFleet(list.length, bridge.life, name) };   // 1 InstancedMesh = 1 lệnh vẽ cho cả hệ
  list.forEach((v, i) => vhSetInfo(T.fleet, i, v.type, v.color));
  return T;
}
/* closable: có theo lệnh đóng cầu của thời tiết (bão) không; Hầm vượt sông Hàn truyền false (hầm vẫn lưu thông) */
const _base = new THREE.Vector3();
/* Không cấp phát mỗi khung (D-018); đèn pha/hậu bật trong shader theo uNight (common/vehicles/material.ts) */
export function stepTraffic(T: Traffic, dt: number, profile: Profile, closable = true) {
  const range = T.x1 - T.x0, base = _base;
  for (let i = 0; i < T.list.length; i++) {
    const v = T.list[i];
    v.s += v.dir * v.speed * dt; if (v.s > T.x1) v.s -= range; if (v.s < T.x0) v.s += range;
    if (closable && vanished(i, weatherFx.clear)) { vhHide(T.fleet, i); continue; }   // đóng cầu (bão): dọn dần xe
    const y = profile(v.s), slope = (profile(v.s + 1) - profile(v.s - 1)) / 2;
    _q.setFromEuler(_e.set(0, v.dir > 0 ? 0 : Math.PI, Math.atan(slope * v.dir), 'YZX'));
    base.set(v.s, y + 0.03, v.dir * v.lane);                 // tọa độ cục bộ của group cầu
    vhSetVehicle(T.fleet, i, base, _q);
  }
  vhCommit(T.fleet);
}
