import * as THREE from 'three';
import { CONFIG } from '../config';
import { scene } from '../core/renderer';
import { weatherFx } from '../core/shared';
import { rng, lerp } from '../common/math';
import { createPeople, stepPeople, ppApplyKinds, ppFaceZ, type People, type Walker } from '../common/people';
import { ppAssignKinds } from '../common/people/kinds';
import { deckY } from '../bridges/dragon/profile';
import { crowdParams, crClip, type CrowdInfo } from '../common/people/crowd';
import { crowdGet } from '../common/people/crowdData';

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
  /* Cắt theo khung nhìn: khối cầu cố định bao mọi chỗ người có thể tới trên cả mặt cầu (không computeBoundingSphere — sẽ co theo vị trí lúc gọi).
     Người thật (BatchedMesh): three cũng tự tính bao cầu cả đối tượng một lần nếu để trống rồi không cập nhật ⇒ đặt sẵn như hình khối; từng id còn cắt riêng (perObjectFrustumCulled) */
  const box = new THREE.Box3(new THREE.Vector3(-326, CONFIG.roadY, -hw), new THREE.Vector3(326, deckY(0) + 2.5, hw));   // x ±(325 + 1) m, cao tới đỉnh nón / tay giơ trên đỉnh vồng
  dragon.mesh.boundingSphere = box.getBoundingSphere(new THREE.Sphere()); dragon.mesh.frustumCulled = true;
}

export function updateDragonPeople(dt: number, elapsed: number, cam: THREE.Camera): void {
  if (!dragon) return;
  const near = cam.position.distanceTo(CENTER) < D.hideDistance;
  if (near) stepPeople(dragon, dt, elapsed, true);
  dragon.group.visible = near && weatherFx.clear < 1;   // bão đã dọn hết thì bỏ luôn lệnh vẽ
}

/* Móc kiểm thử (tests/people-check.mjs): các hệ người tìm theo tên trong scene; chạy cho cả hình khối (InstancedMesh) lẫn người thật (BatchedMesh) */
const PP_NAMES = ['ttl-people', 'sh-people', 'dragon-people'];
type PpMesh = THREE.InstancedMesh | THREE.BatchedMesh;
const ppFind = (name: string) => {
  const g = scene.getObjectByName(name), meshes: PpMesh[] = [];
  g?.traverse((o) => { if ((o as THREE.InstancedMesh).isInstancedMesh || (o as THREE.BatchedMesh).isBatchedMesh) meshes.push(o as PpMesh); });
  return { g, meshes, list: (g?.userData.people as People | undefined)?.list, real: !!(g?.userData.people as People | undefined)?.real };
};
export const peopleTest = {
  /* visible = số người đang hiện (hình khối: instance có scale > 0; người thật: getVisibleAt).
     Người thật: real, tris = tổng tam giác các id, chars = số nhân vật khác nhau đang dùng, hats = số người đội nón; colors = số id đã setColorAt */
  systems(): { name: string; count: number; visible: number; meshes: number; material: string; materialName: string; verts: number; colors: number; shirtKinds: number; instAttrs: boolean; groupVisible: boolean; real: boolean; tris: number; chars: number; hats: number }[] {
    return PP_NAMES.map((name) => {
      const { g, meshes, list, real } = ppFind(name), m0 = meshes[0];
      if (!m0) return null;
      const mat = m0.material as THREE.Material, geo = m0.geometry, base = { name, meshes: meshes.length, material: mat.uuid, materialName: mat.name, verts: geo.getAttribute('position').count, groupVisible: g.visible, real };
      if ((m0 as THREE.BatchedMesh).isBatchedMesh) {
        const m = m0 as THREE.BatchedMesh, info = m.userData.crowd as CrowdInfo, n = list?.length ?? 0, col = new THREE.Color(), tints = new Set<string>();
        let visible = 0;
        for (let i = 0; i < n; i++) { if (m.getVisibleAt(i)) visible++; m.getColorAt(i, col); tints.add(col.r.toFixed(3)); }
        return { ...base, count: n, visible, colors: n, shirtKinds: tints.size, instAttrs: false, tris: info.tris, chars: new Set(info.char).size, hats: info.hat.reduce((a, b) => a + b, 0) };
      }
      const m = m0 as THREE.InstancedMesh, a = m.instanceMatrix.array, c = m.instanceColor?.array, shirts = new Set<string>();
      let visible = 0;
      for (let i = 0; i < m.count; i++) { if (Math.abs(a[i * 16]) + Math.abs(a[i * 16 + 1]) + Math.abs(a[i * 16 + 2]) > 1e-9) visible++; if (c) shirts.add(`${c[i * 3].toFixed(3)},${c[i * 3 + 1].toFixed(3)},${c[i * 3 + 2].toFixed(3)}`); }
      const inst = (n: string) => !!(geo.getAttribute(n) as THREE.InstancedBufferAttribute)?.isInstancedBufferAttribute;
      return { ...base, count: m.count, visible, colors: c ? c.length / 3 : 0, shirtKinds: shirts.size, instAttrs: inst('aVar') && inst('aPants'), tris: (geo.index ? geo.index.count : geo.getAttribute('position').count) / 3 * m.count, chars: 0, hats: 0 };
    }).filter(Boolean);
  },
  /* Vị trí cục bộ (trong nhóm cầu) từng người, cao độ mặt lề tại đó, kiểu, scale, trục đứng (y của trục Y), hướng mặt (+X của hình); getMatrixAt có ở cả hai loại lưới.
     visible: đang hiện (hình khối: scale > 0; người thật: getVisibleAt — người ẩn giữ ma trận cũ); follow: chỉ số người dẫn (−1 nếu không); lx, lz: vị trí trong danh sách (CPU).
     Người thật thêm: char (chỉ số nhân vật), child (nhân vật trẻ em: trần nhịp rateMaxChild), clip (đoạn chuyển động), rate (nhịp phát đọc lại từ texture thông số shader dùng = khung/giây ÷ fps của đoạn), natural (m/s tự nhiên của đoạn ở tỉ lệ 1) */
  positions(name: string): { i: number; x: number; y: number; z: number; ground: number; kind: string; scale: number; upY: number; fwd: number[]; visible: boolean; follow: number; lx: number; lz: number; char?: number; child?: boolean; clip?: string; rate?: number; natural?: number; speed: number }[] {
    const { meshes, list } = ppFind(name), m = meshes[0], M = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(), up = new THREE.Vector3(), fwd = new THREE.Vector3();
    if (!m || !list) return [];
    const bm = (m as THREE.BatchedMesh).isBatchedMesh ? (m as THREE.BatchedMesh) : null, data = crowdGet(), info = bm?.userData.crowd as CrowdInfo | undefined;
    const pd = bm ? (crowdParams(bm.material as THREE.Material).image.data as unknown as Float32Array) : null;
    const cd = bm ? ((bm as unknown as { _colorsTexture: THREE.DataTexture })._colorsTexture.image.data as unknown as Float32Array) : null;
    return list.map((w, i) => {
      m.getMatrixAt(i, M); M.decompose(p, q, s);
      up.set(0, 1, 0).applyQuaternion(q); fwd.set(1, 0, 0).applyQuaternion(q);
      const out = { i, x: p.x, y: p.y, z: p.z, ground: w.profile(w.axis === 'z' ? w.z : w.x), kind: w.kind ?? 'walk', scale: s.x, upY: up.y, fwd: fwd.toArray(), visible: bm ? bm.getVisibleAt(i) : s.x > 0, follow: w.follow ?? -1, lx: w.x, lz: w.z, speed: w.speed };
      if (!bm || !data) return out;
      const clip = crClip(w), c = data.chars[info.char[i]].clips[clip], g = Math.round(cd[i * 4 + 3]);   // kênh alpha màu id = chỉ số người trong texture thông số
      return { ...out, char: info.char[i], child: data.chars[info.char[i]].child, clip, rate: pd[g * 4 + 2] / c.fps, natural: c.speed };
    });
  },
  /* Chân người thật theo chuyển động (oracle trên CPU, đọc thẳng crowd.bin đã tải): với mỗi nhân vật và đoạn, skin lưới (không nón) ở từng khung
     (đoạn không lặp: chỉ khung cuối, đúng như shader) rồi lấy y thấp nhất; trả [min, max] của y thấp nhất qua các khung, đơn vị m ở tỉ lệ 1. null nếu không có dữ liệu */
  crowdFeet(): { id: string; child: boolean; clips: Record<string, [number, number]> }[] | null {
    const d = crowdGet(); if (!d) return null;
    const h = (k: number) => THREE.DataUtils.fromHalfFloat(d.animData[k]), W = d.animWidth;
    return d.chars.map((c) => {
      const pos = c.geometry.getAttribute('position'), bi = c.geometry.getAttribute('aBones'), aw = c.geometry.getAttribute('aW'), clips: Record<string, [number, number]> = {};
      for (const [name, k] of Object.entries(c.clips)) {
        let lo = Infinity, hi = -Infinity;
        for (let f = k.loop ? 0 : k.frames - 1; f < k.frames; f++) {
          const row = (k.row + f) * W * 4;
          let low = Infinity;
          for (let v = 0; v < pos.count; v++) {
            const x = pos.getX(v), yv = pos.getY(v), z = pos.getZ(v), a = aw.getX(v);
            const yOf = (b: number) => { const t = row + (b * 3 + 1) * 4; return h(t) * x + h(t + 1) * yv + h(t + 2) * z + h(t + 3); };   // hàng 1 (y) của ma trận 3×4 xương b
            const y = a * yOf(bi.getX(v)) + (1 - a) * yOf(bi.getY(v));
            if (y < low) low = y;
          }
          lo = Math.min(lo, low); hi = Math.max(hi, low);
        }
        clips[name] = [lo, hi];
      }
      return { id: c.id, child: c.child, clips };
    });
  }
};
