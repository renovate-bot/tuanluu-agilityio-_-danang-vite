# Tự khám phá bằng dù lượn — Kế hoạch thực hiện

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm màn chọn phương tiện khi vào trang và chế độ bay dù lượn tự do (WASD, góc nhìn thứ ba) từ đỉnh Sơn Trà, không làm thay đổi bản "Tham quan có hướng dẫn".

**Architecture:** Mã mới nằm trong `src/explore/`: mô hình bay thuần (`flight.ts`), mô hình dù (`glider.ts`), camera bám (`chase.ts`), màn chọn (`chooser.ts`), điều phối (`index.ts`). Chế độ camera mới `'glider'`: `updateCamera()` bỏ qua, `explore.update(dt)` đặt camera, giống mẫu `swRide` (D-016). Màn chọn là lớp phủ HTML. Dù chỉ thêm vào scene khi bắt đầu bay. Thoát thì tải lại trang.

**Tech Stack:** Vite 6, TypeScript 5.9, three@0.165, Playwright + SwiftShader cho test.

**Spec:** `docs/superpowers/specs/2026-11-02-tu-kham-pha-du-luon-design.md`

## Global Constraints

- Không đổi thứ tự `build*()` trong `src/main.ts`, không thêm/bớt `rand()` trong code cũ; mã mới không gọi `rand()`.
- Góc nhìn cũ: `test:drawcalls` chênh **0** so với `tests/KET-QUA.md`.
- Mọi thông số trong `CONFIG.explore` (`src/config.ts`), mỗi dòng chú thích tiếng Việt + đơn vị + `(ước lượng)`.
- Khóa i18n mới đủ 9 file `src/i18n/locales/{vi,en,ko,ja,zh,th,ar,hi,ru}.json` qua `scripts/add-explore-locales.mjs` (mẫu `scripts/add-quality-locales.mjs`); `ar` RTL.
- Không thêm thư viện, ảnh, mô hình ngoài; không `PointLight`/`SpotLight`; đèn đêm của dù đọc `shared.uNight`.
- Comment tiếng Việt, khối `/* ===== ... ===== */`, tiền tố hàm `ex*`, không tự format lại file cũ.
- URL: không tham số → màn chọn; `?test` → bỏ qua màn chọn (như cũ); `?test&chooser` → màn chọn + `window.__app`; `?explore=glider` (có hoặc không `test`) → vào thẳng bay.
- `npm run typecheck` sau mọi thay đổi `.ts`; `npm run build` trước mọi test (test đọc `dist/`).
- Subagent không đọc nguyên `src/config.ts` (58 KB ≈ 20k token): dùng grep tìm khối cần sửa rồi chỉ đọc đoạn đó.
- Trước mỗi lần chạy test: không còn tiến trình `*-check.mjs`/`drawcalls.mjs` mồ côi (xem `activeContext.md`, Bước tiếp theo, mục 7).

## Review Focus

1. **Phím kẹt khi mất focus** (Alt+Tab khi đang giữ A): dù phải ngừng rẽ (`keys.clear()` khi `blur` đã có). Test ở Task 3.
2. **Gõ phím khi focus trong ô chọn** (`#langSelect`, `#qualitySel`): W/S/A/D/mũi tên phải đổi ô chọn, không lái dù. Test ở Task 3.
3. **Esc ở bản hướng dẫn** phải giữ hành vi cũ (thoát Tour / xuống cabin), không tải lại trang. Test ở Task 4.
4. **Đổi ngày/đêm khi đang bay**: đèn trên cánh sáng/tắt theo `shared.uNight`, draw call ngày = đêm. Test ở Task 2 (mesh) và Task 5 (đo).
5. **Giữ A mãi ở góc vùng bay**: dù không thoát ra ngoài và không giật qua lại. Test ở Task 3.

---

## Cách chia việc, chọn model và tiết kiệm token

Người điều phối (phiên chính) giữ kế hoạch và bảng Sổ token cuối plan. Mỗi task giao cho một subagent mới. Subagent chỉ nhận **đoạn task của mình**, mục Global Constraints và khối Interfaces, không nhận cả file kế hoạch.

| Task | Nội dung | Implementer | Reviewer | Lý do |
|---|---|---|---|---|
| 1 | `CONFIG.explore` + mô hình bay thuần | **sonnet** | **sonnet** | Toán vector, cần đúng quy ước trục |
| 2 | Mô hình dù + camera bám | **sonnet** | **haiku** (đối chiếu checklist) | Hình học + cảm giác, test đã định sẵn |
| 3 | Điều phối, phím, `'glider'`, `?explore=glider` | **sonnet** | **sonnet** | Đụng `camera.ts` và `main.ts` dùng chung |
| 4 | Màn chọn + giao diện khi bay + i18n | **sonnet** | **sonnet** | DOM/CSS, bản dịch 9 ngôn ngữ, dễ lọt lỗi nếu chỉ đối chiếu checklist |
| 5 | Đo draw call / ms + chạy đủ bộ test | điều phối chạy nền (0 token LLM) + **haiku** ghi `KET-QUA.md` | — | Chỉ đọc log |
| 6 | Tài liệu + memory bank (D-020) | **haiku** | — | Viết theo mẫu có sẵn |
| Cuối | Review toàn nhánh | — | **opus** | Một lần, bắt lỗi liên task |

Cách tiết kiệm token:
1. **Chạy test bằng Bash nền, không qua subagent.** Test SwiftShader mất 10–20 phút. Điều phối chạy với `run_in_background` rồi đọc dòng cuối và các dòng `LỖI`, không đọc cả log.
2. **Mỗi subagent chỉ chạy test của task mình** (`test:explore` với một mục). Chạy đủ bộ test một lần ở Task 5.
3. **Reviewer haiku** chỉ dùng cho Task 2, nơi test đã khóa hành vi. **Opus** chỉ dùng một lần cho review cuối.
4. **Ảnh tự xem**: tối đa 4 ảnh 960×600, chỉ ở Task 2 và Task 4.
5. **Ghi token**: thông báo hoàn thành của mỗi subagent có `subagent_tokens`. Điều phối ghi số này vào bảng Sổ token cuối plan, kèm Agent (tên/ID ngắn) và Model; không dùng GitHub Project để tránh thêm lượt cho phiên điều phối.

---

### Task 1: `CONFIG.explore` và mô hình bay thuần

**Files:**
- Modify: `src/config.ts` (thêm khối `explore` cạnh các khối cùng cấp, trước `export const CONFIG` nếu file theo mẫu `xxxBase`)
- Create: `src/explore/flight.ts`
- Create: `tests/explore-check.mjs`, thêm `"test:explore": "node tests/explore-check.mjs"` vào `package.json`

**Interfaces:**
- Produces:
  - `CONFIG.explore`:
    - `speed: 25` (m/s)
    - `turnRate: 0.6` (rad/s ở góc nghiêng tối đa)
    - `bankMax: 0.45` (rad)
    - `bankRate: 2.5` (1/s, tốc độ tiến tới góc nghiêng đích)
    - `climbRate: 6` (m/s)
    - `floor: 30`, `ceiling: 800` (m, y thế giới)
    - `takeoff: [2600, 702, -4700]`
    - `takeoffYaw: Math.atan2(-1800, -2600)` (hướng về Thuận Phước `(0, −2900)`)
    - `bounds: { x0: -2600, x1: 3600, z0: -5600, z1: 2800 }`
    - `returnMargin: 400` (m)
    - `chase: { back: 18, up: 6, lag: 0.25 }` (m, m, s)
    - `glider: { span: 11, lines: 7 }` (m)
    - Mọi số trên ghi `(ước lượng)`; riêng `speed` ghi "dù thật ≈ 10 m/s, chọn nhanh hơn để dễ chơi".
  - `src/explore/flight.ts`:
    - `export interface GliderState { pos: THREE.Vector3; yaw: number; bank: number }`. Hướng bay `(cos yaw, 0, −sin yaw)`, cùng quy ước với `walk` trong `src/views/camera.ts`. `yaw` tăng là rẽ trái. `bank > 0` là nghiêng trái.
    - `export interface GliderInput { turn: -1 | 0 | 1; climb: -1 | 0 | 1 }`: `turn` +1 = A (trái), `climb` +1 = W (lên).
    - `export function exCreate(): GliderState`: tạo trạng thái tại `takeoff`, `takeoffYaw`, `bank` 0.
    - `export function exStep(s: GliderState, inp: GliderInput, dt: number): void`: tốc độ ngang luôn đúng `speed`; `bank` tiến về `turn·bankMax` theo `bankRate`; `yaw += turnRate·(bank/bankMax)·dt`; `y += climb·climbRate·dt`, kẹp `[floor, ceiling]`. Gần ranh giới thì ghi đè `turn` (xem Step 3). Không cấp phát mỗi lần gọi.
    - `export function exInputFromKeys(keys: Set<string>): GliderInput`: `a`/`arrowleft` → +1, `d`/`arrowright` → −1, `w`/`arrowup` → +1, `s`/`arrowdown` → −1; nhấn cả hai phím ngược nhau thì 0.

Task 1 chưa có cách gọi từ trình duyệt. Test của task này dùng móc tạm `window.__app.exFlight = { exCreate, exStep, exInputFromKeys, CONFIG_explore }`, thêm vào khối `?test` trong `main.ts` (một dòng, chỉ trong khối đó). Task 3 thay móc này bằng `__app.explore`.

- [ ] **Step 1: Viết test (mục 1 của `tests/explore-check.mjs`)**

Theo mẫu `tests/mobile-check.mjs`: `check(name, ok)`, `serveDir('dist')`, `openApp(browser, url)`, cuối file `process.exit(problems.length ? 1 : 0)`. Các kiểm, chạy trong `page.evaluate`, mỗi kiểm 30 s mô phỏng với `dt = 1/60`:

```js
// 1a tốc độ ngang không đổi: mọi bước |Δ(x,z)|/dt ∈ [24.99, 25.01], kể cả khi turn = ±1 và climb = ±1
// 1b A rẽ trái: sau 3 s turn=+1, yaw tăng > 0.5 rad; D thì giảm < −0.5 rad
// 1c W/S: 200 s climb=+1 → y === 800; 200 s climb=−1 → y === 30
// 1d thả phím tự cân bằng: sau 2 s turn=+1 rồi 3 s turn=0, |bank| < 0.01 và |Δyaw trong 0.5 s cuối| < 0.005
// 1e ranh giới: xuất phát tại takeoff, turn = 0 suốt 600 s → mọi bước x ∈ [x0, x1], z ∈ [z0, z1]
// 1f giữ A ở góc (x1−50, z0+50, hướng ra ngoài) 600 s → không vượt ranh giới; trong 60 s cuối số lần đổi dấu của bank ≤ 2
// 1g exInputFromKeys: {'a'}→turn 1; {'arrowright'}→−1; {'a','d'}→0; {'w'}→climb 1; {'s','arrowup'}→0
// 1h exCreate(): pos === takeoff, yaw === takeoffYaw
```

- [ ] **Step 2: Chạy để xác nhận lỗi**

Run: `npm run build && npm run test:explore`
Expected: thoát mã 1, báo `__app.exFlight` không tồn tại.

- [ ] **Step 3: Viết `CONFIG.explore` và `flight.ts`**

Thuật toán ranh giới (test chưa đủ để xác định cách làm nên ghi ở đây). Gọi `d` là khoảng cách ngắn nhất từ `pos` tới mép khung. Khi `d < returnMargin`:
- tính hướng về tâm khung `c`;
- lấy `w = 1 − d/returnMargin`;
- nếu hướng bay đang đi ra ngoài (tích vô hướng giữa hướng bay và hướng tới tâm < 0.3), thay `turn` bằng dấu của góc lệch yaw → hướng tâm, với trọng số `w`. Cụ thể `turnEff = lerp(inp.turn, sign(Δ), w)`, và tại `d ≤ 0.25·returnMargin` thì `turnEff = sign(Δ)`;
- vị trí luôn kẹp cứng vào khung để không bao giờ vượt.

- [ ] **Step 4: Chạy test**

Run: `npm run typecheck && npm run build && npm run test:explore`
Expected: mọi dòng `đạt`, thoát mã 0.

- [ ] **Step 5: Commit**

```bash
git add src/config.ts src/explore/flight.ts src/main.ts tests/explore-check.mjs package.json
git commit -m "feat(explore): CONFIG.explore và mô hình bay dù lượn"
```

---

### Task 2: Mô hình dù và camera bám

**Files:**
- Create: `src/explore/glider.ts`, `src/explore/chase.ts`
- Modify: `tests/explore-check.mjs` (mục 2), móc tạm trong `main.ts` (thêm `exBuildGlider`, `exPlaceGlider`, `exChase`)
- Create: `tests/explore-shots.mjs` (ảnh vào `tests/screens/explore/`, không commit ảnh)

**Interfaces:**
- Consumes: `GliderState`, `CONFIG.explore.glider`, `CONFIG.explore.chase`, `shared.uNight`.
- Produces:
  - `export function exBuildGlider(): THREE.Group`: cánh vòm (cong theo sải `span`), dây (hộp mảnh), người treo cách cánh `lines`. Gộp `mergeGeometries` thành **một** mesh, vertex color, `MeshStandardMaterial({ vertexColors: true })`. Dải đèn mép cánh là emissive (vertex color riêng hoặc `emissiveMap` canvas). `castShadow = false`. Không gọi `scene.add`. `name = 'ex-glider'`.
  - `export function exPlaceGlider(g: THREE.Group, s: GliderState): void`: đặt vị trí, quay theo `yaw` rồi `bank` (cuộn quanh trục bay); `emissiveIntensity = shared.uNight.value`.
  - `export function exChase(camera: THREE.PerspectiveCamera, target: THREE.Vector3, s: GliderState, dt: number, snap = false): void`:
    - camera đích = `pos − forward·back + up·up`;
    - lerp theo `1 − exp(−dt/lag)`; `snap` thì đặt thẳng;
    - nhìn vào `pos + forward·30`;
    - ghi điểm nhìn đó vào `target` để `controls.target` (và tâm bóng đổ trong `main.ts`) bám theo.

- [ ] **Step 1: Viết test (mục 2)**

```js
// 2a mesh: exBuildGlider() có đúng 1 Mesh con (traverse đếm isMesh), castShadow false, tổng bbox rộng ∈ [10, 12] m
// 2b chưa bay: scene không chứa object tên 'ex-glider' (draw call góc cũ không đổi)
// 2c thêm vào scene tại pose takeoff, camera exChase(snap): renderer.info.render.calls (thêm) − (không) ∈ [1, 2]; đêm = ngày
// 2d exPlaceGlider với bank 0.45: góc cuộn của group ≈ 0.45 ± 1e-3
// 2e exChase snap: khoảng cách camera→pos ≈ hypot(18, 6) ± 0.01; camera cao hơn pos 6 ± 0.01; camera nằm sau (dot((pos−cam), forward) > 0)
// 2f exChase không snap: sau 1 bước dt=1/60 camera còn cách đích > 0 (có trễ); sau 3 s (180 bước) cách đích < 0.05 m
// 2g đêm: shared.uNight=1 → material.emissiveIntensity === 1; ngày → 0
```

- [ ] **Step 2: Chạy để xác nhận lỗi**

Run: `npm run build && npm run test:explore`
Expected: mục 2 LỖI (hàm chưa có), mục 1 vẫn đạt.

- [ ] **Step 3: Viết `glider.ts` và `chase.ts`**, theo Interfaces ở trên.

- [ ] **Step 4: Chạy test và chụp ảnh**

Run: `npm run typecheck && npm run build && npm run test:explore && node tests/explore-shots.mjs`
Expected: test đạt. Có 2 ảnh: `takeoff-ngay.png` (thấy dù từ phía sau, phía trước là cửa sông) và `takeoff-dem.png` (mép cánh sáng). Implementer tự xem hai ảnh này.

- [ ] **Step 5: Commit**

```bash
git add src/explore/glider.ts src/explore/chase.ts src/main.ts tests/explore-check.mjs tests/explore-shots.mjs
git commit -m "feat(explore): mô hình dù lượn và camera bám góc nhìn thứ ba"
```

---

### Task 3: Điều phối chế độ bay, phím, `?explore=glider`

**Files:**
- Create: `src/explore/index.ts`
- Modify: `src/views/state.ts:4` (thêm `'glider'` vào `CameraMode`)
- Modify: `src/views/camera.ts` (`updateCamera`: thêm nhánh `else if (cam.mode === 'glider') { /* explore.update đặt camera */ }` ngay sau nhánh `swRide`)
- Modify: `src/main.ts`:
  - gọi `explore.update(dt)` ngay sau `updateCamera(dt)`;
  - gọi `setupExplore()` sau `setupCompactUI()`;
  - trong khối `?test`: thay móc tạm `exFlight` bằng `explore`.
- Modify: `tests/explore-check.mjs` (mục 3; mục 1–2 chuyển sang gọi qua `__app.explore`)

**Interfaces:**
- Consumes: Task 1, Task 2.
- Produces (`src/explore/index.ts`):
  - `export const explore = { active(): boolean; state: GliderState | null; glider: THREE.Group | null; start(): void; update(dt: number): void; exit(): void; step(dt: number, inp: GliderInput): void }`.
  - `start()`:
    - tạo state;
    - dựng dù (chỉ lần đầu), `scene.add`;
    - `cam.mode = 'glider'`, `controls.enabled = false`;
    - gọi `exChase(..., snap = true)`;
    - thêm `body.explore`.
  - `update(dt)`: chỉ chạy khi `active()`: `exInputFromKeys(keys)` → `exStep` → `exPlaceGlider` → `exChase(camera, controls.target, …)`.
  - `step(dt, inp)`: dùng cho test, như `update` nhưng nhận input trực tiếp.
  - `exit()`: `location.replace(url bỏ tham số explore và chooser)`.
  - `export function setupExplore(): void`:
    - đọc URL; có `explore=glider` thì gọi `start()` (Task 4 thêm phần màn chọn);
    - gắn listener `keydown` riêng: chỉ khi `active()` và `e.target` không phải `select`/`input`/`textarea` thì `keys.add(e.key.toLowerCase())`; mũi tên thì `preventDefault`; Esc thì `exit()`.
    - **Không** sửa listener cũ trong `src/ui/setupUI.ts`. `keyup`/`blur` cũ đã xoá phím.

- [ ] **Step 1: Viết test (mục 3)**, mở bằng `openApp(browser, url + '?explore=glider')`:

```js
// 3a cam.mode === 'glider', controls.enabled === false, body có class 'explore', scene có 'ex-glider'
// 3b nhấn giữ 'a' 1.5 s (page.keyboard.down/up, canvas có focus) → state.yaw tăng; thả → không tăng thêm sau 3 s quá độ
// 3c giữ 'a', rồi page.evaluate(() => window.dispatchEvent(new Event('blur'))) → keys rỗng, bank về ~0 sau 3 s
// 3d focus #qualitySel, nhấn 'ArrowDown' 3 lần → state.yaw/y không đổi do phím (so với bước không phím), giá trị select đổi
// 3e controls.target bám điểm nhìn: |controls.target − (pos + forward·30)| < 1
// 3f Esc → page.waitForURL(u => !u.includes('explore=')) (trang tải lại)
// 3g openApp không tham số (chỉ ?test): cam.mode === 'orbit', không có 'ex-glider', body không có 'explore'
```

- [ ] **Step 2: Chạy để xác nhận lỗi**

Run: `npm run build && npm run test:explore`
Expected: mục 3 LỖI.

- [ ] **Step 3: Viết `index.ts` và các chỗ sửa nhỏ** theo Interfaces ở trên.

- [ ] **Step 4: Chạy test của task và test hồi quy gần nhất**

Run: `npm run typecheck && npm run build && npm run test:explore && npm run test:tour`
Expected: cả hai đạt. `test:tour` kiểm rằng việc thêm nhánh vào `updateCamera` và lời gọi trong vòng animate không làm hỏng Tour và Esc cũ.

- [ ] **Step 5: Commit**

```bash
git add src/explore/index.ts src/views/state.ts src/views/camera.ts src/main.ts tests/explore-check.mjs
git commit -m "feat(explore): chế độ camera glider, điều khiển phím, ?explore=glider"
```

---

### Task 4: Màn chọn phương tiện, giao diện khi bay, i18n

**Files:**
- Create: `src/explore/chooser.ts`, `scripts/add-explore-locales.mjs`
- Modify: `index.html` (`#chooser` lớp phủ; `#exHint` dòng hướng dẫn; `#btnExExit`), `src/styles/main.css` (khối `/* ===== Tự khám phá ===== */`: `#chooser`, `body.explore …`), `src/explore/index.ts` (`setupExplore` gọi màn chọn), 9 file `src/i18n/locales/*.json` (qua script)
- Modify: `tests/explore-check.mjs` (mục 4)

**Interfaces:**
- Consumes: `explore.start()`, `explore.exit()`, `t()`/`apply()` từ `src/i18n/index.ts`.
- Produces:
  - `export function exShowChooser(onPick: (choice: 'glider' | 'guided') => void): void`
  - `export function exHideChooser(): void`
  - Khóa i18n (tên do implementer đặt, tiền tố `ex`, ví dụ `exTitle`, `exGlider`, `exCar`, `exBike`, `exWalk`, `exGuided`, `exSoon`, `exDesktopOnly`, `exHint`, `exExit`):
    - vi `exHint`: "W/S hoặc ↑/↓ để lên/xuống · A/D hoặc ←/→ để rẽ · Esc để thoát"
    - vi `exSoon`: "Sắp có"
    - vi `exDesktopOnly`: "Chỉ dùng trên máy tính"
- Hành vi:
  - `setupExplore()`:
    - có `explore=glider` → `start()`;
    - không thì, nếu không có `test` hoặc có `chooser` → `exShowChooser`;
    - `glider` → `start()`; `guided` → ẩn màn chọn, giữ nguyên giao diện cũ.
  - Thẻ ô tô/xe máy/đi bộ là `button disabled` + nhãn "Sắp có".
  - Thẻ dù lượn `disabled` + "Chỉ dùng trên máy tính" khi `matchMedia('(hover: none)').matches`.
  - `body.explore`:
    - chỉ hiện `#langSelect`, `#btnNight`, `#qualitySel` (kèm nhãn), `#exHint`, `#btnExExit`;
    - mọi `[data-bridge]`, `[data-view]`, `#tourCaption`, `#weatherSel`, `#btnWxStorm`, `#timeSlider`, `#btnMusic`, bảng Thông số và HUD đều ẩn (HUD giữ khi URL có `test` để test đo draw call).
  - `#btnExExit` → `explore.exit()`.
  - Màn chọn hiện sau khung đầu (cảnh đã dựng phía sau), chặn chuột vào canvas tới khi chọn.

- [ ] **Step 1: Viết test (mục 4)**

```js
// 4a ?chooser (openApp thêm &test): #chooser hiện; 5 thẻ; thẻ ô tô/xe máy/đi bộ disabled; thẻ dù lượn enabled
// 4b chỉ ?test: #chooser không hiện (test cũ không đổi)
// 4c bấm thẻ "Tham quan có hướng dẫn": #chooser ẩn, cam.mode 'orbit', [data-bridge="dragon"] hiện và bấm được (pickView chạy)
// 4d bấm thẻ dù lượn: cam.mode 'glider'; các id được giữ đều hiện (visibleAll); danh sách cần ẩn đều ẩn (hiddenAll)
// 4e #btnExExit → trang tải lại, URL không còn 'explore='
// 4f openApp(..., { mobile: true }) với ?chooser: thẻ dù lượn disabled và có chữ t('exDesktopOnly')
// 4g bản hướng dẫn: Esc khi đang Tour (bấm data-view tour) → thoát Tour, URL không đổi, không tải lại (Review Focus 3)
// 4h 9 locale đủ mọi khóa ex*; đổi sang ar khi đang bay: html dir=rtl, #exHint có chữ khác vi
```

- [ ] **Step 2: Chạy để xác nhận lỗi**

Run: `npm run build && npm run test:explore`
Expected: mục 4 LỖI.

- [ ] **Step 3: Viết `chooser.ts`, HTML/CSS và `add-explore-locales.mjs`; chạy `node scripts/add-explore-locales.mjs`**

Bản dịch: implementer tự dịch 8 ngôn ngữ; `ar` RTL. Ghi vào "Chưa làm" rằng chưa có người bản ngữ duyệt.

- [ ] **Step 4: Chạy test, test mobile và ảnh**

Run: `npm run typecheck && npm run build && npm run test:explore && npm run test:mobile && node tests/explore-shots.mjs`
Expected: đạt. Thêm ảnh `chooser.png` và `flying-ui.png` vào `explore-shots.mjs`. Implementer tự xem hai ảnh này.

- [ ] **Step 5: Commit**

```bash
git add src/explore index.html src/styles/main.css src/i18n/locales scripts/add-explore-locales.mjs tests/explore-check.mjs tests/explore-shots.mjs
git commit -m "feat(explore): màn chọn phương tiện, giao diện khi bay, i18n 9 ngôn ngữ"
```

---

### Task 5: Đo đạc và chạy đủ bộ test

**Files:**
- Modify: `tests/explore-check.mjs` (mục 5), `tests/KET-QUA.md` (mục mới "Tự khám phá")

**Interfaces:**
- Consumes: `__app.explore.state` (gán `pos`/`yaw` trực tiếp để đặt tư thế).

- [ ] **Step 1: Viết mục 5 (đo, không fail trừ ngày ≠ đêm)**

Bốn tư thế bay:
- `exTakeoff`: điểm cất cánh;
- `exDragon`: trên Cầu Rồng, `(0, 120, 400)`, nhìn Bắc;
- `exTp`: gần Thuận Phước, `(300, 150, −2400)`, nhìn Bắc;
- `exHigh`: trên cao, `(0, 800, 1500)`, nhìn Bắc.

Mỗi tư thế đo ngày và đêm: `renderer.info.render.calls` (trung vị 5 khung) và `perf.stats().avg`. In ra bảng. Kiểm: số draw call phần dù (bật/tắt `ex-glider`) ngày = đêm.

- [ ] **Step 2: Điều phối chạy đủ bộ test ở nền, lần lượt, không chồng nhau**

Run: `npm run build`, rồi lần lượt:
- `test:explore`, `test:drawcalls`, `test:tour`, `test:tunnel`, `test:riverfront`, `test:voice`, `test:weather`, `test:sunwheel`, `test:mobile`, `test:perf -- --strict`

Mỗi lệnh ghi log `tests/screens/explore-logs/<tên>.log`.
Expected: tất cả thoát mã 0. `test:drawcalls` góc cũ chênh 0, trừ `swTour` dao động đã biết (D-018).

Không chạy `test:weather` trong khung 23:00–23:10 tối thứ Bảy (lịch tự quay cầu).

- [ ] **Step 3: Haiku ghi `KET-QUA.md`** từ phần cuối các log: bảng 4 tư thế × ngày/đêm (draw call, ms), kết quả từng test. Chỉ ghi số có trong log.

- [ ] **Step 4: Commit**

```bash
git add tests/explore-check.mjs tests/KET-QUA.md
git commit -m "test(explore): đo draw call các tư thế bay, ghi KET-QUA"
```

---

### Task 6: Tài liệu và memory bank

**Files:**
- Modify: `.github/memory-bank/decisions.md` (D-020), `activeContext.md`, `progress.md`, `systemPatterns.md` (mẫu "chế độ điều khiển tự do: mô hình thuần + chase + body class"), `README.md` (mục Cấu trúc thêm `src/explore/`, lệnh `test:explore`), `.github/copilot-instructions.md` §5 (thêm `npm run test:explore`)

- [ ] **Step 1: Haiku viết theo mẫu D-016/D-019.** D-020 ghi các quyết định ở §6 của spec, gồm: Thoát = tải lại trang, không có va chạm, URL `?explore=glider`/`?chooser`. "Chưa làm" lấy từ §3 spec, cộng với bản dịch chưa được duyệt.
- [ ] **Step 2: Kiểm** `npm run build` (đổi tài liệu không được làm hỏng build).
- [ ] **Step 3: Commit** `docs: memory bank và README cho chế độ tự khám phá (D-020)`.

---

### Review cuối (opus)

Reviewer đọc spec, plan và `git diff main...feature/explore-du-luon`. Trọng tâm:
- 5 dòng Review Focus;
- bất biến seed và draw call;
- không đụng code cũ ngoài danh sách file của các task;
- mọi chuỗi đều qua i18n.

Kết quả: danh sách lỗi theo mức nghiêm trọng. Lỗi nào sửa thì làm task phụ (sonnet) rồi chạy lại test liên quan. Ghi token vào dòng "Cuối" của Sổ token và cộng tổng.

## Sổ token (điều phối điền khi chạy)

| Task | Agent | Model | Tokens implementer | Tokens reviewer | Tổng |
|---|---|---|---|---|---|
| T1 | | | | | |
| T2 | | | | | |
| T3 | | | | | |
| T4 | | | | | |
| T5 | | | | | |
| T6 | | | | | |
| Cuối | | | | | |
