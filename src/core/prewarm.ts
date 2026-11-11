import * as THREE from 'three';
import { renderer, scene, camera } from './renderer';
import { composer } from './postprocessing';
import { LIGHT_SETS, applyLightSet, stepLights, pointLights } from './lights';

/* =====================================================================
   BIÊN DỊCH TRƯỚC (D-018) — chạy một lần lúc màn hình chờ còn hiện, trước khung hình đầu.
   Nếu không, three biên dịch shader của một vật liệu lần đầu nó được vẽ (đồng bộ trên luồng chính) ⇒ giật khi:
   chuyển đêm lần đầu (composer vẽ vào render target ⇒ biến thể không tone mapping), bay tới công trình có `details` đang ẩn, mặt cắt Hầm…
   - renderer.compile() duyệt MỌI object (kể cả đang ẩn), nên không cần bật tạm `visible`.
   - Hai biến thể: vẽ thẳng ra canvas (ban ngày) và vào render target (composer ban đêm; cũng trùng biến thể phản chiếu mặt nước).
   - Upload sẵn mọi texture (atlas quảng cáo 2048², địa chất 4096×636…) để lần hiện đầu không phải tải lên GPU.
   - Vẽ composer một lần: biên dịch các pass bloom / output.
   - Ba bộ đèn (D-031, core/lights.ts: day / night / full): số đèn nằm trong program key nên mỗi bộ là một program khác của cùng vật liệu.
     Lặp cả ba bộ (biên dịch + vẽ thật) để khi chạy đổi bộ chỉ là tra bảng materialProperties.programs, không biên dịch. Upload texture chỉ một lần.
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
  for (const set of LIGHT_SETS) {
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
  stepLights();   // về bộ ứng với cường độ đèn thật (applyNight đã chạy trước prewarm)
  composer.render(0);   // một lần nữa với trạng thái thật (bloom/output pass đã biên dịch ở lần trên)
}
