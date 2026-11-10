import { createTraffic } from '../../common/traffic';
import { createBoats } from '../../common/boats';
import { TP } from './profile';
import type { ThuanPhuocBridge } from './ThuanPhuocBridge';

/* [life] xe cộ & tàu thuyền (hệ dùng chung trong common/) */
export function tpBuildTraffic(bridge: ThuanPhuocBridge) {
  bridge.traffic = createTraffic(bridge, { seed: 405, x0: -1500, x1: 1480, name: 'tp-traffic', lanes: [
    { off: TP.median / 2 + TP.laneWidth * 0.5, n: 20, speed: 16 },               // làn trong
    { off: TP.median / 2 + TP.laneWidth * 1.5, n: 30, speed: 11, bike: 0.6 }     // làn ngoài, nhiều xe máy
  ] });
}
export function tpBuildBoats(bridge: ThuanPhuocBridge) {
  // tàu cá, tàu du lịch và một tàu hàng nhỏ đi qua nhịp chính (tĩnh không 27 m)
  bridge.boats = createBoats(bridge, [
    { x: -70, z: 600, dir: -1, speed: 4.2, len: 22, w: 6.5, h: 2.6, cab: 2.6, type: 'D' },
    { x: 30, z: -500, dir: 1, speed: 3.4, len: 18, w: 6, h: 2.4, cab: 2.4, type: 'B' },
    { x: 110, z: 200, dir: -1, speed: 2.6, len: 46, w: 10, h: 4.2, cab: 7.5, type: 'D' }
  ], 'tp-boats');
}
