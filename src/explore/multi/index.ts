/* ===== Dù lượn và đi dạo nhiều người: điều phối phía khách =====
   Nối MultiSession (kết nối, phiên) với exRemotes (dù người khác), stAvatars (người đi dạo khác), nhãn tên và danh sách người chơi.
   Người bay thấy người đi dạo và ngược lại; mỗi phiên chỉ giữ một loại chỗ (session.kind).
   Chỉ mở kết nối khi có người gọi begin(); ?test mà không có multi= thì url() rỗng nên không bao giờ mở WebSocket. */
import { scene, camera } from '../../core/renderer';
import { CONFIG } from '../../config';
import { t, onChange as onLang } from '../../i18n';
import { exConnect } from './client';
import { MultiSession } from './session';
import { exRemotes } from './remote';
import { exLabelsUpdate, exLabelsClear } from './labels';
import { ExIdle } from './idle';
import { stAvatars } from '../stroll/avatars';
import type { Kind } from './protocol';
import type { GliderState } from '../flight';
import type { StState } from '../stroll/motion';

const M = CONFIG.explore.multi;
let session: MultiSession | null = null;
let sentAt = -1e9;
let rosterKey = '';
let idle: ExIdle | null = null;
let idleTimer = 0, beatTimer = 0;   // setInterval kiểm tra rời máy + nhịp sống; chỉ chạy khi đang bay
let idleShown = '';                 // chữ đang hiện ở #exMpIdle ('' = ẩn): chỉ ghi DOM khi đổi

/* ===== Rời máy: đếm bằng setInterval (tab ẩn vẫn đếm), hết hạn thì trả slot và sang chế độ xem ===== */
/* ?idleMs / ?idleWarnMs chỉ đọc khi có ?test (để test rút ngắn) */
function idleParams(): [number, number] {
  const q = new URLSearchParams(location.search);
  if (!q.has('test')) return [M.idleMs, M.idleWarnMs];
  const n = (k: string, d: number) => { const v = Number(q.get(k)); return q.has(k) && v > 0 ? v : d; };
  return [n('idleMs', M.idleMs), n('idleWarnMs', M.idleWarnMs)];
}

function idleShow(text: string): void {
  const el = document.getElementById('exMpIdle');
  if (!el || text === idleShown) return;
  /* Lần đầu hiện thì đọc to một lần; các giây sau chỉ đổi chữ, không đọc lại */
  el.setAttribute('aria-live', idleShown === '' ? 'polite' : 'off');
  idleShown = text;
  el.textContent = text;
  el.hidden = text === '';
}

function idleTick(): void {
  if (!session || !idle || session.phase !== 'flying') return;
  const now = performance.now();
  const st = idle.tick(now);
  if (st === 'ok') idleShow('');
  else if (st === 'warn') idleShow(t('exMpIdle', { s: idle.remaining(now) }));
  else { idleShow(''); session.leave(); }   // leave → onChange → idleStop
}

function idleStart(): void {
  if (idleTimer || !session) return;   // đã chạy: không mở hai đồng hồ
  const [a, b] = idleParams();
  idle = new ExIdle(a, b); idle.reset(performance.now());
  idleShown = '';
  idleTimer = window.setInterval(idleTick, M.idleTickMs);
  beatTimer = window.setInterval(() => session?.heartbeat(), M.heartbeatMs);
}

function idleStop(): void {
  clearInterval(idleTimer); clearInterval(beatTimer);
  idleTimer = beatTimer = 0; idle = null;
  idleShow('');
}

/* Danh sách người chơi ở góc màn hình: đầu "Đi dạo n/5 · Bay n/5", rồi nhóm người đi dạo (chấm vuông) và nhóm người bay (chấm tròn),
   mỗi người một dòng có chấm màu theo slot; dòng của mình đậm. Dùng textContent */
function renderRoster(): void {
  const box = document.getElementById('exMpRoster');
  if (!box) return;
  const flyers = session ? session.flyers : [], walkers = session ? session.walkers : [];
  const head = t('stRoster', { w: walkers.length, f: flyers.length });
  const kind = session ? session.kind : 'fly', mine = session ? session.mySlot : -1;
  const key = walkers.map(f => f.slot + ':' + f.name).join('|') + '#' + flyers.map(f => f.slot + ':' + f.name).join('|') + '#' + kind + mine + '#' + head;
  if (key === rosterKey) return;
  rosterKey = key;
  box.hidden = !session || session.phase === 'solo';
  box.textContent = '';
  const h = document.createElement('div'); h.className = 'ex-mp-head'; h.textContent = head; box.appendChild(h);
  const group = (list: typeof flyers, k: 'fly' | 'walk') => {
    for (const f of list) {
      const row = document.createElement('div'); row.className = 'ex-mp-row' + (k === 'walk' ? ' walk' : '') + (k === kind && f.slot === mine ? ' me' : '');
      const dot = document.createElement('i'); dot.style.background = M.colors[f.slot % M.colors.length];
      const nm = document.createElement('span'); nm.textContent = f.name;
      row.append(dot, nm); box.appendChild(row);
    }
  };
  group(walkers, 'walk'); group(flyers, 'fly');
}

/* Người đi dạo hiện cho cả người bay: dựng nhóm nhân vật (lười) lần đầu phòng có người đi dạo; mô hình có xương nạp khi slot đầu tiên hiện */
function stEnsureAvatars(): void {
  const mesh = stAvatars.build();
  if (!mesh.parent) scene.add(mesh);
}

export const exMulti = {
  /* Địa chỉ máy chủ: có ?test thì ?multi= nếu có, không có thì rỗng (không mở mạng); không có ?test thì luôn là địa chỉ cấu hình (người ngoài không đổi được máy chủ qua URL) */
  url(): string {
    const q = new URLSearchParams(location.search);
    if (!q.has('test')) return M.url;
    return q.get('multi') ?? '';
  },
  get session(): MultiSession | null { return session; },
  onChange: (() => {}) as () => void,   // móc cho giao diện sảnh (Task 6) và test

  /* Mở phiên loại kind ('fly' giành chỗ bay, 'walk' giành chỗ đi dạo); onReady gọi một lần khi có thông tin đầu tiên (sảnh hoặc ngoại tuyến). Trả false nếu không có địa chỉ */
  begin(onReady: () => void, kind: Kind = 'fly'): boolean {
    const url = exMulti.url();
    if (!url || session) return false;
    const s = session = new MultiSession(() => exConnect(url, M.connectTimeoutMs), undefined, kind);
    let ready = false;
    s.onPos = f => exRemotes.onPos(f, performance.now());
    s.onWalkPos = w => stAvatars.onPos(w, performance.now());
    s.onChange = () => {
      exRemotes.sync(s.flyers, s.kind === 'fly' ? s.mySlot : -1);   // slot đi dạo và slot bay là hai nhóm: số slot của mình chỉ loại trừ trong nhóm của mình
      if (s.walkers.length || stAvatars.mesh) { stEnsureAvatars(); stAvatars.sync(s.walkers, s.kind === 'walk' ? s.mySlot : -1); }
      if (s.phase === 'solo') exLabelsClear();
      renderRoster();
      if (s.phase === 'flying') idleStart(); else idleStop();
      exMulti.onChange();
      if (!ready) { ready = true; onReady(); }
    };
    s.open();
    return true;
  },

  /* Đóng phiên (Quay lại / Esc ở sảnh, hoặc chọn Bay một mình khi có máy chủ): đóng WebSocket, ẩn dù người khác, nhãn, danh sách; begin() mở lại được */
  end(): void {
    if (!session) return;
    session.dispose(); session = null;
    exMulti.onChange = () => {};
    idleStop(); exRemotes.clear(); stAvatars.clear(); exLabelsClear();
    rosterKey = ''; renderRoster();
  },

  /* Mỗi khung (bay, đi dạo hoặc xem): dù người khác, người đi dạo khác, nhãn; đang bay thì gửi vị trí sendHz lần/s (state = null: không gửi) */
  update(_dt: number, nowMs: number, state: GliderState | null): void {
    if (!session) return;
    exRemotes.update(nowMs);
    if (stAvatars.mesh) stAvatars.update(nowMs);   // người đi dạo khác, kể cả khi mình bay dù
    exLabelsUpdate(camera, exRemotes, nowMs, stAvatars);
    if (state && session.kind === 'fly' && session.phase === 'flying' && nowMs - sentAt >= 1000 / M.sendHz) {
      sentAt = nowMs;
      const p = state.pos, r = (v: number) => Math.round(v * 10) / 10, a = (v: number) => Math.round(v * 1000) / 1000;
      session.sendPos(r(p.x), r(p.y), r(p.z), a(state.yaw), a(state.bank), Math.round(nowMs));
    }
  },

  /* Mỗi khung khi đi dạo có chỗ: gửi vị trí + dáng sendHz lần/s (s = null: không gửi) */
  updateWalk(nowMs: number, s: StState | null): void {
    if (!session || !s || session.kind !== 'walk' || session.phase !== 'flying' || nowMs - sentAt < 1000 / M.sendHz) return;
    sentAt = nowMs;
    const r = (v: number) => Math.round(v * 100) / 100, a = (v: number) => Math.round(v * 1000) / 1000;
    session.sendWalk(r(s.x), r(s.y), r(s.z), a(s.yaw), s.pose, Math.round(nowMs));
  },

  /* Người chơi vừa bấm phím điều khiển: đếm lại thời gian rời máy */
  activity(): void {
    if (!idle) return;
    idle.activity(performance.now());
    idleShow('');
  },

  /* Trạng thái dù đang xem (khi hết chỗ, Task 6); null nếu không xem ai */
  watchState(): GliderState | null {
    return session && session.kind === 'fly' && session.phase === 'watching' ? exRemotes.slotState(session.watched) : null;
  },

  /* Trạng thái người đi dạo đang xem (hết chỗ đi dạo); null nếu không xem ai */
  watchWalker(): { x: number; y: number; z: number; yaw: number; pose: number } | null {
    return session && session.kind === 'walk' && session.phase === 'watching' && session.watched >= 0 ? stAvatars.slotState(session.watched) : null;
  }
};

onLang(() => { rosterKey = ''; renderRoster(); });
