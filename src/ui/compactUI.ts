import { CONFIG } from '../config';
import { onChange } from '../i18n';

/* ===== Chế độ gọn (điện thoại): body.compact + hai tờ Cài đặt / Góc nhìn (body.sheet-*) =====
   Máy tính dùng chung trạng thái tờ (bảng thu gọn thành nút ⚙ / ☰, D-025). */
export type Sheet = 'none' | 'settings' | 'views';

export const ui: { compact: boolean; sheet: Sheet } = { compact: false, sheet: 'none' };

/* Mỗi lúc chỉ một tờ mở; 'none' = đóng hết. aria-expanded của hai nút mở tờ theo trạng thái */
export function openSheet(s: Sheet) {
  // Đóng một tờ khi focus còn bên trong: đưa focus về nút mở tờ đó, không để kẹt trên ô chọn đã ẩn (mũi tên sẽ đổi cài đặt thay vì lái dù)
  const SHEET: Record<Sheet, [string, string] | null> = { none: null, settings: ['.brand', 'btnSettings'], views: ['.views', 'btnViewsSheet'] };   // [khung tờ, nút mở]
  const prev = SHEET[ui.sheet], back = ui.sheet !== s && prev && document.activeElement?.closest(prev[0]) ? prev[1] : '';
  ui.sheet = s;
  document.body.classList.toggle('sheet-settings', s === 'settings');
  document.body.classList.toggle('sheet-views', s === 'views');
  document.getElementById('btnSettings')?.setAttribute('aria-expanded', String(s === 'settings'));
  document.getElementById('btnViewsSheet')?.setAttribute('aria-expanded', String(s === 'views'));
  if (back) document.getElementById(back)?.focus({ preventScroll: true });
}

export function closeSheets() { openSheet('none'); }

/* Đưa phần tử vào tầm nhìn: mở đúng tờ chứa nó (test và phím tắt dùng); phần tử ngoài hai tờ thì đóng hết.
   Điện thoại: chip .seg, nút Tour 4 cầu nằm trên thanh dưới (ngoài tờ); máy tính: cả .views là bảng thu gọn */
export function reveal(el: Element | null) {
  if (!el) return;
  if (el.closest('.brand')) openSheet('settings');
  else if (el.closest('.view-list') || (!ui.compact && el.closest('.views'))) openSheet('views');
  else closeSheets();
}

/* Nút mở/đóng tờ; chạm khung 3D, chọn góc nhìn, Esc thì đóng; ghi --bar-h (cao thanh dưới) cho khung chú thích Tour / Kịch bản bão */
function wireSheets() {
  const toggle = (s: Sheet) => () => openSheet(ui.sheet === s ? 'none' : s);   // bấm lại thì đóng
  document.getElementById('btnSettings')?.addEventListener('click', toggle('settings'));
  document.getElementById('btnViewsSheet')?.addEventListener('click', toggle('views'));
  document.querySelectorAll('.sheet-close').forEach((b) => b.addEventListener('click', () => closeSheets()));
  // Bấm khung 3D khi có tờ mở: chỉ đóng tờ. Pha capture trên window chạy trước listener của canvas (exitTour, OrbitControls) nên chặn được cú bấm này
  window.addEventListener('pointerdown', (e) => {
    if (ui.sheet === 'none' || (e.target as Element | null)?.id !== 'scene') return;
    closeSheets(); e.stopPropagation(); e.preventDefault();
  }, true);
  document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => { if (ui.sheet !== 'none') closeSheets(); }));
  // Esc khi có tờ mở: chỉ đóng tờ, chặn các listener Esc khác (thoát Tour, xuống cabin, thoát bay); Esc lần sau mới tới chúng
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || ui.sheet === 'none') return;
    closeSheets(); e.stopImmediatePropagation(); e.preventDefault();
  }, true);
  const bar = document.querySelector<HTMLElement>('.views');
  if (!bar || typeof ResizeObserver === 'undefined') return;
  // chỉ đo lúc thanh đóng: tờ Góc nhìn làm .views cao lên, tờ Cài đặt ẩn .views
  new ResizeObserver(() => { if (ui.compact && ui.sheet === 'none') document.documentElement.style.setProperty('--bar-h', bar.offsetHeight + 'px'); }).observe(bar);
}

/* Vệt mờ trên hàng chip .seg: .more-start / .more-end khi còn nội dung bị cuộn khuất ở đầu / cuối dòng (RTL: scrollLeft ≤ 0, đầu dòng ở bên phải) */
function wireSegFade() {
  const seg = document.querySelector<HTMLElement>('.seg');
  if (!seg) return;
  const update = () => {
    const max = seg.scrollWidth - seg.clientWidth;
    const pos = Math.abs(seg.scrollLeft);   // quãng đã cuộn từ đầu dòng, đúng cả LTR lẫn RTL
    seg.classList.toggle('more-start', ui.compact && pos > 8);
    seg.classList.toggle('more-end', ui.compact && max - pos > 8);
  };
  seg.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  segFadeUpdate = update;
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(update).observe(seg);
  onChange(update);   // đổi ngôn ngữ đổi bề rộng chip nhưng không đổi hộp .seg nên ResizeObserver không báo
}
let segFadeUpdate = () => {};

/* Tour / kịch bản bão bật lên thì đóng tờ đang mở (class của body đổi) */
function wireAutoClose() {
  let was = false;
  new MutationObserver(() => {
    const on = document.body.classList.contains('touring') || document.body.classList.contains('wxrun');
    if (on && !was && ui.sheet !== 'none') closeSheets();
    was = on;
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
}

export function setupCompactUI() {
  wireSheets();
  wireSegFade();
  wireAutoClose();
  const mq = window.matchMedia(CONFIG.ui.compactQuery);
  const apply = () => {
    const was = ui.compact;
    ui.compact = mq.matches;
    document.body.classList.toggle('compact', ui.compact);
    if (was !== ui.compact) closeSheets();   // qua ngưỡng gọn ↔ máy tính (cả hai chiều): không để tờ mở dở
    segFadeUpdate();
  };
  mq.addEventListener('change', apply);
  apply();
}
