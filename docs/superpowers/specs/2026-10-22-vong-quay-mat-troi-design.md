# Vòng quay Mặt Trời (Sun Wheel) Đà Nẵng — Thiết kế
_2026-10-22 · Trạng thái: Đã xây (merge 257b905, PR #8) · Prompt gốc: prompts/vong-quay-mat-troi.md tại c418f92_

Đọc lại bản prompt cũ: `git show c418f92:prompts/vong-quay-mat-troi.md`. Tài liệu này mô tả cái ĐÃ XÂY, đối chiếu với `src/bridges/sun-wheel/`, `CONFIG.sunWheel` (`sunWheelBase` + `deriveSunWheel()` trong `src/config.ts`) và các quyết định D-014, D-016, D-017 (liên quan: D-012 đóng theo `closed`, D-018 tối ưu độ mượt). Kế hoạch theo giai đoạn: [2026-10-22-vong-quay-mat-troi.md](../plans/2026-10-22-vong-quay-mat-troi.md).

## 1. Mục đích và lý do
- Cảnh đã có 4 cầu, Hầm (phương án đề xuất), hai bờ sông và thời tiết. Thêm **Sun Wheel** — vòng quay quan sát ở Asia Park (Công viên Châu Á), bờ Tây sông Hàn, phía Nam Cầu Trần Thị Lý — gồm **vòng quay + bệ + nhà ga** (không dựng Asia Park).
- Người xem phải:
  - thấy vòng quay **đang hoạt động**: quay đúng tốc độ thật (15 phút/vòng) hoặc tua nhanh ×10 / ×60, cabin luôn đứng thẳng;
  - xem **show LED ban đêm** (13 000 LED trên 32 thanh), vài kiểu, có kiểu đồng bộ với LED trái tim riverfront;
  - **ngồi trong cabin** (camera đi theo) để ngắm 4 cầu từ độ cao tới ~115 m;
  - đi **Tour** có thuyết minh vi/en/ru;
  - thấy vòng quay **dừng khi Bão** (theo trạng thái `closed`, như D-012).
- Không làm hỏng cái đang có: chuỗi `rand()` có seed, draw call các góc nhìn cũ (ngân sách mục 6), ngày/đêm, thời tiết, Tour, thuyết minh, test hiện tại.
- Thứ tự ưu tiên của prompt: **P1** hình học + quay + LOD → **P2** LED đêm + ngồi cabin + thời tiết → **P3** Tour + thuyết minh, kiểu show đồng bộ riverfront. Đã làm đủ P1–P3; phần P3 "đèn rọi trời" chưa làm (mục 7).
- Hiện trạng thật: theo một số nguồn vòng quay đã ngừng sau 3/9/2025 (Wikipedia infobox "Closed", hoiandaytrip; chưa xác nhận). Người dùng chọn thể hiện lúc **đang hoạt động** kèm ghi chú (12b-1, mục 5).

## 2. Phạm vi: có / không có
Có:
- `class SunWheel extends BridgeBase` (D-014) ở `src/bridges/sun-wheel/`: phần tĩnh (quảng trường, bệ + nhà ga, hai tháp đầu bệ + lầu, cổng vòm vàng, giàn tháp đỡ, trục) gộp một mesh; phần quay (vành chính, vành phụ, vành moay-ơ, 32 thanh, 64 cáp chéo, moay-ơ) gộp một mesh; 64 cabin `InstancedMesh`; biển "SUN WHEEL" vẽ canvas.
- Quay deterministic, 4 tốc độ (Dừng / ×1 / ×10 / ×60), đổi mượt; cabin luôn đứng thẳng khi lặng gió.
- LED đêm 5 kiểu show trong shader của ba vật liệu sẵn có (`ledShow.ts`), kiểu "nhịp tim" đồng bộ LED trái tim riverfront.
- Ngồi cabin (`ride.ts`, chế độ camera `'swRide'`, D-016).
- Thời tiết: dừng khi bão (`weatherFx.wheelStopped`), cabin lắc theo `windFx`, mặt ướt (option `weather` của `bridgePatch`), dòng thông báo khi đang ngồi.
- 7 góc nhìn `sw*` + nút Ngồi cabin + ô tốc độ + ô kiểu show + bảng Thông số + Tour 6 điểm có thuyết minh vi/en/ru (D-017); i18n 9 ngôn ngữ.
- `tests/sunwheel-check.mjs` (`npm run test:sunwheel`); góc `sw*` trong `tests/drawcalls.mjs`; `sw` trong `tests/tour-check.mjs`, `tests/voice-check.mjs`.

Không có (theo 12b-2 và prompt):
- Asia Park, hồ/kênh nhánh phía Bắc–Tây (ảnh `a1`): cảnh không có kênh này, không dựng.
- Phối cảnh **quy hoạch đề xuất** quanh Sun Wheel (Aurora Tower, nhà hát… — ảnh `a3`): chỉ để định vị, không dựng.
- Logo Sun World (ảnh `a1` có logo đỏ ở chỗ biển): cố ý không dựng, chỉ dựng chữ "SUN WHEEL".
- Âm thanh riêng (prompt mục 8 để trống).

Ảnh tham chiếu: 6 ảnh người dùng gửi ngày 2026-10-22, nằm ở docs/superpowers/specs/tham-chieu/sun-wheel/ (trước ở prompts/tham-chieu/sun-wheel/). Thư mục nằm trong `.gitignore`, **không commit**: ảnh lấy từ nguồn ngoài, có bản quyền, chỉ dùng trên máy để dựng hình; không đưa vào `src/` hay `public/`.

| Ảnh | Nội dung | Mục 1.1 của prompt |
|---|---|---|
| `a1-flycam-ngay-nhin-bac.png` | Flycam ban ngày từ phía Nam Đông Nam nhìn về Bắc: vòng quay, bệ, quảng trường, Cầu Trần Thị Lý và Cầu Rồng phía sau | 3, 4, 7 |
| `a2-flycam-dem-nhin-bac.png` | Flycam lúc chạng vạng, cùng hướng: nan LED hồng tím, cabin đỏ | 6, 7 |
| `a3-phoi-canh-quy-hoach-de-xuat.png` | Phối cảnh quy hoạch đề xuất: chỉ để định vị, không dựng | — |
| `n1-chinh-dien-dem.png` | Chính diện ban đêm: đếm cabin, nan, đo tỉ lệ bệ / vành | 2, 4, 6 |
| `n2-chan-nhin-len-dem.png` | Dưới chân nhìn lên ban đêm: giàn tháp đỡ, vành phụ, biển "SUN WHEEL" | 3, 6 |
| `n3-nghieng-dem.png` | Nhìn nghiêng ban đêm: chiều sâu tháp đỡ, bệ, hai lầu ở hai đầu | 3, 6 |

Tọa độ tâm và hướng mặt phẳng (mục 1.1 ý 1) người dùng gửi cùng ngày, không có file. Tư liệu prompt mục 1.1 còn thiếu: ảnh cận cabin ban ngày (ý 5), video show LED 10–30 s mỗi kiểu (ý 6; mới có ảnh tĩnh hai kiểu), ảnh từ trong cabin ở đỉnh (ý 8, để đối chiếu `swTop` / ride), tài liệu kỹ thuật (ý 9: đường kính thật, cao trục, nhà sản xuất Igosu 108). Ý 7 (ảnh từ Cầu Trần Thị Lý nhìn Nam, từ bờ Đông) mới có `a1`/`a2` (từ phía Nam nhìn Bắc).

## 3. Thông số đã dùng
Mọi số nằm trong `sunWheelBase` (`src/config.ts`), xuất ra `CONFIG.sunWheel` qua `deriveSunWheel()`; mã đọc qua `SW = CONFIG.sunWheel` (`profile.ts`). Đơn vị: m, độ, giây; tọa độ thế giới (z âm là Bắc), mặt đất y = `landY` 2,5. Quy tắc của prompt: có nguồn thì ghi nguồn, không có thì "(ước lượng)", không bịa số.

**Số có nguồn / người dùng đo:**

| Thông số | Giá trị | Trạng thái / nguồn (theo prompt mục 1) | Khóa |
|---|---|---|---|
| Chiều cao tổng (đỉnh cabin so với mặt đất) | 115 m | đã có nguồn: Wikipedia (Sun Wheel (Da Nang)), danang.gov.vn | `height` |
| Số cabin × sức chứa | 64 × 6 = 384 khách | đã có nguồn: Wikipedia, vietnamtourism.vn | `cabins`, `seats` |
| Thời gian một vòng | 900 s (≈ 15 phút) → ω = 2π/900 ≈ 0,00698 rad/s | đã có nguồn: vietnamtourism.vn | `period`, `omega` (dẫn xuất) |
| Khối lượng | 980 t | một nguồn: vietnambooking | `mass` |
| Chiếu sáng | 13 000 LED trên 32 thanh chính | một nguồn: vietnambooking | `leds`, `spokes` |
| Lịch sử | "Igosu 108", Biwako Tower (Shiga, Nhật), mở 26/4/1992, cao 108 m; tháo về Đà Nẵng, dựng trên bệ cao hơn, mở 18/7/2014 | đã có nguồn: Wikipedia, abandonedkansai | chú thích đầu khối; `swNote`, `swStops[2]` |
| Tâm vòng quay | 16,040525°N; 108,228459°E | người dùng cung cấp (Google Maps, 2026-10-22) | `lat`, `lon` |
| So với Cầu Rồng | 2 282 m về Nam, 136 m về Đông (Cầu Rồng 16,06116°N; 108,22719°E theo Structurae) | tính từ hai tọa độ | chú thích `lat` |
| Vị trí z trong cảnh | **+2 280** | theo khoảng cách Nam–Bắc tới Cầu Rồng (mô hình coi sông thẳng, trục X = Đông thật) | `z` |
| Hướng mặt phẳng vòng quay | phương vị 83° ↔ 263° (Đông Đông Bắc – Tây Tây Nam); trục quay 173° ↔ 353° | người dùng đo trên ảnh vệ tinh (2026-10-22) | `azimuth` |
| Hướng trong cảnh | `group.rotation.y` = `yaw` = 90° − 83° = **+7°** (0,122 rad): đầu Đông của vòng quay lệch về Bắc (−Z); quy đổi phương vị A ↦ (sin A, 0, −cos A) | dẫn xuất | `yaw` (dẫn xuất) |
| Mặt chính | mặt có biển "SUN WHEEL" và quảng trường quay **Nam Đông Nam** (+Z cục bộ); từ Cầu Trần Thị Lý nhìn thấy **mặt sau** | đọc từ ảnh `a1`, `a2` | hệ cục bộ (`profile.ts`) |
| Hiện trạng | một số nguồn ghi đã ngừng sau 3/9/2025 | chưa xác nhận (Wikipedia infobox "Closed", hoiandaytrip) | `swNote`, `swStops[2]` |
| Tốc độ | hệ số 0, 1, 10, 60 | 12b-3 | `speeds` |

**Số ước lượng (đọc tỉ lệ trên ảnh):**

| Thông số | Giá trị | Cách suy / ghi chú | Khóa |
|---|---|---|---|
| Vị trí x | **≈ −440** | −(262 mép kè Tây + ≈ 180 m vào bờ), đọc trên ảnh `a1`/vệ tinh. Không lấy từ độ lệch kinh độ vì sông thật lệch dần về Đông khi đi về phía Nam. Chờ đo khoảng cách tâm → mép nước (12b) | `x` |
| Bán kính vành | 46,5 m → **đường kính ≈ 93 m** | suy từ 115 = bệ 13 + 2·(R + 4,5 cabin). Một nguồn (hoiandaytrip) ghi 108 m — nhiều khả năng lẫn với chiều cao ở Nhật; đo ngang trên ảnh `n1` ra ≈ 100 m nhưng ảnh chụp từ dưới lên, có phối cảnh | `rimR` |
| Cabin + giá treo | 4,5 m, treo ngoài vành | — | `cabinH` |
| Cao sàn mái bệ | **≈ 13 m**; cabin thấp nhất chạm sàn này | đo tỉ lệ trên ảnh `n1`, `n3` | `baseH` |
| Bệ | dài 100 m (dọc mặt vòng quay), sâu 30 m (theo trục quay) | prompt: dài ≈ 100 m | `baseLen`, `baseDepth` |
| Cao tâm trục | `hubY` = `landY` + `baseH` + `cabinH` + `rimR` = 66,5 so với mặt nước = **≈ 64 m** so với mặt đất | dẫn xuất | `hubY` |
| Đỉnh cabin | `topY` = 117,5 so với mặt nước (115 m so với mặt đất) | dẫn xuất, khớp số có nguồn | `topY` |
| Bán kính tâm cabin | `cabinR` = `rimR` + `cabinH`/2 = 48,75 m | dẫn xuất | `cabinR` |
| Quảng trường | 120 × 70 m, phía mặt Nam, nối vào bệ | — | `plaza` |
| Dọn nền | khung bao bệ + quảng trường (`site`), lề 6 m | — | `site` (dẫn xuất), `clearMargin` |
| LOD | 1 500 m: xa hơn thì ẩn cabin, biển hiệu | — | `lodDistance` |

**Hình học (GĐ2, tất cả ước lượng, đọc tỉ lệ từ ảnh `n1` chính diện và `a1` flycam):**

| Bộ phận | Giá trị | Khóa |
|---|---|---|
| Vành chính | 2 vòng cách nhau 5 m theo trục quay, ống bán kính 0,45 m, 64 thanh giằng | `rim` |
| Vành phụ | ở 0,65 R (theo ảnh `n2`), ống 0,25 m | `ring2`, `ring2Tube` |
| Vành moay-ơ | bán kính 7 m, ống 0,3 m | `hubRing`, `hubRingTube` |
| Moay-ơ | bán kính 2,6 m, dài 7 m | `hub` |
| Thanh / cáp | 32 thanh bán kính 0,22 m; 64 cáp chéo 0,07 m (`n1` thấy nhiều hơn 32 đường) | `spokeR`, `cableR`, `cables` |
| Trục tĩnh | bán kính 1,3 m, dài 24 m theo phương 173°/353° | `axle` |
| Giàn tháp đỡ | mỗi bên mặt vòng quay: mặt giàn cách mặt vòng quay 10 m ở trục, 13 m ở chân; chân rộng ±26 m trên mặt bệ, đỉnh ±3 m; tiết diện chân 1,2 m, giằng 0,5 m; 5 tầng giằng ngang | `legs` |
| Cabin | viên nang đứng: bán kính 1,5, thân thẳng 1,3 (cao 4,3 m), dải kính ±0,8 m quanh giữa | `cabin` |
| Nhà ga | tháp vuông hai đầu bệ rộng 17, cao 15; 3 vòm cuốn rộng 7, cao 8,5, cách nhau 21 m; ốp đá xám (hệ số màu 0,55); 8 bồn cây trên sàn mái | `station` |
| Lầu trên tháp | rộng 12, tầng dưới cao 4, tầng trên 3, mái dưới 3, mái trên 2,6 | `pavilion` |
| Cổng vòm vàng (sân khấu) | bán kính vòm 9, ống 0,9, sân khấu sâu 8 (`a1`) | `gate` |
| Biển "SUN WHEEL" | rộng 16, cao 3,2, tâm thấp hơn trục 13 m, mặt Nam (`n1`) | `sign` |
| Cột đèn quảng trường | 8 cột, cao 8 m | `lamps` |

**Chuyển động, LED, ngồi cabin, Tour, thời tiết (tất cả ước lượng trừ ghi khác):**

| Thông số | Giá trị | Khóa |
|---|---|---|
| Đổi tốc độ | 6 hệ số/giây (dừng ↔ ×60 ≈ 10 s, dừng ↔ ×1 < 0,2 s) | `speedAccel` |
| Bước tích phân tối đa | 0,1 s | `stepMax` |
| Lệch góc tối thiểu để dựng lại 64 ma trận cabin | 1e-4 rad | `placeEps` |
| Kiểu show | `white`, `pink`, `rays`, `heart`, `off` (`uShow` 0–4), mặc định trắng | `led.shows`, `led.show` |
| Độ sáng LED | thanh 1,5 · viền vành 2,2 · vành phụ/moay-ơ 1,2 · cáp 0,35 · moay-ơ 0,6 | `led.spoke`, `rim`, `ring`, `cable`, `hub` |
| Giàn + trục chiếu trắng | 0,32 ở kiểu trắng, một nửa ở kiểu màu, 0 khi tắt | `led.flood` |
| Viền LED đỏ cabin | 2,0 (hai vòng sát mép dải kính, cao 0,22 m) + ánh đỏ vỏ 0,12 | `led.cabinRing`, `cabinShell`, `cabinRingW` |
| Đèn cột quảng trường | 1,6 (vàng ấm), sáng mọi kiểu show | `led.lamp` |
| Hồng tím / tia chạy / nhịp tim | dải màu trượt 0,8 rad/s; tia 0,6 vòng sóng/s, 1,5 sóng/bán kính (≈ 1,1 s một sóng); nền nhịp tim 0,25 | `led.pinkWave`, `rayRate`, `rayCount`, `heartBase` |
| Ngồi cabin | mắt cao hơn tâm cabin 0,4 m; cúi 0,12 rad lúc lên; giới hạn ngẩng/cúi 1,4 rad (≈ 80°); 0,005 rad/px; bay vào 1,6 s | `ride.eyeUp`, `pitch0`, `pitchMax`, `lookSpeed`, `enterTime` |
| Tour | lên đỉnh ×40, tới đỉnh ×1; điểm 4 tối thiểu 18 s, điểm 5 tối thiểu 12 s; điểm 6 show `pink` | `tour.climbSpeed`, `topSpeed`, `climbSec`, `topSec`, `show` |
| Dừng khi bão | 10 s, giảm tốc tuyến tính từ tốc độ lúc đó | `storm.stopSec` |
| Cabin lắc | gió tham chiếu 25 m/s (biên độ ∝ (gió/ref)², có trần); nghiêng tối đa 0,16 rad (≈ 9°); phần nghiêng cố định 0,5; 1,6 rad/s; lệch pha 2,4 rad giữa cabin liền kề; điểm treo cao hơn tâm 3,6 m | `storm.sway.ref`, `maxTilt`, `mean`, `omega`, `phase`, `pivotUp` |

Số nằm cứng trong mã (không ở `config.ts`; ghi nhận khi chấm GĐ4): hệ số đèn hắt từ chân giàn `0,6 + 0,4·smoothstep` và nền tia chạy 0,12, các màu LED (trắng, đỏ vành, hồng/tím, hồng trái tim), tốc độ đổi màu tia 0,05 (`ledShow.ts`); độ sáng biển `0,85 + 1,6·uNight` (`SunWheel.update`); canvas biển 512 × 96, chữ đậm 76 px (`materials.ts`); nhịp tim lấy `HEART_BEAT_PERIOD` 1,5 s, `HEART_CYCLE` từ `heartFacade.ts`.

## 4. Hình dạng, hành vi như đã xây
Hệ cục bộ (`profile.ts`, D-014): X dọc mặt vòng quay (phương vị 83°), Y lên (cao độ thế giới), Z theo trục quay (+Z về mặt Nam Đông Nam, có biển và quảng trường). `group.position = (x, 0, z)`, `rotation.y = yaw`. `swToWorld()` đổi điểm cục bộ sang thế giới (dùng ở `views/presets.ts`, `tourStops.ts`, test).

| File | Nội dung chính |
|---|---|
| `SunWheel.ts` | `class SunWheel extends BridgeBase` (tiền tố `sw`, LOD `lodDistance`); dọn nền `clearRects([SW.site], SW.clearMargin)`; mesh `sw-static` (vật liệu bê tông), Group `sw-wheel` (gốc tại tâm trục) chứa `sw-wheel-mesh` (thép); `details` chứa `sw-cabins`, `sw-sign`; `setAngle`, `angle`, `setSpeed`, `speedNow`, `speedTarget`, `stopping`, `advance`, `sway`, `cabinPose`, `cabinWorld`, `cabinUp`, `setShow`, `show`, `update` |
| `profile.ts` | `SW`, `swCabinAngle`, `swCabinPos`, `swToWorld` |
| `structure.ts` | `swBuildBase` (quảng trường + 8 cột đèn, bệ ốp đá + 3 vòm cuốn hai mặt, 2 tháp vuông ô tròn + lầu hai tầng mái đỏ, bồn cây sàn mái, cổng vòm vàng), `swBuildLegs` (2 giàn hình thang 5 tầng giằng + trụ giữa + gối trục + trục), `swSignGeometry`, thuộc tính `aLit` (`SW_LIT` none/flood/lamp) |
| `wheel.ts` | `swBuildWheel`: 2 vòng vành + 64 giằng thẳng/chéo, vành phụ 0,65 R, vành moay-ơ, moay-ơ, 32 thanh, 64 cáp chéo; thuộc tính `aSpoke` (0–31 thanh chính, mã âm `SW_PART` rim −1, ring −2, cable −3, hub −4) và `aR` (0 moay-ơ → 1 vành) |
| `cabins.ts` | `swCabinGeometry` (`CapsuleGeometry`, dải kính theo màu đỉnh), `swCabinPose`, `swPlaceCabins`, `swBuildCabins` (InstancedMesh 64, khung bao cố định có cộng biên độ lắc) |
| `materials.ts` | `concrete` (`bridgePatch` `noise`, `wet`, `weather`; tô màu theo đỉnh), `steel` (`weather`), `cabin` (`weather`), cả ba qua `swLedPatch`; `sign` `MeshBasicMaterial` + canvas, `alphaTest` 0,4 |
| `ledShow.ts` | `swLedU.uShow`, `swLedPatch(mat, kind)` (`wheel`/`cabin`/`static`), `swShowIndex` |
| `ride.ts` | `swRide`: trạng thái cabin/yaw/pitch/`blend`/`saved`, `active`, `boardingCabin`, `eye`, `look`, `begin`, `update`, `updateNotice`, phần Tour (`tour`, `tourPhase`, `tourBoard`, `tourClimb`, `tourEnd`) |
| `index.ts` | xuất `SunWheel`, `SW`, `swRide` |

Nối vào ứng dụng: `main.ts` gọi `new SunWheel()` **sau** `buildRiverfront()` và **trước** `buildWeather()` (thời tiết chụp vật liệu gốc), thêm vào `bridges[]` (`bridgeKeys` `'sw'`) và `window.__app.sunWheel`, `__app.swRide`, `__app.windFx` (`?test`).

Hành vi:
- **Quay (GĐ3).** `advance(sec)` tích phân deterministic, bước ≤ `stepMax`: tốc độ tiến tuyến tính về đích theo `speedAccel`, `θ += ω·speed·h`. `wheel.rotation.z = θ` (ngược chiều kim đồng hồ nhìn từ mặt Nam; θ = 0 là cabin 0 ở giờ 3). Mặc định ×1. `update()` gọi `updateLod` → `advance(dt)` → `swRide.update(dt)` → `swRide.updateNotice()`.
- **Cabin đứng thẳng.** Cabin i ở góc `θ + i·2π/64`, vị trí `(cos, sin)·cabinR` quanh `(0, hubY)`; ma trận chỉ có phép tịnh tiến khi lặng gió. 64 ma trận chỉ dựng lại khi `details` hiện và (góc lệch ≥ `placeEps` hoặc đang lắc); ở xa vành vẫn quay (một phép gán), quay lại gần thì dựng lại ngay.
- **LED đêm (GĐ4).** Không mesh, không đèn: `swLedPatch` vá shader của ba vật liệu (chạy sau `bridgePatch`, dùng `uTime`/`uNight`/`vBW`), cộng vào `totalEmissiveRadiance`, nhân `shared.uNight` → ban ngày đóng góp 0. Kiểu: 0 trắng (kết cấu sáng trắng, viền vành đỏ, cabin viền đỏ, giàn được chiếu trắng — ảnh `n1`–`n3`); 1 hồng ↔ tím trượt dọc nan (ảnh `a2`); 2 tia chạy từ moay-ơ ra vành, màu đổi theo nan; 3 nhịp tim — cùng công thức + cùng `shared.uTime` với tấm pha 0 của LED trái tim riverfront (`heartFacade.ts` chỉ tách hằng GLSL ra để dùng chung, giá trị giữ nguyên); 4 tắt. Đèn cột quảng trường sáng mọi kiểu.
- **Ngồi cabin (GĐ5, D-016).** Chế độ camera `'swRide'`: `enterSwRide()`/`leaveSwRide(restore)`/`dropRide()` ở `views/camera.ts`. Lên cabin ở đáy vòng quay lúc bấm; mắt = tâm cabin + `eyeUp`; mặc định nhìn về Bắc (−Z cục bộ), hơi cúi. Tư thế camera đặt trong `SunWheel.update()` ngay sau `advance()` (không trong `updateCamera()`, vốn chạy trước `bridges[].update()` nên lệch một bước `dt`). Kéo chuột nhìn quanh (pointer events trên canvas), kẹp `pitchMax`. Tốc độ quay giữ theo ô tốc độ (×1 lên đỉnh ≈ 7,5 phút). Cabin là viên nang một mặt (FrontSide) nên nhìn từ trong ra không che cảnh. `begin()` chốt tư thế bằng `controls.update()` với damping tắt rồi mới lưu (sửa lỗi GĐ5).
- **Thời tiết (GĐ6).** `weatherFx.wheelStopped` (`core/shared.ts`) = `closed` trong `updateHooks()` (`weather/effectsHooks.ts`), không có ngưỡng gió (D-012). Khi dừng: tốc độ giảm tuyến tính từ tốc độ lúc bắt đầu dừng về 0 đúng sau `stopSec` (từ ×1 hay ×60 đều 10 s); tốc độ đích người dùng chọn giữ nguyên, hết bão tăng lại theo `speedAccel`. Cabin lắc: `swCabinPose()` nghiêng cabin quanh điểm treo cao hơn tâm `pivotUp`, góc `amp·(mean + (1 − mean)·sin(ω·t + i·phase))`, `amp = min(1, (|windFx|/ref)²)·maxTilt`, đáy cabin xuôi gió, pha cố định theo chỉ số (không `rand()`), đồng hồ `swayT` cộng dồn trong `advance()`. Đang ngồi: camera nghiêng theo cabin (`cabinPose()` thay cho đọc ma trận instance), dòng `#swStormNote` hiện khi `wheelStopped`. Mặt ướt có sẵn từ GĐ2 (option `weather: true`, đọc `uWet`).
- **Tour (GĐ7, D-017).** `SW_TOUR` (`views/tourStops.ts`), `TOUR_DEFS.sw` (`loop: false`, `segMax` = `CONFIG.tourAll.segMax`). Giữ `cam.mode = 'tour'`; `TourStop.sw` (`ride`/`top`/`night`) gọi `tourHooks.sw` (khe riêng, không đụng `tourHooks.stop` của Hầm); `swRide.active()` đúng cả khi `tour.on`, nên `SunWheel.update()` (chạy sau `updateTour()`) ghi đè camera bằng cabin; vào/ra cabin trộn mượt (`blend`, `tour.out`). Lên đỉnh: `tourClimb()` tua ×40 rồi giảm tốc khi quãng còn lại bằng quãng phanh từ `speedAccel`, tới đỉnh ở ×1. `TourStop.minSec` giữ điểm hiện đủ lâu kể cả khi tắt giọng (`fitDurations`). Thoát Tour (Esc / hết hành trình / đổi góc nhìn giữa chừng — `setView` không gọi `exitTour`, `swRide.update` tự phát hiện) trả tốc độ quay, ngày/đêm, kiểu show (`swRide.tourEnd()`, `onEnd` ở `setupUI.ts`).

## 5. Tương tác, UI, i18n, thuyết minh
- `index.html`: nút công trình `data-bridge="sw"` (`bridgeSw`); nhóm `data-list="sw"`: `swTour` (nhãn `vTour` dùng chung), `swOverview` (nhãn `vTtlOverview` "Toàn cảnh" dùng chung), `swFront`, `swBase`, `swFromTTL`, `swNight`, `swTop`, `swRide`; ô `#swSpeed` (Dừng / Thật (1×) / 10× / 60×); ô `#swShow` (Trắng / Hồng tím / Tia chạy / Nhịp tim / Tắt); `#swRideHint` (chuột / cảm ứng), `#swStormNote`.
- Góc nhìn (`views/presets.ts`, tọa độ cục bộ qua `swToWorld`, đều ước lượng): `swOverview` [180, 80, 260] → [0, 55, 0] (chếch từ bờ sông); `swFront` [0, 8, 230] → [0, 55, 0] (chính diện mặt Nam, thấp); `swBase` [−20, 4,3, 70] → [0, 40, 0], `maxPolar` 0,97π (đứng trên quảng trường nhìn lên); `swFromTTL` thế giới [−215, 20, TTLZ + 10] → điểm cục bộ [0, 60, 0] (từ Cầu Trần Thị Lý nhìn xuống phía Nam, ~1 km); `swNight` [−120, 25, 200] (tự chuyển sang đêm như `rfHearts`); `swTop` [0, 190, 120] → [0, 60, 0]. `BRIDGE_HOME.sw = 'swOverview'`.
- Bảng Thông số (`SPEC_KEYS.sw`, `src/ui/panel.ts`): dùng nhãn chung "Chiều dài / Bề rộng / Làn xe": `swLengthVal` "Cao 115 m", `swWidthVal` "≈ 93 m (đường kính)", làn "—", `swSpan` "Cabin", `swSpanVal` "64 cabin × 6 khách · 15 phút/vòng", `swNote` "Asia Park, khai trương 18/7/2014 (trước là Igosu 108, Nhật Bản). Theo một số nguồn đã ngừng hoạt động từ 9/2025; mô hình thể hiện lúc còn vận hành." (đúng câu prompt mục 1 yêu cầu).
- Esc: đang ngồi cabin thì xuống (`ui/setupUI.ts`); bấm lại nút `swRide` cũng xuống. Đổi góc nhìn / bắt đầu Tour / kịch bản bão / swing-follow → thoát ngay, không bay về chỗ cũ.
- Tour 6 điểm (`swStops`, tên các điểm theo `vi.json`): 1 "Vòng quay Mặt Trời" (toàn cảnh từ sông, `bridge: 'sw'`) · 2 "Chân vòng quay và nhà ga" · 3 "Từ Igosu 108 đến Sun Wheel" (lịch sử + ghi chú hiện trạng 9/2025) · 4 "Lên cabin, tới đỉnh" (`sw: 'ride'`) · 5 "Nhìn về bốn cầu" (`sw: 'top'`; phía Bắc là Cầu Trần Thị Lý ~1 km, rồi Cầu Rồng, Cầu sông Hàn, Thuận Phước) · 6 "Show LED ban đêm" (`sw: 'night'`, đêm + show hồng tím).
- i18n 25 khóa × 9 ngôn ngữ (`vi, en, ko, ja, zh, th, ar, hi, ru`; `ar` RTL), đã đếm 2026-11-08 (thiếu 0 ở mọi locale): GĐ3 14 khóa (`bridgeSw, vSwFront, vSwBase, vSwFromTTL, vSwNight, vSwTop, swWheelSpeed, swWheelStop, swWheelReal, swLengthVal, swWidthVal, swSpan, swSpanVal, swNote`); GĐ4 6 khóa (`swShow, swShowWhite, swShowPink, swShowRays, swShowHeart, swShowOff`); GĐ5 `vSwRide, swRideHint`; GĐ6 `swStormNote`; GĐ7 `swStops` (6 cặp tên + lời); sau merge `swRideHintTouch` (giao diện điện thoại, D-019). Thêm bằng `scripts/add-sunwheel-locales.mjs` và `scripts/add-sunwheel-tour-locales.mjs`.
- Thuyết minh vi/en/ru: khóa `swStops` trong `scripts/narration/*.json` (`scripts/add-sunwheel-narration.mjs`), 18 clip `public/voice/{vi,en,ru}/swStops-0…5.mp3` (commit `028dede`). Thời lượng clip (`manifest.json`): vi 12,1 / 11,4 / 21,2 / 15 / 12,6 / 10,7 s; en 13,2 / 13,7 / 20,2 / 18,5 / 15 / 12 s; ru 13,8 / 13,4 / 22,5 / 18,8 / 14,2 / 13,4 s.

## 6. Ràng buộc đã tuân thủ
- **`rand()` có seed (bất biến 1, D-014).** Dựng sau mọi lệnh dùng `rand` (sau `buildRiverfront()`); không thêm/bớt `rand()`; nền dọn bằng `clearRects()` của riverfront (scale 0 cả `near` lẫn `far` của LOD). Vùng z ≈ 2 280, x < −262 vốn chỉ có đất phẳng, kè, dải đi bộ (khu phố |z| < 1 800, đường Bạch Đằng tới z = 2 600, cây/đèn kè tới z = 2 300) nên dọn 0 nhà / 0 cây (`test:sunwheel` GĐ1). Lắc cabin dùng pha cố định theo chỉ số, không ngẫu nhiên.
- **Draw call (bất biến 2; ngân sách prompt mục 9, 12b-4).** Ngân sách: góc cũ ≤ chuẩn **+2** (người dùng duyệt); góc `sw*` ≤ 6 cho phần vòng quay; ngày ↔ đêm chênh 0 cho phần vòng quay; preset thời tiết không thêm so với `now`. Đã xây: phần tĩnh 1 mesh + phần quay 1 mesh luôn hiện (điểm mốc); cabin + biển trong `details`. Không `castShadow` (shadow camera bật lớp 1 nên sẽ thêm lượt vẽ bóng; `sw-static` chỉ `receiveShadow`), tất cả lớp 1 (`noReflect`). Kết quả (`tests/KET-QUA.md`, log GĐ8, chuẩn `tests/screens/chuan-truoc-sunwheel.txt`): mọi góc cũ chênh 0 đến +2; +2 đúng ở sáu góc xa thấy vòng quay (`bird`, `tpBay`, `tpBoth`, `ttlBoth`, `shOverview`, `wxRiverMouth`, ngày và đêm, đều cách > 2 700 m nên `details` ẩn). Phần vòng quay (bật − ẩn nhóm): 2 ở góc xa, 4 ở góc gần (`swOverview`, `swTop`), 3 khi ngồi cabin; ngày = đêm. Bảng `now` (ngày / đêm): `swOverview` 185 / 185, `swFront` 308 / 308, `swBase` 239 / 239, `swFromTTL` 133 / 133, `swNight` 281 / 302, `swTop` 119 / 140, `swRide` 283 / 304, `swTour` 188 / 207. Chênh đêm − ngày 19–21 ở `swNight/swTop/swRide/swTour` không do vòng quay (mục 8); cột "ngày" của `swOverview/swFront/swBase/swFromTTL` thực ra đo ban đêm (đo riêng `swOverview` ngày thật 164).
- **Preset thời tiết không thêm draw call.** `test:sunwheel` GĐ6: draw call vòng quay trong bão = lúc `now` (góc cũ ≤ 2, góc gần / `sw*` ≤ 6). Preset `now` không dừng, không lắc (ma trận chỉ tịnh tiến).
- **Đèn (bất biến 5).** Không `PointLight`/`SpotLight`; LED, đèn cột, chiếu sáng giàn là emissive trong shader nhân `shared.uNight`; biển hiệu đổi `color` theo `uNight`. Ảnh `swNight-white`, `swNight-pink`: không cháy bloom (bloom ngưỡng 0,98).
- **Không thư viện, không ảnh ngoài.** Chữ "SUN WHEEL" vẽ canvas; ảnh tham chiếu không vào `src/`/`public/`.
- **Mọi thông số ở `src/config.ts`** (`sunWheelBase`, chú thích tiếng Việt, đơn vị, nguồn hoặc "(ước lượng)"); ngoại lệ nằm cứng trong mã liệt kê cuối mục 3.
- **Hành lang Hầm `|z + 1700| < 30`.** Vòng quay ở z ≈ 2 280, không vật nào trong hành lang (`test:sunwheel`, cả cabin ở mọi góc).
- **Hiện trạng ghi rõ.** Panel (`swNote`) và Tour điểm 3 (`swStops[2]`, kiểm "2025" ở cả 9 locale) nói đã ngừng từ 9/2025 theo một số nguồn, mô hình thể hiện lúc còn vận hành. Vòng quay là công trình có thật nên không mang nhãn "phương án đề xuất"; phối cảnh quy hoạch đề xuất (`a3`) không dựng.
- **Không cấp phát mỗi khung (D-018, sau merge).** `sway()` trả một object dùng lại; `swPlaceCabins` dùng ma trận/vector dùng chung và khung bao cố định (`134d5c8`).

## 7. Khác so với ý định ban đầu
- **Không có giá treo tam giác của cabin.** Prompt mục 1.3: "Giá treo là khung tam giác nhỏ nối ra vành". Instance cabin chỉ tịnh tiến nên giá không xoay theo góc được; từ trong cabin cũng không thấy giá. Muốn thêm thì một `InstancedMesh` thứ hai (+1 draw call, trong `details`) — chưa làm.
- **Lầu là khối đặc** thay vì lầu cột rỗng hai tầng mái (ảnh `n1`/`a1`).
- **32 thanh chính + 64 cáp chéo** thay vì ~64 nan nhìn thấy trên ảnh `n1` (32 thanh mang LED theo nguồn; cáp chéo thay phần "nhiều hơn 32 đường").
- **Không có đèn rọi trời màu xanh** (`n1`, `n3`; P3, prompt cho phép mesh nón phát sáng cộng màu, không `SpotLight`).
- **Nhãn bảng Thông số dùng chung** "Chiều dài / Bề rộng / Làn xe" (ghi "Cao 115 m", "≈ 93 m (đường kính)", làn "—"). GĐ3 để nhãn riêng cho GĐ7 (panel) nhưng GĐ7 không làm; chú thích trong `panel.ts` vẫn ghi "giai đoạn 7".
- **Khác ảnh khác:** không có tầng sàn kỹ thuật ngang ở chân giàn; cây/bồn cây chi tiết chỉ là 8 bồn; quảng trường một màu không có ô lát; logo Sun World cố ý không dựng.
- **Phần tĩnh gộp bê tông, kể cả giàn thép và trục.** Prompt mục 2: giàn "gộp thép", quảng trường/bệ "gộp bê tông". Đã xây: mọi phần tĩnh gộp MỘT mesh vật liệu bê tông tô màu theo đỉnh (giàn có màu thép), để chỉ 1 draw call.
- **Nhà ga không nằm trong `details`.** Prompt mục 5: `details` gồm "cabin, nhà ga chi tiết". Đã xây: `details` chỉ có cabin + biển hiệu; bệ, nhà ga thuộc mesh tĩnh luôn hiện.
- **Hàm dựng khác tên/cách.** Prompt: `swBuildBase/Station/Legs/Axle`, `swLedShow`, `taperedTube`, `loftOct`, `TubeGeometry`. Đã xây: `swBuildBase` (gồm nhà ga), `swBuildLegs` (gồm trục), `swLedPatch`/`swLedU`; hình dựng bằng `boxAt`, `beamBetween`, `CylinderGeometry`, `TorusGeometry`, `ConeGeometry`, `CapsuleGeometry` (cabin).
- **Đổi tốc độ tuyến tính, không qua `toward()`.** Prompt mục 3, 6: `toward()`. Đã xây: tăng/giảm tuyến tính `speedAccel` 6/s; khi bão giảm tuyến tính với tốc độ `stopFrom/stopSec` để từ ×1 hay ×60 đều dừng đúng 10 s.
- **Cabin không cập nhật mỗi khung.** Prompt mục 2: "mỗi khung cập nhật `instanceMatrix`". Đã xây: chỉ khi `details` hiện và (góc lệch ≥ `placeEps` hoặc đang lắc).
- **Mặt ướt không qua `registerWet`.** Prompt mục 6: "vật liệu `registerWet`". `registerWet` dành cho vật liệu đường có `map`/roughness riêng; vòng quay dùng option `weather: true` của `bridgePatch` (đọc `uWet`) có từ GĐ2, không cần mã mới.
- **Hướng quay** ngược chiều kim đồng hồ nhìn từ Nam: chưa có nguồn.
- **Thuyết minh: clip giọng sinh ngoài phiên agent.** Trong GĐ7 `npm run gen:voice` bị từ chối quyền hai lần (cần mạng tới Edge TTS); 18 clip `swStops` có trong commit `028dede` (người dùng chạy ngoài phiên).
- **Thư mục ảnh tự xem** là `tests/screens/sunwheel-gd2/` … `sunwheel-gd7/` (prompt GĐ2: `tests/screens/sunwheel/`).
- **Test mục 11 của prompt** có đủ, mở rộng thêm (mục 8); GĐ4 (LED) không thêm kiểm tra tự động vào `sunwheel-check.mjs` (chỉ ảnh tự xem + `test:drawcalls` ở kiểu trắng mặc định).
- **Prompt mục 1.1:** ảnh còn thiếu (cận cabin, video LED, ảnh trong cabin, tài liệu kỹ thuật) — thiếu thì dựng bằng số ước lượng, hướng mặt vòng quay đã có số đo của người dùng nên không phải đoán.
- **Báo cáo mục 13 của prompt** (draw call trước/sau từng góc, số ước lượng, test nguyên văn): nằm ở `tests/KET-QUA.md` và plan; chưa có FPS thật.

Câu trả lời của người dùng (prompt mục 12b, 2026-10-22), đều đã theo:
1. Hiện trạng: **đang hoạt động**, kèm ghi chú nguồn báo đã ngừng từ 9/2025 (mục 1, 5, 6).
2. Phạm vi: **vòng quay + bệ + nhà ga**, không dựng Asia Park (mục 2).
3. Tương tác: **cả bốn** — ngồi cabin, tốc độ thật/tua nhanh, show LED, Tour + thuyết minh (mục 4, 5).
4. Draw call góc cũ: **≤ +2** (mục 6).
5. Tọa độ và hướng: 16,040525; 108,228459, phương vị 83°/263° (mục 3).

Còn chờ theo 12b (không chặn, đang dùng ước lượng): khoảng cách tâm → mép nước sông Hàn (đo vuông góc bờ trên Google Maps) để chốt `x`; khoảng cách tâm → tim Cầu Trần Thị Lý để kiểm `z` (cảnh đặt Trần Thị Lý ở z = +1 300); đường kính hoặc chiều cao trục nếu có nguồn; ảnh cận cabin ban ngày, video show LED, ảnh trong cabin (mục 9).

## 8. Kiểm tra
- `tests/sunwheel-check.mjs` (`npm run test:sunwheel`), mở rộng theo giai đoạn (mục 11 của prompt):
  - GĐ1: tâm (−440; 2 280), hướng mặt phẳng 83°, kích thước dẫn xuất, đỉnh 115 m, dọn nền 0 nhà / 0 cây ngoài nền, console sạch.
  - GĐ2: chỉ `sw-static`, `sw-wheel` ngoài `details`/`life`; 64 instance, nghiêng ≤ 2°, đỉnh cabin 115 ± 1 m, không chạm hành lang Hầm, mesh lớp 1 + không đổ bóng, cabin/biển trong `details`; draw call do vòng quay (4 góc cũ ≤ 2, 3 camera gần ≤ 6, ngày = đêm).
  - GĐ3: chu kỳ ×1/×10/×60 (sai ≤ 1 %; ×1 90 s ≈ 2π/10), đổi tốc độ mượt + dừng không trôi, cabin nghiêng ≤ 2° ở 5 góc, bám vòng/bám điểm vành, đỉnh 115 ± 1 m ở mọi góc, không vào hành lang Hầm, ma trận cabin bám góc khi gần / quay tiếp khi xa / đúng ngay khi quay lại gần (ngưỡng `SYNC_TOL` 1e-4 m), draw call 6 góc `sw*` × ngày/đêm × tốc độ 0/60 (≤ 6, ngày = đêm), nút góc nhìn, nhóm `sw`, ô tốc độ, ghi chú hiện trạng, 9 locale đủ khóa.
  - GĐ5: lên cabin bằng nút (mode, OrbitControls tắt, nút/hint, chặng bay vào, cabin lên là cabin ở đáy), camera = tâm cabin + `eyeUp` sai < 1 mm ở 24 góc + đỉnh/đáy, cao ≈ 115 m ở đỉnh, ×60 vẫn đúng cabin, hướng mặc định về Bắc, kéo chuột đổi yaw/pitch không dời camera và kẹp `pitchMax`, draw call khi ngồi (≤ 6, ngày = đêm) + kiểm riêng ngẩng hết cỡ, xuống bằng Esc / bấm lại nút (camera, target, `maxPolarAngle` về đúng), đổi góc nhìn, Tour rồi Esc, Esc khi không ngồi không đổi gì.
  - GĐ6: `now` không dừng/không lắc; bão → `wheelStopped`; dừng đúng `stopSec` từ ×60 và ×1; cabin lắc (nghiêng trong (2°; `maxTilt`], đáy xuôi gió, đổi theo thời gian, không thêm mesh); draw call trong bão = `now` (bỏ mẫu có tia chớp); ba vật liệu có nhánh `weather`; ngồi cabin khi bão (đứng yên, camera lệch mắt < 1 mm, camera nghiêng, thông báo hiện/ẩn); hết bão quay lại tốc độ cũ + cabin thẳng.
  - GĐ7: cờ + `minSec`, chú thích 6 điểm, camera bám mắt cabin < 1 mm, lên đỉnh < `climbSec` và ở đỉnh ± 0,1 m, tốc độ về `topSpeed`, nhìn Bắc, draw call ở cabin trong Tour ngày = đêm ≤ 6, điểm 6 đêm + show, hết Tour trả trạng thái, Esc giữa Tour, tua thẳng tới điểm 5, đổi góc nhìn giữa Tour; `swStops` 6 cặp ở 9 locale, điểm 3 có "2025".
  - GĐ8 (mục 8 trong file): mọi góc `sw*` có trong `VIEWS` của `drawcalls.mjs` và có dòng `| swX |` trong `tests/KET-QUA.md`; README có `sun-wheel/`. Lưu ý: test đọc `tests/KET-QUA.md` và `README.md`, nên đổi hai file đó có thể làm `test:sunwheel` lỗi.
  - Kết quả gần nhất: đạt (bộ test giao diện điện thoại 2026-10-27, `tests/KET-QUA.md`); bản đầy đủ gồm mục 8 chạy tay đạt 2026-10-24.
- `tests/drawcalls.mjs`: `VIEWS` có `swOverview, swFront, swBase, swFromTTL, swNight, swTop` (GĐ3), `swRide` (GĐ5, đặt `blend = 1`), `swTour` (GĐ7, tua tới điểm 5). Lần gần nhất 72/74 khớp chênh 0 (2026-10-27); hai dòng lệch là `swTour` (ngày 187 vs 188, đêm 209 vs 207 — dao động đã biết khi camera leo cabin, D-018; thăm dò 4 lần trung vị 209/209/209/208, từng khung 200–223).
- `tests/tour-check.mjs`: `sw` 6 điểm, đường bay mở, raycast đường bay Catmull-Rom (điểm 4–5 đặt trên không phía Nam, z ≥ 60 m), camera thấp nhất 3 m, hết hành trình → orbit. Đạt (2026-10-24, 2026-10-27).
- `tests/voice-check.mjs`: `sw` 6 điểm × vi/en/ru. Đạt (2026-10-24, 2026-10-27).
- `test:weather`: không có kiểm tra riêng cho Vòng quay (phần bão nằm trong `test:sunwheel`); đạt ở các lần chạy đủ bộ.
- `test:perf -- --strict` (sau merge, D-018): "Bay tới Vòng quay lần đầu" +4 176 ms / +4 program → +2 ms / 0.
- Script ảnh tự xem (không commit ảnh): `tests/sunwheel-gd2-shots.mjs` … `tests/sunwheel-gd7-shots.mjs` → `tests/screens/sunwheel-gd{2..7}/`; danh sách ảnh đã xem ghi trong plan. GĐ8 không có bước nhìn kết quả.
- Chênh đêm − ngày ≈ 21 ở `swNight/swTop/swRide/swTour`: đo riêng (ẩn nhóm vòng quay) vẫn 21 (`swOverview` 164/185, `swTop` 115/136, `swRide` 280/301); vật chỉ vẽ ban đêm `rf-night-lights` ×1, `ttl-life` ×2 và 2 mesh không tên (chưa xác định). Mức này có ở góc cũ (`ttlBase`, `ttlDeck`, `tpWater` +21; `overview` +24).
- Chưa có bằng chứng: FPS GPU thật, giọng đọc nghe thật, cột "bản gốc" (`test:drawcalls -- tests/original`) cho góc cũ.

## 9. Còn mở
- (a) Sửa `tests/drawcalls.mjs` để trả ban ngày sau `rfHearts` (đặt lại `setNight(page, night)` sau khi đo), rồi đo lại bảng: cột "ngày" của `rfBank`, `wxRiverMouth`, `wxTtlStays`, `wxStreet`, `swOverview`, `swFront`, `swBase`, `swFromTTL` thực ra đo ban đêm; cập nhật `tests/KET-QUA.md` và `chuan-truoc-sunwheel.txt`.
- (b) Chạy `test:drawcalls` một mình tại `main` (lần `-Resume` cuối bị TimeoutError do máy quá tải) và `test:drawcalls -- tests/original` cho các góc cũ (góc `sw*` không có trong bản gốc).
- (c) Chốt số ước lượng: `x ≈ −440`, D ≈ 93 m, trục ≈ 64 m, bệ ≈ 13 m — cần đo khoảng cách tâm → mép nước, khoảng cách tâm → tim Cầu Trần Thị Lý; đường kính thật, ảnh cận cabin, video show LED, ảnh trong cabin.
- (d) Nghe thử giọng đọc `swStops`, chạy `/code-review`, đo FPS GPU thật.
- (e) Khác ảnh tham chiếu: giá treo cabin (+1 draw call nếu làm), lầu hai đầu bệ rỗng, đèn rọi trời (mesh nón, không `SpotLight`).
- Chưa sửa preset `swFront`: camera (y 8) thấp hơn điểm nhìn (y 55) mà không có `maxPolar`, nên OrbitControls kẹp camera lên y ≈ 58,7 ở khung đầu; thêm `maxPolar` nếu muốn góc thấp như đã định.
- Bố cục: ở màn thấp (≈ 600 px) ô tốc độ/LED và nút "Ngồi cabin" sát hoặc bị bảng Thông số che một phần; `#swRideHint`, `#swStormNote` ở giữa trên che một góc ô chọn ngôn ngữ khi cửa sổ ≈ 960 px; chú thích Tour chồng bảng Thông số ở màn thấp (như Tour khác); câu `swRideHintTouch` trỏ tới nút nằm trong sheet Góc nhìn (giao diện điện thoại).
- Chưa có: âm thanh/rung cabin; điểm nhìn vòng quay trong kịch bản bão (`STORM_TOUR`); kiểm tra Vòng quay trong `test:weather`; kiểm tra tự động cho 5 kiểu show LED và nhịp tim đồng bộ (mới có ảnh `swNight-heart`); kiểm cảm giác kéo trên cảm ứng thật.
- Hình ảnh khó thấy: cabin lắc 9° và mặt ướt khó thấy ở cự ly xa; ở `swTop`/điểm 5 các cầu xa bị sương che, chỉ thấy rõ Trần Thị Lý (~1 km); nhìn dọc mặt vòng quay (Đông/Tây) từ cabin bị cabin bên cạnh (cách ≈ 4,8 m) che gần hết khung — đúng hình học.
- Ô chọn thời tiết vẫn hiện "Hiện trạng" khi preset đặt qua API (chung với thời tiết).
