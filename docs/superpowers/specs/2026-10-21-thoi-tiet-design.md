# Thời tiết Đà Nẵng và ảnh hưởng tới các cây cầu — Thiết kế
_2026-10-21 · Trạng thái: Đã xây (merge d49dd58, PR #6) · Prompt gốc: prompts/ke-hoach-thoi-tiet.md tại c418f92_

Đọc lại bản prompt cũ: `git show c418f92:prompts/ke-hoach-thoi-tiet.md`. Tài liệu này mô tả cái ĐÃ XÂY, đối chiếu với `src/environment/weather/`, `src/ui/weatherUI.ts`, `CONFIG.weather` (`weatherBase` trong `src/config.ts`) và các quyết định D-009, D-010, D-011, D-012, D-013. Kế hoạch theo giai đoạn: [2026-10-21-thoi-tiet.md](../plans/2026-10-21-thoi-tiet.md).

## 1. Mục đích và lý do
- Cảnh cũ chỉ có một kiểu trời (nắng nhẹ, mây mỏng, gió lặng) và một trục **ngày ↔ đêm** (`src/core/dayNight.ts`). Thêm trục thứ hai là **thời tiết**: người xem chọn mùa / hiện tượng và **thấy rõ thời tiết tác động lên từng cây cầu** (kết cấu, giao thông, vận hành, ánh sáng).
- Bốn trạng thái theo prompt (thời kỳ "cần xác minh", xem mục 3):

| Trạng thái | Thời kỳ ở Đà Nẵng (prompt) | Cảnh nhìn thấy | Ảnh hưởng tới cầu |
|---|---|---|---|
| Nắng hè | khoảng tháng 4–8 | trời xanh gắt, nắng chói, ảo ảnh mặt đường, sông xanh trong, ít mây | giãn nở nhiệt, cáp Thuận Phước võng thêm, khe co giãn hẹp lại; phun lửa Cầu Rồng vẫn diễn |
| Mưa (mùa mưa) | khoảng tháng 9–12 | mưa xiên, mặt đường/mặt cầu ướt bóng, phản chiếu đèn đêm, sương, sông đục phù sa, nước dâng nhẹ | dây văng Trần Thị Lý rung do mưa–gió (hiện tượng thật); phun lửa có thể tạm dừng |
| Gió mùa Đông Bắc | khoảng tháng 10–3 | cây nghiêng và lắc, sóng lớn, mây chạy nhanh, thuyền tròng trành, lửa/nước lệch gió | gió tăng theo cao độ; hanger, dây văng dao động |
| Bão | khoảng tháng 9–11 | trời tối sầm giữa ngày, mưa trắng trời, gió giật, chớp, nước dâng | cấm lưu thông qua cầu, cấm thuyền, dừng trình diễn, cáp dao động mạnh; có **kịch bản bão** tự chạy |

- Chế độ **"Hiện trạng"** (`now`, mặc định) phải giữ nguyên từng điểm ảnh và từng draw call như trước.
- Không làm hỏng cái đang có: chuỗi `rand()` có seed, draw call góc nhìn cũ, ngày/đêm, Tour, thuyết minh, test hiện tại.
- Thứ tự ưu tiên của prompt: **P1** khung trạng thái + khí quyển + mưa + mặt ướt → **P2** gió (cây, sóng, cáp) + bão (chớp, đóng cầu, nước dâng) + bảng "Ảnh hưởng tới cầu" → **P3** kịch bản bão có lời dẫn, nắng hè chi tiết (ảo ảnh, số giãn nở), âm thanh, sau bão (cây đổ). Đã làm đủ P1–P3 (xem mục 7, 9 cho phần thiếu).
- Đây là **mô phỏng trực quan, không phải phân tích kết cấu**: biên độ thật chỉ vài cm nên cảnh nhân hệ số phóng đại ×20; UI ghi rõ "phóng đại ×20", "tính gần đúng".

## 2. Phạm vi: có / không có
Có:
- Trạng thái liên tục `WeatherParams` (`temp, rain, wind, gust, windDir, cloud, haze, level, lightning, closed`), 5 preset, thanh cường độ, tiến dần về target theo hằng số thời gian (`state.ts`).
- Bảng ảnh hưởng thuần (`impact.ts`): gió theo cao độ, cấp Beaufort, giãn nở nhiệt, võng cáp Thuận Phước, trạng thái Mở/Cấm.
- Khí quyển (`atmosphere.ts`): sương, Sky, nắng, hemi, phơi sáng, mây, màu nước, sóng, mực nước dâng — 0 draw call mới.
- Mưa (`rain.ts`): một `InstancedMesh` vệt mưa, +1 draw call khi mưa, chống overdraw, tự hạ chất lượng, tắt trong hầm / dưới nước.
- Mặt ướt (`wetness.ts` + option `weather` của `bridgePatch`).
- Gió (`wind.ts` + option `sway` của `bridgePatch`): tán cây, hanger TP, dây văng TTL (đường cong mưa–gió + dao động gió giật) và SH, thuyền, lửa/nước/râu Cầu Rồng, mây, sóng.
- Bão: chớp (`lightning.ts`, +1 draw call lúc nháy), vận hành (`effectsHooks.ts` → `weatherFx`): dọn xe, thuyền về bến, dừng trình diễn, khoá quay Cầu sông Hàn, tắt quảng cáo, dừng Vòng quay Mặt Trời (thêm sau, `991ee46`).
- Bảng "Ảnh hưởng tới cầu" (`#wxImpact`), 3 góc nhìn `wxRiverMouth`, `wxTtlStays`, `wxStreet`.
- Kịch bản bão (`scenario.ts`): 8 mốc, hành trình camera `STORM_TOUR` (chế độ `'storm'`), chú thích `wxS1…wxS8` 9 ngôn ngữ, **thuyết minh giọng đọc vi/en/ru** (`wxStorm`, 24 clip) — D-013.
- Nắng hè (`summer.ts`): ảo ảnh mặt đường phố, võng cáp TP phóng đại (option `sag`).
- Sau bão (`fallen.ts`): 6–10 cây đổ quanh điểm nhìn, dựng lại đúng ma trận gốc.
- Âm thanh (`sound.ts` + `audio.setWeather()/thunder()`): mưa, gió, sấm, hạ nhạc nền.
- i18n đủ 9 ngôn ngữ (37 khóa thời tiết trong `vi.json`, kể cả `wxStormHintTouch` của giao diện điện thoại).
- `tests/weather-check.mjs` (`npm run test:weather`), `tests/weather-lib.mjs`, kiểm đường bay kịch bản trong `tests/tour-check.mjs`, giọng đọc kịch bản trong `tests/voice-check.mjs`.

Không có (theo 12b hoặc chưa làm, chi tiết ở mục 7 và 9):
- Ngưỡng gió bằng số cho cấm lưu thông và khoá quay cầu (`closeWind`, `swingMaxWind`) — bỏ theo 12b-1.
- Trạng thái "Hạn chế" (`wxLimited`) — chỉ Mở/Cấm.
- Thanh chỉnh hệ số phóng đại trong UI (câu hỏi 12-2: ×1 thật → ×50) — 12b-2: cố định ×20.
- Ngập phố (nước tràn Bạch Đằng) — 12b-4 đồng ý không làm, chỉ dâng mực nước sông ≤ 1,2 m.
- Tự chọn preset theo tháng (12b-6): có `CONFIG.weather.monthPreset` nhưng **chưa có mã đọc**.
- Gợn mưa trên mặt nước (+1 draw call, 12b-7 cho phép), sóng bạc đầu cửa sông, bơm hầm, xử lý riêng tàu cao `ship` của Cầu sông Hàn, ảo ảnh trên mặt cầu, dầm Thuận Phước lắc/xoắn.
- Thời tiết cho xe chạy chậm / bật đèn ban ngày khi mưa (`trafficK.speed` của prompt) — không có trong mã (đã grep `src/`).

## 3. Thông số đã dùng
Mọi số nằm trong `weatherBase` (`src/config.ts`), xuất ra `CONFIG.weather`. Đơn vị: m, m/s, °C, giây. Chú thích đầu khối: "mọi số là (ước lượng) trừ khi ghi nguồn".

**Khung chung:**

| Thông số | Giá trị | Nguồn / ghi chú | Khóa |
|---|---|---|---|
| Hạt giống ngẫu nhiên riêng | 20061001 (ngày bão Xangsane); nhiễu gió `seed + 1`, mưa `+ 2`, chớp `+ 3`, cây đổ `+ 7` | prompt mục 5.2 | `seed` |
| Bật mặc định | `false` (preset `now` no-op) | bất biến draw call | `enabled` |
| Hệ số phóng đại dao động | ×20, cố định, không có thanh chỉnh | 12b-2 | `swayExaggeration` |
| Hồ sơ gió | v(z) = v₁₀·(z/10)^α, α = 0,12, z chuẩn 10 m | mặt nước/địa hình trống; cần xác minh theo TCVN 2737 | `windAlpha`, `windRefH` |
| Nhiễu gió giật | chu kỳ 7 s, 3 tầng, bảng 256 | (ước lượng) | `gust` |
| Hệ số giãn nở nhiệt | thép 12·10⁻⁶ /°C, bê tông 10,5·10⁻⁶ /°C, nhiệt độ chuẩn 25 °C | phổ biến; cần xác minh theo TCVN 11823:2017 (prompt: bê tông 10–11·10⁻⁶) | `thermal` |
| Cáp chủ TP | nhịp 405 m, L/f = 9,5 | theo cấu hình cầu | `cableSag` |
| Thang Beaufort (ngưỡng dưới cấp 1…16, m/s ở 10 m) | 0,3 · 1,6 · 3,4 · 5,5 · 8,0 · 10,8 · 13,9 · 17,2 · 20,8 · 24,5 · 28,5 · 32,7 · 37,0 · 41,5 · 46,2 · 51,0 | thang chuẩn hoá (prompt mục 1.2); không ghi văn bản nguồn | `beaufort` |
| Hằng số thời gian tiến về target | mưa 4, ướt (khô) 40, gió 6, nhiệt 20, mây 10, mù 10, nước 30, chớp 3 s | prompt: mưa ~4 s, khô ~40 s, nước ~30 s (ước lượng) | `tau` |
| Mực nước dâng tối đa | 1,2 m (< `landY` 2,5, không ngập phố) | (ước lượng), 12b-4 | `levelMax` |
| Hướng gió mặc định | 0 rad (thổi từ Tây sang Đông, +X) | — | `windDir` |
| Lịch tháng → preset | T1–2 `monsoon`, T3–4 `now`, T5–8 `summer`, T9–10 `rain`, T11–12 `monsoon` | (ước lượng theo mùa); **chưa có mã đọc** (12b-6) | `monthPreset` |

**Preset** (tất cả `(ước lượng)`; thanh cường độ 0–100 % nhân lên `rain`, `wind`, `gust`, `level`; `presetTarget()` trong `state.ts`):

| Preset | temp | rain | wind | gust | cloud | haze | level | lightning | closed |
|---|---|---|---|---|---|---|---|---|---|
| `now` (Hiện trạng) | `null` — no-op | | | | | | | | |
| `summer` (Nắng hè) | 37 | 0 | 3 | 1 | 0,1 | 0,6 | 0 | 0 | false |
| `rain` (Mưa) | 26 | 0,7 | 6 | 3 | 0,85 | 0 | 0,4 | 0 | false |
| `monsoon` (Gió mùa Đông Bắc) | 22 | 0,25 | 14 | 5 | 0,7 | 0 | 0,2 | 0 | false |
| `storm` (Bão) | 25 | 1 | 28 | 10 | 1 | 0 | 1,2 | 0,8 | **true** |

**Khí quyển** (`CONFIG.weather.atmosphere`, mọi số ước lượng). Trọng số liên tục: `sunny = haze`, `gray = max(rain, (cloud − 0,5)·1,4)`, `stormK = min(rain, wind / 28)`.

| Thành phần | Nắng hè | Mưa (xám) | Bão | Khóa |
|---|---|---|---|---|
| Mật độ sương (gốc 0,00016) | ×(1 + 0,3·haze) = ×1,3 | ×8 ở mưa 1 (×5,6 ở mưa 0,7) | ×10 | `hazeFog`, `rainFog`, `stormFog` |
| Màu sương | be `#e8dcc4` | xám xanh `#8c9aa3` | `#5d6870` | hằng `C` trong `atmosphere.ts` |
| Sky turbidity / rayleigh | 3 / 1,0 | 12 / 3 | 20 / 4 | `sunSky`, `graySky`, `stormSky` |
| `sun.intensity` | ×1,15 | ×(1 − 0,85·mây) | thêm ×0,67 (mây 1 → ×0,1) | `sunBoost`, `sunCloud`, `stormSun` |
| `hemi.intensity` | ×1,05 | ×0,7, màu xám | ×0,5 | `hemiBoost`, `hemiGray`, `hemiStorm` |
| `toneMappingExposure` | ×1,08 | ×0,9 | ×0,8 (+ xung chớp) | `expBoost`, `expGray`, `expStorm` |
| Mây | opacity ×0,3 (`cloudThin` 0,7) | xám đậm `#7d868c`, đêm opacity 0,6, màu ×0,12 | gần đen `#2a2f33`, xoay cụm 0,004 rad/s | `cloudThin`, `cloudNightOpacity`, `cloudNightDim`, `cloudSpin` |
| Nước | `#2f6f6a`, distortion 2,0 | `#5a5a3e`, distortion 4 | `#4a4433`, distortion 7, size 0,4 (gốc 2,4 và 0,6) | `sunWave`, `grayWave`, `stormWave`, `stormSize` |
| Đêm | màu thời tiết (ban ngày) × (1 − 0,9·đêm) | | | `nightDim` |

**Mưa, mặt ướt, hiệu năng:**

| Thông số | Giá trị | Khóa |
|---|---|---|
| Số vệt; hộp quanh camera; tốc độ rơi; độ dài vệt | 6.000; 160 × 90 × 160 m; 18 m/s; 1,6 m (× 0,55–1,0 theo hạt) | `rain.count`, `box`, `fall`, `len` |
| Bề rộng vệt; độ đục tối đa; màu ban ngày | 0,03 m; 0,55; `#c4ccd4` | `rainLook` |
| Mặt ướt đường | roughness → 0,25; màu ×0,65; không đổi `envMapIntensity` (đường dùng `scene.environment`, three bỏ qua) | `wetness.roughness`, `darken` |
| Mặt ướt bê tông/thép cầu (`bridgePatch`) | màu ×0,8; roughness tối đa 0,45 | `wetness.bridgeDarken`, `bridgeRough` |
| Bỏ vệt gần; mờ tới | 1,5 m; 70 m | `perf.rainNear`, `perf.rainFadeFar` |
| Tự hạ chất lượng | cửa sổ 2 s, dưới 40 FPS lùi bậc `[1, 0,6, 0,35]`; không tự nâng; tắt khi `?test` | `perf.adaptiveWindow`, `adaptiveMinFps`, `adaptiveSteps` |
| Khung dài nhất khi đổi preset | 150 ms (test:perf dùng `CONFIG.perf.maxHitchMs` 150) | `perf.maxFrameMs` |
| pixelRatio tối đa khi mưa | 1,5 — từ `weather.perf.rainMaxPixelRatio` chuyển sang `CONFIG.perf.rainMaxRatio` ở `134d5c8` (D-018) | `CONFIG.perf.rainMaxRatio` |

**Chớp** (`CONFIG.weather.lightning`, ước lượng): khoảng cách giữa hai tia 3 s (chớp 1) → 12 s (chớp 0), nhân ngẫu nhiên 0,6–1,4; cách camera 800–3.000 m; chân mây 700 m; tia chính 12 đoạn + 3 nhánh × 5 đoạn (27 đoạn); lệch 0,1; bề rộng 0,004 × khoảng cách; hướng ±0,6 rad quanh hướng nhìn (`yawSpread`); 2–3 nháy × 60–90 ms, tắt 40–70 ms giữa nháy; `hemiPulse` +2,5, `expPulse` ×1,6, tắt trong 0,3 s; màu HDR (3, 3, 4). Sấm trễ khoảng cách / 343 m/s (hằng `SOUND` trong `lightning.ts`).

**Vận hành khi bão** (`CONFIG.weather.ops`): dọn xe trong 5 s (`clearSec`, theo prompt); thuyền về bến trong 12 s (`boatAwaySec`, ước lượng); trình diễn Cầu Rồng dừng khi gió trung bình > **10 m/s** (`showMaxWind`) hoặc mưa > **0,5** (`showMaxRain`) — ước lượng, cần xác minh thực tế (D-012: 12b chỉ bỏ ngưỡng cho cấm lưu thông và quay cầu). Cấm lưu thông / khoá quay **không có ngưỡng gió**: theo `closed`.

**Gió** (`CONFIG.weather.wind`; biên độ THẬT trước khi ×20; ước lượng):

| Đối tượng | Giá trị | Khóa |
|---|---|---|
| Dây ngắn lắc ít | biên độ × min(1, dài / 40 m) | `refLen` |
| Số đoạn dọc mỗi dây có lắc | **8** (dây 1 đoạn thì `sin(π·t)` = 0 ở mọi đỉnh, không lắc — sửa lỗi GĐ4 ở `8c7ef9e`) | `cableSegs` |
| Hanger TP | cao độ 50 m, 0,03 m ở 30 m/s, ∝ v², trần 0,06 m, ω 2,2 rad/s | `tp` |
| Dây văng TTL | rung mưa–gió cực đại 0,05 m khi gió trong [6; 18] m/s và mưa (nhận dần 0,1–0,3); không mưa `dryAmp` 0,008·(v/30)²; gió vượt 18 m/s thêm `buffet` **0,1**·(v/30)² nhận dần trong 6 m/s (`buffetRise`); ω 3,0 | `ttl` |
| Dây văng SH | cao độ 35 m, 0,015 m ở 30 m/s, trần 0,03 m, ω 2,6 | `sh` |
| Tán cây (KHÔNG ×20) | nghiêng 0,03, lắc 0,02 m/m cao ở 28 m/s, ∝ v², trần 0,06, ω 1,6 | `trees` |
| Thuyền tròng trành | × (1 + 0,08·gió) (bão 28 m/s ≈ ×3,2) | `boatRock` |
| Râu rồng | × (1 + 0,06·gió) | `whisker` |
| Sóng | tốc độ trôi × (1 + 0,04·gió); distortion + 3·(gió/28) | `waveSpeed`, `windWave` |
| Hạt Cầu Rồng | vel += gió·k·dt, lửa 1,0, tia nước 0,15, sương 1,2 (1/s) | `fire`, `water`, `mist` |

**Nắng hè** (`summer`): ảo ảnh từ 60 m, đủ ở 200 m; |cos| tia nhìn–pháp tuyến < 0,28; trộn tối đa 0,55, sáng thêm 0,12; lệch UV 0,004, 2,2 rad/s.
**Cây đổ** (`fallen`): 6–10 cây; nghiêng 80°, lệch hướng 0,3 rad; bán kính 350 m, chọn trong 40 cây gần nhất; đổ trong 3 s; giữ 120 s; "bão qua đỉnh" khi gió hiện tại ≥ 20 m/s, đổ khi gió đích ≤ 8 m/s và hết cấm.
**Âm thanh** (`sound`): mưa gain 0,2, bandpass 3.500 Hz Q 0,6, lowpass 6.500 Hz, tối đa 28 "tí tách"/s; gió gain 0,4 (∝ (v/28)²), bandpass 180 + 22·v Hz, Q 1,6; sấm lowpass 120–300 Hz, rền 2–4 s, gain 1,1 ở 800 m; nhạc nền ×0,7 khi bão (−30 %); trong hầm / dưới nước còn 15 %.
**Kịch bản bão** (`scenario`): 120 s khi không có giọng; `arrive` 0,45; `pad` 1,2 s; vòng cung bay vào `entryArc` 0,15 × khoảng cách, tối đa 250 m. Mốc (target cộng dồn từ trạng thái trung tính):

| Mốc (s) | Đặt | Chú thích |
|---|---|---|
| 0 | wind 6, cloud 0,6 | `wxS1` |
| 15 | wind 10, cloud 0,9, rain 0,3 | `wxS2` |
| 30 | wind 15, rain 0,6 | `wxS3` |
| 45 | wind 22, gust 8, rain 0,9, lightning 0,5 | `wxS4` |
| 60 | wind 28, gust 10, rain 1, level 0,8, **closed true** | `wxS5` |
| 80 | level 1,2, lightning 0,9 | `wxS6` |
| 95 | wind 12, gust 3, rain 0,5, lightning 0,2 | `wxS7` |
| 110 | wind 3, gust 0, rain 0, cloud 0,3, lightning 0, level 0,2, closed false | `wxS8` |

Có giọng đọc thì cửa sổ mỗi mốc = max(gốc, clip + 1,2 s). Tính từ `public/voice/manifest.json`: tổng ≈ 122,4 s (vi), 124,7 s (en), 125,7 s (ru) — khớp "khoảng 2:00–2:10" của memory bank.

**Số nằm trong mã, chưa vào `CONFIG`:** hiệu ứng "giãn nở" chỉ hiện khi nhiệt độ ≥ chuẩn + 8 °C (`impact.ts`); võng chỉ hiện khi > 0,005 m (`weatherUI.ts`); ngưỡng 1e-3 cho mưa/ướt coi như 0 (`index.ts`); vận tốc âm 343 m/s; camera kịch bản không thấp hơn y = 3 m (`scenario.ts`); bảng ảnh hưởng vẽ lại 2 lần/giây.

**Gió tại cao độ khi bão (`impact()`, v₁₀ = 28):** Rồng 28,0 m/s (cấp 10), Thuận Phước 32,1 (cấp 11), Trần Thị Lý 28,9, sông Hàn 29,1 (số đo GĐ6). GĐ1 kiểm v₁₀ = 25 → TP ≈ 29 m/s (prompt mục 1.6).
**Giãn nở / võng ở `summer` (37 °C):** võng thêm TP 0,107 m (×20 ≈ 2,1 m, số đo GĐ7). Ước tính của prompt (mục 1.6) giữ để đối chiếu: Cầu Rồng 666 m, ΔT 13 → ΔL ≈ 0,10 m; cáp TP L 405 m, f ≈ 42,6 m, S ≈ 417 m, ΔT 25 → ΔS ≈ 0,125 m, Δf ≈ 0,22 m (bỏ qua chuyển vị đỉnh tháp và độ cứng dầm). Bảng gió prompt (v₁₀ 25, α 0,12): mặt Rồng ≈ 10 m → 25; SH 13,8 m → 26; TTL ≈ 13,2 m → 26; TP 31,6 m → 29; đỉnh tháp TTL 145 m → 34; đỉnh tháp TP 91,5 m → 33. `impact()` dùng `CONFIG.length` (666) cho Rồng và `totalLength` cho các cầu khác (TP 1.856 m là tổng cả cầu, chỉ tham khảo giãn nở); Hầm không chịu gió, không giãn nở.

**Số liệu thật trong mục 1 của prompt — chưa xác minh.** Prompt dặn tra rồi ghi link; mã và memory bank không có link nào, các chú thích config vẫn ghi "cần xác minh". Giữ nguyên ở đây để tra sau:
- Khí hậu (nguồn gợi ý: Đài KTTV khu vực Trung Trung Bộ, QCVN 02:2022/BXD, Tổng cục KTTV): mùa khô/nóng khoảng tháng 1–8, nóng nhất 5–8; nhiệt độ cao nhất mùa hè khoảng 35–38 °C, có ngày gần 40 °C; mặt đường/mặt cầu dưới nắng cao hơn không khí 10–20 °C (tài liệu mặt đường bê tông nhựa); mùa mưa khoảng 9–12, nhiều nhất 10–11; lượng mưa năm khoảng 2.000–2.500 mm; gió mùa Đông Bắc khoảng 10–3; mùa bão ảnh hưởng Đà Nẵng tập trung 9–11.
- Thang Beaufort (bảng mô tả UI của prompt): 0–3 < 5,5 m/s lặng/gió nhẹ; 4–5 5,5–10,7 gió vừa; 6 10,8–13,8 gió mạnh; 7 13,9–17,1 gió rất mạnh (áp thấp nhiệt đới cấp 6–7); 8–9 17,2–24,4 bão; 10–11 24,5–32,6 bão mạnh; 12–15 32,7–50,9 bão rất mạnh; ≥ 16 ≥ 51,0 siêu bão. Phân cấp bão theo Quyết định 18/2021/QĐ-TTg: cần xác minh số hiệu và ngưỡng.
- Cường độ mưa: nhỏ / vừa / to / rất to theo lượng mưa 24 h (khoảng 16–50 / 51–100 / > 100 mm cho vừa / to / rất to), cần xác minh theo ngành KTTV; trong cảnh chỉ ánh xạ sang mật độ hạt và tầm nhìn (thanh cường độ).
- Sự kiện tham khảo (cho lời dẫn, cần xác minh ngày và số liệu): bão Xangsane (số 6/2006) đổ bộ khoảng 30/9–1/10/2006, một trong những cơn mạnh nhất vào Đà Nẵng (dùng làm `seed`); bão Nari (số 11/2013) khoảng 15/10/2013; bão Noru (số 4/2022) khoảng 27–28/9/2022, thành phố cấm lưu thông qua các cầu lớn (cần xác minh danh sách cầu, giờ cấm); mưa lớn lịch sử khoảng 14–15/10/2022, nhiều phố trung tâm ngập sâu. Kịch bản đã xây là giả định, không nhắc tên các cơn bão này.
- Kỹ thuật: vùng áp lực gió Đà Nẵng II.B (W₀ ≈ 95 daN/m², cần xác minh theo TCVN 2737) — không dùng trong mã; rung dây do mưa–gió thường gặp ở gió 6–18 m/s kèm mưa nhỏ–vừa, dây nghiêng 20–45°, tần số 1–3 Hz (ngưỡng cụ thể cần xác minh) — mã dùng dải 6–18 m/s; vận tốc tới hạn flutter Cầu Thuận Phước: **không có nguồn, không ghi số**, chỉ mô tả định tính; ngưỡng cấm lưu thông (thông báo UBND / Sở GTVT) và ngưỡng dừng quay cầu (quy trình vận hành cầu quay): không có nguồn → 12b-1 "theo thông báo của thành phố", không đặt số.

## 4. Hình dạng, hành vi như đã xây
Thư mục `src/environment/weather/` (theo mẫu `environment/riverfront/`, không kế thừa `BridgeBase`):
- `index.ts`: `buildWeather()` gọi theo thứ tự `buildAtmosphere` (chụp gốc) → `buildWetness` → `buildRain` → `buildSummer` → `buildFallen` → `buildWind` → `buildLightning`; `updateWeather(dt, time, night, cam)` mỗi khung: kịch bản → `stepWeather` → `applyAtmosphere` → `applyWetness` → `updateWind` → `updateRain` (tắt khi `hrInside()` hoặc camera dưới mặt nước) → `updateLightning` → `updateSummer` → `aftermath` (cây đổ) → âm thanh → `updateHooks`, rồi ghi `weatherU`. `setWeatherPreset(name)` dừng kịch bản (không trả preset cũ) và dựng lại cây; `enabled = name !== 'now'`. API test trong `window.__app.weather`: `setPreset`, `setIntensity`, `setRainCount`, `wetMaterials`, `impact`, `windAt`, `beaufort`, `setParams(p, instant)`, `sway`, `fx`, `lightning.strike()/flashing()/stats`, `fallen.fell()/stand()/snapshot()`, `scenario`.
- `state.ts` (thuần, không import three): `WeatherParams`, `neutralParams()` (đích của `now`), `presetTarget()`, `setPreset()`, `stepWeather()` (tiến mũ theo `tau`; `wet` lên theo `tau.rain`, khô theo `tau.wet`), `gustNoise()` (3 tầng nội suy cosin trên bảng `rng(seed + 1)`), `windNow = wind + gust·g(t)`.
- `impact.ts` (thuần): `windAt`, `beaufort`, `expansion`, `cableSag`, `bridgeImpacts()` → mỗi công trình `{ key, windDeck, windTop, level, status, effects, expand, sag }`; `effects` gồm `rainWindCable` (TP/TTL/SH khi có mưa và gió), `thermal`, `closed` / `swingLocked` (SH); Hầm luôn `open`, gió 0. Kiểu `BridgeStatus` còn giữ giá trị `'limited'` nhưng không mã nào gán (xem mục 7).
- `atmosphere.ts`: điều biến SAU `applyNight()` (D-009); giá trị applyNight không đặt lại (mật độ sương, Sky, `distortionScale`, `size`, `water.position.y`, màu mây, xoay mây) chụp lúc build; khi cả ba trọng số ≈ 0 và `level` ≈ 0 thì `restore()` trả đúng gốc một lần rồi không đụng gì (`now` no-op, storm → now khớp tuyệt đối). Mây xoay bằng `spin` cộng dồn, về 0 khi restore. Nước dâng = `water.position.y += level`.
- `rain.ts`: một `InstancedMesh` quad mảnh, thuộc tính `aP0` sinh một lần bằng `rng(seed + 2)`; vertex shader gói vòng quanh `cameraPosition`, xiên theo gió, bỏ vệt < `rainNear` (đưa ra ngoài clip space), alpha mờ theo khoảng cách (varying); CPU chỉ cộng dồn `uOffset`. `mesh.count = round(N·mưa·bậc)`; layer 1, không đổ bóng, `frustumCulled = false`, `depthWrite = false`. Program biên dịch sẵn lúc build (`renderer.compile`, hai render target). `rainShowing()` cho bộ quản lý chất lượng giới hạn pixelRatio (D-018).
- `wetness.ts`: `registerWet(mat)` đăng ký tường minh (không dò tên): `MAT.road`, `MAT.road2`, `MAT.paver`, `MAT.stone` + `mats.road` của TP, TTL, SH; roughness và màu lerp theo `wet`, chụp gốc, `wet < 1e-3` thì trả đúng gốc một lần. Bê tông/thép/tháp của TP, TTL, SH (và sau này Vòng quay) bật option `weather: true` của `bridgePatch` (đọc `uWet`).
- `wind.ts`: vá `MAT.leaf`, `MAT.palm` (dịch tán theo `uWindDir`, tỉ lệ độ cao, pha theo vị trí instance; thân và bóng không lắc); `updateWind()` tính `uSwayTp/Ttl/Sh`, `uTreeLean/Sway` và `windFx` (thuyền, râu, lửa/nước, sóng). Option `sway: 'tp'|'ttl'|'sh'` của `bridgePatch` dịch đỉnh SAU khi nhân `instanceMatrix`/`modelMatrix` (không gian thế giới, vì `segmentMatrix` co bán kính), dạng `sin(π·t)`, `t = position.y + 0.5`, hướng chính vuông góc dây + 35 % hướng thứ hai (quỹ đạo elip). Hình trụ dây có `cableSegs` = 8 đoạn (`thuan-phuoc/cables.ts`, `tran-thi-ly/stays.ts`, `song-han/swingSpan.ts`).
- `lightning.ts`: một mesh ribbon `MeshBasicMaterial` dựng sẵn (27 đoạn), mỗi lần chớp chỉ ghi lại buffer (`rng(seed + 3)`); xung `hemi` + exposure; tắt khi camera trong hầm / dưới nước; không thêm hay bật/tắt đèn.
- `effectsHooks.ts` (D-012): ghi `weatherFx` (`core/shared.ts`: `clear`, `boatAway`, `showAllowed`, `swingBlocked`, `wheelStopped`) theo `current.closed`; `attachSwing(ctrl)` gán `ctrl.canStart`; đang mở thì `requestClose()`; `setAdsSuppressed(closed)`. Mã có sẵn chỉ đọc: xe ẩn dần bằng `vanished(i, k)` (thứ tự cố định theo chỉ số, không `rand()`) ở `environment/traffic.ts` (`PATHS.axis`, `PATHS.ttl`) và `common/traffic.ts` (`stepTraffic(…, closable)`; Hầm truyền `false`); thuyền chậm dần + ẩn dần (`common/boats.ts`, `updateBoats`); `BridgeBase.life` ẩn khi `clear = 1` (trừ `closable = false`); `updateShow` đặt khoá `sWeather`; `swingUI.ts` hiện lý do khi `swingBlocked`. `lifeOn`, `show.on`, nút quảng cáo không bao giờ bị ghi.
- `scenario.ts` (D-013): dòng thời gian, target cộng dồn, `on.caption/end`, `start({speed, from})`, `stop(restore)`, `releaseCamera()`, `pose(t)` thuần theo `t` (Catmull-Rom mở centripetal qua `STORM_TOUR`, điểm `via` để tránh mô hình, chậm ở hai đầu; đoạn bay vào điểm đầu theo vòng cung), `focus()`. Cửa sổ mỗi mốc kéo dài theo giọng đọc (`narration.duration('wxStorm', k)`), tính lại khi bật/tắt giọng hoặc đổi ngôn ngữ, giữ vị trí (mốc + tỉ lệ). Hết giờ hoặc `stop(true)` trả preset + thanh cường độ cũ, tắt `enabled` nếu preset cũ là `now`; không đổi ngày/đêm. Chế độ camera `'storm'` ở `views/camera.ts`.
- `STORM_TOUR` (`views/tourStops.ts`): cửa sông (như `wxRiverMouth`) → trên sông quanh Cầu sông Hàn (thuyền về bến) → đầu rồng từ mặt sông phía Bắc → [via: vượt Cầu Rồng trên cao] → dây văng TTL phía Bắc cầu, sát giữa chùm dây dài ~80 m → Cầu sông Hàn (như `shOverview`) → [via: vượt Thuận Phước trên đỉnh tháp] → vịnh Thuận Phước (như `tpBay`) → trên cao nhìn thành phố (gần `tpBoth`) → phố bờ Tây Cầu Rồng (cây đổ quanh target).
- `summer.ts`: vá `MAT.road`, `MAT.road2` (`onBeforeCompile`): nhìn sát mặt và xa hơn 60 m thì trộn `fogColor` + dao động UV, cường độ `uHaze·(1 − đêm)`; `updateSummer` đặt `weatherU.uSagTp = Δf × 20`, option `sag: 'cable'|'hanger'` của `bridgePatch` võng cáp chủ + đầu trên hanger TP theo `Δf·sin(πu)`, chỉ nhịp chính.
- `fallen.ts`: tìm cặp `InstancedMesh` thân–tán (cùng chỉ số, anh em liền kề), chọn bằng `rng(seed + 7)`, lưu ma trận gốc, nghiêng quanh gốc theo hướng gió, `stand()` ghi lại đúng bản gốc; bỏ qua instance đã dọn scale 0 (hầm, riverfront). `aftermath()` trong `index.ts`: gió từng ≥ 20 m/s rồi gió đích ≤ 8 m/s và hết `closed` → đổ quanh `scenario.focus()` (đang chạy kịch bản) hoặc `controls.target`; dựng lại sau 120 s, khi gió đích tăng lại, khi chọn preset khác `now`, hoặc khi kịch bản kết thúc/dừng.
- `sound.ts`: gọi `audio.setWeather` ~10 lần/giây, `audio.thunder()` khi `lightning.stats.count` tăng (trễ `thunderDelay`, to ∝ 800 m / khoảng cách). Mưa = nhiễu trắng bandpass + "tí tách" `Math.random` (không `rand`), gió = nhiễu nâu bandpass trượt theo v, sấm lowpass; chỉ khi người xem bật âm thanh.

Nối vào mã có sẵn: `main.ts` gọi `buildWeather()` sau `buildRiverfront()` và sau `new SunWheel()` (sau mọi `rand()`), `updateWeather()` ngay sau `applyNight()`, `weather.attachSwing(songHan.ctrl)`, `weather` và `audio` trong `window.__app` (`?test`); `main.ts` nhân tốc độ trôi pháp tuyến nước với `windFx.waveSpeed`.

## 5. Tương tác, UI, i18n, thuyết minh
- `.panel.brand` (`index.html`, khối `.weather-row`): `select#weatherSel` (Hiện trạng / Nắng hè / Mưa / Gió mùa / Bão), `input#weatherK` (0–100, cường độ), `button#btnWxImpact.toggle` + `div#wxImpact`, `button#btnWxStorm` (Kịch bản bão / Dừng kịch bản). Logic ở `src/ui/weatherUI.ts` (`setupWeatherUI(toggle)`, `setupScenarioUI`), CSS `.weather-row`, `.wx-*` trong `src/styles/main.css`.
- Thẻ "Ảnh hưởng tới cầu": mỗi công trình một ô gồm tên, chip Mở/Cấm, gió tại mặt cầu (m/s, cấp) + đỉnh tháp, "Rung dây do mưa–gió (biện pháp: gân xoắn trên ống bọc, giảm chấn)" (`wxRainWind`, theo prompt mục 2.3; ống HDPE gần neo `hdpeR`/`hdpeLen` không có hiệu ứng riêng), giãn nở và võng cáp (chỉ khi nóng), "Không quay cầu", "Cấm lưu thông theo thông báo của thành phố"; Hầm luôn ghi "Hầm vẫn lưu thông, không chịu gió, bơm thoát nước làm việc (phương án đề xuất)" (`wxTunnelOk`); dòng chú thích "Mô phỏng trực quan, phóng đại ×{k}, số liệu tính gần đúng — không phải phân tích kết cấu" lấy `k` từ `swayExaggeration`. Vẽ lại 2 lần/giây chỉ khi đang mở và nội dung đổi, vẽ lại khi đổi ngôn ngữ; có `max-height` và cuộn trong thẻ.
- Cầu sông Hàn: bão thì `ctrl.start()` trả `false`, sự kiện `swingBlocked`, dòng lý do `swingWeather` trong `swingUI.ts`; trong Tour Cầu sông Hàn thêm "Tạm hoãn quay cầu do thời tiết." (`wxSwingTour`) vào `#tourText`, Tour không treo (`fromTour` không bị giữ khi bị từ chối).
- Cầu Rồng: trình diễn tạm dừng hiện "tạm dừng do thời tiết" (`sWeather`); `show.on` giữ nguyên.
- Góc nhìn mới (`views/presets.ts`, nút trong `index.html`): `wxRiverMouth` (nhóm `tp`) pos [260, 36, TPZ − 330] → [0, 30, TPZ]; `wxTtlStays` (nhóm `ttl`) pos [70; 14,6; 1.309] → [−140, 60, 1300], `maxPolar` 0,97π (cùng khung với `ttlDeck`); `wxStreet` (nhóm `dragon`) pos [−299; 1,8; 120] → [−200, 8, 0], `maxPolar` 0,97π.
- Kịch bản bão: khung `#wxScenario` (cùng kiểu `#tourCaption`: đồng hồ `#wxScenarioTime`, `#wxScenarioText`, thanh `#wxScenarioBar`), `body.wxrun` ẩn bảng Thông số; dòng hướng dẫn `wxStormHint` (chuột) / `wxStormHintTouch` (cảm ứng, D-019). Kéo chuột / cuộn / Esc / bấm góc nhìn chỉ `releaseCamera()` — thời tiết chạy tiếp (giống `exitTour`); bấm "Dừng kịch bản" trả preset ngay. Người xem chọn preset / kéo thanh cường độ khi kịch bản chạy → kịch bản dừng, KHÔNG trả preset cũ.
- Chú thích `wxS1…wxS8` mô tả đúng nơi camera đang tới, ví dụ `wxS1` "Cửa sông Hàn — bản tin giả định: bão mạnh cấp 11 trên Biển Đông, dự kiến ảnh hưởng Đà Nẵng", `wxS5` "Cầu sông Hàn — cấm lưu thông qua các cầu theo thông báo của thành phố; không quay cầu", `wxS8` "Phố ven sông bờ Tây — sau bão: thông xe, mở lại cầu, dọn cây đổ".
- **Thuyết minh** (D-013, người dùng đổi 12b-3 ngày 2026-10-22): khóa `wxStorm` trong `scripts/narration/{vi,en,ru}.json`, 8 clip mỗi ngôn ngữ (`public/voice/{vi,en,ru}/wxStorm-0…7.mp3`, 24 clip, `8c7ef9e`). Lời mở đầu nói rõ "kịch bản giả định, không phải bản tin thật", lời cuối nói kịch bản kết thúc. Lời mốc 4 nói cố định "hai mươi lần" = `swayExaggeration` (đổi hệ số thì sửa lời và chạy lại `gen:voice`). Đang xem Tour thì kịch bản nhường giọng cho Tour.
- i18n: 37 khóa thời tiết × 9 ngôn ngữ, sinh bằng `scripts/add-weather-locales.mjs` (mảng theo giai đoạn K6/T6, K7/T7): `weather, wxNow, wxSummer, wxRain, wxMonsoon, wxStorm, wxIntensity` (GĐ2); `sWeather, swingWeather` (GĐ5); `wxImpact, wxImpactNote, wxWindDeck, wxWindTop, wxOpen, wxClosed, wxClosedNote, wxThermal, wxSag, wxRainWind, wxSwingBlocked, wxSwingTour, wxTunnelOk, vWxRiverMouth, vWxTtlStays, vWxStreet` (GĐ6); `wxStormRun, wxStormStop, wxStormHint, wxS1…wxS8` (GĐ7); `wxStormHintTouch` (giao diện điện thoại). Đã kiểm 8 ngôn ngữ còn lại không thiếu khóa nào so với `vi` (script node, 2026-11-08). `ar` có `dir=rtl`, thẻ lật đúng bên (ảnh GĐ6).

## 6. Ràng buộc đã tuân thủ
- **`rand()` có seed (bất biến 1).** `buildWeather()` sau mọi lệnh dùng `rand` (sau `buildRiverfront()` và `new SunWheel()`). Mọi ngẫu nhiên mới dùng `rng(CONFIG.weather.seed + k)`; không thêm/bớt `rand()` trong `effects.ts`, `traffic.ts`; xe ẩn dần theo chỉ số (`vanished`), cây đổ `rng(seed + 7)`; tiếng "tí tách" dùng `Math.random` như phần nhạc.
- **Draw call (bất biến 2, D-009).** Preset `now` chênh 0: `test:drawcalls` 52/52 chênh 0 ở GĐ2–GĐ5 và 58/58 khớp bảng GĐ8 sau GĐ6 (thêm 3 góc `wx*`). Bảng `now` (`tests/KET-QUA.md`, ngày / đêm): `wxRiverMouth` 281 / 281 trước vòng quay, 283 / 283 sau (+2 do Vòng quay); `wxTtlStays` 168 / 168; `wxStreet` 286 / 286. Cột "ngày" của ba góc `wx*` thực ra đo ban đêm (lỗi `tests/drawcalls.mjs` sau `rfHearts`, xem `KET-QUA.md`). Preset khác: mưa +1 (`rain` 60 % + gió 12 m/s = `now` + 1 ở 3 góc `wx*`, ngày và đêm — đo trong `weather-gd6-shots.mjs`, không có trong `test:drawcalls`); bão +1 lúc chớp (`test:weather`: ≤ now + 2, lấy max 10 khung có chớp); ngân sách 12b-7 ≤ +3 (prompt đề xuất ≤ +2; người dùng cho thêm +1 để làm gợn mưa trên mặt nước, chưa làm). Mưa, chớp ở layer 1, không đổ bóng, không pass hậu kỳ. Số draw call từng preset chưa ghi vào `KET-QUA.md`.
- **Vật liệu dùng chung.** Chụp giá trị gốc, trả về đúng khi `now` (so `===` trong `test:weather` GĐ2, GĐ7). Nhánh shader no-op khi uniform = 0 (`uWet`, `uSway*`, `uHaze`, `uSagTp`); `bridgePatch` option mặc định tắt, chuỗi cache key cũ giữ nguyên khi tắt.
- **Không khựng (D-010, D-018).** Ướt/lắc/mưa điều khiển bằng uniform; không đổi `defines`/`transparent`/số đèn theo preset; mesh mưa + tia chớp biên dịch sẵn lúc build; `core/prewarm.ts` (D-018) vẽ thật một lần mọi object. `test:perf --strict`: "bật mưa" / "tắt mưa" ≤ 150 ms, 0 program mới.
- **Đèn (bất biến 5).** Không `PointLight`/`SpotLight`; chớp chỉ đổi cường độ `hemi` + exposure, mesh tia `MeshBasicMaterial` HDR cho bloom.
- **Không thư viện, không ảnh ngoài.** Âm thanh Web Audio tổng hợp; không texture mới.
- **Mọi thông số ở `src/config.ts`** (khối `weatherBase` có chú thích tiếng Việt, đơn vị, `(ước lượng)` / "cần xác minh"); ngoại lệ trong mã liệt kê cuối mục 3.
- **"Phương án đề xuất" (bất biến 6).** Mọi chữ về Hầm giữ nhãn: `wxTunnelOk` "(phương án đề xuất)". Kịch bản bão nói rõ là giả định: `wxS1` "bản tin giả định", lời đọc mở đầu "kịch bản giả định, không phải bản tin thật".
- **Hành lang Hầm `|z + 1700| < 30`.** `STORM_TOUR` không đặt điểm trên hành lang.
- **Hầm khi bão.** Không mưa, không chớp trong hầm (`hrInside()`); `closable = false` nên hầm vẫn lưu thông; âm thanh mưa/gió còn 15 % trong hầm.

## 7. Khác so với ý định ban đầu
- **Không có `closeWind` / `swingMaxWind` (12b-1, D-012).** Prompt mục 5.2 và GĐ5 đặt `closed` theo `closeWind`, khoá quay theo `swingMaxWind`; câu hỏi 12-1 đề xuất cấm khi ≥ cấp 10, không quay khi ≥ cấp 6. Người dùng chọn "theo thông báo của thành phố": cấm lưu thông, khoá quay cầu (và tắt quảng cáo, dừng Vòng quay) bật theo **trạng thái** `closed` — preset Bão và mốc 60 s của kịch bản. Thẻ và `wxS5` ghi "Cấm lưu thông theo thông báo của thành phố". `test:weather` chỉ kiểm theo trạng thái.
- **Không có trạng thái "Hạn chế" / khóa `wxLimited` (12b-1).** Prompt mục 8.1 và `impact.ts` mục 5.1 có ba mức Mở / Hạn chế / Cấm. Đã xây: chỉ Mở/Cấm theo `closed`; kiểu `BridgeStatus` trong `impact.ts` vẫn liệt kê `'limited'` nhưng không mã nào gán.
- **Không có khóa `wxBeaufort` riêng.** Cấp Beaufort nằm trong `wxWindDeck` ("Gió tại mặt cầu: {v} m/s · cấp {b}"). Thêm các khóa ngoài danh sách tối thiểu: `wxWindTop`, `wxClosedNote`, `wxSwingTour`, `swingWeather`, `wxStormHint`, `wxStormHintTouch`.
- **Kịch bản bão là hành trình camera có thuyết minh vi/en/ru (12b-3 đổi, D-013).** 12b-3 ban đầu: "Để sau — không làm thuyết minh, không chạy `gen:voice`, chỉ chú thích chữ". GĐ7 làm đúng như vậy, và camera chỉ `setView()` tới 3 góc tĩnh (`wxRiverMouth` mốc 0, `wxTtlStays` mốc 45, `tpBay` mốc 60) như prompt mục 6. Ngày 2026-10-22 người dùng đổi: thêm giọng đọc (24 clip `wxStorm`) và camera bay liên tục qua `STORM_TOUR` (lời đọc nói về thuyền, Cầu Rồng, Cầu sông Hàn trong khi camera đứng ở chỗ khác; mốc 4–7 đứng yên ở vịnh TP; clip bị giới hạn ≤ khoảng cách mốc − 1,2 s). Bỏ `cam` khỏi `scenario.steps` và bỏ `on.camera`; thời lượng kéo dài theo giọng (khoảng 2:00–2:10). Chú thích `wxS1…wxS8` viết lại để mô tả nơi camera tới (prompt: "Bản tin: bão mạnh cấp 11…", "Cấm tàu thuyền hoạt động trên sông Hàn", …).
- **Dây hình trụ 8 đoạn (sửa lỗi GĐ4, `8c7ef9e`).** Prompt mục 4.5 dặn lấy `t` từ `position.y + 0.5` của `CylinderGeometry` nhưng không nói số đoạn. Hanger TP, dây văng TTL/SH dựng bằng hình trụ 1 đoạn nên `sin(π·t)` = 0 ở mọi đỉnh — uniform `uSway` có giá trị mà dây KHÔNG lắc trên hình (người dùng phát hiện ở mốc 4 kịch bản). Sửa: `CONFIG.weather.wind.cableSegs` = 8, 0 draw call thêm. `test:weather` thêm kiểm điểm ảnh ở mốc 4 (uSway 1 m phải đổi > 200 px). Mẫu đã ghi ở `systemPatterns.md`.
- **Dao động do gió giật của dây TTL (`buffet`, `8c7ef9e`).** Prompt: biên độ dây "giảm khi gió quá mạnh". Đã xây đúng đường cong mưa–gió, nhưng gió bão vượt dải (> 18 m/s ở 50 m) chỉ còn `dryAmp` ≈ 0,13 m hiển thị (×20). Người dùng muốn rõ hơn: thêm `buffet` 0,1 m → ≈ 2,2 m hiển thị ở mốc 4; ×20 giữ nguyên vì lời đọc nói "hai mươi lần". Camera mốc 4 cách giữa chùm dây dài ~80 m.
- **Mốc 30 s của kịch bản.** Prompt: dừng phun lửa, khoá quay Cầu sông Hàn, quảng cáo tắt. Đã xây: khoá quay và tắt quảng cáo theo `closed` ở mốc 60 s (12b-1), nên `wxS3` chỉ nói "tạm dừng trình diễn" — trình diễn dừng tự động vì mưa 0,6 > `showMaxRain`. Mốc 95 thêm `gust 3, lightning 0,2`; mốc 110 thêm `gust 0, lightning 0, level 0,2, closed false` (prompt chỉ ghi wind/rain/cloud). Mốc 80 "sóng bạc đầu cửa sông" chưa có.
- **Kịch bản không đổi ngày/đêm.** Prompt mục 8.1: kịch bản tự đặt ban ngày (`dayNight.target = 0`) rồi trả lại. Đã xây: không đụng ngày/đêm; hết giờ chỉ trả preset + thanh cường độ (`test:weather` kiểm ngày/đêm không đổi).
- **Kịch bản tính thời gian theo `dt` đã kẹp 0,05 s** (như `stepWeather`), nên máy chậm thì kịch bản dài hơn 120 s thực.
- **Cây đổ.** 12b-5 "chân thật nhất có thể". Đã xây: đổ quanh điểm nhìn, giữ 120 s rồi dựng lại (tự dựng khi chọn preset khác `now`) — chân thật nhưng không kẹt. Sau `8c7ef9e` cây đổ ở mốc cuối quanh `scenario.focus()` chứ không quanh `controls.target`.
- **Ảo ảnh chỉ trên đường phố** (`MAT.road/road2`); mặt cầu có vật liệu riêng (`bridgePatch`) nên chưa có ảo ảnh (prompt: "vật liệu đường").
- **Mặt ướt không đổi `envMapIntensity`** (prompt mục 4.4): đường dùng `scene.environment` nên three bỏ qua giá trị này.
- **Trọng số khí quyển liên tục**, không theo tên preset (`sunny`, `gray`, `stormK`); thanh cường độ co giãn mượt. Mật độ sương mưa ×8 ở mưa 1 (prompt ×5 → ×8 theo rain).
- **Mưa.** Prompt: quad 0,02 × 0,5–1,2 m, hộp 160 × 80 × 160 m, vFall ≈ 9 m/s, `uCamSnap` làm tròn theo lưới. Đã xây: bề rộng 0,03 m, dài 0,88–1,6 m, hộp 160 × 90 × 160 m, rơi 18 m/s, gói vòng theo `cameraPosition` (hạt cố định theo thế giới, không nhảy khi camera đi).
- **Chớp.** Prompt: trung bình 1 lần mỗi 6–15 s khi bão, ~12 đoạn có nhánh, vị trí ngẫu nhiên 800–3.000 m. Đã xây: 3–12 s × 0,6–1,4 theo cường độ chớp, 12 + 3 × 5 đoạn, hướng trong ±0,6 rad quanh hướng nhìn (lần chụp đầu ±1 rad thì `tpBay` không bắt được tia trong khung).
- **pixelRatio khi mưa** chuyển từ `rain.ts` (`weather.perf.rainMaxPixelRatio` 1,5) sang bộ quản lý chất lượng `CONFIG.perf.rainMaxRatio` 1,5 ở `134d5c8` (D-018). Biên dịch trước dùng `renderer.compile` trong `buildRain`/`buildLightning` và sau này `core/prewarm.ts`, không gọi `compileAsync` trong `buildWeather()` như prompt mục 9.
- **Tên nút.** Prompt `button#btnStormRun.toggle`; đã xây `button#btnWxStorm`.
- **Tên hàm/điểm nối.** Prompt `weatherAllowsShow()`, `trafficK`, `boatK`, `setLifeVisible(false)`; đã xây nguồn duy nhất `weatherFx` (D-012), `BridgeBase.life` ẩn khi `clear = 1`, quảng cáo qua `setAdsSuppressed()` (prompt `setAdsEnabled(false)`). Prompt mục 5.1 `snapshotAtmosphere()`, `applyWeather(w, night, time)`, `runStormScenario()`: đã xây `buildAtmosphere()`, `applyAtmosphere(state, night, dt)`, `scenario.start()`.
- **`updateWeather` nhận `camera` từ khi cần** (GĐ1 chưa có tham số này; nay `updateWeather(dt, time, night, cam)`).
- **Chưa làm từ prompt mục 2:** vảy rồng (`MAT.scale`) lóa nắng và thân rồng ướt bóng (vật liệu Cầu Rồng không có option `weather`; chưa đối chiếu mặt đường Cầu Rồng có dùng `MAT.road` không); người đi bộ trên Cầu Rồng (không có trong mã); dầm Thuận Phước lắc ngang/xoắn (P3) và lời dẫn Tacoma Narrows 1940; đèn hàng không tháp TP "thấy rõ qua mưa" (không có xử lý riêng); thuyền vùng cửa sông về bến — có, chung cho mọi thuyền; tàu cao `ship` của Cầu sông Hàn không qua luồng — chưa xử lý riêng; sóng bạc đầu; gờ chắn ngập / nước chảy xuống dốc hầm hở, mái lam ướt, bơm hầm; xe chạy chậm và bật đèn ban ngày khi mưa; gợn mưa riêng trên mặt nước (+1, 12b-7 cho phép). LED trái tim riverfront vẫn chạy khi mưa (không có mã chặn).
- **Lời dẫn P3 về sấm** ("đếm giây giữa chớp và sấm, nhân 343 m") không có trong `wxStorm` (chưa đối chiếu từng câu ngoài bản vi; bản vi không nhắc).
- **Test mục 11 khác prompt** (xem mục 8): item 1 (no-op 6 góc) thay bằng `test:drawcalls` toàn bộ; item 3 chỉ kiểm bão ≤ now + 2 (mưa ≤ now + 1 đo trong script ảnh GĐ6); item 5 (mưa ẩn ở `hrGallery`) và 7c (pixelRatio) không có trong `weather-check.mjs`; 7b (khung dài nhất) nằm ở `test:perf` (D-018). `tests/KET-QUA.md` ghi "rain ≤ now + 1 … được kiểm trong `test:weather`" — không khớp mã hiện tại (`weather-check.mjs` chỉ có kiểm bão).
- **Bảng `KET-QUA.md` không có cột/khối preset thời tiết** (prompt GĐ8): log GĐ8 chỉ ghi `now`.
- **Báo cáo mục 13 của prompt** (draw call từng preset, FPS SwiftShader, link nguồn mục 1): chưa có số FPS, chưa có link, chưa có bảng preset.

## 8. Kiểm tra
- `tests/weather-check.mjs` (`npm run test:weather`, dùng `tests/weather-lib.mjs`: `snapAtmosphere`, `setWx`):
  - GĐ2: `now` không nhúc nhích mọi giá trị khí quyển; `storm → now` (ngày và đêm) khớp tuyệt đối chụp gốc (sương, Sky, nước, mây, ánh sáng, exposure); mỗi preset khác `now` đổi cảnh (mưa/bão sương > ×4); console sạch.
  - GĐ5: `now` đủ 536 xe khu phố, không khoá trình diễn/cầu quay; bão: `songHan.ctrl.start()` false và cầu vẫn đóng, `showAllowed` false, còn 232 xe (hai phố bờ sông), quảng cáo tắt, draw call ≤ now + 2 (max 10 khung có chớp); hết bão xe đủ 536, nút người dùng (`adsEnabled`, `songHan.lifeOn`, `hr.lifeOn`) giữ nguyên, `canStart()` true.
  - GĐ7 (+ `8c7ef9e`): nút kịch bản vào chế độ `storm`, camera bám hành trình < 1 m; mốc 4 dây TTL lắc trên hình (> 200 px khác); Esc trả `orbit` mà kịch bản vẫn chạy; nút Dừng dừng kịch bản; 3 lần kịch bản tua ×30 chạy hết ≥ 8 mốc, trả preset `now`/`enabled` false, ngày/đêm không đổi, 0 cây đổ, `geometries`/`textures` bằng mốc; 5 vòng đổi preset không rò rỉ; `programs` không tăng; khí quyển về đúng gốc. Mốc bộ nhớ lấy SAU khi vẽ trước một tia chớp (three chỉ đếm geometry khi mesh được vẽ lần đầu — 206 → 207 lần đầu là tải GPU lười, không rò rỉ).
  - Kết quả gần nhất: đạt (bộ test giao diện điện thoại 2026-10-27, `progress.md`); lần chạy tối ưu độ mượt 2026-10-25 lỗi lần 1 vì lịch tự quay Cầu sông Hàn 23:00 thứ Bảy (`swingUI.ts`) trùng giờ chạy, chạy lại sau 23:10 đạt.
- `tests/tour-check.mjs` mục 5 (`--only=storm`): đường bay `scenario.pose(t)` trên [0; duration] không dưới 3 m, không xuyên mô hình (raycast); nút vào chế độ `storm`, Esc trả `orbit`. Đạt (2026-10-27).
- `tests/voice-check.mjs` mục 5: mỗi mốc một clip `wxStorm` (vi/en/ru), đọc xong (clip + 1,2 s) trước mốc kế, phát đúng mốc, đổi ngôn ngữ đọc lại, Dừng thì dừng giọng; `times` theo từng ngôn ngữ. Đạt (2026-10-27).
- `tests/drawcalls.mjs`: `VIEWS` có `['tp','wxRiverMouth'], ['ttl','wxTtlStays'], ['dragon','wxStreet']` (thêm ở `c169343`); chỉ đo preset `now`. Lần gần nhất 72/74 khớp chênh 0 (2026-10-27; hai dòng lệch là `swTour`, dao động đã biết).
- `tests/perf-check.mjs` (`npm run test:perf -- --strict`): "bật mưa", "tắt mưa" ≤ 150 ms và 0 program mới — đạt 2026-10-25 và 2026-11-04.
- `test:tunnel`, `test:riverfront`, `test:tour` chạy ở preset mặc định; đạt ở các lần chạy đủ bộ (GĐ8 thời tiết 2026-10-22, 2026-10-27).
- Script ảnh từng giai đoạn (không commit ảnh; `tests/screens/weather-gd{2..7}/`): `tests/weather-gd2-shots.mjs` … `tests/weather-gd7-shots.mjs`; đã tự xem ảnh ghi trong plan.
- Chưa có bằng chứng: so ảnh `now` trước/sau trùng điểm ảnh; FPS SwiftShader / GPU thật (`overview`, `wxStreet`, `now` và `rain` 100 %); draw call từng preset trong `KET-QUA.md`; cột "bản gốc" của `test:drawcalls` sau thời tiết (log GĐ8 chạy không kèm `tests/original`); bảng cũ 2026-10-20 thấp hơn 7 draw call so với log GĐ8 ở `overview|ngày` (275 → 282) và `head|ngày` (298 → 305), chưa rõ nguyên nhân.

## 9. Còn mở
- Tự chọn preset theo tháng khi không có `?test` và người xem chưa tự chọn (12b-6, đã đồng ý; `CONFIG.weather.monthPreset` có sẵn nhưng chưa có mã đọc). Làm xong phải chạy lại `test:weather` và `test:drawcalls`, vì đổi mặc định hiển thị.
- Số draw call từng preset (`rain`, `storm`, `summer`, `monsoon`) chưa ghi vào `tests/KET-QUA.md`; log GĐ8 chỉ ghi `now`. Thêm kiểm `rain ≤ now + 1` vào `test:weather` (hoặc sửa câu trong `KET-QUA.md`).
- Sóng bạc đầu cửa sông, bơm hầm (gờ chắn ngập / nước chảy dốc hầm hở), tàu cao `ship` của Cầu sông Hàn, ảo ảnh mặt cầu chưa có. Cũng chưa có: gợn mưa trên mặt nước (+1, 12b-7), dầm TP lắc/xoắn, vảy/thân rồng ướt và lóa nắng, xe chậm + bật đèn khi mưa, người đi bộ Cầu Rồng.
- Cột "bản gốc" của `test:drawcalls` chưa đo lại (`npm run test:drawcalls -- tests/original`); giải thích chênh 7 draw call ở `overview|ngày`, `head|ngày`.
- Sửa `tests/drawcalls.mjs` để trả ban ngày sau `rfHearts` rồi đo lại cột "ngày" của `wxRiverMouth`, `wxTtlStays`, `wxStreet`.
- So ảnh `now` trước/sau trùng điểm ảnh; FPS SwiftShader và GPU thật; ảnh preset × ngày/đêm theo mục 11-8 của prompt (`overview`, `tpBay`, `wxTtlStays`, `wxStreet`, `shOverview` × 5 preset).
- Test bỏ qua lịch tự quay Cầu sông Hàn khi `?test` (lỗi phụ thuộc giờ chạy, có từ trước; đề xuất trong D-018).
- Ô chọn thời tiết vẫn hiện "Hiện trạng" khi preset đặt qua API (helper test, không qua UI).
- Ban đêm ở `rain` 60 % ảnh vẫn thấy sao và ít vệt mưa; water 40.000 m với `water.size` 0,4 khi bão làm mặt nước hơi vỡ hạt ở gần; mirage và võng cáp 2 m trên 405 m khó thấy ở góc xa.
- Ở màn thấp (~620 px) thẻ "Ảnh hưởng tới cầu" có thể chạm bảng Thông số (đã giới hạn `max-height`).
- Xác minh số liệu mục 3 ("cần xác minh"): khí hậu, Beaufort / QĐ 18/2021, cường độ mưa, sự kiện bão, TCVN 2737 / 11823:2017, ngưỡng rung mưa–gió, ngưỡng dừng trình diễn thực tế.
- Nghe thử giọng đọc `wxStorm` thật; thuyết minh kịch bản cho ko, ja, zh, th, ar, hi.
