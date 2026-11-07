---
agent: agent
description: Thêm một công trình mới (cầu, hầm…) theo đúng mẫu kiến trúc của dự án
argument-hint: Tên công trình + đường dẫn spec trong docs/superpowers/specs/
---

# Thêm công trình mới

Công trình: `${input:name:Tên công trình}` · Spec: `${input:spec:docs/superpowers/specs/<file>-design.md}`

**Bước 0:** chưa có spec + plan cho công trình này thì chạy prompt [plan-feature](plan-feature.prompt.md) trước (spec ở `docs/superpowers/specs/`, plan ở `docs/superpowers/plans/`). Có plan rồi thì làm theo plan; checklist dưới đây là các bước kỹ thuật riêng của dự án để đưa vào plan.

Đọc trước: `.github/memory-bank/systemPatterns.md` (mục "Mẫu: một công trình mới"), `.github/instructions/bridges.instructions.md`, và một công trình mẫu đầy đủ (`src/bridges/song-han/` hoặc `src/bridges/han-tunnel/`).

## Checklist (làm theo thứ tự, kiểm tra xong mới sang bước sau)

1. **Config** — khối `<x>Base` + `derive<X>()` trong `src/config.ts`, số công bố có nguồn, phần còn lại `(ước lượng)`.
2. **Thư mục** `src/bridges/<ten>/`: `index.ts`, `profile.ts`, `materials.ts`, `<Ten>.ts` (extends `BridgeBase`), các bộ phận, `life.ts`.
3. **Tích hợp** `src/main.ts`: `new` **sau** mọi lệnh dùng `rand()` (hiện là sau `new HanTunnel()` và các module dựng sau nó), `scene.add`, thêm vào mảng `bridges`, thêm vào `window.__app` nếu test cần.
4. **Dọn chỗ** nhà/cây/đèn trên tuyến bằng scale 0 (mẫu `han-tunnel/corridor.ts`).
5. `npm run typecheck` → `npm run build` → `npm run test:drawcalls` — góc nhìn cũ đạt ngưỡng của spec.
6. **Góc nhìn** trong `views/presets.ts` + nút `index.html` (`data-list` mới) + `ui/panel.ts`/`setupUI.ts` (chọn công trình, điều khiển riêng).
7. **i18n**: tên công trình, góc nhìn, bảng thông số, điều khiển — đủ 9 locales.
8. **Tour**: điểm dừng `views/tourStops.ts` + `TOURS` trong `views/tour.ts` + `<prefix>Stops` ở 9 locales + thuyết minh vi/en → `npm run gen:voice`.
9. **Test** riêng `tests/<ten>-check.mjs` + `test:<ten>` cho các ràng buộc kỹ thuật; cập nhật `tests/tour-check.mjs` nếu có Tour.
10. **Tài liệu**: README (mục Cấu trúc + mục riêng), `tests/KET-QUA.md`, memory bank (`update-memory-bank`).

Báo cáo cuối: đã xong / còn thiếu, draw call trước/sau, thông số nào ước lượng, kết quả các test (dán thật).
