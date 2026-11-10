# Dù lượn nhiều người (5 slot) — Kế hoạch thực hiện

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Một bầu trời chung 5 slot cho chế độ dù lượn: xem số chỗ, nhập tên 9 ký tự, thấy người khác bay; hết chỗ thì xem bám một người đang bay.

**Architecture:** Một Cloudflare Durable Object (`server/multi/`) giữ slot và chuyển tiếp vị trí qua WebSocket; logic phòng là lớp thuần `SkyRoom`, không phụ thuộc Cloudflare. Phía trình duyệt nằm trong `src/explore/multi/`: `MultiSession` là máy trạng thái thuần (không DOM, không three), các file còn lại nối nó với cảnh và HTML. Không có `CONFIG.explore.multi.url` hoặc `?multi=` thì mọi thứ chạy như hiện nay.

**Tech Stack:** Vite 6, TypeScript 5.9, three@0.165, WebSocket có sẵn của trình duyệt, Cloudflare Workers + Durable Objects (Hibernation API, gói Free), `wrangler` (devDependency của `server/multi`), `tsx --test` cho test đơn vị (Node 24), Playwright + SwiftShader cho test trong trình duyệt.

**Spec:** `docs/superpowers/specs/2026-11-09-du-luon-nhieu-nguoi-design.md`

**Trước khi bắt đầu:** công việc hiệu ứng đêm đang dở trên `feature/du-luon-hieu-ung-dem` đụng `src/explore/index.ts`, `src/config.ts`. Hoàn tất nó trước, rồi tạo nhánh `feature/du-luon-nhieu-nguoi` từ `main`. Không commit file của tính năng khác.

## Global Constraints

- 5 slot, tên tối đa 9 grapheme, chỉ dùng dịch vụ miễn phí, một bầu trời chung.
- Góc nhìn cũ và bay một mình: chênh draw call **0** so với `tests/KET-QUA.md`. Đủ 5 người: tối đa **+4** khi bay, **+5** khi xem. Nhãn tên là HTML, 0 draw call.
- Không đổi thứ tự `build*()`, không gọi `rand()` (chọn ngẫu nhiên dùng `Math.random`). Không thêm `PointLight`/`SpotLight`; đèn đêm đọc `shared.uNight`.
- Mọi thông số nằm trong `multiParams` (`src/explore/multi/params.ts`), lộ ra thành `CONFIG.explore.multi`; mỗi dòng chú thích tiếng Việt + đơn vị + `(ước lượng)`.
- Khóa i18n mới đủ 9 file locale qua `scripts/add-multi-locales.mjs` (mẫu `scripts/add-explore-locales.mjs`); `ar` là RTL.
- `?test` không kết nối mạng trừ khi có `multi=<ws-url>`. `?explore=glider` vẫn bay một mình, không qua slot.
- Mã trình duyệt không thêm thư viện runtime (WebSocket có sẵn là đủ).
- Comment tiếng Việt, khối `/* ===== ... ===== */`, tiền tố hàm `ex*`, không tự format lại file cũ. Tên hiển thị bằng `textContent`, không dùng `innerHTML`.
- Test nặng (`test:drawcalls`, `test:tour`, cả bộ) chỉ chạy một lần ở Task 9. Giữa các task chỉ chạy test tập trung của task đó.

## Review Focus

1. Slot vừa trả được người khác lấy ngay: dù mới phải xuất hiện đúng chỗ cất cánh của người mới, không trượt từ vị trí người cũ. (Test: Task 4)
2. Tên có emoji, chữ tổ hợp, chữ Ả Rập, ký tự bidi hoặc thẻ HTML: đếm đúng 9 grapheme, không chèn được HTML, không đảo chữ giao diện. (Test: Task 1, Task 6)
3. Gõ W/A/S/D trong ô tên (ở bước riêng hoặc lời mời khi đang xem): không lái dù, không kích hoạt phím khác; Esc khi đang xem vẫn thoát. (Test: Task 7)
4. Tab bị ẩn lúc đang bay rồi quay lại trong vòng 60 giây: giữ slot, dù người khác không giật do dt lớn. (Test: Task 8)
5. Đổi ngôn ngữ khi đang ở bước riêng hoặc đang xem: số chỗ và dòng "Đang xem" dịch ngay, tên người bay giữ nguyên. (Test: Task 6)

---

### Task 1: Giao thức và logic phòng `SkyRoom`

**Files:**
- Create: `src/explore/multi/params.ts`, `src/explore/multi/protocol.ts`, `server/multi/src/room.ts`, `server/multi/src/badwords.ts`, `tests/multi-unit/room.test.ts`
- Modify: `src/config.ts` (`explore: { ...exploreBase, multi: multiParams }`, giữ nguyên phần còn lại), `package.json` (devDep `tsx`, script `"test:multi:unit": "tsx --test tests/multi-unit/*.test.ts"`), `.gitignore` (`.superpowers/`, `.wrangler/`)

**Interfaces:**
- Produces, `params.ts` (không import gì): `export const multiParams = { url: '', slots: 5, nameMax: 9, sendHz: 5, broadcastMs: 100, posMaxPerSec: 8, heartbeatMs: 3000, slotTimeoutMs: 10000, sweepMs: 10000, connectTimeoutMs: 4000, idleMs: 60000, idleWarnMs: 15000, maxConns: 200, maxMsgBytes: 256, interpSends: 2.5, spawnSpread: 30, labelBelow: 9, colors: ['#2f9e6e', '#e8892b', '#a855c7', '#2a8fd6', '#e0c02e'], bounds: { x0: -2600, x1: 3600, z0: -5600, z1: 2800 }, floor: 7, ceiling: 800 }`
- Produces, `protocol.ts`:
  - `type ClientMsg = {t:'join';name:string} | {t:'pos';x:number;y:number;z:number;yaw:number;bank:number} | {t:'hb'} | {t:'leave'}`
  - `interface Flyer {slot:number;name:string}`
  - `type ServerMsg = {t:'lobby';flyers:Flyer[]} | {t:'joined';slot:number} | {t:'rejected';why:'full'|'name'} | {t:'pos';f:number[][]} | {t:'released'}` (`f`: mỗi phần tử `[slot,x,y,z,yaw,bank]`)
  - `exSanitizeName(raw: string): string | null`: bỏ ký tự điều khiển (`\p{Cc}`) và định dạng/bidi (`\p{Cf}`), cắt khoảng trắng; rỗng hoặc quá `nameMax` grapheme (`Intl.Segmenter`) trả `null`.
- Produces, `room.ts`: `type Out = {to: string | 'all'; msg: ServerMsg}` và `class SkyRoom` với `connect(id, now): Out[] | null` (`null` khi đã đủ `maxConns`), `message(id, raw: string, now): Out[]`, `disconnect(id): Out[]`, `sweep(now): Out[]`, `hasFlyers(): boolean`, `slotOf(id): number`, `restore(list: {id:string;slot:number;name:string}[], now): void`.

- [ ] **Step 1: Viết test thất bại** trong `room.test.ts` (`node:test`):
  - `sáu người join: 5 joined, người thứ sáu rejected full`, kể cả 6 `message` gọi liên tiếp.
  - `người mới connect nhận lobby ngay, chỉ người gửi nhận joined, all nhận lobby mới`.
  - `slot là số nhỏ nhất đang trống; leave rồi join lại được slot đó; người leave vẫn nhận lobby và pos`.
  - `pos chỉ phát cho all khi cách lần phát trước >= broadcastMs, gói mới nhất của mọi slot`.
  - `pos từ người không có slot bị bỏ; pos quá posMaxPerSec trong 1 s bị bỏ; NaN/Infinity bị bỏ; x vượt bounds bị kẹp về bounds.x1; y kẹp về [floor, ceiling]`.
  - `raw dài hơn maxMsgBytes hoặc JSON hỏng: không ném lỗi, trả []`.
  - `join tên xấu: rejected name`; `join khi đã có slot: bỏ qua`.
  - `exSanitizeName`: `'  An  '`→`'An'`; `''`→null; `'1234567890'`→null; `'Nguyễn Anh'`(10)→null; `'Đặng Thị A'`(10)→null; `'Trường'`→`'Trường'`; chuỗi 9 emoji `👨‍👩‍👧` hợp lệ; `'a‮b'`→`'ab'`; `'<b>x</b>'` giữ nguyên (8 ký tự; an toàn nhờ `textContent`).
  - `sweep: slot không có tin quá slotTimeoutMs được trả và gửi released cho chủ; hb làm mới mốc`.
  - `connect thứ maxConns+1 trả null`.
  - `multiParams.bounds khớp CONFIG.explore.bounds, floor và ceiling khớp` (import `src/config`).
- [ ] **Step 2: Chạy** `npm run test:multi:unit`. Mong đợi: FAIL vì chưa có module.
- [ ] **Step 3: Viết `params.ts`, `protocol.ts`, `badwords.ts`, `room.ts`.** `badwords.ts`: `exIsBad(name)` so khớp tên đã hạ chữ thường và bỏ dấu với danh sách từ tục vi + en ngắn. Nhớ `multiParams` được `import` từ `config.ts` (config import params, không ngược lại).
- [ ] **Step 4: Chạy lại.** Mong đợi: PASS. Chạy `npm run typecheck`.
- [ ] **Step 5: Commit** `feat(multi): giao thức và logic phòng 5 slot`.

### Task 2: Worker, triển khai và đo hạn mức (cổng quyết định)

**Files:**
- Create: `server/multi/package.json` (devDep `wrangler`, `@cloudflare/workers-types`), `server/multi/wrangler.toml`, `server/multi/tsconfig.json`, `server/multi/src/worker.ts`, `server/multi/scripts/quota-probe.mjs`, `tests/multi-unit/worker.integration.mjs`
- Modify: `package.json` (`"test:multi:worker": "node tests/multi-unit/worker.integration.mjs"`), `src/explore/multi/params.ts` (`url`, có thể `sendHz`), `README.md` (mục Cấu trúc)

**Interfaces:**
- Consumes: `SkyRoom`.
- Produces: endpoint `GET /sky` nâng cấp WebSocket, 403 khi `Origin` không hợp lệ, 503 khi đủ `maxConns`. Lệnh `npm --prefix server/multi run dev` chạy ở cổng `8799` (`wrangler dev --port 8799`).

`wrangler.toml`: `name = "danang-sky"`, `main = "src/worker.ts"`, binding `SKY` → class `SkyObject`, `new_sqlite_classes = ["SkyObject"]`, `[vars] ALLOWED_ORIGINS = "https://danangbridges.netlify.app,http://localhost,http://127.0.0.1"` (so khớp scheme + hostname, bỏ cổng).

`SkyObject`: một instance `idFromName('sky')`; dùng `state.acceptWebSocket`. Khi đánh thức, `SkyRoom.restore` từ `ws.deserializeAttachment()` của `state.getWebSockets()`; mỗi lần đổi slot gọi `serializeAttachment({id,slot,name})`. Đặt `state.storage.setAlarm(now + sweepMs)` khi `hasFlyers()`, không đặt lại khi không còn ai bay.

- [ ] **Step 1: Viết test tích hợp** `worker.integration.mjs` (tự spawn `wrangler dev`, dùng `WebSocket` của Node 24 với header `Origin` qua `fetch` upgrade hoặc `new WebSocket(url, { headers })`): 6 kết nối join → 5 joined + 1 rejected full; đóng một kết nối → lobby còn 4 tên; `Origin: https://evil.example` → 403; không có Origin → 403.
- [ ] **Step 2: Chạy** `npm run test:multi:worker`. Mong đợi: FAIL.
- [ ] **Step 3: Viết `worker.ts`.** Chạy lại, mong đợi PASS.
- [ ] **Step 4: Dừng lại, người dùng làm:** tạo tài khoản Cloudflare miễn phí, chạy `! npx --prefix server/multi wrangler login`.
- [ ] **Step 5: Triển khai** `npm --prefix server/multi run deploy`; ghi URL `wss://danang-sky.<tài-khoản>.workers.dev/sky` vào `multiParams.url`.
- [ ] **Step 6: Đo hạn mức.** `quota-probe.mjs <url>`: mở 1 kết nối (Origin Netlify), gửi 120.000 tin `hb` ở khoảng 400 tin/s trong cùng một ngày UTC, in số tin đã gửi được và mã đóng kết nối nếu có; sau đó mở kết nối mới và `join`. Mong đợi một trong hai:
  - Kết nối mới vẫn được `joined`: có tỉ lệ 20:1, giữ `sendHz: 5`.
  - Kết nối bị từ chối / lỗi và hồi phục sau 7:00 giờ Việt Nam: không có tỉ lệ, đặt `sendHz: 2`, `posMaxPerSec: 4`.

  Kết quả không rơi vào hai trường hợp trên thì dừng, báo người dùng.
- [ ] **Step 7:** Ghi kết quả vào `.github/memory-bank/decisions.md` (số D tiếp theo còn trống; D-022 đã dùng cho dù lượn ban đêm). Commit `feat(multi): máy chủ Durable Object và đo hạn mức miễn phí`.

### Task 3: `MultiSession` và kết nối

**Files:**
- Create: `src/explore/multi/session.ts`, `src/explore/multi/client.ts`, `tests/multi-unit/session.test.ts`

**Interfaces:**
- Consumes: `protocol.ts`.
- Produces, `client.ts`: `interface Transport { send(m: ClientMsg): void; close(): void; onMessage: (m: ServerMsg) => void; onClose: () => void }`, `exConnect(url: string, timeoutMs: number): Promise<Transport>` (reject khi quá hạn hoặc lỗi).
- Produces, `session.ts`:
  - `type Phase = 'connecting'|'lobby'|'flying'|'watching'|'solo'`
  - `type Notice = ''|'offline'|'lost'|'late'|'nameBad'|'released'`
  - `class MultiSession`, hàm tạo `(connect: () => Promise<Transport>, pick: (n: number) => number = Math.random-based)`; thuộc tính `phase, flyers: Flyer[], mySlot: number (-1), watched: number (-1), invite: boolean, notice: Notice, name: string`; `onChange: () => void`, `onPos: (f: number[][]) => void`; phương thức `open()`, `join(name)`, `leave()` (bay → xem, do idle), `sendPos(x,y,z,yaw,bank)`, `heartbeat()`, `dispose()`.

- [ ] **Step 1: Viết test thất bại** với `Transport` giả:
  - `kết nối lỗi: phase solo, notice offline`.
  - `lobby đầu tiên có 5 flyers: chuyển thẳng watching, watched thuộc 5 slot đó`; `lobby đầu < 5: phase lobby`.
  - `join → joined: flying, mySlot đúng`; `rejected full ở lobby: watching, giữ name`; `rejected name: phase giữ nguyên, notice nameBad`.
  - `đang watching, flyers < 5: invite true; join rồi rejected full: notice late, vẫn watching`.
  - `người đang xem rời đi: watched đổi sang slot khác còn lại; không còn ai: watched -1, invite true`.
  - `flyers đổi nhưng người đang xem còn: watched không đổi`.
  - `đóng kết nối khi flying: solo, notice lost, flyers rỗng, mySlot giữ -1`; `khi watching: notice lost, phase solo`.
  - `released khi flying: watching, notice released`.
  - `sendPos ngoài phase flying: không gửi`; `heartbeat chỉ gửi khi flying`.
- [ ] **Step 2: Chạy** `npm run test:multi:unit`. FAIL.
- [ ] **Step 3: Viết `session.ts`, `client.ts`.** Chạy lại. PASS. `npm run typecheck`.
- [ ] **Step 4: Commit** `feat(multi): máy trạng thái phiên và kết nối`.

### Task 4: Dù người khác và nội suy

**Files:**
- Create: `src/explore/multi/interp.ts`, `src/explore/multi/remote.ts`, `tests/multi-unit/interp.test.ts`
- Modify: `src/explore/glider.ts`

**Interfaces:**
- Produces, `interp.ts` (thuần): `class ExTrack { push(t: number, x,y,z,yaw,bank): void; sample(t: number, out: {x,y,z,yaw,bank}): boolean; reset(): void }`. Vòng đệm cố định 8 mẫu, nội suy tuyến tính, yaw theo đường ngắn, kẹp ở mẫu cuối, không cấp phát.
- Produces, `glider.ts`: `exBuildGlider(wingColor?: string): THREE.Group`. Không truyền tham số thì giống hệt hiện tại. Dùng chung một geometry đã cache; có `wingColor` thì vẽ nền màu đó, không sao, có đường ô khí.
- Produces, `remote.ts`: `exRemotes`, gồm `sync(flyers: Flyer[], mySlot: number)`, `onPos(f: number[][], nowMs: number)`, `update(nowMs: number)`, `slotState(slot: number): GliderState | null`, `clear()`. Khi tên hoặc chủ của slot đổi: `track.reset()` và ẩn group tới khi có mẫu đầu. Thời điểm lấy mẫu `nowMs - interpSends * 1000 / sendHz`.

- [ ] **Step 1: Viết test thất bại** `interp.test.ts`: `giữa hai mẫu trả trung điểm`; `yaw 3.1 và -3.1 đi đường ngắn qua ±π`; `t quá mẫu cuối giữ mẫu cuối`; `chưa có mẫu trả false`; `reset xong trả false, mẫu mới không nội suy từ vị trí cũ`; `push 100 lần không vượt 8 mẫu`.
- [ ] **Step 2: Chạy, FAIL. Viết `interp.ts`, chạy, PASS.**
- [ ] **Step 3: Sửa `glider.ts`, viết `remote.ts`.** Dù đặt bằng `exPlaceGlider` (đã đọc `shared.uNight`). Chỉ dựng khi `sync` lần đầu.
- [ ] **Step 4: Chạy** `npm run build && npm run test:explore`. Mong đợi: đạt (dù một mình không đổi).
- [ ] **Step 5: Commit** `feat(multi): dù người khác nhiều màu, nội suy vị trí`.

### Task 5: Điều phối bay qua mạng, nhãn và danh sách

**Files:**
- Create: `src/explore/multi/labels.ts`, `src/explore/multi/index.ts`, `tests/multi-check.mjs`, `scripts/add-multi-locales.mjs`
- Modify: `src/explore/index.ts`, `src/main.ts` (thêm `multi` vào `__app`), `index.html` (`#exMpLabels`, `#exMpRoster`, `#exMpNotice`), `src/styles/main.css`, 9 file locale, `package.json` (`"test:multi": "node tests/multi-check.mjs"`)

**Interfaces:**
- Consumes: `MultiSession`, `exRemotes`, `exStep`.
- Produces, `multi/index.ts`: `exMulti` gồm `url(): string` (`?multi=` nếu có; nếu `?test` mà không có `multi=` thì `''`; còn lại `CONFIG.explore.multi.url`), `session: MultiSession | null`, `begin(onReady)`, `update(dt, nowMs, state: GliderState | null)`, `watchState(): GliderState | null`.
- Produces, `labels.ts`: `exLabelsUpdate(camera, remotes, nowMs)`. Một `div` cho mỗi slot, tên + khoảng cách (`m`, `km`), đặt **dưới cánh** (chiếu điểm thấp hơn dù `labelBelow` m), ẩn khi sau camera. Chỉ ghi DOM khi chuỗi đổi hoặc vị trí lệch quá 1 px.

Cất cánh: `exCreate()` rồi cộng `spawnSpread * (slot - 2)` vào `pos.z`, chỉ khi có slot.

Gửi vị trí: trong `explore.update`, mỗi `1000 / sendHz` ms gọi `sendPos`.

- [ ] **Step 1: Viết test `tests/multi-check.mjs`** (mẫu `explore-check.mjs`; tự spawn `wrangler dev`, mở trang `?test&chooser&multi=ws://127.0.0.1:8799/sky`; các dù khác là bot Node WebSocket gửi `join` + `pos`), mục 1:
  - `4 bot bay: exRemotes có 4 dù, 4 màu khác nhau, nhãn hiện đúng tên`.
  - `nhãn nằm dưới cánh: top của nhãn > điểm chiếu của dù`.
  - `Draw call chênh giữa 0 bot và 4 bot trong khung nhìn ≤ +4`.
  - `Bot đóng kết nối: dù biến mất, roster còn 3`.
  - `Không có multi=: không có WebSocket nào được mở (bắt bằng page.on('websocket'))`.
- [ ] **Step 2: Chạy** `npm run build && npm run test:multi`. FAIL.
- [ ] **Step 3: Viết code.** `explore.update` gọi `exMulti.update` sau `exChase`. Không cấp phát mỗi khung. Roster góc màn hình theo `body.explore`, dùng `textContent`.
- [ ] **Step 4: Chạy lại** `test:multi` và `test:explore`. PASS.
- [ ] **Step 5: Commit** `feat(multi): thấy người khác khi bay, nhãn và danh sách`.

### Task 6: Bước chọn slot và nhập tên

**Files:**
- Create: `src/explore/multi/lobby.ts`
- Modify: `index.html` (`#exMpLobby` trong `.ex-box`), `src/explore/chooser.ts`, `src/explore/index.ts`, `src/styles/main.css`, `scripts/add-multi-locales.mjs`, 9 locale, `tests/multi-check.mjs`

**Interfaces:**
- Consumes: `exMulti`, `MultiSession`.
- Produces: `exShowLobby(session, { onFly, onWatch, onSolo })`. Khóa i18n: `exMpSeats` (`Còn {n} trên 5 chỗ`), `exMpSky`, `exMpName`, `exMpNameMax`, `exMpFly`, `exMpSolo`, `exMpOffline`, `exMpNameBad`.

Tên lưu `localStorage['exMpName']`. `maxlength` không dùng để đếm; nút Bay ngay bật khi `exSanitizeName` khác `null`.

- [ ] **Step 1: Thêm mục 2 vào `multi-check.mjs`:**
  - `bấm Dù lượn hiện số chỗ "Còn 2", 3 tên bot; bot thứ tư vào: "Còn 1" không cần tải lại`.
  - `tên 10 ký tự: nút tắt; 'Trường' bật`.
  - `tên '<img src=x>' hiện đúng chuỗi trong roster, không tạo phần tử img` (và `Review Focus 2`: tên RTL `مرحبا` không đổi `dir` của `body`).
  - `tải lại: tên đã nhớ sẵn`.
  - `máy chủ tắt (multi= cổng không có gì): sau connectTimeoutMs hiện exMpOffline và nút Bay một mình; bấm thì bay được`.
  - `không chọn Dù lượn: không có WebSocket nào`.
  - `đổi ngôn ngữ ở bước riêng: dòng số chỗ dịch ngay, tên giữ nguyên`.
  - `chạy test: lang=ar không tràn hộp`.
- [ ] **Step 2: Chạy, FAIL. Viết code. Chạy, PASS.** Giữ thẻ khóa trên thiết bị cảm ứng.
- [ ] **Step 3:** Chạy `npm run test:mobile` (đổi `index.html`, styles). PASS.
- [ ] **Step 4: Commit** `feat(multi): bước chọn slot và nhập tên`.

### Task 7: Chế độ xem và lời mời

**Files:**
- Create: `src/explore/multi/watch.ts`
- Modify: `index.html` (`#exMpWatch`, `#exMpInvite`), `src/explore/index.ts`, `src/explore/chooser.ts`, styles, locale script + 9 locale, `tests/multi-check.mjs`

**Interfaces:**
- Consumes: `exRemotes.slotState`, `exChase`, `MultiSession`.
- Produces: `explore.startWatching()`, khóa `exMpWatching` (`Đang xem: {name}`), `exMpInvite`, `exMpInviteFly`, `exMpLate`, `exMpLost`, `exMpReleased`.

Khi xem: `cam.mode = 'glider'`, không dựng dù của mình, `exChase` trên `slotState(watched)`; `watched === -1` thì giữ camera. Chấp nhận lời mời: gọi `explore.start()` như bay thường, cất cánh mới. Mất kết nối khi xem: ghi `sessionStorage['exMpNotice']='lost'`, gọi `explore.exit()`; màn chọn đọc và hiện `exMpLost` một lần.

- [ ] **Step 1: Thêm mục 3 vào `multi-check.mjs`:**
  - `5 bot: chọn Dù lượn vào thẳng chế độ xem, dòng Đang xem có tên, phím WASD không đổi vị trí dù`.
  - `Draw call ≤ +5 so với 0 bot cùng tư thế camera`.
  - `một bot rời: hiện lời mời, camera vẫn bám`.
  - `bấm mời khi có chỗ: bay được, có slot, dù mình cờ đỏ`.
  - `bot khác giành trước: hiện exMpLate, vẫn xem`.
  - `người đang xem rời: Đang xem đổi tên khác trong 1 giây`.
  - `gõ wasd trong ô tên của lời mời: keys rỗng; Esc khi xem: thoát`.
  - `máy chủ tắt khi xem: quay về màn chọn và hiện exMpLost`.
  - `máy chủ tắt khi bay: vẫn bay, người khác biến mất, có exMpLost`.
- [ ] **Step 2: Chạy, FAIL. Viết code. Chạy, PASS.**
- [ ] **Step 3: Commit** `feat(multi): xem bám người bay và lời mời vào chỗ trống`.

### Task 8: Rời máy

**Files:**
- Create: `src/explore/multi/idle.ts`, `tests/multi-unit/idle.test.ts`
- Modify: `src/explore/multi/index.ts`, `index.html` (`#exMpIdle`), styles, locale script + 9 locale, `tests/multi-check.mjs`

**Interfaces:**
- Produces: `class ExIdle { constructor(idleMs, warnMs); activity(now): void; tick(now): 'ok'|'warn'|'expired'; remaining(now): number; reset(now): void }`. Nối bằng `setInterval` 500 ms (không dùng rAF), nhịp sống `setInterval heartbeatMs`. Khóa `exMpIdle` (`Bạn còn đó không? {s} giây`).

- [ ] **Step 1: Viết test đơn vị:** `59,9 s: ok; 60 s: warn; 74,9 s: warn; 75 s: expired; activity trong lúc warn quay về ok`; `remaining làm tròn lên giây`.
- [ ] **Step 2: FAIL. Viết `ExIdle`. PASS.**
- [ ] **Step 3: Thêm mục 4 vào `multi-check.mjs`** (rút ngắn bằng `?idleMs=2000&idleWarnMs=1000`, chỉ đọc khi có `?test`): `không phím: hiện đếm ngược rồi chuyển chế độ xem, lobby máy chủ giảm một người`; `bấm phím lúc đếm ngược: giữ slot`; `đóng trang: bot thấy lobby giảm trong 3 s`; `page.evaluate giả hidden và dừng rAF 5 s: slot vẫn còn, quay lại không ném lỗi`.
- [ ] **Step 4: Chạy, PASS. Commit** `feat(multi): trả slot khi rời máy`.

### Task 9: Hoàn tất

**Files:** `tests/KET-QUA.md`, `README.md`, `.github/memory-bank/{activeContext,progress,decisions}.md`, `.github/copilot-instructions.md` (§5 thêm `test:multi`).

- [ ] **Step 1:** Review cuối (`superpowers:requesting-code-review`), sửa.
- [ ] **Step 2:** Kiểm không còn tiến trình `*-check.mjs`/`wrangler` mồ côi.
- [ ] **Step 3:** `npm run build`, rồi chạy một lần: `test:multi:unit`, `test:multi:worker`, `test:multi`, `test:explore`, `test:mobile`, `test:drawcalls`, `test:tour`, `test:tunnel`, `test:riverfront`, `test:voice`, `test:weather`, `test:sunwheel`, `test:perf -- --strict`. Mong đợi: đạt; `test:drawcalls` góc cũ chênh 0 (trừ dao động `swTour` đã biết, D-018).
- [ ] **Step 4:** Ghi draw call 0/4/5 người vào `KET-QUA.md`, cập nhật memory bank (FPS GPU thật, bản dịch chưa duyệt, hạn chế: script/nhiều tab chiếm slot).
- [ ] **Step 5:** Triển khai Worker bản cuối; **người dùng** thử 2 máy thật trên `https://danangbridges.netlify.app`. Commit `docs(multi): kết quả và memory bank`.

## Kết quả thực hiện (2026-11-10)

Task 1–9 làm theo kiểu Subagent-driven, mỗi task có review riêng; review cuối toàn nhánh (With fixes) dẫn tới đợt sửa `d5b82d9` … `9d7b1fb`: máy chủ chỉ phát vị trí mới kèm giờ người gửi (hết "đứng rồi vọt"), `seen` qua hibernation, sảnh có Quay lại/Esc, lọc tên chặt hơn (tên vô hình, dấu chồng) và bỏ từ cấm chặn nhầm (Đàm, Các, Buổi, Lớn), kẹp yaw/bank, `?multi=` chỉ khi `?test`, thông báo tự ẩn. Lệch so với plan: Task 8 thêm mục mới sau mục 4 (mục 4 đã thuộc chế độ xem); kiểm tab ẩn giữ 23 s thay vì 5 s (hạn chờ máy chủ 10 s + quét 10 s); dù người khác ở layer 1, không phản chiếu nước (để giữ +4 draw call). Số đo ở `tests/KET-QUA.md`. Còn: deploy Worker bản cuối, thử 2 máy thật, FPS GPU thật, duyệt bản dịch.
