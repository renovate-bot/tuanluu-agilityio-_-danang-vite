# Giao diện điện thoại — Thiết kế
_2026-10-26 · Trạng thái: Đã xây (merge fc53fdd)_

Tính năng này không có prompt gốc trong `prompts/`. Nguồn là yêu cầu của người dùng (mục 1), D-019 (`.github/memory-bank/decisions.md`), mục "Giao diện điện thoại" trong `activeContext.md`, `progress.md` và `tests/KET-QUA.md`. Tài liệu mô tả cái ĐÃ XÂY, đối chiếu với `src/ui/compactUI.ts`, `src/styles/main.css` (khối `body.compact`), `index.html`, `CONFIG.ui` (`uiBase` trong `src/config.ts`), `src/core/postprocessing.ts` (`scheduleResize`). Kế hoạch: [2026-10-26-mobile-ui.md](../plans/2026-10-26-mobile-ui.md).

## 1. Mục đích và lý do
Yêu cầu của người dùng ngày 2026-10-26: "tối ưu hóa cả giao diện và performance hiển thị trên mobile. Hiện tại trên mobile các options che lấp và quá lớn khiến cho việc trải nghiệm rất khó khăn".

Hiện trạng trước khi làm (đã đọc mã, ghi ở plan):
- Ba panel cố định (`.brand`, `.views`, `.specs`) che gần hết cảnh; `.brand` mở hết cao hơn nửa màn hình dọc.
- Khối `@media (max-width:760px)` biến `.views` thành dải cuộn ngang nhồi cả chip cầu, nút góc nhìn, select và `swing-box`; hàng chip `.seg` chỉ thấy ~1,5 chip.
- Điện thoại xoay ngang (ví dụ 844×390) không khớp `max-width:760px` nên dùng bố cục máy tính và tràn khỏi màn hình.
- Chữ hướng dẫn nói về chuột / phím (`#hint` WASD, `#swRideHint`, `tourExit`, `wxStormHint`, nút Đi bộ), vô nghĩa trên cảm ứng.
- `button:hover` không bọc `(hover:hover)`, nên màu hover dính lại sau khi chạm.
- `<meta name="viewport">` thiếu `viewport-fit=cover`, nên mọi `env(safe-area-inset-*)` bằng 0 trên iPhone có tai thỏ.
- Mọi `.panel` dùng `backdrop-filter: blur(10px)` phủ lên canvas WebGL; mỗi sự kiện `resize` gọi `onResize()` cấp lại framebuffer, mà xoay máy bắn nhiều lần liên tiếp.

Người dùng muốn gọn hơn trên điện thoại, còn màn hình máy tính giữ nguyên (D-019).

## 2. Phạm vi: có / không có
Có:
- Chế độ gọn `body.compact` theo một media query duy nhất `CONFIG.ui.compactQuery`.
- Thanh trên (`.brand` đóng) + thanh dưới (`.views` đóng) + hai tờ (sheet) Cài đặt / Góc nhìn.
- Hàng chip `.seg` cuộn ngang, mờ cạnh khi còn nội dung.
- Chữ hướng dẫn cảm ứng, hover chỉ khi có chuột, ẩn nút Đi bộ khi cảm ứng, tờ tự đóng khi Tour / bão.
- 5 khóa i18n × 9 ngôn ngữ.
- Hiệu năng: `viewport-fit=cover`, bỏ blur khi gọn, tắt animation thanh nhạc khi gọn, `scheduleResize`.
- Test: `tests/mobile-check.mjs` + `npm run test:mobile`, helper `reveal` / `tap` / `pick`.

Không có (mục 9): đo trên điện thoại thật, duyệt bản dịch của người bản ngữ, test riêng cho hook `onChange`.

## 3. Thông số đã dùng
| Thông số | Giá trị | Nguồn / ghi chú |
|---|---|---|
| `CONFIG.ui.compactQuery` | `(max-width: 760px), (max-height: 500px)` | điện thoại dọc (≤ 760 px rộng) hoặc ngang (≤ 500 px cao); khung test mặc định 480×270 cũng khớp |
| `CONFIG.ui.resizeDebounceMs` | 120 ms | (ước lượng) chờ sau resize / xoay máy rồi mới tính lại bố cục |
| Nút trong thanh / tờ | `min-height` 40 px, chữ 13 px | `main.css`, `body.compact .panel button` |
| Chip cầu `.seg button` | `min-height` 36 px | thấp hơn mức 44 px khuyến nghị cho chạm, còn mở (mục 9) |
| Tờ Cài đặt | `max-height: 70dvh` | `body.compact.sheet-settings .brand` |
| Tờ Góc nhìn | `max-height: 55dvh`, lưới 2 cột | `.view-list` |
| Khung chú thích Tour / bão | `max-height: 34dvh`, `bottom: calc(var(--bar-h,60px) + 8px)` | `--bar-h` do `compactUI.ts` ghi từ `ResizeObserver` của `.views` |
| Nền panel khi gọn | `rgba(10,18,22,.92)`, không blur, không đổ bóng | bù cho việc bỏ `backdrop-filter` |
| Ngưỡng mờ cạnh chip | 8 px đã cuộn / còn lại | `wireSegFade()` |

## 4. Hình dạng, hành vi như đã xây
- **Hạ tầng (`src/ui/compactUI.ts`).** `ui = { compact, sheet }`; `openSheet(s)` đặt `body.sheet-settings` / `body.sheet-views` (chỉ một tờ mở) và `aria-expanded` của `#btnSettings` / `#btnViewsSheet`; `closeSheets()`; `reveal(el)`; `setupCompactUI()` nghe `matchMedia(CONFIG.ui.compactQuery)`, bật `body.compact`, ra khỏi chế độ gọn thì đóng tờ.
- **Không chuyển DOM, hai panel đổi vai (D-019).**
  - `.brand` (Cài đặt): đóng = `.brand-head` (tiêu đề `h1` 20 px + `#btnSettings` 40×40) neo trên-trái theo `env(safe-area-inset-*)`; mở = tờ đáy chứa `.brand-top` (ô ngôn ngữ) và `#brandBody`, cuộn dọc (`overscroll-behavior: contain`), ẩn `.views` trong lúc mở.
  - `.views` (Góc nhìn): đóng = thanh đáy một hàng gồm `.seg` (cuộn ngang, `scroll-snap-type: x`), `.tour-all`, `#btnViewsSheet`; mở = `.view-list` của cầu đang chọn hiện phía trên thanh, lưới 2 cột, `.swing-box` và `.mini-select` chiếm trọn 2 cột.
  - `.specs` và `.stats` ẩn như trước.
  - Mỗi tờ có nút đóng `.sheet-close` (SVG ✕).
- **Hành vi tờ.** Bấm lại nút thì đóng; chạm canvas `#scene` (thêm cạnh listener `exitTour` sẵn có), bấm `[data-view]`, hoặc Esc thì đóng (không chặn listener Esc sẵn có: thoát Tour, xuống cabin vẫn chạy). `MutationObserver` theo `class` của `body`: `touring` hoặc `wxrun` bật lên thì đóng tờ.
- **Chữ hướng dẫn cảm ứng.** Mỗi chữ có hai `span`: `.hint-mouse` (khóa cũ `tourExit`, `wxStormHint`, `swRideHint`) và `.hint-touch` (khóa mới). `@media (hover:none)` ẩn `.hint-mouse`, hiện `.hint-touch`, ẩn `[data-view="walk"]` và `#hint`. Mọi `:hover` bọc trong `@media (hover:hover)`.
- **Hiệu năng / thiết bị.**
  - `viewport-fit=cover` để `env(safe-area-*)` có giá trị.
  - `body.compact .panel`: bỏ `backdrop-filter`.
  - `body.compact #btnMusic[aria-pressed="true"] .eq rect{animation:none}`: animation vô hạn buộc dựng lại lớp mỗi khung.
  - `#scene` có `height: 100dvh` sau `height: 100%`.
  - `scheduleResize()` (`postprocessing.ts`) gộp `resize` / `orientationchange` thành một `onResize()` sau `resizeDebounceMs`, bằng `setTimeout` rồi `requestAnimationFrame`; lần gọi `onResize()` lúc khởi động giữ nguyên.
  - Điện thoại còn hưởng D-018: không MSAA, bậc chất lượng khởi đầu Thấp.
- **Vệt mờ chip.** Lớp `.more-start` / `.more-end` của `.seg` cập nhật khi cuộn, đổi cỡ, đổi ngôn ngữ (`onChange`); đúng cả RTL (`scrollLeft` ≤ 0).

## 5. Tương tác, UI, i18n, thuyết minh
- **Tương tác:** nút ⚙ (Cài đặt) và ☰ (Góc nhìn) mở / đóng tờ; chọn góc nhìn, bắt đầu Tour, bão, chạm canvas, Esc đều đóng tờ.
- **i18n 5 khóa × 9 ngôn ngữ** (`scripts/add-mobile-locales.mjs`): `settings`, `close`, `tourExitTouch`, `wxStormHintTouch`, `swRideHintTouch`; `apply()` trong `src/i18n/index.ts` chốt khóa thiếu. `ar` là RTL, tờ neo bằng `inset-inline`.
- **Test dùng chung:** `window.__app.ui` = `{ ui, openSheet, closeSheets, reveal }` (chỉ `?test`). `tests/lib.mjs`: `tap(page, sel)` và `pick(page, sel, value)` gọi `reveal(el)` trước khi bấm (phần tử trong `.brand` → mở tờ Cài đặt; trong `.view-list` → tờ Góc nhìn; chỗ khác → đóng tờ); `openApp(..., { mobile })` dùng `isMobile` + `hasTouch`. Hệ quả: test bấm phần tử nằm trong panel phải dùng `tap` / `pick`, không `page.click` trực tiếp.
- Không có thuyết minh mới.

## 6. Ràng buộc đã tuân thủ
- **Draw call:** chỉ đổi DOM / CSS / i18n, không thêm mesh / đèn / `rand()`, nên không đổi. `test:drawcalls` 72/74 khớp, chênh 0 (`swTour` ngày 187 so với 188, đêm 209 so với 207 = dao động đã biết, D-018).
- Không đổi thứ tự `build*()`.
- Màn hình máy tính không khớp `compactQuery` giữ nguyên bố cục (test kiểm `.views` rộng 228 px, `.brand` left 14, vẫn blur).
- Thông số ở `CONFIG.ui` với chú thích tiếng Việt.
- i18n đủ 9 ngôn ngữ; không thêm thư viện hay ảnh ngoài (icon ⚙ / ✕ / ☰ là SVG inline).
- Không liên quan "phương án đề xuất".

## 7. Khác so với ý định ban đầu
So sánh với plan [2026-10-26-mobile-ui.md](../plans/2026-10-26-mobile-ui.md):

| Mục | Plan | Đã xây | Vì sao / commit |
|---|---|---|---|
| `reveal()` với chỗ ngoài `.brand` / `.view-list` (chip `.seg`, nút Tour) | Interfaces Task 1: "không làm gì" | đóng mọi tờ (`closeSheets()`) | khớp D-019 ("chỗ khác → đóng tờ"); có từ `8605bd5` |
| Tờ đang mở so với chú thích Tour / bão | không nêu | tờ có `z-index: 10` để nằm trên chú thích | sửa sau review cuối `fced484` |
| Ghi chú `src/i18n/index.ts` về khóa thiếu | không nêu | sửa lại comment cho đúng (khóa thiếu giữ chữ đang có, chưa chắc là chữ mặc định) | `fced484` |
| Kiểm tràn ngang | Task 4 dùng `offsetParent` | `checkVisibility()` | `.panel` fixed luôn có `offsetParent` null (`6857698`, D-019) |
| Vệt mờ cạnh chip `.seg` (`wireSegFade`) | không nêu thành bước riêng | thêm, cập nhật khi cuộn / đổi cỡ / đổi ngôn ngữ | `9214229` |
| Biến `--bar-h` + `ResizeObserver` đo `.views` cho khung chú thích | Task 2 có nêu | đã xây như plan | `598012c` |
| Đo máy thật | Task 6 Step 2: "máy thật cần người nên để sau" | chỉ đo giả lập iPhone 12 | mục 8, 9 |

## 8. Kiểm tra
- `tests/mobile-check.mjs` (`npm run test:mobile`): dọc 390×844, ngang 844×390, máy tính 1280×800; 9 ngôn ngữ × 2 tờ: tờ hiện, không tràn ngang; `ar` RTL; console sạch.
- Chạy đủ bộ ngày 2026-10-27, tuần tự từng lệnh (log `tests/screens/mobile/t6-*.log`, không commit): `build`, `test:mobile`, `test:tour` (8/8), `test:voice` (vi + en + ru, 6 tour, 47 điểm dừng + 8 mốc bão), `test:tunnel`, `test:riverfront`, `test:weather`, `test:sunwheel` đạt; `test:drawcalls` 72/74 khớp chênh 0; `test:perf -- --strict` đạt, 0 program mới, draw call overview Cao / TB / Thấp ngày 282 / 215 / 116, đêm 306 / 306 / 121, tự động hạ 2 bậc.
- Đo giả lập iPhone 12 (`tests/screens/mobile/emulate.mjs`, tạm, không commit): Playwright `devices['iPhone 12']` (dpr 3), mở trang không `?test` (bậc Tự động, `device.phone`), đọc `#ftime` / `#fps` sau 20 s ở `overview`; cả ba lần bậc "Tự động · Thấp", `body.compact` bật.

| Cấu hình | Tải xong | FPS | ms trung bình · p95 · max | Draw call | Canvas |
|---|---|---|---|---|---|
| Dọc 390×844, CPU ×4 | 9,6 s | 6 | 181 · 267 · 267 | 77 | 292×498 |
| Ngang 844×390, CPU ×4 | 80,0 s | 1 | 1016 · 1016 · 1016 | 117 | 562×255 |
| Dọc 390×844, không giảm tốc | 28,3 s | 1 | 869 · 869 · 869 | 77 | 390×664 |

  Các số ms KHÔNG dùng để kết luận FPS điện thoại: SwiftShader, dao động mạnh giữa ba lần (lần ngang và lần không giảm tốc chậm hơn lần dọc ×4 vì tải máy và mẫu quá ít, `perf` chỉ có 1–2 khung trong cửa sổ). Ảnh từng trạng thái: `tests/screens/mobile/{P,L}-*.png`, `E-*.png` (không commit).
- Từng test kiểm tra phần mình: `test:mobile` chỉ phủ giao diện gọn; draw call chỉ do `test:drawcalls`.

## 9. Còn mở
- Đo trên điện thoại thật: FPS, tai thỏ / safe-area (thanh home), cảm giác chạm hàng chip.
- 7 bản dịch khóa mới (ko, ja, zh, th, ar, hi, ru) chưa người bản ngữ duyệt (ar "الكابينة" so với "المقصورة" cũ; ru `wxStormHintTouch` hơi lạ).
- Chip `.seg` cao 36 px (< 44 px khuyến nghị cho chạm), cần thử máy thật.
- Câu hướng dẫn xuống cabin (`swRideHintTouch`) trỏ tới nút nằm trong tờ Góc nhìn.
- `100dvh` trên `#scene` chỉ có tác dụng trước JS (canvas giữ cỡ cũ ≤ 120 ms sau resize, chủ ý).
- Listener `matchMedia` và `[data-view]` gắn một lần lúc setup: nút thêm động sau này không tự đóng tờ.
- Nút ⚙ / ☰ và ✕ cùng hiện khi tờ mở (dư thừa, có chủ ý).
- Font tải sau `onChange` có thể làm mờ cạnh chip cũ tới lần cuộn sau.
- `mobile-check` chưa có test riêng cho hook `onChange`.
- Khi làm đã gặp: `test:perf` từng treo hàng giờ vì tiến trình `test:mobile` mồ côi tranh CPU; trước mỗi test kiểm không còn tiến trình `*-check.mjs` / `drawcalls.mjs` nào chạy (PowerShell: `Get-CimInstance Win32_Process`).
