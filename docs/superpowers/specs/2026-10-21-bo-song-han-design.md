# Hai bờ sông Hàn — Thiết kế
_2026-10-21 · Trạng thái: Đã xây (merge f5e79a1, PR #2; PR #4 chỉ mang bộ hướng dẫn agent từ cùng nhánh) · Prompt gốc: prompts/bo-song-han.md tại c418f92_

Đọc lại bản prompt cũ: `git show c418f92:prompts/bo-song-han.md`. Tài liệu này mô tả cái ĐÃ XÂY, đối chiếu với `src/environment/riverfront/`, `src/ui/riverfrontUI.ts`, `CONFIG.riverfront` trong `src/config.ts` và `tests/riverfront-check.mjs`.

## 1. Mục đích và lý do
- Làm hai bờ sông Hàn **gần cảnh thật** hơn: trước đó chỉ có hộp đất, kè đá, dải lát gạch (`environment/river.ts`), nhà hộp ngẫu nhiên (`city.ts`) và cây/đèn đường (`trees.ts`).
- Bốn việc: (1) dựng lại địa danh có thật ven sông; (2) chọn một tòa cao tầng mỗi bờ để chiếu LED trái tim và chữ "DN" (Novotel Danang Premier Han River bờ Tây, Vinpearl Condotel Riverfront bờ Đông); (3) bảng quảng cáo như phố thật, thương hiệu hư cấu xen thông điệp du lịch; (4) chi tiết đời thường trên bờ.
- Thứ tự ưu tiên của prompt khi thiếu thời gian: **P1** địa danh + mặt dựng trái tim, **P2** quảng cáo, **P3** chi tiết bờ. Cả ba đã xây.
- Không làm hỏng cái đang có: bốn cầu, hầm, vị trí nhà/cây/xe (chuỗi `rand()` có seed), draw call các góc nhìn cũ, các test cũ.
- Quyết định liên quan: D-008 (không dùng thương hiệu thật; tòa thật dựng khối, không logo).

## 2. Phạm vi: có / không có
Có:
- Địa danh gộp một mesh (`landmarks.ts`): Novotel, Vinpearl, Trung tâm Hành chính, Chợ Hàn, Bảo tàng Điêu khắc Chăm, 3 khách sạn ven Trần Hưng Đạo, Cầu Tình Yêu + tượng cá chép hóa rồng.
- Mặt dựng LED trái tim + "DN" (`heartFacade.ts`), hai chế độ Đối đáp / Đồng bộ, công tắc "Đèn trái tim".
- Atlas canvas 2048 × 2048 và bốn loại bảng (`adAtlas.ts`, `billboards.ts`), công tắc "Quảng cáo".
- Dải đi bộ (`promenade.ts`): lan can kè, ghế đá, bồn hoa, thùng rác, bến du thuyền (bờ Tây gần Cầu Rồng), mái hiên + bảng hiệu cửa hàng tầng trệt, đèn LED quấn cây dọc Bạch Đằng, đèn trái tim Cầu Tình Yêu.
- Dọn nhà/cây/cột đèn bị đè bằng scale 0 sau khi cảnh dựng (`clearance.ts`).
- Hai góc nhìn `rfHearts`, `rfBank`; i18n 9 ngôn ngữ; `test:riverfront`.

Không có (xem mục 7, 9):
- Điểm dừng riêng trong Tour (prompt ghi "không bắt buộc"; không thêm, nên không đổi `scripts/narration/*.json`, không `gen:voice`).
- Logo thật của bất kỳ thương hiệu nào (cố ý). Bảng tên trên nóc hai tòa trái tim: không có.
- Danh sách link nguồn đầy đủ (chỉ còn tên nguồn ở đầu `landmarks.ts`, mục 3).

## 3. Thông số đã dùng
Mọi số nằm trong `riverfrontBase` (`src/config.ts`), xuất ra `CONFIG.riverfront`. Đơn vị mét, trừ khi ghi khác. Hệ tọa độ: X Tây → Đông, −Z là Bắc, mặt nước y = 0, `landY` 2,5, mép kè |x| = 262 (`CONFIG.bankX`), đường Bạch Đằng / Trần Hưng Đạo x = ∓299, hàng nhà đầu tiên từ |x| ≈ 330, hành lang Hầm |z + 1700| < 30.

**Địa danh — số tầng/chiều cao có nguồn công khai (tra 2026-10, ghi ở comment đầu `landmarks.ts`):**

| Công trình | Số liệu | Nguồn (như ghi trong `landmarks.ts`) | Khóa |
|---|---|---|---|
| Novotel Danang Premier Han River (36 Bạch Đằng) | 37 tầng | duytan.edu.vn/conferences, banahillsgolf.com | `novotel.floors` 37 |
| Vinpearl Condotel Riverfront (nay Meliá Vinpearl Danang Riverfront, 341 Trần Hưng Đạo) | 36 tầng nổi + sky bar (mã dùng 37) | vinpearl.com, mia.vn | `vinpearl.floors` 37 |
| Trung tâm Hành chính Đà Nẵng (24 Trần Phú) | 34 tầng nổi, 166,8 m, mô phỏng ngọn hải đăng | plo.vn, giaoduc.net.vn | `admin.h` 166,8 |

Prompt gợi ý Novotel ≈ 37 tầng ≈ 150 m, Hành chính 166 m / 34 tầng dáng "bắp ngô", Vinpearl "35–40 tầng, cần xác minh"; số trên là kết quả xác minh.

**Tọa độ trong cảnh là ước lượng** (chưa có nguồn công khai; comment đầu `landmarks.ts` nói rõ):

| Thông số | Giá trị | Khóa |
|---|---|---|
| Chiều cao một tầng | 3,8 m (ước lượng) | `floorH` |
| Novotel | x −352, z −1150, 38 × 38 m; mặt chính quay +X | `novotel` |
| Vinpearl | x 352, z −1150, 40 × 40 m; mặt chính quay −X; thân bậc thụt | `vinpearl` |
| Trung tâm Hành chính | x −470, z −1230; bán kính chân/đỉnh thân 17 / 9 m (ước lượng) | `admin` |
| Chợ Hàn | x −366, z −500, 64 × 48 m, cao 13 m (3 tầng), mặt tiền +X | `market` |
| Bảo tàng Điêu khắc Chăm | x −376, z 110, 54 × 36 m, cao 9 m, tường vàng đất, mái ngói chóp | `museum` |
| Cầu Tình Yêu | z −78, dài 38 m, rộng 6 m, nhô ra từ kè Đông | `love` |
| 3 khách sạn ven Trần Hưng Đạo | (372, −420) 22 tầng; (372, −660) 17 tầng; (374, −880) 25 tầng | `hotels` |
| Lề dọn nhà quanh chân công trình | 4 m | `clearMargin` |

**Mặt dựng LED (`CONFIG.riverfront.heart`):**

| Thông số | Giá trị | Khóa |
|---|---|---|
| Chu kỳ hoạt cảnh | 24 s (4 giai đoạn × 6 s) | `cycle` |
| Biên độ tim đập | 8% (đủ ở giai đoạn 1, còn 40% ở giai đoạn 2, 0 sau đó) | `beat`, `HEART_STAGE_GLSL` |
| Ô LED | 0,8 m | `cell` |
| Bề rộng tấm / tỉ lệ chiều cao phủ | 34 m / 0,66 (≈ 2/3 chiều cao tòa) | `panelW`, `panelFrac` |
| Khe so với mặt kính | 0,08 m (prompt: 0,05–0,1) | `gap` |
| Độ sáng ban ngày so với ban đêm | 0,04 (prompt: ≤ 5%) | `dayLevel` |
| Cường độ LED | 1,7 | `intensity` |
| Lệch pha chế độ Đối đáp | 12 s (nửa chu kỳ) | `duetOffset` |
| Màu | hồng đỏ `#ff2a55` → `#ff7aa8` theo độ cao, chữ DN trắng ấm | trong shader `frag` |

**Quảng cáo và dải đi bộ:**

| Thông số | Giá trị | Khóa |
|---|---|---|
| Pano trụ đơn / bảng nóc / màn LED / băng rôn (ô atlas) | 8 / 5 / 3 / 16 (prompt: 6–10 / 4–6 / 2–3 / mỗi 2–3 cột một băng; README ghi ~100 băng rôn instance) | `ads.panos, roofs, screens, banners` |
| Màn LED đổi quảng cáo | mỗi 8 s, chuyển mờ 0,6 s | `ads.switchEvery`, `ads.fade` |
| Atlas | 2048 × 2048 px, ô theo loại: pano 8, screen 6, roof 8, banner 16, shop 24, landmark 2 | `ATLAS`, `layoutSlots()` |
| Chunk dải đi bộ | 600 m, mỗi chunk một `THREE.LOD` | `promenade.chunk` |
| Ẩn chi tiết dải đi bộ khi camera xa hơn | 400 m (lúc đầu 600 m, đổi ở `a22095c`) | `promenade.lod` |
| Bước ghế / lan can | 20 m / 4 m | `benchStep`, `railStep` |
| Đèn quấn cây | 8 (tham số `lights`) | `promenade.lights` |
| Seed ngẫu nhiên riêng | `rng(5150)` (dải đi bộ) | trong `promenade.ts` |

Thương hiệu hư cấu đã dùng (comment đầu `adAtlas.ts`, đã rà để không trùng tên thật): Cà phê Hàn Giang, Bia Sóng Biển, Ngân hàng Sông Xanh, Hàng không Hải Âu, Nước mắm Cửa Biển, Nhà Bên Sông (thay "Bất động sản Sơn Thuỷ Riverside" của prompt), Điện máy Mặt Trời Mới, Sữa Mây Trắng, Ốc Đảo Travel, Bánh kẹo Cồn Nổi. Thông điệp thành phố (đúng như prompt): "LỄ HỘI PHÁO HOA QUỐC TẾ ĐÀ NẴNG – DIFF", "ĐÀ NẴNG – THÀNH PHỐ ĐÁNG SỐNG", "Khám phá Bán đảo Sơn Trà", "Ngũ Hành Sơn – Danh thắng quốc gia", "Xem Cầu Rồng phun lửa – 21h tối thứ Bảy, Chủ nhật". Băng rôn: DIFF PHÁO HOA, CHÀO NĂM MỚI, ĐÀ NẴNG ĐÁNG SỐNG… Biển hiệu cửa hàng: 24 tên hư cấu (`SHOPS`); biển địa danh "CHỢ HÀN", "BẢO TÀNG ĐIÊU KHẮC CHĂM".

**Vị trí pano** (`PANOS` trong `billboards.ts`, 8 chỗ, ước lượng): (−900, 27), (−1250, −27), (−620, 27), (800, −27), (1100, 27) dọc trục X; (316, −300), (316, 520), (−316, 640) dọc trục Z.

## 4. Hình dạng, hành vi như đã xây
Module không phải công trình, không kế thừa `BridgeBase` (mẫu trong `systemPatterns.md`): `index.ts` giữ đối tượng `current`, export `buildRiverfront()`, `updateRiverfront(dt, time)`, `setHeartsEnabled()`, `setHeartsMode()`, `setAdsEnabled()`, `setAdsSuppressed()`, `disposeRiverfront()`, `getRiverfront()`.

- **Thứ tự dựng** (`buildRiverfront`): atlas → địa danh → hợp các chân (`landmarks.rects` + `panoRects()`) → `clearRects(footprints, clearMargin)` → `collectBuildings()` (nhà còn lại, để chọn mái/mặt tiền/cửa hàng) → trái tim → bảng quảng cáo → dải đi bộ → thêm vào `scene`.
- **`landmarks.ts`**: một `mesh` `rf-landmarks` vật liệu màu đỉnh + `patchWindows` (cửa sổ sáng đêm); mỗi tòa có bệ thương mại, dải chia tầng mỗi 6 tầng, vương miện, ăng-ten. Hành chính dựng bằng `loftOct`, đỉnh đèn hải đăng. Cầu Tình Yêu có cọc, lan can, khóa tình yêu, tượng cá chép trắng (`taperedTube`). Xuất `towers` (cho trái tim), `rects` (chân để dọn), `rooftops` (mái khách sạn cho bảng nóc). Không `castShadow` (sau `a22095c`).
- **`heartFacade.ts`**: một canvas mặt nạ (R tim đặc, G chữ "DN" font `Arial Black`, B viền tim), vẽ theo mét (8 px/m) để tim không méo; fragment shader riêng (`ShaderMaterial`): lưới chấm LED, hoạt cảnh theo `shared.uTime` và độ sáng theo `shared.uNight`. Hai tấm gộp **một mesh** `rf-hearts`; pha từng tấm là attribute `aPhase` (Vinpearl lệch `duetOffset` ở Đối đáp, 0 ở Đồng bộ). Mặt phẳng quay `±π/2` để pháp tuyến +X (Novotel) / −X (Vinpearl); trục U luôn chạy sang phải người nhìn từ sông (`uAxis = (0,0,−face)`). Bốn giai đoạn: tim đập (hai nhịp gần nhau rồi nghỉ, `HEART_BEAT_GLSL`); chữ DN quét trái → phải; tim bọc DN, viền chạy sáng; lấp lánh rồi tắt dần. `brightness(night)` = `lerp(dayLevel, 1, night)·uOn`; `uOn` tiến mượt về 0/1 theo công tắc. Xuất `HEART_BEAT_PERIOD`, `HEART_BEAT_GLSL`, `HEART_STAGE_GLSL`, `HEART_CYCLE` cho Vòng quay Mặt Trời dùng (mục 7).
- **`adAtlas.ts`**: atlas `CanvasTexture` 2048², một texture/một vật liệu cho mọi bảng; chữ có dấu vẽ bằng `"Be Vietnam Pro","Segoe UI",Arial`; có một ô xám sẫm (`darkUV()`) để khung/trụ thép dùng chung vật liệu. Quảng cáo không đổi theo i18n (ngoài đời bảng ở Đà Nẵng ghi tiếng Việt).
- **`billboards.ts`** (ngẫu nhiên riêng `rng(8812)`, dòng 37): pano, bảng nóc, băng rôn, khung thép gộp vào **một mesh** `rf-ad-boards` (vật liệu atlas, emissive = map × `uNight`); màn LED mặt tiền là mesh riêng `rf-led-screens` với shader chuyển mờ giữa hai ô atlas. Cả hai `layers.set(1)` (không vào lượt phản chiếu nước). `update(dt)` đổi quảng cáo; `setEnabled(on)` ẩn cả nhóm. Không đặt bảng lên hành lang Hầm.
- **`promenade.ts`**: chia 2 bờ × chunk 600 m, mỗi chunk một `THREE.LOD` (mesh đồ vật màu đỉnh + mesh bảng hiệu atlas), mọi con `layers.set(1)`; ghế đá, bồn hoa, thùng rác nằm trên dải |x| ≈ 265–269 (ghế `B + 4,5`, bồn `B + 7`, thùng `B + 3`, `B` = mép kè; prompt: dải 264–288 m), lặp mỗi `benchStep` 20 m, tránh chân cầu và cầu tàu qua `blocked()`; bến du thuyền bờ Tây tại z ≈ 104 (phao nổi, cầu dẫn, mái che, thuyền neo); vùng cấm đặt đồ vật (`blocked()`): chân Cầu Rồng (|z| < 34), Cầu sông Hàn, Trần Thị Lý, hành lang Hầm. Đèn LED quấn cây `rf-night-lights` là một `InstancedMesh` hiện về đêm; cây bờ Tây lấy từ instance `MAT.leaf`/`MAT.palm` trong cảnh. Ngẫu nhiên: `rng(5150)`.
- **`clearance.ts`**: `clearRects()` gán ma trận scale 0 cho instance đè lên chân công trình (+ lề), xử lý **cả level near lẫn far** của `THREE.LOD` nhà, và cây/đèn (`MAT.trunk, leaf, palm, lampPole, bulb`, hộp 1,5 m). Lưu `snapshot` (Map mesh → ma trận gốc) trước khi dọn để test so sánh. Dùng lại bởi Vòng quay Mặt Trời (`bridges/sun-wheel/SunWheel.ts`).
- **Thứ tự trong `main.ts`**: `buildRiverfront()` ngay sau `new HanTunnel()`, rồi `new SunWheel()`, rồi `buildWeather()`; `updateRiverfront(dt, time)` trong `animate()`; `riverfront` có trong `window.__app`.

## 5. Tương tác, UI, i18n, thuyết minh
- Góc nhìn trong `VIEWS` (`src/views/presets.ts`): `rfHearts` pos [0, 45, −640] nhìn target [0, 80, −1150] (thấy hai tòa trái tim); `rfBank` pos [−268, 4,3, −935] nhìn target [−352, 50, −1150], `maxPolar` 0,97π (đi bộ ven Bạch Đằng nhìn Novotel). Hai nút `data-view="rfHearts"`, `data-view="rfBank"` nằm trong nhóm góc nhìn Cầu Rồng (`index.html`).
- Chọn `rfHearts` tự chuyển sang đêm: `setupUI.ts` đặt `dayNight.target = 1`, thanh trượt 100.
- Khối điều khiển: nút `#btnRfHearts` ("Đèn trái tim"), ô chọn `#rfHeartsMode` (Đối đáp mặc định / Đồng bộ), nút `#btnRfAds` ("Quảng cáo"); nối trong `src/ui/riverfrontUI.ts` (`setupRiverfrontUI`), gọi từ `setupUI.ts`.
- i18n 7 khóa × 9 ngôn ngữ (`vi, en, ko, ja, zh, th, ar, hi, ru`): `vRfHearts`, `vRfBank`, `rfHearts`, `rfHeartsMode`, `rfHeartsDuet`, `rfHeartsSync`, `rfAds` (`scripts/add-riverfront-locales.mjs`). `ar` theo RTL chung của dự án.
- Thuyết minh: không có (không thêm điểm Tour). Quảng cáo trên bảng không đi qua i18n.

## 6. Ràng buộc đã tuân thủ
- **Chuỗi `rand()`**: không sửa `city.ts`; `buildRiverfront()` chạy sau mọi lệnh dùng `rand`; phần ngẫu nhiên mới dùng `rng(seed)` riêng. Nhà không bị dọn giữ nguyên ma trận (test).
- **Dọn bằng scale 0**: cả level `near` lẫn `far` của LOD (mẫu `hideBankTrees()`, `corridor.ts`). Lần chạy gần nhất ghi 204/7934 instance nhà ở trạng thái scale 0 (`tests/KET-QUA.md`).
- **Đèn**: không thêm `PointLight`/`SpotLight`; đèn rọi bảng và LED bằng emissive/shader, đọc `shared.uNight`.
- **Texture**: mọi texture vẽ bằng canvas (mặt nạ trái tim, atlas); không thêm ảnh ngoài, không thêm thư viện.
- **Không logo/thương hiệu thật** (D-008): tòa thật chỉ có khối; tên hư cấu đã rà.
- **Phản chiếu**: địa danh và mặt LED không đặt layer 1 nên có trong phản chiếu mặt nước (cảnh đẹp nhất ban đêm); bảng quảng cáo, chi tiết dải đi bộ, đèn quấn cây đặt `layers.set(1)`.
- **Draw call** (số của prompt: góc cũ tăng ≤ +10; các góc không thấy đoạn sông giữa Trần Thị Lý và Cầu sông Hàn, ví dụ `tpWater`, `tpDrive`, `hrGallery`, chênh 0): gộp địa danh một mesh, hai tấm LED một mesh, bảng + khung thép một mesh, màn LED một mesh, dải đi bộ theo chunk LOD. `a22095c` giảm thêm: bỏ `castShadow` của địa danh; bật lại frustum culling cho `rf-hearts`, `rf-led-screens` (bỏ `frustumCulled = false`) và tính bounding sphere cho `rf-night-lights`; gộp mesh thép (`rf-ad-steel`, vật liệu `MAT.girder`) vào `rf-ad-boards` bằng UV trỏ ô xám của atlas; `promenade.lod` 600 → 400 m. Số hiện tại (`tests/KET-QUA.md`, ngày/đêm): `rfHearts` 278 / 277, `rfBank` 203 / 203 (cột "ngày" của `rfBank` thực ra đo ban đêm, xem mục 9). Số trước/sau của `a22095c` và độ lệch so với bảng 2026-10-20 cho từng góc cũ: (chưa đối chiếu, không có log trong repo).
- **`disposeRiverfront()`** giải phóng geometry, material, `CanvasTexture`.
- **"Phương án đề xuất"**: không áp dụng (đây là cảnh thực tế hiện hữu).

## 7. Khác so với ý định ban đầu
- Tên thương hiệu: "Bất động sản Sơn Thuỷ Riverside" → "Nhà Bên Sông" (rà tên trùng, comment đầu `adAtlas.ts`); thêm "Ốc Đảo Travel", "Bánh kẹo Cồn Nổi".
- Số tầng Novotel/Vinpearl 37 theo nguồn tra được (prompt "~37" và "35–40, cần xác minh").
- Độ sáng LED ban ngày: `dayLevel` 0,04 (README ghi 4%), thỏa "≤ 5%" của prompt.
- Băng rôn: cấu hình `banners: 16` là số ô atlas khác nhau; số instance thực ~100 (README), không tính theo "mỗi 2–3 cột đèn một băng" một cách chính xác (chưa đối chiếu).
- `rfHearts` đặt camera ở y = 45 (trên cao, giữa hai tòa), không "trên mặt sông" như prompt; việc Cầu sông Hàn nằm phía sau trong khung hình chưa đối chiếu lại.
- Không thêm điểm dừng vào Tour Cầu Rồng (prompt: không bắt buộc) nên không có thuyết minh riêng cho riverfront.
- Link nguồn: prompt yêu cầu ghi link trong báo cáo và comment đầu `landmarks.ts`; comment chỉ có tên miền/tên báo, không có đường dẫn đầy đủ.
- Báo cáo "draw call trước/sau" theo prompt không được lưu thành tài liệu; thay bằng bảng `now` trong `tests/KET-QUA.md` (không có cột "trước").
- Thêm ngoài prompt: nhịp tim dùng chung (`HEART_BEAT_*`, `HEART_CYCLE`) để Vòng quay Mặt Trời đồng bộ LED đêm (commit `7755a3b`, D-014/D-016/D-017 của Vòng quay); `clearRects` được dùng lại để dọn nền Vòng quay.
- Thêm ngoài prompt: `setAdsSuppressed()` — thời tiết (D-012, commit `1b39173`) tắt quảng cáo tạm thời khi `closed` (bão), hết bão trả đúng lựa chọn của người dùng (`adsWanted`), không ép bật. Đèn trái tim không bị tắt khi bão.
- Prompt dặn làm trên nhánh mới `feature/riverfront`; nhánh đó thực tế mang cả Hầm (commit `bdab293`), riverfront (`7003788`, `a22095c`) và Nga hóa thuyết minh, nên PR #2 gộp chung. PR #4 là lần merge thứ hai của cùng nhánh, chỉ mang `.github/`, `AGENTS.md`, `CLAUDE.md` (không đổi file riverfront).
- Tên đường trên pano: prompt đặt pano "dọc Nguyễn Văn Linh, Võ Văn Kiệt, Trần Hưng Đạo, gần đầu cầu"; mã chỉ đặt 8 chỗ theo tọa độ (`PANOS`, mục 3), không gắn tên đường (chưa đối chiếu từng chỗ với đường thật).
- Băng rôn lễ hội: nội dung "LỄ HỘI PHÁO HOA QUỐC TẾ ĐÀ NẴNG – DIFF", "CHÀO NĂM MỚI" đã có trong `adAtlas.ts` (dòng 25, 29, 31).
- Thuyền Tour không được đâm xuyên phao bến du thuyền (prompt, mục 4): mã riverfront không có vùng tránh thuyền cho bến này (chưa làm / chưa đối chiếu bằng test; chỉ Hầm có `boatKeepOut`).

## 8. Kiểm tra
- `npm run test:riverfront` → `tests/riverfront-check.mjs`. Các nhóm: (1) không nhà ngẫu nhiên nào còn hiện mà chân đè địa danh, nhà không bị dọn giữ nguyên ma trận, có dọn ít nhất một nhà; (2) pháp tuyến mặt LED Novotel +X, Vinpearl −X, trục U sang phải người nhìn từ sông (không lật gương); (3) tắt/bật "Đèn trái tim" ba lần: `uOn` về 0 rồi về 1, hoạt cảnh chạy tiếp, `renderer.info.memory` (geometry, texture) không đổi; (4) độ sáng ban ngày/đêm ≤ 5%, Đối đáp lệch 12 s, Đồng bộ cùng pha; (5) quảng cáo: atlas 2048, đủ số lượng (pano ≥ 6, bảng nóc ≥ 4, màn LED ≥ 2, băng rôn ≥ 10), màn LED đổi sau 10 s, không bảng nào đè hành lang hầm, công tắc ẩn được; (6) ảnh chụp ngày/đêm `rfHearts, rfBank, overview, shOverview, bird` vào `tests/screens/` (bỏ bằng `--no-shots`); (7) không lỗi console.
- `npm run test:drawcalls`: `rfHearts`, `rfBank` có trong `VIEWS` (commit `92c8d34`, kèm `hr*`).
- Kết quả gần nhất: `tests/KET-QUA.md` ghi `test:riverfront` đạt (204/7934 nhà scale 0; bộ nhớ GPU 114,14 → 114,14). Đạt lại trong các lần chạy bộ test của thời tiết GĐ8, Vòng quay GĐ8, tối ưu độ mượt, giao diện điện thoại (`progress.md`).

## 9. Còn mở
- **Tọa độ địa danh là ước lượng** (chưa có nguồn công khai); số tầng/chiều cao đã có nguồn. Chưa xác minh bằng Google Maps/OpenStreetMap theo từng vị trí.
- Link nguồn đầy đủ chưa ghi vào `landmarks.ts`.
- Không có điểm Tour riêng cho riverfront, không thuyết minh.
- Cột "ngày" của `rfBank` trong `tests/KET-QUA.md` thực ra đo ban đêm: bấm `rfHearts` đặt `dayNight.target = 1` và `tests/drawcalls.mjs` không trả lại ban ngày cho các góc sau đó (có từ bảng riverfront; đề xuất sửa + đo lại, `activeContext.md`).
- Chưa đo lại ngân sách "góc cũ ≤ +10, `tpWater`/`tpDrive`/`hrGallery` chênh 0" bằng `test:drawcalls -- tests/original` riêng cho riverfront (chưa đối chiếu).
- Chưa kiểm FPS GPU thật; ảnh tự xem soát ban đầu (chữ DN đúng chiều, không z-fighting, bloom không cháy) không còn log trong repo (chưa đối chiếu).
