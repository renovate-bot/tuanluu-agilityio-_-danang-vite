# Cầu sông Hàn (cầu quay) — Thiết kế
_2026-10-21 · Trạng thái: Đã xây (merge b500bb5) · Prompt gốc: prompts/cau-song-han.md tại c418f92_

Đọc lại bản prompt cũ: `git show c418f92:prompts/cau-song-han.md`. Tài liệu này mô tả cái ĐÃ XÂY, đối chiếu với `src/bridges/song-han/`, `src/ui/swingUI.ts` và `CONFIG.songHan` trong `src/config.ts`.

## 1. Mục đích và lý do
- Mô hình 3D Cầu sông Hàn: cầu quay dây văng duy nhất ở Việt Nam, khánh thành 29/3/2000, với animation quay 90° quanh một trụ tròn ở giữa (mâm xoay đỡ trên vành) để mở hai luồng cho tàu.
- Thêm vào CÙNG cảnh với Cầu Rồng, Thuận Phước, Trần Thị Lý; ba cầu cũ giữ nguyên hành vi và hiệu năng.
- Trọng tâm: máy trạng thái quay cầu (`SwingController`) có barie, đèn tín hiệu, xe dừng trước barie, chốt khóa, nâng nhẹ nhịp, quay ease-in/ease-out, tàu qua luồng, rồi đảo ngược.
- Bản HTML gốc (`tests/original/index.html`, có `class SwingController` ở khối `[swingController]`) đã có cầu này; bản Vite là lớp `SongHanBridge` (D-006). Bản HTML là chuẩn hồi quy draw call (D-003).

## 2. Phạm vi: có / không có
Có:
- 11 nhịp cố định BTCT 33 m (6 Tây + 5 Đông), trụ instanced, trụ đón có gối đầu cánh, mố, đường đắp có kè (`fixedSpans.ts`).
- Trụ quay: bệ, trống có 28 lỗ tròn, vòng đèn tím, vành ray, chốt tâm, 40 con lăn quay theo mâm, hệ đệm chống va (`turntable.ts`).
- Nhịp quay 122,7 m trong một `THREE.Group` có gốc tại tâm trụ: dầm thép hộp, bản mặt cầu BTCT, khung giàn dưới dầm, tháp thép xanh chữ A + cột đôi ở tim, mũ trang trí, 18 dây văng, chốt khóa, đèn hàng hải đầu cánh (`swingSpan.ts`).
- Barie (4), đèn tín hiệu đỏ/vàng/xanh, đèn hàng hải trên trụ (`signals.ts`).
- `SwingController`: 8 trạng thái, 5 sự kiện, khóa quay khi bão (`SwingController.ts`).
- Xe dừng trước barie, 76 người đi bộ, hai thuyền du lịch, một tàu buồm cao chờ mở luồng (`life.ts`).
- UI quay cầu: nút, tốc độ 1×/10×/30×, trạng thái, camera theo dõi, lịch tự quay 23:00 thứ Bảy và Chủ nhật, còi và tiếng động cơ (`src/ui/swingUI.ts`).
- Bốn góc nhìn, Tour 6 điểm (điểm 2 tự quay cầu), giao diện 9 ngôn ngữ, thuyết minh vi/en/ru.

Không có (xem mục 7, 9):
- Kiểm tra va chạm hình học tự động giữa nhịp quay với trụ đón và đệm.
- Tiếng positional thật (âm lượng chỉ theo khoảng cách camera).
- Còi/đèn hiệu cho từng đầu cầu ngoài vùng nhịp quay.

## 3. Thông số đã dùng
Mọi số nằm trong `songHanBase` (`src/config.ts`), xuất ra `CONFIG.songHan` (hàm `deriveSh` tính thêm). Mét. Tọa độ cục bộ: tâm trụ quay là gốc (x = 0 ở tim sông); group dời tới `z`.

| Thông số | Giá trị | Nguồn | Khóa |
|---|---|---|---|
| Vị trí Bắc–Nam | z = −1.080 m (dải đường trống trong khu phố, ~1,1 km Bắc Cầu Rồng; giữa Cầu Rồng và Thuận Phước) | prompt: giữa hai cầu | `z` |
| Tổng chiều dài | 487,7 m = 11 × 33 + 122,7 + 2 × 1,0 | prompt (số thật) | `totalLength` |
| Bề rộng | 12,9 m = 2 × 3,35 + 2,2 + 2 × 2,0 | prompt (số thật) | `deckWidth` |
| Nhịp quay | 122,7 m (nửa = 61,35 m), dây văng đối xứng | prompt (số thật) | `swingSpan`, `swingHalf` |
| Khe hở đầu cánh | 1,0 m mỗi đầu (`fixedStart` = 62,35 m) | tính để đủ 487,7 m | `gap`, `fixedStart` |
| Nhịp cố định | 11 × 33 m BTCT dự ứng lực; Tây 6 nhịp (mố x = −260,35 m), Đông 5 nhịp (mố x = +227,35 m) | số nhịp: prompt; cách chia hai bên: ước lượng theo ảnh | `fixedSpan`, `westSpans`, `eastSpans`, `westEnd`, `eastEnd` |
| Làn / dải giữa / lề | 3,35 m × 1 làn mỗi chiều / 2,2 m (mang tháp, neo dây) / 2,0 m mỗi bên (gồm lan can) | (ước lượng) | `laneWidth`, `median`, `sidewalk` |
| Mặt đường nhịp quay | y = 13,8 m, phẳng tuyệt đối | (ước lượng; xem mục 7 về tĩnh không) | `deckY` |
| Dầm | thép nhịp quay cao 2,3 m; BTCT nhịp cố định cao 1,9 m | (ước lượng) | `swingDepth`, `fixedDepth` |
| Đường dẫn hai bờ | hạ từ 13,8 m về 2,6 m, 17 điểm Catmull-Rom (x −340 … 340) | (ước lượng) | `roadProfile` |
| Trụ quay (trống) | bán kính 10 m, mặt trên phần cố định y = 9,4 m | (ước lượng theo ảnh) | `drumR`, `drumTop` |
| Vành ray / con lăn / vành quay | bán kính 7,5 m / 40 con lăn / y = 10,8 m | (ước lượng theo ảnh) | `railR`, `rollers`, `rimTop` |
| Tháp thép xanh | cột đôi ở tim cao 38 m trên mặt cầu; chân chữ A cách tâm 15 m dọc cầu, đỉnh chữ A cao 19 m | cao 38 m: (ước lượng theo ảnh) | `mastHeight`, `aFoot`, `aApex` |
| Dây văng | 9 dây mỗi phía, 1 mặt phẳng ở tim cầu; neo trên cột 25–36,5 m, neo dầm cách tâm 20–59,2 m; bán kính 0,07 m | (ước lượng) | `stays`, `stayTop`, `stayDeck`, `stayR` |
| Nâng nhịp khi mở khóa | 0,05 m | (ước lượng) | `lift` |
| Hướng quay | +1 = ngược chiều kim đồng hồ nhìn từ trên xuống | cấu hình (prompt: để trong config) | `rotateDir` |
| Thời gian (giây thật, chia cho hệ số tăng tốc) | vàng 4 · hạ barie 8 · chờ xe ra tối đa 60 · rút chốt + nâng 20 · quay 150 · giữ mở 1.800 · hạ + khóa 20 | prompt: "vài phút", giữ mở 30–60 phút; các con số (ước lượng) | `timing` |
| Barie | tay đặt tại x = ±68,35 m | (ước lượng) | `barrierX` |
| Trụ đón | tâm x = ±62,4 m | (ước lượng) | `restX` (tính) |
| Lịch tự quay | 23:00 thứ Bảy (6) và Chủ nhật (0), giờ Việt Nam UTC+7 | prompt (số thật: "khoảng 23h tối thứ 7 và Chủ nhật") | `autoSchedule` |
| LOD | `details` ẩn khi xa hơn 1.200 m; mặt đường, dải LED, lề xa hơn 1.500 m | (ước lượng) | `lodDistance`, `farDistance` |
| Tốc độ quay chọn được | 1× / 10× / 30× (mặc định 30×) | prompt: ví dụ 1×, 10×, 30× | `<select id="swingSpeed">`, `SwingController.speed` |
| Tĩnh không khi đóng | prompt: ~25 m (theo Wikipedia); đã xây ~11 m | xem mục 7 | `deckY`, `swingDepth` |

Số khác nằm trong mã, chưa vào `CONFIG`: 4 đệm tường 0,9 × 3,2 × 50 m tại x = ±9,9, z = ±40; 4 trụ chống va hình bình tại (±12, ±66); 4 phao tiêu tại (±56, ±95); 28 lỗ tròn trên trống; chân tháp `PIN_XZ`; tàu buồm 7 × 3 × 30 m, cột 19 m, tốc độ 4,5 m/s (`life.ts`); hệ số `trapezoidEase` a = 0,22; 36 + 40 người đi bộ, seed `rng(2903)`; xe `seed: 2000` (n = 26, tốc độ 11).

## 4. Hình dạng, hành vi như đã xây
`SongHanBridge` (`SongHanBridge.ts`) kế thừa `BridgeBase`. Thứ tự dựng: `shBuildFixedSpans`, `shBuildTurntable`, `shBuildSwingSpan`, `shBuildSignals`, `shBuildLife`, `finalize()`, rồi tạo `SwingController` và `hideBankTrees()`.

- **Nhịp quay là một group riêng.** `shBuildSwingSpan` đặt mọi thứ trên nhịp quay vào `swing` (`sh-swing-span`) có gốc tại tâm trụ, kèm `swingDetails`; gộp bê tông của nhịp quay riêng (mesh `deckSlab`), không trộn với phần cố định (đúng yêu cầu hiệu năng của prompt). Chỉ cần xoay `swing.rotation.y` và `swing.position.y` (nâng).
- `profile.ts`: `shRoadY(x)`: |x| ≤ `fixedStart` thì y = `deckY` (nhịp quay phẳng tuyệt đối); ngoài đó tra đường Catmull-Rom qua `roadProfile`.
- `fixedSpans.ts`: dầm BTCT hai bên (`extrudeAlongX`), mố và đường đắp có kè (Tây ~2 m tới kè; Đông ~35 m lấn sông tới kè), trụ đón (xà mũ rộng, 4 gối đầu cánh + 4 gối nhịp cố định), trụ thường là hai `InstancedMesh` (thân tròn, xà mũ loe) với vệt nước bám qua shader, mặt đường 1 làn mỗi chiều nối Lê Duẩn (Tây) và Phạm Văn Đồng (Đông), lề, lan can, cột đèn, dải LED viền xanh.
- `turntable.ts`: bệ, phần thu nhỏ, trống có lỗ tròn sáng nhẹ ban đêm, hai vòng đèn tím, vành ray, chốt tâm, `InstancedMesh` 40 con lăn (`shPlaceRollers(bridge, spin)` quay theo góc mâm), 4 đệm tường chống va dọc hướng nhịp quay khi mở (trục Z), 4 trụ chống va, 4 phao tiêu đỏ/xanh.
- `swingSpan.ts`: dầm thép hộp xanh + bản mặt cầu BTCT + dải phân cách; khung giàn tựa lên vành quay (torus + 12 thanh xiên + 12 thanh vành); tháp xanh gồm cột đôi ở tim (z = ±0,55) + hai chân chữ A dọc cầu; mũ trang trí (cầu + 14 nón + kim) phát sáng ban đêm; 18 dây văng một `InstancedMesh` hình trụ `cableSegs` đoạn, rẻ quạt đối xứng (neo trên cột cao nhất ↔ neo dầm xa nhất); 4 chốt khóa; 4 đèn hàng hải đầu cánh.
- `SwingController.ts` (kế thừa `EventTarget`): `CLOSED → STOP_TRAFFIC → UNLOCK → ROTATING_OPEN → OPEN → ROTATING_CLOSE → LOCK → REOPEN_TRAFFIC → CLOSED`. `STOP_TRAFFIC`: vàng rồi đỏ, hạ barie, chờ xe ra khỏi nhịp (`spanClear`) hoặc quá `stopMax`; `UNLOCK`: rút chốt rồi nâng 0,05 m (khi vào trạng thái này xe còn trên nhịp bị đẩy ra ngoài barie); `ROTATING_OPEN`/`ROTATING_CLOSE`: góc = `trapezoidEase` × 90° × `rotateDir` (tăng tốc – đều – giảm tốc); `OPEN`: giữ mở `openHold` hoặc khi có `requestClose()`, nhưng chỉ đóng khi `canClose()` (tàu cao đã qua luồng); `LOCK`: hạ nhịp rồi đẩy chốt; `REOPEN_TRAFFIC`: nâng barie, đèn xanh. Sự kiện: `stateChange` (kèm trạng thái), `swingStart`, `swingOpen`, `swingClosed`, `swingBlocked`. Cờ `fromTour`; `canStart()` do thời tiết gán.
- `signals.ts`: `shUpdateSignals` mỗi khung (chỉ khi `details` hiện): tay barie quay theo `ctrl.barrier`, đèn tín hiệu đỏ nhấp nháy / vàng / xanh theo `ctrl.signal`, đèn hàng hải vàng nhấp nháy khi quay hoặc mở (đỏ/xanh cố định khi đóng), chốt khóa trượt theo `ctrl.pin`. Màu đèn ghi bằng `instanceColor`, không cấp phát mỗi khung (D-018, `134d5c8`).
- `life.ts`: xe theo `shStepTraffic`: khi `ctrl.allowEntry` sai thì xe xếp hàng trước barie (khoảng cách 7,5 m); thuyền du lịch nối Cầu Rồng – sông Hàn – Thuận Phước; người đi bộ trên lề cầu cố định và lề ven sông Bạch Đằng; tàu buồm cao `sh-tall-ship` nằm chờ ở z = −260, chạy sang bên kia sau khi `OPEN` (nhân tốc độ quay) và chỉ qua được khi cầu mở.
- `SongHanBridge.update`: `ctrl.update(dt)`; đặt `swing.rotation.y`/`position.y`; khi góc đổi quay các con lăn (`rollerSpin += Δgóc · railR / 0,33`); phát sáng ban đêm (`crown`, `drumLight`, `porthole` nhân `shared.uNight`); di chuyển tàu cao; xe và thuyền khi gần.
- `hideBankTrees()`: thu cây ven kè nằm dưới đường dẫn hai đầu về scale 0 (|z − z_cầu| < `hw` + 4, 250 < |x| < 300), không đổi chuỗi ngẫu nhiên của khu cây (invariant 1).
- Vật liệu (`materials.ts`): thép tháp/dầm xanh có metalness 0,7; dây văng `bridgePatch` bảng màu `'rainbow'`; dải LED viền `'sea'`; tháp xanh `led: 0.9, mode: 1, floodTop`; màu barie kẻ vằn canvas.

## 5. Tương tác, UI, i18n, thuyết minh
- Chọn cầu `data-bridge="sh"`; `BRIDGE_HOME.sh` = `shOverview`.
- Danh sách góc nhìn (`data-list="sh"`): Tour tự động (`shTour`), `shOverview` "Toàn cảnh" (250, 92, z − 330), `shTop` "Trên cao nhìn xuống trụ quay" (−70, 210, z + 70), `shBank` "Từ bờ Bạch Đằng" (−266; 4,6; z − 85), `shDeck` "Trên mặt cầu" (đứng trên lề bộ hành). `shSwingCam` (150, 125, z + 170) là góc camera tự bay đến khi bấm quay, không có nút riêng.
- Khối quay cầu (`index.html` `.swing-box`): nút `#btnSwing` ("Quay cầu" → "Đang quay…" → "Đóng cầu"), trạng thái `#swingState` (8 chuỗi `st_*`), `#swingSpeed` (1×/10×/30×), ghi chú `swingAuto` ("Tự quay lúc 23:00 thứ Bảy, Chủ nhật (giờ Việt Nam), giữ mở 30 phút."), `#btnSwingFollow` (camera theo dõi), `#btnShLife`, `#btnShPeople`.
- `swingUI.ts`: bấm nút khi `CLOSED` thì `ctrl.start(tốc độ)`, khi `OPEN` thì `requestClose()`. Khi `swingStart` và bật theo dõi: lưu camera hiện tại, bay tới `shSwingCam`; khi `swingClosed`: bay về chỗ cũ (không làm khi đang Tour). `audio.horn()` lúc bắt đầu và lúc đóng xong; `audio.motor(true)` trong hai trạng thái quay.
- **Lịch tự quay.** `setInterval` 20 giây kiểm tra giờ thật (UTC+7): thứ Bảy hoặc Chủ nhật, giờ 23, phút < 10, mỗi ngày một lần, và `ctrl.state === 'CLOSED'` → đặt tốc độ 1× rồi `ctrl.start(1)` (chỉ khi trang đang mở). Không có "đồng hồ scene" trong dự án nên dùng đồng hồ máy thật. Giữ mở `openHold` = 1.800 s = 30 phút ở 1×.
- **Tour** `SH_TOUR` 6 điểm (`src/views/tourStops.ts`): Cầu quay duy nhất Việt Nam, Trên trụ quay (cờ `swing: true`: tự quay cầu 30× qua `setTourSwingHook`, đóng ngay khi tàu buồm qua hết luồng), Mâm xoay, Từ bờ Bạch Đằng, Trên mặt cầu, Tàu cao chờ luồng. Trong Tour 4 cầu, điểm 8 (`ALL_TOUR`) cũng quay cầu.
- Bảng Thông số: 487,7 m, 12,9 m, "Nhịp quay" 122,7 m, ghi chú `shNote` ("Hình dáng tháp, chia nhịp và tĩnh không ~11 m là ước lượng theo ảnh").
- i18n đủ 9 ngôn ngữ (`shStops`, `shNote`, `st_*`, `swing*`, `vShTop`, `vShBank`, đã kiểm có trong cả 9 locale); `ar` RTL.
- Thuyết minh Tour: vi và en (`7c60d82`), ru (`0a0b6be`), clip `shStops-0…5`. ko, ja, zh, th, ar, hi chưa có.

## 6. Ràng buộc đã tuân thủ
- **`rand()` có seed (D-002).** Không file nào trong `src/bridges/song-han/` gọi `rand()` (người đi bộ `rng(2903)`, xe `seed: 2000`). `hideBankTrees()` thu cây về scale 0 sau khi mọi `rand()` đã chạy, xử lý đúng mẫu invariant 1. Cầu dựng sau `buildCity()`/`buildTrees()`.
- **Draw call.** Bảng `now` 2026-10-24 (`tests/KET-QUA.md`), ngày / đêm: `shOverview` 282 / 331, `shTop` 213 / 260, `shBank` 235 / 282, `shDeck` 206 / 253. Chuẩn hồi quy là bản gốc: 36/36 lần đo chênh 0 (2026-10-20). Cách giữ thấp: nhịp quay có gộp riêng nhưng luôn là ít mesh; dây, trụ, con lăn, barie, đèn, chốt, đệm đều `InstancedMesh`; chi tiết nhỏ, barie, đèn tín hiệu, cơ cấu mâm xoay, đệm nằm trong `details`/`swingDetails` (ẩn khi xa hơn `lodDistance`); mặt đường, dải LED, lề ẩn khi xa hơn `farDistance`; lớp 1 cho phần không cần phản chiếu. `shOverview` tăng 2 draw call từ Vòng quay Mặt Trời.
- **Đèn.** Ban đêm bằng emissive (`bridgePatch`, `crown`, `drumLight`, `porthole` nhân `shared.uNight`; đèn tín hiệu/hàng hải là `MeshBasicMaterial` màu theo instance); không `PointLight`/`SpotLight` mới (bất biến 5).
- **Texture** vẽ bằng canvas (`makeLaneTexture(1)`, sọc barie), không ảnh ngoài.
- **Quay.** Group quay không bị trộn geometry; cập nhật `rotation.y` mỗi khung nên bounding sphere theo group (kiểm tra frustum culling khi quay: chưa đối chiếu bằng test).
- Công trình đã xây thật, không cần ghi "phương án đề xuất".

## 7. Khác so với ý định ban đầu
- Prompt: module `src/bridges/songHan/` gồm `SongHanBridge.js`, `config.js`, `fixedSpans.js`, `swingSpan.js`, `turntablePier.js`, `swingController.js`, `lighting.js`, `materials.js`. Đã xây: TypeScript trong `src/bridges/song-han/` (`SongHanBridge.ts`, `SwingController.ts`, `fixedSpans.ts`, `swingSpan.ts`, `turntable.ts`, `signals.ts` thay `lighting`, `life.ts`, `materials.ts`, `profile.ts`). Không có `config.js`: thông số ở `CONFIG.songHan` (bất biến 3). Lý do: D-006.
- Prompt: tĩnh không khi đóng ~25 m (theo Wikipedia); "nếu thấy quá cao so với ảnh thì báo". Đã xây: `deckY` = 13,8 m, đáy dầm ~11,5 m, tĩnh không ~11 m "theo ảnh" (ước lượng; `shNote` ghi cho người xem). Số 25 m không dùng.
- Prompt: tháp, số cột, số mặt phẳng dây "không có trong số liệu — xác định từ ảnh, mô tả lại trước khi dựng". Đã xây: tháp thép xanh gồm cột đôi ở tim + chân chữ A dọc cầu; một mặt phẳng dây ở tim cầu, 9 dây mỗi phía, rẻ quạt đối xứng (đều ước lượng theo ảnh, comment trong `config.ts`). Ảnh gốc không còn trong repo.
- Prompt: "kiểm tra không va chạm hình học với trụ đón và fender trong suốt hành trình". Đã xây: các số (khoảng hở 1,0 m, đệm tường x = ±9,9, z = ±40, trụ đón x = ±62,4) được chọn để nhịp quay (bán kính cánh 61,35 m, rộng 12,9 m) không va. Chưa có test hình học tự động.
- Prompt: "ROTATING_OPEN thời lượng thật khoảng vài phút". Đã xây: 150 s thật (`timing.rotate`); ở 30× (mặc định) còn 5 s.
- Prompt: tự quay lúc 23:00 thứ 7 và Chủ nhật "theo giờ scene nếu có đồng hồ". Đã xây: dự án không có đồng hồ scene (ngày/đêm là nút và tự chạy), dùng giờ máy thật quy về UTC+7 (`swingUI.ts`); không bù thời điểm bỏ lỡ (chỉ khi trang đang mở lúc 23:00–23:10).
- Prompt: "quay về vị trí cũ sau khoảng 30–60 phút". Đã xây: giữ mở 30 phút (`timing.openHold` 1.800 s), cận dưới của khoảng prompt; đóng sớm hơn khi người dùng bấm "Đóng cầu" hoặc trong Tour.
- Prompt: âm thanh "còi báo, tiếng động cơ mâm xoay (positional audio, tùy chọn)". Đã xây: còi (hai nốt 311/370 Hz) và tiếng động cơ tổng hợp bằng Web Audio, âm lượng theo khoảng cách camera tới cầu (`audio.setSwingDistance`), không dùng `PannerNode`.
- Prompt: người đi bộ "trên lề cầu và bờ sông Bạch Đằng". Đã xây: 36 người trên lề cố định + 40 người dọc bờ Bạch Đằng.
- Prompt: "Khi bấm Quay cầu, tùy chọn camera tự bay đến góc đẹp nhất rồi quay về góc cũ". Đã xây: `shSwingCam` + nút `#btnSwingFollow` (bật mặc định).
- Prompt: sự kiện `swingStart`, `swingOpen`, `swingClosed`. Đã xây: đủ ba sự kiện, thêm `stateChange` và `swingBlocked`.
- Prompt: thuyền du lịch nối Rồng – sông Hàn – Thuận Phước, "dùng hệ thuyền có sẵn hoặc tạo mới". Đã xây: hai thuyền riêng của cầu và một tàu buồm cao chờ luồng (thêm so với prompt).
- Prompt: "mâm xoay và ray... có chút gỉ/dầu mỡ ở vùng cơ cấu". Đã xây: vật liệu `mech` thép tối (không có texture gỉ riêng).
- Thay đổi do tính năng sau:
  - Thời tiết: vật liệu `weather: true`, bê tông `wet: true`, đường `registerWet` (`5f780b4`); dây văng `sway: 'sh'` lắc theo gió (`e3906e7`, `CONFIG.weather.wind.sh`) và hình trụ `cableSegs` = 8 đoạn (`8c7ef9e`, `swingSpan.ts`); bão đóng cầu: xe ẩn, thuyền về bến, `canStart` trả false (xem dưới), người dùng không bị đổi lựa chọn nút (D-012, `1b39173`).
  - **Khóa quay khi bão (D-012).** `SwingController` thêm `canStart` (`1b39173`, +2 dòng). Bão (preset Bão hoặc kịch bản bão) thì `start()` trả false và phát `swingBlocked`; `main.ts` gắn bằng `weather.attachSwing(songHan.ctrl)`. `swingUI.ts` hiện dòng `swingWeather` ("Không quay cầu: thời tiết xấu, cấm theo thông báo của thành phố") 4 giây rồi trả lại trạng thái; nếu do Tour thì thêm câu `wxSwingTour` vào chú thích Tour và bỏ bước quay, không để `fromTour` treo. Khóa chỉ kiểm lúc `start()`, nếu bão đến khi cầu đang quay thì chưa có xử lý riêng (chưa kiểm bằng test). Không đặt ngưỡng gió: theo trạng thái `closed` của preset Bão (câu trả lời 12b-1 của người dùng, D-012).
  - Bảng "Ảnh hưởng tới cầu": ô riêng cho Cầu sông Hàn (số đo ở bão: gió tại mặt cầu 29,1 m/s); chi tiết trong spec thời tiết.
  - Tối ưu độ mượt (D-018, `134d5c8`): `SongHanBridge.ts`, `life.ts`, `signals.ts`, `turntable.ts` bỏ cấp phát mỗi khung, mảng tạm dùng lại, `shUpdateSignals` chỉ chạy khi `details` hiện.
  - Tour 4 cầu (D-015): `ALL_TOUR` điểm 8 có cờ `swing: true` và `bridge: 'sh'`; điểm 9 nhìn nhịp quay mở luồng.
  - Vòng quay Mặt Trời: `shOverview` +2 draw call (thấy vòng quay).
  - Hầm vượt sông Hàn: tim hầm z = −1.700 nằm ~620 m phía Bắc Cầu sông Hàn, ngoài hành lang cầu.
- Chưa làm (yêu cầu prompt không có trong mã): test va chạm hình học; âm thanh positional thật; ảnh gốc để chỉnh tháp/dây; đo `renderer.info` trong lúc quay (có đo draw call các góc tĩnh, chưa có phép đo riêng "trong khi quay").

## 8. Kiểm tra
- `tests/drawcalls.mjs`: bốn góc `shOverview`, `shTop`, `shBank`, `shDeck`, ngày/đêm. 36/36 chênh 0 so với bản gốc (2026-10-20). Từ đó chỉ có cột `bản Vite` (bảng 2026-10-24).
- `tests/tour-check.mjs` (`npm run test:tour`): `sh` 6 điểm dừng, đạt; kiểm điểm có cờ `swing` thì trạng thái `#swingState` rời "Đóng" (cầu tự quay). Đạt (log GĐ8 Vòng quay 2026-10-24; 8/8 tour đạt 2026-10-27).
- `tests/voice-check.mjs`: `shStops` vi + en + ru, đạt (2026-10-27).
- `tests/weather-check.mjs`: bão thì `songHan.ctrl.start()` trả false và `canStart()` true lại khi hết bão, preset `now` không khóa; đạt (2026-10-27). Chú thích Tour bị hoãn (`wxSwingTour`) chỉ kiểm bằng script ảnh `tests/weather-gd6-shots.mjs`, không nằm trong `test:weather`. Lần chạy 1 từng LỖI vì lịch tự quay 23:00 thứ Bảy trùng giờ chạy test (xem mục 9); chạy lại sau 23:10 thì đạt.
- Chưa có test riêng cho máy trạng thái (từng trạng thái, thời gian, vị trí barie) ngoài kiểm tra qua Tour và thời tiết; chưa có test va chạm.

## 9. Còn mở
- Lịch tự quay 23:00 thứ Bảy làm `test:weather` lỗi nếu chạy đúng giờ đó; đề xuất (`activeContext.md`): bỏ qua lịch khi có `?test` (chưa làm).
- Ảnh gốc của tháp/dây để đối chiếu hình dạng; số nhịp Tây/Đông (6/5), `drumR`, `railR`, tĩnh không ~11 m đều là ước lượng.
- Bão đến khi cầu đang quay: chưa có xử lý (chỉ chặn `start()`).
- Test hình học không va chạm trụ đón/đệm; kiểm frustum culling của nhịp quay khi xoay.
- Thuyết minh ko, ja, zh, th, ar, hi.
- Tàu cao `ship` chưa phản ứng riêng với thời tiết (chỉ thuyền thường về bến).
- Chạy `npm run test:drawcalls -- tests/original` để biết vì sao bảng 2026-10-24 cao hơn bảng 2026-10-20.
