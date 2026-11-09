/* ===== Dù lượn nhiều người: bước chọn slot và nhập tên (trong hộp thoại #chooser) =====
   Hiện sau khi bấm thẻ Dù lượn lúc có máy chủ: 5 chấm + "Còn N trên 5 chỗ", tên những người đang bay, ô tên, nút Bay ngay.
   Cập nhật trực tiếp theo MultiSession; tên người khác chỉ ghi bằng textContent. Tên của mình nhớ ở localStorage.
   Pha lobby: cho nhập tên và giành chỗ. Pha solo (không kết nối được): báo ngoại tuyến. Nút Bay một mình hiện ở cả hai pha (đóng phiên rồi bay một mình).
   Pha flying: gọi onFly. Pha watching (hết chỗ): gọi onWatch (chế độ xem do Task 7 làm).
   Nút Quay lại hoặc Esc: đóng phiên (đóng WebSocket), trả lại các thẻ, tiêu đề và aria-labelledby, gọi onBack để chọn lại.
   Trình nghe gắn một lần cho cả trang và đọc sảnh đang mở (cur), nên vào sảnh nhiều lần không nhân đôi. */
import { CONFIG } from '../../config';
import { t, onChange as onLang } from '../../i18n';
import { exMulti } from './index';
import { exSanitizeName } from './protocol';
import type { MultiSession } from './session';

export interface LobbyCallbacks { onFly: () => void; onWatch: () => void; onSolo: () => void; onBack: () => void }

const M = CONFIG.explore.multi;
const NAME_KEY = 'exMpName';
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export function loadName(): string { try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; } }
export function saveName(n: string): void { try { localStorage.setItem(NAME_KEY, n); } catch { /* bộ nhớ trình duyệt bị chặn */ } }

let listKey = '';
let bound = false;
let cur: { session: MultiSession; cb: LobbyCallbacks } | null = null;   // sảnh đang mở; null = đã đóng (vào bay, xem, bay một mình, quay lại)

/* Đóng sảnh rồi gọi f (một lần) */
function finish(f: () => void): void {
  if (!cur) return;
  cur = null; exMulti.onChange = () => {};
  f();
}

/* Trả hộp thoại về các thẻ: hiện tiêu đề, gắn lại aria-labelledby */
function restoreCards(): void {
  const root = $('exMpLobby'), box = root.closest('#chooser') as HTMLElement;
  root.hidden = true;
  box.querySelector<HTMLElement>('.ex-cards')!.hidden = false;
  $('exTitle').hidden = false;
  box.setAttribute('aria-labelledby', 'exTitle');
}

/* Quay lại / Esc: đóng phiên và về các thẻ */
function back(): void {
  const c = cur; if (!c) return;
  finish(() => { exMulti.end(); restoreCards(); c.cb.onBack(); });
}

/* Bay một mình (có hay không có máy chủ): đóng phiên để không gửi/nhận gì */
function solo(): void {
  const c = cur; if (!c) return;
  finish(() => { exMulti.end(); c.cb.onSolo(); });
}

function render(): void {
  if (!cur) return;
  const session = cur.session, cb = cur.cb;
  const fly = $<HTMLButtonElement>('exMpFly'), soloBtn = $<HTMLButtonElement>('exMpSolo'), input = $<HTMLInputElement>('exMpNameIn');
  const ph = session.phase;
  if (ph === 'flying') { finish(cb.onFly); return; }
  if (ph === 'watching') { finish(cb.onWatch); return; }
  const offline = ph === 'solo';
  $('exMpOnline').hidden = offline;
  $('exMpOffline').hidden = !offline;
  soloBtn.classList.toggle('ex-mp-alt', !offline);   // có máy chủ: nút phụ; ngoại tuyến: nút chính
  if (offline) { if (document.activeElement !== soloBtn) soloBtn.focus({ preventScroll: true }); return; }
  const ready = ph === 'lobby';
  const free = M.slots - session.flyers.length;
  $('exMpSeats').textContent = ready ? t('exMpSeats', { n: free }) : '…';
  $('exMpNameHint').textContent = t('exMpNameMax', { n: M.nameMax });
  const taken = new Set(session.flyers.map(f => f.slot));
  $('exMpDots').querySelectorAll<HTMLElement>('i').forEach((d, i) => {
    d.classList.toggle('on', taken.has(i));
    d.style.background = taken.has(i) ? M.colors[i % M.colors.length] : '';
  });
  const key = session.flyers.map(f => f.slot + ':' + f.name).join('|');
  if (key !== listKey) {
    listKey = key;
    const list = $('exMpList'); list.textContent = '';
    for (const f of session.flyers) {
      const row = document.createElement('div'); row.className = 'ex-mp-row';
      const dot = document.createElement('i'); dot.style.background = M.colors[f.slot % M.colors.length];
      const nm = document.createElement('span'); nm.textContent = f.name; nm.dir = 'auto';
      row.append(dot, nm); list.appendChild(row);
    }
  }
  $('exMpNameBad').hidden = session.notice !== 'nameBad';
  fly.disabled = !ready || exSanitizeName(input.value) === null;
}

function go(): void {
  if (!cur) return;
  const name = exSanitizeName($<HTMLInputElement>('exMpNameIn').value);
  if (name === null || cur.session.phase !== 'lobby') return;
  saveName(name);
  cur.session.join(name);
}

/* Gắn trình nghe một lần */
function bind(): void {
  if (bound) return;
  bound = true;
  const root = $('exMpLobby'), box = root.closest('#chooser') as HTMLElement, input = $<HTMLInputElement>('exMpNameIn');
  input.addEventListener('input', () => {
    if (!cur) return;
    $('exMpNameBad').hidden = true;
    const ok = exSanitizeName(input.value);
    if (ok !== null) saveName(ok);   // nhớ ngay khi hợp lệ, tải lại trang vẫn còn
    $<HTMLButtonElement>('exMpFly').disabled = cur.session.phase !== 'lobby' || ok === null;
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
  $('exMpFly').addEventListener('click', go);
  $('exMpSolo').addEventListener('click', solo);
  $('exMpBack').addEventListener('click', back);
  box.addEventListener('keydown', (e) => { if (e.key === 'Escape' && cur) { e.preventDefault(); back(); } });
  onLang(() => render());
}

/* Hiện bước riêng thay cho các thẻ và gắn nó vào phiên; trả ngay (phiên đang ở pha 'connecting') */
export function exShowLobby(session: MultiSession, cb: LobbyCallbacks): void {
  bind();
  const root = $('exMpLobby'), box = root.closest('#chooser') as HTMLElement, input = $<HTMLInputElement>('exMpNameIn');
  box.querySelector<HTMLElement>('.ex-cards')!.hidden = true;
  $('exTitle').hidden = true; $('exMpLostNote').hidden = true;
  box.setAttribute('aria-labelledby', 'exMpSky');
  root.hidden = false;
  if (!input.value) input.value = loadName();
  listKey = '';
  cur = { session, cb };
  exMulti.onChange = render;
  render();
  input.focus({ preventScroll: true });
}
