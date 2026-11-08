# Tối ưu độ mượt — Kế hoạch triển khai (đã hoàn thành)

> **Cho agent thực thi:** kế hoạch này ghi lại việc đã làm. Các mục `- [x]` đã xong. Việc còn lại ở cuối file.

**Mục tiêu:** Hết giật hàng giây do biên dịch shader giữa phiên và giảm tải khung nặng, giữ nguyên hình gốc làm mặc định (bậc Cao = bảng draw call chuẩn), chỉ tự hạ chất lượng khi lag, có ô chọn Tự động / Cao / Trung bình / Thấp; chạy được trên điện thoại.

**Kiến trúc:** `core/perf.ts` (đo), `core/prewarm.ts` (biên dịch trước), `core/quality.ts` + `core/device.ts` + `CONFIG.perf` (7 bậc), không đổi program key khi chạy (D-018): bóng đổ xóa shadow map thay vì đổi `castShadow`, mặt cắt Hầm đẩy mặt phẳng ra 1e7, phản chiếu tắt = sampler 1×1. UI ở `ui/qualityUI.ts`. Đo bằng `tests/perf-check.mjs`.

**Công nghệ:** Vite 6, TypeScript 5.9, three@0.165, Playwright (Chromium SwiftShader).

**Spec:** [2026-10-24-toi-uu-do-muot-design.md](../specs/2026-10-24-toi-uu-do-muot-design.md)

**Trạng thái:** Đã hoàn thành (merge ecebdf8)

## Giai đoạn
Một nhánh `feature/perf` (2026-10-24 → 2026-10-25), **một commit chung** cho cả sáu giai đoạn: `134d5c8` (`git log --oneline ecebdf8^2 --not ecebdf8^1` chỉ ra đúng commit này), merge `ecebdf8`. Nên không có commit riêng cho từng GĐ. Ranh giới chi tiết của GĐ2, GĐ4, GĐ5 không được ghi lại trong tài liệu; những gì ghi chắc chắn: GĐ0 = đo, GĐ1 = biên dịch trước + `--strict` (`tests/perf-check.mjs`), GĐ3 = bậc chất lượng (comment đầu `tests/perf-check.mjs`). `tests/KET-QUA.md` gọi "GĐ1–GĐ5" chung một lần đo (`gd15.json`).

### GĐ0: Đo (trước khi tối ưu)
- [x] `src/core/perf.ts`: HUD ms trung bình / p95 / max (`#ftime`), đo CPU từng bước trong `animate()` khi `?test&perf`.
- [x] `tests/perf-check.mjs` + `npm run test:perf`: khởi động, giật khựng từng thao tác (số program tăng thêm, render dài nhất), CPU mỗi khung ở 5 góc nhìn, chất lượng hình; `--label`, `--compare`, `--strict`.
- [x] Ghi mốc `tests/screens/perf/gd0.json` (không commit).

Số đo GĐ0 (SwiftShader, khung 480×270): tắt bóng đổ +11 607 ms / +68 program; bật mặt cắt Hầm lần 1 +12 577 ms / +22; đêm lần đầu +5 528 ms / +14; bay tới Hầm +7 477 ms / +5; bay tới Thuận Phước +4 606 ms / +7; bay tới Vòng quay +4 176 ms / +4; bật mưa +3 699 ms / 0; bật bóng đổ +2 909 ms / +4. CPU mỗi khung: overview 1,55 ms, head 22,4 ms, swOverview 38,1 ms (có khung GC lớn), tpBay 1,21 ms. Khung đầu 3,3 s; 81 program sau khởi động.
Commit: `134d5c8` (chung).
Kiểm tra: `test:perf` (không `--strict`) → `gd0.json`, 2026-10-24.

### GĐ1: Biên dịch trước, không đổi program key khi chạy
- [x] `src/core/prewarm.ts`: chờ `document.fonts.ready` (≤ 3 s), `compileAsync` cả cảnh hai biến thể (canvas và render target composer), `initTexture` mọi texture, vẽ thật một lần với mọi object tạm hiện, vẽ composer một lần nữa.
- [x] Mặt cắt Hầm: `clippingPlanes` cố định lúc dựng, tắt = hằng số mặt phẳng 1e7 (`han-tunnel/cutaway.ts`).
- [x] Bóng đổ: không đổi `castShadow`, tắt = ngừng vẽ + xóa shadow map (`core/lights.ts`: `stepShadows`).
- [x] `--strict` của `test:perf`: 0 program mới và render dài hơn bình thường ≤ `CONFIG.perf.maxHitchMs` (150 ms).
- [x] Bước vẽ thật toàn cảnh thêm vào prewarm sau đo GĐ1: không còn program mới nhưng lần đầu bay tới Thuận Phước / Hầm / Vòng quay vẫn khựng 3–5 s (comment `prewarm.ts`).

Số đo sau: GĐ0 4–12 s mỗi thao tác → mọi thao tác ≤ +29 ms, 0 program mới (bảng ở mục 8 của spec). Đổi lại khung hình đầu SwiftShader 3,3 → 16,4 s; program sau khởi động 81 → 157.
Commit: `134d5c8` (chung).
Kiểm tra: `test:perf -- --strict` đạt (`gd15.json`), 2026-10-25.

### GĐ2–GĐ5: CPU mỗi khung, bậc chất lượng, UI, bundle
- [x] CPU (ranh giới GĐ chưa đối chiếu): bỏ cấp phát mỗi khung (xe, thuyền, người, tín hiệu Cầu sông Hàn, con lăn, cabin, cây đổ); hạt lửa / nước bỏ qua khi rỗng; đèn xe không ghi khi ẩn; thanh Tour dùng `scaleX`; âm thanh chỉ lên lịch khi đêm đổi; bounding sphere cabin cố định.
- [x] GĐ3: `core/quality.ts` + `core/device.ts` + `CONFIG.perf` (7 bậc, Tự động / Cao / TB / Thấp, `?test` = bậc 0); điện thoại không MSAA + bậc Thấp; máy yếu bậc Trung bình; phản chiếu nước theo chu kỳ / tắt (sampler 1×1); bloom ½ / tắt; giới hạn pixelRatio khi mưa chuyển từ `rain.ts` sang `CONFIG.perf.rainMaxRatio`.
- [x] Ô `#qualitySel` + `ui/qualityUI.ts` + i18n `quality, qAuto, qHigh, qMed, qLow` × 9 (`scripts/add-quality-locales.mjs`).
- [x] `__app.THREE` chỉ còn 6 lớp (three 724 → 558 KB, gzip 187 → 144 KB).
- [x] Normal map nước tính lưới một lần (trùng byte, nhanh ≈ 3,5×).
- [x] Cập nhật `tests/KET-QUA.md` (mục "Hiệu năng — tối ưu độ mượt"), memory bank, D-018.

Số đo sau (SwiftShader): CPU ngoài render overview 1,55 → 0,85 ms; head 22,4 → 0,68 ms; swOverview 38,1 → 0,91 ms; tpBay 1,21 → 15,3 ms ở lần đo cuối (một khung đột biến trong `traffic`, lần đo GĐ1–2 là 0,73 ms, chưa giải thích). Draw call overview Cao / TB / Thấp: ngày 282 / 215 / 116, đêm 306 / 306 / 121. Tự động: khung giả lập 40 ms hạ ≥ 2 bậc, 5 ms nâng về bậc 0. Đổi chất lượng ≤ +4 ms, 0 program.
Commit: `134d5c8` (chung), merge `ecebdf8`.
Kiểm tra (2026-10-25): `test:perf -- --strict` đạt; `test:drawcalls` 73/74 khớp bảng (`swTour|đêm` 209 so với 207: thăm dò 4 lần trung vị 209 / 209 / 209 / 208, từng khung 200–223 vì camera đang leo cabin, là dao động sẵn có của phép đo); `test:tunnel`, `test:riverfront`, `test:sunwheel`, `test:tour`, `test:voice` đạt; `test:weather` lần 1 LỖI do lịch tự quay Cầu sông Hàn 23:00 thứ Bảy (`swingUI.ts`) trùng giờ chạy, chạy lại sau 23:10: đạt.

## Còn lại
- [ ] Đo GPU thật / điện thoại thật; chỉnh các số `CONFIG.perf` (đều ước lượng).
- [ ] Khung đầu SwiftShader 3,3 → 16,4 s (prewarm): xem có cắt bớt được không.
- [ ] Render target phản chiếu (Water.js) không đổi cỡ được khi chạy.
- [ ] Điện thoại khởi động bậc Thấp mà chọn lên Cao thì biên dịch lại một lần (`castShadow`).
- [ ] Giải thích khung đột biến `tpBay` CPU 15 ms (`traffic`).
- [ ] Font Google vẫn chặn render; đổi sang nạp không đồng bộ thì atlas quảng cáo có thể vẽ trước khi có font.
- [ ] Test bỏ qua lịch tự quay khi `?test` (lỗi `test:weather` phụ thuộc giờ chạy, có từ trước).
