# Cầu sông Hàn (cầu quay) — Kế hoạch triển khai (đã hoàn thành)

> **Cho agent thực thi:** kế hoạch này ghi lại việc đã làm. Các mục `- [x]` đã xong. Việc còn lại ở cuối file.

**Mục tiêu:** Mô hình 3D Cầu sông Hàn, cầu quay dây văng duy nhất ở Việt Nam, với animation quay 90° quanh trụ mâm xoay: barie, đèn tín hiệu, chốt khóa, tàu buồm cao qua luồng, lịch tự quay 23:00 thứ Bảy và Chủ nhật.

**Kiến trúc:** Lớp `SongHanBridge` kế thừa `BridgeBase` (D-006) trong `src/bridges/song-han/` (`fixedSpans`, `turntable`, `swingSpan`, `signals`, `life`, `materials`, `profile`, `SwingController`); nhịp quay là một `THREE.Group` riêng có gốc tại tâm trụ; UI quay cầu ở `src/ui/swingUI.ts`; thông số ở `CONFIG.songHan` (`src/config.ts`). Dựng sau `buildCity()`/`buildTrees()`, không gọi `rand()`; `hideBankTrees()` thu cây về scale 0 (D-002).

**Công nghệ:** Vite 6, TypeScript 5.9, three@0.165, không framework UI. Bản gốc là một file HTML (`tests/original/index.html`).

**Spec:** [2026-10-21-cau-song-han-design.md](../specs/2026-10-21-cau-song-han-design.md)

**Trạng thái:** Đã hoàn thành (merge b500bb5)

## Giai đoạn

### GĐ1: Bản HTML gốc (một file)
- [x] Dựng cầu (nhịp cố định, trụ quay, nhịp quay, dây văng), `class SwingController` (máy trạng thái 8 bước), barie, đèn tín hiệu, tàu buồm, xe, người, thuyền, lịch tự quay, Tour 6 điểm trong `tests/original/index.html`.
- [x] Giữ bản này làm chuẩn hồi quy hành vi và draw call (D-003).

Commit: bản gốc có từ lúc khởi tạo repo (`b500bb5`, 2026-10-20); chưa tách được commit riêng cho Cầu sông Hàn.
Kiểm tra: không có test riêng ở giai đoạn này; bản gốc là mốc cho GĐ2.

### GĐ2: Chuyển sang Vite + TypeScript
- [x] Tách `src/bridges/song-han/` (`SongHanBridge`, `SwingController`, `fixedSpans`, `turntable`, `swingSpan`, `signals`, `life`, `materials`, `profile`), thông số vào `CONFIG.songHan`.
- [x] `src/ui/swingUI.ts`: nút quay, tốc độ 1×/10×/30×, trạng thái, camera theo dõi (`shSwingCam`), lịch tự quay UTC+7, còi và tiếng động cơ.
- [x] Góc nhìn `shOverview`, `shTop`, `shBank`, `shDeck`; Tour `SH_TOUR` 6 điểm (điểm 2 tự quay 30×); bảng Thông số; i18n 9 ngôn ngữ.

Commit: `b500bb5` (Init project).
Kiểm tra: `npm run test:drawcalls`, 36/36 lần đo chênh 0 so với bản gốc (2026-10-20); `npm run test:tour` (cầu tự quay ở điểm 2).

### GĐ3: Thuyết minh Tour
- [x] Clip vi + en (`shStops-0…5`), manifest thời lượng (D-005).
- [x] Clip tiếng Nga.

Commit: `7c60d82` (vi + en); `0a0b6be` (ru).
Kiểm tra: `npm run test:voice`, đạt (vi + en + ru, 2026-10-27).

### GĐ4: Nối với thời tiết (`feature/weather`)
- [x] Vật liệu `weather: true`, bê tông `wet: true`, đường `registerWet` (ướt khi mưa).
- [x] Dây văng `sway: 'sh'` lắc theo gió; hình trụ `cableSegs` = 8 đoạn để uốn cong được dây.
- [x] Bão: `SwingController.canStart` + sự kiện `swingBlocked`, `weather.attachSwing(songHan.ctrl)`; `swingUI.ts` hiện lý do vài giây (D-012).
- [x] Tour Cầu sông Hàn khi bão: thêm câu "Tạm hoãn quay cầu do thời tiết." vào chú thích, `fromTour` không treo.
- [x] Bão đóng cầu: xe ẩn, thuyền về bến; bảng "Ảnh hưởng tới cầu" có ô Cầu sông Hàn ("Không quay cầu").

Commit: `5f780b4` (ướt, `materials.ts`); `e3906e7` (gió, `materials.ts`); `1b39173` (`SwingController.ts` +2 dòng, `swingUI.ts`, commit chung: `common/*`, `effectsHooks.ts`); `8c7ef9e` (dây nhiều đoạn, `swingSpan.ts`); `c169343` (chú thích Tour bị hoãn, bảng ảnh hưởng; commit chung).
Kiểm tra: `npm run test:weather` đạt (`start()` false khi bão, `canStart()` true khi hết bão; lần 1 lỗi do lịch tự quay 23:00 thứ Bảy, chạy lại sau 23:10 đạt, 2026-10-27); `npm run test:drawcalls` (52/52 chênh 0 ở các GĐ 2–4 của thời tiết); `npm run test:tour` đạt.

### GĐ5: Tour 4 cầu
- [x] `ALL_TOUR` điểm 8 (`bridge: 'sh'`, `swing: true`) tự quay cầu 30×; điểm 9 nhìn nhịp quay mở luồng; thuyết minh `allStops`.

Commit: `e672add` (đường bay mở, 13 điểm, `src/views/tourStops.ts`, `swingUI.ts`); `cd52a47` (thuyết minh `allStops` vi/en/ru).
Kiểm tra: `npm run test:tour` (đạt: kiểm điểm có cờ `swing` làm trạng thái rời "Đóng"), `npm run test:voice` (đạt, 2026-10-27).

### GĐ6: Tối ưu độ mượt (D-018)
- [x] `shUpdateSignals`, `shPlaceRollers`, `shStepTraffic` bỏ cấp phát mỗi khung; mảng tạm dùng lại; chỉ cập nhật tín hiệu khi `details` hiện.

Commit: `134d5c8` (commit chung nhiều phần; trong cầu này chỉ `SongHanBridge.ts`, `life.ts`, `signals.ts`, `turntable.ts`).
Kiểm tra: `npm run test:perf -- --strict` đạt (≤ +29 ms, 0 program mới), `npm run test:drawcalls` 73/74 khớp (2026-10-25).

## Còn lại
- [ ] Đề xuất: bỏ qua lịch tự quay khi `?test` (lịch 23:00 thứ Bảy làm `test:weather` lỗi nếu chạy đúng giờ đó).
- [ ] Ảnh gốc của tháp/dây để đối chiếu; ước lượng `drumR`, `railR`, tĩnh không ~11 m, chia nhịp 6/5.
- [ ] Xử lý bão đến khi cầu đang quay (hiện chỉ chặn `start()`).
- [ ] Test hình học không va chạm trụ đón/đệm; test máy trạng thái; kiểm frustum culling của nhịp quay khi xoay.
- [ ] Tàu cao `ship` phản ứng riêng với thời tiết.
- [ ] Thuyết minh ko, ja, zh, th, ar, hi.
- [ ] Chạy `npm run test:drawcalls -- tests/original` để biết vì sao bảng 2026-10-24 cao hơn bảng 2026-10-20.
