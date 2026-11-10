# Thu gọn bảng điều khiển trên máy tính — Thiết kế
_2026-11-10 · Trạng thái: Đã xây (nhánh `feature/thu-gon-bang-dieu-khien`, D-025)_

Nguồn: yêu cầu của người dùng ngày 2026-11-10 qua brainstorming (bản phác chọn phương án B, lưu ở `.superpowers/brainstorm/`, đã gitignore). Mã liên quan: `src/ui/compactUI.ts`, `src/ui/setupUI.ts`, `src/styles/main.css` (khối `.brand`, `.views`, `body.compact`), `index.html` (`header.brand`, `nav.views`), `tests/lib.mjs` (`tap`, `pick`).

## 1. Mục đích và lý do
Người dùng xem trên Asus Zenbook 14 OLED (tỉ lệ 200 %, trang thấy khoảng 1440 × 780 px). Trên máy tính, hai bảng luôn mở hết:
- `.brand` (Cài đặt) ở góc trên đầu dòng: ngôn ngữ, đêm/ngày, bóng đổ, nhạc, thuyết minh, âm lượng, thanh ngày–đêm, thời tiết, chất lượng hình, cà phê. Rộng tới 360 px, cao gần hết màn hình.
- `.views` (Góc nhìn) ở góc trên cuối dòng: rộng 228 px, cao gần hết màn hình.

Hai bảng che gần hết hai bên màn hình, cả khi xem cầu bình thường lẫn khi chạy Tour. Người dùng muốn thu gọn chúng **mọi lúc**, không chỉ khi chạy Tour.

Chế độ gọn cho điện thoại (D-019, `body.compact`) đã có nút ⚙ (`#btnSettings`) và nút ☰ Góc nhìn (`#btnViewsSheet`), nên tận dụng lại.

## 2. Mục tiêu / không làm / thất bại dù chạy được
Mục tiêu:
- Trên máy tính (không `body.compact`), lúc đóng chỉ còn **hai nút nhỏ**:
  - **⚙** ở góc trên đầu dòng, thay cho `.brand`;
  - **☰ Góc nhìn** ở góc trên cuối dòng, thay cho `.views`.
- Bấm nút thì bảng mở nổi ở đúng góc đó, nội dung và thứ tự giữ như hiện nay.
- Áp dụng mọi lúc: xem cầu, Tour, kịch bản bão, cabin Vòng quay, đi bộ, dù lượn. Với RTL (`ar`), hai nút đổi bên như các bảng hiện nay.

Không làm:
- Không đổi bảng **Thông số** (`.specs`, góc dưới đầu dòng) và ô **FPS / draw call** (`.stats`, góc dưới cuối dòng). Người dùng chọn giữ như cũ, kể cả các quy tắc ẩn sẵn có (ẩn khi Tour, khi bay, khi `body.compact`).
- Không đổi bố cục điện thoại (`body.compact`: thanh trên, thanh dưới có hàng chip cầu, tờ trượt từ đáy). Chỉ sửa hai lỗi ở mục 4, vì chúng dùng chung code.
- Không đổi chú thích Tour (`#tourCaption`), khung kịch bản bão, các phần tử của chế độ dù lượn.
- Không nhớ trạng thái mở/đóng giữa các lần tải trang.

Thất bại dù chạy được:
- Bấm ra cảnh để đóng bảng mà làm dừng Tour, hoặc nhấn Esc để đóng bảng mà bị đưa xuống khỏi cabin.
- Góc nhìn cũ tăng draw call (bảng là DOM, không được ảnh hưởng tới cảnh 3D).
- Bản điện thoại thay đổi bố cục, hoặc `test:mobile` hỏng.
- Có chức năng không còn với tới được bằng chuột, bàn phím hoặc trình đọc màn hình.

## 3. Hành vi
### 3.1 Trạng thái
- Mặc định khi mở trang: **đóng cả hai** (cả khi có `?test`; test mở bảng qua `reveal`, xem 5.2).
- Mỗi lúc chỉ mở một bảng, giống tờ trên điện thoại: mở bảng này thì bảng kia đóng. Dùng chung `ui.sheet` / `openSheet()` / `closeSheets()` của `compactUI.ts`, không tạo trạng thái thứ hai.
- `aria-expanded` của hai nút phản ánh trạng thái như hiện nay.

### 3.2 Mở / đóng
- Bấm ⚙ hoặc ☰: mở; bấm lại: đóng.
- Đóng khi bấm ra ngoài bảng (vào khung 3D) hoặc nhấn Esc (xem 4).
- Bảng Góc nhìn tự đóng khi chọn một góc nhìn hay Tour (`[data-view]`, gồm `Tour 4 cầu`). Bấm chip cầu (`[data-bridge]`) hoặc các nút bật/tắt trong danh sách (mặt cắt hầm, trái tim LED…, không có `data-view`) thì **giữ mở** để chọn tiếp. Đây là hành vi sẵn có của `wireSheets`.
- Bảng Cài đặt giữ mở khi chỉnh (đổi ngôn ngữ, đêm, thời tiết…), để chỉnh được nhiều thứ liên tiếp.
- Tour hoặc kịch bản bão bắt đầu thì đóng bảng đang mở (`wireAutoClose` sẵn có).

### 3.3 Hình dạng (máy tính)
- Lúc đóng, `.brand` chỉ còn nút ⚙. Tiêu đề `h1`, dòng `eyebrow`, ô ngôn ngữ và `#brandBody` ẩn. Lúc mở, bảng hiện như bố cục máy tính hiện nay.
- Lúc đóng, `.views` chỉ còn nút ☰ Góc nhìn (biểu tượng + chữ `views`). Lúc mở, bảng hiện như hiện nay: nhãn, lưới chip cầu 2 cột, `Tour 4 cầu`, danh sách góc nhìn. Bảng giữ `max-height` theo chiều cao cửa sổ và tự cuộn.
- Nút `.sheet-close` (×): **việc của người xây**, chọn hiện hoặc không trên máy tính. Bấm lại ⚙ / ☰ vẫn đóng được.
- Kiểu nút theo `.panel button` sẵn có; khi mở thì nút sáng màu vàng như `body.compact #btnSettings[aria-expanded="true"]`.

### 3.4 Chế độ đặc biệt
- **Dù lượn (`body.explore`):** `.views` đã ẩn, nút ☰ cũng ẩn theo. `.brand` chỉ còn ⚙; mở ra thì thấy các mục chế độ bay đang giữ (ngôn ngữ, đêm, chất lượng hình). Nút ⚙ không được đè lên `#exHint` (giữa trên) hay `#btnExExit` (góc trên cuối dòng, `top` 56 px).
- **Đi bộ (`#hint`)**, **cabin Vòng quay (`#swRideHint`)**, **kịch bản bão**: các khung chữ nằm giữa màn hình như cũ.

## 4. Sửa hai lỗi dùng chung (cả máy tính lẫn điện thoại)
1. **Bấm ra cảnh để đóng bảng làm dừng Tour.** `#scene`/canvas có listener `pointerdown` gọi `exitTour` (`setupUI.ts`) bên cạnh listener đóng tờ (`compactUI.ts`). Sửa: khi có bảng đang mở, cú `pointerdown` đầu tiên trên cảnh chỉ đóng bảng. Không thoát Tour, không bắt đầu kéo camera (OrbitControls), không là cú bấm của chế độ bay.
2. **Esc khi có bảng mở làm thoát Tour / xuống cabin.** Hiện listener Esc trong `compactUI.ts` cố ý không chặn listener khác. Sửa: khi có bảng mở, Esc chỉ đóng bảng. Áp cả với listener Esc của chế độ dù lượn (`src/explore/index.ts`: Esc thoát bay) và sảnh nhiều người.

Cách chặn (đăng ký ở pha capture, `stopImmediatePropagation`, hay cờ chung): việc của người xây.

## 5. Ảnh hưởng tới phần khác
### 5.1 Câu hướng dẫn cabin Vòng quay
`swRideHint` (chuột) đang ghi "Kéo chuột để nhìn quanh · Esc hoặc bấm lại nút để xuống cabin". Nút đó giờ nằm trong bảng Góc nhìn đã đóng. Sửa câu thành chỉ nói Esc, ví dụ "Kéo chuột để nhìn quanh · Esc để xuống cabin", ở **cả 9 locale**. `swRideHintTouch` (điện thoại) giữ nguyên.

Rà các câu khác có nhắc "chọn góc nhìn khác" / "bấm lại nút", ví dụ `walkHint` ("chọn góc nhìn khác để thoát"). Câu đó vẫn đúng, vì người dùng mở ☰ để chọn. Người xây ghi lại câu nào đã rà.

### 5.2 Test
- `reveal()` hiện thoát ngay khi không `ui.compact`. Sửa: chạy ở cả máy tính, để `tap()` / `pick()` trong `tests/lib.mjs` mở đúng bảng trước khi bấm.
- Các test bấm thẳng phần tử trong bảng bằng `page.click` / `page.selectOption` sẽ hỏng khi bảng đóng (phần tử bị ẩn). Đã thấy ở `riverfront-check.mjs`, `tunnel-check.mjs`. Người xây rà mọi file `tests/*.mjs` và chuyển sang `tap` / `pick`.
- Các test gọi `element.click()` trong `page.evaluate` vẫn chạy với phần tử ẩn, không cần sửa.
- Test mới (nên đặt trong `test:mobile` hoặc file riêng, việc của người xây), kiểm ở khung máy tính, ví dụ 1440×780:
  - mở trang: hai bảng đóng, chỉ hai nút hiện, không che quá một vùng nhỏ ở hai góc trên;
  - bấm ⚙ / ☰ thì mở, bấm lại thì đóng, mở cái này thì cái kia đóng;
  - chọn góc nhìn thì bảng Góc nhìn đóng, bấm chip cầu thì vẫn mở;
  - đang Tour, mở ⚙ rồi bấm cảnh: bảng đóng, Tour vẫn chạy; nhấn Esc khi bảng mở: bảng đóng, Tour vẫn chạy;
  - RTL `ar`: hai nút đổi bên;
  - `body.explore`: chỉ ⚙ hiện, không đè `#exHint`, `#btnExExit`.

### 5.3 Draw call, hiệu năng
Chỉ đổi DOM/CSS, không đổi cảnh 3D: mọi góc nhìn chênh 0 draw call. `backdrop-filter` của bảng mở giữ như cũ. Lúc đóng, vùng blur nhỏ hơn nên nhẹ hơn.

## 6. Ràng buộc
- Theo `.github/copilot-instructions.md` §3: không thêm thư viện, không ảnh ngoài. Khóa i18n đổi hoặc thêm phải đủ 9 locale. Thông số mới (nếu có, ví dụ khoảng cách nút) đặt trong `CONFIG.ui` (`src/config.ts`) có chú thích tiếng Việt.
- Không đổi `CONFIG.ui.compactQuery`, không đổi bố cục `body.compact`.
- Không bật lại `.specs` / `.stats` ở chỗ đang ẩn.
- Ghi quyết định vào `.github/memory-bank/decisions.md` (D-025). D-019 nói "màn hình máy tính giữ nguyên", quyết định mới thay phần đó.

## 7. Để người xây quyết
- Tên class / cách tách CSS máy tính với điện thoại, ví dụ dùng chung `body.sheet-*` hay thêm class mới.
- Hiệu ứng mở/đóng (có hay không, ngắn).
- Hiện `.sheet-close` trên máy tính hay không.
- Cách chặn ở mục 4.
- Đặt test mới ở file nào.

## 8. Quyết định do agent chọn (người dùng chưa nói rõ, có thể đổi)
- Mặc định đóng khi mở trang, không nhớ trạng thái.
- Mỗi lúc một bảng.
- Bảng Góc nhìn tự đóng khi chọn góc nhìn; bảng Cài đặt giữ mở khi chỉnh.
- Esc / bấm cảnh lúc có bảng mở chỉ đóng bảng (cả điện thoại).
- Câu `swRideHint` bỏ phần "bấm lại nút".
- Lăn chuột trên cảnh khi có bảng mở giữ như hiện nay: thu phóng và thoát Tour, bảng vẫn mở. Chỉ `pointerdown` trên cảnh mới đóng bảng.
- Bấm vào phần giao diện khác ngoài bảng (`.specs`, `#tourCaption`, khung của chế độ bay) không đóng bảng; chỉ bấm khung 3D (`#scene`) mới đóng.
- Đổi cỡ cửa sổ qua ngưỡng `compactQuery` khi bảng đang mở thì đóng bảng, như `setupCompactUI` đang làm.
