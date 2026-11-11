import * as THREE from 'three';
import { CONFIG } from '../config';
import { renderer, scene, camera } from './renderer';
import { composer } from './postprocessing';
import { water } from './water';
import { LIGHT_SETS, LightSet, applyLightSet, stepLights, pointLights, lightState } from './lights';

/* =====================================================================
   BIÊN DỊCH TRƯỚC (D-018) — chạy một lần lúc màn hình chờ còn hiện, trước khung hình đầu.
   Nếu không, three biên dịch shader của một vật liệu lần đầu nó được vẽ (đồng bộ trên luồng chính) ⇒ giật khi:
   chuyển đêm lần đầu (composer vẽ vào render target ⇒ biến thể không tone mapping), bay tới công trình có `details` đang ẩn, mặt cắt Hầm…
   - renderer.compile() duyệt MỌI object (kể cả đang ẩn), nên không cần bật tạm `visible`.
   - Hai biến thể: vẽ thẳng ra canvas (ban ngày) và vào render target (composer ban đêm; cũng trùng biến thể phản chiếu mặt nước).
   - Upload sẵn mọi texture (atlas quảng cáo 2048², địa chất 4096×636…) để lần hiện đầu không phải tải lên GPU.
   - Vẽ composer một lần: biên dịch các pass bloom / output.
   - Bộ đèn (D-031, core/lights.ts: day / night / full): số đèn nằm trong program key nên mỗi bộ là một program khác của cùng vật liệu. Theo device.lightSets:
     · 'off' / 'bg': trước khung đầu chỉ bộ 'full', đúng như trước D-031 (số program, thời gian màn hình chờ không đổi); 'bg' hâm 'day' rồi 'night' sau khung đầu (warmLightSets).
     · 'sync' (test:perf): lặp cả ba bộ (biên dịch + vẽ thật), sẵn sàng ngay. Bản đầu D-031 dùng cách này cho mọi người: 174 → 490 program, màn hình chờ Intel Arc 10–16 s → 26–36 s.
     Lượt "mọi object hiện" không bật visible của đèn / nhóm pointLights: bộ đang xét quyết định đèn nào hiện. Xong thì về bộ ứng với trạng thái thật (stepLights).
   Biến thể vẽ bóng (MeshDepthMaterial) vẫn biên dịch lười khi vật đổ bóng vào khung bóng lần đầu (ít program, rẻ).
   ===================================================================== */
const wait = (ms: number) => new Promise<void>((ok) => setTimeout(ok, ms));

/* Vẽ thật một lần với MỌI object tạm hiện (trừ đèn), không cắt theo khung nhìn, mọi level LOD, InstancedMesh rỗng có 1 instance:
   upload hình học lên GPU, biên dịch biến thể vẽ bóng (MeshDepthMaterial) và phần trình điều khiển biên dịch lười lúc vẽ lần đầu
   (đo GĐ1: không còn program mới nhưng lần đầu bay tới Thuận Phước / Hầm / Vòng quay vẫn khựng 3–5 s trên SwiftShader). Trả nguyên trạng ngay sau đó.
   Đèn và nhóm pointLights giữ nguyên visible: bộ đèn đang xét quyết định đèn nào hiện. */
function drawAll() {
  const saved: [THREE.Object3D, boolean, boolean][] = [], counts: [THREE.InstancedMesh, number][] = [], lods: THREE.LOD[] = [];
  scene.traverse((o) => {
    if ((o as THREE.Light).isLight || o === pointLights) return;
    saved.push([o, o.visible, o.frustumCulled]); o.visible = true; o.frustumCulled = false;
    const im = o as THREE.InstancedMesh; if (im.isInstancedMesh && im.count === 0) { counts.push([im, 0]); im.count = 1; }
    const lod = o as THREE.LOD; if (lod.isLOD && lod.autoUpdate) { lods.push(lod); lod.autoUpdate = false; }
  });
  renderer.render(scene, camera);
  composer.render(0);
  for (const [o, v, f] of saved) { o.visible = v; o.frustumCulled = f; }
  for (const [im, n] of counts) im.count = n;
  for (const lod of lods) lod.autoUpdate = true;
}

export async function prewarm() {
  // Font chữ Việt: atlas quảng cáo vẽ lại khi font nạp xong — chờ trước để chỉ upload một lần (tối đa 3 s nếu không có mạng)
  if (document.fonts?.ready) await Promise.race([document.fonts.ready, wait(3000)]);
  const rt = renderer.getRenderTarget();
  const seen = new Set<THREE.Texture>();
  scene.traverse((o) => {
    const m = (o as THREE.Mesh).material;
    if (!m) return;
    for (const mat of Array.isArray(m) ? m : [m]) for (const v of Object.values(mat)) if ((v as THREE.Texture)?.isTexture && !seen.has(v as THREE.Texture)) { seen.add(v as THREE.Texture); renderer.initTexture(v as THREE.Texture); }
  });
  const sync = lightState.mode === 'sync';
  for (const set of sync ? LIGHT_SETS : ['full' as LightSet]) {
    applyLightSet(set);   // đèn ẩn không vào trạng thái đèn của compile / render (three gom đèn bằng traverseVisible)
    renderer.setRenderTarget(null);
    const canvasPass = renderer.compileAsync(scene, camera);
    renderer.setRenderTarget(rt);
    await canvasPass;
    renderer.setRenderTarget(composer.readBuffer);
    const rtPass = renderer.compileAsync(scene, camera);
    renderer.setRenderTarget(rt);
    await rtPass;
    drawAll();
    // three vẽ shadow map TRƯỚC khi cập nhật trạng thái đèn của khung (WebGLRenderer.render: shadowMap.render rồi mới setupLights)
    // ⇒ khung đầu có sun sau một khung night, lượt bóng mang trạng thái đèn night trong program key của MeshDepthMaterial (đo: +5 program).
    // Vẽ thêm một lần bộ day ngay sau night (không compile xen giữa, vì compile cũng đặt lại trạng thái đèn) để biên dịch sẵn các biến thể đó.
    if (set === 'night') { applyLightSet('day'); drawAll(); }
  }
  if (sync) lightState.ready.day = lightState.ready.night = true;
  stepLights();   // về bộ ứng với cường độ đèn thật (applyNight đã chạy trước prewarm)
  composer.render(0);   // một lần nữa với trạng thái thật (bloom/output pass đã biên dịch ở lần trên)
}

/* =====================================================================
   BIÊN DỊCH NỀN HAI BỘ ĐÈN (D-031, chế độ 'bg') — gọi mỗi khung từ animate() ngay trước lượt vẽ thật; hâm xong thì trả về ngay (không cấp phát).
   - Cần KHR_parallel_shader_compile: trình duyệt biên dịch / link ngoài luồng chính, ta chỉ trả phần đồng bộ (tạo mã shader, gửi lệnh).
     Không có ⇒ mode 'off', ở 'full' mãi (program chưa xong sẽ chặn luồng chính lúc dùng lần đầu: không đáng).
   - Pha 0 (biên dịch): mỗi khung, trong ngân sách CONFIG.perf.lightWarmMs và khi còn ít hơn CONFIG.perf.lightWarmPrograms program đang dịch dở:
     renderer.compile() từng nhóm CHUNK object, hai biến thể canvas / render target như prewarm. Đo Intel Arc (ANGLE D3D11): "song song" chỉ một phần —
     để 2–4 program mới mỗi khung dồn lại thì tiến trình GPU chặn khung 100–600 ms; giữ ≤ 2 đang dịch thì khung dài nhất ≈ 0,1–0,2 s, đổi lại chậm (≈ 20–30 s mỗi bộ).
   - Không đụng tới đèn thật: compile vào một Scene giả (warm.scene) cùng fog / environment, traverseVisible chỉ trả đèn của bộ đang hâm
     (danh sách lấy một lần lúc bắt đầu bằng applyLightSet tạm rồi trả lại ngay trong cùng lời gọi). three giữ trạng thái đèn theo scene
     (renderStates.get(scene)) nên trạng thái đèn của cảnh thật — kể cả cái lượt bóng khung sau còn đọc lại — không đổi.
   - compile() đặt currentProgram của vật liệu sang program bộ đang hâm (có thể chưa link xong) và nối uniform đèn vào trạng thái của Scene giả.
     Vật liệu có ánh sáng: lightsStateVersion khác trạng thái thật ⇒ khung sau setProgram tự gọi getProgram (tra bảng theo key, nối lại uniform).
     Vật liệu không ánh sáng (Basic, ShaderMaterial lights=false…) không có kiểm đó ⇒ đặt needsUpdate để lượt vẽ sau tra lại đúng program
     (tra bảng, không biên dịch); không thì nó dùng program của bộ đang hâm, phải chờ link đồng bộ.
   - Không dùng promise của compileAsync: nó kiểm currentProgram.isReady() sau 10 ms, lúc đó khung thật đã đặt currentProgram về bộ đang dùng
     ⇒ báo xong sớm. Thay vào đó giữ các program mới tạo (renderer.info.programs tăng thêm) và kiểm isReady() mỗi khung.
   - Pha 2 (vẽ thật, drawChunk) khi mọi program của bộ đã isReady ⇒ lightState.ready[bộ] = true; stepLights chuyển sang được từ khung sau.
   - Object gỡ khỏi cảnh trong lúc hâm (parent = null) bị bỏ qua; object thêm vào sau lúc bắt đầu hâm không được hâm (biên dịch lười như trước D-031).
   ===================================================================== */
const CHUNK = 2, DRAW_CHUNK = 2;   // object mỗi lần compile / mỗi lần vẽ hâm: nhỏ để kiểm ngân sách thường xuyên (một object vẽ lần đầu có thể tốn ~0,1 s) (ước lượng)
type Ready = { isReady(): boolean };
type Clip = { mat: THREE.Material; end: number };   // nhóm object cùng kiểu cắt (clippingPlanes + clipIntersection), object [.., end)
type Warm = { objs: THREE.Object3D[]; clips: Clip[]; ci: number; sets: { set: LightSet; lights: THREE.Light[] }[]; si: number; i: number; from: number; to: number;
  pending: Ready[]; pi: number; phase: number; scene: THREE.Scene; proxy: THREE.Object3D; clipScene: THREE.Scene; clipMesh: THREE.Mesh; clipRT: THREE.WebGLRenderTarget;
  draw: THREE.Scene; kids: THREE.Object3D[]; saved: Uint8Array; rts: THREE.WebGLRenderTarget[] };
let warm: Warm | null = null, warmDone = false;
/* Còn đang hâm nền bộ đèn không (quality.update bỏ khung dài do biên dịch khỏi trung bình). Chế độ khác 'bg' không bao giờ hâm */
export const lightsWarming = () => lightState.mode === 'bg' && !warmDone;

/* Số mặt phẳng cắt nằm trong program key (numClippingPlanes / numClipIntersection) nhưng compile() không tự đặt: nó dùng trạng thái cắt còn lại
   từ vật liệu vẽ sau cùng (WebGLClipping.setState chỉ chạy trong setProgram lúc vẽ). Vẽ sau cùng của khung thường là vật liệu bị mặt cắt Hầm cắt
   (4 mặt phẳng) ⇒ compile mọi vật liệu khác ra key sai (đo: +30 program biên dịch đồng bộ, khung 4,2 s ở lần chuyển 'day' đầu).
   Nên: xếp object theo kiểu cắt, trước mỗi nhóm vẽ một tam giác bằng vật liệu cùng kiểu cắt vào render target 1×1 để đặt trạng thái đó. */
function setClip(w: Warm, k: number) {
  const c = renderer.info.render.calls, t = renderer.info.render.triangles;
  w.clipMesh.material = w.clips[k].mat;
  renderer.setRenderTarget(w.clipRT); renderer.render(w.clipScene, camera);
  renderer.info.render.calls = c; renderer.info.render.triangles = t;   // không tính vào lệnh vẽ của khung (HUD, test)
}

function warmInit(): Warm {
  const objs: THREE.Object3D[] = [], clipOf = (o: THREE.Object3D) => { const m = (o as THREE.Mesh).material; const x = (Array.isArray(m) ? m[0] : m) as THREE.Material;
    return renderer.localClippingEnabled && x.clippingPlanes?.length ? x : null; };
  const groups = new Map<string, { rep: THREE.Material | null; objs: THREE.Object3D[] }>(), planeIds = new Map<THREE.Plane[], number>();
  scene.traverse((o) => {
    if (!(o as THREE.Mesh).material) return;   // cả vật liệu không ánh sáng: chúng cũng tra lại program (theo trạng thái đèn đang có) mỗi lần đổi canvas ↔ render target
    const c = clipOf(o);
    if (c && !planeIds.has(c.clippingPlanes)) planeIds.set(c.clippingPlanes, planeIds.size);
    const key = c ? `${planeIds.get(c.clippingPlanes)}:${c.clipIntersection}` : '';
    if (!groups.has(key)) groups.set(key, { rep: c, objs: [] });
    groups.get(key).objs.push(o);
  });
  const clips: Clip[] = [];
  for (const g of groups.values()) {
    for (const o of g.objs) objs.push(o);
    clips.push({ mat: new THREE.MeshBasicMaterial(g.rep ? { clippingPlanes: g.rep.clippingPlanes, clipIntersection: g.rep.clipIntersection } : {}), end: objs.length });
  }
  const clipMesh = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3)));
  clipMesh.frustumCulled = false;
  const clipScene = new THREE.Scene(); clipScene.add(clipMesh);
  const keep = lightState.set, sets: Warm['sets'] = [];
  for (const set of ['day', 'night'] as LightSet[]) {
    applyLightSet(set);
    const lights: THREE.Light[] = [];
    scene.traverseVisible((o) => { if ((o as THREE.Light).isLight) lights.push(o as THREE.Light); });
    sets.push({ set, lights });
  }
  applyLightSet(keep);   // cùng lời gọi, trước khung kế tiếp: không khung nào vẽ với bộ tạm
  const w: Warm = { objs, clips, ci: 0, sets, si: 0, i: 0, from: 0, to: 0, pending: [], pi: 0, scene: new THREE.Scene(), proxy: new THREE.Object3D(), clipScene, clipMesh, clipRT: new THREE.WebGLRenderTarget(1, 1),
    phase: 0, draw: new THREE.Scene(), kids: [], saved: new Uint8Array(DRAW_CHUNK + 16),
    rts: [new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }), new THREE.WebGLRenderTarget(1, 1)] };   // định dạng như composer / phản chiếu nước
  w.draw.children = w.kids; w.draw.matrixWorldAutoUpdate = false;
  // Scene giả: three gom đèn bằng targetScene.traverseVisible ⇒ chỉ trả đèn của bộ đang hâm
  w.scene.traverseVisible = (cb: (o: THREE.Object3D) => void) => { const ls = w.sets[w.si].lights; for (let k = 0; k < ls.length; k++) cb(ls[k]); };
  // Nhóm giả: compile duyệt vật liệu bằng traverse (phẳng, object [from, to)); traverseVisible rỗng ⇒ không thêm đèn
  w.proxy.traverse = (cb: (o: THREE.Object3D) => void) => { for (let k = w.from; k < w.to; k++) if (w.objs[k].parent) cb(w.objs[k]); };
  w.proxy.traverseVisible = () => {};
  return w;
}

/* Vẽ thật một nhóm object với một bộ đèn, ngoài màn hình (trước lượt vẽ thật của khung, cùng lời gọi). Cần vì program "xong" (isReady) mới là
   xong phần link: trình điều khiển D3D còn dịch tiếp lúc vẽ lần đầu với từng định dạng đích (đo Intel Arc, chưa có bước này: lần đầu sang 'night'
   khựng 0,7 s dù +0 program; lần đầu sang 'day' gần 1 s). Vẽ vào scene riêng (w.draw) có children = đèn của bộ + các object của nhóm:
   parent của object không đổi (matrixWorld đã tính ở khung trước, tắt matrixWorldAutoUpdate), trạng thái đèn của cảnh thật không bị đụng.
   Ba đích như khung thật: canvas (biến thể tone mapping; cắt kéo 1×1, khung thật xoá cả canvas ngay sau), render target 1×1 HalfFloat
   (định dạng của composer ban đêm), 1×1 RGBA8 (định dạng phản chiếu mặt nước). Lượt bóng (MeshDepthMaterial) chỉ vẽ ở đích đầu và chỉ khi
   khung thật cũng vẽ lại bóng ngay sau (autoUpdate): không thì shadow map đang dùng bị ghi đè bằng bóng của riêng nhóm này.
   Nước: bỏ qua onBeforeRender (không vẽ lại phản chiếu thật). */
function drawChunk(w: Warm, si: number, canvasOnly: boolean) {
  const kids = w.kids, ls = w.sets[si].lights, sv = w.saved, sm = renderer.shadowMap;
  kids.length = 0;
  for (let k = 0; k < ls.length; k++) { kids.push(ls[k]); sv[k] = ls[k].visible ? 1 : 0; ls[k].visible = true; }
  for (let k = w.from; k < w.to; k++) {
    const o = w.objs[k], im = o as THREE.InstancedMesh, j = ls.length + k - w.from;
    if (!o.parent) { sv[j] = 8; continue; }   // đã gỡ khỏi cảnh
    sv[j] = (o.visible ? 1 : 0) | (o.frustumCulled ? 2 : 0) | (im.isInstancedMesh && im.count === 0 ? 4 : 0);
    o.visible = true; o.frustumCulled = false; if (sv[j] & 4) im.count = 1;
    kids.push(o);
  }
  const ob = water.onBeforeRender, au = sm.autoUpdate, nu = sm.needsUpdate, c = renderer.info.render.calls, t = renderer.info.render.triangles;
  water.onBeforeRender = noop;
  w.draw.fog = scene.fog; w.draw.environment = scene.environment; w.draw.environmentRotation.copy(scene.environmentRotation);   // cùng key fog / envMap
  sm.autoUpdate = false; sm.needsUpdate = au;
  renderer.setRenderTarget(null); renderer.setScissorTest(true); renderer.setScissor(0, 0, 1, 1);
  renderer.render(w.draw, camera);
  renderer.setScissorTest(false); sm.needsUpdate = false;
  if (!canvasOnly) for (const rt of w.rts) { renderer.setRenderTarget(rt); renderer.render(w.draw, camera); }
  sm.autoUpdate = au; sm.needsUpdate = nu; water.onBeforeRender = ob;
  renderer.info.render.calls = c; renderer.info.render.triangles = t;   // không tính vào lệnh vẽ của khung (HUD, test)
  for (let k = 0; k < ls.length; k++) ls[k].visible = sv[k] === 1;
  for (let k = w.from; k < w.to; k++) {
    const o = w.objs[k], j = ls.length + k - w.from;
    if (sv[j] & 8) continue;
    o.visible = (sv[j] & 1) !== 0; o.frustumCulled = (sv[j] & 2) !== 0; if (sv[j] & 4) (o as THREE.InstancedMesh).count = 0;
  }
  kids.length = 0;
}
const noop = () => {};
/* Mỗi khung, trước lượt vẽ thật (sau quality.update: biết khung này có vẽ lại bóng không). Hai pha cho từng bộ day rồi night:
   compile (ngân sách, giới hạn program đang dịch) đến khi mọi program mới isReady → vẽ thật từng nhóm (ngân sách) ⇒ ready[bộ].
   Pha vẽ của night: mỗi nhóm vẽ night rồi vẽ day một lần (chỉ canvas): khung 'day' đầu tiên sau đêm, lượt bóng còn mang trạng thái đèn night
   (three vẽ bóng trước khi cập nhật đèn) ⇒ biến thể MeshDepthMaterial đó được biên dịch + vẽ sẵn ở đây. */
export function warmLightSets() {
  if (warmDone) return;
  if (lightState.mode !== 'bg') { warmDone = true; return; }
  if (!warm) {
    if (!renderer.extensions.has('KHR_parallel_shader_compile')) { lightState.mode = 'off'; warmDone = true; return; }
    warm = warmInit();
  }
  const w = warm, n = w.objs.length, t0 = performance.now(), rt = renderer.getRenderTarget(), set = w.sets[w.si].set;
  if (w.phase === 0) {   // biên dịch nền: giữ tối đa lightWarmPrograms program đang dịch dở (đo Intel Arc: dồn nhiều ⇒ khung 100–600 ms)
    while (w.pi < w.pending.length && w.pending[w.pi].isReady()) w.pi++;   // COMPLETION_STATUS_KHR: không chặn
    const progs = renderer.info.programs;
    w.scene.fog = scene.fog; w.scene.environment = scene.environment; w.scene.environmentRotation.copy(scene.environmentRotation);   // cùng key fog / envMap với cảnh thật
    let clipSet = false;   // khung thật vừa vẽ đã đổi trạng thái cắt ⇒ đặt lại ở lần compile đầu của mỗi lời gọi
    while (w.i < n && w.pending.length - w.pi < CONFIG.perf.lightWarmPrograms && performance.now() - t0 < CONFIG.perf.lightWarmMs) {
      while (w.i >= w.clips[w.ci].end) { w.ci++; clipSet = false; }
      if (!clipSet) { setClip(w, w.ci); clipSet = true; }
      w.from = w.i; w.to = Math.min(w.i + CHUNK, w.clips[w.ci].end);
      const before = progs.length;
      renderer.setRenderTarget(null); renderer.compile(w.proxy, camera, w.scene);
      renderer.setRenderTarget(composer.readBuffer); renderer.compile(w.proxy, camera, w.scene);
      for (let k = before; k < progs.length; k++) w.pending.push(progs[k] as unknown as Ready);
      for (let k = w.from; k < w.to; k++) {
        if (!w.objs[k].parent) continue;
        const m = (w.objs[k] as THREE.Mesh).material;
        if (Array.isArray(m)) for (const x of m) x.needsUpdate = true; else m.needsUpdate = true;
      }
      w.i = w.to;
    }
    renderer.setRenderTarget(rt);
    if (w.i < n || w.pi < w.pending.length) return;
    w.phase = 2; w.i = 0;   // mọi program của bộ đã link xong
    w.from = w.to = 0; drawChunk(w, w.si, true);   // nhóm rỗng: đặt trạng thái đèn của scene vẽ = bộ này (lượt bóng nhóm đầu đọc nó)
  }
  while (w.i < n && performance.now() - t0 < CONFIG.perf.lightWarmMs) {   // vẽ thật
    w.from = w.i; w.to = Math.min(w.i + DRAW_CHUNK, n);
    drawChunk(w, w.si, false);
    if (set === 'night') drawChunk(w, 0, true);   // sets[0] là day
    w.i = w.to;
  }
  renderer.setRenderTarget(rt);
  if (w.i < n) return;
  lightState.ready[set] = true;
  if (++w.si < w.sets.length) { w.phase = 0; w.i = 0; w.ci = 0; w.pending.length = 0; w.pi = 0; return; }
  w.clipRT.dispose(); w.clipMesh.geometry.dispose(); for (const c of w.clips) c.mat.dispose(); for (const r of w.rts) r.dispose();
  warm = null; warmDone = true;
}
