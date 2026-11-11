import * as THREE from 'three';
import { UP } from './geometry';
import { CONFIG } from '../config';
import { weatherFx, vanished } from '../core/shared';
import { ppBuildGeometry } from './people/shapes';
import { ppMaterial } from './people/material';
import { ppAmp, ppCadence, type PersonKind } from './people/gait';
import type { PersonInfo } from './people/kinds';

/* =====================================================================
   NGƯỜI ĐI BỘ — hệ dùng chung cho Trần Thị Lý, Cầu sông Hàn, Cầu Rồng (spec G5–G10).
   Mỗi hệ: 1 InstancedMesh, hình gộp ppBuildGeometry(), vật liệu ppMaterial() (tay chân vung trong vertex shader theo shared.uTime).
   CPU chỉ dời vị trí, quay hướng; dáng đi / chạy / đứng theo thuộc tính instance aVar (pha, biên độ, cờ, nhịp) và aPants (màu quần).
   Mỗi người: { x, z, lo, hi, dir, speed, profile(c) → cao độ chân, axis: 'x' | 'z' } + kiểu người (ppApplyKinds).
   ===================================================================== */
export interface Walker {
  x: number; z: number; lo: number; hi: number; dir: number; speed: number; profile: (c: number) => number; axis?: 'x' | 'z';
  kind?: PersonKind; scale?: number; flags?: number; phase?: number;
  face?: number;     // rad quanh Y, chỉ cho người đứng (0: mặt hướng +X)
  follow?: number;   // chỉ số người dẫn (người đi cùng / trẻ em), chép vị trí dọc dải của người đó
}
export interface People { list: Walker[]; mesh: THREE.InstancedMesh; group: THREE.Group }

/* Băm theo chỉ số → [0, 1) (không đụng chuỗi ngẫu nhiên nào) */
const ppHash = (k: number) => { const s = Math.sin(k * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
/* Góc quay quanh Y để hình (mặt hướng +X) nhìn ra phía z dương (s > 0) hoặc z âm */
export const ppFaceZ = (s: number) => (s > 0 ? -Math.PI / 2 : Math.PI / 2);

/* Gộp danh sách kiểu người của nhiều đoạn (ppAssignKinds từng đoạn) thành một, dời chỉ số follow theo vị trí đoạn trong danh sách chung */
export function ppJoinKinds(...parts: PersonInfo[][]): PersonInfo[] {
  const out: PersonInfo[] = [];
  for (const p of parts) { const base = out.length; for (const k of p) out.push({ ...k, follow: k.follow >= 0 ? k.follow + base : -1 }); }
  return out;
}

/* Gán kiểu người lên danh sách đã dựng (sau khi lấy hết rnd() của cầu, trước createPeople):
   người chạy nhận tốc độ chạy; người đi cùng chép vị trí, hướng, tốc độ, dải của người dẫn rồi lệch ngang companionGap về phía trong
   (về tim cầu với người đi dọc cầu, về phía sông với người đi dọc bờ; outward = true thì lệch ra ngoài, về phía lan can — Cầu Rồng, tránh hàng cột đèn);
   người đứng do từng cầu đặt sát lan can và quay mặt (place). */
export function ppApplyKinds(list: Walker[], infos: PersonInfo[], place: (w: Walker, info: PersonInfo, i: number) => void, outward = false): void {
  const P = CONFIG.people, [r0, r1] = P.run.speed;
  infos.forEach((info, i) => {
    const w = list[i];
    w.kind = info.kind; w.scale = info.scale; w.flags = info.flags; w.phase = info.phase;
    if (info.kind === 'run') w.speed = r0 + (r1 - r0) * ppHash(i + 0.5);
    if (info.follow >= 0) {
      const L = list[info.follow], lat = L.axis === 'z' ? 'x' : 'z';
      Object.assign(w, { x: L.x, z: L.z, dir: L.dir, speed: L.speed, lo: L.lo, hi: L.hi, axis: L.axis, profile: L.profile, follow: info.follow });
      w[lat] += (outward ? 1 : -1) * Math.sign(w[lat]) * P.companionGap;
    }
    if (info.kind === 'stand') place(w, info, i);
  });
}

export function createPeople(bridge: { group: THREE.Object3D; noReflect: THREE.Object3D[] }, list: Walker[], name: string, rnd: () => number): People {
  const P = CONFIG.people, n = list.length, geo = ppBuildGeometry(), col = new THREE.Color();
  const aVar = new Float32Array(n * 4), aPants = new Float32Array(n * 3);
  list.forEach((p, i) => {
    const kind = p.kind ?? 'walk';
    aVar.set([p.phase ?? 0, ppAmp(kind), p.flags ?? 0, ppCadence(kind, p.speed, p.scale ?? 1)], i * 4);   // pha, biên độ hông, cờ, nhịp (khớp material.ts)
    col.setHex(P.pants[Math.floor(ppHash(i) * P.pants.length)]); aPants.set([col.r, col.g, col.b], i * 3);   // Color chuyển hex sRGB → tuyến tính
  });
  geo.setAttribute('aVar', new THREE.InstancedBufferAttribute(aVar, 4));
  geo.setAttribute('aPants', new THREE.InstancedBufferAttribute(aPants, 3));
  const mesh = new THREE.InstancedMesh(geo, ppMaterial(), n);
  list.forEach((_p, i) => mesh.setColorAt(i, col.setHex(P.shirts[Math.floor(rnd() * P.shirts.length)])));   // màu áo: đúng một rnd() mỗi người như cũ
  mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const group = new THREE.Group(); group.name = name; group.add(mesh);
  bridge.group.add(group); bridge.noReflect.push(group);
  const people = { list, mesh, group };
  group.userData.people = people;   // cho móc kiểm thử (environment/pedestrians.ts → peopleTest)
  stepPeople(people, 0, 0);   // đặt sẵn vị trí ban đầu
  return people;
}

const _pm = new THREE.Matrix4(), _pq = new THREE.Quaternion(), _pv = new THREE.Vector3(), _ps = new THREE.Vector3(), _zero = new THREE.Matrix4().makeScale(0, 0, 0);   // tạm cấp sẵn (D-018)
/* Dời người theo dải; đứng thì đứng yên; người đi cùng chép vị trí dọc dải của người dẫn.
   Đóng cầu (bão, closable): người thứ i ẩn dần theo vanished như xe (người đi cùng ẩn cùng lúc với người dẫn) */
export function stepPeople(P: People, dt: number, _elapsed: number, closable = true) {
  const L = P.list, clear = closable ? weatherFx.clear : 0;
  for (let i = 0; i < L.length; i++) {
    const p = L[i], alongZ = p.axis === 'z', key = alongZ ? 'z' : 'x', lead = p.follow ?? -1;
    if (vanished(lead >= 0 ? lead : i, clear)) { P.mesh.setMatrixAt(i, _zero); continue; }
    if (lead >= 0) p[key] = L[lead][key];
    else if (p.kind !== 'stand') { p[key] += p.dir * p.speed * dt; if (p[key] > p.hi) p[key] = p.lo; if (p[key] < p.lo) p[key] = p.hi; }
    const yaw = p.kind === 'stand' ? (p.face ?? 0) : alongZ ? (p.dir > 0 ? -Math.PI / 2 : Math.PI / 2) : (p.dir > 0 ? 0 : Math.PI);
    const s = p.scale ?? 1;
    P.mesh.setMatrixAt(i, _pm.compose(_pv.set(p.x, p.profile(p[key]), p.z), _pq.setFromAxisAngle(UP, yaw), _ps.set(s, s, s)));
  }
  P.mesh.instanceMatrix.needsUpdate = true;
}
