/* ============================ Tự khám phá: màn chọn phương tiện ============================
   Lớp phủ HTML (#chooser trong index.html), không thêm gì vào cảnh. Hiện sau khung đầu tiên (cảnh đã dựng phía sau)
   và chặn chuột vào canvas tới khi chọn. Chữ do data-i18n lo; ở đây chỉ khóa thẻ và gọi onPick. */

import { getLang, onChange } from '../i18n';
import { exMulti } from './multi';
import { exShowLobby } from './multi/lobby';

export type ExChoice = 'glider' | 'guided' | 'walk';

const el = () => document.getElementById('chooser');

/* Dù lượn cần bàn phím: thiết bị cảm ứng (không có hover) thì khóa thẻ và hiện nhãn "Chỉ dùng trên máy tính". Thẻ Đi dạo không khóa (có điều khiển cảm ứng) */
function lockGliderOnTouch(root: HTMLElement): void {
  if (!window.matchMedia('(hover: none)').matches) return;
  const card = root.querySelector<HTMLButtonElement>('[data-pick="glider"]');
  if (!card) return;
  card.disabled = true;
  card.querySelector<HTMLElement>('.ex-note')?.removeAttribute('hidden');
}

/* Ô ngôn ngữ riêng của màn chọn (lớp phủ che #langSelect): chép danh sách từ #langSelect, đổi thì chuyển cho #langSelect xử lý */
function wireLang(root: HTMLElement): void {
  const mine = root.querySelector<HTMLSelectElement>('#exLang');
  const main = document.getElementById('langSelect') as HTMLSelectElement | null;
  if (!mine || !main) return;
  mine.innerHTML = main.innerHTML; mine.value = getLang();
  mine.addEventListener('change', () => { main.value = mine.value; main.dispatchEvent(new Event('change')); });
  onChange((code) => { mine.value = code; });
}

/* Màn chọn là hộp thoại modal: các khối giao diện cũ (header, panel, canvas...) đặt inert để Tab/Enter không lọt xuống dưới */
const inerted: HTMLElement[] = [];
function setUnderInert(root: HTMLElement, on: boolean): void {
  if (on) {
    for (const c of Array.from(document.body.children) as HTMLElement[]) {
      if (c === root || c.tagName === 'SCRIPT' || c.id === 'loading' || c.inert) continue;
      c.inert = true; inerted.push(c);
    }
  } else { for (const c of inerted) c.inert = false; inerted.length = 0; }
}

export function exShowChooser(onPick: (choice: ExChoice) => void, onWatch: (choice: ExChoice) => void = () => {}): void {
  const root = el();
  if (!root) return;
  lockGliderOnTouch(root);
  /* Lần trước mất kết nối khi đang xem (explore.exit tải lại trang): đọc cờ một lần rồi xóa, hiện exMpLostChooser */
  try { if (sessionStorage.getItem('exMpNotice') === 'lost') { sessionStorage.removeItem('exMpNotice'); const n = document.getElementById('exMpLostNote'); if (n) n.hidden = false; } } catch { /* bộ nhớ bị chặn */ }
  wireLang(root);
  /* Không dùng { once: true }: từ sảnh bấm Quay lại / Esc thì các thẻ phải chọn lại được. Hộp đã đóng (đã chọn xong) thì bỏ qua */
  root.querySelectorAll<HTMLButtonElement>('button[data-pick]').forEach((b) => {
    if (b.disabled) return;
    b.addEventListener('click', () => {
      if (root.hidden) return;
      const choice = b.dataset.pick as ExChoice;
      /* Dù lượn / Đi dạo có máy chủ: sang bước chọn slot + nhập tên (mở kết nối ở đây, không sớm hơn); không có máy chủ: bay / đi một mình ngay như trước */
      if ((choice === 'glider' || choice === 'walk') && exMulti.begin(() => {}, choice === 'walk' ? 'walk' : 'fly')) {
        const solo = () => { exHideChooser(); onPick(choice); };
        exShowLobby(exMulti.session!, { onFly: solo, onWatch: () => { exHideChooser(); onWatch(choice); }, onSolo: solo, onBack: () => b.focus({ preventScroll: true }) });
        return;
      }
      exHideChooser(); onPick(choice);
    });
  });
  const show = () => { root.hidden = false; setUnderInert(root, true); root.querySelector<HTMLButtonElement>('button[data-pick]:not(:disabled)')?.focus({ preventScroll: true }); };
  const loading = document.getElementById('loading');
  if (!loading || loading.classList.contains('done')) { show(); return; }
  const mo = new MutationObserver(() => { if (loading.classList.contains('done')) { mo.disconnect(); show(); } });   // #loading.done được đặt sau khung đầu
  mo.observe(loading, { attributes: true, attributeFilter: ['class'] });
}

export function exHideChooser(): void {
  const root = el();
  if (root) { root.hidden = true; setUnderInert(root, false); }
}
