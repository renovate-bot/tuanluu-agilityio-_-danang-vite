---
applyTo: "src/ui/**,src/views/**,index.html,src/styles/**"
description: Quy ước giao diện, góc nhìn và Tour
---

# UI, góc nhìn, Tour

- **Góc nhìn** là dữ liệu trong `views/presets.ts` (`VIEWS`): `{ pos, target, maxPolar? }`, tọa độ thế giới. Góc thấp sát nước/ngước lên cần `maxPolar` (≤ `Math.PI * 0.97`). Cao độ trên mặt cầu dùng hàm `profile.ts` (vd. `shRoadY`).
- Mỗi góc nhìn mới: nút trong `.view-list[data-list="<công trình>"]` của `index.html` + khóa `v<Tên>` ở 9 locales + thêm vào danh sách đo của `tests/drawcalls.mjs` nếu là góc chính.
- **Tour:** điểm dừng trong `views/tourStops.ts` (cờ `swing`, `immerse`, `cutaway`, `interior`); đường bay không được xuyên mặt cầu/tháp/nhà. Lời và tiêu đề ở locales (`<prefix>Stops`), thuyết minh ở `scripts/narration`.
- **Điều khiển:** dùng `toggle(id, fn)` và `selectBridge` của `ui/panel.ts`; UI riêng công trình đặt trong `ui/<prefix>UI.ts` và nối trong `setupUI.ts`. Chữ hiển thị luôn qua `t()`, cập nhật lại khi đổi ngôn ngữ (`onChange`).
- Nhãn 3D bằng `div` định vị theo camera (mẫu `ui/hrUI.ts`), không dùng sprite chữ.
- Kiểm tra RTL (`ar`) khi thêm khối giao diện mới.

## Điện thoại — chế độ gọn (D-019)
- `body.compact` bật khi cửa sổ khớp `CONFIG.ui.compactQuery` (`ui/compactUI.ts`). CSS cho điện thoại viết dưới `body.compact …`, **không** dùng `@media (max-width)`. Máy tính (không khớp) viết dưới `body:not(.compact) …` (D-025): hai bảng mặc định thu thành nút ⚙ / ☰, dùng chung trạng thái tờ; sửa một bên phải kiểm bên kia không đổi.
- Khi gọn, `.panel.brand` là sheet **Cài đặt** (`body.sheet-settings`), `.views` là sheet **Góc nhìn** (`body.sheet-views`). Nút mới đặt trong `.brand` hoặc `.view-list` sẽ tự vào đúng sheet; đặt chỗ khác thì phải có chỗ hiện trên thanh trên/dưới. Mở/đóng bằng `openSheet()`, `closeSheets()`, `reveal(el)`. Sheet tự đóng khi `body` có `touring` hoặc `wxrun`. Khi có sheet mở, bấm `#scene` hoặc Esc chỉ đóng sheet (listener capture trên `window` trong `compactUI.ts`); listener Esc / pointerdown mới không cần tự kiểm sheet.
- Chú thích, lớp phủ mới (kiểu `#tourCaption`, `#wxScenario`) phải có `z-index` < 10: sheet đang mở có `z-index:10` và phải nằm trên chúng, nếu không sẽ có nút không bấm được (lỗi đã gặp ở nút dừng bão).
- Chữ hướng dẫn có hai bản: `.hint-mouse` và `.hint-touch` (khóa i18n riêng, vd. `tourExitTouch`). Hiệu ứng hover đặt trong `@media (hover:hover)`.
- Hàng chip `.seg` cuộn ngang khi gọn, có mờ cạnh (`.more-start`/`.more-end`, lật theo RTL); `.views` không được tràn ngang.
- Đổi giao diện thì chạy `npm run test:mobile` (dọc 390×844, ngang 844×390, tràn chữ 9 ngôn ngữ, RTL, bấm được khi sheet mở).
