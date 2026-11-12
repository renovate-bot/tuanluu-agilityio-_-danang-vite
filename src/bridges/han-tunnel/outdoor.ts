import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from '../../config';
import { canvasTex } from '../../core/textures';
import { rng } from '../../common/math';
import { prepColored, extrudeAlongX, fillBlock, bentBox, boxAt, roadStrip, shadowed } from '../../common/geometry';
import { addLampPosts } from '../../common/deck';
import { trPalmStaticGeo } from '../../common/trees/shapes';
import { HR, hrRoadY } from './profile';
import { drOnNewRoad, drCutAlongX } from '../../environment/driveRoadGeo';
import type { HanTunnel } from './HanTunnel';

/* [outdoor] Phần nhìn thấy trên mặt đất: máng hầm hở (sàn, tường, dải giữa), đoạn gờ chắn ngập, mái lam che nắng mưa,
   kiến trúc hai cửa hầm (Tây: tường thành Điện Hải; Đông: sóng biển, thuyền thúng), cửa phai, khung giới hạn chiều cao,
   mặt đường + vỉa hè + đèn đường + cọ hai bên. Mọi hình học gộp vào concreteParts hoặc InstancedMesh. */
const W = HR.halfWidth, LAND = CONFIG.landY;
const BRICK: [number, number, number] = [0.86, 0.6, 0.45];
const _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler();
const wallTop = (x: number) => Math.max(hrRoadY(x) + 1.1, LAND + 0.6);   // tường máng: cao hơn mặt đường 1,1 m, tối thiểu nhô 0,6 m khỏi mặt phố

/* Vẽ một biển vào vùng (x, y, w, h) của canvas */
function paintSign(g: CanvasRenderingContext2D, x: number, y0: number, cw: number, ch: number, lines: [string, number][], bg: string) {
  g.fillStyle = bg; g.fillRect(x, y0, cw, ch);
  g.strokeStyle = '#f2f2ee'; g.lineWidth = 4; g.strokeRect(x + 5, y0 + 5, cw - 10, ch - 10);
  g.fillStyle = '#f2f2ee'; g.textAlign = 'center'; g.textBaseline = 'middle';
  let y = y0; const tot = lines.reduce((a, [, k]) => a + k, 0);
  for (const [txt, k] of lines) { g.font = `600 ${Math.round(ch * k / tot * 0.72)}px "Be Vietnam Pro", sans-serif`; g.fillText(txt, x + cw / 2, y + ch * k / tot / 2); y += ch * k / tot; }
}
const SIGN_W = 1024, SIGN_H = 160, VMS_H = 92, LIM_W = 128, LIM_H = 64;   // canvas biển: VMS ở trên, biển "4,5 m" ở góc dưới trái
/* UV của PlaneGeometry trỏ vào vùng (u0..u1, v0..v1) của canvas biển */
const remapUV = (g: THREE.BufferGeometry, u0: number, u1: number, v0: number, v1: number) => { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + (u1 - u0) * uv.getX(i), v0 + (v1 - v0) * uv.getY(i)); return g; };

export function hrBuildOutdoor(bridge: HanTunnel) {
  const a = HR.coverHalf, c = HR.rampHalf, cp = bridge.concreteParts, M = bridge.mats;
  const lintelY = (x: number) => hrRoadY(x) + HR.clear + 0.2;
  // gom các chi tiết nhỏ hai phía để mỗi loại chỉ tốn một draw call: lam mái, dải LED, biển VMS, biển giới hạn chiều cao
  const slatAll: THREE.Matrix4[] = [], ledAll: THREE.BufferGeometry[] = [], signAll: THREE.BufferGeometry[] = [];
  const signTex = canvasTex(SIGN_W, SIGN_H, (g) => { g.fillStyle = '#10151c'; g.fillRect(0, 0, SIGN_W, SIGN_H); paintSign(g, 0, 0, SIGN_W, VMS_H, [['HẦM SÔNG HÀN', 1.15], ['60 km/h · XE MÁY ĐI LÀN PHẢI', 0.8]], '#0a3f78'); paintSign(g, 0, VMS_H + 4, LIM_W, LIM_H, [['4,5 m', 1]], '#c9201a'); });
  const signMat = new THREE.MeshBasicMaterial({ map: signTex, side: THREE.DoubleSide });
  M.textures.push(signTex);
  for (const s of [-1, 1]) {
    const x0 = s > 0 ? a : -c, x1 = s > 0 ? c : -a, west = s < 0;
    const tint = west ? BRICK : [0.8, 0.8, 0.8] as [number, number, number];
    // máng chữ U: sàn, hai tường ngoài, dải giữa (thay hành lang thoát nạn)
    cp.push(prepColored(extrudeAlongX([[-W, -HR.slabBelow], [W, -HR.slabBelow], [W, 0], [-W, 0]], x0, x1, 64, hrRoadY), () => 0.75));
    for (const z of [-1, 1]) cp.push(prepColored(fillBlock(x0, x1, HR.outerWall, z * (W - HR.outerWall / 2), -7.6, wallTop, 64), () => tint));
    cp.push(prepColored(fillBlock(x0, x1, HR.tubeNear * 2, 0, -7.6, (x) => hrRoadY(x) + 0.9, 64), () => 0.8));
    // mái lam: dầm biên + dầm giữa trên cột, lam nghiêng bước 2 m
    const lx0 = s > 0 ? a : -a - HR.louverLen, lc = (lx0 + lx0 + HR.louverLen) / 2;
    for (const z of [-W + 0.5, 0, W - 0.5]) cp.push(prepColored(bentBox(HR.louverLen, 0.5, 0.5, lc, HR.clear + 0.25, z, 40, hrRoadY), () => tint));
    for (let x = lx0 + 8; x < lx0 + HR.louverLen; x += 16) cp.push(prepColored(boxAt(0.6, HR.clear - 0.9, 0.6, x, hrRoadY(x) + (HR.clear + 0.9) / 2 - 0.0, 0), () => 0.8));
    const slats: THREE.Matrix4[] = [];
    for (let x = lx0 + 1; x < lx0 + HR.louverLen; x += HR.louverGap) { _q.setFromEuler(_e.set(0, 0, 0.5)); slats.push(new THREE.Matrix4().compose(_p.set(x, hrRoadY(x) + HR.clear + 0.45, 0), _q, _s.set(1, 1, 1))); }
    slatAll.push(...slats);
    // dải LED viền mái lam và cửa hầm (sáng về đêm)
    const px = s * (a + HR.louverLen);   // mặt cửa hầm ở đầu mái lam, phía ra mặt phố
    const led = [-W, W].map((z) => bentBox(HR.louverLen, 0.08, 0.08, lc, HR.clear + 0.55, z, 40, hrRoadY));
    led.push(boxAt(0.1, 0.1, W * 2, px, lintelY(px) + 0.1, 0));
    ledAll.push(...led.map((g) => { g.deleteAttribute('uv'); return g; }));
    // khung cửa hầm: dầm ngang + hai trụ, biển VMS quay ra phía đường dẫn
    cp.push(prepColored(boxAt(1.4, 1.7, W * 2 + 0.4, px, lintelY(px) + 1.1, 0), () => tint));
    for (const z of [-1, 1]) cp.push(prepColored(boxAt(1.6, lintelY(px) + 1.1 - wallTop(px) + 0.4, 1.6, px, (lintelY(px) + 1.1 + wallTop(px)) / 2 - 0.2, z * (W - 0.8)), () => tint));
    signAll.push(remapUV(new THREE.PlaneGeometry(15, 1.35), 0, 1, 1 - VMS_H / SIGN_H, 1).rotateY(s * Math.PI / 2).translate(px + s * 0.72, lintelY(px) + 1.1, 0));
    // trang trí đỉnh cửa hầm
    const topY = lintelY(px) + 1.95, n = Math.floor((W * 2 - 1) / 1.8);
    for (let k = 0; k < n; k++) {
      const z = -W + 0.9 + k * 1.8 + 0.5;
      if (west) cp.push(prepColored(boxAt(0.9, 0.7, 1.0, px, topY + 0.35, z), () => BRICK));            // lô cốt răng cưa, gợi tường thành Điện Hải
      else { const h = 0.5 + 1.0 * (0.5 + 0.5 * Math.sin(k * 0.55)); cp.push(prepColored(boxAt(0.9, h, 1.4, px, topY + h / 2 - 0.05, z), () => [0.75, 0.86, 0.92])); } // đỉnh sóng
    }
    // gờ chắn ngập: đoạn nền đắp qua đỉnh dốc, kèm cửa phai (khe thép + cánh cửa kéo lên) ở đầu hầm hở
    const e0 = s > 0 ? c : -c - 62.5, e1 = s > 0 ? c + 62.5 : -c;
    cp.push(prepColored(fillBlock(e0, e1, 36, 0, 2.0, (x) => hrRoadY(x) - 0.04, 40), () => 0.74));
    const gx = s * (c + 2.5);
    for (const z of [-1, 1]) bridge.steelParts.push(boxAt(0.9, 6.4, 0.9, gx, hrRoadY(gx) + 3.2, z * (W + 0.5)).toNonIndexed());
    bridge.steelParts.push(boxAt(1.0, 0.7, W * 2 + 2.4, gx, hrRoadY(gx) + 6.55, 0).toNonIndexed());
    bridge.steelParts.push(boxAt(0.25, 2.4, W * 2 - 0.4, gx, hrRoadY(gx) + 4.7, 0).toNonIndexed());   // cánh cửa phai, đang kéo lên
    // khung giới hạn chiều cao 4,5 m, cách đầu hầm hở 50 m
    const hx = s * HR.gantryX;
    for (const z of [-1, 1]) bridge.steelParts.push(boxAt(0.5, HR.heightLimit + 1.2, 0.5, hx, hrRoadY(hx) + (HR.heightLimit + 1.2) / 2, z * (W + 1.4)).toNonIndexed());
    bridge.steelParts.push(boxAt(0.55, 0.55, (W + 1.4) * 2, hx, hrRoadY(hx) + HR.heightLimit + 0.3, 0).toNonIndexed());
    for (const z of [-HR.tubeCenter, HR.tubeCenter]) signAll.push(remapUV(new THREE.PlaneGeometry(2.4, 1.2), 0, LIM_W / SIGN_W, 0, LIM_H / SIGN_H).rotateY(Math.PI / 2).translate(hx, hrRoadY(hx) + HR.heightLimit + 1.0, z));
  }
  // mỗi loại gộp thành một mesh; lam mái là InstancedMesh chung hai phía
  cp.push(...slatAll.map((m) => prepColored(new THREE.BoxGeometry(1.5, 0.12, W * 2 - 1.2).applyMatrix4(m), () => [0.93, 0.91, 0.86])));
  bridge.group.add(new THREE.Mesh(mergeGeometries(ledAll), M.led));
  bridge.details.add(new THREE.Mesh(mergeGeometries(signAll), signMat));
  hrBuildSurface(bridge);
  hrBuildDecor(bridge);
}

/* Mặt đường nối (Đống Đa phía Tây, Vân Đồn phía Đông), dải giữa, vỉa hè, đèn đường */
function hrBuildSurface(bridge: HanTunnel) {
  const Wd = HR.shoulder * 2 + HR.laneWidth * HR.lanesPerDir, c = HR.rampHalf;
  const roads: THREE.BufferGeometry[] = [];
  for (const [x0, x1, segs] of [[-1900, -780, 1], [-780, -HR.coverHalf, 80], [HR.coverHalf, 780, 80], [780, 1480, 1]] as [number, number, number][]) {
    roads.push(roadStrip(x0, x1, Wd, HR.tubeCenter, 0.03, segs, hrRoadY), roadStrip(x0, x1, Wd, -HR.tubeCenter, 0.03, segs, hrRoadY, true));
  }
  const road = shadowed(new THREE.Mesh(mergeGeometries(roads), bridge.mats.roadOut), false, true);
  road.name = 'hr-road'; bridge.group.add(road); bridge.noReflect.push(road); bridge.farHide.push(road);
  // dải giữa cỏ (4,2 m) và vỉa hè gạch (3 m) hai bên đường mặt phố; chia đoạn tại nút giao / đường dọc mới của chế độ lái (D-034)
  const med: THREE.BufferGeometry[] = [], paver: THREE.BufferGeometry[] = [];
  for (const [x0, x1] of [[-1900, -c], [c, 1480]]) {
    const segs = Math.ceil((x1 - x0) / 8);
    med.push(...drCutAlongX(x0, x1, HR.z, HR.tubeNear, segs, (len, xc, n) => bentBox(len, 0.3, HR.tubeNear * 2, xc, 0.15, 0, n, hrRoadY)));
    for (const z of [-1, 1]) paver.push(...drCutAlongX(x0, x1, HR.z + z * (HR.tubeFar + 1.5), 1.5, segs, (len, xc, n) => bentBox(len, 0.2, 3, xc, 0.1, z * (HR.tubeFar + 1.5), n, hrRoadY)));
  }
  bridge.concreteParts.push(...med.map((g) => prepColored(g, () => [0.4, 0.58, 0.3])), ...paver.map((g) => prepColored(g, () => [0.8, 0.72, 0.6])));
  const xs: number[] = []; for (let x = 760; x <= 1460; x += 40) xs.push(x, -x);
  addLampPosts(bridge, { xs, profile: hrRoadY, rows: [{ z: -HR.tubeFar - 1.8, s: -1 }, { z: HR.tubeFar + 1.8, s: 1 }] });
}

/* Cọ ven đường, thuyền thúng ở cửa Đông (gợi làng chài Mân Thái, Nại Hiên) */
function hrBuildDecor(bridge: HanTunnel) {
  const rnd = rng(7001), palms: [number, number][] = [];
  for (const s of [-1, 1]) {
    for (let x = HR.coverHalf + 10; x < HR.rampHalf; x += 14) for (const z of [-1, 1]) palms.push([s * x + (rnd() - 0.5) * 2, z * (W + 3.4 + rnd() * 1.5)]);
    for (let x = HR.rampHalf + 20; x < 1440; x += 18) for (const z of [-1, 1]) palms.push([s * x + (rnd() - 0.5) * 3, z * (HR.tubeFar + 5.2 + rnd() * 1.5)]);
  }
  // dừa: hình học tĩnh trPalmStaticGeo (thân cong + tàu lá dải hai mặt, màu đỉnh sẵn) gộp vào bê tông (một draw call chung, không cần InstancedMesh riêng)
  // yaw suy từ chỉ số cây bằng băm (không gọi thêm rnd(): chuỗi rng(7001) giữ nguyên), mỗi cây vẫn đúng 1 lời gọi rnd() lấy h
  const cp = bridge.concreteParts;
  palms.forEach(([x, z], i) => {
    const h = 8 + rnd() * 4, y = hrRoadY(x) < LAND ? LAND : hrRoadY(x) - 0.1, yaw = (Math.sin(i * 12.9898) * 43758.5453 % 1 + 1) % 1 * Math.PI * 2;
    if (drOnNewRoad(x, z + HR.z, CONFIG.drive.roads.clearMargin)) return;   // cọ đứng trên đường dọc mới (chế độ lái, D-034): bỏ, sau khi đã lấy rnd() để chuỗi rng(7001) của cây khác giữ nguyên
    const g = trPalmStaticGeo(h).rotateY(yaw).translate(x, y, z);
    g.deleteAttribute('uv');                    // đã không indexed, có sẵn normal + color: không qua prepColored vì nó ghi đè màu đỉnh
    cp.push(g);
  });
  // thuyền thúng: bát úp nửa cầu + mái chèo, xếp thành cụm bên cạnh cửa hầm phía Đông
  const bowl = new THREE.SphereGeometry(1, 18, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(1.7, 0.9, 1.7);
  const spots: [number, number, number][] = [[612, 25, 0.2], [624, 28, 1.2], [636, 24.5, 2.4], [618, -27, 0.7], [632, -25, 1.9]];
  spots.forEach(([x, z, ry]) => {
    cp.push(prepColored(bowl.clone().rotateY(ry).translate(x, LAND + 0.9, z), () => [0.48, 0.33, 0.19]), prepColored(new THREE.CircleGeometry(1.7, 18).rotateX(-Math.PI / 2).translate(x, LAND + 0.9, z), () => [0.33, 0.23, 0.14]));
  });
}
