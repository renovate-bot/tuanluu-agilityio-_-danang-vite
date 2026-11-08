# Vòng quay Mặt Trời (Sun Wheel) Đà Nẵng — Kế hoạch triển khai (đã hoàn thành)

> **Cho agent thực thi:** kế hoạch này ghi lại việc đã làm. Các mục `- [x]` đã xong. Việc còn lại ở cuối file.

**Mục tiêu:** Thêm Sun Wheel ở Asia Park (bờ Tây, phía Nam Cầu Trần Thị Lý, z ≈ +2 280): vòng quay + bệ + nhà ga, quay đúng 15 phút/vòng hoặc ×10/×60 với cabin luôn đứng thẳng, LED đêm 5 kiểu show (có kiểu đồng bộ LED trái tim riverfront), ngồi cabin, dừng khi bão và cabin lắc theo gió, Tour 6 điểm có thuyết minh vi/en/ru — góc nhìn cũ ≤ chuẩn +2 draw call.

**Kiến trúc:** `class SunWheel extends BridgeBase` trong `src/bridges/sun-wheel/` (`profile`, `materials`, `structure`, `wheel`, `cabins`, `ledShow`, `ride`, `SunWheel`), dựng sau `buildRiverfront()` và trước `buildWeather()`, dọn nền bằng `clearRects()` scale 0 (D-014). Phần tĩnh 1 mesh + phần quay 1 mesh luôn hiện, cabin `InstancedMesh` + biển hiệu trong `details`. LED là emissive vá vào shader của vật liệu sẵn có. Ngồi cabin là chế độ camera `'swRide'`, tư thế đặt trong `SunWheel.update()` (D-016); Tour giữ chế độ `tour`, cabin ghi đè camera (D-017). Thông số ở `CONFIG.sunWheel` (`sunWheelBase` + `deriveSunWheel()` trong `src/config.ts`).

**Công nghệ:** Vite 6, TypeScript 5.9, three@0.165, không framework UI.

**Spec:** [2026-10-22-vong-quay-mat-troi-design.md](../specs/2026-10-22-vong-quay-mat-troi-design.md)

**Trạng thái:** Đã hoàn thành (merge 257b905, PR #8)

## Giai đoạn
Nhánh `feature/sun-wheel` tạo từ `main` (sau khi thời tiết đã merge, cần `weatherFx`), 2026-10-22 → 2026-10-24. Ranh giới giai đoạn theo mục 10 của prompt gốc. Từ GĐ2, mỗi giai đoạn chạy bằng `scripts/run-sunwheel.ps1`: agent làm (sửa mã + `npm run build`, không chạy test nặng, không commit) → script chạy build + test của giai đoạn, ghi log → agent kiểm tra (chỉ đọc) chấm `KET_QUA: DAT / LOI` → LỖI thì agent sửa lại (tối đa `-MaxRetries`, mặc định 1) → ĐẠT thì script commit. Điểm dừng cho người xem đối chiếu ảnh tham chiếu sau GĐ2 và GĐ4 (`-NoCheckpoint` để tắt). Chuẩn draw call lấy từ log GĐ1 vào `tests/screens/chuan-truoc-sunwheel.txt`. Log ở `tests/screens/sunwheel-logs/`, ảnh tự xem ở `tests/screens/sunwheel-gd*/` (không commit).

Bảng giai đoạn của `run-sunwheel.ps1` (model agent làm / test script chạy):

| GĐ | Model, effort | Test sau khi agent làm |
|---|---|---|
| 1 | sonnet, medium | `test:drawcalls`, `test:sunwheel` |
| 2 | opus, high (đối chiếu ảnh, điểm dừng) | `test:drawcalls`, `test:sunwheel` |
| 3 | sonnet, medium | `test:drawcalls`, `test:sunwheel` |
| 4 | opus, high (đối chiếu ảnh, điểm dừng) | `test:drawcalls`, `test:sunwheel` |
| 5 | sonnet, high | `test:sunwheel` |
| 6 | sonnet, medium | `test:drawcalls`, `test:weather`, `test:sunwheel` |
| 7 | sonnet, medium | `test:drawcalls`, `test:tour`, `test:voice`, `test:sunwheel` |
| 8 | haiku, low (chạy test trước agent) | `test:drawcalls`, `test:tour`, `test:tunnel`, `test:riverfront`, `test:voice`, `test:weather`, `test:sunwheel` |

Agent kiểm tra: sonnet, medium. Quyền của agent làm: sửa file + `npm run build`, `npm run typecheck`, `node *`, `git diff/status/log`; mọi lệnh khác bị từ chối (`--permission-prompts none`) — đây là lý do `gen:voice` và các `test:*` "bị cấm" trong phiên agent ở các ghi chú dưới.

### GĐ0: Đặc tả, tọa độ và ảnh tham chiếu
- [x] Viết đặc tả `prompts/vong-quay-mat-troi.md`. Người dùng trả lời 4 câu (mục 12b): đang hoạt động (kèm ghi chú nguồn báo ngừng từ 9/2025), chỉ vòng quay + bệ + nhà ga, đủ 4 tương tác (ngồi cabin, ×1/×10/×60, show LED, Tour vi/en/ru), góc cũ ≤ +2 draw call.
- [x] Nhận (2026-10-22): tọa độ 16,040525; 108,228459 → z ≈ +2 280 (2 282 m Nam Cầu Rồng); mặt phẳng phương vị 83°/263° → `rotation.y = +7°`; mặt có biển/quảng trường quay Nam Đông Nam (+Z).
- [x] 6 ảnh ở `prompts/tham-chieu/sun-wheel/` (nay chuyển sang docs/superpowers/specs/tham-chieu/sun-wheel/); thư mục vào `.gitignore` vì ảnh có bản quyền.
- [x] Đặc tả mục 1, 1.2, 1.3, 2, 4 cập nhật theo ảnh: tháp đỡ là giàn hình thang + trụ giữa, vành phụ 0,65 R, bệ có 3 vòm + 2 tháp có lầu.

Vẫn ước lượng: x ≈ −440 (chờ đo khoảng cách tới mép nước), D ≈ 93 m, trục ≈ 64 m, bệ ≈ 13 m.
Commit: `52ad574` (2026-10-22; `prompts/vong-quay-mat-troi.md`, `.gitignore`).
Kiểm tra: — (chỉ tài liệu).

### GĐ1: Config, khung `SunWheel`, dọn nền
- [x] `CONFIG.sunWheel` + `deriveSunWheel()`: `yaw` = 90° − phương vị = +7°, `hubY` 66,5, `topY` 117,5 = 115 m trên mặt đất, `site` = khung bao nền.
- [x] `src/bridges/sun-wheel/{index,profile,materials,SunWheel}.ts` (khung rỗng, chỉ `clearRects([SW.site])` + `updateLod`).
- [x] `new SunWheel()` giữa `buildRiverfront()` và `buildWeather()` trong `main.ts`, có trong `bridges[]` và `__app.sunWheel`.
- [x] `tests/sunwheel-check.mjs` + `npm run test:sunwheel`; D-014 ở `decisions.md` (prompt sửa số quyết định D-013 → D-014 trong cùng commit).
- [x] Script chạy từng giai đoạn `scripts/run-sunwheel.ps1` (mặc định GĐ2 → GĐ8, tương tự `run-weather.ps1`; điểm dừng sau GĐ2 và GĐ4; chuẩn draw call từ log GĐ1 vào `tests/screens/chuan-truoc-sunwheel.txt`). Đã chạy thử `-DryRun` lúc đó, chưa chạy thật.

Chưa làm lúc đó: mọi hình học (GĐ2), quay (GĐ3), LED (GĐ4), ngồi cabin (GĐ5), thời tiết (GĐ6: `weatherFx.wheelStopped`), panel/i18n/Tour (GĐ7). `SunWheel` chưa có `setAngle()` (GĐ3). Bước tiếp theo lúc đó cần `x` thật: khoảng cách tâm → mép nước sông Hàn.
Commit: `b4eac62` (2026-10-22; config, khung, test); `d5a27f5` (script `run-sunwheel.ps1`), `d6f4875` (memory bank ghi script).
Kiểm tra: `typecheck`, `build` qua; `test:sunwheel` đạt (tâm −440/2 280, hướng 83°, đỉnh 115 m, dọn nền 0 nhà / 0 cây vì khu này vốn trống). `test:drawcalls` 58/58 khớp bảng GD8 trong `KET-QUA.md` (chênh 0; chạy không kèm `tests/original`, nên so với bảng GD8 chứ chưa so với bản gốc). 2026-10-22.

### GĐ2: Hình học tĩnh, vành, 64 cabin, LOD
- [x] `CONFIG.sunWheel` thêm `rim, ring2, hubRing, hub, spokeR, cableR, cables, axle, legs, cabin, station, pavilion, gate, sign, lamps` (đều ước lượng, đọc tỉ lệ từ ảnh `n1`/`a1`).
- [x] `structure.ts`: `swBuildBase` (bệ ốp đá + 3 vòm cuốn hai mặt, 2 tháp vuông ô tròn + lầu hai tầng mái đỏ, bồn cây sàn mái, quảng trường + 8 cột đèn, cổng vòm vàng); `swBuildLegs` (2 giàn hình thang 5 tầng giằng + trụ giữa + gối trục + trục); `swSignGeometry`.
- [x] `wheel.ts` (`swBuildWheel`): 2 vòng vành + 64 giằng thẳng/chéo, vành phụ 0,65 R, vành nhỏ moay-ơ, moay-ơ, 32 thanh chính, 64 cáp chéo; thuộc tính `aSpoke`/`aR` cho LED GĐ4.
- [x] `cabins.ts` (`swBuildCabins`/`swPlaceCabins`): InstancedMesh 64 viên nang đỏ, dải kính theo màu đỉnh, chỉ tịnh tiến ở θ = 0.
- [x] `materials.ts` thêm `cabin`, `sign` (chữ "SUN WHEEL" vẽ canvas, `MeshBasicMaterial` alphaTest; `SunWheel.update` nhân màu theo `shared.uNight`). `SunWheel` có `wheel` (Group gốc tại tâm trục — GĐ3 quay quanh Z cục bộ), `cabins`, `sign`.
- [x] `tests/sunwheel-check.mjs`: kiểm 6 cũ (khung rỗng) đổi thành "chỉ có `sw-static`, `sw-wheel` ngoài details/life"; thêm GĐ2: 64 instance, nghiêng ≤ 2°, đỉnh cabin 115 ± 1 m, không chạm hành lang Hầm, mesh lớp 1 + không đổ bóng, cabin/biển trong details, draw call do vòng quay (4 góc cũ ≤ 2, 3 camera gần ≤ 6, ngày = đêm).
- [x] Script ảnh `tests/sunwheel-gd2-shots.mjs` (960×600, bật/tắt group).

Quyết định draw call: phần tĩnh (kể cả giàn thép, trục) gộp MỘT mesh vật liệu bê tông tô màu theo đỉnh (`sw-static`), phần quay một mesh thép (`sw-wheel-mesh`) — hai mesh luôn hiện; cabin + biển hiệu trong `details` (LOD 1 500 m). Không `castShadow` (shadow camera bật lớp 1 nên sẽ thêm lượt vẽ bóng), tất cả lớp 1. Mọi góc cũ thấy vòng quay (`bird`, `tpBay`, `tpBoth`, `ttlBoth`, `shOverview`, `wxRiverMouth`) đều cách > 2 700 m nên chỉ +2. Không `rand()`, không đèn.
Số đo (script ảnh): góc cũ `ttlBoth`/`shOverview`/`bird`/`tpBay` +2 ngày và đêm, details ẩn; camera gần (`a1`, `n1`, `n2`, `n3`, `top`) +4, ngày = đêm; console sạch; tam giác tĩnh 3 188, quay 6 144.
Chưa có góc nhìn `sw*` (nút, preset, i18n) — theo đặc tả mục 10 thuộc GĐ3, nên `tests/drawcalls.mjs` chưa thêm gì. Ảnh chụp bằng camera đặt tay.
Khác ảnh tham chiếu (để GĐ sau / chưa làm): ban đêm kết cấu chưa chiếu trắng, cabin chưa viền LED đỏ, vành chưa viền đỏ (GĐ4); không có giá treo tam giác cabin (instance chỉ tịnh tiến nên giá không xoay theo góc được — xem lại ở GĐ3); lầu là khối đặc thay vì lầu cột rỗng; ảnh `n1` thấy ~64 nan thẳng, mô hình 32 thanh + 64 cáp chéo; chưa có đèn rọi trời, tầng sàn kỹ thuật ngang ở chân giàn, cây/bồn cây chi tiết, logo Sun World (cố ý không dựng); cột đèn quảng trường chưa phát sáng (GĐ4 đã làm); quảng trường một màu không có ô lát.
Commit: `edb64a1` (2026-10-22).
Kiểm tra: `npm run build` qua; script ngoài chấm `test:drawcalls` + `test:sunwheel` → `KET_QUA: DAT` lần chấm 0 (`gd2-l0-kiemtra.json`), 2026-10-22.

### GĐ3: Chuyển động, tốc độ, góc nhìn `sw*`
- [x] `SunWheel`: `setAngle(rad)`, `angle()`, `setSpeed(k)`, `speedNow()`, `speedTarget()`, `advance(giây)` (tích phân deterministic, bước ≤ `SW.stepMax`), `cabinWorld(i)`, `cabinUp(i)`; `update()` gọi `advance(dt)`.
- [x] `wheel.rotation.z = θ` (mặt phẳng cục bộ, ngược chiều kim đồng hồ nhìn từ mặt Nam); 64 cabin vẫn là một `InstancedMesh` chỉ có phép tịnh tiến theo `swPlaceCabins(θ)` nên luôn đứng thẳng.
- [x] `CONFIG.sunWheel` thêm `speedAccel` 6 (hệ số/giây, ước lượng: dừng ↔ ×60 ≈ 10 s), `stepMax`, `placeEps`. Mặc định ×1 (900 s/vòng, có nguồn).
- [x] Góc nhìn `swOverview, swFront, swBase, swFromTTL, swNight, swTop` (`views/presets.ts`, tọa độ cục bộ qua `swToWorld`, đều ước lượng), nút bridge `sw` + `data-list="sw"` + ô tốc độ `#swSpeed` (Dừng / ×1 / ×10 / ×60) trong `index.html`, `BRIDGE_HOME.sw`, `SPEC_KEYS.sw` (`panel.ts`), `setupUI` nhận `sunWheel` (ô tốc độ; `swNight` tự chuyển sang đêm như `rfHearts`).
- [x] i18n 14 khóa × 9 ngôn ngữ qua `scripts/add-sunwheel-locales.mjs` (bảng thông số + ghi chú hiện trạng "ngừng từ 9/2025").
- [x] `tests/drawcalls.mjs` thêm 6 góc `sw*` vào `VIEWS` (và với `swNight` tự trả ngày/đêm đang đo; `rfHearts` giữ cách đo cũ để khớp bảng chuẩn).
- [x] `tests/sunwheel-check.mjs` mở rộng (không xóa kiểm tra cũ): chu kỳ ×1/×10/×60 (sai ≤ 1 %), đổi tốc độ mượt + dừng không trôi, cabin nghiêng ≤ 2° ở 5 góc, bám vòng/bám điểm vành, đỉnh cabin 115 ± 1 m ở mọi góc, không vào hành lang Hầm, ma trận cabin bám góc khi ở gần / quay tiếp khi ở xa / đúng ngay khi quay lại gần, draw call 6 góc `sw*` × ngày/đêm × tốc độ 0/60 (≤ 6, ngày = đêm, quay không đổi), nút góc nhìn, nhóm `sw`, ô tốc độ, ghi chú hiện trạng, 9 locale đủ 14 khóa.
- [x] Script ảnh `tests/sunwheel-gd3-shots.mjs` → `tests/screens/sunwheel-gd3/`.

Quyết định: (1) cabin chỉ đặt lại ma trận khi `details` hiện (LOD 1 500 m) và góc lệch ≥ `placeEps`; ở xa vành vẫn quay (1 phép gán `rotation.z`), quay lại gần thì dựng lại ngay. (2) Không thêm mesh/draw call: số draw call của vòng quay như GĐ2 (không phụ thuộc quay/ngày/đêm). (3) Bảng Thông số dùng nhãn dùng chung "Chiều dài/Bề rộng/Làn xe": ghi "Cao 115 m", "≈ 93 m (đường kính)", làn "—" — nhãn riêng để GĐ7 (panel); GĐ7 không làm, nhãn vẫn dùng chung.
Thăm dò trước khi chấm (`tests/screens/sunwheel-gd3/probe.mjs`, không commit; bản test đầy đủ bị cấm trong phiên agent): ×1 90 s đúng 1,0000 · 2π/10, ×60 đúng 60 lần, 31,0 sau 5 s tăng tốc, dừng đúng 10 s, cabin lệch khỏi trục lên 0°, lệch bán kính ≈ 1e-6 m.
Ảnh đã xem: `ui-panel`, `swOverview-ngay`, `swFront-ngay`, `swBase-ngay`, `swFromTTL-ngay`, `swNight-dem`, `swTop-ngay`, `front-angle-3.5`: vòng quay dựng đúng, cabin đứng thẳng quanh vành, mặt Nam có quảng trường; `swFromTTL` thấy vòng quay nhỏ ở ~1 km (đúng khoảng cách). Console sạch.
Hạn chế lúc đó: ô tốc độ ở màn thấp (600 px) nằm sát bảng Thông số (đã rút ngắn nhãn); hướng quay (ngược chiều kim đồng hồ nhìn từ Nam) chưa có nguồn; chưa có giá treo tam giác cabin (instance chỉ tịnh tiến, giá không xoay được theo góc) — nếu muốn thì thêm InstancedMesh thứ hai (+1 draw call, trong `details`) ở GĐ sau; `swNight` ban đêm vẫn chưa có LED/chiếu sáng (GĐ4).
Lần chấm 0 LỖI (2026-10-22): `test:sunwheel` — hai kiểm tra cabin bám góc ('gần', 'quay lại gần') lệch 1,8e-6 m so với ngưỡng 1e-6 m. Nguyên nhân gốc: ma trận instance là float32 (ulp ở y ≈ 115 m ≈ 7,6e-6 m), nên 1e-6 m không đạt được dù mã đúng; không phải lỗi logic đặt cabin. Sửa: ngưỡng `SYNC_TOL = 1e-4` m trong `tests/sunwheel-check.mjs` (có chú thích lý do). Vẫn bắt được lỗi thật: ma trận trễ một bước `placeEps` (1e-4 rad × cabinR ≈ 4,6e-3 m) lớn hơn ngưỡng 46 lần. Không đổi mã ứng dụng; draw call/i18n/phạm vi đã đạt ở lần 0.
Commit: `4aff07c` (2026-10-22).
Kiểm tra: lần chấm 1 `KET_QUA: DAT` (`gd3-l1-kiemtra.json`, log cục bộ, không commit; `build`, `test:sunwheel`, `test:drawcalls` góc cũ ≤ +2 so với `chuan-truoc-sunwheel.txt`), 2026-10-22.

### GĐ4: LED đêm + 5 kiểu show
- [x] `ledShow.ts` (`swLedPatch`, uniform chung `swLedU`, `SunWheel.setShow()/show()`), ô `#swShow` (trắng / hồng tím / tia chạy / nhịp tim / tắt), `CONFIG.sunWheel.led`. LED nằm trong shader của ba vật liệu có sẵn nên không thêm mesh/draw call. Chi tiết xem comment đầu `ledShow.ts`.
- [x] Kết cấu ban đêm chiếu trắng (giàn + trục, `aLit` flood), viền vành đỏ, viền LED đỏ cabin, đèn cột quảng trường (`aLit` lamp) — các điểm "khác ảnh" của GĐ2 phần LED.
- [x] Nhịp tim đồng bộ riverfront: `heartFacade.ts` tách hằng `HEART_BEAT_PERIOD`, `HEART_BEAT_GLSL`, `HEART_STAGE_GLSL`, `HEART_CYCLE` để dùng chung (giá trị giữ nguyên, 1,5 s).
- [x] i18n 6 khóa (`swShow`, `swShowWhite`, `swShowPink`, `swShowRays`, `swShowHeart`, `swShowOff`) × 9 qua `scripts/add-sunwheel-locales.mjs`.
- [x] Script ảnh `tests/sunwheel-gd4-shots.mjs` → `tests/screens/sunwheel-gd4/` (14 ảnh).

`activeContext.md` không có mục riêng cho GĐ4 (chỉ ghi bổ sung sau commit). Ghi chú dưới lấy từ lần chấm 0 (`tests/screens/sunwheel-logs/gd4-l0-kiemtra.json`, không commit):
- Draw call: 57 góc cũ chênh tối đa +2 (`bird`, `tpBay`, `tpBoth`, `ttlBoth`, `shOverview`, `wxRiverMouth` +2 ngày và đêm, như GĐ2–GĐ3); góc `sw*` bằng GĐ3 (`swOverview` 185, `swFront` 308, `swBase` 239, `swFromTTL` 133); `swNight` 281 → 302 và `swTop` 119 → 140 chênh 21 ở cả log GĐ3 và GĐ4 nên không do LED; `rfHearts` vẫn 278 / 277.
- Ảnh đã xem `swNight-white`, `swNight-pink`: viền vành đỏ, nan trắng hoặc hồng tím, cabin viền đỏ, giàn được chiếu sáng, không cháy bloom.
- Lỗi nhẹ không chặn: hệ số `up` (0,6/0,4), nền tia chạy 0,12, các màu LED, tốc độ đổi màu 0,05 nằm cứng trong shader, không ở config.
- Chưa có: kiểm tra tự động cho 5 kiểu show, draw call khi đổi `uShow`, 6 khóa i18n mới (`sunwheel-check.mjs` không đổi ở GĐ4; chênh ngày/đêm 0 chỉ thấy gián tiếp qua `test:drawcalls` ở kiểu trắng mặc định); nhịp tim đồng bộ chỉ có ảnh `swNight-heart.png`; không có log `test:riverfront` cho thay đổi ở `heartFacade.ts` (rủi ro thấp, chỉ tách hằng).
- Commit có thêm dòng `.env.production` vào `.gitignore` (không thuộc GĐ4). Phiên agent làm bị ngắt vì hết hạn mức (429) nhưng mã cuối build và test qua.
Commit: `7755a3b` (2026-10-23).
Kiểm tra: `build`, `test:sunwheel` đạt, `test:drawcalls` thoát 0 (70 dòng đo); `KET_QUA: DAT` lần chấm 0, 2026-10-23.

### GĐ5: Ngồi cabin
- [x] `src/bridges/sun-wheel/ride.ts` (`swRide`: cabin, yaw, pitch, chặng bay vào `blend`, camera cũ để trả lại; kéo chuột nhìn quanh bằng pointer events trên canvas); `SunWheel.update()` gọi `swRide.update(dt)` sau `advance()`.
- [x] `views/camera.ts` thêm `enterSwRide()`, `leaveSwRide(restore)`, `dropRide()`, chế độ `'swRide'` (`views/state.ts`), `setView('swRide')`; Esc xuống cabin (`ui/setupUI.ts`).
- [x] Nút góc nhìn `data-view="swRide"` trong nhóm `sw` + dòng hướng dẫn `#swRideHint` (`index.html`, CSS dùng chung với `#hint`).
- [x] i18n 2 khóa `vSwRide`, `swRideHint` × 9 ngôn ngữ (`scripts/add-sunwheel-locales.mjs`, mảng K5/T5).
- [x] `CONFIG.sunWheel.ride` (`eyeUp` 0,4 m, `pitch0` −0,12 rad, `pitchMax` 1,4 rad, `lookSpeed` 0,005 rad/px, `enterTime` 1,6 s — đều ước lượng); `swRide` có trong `index.ts` của vòng quay và trong `window.__app` (`?test`). D-016.
- [x] `tests/drawcalls.mjs` `VIEWS` thêm `['sw', 'swRide']` (đặt `swRide.blend = 1` trước khi đo, bản gốc tự bỏ qua vì không có nút).
- [x] `tests/sunwheel-check.mjs` thêm phần GĐ5 (không xóa kiểm tra cũ): lên cabin bằng nút (mode, OrbitControls tắt, nút/hint, có chặng bay vào, cabin lên là cabin ở đáy); camera = tâm cabin + `eyeUp` sai < 1 mm ở 24 góc + đỉnh/đáy, cao ≈ 115 m ở đỉnh; ×60 camera vẫn đúng cabin giữa các khung; hướng nhìn mặc định về Bắc; kéo chuột đổi yaw/pitch, không dời camera, kẹp `pitchMax`; draw call khi ngồi (≤ 6, ngày = đêm, quay không đổi) và không thêm mesh; xuống bằng Esc / bấm lại nút (camera, target, `maxPolarAngle` về đúng, OrbitControls xoay lại được); đổi góc nhìn; bắt đầu Tour rồi Esc; Esc khi không ngồi không đổi gì; i18n thêm 2 khóa.
- [x] Script ảnh `tests/sunwheel-gd5-shots.mjs` → `tests/screens/sunwheel-gd5/`.

Hành vi: lên cabin là cabin ở đáy vòng quay (gần sàn lên nhất) tại thời điểm bấm; mắt = tâm cabin + `eyeUp`; mặc định nhìn về Bắc (−Z cục bộ, phía có các cầu), hơi cúi. Tốc độ quay giữ theo ô tốc độ người dùng (không tự đổi): ×1 thì lên tới đỉnh mất ≈ 7,5 phút, chọn ×10/×60 để lên nhanh. Xuống: Esc hoặc bấm lại nút → bay về camera + `maxPolarAngle` đã nhớ lúc lên, trả OrbitControls; đổi góc nhìn / bắt đầu Tour / kịch bản bão / swing-follow → thoát ngay, không bay về chỗ cũ.
Draw call: không thêm mesh, không thêm đèn, không `rand()`. Mốc cần so lúc đó: góc cũ ≤ chuẩn +2 (`chuan-truoc-sunwheel.txt`), `swRide` ≤ 6 phần vòng quay, ngày = đêm.
Ảnh đã xem: `ui-before`, `ride-ui-bottom`, `ride-entering`, `ride-bottom-north`, `ride-mid-north`, `ride-top-north`, `ride-top-south`, `ride-top-east`, `ride-top-down`, `ride-top-north-dem`, `ride-mid-north-dem`, `after-exit`. Số đo từ script: camera lệch tâm cabin ≤ 3e-6 m (cả ×60), mắt cao 115,65 m (cao độ thế giới; 113 m so với mặt đất) ở đỉnh, 18,15 m ở đáy; console sạch. Thấy được: thành phố, sông Hàn, Cầu Trần Thị Lý (~1 km) khi nhìn Bắc; các cầu xa hơn bị sương che. Nhìn dọc mặt vòng quay (Đông/Tây) bị cabin bên cạnh (cách ≈ 4,8 m) che gần hết khung — đúng hình học, không sửa.
Hạn chế lúc đó: không có thông báo "vòng quay dừng do bão" khi đang ngồi và cabin chưa lắc theo gió (GĐ6); không có giá treo tam giác nên từ trong cabin không thấy giá; không có tiếng/rung cabin; ở màn thấp (≈ 600 px) nút "Ngồi cabin" bị bảng Thông số che một phần (cùng lỗi bố cục của ô tốc độ/LED GĐ3–GĐ4, chưa chỉnh CSS); dòng hướng dẫn ở giữa trên che một góc ô chọn ngôn ngữ khi cửa sổ ≈ 960 px (giống `#hint` đi bộ); chưa kiểm cảm giác kéo chuột trên cảm ứng thật. Tour (GĐ7) gọi `enterSwRide()` từ `tourHooks`.
Lần chấm 0 LỖI (2026-10-23): `test:sunwheel` 3 kiểm tra không qua; chưa có log `test:drawcalls` (runner chỉ khai `test:sunwheel` cho GĐ5). Nguyên nhân gốc (thăm dò bằng script tạm `tests/screens/sunwheel-gd5/probe.mjs`, không commit):
1. Draw call ngồi cabin 3 so với 4: KHÔNG phải lỗi app. `sw-sign` (biển hiệu quảng trường phía Nam) bị cắt khung hình khi camera ngẩng gần thẳng đứng (`pitchMax`, test kéo chuột tới giới hạn) — đúng frustum culling. Test lại đo lúc vòng quay còn quay ~×55 (lệnh `setSpeed(0)` chưa giảm tốc xong, camera chạy theo cabin) nên mỗi mẫu một tư thế. Sửa test (không nới ngưỡng): mỗi mẫu đặt hướng nhìn mặc định (`pitch0`, yaw 0) và `advance(15)` cho tốc độ đạt đích; thêm kiểm riêng ngẩng hết cỡ (dừng, cùng góc, ngày = đêm, ≤ 6). Sau sửa, thăm dò: d = 3 ở cả bốn mẫu (ngày/đêm × 0/×60).
2. "Bấm lại nút: không về chỗ cũ": lỗi app. Preset `swFront` đặt camera (y 8) thấp hơn điểm nhìn (y 55) mà không có `maxPolar`, nên khung đầu sau chuyến bay OrbitControls kẹp camera lên y 58,69. `swRide.begin()` lưu tư thế TRƯỚC khung đó → xuống cabin bay về chỗ chưa kẹp, rồi OrbitControls dời lại. Sửa: `begin()` chốt tư thế bằng `controls.update()` với damping tắt (kẹp + xả quán tính) rồi mới lưu. Thăm dò: `saved` = tư thế đã kẹp, sau khi xuống camera đúng chỗ và không trôi thêm sau 20 khung. Chưa sửa preset `swFront` (đổi khung nhìn GĐ3, ngoài phạm vi GĐ5; đáng xem lại: thêm `maxPolar` nếu muốn góc thấp như đã định).
Commit: `1a16009` (2026-10-23).
Kiểm tra: lần chấm 1 `KET_QUA: DAT` (`gd5-l1-kiemtra.json`, log cục bộ, không commit; `build`, `test:sunwheel` đạt; chưa có log `test:drawcalls` nên +2 ở góc cũ chỉ xác nhận qua đo bật/tắt group trong `test:sunwheel`), 2026-10-23.

### GĐ6: Thời tiết — dừng khi bão, lắc gió, mặt ướt
- [x] `weatherFx.wheelStopped` (`core/shared.ts`) đặt = `closed` trong `updateHooks()` (`weather/effectsHooks.ts`), không có ngưỡng gió (D-012).
- [x] `SunWheel.advance()`: khi dừng, tốc độ giảm TUYẾN TÍNH từ tốc độ lúc bắt đầu dừng về 0 đúng sau `CONFIG.sunWheel.storm.stopSec` (10 s, ước lượng) — dùng `stopFrom/stopSec` làm tốc độ giảm nên từ ×1 hay ×60 đều mất 10 s; tốc độ đích người dùng chọn (`speedTarget()`) giữ nguyên, hết bão tăng lại theo `speedAccel`.
- [x] Cabin lắc: `swCabinPose()` (`cabins.ts`) nghiêng cabin quanh điểm treo cao hơn tâm `pivotUp`, góc = `amp·(mean + (1−mean)·sin(ω·t + i·phase))`, `amp = min(1,(|windFx|/ref)²)·maxTilt` (`storm.sway`, mọi số ước lượng; `maxTilt` 0,16 rad ≈ 9°), đáy cabin xuôi gió, pha cố định theo chỉ số (không `rand()`); đồng hồ `swayT` cộng dồn trong `advance()`. Lặng gió thì `amp = 0` và ma trận chỉ tịnh tiến như cũ (`now` không đổi). 64 ma trận chỉ dựng lại khi `details` hiện và (góc đổi hoặc đang lắc); không thêm mesh/draw call.
- [x] Đang ngồi cabin (`ride.ts`): mắt = tâm cabin + `eyeUp` theo trục lên đã nghiêng, camera nghiêng theo cabin (`SunWheel.cabinPose()` thay cho đọc ma trận instance); dòng `#swStormNote` (i18n `swStormNote` × 9, `scripts/add-sunwheel-locales.mjs` K6/T6, CSS `#swStormNote`) hiện khi đang ngồi và `wheelStopped`, `swRide.updateNotice()` gọi từ `SunWheel.update()`.
- [x] `windFx` thêm vào `window.__app`. `SunWheel.sway()`, `stopping()` cho test.
- [x] Mặt ướt: không cần mã mới — ba vật liệu (`concrete`, `steel`, `cabin`) đã có option `weather: true` của `bridgePatch` từ GĐ2 (đọc `uWet`). `registerWet` chỉ dành cho vật liệu đường có `map`/roughness riêng; vòng quay không có đường nên không đăng ký.
- [x] `tests/sunwheel-check.mjs` thêm mục GĐ6 (không xóa kiểm tra cũ): `now` không dừng/không lắc; bão → `wheelStopped`; dừng đúng `stopSec` từ ×60 và ×1 (giảm tuyến tính, còn > 0 trước mốc, đúng 0 sau mốc, góc không trôi, tốc độ đích giữ nguyên); cabin lắc (gió > 1 m/s, nghiêng trong (2°; maxTilt], đáy xuôi gió, đổi theo thời gian, không thêm mesh); draw call vòng quay trong bão = lúc `now` (góc cũ ≤ 2, góc gần/`sw*` ≤ 6); ba vật liệu có nhánh `weather`; ngồi cabin khi bão (đứng yên, camera lệch mắt < 1 mm, camera nghiêng, dòng thông báo hiện/ẩn); hết bão quay lại tốc độ cũ + cabin thẳng; Esc ẩn thông báo; i18n thêm `swStormNote`.
- [x] Script ảnh `tests/sunwheel-gd6-shots.mjs` → `tests/screens/sunwheel-gd6/` (đã xem 8 ảnh).

Số đo tự kiểm: bão: tốc độ 0, gió 30,6 m/s, biên độ 0,16, cabin nghiêng tối đa 9,17°; `now`: 0 / 0°; dòng thông báo hiện khi ngồi + bão; camera bám cabin nghiêng; console sạch. Draw call toàn cảnh ở cùng camera: now 218 / bão 217 (góc cabin).
Hạn chế lúc đó: không có góc nhìn `sw*` mới ở GĐ6 (đặc tả không yêu cầu) nên `VIEWS` của `tests/drawcalls.mjs` không đổi; `test:weather` chưa thêm kiểm tra Vòng quay (phần bão nằm trong `test:sunwheel`); cabin lắc 9° khó thấy từ xa, mặt ướt khó thấy ở cự ly xa (SwiftShader, ảnh nhỏ); `#swStormNote` ở giữa trên chồng lên ô chọn ngôn ngữ ở cửa sổ ≈ 960 px (giống `#swRideHint`); ô chọn thời tiết vẫn hiện "Hiện trạng" khi đặt preset qua API; chưa có âm thanh/rung cabin; kịch bản bão (`STORM_TOUR`) chưa có điểm nhìn vòng quay.
Lần chấm 0 LỖI (2026-10-23): `test:sunwheel` — "bão swFromTTL: vòng quay 5 draw call, lúc now 4". Nguyên nhân gốc: vòng quay chỉ có 4 mesh (static, wheel, cabins, sign) nên 5 không thể do nó; `delta()` đo bật/tắt group ở hai cửa sổ 3 khung khác nhau, mà tia chớp của bão (+1 draw call lúc nháy, D-012) rơi vào một cửa sổ. Các góc khác không trúng chớp. Sửa test (không nới ngưỡng): `delta()` bỏ mẫu có `weather.lightning.flashing()` và đo lại (tối đa 40 lần). Không đổi mã ứng dụng. Giả thuyết dựa trên số liệu log (mọi góc khác = 4, `now` = 4), chưa tự chứng minh bằng chạy lại trong phiên agent.
Log `gd6-l0-kiemtra.json` trên đĩa ghi `KET_QUA: DAT` — lần chấm cuối ghi đè (chạy `-Resume`), lần LỖI chỉ còn trong memory bank.
Commit: `991ee46` (2026-10-23; gồm +1 dòng trong `weather/effectsHooks.ts`).
Kiểm tra: `build`, `test:sunwheel`, `test:weather`, `test:drawcalls` đạt (`KET_QUA: DAT`), 2026-10-23.

### GĐ7: Panel, i18n, Tour 6 điểm + thuyết minh
- [x] Tour `sw` 6 điểm (`SW_TOUR` trong `views/tourStops.ts`, `TOUR_DEFS.sw`, `loop: false`; nút `data-view="swTour"` đầu nhóm `sw`, nhãn dùng khóa `vTour` có sẵn): toàn cảnh từ sông → chân + nhà ga → chính diện (lịch sử Igosu 108 + ghi chú hiện trạng 9/2025) → lên cabin tới đỉnh → nhìn về 4 cầu → ban đêm, show hồng tím.
- [x] D-017: Tour giữ `cam.mode = 'tour'`, `TourStop.sw` (`ride`/`top`/`night`) gọi `tourHooks.sw` (khe mới, không đụng `tourHooks.stop` của Hầm; `exitTour()` gọi `sw(null, true)` sau khi về orbit); `swRide.active()` đúng cả lúc `tour.on` nên `SunWheel.update()` ghi đè camera bằng cabin SAU `updateTour()`; trộn mượt vào/ra cabin (`blend`, `tour.out`).
- [x] Lên đỉnh: `swRide.tourClimb()` tua `CONFIG.sunWheel.tour.climbSpeed` ×40 rồi bắt đầu giảm tốc khi quãng còn lại = quãng phanh từ `speedAccel`, tới đỉnh ở ×1 (đo: 16,9 s, cabin đúng y = 115,25 m).
- [x] `TourStop.minSec` (`tour.climbSec` 18, `topSec` 12) giữ điểm hiện đủ lâu kể cả khi tắt giọng (`fitDurations` trong `views/tour.ts`; durs đo được [17,9; 8; 8,1; 28,3; 8,9; 6], tổng 77,1 s khi chưa có giọng).
- [x] Thoát Tour (Esc / hết hành trình / đổi góc nhìn giữa chừng — `setView` không gọi `exitTour`, nên `swRide.update` tự phát hiện) trả tốc độ quay, ngày/đêm, kiểu show (`swRide.tourEnd()`, `onEnd` ở `setupUI.ts`). `CONFIG.sunWheel.tour` (mọi số ước lượng).
- [x] i18n: `swStops` (6 cặp tên + lời) × 9 ngôn ngữ qua `scripts/add-sunwheel-tour-locales.mjs`. Lời thuyết minh vi/en/ru: `scripts/add-sunwheel-narration.mjs` → `scripts/narration/*.json` (khóa `swStops`).
- [x] 18 clip giọng đọc `public/voice/{vi,en,ru}/swStops-0…5.mp3` + `manifest.json` (xem ghi chú "giọng đọc" dưới).
- [x] Test: `tests/sunwheel-check.mjs` thêm mục GĐ7 (cờ + minSec, caption 6 điểm, lên cabin → camera bám mắt cabin < 1 mm, lên đỉnh < `climbSec` và ở đỉnh ± 0,1 m, tốc độ về `topSpeed`, hướng nhìn Bắc, draw call ở cabin trong Tour ngày = đêm ≤ 6, không thêm mesh, điểm 6 đêm + show, hết Tour trả trạng thái, Esc giữa Tour, tua thẳng tới điểm 5, đổi góc nhìn giữa Tour; i18n `swStops`). `tests/tour-check.mjs` thêm `sw` (đường bay mở, raycast đường bay Catmull-Rom — điểm 4–5 đặt trên không phía Nam, z ≥ 60 m); `tests/voice-check.mjs` thêm `sw`; `tests/drawcalls.mjs` thêm `['sw','swTour']` (tua tới điểm 5, `blend = 1`, Esc sau khi đo). Các góc nhìn `sw*` tĩnh không thêm mới (GĐ7 không có góc nhìn tĩnh), nên `VIEWS` chỉ thêm góc Tour.
- [x] Script ảnh `tests/sunwheel-gd7-shots.mjs` → `tests/screens/sunwheel-gd7/`: đã xem `stop1`, `stop3`, `stop4-board`, `stop5-north` — caption đúng, camera trong cabin ở đáy rồi đỉnh nhìn về Bắc. Điểm 6 (đêm) chụp ở lần chạy nền thứ hai (xem báo cáo phiên đó).

Giọng đọc: trong phiên agent `npm run gen:voice` bị từ chối quyền (cần mạng tới dịch vụ Edge TTS, không có ai duyệt), nên lúc đó `public/voice/` và `manifest.json` CHƯA có `swStops` (18 clip: 6 × vi/en/ru); ứng dụng vẫn chạy (không giọng thì dùng `minSec`/thời lượng gốc) nhưng `test:voice` báo thiếu clip. Lần sửa 1 thử lại `gen:voice` — bị từ chối lần nữa; không đổi mã, không nới test. Người dùng chạy `npm run gen:voice` ngoài phiên; 18 clip có trong commit `028dede` và lần chấm cuối ghi "đủ clip giọng đọc". Chưa nghe thử giọng.
Hạn chế: điểm 5 ở đỉnh ×1: các cầu xa bị sương che, chỉ thấy rõ Trần Thị Lý (~1 km). `swTour` ở nhóm `sw` dùng nhãn "Tour tự động" như các cầu khác. Màn thấp: chú thích Tour chồng lên bảng Thông số như Tour khác. Nhãn bảng Thông số riêng (dự kiến từ GĐ3) không làm.
Lần chấm 0 LỖI (2026-10-23): nguyên nhân gốc duy nhất là thiếu 18 clip `swStops` (không phải lỗi mã); lần sửa 1 thử lại `npm run gen:voice` — bị từ chối quyền tự động lần nữa; `npm run build` qua; `public/voice/` vẫn chưa có `swStops` (đã kiểm bằng glob). Người dùng phải tự chạy `npm run gen:voice` ngoài phiên.
Lần chấm 0 LỖI (2026-10-23, log `gd7-l0-*`): (1) `test:voice` sập vì thiếu 18 clip `swStops` — nguyên nhân gốc vẫn là chưa sinh được clip; lần sửa 1 thử `gen:voice` lại bị chặn quyền (phiên không có ai duyệt), nên KHÔNG sinh được. (2) `test:sunwheel` "sau khi rời cabin camera vẫn dính cabin (1,8e-5 m)": lỗi của test, không phải app. Vòng `R.update(0.1)` thủ công trong test không chạy `updateTour()`, nên camera (đang ở mắt cabin) không được đặt lại lên đường bay; khi `tour.out` về −1 camera vẫn nằm ở cabin. Ở app thật `updateTour` chạy mỗi khung trước `ride.update`. Sửa test (không nới ngưỡng 5 m): chạy `frames(page, 3)` thật trước khi đo. Không đổi mã ứng dụng; `npm run build` qua.
Log `gd7-l0-kiemtra.json` trên đĩa ghi `KET_QUA: DAT` (build và 4 test qua, góc cũ đúng +2, phần vòng quay ≤ 6 và ngày = đêm, đủ 9 ngôn ngữ và clip giọng) — lần chấm cuối sau khi có clip, ghi đè các lần LỖI.
Commit: `028dede` (2026-10-24; gồm 18 clip `public/voice/` và `manifest.json`).
Kiểm tra: `build`, `test:sunwheel`, `test:tour`, `test:voice`, `test:drawcalls` đạt (`KET_QUA: DAT`), 2026-10-24.

### GĐ8: Tài liệu + đo đạc
- [x] `tests/sunwheel-check.mjs` thêm mục 8 (mọi góc `sw*` có trong `VIEWS` của `drawcalls.mjs` và dòng trong `KET-QUA.md`; README có `sun-wheel/`).
- [x] `tests/KET-QUA.md` viết lại theo log `tests/screens/sunwheel-logs/gd8-l0-*.log` (bảng `now` 74 phép đo gồm `sw*`, chênh draw call so với `chuan-truoc-sunwheel.txt`).
- [x] README mục Cấu trúc thêm `sun-wheel/`. `systemPatterns.md` thêm mẫu "công trình chuyển động + ngồi cabin". `progress.md` thêm dòng GĐ1–GĐ7 và GĐ8. Không đổi mã ứng dụng. Không có bước nhìn kết quả trong GĐ8 nên không chụp ảnh.

Số đo (log GĐ8): góc cũ chênh 0 đến +2 so với chuẩn (ngân sách ≤ +2 đạt); +2 ở `bird`, `tpBay`, `tpBoth`, `ttlBoth`, `shOverview`, `wxRiverMouth` (ngày và đêm), đúng các góc xa thấy vòng quay. `sw*` ngày/đêm: `swOverview` 185, `swFront` 308, `swBase` 239, `swFromTTL` 133, `swNight` 281/302, `swTop` 119/140, `swRide` 283/304, `swTour` 188/207 (đã sửa từ 209 theo log).
Lần chấm 0 LỖI (2026-10-24, `run-sunwheel.ps1`): `KET-QUA.md` ghi `swTour|đêm` = 209 trong khi log là 207; thiếu bằng chứng cho mục 8 của `test:sunwheel`; chưa giải thích 19–21 draw call chênh ngày/đêm; `test:tunnel` timeout. Xử lý (2026-10-24, chạy tay từng test, không chạy chồng):
- (a) `npm run test:tunnel` chạy riêng **đạt** (thoát 0); log `gd8-l0-test-tunnel.log` trên đĩa cũng ghi đạt và không có "timeout" nào trong các log `gd8-l0-*`, nên lần timeout `page.goto` không tái hiện — khả năng cao do tải máy, CHƯA chứng minh. (Trước đó, khi chưa được chạy test: GĐ8 không đổi `src/`; cùng `openApp` đã đạt `test:riverfront` sau đó; chưa sửa mã.)
- (b) `npm run test:sunwheel` bản đầy đủ gồm mục 8 **đạt** (thoát 0; log `tests/screens/sunwheel-gd8/fix-sunwheel.log`).
- (c) Chênh 19–21 ở `swNight/swTop/swRide/swTour` KHÔNG do vòng quay: đo riêng (`tests/screens/sunwheel-gd8/probe-night.mjs`, không commit) ẩn nhóm vòng quay mà `swOverview` 164/185, `swTop` 115/136, `swRide` 280/301 vẫn chênh 21; vật chỉ vẽ ban đêm: `rf-night-lights` ×1, `ttl-life` ×2, 2 mesh không tên (chưa xác định). Vòng quay đóng góp 4 draw call ở `swOverview`/`swTop` và 3 ở `swRide`, ngày = đêm. Mức +21 cũng có ở góc cũ (`ttlBase`, `tpWater`; `overview` +24). Còn 4 góc `swOverview/swFront/swBase/swFromTTL` chênh 0 vì cột "ngày" của chúng được đo ban đêm: bấm `rfHearts` đặt `dayNight.target = 1` (`setupUI.ts:67`), `drawcalls.mjs` không trả ban ngày cho các góc sau đó (cùng ảnh hưởng `rfBank`, `wxRiverMouth`, `wxTtlStays`, `wxStreet`). Ghi chú đã vào `KET-QUA.md`.
- Cập nhật sau lần chấm LỖI: dòng `sw*` trong bảng `now` của `KET-QUA.md` từng in đậm và `swRide`/`swTour` có chú thích trong tên dòng nên mục 8 của `sunwheel-check` (`^\| sw… \|`) sẽ LỖI. Sửa thành tên thuần; số đo không đổi. Log `gd8-l0-test-sunwheel` chạy trước mục 8.
Chưa có: FPS thật, giọng đọc nghe thật, ảnh GĐ8. `tests/KET-QUA.md` mục "Bộ test Vòng quay Mặt Trời GĐ8" vẫn ghi `test:tunnel` LỖI và `test:sunwheel` "chưa đủ bằng chứng" (viết trước khi chạy tay (a), (b)); kết quả chạy tay ở trên và trong tin nhắn commit `314e6b4`.
Commit: `314e6b4` (2026-10-24; `KET-QUA.md`, README, memory bank, `sunwheel-check.mjs`). Merge `origin/main` vào nhánh `9a809dc` (Google tag, LICENSE, README; giữ `.env.production` và `prompts/tham-chieu/` trong `.gitignore`); merge PR #8 vào `main` là `257b905` (2026-10-24).
Kiểm tra: log GĐ8: `build` đạt (146 module); `test:drawcalls` đạt (74 phép đo = 37 góc × ngày/đêm, góc cũ chênh 0 đến +2, khớp log); `test:tour` đạt (dragon 8, tp 7, ttl 7, sh 6, hr 8, all 13, sw 6, storm 8); `test:voice` đạt (vi/en/ru, 6 tour, 47 điểm dừng + 8 mốc bão); `test:riverfront`, `test:weather` đạt. Chạy tay 2026-10-24: `test:tunnel` đạt, `test:sunwheel` đầy đủ (gồm mục 8) đạt.

### Sau merge: thay đổi chạm Vòng quay từ tính năng khác
- [x] Tối ưu độ mượt (D-018): `sway()` trả một object dùng lại thay vì tạo mới mỗi lần; `swPlaceCabins` dùng ma trận/vector dùng chung, không tính lại bounding sphere mỗi lần — khung bao cố định ở `swBuildCabins` (tâm trục, cộng `pivotUp·maxTilt`); `core/prewarm.ts` vẽ thật một lần mọi object nên "Bay tới Vòng quay lần đầu" từ +4 176 ms / +4 program còn +2 ms / 0 (`tests/KET-QUA.md`). Commit `134d5c8` (2026-10-25; `SunWheel.ts` +10/−5, `cabins.ts` +6/−4; commit chung).
- [x] Giao diện điện thoại (D-019): `swRideHintTouch` × 9 (chữ hướng dẫn cảm ứng trong `#swRideHint`). Commit `9214229`, `1dbe77a` (chung với mobile UI).

Kiểm tra: `test:perf -- --strict` đạt 2026-10-25; `test:drawcalls` 73/74 (2026-10-25, `swTour|đêm` 209 vs 207, thăm dò 4 lần trung vị 209/209/209/208, từng khung 200–223 khi camera leo cabin — dao động của phép đo) và 72/74 (2026-10-27, `swTour` ngày 187 vs 188, đêm 209 vs 207, dao động đã biết); `test:sunwheel`, `test:tour`, `test:voice` đạt 2026-10-25 và 2026-10-27.

## Còn lại
- [ ] Sửa `tests/drawcalls.mjs` để trả ban ngày sau `rfHearts` (đặt lại `setNight(page, night)` sau khi đo), chạy lại `test:drawcalls`, cập nhật cột "ngày" của 8 góc (`rfBank`, `wxRiverMouth`, `wxTtlStays`, `wxStreet`, `swOverview`, `swFront`, `swBase`, `swFromTTL`) ở `tests/KET-QUA.md` và `chuan-truoc-sunwheel.txt`.
- [ ] Chạy `test:drawcalls` một mình tại `main` (lần `-Resume` cuối bị TimeoutError do máy quá tải) và `npm run test:drawcalls -- tests/original` cho các góc cũ (góc `sw*` không có trong bản gốc).
- [ ] Chốt số ước lượng: `x ≈ −440` (đo khoảng cách tâm → mép nước), kiểm `z` (khoảng cách tâm → tim Cầu Trần Thị Lý), D ≈ 93 m, trục ≈ 64 m, bệ ≈ 13 m; cần đường kính thật, ảnh cận cabin, video show LED, ảnh trong cabin.
- [ ] Nghe thử giọng đọc `swStops`; `/code-review`; đo FPS GPU thật.
- [ ] Khác ảnh tham chiếu: giá treo cabin (InstancedMesh thứ hai, +1 draw call trong `details`), lầu hai đầu bệ rỗng, đèn rọi trời (mesh nón cộng màu, không `SpotLight`).
- [ ] Thêm `maxPolar` cho preset `swFront` (camera bị OrbitControls kẹp lên y ≈ 58,7).
- [ ] Nhãn bảng Thông số riêng cho Vòng quay (thay "Chiều dài / Bề rộng / Làn xe").
- [ ] Bố cục màn thấp (≈ 600 px): ô tốc độ/LED, nút "Ngồi cabin" sát/bị bảng Thông số che; `#swRideHint`, `#swStormNote` che ô chọn ngôn ngữ ở ≈ 960 px; `swRideHintTouch` trỏ tới nút trong sheet Góc nhìn.
- [ ] Kiểm tra tự động cho 5 kiểu show LED và nhịp tim đồng bộ riverfront; kiểm tra Vòng quay trong `test:weather`.
- [ ] Âm thanh/rung cabin; điểm nhìn vòng quay trong kịch bản bão (`STORM_TOUR`); kiểm cảm giác kéo trên cảm ứng thật.
- [ ] Sửa mục "Bộ test Vòng quay Mặt Trời GĐ8" của `tests/KET-QUA.md` theo kết quả chạy tay 2026-10-24 (`test:tunnel` đạt, `test:sunwheel` đầy đủ đạt; chênh ngày/đêm đã tách).
