| exHigh | 259 | 1710,8 | 287 | 561,4 | 2/2 || exTp | 137 | 567,2 | 159 | 285,1 | 2/2 || exDragon | 292 | 1452,4 | 314 | 559,4 | 2/2 || exTakeoff | 247 | 1245,0 | 266 | 631,8 | 2/2 |# Kết quả kiểm tra (cập nhật 2026-10-24, nhánh `feature/sun-wheel` GĐ8; bảng `now` bên dưới là của lần chạy GĐ8 Vòng quay)

Chromium + SwiftShader, khung 480×270. Draw call = renderer.info.render.calls (gồm bóng đổ, phản chiếu nước, bloom), trung vị 5 khung hình.

Khung test mặc định 480×270 khớp `(max-height: 500px)` nên cả bộ test chạy ở chế độ gọn (không blur): draw call không đổi; số hitch của `test:perf` không so sát được với mốc D-018 (đo khi còn blur).

## Xe cộ thực tế hơn (2026-11-10, nhánh `feature/xe-co-thuc-te`, D-027)

Các hệ xe (khu phố, Cầu Rồng, Thuận Phước, Trần Thị Lý, Cầu sông Hàn, Bạch Đằng) mỗi hệ một `InstancedMesh` (thay 4 khối hộp mỗi hệ). **Chưa đo** draw call (`test:drawcalls`), `test:perf --strict`, so hiệu năng với `main` (spec: thời gian traffic/render lệch ≤ 15 %) và FPS GPU thật, theo yêu cầu người dùng duyệt trên demo. Số đỉnh hình học gộp (cho mỗi instance): siêu xe 628, buýt 496, xe tay ga 636, **gộp 1 760** (≤ `CONFIG.vehicles.maxVerts` 2 000).

| Lệnh | Kết quả |
|---|---|
| `typecheck`, `build` | đạt |
| `test:traffic:unit` | 11/11 đạt |
| `test:boats:unit` | 17/17 đạt |
| `test:traffic` (bản cuối `616141a`) | 17/17 ĐẠT: tên 5 hệ xe, vật liệu `vehicleFleet`, không còn khối hộp cũ; số xe 536 / 52 / 348 khớp; chuỗi `rand()` giữ nguyên (7 tốc độ tàu trùng `main`: 4.834, 3.462, 3.368, 4.562, 4.303, 3.223, 4.648); depth patch; đèn bật theo `uNight`; cutaway 4 mặt cắt; xe chạy; tắt làn 104 xe scale 0 rồi bật lại; bão dọn 200 xe Cầu Rồng, Bạch Đằng vẫn chạy 124/124; không lỗi console |
| `test:drawcalls`, `test:perf --strict`, `test:tour`, `test:voice`, `test:tunnel`, `test:riverfront`, `test:weather`, `test:sunwheel`, `test:mobile`, `test:explore`, `test:citynight` (mốc ngày sẽ đổi vì xe đổi dáng), `test:boats`, `test:multi*` | **chưa chạy** (theo yêu cầu người dùng) |

Chưa kiểm trong trình duyệt: hàng xe xếp trước barie Cầu sông Hàn (chỉ có unit test buýt dài ≤ 7,5 m); vị trí nhà/cây so với `main` (bằng chứng gián tiếp là tốc độ tàu).

## Tàu thuyền sông Hàn (2026-11-10, nhánh `feature/tau-thuyen-song-han`, D-026)

Mỗi đội tàu một `InstancedMesh` (thay 3 khối hộp). Draw call đo tại Task 3 (commit `9ae6c2a`, trước đèn đêm + cụm tàu tụ tập) so với `main` `43cec90` cùng máy (`node tests/drawcalls.mjs ../danang-dist-main`): **74/74 góc giảm 10–20, không góc nào tăng**. Cụm tàu tụ tập (Task 4) nằm trong đội tàu chung nên không thêm mesh; **chưa đo lại bản cuối** (lần chạy đủ bộ bị treo > 3,5 h do tranh CPU, người dùng chọn duyệt trên demo thay vì chạy lại).

| Lệnh (bản cuối `566676f`) | Kết quả |
|---|---|
| `test:boats:unit` | 17/17 đạt |
| `test:boats` | 18/18 đạt (crowdRamp 145/154 khung so le; ledBright vệt 19 px) |
| `test:citynight -- --no-shots` (tại `63c3976`, trước sửa review) | đạt: warmDominant 88,1 %, dayDiff 1,30/255 — không cần chụp lại mốc |
| `test:drawcalls` (bản cuối), `test:perf --strict`, `test:tour`, `test:voice`, `test:tunnel`, `test:riverfront`, `test:weather`, `test:sunwheel`, `test:mobile`, `test:explore` | **chưa chạy** (theo yêu cầu người dùng) |

| Góc | ngày main | ngày mới | chênh | đêm main | đêm mới | chênh |
|---|---|---|---|---|---|---|
| overview | 282 | 272 | -10 | 306 | 296 | -10 |
| head | 305 | 293 | -12 | 328 | 316 | -12 |
| tail | 236 | 224 | -12 | 264 | 252 | -12 |
| drive | 216 | 204 | -12 | 244 | 232 | -12 |
| bird | 269 | 257 | -12 | 299 | 287 | -12 |
| walk | 216 | 204 | -12 | 243 | 231 | -12 |
| tpBay | 276 | 266 | -10 | 297 | 287 | -10 |
| tpWater | 117 | 107 | -10 | 138 | 128 | -10 |
| tpDrive | 125 | 115 | -10 | 145 | 135 | -10 |
| tpBoth | 282 | 272 | -10 | 315 | 305 | -10 |
| ttlOverview | 239 | 229 | -10 | 261 | 251 | -10 |
| ttlBase | 130 | 120 | -10 | 151 | 141 | -10 |
| ttlDeck | 147 | 137 | -10 | 168 | 158 | -10 |
| ttlBoth | 247 | 235 | -12 | 269 | 257 | -12 |
| shOverview | 282 | 262 | -20 | 331 | 311 | -20 |
| shTop | 213 | 193 | -20 | 260 | 240 | -20 |
| shBank | 235 | 219 | -16 | 282 | 266 | -16 |
| shDeck | 206 | 190 | -16 | 253 | 237 | -16 |
| hrOverview | 277 | 257 | -20 | 307 | 287 | -20 |
| hrCutaway | 358 | 338 | -20 | 390 | 370 | -20 |
| hrPortalW | 163 | 147 | -16 | 190 | 174 | -16 |
| hrPortalE | 205 | 189 | -16 | 229 | 213 | -16 |
| hrDrive | 210 | 194 | -16 | 234 | 218 | -16 |
| hrGallery | 169 | 155 | -14 | 200 | 186 | -14 |
| rfHearts | 278 | 258 | -20 | 277 | 257 | -20 |
| rfBank | 203 | 187 | -16 | 203 | 187 | -16 |
| wxRiverMouth | 283 | 273 | -10 | 283 | 273 | -10 |
| wxTtlStays | 168 | 158 | -10 | 168 | 158 | -10 |
| wxStreet | 286 | 270 | -16 | 286 | 270 | -16 |
| swOverview | 185 | 175 | -10 | 185 | 175 | -10 |
| swFront | 308 | 298 | -10 | 308 | 298 | -10 |
| swBase | 239 | 229 | -10 | 239 | 229 | -10 |
| swFromTTL | 133 | 123 | -10 | 133 | 123 | -10 |
| swNight | 281 | 271 | -10 | 302 | 292 | -10 |
| swTop | 119 | 109 | -10 | 140 | 130 | -10 |
| swRide | 283 | 273 | -10 | 304 | 294 | -10 |
| swTour | 187 | 174 | -13 | 209 | 198 | -11 |

## Dù lượn nhiều người (2026-11-10, nhánh `feature/du-luon-nhieu-nguoi`, D-024)

Chromium + SwiftShader, máy chủ `wrangler dev` cục bộ, bot là kết nối WebSocket giả. Draw call đo cùng tư thế camera, trung vị khung thật (`tests/multi-check.mjs`). Dù người khác ở layer 1, không phản chiếu nước (Ruling R6), mỗi dù 1 draw call.

| Tình huống | 0 người khác | Có người khác | Chênh | Ngưỡng spec |
|---|---|---|---|---|
| Đang bay, 4 người khác trong khung nhìn | 146 | 150 | +4 | ≤ +4 |
| Đang xem (phòng đủ 5 người bay) | 145 | 150 | +5 | ≤ +5 |
| Bay một mình (`?explore=glider`) | `exTakeoff` 247/266, `exDragon` 292/314, `exTp` 137/159, `exHigh` 259/287 (ngày/đêm) | — | +0 so với `main` | +0 |

| Lệnh (tại `9d7b1fb`, chạy một lần) | Kết quả |
|---|---|
| `npm run build` | đạt |
| `test:multi:unit` | 47/47 đạt |
| `test:multi:worker` | đạt (Origin lạ / thiếu Origin → 403) |
| `test:multi` | đạt, 68 kiểm tra; bot bay thẳng 15 m/s: bước nội suy mỗi 50 ms 0,73–0,76 m (chuẩn 0,75) |
| `test:explore`, `test:mobile`, `test:tour`, `test:tunnel`, `test:riverfront`, `test:voice`, `test:weather`, `test:sunwheel` | đạt |
| `test:citynight` | đạt (mốc `--baseline` chụp trên `main` 8bac32d) |
| `test:drawcalls` | 73/74 khớp bảng `now`, chênh 0; `swTour` đêm 208 vs 207 = dao động đã biết (D-018) |
| `test:perf -- --strict` | đạt |

Chưa đo: FPS GPU thật, hai máy thật qua Worker đã triển khai.

## Tự khám phá bằng dù lượn (2026-11-09, nhánh `feature/explore-du-luon`, D-020)

Bảng số đo là lần cuối (có cánh cờ, người treo, camera cao 9 m); bảng kết quả lệnh dưới đó đo tại `3985ce2`, sau đó chỉ chạy lại `test:explore` và `test:mobile` (đều đạt). Chromium + SwiftShader. Draw call là trung vị 5 khung thật của app (gồm bloom khi đêm). Phần dù = chênh khi bật/tắt `ex-glider`.

| Tư thế | Draw call ngày | ms ngày | Draw call đêm | ms đêm | Phần dù (ngày/đêm) |
|---|---|---|---|---|---|
| exTakeoff | 247 | 1808,7 | 266 | 924,2 | 2/2 |
| exDragon | 290 | 1572,3 | 312 | 1363,0 | 2/2 |
| exTp | 135 | 570,9 | 157 | 621,4 | 2/2 |
| exHigh | 256 | 1414,1 | 284 | 856,9 | 2/2 |

| Lệnh | Kết quả |
|---|---|
| `npm run build` | đạt |
| `npm run test:explore` | đạt |
| `npm run test:drawcalls` | 72/74 khớp bảng `now`, chênh 0; `swTour` ngày 187 vs 188, đêm 209 vs 207 = dao động đã biết (D-018) |
| `test:tour`, `test:tunnel`, `test:riverfront`, `test:voice`, `test:weather`, `test:sunwheel`, `test:mobile` | đạt (chạy hai lần trên cùng commit, cả hai đạt) |
| `npm run test:perf -- --strict` | exit 0 lúc 04:02; log của lần đó đã bị ghi đè nên không có số ms ở đây |

## Giao diện điện thoại (2026-10-27, nhánh `feature/mobile-ui`, D-019)

Chỉ đổi DOM/CSS/i18n, không đổi mã dựng cảnh. Chạy tuần tự từng lệnh trên cùng máy (log `tests/screens/mobile/t6-*.log`, không commit):

| Lệnh | Kết quả |
|---|---|
| `npm run build` | đạt |
| `npm run test:mobile` | đạt (dọc 390×844, ngang 844×390, máy tính 1280×800; 9 ngôn ngữ × 2 tờ: tờ hiện, không tràn ngang; `ar` RTL; console sạch) |
| `npm run test:drawcalls` | 72/74 khớp, chênh 0; `swTour` ngày 187 vs 188, đêm 209 vs 207 = dao động đã biết (D-018) |
| `npm run test:tour` | đạt (8/8 tour) |
| `npm run test:voice` | đạt (vi + en + ru, 6 tour, 47 điểm dừng + 8 mốc bão) |
| `npm run test:tunnel`, `test:riverfront`, `test:weather`, `test:sunwheel` | đạt |
| `npm run test:perf -- --strict` | đạt, 0 program mới; draw call overview Cao/TB/Thấp ngày 282/215/116, đêm 306/306/121; tự động hạ 2 bậc |

Đo giả lập điện thoại (`tests/screens/mobile/emulate.mjs`, tạm, không commit): Playwright `devices['iPhone 12']` (dpr 3), mở trang KHÔNG `?test` (bậc Tự động, `device.phone`), chờ `#loading.done`, đọc `#ftime`/`#fps` sau 20 s ở `overview` (góc nhìn mở đầu). Cả ba lần bậc hiển thị "Tự động · Thấp"; `body.compact` bật.

| Cấu hình | Tải xong | FPS | ms trung bình · p95 · max | Draw call | Canvas |
|---|---|---|---|---|---|
| Dọc 390×844, CPU ×4 | 9,6 s | 6 | 181 · 267 · 267 | 77 | 292×498 |
| Ngang 844×390, CPU ×4 | 80,0 s | 1 | 1016 · 1016 · 1016 | 117 | 562×255 |
| Dọc 390×844, không giảm tốc | 28,3 s | 1 | 869 · 869 · 869 | 77 | 390×664 |

Chưa đo máy thật; SwiftShader chỉ so tương đối. Các số ms ở trên dao động mạnh giữa ba lần (lần ngang/không giảm tốc chậm hơn lần dọc ×4 vì tải máy và mẫu quá ít: perf chỉ có 1–2 khung trong cửa sổ), nên KHÔNG dùng để kết luận FPS điện thoại. Ảnh từng trạng thái: `tests/screens/mobile/{P,L}-*.png`, `E-*.png`. Còn lại cho người dùng: đo trên điện thoại thật (FPS, safe-area tai thỏ/thanh home, cảm giác chạm hàng chip) và bản dịch 7 ngôn ngữ do người bản ngữ duyệt.

## Hiệu năng — tối ưu độ mượt (2026-10-25, nhánh `feature/perf`, D-018)

`npm run test:perf` (`tests/perf-check.mjs`), Chromium SwiftShader (CPU), khung 480×270. Số ms chỉ so tương đối trên cùng máy; chưa đo GPU thật.
GĐ0 = trước khi tối ưu (`tests/screens/perf/gd0.json`), sau = GĐ1–GĐ5 (`gd15.json`, chạy `--strict`: **đạt**).

| Thao tác | GĐ0: render chậm thêm / program mới | Sau tối ưu |
|---|---|---|
| Đêm lần đầu | +5 528 ms / +14 | +29 ms / 0 |
| Tắt bóng đổ | +11 607 ms / +68 | −2 ms / 0 |
| Bật bóng đổ | +2 909 ms / +4 | +11 ms / 0 |
| Bay tới Thuận Phước lần đầu | +4 606 ms / +7 | +0 ms / 0 |
| Bay tới Hầm lần đầu | +7 477 ms / +5 | +14 ms / 0 |
| Bật mặt cắt Hầm lần 1 | +12 577 ms / +22 | +5 ms / 0 |
| Bay tới Vòng quay lần đầu | +4 176 ms / +4 | +2 ms / 0 |
| Bật mưa | +3 699 ms / 0 | +3 ms / 0 |
| Đổi chất lượng Thấp / TB / Cao (đêm) | — | ≤ +4 ms / 0 |

- CPU mỗi khung (ngoài render, trung bình 30 khung): overview 1,55 → 0,85 ms; head 22,4 → 0,68 ms; swOverview 38,1 → 0,91 ms (GĐ0 có khung GC lớn); tpBay 1,21 → 15,3 ms ở lần đo này (một khung đột biến trong `traffic`, lần đo GĐ1–2 là 0,73 ms — chưa giải thích, xem memory bank).
- Khung hình đầu (SwiftShader): 3,3 s → 16,4 s, vì prewarm biên dịch và vẽ trước toàn bộ cảnh trong lúc màn hình chờ còn hiện; program sau khởi động 81 → 157.
- Bậc chất lượng, draw call ở overview (tối đa 6 khung): ngày Cao 282 / Trung bình 215 / Thấp 116; đêm 306 / 306 / 121. Tự động: khung giả lập 40 ms hạ ≥ 2 bậc, 5 ms nâng về bậc 0.
- Bundle: `three-*.js` 724 KB → 558 KB (gzip 187 → 144 KB) nhờ không đưa cả namespace THREE vào `__app`.
- `test:drawcalls` ở bậc Cao (?test): 73/74 phép đo khớp bảng `now` bên dưới; `swTour|đêm` 209 (bảng 207). Thăm dò 4 lần trên cùng bản build: trung vị 209, 209, 209, 208; từng khung 200–223 (camera đang leo cabin) — dao động của phép đo, không do tối ưu.
- Bộ test khác: `test:tunnel`, `test:riverfront`, `test:sunwheel`, `test:tour`, `test:voice` đạt; `test:weather` đạt khi chạy lại (lần đầu trùng lịch tự quay Cầu sông Hàn 23:00 thứ Bảy, `swingUI.ts`).

## Bộ test Vòng quay Mặt Trời GĐ8 (2026-10-24, nhánh `feature/sun-wheel`)

Log: `tests/screens/sunwheel-logs/gd8-l0-*.log` (không commit). Lần chạy này trước khi thêm mục 8 (kiểm tra tài liệu) vào `tests/sunwheel-check.mjs`; mục 8 mới chỉ kiểm `node --check` và `npm run build`, chưa chạy.

| Lệnh | Kết quả |
|---|---|
| `npm run build` | đạt (`tsc --noEmit` + `vite build`, 146 module) |
| `npm run test:sunwheel` | **chưa đủ bằng chứng**: log `gd8-l0-test-sunwheel.log` có mục 1–7 và in `sunwheel-check: đạt`, nhưng log chạy TRƯỚC khi thêm mục 8 (góc `sw*` trong `VIEWS` và `KET-QUA.md`, README). Mục 8 chưa được chạy. Chưa chạy lại (phiên sửa GĐ8 không được chạy test) |
| `npm run test:drawcalls` | đạt về lỗi console; 74 phép đo = 37 góc × ngày/đêm. Log chỉ có cột `bản Vite` (chạy không kèm `tests/original`). So với chuẩn trước Vòng quay (`tests/screens/chuan-truoc-sunwheel.txt`, 58 góc cũ): xem bảng dưới |
| `npm run test:tour` | đạt: dragon 8, tp 7, ttl 7, sh 6, hr 8, all 13, **sw 6**, storm 8 |
| `npm run test:voice` | đạt (vi + en + ru, 6 tour, 47 điểm dừng + 8 mốc kịch bản bão mỗi ngôn ngữ). Có clip `swStops` trong `public/voice/manifest.json` |
| `npm run test:riverfront` | đạt (204/7934 nhà ở trạng thái scale 0; bộ nhớ GPU 114,14 → 114,14) |
| `npm run test:weather` | đạt (`weather-check: đạt`) |
| `npm run test:tunnel` | **LỖI**: `page.goto` quá 180 s khi mở `?test` (`tests/lib.mjs:44`, `waitUntil: 'load'`), chưa có kết quả kiểm tra nào. Đã loại trừ: GĐ8 không đổi `src/` (chỉ tài liệu và test); cùng `openApp` đã chạy đạt `test:riverfront` lúc 08:31, sáu phút sau lỗi lúc 08:25. **Nguyên nhân gốc chưa chứng minh.** Ứng viên: sự kiện `load` chờ dựng cảnh chậm trên SwiftShader. Điều kiện sẵn sàng thật (`__app` và `#loading.done`, chờ 240 s) không đổi. Chưa đổi `tests/lib.mjs` vì không chạy được test để kiểm (harness dùng chung cho mọi test). **Cần chạy lại `npm run test:tunnel` riêng**; nếu lỗi lặp lại, thử `waitUntil: 'domcontentloaded'` và giữ nguyên điều kiện chờ thứ hai. |

### Chênh draw call so với chuẩn trước Vòng quay

Chuẩn: `tests/screens/chuan-truoc-sunwheel.txt` (đo trước GĐ1 của vòng quay). Ngân sách mục 9: góc cũ ≤ chuẩn +2.

- Mọi góc cũ (58 dòng, ngày và đêm): chênh **0 đến +2**, đạt ngân sách.
- Chênh +2 ở đúng sáu góc nhìn xa nhìn thấy vòng quay (ngày và đêm): `bird`, `tpBay`, `tpBoth`, `ttlBoth`, `shOverview`, `wxRiverMouth`. Góc khác (đặc biệt góc gần cầu và hầm) chênh 0.
- Góc `sw*` (ngày, đêm): `swOverview` 185, `swFront` 308, `swBase` 239, `swFromTTL` 133, `swNight` 281/302, `swTop` 119/140, `swRide` 283/304, `swTour` 188/207 (log `gd8-l0-test-drawcalls.log`).
- Phần vòng quay riêng (log `gd8-l0-test-sunwheel.log`, các dòng `draw call vòng quay` và `draw call ngồi cabin`): số ngày và đêm **bằng nhau** ở mọi góc đo (2 ở góc xa, 4 ở góc gần; 3 khi ngồi cabin). Vì vậy phần vòng quay chênh 0, đạt mục 9.
- **Chưa giải thích:** `swNight`, `swTop`, `swRide`, `swTour` có tổng cảnh đêm cao hơn ngày **19–21** draw call. Phần này không phải vòng quay (xem trên). Chênh ngày/đêm đã có sẵn trước vòng quay (chuẩn: `overview` 282/306, `shTop` 202/248), nên mục 9 chỉ áp cho phần vòng quay. Ứng viên từ mã, **chưa đo**: mesh chỉ hiện ban đêm (`rf-night-lights` ở `promenade.ts:116-119`, đèn xe `T.head/T.tail` ở `common/traffic.ts:72`, `vHead/vTail` ở `core/dayNight.ts:38`). Chưa tách được vì cần đo bật/tắt từng nhóm; phiên này không được chạy test.
- Chưa có bằng chứng so với bản gốc: cần `npm run test:drawcalls -- tests/original`.

Chưa có bằng chứng: FPS SwiftShader/GPU thật; giọng đọc nghe thật (headless chỉ kiểm file và thời lượng); ảnh GĐ8 (đặc tả mục 10 không có bước nhìn kết quả cho GĐ8, nên không chụp ảnh); số draw call từng preset thời tiết khi có vòng quay (chỉ ghi `now`).

## Bộ test Tour 4 cầu (2026-10-22, nhánh `feature/tour-4-cau`)

Log: `tests/screens/tour4-gd4-*.log` (không commit). Không thêm mesh nên draw call phải không đổi.

| Lệnh | Kết quả |
|---|---|
| `npm run typecheck`, `npm run build` | đạt |
| `npm run test:drawcalls` | đạt, 58/58 phép đo (ngày + đêm) khớp bảng `now` cũ, chênh 0. Lần chạy đầu bị treo 240 s ở một thao tác nhấp (log `tour4-gd4-drawcalls.log`); chạy lại riêng một mình thì đạt. Chạy không kèm `tests/original` nên chỉ có cột `bản Vite` |
| `npm run test:tour` | đạt: dragon 8, tp 7, ttl 7, sh 6, hr 8, **all 13** (camera thấp nhất 24 m, cầu sông Hàn tự quay ở điểm 8, hết hành trình → orbit), storm 8 |
| `npm run test:voice` | đạt (vi + en + ru, 5 tour, 41 điểm dừng + 8 mốc kịch bản bão mỗi ngôn ngữ) |
| `npm run test:tunnel`, `test:riverfront`, `test:weather` | đạt |

Chưa có bằng chứng: FPS SwiftShader/GPU thật của Tour 4 cầu; giọng đọc nghe thật; Tour 4 cầu ở ban đêm / khi có thời tiết khác `now`.

## Bộ test GĐ8 Thời tiết (2026-10-22)

Log đầy đủ: `tests/screens/weather-logs/gd8-l0-*.log`.

| Lệnh | Kết quả |
|---|---|
| `npm run build` | đạt (`tsc --noEmit` + `vite build`, 137 module) |
| `npm run test:drawcalls` | đạt, 58 góc nhìn (ngày + đêm) đo được ở trạng thái `now` (bảng dưới, bảng cũ trước khi có vòng quay) |
| `npm run test:tour` | đạt: dragon 8, tp 7, ttl 7, sh 6, hr 8 điểm dừng |
| `npm run test:tunnel` | đạt |
| `npm run test:riverfront` | đạt |
| `npm run test:voice` | đạt (vi + en + ru, 4 tour, 28 điểm dừng mỗi ngôn ngữ) |
| `npm run test:weather` | đạt (`weather-check: đạt`) |

Lưu ý về log `test:drawcalls` GD8 Thời tiết: lệnh chạy **không kèm** `tests/original`, nên log chỉ có cột `bản Vite`. Số 2026-10-20 ở bảng cũ thấp hơn 7 draw call so với log ở cùng góc `overview|ngày` (275 → 282) và `head|ngày` (298 → 305); chưa xác định nguyên nhân. Muốn có cột chênh: `npm run test:drawcalls -- tests/original`.

## Draw call bản Vite (trạng thái `now`, không có preset thời tiết, 2026-10-24)

Các góc cũ (`overview` … `shDeck`), `hr*`, `rf*`, `wx*` và `sw*` (lần chạy GĐ8 Vòng quay). Số cũ của `wx*` trước vòng quay: `wxRiverMouth` 281/281, `wxTtlStays` 168/168, `wxStreet` 286/286 (chênh +2 ở `wxRiverMouth` là do vòng quay, mục trên). Log không ghi số draw call theo từng preset thời tiết (`rain`, `storm`, …); các giới hạn ngân sách (rain ≤ now + 1, storm ≤ now + 2) được kiểm trong `test:weather`, và log chỉ ghi kết quả đạt.

| góc nhìn | ngày | đêm |
|---|---|---|
| overview | 282 | 306 |
| head | 305 | 328 |
| tail | 236 | 264 |
| drive | 216 | 244 |
| bird | 269 | 299 |
| walk | 216 | 243 |
| tpBay | 276 | 297 |
| tpWater | 117 | 138 |
| tpDrive | 125 | 145 |
| tpBoth | 282 | 315 |
| ttlOverview | 239 | 261 |
| ttlBase | 130 | 151 |
| ttlDeck | 147 | 168 |
| ttlBoth | 247 | 269 |
| shOverview | 282 | 331 |
| shTop | 213 | 260 |
| shBank | 235 | 282 |
| shDeck | 206 | 253 |
| hrOverview | 277 | 307 |
| hrCutaway | 358 | 390 |
| hrPortalW | 163 | 190 |
| hrPortalE | 205 | 229 |
| hrDrive | 210 | 234 |
| hrGallery | 169 | 200 |
| rfHearts | 278 | 277 |
| rfBank | 203 | 203 |
| wxRiverMouth | 283 | 283 |
| wxTtlStays | 168 | 168 |
| wxStreet | 286 | 286 |
| swOverview | 185 | 185 |
| swFront | 308 | 308 |
| swBase | 239 | 239 |
| swFromTTL | 133 | 133 |
| swNight | 281 | 302 |
| swTop | 119 | 140 |
| swRide | 283 | 304 |
| swTour | 188 | 207 |

`swRide` = ngồi cabin (đo sau khi camera vào cabin); `swTour` = Tour Vòng quay điểm 5 (ở đỉnh). Hai dòng này nằm trong `VIEWS` của `tests/drawcalls.mjs`.

**Lưu ý về cột "ngày" của 8 góc: `rfBank`, `wxRiverMouth`, `wxTtlStays`, `wxStreet`, `swOverview`, `swFront`, `swBase`, `swFromTTL`.** Số ở cột này được đo khi cảnh đang ở **ban đêm**, nên bằng cột "đêm". Nguyên nhân (đã kiểm trên mã): bấm nút `rfHearts` đặt `dayNight.target = 1` (`src/ui/setupUI.ts:67`), và `tests/drawcalls.mjs` chỉ trả lại ban ngày ở `swNight`, nên các góc đo sau `rfHearts` trong lượt "ngày" vẫn ở đêm cho tới `swNight`. Lỗi đo có từ bảng riverfront (`rfBank` 203/203), không phải do vòng quay. Số ban ngày thật thấp hơn khoảng 21: đo riêng `swOverview` ra **164** ngày / 185 đêm (`tests/screens/sunwheel-gd8/probe-night.log`).

**Chênh đêm − ngày khoảng 19–21 ở `swNight`, `swTop`, `swRide`, `swTour` không phải do vòng quay.** Cùng mức này có ở các góc cũ (`ttlBase`, `ttlDeck`, `tpWater` +21; `overview` +24). Đo riêng (ẩn nhóm vòng quay bằng `group.visible = false`, 3 góc `swOverview`, `swTop`, `swRide`): chênh vẫn là 21 (164/185, 115/136, 280/301). Vật chỉ được vẽ ban đêm ở cả ba góc: `rf-night-lights` ×1, `ttl-life` ×2 và 2 mesh không tên (chưa xác định); không vật nào thuộc vòng quay. Draw call do chính vòng quay (bật − ẩn nhóm): 4 ngày, 4 đêm ở `swOverview` và `swTop`; 3 và 3 ở `swRide` — ngày = đêm.

## Draw call: bản gốc vs bản Vite (2026-10-20, bảng cũ)

Giữ để đối chiếu; chưa đo lại cùng lần chạy với bản gốc.

```
┌─────────┬────────────────────┬─────────┬──────────┬───────┐
│ (index) │ góc nhìn           │ bản gốc │ bản Vite │ chênh │
├─────────┼────────────────────┼─────────┼──────────┼───────┤
│ 0       │ 'overview|ngày'    │ 275     │ 275      │ 0     │
│ 1       │ 'head|ngày'        │ 298     │ 298      │ 0     │
│ 2       │ 'tail|ngày'        │ 231     │ 231      │ 0     │
│ 3       │ 'drive|ngày'       │ 212     │ 212      │ 0     │
│ 4       │ 'bird|ngày'        │ 260     │ 260      │ 0     │
│ 5       │ 'walk|ngày'        │ 211     │ 211      │ 0     │
│ 6       │ 'tpBay|ngày'       │ 270     │ 270      │ 0     │
│ 7       │ 'tpWater|ngày'     │ 115     │ 115      │ 0     │
│ 8       │ 'tpDrive|ngày'     │ 124     │ 124      │ 0     │
│ 9       │ 'tpBoth|ngày'      │ 274     │ 274      │ 0     │
│ 10      │ 'ttlOverview|ngày' │ 232     │ 232      │ 0     │
│ 11      │ 'ttlBase|ngày'     │ 128     │ 128      │ 0     │
│ 12      │ 'ttlDeck|ngày'     │ 144     │ 144      │ 0     │
│ 13      │ 'ttlBoth|ngày'     │ 239     │ 239      │ 0     │
│ 14      │ 'shOverview|ngày'  │ 260     │ 260      │ 0     │
│ 15      │ 'shTop|ngày'       │ 202     │ 202      │ 0     │
│ 16      │ 'shBank|ngày'      │ 219     │ 219      │ 0     │
│ 17      │ 'shDeck|ngày'      │ 194     │ 194      │ 0     │
│ 18      │ 'overview|đêm'     │ 298     │ 298      │ 0     │
│ 19      │ 'head|đêm'         │ 319     │ 319      │ 0     │
│ 20      │ 'tail|đêm'         │ 258     │ 258      │ 0     │
│ 21      │ 'drive|đêm'        │ 239     │ 239      │ 0     │
│ 22      │ 'bird|đêm'         │ 289     │ 289      │ 0     │
│ 23      │ 'walk|đêm'         │ 237     │ 237      │ 0     │
│ 24      │ 'tpBay|đêm'        │ 290     │ 290      │ 0     │
│ 25      │ 'tpWater|đêm'      │ 136     │ 136      │ 0     │
│ 26      │ 'tpDrive|đêm'      │ 144     │ 144      │ 0     │
│ 27      │ 'tpBoth|đêm'       │ 306     │ 306      │ 0     │
│ 28      │ 'ttlOverview|đêm'  │ 253     │ 253      │ 0     │
│ 29      │ 'ttlBase|đêm'      │ 148     │ 148      │ 0     │
│ 30      │ 'ttlDeck|đêm'      │ 164     │ 164      │ 0     │
│ 31      │ 'ttlBoth|đêm'      │ 260     │ 260      │ 0     │
│ 32      │ 'shOverview|đêm'   │ 306     │ 306      │ 0     │
│ 33      │ 'shTop|đêm'        │ 248     │ 248      │ 0     │
│ 34      │ 'shBank|đêm'       │ 265     │ 265      │ 0     │
│ 35      │ 'shDeck|đêm'       │ 240     │ 240      │ 0     │
└─────────┴────────────────────┴─────────┴──────────┴───────┘
Draw call trùng khớp bản gốc ở mọi góc nhìn.
```

## Tour

Log GD8 Vòng quay (`gd8-l0-test-tour.log`), bản Vite:

```
dragon 8 điểm dừng, camera thấp nhất 3 m → đạt
tp     7 điểm dừng, camera thấp nhất 3 m → đạt
ttl    7 điểm dừng, camera thấp nhất 3.22 m → đạt
sh     6 điểm dừng, camera thấp nhất 3 m, cầu tự quay (“Dừng xe, hạ barie”) → đạt
hr     8 điểm dừng, camera thấp nhất -14.73 m, mô phỏng dìm chạy (“FLOAT_IN”) → đạt
all    13 điểm dừng, camera thấp nhất 24.04 m, cầu tự quay (“Dừng xe, hạ barie”), hết hành trình → orbit → đạt
sw     6 điểm dừng, camera thấp nhất 3 m, hết hành trình → orbit → đạt
storm  8 điểm dừng, camera thấp nhất 17.66 m → đạt
```

Bảng 2026-10-20 cho bản gốc (đối chiếu): dragon ghi LỖI do một điểm chạm ở (−282,2; 9,9; −2,2) đã có sẵn trong bản gốc. Từ GĐ4 (D-011), điểm 3 Tour Cầu Rồng đã đổi sang làn Bắc, nên dragon đạt ở bản Vite. `test:tour -- tests/original` vì vậy báo khác bản gốc ở dragon có chủ đích.
