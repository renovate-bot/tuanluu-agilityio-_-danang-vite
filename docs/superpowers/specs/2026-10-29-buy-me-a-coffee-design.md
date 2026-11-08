# Buy me a coffee (MoMo) — Thiết kế
_2026-10-29 · Trạng thái: Đã xây (merge cbfda36, PR #10; commit `ef844f0`)_

Tính năng này không có prompt gốc trong `prompts/`. Nguồn là ba quyết định của người dùng ngày 2026-10-29 (ghi ở đầu plan, mục "Spec"), D-021 (`.github/memory-bank/decisions.md`), `activeContext.md` và `progress.md`. Tài liệu mô tả cái ĐÃ XÂY, đối chiếu với `src/ui/donateUI.ts`, `CONFIG.ui.donate` (`uiBase` trong `src/config.ts`), `index.html`, `src/styles/main.css`, `tests/mobile-check.mjs`. Kế hoạch: [2026-10-29-buy-me-a-coffee.md](../plans/2026-10-29-buy-me-a-coffee.md).

## 1. Mục đích và lý do
Thêm liên kết "Buy me a coffee" ở cuối panel Cài đặt, mở trang nhận tiền MoMo của tác giả ở tab mới. Ba quyết định của người dùng (2026-10-29):
1. Đích là trang nhận tiền **MoMo** (dạng `https://me.momo.vn/bbk9x`), không dùng widget / script của buymeacoffee.com.
2. Vị trí: **cuối panel Cài đặt**, dưới ô "Chất lượng hình".
3. Chữ trên nút giữ tiếng Anh "Buy me a coffee" (không dịch); `aria-label` dịch đủ 9 ngôn ngữ.

Lý do chọn liên kết thuần (D-021): không thêm script / widget bên thứ ba hay phụ thuộc runtime (bất biến "không thêm thư viện runtime").

## 2. Phạm vi: có / không có
Có:
- Thẻ `<a id="donateLink" class="donate">` tĩnh trong `.panel.brand`, icon cốc là SVG inline vẽ tay.
- `src/ui/donateUI.ts`: đọc URL từ `CONFIG.ui.donate.url`, chỉ nhận `https:`.
- CSS `.donate`, bản gọn dưới `body.compact`.
- Khóa `donateAria` × 9 ngôn ngữ (`scripts/add-donate-locales.mjs`).
- Test trong `tests/mobile-check.mjs`.

Không có: widget hoặc ảnh của MoMo / BMC; logo MoMo; đổi cảnh 3D; giao dịch thật (xem mục 9).

## 3. Thông số đã dùng
| Thông số | Giá trị | Ghi chú |
|---|---|---|
| `CONFIG.ui.donate.url` | `https://me.momo.vn/bbk9x` | alias do người dùng cung cấp; rỗng = ẩn nút; URL nằm công khai trong bundle nên dùng alias riêng, không dùng số điện thoại (chú thích trong `config.ts`) |
| Chiều cao nút khi gọn | `min-height: 40px` | `body.compact .donate` |
| Chữ nút | "Buy me a coffee" | cố định tiếng Anh, không có `data-i18n` |
| Màu / viền | `var(--gold)`, viền `rgba(230,189,106,.32)` | `.donate` trong `main.css` |

## 4. Hình dạng, hành vi như đã xây
- `index.html`: `a#donateLink.donate` là phần tử cuối của `#brandBody` (sau `label[for=qualitySel]`), `target="_blank" rel="noopener noreferrer"`, `data-i18n-aria="donateAria"`, `aria-label` mặc định tiếng Việt, `hidden` sẵn, chứa `<svg aria-hidden="true">` + `<span>Buy me a coffee</span>`.
- `donateUI.ts`: `setupDonateUI(): DonateApi` với `DonateApi { set(url: string): boolean }`. `set` thử `new URL(url)`; chỉ khi `protocol === 'https:'` thì gắn `href`, bỏ `hidden`, trả `true`; ngược lại (rỗng, sai định dạng, `javascript:`, `http:`) bỏ `href`, đặt `hidden`, trả `false`. Gọi `set(CONFIG.ui.donate.url)` một lần lúc dựng.
- Nối vào `setupUI()`, trả `{ donate }`; `main.ts` đưa vào `window.__app.ui.donate` (chỉ `?test`).
- CSS: `.donate[hidden]{display:none}` (vì `display:inline-flex` đè `hidden`); hover bọc trong `@media (hover:hover)`.
- Điện thoại: liên kết nằm trong `#brandBody` nên tự vào tờ Cài đặt (D-019).

## 5. Tương tác, UI, i18n, thuyết minh
- Bấm nút mở trang MoMo ở tab mới.
- i18n: một khóa `donateAria` × 9 ngôn ngữ (vi, en, ko, ja, zh, th, ar, hi, ru); giữ ý "qua MoMo" và "mở tab mới". `ar` là RTL; test kiểm liên kết vẫn nằm trong tờ, không tràn ngang.
- Không có thuyết minh.

## 6. Ràng buộc đã tuân thủ
- Không thêm mesh / vật liệu / đèn / `rand()`, nên draw call không đổi; không chạy `test:drawcalls` (thay đổi chỉ ở DOM).
- Không thêm thư viện runtime, không ảnh ngoài; icon là SVG inline.
- Thông số ở `src/config.ts` có chú thích tiếng Việt.
- Khóa i18n có đủ 9 file.
- CSS điện thoại viết dưới `body.compact`.
- Không đụng `main.ts` ngoài dòng `__app`.
- Không liên quan "phương án đề xuất".

## 7. Khác so với ý định ban đầu
So sánh với plan [2026-10-29-buy-me-a-coffee.md](../plans/2026-10-29-buy-me-a-coffee.md):

| Mục | Plan | Đã xây | Vì sao / commit |
|---|---|---|---|
| Số commit | 3 commit (Task 1, Task 2, Task 3) | một commit `ef844f0` (cả mã, i18n, test, memory bank) | đẩy qua PR #10 từ nhánh `feature/donate-momo-pr`, merge `cbfda36` |
| Tên nhánh | `feature/donate-momo` | PR từ `feature/donate-momo-pr` | PR #10 |
| URL mặc định | `''` (ẩn) nếu chưa có alias | `https://me.momo.vn/bbk9x` | người dùng cung cấp alias; trang MoMo đã mở được trong trình duyệt |
| Số quyết định | D-020 | D-021 | trong `decisions.md` chỉ có D-021 cho tính năng này |
| `href` ban đầu của thẻ `<a>` | `href="#"` | không có `href` tới khi `set()` hợp lệ | tránh nút chết khi URL rỗng |
| Trang test máy tính | `N` | biến `D` trong `tests/mobile-check.mjs` | đặt tên biến theo file test hiện có |
| File plan trên `main` | không nêu | thêm bằng commit riêng `e5763d1` ("feat: add Buy me a coffee link in settings panel", chỉ chứa file plan) | sau merge |

## 8. Kiểm tra
- `tests/mobile-check.mjs` (`npm run test:mobile`), các dòng `donate:`:
  - URL rỗng thì ẩn;
  - `javascript:` và `http:` bị từ chối;
  - `https` gắn được;
  - hiện trong tờ Cài đặt;
  - `href`, tab mới, `rel` có `noopener` và `noreferrer`;
  - chữ "Buy me a coffee" cố định;
  - cao ≥ 40 px khi gọn;
  - là phần tử cuối của `#brandBody`;
  - máy tính: `donate` nằm trong `.brand`;
  - mỗi ngôn ngữ: `aria-label` đúng khóa `donateAria` đã dịch, tờ Cài đặt không tràn ngang.
- Kết quả 2026-11-04 (`progress.md`): `typecheck`, `build`, `test:mobile`, `test:perf -- --strict` đạt.
- Thủ công: alias do người dùng cung cấp đã mở tới trang MoMo trong trình duyệt (`activeContext.md`). Chưa thực hiện giao dịch, chưa kiểm tra trên điện thoại thật.

## 9. Còn mở
- Chưa thực hiện giao dịch thanh toán thật; chưa kiểm tra trên điện thoại thật.
- Bước "tự xem bằng mắt" (`npm run dev`, `/?test`, 1280×800 và 390×844, `vi` và `ar`) của plan chưa có bằng chứng đã làm (chưa đối chiếu).
- Chưa đối chiếu alias `bbk9x` có phải alias riêng hay gắn với số điện thoại; D-021 ghi "không bật URL thật cho tới khi có alias riêng đã xác minh", còn URL đã có trong bundle công khai.
- Bản dịch `donateAria` ở các ngôn ngữ ngoài vi / en chưa người bản ngữ duyệt (chưa đối chiếu).
