# Thuyết minh tiếng Nga — Kế hoạch triển khai (đã hoàn thành)

> **Cho agent thực thi:** kế hoạch này ghi lại việc đã làm. Các mục `- [x]` đã xong. Việc còn lại ở cuối file.

**Mục tiêu:** Chọn Русский thì Tour đọc bằng giọng Nga (`ru-RU-SvetlanaNeural`), nút Озвучка mở, không đổi logic phát giọng.

**Kiến trúc:** Lời thoại `scripts/narration/ru.json` cùng khóa/thứ tự với `vi.json`/`en.json`; `scripts/gen-narration.mjs` sinh clip mp3 bằng `msedge-tts` và ghi `public/voice/manifest.json` (D-005); `src/audio/narration.ts` tự nhận ngôn ngữ mới qua manifest.

**Công nghệ:** Vite 6, TypeScript 5.9, three@0.165, `msedge-tts`, Playwright (test).

**Spec:** [2026-10-21-thuyet-minh-tieng-nga-design.md](../specs/2026-10-21-thuyet-minh-tieng-nga-design.md)

**Trạng thái:** Đã hoàn thành (commit `0a0b6be`, vào `main` cùng PR #2)

## Giai đoạn

### GĐ1: Giao diện tiếng Nga (tiền đề)
- [x] `src/i18n/locales/ru.json` (cặp tiêu đề/chú thích các Tour, tên riêng Nga), `src/i18n/index.ts` nhận `ru`, CSS `main.css`.
Commit: `ca91609` (2026-10-20).
Kiểm tra: chưa có test riêng (`progress.md` ghi "—").

### GĐ2: Lời thoại, giọng, clip, test, README
Một commit mang toàn bộ.
- [x] Viết `scripts/narration/ru.json`: số bằng chữ chia đúng ngữ pháp, không viết tắt đơn vị, tên riêng theo `locales/ru.json`. Thực tế 5 khóa / 36 điểm (có cả `hrStops`).
- [x] `VOICES.ru = 'ru-RU-SvetlanaNeural'` trong `scripts/gen-narration.mjs` (sau `vi`, `en`).
- [x] Sinh 36 clip `public/voice/ru/` và khóa `ru` trong `manifest.json` bằng `npm run gen:voice` (không `--force`).
- [x] `tests/voice-check.mjs`: danh sách ngôn ngữ `['vi', 'en', 'ru']` ở bước 1 và 2; bước 3 thêm kiểm đổi sang `ru` phát `voice/ru/<khóa>-1.mp3`; bước 4 vẫn dùng `ja`.
- [x] README mục "Giọng thuyết trình của Tour (vi, en, ru)".
Commit: `0a0b6be` (2026-10-21).
Kiểm tra: `test:voice` đạt (vi + en + ru, 4 tour, 28 điểm dừng mỗi ngôn ngữ), thông báo của `voice-check` ở commit `0a0b6be`. `tests/KET-QUA.md` có dòng cùng số liệu ở commit `2572e8a` (log GĐ8 thời tiết, không phải lần đo ngày 2026-10-21).

### GĐ3: Mở rộng khóa `ru` theo các tính năng sau
Mỗi lần thêm khóa mới trong `ru.json` và sinh clip `ru` cùng với vi/en:
- [x] `wxStorm` (kịch bản bão, 8 clip): `8c7ef9e` (2026-10-22), D-013.
- [x] `allStops` (Tour 4 cầu, 13 clip): `cd52a47` (2026-10-22), D-015.
- [x] `swStops` (Tour Vòng quay Mặt Trời, 6 clip): `028dede` (2026-10-24), D-017.
Kiểm tra: `test:voice` đạt (vi + en + ru, 6 tour, 47 điểm dừng + 8 mốc kịch bản bão mỗi ngôn ngữ), 2026-10-24; tổng 63 clip `ru` hiện có.

## Còn lại
- [ ] Nghe thử giọng Nga (và vi/en) cho mọi khóa; chỉnh trọng âm U+0301 nếu sai.
- [ ] Thuyết minh cho ko, ja, zh, th, ar, hi.
- [ ] Ghi lại các câu `ru` đã phải rút gọn (nếu có) khi sửa lời lần sau.
