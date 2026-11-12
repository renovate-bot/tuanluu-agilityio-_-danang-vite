# Tech Context

## Ngăn xếp
| Thành phần | Phiên bản | Ghi chú |
|---|---|---|
| three | ^0.165.0 | Addons import từ `three/addons/...` |
| Vite | ^6.4 | `base: './'`; three tách chunk riêng (`manualChunks`) |
| TypeScript | ~5.9 | `strict: false`, `noUnusedLocals: true`; chỉ `src/` được typecheck |
| Playwright | ^1.56 | Chỉ cho test; cần `npx playwright install chromium` hoặc `CHROMIUM_PATH` |
| msedge-tts | ^2.1 | Sinh clip thuyết minh; dịch vụ không chính thức, có thể bị giới hạn |

Không framework UI: DOM thuần trong `index.html` + `src/ui/*`. CSS ở `src/styles/main.css`.

## Môi trường phát triển
- Windows, Git Bash/PowerShell. Repo lưu LF; git cảnh báo CRLF khi checkout — bình thường.
- Đường dẫn repo có dấu cách (`D:\2026 - Tuan\danang-vite`): luôn đặt trong ngoặc kép khi gọi lệnh.

## Kiểm thử
| Lệnh | Kiểm gì | Thời gian |
|---|---|---|
| `npm run typecheck` | Kiểu TS | vài giây |
| `npm run test:drawcalls -- [tests/original]` | Draw call 18 góc nhìn × ngày/đêm, so bản gốc | 10–20 phút |
| `npm run test:tour -- [tests/original]` | 5 Tour: chú thích, đường bay, quay cầu, mặt cắt + dìm | 10–20 phút |
| `npm run test:tunnel` | Trắc dọc hầm, mặt cắt bật/tắt, mắt thích nghi, dìm; ảnh vào `tests/screens/` | 10–20 phút |
| `npm run test:riverfront` | Dọn nhà, hướng mặt LED (không lật gương), bật/tắt đèn trái tim + quảng cáo không rò rỉ, độ sáng ngày ≤ 5% | 10–20 phút |
| `npm run test:voice` | Clip mp3 tồn tại, thời lượng khớp manifest | vài phút |

Tất cả test (trừ typecheck) đọc `dist/` → `npm run build` trước. Chromium chạy SwiftShader (CPU), khung 480×270 hoặc 960×540.

## Script phụ trợ
- `scripts/gen-narration.mjs`: `scripts/narration/<lang>.json` → `public/voice/<lang>/<khóa>-<i>.mp3` + `manifest.json` (thời lượng + hash; chỉ sinh lại clip đổi). Giọng ở hằng `VOICES` (hiện có vi, en, ru).
- `scripts/add-tunnel-locales.mjs`, `scripts/add-tunnel-narration.mjs`: script chạy một lần để chèn khóa hầm vào 9 locales / narration. Mẫu tốt để chèn hàng loạt khóa i18n cho tính năng mới.

## Giới hạn
- Bundle three ~ lớn → `chunkSizeWarningLimit: 900`.
- Không có CI; kiểm tra chạy tay trên máy dev.
- Tài nguyên ngoài trong repo: mp3 thuyết minh (`public/voice/`), mô hình + texture người Rocketbox (`public/people/`). Thêm mô hình / texture ngoài khác được phép theo điều kiện của D-033 (giấy phép, ghi nguồn, trần dung lượng, đường lùi).
