---
applyTo: "tests/**"
description: Quy ước viết script kiểm tra Playwright
---

# Kiểm tra trong `tests/`

- Script `.mjs` ESM, chạy bằng `node`, khai báo trong `package.json` dạng `test:<ten>`.
- Dùng `tests/lib.mjs`: `serveDir(dist/)`, `launch()` (SwiftShader), `openApp(browser, url, {width, height, mobile})` → `{ page, errors }` (`mobile: true` = `isMobile` + `hasTouch`), `frames`, `waitFlight`.
- Bấm nút giao diện bằng `tap(page, sel)` / `pick(page, sel, value)` thay cho `page.click` / `selectOption`: hai hàm này mở đúng sheet trước khi bấm. Khung mặc định 480×270 khớp `(max-height: 500px)` nên **mọi test đều chạy ở chế độ gọn** (`body.compact`, không blur); nút trong sheet đang đóng thì `page.click` sẽ hết giờ. Từ D-025 khung máy tính (vd. 960×540) cũng thu gọn hai bảng, nên quy tắc này áp cho mọi khung.
- Đọc trạng thái qua `window.__app` (cần `?test`, `openApp` đã thêm). Đối tượng mới cần kiểm → thêm vào `__app` trong `src/main.ts`.
- Gom lỗi: `const problems = []; const check = (ok, msg) => …`; cuối test kiểm `errors` console rỗng, in kết quả tiếng Việt, `process.exit(1)` nếu có lỗi.
- Comment đầu file liệt kê đánh số những gì được kiểm + lệnh chạy (mẫu `tunnel-check.mjs`).
- Ảnh chụp → `tests/screens/` (đã gitignore), có cờ `--no-shots`.
- **Không sửa `tests/original/`** — đó là bản gốc dùng để so sánh.
- Cập nhật `tests/KET-QUA.md` khi đo lại draw call chuẩn (ghi ngày, cấu hình máy/kích thước khung).
- Test chậm (10–20 phút): khi lặp nhanh, chạy riêng phần cần, nhưng báo cáo cuối phải chạy đủ.
- SwiftShader trên máy chậm chỉ ~3 s/khung (đo khi làm D-029): chờ theo thời gian dùng `waitForFunction(…, { polling: <ms> })` thay vì rAF, đừng đếm số khung cố định; test nhiều người không thử rời máy thì thêm `idleMs=600000` vào URL để slot không bị thu giữa chừng; không bọc lệnh test trong `timeout` (từng làm chết lượt chạy).
- Cảm ứng nhiều ngón thật: CDP `Input.dispatchTouchEvent` (mẫu `mobile-check.mjs`); `touchEnd` / `touchCancel` với danh sách rỗng kết thúc **mọi** ngón.
- Kiểm va chạm ("không xuyên") phải dùng oracle độc lập với mã đang chấm và có bằng chứng không rỗng (có bước sát tường, tường thật chặn lại) — xem mẫu đi dạo trong `systemPatterns.md`.
- `wrangler dev` cổng 8799 bị bỏ lại sẽ làm `test:multi` / `test:multi:worker` hỏng: kiểm tiến trình `wrangler` mồ côi cùng lúc với `*-check.mjs`.
- Viết file test bằng công cụ sửa file, không dán mã có dấu `>` vào lệnh shell: trên máy này đã sinh file rỗng lạc ở gốc repo (`0`, `hi`, `o.msg.t`…).
- Không chạy hai test cùng lúc. Trước mỗi lần chạy, kiểm không còn tiến trình `*-check.mjs`/`drawcalls.mjs` mồ côi (PowerShell: `Get-CimInstance Win32_Process`): một test bị bỏ dở có thể làm test sau treo hàng giờ.
- `?test` tắt bộ đèn theo trạng thái (luôn `full`, D-031) để bảng draw call chuẩn giữ nguyên; test cần bộ đèn mở thêm `lightsets=sync` (như `perf-check.mjs`) hoặc `lightsets=bg` (như `gpu-time.mjs`) và đọc `__app.lights` (`set`, `ready`, `mode`).
- `npm run test:gpu` chạy trên GPU thật, không chấm theo ms; không chạy cùng lúc với test SwiftShader (số đo nhiễu).
- Test người đi bộ (D-032): `tests/people-check.mjs` chạy cả đường người thật, `?crowd=off`, chặn `people/crowd.*`, `crowd.bin` chậm quá `loadTimeoutMs`, `crowd.jpg` hỏng; sửa vùng người đi bộ thì kiểm đủ các trang. Người thật bị bão ẩn giữ ma trận cũ, đếm bằng `visible` (`getVisibleAt`), không bằng scale 0; bật / tắt hệ để đếm lệnh vẽ phải đổi `visible` của lưới. Bộ kiểm có cả "ảnh đêm không đen kịt" (NaN từ pháp tuyến dài 0 từng làm đen cả khung) và độ cao chân so với mặt lề (`crowdFeet()`). `openApp` có tuỳ chọn `before(page)` để gắn route / nghe console trước khi mở trang.
