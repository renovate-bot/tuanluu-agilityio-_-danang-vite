/* ============================ Đi dạo: điều phối chế độ (một mình, máy tính) ============================
   Nối bản đồ va chạm (map / mapData / sceneData), chuyển động (motion), nhân vật (avatars), camera sau lưng (camera) với vòng animate, phím, chuột.
   `?explore=stroll` vào thẳng (explore/index.ts gọi start). Esc và nút Thoát dùng explore.exit() (tải lại trang, D-020).
   - Bản đồ dựng lần đầu vào chế độ: dữ liệu tĩnh + nhà / chân đế thu từ cảnh đã dựng (chỉ đọc, sau mọi rand()).
   - Nhịp quay Cầu sông Hàn đóng với người đi dạo khi cầu rời trạng thái CLOSED (spec §3 mục 13); không tự quay, không tăng tốc quay.
   - Ban đêm Cầu Rồng tự phun như khi bay dù (exNightStep, không đụng cầu quay).
   - Nhảy theo cạnh: một lần bấm Space một lần nhảy, giữ Space không nhảy liên tục (stStep nhảy mỗi khung jump = true khi chạm đất).
   - Phím chỉ ghi khi đang đi dạo, bỏ qua ô nhập và tổ hợp Ctrl / Meta / Alt; blur, ẩn tab, focus vào ô nhập thì xóa hết phím (Review Focus 3).
   Mỗi khung không cấp phát (D-018). */
import { scene, camera, controls, canvas } from '../../core/renderer';
import { cam, keys } from '../../views/state';
import { CONFIG } from '../../config';
import { stSetGate, type StMap } from './map';
import { ST_GATE_SWING, stBuildStaticMap } from './mapData';
import { stCreate, stStep, type StState, type StInput } from './motion';
import { stAvatars } from './avatars';
import { stCollectRuntime } from './sceneData';
import { stCamPlace, stCamDrag, type StCam } from './camera';
import { stInputFromKeys } from './keys';
import { exNightStep } from '../nightShows';
import type { SwingController } from '../../bridges/song-han/SwingController';

const ST_SOLO_SLOT = -1;     // stCreate / stSpawn: đi một mình đứng giữa các điểm xuất phát
const ST_SOLO_AVATAR = 0;    // instance nhân vật khi đi một mình (avatars.ts)

let map: StMap | null = null;
let state: StState | null = null;
let ctrl: SwingController | null = null;
let jumpQueued = false;      // Space vừa được bấm (không phải tự lặp): khung sau nhảy một lần
const camS: StCam = { yaw: 0, pitch: CONFIG.stroll.cam.pitch };
const _inp: StInput = { mx: 0, mz: 0, run: false, jump: false, camYaw: 0 };   // đầu vào tái dùng mỗi khung

const active = () => cam.mode === 'stroll' && state !== null;
const isField = (t: EventTarget | null) => !!t && /^(SELECT|INPUT|TEXTAREA)$/.test((t as HTMLElement).tagName || '');

/* Một bước: cổng nhịp quay, chuyển động, nhân vật, camera, hiệu ứng đêm */
function advance(dt: number, inp: StInput): void {
  if (ctrl) stSetGate(map!, ST_GATE_SWING, ctrl.state !== 'CLOSED');
  stStep(state!, inp, map!, dt);
  stAvatars.setSelf(ST_SOLO_AVATAR, state);
  stCamPlace(camera, controls.target, state!, camS, map!, dt);
  exNightStep(dt, false);
}

export const stroll = {
  active,
  get state(): StState | null { return state; },
  get map(): StMap | null { return map; },
  get cam(): StCam { return camS; },
  start(): void {
    if (!map) { map = stBuildStaticMap(); stCollectRuntime(map); }
    if (ctrl) stSetGate(map, ST_GATE_SWING, ctrl.state !== 'CLOSED');
    state = stCreate(map, ST_SOLO_SLOT);
    camS.yaw = state.yaw; camS.pitch = CONFIG.stroll.cam.pitch;
    const mesh = stAvatars.build();
    if (!mesh.parent) scene.add(mesh);
    stAvatars.setSelf(ST_SOLO_AVATAR, state);
    keys.clear(); jumpQueued = false;
    cam.flight.then = null; cam.mode = 'stroll'; controls.enabled = false;
    stCamPlace(camera, controls.target, state, camS, map, 0, true);
    document.body.classList.add('explore', 'stroll');
  },
  update(dt: number): void {
    if (!active()) return;
    stInputFromKeys(keys, camS.yaw, _inp);
    _inp.jump = jumpQueued; jumpQueued = false;
    advance(dt, _inp);
  },
  /* Cho test: như update nhưng nhận đầu vào trực tiếp */
  step(dt: number, inp: StInput): void {
    if (active()) advance(dt, inp);
  }
};

export function setupStroll(c: SwingController): void {
  ctrl = c;
  window.addEventListener('keydown', (e) => {
    if (!active() || e.key === 'Escape') return;   // Esc do explore/index.ts xử lý (thoát chung)
    if (e.ctrlKey || e.metaKey || e.altKey) return;   // phím tắt trình duyệt không điều khiển nhân vật, tránh kẹt phím
    if (isField(e.target)) return;                    // gõ trong ô nhập / chọn không điều khiển nhân vật
    const k = e.key.toLowerCase();
    if (k === ' ') { e.preventDefault(); if (!e.repeat) jumpQueued = true; }
    else if (k.startsWith('arrow')) e.preventDefault();
    keys.add(k);
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(e.key.toLowerCase());
    if (e.key === ' ' && active() && !isField(e.target)) e.preventDefault();   // Space không bấm nút đang focus
  });
  const drop = () => { keys.clear(); jumpQueued = false; };
  window.addEventListener('blur', drop);
  document.addEventListener('visibilitychange', () => { if (document.hidden) drop(); });
  window.addEventListener('focusin', (e) => { if (active() && isField(e.target)) drop(); });
  /* Kéo chuột trái trên canvas: xoay camera (cảm ứng ở Task 8) */
  let dragId = -1, lx = 0, ly = 0;
  canvas.addEventListener('pointerdown', (e) => {
    if (!active() || e.pointerType === 'touch' || e.button !== 0) return;
    dragId = e.pointerId; lx = e.clientX; ly = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== dragId) return;
    stCamDrag(camS, e.clientX - lx, e.clientY - ly, CONFIG.stroll.cam.mouse);
    lx = e.clientX; ly = e.clientY;
  });
  const end = (e: PointerEvent) => { if (e.pointerId === dragId) dragId = -1; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('lostpointercapture', end);
}
