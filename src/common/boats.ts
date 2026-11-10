import * as THREE from 'three';
import { CONFIG, type BoatTypeId } from '../config';
import { _e } from './traffic';
import { windFx, weatherFx, vanished } from '../core/shared';
import { btCreateFleet, btSetInfo, btSetBoat, btHideBoat, btCommit, type BoatFleet } from '../environment/boats/fleet';

/* type: kiểu tàu (environment/boats/hulls.ts); w, h, cab: kích thước của khối hộp cũ, nay chỉ còn len quyết định (kiểu co giãn đều theo len) */
export interface BridgeBoat { x: number; z: number; dir: number; speed: number; len: number; w: number; h: number; cab: number; type?: BoatTypeId }
export interface Boats { list: BridgeBoat[]; fleet: BoatFleet }

/* list: [{ x, z, dir, speed, len, … }] — thuyền chạy dọc sông (trục Z cục bộ); một đội tàu = 1 lệnh vẽ, nằm trong bridge.life (layer 1) */
export function createBoats(bridge: { life: THREE.Group }, list: BridgeBoat[], name: string): Boats {
  const types = [...new Set(list.map((b) => b.type ?? 'A'))];
  const fleet = btCreateFleet(list.length, types, bridge.life, name), N = CONFIG.boats;
  list.forEach((b, i) => { const k = Math.abs(Math.round(b.x)) + i; btSetInfo(fleet, i, { type: b.type ?? 'A', variant: k % N.variants, led: k % N.led.colors.length, name: k % N.names.length }); });
  return { list, fleet };
}
const _bq = new THREE.Quaternion(), _bb = new THREE.Vector3();   // vector tạm cấp sẵn (D-018)
export function stepBoats(B: Boats, dt: number, elapsed: number, zMin: number, zMax: number) {
  B.list.forEach((b, i) => {
    b.z += b.dir * b.speed * dt * (1 - weatherFx.boatAway); if (b.z > zMax) b.z = zMin; if (b.z < zMin) b.z = zMax;
    if (vanished(i, weatherFx.boatAway)) { btHideBoat(B.fleet, i); return; }   // bão: thuyền về bến, ẩn dần
    _bq.setFromEuler(_e.set(Math.sin(elapsed * 0.8 + i) * 0.012 * windFx.boatRock, b.dir > 0 ? 0 : Math.PI, Math.sin(elapsed + i * 2) * 0.018 * windFx.boatRock, 'YXZ'));   // mũi theo hướng chạy; tròng trành tăng theo gió (mặc định ×1)
    btSetBoat(B.fleet, i, _bb.set(b.x, 0, b.z), _bq, b.len);
  });
  btCommit(B.fleet);
}
