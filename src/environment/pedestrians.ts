import * as THREE from 'three';
import { CONFIG } from '../config';
import { scene } from '../core/renderer';
import { weatherFx } from '../core/shared';
import { rng, lerp } from '../common/math';
import { createPeople, stepPeople, ppApplyKinds, ppFaceZ, type People, type Walker } from '../common/people';
import { ppAssignKinds } from '../common/people/kinds';
import { deckY } from '../bridges/dragon/profile';

/* =====================================================================
   NGƯỜI ĐI BỘ CẦU RỒNG (spec G9, G10, §7) — hai lề 2,5 m, ngày và đêm như nhau, không nút bật/tắt.
   Dựng bằng rng(CONFIG.people.dragon.seed) riêng (không gọi rand()), sau mọi lệnh dựng dùng rand() trong main.ts.
   Người đứng sát lan can, mặt quay ra sông; phần headBias số người đứng ở đoạn gần đầu rồng (x > 150, phía Đông).
   Lớp 1 (không phản chiếu), không đổ bóng; ẩn cả nhóm khi camera xa hơn hideDistance; bão đóng cầu thì rời cầu dần như xe.
   ===================================================================== */
const D = CONFIG.people.dragon;
const CENTER = new THREE.Vector3(0, deckY(0), 0);
let dragon: People | null = null;

export function buildDragonPeople(): void {
  const r = rng(D.seed), W = CONFIG.people.walk, hw = CONFIG.width / 2, zWalk = D.walkZ, list: Walker[] = [];   // tuyến đi giữa hàng cột đèn (|z| 17) và lan can
  const onDeck = (x: number) => deckY(x) + 0.25;   // mặt lát lề cao 0,25 m trên bản mặt cầu (deck.ts)
  for (let i = 0; i < D.n; i++) list.push({ x: lerp(-325, 325, r()), z: (r() < 0.5 ? -1 : 1) * zWalk, lo: -325, hi: 325, dir: r() < 0.5 ? -1 : 1, speed: lerp(W.speed[0], W.speed[1], r()), profile: onDeck });
  const infos = ppAssignKinds(D.n, D.seed + 1), nHead = Math.round(infos.filter((k) => k.kind === 'stand').length * D.headBias);
  let k = 0;
  ppApplyKinds(list, infos, (w) => {
    const s = Math.sign(w.z);
    w.z = s * (hw - 0.5); w.face = ppFaceZ(s);
    w.x = k++ < nHead ? lerp(150, D.standX, r()) : lerp(-D.standX, 150, r());   // headBias phần người đứng ở đoạn gần đầu rồng; chỉ trên phần cầu qua sông (một r() mỗi người như cũ)
  }, true);   // người đi cùng lệch ra phía lan can, không lấn vào hàng cột đèn
  dragon = createPeople({ group: scene, noReflect: [] }, list, 'dragon-people', r);
  dragon.group.traverse((o) => o.layers.set(1));
  /* Cắt theo khung nhìn: khối cầu cố định bao mọi chỗ người có thể tới trên cả mặt cầu (không computeBoundingSphere — sẽ co theo vị trí lúc gọi) */
  const box = new THREE.Box3(new THREE.Vector3(-326, CONFIG.roadY, -hw), new THREE.Vector3(326, deckY(0) + 2.5, hw));   // x ±(325 + 1) m, cao tới đỉnh nón / tay giơ trên đỉnh vồng
  dragon.mesh.boundingSphere = box.getBoundingSphere(new THREE.Sphere()); dragon.mesh.frustumCulled = true;
}

export function updateDragonPeople(dt: number, elapsed: number, cam: THREE.Camera): void {
  if (!dragon) return;
  const near = cam.position.distanceTo(CENTER) < D.hideDistance;
  if (near) stepPeople(dragon, dt, elapsed, true);
  dragon.group.visible = near && weatherFx.clear < 1;   // bão đã dọn hết thì bỏ luôn lệnh vẽ
}

/* Móc kiểm thử (tests/people-check.mjs): các hệ người tìm theo tên trong scene */
const PP_NAMES = ['ttl-people', 'sh-people', 'dragon-people'];
const ppFind = (name: string) => {
  const g = scene.getObjectByName(name), meshes: THREE.InstancedMesh[] = [];
  g?.traverse((o) => { if ((o as THREE.InstancedMesh).isInstancedMesh) meshes.push(o as THREE.InstancedMesh); });
  return { g, meshes, list: (g?.userData.people as People | undefined)?.list };
};
export const peopleTest = {
  /* visible = số instance có scale > 0 */
  systems(): { name: string; count: number; visible: number; meshes: number; material: string; materialName: string; verts: number; colors: number; shirtKinds: number; instAttrs: boolean; groupVisible: boolean }[] {
    return PP_NAMES.map((name) => {
      const { g, meshes } = ppFind(name), m = meshes[0];
      if (!m) return null;
      const a = m.instanceMatrix.array, c = m.instanceColor?.array, geo = m.geometry, shirts = new Set<string>();
      let visible = 0;
      for (let i = 0; i < m.count; i++) { if (Math.abs(a[i * 16]) + Math.abs(a[i * 16 + 1]) + Math.abs(a[i * 16 + 2]) > 1e-9) visible++; if (c) shirts.add(`${c[i * 3].toFixed(3)},${c[i * 3 + 1].toFixed(3)},${c[i * 3 + 2].toFixed(3)}`); }
      const inst = (n: string) => !!(geo.getAttribute(n) as THREE.InstancedBufferAttribute)?.isInstancedBufferAttribute;
      const mat = m.material as THREE.Material;
      return { name, count: m.count, visible, meshes: meshes.length, material: mat.uuid, materialName: mat.name, verts: geo.getAttribute('position').count, colors: c ? c.length / 3 : 0, shirtKinds: shirts.size, instAttrs: inst('aVar') && inst('aPants'), groupVisible: g.visible };
    }).filter(Boolean);
  },
  /* Vị trí cục bộ (trong nhóm cầu) từng người, cao độ mặt lề tại đó, kiểu, scale, trục đứng (y của trục Y), hướng mặt (+X của hình) */
  positions(name: string): { i: number; x: number; y: number; z: number; ground: number; kind: string; scale: number; upY: number; fwd: number[] }[] {
    const { meshes, list } = ppFind(name), m = meshes[0], M = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(), up = new THREE.Vector3(), fwd = new THREE.Vector3();
    if (!m || !list) return [];
    return list.map((w, i) => {
      m.getMatrixAt(i, M); M.decompose(p, q, s);
      up.set(0, 1, 0).applyQuaternion(q); fwd.set(1, 0, 0).applyQuaternion(q);
      return { i, x: p.x, y: p.y, z: p.z, ground: w.profile(w.axis === 'z' ? w.z : w.x), kind: w.kind ?? 'walk', scale: s.x, upY: up.y, fwd: fwd.toArray() };
    });
  }
};
