/* ===== Dữ liệu đám đông người thật (D-032): đọc public/people/crowd.bin + crowd.jpg ===== */
/* Spec: docs/superpowers/specs/2026-11-12-dam-dong-nguoi-that-design.md §4; sinh bằng npm run gen:crowd (scripts/people/crowd.py).
   10 nhân vật Rocketbox (MIT) giản lược ≤ 1 600 tam giác, 22 xương, 2 xương mỗi đỉnh; chuyển động nướng thành ma trận xương.
   Hệ toạ độ của lưới: mét, +Y lên, mặt hướng +X, chân y = 0, tư thế nghỉ chữ T / chữ A (cần skin mới ra dáng đi).

   Định dạng crowd.bin (little-endian), phiên bản 1:
     0   4 byte  'DNCR'
     4   u32     phiên bản (1)
     8   u32     J = số byte phần JSON (đệm dấu cách tới bội 4)
     12  J byte  JSON utf-8: { bones, boneNames, anim: { width, height, offset, bytes }, source,
                 chars: [{ id, child, female, height, verts, tris, hatVerts, hatTris, pos, nrm, uv, bones, w, idx,
                           clips: { walk|jog|idle|photo: { row, frames, fps, loop, speed } } }] }
                 pos … idx là offset byte (tính từ đầu khối nhị phân) của từng mảng.
     12+J        khối nhị phân, mỗi mảng bắt đầu ở bội 4:
                 pos f32 ×3, nrm f32 ×3, uv f32 ×2, bones u8 ×2, w f32 ×1, idx u16 ×3 mỗi tam giác.
                 Đỉnh 0..verts−1 và tam giác 0..tris−1 là người; hatVerts / hatTris nối tiếp là nón lá (index trỏ vào mảng
                 đỉnh chung, gắn cứng xương đầu: bones = [đầu, đầu], w = 1). Bản đội nón = toàn bộ mảng.
                 anim: u16 (half-float) RGBA, width = bones × 3 texel, mỗi hàng một khung; texel (b × 3 + j) = hàng j của
                 ma trận 3×4 xương b, đưa đỉnh từ tư thế nghỉ sang tư thế khung (cùng hệ toạ độ lưới):
                   p' = Σ_k w_k · (dot(T[b_k·3], p1), dot(T[b_k·3+1], p1), dot(T[b_k·3+2], p1)), p1 = (p, 1); pháp tuyến dùng .xyz.
   uv: toạ độ trong atlas crowd.jpg với v = 0 ở mép TRÊN của ảnh (texture.flipY = false, ImageBitmap không lật).
   Đoạn: walk / idle / photo 15 khung/giây, jog 30; loop = false (photo) thì giữ khung cuối. speed: m/s tự nhiên ở tỉ lệ 1
   khi phát đúng fps (0 với idle, photo). Trẻ em: không có bản nón (hat = null). */
import * as THREE from 'three';
import { CONFIG } from '../../config';

export type CrowdClipName = 'walk' | 'jog' | 'idle' | 'photo';
export interface CrowdClip { row: number; frames: number; fps: number; loop: boolean; speed: number }   // row: hàng đầu của đoạn trong texture chuyển động; speed: m/s tự nhiên ở tỉ lệ 1 (0 với idle, photo)
export interface CrowdChar {
  id: string;            // tên Rocketbox
  child: boolean; female: boolean;
  height: number;        // m, ở tỉ lệ 1
  geometry: THREE.BufferGeometry;           // position (Float32 ×3), normal (×3), uv (×2, toạ độ trong atlas), aBones (Uint8 ×2), aW (Float32 ×1: trọng số xương thứ nhất), có index
  hat: THREE.BufferGeometry | null;         // cùng bộ attribute, thêm nón lá; null với trẻ em
  clips: Record<CrowdClipName, CrowdClip>;
}
export interface CrowdParsed { chars: CrowdChar[]; bones: number; animWidth: number; animHeight: number; animData: Uint16Array; maxVerts: number; maxIndices: number }   // animData: RGBA half-float, mỗi hàng một khung, 3 texel mỗi xương
export interface CrowdData extends CrowdParsed { anim: THREE.DataTexture; atlas: THREE.Texture }

const MAGIC = 'DNCR', VERSION = 1;
const CLIP_NAMES: CrowdClipName[] = ['walk', 'jog', 'idle', 'photo'];

/* ===== Đọc tệp (thuần: không DOM, không fetch; chạy được trong node) ===== */
export function crowdParse(buf: ArrayBuffer): CrowdParsed {
  if (buf.byteLength < 12) throw new Error('crowd.bin: tệp quá ngắn');
  const head = new Uint8Array(buf, 0, 4), dv = new DataView(buf);
  if (String.fromCharCode(...head) !== MAGIC) throw new Error('crowd.bin: sai magic');
  const ver = dv.getUint32(4, true); if (ver !== VERSION) throw new Error(`crowd.bin: phiên bản ${ver} (cần ${VERSION})`);
  const J = dv.getUint32(8, true); if (12 + J > buf.byteLength || J % 4) throw new Error('crowd.bin: phần JSON hỏng');
  const meta = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 12, J)));
  const base = 12 + J;
  const view = <T>(C: { new (b: ArrayBuffer, o: number, n: number): T; BYTES_PER_ELEMENT: number }, off: number, n: number): T => {
    if (off % C.BYTES_PER_ELEMENT || base + off + n * C.BYTES_PER_ELEMENT > buf.byteLength) throw new Error('crowd.bin: mảng vượt tệp');
    return new C(buf, base + off, n);
  };
  const bones: number = meta.bones;
  let maxVerts = 0, maxIndices = 0;
  const chars: CrowdChar[] = meta.chars.map((c) => {
    const nv = c.verts + c.hatVerts, ni = (c.tris + c.hatTris) * 3;
    const pos = view(Float32Array, c.pos, nv * 3), nrm = view(Float32Array, c.nrm, nv * 3), uv = view(Float32Array, c.uv, nv * 2);
    const bi = view(Uint8Array, c.bones, nv * 2), w = view(Float32Array, c.w, nv), idx = view(Uint16Array, c.idx, ni);
    const geo = (v: number, i: number): THREE.BufferGeometry => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, v * 3), 3));
      g.setAttribute('normal', new THREE.BufferAttribute(nrm.subarray(0, v * 3), 3));
      g.setAttribute('uv', new THREE.BufferAttribute(uv.subarray(0, v * 2), 2));
      g.setAttribute('aBones', new THREE.BufferAttribute(bi.subarray(0, v * 2), 2));
      g.setAttribute('aW', new THREE.BufferAttribute(w.subarray(0, v), 1));
      g.setIndex(new THREE.BufferAttribute(idx.subarray(0, i), 1));
      g.computeBoundingBox(); g.computeBoundingSphere();
      maxVerts = Math.max(maxVerts, v); maxIndices = Math.max(maxIndices, i);
      return g;
    };
    const clips = {} as Record<CrowdClipName, CrowdClip>;
    for (const n of CLIP_NAMES) {
      const k = c.clips?.[n]; if (!k) throw new Error(`crowd.bin: ${c.id} thiếu đoạn ${n}`);
      clips[n] = { row: k.row, frames: k.frames, fps: k.fps, loop: !!k.loop, speed: k.speed };
    }
    return { id: c.id, child: !!c.child, female: !!c.female, height: c.height, geometry: geo(c.verts, c.tris * 3), hat: c.hatVerts > 0 ? geo(nv, ni) : null, clips };
  });
  const a = meta.anim;
  if (a.width !== bones * 3 || a.bytes !== a.width * a.height * 8) throw new Error('crowd.bin: kích thước texture chuyển động sai');
  const animData = view(Uint16Array, a.offset, a.width * a.height * 4);
  return { chars, bones, animWidth: a.width, animHeight: a.height, animData, maxVerts, maxIndices };
}

/* ===== Tải trong trình duyệt ===== */
let loaded: CrowdData | null = null;
let pending: Promise<CrowdData | null> | null = null;

// Kết quả của lần crowdLoad đã xong (null nếu chưa xong, lỗi, hoặc ?crowd=off)
export function crowdGet(): CrowdData | null { return loaded; }

// Tải bin + jpg theo BASE_URL, tối đa CONFIG.people.crowd.loadTimeoutMs; lỗi bất kỳ → console.warn một lần, trả null.
// ?crowd=off → null ngay, không gửi yêu cầu nào. Gọi nhiều lần dùng chung một lượt tải.
export function crowdLoad(): Promise<CrowdData | null> {
  if (pending) return pending;
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('crowd') === 'off') return (pending = Promise.resolve(null));
  pending = (async () => {
    const C = CONFIG.people.crowd, ctl = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, rej) => { timer = setTimeout(() => { ctl.abort(); rej(new Error(`quá ${C.loadTimeoutMs} ms`)); }, C.loadTimeoutMs); });
    const work = (async (): Promise<CrowdData> => {
      const base = import.meta.env.BASE_URL;
      const [rb, ri] = await Promise.all([fetch(base + C.bin, { signal: ctl.signal }), fetch(base + C.atlas, { signal: ctl.signal })]);
      if (!rb.ok || !ri.ok) throw new Error(`HTTP ${rb.status} / ${ri.status}`);
      const [buf, blob] = await Promise.all([rb.arrayBuffer(), ri.blob()]);
      const parsed = crowdParse(buf);
      const bmp = await createImageBitmap(blob);
      const atlas = new THREE.Texture(bmp);
      atlas.flipY = false; atlas.colorSpace = THREE.SRGBColorSpace; atlas.name = 'peopleCrowdAtlas'; atlas.needsUpdate = true;
      const anim = new THREE.DataTexture(parsed.animData as Uint16Array<ArrayBuffer>, parsed.animWidth, parsed.animHeight, THREE.RGBAFormat, THREE.HalfFloatType);
      anim.minFilter = anim.magFilter = THREE.NearestFilter; anim.generateMipmaps = false; anim.name = 'peopleCrowdAnim'; anim.needsUpdate = true;
      return { ...parsed, anim, atlas };
    })();
    work.catch(() => {}); timeout.catch(() => {});
    try {
      loaded = await Promise.race([work, timeout]);
    } catch (e) {
      console.warn('[people] không dùng được đám đông người thật, dùng hình khối:', e instanceof Error ? e.message : e);
      loaded = null;
    } finally { clearTimeout(timer); }
    return loaded;
  })();
  return pending;
}
