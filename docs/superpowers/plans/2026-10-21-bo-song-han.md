# Hai bờ sông Hàn — Kế hoạch triển khai (đã hoàn thành)

> **Cho agent thực thi:** kế hoạch này ghi lại việc đã làm. Các mục `- [x]` đã xong. Việc còn lại ở cuối file.

**Mục tiêu:** Hai bờ sông Hàn gần cảnh thật: địa danh có thật, mặt dựng LED trái tim + "DN" trên Novotel và Vinpearl (đối đáp / đồng bộ), bảng quảng cáo thương hiệu hư cấu xen thông điệp du lịch, chi tiết dải đi bộ.

**Kiến trúc:** Module `src/environment/riverfront/` (`index`, `landmarks`, `heartFacade`, `adAtlas`, `billboards`, `promenade`, `clearance`); thông số ở `CONFIG.riverfront` (`riverfrontBase` trong `src/config.ts`); UI ở `src/ui/riverfrontUI.ts`. `buildRiverfront()` chạy sau `HanTunnel`, sau mọi `rand()`; nhà/cây bị đè được thu về scale 0; phần ngẫu nhiên mới dùng `rng(seed)` riêng. D-008: không dùng thương hiệu thật.

**Công nghệ:** Vite 6, TypeScript 5.9, three@0.165, không framework UI.

**Spec:** [2026-10-21-bo-song-han-design.md](../specs/2026-10-21-bo-song-han-design.md)

**Trạng thái:** Đã hoàn thành (merge f5e79a1, PR #2)

## Giai đoạn

### GĐ1: Toàn bộ riverfront trên nhánh `feature/riverfront`
Prompt gốc chia 9 bước (khảo sát; xác minh địa danh; config + dọn nhà; địa danh; mặt dựng trái tim; atlas + quảng cáo; chi tiết bờ; UI + góc nhìn + i18n; test + ảnh + tài liệu). Mã thật nằm trong MỘT commit, nên các việc dưới đây chung một mốc.
- [x] Khảo sát `config.ts`, `main.ts`, `environment/*`, `common/shaders.ts`, `common/math.ts`, `core/shared.ts`, `core/water.ts`, `bridges/song-han/SongHanBridge.ts`, `bridges/han-tunnel/corridor.ts`, `views/*`, `ui/*`, `i18n`, `tests/*.mjs`.
- [x] Xác minh số tầng/chiều cao (Novotel 37, Vinpearl 36 nổi + sky bar, Hành chính 34 tầng 166,8 m); ghi nguồn ở đầu `landmarks.ts`; tọa độ cảnh giữ `(ước lượng)`.
- [x] Khối `riverfrontBase` → `CONFIG.riverfront`; `clearance.ts` (`clearRects`, `snapshot`, `collectBuildings`) dọn nhà/cây bằng scale 0 cho cả level near và far của LOD.
- [x] `landmarks.ts`: Novotel, Vinpearl, Trung tâm Hành chính, Chợ Hàn, Bảo tàng Chăm, 3 khách sạn, Cầu Tình Yêu + cá chép hóa rồng, một mesh gộp, `patchWindows`.
- [x] `heartFacade.ts`: mặt nạ canvas (tim / DN / viền), shader lưới chấm LED, hoạt cảnh 24 s, Đối đáp / Đồng bộ qua `aPhase`, công tắc, `brightness()`.
- [x] `adAtlas.ts` (atlas 2048², 10 thương hiệu hư cấu, 5 thông điệp thành phố, 24 biển hiệu) và `billboards.ts` (pano, bảng nóc, màn LED đổi quảng cáo, băng rôn).
- [x] `promenade.ts`: lan can, ghế, bồn hoa, thùng rác, bến du thuyền, mái hiên + bảng hiệu, đèn quấn cây, đèn trái tim Cầu Tình Yêu; chunk 600 m dạng `THREE.LOD`.
- [x] `main.ts` gọi `buildRiverfront()` sau `HanTunnel` và `updateRiverfront()` trong `animate()`; `riverfront` trong `window.__app`.
- [x] Góc nhìn `rfHearts`, `rfBank`; nút và khối điều khiển trong `index.html`; `ui/riverfrontUI.ts`; `rfHearts` tự chuyển sang đêm.
- [x] i18n 7 khóa × 9 ngôn ngữ (`scripts/add-riverfront-locales.mjs`), README mục Hai bờ sông Hàn và Cấu trúc.
- [x] `tests/riverfront-check.mjs` + `npm run test:riverfront`.

Commit: `7003788` (2026-10-21).
Kiểm tra: `npm run build`; `npm run test:riverfront` (nhà bị dọn, hướng LED, bật/tắt 3 lần, ban ngày ≤ 5%, quảng cáo, ảnh chụp). Log ngày của lần chạy đầu chưa lưu trong repo (chưa đối chiếu).

### GĐ2: Giảm draw call riverfront
- [x] Bỏ `castShadow` của mesh địa danh (không tăng lượt vẽ bóng).
- [x] Bật lại frustum culling cho `rf-hearts` và `rf-led-screens`; tính bounding sphere cho `rf-night-lights` (thay `frustumCulled = false`).
- [x] Gộp khung/trụ thép của bảng vào mesh `rf-ad-boards`: UV trỏ ô xám sẫm của atlas (`darkUV()`), bỏ mesh `rf-ad-steel`.
- [x] `promenade.lod` 600 → 400 m (bóng/chi tiết dải đi bộ ẩn sớm hơn).

Commit: `a22095c` (2026-10-21).
Kiểm tra: `npm run test:drawcalls` (ghi trong `progress.md`; số trước/sau của riêng commit này chưa đối chiếu).

### GĐ3: Đo `rf*` trong `test:drawcalls` và merge
- [x] Thêm `rfHearts`, `rfBank` (cùng `hr*`) vào `VIEWS` của `tests/drawcalls.mjs`, tăng timeout, thêm `test:tour -- --only` (commit `92c8d34`, 2026-10-21; commit chung với hầm).
- [x] Merge nhánh `feature/riverfront` vào `main` qua PR #2 (`f5e79a1`, 2026-10-21; chung với Hầm, `prompts/bo-song-han.md`, `prompts/cau-rong.md` và thuyết minh tiếng Nga).
- [x] PR #4 (`0a29fb2`, 2026-10-21) merge lại nhánh `feature/riverfront` để đưa bộ hướng dẫn AI agent + memory bank (`.github/`, `AGENTS.md`, `CLAUDE.md`) vào `main`; không đổi file riverfront.

Kiểm tra: `test:riverfront`, `test:drawcalls` đạt (bảng `rfHearts` 278 / 277, `rfBank` 203 / 203 trong `tests/KET-QUA.md`); đạt lại ở các lần chạy bộ test về sau (GĐ8 thời tiết 2026-10-22, GĐ8 Vòng quay 2026-10-24, giao diện điện thoại 2026-10-27).

### GĐ4: Liên kết với tính năng sau
- [x] Vòng quay Mặt Trời dùng chung nhịp tim `HEART_BEAT_*`/`HEART_CYCLE` của `heartFacade.ts` cho LED đêm (commit `7755a3b`) và `clearRects` để dọn nền.
- [x] Thời tiết (D-012): `setAdsSuppressed()` tắt quảng cáo khi bão `closed`, trả đúng lựa chọn của người dùng khi hết bão (commit `1b39173`).

## Còn lại
- [ ] Xác minh tọa độ địa danh bằng Google Maps / OpenStreetMap, thay `(ước lượng)` trong `riverfrontBase`; ghi link nguồn vào đầu `landmarks.ts`.
- [ ] Sửa `tests/drawcalls.mjs` để trả ban ngày sau `rfHearts`, đo lại cột "ngày" của `rfBank` và các góc sau nó; cập nhật `tests/KET-QUA.md`.
- [ ] `test:drawcalls -- tests/original` để xác nhận ngân sách riverfront: góc cũ ≤ +10, `tpWater`/`tpDrive`/`hrGallery` chênh 0.
- [ ] Cân nhắc điểm dừng Tour (+ thuyết minh vi/en/ru) cho hai tòa trái tim.
- [ ] Đo FPS trên GPU thật / điện thoại thật.
