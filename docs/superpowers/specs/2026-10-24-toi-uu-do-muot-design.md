# Tối ưu độ mượt — Thiết kế
_2026-10-24 · Trạng thái: Đã xây (merge ecebdf8, commit `134d5c8`)_

Tính năng này không có prompt gốc trong `prompts/`. Nguồn là D-018 (`.github/memory-bank/decisions.md`), mục "Tối ưu độ mượt" trong `activeContext.md`, `progress.md` và `tests/KET-QUA.md`. Tài liệu mô tả cái ĐÃ XÂY, đối chiếu với `src/core/{perf,prewarm,quality,device}.ts`, `src/core/lights.ts`, `src/core/water.ts`, `src/ui/qualityUI.ts` và `CONFIG.perf` (`perfBase` trong `src/config.ts`). Kế hoạch theo giai đoạn: [2026-10-24-toi-uu-do-muot.md](../plans/2026-10-24-toi-uu-do-muot.md).

## 1. Mục đích và lý do
Lag có hai nguồn (D-018):
- **Giật hàng giây do biên dịch shader giữa phiên.** Three biên dịch shader của một vật liệu lần đầu nó được vẽ, đồng bộ trên luồng chính. Đo `test:perf` GĐ0 trên SwiftShader: tắt bóng đổ 11,6 s / +68 program; bật mặt cắt Hầm 12,6 s / +22; đêm lần đầu 5,5 s / +14; bay tới công trình lần đầu 4–7 s.
- **Khung nặng.** MSAA + pixelRatio 2, shadow map 2048² PCFSoft vẽ mỗi khung, phản chiếu nước vẽ lại cả cảnh mỗi khung, bloom độ phân giải đầy đủ, việc CPU thừa (536 `clone()` xe mỗi khung, 940 hạt lửa chạy cả khi tắt).

Người dùng chọn (D-018):
- giữ hình gốc làm mặc định;
- chỉ tự hạ chất lượng khi lag;
- có ô chọn Tự động / Cao / Trung bình / Thấp;
- phải chạy được trên điện thoại.

## 2. Phạm vi: có / không có
Có:
- Đo: `core/perf.ts` (HUD ms trung bình / p95 / max, đo CPU từng bước khi `?test&perf`), `tests/perf-check.mjs` + `npm run test:perf`.
- Biên dịch trước: `core/prewarm.ts`.
- Không đổi program key khi chạy: mặt cắt Hầm, bóng đổ, phản chiếu nước.
- Bỏ cấp phát và việc thừa mỗi khung (xe, thuyền, người, tín hiệu Cầu sông Hàn, con lăn, cabin, cây đổ, hạt lửa/nước, đèn xe, thanh Tour, âm thanh).
- Bậc chất lượng: `core/quality.ts`, `core/device.ts`, `CONFIG.perf`; ô `#qualitySel` + `ui/qualityUI.ts`; i18n `quality, qAuto, qHigh, qMed, qLow` × 9 (`scripts/add-quality-locales.mjs`).
- Bundle: `__app.THREE` chỉ còn 6 lớp (three 724 → 558 KB); normal map nước tính lưới một lần.

Không có (xem mục 9): đo GPU thật / điện thoại thật, đổi cỡ render target phản chiếu khi chạy, nạp font không đồng bộ.

## 3. Thông số đã dùng
Mọi số ở `CONFIG.perf` (`perfBase`), đều ghi "(ước lượng)" trong code, chỉnh theo đo trên GPU thật.

| Thông số | Giá trị | Ý nghĩa |
|---|---|---|
| `hudSamples` | 240 | số khung trong vòng mẫu HUD (≈ 4 s ở 60 FPS) |
| `maxHitchMs` | 150 ms | khung dài nhất cho phép khi đổi trạng thái (`test:perf --strict`; `tests/perf-check.mjs` giữ bản sao `MAX_HITCH`) |
| `adapt.window` | 2 s | cửa sổ đo trung bình |
| `adapt.downMs` | 22 ms | trung bình trên mức này (≈ dưới 45 FPS) thì hạ một bậc |
| `adapt.upMs` / `upHold` | 12 ms / 10 s | trung bình dưới mức này liên tục đủ lâu thì nâng một bậc |
| `adapt.cooldown` | 3 s | tối thiểu giữa hai lần đổi bậc (đổi pixelRatio phải cấp lại framebuffer) |
| `adapt.ignoreMs` | 400 ms | bỏ khung dài hơn khỏi trung bình |
| `rainMaxRatio` | 1,5 | pixelRatio tối đa khi mưa (chuyển từ `weather.perf.rainMaxPixelRatio`) |
| `manual` | `high` 0, `medium` 2, `low` 5 | bậc ứng với lựa chọn tay |
| `start` | `phone` 5, `weak` 2 | bậc khởi đầu ở chế độ Tự động |

Thang 7 bậc `CONFIG.perf.steps` (bậc 0 = cảnh gốc, bảng draw call chuẩn đo ở bậc này):

| Bậc | tier | ratio | shadow (px) | shadowEvery | reflectEvery | bloom | clouds |
|---|---|---|---|---|---|---|---|
| 0 | high | 2 | 2048 | 1 | 1 | 1 | 26 |
| 1 | high | 1,5 | 2048 | 1 | 1 | 1 | 26 |
| 2 | medium | 1,5 | 1024 | 2 | 2 | 0,5 | 26 |
| 3 | medium | 1,25 | 1024 | 2 | 2 | 0,5 | 26 |
| 4 | medium | 1 | 1024 | 2 | 3 | 0,5 | 18 |
| 5 | low | 1 | 0 (tắt) | 1 | 0 (tắt) | 0 (tắt) | 12 |
| 6 | low | 0,75 | 0 (tắt) | 1 | 0 (tắt) | 0 (tắt) | 12 |

`device` (`core/device.ts`): `phone` = không `?test` và con trỏ thô (`pointer: coarse`) và cạnh ngắn màn hình < 900 px; `weak` = không `?test` và (`deviceMemory` ≤ 4 hoặc `hardwareConcurrency` ≤ 4).

## 4. Hình dạng, hành vi như đã xây
- **Quy tắc gốc (D-018): không đổi gì làm thay đổi program key khi chạy.**
  - Bóng đổ: nút người dùng và bậc chất lượng không đổi `sun.castShadow`. Tắt = ngừng vẽ + xóa shadow map về trắng (`lights.ts`: `setShadowQuality`, `stepShadows`). Đổi cỡ map = `dispose` map, three tạo lại ở lần vẽ bóng kế tiếp (cỡ map là uniform).
  - Mặt cắt Hầm: `clippingPlanes` gán cố định lúc dựng (`cutaway.ts`); tắt = đẩy hằng số mặt phẳng đầu ra `PLANE_OFF = 1e7`.
  - Phản chiếu nước tắt = đổi sampler sang texture 1×1 màu sương (`water.ts`, `reflectState.every = 0`).
  - Ngoại lệ duy nhất: điện thoại khởi động ở bậc Thấp thì `castShadow = false` từ đầu (`quality.init`); bật lại sau đó thì biên dịch một lần.
- **Biên dịch trước (`prewarm.ts`)**, chạy một lần lúc màn hình chờ còn hiện, trước khung đầu:
  - chờ `document.fonts.ready` (tối đa 3 s) để atlas quảng cáo chỉ upload một lần;
  - `compileAsync` cả cảnh hai biến thể: canvas và render target của composer (cũng trùng biến thể phản chiếu nước);
  - `renderer.initTexture` cho mọi texture;
  - vẽ thật một lần với MỌI object tạm hiện, không cắt theo khung nhìn, mọi level LOD, `InstancedMesh` rỗng có 1 instance, rồi trả nguyên trạng (upload hình học, biên dịch biến thể vẽ bóng, phần trình điều khiển biên dịch lười); cuối cùng `composer.render` thêm một lần.
- **Bậc chất lượng (`quality.ts`).**
  - Chế độ `auto` | `high` | `medium` | `low`, lưu ở `localStorage` khóa `dn3d-quality`; `?test` luôn `high`, không tự đổi (trừ khi test gọi `set()` hoặc bật `simulateMs`).
  - Khi chạy chỉ đổi: pixelRatio, cỡ / chu kỳ shadow map, chu kỳ phản chiếu, tỉ lệ bloom, số tấm mây.
  - Tự động: trung bình 2 s > `downMs` thì hạ; < `upMs` trong `upHold` thì nâng; cách nhau ≥ `cooldown`; không đổi giữa chuyến bay camera (`quality.init(() => cam.mode === 'fly')`); bỏ khung > `ignoreMs`.
  - Giới hạn pixelRatio khi mưa chuyển từ `rain.ts` sang đây (`rainMaxRatio`).
  - Điện thoại: không MSAA (`renderer.ts`: `antialias: !device.phone`, chỉ đặt được lúc tạo context), bậc khởi đầu Thấp. Máy yếu: bậc Trung bình.
- **CPU.**
  - Vector / matrix tạm cấp sẵn trong mọi hàm `update` / `step*`.
  - Không ghi ma trận đèn xe khi ẩn (ban ngày).
  - Hạt lửa / nước bỏ vòng lặp và upload khi không còn hạt.
  - Tín hiệu Cầu sông Hàn chỉ cập nhật khi `details` hiện.
  - Bounding sphere cabin Vòng quay cố định.
  - Thanh Tour dùng `scaleX`.
  - Âm thanh chỉ lên lịch khi đêm đổi.
  - Normal map nước tính lưới một lần (trùng byte, nhanh ≈ 3,5×).
- **Đo.** `perf.tick()` mỗi khung, `perf.start()/lap()` đo từng bước trong `animate()` (chỉ khi `perf.on`, tức URL có `?test&perf`); vòng mẫu là `Float32Array` cấp sẵn, không cấp phát mỗi khung. HUD: `#ftime` ghi "trung bình · p95 · max".

## 5. Tương tác, UI, i18n, thuyết minh
- Ô `select#qualitySel` ("Chất lượng hình") ở cuối panel Cài đặt, `ui/qualityUI.ts`: Tự động / Cao / Trung bình / Thấp. Ở chế độ Tự động, chữ ghi kèm bậc đang dùng ("Tự động · Trung bình"), cập nhật 1 lần/giây và khi đổi ngôn ngữ.
- i18n: 5 khóa `quality, qAuto, qHigh, qMed, qLow` × 9 ngôn ngữ (`scripts/add-quality-locales.mjs`).
- Không có thuyết minh.
- API test: `window.__app.perf`, `window.__app.quality` (chỉ khi `?test`); `__app.THREE` chỉ còn 6 lớp.

## 6. Ràng buộc đã tuân thủ
- **Draw call.** Bậc Cao (bậc 0) giữ nguyên draw call và điểm ảnh của bảng chuẩn; bậc thấp hơn chỉ được giảm draw call (`test:perf` kiểm). `test:drawcalls` ở bậc Cao: 73/74 phép đo khớp bảng `now`; `swTour|đêm` 209 so với 207 (xem mục 8).
- **`rand()` / seed.** Không thêm / bớt lời gọi `rand()`; không đổi thứ tự `build*()`.
- **Đèn.** Không thêm `PointLight` / `SpotLight`.
- **Không thêm thư viện runtime**, không ảnh ngoài.
- **Mọi thông số ở `src/config.ts`** với chú thích tiếng Việt; số chưa có nguồn đều "(ước lượng)".
- **i18n đủ 9 ngôn ngữ** cho khóa mới.
- Không liên quan "phương án đề xuất".

## 7. Khác so với ý định ban đầu
So sánh với văn bản quyết định D-018:

| Mục | D-018 / dự kiến | Đã xây | Vì sao |
|---|---|---|---|
| Biên dịch trước | `compileAsync` hai biến thể, upload texture, vẽ composer một lần | thêm bước vẽ thật toàn cảnh với mọi object tạm hiện (mọi LOD, `InstancedMesh` rỗng = 1 instance) | đo GĐ1: không còn program mới nhưng lần đầu bay tới Thuận Phước / Hầm / Vòng quay vẫn khựng 3–5 s trên SwiftShader (comment trong `prewarm.ts`) |
| Khung đầu | không nói | SwiftShader 3,3 → 16,4 s; program sau khởi động 81 → 157 | đổi lấy hết giật giữa phiên; làm trong lúc màn hình chờ còn hiện |
| Render target phản chiếu | D-018 chỉ nêu chu kỳ vẽ / tắt (sampler 1×1) | không đổi cỡ 512² được khi chạy | Water.js không export render target (ghi ở "Hệ quả" của D-018) |
| Giới hạn pixelRatio khi mưa | trước đó ở `rain.ts` (`weather.perf.rainMaxPixelRatio`) | chuyển sang `quality.apply()` với `CONFIG.perf.rainMaxRatio` | một nơi quản lý pixelRatio |
| Số trên khung test | trước đó đo khi còn blur panel | khung 480×270 khớp `(max-height: 500px)` nên sau D-019 cả bộ test chạy ở chế độ gọn (không blur) | số hitch không so sát được với mốc D-018 (ghi ở đầu `tests/KET-QUA.md`) |

## 8. Kiểm tra
- `npm run test:perf -- --strict` (`tests/perf-check.mjs`): 0 program mới sau prewarm và render dài hơn bình thường ≤ `maxHitchMs` ở mọi thao tác. Kết quả sau tối ưu (`tests/screens/perf/gd15.json`, SwiftShader, khung 480×270):

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

- CPU mỗi khung (ngoài render, trung bình 30 khung): overview 1,55 → 0,85 ms; head 22,4 → 0,68 ms; swOverview 38,1 → 0,91 ms (GĐ0 có khung GC lớn); tpBay 1,21 → 15,3 ms ở lần đo này (một khung đột biến trong `traffic`, lần đo GĐ1–2 là 0,73 ms, chưa giải thích).
- Bậc chất lượng, draw call ở overview (tối đa 6 khung): ngày Cao 282 / Trung bình 215 / Thấp 116; đêm 306 / 306 / 121. Tự động: khung giả lập 40 ms hạ ≥ 2 bậc, 5 ms nâng về bậc 0.
- `test:drawcalls` ở bậc Cao (`?test`): 73/74 khớp bảng; `swTour|đêm` 209 so với 207. Thăm dò 4 lần trung vị 209 / 209 / 209 / 208, từng khung 200–223 (camera đang leo cabin): dao động sẵn có của phép đo, không do tối ưu.
- Bộ test khác: `test:tunnel`, `test:riverfront`, `test:sunwheel`, `test:tour`, `test:voice` đạt. `test:weather` lần 1 LỖI do lịch tự quay Cầu sông Hàn 23:00 thứ Bảy (`swingUI.ts`) trùng giờ chạy; chạy lại sau 23:10: đạt.
- Bundle: `three-*.js` 724 → 558 KB (gzip 187 → 144 KB).
- Đã gặp khi làm (mục "Giao diện điện thoại" của `activeContext.md`): `test:perf` từng treo hàng giờ vì tiến trình `test:mobile` mồ côi tranh CPU; trước mỗi test kiểm không còn tiến trình `*-check.mjs` / `drawcalls.mjs` nào chạy.
- Số liệu trong bảng là SwiftShader (CPU), chỉ so tương đối trên cùng máy; chưa đo GPU thật.

## 9. Còn mở
- Chưa đo GPU thật / điện thoại thật.
- Khung đầu SwiftShader 3,3 → 16,4 s (prewarm).
- Render target phản chiếu (Water.js) không đổi cỡ được khi chạy.
- Điện thoại khởi động bậc Thấp mà chọn lên Cao thì biên dịch lại một lần (`castShadow`).
- `tpBay` CPU 15 ms ở lần đo cuối là một khung đột biến chưa giải thích.
- Font Google vẫn chặn render; đổi sang nạp không đồng bộ thì atlas quảng cáo có thể vẽ trước khi có font.
- Đề xuất: test bỏ qua lịch tự quay khi `?test` (lỗi `test:weather` phụ thuộc giờ chạy, có từ trước).
- Mọi số trong `CONFIG.perf` là ước lượng, cần chỉnh theo đo trên GPU thật.
