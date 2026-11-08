---
agent: agent
description: Thêm giọng thuyết minh Tour cho một ngôn ngữ mới
argument-hint: Mã ngôn ngữ (vd. ru, ko, ja)
---

# Thêm thuyết minh cho ngôn ngữ `${input:lang:mã ngôn ngữ}`

Nếu có spec riêng trong `docs/superpowers/specs/` (vd. `2026-10-21-thuyet-minh-tieng-nga-design.md`) thì spec đó ưu tiên.

1. Tạo `scripts/narration/<lang>.json` theo đúng khóa và thứ tự của `scripts/narration/en.json`. Nội dung dựa trên `vi.json` (nguồn), viết lại tự nhiên, **số và đơn vị bằng chữ**, độ dài mỗi clip gần bằng bản `en` (±25%).
2. Thêm giọng Neural của Edge vào `VOICES` trong `scripts/gen-narration.mjs`.
3. `npm run gen:voice` — chỉ sinh clip của ngôn ngữ mới; clip `vi`/`en` không được đổi (`git diff --stat public/voice/vi public/voice/en` rỗng).
4. Cập nhật `tests/voice-check.mjs` để kiểm ngôn ngữ mới.
5. `npm run build && npm run test:voice`, rồi `npm run test:tour`.
6. README (mục Giọng thuyết trình) + memory bank.

TTS lỗi → dừng và báo; không tạo clip giả, không sửa tay `manifest.json`.
