# Tối ưu thời gian vẽ trên GPU (bộ đèn theo trạng thái, tán cây bản thưa) — Thiết kế

_2026-11-12 · Trạng thái: Đã xong (PR #TBD); số đo ở `tests/KET-QUA.md` · Quyết định: D-031 · Nhánh: `feature/toi-uu-hieu-nang`_

## 1. Mục đích và lý do

Người dùng báo ứng dụng lag. D-018 đã xử lý giật khựng (biên dịch shader) và CPU mỗi khung; từ đó cảnh nặng thêm (D-026 tàu, D-027 xe, D-028 cây và người) nhưng chưa lần nào đo trên GPU thật.

Đo ngày 2026-11-12 trên máy của người dùng (Intel Arc, Chromium headless ANGLE D3D11, bản build `main` `a309fa8`, góc mặc định Cầu Rồng, 1920×1080, pixelRatio 1, bậc chất lượng 0, bộ đếm `EXT_disjoint_timer_query_webgl2`, trung vị 5–7 vòng xen kẽ):

| Phép đo | Ngày | Đêm |
|---|---|---|
| Gốc | 19,2–19,6 ms (269 lệnh vẽ, 5,07 triệu tam giác) | 18,9–20,5 ms (287 lệnh vẽ, 5,10 triệu) |
| CPU các bước cập nhật (không gồm render) | ≈ 0,8 ms | chưa đo |
| Bỏ 7 `PointLight` | 15,3–16,6 | 16,0–17,3 |
| Bỏ 7 `PointLight` + `moon` | 14,7 | – |
| Ẩn `sun` (không lượt bóng, không lấy mẫu bóng) | – | 13,3 |
| Tắt lượt bóng | 17,2 | 16,9–19,0 |
| Tắt phản chiếu nước | 16,4 | 14,8 |
| Ẩn hẳn 4 lưới cây khu phố | 12,0 | 13,5 |
| Bỏ đèn + `moon` + tán cây bóng mát khỏi lượt bóng và phản chiếu | 11,6 | – |
| Xe khu phố không đổ bóng (thêm vào dòng trên) | 11,7 (không đổi) | – |

Kết luận:
1. CPU không phải nút thắt. Gần như toàn bộ thời gian khung là GPU.
2. Vượt 16,7 ms nên vòng `requestAnimationFrame` rơi xuống 30 FPS (đo vòng thật: 34,9 ms/khung), và chế độ Tự động hạ bậc chất lượng.
3. Ba chỗ tốn mà không cho hình ảnh gì:
   - 6 đèn dọc Cầu Rồng + đèn lửa (`PointLight`) có cường độ 0 ban ngày nhưng vẫn được tính cho mọi điểm ảnh của mọi vật liệu có ánh sáng. `moon` cũng vậy.
   - Ban đêm `sun.intensity = 0` nhưng lượt bóng vẫn vẽ 1,7 triệu tam giác mỗi khung và mọi điểm ảnh vẫn lấy mẫu bóng `PCFSoft`.
   - Tán cây bóng mát (640 tam giác × 890 cây khu phố + 128 cây Thuận Phước) vẽ đủ chi tiết trong lượt bóng (0,46 m mỗi texel) và lượt phản chiếu (512², méo theo sóng), nơi không thấy được chi tiết đó.

## 2. Mục tiêu

1. Thời gian GPU góc mặc định, 1920×1080, pixelRatio 1, bậc 0, trên máy đã đo: ngày ≤ 14 ms, đêm ≤ 15 ms (hiện 19,2–19,6 và 18,9–20,5).
2. Hình ảnh ban ngày và ban đêm không đổi ở lượt chính. Bóng cây và ảnh cây trên mặt nước giữ đúng vị trí, cỡ và đường bao cụm lá, chỉ ít mặt hơn.
3. Có lệnh đo GPU thật lặp lại được (`npm run test:gpu`) để các tính năng sau so sánh.

## 3. Không làm

- LOD theo khoảng cách cho cây / xe ở lượt chính (cây còn ≈ 3,4 ms ở lượt chính): cần tách instance theo vùng, đụng ngân sách draw call. Ghi ở mục 9.
- Hình bóng đơn giản cho xe: đo không thấy lợi (11,6 → 11,7 ms).
- Đổi thang bậc chất lượng `CONFIG.perf.steps`, đổi chu kỳ bóng / phản chiếu ở bậc 0.
- Chuyển cây sang layer 1 (bỏ hẳn khỏi phản chiếu): giữ ảnh cây trên sông như người dùng đã chọn ở D-028.

## 4. Điều không được xảy ra

- Giật khi chuyển ngày ↔ đêm, khi rồng phun lửa ban ngày, khi bay tới công trình lần đầu: `test:perf -- --strict` vẫn +0 program và render dài nhất ≤ `CONFIG.perf.maxHitchMs` cho mọi thao tác.
- Màn hình chờ dài hơn trước D-031.
- Tăng draw call ở bất kỳ góc nhìn cũ nào. Ban ngày chênh 0. Ban đêm **giảm** khi bộ đèn bật (không còn lượt bóng); `?test` mặc định tắt bộ đèn nên bảng chuẩn giữ nguyên.
- Đổi chuỗi `rand()`, đổi vị trí / ma trận instance của cây.
- Thêm đèn, thêm thư viện, thêm lệnh vẽ.
- Bóng cây hoặc ảnh phản chiếu biến mất, lệch chỗ; lượt chính vẽ nhầm bản thưa.

## 5. Thông số

| Khóa | Giá trị | Ý nghĩa |
|---|---|---|
| `CONFIG.perf.lightWarmMs` | 3 | ms — ngân sách mỗi khung cho phần đồng bộ của biên dịch nền bộ đèn (ước lượng) |
| `CONFIG.trees.shade.lodDetail` | 0 | số lần chia khối 20 mặt của mỗi cụm lá ở bản thưa (bản đầy đủ chia 1 lần = 80 tam giác; 0 = 20 tam giác) ⇒ tán thưa 160 tam giác thay vì 640 (ước lượng, chọn theo đo) |

Ba bộ đèn (không phải thông số, là trạng thái):

| Bộ | `sun` | `moon` | 7 `PointLight` | Khi nào |
|---|---|---|---|---|
| `day` | hiện | ẩn | ẩn | `sun.intensity > 0`, `moon.intensity = 0`, mọi `PointLight` cường độ 0 |
| `night` | ẩn | hiện | hiện | `sun.intensity = 0` (đêm ≥ 0,87) |
| `full` | hiện | hiện | hiện | còn lại: đang chuyển ngày ↔ đêm, rồng phun lửa ban ngày |

## 6. Hành vi

### 6.1 Bộ đèn theo trạng thái (`src/core/lights.ts`)

- `stepLights()` chạy mỗi khung, sau mọi chỗ ghi cường độ đèn (`applyNight`, `updateWeather`, `updateEffects`) và trước khi vẽ. Nó chọn bộ theo bảng trên rồi đặt `visible` của `sun`, `moon` và một `Group` chứa 7 `PointLight`. Chỉ ghi khi bộ đổi.
- three bỏ đèn ẩn khỏi trạng thái đèn, nên số đèn trong shader đổi theo bộ. Mỗi vật liệu giữ sẵn program của từng bộ (`materialProperties.programs`), đổi bộ chỉ là tra bảng, không biên dịch, **với điều kiện cả ba bộ đã được biên dịch trước**.
- **Biên dịch (sửa sau Task 1, 2026-11-12).** Bản đầu biên dịch cả ba bộ trước khung đầu: số program 174 → 490, màn hình chờ trên Intel Arc 10–16 s → 26–36 s. Không chấp nhận. Thiết kế chốt, theo `device.lightSets`:
  - `'bg'` (mặc định khi không có `?test`, và chỉ khi trình duyệt có `KHR_parallel_shader_compile`; không có thì `'off'`): trước khung đầu chỉ biên dịch bộ `full` đúng như trước D-031 (không đổi thời gian chờ). Sau khung đầu, `warmLightSets()` chạy mỗi khung với ngân sách thời gian `CONFIG.perf.lightWarmMs`: gọi `renderer.compileAsync(<nhóm object>, camera, scene)` từng nhóm nhỏ cho bộ `day` rồi `night` (hai biến thể canvas / render target); trình duyệt biên dịch song song ngoài luồng chính. Bộ nào xong hết thì `lightState.ready[bộ] = true`.
  - `stepLights()` chỉ chuyển sang bộ đã `ready`; chưa sẵn sàng thì ở `full` (hình ảnh giống hệt, chỉ chậm như cũ). Tính đúng không phụ thuộc tiến độ biên dịch nền.
  - `'sync'` (`?test&lightsets=sync`, dùng cho `test:perf`): biên dịch + vẽ thật cả ba bộ trước khung đầu (bản Task 1), sẵn sàng ngay.
  - `'off'` (mặc định khi `?test`): luôn `full` ⇒ mọi test và bảng draw call cũ giữ nguyên. `?test&lightsets=bg` để thử đường nền.
  - Biến thể vẽ bóng (`MeshDepthMaterial`, ~5 program nhỏ) của bộ `day` ở chế độ `'bg'` biên dịch lười ở khung đầu chuyển sang `day` (three vẽ shadow map trước khi cập nhật trạng thái đèn của khung).
- Bộ `night`: `sun` ẩn nên three không vẽ shadow map và shader không lấy mẫu bóng. `stepShadows()` giữ nguyên nghĩa (nút Bóng đổ, bậc chất lượng).
- Đây là ngoại lệ có kiểm soát của quy tắc D-018 "không đổi program key khi đang chạy": chỉ ba bộ cố định, đều đã biên dịch trước. Mọi cách đổi số đèn khác vẫn cấm.
- Móc test: `__app.lights` = `lightState` (`set`, `ready`, `mode`).

### 6.2 Tán cây bản thưa cho lượt bóng và phản chiếu

- `trShadeCrownGeo(detail = 1)` nhận số lần chia; bố cục cụm lá và chuỗi `rng` không đổi theo `detail` (cùng tâm, cùng cỡ cụm).
- Lưới `trees-shade-crown` và `tp-trees-crown` dùng hình học gộp `[bản đầy đủ | bản thưa]` trong cùng một buffer. `drawRange` mặc định = bản đầy đủ.
- `src/core/passLod.ts`: đăng ký lưới có bản thưa. Trong lượt bóng (`onBeforeShadow` / `onAfterShadow` của lưới) và trong lượt phản chiếu (bọc quanh lời gọi vẽ gương ở `core/water.ts`) đổi `drawRange` sang bản thưa rồi trả lại. Lồng nhau được (bóng vẽ bên trong lượt gương khi `shadowEvery > 1`).
- Không thêm lưới, không thêm lệnh vẽ, ma trận instance giữ nguyên ⇒ cây đổ, dọn cây, gió bám thân chạy như cũ.
- `treesTest.meshes()` báo `tris` = số tam giác bản đầy đủ (như cũ) và thêm `lodTris`.

### 6.3 Lệnh đo GPU thật

- `tests/gpu-time.mjs` + `npm run test:gpu`: mở `dist/` bằng Chromium với GPU thật (ANGLE D3D11, không SwiftShader), in tên GPU, đo thời gian GPU mỗi khung bằng timer query ở góc mặc định, ngày và đêm, kèm số lệnh vẽ và tam giác; tùy chọn `--w`, `--h`. Không có timer query hoặc GPU là SwiftShader thì báo rõ và thoát mã 0 (không chấm đạt / lỗi: số đo phụ thuộc máy).

## 7. Ràng buộc dự án

- Seed: không đụng lệnh `build*()` nào ngoài việc đổi hình học tán; không thêm lời gọi `rand()`.
- Draw call: ngày chênh 0 ở mọi góc; đêm chỉ được giảm.
- Thông số mới ở `src/config.ts`, chú thích tiếng Việt, `(ước lượng)`.
- Không khóa i18n mới. Không thêm thư viện, đèn, ảnh.
- Comment tiếng Việt, không format lại file.

## 8. Kiểm tra

| Test | Ngưỡng |
|---|---|
| `npm run typecheck`, `npm run build` | đạt |
| `npm run test:trees:unit` | đạt; thêm kiểm: bản thưa có cùng hộp bao (sai ≤ 0,12) và ≤ 200 tam giác |
| `npm run test:gpu` | ngày ≤ 14 ms, đêm ≤ 15 ms trên máy đã đo (ghi số vào `tests/KET-QUA.md`) |
| `npm run test:perf -- --strict` | đạt (+0 program mọi thao tác, gồm đêm lần đầu); thêm kiểm bộ đèn: ngày `day`, đêm `night`; ghi thời gian khung đầu và số program |
| `npm run test:trees` | đạt |
| `npm run test:drawcalls` | khớp bảng (chênh 0; `?test` tắt bộ đèn) |
| `npm run test:weather`, `npm run test:citynight` | đạt (đèn / khí quyển / ảnh đêm) |

## 9. Câu hỏi còn mở (báo người dùng)

1. Cây ở lượt chính còn ≈ 3,4 ms: có làm LOD theo khoảng cách (tách cây theo vùng, có thể thêm lệnh vẽ ở vài góc) không.
2. Màn hình mật độ cao: bậc 0 cho pixelRatio tới 2 (2880×1800 ⇒ 5,2 triệu điểm ảnh, MSAA); có hạ trần bậc 0 xuống 1,5 không.
3. Trình duyệt không có `KHR_parallel_shader_compile` không được lợi từ bộ đèn (ở `full` như cũ).
