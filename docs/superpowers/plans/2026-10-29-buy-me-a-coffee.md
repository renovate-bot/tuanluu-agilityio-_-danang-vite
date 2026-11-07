# Buy me a coffee (MoMo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm liên kết "Buy me a coffee" ở cuối panel Cài đặt, mở trang nhận tiền MoMo của tác giả ở tab mới.

**Architecture:** Một thẻ `<a>` tĩnh trong `.panel.brand` (`index.html`), icon SVG inline; `src/ui/donateUI.ts` đọc URL từ `CONFIG.ui.donate.url`, chỉ nhận `https:`, URL rỗng/sai thì ẩn liên kết. Không đụng cảnh 3D, không thêm draw call. Điện thoại: liên kết nằm trong `#brandBody` nên tự vào sheet Cài đặt (D-019).

**Tech Stack:** Vite 6 + TypeScript 5.9, DOM thuần, test Playwright trong `tests/mobile-check.mjs` (đọc `dist/`).

**Spec (quyết định của người dùng, 2026-10-29 — không có file đặc tả riêng):**
1. Đích: trang nhận tiền **MoMo** (dạng `https://me.momo.vn/bbk9x`), không dùng widget/script của buymeacoffee.com.
2. Vị trí: **cuối panel Cài đặt**, dưới ô "Chất lượng hình".
3. Chữ trên nút giữ tiếng Anh **"Buy me a coffee"** (không dịch); `aria-label` dịch đủ 9 ngôn ngữ.

## Global Constraints

- Không thêm thư viện runtime, không ảnh ngoài: icon cốc là SVG inline, không tải script/ảnh của MoMo hay BMC.
- Mọi thông số ở `src/config.ts`, mỗi dòng chú thích tiếng Việt.
- Khóa i18n mới có trong cả 9 file `src/i18n/locales/{vi,en,ko,ja,zh,th,ar,hi,ru}.json`; `ar` là RTL.
- CSS điện thoại viết dưới `body.compact …`, không dùng `@media (max-width)`; hover đặt trong `@media (hover:hover)`.
- Comment tiếng Việt, kiểu "một dòng một ý" như file xung quanh; không format lại file.
- Liên kết ngoài: `target="_blank" rel="noopener noreferrer"`.
- Không gọi `rand()`, không đổi thứ tự `build*()` (không đụng `main.ts` ngoài dòng `__app`).
- Làm trên nhánh `feature/donate-momo`.

## Review Focus

1. **URL chưa điền / để trống** (mặc định khi merge nếu người dùng chưa đưa alias): liên kết phải ẩn hẳn, không có nút chết `href=""`. → Task 1 test `set('')`.
2. **URL không an toàn trong config** (`javascript:…`, `http://…`): không được gắn vào `href`. → Task 1 test.
3. **Chữ dài ở 9 ngôn ngữ / RTL trong sheet Cài đặt 390 px:** không tràn ngang; `ar` liên kết vẫn nằm trong panel. → Task 2 (vòng lặp tràn chữ có sẵn ở Mục 4 sẽ bao cả liên kết vì đã bật trước đó).
4. **Chạm trên điện thoại:** vùng bấm cao ≥ 40 px khi `body.compact` (như nút thanh). → Task 1 test.
5. **Lộ số điện thoại:** alias `me.momo.vn` có thể là số điện thoại của tác giả, và URL nằm trong bundle công khai. Người dùng nên tạo alias riêng trong app MoMo trước khi điền. → ghi chú ở `src/config.ts` (Task 1) và nhắc lại ở bàn giao.

---

### Task 1: Liên kết MoMo trong panel Cài đặt

**Files:**
- Modify: `src/config.ts:549-552` (`uiBase`)
- Create: `src/ui/donateUI.ts`
- Modify: `src/ui/setupUI.ts` (import + gọi `setupDonateUI()`, cạnh `setupQualityUI`)
- Modify: `src/main.ts:99` (thêm `donate` vào `ui: {…}` của `__app`)
- Modify: `index.html` (sau `<label class="mini-select" for="qualitySel">…</label>`, trước `</div>` đóng `#brandBody`)
- Modify: `src/styles/main.css` (kiểu `.donate`; bản gọn dưới `body.compact`)
- Test: `tests/mobile-check.mjs` (mục mới "Mục 5 — Buy me a coffee", và bản máy tính dùng trang `N`)

**Interfaces:**
- Produces: `CONFIG.ui.donate.url: string`. `setupDonateUI(): DonateApi` với `interface DonateApi { set(url: string): boolean }`, trả `true` khi đã gắn và hiện liên kết, `false` khi ẩn. Hàm `setupUI` hiện trả về gì thì trả thêm `DonateApi` qua đường đó; `main.ts` để nó ở `window.__app.ui.donate`. Nếu `setupUI` không trả object thì để `donateUI.ts` export thêm `donate: DonateApi` (singleton tạo trong `setupDonateUI`) và `main.ts` import trực tiếp.
- Phần tử: `a#donateLink.donate` chứa `<svg aria-hidden="true">` (icon cốc) + `<span>Buy me a coffee</span>` (KHÔNG có `data-i18n`), thuộc tính `data-i18n-aria="donateAria"`, `aria-label` mặc định tiếng Việt, `hidden` sẵn trong HTML.

- [ ] **Step 1: Tạo nhánh**

```bash
git switch -c feature/donate-momo
```

- [ ] **Step 2: Viết test thất bại** — trong `tests/mobile-check.mjs`, thêm mục mới ở trang dọc `P` **trước** "Mục 4" (để vòng lặp tràn chữ 9 ngôn ngữ ở Mục 4 đo cả liên kết):

```js
// Mục 5 — Buy me a coffee (MoMo): ẩn khi URL rỗng/không an toàn, hiện trong tờ Cài đặt
const DONATE_URL = 'https://me.momo.vn/bbk9x';
check('donate: URL rỗng thì ẩn', await P.page.evaluate(() => window.__app.ui.donate.set('') === false && document.getElementById('donateLink').hidden));
check('donate: javascript: bị từ chối', await P.page.evaluate(() => window.__app.ui.donate.set('javascript:alert(1)') === false && document.getElementById('donateLink').hidden && !document.getElementById('donateLink').getAttribute('href')?.startsWith('javascript')));
check('donate: http: bị từ chối', await P.page.evaluate(() => window.__app.ui.donate.set('http://me.momo.vn/x') === false && document.getElementById('donateLink').hidden));
check('donate: https gắn được', await P.page.evaluate((u) => window.__app.ui.donate.set(u) === true, DONATE_URL));
await P.page.evaluate(() => window.__app.ui.openSheet('settings'));
await frames(P.page, 2);
check('donate: hiện trong tờ Cài đặt', await visibleAll(P.page, ['#donateLink']));
check('donate: href, tab mới, rel', await P.page.evaluate((u) => { const a = document.getElementById('donateLink'); return a.href === u && a.target === '_blank' && /noopener/.test(a.rel) && /noreferrer/.test(a.rel); }, DONATE_URL));
check('donate: chữ tiếng Anh cố định', await P.page.evaluate(() => document.getElementById('donateLink').textContent.trim() === 'Buy me a coffee'));
check('donate: cao ≥ 40 px khi gọn', (await rects(P.page, ['#donateLink']))[0].height >= 40);
check('donate: là phần tử cuối của #brandBody', await P.page.evaluate(() => document.getElementById('brandBody').lastElementChild.id === 'donateLink'));
await P.page.evaluate(() => window.__app.ui.closeSheets());
```

Và ở trang máy tính `N` (gần dòng 190), thêm:

```js
await N.page.evaluate(() => window.__app.ui.donate.set('https://me.momo.vn/bbk9x'));
check('máy tính: donate nằm trong .brand', await N.page.evaluate(() => { const a = document.getElementById('donateLink').getBoundingClientRect(), b = document.querySelector('.brand').getBoundingClientRect(); return a.height > 0 && a.top >= b.top && a.bottom <= b.bottom + 1 && a.left >= b.left - 1 && a.right <= b.right + 1; }));
```

- [ ] **Step 3: Chạy để thấy test thất bại**

Run: `npm run build; npm run test:mobile`
Expected: LỖI ở `donate: URL rỗng thì ẩn` (`window.__app.ui.donate` undefined).

- [ ] **Step 4: Thêm cấu hình** — trong `uiBase` của `src/config.ts`:

```ts
  donate: {
    url: ''   // trang nhận tiền MoMo, dạng https://me.momo.vn/bbk9x; rỗng = ẩn nút. Dùng alias riêng, KHÔNG dùng số điện thoại (URL nằm trong bundle công khai)
  }
```

(thêm dấu phẩy sau `resizeDebounceMs: 120` nhưng giữ nguyên chú thích của dòng đó).

- [ ] **Step 5: Thêm markup** vào `index.html`, cuối `#brandBody`:

```html
  <a id="donateLink" class="donate" href="#" target="_blank" rel="noopener noreferrer" data-i18n-aria="donateAria" aria-label="Mời tác giả một ly cà phê qua MoMo (mở tab mới)" hidden>
    <svg viewBox="0 0 16 16" aria-hidden="true"><!-- cốc cà phê có quai + 2 vệt hơi, fill="currentColor", vẽ tay --></svg>
    <span>Buy me a coffee</span>
  </a>
```

Icon: tự vẽ path SVG 16×16 (thân cốc + quai bên phải + hai vệt hơi), cùng phong cách với icon nốt nhạc/micro có sẵn. Không lấy logo MoMo/BMC.

- [ ] **Step 6: Viết `setupDonateUI(): DonateApi` trong `src/ui/donateUI.ts`**

Khối tiêu đề `/* ===== Buy me a coffee (MoMo) ===== */`. `set(url)`: `new URL(url)` trong `try`; chỉ nhận `protocol === 'https:'`; hợp lệ thì `a.href = url; a.hidden = false; return true`, ngược lại `a.removeAttribute('href'); a.hidden = true; return false`. `setupDonateUI()` gọi `set(CONFIG.ui.donate.url)` một lần. Nối vào `setupUI.ts` và `__app.ui.donate` như mục Interfaces.

- [ ] **Step 7: CSS trong `src/styles/main.css`**

`.donate` (chung với khu `.mini-select`, khoảng dòng 85–94): `display:inline-flex; align-items:center; gap:6px; margin-top:6px`, chữ 12px `var(--font-body)`, màu `var(--gold)`, viền `1px solid rgba(230,189,106,.32)`, bo 4px, `padding:6px 10px`, `text-decoration:none`; `svg` 14px. Hover trong `@media (hover:hover)` (nền `rgba(230,189,106,.1)`). `.donate[hidden]{display:none;}` (vì `display:inline-flex` đè `hidden`). Bản gọn: `body.compact .donate{min-height:40px;}`. Dùng `margin-inline-*` (không `margin-left`) cho RTL.

- [ ] **Step 8: Chạy test**

Run: `npm run typecheck; npm run build; npm run test:mobile`
Expected: mọi dòng `donate:` và `máy tính: donate…` đạt, các kiểm tra cũ vẫn đạt; `mobile-check: đạt`.

- [ ] **Step 9: Commit**

```bash
git add src/config.ts src/ui/donateUI.ts src/ui/setupUI.ts src/main.ts index.html src/styles/main.css tests/mobile-check.mjs
git commit -m "feat: nút Buy me a coffee (MoMo) cuối panel Cài đặt"
```

---

### Task 2: `aria-label` 9 ngôn ngữ

**Files:**
- Create: `scripts/add-donate-locales.mjs` (chép đúng khuôn `scripts/add-mobile-locales.mjs`)
- Modify: `src/i18n/locales/{vi,en,ko,ja,zh,th,ar,hi,ru}.json` (do script ghi)
- Test: `tests/mobile-check.mjs` Mục 4

**Interfaces:**
- Consumes: `a#donateLink[data-i18n-aria="donateAria"]` từ Task 1.
- Produces: khóa `donateAria` ở 9 locale.

- [ ] **Step 1: Viết test thất bại** — trong Mục 4 của `tests/mobile-check.mjs`: thêm `'donateAria'` vào `KEYS`; đổi nhãn `` `${code}: đủ 5 khóa` `` thành `` `${code}: đủ ${KEYS.length} khóa` ``; trong vòng lặp ngôn ngữ, sau `pick(…'#langSelect', code)`, thêm:

```js
check(`${code}: aria donate đã dịch`, await P.page.evaluate((v) => document.getElementById('donateLink').getAttribute('aria-label') === v, json.donateAria));
```

- [ ] **Step 2: Chạy để thấy thất bại**

Run: `npm run build; npm run test:mobile`
Expected: LỖI `vi: đủ 6 khóa` (thiếu `donateAria`).

- [ ] **Step 3: Viết `scripts/add-donate-locales.mjs`** với `K = ['donateAria']` và bản dịch (giữ ý "qua MoMo" + "mở tab mới"):

| code | `donateAria` |
|---|---|
| vi | Mời tác giả một ly cà phê qua MoMo (mở tab mới) |
| en | Buy the author a coffee via MoMo (opens in a new tab) |
| ko | MoMo로 제작자에게 커피 한 잔 사주기 (새 탭에서 열림) |
| ja | MoMoで作者にコーヒーをおごる（新しいタブで開きます） |
| zh | 通过 MoMo 请作者喝杯咖啡（在新标签页中打开） |
| th | เลี้ยงกาแฟผู้สร้างผ่าน MoMo (เปิดในแท็บใหม่) |
| ar | ادعُ المؤلف إلى فنجان قهوة عبر MoMo (يفتح في علامة تبويب جديدة) |
| hi | MoMo से लेखक को एक कॉफ़ी पिलाएँ (नए टैब में खुलता है) |
| ru | Угостить автора кофе через MoMo (откроется в новой вкладке) |

Chạy: `node scripts/add-donate-locales.mjs` → in `vi 1 khóa` … `ru 1 khóa`.

- [ ] **Step 4: Chạy test**

Run: `npm run build; npm run test:mobile`
Expected: `đủ 6 khóa` và `aria donate đã dịch` đạt ở cả 9 ngôn ngữ; tờ Cài đặt không tràn ngang ở cả 9; `ar` đạt; `mobile-check: đạt`.

- [ ] **Step 5: Commit**

```bash
git add scripts/add-donate-locales.mjs src/i18n/locales/*.json tests/mobile-check.mjs
git commit -m "feat: aria-label Buy me a coffee cho 9 ngôn ngữ"
```

---

### Task 3: Điền URL thật, kiểm tra cuối, memory bank

**Files:**
- Modify: `src/config.ts` (`CONFIG.ui.donate.url`, chỉ khi người dùng đã đưa alias)
- Modify: `.github/memory-bank/decisions.md` (D-020), `activeContext.md`, `progress.md`

- [ ] **Step 1: Điền URL** — hỏi người dùng alias MoMo (`https://me.momo.vn/bbk9x`). Mở URL đó trên trình duyệt máy tính và trên điện thoại để chắc là trang nhận tiền đúng người. Chưa có alias thì để `''`: nút ẩn, phần còn lại vẫn merge được.

- [ ] **Step 2: Kiểm tra trước khi xong** — trước khi chạy, kiểm không còn tiến trình `*-check.mjs`/`drawcalls.mjs` nào chạy (PowerShell: `Get-CimInstance Win32_Process | ? CommandLine -match 'check.mjs|drawcalls.mjs'`).

Run: `npm run build; npm run test:mobile; npm run test:perf -- --strict`
Expected: `mobile-check: đạt`; `test:perf` đạt (0 program mới). Không chạy `test:drawcalls`: thay đổi chỉ ở DOM, không có mesh/vật liệu mới. Ghi lý do này vào báo cáo.

- [ ] **Step 3: Tự xem bằng mắt** — `npm run dev`, mở `/?test` ở 1280×800 và 390×844 (sheet Cài đặt), ngôn ngữ `vi` và `ar`: nút ở cuối panel, không đè bảng Thông số, bấm mở tab mới.

- [ ] **Step 4: Memory bank** — `decisions.md` thêm D-020: liên kết thuần thay cho widget BMC (bất biến #5), chọn MoMo, chữ cố định tiếng Anh + aria 9 ngôn ngữ, URL rỗng = ẩn, chỉ `https:`. Cập nhật `activeContext.md` + `progress.md` theo prompt `update-memory-bank`.

- [ ] **Step 5: Commit**

```bash
git add src/config.ts .github/memory-bank/
git commit -m "docs: memory bank cho nút Buy me a coffee (D-020)"
```
