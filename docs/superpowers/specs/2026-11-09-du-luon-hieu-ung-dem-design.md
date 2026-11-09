# Thiết kế: Dù lượn ban đêm — Cầu sông Hàn tự xoay, Cầu Rồng tự phun lửa & nước

_2026-11-09 · Bổ sung cho chế độ tự khám phá (D-020, [spec](2026-11-02-tu-kham-pha-du-luon-design.md))_

## 1. Ý định

Khi bay dù lượn, người chơi không có cách nào thấy hai màn đặc sắc nhất của sông Hàn: nút "Quay cầu" và "Phun lửa & nước" nằm trong khung Góc nhìn, mà khung này bị ẩn khi bay (`body.explore .views`). Người dùng muốn: **đang bay dù, chuyển sang ban đêm thì hai cảnh này tự diễn ra**, không phải bấm gì, để bay tới là thấy.

## 2. Mục tiêu

Chỉ khi `cam.mode === 'glider'` **và** trời đang là đêm (`dayNight.target > 0.5`, tức ngay khi bấm nút Đêm — nút này vẫn hiện khi bay):

1. **Cầu Rồng** chạy màn phun lửa rồi phun nước theo chu kỳ có sẵn (`CONFIG.showCycle`, 48 s), lặp lại suốt đêm.
2. **Cầu sông Hàn** tự xoay, lặp lại suốt đêm:
   - Lượt đầu bắt đầu ngay khi vào đêm.
   - Tốc độ 30× như Tour: xoay ra hoặc xoay về khoảng 6 s mỗi chiều.
   - Khi cầu đã mở thì xin đóng ngay; cầu đóng sau khi tàu qua hết luồng (`canClose` có sẵn), giống Tour.
   - Đóng xong nghỉ 30 s rồi quay lượt tiếp.

Khi chuyển sang ngày giữa chừng:
- Không phun lửa/nước nữa ngay lập tức; hạt đã phun tự tàn trong khoảng 1–3 s như bình thường (không xóa đột ngột).
- Cầu đang quay thì đi nốt tới khi đóng hẳn, không giật về vị trí cũ, và không bắt đầu lượt mới.

## 3. Không làm

- Không thêm nút, chữ hay dòng trạng thái khi bay; **không có khóa i18n mới**.
- Không đổi hành vi ở mọi chế độ khác: Tour, góc nhìn, nút Quay cầu, nút Phun lửa giữ nguyên.
- Không thêm âm thanh cho chế độ bay. Hiện `AudioContext` chỉ tạo khi người xem bấm phát, và hàng âm thanh bị ẩn khi bay, nên thực tế bay dù không có tiếng; đợt này giữ nguyên.
- Không làm va chạm dù với cầu đang xoay (dù vốn chưa có va chạm).
- Không làm màn bay riêng cho điện thoại (đã hoãn từ spec D-020).

## 4. Phản mục tiêu

- Camera hoặc quyền lái dù bị lấy mất khi cầu bắt đầu quay.
- Ban ngày trong lúc bay mà có lửa, nước hay cầu tự xoay.
- Cầu bị giật hoặc kẹt ở trạng thái mở khi đổi ngày/đêm.
- Hiệu ứng tự chạy lọt sang chế độ ngoài dù lượn.

## 5. Ràng buộc

- Bất biến ở `.github/copilot-instructions.md` §3. Không thêm/bớt `rand()` lúc dựng scene, không đổi thứ tự `build*()`.
- Số mới ở `CONFIG.explore` (chú thích tiếng Việt, đơn vị, `(ước lượng)` vì là số chọn cho cảm giác): `swingSpeed: 30`, `swingRest: 30` (s).
- Draw call các góc nhìn cũ không đổi: không thêm mesh nào, chỉ kích hoạt cái đã có.
- Comment tiếng Việt, tiền tố hàm `ex*`.

## 6. Đã quyết

Người dùng quyết:
1. Hai hiệu ứng **tự diễn ra**, không cần bấm.
2. **Chỉ khi đang bay dù và là ban đêm**; ban ngày không có cả hai.
3. Nhịp xoay ở §2 (30×, đóng khi tàu qua, nghỉ 30 s, lặp; sang ngày thì lửa/nước ngừng còn cầu đi nốt tới đóng) — người viết đề xuất, người dùng đồng ý.

Người viết quyết (có thể đổi khi duyệt):
4. Đêm tính theo `dayNight.target > 0.5` thay vì `dayNight.night`, để phản ứng ngay khi bấm nút.
5. Thời tiết giữ luật cũ: `weatherFx.showAllowed` tạm dừng màn phun, `ctrl.canStart()` cấm quay khi bão. Bộ tự chạy phải hỏi `canStart()` trước khi gọi `start()`, nếu không `swingBlocked` sẽ phát liên tục mỗi khung.
6. Lịch tự quay 23:00 thứ Bảy/Chủ nhật (`swingUI.ts`, tốc độ 1×) **không chạy khi đang bay dù**, vì sẽ làm cầu xoay giữa ban ngày trái với mục 2.
7. Không dùng cờ `ctrl.fromTour` (cờ này ghi chú thích vào khung Tour); bộ tự chạy tự gọi `ctrl.requestClose()` khi `OPEN`.
8. Không tắt phần tử hạt hay ghi lại nút `btnShow`: thoát dù là tải lại trang (D-020) nên `show.on` không rò sang chế độ khác.

## 7. Bối cảnh trong code

| Chỗ | Điều cần biết |
|---|---|
| `src/explore/index.ts` `advance()` | Chạy mỗi bước khi bay (cả `explore.step` của test): chỗ hợp lý để gọi bộ tự chạy. `setupExplore()` gọi ở `main.ts:96`, hiện không nhận tham số; cần đường để lấy `songHan.ctrl`. |
| `src/bridges/dragon/effects.ts` `show` | `show.on = true` là đủ để `updateShow` chạy chu kỳ; `false` thì `fireOn/waterOn` về false. Đặt `show.t = 0` khi bật để luôn bắt đầu bằng lửa. |
| `src/bridges/song-han/SwingController.ts` | `start(speed)`, `requestClose()`, `state`, `canStart()`. Mỗi lần gọi `start` phát `swingStart`. |
| `src/ui/swingUI.ts:42-48` | **Bẫy:** `swingStart` gọi `exitTour(); flyTo(VIEWS.shSwingCam)` khi `follow` bật (mặc định bật) và không phải Tour → sẽ đổi `cam.mode` sang `'fly'`, mất dù. Phải thêm điều kiện `cam.mode !== 'glider'`. |
| `src/ui/swingUI.ts:51-56` | Lịch tự quay, xem quyết định 6. |
| `tests/explore-check.mjs` | Đo draw call 4 tư thế × ngày/đêm; nếu cầu xoay trong lúc đo, số đêm sẽ dao động. |

## 8. Kiểm tra

- Trong `?test`, bộ tự chạy **mặc định tắt** để các phép đo đêm hiện có giữ ổn định; test mới bật tường minh qua `window.__app`.
- `test:explore` thêm các kiểm:
  - Ngày khi bay: `show.on` false, `ctrl.state === 'CLOSED'` sau nhiều bước.
  - Đêm khi bay: `show.fireOn` có lúc true; `ctrl` đi hết một lượt về `CLOSED`, rồi lượt sau bắt đầu sau khoảng nghỉ.
  - Suốt lượt quay: `cam.mode` vẫn `'glider'`, lái dù vẫn đổi được hướng.
  - Sang ngày khi cầu đang mở: cầu về `CLOSED`, không bắt đầu lượt mới; `show.fireOn` false.
  - Bão: không quay, không phát `swingBlocked` lặp lại.
  - Không ở chế độ dù, ban đêm: `show.on` và `ctrl.state` không tự đổi.
- Theo nguyên tắc dự án: bộ test nặng (`test:drawcalls` …) chạy một lần cuối nhánh; có sửa `swingUI.ts` ngoài `src/explore/` nên phải chạy đủ bộ.
- Xem bằng mắt: bay về phía cầu ban đêm, thấy cả hai màn từ khoảng cách bình thường.

## 9. Để người làm tự quyết

- Tách bộ tự chạy thành file riêng (ví dụ `src/explore/nightShows.ts`) hay để trong `index.ts`; cách truyền `songHan.ctrl`.
- Cách bật lại bộ tự chạy trong test.
- Đổi đêm → ngày → đêm thật nhanh trong lúc đang nghỉ: có giữ đồng hồ nghỉ hay không.
