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
- Không chạy hai test cùng lúc. Trước mỗi lần chạy, kiểm không còn tiến trình `*-check.mjs`/`drawcalls.mjs` mồ côi (PowerShell: `Get-CimInstance Win32_Process`): một test bị bỏ dở có thể làm test sau treo hàng giờ.
