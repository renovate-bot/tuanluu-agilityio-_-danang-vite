# Cầu Rồng — Thiết kế
_2026-10-21 · Trạng thái: Đã xây (merge b500bb5) · Prompt gốc: prompts/cau-rong.md tại c418f92_

Đọc lại bản prompt cũ: `git show c418f92:prompts/cau-rong.md`. Tài liệu này mô tả cái ĐÃ XÂY, đối chiếu với `src/bridges/dragon/` và `src/config.ts`.

## 1. Mục đích và lý do
- Mô hình 3D Cầu Rồng (Đà Nẵng) bắc qua sông Hàn, càng giống công trình thật càng tốt về dáng, kết cấu, tỷ lệ, màu và bối cảnh.
- Là công trình đầu tiên và là gốc của cả cảnh: mọi cầu khác đặt tương đối với Cầu Rồng (z = 0).
- Prompt gốc yêu cầu một file HTML dùng three.js qua CDN. Bản đó được viết thành `tests/original/index.html` (~4 600 dòng), rồi chuyển sang Vite + TS (mục 7).
- Bản HTML gốc thành chuẩn hồi quy draw call (D-003) và chuẩn thứ tự `rand()` có seed (D-002).

## 2. Phạm vi: có / không có
Có:
- Mặt cầu 6 làn, dải phân cách, lề đi bộ, lan can, dầm hộp thép, trụ (`deck.ts`).
- Thân rồng uốn theo 5 nhịp chính, vảy, đai sườn, vây lưng, dải LED, vây đuôi, dây treo (`body.ts`).
- Đầu rồng: sọ, mõm, hàm mở, răng, mắt, sừng, bờm, râu (`head.ts`).
- Trình diễn lửa + nước + sương, ánh lửa hắt (`effects.ts`).
- Bối cảnh: sông (`Water`), trời (`Sky`), phố, cây, đèn đường, xe, thuyền, núi Sơn Trà, Cầu Trần Thị Lý (nay là cầu riêng, `src/bridges/tran-thi-ly/`).
- Điều khiển: OrbitControls, 6 góc nhìn riêng (`overview`, `head`, `tail`, `drive`, `bird`, `walk`), Tour 8 điểm, nút ngày/đêm, nút phun lửa & nước, bảng thông số, FPS.
- Thuyết minh Tour vi/en/ru; giao diện 9 ngôn ngữ.

Không có (xem mục 7 và 9):
- Vảy dạng giọt nước theo ảnh thật, chi tiết đầu rồng theo ảnh thật.
- Đèn PointLight/SpotLight dọc cầu (cố ý không dùng, mục 6).
- Người đi bộ trên cầu.

## 3. Thông số đã dùng
Mọi số nằm trong khối `base` (đầu `src/config.ts`), xuất ra `CONFIG`. 1 đơn vị = 1 m.

| Thông số | Giá trị | Nguồn | Khóa |
|---|---|---|---|
| Tổng chiều dài | 666 m | prompt: ưu tiên; có trong mã | `CONFIG.length` |
| Nhịp chính | 70 / 85 / 200 / 85 / 70 m (5 nhịp) | nhịp giữa 200 m theo prompt; 4 nhịp còn lại (ước lượng) | `CONFIG.mainSpans` |
| Tổng 5 nhịp chính | 510 m | tính từ `sum(mainSpans)` | `CONFIG.mainTotal` |
| Trụ nhịp dẫn | x = −294 m (3 nhịp dẫn: 2 bờ Tây, 1 bờ Đông) | (ước lượng) | `CONFIG.approachPiers` |
| Độ vồng thân rồng theo nhịp | 70 → 13 m, 85 → 19 m, 200 → 37 m | (ước lượng) | `CONFIG.spanRise` |
| Bề rộng tổng | 37,5 m | prompt: ưu tiên | `CONFIG.width` |
| Làn xe | 3,75 m, 3 làn mỗi chiều = 6 làn | prompt (3,5–3,75 m) | `CONFIG.laneWidth`, `CONFIG.lanesPerDir` |
| Dải phân cách giữa | 6 m | prompt | `CONFIG.median` |
| Lề đi bộ | 2,5 m mỗi bên | prompt | `CONFIG.sidewalk` |
| Lề xe (shoulder) | 2,0 m | (chưa đối chiếu nguồn) | `CONFIG.shoulder` |
| Cao độ mặt cầu giữa sông | 10,0 m | (ước lượng) | `CONFIG.deckMidY` |
| Cao độ đường bờ / đất | 2,6 m / 2,5 m | quy ước chung của dự án | `CONFIG.roadY`, `CONFIG.landY` |
| Mép kè hai bờ | \|x\| = 262 m (sông rộng ~524 m) | (ước lượng) | `CONFIG.bankX` |
| Bán kính thân / cổ-đầu | 2,2 m / 3,4 m | (ước lượng) | `CONFIG.bodyRadius`, `CONFIG.headRadius` |
| Vảy | bước 1,5 m, 9 vảy mỗi vòng | (ước lượng) | `CONFIG.scaleStep`, `CONFIG.scalesPerRing` |
| Dây treo | cách nhau 5 m, 2 dây mỗi vị trí | (ước lượng) | `CONFIG.hangerStep` |
| Bóng đổ | shadow map 2048 | prompt (2048 hoặc 4096) | `CONFIG.shadowMapSize` |
| Hạt lửa / nước | 420 / 520 | prompt: "vài trăm" | `CONFIG.fireCount`, `CONFIG.waterCount` |
| Chu kỳ trình diễn | 48 s | prompt: 30–60 s | `CONFIG.showCycle` |
| Lịch trình diễn thật | tối thứ Bảy và Chủ Nhật, 21:00 | prompt ("Trong thực tế…"); không đối chiếu nguồn ngoài | không có khóa; mô hình không dùng lịch (xem mục 7) |

Lưu ý độ tin cậy (giữ từ prompt gốc):
- Trọng lượng (900 tấn hay gần 9 000 tấn), chiều cao đầu rồng (~18 m trong prompt) và độ rộng mặt cầu khác nhau giữa các nguồn. Khi mâu thuẫn, ưu tiên 666 m, nhịp 200 m, rộng 37,5 m, 6 làn.
- Không khóa nào ghi chiều cao đầu rồng 18 m. Đầu dựng bằng hình khối cố định trong `head.ts` (chưa đối chiếu với 18 m).
- Tọa độ tham khảo 16,061°N, 108,227°E (prompt: "cần đối chiếu bản đồ"). Comment cạnh `CONFIG.sunWheel.lat` dùng 16,06116°N; 108,22719°E làm gốc so sánh.

Hằng số còn nằm trong mã, chưa vào `CONFIG` (ghi ở mục 9): `SPINE_SEGS` = 1400, `MOUTH_LOCAL` = (13,2; −2,6; 0), cường độ `fireLight` 380, tốc độ phát hạt 520/s (lửa) và 300/s (nước), các điểm xương sống trong `buildDragonBody()`.

## 4. Hình dạng, hành vi như đã xây
Cầu Rồng dựng thẳng vào scene bằng các hàm rời, không dùng `BridgeBase` (D-006; có trước lớp đó). Thứ tự gọi trong `src/main.ts`: `buildBridgeDeck`, `buildPiers`, `buildDragonBody`, `buildScales`, `buildHangers`, `buildDragonHead`.

- `profile.ts` — `deckY(x)`: cao độ mặt cầu. Giữa sông vồng nhẹ từ 8,2 lên `deckMidY`; hai bờ hạ dần về `roadY` bằng `smooth`. Mọi phần của cầu bám theo hàm này.
- `deck.ts` — `buildBridgeDeck()`: bản mặt cầu, dầm hộp thép ẩn (570 × 3 × 26 m), dải phân cách, lề đi bộ, gờ chắn, tay vịn, dải LED lan can, gộp bằng `mergeGeometries` theo vật liệu. Mặt đường 6 làn đẩy vào `ROADS3` để gộp chung với đường bờ. Cột lan can là một `InstancedMesh`. `buildPiers()`: trụ đôi, bệ, xà mũ, đều `InstancedMesh`.
- `body.ts` — `buildDragonBody()`: xương sống `CatmullRomCurve3` (centripetal) gồm đuôi cong ở Tây, 5 nhịp sóng (nhô lên giữa nhịp, lặn dưới mặt cầu tại trụ), cổ vươn ở Đông; thân là `taperedTube`; đai sườn (`TorusGeometry` instanced), vây lưng (`ConeGeometry` instanced), hai dải LED `ledRail`, vây đuôi 9 nón. `buildScales()`: vảy hình thoi 5 đỉnh, một `InstancedMesh`, màu từng vảy lệch bằng `rand()` (nằm trong chuỗi seed, D-002). `buildHangers()`: `CylinderGeometry` mảnh instanced, bỏ dây ngắn hơn 2,5 m.
- `head.ts` — `buildDragonHead()`: nhóm `headGroup` đặt ở cuối xương sống: sọ, mõm, mũi, mày, mắt + con ngươi, tai, hai sừng cong có nhánh, hàm dưới mở (xoay −0,38 rad), 20 + 18 răng instanced, bờm lửa 40 nón, râu cằm, hai râu dài trong `whiskerGroup` (đung đưa nhẹ).
- `materials.ts` — vá `MAT.gold` và `MAT.scale` bằng `onBeforeCompile`: sóng sáng chạy dọc thân, đổi vàng ấm ↔ xanh lam theo `sin`, nhân `shared.uNight` (chỉ sáng ban đêm). Không dùng đèn thật.
- `effects.ts` — `createFire()`, `createWaterJet()`: hai `THREE.Points` với `ShaderMaterial` riêng (lửa `AdditiveBlending`, nước `NormalBlending`), bộ đệm ghi lại mỗi khung. `updateShow(dt)`: lịch 48 s, lửa 9 lần (mỗi 3 s, phun 1,6 s) trong 27 s đầu, nước từ 27 s đến 42 s, nghỉ phần còn lại. `updateEffects(dt, time)`: phát hạt từ miệng rồng (`mouthW`), nước có 25 % hạt sương, ánh lửa hắt qua `fireLight` (PointLight duy nhất, tắt dần), râu rồng đung đưa. Khi không phun và hết hạt sống thì bỏ vòng lặp + upload (D-018).
- Nối với thời tiết: `windFx` đẩy lửa, nước, râu; `weatherFx.showAllowed` tạm dừng trình diễn khi mưa lớn/gió mạnh/bão (khóa `sWeather`); `weatherFx.clear` dọn xe trên cầu khi đóng cầu (D-012).
- Bối cảnh (ngoài `dragon/`, cũng từ bản gốc): `core/sky.ts` (`Sky` addon), `core/water.ts` (`Water` addon), `core/lights.ts`, `environment/` (phố, nhà theo cụm `THREE.LOD`, cây instanced, đèn đường, xe, thuyền, núi). Cầu Trần Thị Lý là lớp `TranThiLyBridge`.

## 5. Tương tác, UI, i18n, thuyết minh
- Góc nhìn (`src/views/presets.ts`, `src/views/camera.ts`, `index.html`): `overview` (−430, 330, 560), `head` (392, 26, 40), `tail` (−412, 20, −44), `bird` (−150, 70, −430) là preset cố định; `drive` và `walk` là chế độ camera riêng (`walk` bắt đầu x = −240, z = 17,4, điều khiển WASD, dòng gợi ý `#hint`). `BRIDGE_HOME.dragon` = `overview`.
- Tour "Tour tự động": 8 điểm, `DRAGON_TOUR` trong `src/views/tourStops.ts`. Tên điểm (khóa `stops` của `vi.json`): Toàn cảnh sông Hàn, Đuôi rồng, Trên mặt cầu, Nhịp vòm chính 200 m, Từ mặt sông, Đầu rồng, Cầu Trần Thị Lý, Chim bay ven sông. Điểm 3 đặt ở làn Bắc (D-011, mục 7).
- Nút `#btnShow` "Phun lửa & nước"; `#btnNight` đổi ngày/đêm; `#btnShadow` bật/tắt bóng; FPS và ms ở `#fps`, `#ftime`.
- Bảng Thông số hiển thị 666 m, 37,5 m, 6 làn (khóa `lengthVal`, `widthVal` trong `src/i18n/locales/*.json`).
- Thuyết minh Tour: vi, en (`7c60d82`), ru (`0a0b6be`), clip trong `public/voice/` (D-005). ko, ja, zh, th, ar, hi chưa có thuyết minh.
- i18n đủ 9 ngôn ngữ; `ar` là RTL (bất biến 4).

## 6. Ràng buộc đã tuân thủ
- **Draw call.** Bảng `now` gần nhất trong `tests/KET-QUA.md` (2026-10-24), ngày / đêm: `overview` 282 / 306, `head` 305 / 328, `tail` 236 / 264, `drive` 216 / 244, `bird` 269 / 299, `walk` 216 / 243. Prompt yêu cầu "dưới khoảng 200": cảnh hiện tại vượt vì gồm cả hầm, hai bờ, bốn cầu khác (mục 7). Chuẩn hồi quy là bản gốc: `test:drawcalls`, 36/36 lần đo chênh 0 (2026-10-20, `progress.md`). Góc cũ không được tăng quá ngưỡng của prompt nhiệm vụ (D-003).
- **`rand()` có seed.** `buildScales()` gọi `rand()` để đổi màu vảy; `buildCity`, `buildTrees`, `buildTraffic` dùng cùng chuỗi `rand = rng(20130329)` (D-002). Không đổi thứ tự các lệnh `build*()` trong `main.ts`, không thêm/bớt lời gọi `rand()`. Hiệu ứng lửa/nước cũng gọi `rand()` lúc chạy, sau khi dựng xong nên không đổi vị trí nhà/cây.
- **Đèn.** Ban đêm bằng emissive (`patchDragonGlow`, `ledRail`, đọc `shared.uNight`). Chỉ có `fireLight` (PointLight cam) từ bản gốc; không thêm đèn mới. Prompt đề xuất PointLight/SpotLight dọc cầu: không làm, theo bất biến 5.
- **Texture** vẽ bằng canvas, không ảnh ngoài; không thêm thư viện runtime.
- **Bóng đổ.** Thân, vảy, đầu, dây treo, cột lan can có `castShadow`; kích thước shadow map `CONFIG.shadowMapSize`.
- Công trình đã xây thật, không cần ghi "phương án đề xuất".

## 7. Khác so với ý định ban đầu
- Prompt: "một file HTML, import CDN". Đã xây: Vite + TS, three@0.165, không framework UI (`b500bb5`). Bản HTML gốc giữ ở `tests/original/index.html` làm chuẩn hồi quy (D-003).
- Prompt: "tổng draw call dưới ~200". Đã xây: 216–328 tùy góc (mục 6), vì cảnh nay còn hầm, hai bờ, Vòng quay Mặt Trời, thời tiết. Mục tiêu thực tế đổi thành "góc cũ không tăng so với bản gốc" (D-003).
- Prompt: điểm "Trên mặt cầu" của Tour. Bản gốc đặt z = +11,5, đường bay cắt thân rồng ở (−282,2; 9,9; −2,2). Đã dời sang làn Bắc `[-228, 11.4, -11.5]`, target `[-60, 15, -2]` (D-011, commit `e3906e7`). `test:tour -- tests/original` vì thế báo "KHÁC" ở dragon, có chủ đích.
- Prompt: đèn đêm bằng PointLight/SpotLight dọc cầu. Đã xây: emissive trong shader (sóng sáng chạy dọc thân) và một `fireLight`; giữ draw call và theo bất biến 5.
- Prompt: `buildLights()`, `buildCity()`, `buildTrees()`, `buildCableStayBridge()` trong một file. Đã xây: `buildLights()` ở `core/lights.ts`; Cầu Trần Thị Lý tách thành lớp `TranThiLyBridge` (D-006). Số liệu cầu đó (prompt ghi ~731 m, tháp ~145 m) nằm ở tài liệu riêng của cầu.
- Prompt: đầu rồng "cao khoảng 18 m", vảy "giọt nước, cong nhẹ". Đã xây: đầu dựng từ hình khối cơ bản; vảy là tấm 5 đỉnh (chưa đối chiếu với 18 m).
- Prompt: rồng phun lửa và nước "vào tối thứ Bảy và Chủ Nhật lúc 21:00", lặp 30–60 s. Đã xây: không có lịch theo ngày giờ. Trình diễn chạy khi người xem bấm `#btnShow` (`show.on`, `setupUI.ts`), rồi lặp chu kỳ 48 s mãi (`updateShow`, `CONFIG.showCycle`). Chỉ có một liên hệ với giờ: bật trình diễn thì ban ngày tự chuyển sang đêm (`dayNight.target = 1`, comment "lúc 21:00"). Chữ "21h tối thứ Bảy, Chủ nhật" chỉ xuất hiện trong quảng cáo hư cấu của riverfront (`adAtlas.ts`). Lý do: mô hình xem được mọi lúc, không phụ thuộc đồng hồ máy.
- Prompt: chế độ đi bộ "tùy chọn". Đã xây: có (`walk`), nhưng không có người đi bộ.
- Prompt: ngày/đêm bằng nút hoặc slider. Đã xây: nút `#btnNight`; thêm hệ thời tiết (ngoài prompt gốc).
- Chưa làm (yêu cầu của prompt không có trong mã):
  - vảy kim loại và đầu rồng chi tiết theo ảnh thật;
  - kiểm chứng chiều cao đầu rồng 18 m;
  - PointLight/SpotLight dọc thân (cố ý bỏ);
  - mục 11 của prompt: ảnh tham khảo, bản vẽ/GIS, chọn mức chi tiết. Chưa nhận ảnh đầu rồng. Chạy trên điện thoại đã làm ở chung toàn dự án (D-019), không riêng Cầu Rồng.

## 8. Kiểm tra
- `tests/drawcalls.mjs` (`npm run test:drawcalls`): sáu góc `dragon` (`overview`, `head`, `tail`, `drive`, `bird`, `walk`) ngày/đêm, so với `tests/original`. Lần so bản gốc đầy đủ: 36/36 chênh 0 (2026-10-20). Từ đó chỉ có cột `bản Vite` (`tests/KET-QUA.md`); bảng 2026-10-24 cao hơn bảng cũ 7 draw call ở `overview` và `head`, chưa xác định nguyên nhân.
- `tests/tour-check.mjs` (`npm run test:tour`): `dragon` 8 điểm dừng, camera thấp nhất 3 m, đạt (log GĐ8 Vòng quay, 2026-10-24; 8/8 tour đạt 2026-10-27).
- `tests/voice-check.mjs` (`npm run test:voice`): Tour Cầu Rồng vi + en + ru, đạt (2026-10-27).
- `tests/weather-check.mjs` (`npm run test:weather`): bão thì `showAllowed` = false, đạt (2026-10-27).
- Chưa có test riêng cho hình học thân/đầu rồng (kiểm bằng ảnh và draw call).

## 9. Còn mở
- `.github/memory-bank/progress.md` còn ghi "Dựng lại Cầu Rồng chi tiết theo `prompts/cau-rong.md`" như việc chưa bắt đầu. Người dùng xác nhận Cầu Rồng đã XONG ở mức hiện tại, dòng đó sai (Task 11 sửa). Phần dưới là việc prompt yêu cầu mà mã chưa có.
- Dựng lại vảy và đầu rồng chi tiết theo ảnh thật (cần ảnh đầu, thân, mặt cầu nhiều góc; màu sơn chính xác).
- Đối chiếu chiều cao đầu rồng (~18 m), 4 nhịp phụ 70/85 m, độ vồng, trụ nhịp dẫn, lề xe 2,0 m: đều là ước lượng.
- Đưa các hằng số rời (`SPINE_SEGS`, `MOUTH_LOCAL`, tốc độ phát hạt, cường độ `fireLight`, điểm xương sống) vào `CONFIG` nếu cần chỉnh.
- Bảng draw call: chưa rõ vì sao `overview|ngày` và `head|ngày` cao hơn 7 so với bảng 2026-10-20; cần `npm run test:drawcalls -- tests/original`.
- Thuyết minh ko, ja, zh, th, ar, hi.
- Người đi bộ trên cầu chưa có.
