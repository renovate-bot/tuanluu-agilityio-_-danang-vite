# Cầu Trần Thị Lý — Thiết kế
_2026-10-21 · Trạng thái: Đã xây (merge b500bb5) · Prompt gốc: prompts/cau-tran-thi-ly.md tại c418f92_

Đọc lại bản prompt cũ: `git show c418f92:prompts/cau-tran-thi-ly.md`. Tài liệu này mô tả cái ĐÃ XÂY, đối chiếu với `src/bridges/tran-thi-ly/` và `CONFIG.tranThiLy` trong `src/config.ts`.

## 1. Mục đích và lý do
- Mô hình 3D Cầu Trần Thị Lý: cầu dây văng BTCT một tháp nghiêng, hệ dây 3 mặt phẳng, ý tưởng kiến trúc "cánh buồm căng gió" trên sông Hàn.
- Thêm vào CÙNG cảnh với Cầu Rồng và Cầu Thuận Phước; hai cầu cũ giữ nguyên hành vi và hiệu năng.
- Prompt: điểm nhận diện số 1 là hệ dây văng 3 mặt phẳng (một mặt trước nửa rẻ quạt ở tim cầu, hai mặt sau "rẻ quạt xoắn" gần mặt hyperbolic paraboloid). Ưu tiên độ chính xác ở đây hơn mọi chi tiết khác.
- Bản HTML gốc (`tests/original/index.html`) đã có cầu này; bản Vite chuyển sang lớp `TranThiLyBridge` (D-006). Bản HTML là chuẩn hồi quy draw call (D-003).

## 2. Phạm vi: có / không có
Có:
- Tháp BTCT đơn nghiêng 12° về phía Tây, tiết diện thay đổi dọc thân, khối đế, hai gối cầu cầu, đèn báo hàng không (`pylon.ts`).
- Hệ dây văng 54 dây: 18 dây mặt trước + 2 × 18 dây mặt sau xoắn, ống HDPE, hộp neo trên tháp và dầm (`stays.ts`).
- Dầm hộp BTCT 34,5 m, 6 làn, dải phân cách 5,5 m, lề, lan can, cột đèn, dải LED (`deck.ts`).
- 12 nhịp: 3 nhịp sau tháp, nhịp dây văng 230 m, 3 nhịp dẫn Tây, 5 nhịp dẫn Đông; trụ thân rộng, mố, đường đắp (`approaches.ts`).
- Cầu Nguyễn Văn Trỗi cũ (dàn thép thấp, đi bộ), mức chi tiết thấp, bật/tắt được (`nvt.ts`).
- Xe 6 làn, hai thuyền du lịch, 80 người đi bộ (`life.ts`).
- LED đổi màu trên tháp, dây và mặt cầu, ba mẫu chọn được; bốn góc nhìn, Tour 7 điểm; giao diện 9 ngôn ngữ; thuyết minh vi/en/ru.

Không có (xem mục 7, 9):
- Nút giao nhiều tầng và hầm chui ở đầu Tây (prompt: chỉ cần đường dẫn đổ xuống mặt đất, không dựng hầm).
- Ảnh tham chiếu thật để chỉnh tiết diện tháp.

## 3. Thông số đã dùng
Mọi số nằm trong `tranThiLyBase` (`src/config.ts`), xuất ra `CONFIG.tranThiLy` (hàm `deriveTtl` tính thêm). Mét. Tọa độ cục bộ: x = 0 ở tim sông, tháp ở `pylonX`; group dời tới `z`.

| Thông số | Giá trị | Nguồn | Khóa |
|---|---|---|---|
| Vị trí Bắc–Nam | z = +1.300 m (phía Nam, thượng lưu Cầu Rồng ~1,3 km) | prompt: 1–2 km | `z` (lấy từ `CONFIG.ttl.z`) |
| Tổng chiều dài | 731 m, 12 nhịp | prompt (số thật) | `totalLength`, `spanCount` |
| Nhịp dây văng chính | 230 m, phía Đông của tháp | prompt (số thật) | `mainSpan` |
| Tim chân tháp | x = −130 m (gần bờ Tây, nhịp chính vượt sông về phía Đông) | (ước lượng) | `pylonX` |
| Nhịp sau tháp | 3 × 40 m, nơi neo dây xoắn | (ước lượng) | `backSpans` |
| Nhịp dẫn Tây | 49 + 38,5 + 38,5 m; mố Tây x = −376 m | (ước lượng) | `westSpans`, `westEnd` |
| Nhịp dẫn Đông | 51 + 51 + 51 + 46 + 56 m; mố Đông x = +355 m; cuối nhịp dây văng x = +100 m | (ước lượng) | `eastSpans`, `eastEnd`, `mainEnd` |
| Chia nhịp tổng | 3 + 3 + 1 + 5 = 12 nhịp, tổng 731 m | prompt: 12 nhịp; cách chia (ước lượng hợp lý, theo yêu cầu prompt) | — |
| Bề rộng mặt cầu | 34,5 m | prompt (số thật) | `deckWidth` |
| Dải phân cách giữa | 5,5 m (mang tháp và neo dây trước) | prompt (số thật) | `median` |
| Làn xe | 3,75 m, 3 làn mỗi chiều = 6 làn | prompt: 6 làn; 3,75 m (ước lượng) | `laneWidth`, `lanesPerDir` |
| Lề bộ hành (gồm lan can) | 3,25 m mỗi bên = (34,5 − 5,5 − 6×3,75) / 2 | tính từ số thật | `sidewalk` |
| Dầm hộp BTCT | cao 2,6 m, cánh hẫng, sườn vát | (ước lượng) | `girderDepth` |
| Cao độ mặt đường | 2,6 m (nút giao Tây) → 12,6 m (chân tháp) → 13,2 m (giữa sông) → 2,6 m (bờ Đông) | (ước lượng) | `roadProfile` |
| Chiều cao tháp | 145 m thẳng đứng từ chân tháp (≈148,2 m dọc trục) | prompt (số thật) | `pylonHeight`, `axisLen` |
| Phần tháp nhô trên mặt cầu | 134 m (chân tháp thấp hơn mặt cầu ~11 m) | prompt (số thật); khóa chỉ để ghi lại, không có mã nào đọc | `pylonAboveDeck` |
| Độ nghiêng tháp | 12° về phía Tây, ngả ra xa nhịp chính | prompt (số thật) | `leanDeg`, `lean` |
| Cao độ chân tháp | 1,5 m, đặt trên 2 gối cầu | (ước lượng) | `pylonBaseY` |
| Tiết diện tháp (dọc cầu × ngang cầu) | chân 12 × 5,0 m → đỉnh 3,0 × 2,8 m; 64 vòng tiết diện; ngang cầu lọt dải phân cách 5,5 m | (ước lượng, dáng cánh buồm) | `pylonLen`, `pylonWid`, `pylonRings` |
| Gối cầu | 2 gối, bán kính 1,7 m (~250.000 kN mỗi gối ghi trong comment) | prompt (số thật); bán kính (ước lượng) | `bearingR` |
| Dây mặt trước | 18 dây, 1 mặt phẳng ở tim cầu, nửa rẻ quạt | prompt: 15–25 dây mỗi mặt (ước lượng từ ảnh) | `staysFront` |
| Dây mỗi mặt sau | 18 dây × 2 mặt, rẻ quạt xoắn | như trên | `staysBack` |
| Đoạn thân tháp có neo | từ 0,5 đến 0,96 chiều dài trục | (ước lượng) | `anchorT` |
| Neo dầm dây trước | cách tim tháp 24 → 226 m | (ước lượng) | `frontDeck` |
| Neo dầm dây sau | cách tim tháp 14 → 116 m, ở mép ngoài dầm z = ±17,7 m | (ước lượng) | `backDeck`, `backDeckZ` |
| Dây văng / ống HDPE | bán kính 0,10 m / 0,17 m, HDPE dài 4,0 m gần neo dầm | (ước lượng) | `stayR`, `hdpeR`, `hdpeLen` |
| Cột đèn | cách nhau 30 m (trừ ±18 m quanh tháp) | (ước lượng) | `lampSpacing` |
| Cầu Nguyễn Văn Trỗi cũ | z cục bộ −65 m (sát phía Bắc), mặt cầu 7,0 m, rộng 9 m, dàn cao 6 m, 8 nhịp qua sông | (ước lượng) | `nvtZ`, `nvtDeckY`, `nvtWidth`, `nvtTruss`, `nvtSpans` |
| LOD | ẩn chi tiết khi xa hơn 1.500 m; ẩn mặt đường, dải LED, cầu NVT khi xa hơn 2.600 m (mã `TranThiLyBridge.farDistance`, chưa vào `CONFIG`) | (ước lượng) | `lodDistance` |
| LED mặc định | mẫu 2 "sóng màu chạy dọc dây" | thiết kế | `ttlPattern` (`profile.ts`) |

Lưu ý độ tin cậy (giữ từ prompt): hình dạng tiết diện tháp chính xác không có trong số liệu; số dây mỗi mặt ước lượng từ ảnh; cách chia nhịp 731 m là ước lượng. `ttlNote` ghi cho người xem: "Tiết diện tháp và chia nhịp dẫn là ước lượng." Comment `profile.ts`: tiết diện tháp "sẽ chỉnh theo ảnh tham khảo" (chưa nhận ảnh, mục 9). Các số trong mã không có khóa `CONFIG`: số hộp neo (`BoxGeometry` 1,3 × 0,9 × 1,3 trên tháp, 1,1 × 0,9 × 1,1 trên dầm), khối đế 16×7 → 14,5×6,4 m, số người đi bộ 46 + 34, số xe/thuyền (mục 4).

## 4. Hình dạng, hành vi như đã xây
`TranThiLyBridge` (`TranThiLyBridge.ts`) kế thừa `BridgeBase` (D-006). Thứ tự dựng: `ttlBuildPylon`, `ttlBuildStays`, `ttlBuildDeck`, `ttlBuildApproaches`, `ttlBuildNvt`, `ttlBuildLife`. Dựng sau `buildCity()`/`buildTrees()` trong `main.ts`.

- `profile.ts`: `ttlRoadY(x)` cao độ mặt đường (Catmull-Rom centripetal qua `roadProfile`, tra bảng 4.000 điểm); `ttlPylonSection(t)` tiết diện tháp theo t ∈ [0, 1] (mép sau gần thẳng, mép trước cong căng như cánh buồm); `ttlPylonMatrix` = dựng thẳng rồi xoay quanh trục Z tại chân tháp một góc `lean` về phía Tây (đúng cách prompt mô tả); `ttlPylonPoint(t, lx, lz)` đổi điểm trên thân tháp sang tọa độ thế giới; `ttlPattern` = `{ value: 2 }`, uniform chung chọn mẫu LED.
- `pylon.ts`: tháp là một `loftRings` (64 vòng) áp `ttlPylonMatrix`, mesh `ttl-pylon`; khối đế nằm ngang trên hai gối (gộp vào bê tông), bệ móng trong sông; hai gối cầu gồm đế thép và chỏm cầu (gộp vào thép); hai đèn báo hàng không chớp (`blinkBeacon`, pha 0,4 s).
- `stays.ts`: `ttlStayList()` tính danh sách dây. Mặt trước: neo trên tháp từ trên xuống ↔ neo dầm xa dần (24 → 226 m) tại tim cầu. Hai mặt sau: neo cao nhất trên tháp ↔ neo GẦN tháp nhất ở mép ngoài dầm (z = ±17,7 m), neo thấp nhất ↔ xa nhất → dây giao chéo nhau, bề mặt gần paraboloid hyperbolic, đúng tham số hóa của prompt (`P_tower(i)` đi từ trên xuống, `P_deck(i)` đi từ gần ra xa). Dây là đoạn thẳng, một `InstancedMesh` hình trụ (54 dây) đặt bằng `segmentMatrix`; ống HDPE, hộp neo trên tháp và trên dầm là ba `InstancedMesh` trong `details`.
- `deck.ts`: dầm hộp `extrudeAlongX` (320 đoạn) gộp vào bê tông; mặt đường 6 làn hai dải (`roadStrip`, lớp `noReflect`, `farHide`); dải phân cách 5,5 m có thảm cỏ; lề, gờ, lan can, khe co giãn, cột đèn dùng helper chung `src/common/deck.ts`; cột đèn đặt trên dải phân cách (z = ±2,0); dải LED mép ngoài dầm và mép dải phân cách (`ledStrip`).
- `approaches.ts`: trụ thân rộng (gộp vào bê tông; trong sông có bệ móng, vệt nước bám qua shader `wet`), mố hai đầu, tường chắn và đường đắp (`fillBlock`). Trụ gộp thay vì `InstancedMesh` để ra 1 draw call.
- `nvt.ts`: nhóm `nvt-bridge`: mặt cầu đi bộ, trụ đôi mỗi pier, dàn thép kiểu Pratt (mỗi nhịp 8 khoang, hai bên), giằng ngang trên, lan can thấp hai thanh, dây bóng đèn dọc biên trên. `setNvtVisible(on)` đặt `userData.on` để LOD xa không bật nhầm.
- `materials.ts`: `bridgePatch` bảng màu `'sail'`, `originX = pylonX`, `pattern: ttlPattern`: tháp `led: 0.95, mode: 1, floodTop: 150, floodBase: 8`; dây văng `led: 2.6, mode: 0`; dải LED mặt cầu `led: 2.2`. Ba mẫu: 0 tĩnh, 1 chuyển màu chậm, 2 sóng màu chạy dọc dây (`#ttlPatternSel`, `setPattern`).
- `life.ts`: xe làn ngoài mỗi chiều (`seed: 731`, n = 30, tốc độ 9, 85 % xe máy) ở đây; hai làn trong dùng hệ xe chung của khu phố (`PATHS.ttl` trong `environment/traffic.ts`, từ bản gốc; `update()` ẩn theo nút bật/tắt); hai thuyền du lịch (24 m, 20 m); 46 người đi bộ trên lề cầu + 34 trên cầu NVT (`createPeople`, hệ chung `src/common/people.ts`, bộ sinh `rng(1965)`).
- `update(dt, elapsed, cam)`: `updateLod`, ẩn xe làn trong khi `lifeOn` tắt, `blinkBeacon`, người đi bộ khi `details` hiện, `stepTraffic`, `stepBoats`. `dispose()` thêm việc đánh dấu `PATHS.ttl.hidden = true`.

## 5. Tương tác, UI, i18n, thuyết minh
- Chọn cầu `data-bridge="ttl"`; `BRIDGE_HOME.ttl` = `ttlOverview`.
- Danh sách góc nhìn (`data-list="ttl"`): Tour tự động (`ttlTour`), `ttlOverview` "Toàn cảnh" (330, 120, z + 440), `ttlBase` "Dưới chân tháp nhìn lên" (−176; 15,2; z + 0,5, `maxPolar` π·0,97), `ttlDeck` "Trên mặt cầu" (70; 14,6; z + 9), `ttlBoth` "Cầu Rồng và Trần Thị Lý" (540, 300, −380), `wxTtlStays` "Dọc dây văng (thời tiết)"; ô chọn mẫu LED; nút `#btnTtlLife`, `#btnTtlPeople`, `#btnTtlNvt`.
- Tour 7 điểm `TTL_TOUR`; tên điểm (`ttlStops`): Cánh buồm trên sông Hàn, Tháp nghiêng 12°, Hai gối cầu khổng lồ, Từ bờ Đông, Mặt phẳng dây phía trước, Dây văng xoắn phía sau, Cầu Nguyễn Văn Trỗi cũ. Đường bay sắp để không xuyên mặt cầu hay thân tháp (điểm 6 lệch tim cầu 6 m). Tour 4 cầu (`ALL_TOUR`) bắt đầu từ ba điểm của cầu này.
- Bảng Thông số: 731 m, 34,5 m, "Nhịp dây văng chính" 230 m, `ttlNote` (khóa `ttlLengthVal`, `ttlWidthVal`, `ttlSpan`, `ttlSpanVal`, `ttlNote`).
- i18n đủ 9 ngôn ngữ (đã kiểm `ttlStops`, `ttlNote`, `patWave` có trong cả 9 locale); `ar` RTL.
- Thuyết minh Tour: vi và en (`7c60d82`), ru (`0a0b6be`), `public/voice/<lang>/ttlStops-0…6.mp3` (D-005). ko, ja, zh, th, ar, hi chưa có.

## 6. Ràng buộc đã tuân thủ
- **`rand()` có seed (D-002).** Không file nào trong `src/bridges/tran-thi-ly/` gọi `rand()`; người đi bộ dùng `rng(1965)`, xe `seed: 731`. Cầu dựng sau `buildCity()`/`buildTrees()` nên không đổi vị trí nhà/cây.
- **Draw call.** Bảng `now` 2026-10-24 (`tests/KET-QUA.md`), ngày / đêm: `ttlOverview` 239 / 261, `ttlBase` 130 / 151, `ttlDeck` 147 / 168, `ttlBoth` 247 / 269. Chuẩn hồi quy là bản gốc: 36/36 lần đo chênh 0 (2026-10-20). Cách giảm: trụ, mố, đế, dầm gộp vào một mesh bê tông (`finalize()`); dây văng, HDPE, hộp neo, đèn báo `InstancedMesh`; cột đèn, lan can dùng helper chung; hộp neo/HDPE/cầu NVT dưới LOD; lớp 1 cho mặt đường, chi tiết, xe.
- **Đèn.** Ban đêm bằng emissive qua `bridgePatch` và `shared.uNight`; không `PointLight`/`SpotLight` mới (bất biến 5). Bloom dùng sẵn của cảnh.
- **Texture** vẽ bằng canvas (`makeLaneTexture(3)`), không ảnh ngoài.
- **Bóng đổ.** Tháp, dây văng có `castShadow`; cầu NVT có.
- Công trình đã xây thật, không cần ghi "phương án đề xuất".

## 7. Khác so với ý định ban đầu
- Prompt: module `src/bridges/tranThiLy/` gồm `TranThiLyBridge.js`, `config.js`, `pylon.js`, `stayCables.js`, `deck.js`, `approaches.js`, `lighting.js`, `materials.js`. Đã xây: TypeScript trong `src/bridges/tran-thi-ly/` (`TranThiLyBridge.ts`, `pylon.ts`, `stays.ts`, `deck.ts`, `approaches.ts`, `materials.ts`, thêm `profile.ts`, `life.ts`, `nvt.ts`). Không có `lighting.js`/`config.js` (LED trong `materials.ts`, thông số ở `CONFIG.tranThiLy`). Lý do: D-006 và bất biến 3.
- Prompt: đề xuất tách phần dùng chung giữa hai cầu cũ vào `bridges/common/` (hỏi trước khi refactor). Đã xây: `src/common/` (`BridgeBase`, `deck`, `geometry`, `traffic`, `boats`, `people`, `shaders`, `textures`). Câu trả lời của người dùng không còn bản ghi trong repo (chưa đối chiếu).
- Prompt: "chụp 3 góc (từ trên xuống, ngang từ bờ sông, dọc trục cầu) và tự kiểm tra hiệu ứng dây xoắn". Đã xây: các góc `ttlBase`, `ttlDeck`, `ttlBoth` và hai điểm Tour 5–6 (mặt phẳng dây trước, dây xoắn sau). Ảnh tự kiểm của bước này không còn trong repo (chưa đối chiếu).
- Prompt: dây văng "ống bảo vệ HDPE màu sáng ở đoạn gần neo dầm". Đã xây: đúng, nằm trong `details` (ẩn khi xa).
- Prompt: nút giao nhiều tầng với hầm chui ở đầu Tây, mô phỏng đơn giản đường dẫn đổ xuống mặt đất. Đã xây: chỉ `roadProfile` hạ về 2,6 m ở x = −470 và mố/đường đắp; không có nút giao nhiều tầng, không có hầm chui.
- Prompt: "người đi bộ mức chi tiết thấp, tùy chọn". Đã xây: 80 người (46 trên lề cầu + 34 trên cầu NVT), nút `#btnTtlPeople`.
- Prompt: thuyền du lịch "nối lộ trình với Cầu Rồng". Đã xây: hai thuyền riêng của cầu, chạy trong khoảng z −1.450 … 400 (`stepBoats(…, -1450, 400)` trong `update()`), tức đến gần Cầu Rồng.
- Prompt: mẫu LED "tĩnh / chuyển màu chậm / sóng màu chạy dọc dây". Đã xây: đúng ba mẫu, mặc định mẫu 2.
- Prompt: "Tháp ... nếu có khe hở/tách nhánh, mô phỏng theo ảnh". Đã xây: tháp một khối liền; không có khe, vì chưa có ảnh.
- Prompt: "mặt cầu hơi vồng dọc". Đã xây: `roadProfile` vồng lên 13,2 m ở giữa sông.
- Thay đổi do tính năng sau:
  - Thời tiết: vật liệu `weather: true`; bê tông có `wet: true`; đường `registerWet` (`5f780b4`); dây văng `sway: 'ttl'` rung mưa–gió (`e3906e7`, `CONFIG.weather.wind.ttl`: rung cực đại 0,05 m khi gió 6–18 m/s kèm mưa, `dryAmp`, `buffet` 0,1 m cho gió giật); dây dựng bằng hình trụ `cableSegs` = 8 đoạn (`8c7ef9e`, lỗi dây không lắc từ GĐ4 do hình trụ 1 đoạn); xe, người, thuyền ẩn khi bão đóng cầu (`closable`, D-012, `1b39173`); ô riêng trong bảng "Ảnh hưởng tới cầu" (số đo ở bão: gió tại mặt cầu 28,9 m/s); thêm góc nhìn `wxTtlStays` (cùng khung với `ttlDeck`).
  - Tối ưu độ mượt (D-018, `134d5c8`): commit chung; không sửa file trong `tran-thi-ly/`.
  - Tour 4 cầu (D-015): `ALL_TOUR` mở đầu bằng Trần Thị Lý (toàn cảnh, tháp nghiêng, nhìn lại từ phía Bắc); đường bay vượt cầu ở x ≈ 140.
  - Vòng quay Mặt Trời: góc `swFromTTL` đặt camera trên cầu nhìn về Nam; `ttlBoth` tăng 2 draw call vì thấy vòng quay.
- Chưa làm (yêu cầu prompt không có trong mã): nút giao nhiều tầng và hầm chui; ảnh tham chiếu thật; tự kiểm 3 góc có lưu ảnh.

## 8. Kiểm tra
- `tests/drawcalls.mjs`: bốn góc `ttlOverview`, `ttlBase`, `ttlDeck`, `ttlBoth` + `wxTtlStays`, ngày/đêm. 36/36 chênh 0 so với bản gốc (2026-10-20). Từ đó chỉ có cột `bản Vite` (bảng 2026-10-24).
- `tests/tour-check.mjs`: `ttl` 7 điểm dừng, đạt (log GĐ8 Vòng quay 2026-10-24; 8/8 tour đạt 2026-10-27).
- `tests/voice-check.mjs`: `ttlStops` vi + en + ru, đạt (2026-10-27); bài thử bật/tắt giọng dùng Tour `ttl`.
- `tests/weather-check.mjs`: dây lắc đổi > 200 px ở mốc 4 kịch bản bão, đạt (2026-10-27).
- Chưa có test riêng cho hình học tháp/dây xoắn, cầu NVT, mẫu LED.

## 9. Còn mở
- Ảnh tham chiếu để chỉnh tiết diện tháp ("cánh buồm"), vị trí `pylonX`, chia nhịp dẫn, cao độ `roadProfile`.
- Nút giao nhiều tầng/hầm chui đầu Tây (nếu muốn).
- Đưa `farDistance` 2.600 m, kích thước hộp neo, khối đế vào `CONFIG`; `pylonAboveDeck` chưa có mã đọc.
- Chạy `npm run test:drawcalls -- tests/original` để biết vì sao bảng 2026-10-24 cao hơn bảng 2026-10-20.
- Thuyết minh ko, ja, zh, th, ar, hi.
