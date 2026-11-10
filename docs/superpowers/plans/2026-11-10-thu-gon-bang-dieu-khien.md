# Thu gọn bảng điều khiển trên máy tính — Kế hoạch thực hiện

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trên máy tính, hai bảng `.brand` (Cài đặt) và `.views` (Góc nhìn) mặc định thu thành nút ⚙ và ☰ Góc nhìn, bấm mới mở. Bấm cảnh hoặc nhấn Esc khi có bảng mở chỉ đóng bảng (cả máy tính lẫn điện thoại).

**Architecture:** Dùng lại trạng thái tờ của chế độ gọn (`ui.sheet`, `openSheet`, `closeSheets`, `body.sheet-settings` / `body.sheet-views` trong `src/ui/compactUI.ts`) cho cả máy tính. Phần CSS máy tính viết thành khối `body:not(.compact)` riêng, khối `body.compact` giữ nguyên. Chặn cú bấm cảnh / Esc khi có bảng mở bằng listener pha capture trên `window`.

**Tech Stack:** Vite 6 + TypeScript 5.9, CSS thuần, test Playwright + SwiftShader (`tests/*.mjs`).

**Spec:** [2026-11-10-thu-gon-bang-dieu-khien-design.md](../specs/2026-11-10-thu-gon-bang-dieu-khien-design.md)

**Nhánh:** `feature/thu-gon-bang-dieu-khien` (đã có commit spec `760485e`).

## Global Constraints
- Không đổi bố cục `body.compact` và `CONFIG.ui.compactQuery` (`(max-width: 760px), (max-height: 500px)`).
- `.specs` và `.stats` giữ nguyên, kể cả quy tắc ẩn sẵn có.
- Mặc định đóng cả hai bảng, kể cả khi có `?test`. Không lưu trạng thái vào `localStorage`.
- Mỗi lúc một bảng (dùng chung `ui.sheet`).
- Không thêm thư viện, không ảnh ngoài, không đổi cảnh 3D: mọi góc nhìn chênh 0 draw call.
- Khóa i18n đổi phải đủ 9 file `src/i18n/locales/{vi,en,ko,ja,zh,th,ar,hi,ru}.json`.
- Comment tiếng Việt, kiểu "một dòng một ý" như file xung quanh; không format lại file.
- `npm run typecheck` sau mọi thay đổi `.ts`; test đọc `dist/` nên `npm run build` trước khi chạy test.
- Bộ test nặng (`test:tour`, `test:drawcalls`, cả bộ) **chỉ chạy một lần ở Task 5**, không chạy giữa các task (ý người dùng). Giữa các task chỉ chạy `test:mobile`.

## Review Focus
1. **Mở ⚙ trong lúc Tour rồi bấm cảnh:** bảng đóng, Tour vẫn chạy, camera không bị kéo. Test ở Task 1.
2. **Nhấn Esc khi đang ngồi cabin Vòng quay và bảng Cài đặt đang mở:** bảng đóng, vẫn ở cabin; nhấn Esc lần nữa mới xuống. Test ở Task 1.
3. **Đang bay dù lượn, mở ⚙ rồi nhấn Esc:** bảng đóng, vẫn đang bay; Esc lần nữa mới thoát. Test ở Task 1.
4. **Kéo cửa sổ qua ngưỡng điện thoại ↔ máy tính khi bảng đang mở:** bảng đóng ở cả hai chiều, không còn `body.sheet-*` thừa. Test ở Task 1.
5. **Tiếng Ả Rập (RTL):** ⚙ ở góc trên bên phải, ☰ ở góc trên bên trái, bảng mở ra không tràn ngoài màn hình. Test ở Task 2.

---

### Task 1: Hành vi dùng chung — `reveal` cho máy tính, chặn bấm cảnh / Esc, đóng khi qua ngưỡng

**Files:**
- Modify: `src/ui/compactUI.ts` (`reveal`, `wireSheets`, `setupCompactUI`)
- Test: `tests/mobile-check.mjs` (mục mới "Mục 5: thu gọn trên máy tính", hành vi)

**Interfaces:**
- Consumes: `exitTour` không đổi (`src/views/tour.ts`), listener Esc sẵn có ở `src/ui/setupUI.ts:105` và `src/explore/index.ts` (`setupExplore`).
- Produces:
  - `reveal(el: Element | null): void`: chạy cả khi không `ui.compact`. Quy tắc: `el.closest('.brand')` → `openSheet('settings')`; `el.closest('.view-list')` hoặc (`!ui.compact` và `el.closest('.views')`) → `openSheet('views')`; còn lại → `closeSheets()`.
  - Không đổi tên / chữ ký `openSheet`, `closeSheets`, `ui`. `window.__app.ui.{openSheet, closeSheets, reveal, ui}` giữ như cũ.

- [ ] **Step 1: Viết test thất bại** ở cuối `tests/mobile-check.mjs` (trước `check('console sạch'…)`), trang mới `E = openApp(browser, srv.url, { width: 1440, height: 780 })`:
  - `'máy tính: reveal mở tờ Góc nhìn cho chip cầu'`: `__app.ui.reveal(document.querySelector('[data-bridge="hr"]'))` → `__app.ui.ui.sheet === 'views'`.
  - `'máy tính: Tour + tờ mở, bấm cảnh chỉ đóng tờ'`: bấm `[data-view="tour"]` bằng `element.click()` trong `evaluate`, `waitForFunction` tới khi `body` có `touring` (tờ tự đóng khi `touring` bật, nên phải mở sau), rồi `openSheet('settings')`, rồi `page.mouse.click(720, 400)` (giữa canvas) → `ui.sheet === 'none'` **và** `document.body.classList.contains('touring')`. Sau đó `page.mouse.click(720, 400)` lần nữa → không còn `touring` (hành vi cũ khi không có tờ).
  - `'máy tính: Tour + tờ mở, Esc chỉ đóng tờ'`: như trên nhưng `page.keyboard.press('Escape')` → tờ đóng, vẫn `touring`; Esc lần nữa → hết `touring`.
  - `'máy tính: cabin + tờ mở, Esc chỉ đóng tờ'`: `[data-view="swRide"]` `.click()`, `waitFlight`, `openSheet('settings')`, Esc → `ui.sheet === 'none'` và `__app.cam.mode === 'swRide'`; Esc lần nữa → `cam.mode !== 'swRide'`.
  - `'qua ngưỡng: tờ đóng cả hai chiều'`: `openSheet('settings')`, `page.setViewportSize({ width: 700, height: 700 })`, chờ 2 khung → `ui.sheet === 'none'` và `body` không có `sheet-settings`; `openSheet('views')`, đổi lại `1440×780` → `ui.sheet === 'none'`.
  - Trang riêng `G = openApp(browser, srv.url + '?explore=glider', { width: 1440, height: 780 })`: `'dù lượn: tờ mở, Esc chỉ đóng tờ'` → `openSheet('settings')`, Esc → `ui.sheet === 'none'` và `__app.explore.active()`.
  - Điện thoại (trang `P` sẵn có, 390×844 cảm ứng), thêm `'điện thoại: Tour + tờ mở, chạm cảnh chỉ đóng tờ'`: như bước bấm cảnh nhưng dùng `page.touchscreen.tap(195, 300)` (giữa vùng cảnh, ngoài thanh trên/dưới).

- [ ] **Step 2: Chạy, thấy thất bại**
  Run: `npm run build && npm run test:mobile`
  Expected: LỖI ở các mục mới (reveal không mở trên máy tính; Tour / cabin / dù lượn bị thoát; qua ngưỡng 760 → máy tính còn `sheet-*`).

- [ ] **Step 3: Sửa `src/ui/compactUI.ts`**
  - `reveal`: bỏ `!ui.compact` khỏi điều kiện thoát sớm (giữ `!el`), thêm nhánh `.views` khi không compact như Interfaces.
  - `wireSheets`: thay listener `#scene` `pointerdown` hiện có bằng listener `window` `pointerdown` pha capture: nếu `ui.sheet !== 'none'` và `e.target` là `#scene` → `closeSheets()`, `e.stopPropagation()`, `e.preventDefault()`. Nhờ vậy `exitTour` (canvas) và OrbitControls không nhận cú bấm này.
  - `wireSheets`: thay listener Esc hiện có bằng listener `window` `keydown` pha capture: nếu `e.key === 'Escape'` và `ui.sheet !== 'none'` → `closeSheets()`, `e.stopImmediatePropagation()`, `e.preventDefault()`. Sửa comment cũ ("KHÔNG chặn các listener Esc sẵn có") cho đúng hành vi mới.
  - `setupCompactUI` → `apply`: đổi `if (was && !ui.compact) closeSheets()` thành `if (was !== ui.compact) closeSheets()`. Lần gọi đầu thì `was = false`; nếu máy đang ở compact thì tờ vẫn `'none'`, gọi thừa vô hại.
  - Comment đầu file: thêm câu "Máy tính dùng chung trạng thái tờ (bảng thu gọn, D-025)".

- [ ] **Step 4: Chạy, thấy đạt**
  Run: `npm run typecheck && npm run build && npm run test:mobile`
  Expected: các mục Task 1 `đạt`. Mục cũ `'máy tính: không có nút sheet'` và `'máy tính: .brand neo trái 14 px, .views rộng 228 px'` vẫn đạt, vì CSS chưa đổi (Task 2 mới sửa chúng).

- [ ] **Step 5: Commit**
  ```bash
  git add src/ui/compactUI.ts tests/mobile-check.mjs
  git commit -m "feat(ui): bấm cảnh / Esc khi có tờ mở chỉ đóng tờ; reveal chạy cả máy tính"
  ```

### Task 2: CSS máy tính — hai bảng thu thành nút ⚙ / ☰

**Files:**
- Modify: `src/styles/main.css` (khối "Phần tử riêng của chế độ gọn" quanh dòng 166–168; thêm khối mới `/* ===== Máy tính: bảng thu gọn (D-025) ===== */` ngay sau, trước khối `body.compact`)
- Test: `tests/mobile-check.mjs` (trang `E` từ Task 1; sửa mục máy tính cũ trên trang `D` 1280×800)

**Interfaces:**
- Consumes: `body.sheet-settings`, `body.sheet-views`, `#btnSettings`, `#btnViewsSheet`, `aria-expanded` (Task 1, sẵn có).
- Produces: không có API mới, chỉ CSS. Test các task sau dựa vào: lúc đóng trên máy tính chỉ `#btnSettings` (trong `.brand`) và `#btnViewsSheet` (trong `.views`) hiện.

- [ ] **Step 1: Sửa / viết test thất bại**
  - Trang `D` (1280×800): bỏ hai check cũ `'máy tính: .brand neo trái 14 px, .views rộng 228 px'` và `'máy tính: không có nút sheet'`. Thay bằng:
    - `'máy tính: đóng — chỉ ⚙ và ☰ hiện'`: `visibleAll(['#btnSettings', '#btnViewsSheet'])` và `hiddenAll(['.brand h1', '.brand-top', '#brandBody', '.views .seg', '.views .tour-all', '.views .view-list:not([hidden])'])`.
    - `'máy tính: đóng — hai nút nhỏ ở hai góc trên'`: hộp `.brand` có `left ≈ 14`, `top ≈ 14`, `width ≤ 64`, `height ≤ 64`; hộp `.views` có `right ≈ 1280 − 14`, `top ≈ 14`, `height ≤ 64`, `width ≤ 200`.
    - `'máy tính: mở Cài đặt — đủ mục, ⚙ sáng'`: `openSheet('settings')` → `visibleAll(['.brand-top', '#brandBody', '#btnNight', '#qualitySel'])`, `#btnSettings[aria-expanded="true"]`, `.views` vẫn chỉ còn ☰.
    - `'máy tính: mở Góc nhìn — đủ mục, rộng 228 px, nằm trong màn hình'`: `openSheet('views')` → `visibleAll(['.views .seg', '.views .tour-all'])`, `getComputedStyle(.views).width === '228px'`, hộp `.views` có `bottom ≤ 800`.
    - Giữ `'máy tính: vẫn blur'` (đo khi Cài đặt mở) và `'máy tính: donate nằm trong .brand'` (mở Cài đặt trước khi đo).
  - Trang `E` (1440×780), thêm `'máy tính: mặc định đóng'`: `ui.sheet === 'none'` ngay sau `openApp`.
  - Trang mới `A = openApp(browser, srv.url, { width: 1440, height: 780 })`, `pick(A.page, '#langSelect', 'ar')`, `closeSheets()`: `'ar: ⚙ bên phải, ☰ bên trái'` → hộp `#btnSettings` có `right > 1440 − 80`, hộp `#btnViewsSheet` có `left < 80`. Mở lần lượt hai tờ: hộp bảng nằm trọn trong `0..1440 × 0..780`.

- [ ] **Step 2: Chạy, thấy thất bại**
  Run: `npm run build && npm run test:mobile`
  Expected: LỖI ở các mục máy tính mới (nút sheet đang `display:none` trên máy tính).

- [ ] **Step 3: Viết CSS trong `src/styles/main.css`**
  - Dòng `#btnSettings,#btnViewsSheet,.sheet-close{display:none;}` → chỉ còn `.sheet-close{display:none;}`. `#btnSettings`, `#btnViewsSheet` hiện ở cả hai chế độ. Sửa comment dòng 166 cho đúng.
  - Khối máy tính, mọi selector bắt đầu bằng `body:not(.compact)`:
    - Nút: `#btnSettings` vuông khoảng 36 px, svg 16 px; `#btnViewsSheet` inline-flex, biểu tượng + chữ, `gap` 6 px. Trạng thái `[aria-expanded="true"]` dùng cùng màu vàng như `body.compact #btnSettings[aria-expanded="true"]` (gộp selector, không chép giá trị).
    - Lúc đóng (`:not(.sheet-settings)`): `.brand` padding nhỏ (khoảng 6 px), ẩn `.brand-top`, `.brand h1`, `#brandBody`. Lúc mở: `.brand-head` thành hàng flex (h1 co giãn, ⚙ ở cuối), phần còn lại như bố cục cũ.
    - Lúc đóng (`:not(.sheet-views)`): `.views` `width:auto`, padding nhỏ, ẩn mọi con trừ `#btnViewsSheet` (`.views > :not(#btnViewsSheet){display:none}`). Lúc mở: `.views` như cũ (rộng 228 px, `max-height` theo cửa sổ, cuộn), `#btnViewsSheet` ở trên cùng.
    - Không đặt `top` / `inset-inline-*` mới: hai bảng giữ neo `14px` sẵn có ở `.brand`, `.views`, để RTL tự đổi bên.
  - Không thêm số vào `CONFIG` (chỉ là kích thước CSS, như các dòng `body.compact` sẵn có).

- [ ] **Step 4: Chạy, thấy đạt**
  Run: `npm run build && npm run test:mobile`
  Expected: `mobile-check: đạt` (gồm mọi mục điện thoại cũ: bố cục compact không đổi).

- [ ] **Step 5: Nhìn bằng mắt.** Chụp 4 ảnh vào `tests/screens/thu-gon/` (không commit) ở 1440×780: đóng, mở Cài đặt, mở Góc nhìn, `ar` đóng. Kiểm hai nút không đè `#tourCaption`, `.specs`, `.stats`. Ở `?explore=glider` chỉ ⚙ hiện, không đè `#exHint` / `#btnExExit`.

- [ ] **Step 6: Commit**
  ```bash
  git add src/styles/main.css tests/mobile-check.mjs
  git commit -m "feat(ui): máy tính thu hai bảng thành nút Cài đặt / Góc nhìn"
  ```

### Task 3: Test cũ bấm thẳng nút trong bảng → `tap` / `pick`

**Files:**
- Modify: `tests/riverfront-check.mjs` (dòng 68, 71, 74, 86, 90, 118, 119), `tests/tunnel-check.mjs` (dòng 57, 58, 71, 74, 81, 86, 120, 122, 124, 128), `tests/weather-gd6-shots.mjs` (49, 61, 73), `tests/weather-gd7-shots.mjs` (79, 84, 112, 113, 117, 122, 127, 138, 141, 147, 148)

**Interfaces:**
- Consumes: `tap(page, sel)`, `pick(page, sel, value)` trong `tests/lib.mjs` (không đổi), `reveal` máy tính (Task 1).

- [ ] **Step 1: Chạy, thấy thất bại** (bằng chứng cần sửa)
  Run: `npm run build && npm run test:tunnel`
  Expected: hỏng ở bước bấm `button[data-bridge="hr"]` (Playwright chờ phần tử hiện tới hết timeout). Chỉ cần thấy lỗi đầu tiên rồi dừng (Ctrl+C), không chờ hết.

- [ ] **Step 2: Đổi** mọi `page.click(sel)` trên phần tử nằm trong `.brand` / `.views` thành `tap(page, sel)`, mọi `page.selectOption(sel, v)` thành `pick(page, sel, v)`. Thêm `tap`, `pick` vào dòng `import` của từng file. Không đổi `page.click` của phần tử ngoài hai bảng (`#chooser`, `#exMp*`, `#btnExExit` trong `explore-check` / `multi-check`).

- [ ] **Step 3: Chạy, thấy đạt**
  Run: `npm run test:tunnel` rồi `npm run test:riverfront`
  Expected: `đạt` cả hai. Hai script `weather-gd*-shots` chỉ là script chụp ảnh lịch sử: kiểm bằng `node --check` (cú pháp), không chạy.

- [ ] **Step 4: Rà** `grep -n "page.click\|selectOption" tests/*.mjs`: không còn lời gọi nào nhắm phần tử trong `.brand` / `.views`. Ghi kết quả rà vào báo cáo task.

- [ ] **Step 5: Commit**
  ```bash
  git add tests/riverfront-check.mjs tests/tunnel-check.mjs tests/weather-gd6-shots.mjs tests/weather-gd7-shots.mjs
  git commit -m "test: bấm nút trong bảng qua tap/pick (bảng máy tính thu gọn)"
  ```

### Task 4: Câu hướng dẫn cabin `swRideHint` (9 ngôn ngữ)

**Files:**
- Modify: `src/i18n/locales/{vi,en,ko,ja,zh,th,ar,hi,ru}.json` (khóa `swRideHint`), `index.html:213` (chữ mặc định trong `#swRideHint .hint-mouse`)
- Test: `tests/mobile-check.mjs` (trang `E`)

**Interfaces:** không có.

- [ ] **Step 1: Viết test thất bại** `'swRideHint không nhắc nút'`: đọc 9 file locale bằng `fs` trong test, `swRideHint` của mỗi file khớp đúng chuỗi ở Step 3.

- [ ] **Step 2: Chạy, thấy thất bại.** Run: `npm run build && npm run test:mobile`. Expected: LỖI `swRideHint không nhắc nút`.

- [ ] **Step 3: Đổi chuỗi** (bỏ vế "hoặc bấm lại nút", giữ phần nhìn quanh như cũ):
  | locale | `swRideHint` |
  |---|---|
  | vi | `Kéo chuột để nhìn quanh · Esc để xuống cabin` |
  | en | `Drag to look around · Esc to step off` |
  | ko | `드래그하여 둘러보기 · Esc로 내리기` |
  | ja | `ドラッグで見回す · Esc で降ります` |
  | zh | `拖动鼠标环顾四周 · 按 Esc 下车` |
  | th | `ลากเมาส์เพื่อมองรอบตัว · กด Esc เพื่อลง` |
  | ar | `اسحب للنظر حولك · اضغط Esc للنزول` |
  | hi | `चारों ओर देखने के लिए खींचें · उतरने के लिए Esc दबाएँ` |
  | ru | `Перетаскивайте мышь, чтобы осмотреться · Esc — выйти из кабины` |

  `swRideHintTouch` không đổi. `index.html` dùng chuỗi `vi`.
  Rà các khóa khác trong `vi.json` có nhắc "bấm lại nút" / "chọn góc nhìn" (đã biết: `walkHint` — giữ, vẫn đúng vì mở ☰ để chọn; `swRideHintTouch` — giữ, điện thoại không đổi). Ghi danh sách đã rà vào báo cáo task.

- [ ] **Step 4: Chạy, thấy đạt.** Run: `npm run build && npm run test:mobile`. Expected: `mobile-check: đạt`.

- [ ] **Step 5: Commit**
  ```bash
  git add src/i18n/locales index.html tests/mobile-check.mjs
  git commit -m "i18n: swRideHint chỉ nhắc Esc (nút cabin nằm trong bảng thu gọn)"
  ```

### Task 5: Tài liệu, memory bank, chạy bộ test cuối

**Files:**
- Modify: `.github/memory-bank/decisions.md` (D-025), `.github/memory-bank/activeContext.md`, `.github/memory-bank/progress.md`, `.github/memory-bank/systemPatterns.md` (dòng bố cục `body.explore` thêm ý: máy tính `.brand` lúc đóng chỉ còn ⚙), `docs/superpowers/specs/2026-11-10-thu-gon-bang-dieu-khien-design.md` (trạng thái → "Đã xây"), `tests/KET-QUA.md` (dòng kết quả nếu bảng có mục cho `test:mobile`), plan này (đánh dấu bước).

- [ ] **Step 1: Ghi D-025** vào `decisions.md`, theo mẫu D-024:
  - Bối cảnh: hai bảng che hai bên trên laptop 1440×780.
  - Quyết định: phương án B, dùng chung trạng thái tờ, Esc / bấm cảnh khi có tờ mở chỉ đóng tờ.
  - Hệ quả: thay vế "máy tính giữ nguyên" của D-019; test bấm nút trong bảng phải qua `tap` / `pick`.

- [ ] **Step 2: Báo người dùng thời gian ước tính trước khi chạy test nặng** (SwiftShader, 1–2 giờ cho đủ bộ) và đề xuất bộ tối thiểu: `test:mobile`, `test:tunnel`, `test:riverfront`, `test:sunwheel`, `test:explore`, `test:tour`, `test:weather`, `test:voice`. `test:drawcalls` không cần vì không đổi cảnh 3D. Chạy theo lựa chọn của người dùng. Trước khi chạy, kiểm không còn tiến trình `*-check.mjs` / `drawcalls.mjs` mồ côi.

- [ ] **Step 3: Cập nhật `activeContext.md`, `progress.md`** (đúng test đã chạy / chưa chạy). Sửa dòng "Nhánh đang làm" cũ (`feature/du-luon-roster-goc-phai` đã merge).

- [ ] **Step 4: Commit**
  ```bash
  git add .github/memory-bank docs/superpowers tests/KET-QUA.md
  git commit -m "docs: D-025 thu gọn bảng điều khiển, memory bank, kết quả test"
  ```
