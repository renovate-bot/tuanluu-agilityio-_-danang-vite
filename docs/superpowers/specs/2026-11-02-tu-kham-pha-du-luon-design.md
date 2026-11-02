# Thiết kế: Tự khám phá bằng dù lượn (WASD)

_Ngày: 2026-11-02 · Nhánh dự kiến: `feature/explore` · Trạng thái: chờ duyệt_

## 1. Ý định

Hiện người xem chỉ quan sát thành phố qua góc nhìn đặt sẵn, Tour có thuyết minh hoặc xoay camera quanh một điểm. Người dùng muốn thêm cách **tự khám phá**: tự lái bằng bàn phím, đi tới đâu tùy ý, và ngắm các cây cầu như đang ở trong thành phố.

Về lâu dài có bốn phương tiện: dù lượn, ô tô, xe máy, đi bộ. **Đợt này chỉ làm dù lượn**: cất cánh từ đỉnh Sơn Trà và bay tự do quanh thành phố.

Đây là một **lựa chọn thêm**, không thay bản hiện tại. Cả hai bản dùng chung một cảnh 3D để mỗi lần sửa cầu, thời tiết hay ánh sáng chỉ phải làm một lần.

## 2. Mục tiêu

1. **Màn chọn phương tiện** hiện **mỗi lần** vào trang, gồm:
   - **Dù lượn**: chọn được.
   - **Ô tô**, **Xe máy**, **Đi bộ**: mờ, ghi "Sắp có", không bấm được.
   - **Tham quan có hướng dẫn**: vào giao diện hiện tại y như cũ (orbit, chọn cầu, góc nhìn, Tour, thời tiết…).
2. **Chế độ dù lượn**:
   - Cất cánh trên đỉnh Sơn Trà, hướng mặc định nhìn về cửa sông / Cầu Thuận Phước.
   - Tốc độ **cố định**, không tăng, không giảm. Dù luôn tự bay về phía trước.
   - **A/D** (và ←/→): rẽ trái/phải. Dù nghiêng (bank) theo hướng rẽ.
   - **W/S** (và ↑/↓): lên cao/xuống thấp. W là lên, theo trực giác người dùng phổ thông, không theo kiểu cần lái máy bay.
   - Thả phím thì dù tự cân bằng và bay thẳng.
   - **Không va chạm**: bay xuyên cầu, nhà, tháp, mặt đất cũng được, chỉ bị giới hạn bởi sàn và trần độ cao.
   - Có **sàn** và **trần** độ cao. Tới gần ranh giới vùng bay thì dù **tự vòng về** một cách êm, không có tường vô hình làm khựng lại.
   - Camera **góc nhìn thứ ba**: đặt sau và hơi cao hơn dù, bám theo mượt và trễ một chút khi dù rẽ.
   - Chỉ ngắm cảnh. **Không** hiện tên cầu, chú thích hay thuyết minh khi bay.
3. **Giao diện khi bay**: ẩn toàn bộ giao diện cũ. Chỉ giữ:
   - nút sáng/tối (`#btnNight`)
   - ô ngôn ngữ (`#langSelect`)
   - ô chất lượng đồ họa (`#qualitySel`)
   - một dòng hướng dẫn phím
   - nút **Thoát** (và phím Esc) để về màn chọn (tải lại trang, xem §6 #16).
4. Cảnh vẫn sống động như cũ: xe, thuyền, LED, Vòng quay tự quay, chu kỳ ngày/đêm theo nút.

## 3. Không làm (đợt này)

- Điện thoại / cảm ứng. Trên máy không có chuột, thẻ Dù lượn mờ và ghi "Chỉ dùng trên máy tính"; mục "Tham quan có hướng dẫn" vẫn dùng bình thường.
- Ô tô, xe máy, đi bộ (chỉ có thẻ "Sắp có").
- Tăng/giảm tốc.
- Va chạm, rơi, hạ cánh, điểm số, nhiệm vụ.
- Chữ, nhãn, thuyết minh khi bay.
- Dựng lại núi Sơn Trà. Hiện đó chỉ là khối nón phông nền, chấp nhận nhìn thô lúc cất cánh.
- Thời tiết, kịch bản bão, ngồi cabin Vòng quay, âm thanh trong chế độ bay: không có nút trong chế độ bay. Thời tiết giữ trạng thái `now`.

## 4. Phản mục tiêu (làm ra mà dính những điều này là hỏng)

- Bản "Tham quan có hướng dẫn" khác đi so với bây giờ: hành vi, vị trí nhà/cây/xe, số draw call ở các góc nhìn cũ.
- Bộ test hiện có phải sửa để qua. Đây là dấu hiệu đã đụng vào phần cũ.
- Điều khiển khó, ví dụ ngược tay hoặc dù chúi đầu khi thả phím, làm người không chơi game bỏ cuộc.
- Người dùng lạc ra vùng trống ngoài thành phố rồi không biết đường về.

## 5. Ràng buộc (từ `.github/copilot-instructions.md`)

- **Seed:** không đổi thứ tự `build*()` trong `src/main.ts`, không thêm/bớt lời gọi `rand()` trong code cũ. Mọi thứ mới dựng **sau** các lệnh dùng `rand`; nếu cần ngẫu nhiên thì dùng `rng(seed)` riêng.
- **Draw call:** góc nhìn cũ chênh **0** so với `tests/KET-QUA.md`. Màn chọn là lớp phủ HTML, không thêm gì vào cảnh. Mô hình dù chỉ được thêm vào scene (hoặc chỉ hiện) khi đang bay.
- **Thông số** (tốc độ, tốc độ rẽ, tốc độ lên/xuống, góc nghiêng, sàn/trần, ranh giới, điểm cất cánh, khoảng cách camera) nằm trong `CONFIG.explore` ở `src/config.ts`. Mỗi dòng có chú thích tiếng Việt, đơn vị, `(ước lượng)`.
- **i18n:** mọi chuỗi mới có đủ 9 ngôn ngữ `vi,en,ko,ja,zh,th,ar,hi,ru`; `ar` là RTL. Làm theo mẫu `scripts/add-*-locales.mjs`.
- **Không thêm thư viện, không thêm ảnh/mô hình ngoài.** Dù dựng bằng hình học three, màu bằng vertex color hoặc canvas. Không thêm `PointLight`/`SpotLight`; đèn đêm trên cánh dùng emissive và đọc `shared.uNight`.
- Comment tiếng Việt, khối `/* ===== ... ===== */`, tiền tố hàm `ex*`, phong cách "một dòng một ý".
- Có `?test` thì **bỏ qua màn chọn** và vào thẳng giao diện cũ như hiện nay, để mọi `test:*` chạy y như cũ.

## 6. Đã quyết

| # | Điều | Ai quyết |
|---|---|---|
| 1 | Thêm lựa chọn trên cùng một trang, không tách website riêng | Người dùng (theo đề xuất của agent) |
| 2 | Màn chọn hiện mỗi lần vào trang (trừ `?test`) | Người dùng |
| 3 | Chỉ hỗ trợ máy tính đợt này | Người dùng |
| 4 | Tốc độ cố định | Người dùng |
| 5 | Bay xuyên vật thể, không va chạm | Người dùng |
| 6 | Không hiện chữ/thuyết minh khi bay | Người dùng |
| 7 | Góc nhìn thứ ba từ phía sau | Người dùng |
| 8 | Khi bay chỉ giữ sáng/tối, ngôn ngữ (+ chất lượng) | Người dùng (chất lượng: agent thêm vì bay cao thấy cả thành phố) |
| 9 | Phương tiện là **dù lượn** (cánh vòm, người treo bên dưới), vì Sơn Trà thật có điểm bay dù lượn | Agent |
| 10 | W lên, S xuống; thả phím tự cân bằng | Agent |
| 11 | Tốc độ ≈ 25 m/s (ước lượng, không thực tế; dù thật ≈ 10 m/s) để Sơn Trà → Thuận Phước ≈ 1,5 phút | Agent |
| 12 | Sàn/trần xem #17; điểm cất cánh = đỉnh nón Sơn Trà chính `(2600, ≈682, −4700)` trong `src/environment/mountains.ts` | Agent |
| 13 | Ranh giới: vùng có nhà cửa và công trình — nhà ở x −2000…1450, z −1800…1800; Thuận Phước z −2900; Vòng quay z +2280; cộng thêm phần chứa điểm cất cánh. Tới gần mép thì dù tự rẽ về phía tâm | Agent |
| 14 | Có đường dẫn `?explore=glider` để mở thẳng chế độ bay (chia sẻ link, test) | Agent |
| 15 | Mã mới nằm trong `src/explore/`; thêm `CameraMode` mới `'glider'` vào `src/views/state.ts` | Agent |
| 16 | Esc / nút Thoát **tải lại trang** (bỏ `?explore=…` khỏi URL) → màn chọn hiện lại. Nhờ vậy bản hướng dẫn sau khi bay giống hệt lúc mới mở trang (camera, ngày/đêm, xe, thuyền, cầu quay), không phải viết code dọn trạng thái dùng chung. Từ bản hướng dẫn muốn về màn chọn thì tải lại trang; không thêm nút | Agent |
| 17 | Vùng bay là một khung cố định chứa **cả** Sơn Trà lẫn thành phố; người dùng bay về núi được. Độ cao tính theo y thế giới (mặt nước y = 0). Sàn 30 m, trần **800 m** (đỉnh núi ≈ 682 m); cất cánh ở ≈ đỉnh + 20 m | Agent |
| 18 | Hiệu năng: đợt này **đo và ghi** draw call / ms ở các tư thế bay vào `KET-QUA.md`. LOD theo độ cao **không** làm đợt này. Chỉ làm khi bậc Tự động không giữ được khung hình chơi được trên máy thật; khi đó báo người dùng và xem là việc tiếp theo | Agent |
| 19 | Test: `?test&chooser` hiện màn chọn kèm `window.__app`; `?test&explore=glider` vào thẳng chế độ bay. Chỉ có `?test` thì vẫn bỏ qua màn chọn như cũ | Agent |
| 20 | Âm thanh: không đụng `audio`. Mặc định nhạc tắt nên khi bay im lặng; tiếng nền (nếu có) chạy như bản hướng dẫn | Agent |

## 7. Bối cảnh trong code

- `src/views/camera.ts`: `updateCamera()` rẽ nhánh theo `cam.mode`. Chế độ `walk` đã đọc phím từ `keys` (`src/views/state.ts`), đây là mẫu để làm theo.
- `src/environment/mountains.ts`: Sơn Trà là các khối `ConeGeometry` gộp lại. Nón chính ở `(2600, −4700)`, cao 690, dời xuống 8 m.
- `src/core/renderer.ts`: `FogExp2(…, 0.00016)`, camera far 30 000. Khu phố có LOD 2 200 / 8 000 m (`src/environment/city.ts`).
- `src/core/device.ts` và pattern `(hover:none)` đã có (D-019) để nhận biết máy cảm ứng.
- `src/ui/setupUI.ts`: listener của OrbitControls `start` đưa `fly` về `orbit`. Chế độ mới phải tắt `controls` như `walk`.
- Mẫu ẩn/hiện giao diện bằng class trên `body`: `body.compact`, `body.touring`, `body.wxrun`.

## 8. Thử thách đã biết

1. **Hiệu năng trên cao.** Góc nhìn trên cao thấy cả thành phố cùng lúc, chưa từng được đo. Phải đo draw call và thời gian khung ở vài tư thế bay, ghi vào `tests/KET-QUA.md`. Nếu quá nặng, cân nhắc LOD theo độ cao (không được đổi góc cũ).
2. **Núi thô** khi cất cánh. Chấp nhận đợt này.
3. **Camera chui vào vật thể** (nhà, tháp) do không có va chạm: sẽ thấy mặt trong hoặc mặt bị cắt. Chấp nhận.
4. **Mép sương mù / vùng trống**: ranh giới phải đủ sớm để không nhìn ra khoảng trống, nhưng không bó quá chặt quanh Sơn Trà.
5. **Phím trùng với chế độ cũ**: `keys` dùng chung với `walk`. Esc hiện đang thoát Tour/cabin. Khi đang bay, phím chỉ phục vụ dù.

## 9. Kiểm tra

- `npm run typecheck`, `npm run build`.
- **Không đổi:** `test:drawcalls` (góc cũ chênh 0), `test:tour`, `test:tunnel`, `test:riverfront`, `test:voice`, `test:weather`, `test:sunwheel`, `test:perf --strict`, `test:mobile`. Tất cả chạy với `?test`, nên không gặp màn chọn.
- **Mới:** `tests/explore-check.mjs` + `npm run test:explore`. Kiểm:
  - Không có `?test` thì màn chọn hiện. Thẻ dù lượn bật trên máy có chuột, mờ khi giả lập cảm ứng. Ba thẻ "Sắp có" không bấm được.
  - Vào bay: giao diện cũ ẩn, chỉ còn sáng/tối, ngôn ngữ, chất lượng, hướng dẫn, Thoát.
  - Tốc độ không đổi theo thời gian.
  - A/D đổi hướng; W/S đổi độ cao trong `[sàn, trần]`; thả phím thì cân bằng lại.
  - Bay thẳng ra ngoài thì tự vòng về, không vượt ranh giới.
  - Esc / Thoát về màn chọn; vào "Tham quan có hướng dẫn" thì giao diện cũ hoạt động.
  - `?explore=glider` vào thẳng chế độ bay.
  - Đủ khóa i18n trong 9 ngôn ngữ, `ar` RTL.
  - Draw call khi bay ở vài tư thế đặt sẵn (ngày = đêm, ghi số vào `KET-QUA.md`).
- Tự xem ảnh chụp: lúc cất cánh, trên Cầu Rồng, gần Thuận Phước, ban đêm.

## 10. Để người làm tự quyết

- Hình dáng và số đỉnh của mô hình dù (giữ ≤ 1–2 draw call, đặt lớp 1/`noReflect` nếu phù hợp).
- Đường cong rẽ, nghiêng, cân bằng, độ trễ camera; cách tính "tự vòng về" ở ranh giới.
- Bố cục và kiểu dáng màn chọn (theo phong cách `.panel` hiện có). Hiện trên cảnh đã dựng xong hay trên màn tải.
- Cách gom các phần tử cần ẩn (class `body.explore` là gợi ý).
- Tên khóa i18n.
- Ghi D-020 vào `decisions.md` và cập nhật memory bank khi xong.
