import * as THREE from 'three';
import { renderer, scene } from '../../core/renderer';
import { MAT } from '../../core/materials';
import { canvasTex } from '../../core/textures';
import { water } from '../../core/water';
import { CONFIG } from '../../config';
import { HR, HR_HOLES, hrRoadY, hrBedY, hrTrenchY } from './profile';
import type { HrMaterials } from './materials';
import { btFleetMaterial } from '../../environment/boats/material';
import { vhMaterial } from '../../common/vehicles/material';

/* [cutaway] Hai chế độ xem dưới lòng đất:
   • Mặt cắt địa chất (section): bóc dải đất phía Bắc mặt cắt dọc tim ống Nam, hiện tấm địa chất, nước trong suốt.
     Bóc bằng clippingPlanes + clipIntersection (4 mặt phẳng ⇒ một hình hộp bị loại bỏ), riêng nước dùng discard trong shader.
   • Nước trong (glass): chỉ làm nước trong suốt để thấy hào nạo vét và đốt hầm đang dìm (dùng khi mô phỏng dìm đốt hầm).
   Mặt phẳng cắt gán cố định từ khi dựng (D-018): đổi clippingPlanes/clipIntersection làm mọi vật liệu biên dịch lại shader (~45 vật liệu + nhà,
   giật vài giây). Tắt = đẩy mặt phẳng đầu ra rất xa: với clipIntersection, điểm chỉ bị cắt khi nằm phía âm của CẢ 4 mặt phẳng ⇒ không điểm nào bị cắt. */
export const CUT_X = HR.approachHalf + 40;     // m — nửa chiều dài vùng bóc
export const CUT_Z = HR.z + HR.cutZ;           // m — mặt cắt (thế giới), qua tim ống Nam
export const CUT_STRIP = 110;                  // m — bề rộng dải bị bóc, phía Bắc mặt cắt
const Y_TOP = 8, Y_BOT = -45;
const PLANE_OFF = 1e7;                         // m — hằng số mặt phẳng đầu khi tắt mặt cắt: mọi điểm nằm phía dương ⇒ không cắt

/* Nhãn 3D trên mặt cắt: khóa i18n + tọa độ thế giới */
export const CUT_LABELS: { key: string; pos: [number, number, number] }[] = [
  { key: 'hrLblElements', pos: [-150, -13, CUT_Z] },
  { key: 'hrLblGina', pos: [60, -10, CUT_Z] },
  { key: 'hrLblBed', pos: [150, -4.6, CUT_Z] },
  { key: 'hrLblPump', pos: [-9, -12, HR.z + HR.tubeFar - 0.7] },
  { key: 'hrLblCover', pos: [400, -4, CUT_Z] },
  { key: 'hrLblRamp', pos: [600, 1.5, CUT_Z] },
  { key: 'hrLblFlood', pos: [HR.rampHalf + 7, 4.4, CUT_Z] }
];

const LAYERS: [number, string, string][] = [[-2, '#d8c58f', 'cát san lấp'], [-9, '#c3a869', 'cát pha'], [-22, '#7f8f72', 'sét yếu'], [-34, '#8d7058', 'sét cứng'], [Y_BOT, '#6b6865', 'đá phong hoá']];

function drawGeology() {
  const W = 4096, H = Math.round((Y_TOP - Y_BOT) * 12), kx = W / (2 * CUT_X), ky = 12;
  const px = (x: number) => (CUT_X - x) * kx, py = (y: number) => (Y_TOP - y) * ky;   // đông ở bên trái khi nhìn từ phía Bắc
  return canvasTex(W, H, (g) => {
    const surf = (x: number) => (Math.abs(x) <= 264 ? hrBedY(x) : CONFIG.landY);
    // các lớp đất, mỗi cột 1 px
    for (let c = 0; c < W; c++) {
      const x = CUT_X - (c + 0.5) / kx, s = surf(x);
      let top = s;
      for (const [bot, col] of LAYERS) {
        if (top <= bot) continue;
        g.fillStyle = col; g.fillRect(c, py(top), 1.2, py(bot) - py(top) + 1); top = bot;
      }
      if (Math.abs(x) <= 264) { g.fillStyle = 'rgba(70,150,185,0.55)'; g.fillRect(c, py(0), 1.2, py(s) - py(0)); }   // cột nước sông
    }
    // lớp đá hộc trong hào nạo vét
    g.fillStyle = '#8b8880';
    for (let c = 0; c < W; c++) { const x = CUT_X - (c + 0.5) / kx; if (Math.abs(x) <= 264) g.fillRect(c, py(hrBedY(x)), 1.2, py(hrTrenchY(x)) - py(hrBedY(x))); }
    // vỏ hầm: bản nóc và bản đáy (cắt qua), ống rỗng
    for (let c = 0; c < W; c++) {
      const x = CUT_X - (c + 0.5) / kx, a = Math.abs(x), R = hrRoadY(x);
      if (a <= HR.coverHalf) {
        g.fillStyle = '#b6b3ab'; g.fillRect(c, py(R + HR.roofTop), 1.2, py(R + HR.clear) - py(R + HR.roofTop) + 1);
        g.fillRect(c, py(R), 1.2, py(R - HR.slabBelow) - py(R) + 1);
      } else if (a <= HR.rampHalf) {
        g.clearRect(c, 0, 1.2, py(R));                                               // máng hầm hở: bỏ đất phía trên sàn
        g.fillStyle = '#b6b3ab'; g.fillRect(c, py(R), 1.2, py(R - HR.slabBelow) - py(R) + 1);
      }
    }
    g.globalCompositeOperation = 'destination-out';                                  // lòng ống xe: để trống cho thấy nội thất 3D
    for (let c = 0; c < W; c++) { const x = CUT_X - (c + 0.5) / kx; if (Math.abs(x) <= HR.coverHalf) { const R = hrRoadY(x); g.fillRect(c, py(R + HR.clear), 1.2, py(R) - py(R + HR.clear)); } }
    g.globalCompositeOperation = 'source-over';
    // đường mặt đất, mực nước, lưới cao độ
    g.strokeStyle = 'rgba(30,30,30,0.7)'; g.lineWidth = 2; g.beginPath();
    for (let c = 0; c < W; c += 2) { const x = CUT_X - c / kx, y = Math.abs(x) <= 264 ? hrBedY(x) : CONFIG.landY; c ? g.lineTo(c, py(y)) : g.moveTo(c, py(y)); }
    g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.28)'; g.fillStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 1; g.font = '14px "JetBrains Mono", monospace';
    for (let y = 0; y >= Y_BOT; y -= 10) { g.beginPath(); g.moveTo(0, py(y)); g.lineTo(W, py(y)); g.stroke(); g.fillText(`${y} m`, 8, py(y) - 3); g.fillText(`${y} m`, W - 56, py(y) - 3); }
    g.setLineDash([10, 8]); g.strokeStyle = 'rgba(80,170,255,0.9)'; g.beginPath(); g.moveTo(px(CUT_X), py(0.4)); g.lineTo(px(264), py(0.4)); g.moveTo(px(-264), py(0.4)); g.lineTo(px(-CUT_X), py(0.4)); g.stroke();   // mực nước ngầm
  });
}
/* Dải cột chữ cái cho tên lớp đất (ghi bên trái bảng) */
export class Cutaway {
  section = false; glass = false;
  readonly planes: THREE.Plane[];
  readonly plane: THREE.Mesh;
  private mats: THREE.Material[] = [];

  constructor(M: HrMaterials) {
    renderer.localClippingEnabled = true;
    // vùng bị bóc: x ∈ (−CUT_X, CUT_X), z ∈ (CUT_Z − CUT_STRIP, CUT_Z) — clipIntersection nên chỉ phần nằm ngoài CẢ 4 mặt phẳng mới bị cắt
    this.planes = [
      new THREE.Plane(new THREE.Vector3(-1, 0, 0), PLANE_OFF), new THREE.Plane(new THREE.Vector3(1, 0, 0), -CUT_X),
      new THREE.Plane(new THREE.Vector3(0, 0, -1), CUT_Z - CUT_STRIP), new THREE.Plane(new THREE.Vector3(0, 0, 1), -CUT_Z)
    ];
    // tấm mặt cắt địa chất đặt sát mặt phía Nam, quay mặt về phía Bắc (nơi camera đứng)
    const tex = drawGeology(); M.textures.push(tex);
    this.plane = new THREE.Mesh(new THREE.PlaneGeometry(CUT_X * 2, Y_TOP - Y_BOT), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.04, fog: false }));
    this.plane.rotation.y = Math.PI; this.plane.position.set(0, (Y_TOP + Y_BOT) / 2, CUT_Z + 0.04);
    this.plane.visible = false; this.plane.name = 'hr-geology'; this.plane.layers.set(1); scene.add(this.plane);
    this.patchWater();
    // vật liệu bị bóc: đất, đường, cây, đèn, nhà (vật liệu riêng của buildCity) và hầm
    const set = new Set<THREE.Material>([MAT.land, MAT.sand, MAT.paver, MAT.stone, MAT.grass, MAT.road, MAT.road2, MAT.trunk, MAT.leaf, MAT.palm, MAT.lampPole, MAT.bulb,
      vhMaterial, btFleetMaterial,
      M.concrete, M.bore, M.roadIn, M.roadOut, M.louver, M.brick, M.wave, M.bed, M.rubble, M.steel, M.lampThr, M.lampIn, M.lampCorr, M.fan, M.sos, M.extinguisher, M.door, M.exit, M.laneGreen, M.guide, M.equip, M.grate, M.basket]);
    scene.traverse((o) => { const i = o as THREE.InstancedMesh; if (i.isInstancedMesh && i.parent && (i.parent as THREE.LOD).isLOD) set.add(i.material as THREE.Material); });
    this.mats = [...set];
    for (const m of this.mats) { m.clippingPlanes = this.planes; m.clipIntersection = true; m.needsUpdate = true; }   // lúc dựng, trước lần biên dịch đầu
  }
  /* Nước: bỏ các điểm nằm trong máng hầm hở (nước trải vô hạn ở y = 0 sẽ lọt vào máng) và trong vùng bóc khi bật mặt cắt */
  private patchWater() {
    const mat = water.material as THREE.ShaderMaterial;
    mat.uniforms.uHoles = { value: HR_HOLES.map((h) => new THREE.Vector4(h.x0, h.z0, h.x1, h.z1)) };
    mat.uniforms.uCut = { value: new THREE.Vector4(-CUT_X, CUT_Z - CUT_STRIP, CUT_X, CUT_Z) };
    mat.uniforms.uCutOn = { value: 0 };
    mat.fragmentShader = mat.fragmentShader.replace('void main() {', `uniform vec4 uHoles[${HR_HOLES.length}]; uniform vec4 uCut; uniform float uCutOn;
      bool inRect(vec4 r, vec2 p) { return p.x > r.x && p.x < r.z && p.y > r.y && p.y < r.w; }
      void main() {
        vec2 wp = worldPosition.xz;
        for (int i = 0; i < ${HR_HOLES.length}; i++) if (inRect(uHoles[i], wp)) discard;
        if (uCutOn > 0.5 && inRect(uCut, wp)) discard;`);
    mat.needsUpdate = true;
  }
  setSection(on: boolean) {
    if (on === this.section) return;
    this.section = on; this.plane.visible = on;
    this.planes[0].constant = on ? -CUT_X : PLANE_OFF;
    (water.material as THREE.ShaderMaterial).uniforms.uCutOn.value = on ? 1 : 0;
    this.applyWater();
  }
  setGlass(on: boolean) { if (on === this.glass) return; this.glass = on; this.applyWater(); }
  private applyWater() {
    const clear = this.section || this.glass, mat = water.material as THREE.ShaderMaterial;
    mat.transparent = clear; mat.depthWrite = !clear; mat.uniforms.alpha.value = clear ? 0.4 : 1;
  }
}
