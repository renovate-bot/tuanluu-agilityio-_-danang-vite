# Hướng dẫn cho AI agent — Đà Nẵng 3D (`danang-bridges-3d`)

File này là **điểm vào chung** cho mọi agent (Claude Code qua `CLAUDE.md`, GitHub Copilot, Codex/agent khác qua `AGENTS.md`).
Đọc hết file này, rồi làm theo **Quy trình Memory Bank** bên dưới trước khi đụng vào code.

## 1. Dự án trong một đoạn

Mô hình 3D các công trình trên sông Hàn, Đà Nẵng: Cầu Rồng, Thuận Phước, Trần Thị Lý, Cầu sông Hàn (cầu quay) và Hầm vượt sông Hàn (phương án đề xuất, chưa xây), cùng hai bờ sông, ngày/đêm, Tour có thuyết minh, giao diện 9 ngôn ngữ.
Vite 6 + TypeScript 5.9 + three@0.165, **không dùng framework UI**. Chuyển từ một file HTML ~4 600 dòng (`tests/original/index.html`) và phải giữ nguyên hành vi lẫn draw call của bản gốc.

## 2. Quy trình Memory Bank (bắt buộc)

Agent không nhớ gì giữa các phiên. Bộ nhớ của dự án nằm ở [.github/memory-bank/](memory-bank/README.md).

1. **Đầu phiên:** đọc `memory-bank/activeContext.md`; đọc `memory-bank/progress.md` khi cần biết trạng thái một tính năng cũ. Đọc thêm file khác theo bảng trong [memory-bank/README.md](memory-bank/README.md) khi nhiệm vụ cần. Đang làm một tính năng có plan thì đọc plan đó (`../docs/superpowers/plans/`) và spec của nó.
2. **Trong phiên:** quyết định kiến trúc mới → ghi vào `decisions.md`. Phát hiện quy ước chưa có → ghi vào `systemPatterns.md`.
3. **Cuối phiên / trước commit:** cập nhật `activeContext.md` (đang làm gì, bước tiếp theo) và `progress.md` (xong / còn thiếu). Dùng prompt [update-memory-bank](prompts/update-memory-bank.prompt.md).

Memory bank ghi **cái code không tự nói ra được**: lý do, trạng thái, việc dở dang, cạm bẫy. Không chép lại code hay README.

## 3. Bất biến — vi phạm là hỏng dự án

1. **Chuỗi ngẫu nhiên có seed.** `rand()` trong `src/common/math.ts` dùng chung cho Cầu Rồng và khu phố; thứ tự dựng trong `src/main.ts` quyết định vị trí nhà, cây, xe.
   - Không đổi thứ tự các lệnh `build*()` hiện có, không thêm/bớt lời gọi `rand()` trong code đã có.
   - Phần ngẫu nhiên mới dùng bộ sinh riêng `rng(seed)` (mẫu: `src/core/water.ts`).
   - Công trình mới cần dọn nhà/cây: dựng **sau** mọi lệnh dùng `rand`, rồi thu nhỏ instance về scale 0 (mẫu: `src/bridges/han-tunnel/corridor.ts`, `hideBankTrees()` trong `SongHanBridge.ts`). Xử lý cả level `near` lẫn `far` của `THREE.LOD`.
2. **Draw call.** Bảng chuẩn ở `tests/KET-QUA.md`. Góc nhìn cũ không được tăng quá ngưỡng mà spec của tính năng cho phép (mặc định: 0). Gộp hình học (`mergeGeometries`), dùng `InstancedMesh`, LOD, `noReflect`/layer 1.
3. **Mọi thông số ở `src/config.ts`.** Mỗi dòng: chú thích tiếng Việt, đơn vị, `(ước lượng)` nếu không có nguồn. Số đã công bố thì ghi nguồn.
4. **i18n đủ 9 ngôn ngữ.** Khóa mới phải có trong cả `src/i18n/locales/{vi,en,ko,ja,zh,th,ar,hi,ru}.json`. `ar` là RTL.
5. **Không thêm thư viện runtime, không thêm ảnh ngoài.** Texture vẽ bằng canvas. Không thêm `PointLight`/`SpotLight` mới; đèn đêm làm bằng emissive, đọc `shared.uNight`.
6. **Công trình chưa xây phải nói rõ là "phương án đề xuất"** trong UI và thuyết minh.

## 4. Hệ tọa độ

1 đơn vị = 1 m. **X**: Tây → Đông (dọc Cầu Rồng). **Z**: dọc sông, **−Z là Bắc** (cửa sông, Sơn Trà). Mặt nước y = 0, mặt đất `landY = 2.5`, mặt đường `roadY = 2.6`, mép kè |x| = 262.
Cầu Rồng z = 0 · Cầu sông Hàn z = −1080 · Trần Thị Lý z = +1300 · Thuận Phước z = −2900 · tim Hầm z = −1700 (hành lang |z + 1700| < 30, không đặt gì lên đó).

## 5. Lệnh

```bash
npm run dev            # máy chủ phát triển; thêm ?test vào URL để có window.__app
npm run typecheck      # tsc --noEmit — chạy sau MỌI thay đổi .ts
npm run build          # typecheck + vite build → dist/ (các test đọc dist/, nên build trước khi test)
npm run test:drawcalls -- [tests/original]   # 10–20 phút (SwiftShader)
npm run test:tour      -- [tests/original]
npm run test:tunnel
npm run test:riverfront
npm run test:voice
npm run test:weather
npm run test:sunwheel
npm run test:perf      -- [--strict]   # khung dài nhất, số shader biên dịch thêm
npm run test:explore   # chế độ tự khám phá (dù lượn); đọc dist/
npm run test:mobile    # giao diện điện thoại — chạy khi đổi index.html / styles / ui
npm run test:citynight # đèn đêm tòa nhà + vệt trên sông; cần `-- --baseline` trên bản chưa sửa để có mốc chuẩn
npm run test:boats:unit # tàu thuyền: vị trí tàu tụ tập, vùng cấm, hình học từng kiểu (nhanh, không trình duyệt)
npm run test:boats     # tàu thuyền: đội tàu, chuỗi rand() giữ nguyên, tàu tụ tập ngày/đêm/bão, LED trên sông; đọc dist/
npm run test:traffic:unit # xe cộ: kích thước, hướng mặt, thông số từng loại xe (nhanh, không trình duyệt)
npm run test:traffic   # xe cộ: một lệnh vẽ mỗi hệ, chuỗi rand() giữ nguyên, đèn theo đêm, bão dọn xe, tắt làn; đọc dist/
npm run test:trees:unit # cây: hình học cây bóng mát / dừa, trần tam giác, thân cong (nhanh, không trình duyệt)
npm run test:trees     # cây: 6 lưới, vị trí + chuỗi rand() giữ nguyên, dọn cây, cây đổ dựng lại, gió bám thân, dừa cửa hầm, ảnh; đọc dist/
npm run test:people:unit # người đi bộ: dáng đi / chạy, hình học ≤ 900 đỉnh, chia kiểu người (nhanh, không trình duyệt)
npm run test:people    # người đi bộ: 1 lưới mỗi hệ, kiểu đi / chạy / đứng, lề cầu, rời cầu khi bão, tắt/bật; đọc dist/
npm run test:multi:unit   # dù lượn nhiều người: logic phòng, tên, nội suy, idle (nhanh, không trình duyệt)
npm run test:multi:worker # Worker qua wrangler dev: kiểm Origin
npm run test:multi        # dù lượn nhiều người: trình duyệt + bot qua wrangler dev cục bộ; đọc dist/
npm run gen:voice      # sinh lại clip thuyết minh đã đổi (-- --force: tất cả)
```

Test chạy Chromium CPU nên **chậm**: chạy test liên quan trực tiếp tới thay đổi; chạy đủ bộ trước khi báo xong một tính năng. Báo kết quả thật, kể cả khi lỗi hoặc không chạy được.

## 6. Phong cách code

- Comment **tiếng Việt**, khối tiêu đề `/* ===== ... ===== */` ở đầu file/mục, mật độ comment như file xung quanh.
- Hàm dựng đặt tiền tố theo công trình: `shBuild*`, `hr*`, `tp*`, `ttl*`, `rf*`.
- Dòng dài, gọn kiểu "một dòng một ý" như code hiện có; không tự ý format lại file.
- `tsconfig` đang `strict: false` (giai đoạn 1). Code mới nên có kiểu rõ ràng, không bật strict toàn cục.
- Không tạo file tài liệu mới ngoài yêu cầu (trừ spec/plan trong `docs/superpowers/` theo `plan-feature`); README cập nhật mục **Cấu trúc** khi thêm thư mục.

## 7. Bản đồ tài liệu cho agent

| Nhu cầu | File |
|---|---|
| Bộ nhớ dự án | [.github/memory-bank/](memory-bank/README.md) |
| Quy tắc theo vùng code (tự áp theo `applyTo`) | [.github/instructions/](instructions/) |
| Quy trình tái sử dụng (thêm công trình, thêm ngôn ngữ, kiểm tra…) | [.github/prompts/](prompts/) |
| Vai trò agent (lập kế hoạch, review) | [.github/agents/](agents/) |
| **Spec tính năng** (cái gì, vì sao, thông số) | [docs/superpowers/specs/](../docs/superpowers/specs/) |
| **Plan tính năng** (làm theo bước nào, đã xong tới đâu) | [docs/superpowers/plans/](../docs/superpowers/plans/) |

Quy ước: `docs/superpowers/` là nguồn sự thật cho "xây cái gì / theo bước nào"; tính năng mới bắt đầu bằng brainstorming → spec → plan (prompt [plan-feature](prompts/plan-feature.prompt.md), có hoặc không có plugin superpowers). `.github/prompts/` là **quy trình lặp lại** (làm thế nào).

## 8. Git

- Làm trên nhánh `feature/*`, không commit thẳng `main`. Commit theo từng giai đoạn đã kiểm tra.
- Không commit file của tính năng khác đang làm dở.
- Commit `public/voice/` khi đổi lời thuyết minh. Không commit `dist/`, `tests/screens/`.
