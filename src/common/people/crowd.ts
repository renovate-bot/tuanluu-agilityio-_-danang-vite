import * as THREE from 'three';
import { CONFIG } from '../../config';
import { shared } from '../../core/shared';
import { PP_FLAG } from './kinds';
import type { CrowdData, CrowdClip, CrowdClipName } from './crowdData';
import type { Walker } from '../people';

/* =====================================================================
   ĐÁM ĐÔNG NGƯỜI THẬT (D-032) — mỗi hệ người đi bộ một THREE.BatchedMesh (r165, WEBGL_multi_draw ⇒ 1 lệnh vẽ), một id mỗi người.
   Spec: docs/superpowers/specs/2026-11-12-dam-dong-nguoi-that-design.md §4, §5. Dữ liệu: crowdData.ts (định dạng crowd.bin ở đầu file đó).
   - Skin trong vertex shader: 2 xương mỗi đỉnh (aBones, aW), ma trận 3×4 của xương đọc từ texture chuyển động (uCrowdAnim, texelFetch),
     nội suy hai khung liền nhau; đoạn lặp thì khung cuối nội suy về khung đầu, đoạn không lặp (photo) giữ khung cuối.
   - Thông số từng người (hàng đầu đoạn, ±số khung, khung/giây, pha theo khung) nằm trong một DataTexture float dùng chung cho cả 3 hệ
     (uCrowdPeople). Chỉ số của người trong texture đó (= chỗ bắt đầu của hệ + id) ghi vào kênh alpha của batchingColorTexture
     (setColorAt chỉ ghi rgb; rgb = hệ số sáng theo người, spec §4.11). Một vật liệu cho cả 3 hệ ⇒ không có uniform riêng theo hệ.
   - Thời gian: shared.uTime; lấy mod theo chu kỳ của người TRƯỚC khi nhân khung/giây để pha không mất chính xác khi trang chạy lâu.
   - Phải setColorAt cho mọi id (r165: thiếu bảng màu thì renderer tra lại program mỗi khung). sortObjects = false; không setInstanceCountAt.
   - Ẩn người: setVisibleAt (tự đặt _visibilityChanged). setMatrixAt tự đặt matricesTexture.needsUpdate.
   - Khối cầu bao từng id: của lưới nguồn, nới cullPad / tỉ lệ người (đơn vị cục bộ; matrix nhân lại tỉ lệ) để tay chân không bị cắt nhầm.
   ===================================================================== */
const PEOPLE_W = 32, PEOPLE_H = 32;   // texel — sức chứa texture thông số: 1 024 người cho mọi hệ (hiện 226)

/* ---------- băm theo chỉ số (không dùng rand / rnd / rng) ---------- */
const crHashStr = (s: string): number => { let h = 2166136261; for (let k = 0; k < s.length; k++) h = Math.imul(h ^ s.charCodeAt(k), 16777619); return h >>> 0; };
const crHash = (a: number, b: number): number => {
  let h = Math.imul(a ^ Math.imul((b + 0x9e3779b9) | 0, 0x85ebca6b), 0xc2b2ae35);
  h ^= h >>> 16; h = Math.imul(h, 0x7feb352d); h ^= h >>> 15; h = Math.imul(h, 0x846ca68b); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

/* Dùng được người thật không: có dữ liệu và có WEBGL_multi_draw (thiếu thì r165 vẽ mỗi người một lệnh ⇒ lùi về hình khối) */
export function crowdUsable(data: CrowdData | null, hasMultiDraw: boolean): boolean {
  return !!data && hasMultiDraw && data.chars.some((c) => c.child) && data.chars.some((c) => !c.child);
}

/* Chọn nhân vật cho người i của hệ system (tất định). isChild → chỉ nhân vật trẻ em; avoid: nhân vật của người đi cùng (−1 nếu không), tránh trùng khi có ≥ 2 lựa chọn */
export function crowdPick(chars: { child: boolean }[], system: string, i: number, isChild: boolean, avoid: number): number {
  let cand: number[] = [];
  chars.forEach((c, k) => { if (c.child === isChild) cand.push(k); });
  if (!cand.length) cand = chars.map((_, k) => k);
  let k = Math.floor(crHash(crHashStr(system), i) * cand.length);
  if (cand[k] === avoid && cand.length > 1) k = (k + 1) % cand.length;
  return cand[k];
}

/* Nhịp phát chuyển động = tốc độ người ÷ (tốc độ tự nhiên của đoạn × tỉ lệ người), kẹp [rateMin, rateMax] (spec §4.5). natural = 0 (đứng) → 1 */
export function crowdRate(speed: number, natural: number, scale: number): number {
  const C = CONFIG.people.crowd;
  if (!(natural > 0)) return 1;
  return Math.min(C.rateMax, Math.max(C.rateMin, speed / (natural * scale)));
}

/* Khung (số thực) trong [0, frames) tại thời điểm t (s); phase: pha chu kỳ, rad (Walker.phase). Bản CPU của công thức trong shader (VS_SKIN) */
export function crowdFrame(t: number, clip: CrowdClip, rate: number, phase: number): number {
  const N = clip.frames;
  if (!clip.loop) return N - 1;
  const fr = clip.fps * rate, T = N / fr, ph = crPhase(phase, N);
  const f = ((t % T) * fr + ph) % N;
  return f < 0 ? f + N : f;
}
const crPhase = (phase: number, N: number) => ((((phase / (2 * Math.PI)) % 1) + 1) % 1) * N;   // rad → khung, [0, N)
export const crClip = (w: Walker): CrowdClipName => (w.kind === 'run' ? 'jog' : w.kind === 'stand' ? ((w.flags ?? 0) & PP_FLAG.photo ? 'photo' : 'idle') : 'walk');

/* ---------- shader ---------- */
const VS_PARS = /* glsl */`#include <batching_pars_vertex>
uniform highp sampler2D uCrowdAnim;
uniform highp sampler2D uCrowdPeople;
uniform float uTime;
attribute vec2 aBones;
attribute float aW;
vec4 crRow( int c, int f0, int f1, float t ) { return mix( texelFetch( uCrowdAnim, ivec2( c, f0 ), 0 ), texelFetch( uCrowdAnim, ivec2( c, f1 ), 0 ), t ); }
`;
// thay beginnormal_vertex: tính 3 hàng ma trận skin (crR0..2) một lần, dùng lại ở begin_vertex
const VS_SKIN = /* glsl */`
vec4 crR0 = vec4( 1.0, 0.0, 0.0, 0.0 ), crR1 = vec4( 0.0, 1.0, 0.0, 0.0 ), crR2 = vec4( 0.0, 0.0, 1.0, 0.0 );
#if defined( USE_BATCHING ) && defined( USE_BATCHING_COLOR )
{
  int crCs = textureSize( batchingColorTexture, 0 ).x, crId = int( batchId );
  int crG = int( texelFetch( batchingColorTexture, ivec2( crId % crCs, crId / crCs ), 0 ).a + 0.5 );   // chỉ số người trong uCrowdPeople
  int crPw = textureSize( uCrowdPeople, 0 ).x;
  vec4 crP = texelFetch( uCrowdPeople, ivec2( crG % crPw, crG / crPw ), 0 );   // x hàng đầu đoạn, y ±số khung (âm: giữ khung cuối), z khung/giây, w pha (khung)
  int crN = int( abs( crP.y ) + 0.5 ), f0 = crN - 1, f1 = crN - 1; float ft = 0.0;
  if ( crP.y > 0.0 ) {
    float crF = mod( mod( uTime, crP.y / crP.z ) * crP.z + crP.w, crP.y );   // mod theo chu kỳ trước: uTime lớn không làm mất chính xác pha
    f0 = min( int( crF ), crN - 1 ); f1 = f0 + 1 >= crN ? 0 : f0 + 1; ft = fract( crF );
  }
  int crRw = int( crP.x + 0.5 ); f0 += crRw; f1 += crRw;
  int b0 = int( aBones.x + 0.5 ) * 3, b1 = int( aBones.y + 0.5 ) * 3; float w1 = 1.0 - aW;
  crR0 = crRow( b0, f0, f1, ft ) * aW + crRow( b1, f0, f1, ft ) * w1;
  crR1 = crRow( b0 + 1, f0, f1, ft ) * aW + crRow( b1 + 1, f0, f1, ft ) * w1;
  crR2 = crRow( b0 + 2, f0, f1, ft ) * aW + crRow( b1 + 2, f0, f1, ft ) * w1;
}
#endif
vec3 objectNormal = vec3( dot( crR0.xyz, normal ), dot( crR1.xyz, normal ), dot( crR2.xyz, normal ) );
#ifdef USE_TANGENT
vec3 objectTangent = vec3( tangent.xyz );
#endif
`;
const VS_POS = /* glsl */`vec4 crPos = vec4( position, 1.0 );
vec3 transformed = vec3( dot( crR0, crPos ), dot( crR1, crPos ), dot( crR2, crPos ) );
#ifdef USE_ALPHAHASH
vPosition = vec3( position );
#endif
`;

type CrowdState = { people: THREE.DataTexture; next: number };
const mats = new WeakMap<CrowdData, THREE.MeshStandardMaterial>();
/* Một vật liệu dùng chung cho 3 hệ (theo bộ dữ liệu). Texture trong uniform (uCrowdAnim, uCrowdPeople) không được prewarm tải trước:
   bên dựng gọi renderer.initTexture (people.ts) */
export function crowdMaterial(data: CrowdData): THREE.MeshStandardMaterial {
  const old = mats.get(data); if (old) return old;
  const m = new THREE.MeshStandardMaterial({ map: data.atlas, roughness: CONFIG.people.roughness, metalness: 0 });
  m.name = 'peopleCrowd';
  const people = new THREE.DataTexture(new Float32Array(PEOPLE_W * PEOPLE_H * 4), PEOPLE_W, PEOPLE_H, THREE.RGBAFormat, THREE.FloatType);
  people.minFilter = people.magFilter = THREE.NearestFilter; people.generateMipmaps = false; people.name = 'peopleCrowdParams'; people.needsUpdate = true;
  const state: CrowdState = { people, next: 0 };
  m.userData.crowd = state;
  m.onBeforeCompile = (s) => {
    s.uniforms.uTime = shared.uTime; s.uniforms.uCrowdAnim = { value: data.anim }; s.uniforms.uCrowdPeople = { value: people };
    s.vertexShader = s.vertexShader.replace('#include <batching_pars_vertex>', VS_PARS).replace('#include <beginnormal_vertex>', VS_SKIN).replace('#include <begin_vertex>', VS_POS);
    m.userData.vs = s.vertexShader;
  };
  m.customProgramCacheKey = () => 'peopleCrowd';
  mats.set(data, m);
  return m;
}
/* Texture thông số theo người của vật liệu (cho renderer.initTexture) */
export const crowdParams = (m: THREE.Material): THREE.DataTexture => (m.userData.crowd as CrowdState).people;

/* Thông tin theo id (móc kiểm thử, stepPeople): nhân vật, có nón, tỉ lệ người (m/m so với lưới), tổng tam giác */
export interface CrowdInfo { char: Int16Array; hat: Uint8Array; scale: Float32Array; tris: number }

/* Dựng một hệ: một id mỗi người theo thứ tự list. Tỉ lệ người lớn = heightScale × Walker.scale; trẻ em (Walker.scale = childScale) = heightScale
   (nhân vật trẻ em đã thấp sẵn, spec §4.10). Cờ nón + nhân vật có bản nón → lưới hat. Không gọi rnd() / rand() / rng */
export function crowdBuild(data: CrowdData, list: Walker[], system: string): THREE.BatchedMesh {
  const P = CONFIG.people, C = P.crowd, mat = crowdMaterial(data), st = mat.userData.crowd as CrowdState, n = list.length;
  if (st.next + n > PEOPLE_W * PEOPLE_H) throw new Error('crowd: hết chỗ trong texture thông số người');
  const char = new Int16Array(n), hat = new Uint8Array(n), scale = new Float32Array(n), geos: THREE.BufferGeometry[] = [];
  let nv = 0, ni = 0;
  list.forEach((w, i) => {
    const child = w.scale === P.childScale, lead = w.follow ?? -1;
    char[i] = crowdPick(data.chars, system, i, child, lead >= 0 && lead < i ? char[lead] : -1);
    const ch = data.chars[char[i]], useHat = !!((w.flags ?? 0) & PP_FLAG.hat) && !!ch.hat, src = useHat ? ch.hat : ch.geometry;
    hat[i] = useHat ? 1 : 0;
    scale[i] = C.heightScale * (child ? 1 : (w.scale ?? 1));
    // vỏ dùng chung attribute của lưới nguồn (addGeometry chép dữ liệu), chỉ khác khối cầu bao đã nới
    const g = new THREE.BufferGeometry();
    for (const k of Object.keys(src.attributes)) g.setAttribute(k, src.attributes[k]);
    g.setIndex(src.index); g.boundingBox = src.boundingBox;
    g.boundingSphere = src.boundingSphere.clone(); g.boundingSphere.radius += C.cullPad / scale[i];
    geos.push(g); nv += src.getAttribute('position').count; ni += src.index.count;
  });
  const mesh = new THREE.BatchedMesh(n, nv, ni, mat), col = new THREE.Color(), pd = st.people.image.data as unknown as Float32Array, base = st.next, sysH = crHashStr(system) ^ 0x5bd1e995;
  st.next += n;
  geos.forEach((g, i) => {
    const id = mesh.addGeometry(g), w = list[i], name = crClip(w), clip = data.chars[char[i]].clips[name];
    mesh.setColorAt(id, col.setScalar(C.tint[0] + (C.tint[1] - C.tint[0]) * crHash(sysH, i)));   // hệ số sáng theo người (spec §4.11); bắt buộc cho mọi id
    const rate = name === 'walk' || name === 'jog' ? crowdRate(w.speed, clip.speed, scale[i]) : 1;
    pd.set([clip.row, clip.loop ? clip.frames : -clip.frames, clip.fps * rate, crPhase(w.phase ?? 0, clip.frames)], (base + id) * 4);
  });
  const colors = (mesh as unknown as { _colorsTexture: THREE.DataTexture })._colorsTexture, cd = colors.image.data as unknown as Float32Array;
  for (let i = 0; i < n; i++) cd[i * 4 + 3] = base + i;   // kênh alpha: chỉ số người trong uCrowdPeople
  colors.needsUpdate = true; st.people.needsUpdate = true;
  mesh.sortObjects = false; mesh.perObjectFrustumCulled = true; mesh.frustumCulled = false;   // bao cầu cả đối tượng không tự cập nhật: bên gọi đặt nếu cần (Cầu Rồng)
  mesh.castShadow = mesh.receiveShadow = false;
  mesh.userData.crowd = { char, hat, scale, tris: ni / 3 } satisfies CrowdInfo;
  return mesh;
}
