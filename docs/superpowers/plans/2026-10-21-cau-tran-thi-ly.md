# Cầu Trần Thị Lý — Kế hoạch triển khai (đã hoàn thành)

> **Cho agent thực thi:** kế hoạch này ghi lại việc đã làm. Các mục `- [x]` đã xong. Việc còn lại ở cuối file.

**Mục tiêu:** Mô hình 3D Cầu Trần Thị Lý: cầu dây văng BTCT một tháp nghiêng 12°, hệ dây 3 mặt phẳng (hai mặt sau xoắn), 6 làn, cầu Nguyễn Văn Trỗi cũ, LED đổi màu.

**Kiến trúc:** Lớp `TranThiLyBridge` kế thừa `BridgeBase` (D-006) trong `src/bridges/tran-thi-ly/` (`pylon`, `stays`, `deck`, `approaches`, `nvt`, `life`, `materials`, `profile`); thông số ở `CONFIG.tranThiLy` (`src/config.ts`). Dựng sau `buildCity()`/`buildTrees()`, không gọi `rand()` (D-002).

**Công nghệ:** Vite 6, TypeScript 5.9, three@0.165, không framework UI. Bản gốc là một file HTML (`tests/original/index.html`).

**Spec:** [2026-10-21-cau-tran-thi-ly-design.md](../specs/2026-10-21-cau-tran-thi-ly-design.md)

**Trạng thái:** Đã hoàn thành (merge b500bb5)

## Giai đoạn

### GĐ1: Bản HTML gốc (một file)
- [x] Dựng cầu (tháp nghiêng, dây 3 mặt phẳng, dầm, cầu dẫn), cầu Nguyễn Văn Trỗi cũ, xe, thuyền, người đi bộ, Tour 7 điểm trong `tests/original/index.html`.
- [x] Giữ bản này làm chuẩn hồi quy hành vi và draw call (D-003).

Commit: bản gốc có từ lúc khởi tạo repo (`b500bb5`, 2026-10-20); chưa tách được commit riêng cho Trần Thị Lý.
Kiểm tra: không có test riêng ở giai đoạn này; bản gốc là mốc cho GĐ2.

### GĐ2: Chuyển sang Vite + TypeScript
- [x] Tách `src/bridges/tran-thi-ly/` (`TranThiLyBridge`, `pylon`, `stays`, `deck`, `approaches`, `nvt`, `life`, `materials`, `profile`), thông số vào `CONFIG.tranThiLy`.
- [x] Dùng chung `src/common/` (`BridgeBase`, `deck`, `geometry`, `traffic`, `boats`, `people`, `shaders`); LED `bridgePatch` bảng màu `'sail'`, ba mẫu (`#ttlPatternSel`).
- [x] Góc nhìn `ttlOverview`, `ttlBase`, `ttlDeck`, `ttlBoth`; Tour `TTL_TOUR` 7 điểm; nút xe/người/cầu NVT; bảng Thông số; i18n 9 ngôn ngữ.

Commit: `b500bb5` (Init project).
Kiểm tra: `npm run test:drawcalls`, 36/36 lần đo chênh 0 so với bản gốc (2026-10-20); `npm run test:tour`.

### GĐ3: Thuyết minh Tour
- [x] Clip vi + en (`ttlStops-0…6`), manifest thời lượng (D-005).
- [x] Clip tiếng Nga.

Commit: `7c60d82` (vi + en); `0a0b6be` (ru).
Kiểm tra: `npm run test:voice`, đạt (vi + en + ru, 2026-10-27).

### GĐ4: Nối với thời tiết (`feature/weather`)
- [x] Vật liệu `weather: true`, bê tông `wet: true`, mặt đường `registerWet` (ướt khi mưa).
- [x] Dây văng `sway: 'ttl'`: rung mưa–gió; thêm dao động gió giật `buffet`.
- [x] Dây dựng bằng hình trụ `cableSegs` = 8 đoạn để shader uốn cong được dây (lỗi dây không lắc từ GĐ4 phát hiện ở mốc 4 kịch bản bão).
- [x] Bão đóng cầu: xe, người, thuyền ẩn dần (D-012); bảng "Ảnh hưởng tới cầu"; góc nhìn `wxTtlStays`.

Commit: `5f780b4` (ướt, `materials.ts`); `e3906e7` (gió, `materials.ts`); `1b39173` (đóng cầu, commit chung: `common/*`, không sửa file trong `tran-thi-ly/`); `8c7ef9e` (dây nhiều đoạn, `stays.ts`); `c169343` (bảng ảnh hưởng, góc `wxTtlStays`, commit chung).
Kiểm tra: `npm run test:drawcalls` (52/52 chênh 0 ở các GĐ 2–4 của thời tiết), `npm run test:weather` đạt (kiểm điểm ảnh dây lắc ở mốc 4), `npm run test:tour` đạt (2026-10-21 đến 2026-10-27).

### GĐ5: Tour 4 cầu
- [x] `ALL_TOUR` mở đầu bằng Trần Thị Lý (3 điểm đầu), vượt cầu ở x ≈ 140; thuyết minh `allStops`.

Commit: `e672add` (đường bay mở, 13 điểm, `src/views/tourStops.ts`); `cd52a47` (thuyết minh `allStops` vi/en/ru). Không sửa file trong `tran-thi-ly/`.
Kiểm tra: `npm run test:tour` (đạt), `npm run test:voice` (đạt, 2026-10-27).

## Còn lại
- [ ] Nhận ảnh tham chiếu để chỉnh tiết diện tháp ("cánh buồm"), `pylonX`, chia nhịp dẫn, `roadProfile`.
- [ ] Nút giao nhiều tầng và hầm chui đầu Tây (nếu muốn).
- [ ] Đưa `farDistance` (2.600 m), kích thước hộp neo và khối đế vào `CONFIG`.
- [ ] Chạy `npm run test:drawcalls -- tests/original` để biết vì sao bảng 2026-10-24 cao hơn bảng 2026-10-20.
- [ ] Thuyết minh ko, ja, zh, th, ar, hi.
