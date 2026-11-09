/* ===== Dù lượn nhiều người: bước chọn slot và nhập tên (trong hộp thoại #chooser) =====
   Hiện sau khi bấm thẻ Dù lượn lúc có máy chủ: 5 chấm + "Còn N trên 5 chỗ", tên những người đang bay, ô tên, nút Bay ngay.
   Cập nhật trực tiếp theo MultiSession; tên người khác chỉ ghi bằng textContent. Tên của mình nhớ ở localStorage.
   Pha lobby: cho nhập tên và giành chỗ. Pha solo (không kết nối được): báo ngoại tuyến + nút Bay một mình.
   Pha flying: gọi onFly. Pha watching (hết chỗ): gọi onWatch (chế độ xem do Task 7 làm). */
import { CONFIG } from '../../config';
import { t, onChange as onLang } from '../../i18n';
import { exMulti } from './index';
import { exSanitizeName } from './protocol';
import type { MultiSession } from './session';

export interface LobbyCallbacks { onFly: () => void; onWatch: () => void; onSolo: () => void }

const M = CONFIG.explore.multi;
const NAME_KEY = 'exMpName';
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export function loadName(): string { try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; } }
export function saveName(n: string): void { try { localStorage.setItem(NAME_KEY, n); } catch { /* bộ nhớ trình duyệt bị chặn */ } }

let listKey = '';
let langBound = false;
let redraw: (() => void) | null = null;

/* Hiện bước riêng thay cho các thẻ và gắn nó vào phiên; trả ngay (phiên đang ở pha 'connecting') */
export function exShowLobby(session: MultiSession, cb: LobbyCallbacks): void {
  const root = $('exMpLobby'), box = root.closest('#chooser') as HTMLElement;
  const input = $<HTMLInputElement>('exMpNameIn'), fly = $<HTMLButtonElement>('exMpFly'), solo = $<HTMLButtonElement>('exMpSolo');
  box.querySelector<HTMLElement>('.ex-cards')!.hidden = true;
  $('exTitle').hidden = true; $('exMpLostNote').hidden = true;
  box.setAttribute('aria-labelledby', 'exMpSky');
  root.hidden = false;
  if (!input.value) input.value = loadName();
  listKey = '';
  let done = false;
  const finish = (f: () => void) => { if (done) return; done = true; exMulti.onChange = () => {}; redraw = null; f(); };

  const render = () => {
    if (done) return;
    const ph = session.phase;
    if (ph === 'flying') { finish(cb.onFly); return; }
    if (ph === 'watching') { finish(cb.onWatch); return; }
    const offline = ph === 'solo';
    $('exMpOnline').hidden = offline;
    $('exMpOffline').hidden = !offline;
    solo.hidden = !offline;
    if (offline) { if (document.activeElement !== solo) solo.focus({ preventScroll: true }); return; }
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
  };

  const go = () => {
    const name = exSanitizeName(input.value);
    if (name === null || session.phase !== 'lobby') return;
    saveName(name);
    session.join(name);
  };
  input.addEventListener('input', () => {
    $('exMpNameBad').hidden = true;
    const ok = exSanitizeName(input.value);
    if (ok !== null) saveName(ok);   // nhớ ngay khi hợp lệ, tải lại trang vẫn còn
    fly.disabled = session.phase !== 'lobby' || ok === null;
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
  fly.addEventListener('click', go);
  solo.addEventListener('click', () => finish(cb.onSolo), { once: true });

  redraw = render;
  if (!langBound) { langBound = true; onLang(() => { if (redraw) redraw(); }); }
  exMulti.onChange = render;
  render();
  input.focus({ preventScroll: true });
}
