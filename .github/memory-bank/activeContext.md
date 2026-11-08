# Active Context

_Cập nhật: 2026-11-09 · Nhánh đang làm: `feature/explore-du-luon` · Nhánh chính: `main`_

## Trạng thái
- Đang làm: chế độ tự khám phá bằng dù lượn (D-020): mã, giao diện, i18n và đủ bộ test đã xong trên nhánh, kết quả ở `tests/KET-QUA.md`; chờ merge.
- `main` đã có đủ: Hầm vượt sông Hàn (PR #1), hai bờ sông + tối ưu draw call + thuyết minh tiếng Nga (PR #2), bộ hướng dẫn AI agent + memory bank (PR #3), thời tiết GĐ1–GĐ8 + kịch bản bão có thuyết minh (PR #6), Tour 4 cầu (D-015), Vòng quay Mặt Trời GĐ0–GĐ8 (PR #8, merge `257b905`), tối ưu độ mượt (D-018, merge `ecebdf8`), giao diện điện thoại (D-019, merge `fc53fdd`), Buy me a coffee (D-021, PR #10, merge `cbfda36`).
- `prompts/` đã chuyển sang `docs/superpowers/` (spec + plan cho từng tính năng; PR #11, merge `66d7ebb`). Lịch sử từng giai đoạn (đã làm, số đo, lần chấm LỖI, hạn chế) nằm trong `docs/superpowers/plans/`; thiết kế như đã xây nằm trong `docs/superpowers/specs/`.
- Buy me a coffee (D-021) đã triển khai; `CONFIG.ui.donate.url` đã cấu hình, trang MoMo mở được trong trình duyệt, chưa kiểm tra giao dịch trên điện thoại thật. Chi tiết: [plan](../../docs/superpowers/plans/2026-10-29-buy-me-a-coffee.md).
- Quy tắc chế độ gọn cho agent: `.github/instructions/ui-views.instructions.md`, `tests.instructions.md`. Lệnh test đầy đủ: `copilot-instructions.md` §5. Bảng draw call chuẩn: `tests/KET-QUA.md`.

## Bước tiếp theo
0. Tự khám phá (D-020): merge nhánh; sau đó người bản ngữ duyệt 8 bản dịch `ex*`, đo FPS trên GPU thật. [plan](../../docs/superpowers/plans/2026-11-02-tu-kham-pha-du-luon.md)
1. Giao diện điện thoại (D-019): còn đo trên điện thoại thật; duyệt 7 bản dịch khóa mới; chip cao 36 px (< 44 px); câu hướng dẫn xuống cabin trỏ tới nút trong sheet Góc nhìn. [plan](../../docs/superpowers/plans/2026-10-26-mobile-ui.md)
2. Tối ưu độ mượt (D-018): chưa đo GPU / điện thoại thật; khung đầu SwiftShader 16,4 s (prewarm); đề xuất test bỏ qua lịch tự quay Cầu sông Hàn khi `?test`. [plan](../../docs/superpowers/plans/2026-10-24-toi-uu-do-muot.md)
3. Tour 4 cầu (D-015): chưa kiểm giọng nghe thật, Tour ban đêm / thời tiết khác `now`. Lời điểm 7 ("Tiếp tục về phía Bắc") đọc lúc camera còn nhìn lại Cầu Rồng; chỉnh `ALL_TOUR[6]` nếu muốn quay về hướng Bắc. [plan](../../docs/superpowers/plans/2026-10-22-tour-4-cau.md)
4. Thời tiết: tự chọn preset theo tháng khi không có `?test` (12b-6); làm xong phải chạy lại `test:weather` và `test:drawcalls` vì đổi mặc định hiển thị. Còn thiếu: số draw call từng preset, sóng bạc đầu cửa sông, bơm hầm, tàu cao `ship`. [plan](../../docs/superpowers/plans/2026-10-21-thoi-tiet.md)
5. Vòng quay Mặt Trời (D-014/D-016/D-017): (a) sửa `tests/drawcalls.mjs` trả ban ngày sau `rfHearts` rồi đo lại bảng (cột "ngày" của `rfBank`, `wx*`, `swOverview/Front/Base/FromTTL` thực ra đo ban đêm); (b) chạy `test:drawcalls` một mình tại `main` và `-- tests/original`; (c) số ước lượng `x ≈ −440`, D ≈ 93 m, trục ≈ 64 m, bệ ≈ 13 m; (d) nghe thử giọng `swStops`, `/code-review`, FPS GPU thật; (e) khác ảnh tham chiếu: giá treo cabin, lầu hai đầu bệ rỗng, đèn rọi trời. [plan](../../docs/superpowers/plans/2026-10-22-vong-quay-mat-troi.md)
6. Buy me a coffee: chưa thực hiện giao dịch, chưa kiểm tra trên điện thoại thật. [plan](../../docs/superpowers/plans/2026-10-29-buy-me-a-coffee.md)
7. Trước mỗi test chạy lâu, kiểm không còn tiến trình `*-check.mjs` / `drawcalls.mjs` mồ côi (PowerShell: `Get-CimInstance Win32_Process`); chúng tranh CPU và từng làm `test:perf` treo hàng giờ.

## Vấn đề mở / cần quyết
- Tọa độ các địa danh riverfront là ước lượng (chưa có nguồn công khai); số tầng đã xác minh — xem comment đầu `src/environment/riverfront/landmarks.ts`.
- Thuyết minh cho ko, ja, zh, th, ar, hi: chưa lên kế hoạch.
