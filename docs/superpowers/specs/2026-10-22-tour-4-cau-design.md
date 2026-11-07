# Tour 4 cầu — Thiết kế
_2026-10-22 · Trạng thái: Đã xây (merge `ad963d0`, merge cục bộ, không PR) · Prompt gốc: prompts/tour-4-cau.md tại c418f92_

Đọc lại bản prompt cũ: `git show c418f92:prompts/tour-4-cau.md`. Tài liệu này mô tả cái ĐÃ XÂY, đối chiếu với `src/views/tour.ts`, `src/views/tourStops.ts` (`ALL_TOUR`), `CONFIG.tourAll` trong `src/config.ts`, `tests/tour-check.mjs`, `tests/voice-check.mjs`.

## 1. Mục đích và lý do
- Một hành trình camera xuyên sông Hàn qua cả 4 cầu từ Nam lên Bắc, có chú thích 9 ngôn ngữ và giọng đọc vi/en/ru.
- Thứ tự (z, m): Trần Thị Lý +1300 → Cầu Rồng 0 → Cầu sông Hàn −1080 → Thuận Phước −2900. Quãng đường ~4,2 km.
- Quyết định: D-015 (dùng chung bộ máy Tour, thêm đường bay mở `loop: false`).

## 2. Phạm vi: có / không có
Có: nút `data-view="allTour"`, 13 điểm dừng, `loop: false`, `segMax`, `TourStop.bridge`, quay cầu ở điểm 8, thuyết minh vi/en/ru, i18n 9 ngôn ngữ, mở rộng `test:tour` và `test:voice`.
Không có:
- Điểm dừng riêng cho Hầm (chỉ một câu ở đoạn chuyển SH → TP, điểm 10).
- Bay ngược về chỗ cũ khi hết hành trình.
- Mesh mới, `rand()` mới.

## 3. Thông số đã dùng
`CONFIG.tourAll` (`tourAllBase`, `src/config.ts`; thêm ở `e672add`), đều ước lượng:

| Khóa | Giá trị | Ý nghĩa |
|---|---|---|
| `segMax` | 24 s | Trần thời lượng một đoạn bay. Tour từng cầu: 16 s (clamp 8–16). Đoạn chuyển giữa hai cầu dài 1–1,8 km (ước lượng) |
| `holdMin` | 6 s | Giữ khung hình tối thiểu ở điểm cuối; có giọng thì kéo tới hết clip (ước lượng) |

Công thức thời lượng đoạn (`views/tour.ts`): `clamp(4 + khoảng cách / 45, 8, segMax)`; đoạn giữ cuối = `holdMin`.

Thuyết minh: khóa `allStops`, 13 điểm × 3 ngôn ngữ = **39 clip** (`cd52a47`). Thời lượng tổng (giây, manifest): vi 121,0 · en 144,7 · ru 151,0.

Người dùng đã chốt 4 câu (đặc tả gốc mục 2):

| # | Câu hỏi | Trả lời |
|---|---|---|
| 1 | Nút đặt ở đâu | Dưới thanh chọn cầu, luôn hiện (`data-view="allTour"`) |
| 2 | Hết hành trình | Đi một chiều: giữ khung hình ở Thuận Phước tới khi đọc xong, rồi trả điều khiển (orbit). Không bay ngược về |
| 3 | Độ dài | Gọn, ~4–5 phút, ~13 điểm dừng, lời mới (ngắn hơn Tour từng cầu) |
| 4 | Hầm | Nhắc một câu ở đoạn chuyển SH → TP, ghi rõ "phương án đề xuất, chưa xây". Không có điểm dừng riêng |

## 4. Hình dạng, hành vi như đã xây
- `TOUR_DEFS.all = { view: 'allTour', key: 'allStops', stops: ALL_TOUR, loop: false, segMax: CONFIG.tourAll.segMax }` trong `views/tourStops.ts`.
- `views/tour.ts` (`e672add`):
  - `Tour extends TourDef` có `loop`; `loop: false` thì Catmull-Rom mở (`new CatmullRomCurve3(P, loop, 'centripetal')`), n − 1 đoạn bay + một đoạn giữ ở điểm cuối (`durs[n−1] = holdMin`), `u = min((i + e)/(n−1), 1)` nên đoạn giữ đứng yên.
  - `fitDurations`: điểm 0 hiện từ đầu (không có đoạn trước), điểm cuối hiện tới hết đoạn giữ (chia cho 1 thay vì `SWITCH` 0,55).
  - `locate` không vượt đoạn cuối; `updateTour`: `tour.t` kẹp ở `total` (không modulo); hết thì `exitTour()` (trả orbit, ẩn chú thích, dừng giọng).
  - `tourHooks.bridge`: tới điểm có `bridge` thì `setupUI` gọi `selectBridge(key, false)` (đổi bảng Thông số + danh sách góc nhìn, không bay camera). Dùng hook để tránh vòng import panel → camera → tour.
- Tới điểm có `swing: true` gọi `onTourSwingStop` như Tour Cầu sông Hàn (quay 30×); khi bão thì giữ D-012 (không quay, ghi chú "Tạm hoãn quay cầu").
- Điểm dừng `ALL_TOUR` (tọa độ chỉnh theo raycast của `test:tour`, ước lượng):

| # | Điểm | Ghi chú |
|---|---|---|
| 1 | TTL toàn cảnh | `bridge: 'ttl'`, mở đầu hành trình |
| 2 | TTL tháp nghiêng | |
| 3 | TTL nhìn lại từ phía Bắc (cầu Nguyễn Văn Trỗi cũ) | |
| 4 | Xuôi dòng về Cầu Rồng | đoạn chuyển |
| 5 | Rồng từ phía Nam | `bridge: 'dragon'` |
| 6 | Đầu rồng | như góc nhìn `head` |
| 7 | Nhìn lại Cầu Rồng, tiếp tục về phía Bắc | |
| 8 | SH trên trụ quay | `bridge: 'sh'`, `swing: true` |
| 9 | SH từ phía Bắc | nhịp quay mở luồng |
| 10 | Nhìn dọc tuyến hầm về cửa Tây | phương án đề xuất, chưa xây (`HRZ`) |
| 11 | TP trên cao phía Nam | `bridge: 'tp'` |
| 12 | TP yên ngựa đỉnh tháp Tây | |
| 13 | TP từ vịnh | kết thúc, lời chào |

## 5. Tương tác, UI, i18n, thuyết minh
- Bấm nút → `flyTo` điểm 1 rồi vào chế độ `tour`; chú thích "Điểm dừng i/13".
- Kéo chuột / cuộn / Esc → thoát như Tour cũ.
- Có giọng thì đoạn bay kéo dài cho đọc xong; ngôn ngữ chưa có giọng thì chạy lặng.
- i18n: `vTourAll`, `allStops` × 9 ngôn ngữ (`scripts/add-tour-all-locales.mjs`; `ar` RTL).
- Thuyết minh vi/en/ru: khóa `allStops` trong `scripts/narration/*.json` (`cd52a47`); lời điểm 10 (ru): «Под нами — трасса тоннеля под рекой Хан. Это лишь модель предлагаемого варианта, тоннель ещё не построен.»

## 6. Ràng buộc đã tuân thủ
- Không thêm mesh, không gọi `rand()`: seed và draw call các góc nhìn cũ không đổi (ngưỡng 0). `test:drawcalls` 58/58 chênh 0 (`tests/KET-QUA.md`, mục Bộ test Tour 4 cầu).
- 5 Tour cũ giữ nguyên `durs` và đường bay: nhánh mới chỉ chạy khi `loop === false`.
- Không đặt điểm dừng trên hành lang Hầm ở độ thấp (`test:tour`: camera thấp nhất 24 m).
- Hầm là "phương án đề xuất, chưa xây" ở lời điểm 10 (vi/en/ru).

## 7. Khác so với ý định ban đầu
| Dự định | Như đã xây | Vì sao |
|---|---|---|
| Điểm 3 là "TTL dây văng trên mặt cầu" (đặc tả gốc mục 5) | `ALL_TOUR[2]` đặt camera nhìn lại từ phía Bắc về cầu Nguyễn Văn Trỗi cũ | Tọa độ chỉnh theo raycast của `test:tour`; chưa đối chiếu lại lời điểm 3 |
| Điểm 4 "dọc sông về Cầu Rồng", điểm 7 "dưới bụng cầu phía Bắc" | `ALL_TOUR[3]` xuôi dòng về Cầu Rồng; `[6]` nhìn lại Cầu Rồng rồi tiếp tục về Bắc | Như trên |
| Điểm 12 "TP bờ Đông" | `ALL_TOUR[11]` ở yên ngựa đỉnh tháp Tây | Như trên |
| Số điểm trong thông báo test: 5 tour, 41 điểm dừng | Nay 6 tour, 47 điểm dừng + 8 mốc bão | Thêm `sw` (`028dede`) và kịch bản bão (`8c7ef9e`) |

## 8. Kiểm tra
- `test:tour` (`tests/tour-check.mjs`): thêm Tour `all` — chú thích đúng 13 điểm, camera y ≥ 3 m (thực đo thấp nhất 24 m), raycast đường bay không chạm, tới cầu mới thì danh sách góc nhìn chuyển theo cầu đó, Cầu sông Hàn tự quay ở điểm 8, hết hành trình thì `cam.mode` về `orbit` và không lặp lại. Đạt: dragon 8, tp 7, ttl 7, sh 6, hr 8, all 13, sw 6, storm 8.
- `test:voice`: `allStops` đủ clip vi/en/ru, đọc kịp (clip + 1,2 s); đạt (6 tour, 47 điểm + 8 mốc bão) ở lần chạy gần nhất.
- `test:drawcalls`: 58/58 phép đo khớp bảng `now` cũ, chênh 0 (2026-10-22; lần đầu treo 240 s ở một thao tác nhấp, chạy lại riêng thì đạt). Lần gần nhất 72/74 khớp (2026-10-27), ngoại lệ `swTour` là dao động đã biết.
- `test:tunnel`, `test:riverfront`, `test:weather` đạt cùng đợt (`f6a6c3f`).

## 9. Còn mở
- Lời điểm 7 ("Tiếp tục về phía Bắc") đọc lúc camera còn nhìn lại Cầu Rồng; chỉnh `ALL_TOUR[6]` nếu muốn camera quay về hướng Bắc.
- Chưa kiểm: giọng nghe thật; Tour ban đêm / thời tiết khác `now`; FPS SwiftShader/GPU thật.
- `tests/KET-QUA.md` chưa ghi riêng số draw call của Tour 4 cầu (chưa đối chiếu có góc nhìn `allTour` trong `VIEWS` của `tests/drawcalls.mjs` hay không).
