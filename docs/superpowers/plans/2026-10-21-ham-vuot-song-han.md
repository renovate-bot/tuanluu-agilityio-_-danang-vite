# Hầm vượt sông Hàn — Kế hoạch triển khai (đã hoàn thành)

> **Cho agent thực thi:** kế hoạch này ghi lại việc đã làm. Các mục `- [x]` đã xong. Việc còn lại ở cuối file.

**Mục tiêu:** Mô hình 3D Hầm vượt sông Hàn (phương án đề xuất 2025, chưa xây): hầm dìm 5 đốt × 120 m qua sông, hầm kín trên bờ, hầm hở hai đầu, nội thất, chế độ mặt cắt địa chất, mô phỏng dìm đốt hầm, lái xe xuyên hầm, Tour 8 điểm có thuyết minh.

**Kiến trúc:** Lớp `HanTunnel` kế thừa `BridgeBase` trong `src/bridges/han-tunnel/` (`profile`, `shell`, `bore`, `outdoor`, `riverbed`, `cutaway`, `immersion`, `corridor`, `materials`); thông số ở `CONFIG.hanTunnel` (`hanTunnelBase` + `deriveHr()` trong `src/config.ts`); UI ở `src/ui/hrUI.ts`. Dựng sau mọi lệnh dùng `rand()`, không gọi `rand()`; `hrClearCorridor()` thu nhà/cây/cột đèn trên hành lang `|z + 1700| < 30` về scale 0 (D-002). Quyết định D-007: bám số công bố, phần còn lại là ước lượng.

**Công nghệ:** Vite 6, TypeScript 5.9, three@0.165, không framework UI.

**Spec:** [2026-10-21-ham-vuot-song-han-design.md](../specs/2026-10-21-ham-vuot-song-han-design.md)

**Trạng thái:** Đã hoàn thành (merge 745f72d, PR #1)

## Giai đoạn

### GĐ1: Hầm đầy đủ trên nhánh `feature/han-tunnel`
Prompt gốc chia 9 bước (khảo sát; config + profile; khoét đất + nước + đáy sông; hầm dìm/kín/hở + cửa; nội thất + xe; mặt cắt; dìm đốt hầm; UI + Tour + i18n + thuyết minh; test + tài liệu). Mã thật nằm trong MỘT commit, nên các việc dưới đây chung một mốc.
- [x] Khảo sát `config.ts`, `BridgeBase.ts`, `bridges/song-han/`, `environment/*`, `common/traffic.ts`, `views/*`, `ui/*`, `i18n`, `tests/*.mjs`.
- [x] `hanTunnelBase` + `deriveHr()` trong `src/config.ts` (mỗi dòng có chú thích, đơn vị, `(ước lượng)`); `profile.ts` (`hrRoadY`, `hrBedY`, `HR_HOLES`, `hrInside`).
- [x] Khoét đất cho hai máng hầm hở (`environment/river.ts`); vá shader nước bằng `uHoles` (`cutaway.ts`); đáy sông + hào + đá hộc (`riverbed.ts`).
- [x] Vỏ hầm và gioăng (`shell.ts`); nội thất theo ba đoạn gồm đốt số 3 tách riêng (`bore.ts`); máng hầm hở, mái lam, cửa Tây/Đông, gờ chắn ngập, cửa phai, khung 4,5 m, đường nối, cọ (`outdoor.ts`).
- [x] Dọn hành lang bằng scale 0 (`corridor.ts`); `HanTunnel` dựng trong `main.ts` sau `SongHanBridge`.
- [x] Xe có làn xe máy (`createTraffic`); thuyền tránh vùng thi công (`boatKeepOut` trong `environment/traffic.ts`).
- [x] Mặt cắt địa chất: clipping plane, nước trong, tấm địa chất canvas, 7 nhãn 3D (`cutaway.ts`, `ui/hrUI.ts`).
- [x] Mô phỏng dìm đốt hầm số 3 (`immersion.ts`); lái xe xuyên hầm có mắt thích nghi (`hrDrive`, `views/camera.ts`).
- [x] 6 góc nhìn + `hrSimCam`, `BRIDGE_HOME.hr`, `SPEC_KEYS.hr`, Tour `HR_TOUR` 8 điểm, nút và khối dìm trong `index.html`.
- [x] i18n 9 ngôn ngữ (`scripts/add-tunnel-locales.mjs`), thuyết minh `hrStops` vi/en (`scripts/add-tunnel-narration.mjs`, 16 clip), README mục Cấu trúc và Hầm.
- [x] `tests/tunnel-check.mjs` + `npm run test:tunnel`; Tour hầm trong `tests/tour-check.mjs`.

Commit: `bdab293` (cùng bản cập nhật `prompts/cau-*.md`, `.gitignore`, `package.json`); merge PR #1 vào `main` là `745f72d` (2026-10-21).
Kiểm tra: `npm run build`; `npm run test:tunnel` (hình học 600/380/415, dốc, phủ nóc, mặt cắt bật/tắt 3 lần, mắt thích nghi, dìm đủ trạng thái); `npm run test:tour` (hr 8 điểm). Log ngày của lần chạy đầu chưa lưu trong repo (chưa đối chiếu).

### GĐ2: Giảm draw call hầm
- [x] Gộp biển VMS và biển 4,5 m vào một canvas/mesh.
- [x] Gộp dải LED, lam mái, cọ, thuyền thúng, dải giữa, vỉa hè vào bê tông (màu đỉnh).
- [x] Bê tông/thép gộp không vào lượt phản chiếu mặt nước (`layers.set(1)`); thép và cột đèn không đổ bóng; bỏ đổ bóng thừa.
- [x] Ẩn chi tiết theo khoảng cách: `lodDistance` 1300 → 600 m, `farDistance` 1600 → 650 m, xe 450 m, cả công trình 1.500 m (`hideDistance`).
- [x] Nâng điểm dừng cổng của Tour hầm lên 15 m để đường bay không lọt dưới đất (`views/tourStops.ts`).

Commit: `a4802ad` (2026-10-21; `HanTunnel.ts`, `outdoor.ts`, `config.ts`, `tourStops.ts`).
Kiểm tra: `npm run test:drawcalls`, `npm run test:tunnel` (ghi ở `progress.md`; số draw call hầm sau này ở `tests/KET-QUA.md`: `hrOverview` 277 / 307, `hrCutaway` 358 / 390, `hrPortalW` 163 / 190, `hrPortalE` 205 / 229, `hrDrive` 210 / 234, `hrGallery` 169 / 200, ngày / đêm).

### GĐ3: Test dài hơn và đo thêm góc nhìn hầm
- [x] `tests/lib.mjs` tăng timeout; `tests/tour-check.mjs --only=` chạy từng Tour; `tests/drawcalls.mjs` thêm 6 góc `hr*` (và `rf*`) vào `VIEWS`.

Commit: `92c8d34` (3 file test).
Kiểm tra: `npm run test:tour -- --only=hr`; `npm run test:drawcalls` (log về sau trong `tests/KET-QUA.md`).

### GĐ4: Ngôn ngữ Nga cho Tour hầm
- [x] `hrStops` tiếng Nga (8 clip `public/voice/ru/hrStops-0…7.mp3`), cùng 5 Tour / 36 điểm dừng.

Commit: `0a0b6be` (thuyết minh tiếng Nga; commit chung nhiều Tour).
Kiểm tra: `npm run test:voice` (vi + en + ru đạt, 2026-10-27).

### GĐ5: Thời tiết GĐ3 — sửa hai lỗi có sẵn để `test:tunnel` qua
Lần chấm 0 của GĐ3 thời tiết lỗi vì `test:tunnel`; hai lỗi KHÔNG do mưa/ướt mà có sẵn trong mã hầm.
- [x] `riverbed.group.visible` bỏ điều kiện `details.visible &&`: camera `hrOverview` cách tâm hầm ≈ 797 m (> `lodDistance` 600 m) nên bật mặt cắt không hiện đáy sông (`hrBed` false ở bước 2 của test). Draw call không đổi.
- [x] Dao động sóng của đốt nổi trong `applySim()` chỉ chìm xuống: `(sin(t·1,3) − 1)·0,04` ∈ [−0,08; 0] thay cho `sin·0,08`, nên `lift` không bao giờ vượt `FLOAT_LIFT` 8,4 m (log lỗi: 8,4395 ở khung đầu `BALLAST`); `FLOAT_IN` vẫn > 8.

Commit: `5f780b4` (`HanTunnel.ts` +5/−2 dòng; commit chung với mưa + mặt ướt của thời tiết GĐ3).
Kiểm tra: `npm run build`; `test:drawcalls` 52/52 chênh 0; `test:tunnel` đạt sau sửa (ghi ở `activeContext.md`, mục Thời tiết — Giai đoạn 3). Không nới ngưỡng test.

### GĐ6: Thời tiết GĐ5 — hầm không đóng khi bão
- [x] `HanTunnel.closable = false`; `stepTraffic(…, false)`: hầm vẫn lưu thông khi preset Bão (bơm thoát nước làm việc).
- [x] Bảng "Ảnh hưởng tới cầu" ghi hầm vẫn lưu thông "(phương án đề xuất)" (`wxTunnelOk`, thuộc spec thời tiết).

Commit: `1b39173` (`HanTunnel.ts` +2/−1 dòng; commit chung với bão: chớp, đóng cầu, cầu quay).
Kiểm tra: `npm run test:drawcalls`, `npm run test:weather` (log GĐ5).

### GĐ7: Tối ưu độ mượt (D-018)
- [x] Mặt cắt dùng `clippingPlanes` gán cố định từ lúc dựng; tắt = đẩy mặt phẳng đầu ra 1e7 m, thay cho đổi `clippingPlanes`/`clipIntersection` lúc chạy (tránh biên dịch lại shader).

Commit: `134d5c8` (`cutaway.ts` +6/−5 dòng; commit chung nhiều phần).
Kiểm tra: `npm run test:perf -- --strict` đạt (bay tới Hầm lần đầu +14 ms / 0 program; bật mặt cắt lần 1 +5 ms / 0 program, so với GĐ0 +12 577 ms / +22), 2026-10-25; `npm run test:tunnel` đạt.

### GĐ8: Ghi nhận bảng đo `hr*` (thời tiết GĐ8)
- [x] `tests/KET-QUA.md` có 6 góc `hr*` ngày / đêm; Tour `hr` 8 điểm đạt (camera thấp nhất −14,73 m).

Commit: `2572e8a` (2026-10-22, tài liệu thời tiết GĐ8; commit chung, không đổi mã hầm). Commit `314e6b4` (GĐ8 Vòng quay) không chạm bảng `hr*`.
Kiểm tra: `npm run test:tunnel` đạt (chạy tay 2026-10-24; lần đầu `page.goto` quá 180 s không tái hiện); `npm run test:tour` 8/8 đạt (2026-10-27).

## Còn lại
- [ ] Âm thanh trong hầm (tiếng ù quạt, tiếng xe vọng) khi camera ở trong hầm.
- [ ] Giảm draw call các góc `hrOverview`, `hrCutaway`, `hrPortalE`, `hrDrive` (prompt đặt ngân sách ≤ 260); đo trước/sau, tách phần do hầm.
- [ ] Nhà điều hành và thông gió cạnh cửa Đông; ô chữ lý trình trên tường máng; camera CCTV và họng nước; cọc chống đẩy nổi và tường vây barrette dạng hình học 3D.
- [ ] Ảnh khung giữa mô phỏng dìm trong `test:tunnel`; kiểm đường bay Tour hầm không xuyên thành hầm.
- [ ] Nhắc lịch sử phương án 2016/2017 trong thuyết minh (prompt dặn).
- [ ] Thuyết minh ko, ja, zh, th, ar, hi.
- [ ] Đối chiếu nguồn "Sở Xây dựng Đà Nẵng" trong README với nguồn của prompt gốc; sửa dòng giới thiệu Hầm bị lặp ở đầu `README.md`.
- [ ] Chuyển các số còn nằm trong mã (đốt 3 ±60 m, vòng GINA, vùng bóc, thuyền thúng, tốc độ `hrDrive`) vào `hanTunnelBase`.
