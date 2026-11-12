/* ============================ Lái xe: điều phối chế độ (lái một mình, máy tính) ============================
   Nối mạng đường (net / roadData / solids / sceneSolids), chuyển động + va chạm (motion / collide), hình xe (car / cars),
   camera sau xe (camera) với vòng animate, phím, chuột, cảm ứng (touch), HUD (hud: đồng hồ, bản đồ nhỏ, gợi ý), tiếng mô tơ / còi (sound). Mẫu: explore/stroll/index.ts.
   `?explore=drive` vào thẳng, lái một mình; thẻ "Ô tô" ở màn chọn cũng lái một mình (sảnh nhiều người: Task 10–11).
   Esc và nút Thoát dùng explore.exit() (tải lại trang, D-020); trước đó drive.stop() trả lại các thứ đã đổi.
   - Mạng đường dựng MỘT lần ở lần đầu vào chế độ và giữ lại: ô tĩnh + vật cản tĩnh + nhà / chân đế thu từ cảnh (drCollectRuntime chỉ push,
     gọi hai lần sẽ nhân đôi vật cản). Chỉ đọc cảnh, sau mọi rand().
   - Barie Cầu sông Hàn: cổng DR_GATE_SWING của ô nhịp quay đóng khi cầu rời CLOSED (mỗi khung); không tự quay, không tăng tốc quay (như đi dạo).
     Xe đang chạm nhịp quay lúc đó được sơ tán ra ngoài barie gần nhất (motion.ts drEvacStep), gói trong thời gian còn lại trước khi nhịp xoay
     (drSwingBudget: coi như nhịp không phải chờ xe tự động rời nhịp, tức thời gian ngắn nhất).
   - Xe tự động: mỗi khung lấy hộp các xe đang hiện trong bán kính CONFIG.drive.ai.radius (common/trafficQuery.ts trNearby, mảng tái dùng);
     người chơi lao vào thì bị chặn, xe tự động chạy tới thì đi xuyên (collide.ts drMove).
   - Ban đêm Cầu Rồng tự phun như khi đi dạo (exNightStep, swing = false).
   - Hầm: driveView.far = CONFIG.drive.tunnelFar khi đang lái để mặt đường hầm hiện ở nút giao với hai đường dọc mới; thoát trả 1.
   - Xe của mình là xe slot 0 của drCars (màu slot 0 khi lái một mình); xe và bánh chỉ vào cảnh khi vào chế độ (góc nhìn cũ không thêm lệnh vẽ).
   - Phím theo e.code (keys.ts), chỉ ghi khi đang lái, bỏ qua ô nhập và tổ hợp Ctrl / Meta / Alt; blur, ẩn tab, focus vào ô nhập thì nhả hết.
   - Cảm ứng (touch.ts, #drHud): đọc SAU phím và gộp (giá trị có độ lớn lớn hơn), không xóa phím trên máy lai; reset() cùng chỗ nhả phím. Phím H: còi.
   Mỗi khung không cấp phát (D-018). */
import type * as THREE from 'three';
import { scene, camera, controls, canvas, renderer } from '../../core/renderer';
import { composer, onResize } from '../../core/postprocessing';
import { cam } from '../../views/state';
import { CONFIG } from '../../config';
import { driveView } from '../../environment/driveRoads';
import { drMakeNet, drSetGate, type DrNet } from './net';
import { drBuildPads, DR_GATE_SWING } from './roadData';
import { drBuildSolids } from './solids';
import { drCollectRuntime, drSceneStats } from './sceneSolids';
import { drCreate, drStep, drEvacStep, type DrState, type DrInput } from './motion';
import { trNearby } from '../../common/trafficQuery';
import type { DrBox } from './collide';
import { drCarLoad, drCarSetWarm } from './car';
import { drCars } from './cars';
import { drCamPlace, drCamDrag, type DrCam } from './camera';
import { drInputFromKeys, drBindDrop, DR_KEYS } from './keys';
import { drHudShow, drHudHide, drHudUpdate, type DrMapDot } from './hud';
import { drTouchBind } from './touch';
import { drSound } from './sound';
import { exNightStep } from '../nightShows';
import type { SwingController } from '../../bridges/song-han/SwingController';

const DR_SOLO_SLOT = -1;     // drCreate / drSpawnPose: lái một mình xuất phát ở giữa các chỗ của slot
const DR_SELF = 0;           // slot xe của mình trong drCars khi lái một mình (màu slot 0)

/* Làm nóng shader của xe (D-018), như stroll/index.ts stRigSetWarm: hai biến thể (vẽ thẳng ra canvas ban ngày, vào render target của composer ban đêm),
   đèn / sương / bóng lấy từ cảnh chính, camera chính (đèn lọc theo lớp của nó). Nhóm làm nóng do car.ts dựng, không thêm vào scene */
drCarSetWarm(async (o: THREE.Object3D) => {
  const rt = renderer.getRenderTarget();
  renderer.setRenderTarget(null);
  const a = renderer.compileAsync(o, camera, scene);
  renderer.setRenderTarget(rt);
  await a;
  renderer.setRenderTarget(composer.readBuffer);
  const b = renderer.compileAsync(o, camera, scene);
  renderer.setRenderTarget(rt);
  await b;
});

let net: DrNet | null = null;
let state: DrState | null = null;
let ctrl: SwingController | null = null;
const drKeys = new Set<string>();  // e.code đang giữ
const camS: DrCam = { yaw: 0, pitch: 0, idle: 0 };
const _inp: DrInput = { gas: 0, brake: 0, steer: 0, hand: false };   // đầu vào tái dùng mỗi khung
const NO_OTHERS: DrMapDot[] = [];  // xe người khác trên bản đồ nhỏ: Task 11 truyền; hiện không có
let touch: ReturnType<typeof drTouchBind> | null = null;   // điều khiển cảm ứng (setupDrive dựng)
const boxes: DrBox[] = [];         // hộp xe tự động gần xe, tái dùng mỗi khung (trNearby chỉ thêm phần tử khi phải nới)
let saved: { fov: number; explore: boolean } | null = null;   // thứ start() đổi, stop() trả lại: fov camera, lớp body 'explore' đã có từ trước chưa

const active = () => cam.mode === 'car' && state !== null;
const isField = (t: EventTarget | null) => !!t && /^(SELECT|INPUT|TEXTAREA)$/.test((t as HTMLElement).tagName || '');

/* Mạng đường dựng lần đầu vào chế độ, giữ lại cho các lần sau; cổng nhịp quay theo cầu hiện tại */
function drEnsureNet(): DrNet {
  if (!net) {
    const n = drMakeNet(drBuildPads(), drBuildSolids());
    drCollectRuntime(n, (scene.getObjectByName('tp-houses') as THREE.InstancedMesh) || null);   // một lần cho mỗi net (chỉ push)
    net = n;                                                         // gán sau khi thu xong: thu lỗi thì lần vào sau thu lại từ đầu
  }
  if (ctrl) drSetGate(net, DR_GATE_SWING, ctrl.state !== 'CLOSED');
  return net;
}

/* Giây (thời gian thật) còn lại tới lúc nhịp quay bắt đầu xoay (ROTATING_OPEN), giả sử nhịp không phải chờ xe tự động rời nhịp
   (spanClear đúng ngay: thời gian ngắn nhất); 0 khi nhịp đã / đang xoay hoặc cầu đóng */
function drSwingBudget(c: SwingController): number {
  const T = c.cfg.timing, sp = c.speed > 0 ? c.speed : 1;
  if (c.state === 'STOP_TRAFFIC') return Math.max(0, T.amber + T.barrier - c.t + T.unlock) / sp;
  if (c.state === 'UNLOCK') return Math.max(0, T.unlock - c.t) / sp;
  return 0;
}

/* Một bước: cổng nhịp quay, sơ tán / chuyển động, hình xe, camera, hiệu ứng đêm */
function advance(dt: number, inp: DrInput): void {
  if (ctrl) drSetGate(net!, DR_GATE_SWING, ctrl.state !== 'CLOSED');
  const s = state!;
  if (!drEvacStep(s, net!, dt, ctrl ? drSwingBudget(ctrl) : undefined)) drStep(s, inp, net!, boxes, trNearby(s.x, s.z, CONFIG.drive.ai.radius, boxes), dt);
  drCars.place(DR_SELF, state!);
  drCamPlace(camera, state!, camS, net!, dt);
  controls.target.set(state!.x, state!.y, state!.z);   // tâm vùng bóng đổ (main.ts shadowCenter) theo xe
  drHudUpdate(state!, NO_OTHERS); drSound.update(state!.v);
  exNightStep(dt, false);
}

/* Xe đứng yên ở (x, z) hướng yaw, trạng thái mới từ drCreate (xóa trạng thái cọ tường); y bỏ trống thì lấy mặt đường cao nhất tại đó.
   Dùng cho test (__app.drive) và đặt lại vị trí */
function drPlaceAt(x: number, z: number, yaw: number, y?: number): void {
  if (!net) return;
  const s = drCreate(net, DR_SOLO_SLOT);
  let gy = -Infinity;
  for (const p of net.pads) {
    if (x < p.x0 || x > p.x1 || z < p.z0 || z > p.z1 || (p.gate !== undefined && net.closed.has(p.gate))) continue;
    gy = Math.max(gy, p.y(x, z));
  }
  s.x = x; s.z = z; s.yaw = yaw; s.y = y ?? (Number.isFinite(gy) ? gy : CONFIG.roadY);
  state = s;
  camS.yaw = 0; camS.pitch = 0; camS.idle = 0;
  drCars.place(DR_SELF, s);
  drCamPlace(camera, s, camS, net, 0, true);
  controls.target.set(s.x, s.y, s.z);
}

export const drive = {
  active,
  get state(): DrState | null { return state; },
  get net(): DrNet | null { return net; },
  get cam(): DrCam { return camS; },
  /* Vào lái. solo: lái một mình (hiện luôn là một mình; slot nhiều người ở Task 11) */
  start(solo = true): void {
    const n = drEnsureNet();
    state = drCreate(n, DR_SOLO_SLOT);
    camS.yaw = 0; camS.pitch = 0; camS.idle = 0;
    drCars.sync([{ slot: DR_SELF }]);
    if (!drCars.group.parent) scene.add(drCars.group);
    drCars.place(DR_SELF, state);
    driveView.far = CONFIG.drive.tunnelFar;
    drKeys.clear(); touch?.reset();
    drHudShow(n); drSound.start();
    if (!saved) saved = { fov: camera.fov, explore: document.body.classList.contains('explore') };
    cam.flight.then = null; cam.mode = 'car'; controls.enabled = false;
    camera.fov = CONFIG.drive.cam.fov; onResize();   // onResize cập nhật ma trận chiếu và hệ số cỡ điểm theo fov mới
    drCamPlace(camera, state, camS, n, 0, true);
    controls.target.set(state.x, state.y, state.z);
    document.body.classList.add('explore', 'drive');
  },
  /* Chế độ xem bám xe người khác: Task 11. Hiện chưa có phiên lái nhiều người nên lái một mình */
  startWatching(): void { drive.start(true); },
  update(dt: number): void {
    if (!active()) return;
    drInputFromKeys(drKeys, _inp);
    if (touch) touch.read(_inp);   // gộp, không xóa phím
    drSound.horn(drKeys.has('KeyH'));
    advance(dt, _inp);
  },
  /* Gọi ngay sau lệnh vẽ khung chính (main.ts); chỗ cho HUD / chụp ảnh của task sau */
  afterRender(): void { /* chưa có việc */ },
  /* Rời chế độ: trả mọi thứ đã đổi (explore.exit tải lại trang ngay sau), kể cả khi cam.mode đã bị chỗ khác đổi khỏi 'car' */
  stop(): void {
    if (state === null) return;
    state = null; drKeys.clear(); touch?.reset();
    drHudHide(); drSound.stop();
    drCars.clear(); drCars.group.removeFromParent();
    driveView.far = 1;
    document.body.classList.remove('drive');
    if (saved) {
      if (!saved.explore) document.body.classList.remove('explore');
      camera.fov = saved.fov; onResize();                            // onResize tính lại ma trận chiếu và pScale theo fov cũ
      saved = null;
    }
    if (cam.mode === 'car') { cam.mode = 'orbit'; controls.enabled = true; }
  },
  /* Cho test: như update nhưng nhận đầu vào trực tiếp; đặt xe tại chỗ */
  step(dt: number, inp: DrInput): void { if (active()) advance(dt, inp); },
  placeAt: drPlaceAt,
  stats: drSceneStats,
  preload(): void { void drCarLoad(); }
};

/* onExit: thoát chung (explore.exit); Task 11 dùng khi mất kết nối lúc đang xem, lái một mình chưa cần */
export function setupDrive(c: SwingController, onExit: () => void): void {
  ctrl = c;
  window.addEventListener('keydown', (e) => {
    if (!active() || e.key === 'Escape') return;   // Esc do explore/index.ts xử lý (thoát chung)
    if (e.ctrlKey || e.metaKey || e.altKey) return;   // phím tắt trình duyệt không điều khiển xe, tránh kẹt phím
    if (isField(e.target)) return;                    // gõ trong ô nhập / chọn không điều khiển xe
    if (!DR_KEYS.has(e.code)) return;
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();   // không cuộn trang, Space không bấm nút đang focus
    drKeys.add(e.code);
  });
  window.addEventListener('keyup', (e) => {
    drKeys.delete(e.code);
    if (e.code === 'Space' && active() && !isField(e.target)) e.preventDefault();
  });
  const drop = drBindDrop(window, document, drKeys);
  window.addEventListener('focusin', (e) => { if (active() && isField(e.target)) { drop(); touch?.reset(); drSound.horn(false); } });
  /* Tab ẩn hoặc mất tiêu điểm: vòng khung có thể dừng nên tắt còi ngay (phím đã nhả ở drBindDrop, cảm ứng tự reset trong touch.ts) */
  window.addEventListener('blur', () => drSound.horn(false));
  document.addEventListener('visibilitychange', () => { if (document.hidden) drSound.horn(false); });
  const hud = document.getElementById('drHud');
  if (hud) touch = drTouchBind(hud, {
    look: (dx, dy) => { if (active()) drCamDrag(camS, dx, dy); },
    activity: () => { /* Task 11: exMulti.activity() */ }
  });
  /* Kéo chuột trái trên canvas: xoay camera quanh xe (ngón tay vuốt #drLook trong touch.ts) */
  let dragId = -1, lx = 0, ly = 0;
  canvas.addEventListener('pointerdown', (e) => {
    if (!active() || e.pointerType === 'touch' || e.button !== 0) return;
    dragId = e.pointerId; lx = e.clientX; ly = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== dragId) return;
    drCamDrag(camS, e.clientX - lx, e.clientY - ly);
    lx = e.clientX; ly = e.clientY;
  });
  const end = (e: PointerEvent) => { if (e.pointerId === dragId) dragId = -1; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('lostpointercapture', end);
}
