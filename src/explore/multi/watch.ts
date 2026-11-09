/* ===== Dù lượn nhiều người: giao diện chế độ xem và các thông báo =====
   #exMpWatch "Đang xem: tên", #exMpInvite (lời mời khi còn chỗ: ô tên nếu chưa có tên hợp lệ + nút vào bay), #exMpNotice (late / released / lost).
   Không điều khiển camera hay phiên: explore/index.ts gọi exWatchShow / exWatchRender / exWatchHide và tự xử lý chuyển pha.
   Mọi tên người khác chỉ ghi bằng textContent, bọc trong cặp cô lập hướng chữ để tên RTL không làm lệch câu. */
import { t, onChange as onLang } from '../../i18n';
import { exSanitizeName } from './protocol';
import { exRemotes } from './remote';
import { loadName, saveName } from './lobby';
import type { MultiSession } from './session';

const LATE_MS = 5000;   // ms hiện "chỗ vừa bị giành" rồi tự ẩn (ước lượng)
const PENDING_MS = 4000;   // ms tối đa khóa nút khi chờ máy chủ trả lời (ước lượng)
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

let session: MultiSession | null = null;
let bound = false;
let pending = false;       // đã bấm vào bay, chờ máy chủ trả lời: nút khóa để không gửi hai lần
let pendingTimer = 0;
let lateUntil = 0;         // mốc (ms) hết hạn hiện exMpLate
let lateTimer = 0;
let noticeKey = '';        // khóa đang hiện ở #exMpNotice ('' = ẩn)

/* Tên hợp lệ đã biết: tên đã dùng trong phiên, hoặc tên nhớ ở sảnh */
const knownName = (): string | null => (session && exSanitizeName(session.name)) || exSanitizeName(loadName());

/* Ghi/ẩn #exMpNotice (dùng cả khi đang bay: mất kết nối) */
export function exWatchNotice(key: string): void {
  noticeKey = key;
  const el = $('exMpNotice');
  el.textContent = key ? t(key) : '';
  el.hidden = !key;
}

function unlock(): void { pending = false; clearTimeout(pendingTimer); }

function accept(): void {
  if (!session || session.phase !== 'watching' || pending) return;
  const input = $<HTMLInputElement>('exMpInviteName');
  const name = knownName() ?? exSanitizeName(input.value);
  if (name === null) return;
  saveName(name);
  pending = true; clearTimeout(pendingTimer);
  pendingTimer = window.setTimeout(() => { pending = false; exWatchRender(); }, PENDING_MS);
  exWatchRender();
  session.join(name);
}

export function exWatchRender(): void {
  const s = session;
  if (!s || s.phase !== 'watching') return;
  /* Dòng "Đang xem" */
  const nm = s.watched >= 0 ? exRemotes.name(s.watched) : null;
  const w = $('exMpWatch');
  w.hidden = nm === null;
  w.textContent = nm === null ? '' : t('exMpWatching', { name: '\u2068' + nm + '\u2069' });
  /* Thông báo từ phiên: nút đã có trả lời thì mở khóa */
  if (pending && (s.notice === 'late' || s.notice === 'nameBad')) {
    unlock();
    if (s.notice === 'late') { lateUntil = performance.now() + LATE_MS; clearTimeout(lateTimer); lateTimer = window.setTimeout(exWatchRender, LATE_MS + 50); }
  }
  let key = '';
  if (s.notice === 'late') key = performance.now() < lateUntil ? 'exMpLate' : '';
  else if (s.notice === 'released') key = 'exMpReleased';
  else if (s.notice === 'nameBad') key = 'exMpNameBad';
  exWatchNotice(key);
  /* Lời mời */
  const inv = $('exMpInvite'), input = $<HTMLInputElement>('exMpInviteName'), btn = $<HTMLButtonElement>('exMpInviteFly');
  inv.hidden = !s.invite;
  const needName = knownName() === null;
  input.hidden = !needName;
  btn.disabled = pending || (needName && exSanitizeName(input.value) === null);
}

/* Bắt đầu hiện giao diện xem cho phiên s */
export function exWatchShow(s: MultiSession): void {
  session = s; unlock(); lateUntil = 0;
  if (!bound) {
    bound = true;
    $('exMpInviteFly').addEventListener('click', accept);
    const input = $<HTMLInputElement>('exMpInviteName');
    input.addEventListener('input', exWatchRender);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); accept(); } });   // Esc để lọt lên trình nghe chung (thoát)
    onLang(() => { if (session) { exWatchRender(); if (noticeKey && session.phase !== 'watching') exWatchNotice(noticeKey); } });
  }
  exWatchRender();
}

/* Gỡ giao diện xem (vào bay, hoặc thoát) */
export function exWatchHide(): void {
  session = null; unlock(); clearTimeout(lateTimer);
  $('exMpWatch').hidden = true; $('exMpInvite').hidden = true;
  exWatchNotice('');
}

/* Khi đang bay: hiện một thông báo (mất kết nối); đổi ngôn ngữ thì dịch lại */
export function exFlyNotice(s: MultiSession, key: string): void {
  session = s;   // để onLang dịch lại
  exWatchNotice(key);
}
