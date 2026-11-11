/* ===== Đi dạo: nạp mô hình người có xương (public/people/p<k>.glb) và một nhân vật đang diễn =====
   - stRigLoad(k): import() động GLTFLoader + SkeletonUtils (chunk riêng, trang thường không tải), nạp p<k>.glb một lần, nhớ đệm theo k.
     Lỗi bất kỳ (mạng, file hỏng, thiếu đoạn) → console.warn một lần cho mô hình đó, trả null, không thử lại trong phiên; promise không bao giờ bị từ chối.
   - stRigSource: chuẩn hóa cảnh đã nạp: lớp 1 (không vào phản chiếu nước), không đổ / nhận bóng, tắt frustumCulled (hộp bao theo tư thế gốc sai khi diễn),
     vật liệu metalness 0, roughness 0.85; mảnh alpha (alphaMode MASK) giữ alphaTest, không trộn trong suốt. Tốc độ tự nhiên từng đoạn đọc từ extras.speed.
   - Làm nóng: sau khi nạp, stRigLoad chờ hàm do stRigSetWarm gắn (compileAsync theo cảnh chính, ≤ anim.warmMs) rồi mới trả nguồn (D-018).
   - StRig: một bản sao (SkeletonUtils.clone, dùng chung geometry / texture / vật liệu với nguồn) + AnimationMixer riêng.
     pose(): trọng số đích từ stClipMix (anim.ts), làm mượt về đích với hằng thời gian anim.fade; walk / jog / sprint đồng pha bằng một pha chung 0–1
     (đặt action.time = pha × thời lượng đoạn, timeScale 0 để mixer không tự tua); photo LoopOnce + clampWhenFinished, phát lại từ đầu mỗi lần chuyển sang dáng chụp ảnh.
     dt kẹp [0, stroll.dtMax] (tab ẩn rồi quay lại không làm nhảy pha). Không cấp phát mỗi khung (D-018).
   - Mô hình: mét, chân ở y = 0, mặt hướng +X (như hình khối), xương Rocketbox (Bip01_*). docs/superpowers/specs/2026-11-12-nguoi-di-dao-that-design.md §5, §7 */
import * as THREE from 'three';
import { CONFIG } from '../../config';
import { ST_CLIPS, stClipMix, type StClipMix } from './anim';

const A = CONFIG.stroll.anim, NC = ST_CLIPS.length;
const ST_LOCO0 = 1, ST_LOCO1 = 3, ST_PHOTO = 4;   // chỉ số trong ST_CLIPS: walk..sprint, photo (idle = 0)

export interface StRigSource {
  scene: THREE.Object3D;                                   // cảnh gốc (không thêm vào scene; chỉ để sao chép)
  clips: THREE.AnimationClip[];                            // 5 đoạn theo thứ tự ST_CLIPS
  natural: Float32Array;                                   // tốc độ tự nhiên từng đoạn theo ST_CLIPS, m/s (idle / photo = 0)
  height: number;                                          // chiều cao tư thế đứng, m (0 nếu file không ghi)
  clone: (o: THREE.Object3D) => THREE.Object3D;            // SkeletonUtils.clone (test truyền bản giả)
}

/* Chuẩn hóa cảnh + đoạn đã nạp thành nguồn dùng chung. speeds: tên đoạn → m/s. Thiếu đoạn nào thì ném lỗi (stRigLoad bắt, trả null) */
export function stRigSource(scene: THREE.Object3D, clips: THREE.AnimationClip[], speeds: Record<string, number>, height: number, clone: (o: THREE.Object3D) => THREE.Object3D): StRigSource {
  const out: THREE.AnimationClip[] = [], natural = new Float32Array(NC);
  for (let i = 0; i < NC; i++) {
    const c = clips.find(x => x.name === ST_CLIPS[i]);
    if (!c) throw new Error(`thiếu đoạn ${ST_CLIPS[i]}`);
    out.push(c);
    natural[i] = Math.max(0, Number(speeds[ST_CLIPS[i]]) || 0);
  }
  scene.traverse((o) => {
    o.layers.set(1);
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = false; m.receiveShadow = false; m.frustumCulled = false;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) {
      const s = mat as THREE.MeshStandardMaterial;
      if (s.isMeshStandardMaterial) { s.metalness = 0; s.roughness = 0.85; }
      if (s.alphaTest > 0) s.transparent = false;   // MASK: cắt theo alphaTest, không trộn trong suốt (không cần sắp thứ tự)
    }
  });
  return { scene, clips: out, natural, height: height > 0 ? height : 0, clone };
}

const cache = new Map<number, Promise<StRigSource | null>>();

/* Làm nóng shader (D-018): stroll/index.ts gắn hàm biên dịch sẵn chương trình của cảnh nguồn theo đèn / sương / bóng của cảnh chính
   (rig.ts không import renderer để chạy được trong unit test). Chưa gắn, lỗi hoặc quá anim.warmMs: bỏ qua, nguồn vẫn dùng được */
let warm: ((o: THREE.Object3D) => Promise<unknown>) | null = null;
export function stRigSetWarm(fn: ((o: THREE.Object3D) => Promise<unknown>) | null): void { warm = fn; }
async function stRigWarm(o: THREE.Object3D): Promise<void> {
  if (!warm) return;
  let timer = 0;
  try { await Promise.race([warm(o), new Promise<void>((r) => { timer = setTimeout(r, A.warmMs) as unknown as number; })]); }
  catch { /* biên dịch trước lỗi: lần vẽ đầu tự biên dịch như cũ */ }
  finally { clearTimeout(timer); }
}

/* Nạp mô hình k (nhớ đệm). Không bao giờ ném / từ chối: lỗi → warn một lần, null */
export function stRigLoad(model: number): Promise<StRigSource | null> {
  let p = cache.get(model);
  if (p) return p;
  p = (async () => {
    try {
      const path = A.models[model];
      if (!path) throw new Error('không có mô hình số này');
      const [{ GLTFLoader }, SU] = await Promise.all([import('three/addons/loaders/GLTFLoader.js'), import('three/addons/utils/SkeletonUtils.js')]);
      const gltf = await new GLTFLoader().loadAsync(import.meta.env.BASE_URL + path);
      const speeds: Record<string, number> = {};
      const json = gltf.parser.json as { animations?: { name?: string; extras?: { speed?: number } }[] };   // AnimationClip không giữ extras: đọc từ JSON gốc
      for (const a of json.animations || []) if (a.name) speeds[a.name] = Number(a.extras?.speed) || 0;
      const src = stRigSource(gltf.scene, gltf.animations, speeds, Number(gltf.scene.userData?.height) || 0, SU.clone);
      await stRigWarm(src.scene);   // nguồn chỉ "sẵn sàng" sau khi shader skinning đã biên dịch: lần hiện đầu không khựng
      return src;
    } catch (e) {
      console.warn(`Đi dạo: không nạp được mô hình người ${model}, dùng hình khối`, e);
      return null;
    }
  })();
  cache.set(model, p);
  return p;
}

/* Một nhân vật đang diễn: bản sao của nguồn + mixer riêng */
export class StRig {
  readonly root: THREE.Object3D;
  readonly src: StRigSource;
  readonly mixer: THREE.AnimationMixer;
  readonly actions: THREE.AnimationAction[] = [];
  readonly w = new Float32Array(NC);    // trọng số đang dùng (đã làm mượt), tổng = 1
  rate = 1;                             // hệ số tua đoạn di chuyển đang dùng
  phase = 0;                            // pha chung 0–1 của walk / jog / sprint
  private readonly mix: StClipMix = { w: new Float32Array(NC), rate: 1, loco: false };
  private fresh = true;                 // lần pose đầu: đặt thẳng trọng số đích, không làm mượt
  private photo = false;                // khung trước đang ở dáng chụp ảnh

  constructor(src: StRigSource) {
    this.src = src;
    this.root = src.clone(src.scene);
    this.root.name = 'stroll-rig';
    this.mixer = new THREE.AnimationMixer(this.root);
    for (let i = 0; i < NC; i++) {
      const a = this.mixer.clipAction(src.clips[i]);
      if (i === ST_PHOTO) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
      if (i >= ST_LOCO0 && i <= ST_LOCO1) a.timeScale = 0;   // thời gian do pha chung đặt
      a.enabled = false; a.setEffectiveWeight(0); a.play();
      this.actions.push(a);
    }
  }

  /* Mỗi khung: dáng + tốc độ mặt bằng (m/s) + dt (s) → trọng số, pha, mixer.update */
  pose(pose: number, speed: number, dt: number): void {
    const d = dt > 0 ? (dt < CONFIG.stroll.dtMax ? dt : CONFIG.stroll.dtMax) : 0;   // NaN / âm → 0
    const mix = this.mix, w = this.w, acts = this.actions, clips = this.src.clips;
    stClipMix(pose, speed, this.src.natural, mix);
    const toPhoto = mix.w[ST_PHOTO] === 1;
    if (toPhoto && !this.photo) acts[ST_PHOTO].reset();   // chuyển sang chụp ảnh: giơ máy lại từ đầu
    this.photo = toPhoto;
    const k = this.fresh || !(A.fade > 0) ? 1 : 1 - Math.exp(-d / A.fade);   // fade ≤ 0: chuyển tức thì (tránh 0/0 = NaN khi d = 0)
    this.fresh = false;
    for (let i = 0; i < NC; i++) w[i] += (mix.w[i] - w[i]) * k;
    if (mix.loco) this.rate = mix.rate;   // đang rời nhóm di chuyển: giữ nhịp cũ trong lúc mờ dần
    let lw = 0, dur = 0;
    for (let i = ST_LOCO0; i <= ST_LOCO1; i++) { lw += w[i]; dur += w[i] * clips[i].duration; }
    if (lw > 1e-4 && dur > 1e-6) {
      const p = this.phase + d * this.rate / (dur / lw);   // chu kỳ của hỗn hợp = trung bình thời lượng theo trọng số
      this.phase = p - Math.floor(p);
    }
    for (let i = 0; i < NC; i++) {
      const a = acts[i], on = w[i] > 1e-4;
      if (i >= ST_LOCO0 && i <= ST_LOCO1) a.time = this.phase * clips[i].duration;
      if (on !== a.enabled) a.enabled = on;   // đoạn không trọng số: mixer bỏ qua, không tính
      a.setEffectiveWeight(on ? w[i] : 0);
    }
    this.mixer.update(d);
  }

  /* Đặt lại như vừa tạo: lần pose kế đặt thẳng trọng số đích */
  reset(): void { this.fresh = true; this.photo = false; this.phase = 0; this.w.fill(0); }

  /* Gỡ khỏi nhóm, bỏ mixer, giải phóng skeleton riêng của bản sao (SkeletonUtils.clone tạo skeleton mới cho mỗi SkinnedMesh; renderer cấp boneTexture cho từng cái).
     geometry / texture / vật liệu thuộc nguồn dùng chung nên không dispose */
  dispose(): void {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
    this.root.removeFromParent();
    const seen = new Set<THREE.Skeleton>();
    this.root.traverse((o) => {
      const sk = (o as THREE.SkinnedMesh).isSkinnedMesh ? (o as THREE.SkinnedMesh).skeleton : null;
      if (sk && !seen.has(sk)) { seen.add(sk); sk.dispose(); }
    });
  }
}
