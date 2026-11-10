import { createTraffic } from '../../common/traffic';
import { createBoats } from '../../common/boats';
import { createPeople, type Walker } from '../../common/people';
import { rng, lerp } from '../../common/math';
import { TTL, ttlRoadY, nvtY } from './profile';
import type { TranThiLyBridge } from './TranThiLyBridge';

/* [life] xe (6 làn: 2 làn trong dùng hệ xe chung của khu phố, làn ngoài ở đây), thuyền du lịch, người đi bộ */
export function ttlBuildLife(bridge: TranThiLyBridge) {
  // 2 làn trong mỗi chiều dùng hệ xe chung của scene (PATHS.ttl); làn ngoài (nhiều xe máy) ở đây
  bridge.traffic = createTraffic(bridge, { seed: 731, x0: -1900, x1: 1480, busColor: 0xe8b923,
    lanes: [{ off: TTL.laneOffsets[2], n: 30, speed: 9, bike: 0.85, bus: 0 }] });
  // thuyền du lịch sông Hàn: chạy giữa Cầu Rồng và Trần Thị Lý, qua dưới hai cầu
  bridge.boats = createBoats(bridge, [
    { x: -100, z: -1200, dir: 1, speed: 3.2, len: 24, w: 7, h: 2.6, cab: 3.0, type: 'C' },
    { x: 82, z: 150, dir: -1, speed: 2.8, len: 20, w: 6.5, h: 2.5, cab: 2.8, type: 'A' }
  ], 'ttl-boats');
  // người đi bộ mức chi tiết thấp: trên lề cầu và trên cầu Nguyễn Văn Trỗi (hệ dùng chung common/)
  const rnd = rng(1965), list: Walker[] = [], onDeck = (x: number) => ttlRoadY(x) + 0.25;
  for (let i = 0; i < 46; i++) list.push({ x: lerp(TTL.westEnd + 10, TTL.eastEnd - 10, rnd()), z: (rnd() < 0.5 ? -1 : 1) * (TTL.hw - TTL.sidewalk / 2 - 0.15),
    lo: TTL.westEnd + 5, hi: TTL.eastEnd - 5, dir: rnd() < 0.5 ? -1 : 1, speed: 1 + rnd() * 0.6, profile: onDeck });
  for (let i = 0; i < 34; i++) list.push({ x: lerp(-280, 280, rnd()), z: TTL.nvtZ + (rnd() - 0.5) * 6,
    lo: -285, hi: 285, dir: rnd() < 0.5 ? -1 : 1, speed: 0.9 + rnd() * 0.5, profile: nvtY });
  bridge.people = createPeople(bridge, list, bridge.mats.person, 'ttl-people', rnd);
}
