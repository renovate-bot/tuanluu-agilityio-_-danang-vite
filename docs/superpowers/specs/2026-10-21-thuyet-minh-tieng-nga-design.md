# Thuyết minh tiếng Nga — Thiết kế
_2026-10-21 · Trạng thái: Đã xây (commit `0a0b6be`, vào `main` cùng PR #2) · Prompt gốc: prompts/thuyet-minh-tieng-nga.md tại c418f92_

Đọc lại bản prompt cũ: `git show c418f92:prompts/thuyet-minh-tieng-nga.md`. Tài liệu này mô tả cái ĐÃ XÂY, đối chiếu với `scripts/narration/ru.json`, `scripts/gen-narration.mjs`, `public/voice/manifest.json` và `tests/voice-check.mjs`.

## 1. Mục đích và lý do
- Giao diện tiếng Nga có từ `ca91609` (`src/i18n/locales/ru.json`) nhưng chưa có giọng đọc: chọn Русский thì Tour chạy lặng, nút Thuyết minh (Озвучка) bị khóa (D-005: ngôn ngữ chưa có clip thì lặng).
- Thêm giọng Nga để Tour đọc được, không đổi logic phát giọng.
- Quyết định liên quan: D-005 (clip mp3 sinh sẵn bằng `msedge-tts`, `manifest.json` lưu thời lượng + hash).

## 2. Phạm vi: có / không có
Có:
- `scripts/narration/ru.json`: lời thoại theo đúng khóa và thứ tự điểm dừng của `vi.json`/`en.json`.
- Giọng `ru-RU-SvetlanaNeural` trong `VOICES` của `scripts/gen-narration.mjs`.
- Clip `public/voice/ru/<khóa>-<i>.mp3` + khóa `ru` trong `public/voice/manifest.json`.
- `tests/voice-check.mjs` kiểm cả `ru`; README mục "Giọng thuyết trình của Tour" ghi `ru`.

Không có:
- Không đổi `src/audio/narration.ts`, `views/tour.ts` (hệ thống tự nhận ngôn ngữ mới qua manifest).
- Không tạo lại clip `vi`/`en` (không chạy `--force`).
- Thuyết minh ko, ja, zh, th, ar, hi (mục 9).

## 3. Thông số đã dùng
| Thông số | Giá trị | Nguồn |
|---|---|---|
| Giọng | `ru-RU-SvetlanaNeural` (nữ, đồng bộ `vi-VN-HoaiMyNeural`, `en-US-AriaNeural`) | `VOICES` trong `scripts/gen-narration.mjs` |
| Dự phòng nếu Svetlana không dùng được | `ru-RU-DariyaNeural`, rồi `ru-RU-DmitryNeural` | prompt gốc (không cần dùng, Svetlana chạy được) |
| Định dạng | `audio-24khz-48kbitrate-mono-mp3`, CBR 48 kbps (`BYTES_PER_SEC = 48000 / 8`) | `gen-narration.mjs` |
| Đệm đọc xong trước điểm kế | `PAD = 1,2` s | `views/tour.ts`; `voice-check` bước 2 |

**Số khóa và clip hiện có trong `scripts/narration/ru.json`** (đếm lại khi viết tài liệu này, trùng với `public/voice/manifest.json`):

| Khóa | Điểm / clip | Tour | Commit thêm clip `ru` |
|---|---|---|---|
| `stops` | 8 | Cầu Rồng | `0a0b6be` |
| `ttlStops` | 7 | Trần Thị Lý | `0a0b6be` |
| `tpStops` | 7 | Thuận Phước | `0a0b6be` |
| `shStops` | 6 | Cầu sông Hàn | `0a0b6be` |
| `hrStops` | 8 | Hầm vượt sông Hàn | `0a0b6be` |
| `wxStorm` | 8 | Kịch bản bão (không phải Tour) | `8c7ef9e` (2026-10-22) |
| `allStops` | 13 | Tour 4 cầu | `cd52a47` (2026-10-22) |
| `swStops` | 6 | Tour Vòng quay Mặt Trời | `028dede` (2026-10-24) |
| Tổng | **63** | 7 Tour + 1 kịch bản | |

`0a0b6be` tự ghi "5 tours, 36 stops" (37 file đổi trong `public/voice` ở commit đó, gồm 36 clip `ru` và `manifest.json`). Mỗi khóa có số clip bằng nhau ở `vi`, `en`, `ru`.

**Thời lượng clip (giây, tổng từng khóa, từ manifest):**

| Khóa | vi | en | ru |
|---|---|---|---|
| `stops` | 77,8 | 86,4 | 91,2 |
| `ttlStops` | 61,4 | 70,7 | 79,1 |
| `tpStops` | 60,7 | 69,1 | 76,9 |
| `shStops` | 58,9 | 66,8 | 72,9 |
| `hrStops` | 113,1 | 138,1 | 142,0 |
| `wxStorm` | 85,8 | 93,5 | 96,1 |
| `allStops` | 121,0 | 144,7 | 151,0 |
| `swStops` | 83,0 | 92,6 | 96,1 |

Clip `ru` ngắn nhất 7,6 s (`ttlStops`), không clip nào dưới 4 s. Không clip `ru` nào dài hơn clip `en` cùng điểm quá 3 s (chênh lớn nhất 2,7 s ở `hrStops`), đúng mục tiêu của prompt gốc.

## 4. Hình dạng, hành vi như đã xây
- `ru.json`: các khóa đúng thứ tự và số phần tử như `vi.json`; mỗi phần tử một chuỗi; JSON UTF-8, thụt 2 dấu cách. Thứ tự điểm dừng khớp cặp `[tiêu đề, chú thích]` trong `src/i18n/locales/ru.json`.
- `gen-narration.mjs`: lặp `Object.entries(VOICES)` theo thứ tự `vi`, `en`, `ru`; chỉ tạo lại clip có hash lời đổi; ghi `manifest.json` dạng `{ <ngôn ngữ>: { <khóa>: [{ d: thời lượng, h: hash }] } }`.
- Quy ước viết lời cho TTS tiếng Nga (đã theo trong `ru.json`):
  - mọi con số viết bằng chữ, chia đúng giống/số/cách («шестьсот шестьдесят шесть метров»); số thập phân bằng chữ («девять и девять десятых метра»);
  - không viết tắt đơn vị («метров», «градусов»); giờ bằng chữ; dùng «ё»; không `&`, `<`, `>` (gói `msedge-tts` bọc văn bản vào SSML); ngoặc «»; không «т. е.», «и т. д.», «ок.»;
  - tên riêng theo `src/i18n/locales/ru.json` (Хан, Хайтяу, Шонча, Ми Кхе, Мост Дракона, Чан Тхи Ли, Тхуан Фуок...); tên chưa có thì phiên âm theo Концевич;
  - trọng âm U+0301 chỉ đặt khi nghe thử thấy sai. Hiện `ru.json` không có ký tự U+0301 nào.
- Kiểm bằng mã hiện tại: không có chữ số Ả Rập nào trong `ru.json` trừ tên «Igosu 108» (`swStops` điểm 3, tên của vòng quay cũ ở Nhật).
- Độ dài: mục tiêu của prompt là mỗi clip không dài hơn bản `en` quá 3 s; nếu dài thì rút gọn câu chữ, không bỏ số liệu.
- Lời thoại dịch ý từ `vi.json`, đối chiếu `en.json`; số liệu và sự kiện giữ như bản vi/en, không thêm thông tin mới.

## 5. Tương tác, UI, i18n, thuyết minh
- Chọn Русский: nút Озвучка mở, Tour đọc `voice/ru/<khóa>-<i>.mp3`; đoạn bay kéo dài cho đọc xong (`fitDurations` trong `views/tour.ts`).
- Đổi ngôn ngữ giữa Tour thì phát lại điểm đang hiện bằng giọng mới (`tests/voice-check.mjs` bước 3).
- README mục "Giọng thuyết trình của Tour (vi, en, ru)": đường dẫn `scripts/narration/{vi,en,ru}.json`, thêm `ru-RU-SvetlanaNeural`, ghi chú viết số bằng chữ, chia đúng giống/số/cách và dùng U+0301 khi cần.
- Sinh lại clip: `npm run gen:voice` (cần mạng tới dịch vụ Edge TTS; chỉ tạo lại clip đã đổi, `-- --force` tạo tất cả).

## 6. Ràng buộc đã tuân thủ
- Clip `vi`/`en` không đổi: hash trong manifest giữ nguyên (prompt: "giữ nguyên" phải bằng số clip vi + en đã có, nếu khác thì dừng và kiểm tra).
- Không đụng mã dựng hình: không mesh, không `rand()`, không đèn; draw call không đổi.
- Công trình chưa xây: `hrStops` và `allStops` điểm 10 nói rõ hầm là phương án đề xuất, chưa xây (ví dụ «Это лишь модель предлагаемого варианта, тоннель ещё не построен»).
- i18n: không thêm khóa giao diện mới (giao diện Nga đã có từ `ca91609`).

## 7. Khác so với ý định ban đầu
| Prompt gốc | Như đã xây | Vì sao |
|---|---|---|
| 4 Tour, 28 điểm dừng, "tạo mới 28, giữ nguyên 56" | `0a0b6be` thêm 36 clip, gồm cả `hrStops` (8) | Lúc viết prompt, `hrStops` chưa có lời vi/en; `bdab293` (cùng ngày 2026-10-21) thêm lời vi/en cho Hầm nên bản Nga làm luôn |
| Không đụng khóa `hrStops`; Tour Hầm làm sau, nhớ câu «это модель предлагаемого проекта, тоннель ещё не построен» | Đã làm trong `hrStops`; câu nhắc cùng ý nhưng từ ngữ khác | Mục 6 của prompt chỉ ghi lại để làm sau |
| 4 khóa | Hiện 8 khóa (63 clip) | Các khóa sau tới từ tính năng khác: `wxStorm` (`8c7ef9e`), `allStops` (`cd52a47`), `swStops` (`028dede`) |
| `voice-check`: "vi + en + ru, 4 tour, 28 điểm dừng mỗi ngôn ngữ" | Thông báo cuối hiện "vi + en + ru, 6 tour, 47 điểm dừng + 8 mốc kịch bản bão" | Test mở rộng theo các khóa mới |
| Báo cáo cuối: tổng thời lượng ru so với en, câu đã rút gọn, tên đã thêm trọng âm | Tổng thời lượng có ở mục 3 (đếm lại từ manifest). Không có ghi chép về câu đã rút gọn hay tên có trọng âm; `ru.json` không có U+0301 | Chưa đối chiếu lịch sử soạn lời |
| Nghe thử clip bằng tai (ưu tiên clip nhiều số liệu) | Không có bằng chứng đã nghe; chỉ kiểm thời lượng manifest (không clip dưới 4 s) | `tests/KET-QUA.md`: "giọng đọc nghe thật (headless chỉ kiểm file và thời lượng)" chưa có |

## 8. Kiểm tra
- `npm run build && npm run test:voice` (`tests/voice-check.mjs`): mỗi điểm dừng một clip mỗi ngôn ngữ, thời lượng manifest khớp thật (±0,3 s); đoạn bay đủ dài cho clip + 1,2 s; đổi sang `ru` phát `voice/ru/<khóa>-1.mp3`; bước 4 vẫn dùng `ja` làm ngôn ngữ chưa có giọng; không lỗi console.
- Kết quả gần nhất trong `tests/KET-QUA.md` (2026-10-24, GĐ8 Vòng quay): `test:voice` đạt (vi + en + ru, 6 tour, 47 điểm dừng + 8 mốc kịch bản bão mỗi ngôn ngữ). Ở `0a0b6be` thông báo của test còn ghi "4 tour, 28 điểm dừng" (chưa tính lại cho `hrStops`).
- `test:tour` đạt (dragon 8, tp 7, ttl 7, sh 6, hr 8, all 13, sw 6, storm 8).

## 9. Còn mở
- Thuyết minh cho ko, ja, zh, th, ar, hi (chưa lên kế hoạch; thêm ngôn ngữ: `scripts/narration/<mã>.json` + `VOICES` + `gen:voice`).
- Nghe thử giọng thật (vi, en, ru) cho mọi khóa; kiểm trọng âm, tên riêng Việt.
- `msedge-tts` là dịch vụ không chính thức: có thể đổi hoặc bị giới hạn; clip đã sinh vẫn dùng được.
- Giọng `ru` của `swStops` đã sinh ở `028dede`, chưa nghe (xem `activeContext.md`).
