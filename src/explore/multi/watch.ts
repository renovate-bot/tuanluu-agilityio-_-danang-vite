/* ===== Dù lượn và đi dạo nhiều người: giao diện chế độ xem và các thông báo =====
   Chữ theo session.kind: khóa exMp* (dù lượn) hoặc st* (đi dạo); tên người đang xem lấy từ exRemotes hoặc stAvatars.
   #exMpWatch "Đang xem: tên", #exMpInvite (lời mời khi còn chỗ: ô tên nếu chưa có tên hợp lệ + nút vào bay), #exMpNotice (late / released / lost).
   late tự ẩn sau lateMs, released (khi xem) và lost (khi bay) tự ẩn sau noticeMs; nameBad giữ tới khi gõ tên khác.
   Không điều khiển camera hay phiên: explore/index.ts gọi exWatchShow / exWatchRender / exWatchHide và tự xử lý chuyển pha.
   Mọi tên người khác chỉ ghi bằng textContent, bọc trong cặp cô lập hướng chữ để tên RTL không làm lệch câu. */
import { CONFIG } from '../../config';
import { t, onChange as onLang } from '../../i18n';
import { exSanitizeName } from './protocol';
import { exRemotes } from './remote';
import { stAvatars } from '../stroll/avatars';
import { loadName, saveName } from './lobby';
import type { MultiSession } from './session';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

let session: MultiSession | null = null;
let bound = false;
let pending = false;       // đã bấm vào bay, chờ máy chủ trả lời: nút khóa để không gửi hai lần
let pendingTimer = 0;
let lateUntil = 0;         // mốc (ms) hết hạn hiện exMpLate
let lateTimer = 0;
let relUntil = 0;          // mốc (ms) hết hạn hiện exMpReleased; 0 = chưa hiện trong lần xem này
let relTimer = 0;
let flyKey = '';           // thông báo khi bay đã hiện (không hiện lại sau khi tự ẩn)
let flyTimer = 0;
let rejected: string | null = null;   // tên máy chủ vừa từ chối: không dùng lại, không nhớ
let noticeKey = '';        // khóa đang hiện ở #exMpNotice ('' = ẩn)

/* Tên hợp lệ đã biết: tên đã dùng trong phiên, hoặc tên nhớ ở sảnh; bỏ tên máy chủ đã từ chối */
const okName = (n: string): string | null => { const v = exSanitizeName(n); return v !== null && v !== rejected ? v : null; };
const knownName = (): string | null => (session && okName(session.name)) || okName(loadName());

/* Ghi/ẩn #exMpNotice (dùng cả khi đang bay: mất kết nối) */
export function exWatchNotice(key: string): void {
  noticeKey = key;
  const el = $('exMpNotice');
  el.textContent = key ? t(key) : '';
  el.hidden = !key;
}

function unlock(): void { pending = false; clearTimeout(pendingTimer); }

/* Hiện exMpLate thêm lateMs từ bây giờ */
function armLate(): void {
  lateUntil = performance.now() + CONFIG.explore.multi.lateMs;
  clearTimeout(lateTimer); lateTimer = window.setTimeout(exWatchRender, CONFIG.explore.multi.lateMs + 50);
}

function accept(): void {
  if (!session || session.phase !== 'watching' || pending) return;
  const input = $<HTMLInputElement>('exMpInviteName');
  const name = knownName() ?? exSanitizeName(input.value);
  if (name === null) return;
  pending = true; clearTimeout(pendingTimer);
  pendingTimer = window.setTimeout(() => { pending = false; exWatchRender(); }, CONFIG.explore.multi.pendingMs);
  session.join(name);   // join xóa notice cũ trước khi vẽ lại, nếu không nameBad cũ sẽ mở khóa nút ngay
  exWatchRender();
}

/* Lời mời: ghi chữ theo loại và nhớ khóa ở data-i18n để đổi ngôn ngữ dịch đúng */
function inviteKeys(walk: boolean): void {
  for (const [id, fly, st] of [['exMpInviteText', 'exMpInvite', 'stInvite'], ['exMpInviteFly', 'exMpInviteFly', 'stInviteGo']]) {
    const el = $(id), key = walk ? st : fly;
    if (el.dataset.i18n !== key) { el.dataset.i18n = key; el.textContent = t(key); }
  }
}

export function exWatchRender(): void {
  const s = session;
  if (!s || s.phase !== 'watching') return;
  /* Dòng "Đang xem" */
  const walk = s.kind === 'walk';
  const nm = s.watched >= 0 ? (walk ? stAvatars.name(s.watched) : exRemotes.name(s.watched)) : null;
  const w = $('exMpWatch');
  w.hidden = nm === null;
  w.textContent = nm === null ? '' : t(walk ? 'stWatch' : 'exMpWatching', { name: '\u2068' + nm + '\u2069' });
  /* Thông báo từ phiên: nút đã có trả lời thì mở khóa */
  if (pending && (s.notice === 'late' || s.notice === 'nameBad')) {
    unlock();
    if (s.notice === 'late') armLate();
  }
  if (s.notice === 'nameBad' && s.name !== rejected) {   // tên bị từ chối: quên tên đó (cả bản đã nhớ), hiện lại ô nhập để gõ tên khác
    rejected = s.name;
    if (exSanitizeName(loadName()) === rejected) saveName('');
    $<HTMLInputElement>('exMpInviteName').value = '';
  }
  let key = '';
  if (s.notice === 'late') key = performance.now() < lateUntil ? (walk ? 'stLate' : 'exMpLate') : '';
  else if (s.notice === 'released') {
    const now = performance.now();
    if (!relUntil) { relUntil = now + CONFIG.explore.multi.noticeMs; clearTimeout(relTimer); relTimer = window.setTimeout(exWatchRender, CONFIG.explore.multi.noticeMs + 50); }
    key = now < relUntil ? (walk ? 'stReleased' : 'exMpReleased') : '';
  }
  else if (s.notice === 'nameBad') key = 'exMpNameBad';
  exWatchNotice(key);
  /* Lời mời */
  const inv = $('exMpInvite'), input = $<HTMLInputElement>('exMpInviteName'), btn = $<HTMLButtonElement>('exMpInviteFly');
  inv.hidden = !s.invite;
  inviteKeys(walk);
  const needName = knownName() === null;
  input.hidden = !needName;
  btn.disabled = pending || (needName && exSanitizeName(input.value) === null);
}

/* Bắt đầu hiện giao diện xem cho phiên s */
export function exWatchShow(s: MultiSession): void {
  session = s; unlock(); lateUntil = 0; relUntil = 0; rejected = null;
  if (s.notice === 'late') armLate();   // bị giành chỗ ngay ở sảnh: vào xem kèm lý do
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
  if (session && session.phase === 'flying') { const n = exSanitizeName(session.name); if (n !== null) saveName(n); }   // máy chủ đã nhận tên: bấy giờ mới nhớ
  session = null; unlock(); clearTimeout(lateTimer); clearTimeout(relTimer);
  $('exMpWatch').hidden = true; $('exMpInvite').hidden = true;
  exWatchNotice('');
}

/* Khi đang bay: hiện một thông báo (mất kết nối) một lần, tự ẩn sau noticeMs; đổi ngôn ngữ thì dịch lại */
export function exFlyNotice(s: MultiSession, key: string): void {
  session = s;   // để onLang dịch lại
  if (key === flyKey) return;
  flyKey = key;
  exWatchNotice(key);
  clearTimeout(flyTimer);
  if (key) flyTimer = window.setTimeout(() => { if (noticeKey === key) exWatchNotice(''); }, CONFIG.explore.multi.noticeMs);
}
