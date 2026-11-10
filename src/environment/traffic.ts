import * as THREE from 'three';
import { CONFIG } from '../config';
import { scene } from '../core/renderer';
import { windFx, weatherFx, vanished, shared } from '../core/shared';
import { rand } from '../common/math';
import type { BoatTypeId } from '../config';
import { btCreateFleet, btSetInfo, btSetBoat, btHideBoat, btCommit, btFleets, type BoatFleet } from './boats/fleet';
import { btCrowdSlots, btCrowdTarget, btCrowdLevel, btCrowdShown, btInExclusion } from './boats/crowd';
import { _e, _q, type VehicleType } from '../common/traffic';
import { vhCreateFleet, vhSetInfo, vhSetVehicle, vhHide, vhCommit, vhFleets, type VehicleFleet } from '../common/vehicles/fleet';
import { vhMaterial } from '../common/vehicles/material';
import { deckY } from '../bridges/dragon/profile';
import { ttlRoadY } from '../bridges/tran-thi-ly/profile';

/* ============================ Xe cộ & thuyền của khu phố quanh Cầu Rồng ============================ */
interface Path { axis: 'x' | 'z'; min: number; max: number; fixed: number; profile?: (x: number) => number; hidden?: boolean }
interface CityVehicle { path: Path; lane: number; dir: number; type: VehicleType; s: number; speed: number; color: number }

export const PATHS: Record<'axis' | 'ttl' | 'bachDang' | 'tranHungDao', Path> = {
  axis: { axis: 'x', min: -1900, max: 1480, fixed: 0, profile: deckY },
  ttl: { axis: 'x', min: -1900, max: 1480, fixed: CONFIG.ttl.z, profile: ttlRoadY, hidden: false }, // 2 làn trong mỗi chiều của Cầu Trần Thị Lý
  bachDang: { axis: 'z', min: -2400, max: 2400, fixed: -299 },
  tranHungDao: { axis: 'z', min: -2200, max: 2400, fixed: 299 }
};
const vehicles: CityVehicle[] = [];
export let cityFleet: VehicleFleet;   // 1 InstancedMesh 'traffic-city' cho mọi xe khu phố

export function buildTraffic() {
  const V = CONFIG.vehicles, colors = V.carColors;
  const addLane = (path: Path, lane: number, dir: number, count: number, speed: number, mix: { bike: number; bus: number }) => {
    const range = path.max - path.min;
    for (let k = 0; k < count; k++) {
      const r = rand(); const type: VehicleType = r < mix.bike ? 'bike' : r < mix.bike + mix.bus ? 'bus' : 'car';
      vehicles.push({ path, lane, dir, type, s: path.min + (k + rand() * 0.5) * range / count, speed,
        color: type === 'bike' ? V.bikeColors[k % V.bikeColors.length] : type === 'bus' ? V.palette.busBody : colors[Math.floor(rand() * colors.length)] });
    }
  };
  const lanes = [4.875, 8.625, 12.375];
  for (const dir of [1, -1]) {
    addLane(PATHS.axis, lanes[0], dir, 26, 15, { bike: 0.05, bus: 0.08 });
    addLane(PATHS.axis, lanes[1], dir, 30, 12.5, { bike: 0.3, bus: 0.06 });
    addLane(PATHS.axis, lanes[2], dir, 44, 9.5, { bike: 0.85, bus: 0 });
    for (const [p, n] of [[PATHS.bachDang, 26], [PATHS.tranHungDao, 22]] as [Path, number][]) {
      addLane(p, 3.5, dir, n, 11, { bike: 0.3, bus: 0.05 }); addLane(p, 7.5, dir, n + 10, 8.5, { bike: 0.8, bus: 0 });
    }
    addLane(PATHS.ttl, 4.625, dir, 22, 13, { bike: 0.2, bus: 0.05 }); addLane(PATHS.ttl, 8.375, dir, 30, 9, { bike: 0.8, bus: 0 });
  }
  cityFleet = vhCreateFleet(vehicles.length, scene, 'traffic-city');
  vehicles.forEach((v, i) => vhSetInfo(cityFleet, i, v.type, v.color));
}
const _p = new THREE.Vector3();
/* Không cấp phát mỗi khung (D-018). Đèn pha/hậu bật trong shader theo uNight (common/vehicles/material.ts) */
export function updateTraffic(dt: number) {
  for (let i = 0; i < vehicles.length; i++) {
    const v = vehicles[i], P = v.path, range = P.max - P.min;
    if (P.hidden) { vhHide(cityFleet, i); continue; } // làn tắt bằng nút bật/tắt
    v.s += v.dir * v.speed * dt;
    if (v.s > P.max) v.s -= range; if (v.s < P.min) v.s += range;
    if ((P === PATHS.axis || P === PATHS.ttl) && vanished(i, weatherFx.clear)) { vhHide(cityFleet, i); continue; }   // đóng cầu (bão): dọn dần xe trên Cầu Rồng, Trần Thị Lý
    let yaw: number, pitch = 0;
    if (P.axis === 'x') {
      const y = P.profile(v.s), slope = (P.profile(v.s + 1) - P.profile(v.s - 1)) / 2;
      _p.set(v.s, y + 0.02, P.fixed + v.dir * v.lane); yaw = v.dir > 0 ? 0 : Math.PI; pitch = Math.atan(slope * v.dir);
    } else {
      _p.set(P.fixed - v.dir * v.lane, CONFIG.roadY + 0.03, v.s); yaw = v.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
    }
    _q.setFromEuler(_e.set(0, yaw, pitch, 'YZX'));
    vhSetVehicle(cityFleet, i, _p, _q);
  }
  vhCommit(cityFleet);
}
/* Cho test (__app.traffic) */
export const trafficTest = { fleets: () => vhFleets, city: () => vehicles, paths: PATHS, material: vhMaterial, types: CONFIG.vehicles.types };

/* Vùng cấm thuyền quanh công trường dìm đốt hầm (Hầm vượt sông Hàn, z ≈ −1700): chỉ có hiệu lực khi on */
export const boatKeepOut = { on: false, z0: -1760, z1: -1640 };

/* Thuyền du lịch dọc sông Hàn — một đội tàu (fleet) chung ở layer 0 (có phản chiếu): 7 tàu chạy + chỗ cho 15 tàu tụ tập ban đêm (Task 4) */
export interface RiverBoat { x: number; z: number; dir: number; speed: number; len: number; type: BoatTypeId }
const boats: RiverBoat[] = [];
let fleet: BoatFleet;
export const RIVER_CROWD_FIRST = 7;   // instance 7.. dành cho tàu tụ tập
export function buildBoats() {
  const lanesX = [-48, -22, 22, 48];
  for (let i = 0; i < 7; i++) {
    // giữ đúng 2 lời gọi rand() mỗi tàu, đúng thứ tự (speed rồi len) — bất biến chuỗi seed; r đổi sang khoảng dài của kiểu
    const speed = 3 + rand() * 2, r = rand(), type: BoatTypeId = i % 2 ? 'B' : 'A', [lo, hi] = CONFIG.boats.types[type].len;
    boats.push({ x: lanesX[i % 4], z: -2200 + i * 650, dir: lanesX[i % 4] > 0 ? 1 : -1, speed, len: lo + r * (hi - lo), type });
  }
  fleet = btCreateFleet(RIVER_CROWD_FIRST + crowd.length, ['A', 'B', 'C'], scene, 'boats-river');
  boats.forEach((b, i) => btSetInfo(fleet, i, { type: b.type, variant: i % 3, led: (i * 2) % CONFIG.boats.led.colors.length, name: i % CONFIG.boats.names.length }));
  crowd.forEach((c, k) => btSetInfo(fleet, RIVER_CROWD_FIRST + k, c));
}
/* Tàu tụ tập ban đêm quanh Cầu Rồng / Cầu sông Hàn (spec G5, G6): đậu, trôi tròn chậm, mũi lắc nhẹ; hiện so le theo mức đêm, về bến khi bão */
const crowd = btCrowdSlots(), crowdA: number[] = crowd.map(() => 0);
let crowdLevel = 0;
export function btStepCrowd(f: BoatFleet, first: number, t: number, dt: number) {
  const C = CONFIG.boats.crowd, w = (Math.PI * 2) / C.driftPeriod;
  crowdLevel = btCrowdLevel(crowdLevel, btCrowdTarget(shared.uNight.value, weatherFx.boatAway), dt);
  crowd.forEach((c, k) => {
    const on = btCrowdShown(k, crowdLevel); crowdA[k] = on ? 1 : 0;
    if (!on) { btHideBoat(f, first + k); return; }
    const ph = t * w + c.phase, i = first + k;
    bq.setFromEuler(_e.set(Math.sin(t * 0.7 + k) * 0.012 * windFx.boatRock, c.yaw + C.yawSwing * Math.sin(ph * 0.7), Math.sin(t * 0.9 + k * 2) * 0.018 * windFx.boatRock, 'YXZ'));
    btSetBoat(f, i, bBase.set(c.x + C.drift * Math.cos(ph), 0, c.z + C.drift * Math.sin(ph)), bq, c.len);
  });
}
const bq = new THREE.Quaternion(), bBase = new THREE.Vector3();
export function updateBoats(dt: number, t: number) {
  boats.forEach((b, i) => {
    b.z += b.dir * b.speed * dt * (1 - weatherFx.boatAway); if (b.z > 2500) b.z = -2500; if (b.z < -2500) b.z = 2500;   // bão: thuyền chậm dần rồi dừng
    if (boatKeepOut.on && b.z > boatKeepOut.z0 && b.z < boatKeepOut.z1) b.z = b.dir > 0 ? boatKeepOut.z0 : boatKeepOut.z1;
    if (vanished(i, weatherFx.boatAway)) { btHideBoat(fleet, i); return; }   // về bến: ẩn dần
    bq.setFromEuler(_e.set(Math.sin(t * 0.9 + i) * 0.015 * windFx.boatRock, b.dir > 0 ? 0 : Math.PI, Math.sin(t * 1.1 + i * 2) * 0.02 * windFx.boatRock, 'YXZ'));   // mũi theo hướng chạy; tròng trành tăng theo gió (mặc định ×1)
    btSetBoat(fleet, i, bBase.set(b.x, 0, b.z), bq, b.len);
  });
  btStepCrowd(fleet, RIVER_CROWD_FIRST, t, dt);
  btCommit(fleet);
}
/* Cho test (__app.boats) */
export const boatsTest = { fleets: () => btFleets, running: () => boats, types: CONFIG.boats.types, crowd, crowdFirst: RIVER_CROWD_FIRST, crowdAlpha: () => crowdA, inExclusion: btInExclusion, drift: CONFIG.boats.crowd.drift };
