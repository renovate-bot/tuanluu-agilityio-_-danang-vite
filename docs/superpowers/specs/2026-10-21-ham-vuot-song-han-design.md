# Hầm vượt sông Hàn — Thiết kế
_2026-10-21 · Trạng thái: Đã xây (merge 745f72d, PR #1) · Prompt gốc: prompts/ham-vuot-song-han.md tại c418f92_

Đọc lại bản prompt cũ: `git show c418f92:prompts/ham-vuot-song-han.md`. Tài liệu này mô tả cái ĐÃ XÂY, đối chiếu với `src/bridges/han-tunnel/`, `src/ui/hrUI.ts` và `CONFIG.hanTunnel` trong `src/config.ts`.

## 1. Mục đích và lý do
- Thêm công trình thứ 5 vào cảnh sông Hàn: **Hầm vượt sông Hàn**, đúng mức chi tiết và cách tổ chức mã của bốn cầu có sẵn (góc nhìn, Tour có thuyết minh, bảng Thông số, 9 ngôn ngữ).
- Bám thông tin đã công bố (tuyến, chiều dài từng đoạn, số làn, tốc độ, tổng mức, tiến độ); chỗ chưa công bố tự thiết kế hợp lý và ghi `(ước lượng)` (D-007).
- Hợp với Đà Nẵng: xe máy chiếm đa số (làn xe máy riêng), mùa mưa bão và ngập tháng 9–12 (gờ chắn ngập, cửa phai, trạm bơm), nắng gắt (mái lam), gió biển mặn, gần Thành Điện Hải (cửa Tây).
- Nhìn được phần dưới đất và dưới nước: mặt cắt địa chất, lái xe xuyên hầm, mô phỏng dìm đốt hầm.
- Không làm hỏng cái đang có: bốn cầu, chuỗi `rand()` có seed, draw call góc nhìn cũ, các test cũ.
- Bối cảnh trong prompt: sẽ là hầm vượt sông thứ hai của Việt Nam, sau hầm Thủ Thiêm (TP.HCM, hầm dìm, khánh thành 2011) (Người Quan Sát). Thủ Thiêm là mẫu cho mặt cắt (hai ống xe + hành lang thoát nạn giữa) và phương pháp hầm dìm.

## 2. Phạm vi: có / không có
Có:
- Trắc dọc `hrRoadY(x)` đối xứng qua tim sông, đáy sông, hào nạo vét (`profile.ts`).
- Hầm dìm 5 đốt × 120 m, hầm kín trên bờ, hầm hở hai đầu (máng chữ U), mái lam 80 m, cửa hầm Tây/Đông, gờ chắn ngập, cửa phai, khung giới hạn 4,5 m (`shell.ts`, `bore.ts`, `outdoor.ts`).
- Nội thất: mặt đường 3 làn mỗi ống (làn xe máy riêng), đèn vùng ngưỡng/vùng trong, quạt phản lực quay, hộp SOS, bình chữa cháy, cửa ngang sang hành lang mỗi 100 m, biển EXIT, đèn tín hiệu làn, khe thu nước và tủ bơm (`bore.ts`, `materials.ts`).
- Khoét đất cho hai máng hầm hở, vá shader nước để nước không lọt vào máng (`environment/river.ts`, `cutaway.ts`).
- Chế độ Mặt cắt địa chất: clipping plane, nước trong suốt, tấm địa chất vẽ canvas, 7 nhãn 3D (`cutaway.ts`, `ui/hrUI.ts`).
- Mô phỏng dìm đốt hầm số 3 (`immersion.ts`), lái xe xuyên hầm có hiệu ứng mắt thích nghi (`hrDrive` trong `views/camera.ts`).
- Xe trong hầm và trên đường nối Đống Đa/Vân Đồn, kể cả làn xe máy (`createTraffic`).
- Dọn nhà, cây, cột đèn trên hành lang tuyến bằng scale 0 (`corridor.ts`).
- 6 góc nhìn + Tour, Tour 8 điểm, bảng Thông số, i18n 9 ngôn ngữ, thuyết minh vi/en/ru, `test:tunnel`.

Không có (xem mục 7, 9):
- Âm thanh trong hầm (tiếng ù quạt, tiếng xe vọng): prompt ghi "nếu module audio cho phép", chưa làm.
- Tường vây barrette, cọc chống đẩy nổi, mực nước ngầm chỉ nằm trong ảnh canvas tấm địa chất hoặc lời thuyết minh, không có hình học 3D riêng.
- Nhà điều hành và thông gió cạnh cửa Đông.

## 3. Thông số đã dùng
Mọi số nằm trong `hanTunnelBase` (`src/config.ts`), xuất ra `CONFIG.hanTunnel` qua `deriveHr()`. Mét, trừ khi ghi khác. Tọa độ cục bộ: tim sông x = 0, group dời tới `z`.

**Số đã công bố (bắt buộc bám):**

| Hạng mục | Giá trị | Nguồn | Khóa |
|---|---|---|---|
| Hướng tuyến | từ nút Đống Đa – Trần Phú (Hải Châu, bờ Tây) sang nút Vân Đồn – Trần Hưng Đạo (Sơn Trà, bờ Đông), tuyến thẳng | Tiền Phong 07/2024; Tuổi Trẻ 03/2025 | \|x\| ≤ 835 |
| Tổng chiều dài tuyến chính (phương án 2025) | ≈ 1.670 m = hầm kín qua sông 600 + hầm kín trên bờ 380 + hầm hở 415 + đường dẫn 275 | Tuổi Trẻ 19/03/2025 | `immersedHalf` 300, `coverHalf` 490, `rampHalf` 697,5, `approachHalf` 835 |
| Quy mô | 6 làn xe cơ giới (3 làn mỗi chiều) | BRITEC 2016–2017; Tiền Phong 2024 | `lanesPerDir` 3; bảng Thông số `lanes: '6'` (`panel.ts`) |
| Tốc độ thiết kế | 60 km/h (ô tô 16,7 m/s); xe máy 40 km/h (11,1 m/s) là ước lượng | phương án 2017 | `carSpeed`, `bikeSpeed` |
| Độ dốc dọc tham khảo | hầm kín ≈ 2%, hầm hở ≈ 4% | nguồn tổng hợp, phương án 2017 | `maxGrade` (xem dưới) |
| Tổng mức đầu tư | 6.880 tỷ đồng: xây lắp 3.900 tỷ, giải phóng mặt bằng 2.000 tỷ, chi phí khác ≈ 980 tỷ | Tuổi Trẻ 19/03/2025 | chữ trong `hrNote`, `hrStops` (không có khóa số) |
| Tiến độ | quy hoạch 2021–2030, tầm nhìn 2050 (QĐ 359, QĐ 1287); đầu tư dự kiến 2031–2045 | Tuổi Trẻ, Tiền Phong | chữ trong `hrNote`, `hrStops` |
| Phương án cũ | 2016: 1.315 m, đoạn hầm chìm 900 m; 2017: 1.405 m, hầm kín 1.005 m, 4.700 tỷ. Chỉ nhắc trong thuyết minh như lịch sử; chuẩn là phương án 2025 | Tiền Phong, VnExpress | không có trong mã (xem mục 7) |

Nguồn tham khảo của prompt (giữ lại): Tuổi Trẻ 19/03/2025 *Đà Nẵng đề xuất phương án xây hầm qua sông Hàn hơn 6.800 tỉ*; Tiền Phong 07/2024 *Hầm chui qua sông Hàn sẽ như thế nào?*; VnExpress chủ đề *Đà Nẵng sẽ xây hầm vượt sông Hàn*; VOH *Đề xuất phương án xây dựng hầm vượt sông Hàn hơn 6.000 tỷ đồng*; Người Quan Sát *Hầm vượt sông thứ hai của Việt Nam…*. Địa chỉ đầy đủ xem mục 7 của `git show c418f92:prompts/ham-vuot-song-han.md`.

**Số tự thiết kế (đều `(ước lượng)` trừ khi ghi khác):**

| Thông số | Giá trị | Khóa |
|---|---|---|
| Vị trí Bắc–Nam | z = −1.700 m: ~620 m Bắc Cầu sông Hàn (z = −1.080), ~1,2 km Nam Cầu Thuận Phước (z = −2.900) | `z` |
| Hành lang không đặt gì khác | \|z + 1.700\| < 30 m (bất biến); hầm chạy thẳng theo trục X | `halfWidth` 15,6; `corridor.ts` dọn thêm 3,5 m mỗi bên |
| Đốt hầm dìm | 5 đốt × 120 m, BTCT đúc sẵn | `elements`, `elementLen` |
| Mặt cắt ngang | \|1,0\| ống 12,5 \|0,6\| hành lang 3,0 \|0,6\| ống 12,5 \|1,0\| = 31,2 m (theo hầm Thủ Thiêm) | `halfWidth` 15,6, `outerWall` 1,0, `midWall` 0,6, `corridorHalf` 1,5, `tubeNear` 2,1, `tubeFar` 14,6, `tubeCenter` 8,35 |
| Làn | 2 làn ô tô + 1 làn xe máy sát lề phải, mỗi làn 3,5 m; lề 1,0 m | `laneWidth`, `lanesPerDir`, `shoulder` |
| Chiều cao | bản đáy 1,5 + ống 5,8 + bản nóc 1,2 = đốt cao 8,5 m; hành lang cao 2,6 m | `slabBelow`, `clear`, `roofT`, `corridorClear` |
| Trắc dọc | \[\|x\|, cao độ\]: (0; −14,6), (90; −14,33), (300; −10,35), (490; −5,6), (705; 3,84), (745; 2,6); cong đứng parabol dài 0/40/0/80/24/20 m tại các điểm | `profile`, `vc` |
| Đáy sông | −6 m ở luồng giữa (\|x\| ≤ 90), −2,5 m sát kè (\|x\| ≥ 262), nội suy tuyến tính ở giữa | `bedMid`, `bedFlat`, `bedBank` |
| Độ dốc tối đa | dìm 2%, hầm kín bờ 3,5%, hầm hở 4,5% | `maxGrade` |
| Phủ nóc tối thiểu | nóc hầm dìm thấp hơn đáy sông ≥ 1,0 m (chưa tính lớp đá hộc) | `minCover` |
| Gờ chắn ngập | đỉnh dốc cao hơn mặt phố 1,0 m | `floodSill` |
| Hào nạo vét | nửa bề rộng đáy 19 m, mái dốc 1 : 2,5; đệm đá dăm 0,6 m dưới bản đáy | `trenchBottomHalf`, `trenchSlope` |
| Mái lam | dài 80 m mỗi phía, bước lam 2,0 m | `louverLen`, `louverGap` |
| Bước thiết bị | quạt mỗi 100 m, SOS mỗi 50 m, cửa ngang mỗi 100 m, đèn tín hiệu làn mỗi 150 m | `fanStep`, `sosStep`, `crossStep`, `signalStep` |
| Khung giới hạn chiều cao | 4,5 m, tại \|x\| = 747,5 (cách đầu hầm hở 50 m) | `heightLimit`, `gantryX` |
| LOD | chi tiết nhỏ ẩn xa hơn 600 m; mặt đường/vỉa hè xa hơn 650 m; xe xa hơn 450 m; cả công trình xa hơn 1.500 m | `lodDistance`, `farDistance`, `lifeDistance`, `hideDistance` |
| Vùng cấm thuyền khi dìm | z ∈ [−1.760; −1.640] | `boatKeepOut` (`environment/traffic.ts`) |
| Mặt cắt địa chất | mặt cắt dọc qua giữa làn ô tô và làn xe máy của ống Nam (z = −1.700 + 11,1); dải bóc rộng 110 m phía Bắc; vùng bóc \|x\| ≤ 875 | `cutZ`, `CUT_X`, `CUT_STRIP` (`cutaway.ts`) |
| Lớp địa chất vẽ trên tấm | cát san lấp, cát pha, sét yếu, sét cứng, đá phong hoá (đáy lớp −2/−9/−22/−34/−45 m) | `LAYERS` (`cutaway.ts`, hằng trong mã) |
| Mô phỏng dìm: thời gian thật từng giai đoạn | FLOAT_IN 70 s, POSITION 45 s, BALLAST 100 s, PULL_JOINT 40 s, BACKFILL 70 s, DONE 15 s (chia cho hệ số 1×/10×/30×) | `DUR` (`immersion.ts`) |
| Mô phỏng dìm: hình học | nâng khi nổi 8,4 m (nóc đốt +0,8 m trên mặt nước), tàu kéo từ 230 m, đứng cách 26 m, khe 3,2 m | `FLOAT_LIFT`, `APPROACH`, `STANDOFF`, `GAP` |

Kiểm lại trắc dọc (mô phỏng lại `roadY` bằng một script rời, đối chiếu ràng buộc của `test:tunnel`): đỉnh ≈ +3,62 m tại \|x\| ≈ 707 ⇒ gờ cao hơn mặt phố 2,6 m ≈ 1,02 m (prompt: y = 3,6 m); dốc lớn nhất dìm 1,9%, hầm kín bờ 3,4%, hầm hở 4,4%; nóc hầm dìm cách đáy sông dư ≈ 0,25 m sau khi trừ `minCover`; hầm kín bờ phủ đất ≥ 0,9 m.

Số khác nằm trong mã, chưa vào `CONFIG`: đốt 3 tách riêng ở \|x\| ≤ 60 m; vòng GINA dài 0,5 m nhô 6 cm; tường ốp sáng cao 3 m trong ống (`BAND`); độ sáng nền `boreLevel` (vùng ngưỡng 80 m cuối hầm kín); lô cốt răng cưa cửa Tây (hộp 0,9 × 0,7 × 1,0 m), đỉnh sóng cửa Đông (cao 0,5–1,5 m); 5 thuyền thúng tại x ≈ 612–636, z ≈ ±25; cọ `rng(7001)`; xe `seed: 3100` (34 + 30 + 110 xe, làn xe máy 94%); `hrDrive` chạy 18 m/s từ x = −1.000 đến +1.000, camera cao 1,45 m, hệ số phơi sáng trong hầm 0,7.

## 4. Hình dạng, hành vi như đã xây
`HanTunnel` (`HanTunnel.ts`) kế thừa `BridgeBase`, prefix `hr`. Thứ tự dựng: `hrClearCorridor()` (trước mọi thứ), ba đoạn vỏ + nội thất (`buildBore`), `hrBuildRiverbed`, `hrBuildOutdoor`, `buildSim`, xe (`createTraffic`), `finalize()`, `Cutaway`.

- **Trục và đoạn.** `hrZone(x)` chia `immersed / cover / ramp / approach / street`. `hrRoadY` là đường gãy khúc bo parabol quanh điểm đổi dốc, phẳng 2,6 m sau \|x\| = 745.
- **Vỏ hầm kín** (`shell.ts`): `boreShape()` là tiết diện 31,2 × 8,5 m có ba lỗ (hai ống xe, một hành lang), `extrudeShape` đùn dọc X rồi uốn theo `hrRoadY`; màu đỉnh (`boreColor`) tô tường ốp sáng, trần tối, sàn xám; `jointRing` là vòng gioăng sẫm ở khe nối đốt.
- **Ba đoạn** (`bore.ts`): `west` (−490…−60), `mid` (−60…60 = đốt số 3), `east` (60…490). Tách đốt 3 riêng để mô phỏng dìm di chuyển được. Mỗi đoạn có `shell` (vỏ, giữ lại) và `fit` (nội thất, ẩn khi đốt còn nổi). Vật lặp lại là `InstancedMesh` (quạt, SOS, bình chữa cháy, cửa, EXIT, đèn tín hiệu); đèn trần và vạch dẫn gộp thành một mesh mỗi loại.
- **Phần nằm dưới đất chỉ vẽ khi cần.** `underground` hiện khi `details` hiện và (camera trong hầm `hrInside`, hoặc Mặt cắt bật, hoặc đang dìm, hoặc `forceInterior` do Tour). Từ ngoài nhìn vào chỉ thấy máng hầm hở và cửa hầm.
- **Ngoài trời** (`outdoor.ts`): máng chữ U (sàn, hai tường ngoài cao hơn mặt đường 1,1 m và nhô ≥ 0,6 m khỏi mặt phố, dải giữa thay hành lang); mái lam trên cột (dầm biên + dầm giữa + lam nghiêng); dải LED viền mái lam và cửa hầm; khung cửa hầm; trang trí đỉnh (Tây: lô cốt gạch gợi tường thành Điện Hải; Đông: đỉnh sóng, cụm thuyền thúng); gờ chắn ngập (nền đắp 62,5 m qua đỉnh dốc) + cửa phai (khe thép, cánh kéo lên); khung 4,5 m; biển VMS "HẦM SÔNG HÀN · 60 km/h · XE MÁY ĐI LÀN PHẢI" và biển giới hạn chiều cao gộp chung một canvas (`signTex`). Mặt đường nối Đống Đa (x từ −1.900) và Vân Đồn (đến x = +1.480), dải giữa cỏ, vỉa hè gạch, đèn đường (`addLampPosts`), cọ ven đường.
- **Đáy sông** (`riverbed.ts`): lưới đáy bùn cát với hào nạo vét (6 cột z mỗi hàng ngang x), và 5 dải đá hộc phủ nóc (mỗi đốt một dải để ẩn riêng dải đốt 3 khi dìm), trong dải z ∈ [−2.600; +2.600] (thế giới).
- **Khoét đất và nước** (`environment/river.ts`, `cutaway.ts`): `buildRiverBanks()` tách khối đất thành nhiều hộp, chừa hai lỗ đúng bằng mặt bằng hai máng (`HR_HOLES`, không gọi `rand()`). `Cutaway.patchWater()` vá fragment shader của `Water` bằng `uHoles` (`discard` trong máng) và `uCut`/`uCutOn` (`discard` trong dải bóc khi bật mặt cắt).
- **Mặt cắt** (`Cutaway`): 4 `clippingPlanes` + `clipIntersection = true` tạo một hình hộp bị loại; gán cố định lên các vật liệu đất/đường/cây/đèn/nhà/xe/hầm từ lúc dựng (D-018); tắt = đẩy mặt phẳng đầu ra 1e7 m. Tấm địa chất `hr-geology` là `MeshBasicMaterial` vẽ canvas (lớp đất, nước, đá hộc trong hào, bản nóc/đáy, mực nước ngầm nét đứt, lưới cao độ). `setGlass(true)` chỉ làm nước trong suốt (dùng khi dìm). `applyWater()` đặt `alpha` 0,4 (prompt: ≈ 0,35).
- **Mô phỏng dìm** (`ImmersionController`, kế thừa `EventTarget`): `IDLE → FLOAT_IN → POSITION → BALLAST → PULL_JOINT → BACKFILL → DONE → IDLE`. Sự kiện `immerseStart`, `immerseDone`, `stateChange`. `HanTunnel.applySim()` đặt tư thế đốt 3 (`zOff`, `lift`, `gap`), hiện vách ngăn kín hai đầu đốt (`bulk`), tháp định vị, hai tàu kéo, 4 phao đánh dấu hào, và co dải đá hộc theo `fill`. Khi dìm: đường đóng (`life` ẩn), `boatKeepOut.on = true`, `holdBoats()` giữ thuyền của cầu khác ở mép vùng cấm.
- **Xe** (`createTraffic`, `common/traffic.ts`): 3 làn mỗi chiều (làn phải 94% xe máy), theo `hrRoadY`; chỉ chạy khi `life` hiện (camera trong 450 m). `closable = false`: bão vẫn lưu thông (xem mục 7).
- **Lái xe xuyên hầm** (`views/camera.ts`): chế độ `hrDrive` chạy theo làn giữa của ống Nam (`laneOffsets[1]`), lặp từ x = −1.000 sang +1.000; hệ số `eye.k` tiến dần về 0,7 khi \|x\| < `coverHalf` (thời hằng 0,5 s) và nhân vào `renderer.toneMappingExposure`; `applyNight` đặt lại phơi sáng mỗi khung nên ra khỏi chế độ luôn về 0,55.
- **Dọn hành lang** (`corridor.ts`): `hrClearCorridor()` duyệt `InstancedMesh` là nhà (cha là `THREE.LOD`, cả level `near` lẫn `far`), cây, cột đèn; instance nào có \|z − z_hầm\| < nửa bề rộng + 3,5 m (+ nửa kích thước nhà) và \|x\| ≥ 262 thì gán scale 0.
- **Vật liệu** (`materials.ts`): nội thất dùng `indoor()` (đặt `envMap` trực tiếp, `envMapIntensity` 0,12) cộng `emissive` nhỏ nhân màu đỉnh để khỏi tối; đèn là `MeshBasicMaterial` đổi theo `shared.uNight` (`hrUpdateLamps`): đèn vùng ngưỡng 2,6 (ngày) → 1,1 (đêm); dải LED 0,35 → 1,4 (đêm). Không thêm `PointLight`/`SpotLight`.

## 5. Tương tác, UI, i18n, thuyết minh
- Chọn công trình `data-bridge="hr"` ("Hầm sông Hàn"); `BRIDGE_HOME.hr` = `hrOverview`.
- Danh sách góc nhìn (`data-list="hr"`): `hrTour` "Tour tự động", `hrOverview` "Toàn cảnh" (nhãn dùng khóa `vTtlOverview`), `hrCutaway` "Mặt cắt dọc tuyến" (tự bật mặt cắt), `hrPortalW` "Cửa Tây · Thành Điện Hải", `hrPortalE` "Cửa Đông · Sơn Trà", `hrDrive` "Lái xe xuyên hầm", `hrGallery` "Hành lang thoát nạn". `hrSimCam` (−110, 70, z − 95) là góc camera tự bay đến khi bấm dìm, không có nút riêng.
- Nút bật/tắt và khối dìm (`index.html`): `#btnHrSection` "Mặt cắt địa chất", `#btnHrImmerse` "Mô phỏng dìm đốt hầm", `#hrImSpeed` 1×/10×/30× (mặc định 10×), `#hrImState` (`aria-live="polite"`, 7 chuỗi `im_*`), `#btnHrFollow` "Camera theo dõi khi dìm", `#btnHrLife` "Xe cộ". Ghi chú `hrImNote` dùng lớp `.swing-note`.
- `hrUI.ts`: chọn góc `hrCutaway` thì bật mặt cắt; các góc `hr*` khác hoặc chọn công trình khác thì tắt. Bấm dìm khi bật theo dõi: lưu camera, `exitTour()`, bay tới `hrSimCam`; xong thì bay về chỗ cũ (không làm khi `fromTour` hoặc đang Tour). Nhãn 3D là các `div.hr-label` trong `#hrLabels`, đặt lại vị trí màn hình mỗi khung (`updateHrUI`) và dịch theo ngôn ngữ (`hrLblElements`, `hrLblGina`, `hrLblBed`, `hrLblPump`, `hrLblCover`, `hrLblRamp`, `hrLblFlood`).
- **Tour** `HR_TOUR` 8 điểm (`views/tourStops.ts`; `TOUR_DEFS.hr`, khóa `hrStops`, `minY: -30` cho đường bay dưới mặt nước): (1) toàn tuyến, hầm vượt sông thứ hai của Việt Nam, đang đề xuất; (2) cửa Tây, mái lam; (3) gờ chắn ngập và cửa phai; (4) mặt cắt (cờ `cutaway: true`); (5) khe GINA và dìm đốt hầm (cờ `immerse: true`, chạy 30×); (6) trong ống xe, làn xe máy, quạt, đèn ngưỡng (cờ `interior: true`); (7) hành lang thoát nạn, cửa ngang mỗi 100 m (cờ `interior: true`); (8) cửa Đông, nhìn ra Sơn Trà, nhắc 6.880 tỷ và 2031–2045. `tourHooks.stop` đặt lại mặt cắt/nội thất từng điểm; `tourHooks.exit` tắt cả hai.
- **Bảng Thông số** (`SPEC_KEYS.hr` trong `panel.ts`): `hrLengthVal` "≈ 1.670 m", `hrWidthVal` "31,2 m" (mặt cắt đốt dìm), `hrSpan` "Hầm dìm qua sông", `hrSpanVal` "600 m · 5 đốt", làn "6", `hrNote`: "Phương án đề xuất 2025, dự kiến đầu tư 2031–2045, tổng mức 6.880 tỷ đồng. Mặt cắt, độ sâu và kiến trúc cửa hầm là ước lượng."
- **i18n:** mọi khóa hầm (`bridgeHr`, `vHr*`, `hrSection`, `hrTraffic`, `hrImmerseBtn`, `hrImBusy`, `hrImSpeed`, `hrImNote`, `hrFollow`, `hrLengthVal`, `hrWidthVal`, `hrSpan`, `hrSpanVal`, `hrNote`, `hrLbl*`, `im_*`, `hrStops`) có đủ trong cả 9 locale (đếm khóa mẫu `hr*`, `vHr*`, `im_*`, `bridgeHr`: 33 mỗi locale, bằng nhau); `loadingSub` đã thêm "hầm vượt sông Hàn". `ar` RTL.
- **Thuyết minh:** `hrStops` 8 điểm trong `scripts/narration/{vi,en,ru}.json`, clip `public/voice/{vi,en,ru}/hrStops-0…7.mp3`. vi/en sinh ở `bdab293` (`scripts/add-tunnel-narration.mjs`; bản dịch giao diện `scripts/add-tunnel-locales.mjs`); ru ở `0a0b6be`. ko, ja, zh, th, ar, hi chưa có.

## 6. Ràng buộc đã tuân thủ
- **Phương án đề xuất, chưa xây (bất biến 6).** Hầm là mô hình của phương án đề xuất, không phải công trình đã xây. Chữ này có trong `hrNote` (bảng Thông số: "Phương án đề xuất 2025…"), thuyết minh điểm 1 (`hrStops`: "Phương án đề xuất 2025"), và `hrNote` ghi rõ mặt cắt, độ sâu, kiến trúc cửa hầm là ước lượng. Bảng "Ảnh hưởng tới cầu" của thời tiết ghi hầm vẫn lưu thông "(phương án đề xuất)" (`wxTunnelOk`).
- **Hành lang `|z + 1700| < 30`.** Không đặt gì khác lên hành lang này: nhà, cây, cột đèn nằm trong đó bị thu về scale 0 (`corridor.ts`); cọ và đèn của chính hầm dựng sau khi dọn. Tour kịch bản bão cũng không đặt điểm trên hành lang (`tourStops.ts`).
- **`rand()` có seed (D-002).** `HanTunnel` được tạo trong `main.ts` sau mọi lệnh dùng `rand` (sau `SongHanBridge`), trước `buildRiverfront()`. Không sửa `avoid()` của `city.ts`. Dọn bằng scale 0, xử lý cả level `near` lẫn `far` của `THREE.LOD`. Phần ngẫu nhiên riêng: cọ `rng(7001)`, xe `seed: 3100`. Khoét đất không gọi `rand()`.
- **Draw call.** Bảng `now` (`tests/KET-QUA.md`, log GĐ8 Vòng quay 2026-10-24), ngày / đêm: `hrOverview` 277 / 307, `hrCutaway` 358 / 390, `hrPortalW` 163 / 190, `hrPortalE` 205 / 229, `hrDrive` 210 / 234, `hrGallery` 169 / 200. Góc cũ không thấy hầm chênh 0 so với bản gốc (36/36, 2026-10-20). Cách giữ thấp (`a4802ad`): bê tông gộp một mesh (`hr-concrete`), thép gộp một mesh; biển VMS và biển 4,5 m gộp một canvas/mesh; dải LED, lam mái, cọ, thuyền thúng, dải giữa, vỉa hè vào bê tông bằng màu đỉnh; bê tông/thép không vào lượt phản chiếu (`layers.set(1)`); thép không đổ bóng; vật lặp lại là `InstancedMesh`; LOD 600/650/450/1.500 m; toàn bộ nội thất ẩn khi camera ở ngoài.
- **Đèn.** Ban đêm chỉ bằng emissive/`MeshBasicMaterial` đọc `shared.uNight`; không `PointLight`/`SpotLight` (bất biến 5).
- **Texture** vẽ bằng canvas (vạch đường `makeTunnelRoadTexture`, đá hộc, biển, tấm địa chất), không ảnh ngoài; không thêm thư viện.
- **Mọi thông số ở `src/config.ts`** (`hanTunnelBase`, mỗi dòng có chú thích tiếng Việt, đơn vị, `(ước lượng)`); các số trong mã nêu cuối mục 3 là ngoại lệ chưa chuyển vào `CONFIG`.
- **Bão.** `closable = false`: hầm vẫn lưu thông khi preset Bão (bơm thoát nước làm việc, xem mục 7); mưa/chớp không vẽ trong hầm (`systemPatterns.md`).

## 7. Khác so với ý định ban đầu
- **Cấu trúc file.** Prompt: `HanTunnel.ts`, `index.ts`, `profile.ts`, `materials.ts`, `immersed.ts`, `cutCover.ts`, `openRamp.ts`, `portals.ts`, `equipment.ts`, `riverbed.ts`, `life.ts`, `immersion.ts`. Đã xây: `HanTunnel.ts`, `index.ts`, `profile.ts`, `materials.ts`, `shell.ts` (vỏ và gioăng, thay `immersed`/`cutCover`), `bore.ts` (nội thất theo đoạn, thay `equipment`), `outdoor.ts` (thay `openRamp` + `portals`), `corridor.ts` (thêm: dọn hành lang), `cutaway.ts` (thêm: mặt cắt, nước, nhãn), `riverbed.ts`, `immersion.ts`. Không có `life.ts` riêng: xe dựng bằng `createTraffic` trong `HanTunnel.ts`.
- **Mái lam.** Prompt: lam bê tông siêu tính năng xếp nghiêng, hở 40%. Đã xây: lam nghiêng bước 2,0 m (`louverGap`), mỗi lam là một hộp gộp vào bê tông; không tính tỉ lệ hở.
- **Mặt cắt ngang.** Prompt: bản đáy 1,2 m, ống cao trong 6,1 m, đốt cao 8,5 m. Đã xây: bản đáy 1,5 m, ống 5,8 m, bản nóc 1,2 m, đốt cao vẫn 8,5 m (`slabBelow`, `clear`, `roofT`).
- **Trắc dọc.** Prompt: mặt đường đáy hầm −14…−15 m; đỉnh dốc y = 3,6 m; `hrRoadY(x)` theo mẫu Cầu sông Hàn (Catmull-Rom hoặc parabol). Đã xây: −14,6 m ở tim sông; đỉnh ≈ 3,62 m (gờ cao hơn mặt phố ≈ 1,02 m, test ≥ 0,95 m); `roadY` là đường gãy khúc bo parabol.
- **Tường vây barrette, cọc chống đẩy nổi.** Prompt 2.2–2.3. Đã xây: không có hình học 3D; chỉ có trong thuyết minh/tấm địa chất.
- **Nhà điều hành và thông gió cạnh cửa Đông.** Prompt 2.5. Chưa dựng.
- **Ô chữ "HẦM SÔNG HÀN" và lý trình trên tường máng.** Prompt 2.6. Đã xây: chữ "HẦM SÔNG HÀN" trên biển VMS ở cửa hầm; không có ô chữ lý trình trên tường máng. Hàng cây và dải cỏ: có cọ ven đường và dải giữa cỏ.
- **Camera CCTV, họng nước chữa cháy, biển thoát nạn phát quang.** Prompt 2.5. Đã xây: biển EXIT phát sáng (`MeshBasicMaterial`) và vạch dẫn xanh dưới sàn hành lang; không có CCTV, họng nước.
- **Đường nối với mặt đất.** Prompt 3.8: thêm đường Đống Đa/Vân Đồn vào `ROADS3` (`streets.ts`) cùng nút giao ở mặt đất với Bạch Đằng/Trần Hưng Đạo. Đã xây: mặt đường riêng `hr-road` trong `outdoor.ts` (x từ −1.900 đến +1.480), không sửa `ROADS3`; việc xe trên Bạch Đằng chạy trên nóc hầm kín chưa đối chiếu.
- **LOD.** Prompt: `lodDistance ≈ 1300`, `farDistance ≈ 1600`, nội thất ẩn khi ở ngoài cách cửa hầm > 250 m. Đã xây (`a4802ad`): chi tiết nhỏ ẩn xa hơn 600 m (`lodDistance`, trước đó 800 m), mặt đường/vỉa hè xa hơn 650 m (`farDistance`), xe xa hơn 450 m (`lifeDistance`), cả công trình xa hơn 1.500 m (`hideDistance`); nội thất theo điều kiện camera trong hầm / mặt cắt / dìm / Tour (`underground.visible`), không theo khoảng cách 250 m.
- **`riverbed` không phụ thuộc `details.visible`** (`5f780b4`). Ban đầu `riverbed.group.visible = details.visible && (…)`. Camera `hrOverview` cách tâm hầm ≈ 797 m, xa hơn `lodDistance` 600 m, nên bật Mặt cắt không hiện đáy sông và `test:tunnel` lỗi ở bước 2 (`hrBed` false). Đã bỏ `details.visible &&`: đáy sông là một phần của chế độ mặt cắt / nước trong / dìm; xa hơn `hideDistance` thì cả group đã ẩn; chế độ tắt thì vẫn ẩn nên góc thường không thêm draw call (`test:drawcalls` 52/52 chênh 0 ở lần chấm GĐ3 thời tiết).
- **Dao động `lift` của đốt nổi chỉ chìm xuống** (`5f780b4`). `applySim()` từng cộng `sin(t·1,3)·0,08` lên `lift` khi `lift > 1`; đồng hồ là `performance.now()` nên test ngẫu nhiên: khung đầu `BALLAST` có `lift` = 8,4 + tối đa 0,08 > `FLOAT_LIFT` 8,4 (log: 8,4395). Đã đổi thành `(sin − 1)·0,04` ∈ [−0,08; 0], không bao giờ vượt `FLOAT_LIFT` (mạn khô +0,8 m); `FLOAT_IN` vẫn > 8. Không nới ngưỡng test. Cả hai lỗi này có sẵn trong mã hầm (không do mưa/ướt) và chỉ lộ ra khi GĐ3 thời tiết đòi `test:tunnel` qua.
- **Mặt cắt gán mặt phẳng cố định** (D-018, `134d5c8`). Prompt: bật/tắt mặt cắt đổi `clippingPlanes` rồi trả lại. Đã xây: gán cố định lúc dựng (đổi lúc chạy làm hàng chục vật liệu + nhà biên dịch lại shader, giật vài giây); tắt = đẩy mặt phẳng đầu ra 1e7 m. Cách kiểm "về đúng giá trị gốc" của `test:tunnel` (so ảnh chụp trạng thái nước và đất trước/sau) vẫn dùng được.
- **Hiệu ứng mắt thích nghi.** Prompt: phơi sáng giảm về 70% trong 1,5 s rồi trả lại 0,55. Đã xây: thời hằng 0,5 s (`eye.k`), đích 0,7 khi \|x\| < `coverHalf`; ra ngoài trả lại 1,0 (tức 0,55).
- **Xe máy.** Prompt: "nếu `traffic.ts` chưa có kiểu xe máy thì thêm kiểu mới". `common/traffic.ts` đã có kiểu `bike`; không thêm kiểu mới.
- **Ngân sách draw call.** Prompt: góc nhìn của hầm ≤ 260 draw call (ngày và đêm), góc cũ không tăng quá 12, góc chỉ thấy 4 cầu chênh 0. Đã xây: chỉ `hrPortalW` (163 / 190) và `hrGallery` (169 / 200) nằm dưới 260; `hrOverview` 277 / 307, `hrCutaway` 358 / 390, `hrPortalE` 205 / 229 (đêm), `hrDrive` 210 / 234 (bảng ở mục 6, gồm bóng đổ, phản chiếu, bloom). Một phần là phần nền của cảnh chung. Chưa có số trước/sau theo yêu cầu "báo cáo draw call trước/sau" của prompt.
- **Bão.** `closable = false`; `stepTraffic(…, false)` (`1b39173`): hầm không đóng theo lệnh cấm lưu thông của thời tiết (bơm hoạt động). Bảng "Ảnh hưởng tới cầu" có dòng riêng `wxTunnelOk`. Hầm không chịu gió, không giãn nở (activeContext, GĐ1 thời tiết).
- **Tour điểm 3.** `a4802ad` nâng điểm dừng cổng Tour lên 15 m để đường bay không lọt dưới đất.
- **Thuyết minh.** Prompt: lịch sử phương án 2016/2017 chỉ nhắc trong thuyết minh. Đã xây: lời `hrStops` (vi) không nhắc 2016/2017 và Thủ Thiêm (đã grep); chỉ nhắc "hầm vượt sông thứ hai", phương án 2025, 6.880 tỷ, 2031–2045. Các số của phương án cũ (nêu ở mục 3) chỉ còn trong tài liệu này.
- **Test.** Prompt: `tunnel-check.mjs` còn kiểm Tour 8 điểm, camera không lọt đất/nước, và ảnh `hrOverview`… cùng một khung giữa mô phỏng dìm. Đã xây: Tour kiểm trong `tests/tour-check.mjs`; `tunnel-check.mjs` chụp ảnh ngày/đêm 5 góc + hai khung `hrDrive`; chưa chụp riêng khung giữa mô phỏng dìm trong `tunnel-check.mjs`.
- **Nguồn trong README.** README mục Hầm ghi nguồn "Sở Xây dựng Đà Nẵng", prompt chỉ ghi nguồn báo chí (Tuổi Trẻ, Tiền Phong…). Chưa đối chiếu cái nào đúng.

## 8. Kiểm tra
- `tests/tunnel-check.mjs` (`npm run test:tunnel`): (1) hình học: chiều dài các đoạn 600/380/415/275, tổng 1.670, 5 đốt × 120, dốc từng đoạn ≤ `maxGrade`, nóc hầm dìm cách đáy sông ≥ 1 m, hầm kín dưới đất ≥ 0,8 m, cao độ nhảy ≤ 0,03 m mỗi 0,25 m, gờ chắn ngập ≥ 0,95 m, đối xứng qua tim sông; (2) mặt cắt bật/tắt 3 lần, nước (`transparent`, `depthWrite`, `alpha`, `uCutOn`) và đất (`clippingPlanes`, `clipIntersection`) về đúng giá trị gốc, tấm địa chất và đáy sông hiện/ẩn đúng; (3) lái xuyên hầm: phơi sáng < 0,44 trong hầm, đúng 0,55 sau khi thoát; (4) mô phỏng dìm đi đủ 6 trạng thái rồi `IDLE`, mẫu `FLOAT_IN` (lift > 8, z < −100, nội thất ẩn, nước trong, xe ẩn) và `BALLAST` (lift ∈ (0,4; 8,4], z = 0), cuối trả đúng hầm hoàn chỉnh; (5) ảnh ngày/đêm; (6) console sạch. Kết quả gần nhất trong tài liệu: đạt (chạy tay 2026-10-24 sau GĐ8 Vòng quay; lần đầu trong phiên đó `page.goto` quá 180 s không tái hiện, khả năng cao do tải máy, chưa chứng minh).
- `tests/tour-check.mjs`: `hr` 8 điểm dừng, camera thấp nhất −14,73 m, mô phỏng dìm chạy ("FLOAT_IN"), mỗi điểm đặt đúng chế độ mặt cắt; đường bay ngoài vùng hầm không lọt đất/nước. Đạt (8/8 tour, 2026-10-27).
- `tests/voice-check.mjs`: `hrStops` vi + en + ru đủ clip, đạt.
- `tests/drawcalls.mjs`: 6 góc `hr*` trong `VIEWS`, thêm ở `92c8d34`. Số ở mục 6.
- `tests/perf-check.mjs` (`npm run test:perf`): "Bật mặt cắt Hầm lần 1" +5 ms, 0 program mới sau D-018 (trước đó +12 577 ms, +22 program). Đạt `--strict` (2026-10-25).

## 9. Còn mở
- Âm thanh trong hầm (tiếng ù quạt, tiếng xe vọng) khi camera ở trong hầm.
- Số draw call `hrOverview`, `hrCutaway`, `hrPortalE`, `hrDrive` vượt ngân sách ≤ 260 của prompt; chưa có phép đo trước/sau và chưa tách phần do hầm, phần do cảnh chung.
- Nhà điều hành và thông gió cạnh cửa Đông; ô chữ lý trình trên tường máng; camera CCTV và họng nước; cọc chống đẩy nổi và tường vây barrette dạng hình học 3D.
- Ảnh khung giữa mô phỏng dìm trong `test:tunnel`; kiểm tự động đường bay không xuyên thành hầm (hiện Tour hầm chỉ kiểm phần ngoài vùng sát tuyến).
- Mô phỏng chỉ dìm đốt số 3; chưa chọn được đốt khác.
- Thuyết minh chưa nhắc phương án 2016/2017 (prompt dặn nhắc như lịch sử).
- Thuyết minh ko, ja, zh, th, ar, hi.
- Nguồn "Sở Xây dựng Đà Nẵng" trong README so với nguồn của prompt gốc.
- Các số trong mã chưa vào `CONFIG` (đốt 3 ±60 m, vòng GINA, `BAND`, vùng bóc, thuyền thúng, `hrDrive` 18 m/s) nên chuyển vào `hanTunnelBase` khi có dịp (bất biến 3).
- Dòng giới thiệu Hầm bị lặp ở đầu `README.md` (đã ghi ở `progress.md`).
