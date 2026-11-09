/* ===== Dù lượn nhiều người: điều phối phía khách =====
   Nối MultiSession (kết nối, phiên) với exRemotes (dù người khác), nhãn tên và danh sách người bay.
   Chỉ mở kết nối khi có người gọi begin(); ?test mà không có multi= thì url() rỗng nên không bao giờ mở WebSocket. */
import { camera } from '../../core/renderer';
import { CONFIG } from '../../config';
import { t, onChange as onLang } from '../../i18n';
import { exConnect } from './client';
import { MultiSession } from './session';
import { exRemotes } from './remote';
import { exLabelsUpdate, exLabelsClear } from './labels';
import { ExIdle } from './idle';
import type { GliderState } from '../flight';

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

/* Danh sách người bay ở góc màn hình: đầu "Đang bay n/5", mỗi người một dòng có chấm màu theo slot; dùng textContent */
function renderRoster(): void {
  const box = document.getElementById('exMpRoster');
  if (!box) return;
  const flyers = session ? session.flyers : [];
  const head = t('exMpFlying', { n: flyers.length });
  const key = flyers.map(f => f.slot + ':' + f.name).join('|') + '#' + (session ? session.mySlot : -1) + '#' + head;
  if (key === rosterKey) return;
  rosterKey = key;
  box.hidden = !session || session.phase === 'solo';
  box.textContent = '';
  const h = document.createElement('div'); h.className = 'ex-mp-head'; h.textContent = head; box.appendChild(h);
  for (const f of flyers) {
    const row = document.createElement('div'); row.className = 'ex-mp-row' + (session && f.slot === session.mySlot ? ' me' : '');
    const dot = document.createElement('i'); dot.style.background = M.colors[f.slot % M.colors.length];
    const nm = document.createElement('span'); nm.textContent = f.name;
    row.append(dot, nm); box.appendChild(row);
  }
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

  /* Mở phiên; onReady gọi một lần khi có thông tin đầu tiên (sảnh hoặc ngoại tuyến). Trả false nếu không có địa chỉ */
  begin(onReady: () => void): boolean {
    const url = exMulti.url();
    if (!url || session) return false;
    const s = session = new MultiSession(() => exConnect(url, M.connectTimeoutMs));
    let ready = false;
    s.onPos = f => exRemotes.onPos(f, performance.now());
    s.onChange = () => {
      exRemotes.sync(s.flyers, s.mySlot);
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
    idleStop(); exRemotes.clear(); exLabelsClear();
    rosterKey = ''; renderRoster();
  },

  /* Mỗi khung khi đang bay: dù người khác, nhãn, gửi vị trí sendHz lần/s */
  update(_dt: number, nowMs: number, state: GliderState | null): void {
    if (!session) return;
    exRemotes.update(nowMs);
    exLabelsUpdate(camera, exRemotes, nowMs);
    if (state && session.phase === 'flying' && nowMs - sentAt >= 1000 / M.sendHz) {
      sentAt = nowMs;
      const p = state.pos, r = (v: number) => Math.round(v * 10) / 10, a = (v: number) => Math.round(v * 1000) / 1000;
      session.sendPos(r(p.x), r(p.y), r(p.z), a(state.yaw), a(state.bank), Math.round(nowMs));
    }
  },

  /* Người bay vừa bấm phím điều khiển: đếm lại thời gian rời máy */
  activity(): void {
    if (!idle) return;
    idle.activity(performance.now());
    idleShow('');
  },

  /* Trạng thái dù đang xem (khi hết chỗ, Task 6); null nếu không xem ai */
  watchState(): GliderState | null {
    return session && session.phase === 'watching' ? exRemotes.slotState(session.watched) : null;
  }
};

onLang(() => { rosterKey = ''; renderRoster(); });
