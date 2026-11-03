# Progress

_Cập nhật: 2026-10-27_

## Đã xong
| Tính năng | Commit | Kiểm tra |
|---|---|---|
| Chuyển 1 file HTML → Vite + TS, giữ nguyên hành vi | `b500bb5` | `test:drawcalls`: 36/36 lần đo chênh 0 so bản gốc (`tests/KET-QUA.md`, 2026-10-20) |
| 4 cầu: Rồng, Thuận Phước, Trần Thị Lý, sông Hàn (quay) | `b500bb5` | `test:drawcalls`, `test:tour` |
| Thuyết minh Tour vi + en (msedge-tts, manifest thời lượng) | `7c60d82` | `test:voice` |
| Giao diện tiếng Nga (locale `ru`) | `ca91609` | — |
| Hầm vượt sông Hàn: trắc dọc, mặt cắt địa chất, mô phỏng dìm, lái xe xuyên hầm, Tour 8 điểm, i18n 9 ngôn ngữ, thuyết minh vi/en | `bdab293` | `test:tunnel`, `test:tour` |
| Hai bờ sông: địa danh, mặt LED trái tim + "DN" (đối đáp/đồng bộ), quảng cáo hư cấu, dải đi bộ, dọn nhà scale 0, i18n 9 ngôn ngữ | `7003788` | `test:riverfront` |
| Giảm draw call riverfront (frustum culling LED, gộp khung bảng, LOD 400 m) | `a22095c` | `test:drawcalls` |
| Giảm draw call hầm (gộp biển/LED/lam, ẩn theo khoảng cách 600 m / xe 450 m / toàn bộ 1.500 m) | `a4802ad` | `test:drawcalls`, `test:tunnel` |
| Test: timeout dài hơn, `test:tour -- --only`, đo thêm góc nhìn hầm/riverfront | `92c8d34` | — |
| Thuyết minh tiếng Nga (`ru-RU-SvetlanaNeural`, 5 Tour / 36 điểm dừng) | `0a0b6be` | `test:voice` |
| Thời tiết GĐ1: khung + config (`feature/weather`) | `4baacb1` | `build` |
| Thời tiết GĐ2: khí quyển 4 preset + UI chọn preset | `3978854` | `test:weather`, `test:drawcalls` |
| Thời tiết GĐ3: mưa + mặt ướt | `5f780b4` | `test:drawcalls`, `test:tunnel` |
| Thời tiết GĐ4: gió (cây, dây, thuyền, mây, sóng) | `e3906e7` | `test:drawcalls`, `test:tour` |
| Thời tiết GĐ5: bão — chớp, đóng cầu, cầu quay, trình diễn | `1b39173` | `test:drawcalls`, `test:weather` |
| Thời tiết GĐ6: bảng "Ảnh hưởng tới cầu", góc nhìn `wx*`, i18n | `c169343` | `test:drawcalls`, `test:weather` |
| Thời tiết GĐ7: kịch bản bão 120 s, nắng hè, cây đổ, âm thanh | `edced8b` | `test:drawcalls`, `test:weather`, `test:tour` |
| Vòng quay Mặt Trời GĐ1–GĐ7: khung, hình học, quay + góc `sw*`, LED đêm, ngồi cabin, thời tiết (dừng, lắc, ướt), panel + Tour 6 điểm + `swStops` (D-014, D-016, D-017) | `52ad574` … `028dede` | `test:sunwheel`, `test:drawcalls`, `test:tour`, `test:voice` |
| Vòng quay GĐ8: `KET-QUA.md` (sửa `swTour` đêm 209 → 207 theo log), README, memory bank, mục 8 của `sunwheel-check`, ghi chú đo ngày/đêm | — | `build` đạt; `test:drawcalls` đạt (góc cũ chênh 0 đến +2, `sw*` ghi vào KET-QUA, khớp log); `test:tour`, `test:voice`, `test:riverfront`, `test:weather` đạt (log gd8). chạy tay lại 2026-10-24: `test:tunnel` đạt, `test:sunwheel` đầy đủ (gồm mục 8) đạt; chênh đêm − ngày ≈ 21 đã tách (không do vòng quay), xem `tests/KET-QUA.md` |
| Thời tiết GĐ8: hoàn tất — `KET-QUA.md`, README, memory bank (chưa commit) | — | `build`, toàn bộ bộ test (log `gd8-l0-*`) |
| Kịch bản bão: hành trình camera như Tour + thuyết minh vi/en/ru khớp từng điểm (D-013); sửa dây không lắc (hình trụ 1 đoạn, lỗi từ GĐ4) (chưa commit) | — | `test:tour`, `test:voice`, `test:weather`, `test:drawcalls` |
| Tối ưu độ mượt (D-018): prewarm shader, mặt cắt/bóng đổ không biên dịch lại, bỏ cấp phát mỗi khung, bậc chất lượng Tự động/Cao/TB/Thấp + i18n, bundle three −23 % (`feature/perf`) | — | `test:perf --strict` đạt (≤ +29 ms, 0 program mới; GĐ0 4–12 s); `test:drawcalls` 73/74 (swTour đêm dao động); tunnel, riverfront, weather (chạy lại ngoài giờ tự quay), sunwheel, tour, voice đạt |
| Tour 4 cầu: TTL → Rồng → sông Hàn → Thuận Phước, đường bay mở một chiều, 13 điểm, thuyết minh vi/en/ru, i18n 9 ngôn ngữ (D-015) | `e672add`, `cd52a47` + GĐ4 | `test:drawcalls` (58/58, chênh 0), `test:tour`, `test:voice`, `test:tunnel`, `test:riverfront`, `test:weather` |
| Giao diện điện thoại: chế độ gọn `body.compact`, thanh trên/dưới + 2 sheet, hàng chip cuộn, chữ cảm ứng, i18n 5 khóa × 9, safe-area, bỏ blur, gộp resize (D-019, `feature/mobile-ui`); sửa sau review cuối: sheet nằm trên chú thích Tour/bão | `8605bd5` … `fced484`, merge `fc53fdd` | `test:mobile` mới; `build`, `test:drawcalls` 72/74 khớp chênh 0 (swTour ngày 187 vs 188, đêm 209 vs 207 = dao động đã biết, D-018), `test:tour`, `test:voice`, `test:tunnel`, `test:riverfront`, `test:weather`, `test:sunwheel`, `test:perf --strict` đạt (2026-10-27). Đo giả lập iPhone 12 ghi ở `tests/KET-QUA.md`; chưa đo máy thật |
| Buy me a coffee qua MoMo: liên kết trong panel Cài đặt, URL chỉ nhận HTTPS; aria-label 9 ngôn ngữ (D-021) | — (chưa commit) | `typecheck`, `build`, `test:mobile`, `test:perf -- --strict` đạt (2026-11-04); alias do người dùng cung cấp đã mở tới trang MoMo trong trình duyệt, chưa thực hiện giao dịch/chưa kiểm tra trên điện thoại thật |

Tất cả đã vào `main` (PR #1 hầm, PR #2 riverfront, PR #3 hướng dẫn AI agent, PR #6 thời tiết + kịch bản bão có thuyết minh), Tour 4 cầu (merge cục bộ `ad963d0`), PR #8 Vòng quay Mặt Trời (merge `257b905`), tối ưu độ mượt (merge `ecebdf8`), giao diện điện thoại (merge `fc53fdd`).

## Còn thiếu
- Giao diện điện thoại: đo trên điện thoại thật (FPS, safe-area, cảm giác chạm); người bản ngữ duyệt 7 bản dịch khóa mới; chip `.seg` cao 36 px (< 44 px khuyến nghị cho chạm, cần thử máy thật); câu hướng dẫn xuống cabin (`swRideHintTouch`) trỏ tới nút nằm trong sheet Góc nhìn.
- Tự chọn preset theo tháng khi không có `?test` (12b-6, đã đồng ý nhưng chưa code; đổi mặc định hiển thị nên cần chạy lại bộ test).
- Thời tiết: số draw call từng preset (`rain`, `storm`, …) chưa ghi vào `KET-QUA.md`; log GD8 chỉ ghi `now`. Cột "bản gốc" của `test:drawcalls` chưa đo lại trong bản này.
- Thời tiết: sóng bạc đầu cửa sông, bơm hầm, tàu cao `ship` của Cầu sông Hàn, ảo ảnh mặt cầu chưa có.
- Thuyết minh cho ko, ja, zh, th, ar, hi.
- Dựng lại Cầu Rồng chi tiết theo `prompts/cau-rong.md`.
- Vòng quay Mặt Trời (Sun Wheel) theo `prompts/vong-quay-mat-troi.md`: GĐ1–GĐ7 đã có (xem bảng trên). Còn thiếu để chốt số: khoảng cách tâm → mép nước (x), đường kính thật, ảnh cận cabin, video show LED.
- Vòng quay Mặt Trời: chưa đo bản gốc (`test:drawcalls -- tests/original`) cho các góc cũ; cột "ngày" của `rfBank`, `wxRiverMouth`, `wxTtlStays`, `wxStreet`, `swOverview`, `swFront`, `swBase`, `swFromTTL` trong `KET-QUA.md` thực ra đo ban đêm (lỗi `tests/drawcalls.mjs` sau `rfHearts`, có từ trước; đề xuất sửa + đo lại). Vòng quay chưa có ảnh `sunwheel-gd8/` (GĐ8 không có bước nhìn kết quả).
- Bật `strict` TypeScript dần theo thư mục (giai đoạn 2).

## Lỗi / hạn chế đã biết
- README có dòng giới thiệu Hầm bị lặp hai lần (đầu file).
- `msedge-tts` là dịch vụ không chính thức: có thể lỗi khi sinh clip; clip đã sinh vẫn dùng được.
