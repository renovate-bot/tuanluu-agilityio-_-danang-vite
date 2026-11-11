/* ============================ Đi dạo: điều phối chế độ (một mình hoặc nhiều người, máy tính) ============================
   Nối bản đồ va chạm (map / mapData / sceneData), chuyển động (motion), nhân vật (avatars), camera sau lưng (camera) với vòng animate, phím, chuột.
   `?explore=stroll` vào thẳng, đi một mình (explore/index.ts gọi start). Esc và nút Thoát dùng explore.exit() (tải lại trang, D-020).
   - Bản đồ dựng lần đầu vào chế độ: dữ liệu tĩnh + nhà / chân đế thu từ cảnh đã dựng (chỉ đọc, sau mọi rand()).
   - Nhịp quay Cầu sông Hàn đóng với người đi dạo khi cầu rời trạng thái CLOSED (spec §3 mục 13); không tự quay, không tăng tốc quay.
   - Ban đêm Cầu Rồng tự phun như khi bay dù (exNightStep, không đụng cầu quay).
   - Không có nhảy (D-030): Space chỉ bị chặn hành vi mặc định (không cuộn trang, không bấm nút đang focus), không vào keys.
   - Phím chỉ ghi khi đang đi dạo, bỏ qua ô nhập và tổ hợp Ctrl / Meta / Alt; blur, ẩn tab, focus vào ô nhập thì xóa hết phím (Review Focus 3).
   - Nhiều người (exMulti, phiên kind 'walk'): xuất phát theo slot đi dạo, gửi vị trí + dáng; hết chỗ thì chế độ xem (startWatching) đặt camera sau lưng người được xem.
     Đổi phiên như dù lượn: bị thu chỗ → xem; mất kết nối khi đang đi → đi tiếp một mình + thông báo; mất kết nối khi xem → thoát, màn chọn báo mất kết nối.
   - Rời máy: phím điều khiển, kéo chuột và chạm cảm ứng gọi exMulti.activity().
   - Cảm ứng (touch.ts, #stHud): cần gạt ghi đè phím khi đang được giữ; vuốt nửa phải xoay camera; 📷 và phím P gọi stPhoto (photo.ts: chụp canvas sau lệnh vẽ chính).
   Mỗi khung không cấp phát (D-018). */
import { scene, camera, controls, canvas } from '../../core/renderer';
import { cam, keys } from '../../views/state';
import { CONFIG } from '../../config';
import { stSetGate, type StMap } from './map';
import { ST_GATE_SWING, stBuildStaticMap } from './mapData';
import { stCreate, stStep, stPhotoPose, type StState, type StInput } from './motion';
import { stPhotoRequest, stPhotoAfterRender, stPhotoLast } from './photo';
import { stAvatars } from './avatars';
import { stCollectRuntime } from './sceneData';
import { stCamPlace, stCamDrag, type StCam } from './camera';
import { stInputFromKeys, stKeyName } from './keys';
import { stTouchBind } from './touch';
import { exNightStep } from '../nightShows';
import { exMulti } from '../multi';
import { exWatchShow, exWatchHide, exWatchRender, exFlyNotice } from '../multi/watch';
import type { SwingController } from '../../bridges/song-han/SwingController';

const ST_SOLO_SLOT = -1;     // stCreate / stSpawn: đi một mình đứng giữa các điểm xuất phát
const ST_SOLO_AVATAR = 0;    // instance nhân vật khi đi một mình (avatars.ts)

let map: StMap | null = null;
let state: StState | null = null;
let ctrl: SwingController | null = null;
let exit: () => void = () => {};   // thoát chung (explore.exit), do setupStroll nhận
let selfSlot = ST_SOLO_AVATAR;   // instance nhân vật của mình: slot đi dạo khi có chỗ, giữ nguyên khi mất kết nối (màu áo không đổi)
let watching = false;        // đang xem người khác đi dạo (hết chỗ hoặc vừa nhường chỗ): không có nhân vật của mình, không đọc phím
let touch: ReturnType<typeof stTouchBind> | null = null;   // điều khiển cảm ứng (setupStroll dựng)
let chased = false;          // camera đã bám người được xem lần nào chưa (lần đầu đặt thẳng, không trượt từ xa)
const camS: StCam = { yaw: 0, pitch: CONFIG.stroll.cam.pitch };
const _inp: StInput = { mx: 0, mz: 0, run: false, camYaw: 0 };   // đầu vào tái dùng mỗi khung

const active = () => cam.mode === 'stroll' && state !== null;
const inMode = () => active() || watching;   // Esc và giao diện đi dạo áp cho cả chế độ xem
/* Chụp ảnh (nút 📷, phím P): giơ tay (dáng 4, tới người khác qua gói vị trí kế tiếp), chớp màn hình, xếp yêu cầu chụp cho sau lệnh vẽ */
let flashTimer = 0;
function stPhoto(): void {
  if (!active()) return;
  stPhotoPose(state!);
  const f = document.getElementById('stFlash');
  if (f) { f.classList.add('on'); clearTimeout(flashTimer); flashTimer = window.setTimeout(() => f.classList.remove('on'), CONFIG.stroll.flashMs); }
  stPhotoRequest();
}
const isField = (t: EventTarget | null) => !!t && /^(SELECT|INPUT|TEXTAREA)$/.test((t as HTMLElement).tagName || '');

/* Một bước: cổng nhịp quay, chuyển động, nhân vật, camera, hiệu ứng đêm, người chơi khác */
function advance(dt: number, inp: StInput): void {
  if (ctrl) stSetGate(map!, ST_GATE_SWING, ctrl.state !== 'CLOSED');
  stStep(state!, inp, map!, dt);
  stAvatars.setSelf(selfSlot, state);
  stCamPlace(camera, controls.target, state!, camS, map!, dt);
  exNightStep(dt, false);
  const now = performance.now();
  exMulti.update(dt, now, null);   // người khác (đi dạo + bay), nhãn tên; không làm gì khi đi một mình
  exMulti.updateWalk(now, state);  // gửi vị trí + dáng khi đang giữ chỗ
}

/* Mỗi khung khi xem: người khác, nhãn, danh sách; camera sau lưng người được xem (hướng camera = hướng mặt họ). Không có ai thì camera giữ nguyên */
function watchStep(dt: number): void {
  if (ctrl) stSetGate(map!, ST_GATE_SWING, ctrl.state !== 'CLOSED');
  exMulti.update(dt, performance.now(), null);
  const w = exMulti.watchWalker();
  if (w) { camS.yaw = w.yaw; stCamPlace(camera, controls.target, w, camS, map!, dt, !chased); chased = true; }
  exNightStep(dt, false);
}

/* Đổi phiên khi đang xem hoặc đang đi: vào đi, mất kết nối, bị thu hồi chỗ (như onMultiChange của dù lượn) */
function stOnMultiChange(): void {
  const s = exMulti.session; if (!s) return;
  if (watching) {
    if (s.phase === 'flying') { stroll.start(); return; }   // chấp nhận lời mời: xuất phát như vào đi thường
    if (s.phase === 'solo') { try { sessionStorage.setItem('exMpNotice', 'lostWalk'); } catch { /* bộ nhớ bị chặn */ } exit(); return; }   // màn chọn đọc cờ này và hiện stLostChooser (nhắc Đi dạo, không phải Dù lượn)
    exWatchRender();
  } else if (active()) {
    if (s.phase === 'watching') { state = null; stAvatars.setSelf(selfSlot, null); stroll.startWatching(true); return; }   // chỗ bị thu hồi (rời máy): sang xem, camera giữ nguyên
    if (s.phase === 'solo' && s.notice === 'lost') exFlyNotice(s, 'stLost');   // vẫn đi, người khác đã biến mất
  }
}

/* Bản đồ dựng lần đầu vào chế độ (đi hoặc xem); cổng nhịp quay theo cầu hiện tại */
function stEnsureMap(): StMap {
  if (!map) { map = stBuildStaticMap(); stCollectRuntime(map); }
  if (ctrl) stSetGate(map, ST_GATE_SWING, ctrl.state !== 'CLOSED');
  return map;
}

export const stroll = {
  active,
  inMode,
  get watching(): boolean { return watching; },
  get state(): StState | null { return state; },
  get map(): StMap | null { return map; },
  get cam(): StCam { return camS; },
  /* Vào đi: một mình (không phiên / ngoại tuyến) hoặc với slot đi dạo vừa được cấp (xuất phát lệch theo slot) */
  start(): void {
    if (watching) { watching = false; document.body.classList.remove('ex-watching'); exWatchHide(); }
    const m = stEnsureMap(), s = exMulti.session;
    const slot = s && s.kind === 'walk' && s.mySlot >= 0 ? s.mySlot : ST_SOLO_SLOT;
    if (s) exMulti.onChange = stOnMultiChange;
    selfSlot = slot >= 0 ? slot : ST_SOLO_AVATAR;
    state = stCreate(m, slot);
    camS.yaw = state.yaw; camS.pitch = CONFIG.stroll.cam.pitch;
    const mesh = stAvatars.build();
    if (!mesh.parent) scene.add(mesh);
    stAvatars.setSelf(selfSlot, state);
    keys.clear(); if (touch) touch.reset();
    cam.flight.then = null; cam.mode = 'stroll'; controls.enabled = false;
    stCamPlace(camera, controls.target, state, camS, m, 0, true);
    document.body.classList.add('explore', 'stroll');
  },
  /* Chế độ xem: cam.mode = 'stroll' nhưng không có nhân vật của mình; carry = true khi vừa nhường chỗ (camera đang ở sau lưng mình, trượt dần sang người được xem) */
  startWatching(carry = false): void {
    const s = exMulti.session; if (!s) return;
    stEnsureMap();
    const mesh = stAvatars.build();
    if (!mesh.parent) scene.add(mesh);
    watching = true; chased = carry; state = null;
    keys.clear();
    camS.pitch = CONFIG.stroll.cam.pitch;
    cam.flight.then = null; cam.mode = 'stroll'; controls.enabled = false;
    document.body.classList.add('explore', 'stroll', 'ex-watching');
    exMulti.onChange = stOnMultiChange;
    exWatchShow(s);
  },
  update(dt: number): void {
    if (watching) { watchStep(dt); return; }
    if (!active()) return;
    stInputFromKeys(keys, camS.yaw, _inp);
    if (touch) touch.read(_inp);   // cần gạt đang giữ thì ghi đè hướng và chạy của phím
    advance(dt, _inp);
  },
  photo: stPhoto,
  /* Gọi ngay sau lệnh vẽ khung chính (main.ts): chụp canvas nếu có yêu cầu */
  afterRender(): void { stPhotoAfterRender(canvas); },
  get photoLast() { return stPhotoLast; },
  /* Cho test: như update nhưng nhận đầu vào trực tiếp */
  step(dt: number, inp: StInput): void {
    if (active()) advance(dt, inp);
  }
};

/* onExit: thoát chung (explore.exit), dùng khi mất kết nối lúc đang xem */
export function setupStroll(c: SwingController, onExit: () => void): void {
  ctrl = c; exit = onExit;
  window.addEventListener('keydown', (e) => {
    if (!active() || e.key === 'Escape') return;   // Esc do explore/index.ts xử lý (thoát chung); đang xem: không đọc phím
    if (e.ctrlKey || e.metaKey || e.altKey) return;   // phím tắt trình duyệt không điều khiển nhân vật, tránh kẹt phím
    if (isField(e.target)) return;                    // gõ trong ô nhập / chọn không điều khiển nhân vật
    exMulti.activity();   // phím điều khiển (kể cả tự lặp) tính là còn đó
    const k = stKeyName(e);   // theo vị trí phím (e.code): bố cục không Latin (ru, ar, th, hi) vẫn dùng WASD
    if (k === 'p') { if (!e.repeat) stPhoto(); return; }   // P chụp ảnh, không ghi vào keys
    if (k === ' ') { e.preventDefault(); return; }   // Space: không cuộn trang, không bấm nút đang focus, không điều khiển gì
    if (k.startsWith('arrow')) e.preventDefault();
    keys.add(k);
  });
  window.addEventListener('keyup', (e) => {
    const k = stKeyName(e);
    keys.delete(k); keys.delete(e.key.toLowerCase());   // cả tên cũ: phím dù lượn ghi theo e.key
    if (k === ' ' && active() && !isField(e.target)) e.preventDefault();   // Space không bấm nút đang focus
  });
  const drop = () => { keys.clear(); };
  window.addEventListener('blur', drop);
  document.addEventListener('visibilitychange', () => { if (document.hidden) drop(); });
  window.addEventListener('focusin', (e) => { if (active() && isField(e.target)) drop(); });
  const hud = document.getElementById('stHud');
  if (hud) touch = stTouchBind(hud, {
    look: (dx, dy) => { if (active()) stCamDrag(camS, dx, dy, CONFIG.stroll.cam.touch); },
    photo: stPhoto,
    activity: () => exMulti.activity()
  });
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
    exMulti.activity();   // xoay camera cũng tính là còn đó
    lx = e.clientX; ly = e.clientY;
  });
  const end = (e: PointerEvent) => { if (e.pointerId === dragId) dragId = -1; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('lostpointercapture', end);
}
