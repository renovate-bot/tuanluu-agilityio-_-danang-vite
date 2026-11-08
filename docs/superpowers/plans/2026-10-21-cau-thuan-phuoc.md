# Cầu Thuận Phước — Kế hoạch triển khai (đã hoàn thành)

> **Cho agent thực thi:** kế hoạch này ghi lại việc đã làm. Các mục `- [x]` đã xong. Việc còn lại ở cuối file.

**Mục tiêu:** Mô hình 3D Cầu Thuận Phước ở cửa sông Hàn: cầu treo dây võng 3 nhịp, tháp BTCT chữ H, 114 hanger, hai khối cầu dẫn 12 nhịp, LED đổi màu ban đêm.

**Kiến trúc:** Lớp `ThuanPhuocBridge` kế thừa `BridgeBase` (D-006) trong `src/bridges/thuan-phuoc/` (`towers`, `deck`, `cables`, `approaches`, `site`, `life`, `materials`, `profile`); thông số ở `CONFIG.thuanPhuoc` (`src/config.ts`). Cầu dựng sau `buildCity()`/`buildTrees()` trong `src/main.ts`, không gọi `rand()` (D-002).

**Công nghệ:** Vite 6, TypeScript 5.9, three@0.165, không framework UI. Bản gốc là một file HTML (`tests/original/index.html`).

**Spec:** [2026-10-21-cau-thuan-phuoc-design.md](../specs/2026-10-21-cau-thuan-phuoc-design.md)

**Trạng thái:** Đã hoàn thành (merge b500bb5)

## Giai đoạn

### GĐ1: Bản HTML gốc (một file)
- [x] Dựng cầu (tháp, dầm, cáp chủ, hanger, cầu dẫn), xe, thuyền, Tour 7 điểm trong `tests/original/index.html`.
- [x] Giữ bản này làm chuẩn hồi quy hành vi và draw call (D-003).

Commit: bản gốc có từ lúc khởi tạo repo (`b500bb5`, 2026-10-20); chưa tách được commit riêng cho Thuận Phước.
Kiểm tra: không có test riêng ở giai đoạn này; bản gốc là mốc cho GĐ2.

### GĐ2: Chuyển sang Vite + TypeScript
- [x] Tách `src/bridges/thuan-phuoc/` (`ThuanPhuocBridge`, `towers`, `deck`, `cables`, `approaches`, `site`, `life`, `materials`, `profile`), thông số vào `CONFIG.thuanPhuoc`.
- [x] Dùng chung `src/common/` (`BridgeBase`, `deck`, `geometry`, `traffic`, `boats`, `shaders`); LED bằng `bridgePatch` bảng màu `'sea'`.
- [x] Góc nhìn `tpBay`, `tpWater`, `tpDrive`, `tpBoth`; Tour `TP_TOUR` 7 điểm; bảng Thông số; i18n 9 ngôn ngữ.

Commit: `b500bb5` (Init project).
Kiểm tra: `npm run test:drawcalls`, 36/36 lần đo chênh 0 so với bản gốc (2026-10-20); `npm run test:tour`.

### GĐ3: Thuyết minh Tour
- [x] Clip vi + en (`tpStops-0…6`), manifest thời lượng (D-005).
- [x] Clip tiếng Nga.

Commit: `7c60d82` (vi + en); `0a0b6be` (ru).
Kiểm tra: `npm run test:voice`, đạt (vi + en + ru, 2026-10-27).

### GĐ4: Nối với thời tiết (`feature/weather`)
- [x] Vật liệu `weather: true`, mặt đường `registerWet` (ướt khi mưa).
- [x] Hanger `sway: 'tp'` lắc theo gió; biên độ `CONFIG.weather.wind.tp`.
- [x] Cáp chủ `sag: 'cable'` và hanger `sag: 'hanger'` võng thêm khi nóng.
- [x] Hanger dựng bằng hình trụ `cableSegs` = 8 đoạn để shader lắc uốn cong được dây.
- [x] Bão đóng cầu: xe ẩn dần, thuyền về bến (`weatherFx.clear`, D-012); bảng "Ảnh hưởng tới cầu" có ô Thuận Phước; góc nhìn `wxRiverMouth`.

Commit: `5f780b4` (ướt, `materials.ts`); `e3906e7` (gió, `materials.ts`); `1b39173` (đóng cầu, commit chung: `common/BridgeBase.ts`, `common/traffic.ts`, `common/boats.ts`, không sửa file trong `thuan-phuoc/`); `edced8b` (võng khi nóng, `materials.ts`); `8c7ef9e` (hanger nhiều đoạn, `cables.ts`); `c169343` (bảng ảnh hưởng, góc `wxRiverMouth`, commit chung).
Kiểm tra: `npm run test:drawcalls` (52/52 chênh 0 ở các GĐ 2–4 của thời tiết), `npm run test:weather` đạt, `npm run test:tour` đạt (2026-10-21 đến 2026-10-27).

### GĐ5: Tour 4 cầu
- [x] `ALL_TOUR` đi qua Thuận Phước (3 điểm cuối) và kết thúc ở vịnh; thuyết minh `allStops`.

Commit: `e672add` (đường bay mở, 13 điểm, `src/views/tourStops.ts`); `cd52a47` (thuyết minh `allStops` vi/en/ru, 39 clip). Không sửa file trong `thuan-phuoc/`.
Kiểm tra: `npm run test:tour` (đạt), `npm run test:voice` (đạt, 2026-10-27).

## Còn lại
- [ ] Đối chiếu số ước lượng (độ võng cáp, tiết diện tháp, dầm ngang, cao độ mố, khối neo) với nguồn công khai.
- [ ] Đưa hằng số rời trong `cables.ts`, `approaches.ts`, `towers.ts` vào `CONFIG`.
- [ ] Chạy `npm run test:drawcalls -- tests/original` để biết vì sao bảng 2026-10-24 cao hơn bảng 2026-10-20.
- [ ] Ghi draw call từng preset thời tiết (`rain`, `storm`) vào `tests/KET-QUA.md`.
- [ ] Thuyết minh ko, ja, zh, th, ar, hi.
- [ ] Sóng bạc đầu cửa sông (thời tiết); đo FPS GPU thật.
