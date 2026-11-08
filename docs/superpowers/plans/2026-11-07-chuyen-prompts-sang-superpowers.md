# Chuyển `prompts/` sang `docs/superpowers/` — Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Biến 10 prompt trong `prompts/` (và 3 tính năng chưa có spec) thành cặp spec + plan trong `docs/superpowers/`, mô tả đúng cái đã xây. Đưa quy trình agent trong `.github/` sang superpowers. Làm gọn `activeContext.md`. Xóa `prompts/` và hai script `run-*.ps1`.

**Trạng thái:** Đã hoàn thành (nhánh feature/superpowers-docs, chờ merge)

**Architecture:** Chỉ có tài liệu, không đổi mã. Mỗi spec đối chiếu ba nguồn:
- prompt gốc (`prompts/<file>.md`, sau khi xóa thì đọc bằng `git show c418f92:prompts/<file>.md`);
- mã hiện tại (`src/config.ts`, thư mục công trình);
- memory bank (`decisions.md`, `progress.md`, `activeContext.md`, `tests/KET-QUA.md`).

Mỗi plan dựng lại từ `git log` và các mục GĐ trong `activeContext.md`.

**Tech Stack:** Markdown, git, Node (chạy lệnh kiểm tra), `npm run typecheck`.

**Spec:** `docs/superpowers/specs/2026-11-07-chuyen-prompts-sang-superpowers-design.md`

## Global Constraints

- Văn bản tiếng Việt, giọng như memory bank: câu ngắn, "một dòng một ý", có tên file/khóa trong backtick.
- Spec của tính năng đã xây theo **đúng 9 mục** ở §6 của thiết kế, tiêu đề `## 1. Mục đích và lý do` … `## 9. Còn mở`. Dòng thứ ba của spec theo mẫu:
  `_<ngày gốc> · Trạng thái: Đã xây (merge <hash>[, PR #n]) · Prompt gốc: prompts/<file>.md tại c418f92_`
  (spec của tính năng không có prompt gốc thì bỏ phần "Prompt gốc").
- Plan của tính năng đã xây mở đầu bằng header superpowers. Dòng **Spec:** trỏ tới spec cùng chủ đề. Thêm dòng `**Trạng thái:** Đã hoàn thành (merge <hash>)`, rồi tới các mục giai đoạn. Mỗi giai đoạn: `### GĐn: <tên>`, các việc `- [x]`, dòng `Commit:` và dòng `Kiểm tra:` (test + ngày). Cuối plan có `## Còn lại` với `- [x]`.
- Mọi thông số trong spec phải có trong `src/config.ts` hoặc mã hiện tại. Ghi tên khóa (ví dụ `CONFIG.sunWheel.rim`). Số chưa có nguồn giữ chữ "(ước lượng)". Không chắc thì ghi "(chưa đối chiếu)".
- Không mất thông tin của prompt gốc: nguồn số liệu, lưu ý độ tin cậy, câu trả lời của người dùng (mục "12b" trong thời tiết/vòng quay) phải còn trong spec, ở mục 3, 6 hoặc 7.
- Không sửa `src/` ngoài comment có đường dẫn `prompts/…`. Không sửa nội dung quyết định trong `decisions.md`.
- Tên file: spec `docs/superpowers/specs/<ngày>-<chủ-đề>-design.md`, plan `docs/superpowers/plans/<ngày>-<chủ-đề>.md`. Ngày và chủ đề lấy ở bảng §5 của thiết kế.
- Commit trên nhánh `feature/superpowers-docs`. Tin nhắn commit tiếng Việt, kết thúc bằng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Ba nhóm commit theo thiết kế §10. Task 1–8 thuộc nhóm 1 (spec + plan), Task 9–11 nhóm 2 (tham chiếu, quy trình), Task 12 nhóm 3 (xóa, chuyển). Không gộp file của nhóm khác vào một commit.

### Lệnh kiểm tra dùng chung

**K1 — khung spec** (thay `<f>`): kết quả phải là `9`.
```bash
grep -cE '^## [1-9]\. ' <f>
```

**K2 — link tương đối còn sống**: in ra mọi link hỏng trong các file markdown truyền vào. Đạt khi không in gì.
```bash
node -e '
const fs=require("fs"),p=require("path");
for (const f of process.argv.slice(1)) {
  const t=fs.readFileSync(f,"utf8");
  for (const m of t.matchAll(/\]\(([^)#\s]+)(#[^)]*)?\)/g)) {
    const u=m[1]; if (/^(https?:|mailto:)/.test(u)) continue;
    if (!fs.existsSync(p.resolve(p.dirname(f),decodeURI(u)))) console.log(f+": "+u);
  }
}' <các file .md>
```

**K3 — plan có đánh dấu xong**: phải in ra `0`, nghĩa là không còn `- [x]` nào trước mục `## Còn lại`.
```bash
awk '/^## Còn lại/{exit} /^- \[ \]/{n++} END{print n+0}' <f>
```

## Review Focus

1. **Thông số trong spec lệch mã.** Người đọc spec sẽ tin số đó. Mỗi spec phải kiểm ít nhất mọi số ở mục 3 bằng `grep` trong `src/config.ts`. Bước "Đối chiếu số" của từng task làm việc này.
2. **Mất chi tiết khi làm gọn `activeContext.md`.** Số đo, nguyên nhân lỗi, hạn chế của từng GĐ phải xuất hiện trong plan trước khi xóa khỏi memory bank. Task 11 có bước so khớp từng mục `##`.
3. **Link hỏng sau khi xóa `prompts/`.** Gồm cả link trong `decisions.md`, `README.md` và link trong spec cũ. Task 12 chạy K2 trên toàn bộ.
4. **Copilot/Codex không có plugin không làm theo được quy trình mới.** `plan-feature.prompt.md` phải tự đủ: có khung spec và khung plan ngay trong file, không bắt buộc gọi skill. Task 9 có bước đọc lại với vai agent không plugin.
5. **Ảnh tham chiếu bị commit nhầm khi chuyển thư mục.** Task 12 kiểm `git status --porcelain` không có `.png` nào.

---

### Task 1: Cầu Rồng — spec + plan

**Files:**
- Create: `docs/superpowers/specs/2026-10-21-cau-rong-design.md`
- Create: `docs/superpowers/plans/2026-10-21-cau-rong.md`
- Nguồn: `prompts/cau-rong.md`, `src/bridges/dragon/`, `CONFIG` phần Rồng trong `src/config.ts`, D-002, D-003, D-011, `tests/KET-QUA.md`, `views/tourStops.ts` (Tour Rồng)

**Interfaces:**
- Produces: hai đường dẫn trên. Task 11 link tới chúng từ `progress.md`.

- [x] **Step 1: Đọc nguồn.** Đọc prompt gốc và liệt kê mọi thông số, yêu cầu trong đó. Đối chiếu từng mục với `src/bridges/dragon/` và `src/config.ts`.
- [x] **Step 2: Viết spec** theo 9 mục. Mục 7 ít nhất có:
  - prompt yêu cầu "một file HTML, import CDN", còn bản hiện tại là Vite + TS (`b500bb5`);
  - điểm 3 Tour dời sang làn Bắc (D-011);
  - mọi yêu cầu chưa có trong mã (vảy, chi tiết đầu rồng…) ghi là "chưa làm". Những mục này lặp lại ở mục 9.
- [x] **Step 3: Đối chiếu số.** Mỗi số ở mục 3 phải có kết quả khi `grep -n` trong `src/` (666, 200, 37.5…). Số nào không có thì sửa thành giá trị trong mã, hoặc ghi "(chưa đối chiếu)".
- [x] **Step 4: Viết plan.** Các mốc thật: dựng ở bản HTML gốc (`tests/original/index.html`), chuyển sang Vite `b500bb5`, D-011 (commit từ `git log --oneline -S "-228, 11.4" -- src`), giảm draw call nếu có. Mục `## Còn lại` lấy từ mục 9 của spec.
- [x] **Step 5: Kiểm tra.** K1 trên spec cho `9`. K3 trên plan cho `0`. K2 trên cả hai không in gì.
- [x] **Step 6: Commit**
```bash
git add docs/superpowers/specs/2026-10-21-cau-rong-design.md docs/superpowers/plans/2026-10-21-cau-rong.md
git commit -m "docs: spec + plan Cầu Rồng (đã xây)"
```

### Task 2: Ba cầu Thuận Phước, Trần Thị Lý, sông Hàn — spec + plan

**Files:**
- Create: `docs/superpowers/specs/2026-10-21-cau-thuan-phuoc-design.md`, `…-cau-tran-thi-ly-design.md`, `…-cau-song-han-design.md`
- Create: `docs/superpowers/plans/2026-10-21-cau-thuan-phuoc.md`, `…-cau-tran-thi-ly.md`, `…-cau-song-han.md`
- Nguồn: ba prompt tương ứng, `src/bridges/{thuan-phuoc,tran-thi-ly,song-han}/`, `CONFIG`, `tests/KET-QUA.md`. Riêng sông Hàn có thêm `swingUI.ts` (lịch quay 23:00 thứ Bảy), `SwingController` và các tác động thời tiết (D-012: khóa quay khi bão).

- [x] **Step 1:** Làm như Task 1 Step 1–3 cho từng cầu. Mục 7 ghi thay đổi do các tính năng sau gây ra trên cầu đó:
  - thời tiết: lắc dây `cableSegs`, ướt `registerWet`, cấm lưu thông;
  - Tour 4 cầu.
- [x] **Step 2:** Viết ba plan. Mốc: bản gốc, `b500bb5`, rồi các commit sau có đụng thư mục cầu (`git log --oneline -- src/bridges/<dir>`). Ghi một dòng cho mỗi commit có ý nghĩa, không chép hết.
- [x] **Step 3:** K1 = 9 cho cả ba spec. K3 = 0 cho cả ba plan. K2 sạch.
- [x] **Step 4: Commit** sáu file, tin nhắn `docs: spec + plan ba cầu Thuận Phước, Trần Thị Lý, sông Hàn (đã xây)`.

### Task 3: Hầm vượt sông Hàn — spec + plan

**Files:**
- Create: `docs/superpowers/specs/2026-10-21-ham-vuot-song-han-design.md`, `docs/superpowers/plans/2026-10-21-ham-vuot-song-han.md`
- Nguồn: `prompts/ham-vuot-song-han.md`, `src/bridges/han-tunnel/`, D-007, `progress.md` (`bdab293`, `a4802ad`), `activeContext.md` (hai lỗi `test:tunnel` ở mục Thời tiết GĐ3), PR #1.

- [x] **Step 1:** Làm như Task 1 Step 1–3. Mục 6 phải có câu "phương án đề xuất, chưa xây" (bất biến 6) và hành lang `|z + 1700| < 30`. Mục 7 có:
  - LOD 600/450/1 500 m (`a4802ad`);
  - `riverbed` không phụ thuộc `details.visible`;
  - dao động `lift` chỉ chìm xuống.
- [x] **Step 2:** Plan: các mốc `bdab293`, `a4802ad`, các sửa lỗi trong GĐ3 thời tiết (lấy hash từ `git log --oneline -- src/bridges/han-tunnel`).
- [x] **Step 3:** K1, K3, K2.
- [x] **Step 4: Commit** `docs: spec + plan Hầm vượt sông Hàn (đã xây)`.

### Task 4: Hai bờ sông — spec + plan

**Files:**
- Create: `docs/superpowers/specs/2026-10-21-bo-song-han-design.md`, `docs/superpowers/plans/2026-10-21-bo-song-han.md`
- Nguồn: `prompts/bo-song-han.md`, `src/environment/riverfront/` (comment đầu `landmarks.ts` về tọa độ ước lượng), D-008, `7003788`, `a22095c`, PR #2, PR #4.

- [x] **Step 1:** Làm như Task 1 Step 1–3. Mục 9 có "tọa độ địa danh là ước lượng".
- [x] **Step 2:** Plan theo các commit `7003788`, `a22095c` và PR #2, #4.
- [x] **Step 3:** K1, K3, K2.
- [x] **Step 4: Commit** `docs: spec + plan hai bờ sông Hàn (đã xây)`.

### Task 5: Thuyết minh tiếng Nga và Tour 4 cầu — spec + plan

**Files:**
- Create: `docs/superpowers/specs/2026-10-21-thuyet-minh-tieng-nga-design.md`, `docs/superpowers/plans/2026-10-21-thuyet-minh-tieng-nga.md`
- Create: `docs/superpowers/specs/2026-10-22-tour-4-cau-design.md`, `docs/superpowers/plans/2026-10-22-tour-4-cau.md`
- Nguồn:
  - thuyết minh: `prompts/thuyet-minh-tieng-nga.md`, `scripts/narration/ru.json`, `public/voice/manifest.json`, D-005, `0a0b6be`, `ca91609`;
  - Tour 4 cầu: `prompts/tour-4-cau.md`, `views/tour.ts`, `ALL_TOUR` trong `views/tourStops.ts`, D-015, `e672add`, `cd52a47`, merge `ad963d0`, mục 3 "Bước tiếp theo" trong `activeContext.md`.

- [x] **Step 1:** Spec thuyết minh: giọng `ru-RU-SvetlanaNeural`, số Tour/điểm dừng hiện tại. Đếm khóa trong `scripts/narration/ru.json`, không lấy số "5 Tour / 36 điểm" cũ nếu đã đổi.
- [x] **Step 2:** Spec Tour 4 cầu: 13 điểm, `loop: false`, `segMax`, `TourStop.bridge`, 39 clip. Mục 9 có "Lời điểm 7 đọc lúc camera còn nhìn lại Cầu Rồng" và "chưa kiểm Tour ban đêm/thời tiết khác `now`".
- [x] **Step 3:** Hai plan theo các commit đã nêu.
- [x] **Step 4:** K1, K3, K2 cho bốn file.
- [x] **Step 5: Commit** `docs: spec + plan thuyết minh tiếng Nga, Tour 4 cầu (đã xây)`.

### Task 6: Thời tiết — spec + plan

**Files:**
- Create: `docs/superpowers/specs/2026-10-21-thoi-tiet-design.md`, `docs/superpowers/plans/2026-10-21-thoi-tiet.md`
- Nguồn:
  - `prompts/ke-hoach-thoi-tiet.md` (443 dòng; mục 12b là câu trả lời của người dùng);
  - `src/environment/weather/`, `CONFIG.weather`;
  - D-009, D-010, D-012, D-013;
  - `activeContext.md` các mục `## Kịch bản bão…`, `## Thời tiết — Giai đoạn 1` … `8` (dòng 32–109);
  - `progress.md`, `scripts/run-weather.ps1` (giai đoạn → mục đặc tả), PR #6.

**Interfaces:**
- Produces: plan có một `### GĐn` cho mỗi giai đoạn 1–8 và một `### Kịch bản bão có thuyết minh`. Task 11 sẽ xóa các mục tương ứng khỏi `activeContext.md` và link tới plan này.

- [x] **Step 1:** Spec: làm như Task 1 Step 1–3.
  - Mục 3 lấy từ `CONFIG.weather`: preset, `swayExaggeration` ×20, seed 20061001, `showMaxWind`, `showMaxRain`, `cableSegs`, `buffet`.
  - Mục 7 phải có:
    - không có `closeWind`/`swingMaxWind`, chỉ Mở/Cấm theo `closed` (12b-1, D-012);
    - không có "Hạn chế"/`wxLimited`;
    - kịch bản bão là hành trình camera có thuyết minh vi/en/ru (12b-3 đổi, D-013);
    - dây hình trụ 8 đoạn (sửa lỗi GĐ4).
  - Mục 9 có:
    - 12b-6 (chọn preset theo tháng) chưa làm;
    - draw call từng preset chưa ghi;
    - sóng bạc đầu, bơm hầm, tàu `ship`, ảo ảnh mặt cầu chưa có.
- [x] **Step 2:** Plan: mỗi GĐ chép **toàn bộ** nội dung tương ứng trong `activeContext.md` (đã làm, quyết định, số đo, lần chấm LỖI + nguyên nhân + cách sửa, hạn chế), viết lại thành `- [x]` + đoạn ghi chú. Commit lấy từ `progress.md` (`4baacb1`, `3978854`, `5f780b4`, `e3906e7`, `1b39173`, `c169343`, `edced8b`). GĐ8 và kịch bản bão lấy hash từ `git log --oneline -- src/environment/weather tests/KET-QUA.md`.
- [x] **Step 3: So khớp.** Với mỗi mục `##` thời tiết trong `activeContext.md`, mọi con số (ví dụ `536 → 232`, `77 → 107`, `28,9`) phải xuất hiện trong plan:
```bash
for n in $(sed -n '32,109p' .github/memory-bank/activeContext.md | grep -oE '[0-9]+[,.][0-9]+|[0-9]{3,}' | sort -u); do grep -qF -- "$n" docs/superpowers/plans/2026-10-21-thoi-tiet.md || echo "thiếu $n"; done
```
  Đạt khi không in gì, hoặc chỉ in số thuộc dòng đã có ở mục khác của plan (ghi lý do trong báo cáo task).
- [x] **Step 4:** K1, K3, K2.
- [x] **Step 5: Commit** `docs: spec + plan thời tiết (đã xây)`.

### Task 7: Vòng quay Mặt Trời — spec + plan

**Files:**
- Create: `docs/superpowers/specs/2026-10-22-vong-quay-mat-troi-design.md`, `docs/superpowers/plans/2026-10-22-vong-quay-mat-troi.md`
- Nguồn:
  - `prompts/vong-quay-mat-troi.md` (mục 12b, 1.2, 1.3);
  - `src/bridges/sun-wheel/`, `CONFIG.sunWheel`, `deriveSunWheel()`;
  - D-014, D-016, D-017;
  - `activeContext.md` dòng 110–184 (GĐ1–GĐ8) và mục 6 "Bước tiếp theo";
  - `progress.md`, `scripts/run-sunwheel.ps1`, PR #8 (merge `257b905`).

**Interfaces:**
- Produces: plan có `### GĐ1` … `### GĐ8` (GĐ0 = `52ad574`). Spec mục 2 ghi ảnh tham chiếu ở `docs/superpowers/specs/tham-chieu/sun-wheel/` (không commit; Task 12 chuyển ảnh tới đó).

- [x] **Step 1:** Spec: làm như Task 1 Step 1–3.
  - Mục 3: tọa độ 16,040525; 108,228459 → z ≈ +2 280; `yaw` +7°; đỉnh 115 m; 64 cabin; 900 s/vòng. Các số ước lượng: x ≈ −440, D ≈ 93 m, trục ≈ 64 m, bệ ≈ 13 m.
  - Mục 7: không có giá treo tam giác; lầu đặc thay vì rỗng; 32 thanh + 64 cáp thay vì ~64 nan; không có đèn rọi trời; nhãn bảng thông số dùng chung.
  - Mục 9 lấy mục 6 (a)–(e) của "Bước tiếp theo".
- [x] **Step 2:** Plan: như Task 6 Step 2, mỗi GĐ chép đủ nội dung từ `activeContext.md`. Commit lấy từ `git log --oneline 257b905^2 -- src/bridges/sun-wheel tests/sunwheel-check.mjs` (các mốc đã biết: `52ad574`, `edb64a1`, `7755a3b`, `991ee46`, `028dede`).
- [x] **Step 3: So khớp** như Task 6 Step 3, với dòng `110,184p` và file plan vòng quay.
- [x] **Step 4:** K1, K3, K2.
- [x] **Step 5: Commit** `docs: spec + plan Vòng quay Mặt Trời (đã xây)`.

### Task 8: Tối ưu độ mượt, giao diện điện thoại, Buy me a coffee

**Files:**
- Create: `docs/superpowers/specs/2026-10-24-toi-uu-do-muot-design.md`, `docs/superpowers/plans/2026-10-24-toi-uu-do-muot.md`
- Create: `docs/superpowers/specs/2026-10-26-mobile-ui-design.md`
- Create: `docs/superpowers/specs/2026-10-29-buy-me-a-coffee-design.md`
- Modify: `docs/superpowers/plans/2026-10-26-mobile-ui.md`, `docs/superpowers/plans/2026-10-29-buy-me-a-coffee.md`
- Nguồn:
  - D-018, D-019, D-021;
  - `activeContext.md` các mục `## Tối ưu độ mượt` (26–31) và `## Giao diện điện thoại` (20–25);
  - `progress.md`;
  - `src/core/{perf,prewarm,quality,device}.ts`, `CONFIG.perf`, `src/ui/compactUI.ts`, `CONFIG.ui.donate`;
  - merge `ecebdf8`, `fc53fdd`, PR #10 (`cbfda36`).

- [x] **Step 1:** Ba spec theo 9 mục. Không có prompt gốc nên dòng ba bỏ phần "Prompt gốc". Mục 1 của spec mobile chép nguyên câu yêu cầu của người dùng đã có ở đầu plan mobile.
- [x] **Step 2:** Plan tối ưu độ mượt: GĐ0–GĐ5 theo mục `## Tối ưu độ mượt` (chép đủ số đo và hạn chế); commit lấy từ `git log --oneline ecebdf8^2 --not ecebdf8^1`.
- [x] **Step 3:** Hai plan có sẵn:
  - thêm dòng `**Trạng thái:** Đã hoàn thành (merge <hash>)` sau dòng **Goal**;
  - thêm dòng **Spec:** trỏ tới spec mới;
  - đổi mọi `- [x]` của bước đã làm thành `- [x]`;
  - thêm `## Còn lại` lấy từ mục 9 spec.
  Ngoài các chỗ trên, không sửa nội dung khác.
- [x] **Step 4:** So khớp số (như Task 6 Step 3) cho dòng `20,31p` với plan mobile + plan tối ưu. K1, K3, K2 cho năm file.
- [x] **Step 5: Commit** `docs: spec + plan tối ưu độ mượt; spec giao diện điện thoại, Buy me a coffee`.

### Task 9: Quy trình agent chuyển sang superpowers

**Files:**
- Modify: `.github/prompts/plan-feature.prompt.md` (viết lại)
- Modify: `.github/prompts/new-structure.prompt.md`
- Modify: `.github/agents/planner.agent.md`
- Modify: `.github/copilot-instructions.md` (§2 nếu nhắc đặc tả, §7 bảng + câu "Quy ước")
- Modify: `.github/memory-bank/projectbrief.md:26`, `.github/memory-bank/README.md`
- Modify: `AGENTS.md`, `CONTRIBUTING.md:80,156`, `.github/pull_request_template.md:3`

**Interfaces:**
- Consumes: plan mẫu `docs/superpowers/plans/2026-10-26-mobile-ui.md`, spec mẫu từ Task 8.

- [x] **Step 1: Viết lại `plan-feature.prompt.md`** (giữ frontmatter `mode`/`description` nếu có). Nội dung:
  1. Có plugin superpowers thì dùng `superpowers:brainstorming` rồi `superpowers:writing-plans`.
  2. Không có plugin thì làm tay ba bước: hỏi người dùng tới khi rõ mục đích; viết spec `docs/superpowers/specs/YYYY-MM-DD-<chủ-đề>-design.md`; viết plan `docs/superpowers/plans/YYYY-MM-DD-<chủ-đề>.md`.
  3. Khung spec mới gồm 9 mục: Mục đích và lý do; Mục tiêu; Không làm; Điều không được xảy ra; Thông số (nguồn hoặc ước lượng, khóa `CONFIG`); Hành vi; Ràng buộc dự án (bất biến §3 + ngân sách draw call); Kiểm tra; Câu hỏi còn mở.
  4. Khung plan: header như plan mẫu, task `- [x]` ghi file, bước, lệnh kiểm tra, commit.
  5. Sau khi xong: đánh dấu `- [x]`, thêm `**Trạng thái:** Đã hoàn thành`, sửa spec mục "Khác so với ý định" nếu có.
- [x] **Step 2:** `new-structure.prompt.md`: giữ các bước kỹ thuật riêng dự án; phần "viết đặc tả trong `prompts/`" thay bằng "chạy `plan-feature`". `planner.agent.md`: đầu ra là spec + plan trong `docs/superpowers/`.
- [x] **Step 3:** `copilot-instructions.md` §7:
  - dòng "Đặc tả nhiệm vụ lớn" đổi thành hai dòng: specs `../docs/superpowers/specs/`, plans `../docs/superpowers/plans/`;
  - câu "Quy ước" đổi thành: `docs/superpowers/` là nguồn sự thật cho "xây cái gì / theo bước nào", còn `.github/prompts/` là quy trình lặp lại;
  - thêm một dòng ở §2 bước 1: "Đang làm một tính năng có plan thì đọc plan đó".
- [x] **Step 4:** Sửa các file còn lại trong danh sách Files (đường dẫn và mô tả cây thư mục).
- [x] **Step 5: Đọc lại với vai Copilot không plugin.** Chỉ đọc `copilot-instructions.md` rồi `plan-feature.prompt.md`. Phải trả lời được: viết file gì, ở đâu, có những mục nào. Câu nào chưa trả lời được thì sửa.
- [x] **Step 6:** K2 trên mọi file đã sửa. `grep -n "prompts/[a-z-]*\.md" <các file đã sửa>` không còn kết quả (trừ tên `*.prompt.md`).
- [x] **Step 7: Commit** `docs(agent): quy trình tính năng mới theo superpowers (docs/superpowers là nguồn sự thật)`.

### Task 10: Sửa tham chiếu trong README, test, mã, decisions

**Files:**
- Modify: `README.md:63,77`
- Modify: dòng 1 của `tests/riverfront-check.mjs`, `tests/tunnel-check.mjs`, `tests/weather-check.mjs`, `tests/sunwheel-check.mjs`, `tests/sunwheel-gd2-shots.mjs`
- Modify: `src/environment/weather/impact.ts:5`
- Modify: `.github/memory-bank/decisions.md:36`

- [x] **Step 1:** Thay đường dẫn theo bảng §5 của thiết kế. Số mục cũ phải đổi sang số mục mới của spec:
  - `ke-hoach-thoi-tiet.md mục 11` → `…thoi-tiet-design.md mục 8`;
  - `mục 1.6` (impact) → mục tương ứng ở spec thời tiết; mở spec ra để lấy đúng số;
  - `vong-quay-mat-troi.md, mục 11` → mục 8 của spec vòng quay;
  - `prompts/tham-chieu/sun-wheel/` → `docs/superpowers/specs/tham-chieu/sun-wheel/`;
  - `decisions.md:36` chỉ đổi đường dẫn trong tiêu đề.
- [x] **Step 2:** `npm run typecheck` phải thoát 0. `node --check` năm file test phải thoát 0.
- [x] **Step 3:** K2 trên `README.md`, `.github/memory-bank/decisions.md`.
- [x] **Step 4: Commit** `docs: đổi tham chiếu prompts/ sang docs/superpowers trong README, test, mã`.

### Task 11: Làm gọn memory bank

**Files:**
- Modify: `.github/memory-bank/activeContext.md`
- Modify: `.github/memory-bank/progress.md`

**Interfaces:**
- Consumes: các plan Task 1–8 (đường dẫn trong Global Constraints / Files của từng task).

- [x] **Step 1: Kiểm tra trước khi xóa.** Với mỗi mục `##` từ dòng 20 tới 184 của `activeContext.md`, xác định plan đã chứa nội dung của nó. Ánh xạ:
  - Giao diện điện thoại → plan mobile;
  - Tối ưu → plan tối ưu;
  - Kịch bản bão, Thời tiết GĐ1–8 → plan thời tiết;
  - Vòng quay GĐ1–8 → plan vòng quay.

  Chạy lại lệnh so khớp số của Task 6/7/8 trên đúng các khoảng dòng đó. Phải không in gì, nếu không thì bổ sung vào plan trước.
- [x] **Step 2:** Viết lại `activeContext.md` chỉ gồm `## Trạng thái`, `## Bước tiếp theo`, `## Vấn đề mở / cần quyết`:
  - dòng ngày `_Cập nhật: 2026-11-07 · Nhánh đang làm: feature/superpowers-docs_`;
  - trong Trạng thái thêm dòng: lịch sử từng giai đoạn nằm trong `docs/superpowers/plans/`;
  - mỗi mục ở Bước tiếp theo kết thúc bằng link plan tương ứng;
  - bỏ mục 5 cũ ("Sửa dòng giới thiệu Hầm bị lặp") nếu README đã không còn lặp, nếu còn thì giữ;
  - bỏ dòng "`prompts/cau-rong.md` chưa bắt đầu";
  - không còn chữ `run-weather.ps1` / `run-sunwheel.ps1`.
- [x] **Step 3:** `progress.md`:
  - bảng "Đã xong" thêm cột `Spec / plan` có link cho mỗi dòng có tài liệu;
  - "Còn thiếu" bỏ dòng "Dựng lại Cầu Rồng chi tiết";
  - dòng vòng quay đổi đường dẫn sang spec mới;
  - thêm dòng "Chuyển `prompts/` → `docs/superpowers/`" vào bảng Đã xong; cột commit để `—`, Task 12 điền sau.
- [x] **Step 4:** `wc -l .github/memory-bank/activeContext.md` phải dưới 60. K2 trên hai file sạch. `grep -n "prompts/[a-z-]*\.md\|run-weather\|run-sunwheel" .github/memory-bank/{activeContext,progress}.md` không ra kết quả.
- [x] **Step 5: Commit** `docs(memory-bank): làm gọn activeContext, lịch sử giai đoạn chuyển sang plan`.

### Task 12: Xóa `prompts/`, chuyển ảnh tham chiếu, xóa script, kiểm tra cuối

**Files:**
- Delete: `prompts/*.md` (10 file), `scripts/run-weather.ps1`, `scripts/run-sunwheel.ps1`
- Move (không commit): `prompts/tham-chieu/` → `docs/superpowers/specs/tham-chieu/`
- Modify: `.gitignore:7`
- Modify: `README.md` mục Cấu trúc (nếu liệt kê `prompts/` hoặc `scripts/run-*`), `package.json` (nếu có script gọi `run-*.ps1`)

- [x] **Step 1:** `.gitignore` dòng 7 đổi thành `docs/superpowers/specs/tham-chieu/`. Rồi chạy:
```bash
mkdir -p docs/superpowers/specs && mv prompts/tham-chieu docs/superpowers/specs/tham-chieu
git rm -q prompts/*.md scripts/run-weather.ps1 scripts/run-sunwheel.ps1
```
- [x] **Step 2:** `grep -n "run-weather\|run-sunwheel\|prompts/" package.json README.md CONTRIBUTING.md`. Sửa mọi kết quả, trừ `.github/prompts/`.
- [x] **Step 3: Kiểm tra cuối.**
```bash
grep -rnE "prompts/[a-z0-9-]+\.md|prompts/tham-chieu|run-(weather|sunwheel)\.ps1" . \
  --exclude-dir={node_modules,dist,.git,.entire} --exclude-dir=screens \
  | grep -v "^./.github/prompts/" | grep -v "Prompt gốc: prompts/"
```
  Đạt khi không in gì. Spec chuyển đổi `2026-11-07-chuyen-prompts-sang-superpowers-design.md` và plan này được phép nhắc `prompts/`; nếu có, loại thêm hai file đó khỏi lệnh trên.
- [x] **Step 4:** K2 trên mọi file `.md` trong `docs/superpowers/` (đệ quy), `.github/` (đệ quy), `README.md`, `CONTRIBUTING.md`, `AGENTS.md`, `CLAUDE.md`. Phải sạch.
- [x] **Step 5:** `npm run typecheck` thoát 0. `git status --porcelain | grep -i "\.png"` không in gì. `ls docs/superpowers/specs/tham-chieu/sun-wheel | wc -l` = 6.
- [x] **Step 6:** Dòng mới trong `progress.md` (Task 11 Step 3): cột commit ghi `nhánh feature/superpowers-docs` (hash chưa có trước khi commit), cột Kiểm tra ghi `typecheck` + kết quả Step 3–5.
- [x] **Step 7: Commit**
```bash
git add -A .gitignore prompts scripts README.md CONTRIBUTING.md package.json .github/memory-bank/progress.md
git commit -m "chore: xóa prompts/ và run-*.ps1; ảnh tham chiếu sang docs/superpowers/specs/tham-chieu (không commit)"
```
