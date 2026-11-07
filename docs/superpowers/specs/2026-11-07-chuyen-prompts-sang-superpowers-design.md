# Chuyển `prompts/` sang `docs/superpowers/` — Thiết kế

_2026-11-07 · Trạng thái: đã duyệt_

## 1. Mục đích và lý do

Thư mục `prompts/` ở gốc repo được viết trước khi người dùng biết đến plugin superpowers. Nó gồm 10 file đặc tả, mỗi file là một prompt giao việc cho agent. Dự án đã được dựng từ chính các prompt này. Người dùng muốn sắp xếp lại cho hợp lý: **từ nay `docs/superpowers/` là nguồn sự thật (source of truth) duy nhất** cho việc "xây cái gì, vì sao" (specs) và "làm theo các bước nào" (plans). Mọi tính năng mới đi theo quy trình superpowers: brainstorming → spec → plan → thực thi.

## 2. Mục tiêu

1. Mỗi file trong `prompts/` thành **một spec và một plan** trong `docs/superpowers/`.
2. Spec mô tả **đúng cái đã thực sự xây**, không chép lại prompt gốc. Thông số lấy từ `src/config.ts` hiện tại. Những chỗ làm khác ý định ban đầu được ghi rõ, kèm lý do và mã quyết định D-0xx.
3. Plan của tính năng đã xong ghi lại các giai đoạn đã làm, **đánh dấu hoàn thành** (`- [x]`) kèm commit và test đã qua. Việc còn mở để ở dạng `- [ ]` cuối plan, để sau này làm tiếp.
4. Xóa `prompts/`. Mọi chỗ đang trỏ tới nó chuyển sang đường dẫn mới.
5. Quy trình agent trong `.github/` (dùng chung Copilot, Codex, Claude) **chuyển hẳn sang cách làm của superpowers**.

## 3. Không làm (non-goals)

- Không đổi mã ứng dụng trong `src/`. Ngoại lệ duy nhất là sửa comment có đường dẫn `prompts/…`.
- Không chạy lại test, không đo lại draw call. Số liệu lấy từ `tests/KET-QUA.md`, memory bank và log đã có.
- Không viết lại `decisions.md`. Spec chỉ dẫn link tới D-0xx.
- Không bỏ memory bank. Memory bank vẫn giữ vai trò trạng thái phiên: đang làm gì, bước tiếp theo, xong / còn thiếu. Lịch sử từng giai đoạn chuyển sang plan (§9).

## 4. Điều không được xảy ra (anti-goals)

- Spec "đẹp" nhưng sai so với mã. Thông số, tọa độ, tên hàm và tên khóa trong spec phải khớp mã hiện tại. Không chắc thì ghi "chưa đối chiếu", không bịa.
- Mất thông tin. Những gì prompt gốc có (nguồn số liệu, lưu ý độ tin cậy, câu trả lời của người dùng ở các mục kiểu "12b") phải còn lại trong spec, ở dạng đã đối chiếu.
- Số ước lượng bị biến thành số chắc chắn. Chữ "ước lượng" phải giữ nguyên.
- Còn sót đường dẫn `prompts/<file>.md` hỏng ở bất kỳ đâu. Tham chiếu `.github/prompts/*.prompt.md` là thư mục khác, không đụng.

## 5. Ánh xạ file

Ngày của spec/plan là ngày prompt gốc vào git. Tên file theo quy ước superpowers: spec `YYYY-MM-DD-<chủ-đề>-design.md`, plan `YYYY-MM-DD-<chủ-đề>.md`. Chủ đề viết tiếng Việt không dấu, giống tên cũ.

| Prompt gốc | Spec / plan (chủ đề) | Ngày | Quyết định, nguồn đối chiếu |
|---|---|---|---|
| `cau-rong.md` | `cau-rong` | 2026-10-21 | `src/bridges/dragon/`, D-002, D-011 |
| `cau-thuan-phuoc.md` | `cau-thuan-phuoc` | 2026-10-21 | `src/bridges/thuan-phuoc/` |
| `cau-tran-thi-ly.md` | `cau-tran-thi-ly` | 2026-10-21 | `src/bridges/tran-thi-ly/` |
| `cau-song-han.md` | `cau-song-han` | 2026-10-21 | `src/bridges/song-han/` |
| `ham-vuot-song-han.md` | `ham-vuot-song-han` | 2026-10-21 | `src/bridges/han-tunnel/`, D-007 |
| `bo-song-han.md` | `bo-song-han` | 2026-10-21 | `src/environment/riverfront/`, D-008 |
| `thuyet-minh-tieng-nga.md` | `thuyet-minh-tieng-nga` | 2026-10-21 | `scripts/narration/`, D-005 |
| `ke-hoach-thoi-tiet.md` | `thoi-tiet` | 2026-10-21 | `src/environment/weather/`, D-009, D-010, D-012, D-013 |
| `tour-4-cau.md` | `tour-4-cau` | 2026-10-22 | `views/tour*.ts`, D-015 |
| `vong-quay-mat-troi.md` | `vong-quay-mat-troi` | 2026-10-22 | `src/bridges/sun-wheel/`, D-014, D-016, D-017 |

Bốn cầu và Cầu Rồng được dựng trong bản HTML gốc rồi chuyển sang Vite ở `b500bb5`, nên không có lịch sử từng giai đoạn. Plan của chúng chỉ ghi các mốc thật trong git: dựng ở bản gốc, chuyển sang Vite, các lần sửa sau như D-011. Không dựng lại giai đoạn giả.

Memory bank đang ghi "Dựng lại Cầu Rồng chi tiết theo `prompts/cau-rong.md` — chưa bắt đầu". Người dùng xác nhận Cầu Rồng **đã hoàn thành**, nên dòng này trong `activeContext.md` và `progress.md` được sửa lại. Phần nào của prompt gốc chưa có trong mã thì vào mục "Còn mở" của spec, không coi là tính năng chưa làm.

**Lựa chọn của tôi (người viết thiết kế), không phải người dùng yêu cầu:** cùng đợt, viết thêm spec cho ba tính năng hiện chưa có spec, để `docs/superpowers/` đầy đủ:
- giao diện điện thoại (D-019, đã có plan `2026-10-26-mobile-ui.md`);
- Buy me a coffee (D-021, đã có plan `2026-10-29-buy-me-a-coffee.md`);
- tối ưu độ mượt (D-018): chưa có spec lẫn plan, nên viết cả hai.

Hai plan có sẵn chỉ đánh dấu hoàn thành, không viết lại.

## 6. Khung một spec (tính năng đã xong)

```
# <Tên> — Thiết kế
_Ngày gốc · Trạng thái: Đã xây (merge <hash>/PR #) · Prompt gốc: prompts/<file>.md tại <hash>_

1. Mục đích và lý do
2. Phạm vi: có / không có
3. Thông số đã dùng: bảng số, đơn vị, nguồn hoặc "(ước lượng)", tên khóa CONFIG
4. Hình dạng, hành vi như đã xây: theo cấu trúc mã, tên file, hàm chính
5. Tương tác, UI, i18n, thuyết minh (nếu có)
6. Ràng buộc đã tuân thủ: draw call (số trong KET-QUA.md), rand/seed, đèn, "phương án đề xuất"…
7. Khác so với ý định ban đầu: mỗi dòng ghi cái gì, vì sao, D-0xx hoặc commit
8. Kiểm tra: test nào, ở đâu (tests/*-check.mjs), kết quả gần nhất
9. Còn mở: lấy từ progress.md / activeContext.md
```

Dòng "Prompt gốc … tại <hash>" giữ đường đọc lại bản cũ qua `git show <hash>:prompts/<file>.md` sau khi xóa thư mục.

## 7. Khung một plan (đã xong)

Theo đầu file của các plan superpowers có sẵn (mục tiêu, kiến trúc, công nghệ, link spec). Sau đó là các giai đoạn thật. Mỗi giai đoạn có:
- `- [x]` từng việc chính;
- commit;
- test đã qua và ngày.

Lấy thông tin từ `git log`, `progress.md`, các mục GĐ trong `activeContext.md` và `scripts/run-*.ps1`. Cuối plan có mục "Còn lại" ở dạng `- [ ]`.

## 8. Ảnh tham chiếu

`prompts/tham-chieu/` chuyển sang `docs/superpowers/specs/tham-chieu/`. Thư mục này **vẫn để trong `.gitignore`** vì ảnh có bản quyền. Cập nhật dòng `.gitignore` tương ứng.

## 9. Cập nhật tham chiếu và quy trình

Phải sửa (danh sách từ `grep -rn "prompts/"`, loại trừ `.github/prompts/`):

- **Quy trình agent, chuyển sang superpowers:**
  - `.github/copilot-instructions.md` §7: bảng tài liệu, quy ước "`prompts/` ở gốc = đặc tả".
  - `.github/prompts/plan-feature.prompt.md` và `new-structure.prompt.md`.
  - `.github/agents/planner.agent.md`.
  - `.github/memory-bank/projectbrief.md` và `README.md`.
  - `AGENTS.md`, `CONTRIBUTING.md` (cây thư mục, hướng dẫn PR).
  - `.github/pull_request_template.md`.

  Nội dung chung: tính năng mới bắt đầu bằng brainstorming → spec ở `docs/superpowers/specs/` → plan ở `docs/superpowers/plans/` → thực thi theo plan. Agent không có plugin superpowers (Copilot, Codex) vẫn làm theo được: đọc/viết spec và plan theo khung, làm theo checklist trong plan.
  - **Lựa chọn của tôi:** không tạo file mẫu mới trong `.github/`.
    - `plan-feature.prompt.md` được viết lại. Nó chứa sẵn khung spec cho tính năng *mới*: §6 bỏ "Khác so với ý định", thêm "Câu hỏi còn mở". Nó cũng chứa khung plan superpowers: đầu file như các plan có sẵn, các task `- [ ]`, mỗi task ghi file, bước, lệnh kiểm tra. Prompt này chỉ tới plan mẫu `2026-10-26-mobile-ui.md`.
    - `new-structure.prompt.md` giữ phần "làm thế nào" riêng của dự án (rand, LOD, draw call). Phần "viết đặc tả" trong đó chuyển thành "chạy plan-feature".
- **Tham chiếu tới file cụ thể:**
  - `README.md` (Hầm, riverfront);
  - comment đầu `tests/{riverfront,tunnel,weather,sunwheel}-check.mjs` và `tests/sunwheel-gd2-shots.mjs`;
  - `src/environment/weather/impact.ts`;
  - `.github/memory-bank/{activeContext,progress,decisions}.md`. Trong `decisions.md` chỉ sửa đường dẫn, không sửa nội dung quyết định. Trong `activeContext.md` cũng sửa các chỗ nhắc `run-*.ps1`.
- **`scripts/run-weather.ps1`, `scripts/run-sunwheel.ps1`:** hai script này đọc đặc tả theo số mục ("mục 9, 10, 11, 12b") để chạy từng giai đoạn bằng `claude -p`. Cả hai tính năng đã xong, và cách chạy này được thay bằng superpowers (subagent-driven-development).
  - **Người dùng đã đồng ý:** xóa hai script, vì spec mới không còn đánh số mục như cũ nên giữ lại thì script hỏng. Lịch sử vẫn còn trong git.
- **`activeContext.md` được làm gọn (người dùng chọn):**
  - Các mục nhật ký giai đoạn (Thời tiết GĐ1–GĐ8, kịch bản bão, Vòng quay GĐ1–GĐ8, tối ưu độ mượt, giao diện điện thoại) chuyển vào plan tương ứng. Phải chuyển hết, không mất chi tiết: số đo, nguyên nhân lỗi, hạn chế.
  - Sau khi chuyển, `activeContext.md` chỉ còn ba phần: trạng thái hiện tại, bước tiếp theo (mỗi mục có link tới plan) và vấn đề mở.
  - `progress.md` giữ bảng, thêm cột hoặc link tới spec và plan.

## 10. Ràng buộc

- Văn bản tiếng Việt, cùng giọng với memory bank. Không tạo file tài liệu ngoài danh sách ở §5 (theo `copilot-instructions.md` §6).
- Làm trên nhánh `feature/superpowers-docs`, không commit thẳng `main`. Chia commit theo nhóm:
  1. spec + plan;
  2. sửa tham chiếu và quy trình;
  3. xóa `prompts/`, chuyển ảnh tham chiếu.
- Không đổi mã nên không cần chạy bộ test. Kiểm tra cuối:
  - `grep -rn "prompts/[a-z-]*\.md"` phải không còn kết quả, trừ các chỗ sau: `.github/prompts/`, dòng "Prompt gốc" trong spec, `.entire/`, `tests/screens/`, `node_modules/`, `dist/`;
  - mọi link tương đối trong `docs/superpowers/` và `.github/` trỏ tới file có thật;
  - `npm run typecheck`, vì có sửa comment trong `.ts`.

## 11. Để người làm tự quyết

- Câu chữ, độ chi tiết của từng spec. Spec thời tiết và vòng quay sẽ dài, các cầu thì ngắn.
- Cách chia giai đoạn trong plan, khi git không có ranh giới rõ.
- Thứ tự viết các spec.
