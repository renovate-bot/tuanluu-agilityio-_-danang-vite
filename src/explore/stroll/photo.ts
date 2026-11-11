/* ============================ Đi dạo: chụp ảnh khung hình thành PNG ============================
   Ảnh là đúng khung WebGL vừa vẽ: stPhotoAfterRender chạy ngay sau lệnh vẽ chính trong animate (cùng tác vụ) nên toBlob đọc được bộ đệm vừa vẽ,
   không cần preserveDrawingBuffer. Nhãn tên và mọi phần tử HTML (kể cả chớp trắng) không có trong ảnh.
   Bấm nhiều lần trước khi khung kế tiếp vẽ chỉ xếp một yêu cầu. Kích thước ảnh lấy tại lúc chụp (canvas.width / height), không đọc lại sau.
   Điện thoại (hover: none) có canShare thì mở bảng chia sẻ; còn lại tải file qua <a download>. Hủy bảng chia sẻ (AbortError) không phải lỗi.
   Khi không có yêu cầu chờ, mỗi khung chỉ một phép so sánh, không cấp phát. */
import { CONFIG } from '../../config';
import { t } from '../../i18n';

let pending = false;   // có một yêu cầu chụp chờ khung kế tiếp
export let stPhotoLast: { name: string; size: number; w: number; h: number } | null = null;   // ảnh vừa chụp (cho test)

const pad = (n: number): string => (n < 10 ? '0' : '') + n;

/* danang-YYYYMMDD-HHMMSS.png theo giờ máy người dùng */
export function stPhotoName(d: Date): string {
  return `danang-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.png`;
}

/* Thông báo ngắn ở ô riêng #stToast (không dùng chung #exMpNotice); một bộ hẹn giờ duy nhất, mỗi thông báo mới hủy bộ cũ */
let toastTimer = 0;
function notice(key: string): void {
  const el = document.getElementById('stToast');
  if (!el) return;
  el.textContent = t(key); el.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { el.hidden = true; el.textContent = ''; }, CONFIG.explore.multi.noticeMs);
}

export function stPhotoRequest(): void { pending = true; }

/* Tải file về qua <a download> */
function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; a.style.display = 'none';
  document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), CONFIG.stroll.photoUrlMs);
  notice('stPhotoSaved');
}

/* Lưu: chia sẻ trên điện thoại (lỗi khác AbortError như NotAllowedError thì tải về), còn lại tải về */
function save(blob: Blob, name: string): void {
  const file = new File([blob], name, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (window.matchMedia('(hover: none)').matches && nav.canShare && nav.canShare({ files: [file] })) {
    navigator.share({ files: [file] }).then(() => notice('stPhotoSaved'), (e: unknown) => { if ((e as { name?: string }).name !== 'AbortError') download(blob, name); });
    return;
  }
  download(blob, name);
}

/* Gọi ngay sau lệnh vẽ khung chính: nếu có yêu cầu thì chụp canvas */
export function stPhotoAfterRender(canvas: HTMLCanvasElement): void {
  if (!pending) return;
  pending = false;
  const w = canvas.width, h = canvas.height, name = stPhotoName(new Date());
  try {
    canvas.toBlob((blob) => {
      if (!blob || blob.size === 0) { notice('stPhotoFail'); return; }
      stPhotoLast = { name, size: blob.size, w, h };
      save(blob, name);
    }, 'image/png');
  } catch { notice('stPhotoFail'); }
}
