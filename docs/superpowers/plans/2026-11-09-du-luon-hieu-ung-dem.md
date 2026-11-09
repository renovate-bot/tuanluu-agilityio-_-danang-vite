# Dù lượn ban đêm: cầu tự xoay, rồng tự phun — Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khi đang bay dù và trời là đêm, Cầu sông Hàn tự xoay lặp lại và Cầu Rồng tự phun lửa, nước; ban đêm ngoài dù và ban ngày không tự chạy.

**Architecture:** Một module nhỏ `src/explore/nightShows.ts` được gọi mỗi bước bay từ `advance()`. Nó chỉ bật `show.on` và điều khiển `SwingController` có sẵn, không thêm hình học hay UI. `swingUI.ts` có hai điều kiện chặn để camera không bị kéo đi và lịch 23:00 không chạy khi bay.

**Tech Stack:** Vite 6, TypeScript 5.9, three@0.165, test Chromium qua `tests/lib.mjs`.

**Spec:** [2026-11-09-du-luon-hieu-ung-dem-design.md](../specs/2026-11-09-du-luon-hieu-ung-dem-design.md)

## Global Constraints

- Làm trên nhánh `feature/du-luon-hieu-ung-dem`, không commit thẳng `main`. Tin nhắn commit kết thúc bằng dòng `Co-Authored-By` theo cấu hình phiên.
- Không thêm thư viện, ảnh, đèn, mesh; không có khóa i18n mới.
- Không thêm/bớt `rand()` lúc dựng scene, không đổi thứ tự `build*()`.
- Số mới nằm ở `CONFIG.explore`, chú thích tiếng Việt, đơn vị, `(ước lượng)`.
- Comment tiếng Việt, tiền tố hàm `ex*`.
- Chạy `npm run typecheck` sau mọi thay đổi `.ts`. Các test đọc `dist/`, nên build trước khi test.
- Bộ test nặng chỉ chạy một lần ở Task 3. Trước đó kiểm không còn tiến trình `*-check.mjs` / `drawcalls.mjs` mồ côi.

## Review Focus

1. Vào dù khi cầu đang quay 1× (từ lịch 23:00, hoặc đã mở): cầu tăng lên 30× và đóng xong như thường — test 6f.
2. Bão vừa hết trong lúc nghỉ hoặc lúc chờ: lượt mới bắt đầu, không kẹt và không phát `swingBlocked` lặp — test 6d.
3. Sang ngày khi cầu đang mở và tàu chưa qua: cầu chờ tàu rồi đóng, không có lượt mới — test 6c.
4. Bấm Đêm rồi Ngày liên tục: không có lượt thứ hai khi trời đang là ngày, `show.on` luôn theo trời — test 6c (không lượt mới), 6a/6b (`show.on`).
5. Trong suốt lượt quay người chơi vẫn lái được dù, `cam.mode` không rời `'glider'` — test 6b.

---

### Task 1: Bộ tự chạy ban đêm và chặn kéo camera

**Files:**
- Create: `src/explore/nightShows.ts`
- Modify: `src/config.ts` (trong `exploreBase`), `src/explore/index.ts`, `src/main.ts:96`, `src/ui/swingUI.ts:44`
- Test: `tests/explore-check.mjs` (mục 6, thêm trước `} catch (e) {` ở cuối file)

**Interfaces:**
- Produces:
  - `exNight: { enabled: boolean; rest: number; show: typeof show }` — `enabled` bật/tắt bộ tự chạy, `rest` là số giây nghỉ còn lại, `show` là tham chiếu để test đọc.
  - `exNightBind(ctrl: SwingController): void`
  - `exNightStep(dt: number): void`
  - `setupExplore(ctrl: SwingController): void` (đổi chữ ký)
  - `window.__app.explore.nightShows === exNight`
  - `CONFIG.explore.nightShows: { swingSpeed: number; swingRest: number }`, đọc mỗi bước, không chụp lại vào hằng số, vì test đổi giá trị lúc chạy.

- [ ] **Step 1: Tạo nhánh**

Run: `git switch -c feature/du-luon-hieu-ung-dem`
Expected: đang ở nhánh mới. Spec và plan chưa commit đi theo nhánh này.

- [ ] **Step 2: Viết test thất bại — mục 6 trong `tests/explore-check.mjs`**

Test rút ngắn thời gian bằng cách đổi config thành `swingSpeed = 600`, `swingRest = 0.2`, vì SwiftShader chạy chậm và `dt` bị chặn ở 0,05 s.

```js
// Mục 6 — hiệu ứng ban đêm khi bay dù
{
  const G = await openApp(browser, srv.url + '?explore=glider');
  await frames(G.page, 3);
  check('6 ?test mặc định tắt bộ tự chạy', await G.page.evaluate(() => window.__app.explore.nightShows.enabled === false));
  await G.page.evaluate(() => {
    const a = window.__app, n = a.exFlight.CONFIG_explore.nightShows;
    n.swingSpeed = 600; n.swingRest = 0.2; a.explore.nightShows.enabled = true;
    window.__c = { starts: 0, closed: 0, blocked: 0, leftGlider: false };
    const c = a.songHan.ctrl, C = window.__c;
    c.addEventListener('swingStart', () => C.starts++);
    c.addEventListener('swingClosed', () => C.closed++);
    c.addEventListener('swingBlocked', () => C.blocked++);
    const watch = () => { if (a.cam.mode !== 'glider') C.leftGlider = true; requestAnimationFrame(watch); }; watch();
  });
  const setNight = (v) => G.page.evaluate((v) => { window.__app.dayNight.target = v; }, v);
  const until = (fn, name) => G.page.waitForFunction(fn, { timeout: 120000 }).then(() => check(name, true), () => check(name + ' (hết giờ)', false));
  const read = () => G.page.evaluate(() => { const a = window.__app; return { on: a.explore.nightShows.show.on, fire: a.explore.nightShows.show.fireOn, state: a.songHan.ctrl.state, ...window.__c }; });

  await frames(G.page, 20);
  let r = await read();
  check('6a ngày: không phun, cầu đóng', !r.on && r.state === 'CLOSED' && r.starts === 0);

  await setNight(1);
  await until(() => window.__app.explore.nightShows.show.fireOn, '6b đêm: có phun lửa');
  await until(() => window.__c.starts >= 2 && window.__c.closed >= 1, '6b đêm: cầu quay hết một lượt rồi quay lượt tiếp');
  const y0 = await G.page.evaluate(() => { const s = window.__app.explore.state, y = s.yaw; for (let i = 0; i < 30; i++) window.__app.explore.step(1 / 60, { turn: 1, climb: 0, throttle: 0 }); return s.yaw - y; });
  r = await read();
  check('6b vẫn lái được dù, không rời chế độ glider', y0 !== 0 && !r.leftGlider);

  // 6c: giữ cầu ở OPEN (giả lập tàu chưa qua), chuyển sang ngày
  await G.page.evaluate(() => { const c = window.__app.songHan.ctrl; window.__cc = c.canClose; c.canClose = () => false; });
  await until(() => window.__app.songHan.ctrl.state === 'OPEN', '6c cầu đã mở');
  await setNight(0);
  await frames(G.page, 5);
  r = await read();
  check('6c sang ngày: dừng phun, cầu vẫn chờ tàu', !r.on && !r.fire && r.state === 'OPEN');
  await G.page.evaluate(() => { window.__app.songHan.ctrl.canClose = window.__cc; });
  await until(() => window.__app.songHan.ctrl.state === 'CLOSED', '6c tàu qua: cầu đóng');
  const s6c = (await read()).starts;
  await frames(G.page, 20);
  check('6c ban ngày không có lượt mới', (await read()).starts === s6c);

  // 6d: bão chặn rồi hết
  await G.page.evaluate(() => { window.__app.songHan.ctrl.canStart = () => false; window.__c.blocked = 0; });
  await setNight(1);
  await frames(G.page, 20);
  r = await read();
  check('6d bão: không quay, không phát swingBlocked', r.state === 'CLOSED' && r.blocked === 0);
  await G.page.evaluate(() => { window.__app.songHan.ctrl.canStart = () => true; window.__c.starts = 0; });
  await until(() => window.__c.starts >= 1, '6d hết bão: quay lượt mới');
  await setNight(0);
  await until(() => window.__app.songHan.ctrl.state === 'CLOSED', '6d về trạng thái đóng');

  // 6f: đang quay 1× khi đang bay thì tăng tốc và đóng xong
  await G.page.evaluate(() => { window.__app.songHan.ctrl.start(1); });
  await until(() => window.__app.songHan.ctrl.speed === 600, '6f cầu đang quay 1× được tăng tốc');
  await until(() => window.__app.songHan.ctrl.state === 'CLOSED', '6f cầu đóng xong');
  check('console sạch (mục 6)', G.errors.length === 0);
  await G.page.close();

  // 6e: ban đêm nhưng không bay dù
  const O = await openApp(browser, srv.url);
  await frames(O.page, 3);
  await O.page.evaluate(() => { const a = window.__app; a.explore.nightShows.enabled = true; a.dayNight.target = 1; });
  await frames(O.page, 20);
  const o = await O.page.evaluate(() => { const a = window.__app; return { on: a.explore.nightShows.show.on, state: a.songHan.ctrl.state }; });
  check('6e không bay dù: không tự chạy', !o.on && o.state === 'CLOSED');
  await O.page.close();
}
```

- [ ] **Step 3: Chạy test, xác nhận thất bại**

Run: `npm run build && npm run test:explore`
Expected: LỖI ở mục 6, ngoại lệ vì `nightShows` hoặc `enabled` là undefined.

- [ ] **Step 4: Thêm config vào `exploreBase`, ngay sau dòng `returnTurnSpeed`**

```ts
  nightShows: { swingSpeed: 30, swingRest: 30 },   // hệ số tăng tốc quay Cầu sông Hàn khi bay ban đêm (như Tour); s nghỉ giữa hai lượt (ước lượng)
```

- [ ] **Step 5: Tạo `src/explore/nightShows.ts`**

`exNight` mặc định `{ enabled: true, rest: 0, show }` (import `show` từ `../bridges/dragon/effects`, `dayNight` từ `../core/dayNight`). Thân `exNightStep`:

```ts
if (!exNight.enabled || !ctrl) return;
const C = CONFIG.explore.nightShows, night = dayNight.target > 0.5;
if (show.on !== night) { show.on = night; show.t = 0; }   // đổi trời: bắt đầu lại từ lần phun đầu
if (ctrl.state !== 'CLOSED') {                            // đang quay (cả lúc đã sang ngày): đi nốt tới đóng
  ctrl.speed = C.swingSpeed;
  if (ctrl.state === 'OPEN') ctrl.requestClose();
  exNight.rest = C.swingRest;
  return;
}
if (!night) return;
exNight.rest = Math.max(0, exNight.rest - dt);
if (exNight.rest === 0 && ctrl.canStart()) ctrl.start(C.swingSpeed);   // hỏi canStart trước để bão không phát swingBlocked mỗi khung
```

- [ ] **Step 6: Nối vào `src/explore/index.ts` và `src/main.ts`**

- `advance()`: gọi `exNightStep(dt)` sau `exShowSpeed()`.
- Object `explore`: thêm `nightShows: exNight`.
- `setupExplore(ctrl: SwingController)`: dòng đầu gọi `exNightBind(ctrl)`; ngay sau khi có `q` đặt `exNight.enabled = !q.has('test')`, phải đứng trước dòng `explore.start()`.
- `main.ts:96`: `setupExplore(songHan.ctrl)`. Kiểm `songHan` đã được tạo trước dòng này.

- [ ] **Step 7: Chặn kéo camera trong `src/ui/swingUI.ts:44`**

Thêm `&& cam.mode !== 'glider'` vào điều kiện của `swingStart`. `saved` khi đó giữ `null` nên `swingClosed` không cần sửa.

- [ ] **Step 8: Chạy test, xác nhận đạt**

Run: `npm run typecheck && npm run build && npm run test:explore`
Expected: dòng cuối `explore-check: đạt`, các mục 1–5 cũ vẫn đạt.

- [ ] **Step 9: Commit**

```bash
git add docs/superpowers/specs/2026-11-09-du-luon-hieu-ung-dem-design.md docs/superpowers/plans/2026-11-09-du-luon-hieu-ung-dem.md src/explore/nightShows.ts src/explore/index.ts src/config.ts src/main.ts src/ui/swingUI.ts tests/explore-check.mjs
git commit -m "feat(explore): ban đêm khi bay dù, cầu sông Hàn tự xoay và Cầu Rồng tự phun"
```

### Task 2: Lịch tự quay 23:00 không chạy khi bay dù

**Files:**
- Modify: `src/ui/swingUI.ts:53`
- Test: `tests/explore-check.mjs` (mục 7, ngay sau mục 6)

**Interfaces:**
- Consumes: `cam.mode` đã import sẵn trong `swingUI.ts`.

- [ ] **Step 1: Viết test thất bại**

Lịch kiểm mỗi 20 s, nên test giả giờ rồi chờ 21 s thật.

```js
// Mục 7 — lịch 23:00 không chạy khi bay dù (bộ tự chạy tắt do ?test)
{
  const S = await openApp(browser, srv.url + '?explore=glider');
  await frames(S.page, 3);
  await S.page.evaluate(() => { const t = Date.UTC(2026, 10, 7, 16, 2, 0); Date.now = () => t; });   // 23:02 thứ Bảy giờ Việt Nam
  await new Promise((r) => setTimeout(r, 21000));
  check('7 lịch 23:00 không quay cầu khi bay dù', await S.page.evaluate(() => window.__app.songHan.ctrl.state === 'CLOSED'));
  await S.page.close();
}
```

- [ ] **Step 2: Chạy test, xác nhận thất bại**

Run: `npm run build && npm run test:explore`
Expected: `LỖI 7 lịch 23:00 không quay cầu khi bay dù`.

- [ ] **Step 3: Thêm `cam.mode !== 'glider'` vào điều kiện `if` ở `src/ui/swingUI.ts:53`**

- [ ] **Step 4: Chạy test, xác nhận đạt**

Run: `npm run typecheck && npm run build && npm run test:explore`
Expected: `explore-check: đạt`.

- [ ] **Step 5: Commit**

```bash
git add src/ui/swingUI.ts tests/explore-check.mjs
git commit -m "fix(explore): lịch tự quay cầu 23:00 không chạy khi đang bay dù"
```

### Task 3: Kiểm tra đủ bộ và cập nhật tài liệu

**Files:**
- Modify: `tests/KET-QUA.md`, `.github/memory-bank/decisions.md`, `.github/memory-bank/activeContext.md`, `.github/memory-bank/progress.md`

- [ ] **Step 1: Chạy đủ bộ test một lần** (vì đã sửa ngoài `src/explore/`)

Run lần lượt: `npm run build`, `test:drawcalls`, `test:tour`, `test:tunnel`, `test:riverfront`, `test:voice`, `test:weather`, `test:sunwheel`, `test:mobile`, `test:explore`, `test:perf -- --strict`.
Expected: đều đạt; `test:drawcalls` góc cũ chênh 0, trừ dao động `swTour` đã biết (D-018: ngày 187 vs 188, đêm 209 vs 207). Có lỗi thì ghi nguyên văn và xử lý, không bỏ qua.

- [ ] **Step 2: Xem bằng mắt ở `npm run dev`** (URL `?explore=glider`, không có `?test`)

Bấm nút Đêm, bay tới Cầu sông Hàn và Cầu Rồng. Expected: thấy cầu xoay và lửa, nước từ khoảng cách bay bình thường; dù vẫn lái được; bấm Ngày thì ngừng phun và cầu về đóng.

- [ ] **Step 3: Ghi kết quả và cập nhật memory bank**

`KET-QUA.md`: kết quả thật của Step 1. `decisions.md`: D-022 tóm tắt spec §6. `activeContext.md`, `progress.md`: theo prompt `update-memory-bank`, gồm phần còn thiếu: chưa đo FPS trên GPU thật khi cầu quay và phun cùng lúc.

- [ ] **Step 4: Commit**

```bash
git add tests/KET-QUA.md .github/memory-bank/
git commit -m "docs(explore): ghi kết quả đủ bộ test hiệu ứng đêm khi bay dù (D-022)"
```
