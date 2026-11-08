---
agent: agent
description: Nạp ngữ cảnh đầu phiên từ memory bank và xác nhận trạng thái thật của repo
---

# Bắt đầu phiên

1. Đọc `.github/copilot-instructions.md`, `.github/memory-bank/activeContext.md`, `.github/memory-bank/progress.md`.
2. Đối chiếu với repo thật:
   - `git status`, `git branch --show-current`, `git log --oneline -5`.
   - File mà `activeContext.md` nói "đã có"/"chưa có" có thật như vậy không.
3. Nếu memory bank lệch với repo: **tin repo**, sửa memory bank, nói rõ đã sửa gì.
4. Nếu nhiệm vụ của phiên đã rõ: đọc thêm file memory bank liên quan (bảng trong `.github/memory-bank/README.md`) và spec/plan của tính năng trong `docs/superpowers/`.
5. Trả lời ngắn (≤ 10 dòng): nhánh, đang làm gì, bước tiếp theo đề xuất, vấn đề mở cần người dùng quyết.

Không sửa code trong bước này.
