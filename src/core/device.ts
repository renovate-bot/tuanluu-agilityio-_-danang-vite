/* =====================================================================
   THIẾT BỊ (D-018) — đoán một lần lúc tải, trước khi tạo renderer: có phải điện thoại / máy yếu không.
   Dùng cho những thứ chỉ đặt được lúc khởi động (antialias của WebGL context, bóng đổ có tính trong shader không)
   và bậc khởi đầu của chế độ chất lượng Tự động. ?test luôn coi là máy tính mạnh để bảng draw call chuẩn giữ nguyên.
   ===================================================================== */
const q = new URLSearchParams(location.search);
const nav = navigator as Navigator & { deviceMemory?: number };
const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const small = Math.min(screen.width, screen.height) < 900;

export const device = {
  test: q.has('test'),
  phone: !q.has('test') && coarse && small,                                                     // màn cảm ứng nhỏ: điện thoại / máy tính bảng nhỏ
  weak: !q.has('test') && ((nav.deviceMemory ?? 8) <= 4 || (navigator.hardwareConcurrency ?? 8) <= 4),
  /* Bộ đèn ngày / đêm (D-031, core/lights.ts): 'bg' biên dịch nền sau khung đầu, 'sync' biên dịch cả ba bộ trước khung đầu, 'off' luôn bộ đủ.
     ?test mặc định 'off' (bảng draw call chuẩn, mọi test cũ giữ nguyên); ?test&lightsets=sync | bg để thử */
  lightSets: (!q.has('test') ? 'bg' : q.get('lightsets') === 'sync' ? 'sync' : q.get('lightsets') === 'bg' ? 'bg' : 'off') as 'off' | 'sync' | 'bg'
};
