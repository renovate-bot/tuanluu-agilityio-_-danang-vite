---
agent: agent
description: Lập spec + plan cho một tính năng mới theo superpowers (chưa viết code)
argument-hint: Mô tả tính năng, vd. "bờ sông Hàn phía Đông" hoặc đường dẫn spec đã có
---

# Lập kế hoạch tính năng

Đầu vào: `${input:feature:Mô tả tính năng hoặc đường dẫn spec trong docs/superpowers/specs/}`.

`docs/superpowers/` là nguồn sự thật cho "xây cái gì / theo bước nào". Tính năng mới đi theo ba bước: làm rõ → spec → plan. Không viết code trong prompt này.

## Cách làm

1. **Có plugin superpowers:** dùng `superpowers:brainstorming`, rồi `superpowers:writing-plans`.
2. **Không có plugin (Copilot, Codex…):** làm tay ba bước.
   1. Đọc `.github/copilot-instructions.md`, `memory-bank/systemPatterns.md`, `activeContext.md`, `decisions.md`, rồi code mà tính năng chạm tới. Hỏi người dùng từng câu một cho tới khi rõ mục đích, phạm vi và thông số. Không tự quyết thay.
   2. Viết spec: `docs/superpowers/specs/YYYY-MM-DD-<chủ-đề>-design.md`.
   3. Viết plan: `docs/superpowers/plans/YYYY-MM-DD-<chủ-đề>.md`.

   Tên file dùng ngày hôm nay và chủ đề viết thường, nối bằng dấu gạch ngang, không dấu.

## Khung spec (tính năng mới, 9 mục)

Dòng thứ hai của file: `_<ngày> · Trạng thái: Đang thiết kế_`.

```
# <Tên> — Thiết kế
## 1. Mục đích và lý do
## 2. Mục tiêu
## 3. Không làm
## 4. Điều không được xảy ra
## 5. Thông số
## 6. Hành vi
## 7. Ràng buộc dự án
## 8. Kiểm tra
## 9. Câu hỏi còn mở
```

- Mục 4: các hậu quả phải tránh (hỏng seed, tăng draw call góc cũ, mất hành vi cũ…).
- Mục 5: bảng số, đơn vị, khóa `CONFIG.<...>`, nguồn hoặc `(ước lượng)`. Không bịa số.
- Mục 7: bất biến §3 của `copilot-instructions.md` (seed `rand`, i18n 9 ngôn ngữ, config, không thêm đèn/thư viện) và ngân sách draw call (góc cũ không tăng quá ngưỡng, ghi số).
- Mục 8: test sẽ chạy và ngưỡng đạt.
- Mục 9: những gì người dùng chưa quyết.

## Khung plan

Theo đầu file của plan mẫu [2026-10-26-mobile-ui.md](../../docs/superpowers/plans/2026-10-26-mobile-ui.md):

```
# <Tên> — Kế hoạch triển khai
> Cho agent thực thi: dùng superpowers:subagent-driven-development hoặc superpowers:executing-plans; không có plugin thì làm tuần tự từng ô `- [ ]`.
**Mục tiêu:** ...
**Kiến trúc:** ...
**Công nghệ:** ...
**Spec:** link tương đối tới `../specs/<ngày>-<chủ-đề>-design.md`
```

Sau header là các task. Mỗi task có:
- danh sách file tạo/sửa;
- các bước `- [ ]`, mỗi bước một việc;
- lệnh kiểm tra cụ thể (`npm run typecheck`, `npm run build`, `npm run test:...`) và ngưỡng đạt;
- bước commit cuối task, ghi sẵn tin nhắn.

Task đầu luôn là phần ít rủi ro nhất có thể kiểm tra độc lập (config + dọn chỗ + đo draw call). Plan nêu rõ: rủi ro với seed `rand()`, góc nhìn có thể đổi draw call, khóa i18n mới, thông số mới trong `config.ts`.

## Sau khi làm xong

- Đánh dấu `- [x]` từng bước trong plan; thêm `**Trạng thái:** Đã hoàn thành (merge <hash>)` ngay sau dòng Mục tiêu.
- Sửa spec: `Trạng thái: Đã xây`, và nếu bản xây khác ý định thì thêm mục ghi chỗ khác và lý do (trỏ `D-0xx` hoặc commit).
- Quyết định kiến trúc ghi vào `decisions.md`; trạng thái ghi vào `activeContext.md` và `progress.md` (prompt `update-memory-bank`).
