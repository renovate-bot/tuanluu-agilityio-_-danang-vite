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
import type { GliderState } from '../flight';

const M = CONFIG.explore.multi;
let session: MultiSession | null = null;
let sentAt = -1e9;
let rosterKey = '';

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
  /* Địa chỉ máy chủ: ?multi= nếu có; ?test không có multi= thì rỗng (không mở mạng); còn lại cấu hình */
  url(): string {
    const q = new URLSearchParams(location.search);
    const u = q.get('multi');
    if (u !== null) return u;
    return q.has('test') ? '' : M.url;
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
      exMulti.onChange();
      if (!ready) { ready = true; onReady(); }
    };
    s.open();
    return true;
  },

  /* Mỗi khung khi đang bay: dù người khác, nhãn, gửi vị trí sendHz lần/s */
  update(_dt: number, nowMs: number, state: GliderState | null): void {
    if (!session) return;
    exRemotes.update(nowMs);
    exLabelsUpdate(camera, exRemotes, nowMs);
    if (state && session.phase === 'flying' && nowMs - sentAt >= 1000 / M.sendHz) {
      sentAt = nowMs;
      const p = state.pos, r = (v: number) => Math.round(v * 10) / 10, a = (v: number) => Math.round(v * 1000) / 1000;
      session.sendPos(r(p.x), r(p.y), r(p.z), a(state.yaw), a(state.bank));
    }
  },

  /* Trạng thái dù đang xem (khi hết chỗ, Task 6); null nếu không xem ai */
  watchState(): GliderState | null {
    return session && session.phase === 'watching' ? exRemotes.slotState(session.watched) : null;
  }
};

onLang(() => { rosterKey = ''; renderRoster(); });
