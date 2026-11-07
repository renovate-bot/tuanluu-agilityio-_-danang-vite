# AGENTS.md

Mọi hướng dẫn cho AI agent nằm trong `.github/`:

1. Đọc [.github/copilot-instructions.md](.github/copilot-instructions.md) — quy tắc chung, bất biến, lệnh.
2. Đọc [.github/memory-bank/activeContext.md](.github/memory-bank/activeContext.md) và [progress.md](.github/memory-bank/progress.md) — trạng thái hiện tại.
3. Đang làm một tính năng có plan thì đọc plan đó trong [docs/superpowers/plans/](docs/superpowers/plans/) và spec trong [docs/superpowers/specs/](docs/superpowers/specs/). Tính năng mới: chạy [plan-feature](.github/prompts/plan-feature.prompt.md) (brainstorming → spec → plan) trước khi code.
4. Trước khi sửa một vùng code, đọc file tương ứng trong [.github/instructions/](.github/instructions/) (theo `applyTo`).
5. Cuối phiên, cập nhật memory bank theo [.github/prompts/update-memory-bank.prompt.md](.github/prompts/update-memory-bank.prompt.md).

<!-- entire-agent:begin -->
Read .entire/agent-guide.md for this repository's workflow, source inspection, and verification guidance.
@.entire/agent-guide.md
<!-- entire-agent:end -->
