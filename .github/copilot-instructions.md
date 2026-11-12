# Hướng dẫn cho AI agent — Đà Nẵng 3D (`danang-bridges-3d`)

File này là **điểm vào chung** cho mọi agent (Claude Code qua `CLAUDE.md`, GitHub Copilot, Codex/agent khác qua `AGENTS.md`).
Đọc hết file này, rồi làm theo **Quy trình Memory Bank** bên dưới trước khi đụng vào code.

## 1. Dự án trong một đoạn

Mô hình 3D các công trình trên sông Hàn, Đà Nẵng: Cầu Rồng, Thuận Phước, Trần Thị Lý, Cầu sông Hàn (cầu quay) và Hầm vượt sông Hàn (phương án đề xuất, chưa xây), cùng hai bờ sông, ngày/đêm, Tour có thuyết minh, các chế độ tự khám phá (dù lượn, đi dạo, lái xe VinFast VF 3), giao diện 9 ngôn ngữ.
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
5. **Không thêm thư viện runtime.** **Mô hình và texture ngoài được phép cho mọi loại vật thể (D-033, thay giới hạn "chỉ nhân vật người" của D-030 / D-032)**, với điều kiện: giấy phép cho để trong repo công khai và phân phối lại; ghi nguồn + giấy phép trong README và tệp `LICENSE-*` cạnh tài nguyên trong `public/`; nạp bằng addon có sẵn của `three` (`GLTFLoader`…); spec của tính năng ghi trần dung lượng / tam giác và có test kiểm; có hình tạm hoặc đường lùi khi tải chậm / lỗi. Đang có: nhân vật Đi dạo (`public/people/*.glb`) và đám đông người đi bộ (`public/people/crowd.bin`, `crowd.jpg`), từ Microsoft Rocketbox, MIT. Xe người chơi chế độ Lái xe (`public/car/vf3.glb`, "Vinfast Vf3" của Hoàng Huy, Sketchfab, CC BY 4.0, đã chỉnh sửa; ghi công trong README, `public/car/LICENSE-VF3.txt` và `#drCredit` ở màn chọn / sảnh). Phần cảnh dựng bằng code vẫn vẽ texture bằng canvas, không thay hàng loạt khi không có yêu cầu. Không thêm `PointLight`/`SpotLight` mới; đèn đêm làm bằng emissive, đọc `shared.uNight`. Đèn cường độ 0 vẫn tốn shader mọi điểm ảnh: đèn hiện có thuộc ba bộ `day` / `night` / `full` của `core/lights.ts` (D-031), không ẩn / hiện đèn ở chỗ khác.
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
npm run test:gpu       # đo thời gian GPU thật (không SwiftShader): ngày / đêm, bộ đèn thật so với ép full, hâm nền; không chấm theo ms; đọc dist/
npm run test:explore   # chế độ tự khám phá (dù lượn); đọc dist/
npm run test:mobile    # giao diện điện thoại — chạy khi đổi index.html / styles / ui
npm run test:citynight # đèn đêm tòa nhà + vệt trên sông; cần `-- --baseline` trên bản chưa sửa để có mốc chuẩn
npm run test:boats:unit # tàu thuyền: vị trí tàu tụ tập, vùng cấm, hình học từng kiểu (nhanh, không trình duyệt)
npm run test:boats     # tàu thuyền: đội tàu, chuỗi rand() giữ nguyên, tàu tụ tập ngày/đêm/bão, LED trên sông; đọc dist/
npm run test:traffic:unit # xe cộ: kích thước, hướng mặt, thông số từng loại xe (nhanh, không trình duyệt)
npm run test:traffic   # xe cộ: một lệnh vẽ mỗi hệ, chuỗi rand() giữ nguyên, đèn theo đêm, bão dọn xe, tắt làn; đọc dist/
npm run test:trees:unit # cây: hình học cây bóng mát / dừa, trần tam giác, thân cong (nhanh, không trình duyệt)
npm run test:trees     # cây: 6 lưới, vị trí + chuỗi rand() giữ nguyên, dọn cây, cây đổ dựng lại, gió bám thân, dừa cửa hầm, ảnh; đọc dist/
npm run test:people:unit # người đi bộ: dáng đi / chạy, hình học hình khối ≤ 900 đỉnh, chia kiểu người; đám đông người thật: đọc `crowd.bin`, trần dung lượng / tam giác, chọn nhân vật, nhịp phát, vá pháp tuyến (nhanh, không trình duyệt)
npm run test:people    # người đi bộ: 1 lưới + 1 lệnh vẽ mỗi hệ, kiểu đi / chạy / đứng, lề cầu, rời cầu khi bão, tắt/bật, `dragon-people` cắt theo khung nhìn; chạy người thật, `?crowd=off` (hình khối), chặn `crowd.*`, `crowd.bin` chậm quá giờ, `crowd.jpg` hỏng (đường lùi); đọc dist/
npm run test:stroll:unit # đi dạo: bản đồ va chạm, chuyển động, trộn chuyển động theo tốc độ, nhân vật (bộ nạp giả), file glb, cần gạt, phím (nhanh, không trình duyệt)
npm run test:stroll    # đi dạo: một mình, nhân vật có xương, không xuyên tòa nhà / lan can, camera, sảnh, ảnh, cảm ứng, 9 ngôn ngữ; đọc dist/
npm run test:multi:unit   # dù lượn nhiều người: logic phòng, tên, nội suy, idle (nhanh, không trình duyệt)
npm run test:multi:worker # Worker qua wrangler dev: kiểm Origin
npm run test:multi        # dù lượn nhiều người: trình duyệt + bot qua wrangler dev cục bộ; đọc dist/
npm run test:drive:unit # lái xe: mạng đường (ô, cao độ, liên thông), vật cản, va chạm, chuyển động theo số liệu VF 3, sơ tán nhịp quay, camera, mô hình glb (trần dung lượng / tam giác, giấy phép, ghi công), hình xe + bánh + đèn, HUD, âm thanh, khóa i18n, giao thức nhiều người (nhanh, không trình duyệt)
npm run test:drive     # lái xe: vào bằng thẻ Ô tô / `?explore=drive`, lái qua 4 cầu + 2 ống hầm, đâm lan can / tường hầm / thân rồng, gầm Cầu Rồng, barie Cầu sông Hàn khi quay, ảnh hầm, đèn ngày / đêm / phanh, chặn / làm chậm `vf3.glb` (hình tạm), HUD 9 ngôn ngữ, thoát sang Đi dạo, lệnh vẽ; đọc dist/; một lượt chạy rất nặng (SwiftShader)
npm run gen:voice      # sinh lại clip thuyết minh đã đổi (-- --force: tất cả)
npm run gen:car        # sinh lại public/car/vf3.glb từ scripts/car/vinfast_vf3.glb (Blender 4.5, chạy qua `scripts/people/blender.mjs`, biến môi trường `BLENDER`; chỉ khi đổi mô hình hoặc cách xử lý xe)
npm run gen:people     # sinh lại public/people/p0..p4.glb từ Microsoft Rocketbox (cần Blender 4.5, tải ~160 MB vào scripts/people/.cache/; chạy qua `scripts/people/blender.mjs`, Blender không ở `C:/Program Files/Blender Foundation/Blender 4.5/` thì đặt biến môi trường `BLENDER`; chỉ khi đổi nhân vật)
npm run gen:crowd      # sinh lại public/people/crowd.bin + crowd.jpg (10 nhân vật đám đông người đi bộ, D-032) từ Microsoft Rocketbox; cùng yêu cầu Blender / `BLENDER` / thư mục `.cache/` như gen:people; ảnh xem trước ở `scripts/people/.cache/preview-crowd/`; chỉ khi đổi nhân vật hoặc chuyển động
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
- **Khi người dùng nói "tạo pull request và merge vào main" (hoặc tương đương), tự động cập nhật các file AI tương ứng trước khi mở PR, không cần hỏi lại**, rồi commit chúng vào chính nhánh đó:
  - `memory-bank/activeContext.md` (trạng thái, bước tiếp theo, việc đã/chưa chạy test) và `progress.md` (dòng tính năng, số PR, mục Còn thiếu); `decisions.md` nếu có quyết định mới; `systemPatterns.md` nếu có quy ước / cạm bẫy mới.
  - `instructions/*.instructions.md` của vùng code đã sửa (theo `applyTo`) khi có quy tắc hay cạm bẫy mới; file này (`copilot-instructions.md`) khi đổi lệnh, bất biến hoặc quy trình.
  - Trạng thái spec / plan trong `docs/superpowers/` của tính năng; README mục **Cấu trúc** khi thêm thư mục.
  - Biết số PR sau khi mở thì ghi số đó vào memory bank (commit thêm trên nhánh) trước khi merge. Chỉ ghi điều có thật: test nào đã chạy / chưa chạy, đã deploy hay chưa.
  - Deploy (`npm --prefix server/multi run deploy`) vẫn phải hỏi riêng; câu "tạo PR và merge" không bao gồm deploy.
