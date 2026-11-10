# Thiết kế: Tàu thuyền trên sông Hàn sống động và thực tế hơn

_2026-11-10 · Ảnh tham chiếu (ban đêm, người dùng cung cấp): <https://static.vinwonders.com/2022/12/du-thuyen-tren-song-han-banner.jpg>_

## 1. Ý định

Người dùng thấy tàu thuyền trên sông "chỉ là các khối ô bình thường, không giống thực tế". Họ muốn tàu giống ảnh tham chiếu ở ba điểm: **dáng tàu**, **đèn về đêm**, **cảnh tàu đông đúc**. Cảnh đông đúc chỉ có **vào buổi tối**, tụ quanh **Cầu Rồng** và **Cầu sông Hàn**. Phải có **vài kiểu tàu khác nhau, không phải một mẫu nhân bản**. Số tàu tụ tập khoảng **15 chiếc**, không cần nhiều hơn.

Những gì thấy được trong ảnh tham chiếu:
- Du thuyền 2–3 tầng, mũi nhọn hếch, thân trắng có sọc đỏ.
- Boong trên lộ thiên, có lan can và mái che.
- Cửa sổ chạy dài theo thân.
- Lốp chống va treo dọc mạn, cờ đỏ ở mũi và đuôi.
- Có cả tàu gỗ thân hộp kiểu cũ lẫn du thuyền hai thân mũi cong hiện đại.
- Về đêm có viền LED nhiều màu dọc mép boong và mái, cabin sáng vàng ấm, biển tên phát sáng.
- Mặt sông có vệt phản chiếu sặc sỡ.
- Các tàu đứng yên hoặc trôi chậm, mũi tàu hướng lộn xộn.

## 2. Hiện trạng (để người dựng định hướng)

| Nhóm | Chỗ | Số tàu | Ghi chú |
|---|---|---|---|
| Tàu chạy dọc sông | `src/environment/traffic.ts` (`buildBoats`/`updateBoats`) | 7 | Gắn vào `scene` (layer 0, **có** trong phản chiếu). Làn x = −48, −22, 22, 48. Gọi `rand()` 2 lần mỗi tàu = 14 lần (`speed`, `len`; bất biến). Có `boatKeepOut` quanh công trường hầm. |
| Tàu theo cầu | `src/common/boats.ts` (`createBoats`/`stepBoats`) | 2 (Sông Hàn) + 3 (Thuận Phước) + 2 (Trần Thị Lý) | Gắn vào `bridge.life` (layer 1, **không** có trong phản chiếu; ẩn theo LOD cầu và khi đóng cầu do bão). Tọa độ cục bộ của cầu: các cầu không xoay, nên x cục bộ trùng x thế giới, z lệch theo `bridge.z`. Thuận Phước có một tàu hàng dài 46 m. `hanTunnel.holdBoats` đọc `songHan.boats.list`. |
| Tàu buồm cao | `src/bridges/song-han/life.ts` (`sh-tall-ship`) | 1 | Hộp, cabin, cột buồm, buồm tam giác. Chờ Cầu sông Hàn mở luồng phía Tây. |

- Mỗi nhóm có 3 `InstancedMesh` hộp đơn vị (thân, cabin, mái), dùng `MAT.hull`, `MAT.boatCabin`, `MAT.boatRoof`. Về đêm chỉ có `MAT.boatCabin.emissiveIntensity = m * 1.4` (`src/core/dayNight.ts`). `src/bridges/han-tunnel/cutaway.ts` cũng liệt kê ba vật liệu này.
- Đang có sẵn: tròng trành theo gió (`windFx.boatRock`), về bến khi bão (`weatherFx.boatAway` + `vanished()`), vệt đèn dọc trên sông về đêm (D-023, `patchNightStreak` trong `src/core/water.ts`; áp cho mọi thứ sáng đi vào ảnh phản chiếu).

## 3. Mục tiêu

| # | Hạng mục | Yêu cầu | Nguồn |
|---|---|---|---|
| G1 | Dáng tàu | Thay mọi khối hộp bằng mô hình có thân vuốt mũi, tầng boong, lan can, mái che, dải cửa sổ, lốp chống va, cờ đỏ sao vàng nhỏ. Nhìn gần (≈ 50–150 m, như các góc nhìn cầu) nhận ra ngay là du thuyền sông Hàn. | người dùng |
| G2 | Nhiều kiểu | Ít nhất **3 kiểu tàu du lịch** khác dáng rõ rệt (danh sách ở §6). Mỗi tàu thêm biến thể cố định (không đổi theo khung hình): màu sọc thân, chiều dài, màu LED, biển tên. Hai tàu đứng cạnh nhau không được giống hệt. | người dùng; danh sách kiểu do agent đề xuất |
| G3 | Đèn đêm | Chỉ khi trời tối (nhân `shared.uNight`): viền LED nhiều màu dọc mép boong và mái; cửa sổ cabin vàng ấm; biển tên phát sáng; đèn hàng hải nhỏ (đỏ/xanh ở hai mạn). LED đứng yên, không nhấp nháy. | người dùng; "không nhấp nháy" do agent đề xuất (giống D-023) |
| G4 | Phản chiếu | Ánh LED của tàu in xuống sông thành vệt màu, dùng lại cơ chế vệt của D-023. Muốn vậy tàu phải nằm trong ảnh phản chiếu (layer 0). | người dùng |
| G5 | Cảnh đông đúc | Về đêm có **khoảng 15 tàu tụ tập**: khoảng 8 quanh Cầu Rồng (z ≈ 0), khoảng 7 quanh Cầu sông Hàn (z ≈ −1080). Tàu đứng yên hoặc trôi rất chậm, mũi xoay lệch nhau, khoảng cách giữa các tàu không đều. Ban ngày không có các tàu này. | người dùng (vị trí, thời điểm, số lượng); cách chia 8/7 do agent đề xuất |
| G6 | Xuất hiện / rời đi | Tàu tụ tập hiện dần khi trời tối và mất dần khi trời sáng, so le từng chiếc như cơ chế "về bến" hiện có. Không chiếc nào bật ra đột ngột. Khi bão (`weatherFx.boatAway`) cũng về bến như tàu khác. | agent đề xuất |
| G7 | Tàu buồm cao | Làm lại theo cùng phong cách (thân vuốt, boong, cột buồm, buồm). Giữ nguyên hành vi chờ mở luồng. | agent đề xuất |

## 4. Ngoài phạm vi

- Không đổi số lượng, làn, tốc độ, lộ trình hay hành vi của 14 tàu đang chạy, và không đổi lịch quay Cầu sông Hàn.
- Không làm người trên boong, nhạc, pháo hoa, thuyền thúng, cano hay tàu đổ bộ bến.
- Không thêm UI, nút bật/tắt hay khóa i18n.
- Không đổi lời thuyết minh hay Tour.
- Không làm va chạm giữa tàu với nhau hay với dù lượn.

**Coi là hỏng dù vẫn chạy được:**
- Trông vẫn như khối hộp khi nhìn từ góc cầu.
- Mọi tàu giống hệt nhau.
- Đèn LED nhấp nháy hoặc cả cảnh thành "cầu vồng" lấn át cầu.
- Tàu tụ tập xuất hiện ban ngày, nằm chắn luồng tàu chạy hay chắn luồng mở của Cầu sông Hàn, hoặc xuyên qua trụ cầu.
- Tăng draw call ở góc nhìn cũ.
- Tên thật của hãng tàu (ví dụ các tên trong ảnh) xuất hiện trên biển tên.

## 5. Ràng buộc (bất biến của dự án)

- **`rand()`:** giữ nguyên 14 lời gọi trong `buildBoats()` (2 mỗi tàu, đúng thứ tự) và thứ tự `build*()` trong `main.ts`. Mọi phần ngẫu nhiên mới (kiểu tàu, màu, vị trí tụ tập, pha trôi) dùng `rng(seed)` riêng hoặc hash cố định.
- **Draw call:** ở **mọi góc nhìn cũ**, cả ngày lẫn đêm, số draw call **không được cao hơn** bảng hiện tại (`tests/KET-QUA.md`; dao động `swTour` đã biết, D-018, không tính). Phải tính cả lượt vẽ phản chiếu và lượt vẽ bóng.
  - Hiện tại tàu tốn 3 lệnh vẽ (nhóm chung, có thêm 3 trong phản chiếu) cộng 3 lệnh cho mỗi nhóm theo cầu khi nhóm đó hiện.
  - Chỉ gộp theo kiểu thì chưa đủ: 4 mesh theo kiểu × 2 (cảnh + phản chiếu) = 8, nhiều hơn 6 hiện nay ở các góc chỉ thấy nhóm chung.
  - Hướng giải để người dựng chọn: một `InstancedMesh` chứa mọi kiểu (hình học gộp, chọn kiểu theo thuộc tính instance), hoặc `BatchedMesh`, hoặc ẩn mesh của kiểu không có tàu nào trong tầm. Chọn cách nào phải đo bằng `test:drawcalls`.
- **Đèn:** không thêm `PointLight`/`SpotLight`. Đèn đêm bằng emissive, đọc `shared.uNight`.
- **Hình ảnh:** không dùng ảnh ngoài, không thêm thư viện runtime. Biển tên và dải cửa sổ vẽ bằng canvas; tên tàu hư cấu (ví dụ "Sông Hàn 01", "Ngọc Biển", "Hoa Sen"), không dùng tên hãng thật.
- **Thông số ở `src/config.ts`** (mục mới, ví dụ `CONFIG.boats`): kích thước từng kiểu, số tàu tụ tập, vùng tụ tập, tốc độ trôi, ngưỡng đêm hiện/ẩn, độ sáng LED. Mỗi dòng có chú thích tiếng Việt và đơn vị; ghi `(ước lượng)` nếu không có nguồn.
- **Hiệu năng:** `test:perf --strict` phải đạt. Vật liệu mới phải được `src/core/prewarm.ts` biên dịch trước (không có chương trình shader mới biên dịch sau khởi động). Đỉnh mỗi tàu giữ ở mức vừa phải (SwiftShader chạy test).
- **Vùng cấm:**
  - Tàu tụ tập không đặt trong hành lang hầm |z + 1700| < 30.
  - Không nằm trong luồng mở phía Tây của Cầu sông Hàn (tàu buồm cao chạy ở x ≈ −36).
  - Không nằm trên các làn tàu chạy trong đoạn z của cụm.
  - Không chạm trụ cầu.
  - Phải ở trong mép kè (|x| < 262, trừ khoảng cách an toàn).
- **Hành vi hiện có giữ nguyên:**
  - Tròng trành theo gió và về bến khi bão.
  - `boatKeepOut` và `hanTunnel.holdBoats(songHan.boats.list)`: giữ giao diện `list` có `z`, `dir`, hoặc sửa nơi gọi cho khớp.
  - `cutaway.ts`: chế độ kính của mặt cắt Hầm vẫn áp đúng lên tàu.

## 5b. Làm rõ sau khi review (quyết định của agent)

- **Tàu nào có đèn đêm đầy đủ (G3):** mọi tàu du lịch kiểu A/B/C đều có, gồm 15 tàu tụ tập, 7 tàu chạy chung và các tàu theo cầu. Kiểu D (tàu cá/hàng) chỉ có đèn cabin và đèn hàng hải.
  - Vệt trên sông (G4) chỉ áp cho tàu ở layer 0, tức tàu tụ tập và tàu chạy chung.
  - Tàu theo cầu giữ layer 1, không có trong phản chiếu, không bắt buộc đổi layer.
  - Nếu người dựng gom mọi tàu về một hệ chung ở layer 0, phải tự giữ ẩn theo LOD cầu, ẩn khi đóng cầu, và ngân sách draw call.
- **Chiều dài theo kiểu:** tàu chạy chung vẫn gọi `rand()` đúng 14 lần như cũ. Giá trị đó được đổi sang khoảng dài của kiểu, theo công thức `len = min + r × (max − min)`, với r là số `rand()` đã lấy. Như vậy tàu có thể dài hơn 18–28 m hiện tại; điều này **được phép**, không tính là đổi hành vi ở §4.
  - Tàu chạy chung chỉ dùng kiểu A/B. Kiểu C chủ yếu dành cho tụ tập.
  - Tàu theo cầu giữ kích thước đã khai báo (kể cả tàu hàng 46 m kiểu D): kiểu co giãn theo kích thước đó.
  - `boatKeepOut` / `holdBoats` chỉ dùng `z`, nên chiều dài mới không ảnh hưởng.
- **`test:citynight`:**
  - Giữ nguyên ngưỡng `warmDominant` (≥ 60 % ánh sáng màu là ấm), `dusk`, `duskWater`. LED tàu là dải mảnh, cửa sổ cabin vàng ấm chiếm diện tích lớn hơn, để vàng ấm vẫn áp đảo (đúng tinh thần "không thành cầu vồng").
  - Riêng `dayDiff` chắc chắn đổi vì tàu ban ngày đổi dáng theo thiết kế. Phải chụp lại mốc `--baseline` **sau khi** người dùng duyệt ảnh ban ngày, và ghi rõ lý do trong `tests/KET-QUA.md`.

## 6. Kiểu tàu (đề xuất của agent, người dùng đồng ý "vài kiểu khác nhau")

| Kiểu | Dáng | Dùng cho |
|---|---|---|
| A. Du thuyền hai thân hiện đại | Khoảng 24–28 m (ước lượng), 2 tầng, mũi cong vuốt, thân trắng có sọc đỏ chéo, cabin kính dài, boong trên có mái phẳng | tàu chạy + tụ tập |
| B. Tàu gỗ du lịch kiểu cũ | Khoảng 20–24 m, thân hộp mũi nhọn, 2 tầng, boong trên có mái che, hàng lốp chống va dày, biển tên lớn trên nóc | tàu chạy + tụ tập |
| C. Du thuyền lớn 3 tầng | Khoảng 30–35 m, boong thượng lộ thiên, lan can, dây đèn lồng tròn nhiều màu | chủ yếu tụ tập; có thể 1 tàu chạy |
| D. Tàu cá / tàu hàng nhỏ | Cabin lái ở đuôi, boong hàng phía trước, ít đèn | tàu ở Thuận Phước / cửa sông (gồm tàu hàng 46 m hiện có) |

Kích thước trong bảng là ước lượng; con số chính xác người dựng đặt trong `config.ts`. Kiểu cho từng tàu chạy hiện có được gán cố định (theo chỉ số hoặc hash), không gọi `rand()`.

## 7. Điểm neo kỹ thuật

- Tàu tụ tập nên nằm ở **layer 0** (giống nhóm chung trong `traffic.ts`) để có phản chiếu G4. Tàu theo cầu đang ở layer 1. Gom chúng về một hệ chung hay giữ riêng là việc của người dựng, miễn đạt ràng buộc draw call. Nếu đưa tàu theo cầu vào phản chiếu, lượt vẽ phản chiếu phải được tính vào ngân sách.
- Tàu tụ tập quanh Cầu Rồng có thể lọt vào khung bóng (`sun.shadow.camera` ±470 m). Ban đêm mặt trời tắt nhưng lượt vẽ bóng vẫn có thể chạy; phải đo.
- Vệt phản chiếu D-023 lấy những gì sáng vượt ngưỡng `CONFIG.cityNight.streak.threshold` trong ảnh phản chiếu. LED tàu phải đủ sáng để vượt ngưỡng nhưng không làm loá bloom.
- Tham khảo cách làm đèn đêm bằng emissive trong shader: `patchWindows` (`src/common/shaders.ts`); khi vá shader cần khóa cache riêng (`customProgramCacheKey`).

## 8. Tiêu chí nghiệm thu

1. **Ban ngày:** nhìn từ góc Cầu Rồng, Cầu sông Hàn, Trần Thị Lý, Thuận Phước thấy tàu có dáng du thuyền, nhiều kiểu, không có tàu tụ tập. Người dùng duyệt bằng ảnh chụp.
2. **Ban đêm:** từ góc tương đương ảnh tham chiếu (trên cao, phía Nam Cầu Rồng nhìn về Bắc) thấy khoảng 8 tàu tụ quanh Cầu Rồng với LED nhiều màu, cabin vàng và vệt màu trên sông; quanh Cầu sông Hàn thấy khoảng 7 tàu. Người dùng duyệt bằng ảnh chụp.
3. **Chuyển ngày ↔ đêm:** tàu tụ tập hiện và mất dần, không bật ra đột ngột. Khi bão, mọi tàu về bến.
4. **Test tự động mới** (`test:boats`, đọc `dist/`), kiểm tra:
   - số tàu tụ tập (≈ 15) chỉ hiện khi đêm;
   - không tàu nào nằm trong vùng cấm ở §5;
   - draw call ở vài góc chuẩn không vượt bảng cũ.
5. `npm run typecheck` và `npm run build` đạt. Đủ bộ test ở §5 của `copilot-instructions.md` chạy một lần cuối nhánh. `test:drawcalls` không có góc cũ nào tăng; số mới ghi vào `tests/KET-QUA.md`.

## 9. Để người dựng tự quyết

- Cách dựng hình học (gộp `mergeGeometries`, phân đoạn thân).
- Cách đạt ngân sách draw call (§5).
- Công thức shader đèn đêm.
- Atlas canvas cho cửa sổ và biển tên.
- Vị trí và quỹ đạo trôi cụ thể của từng tàu tụ tập.
- Tốc độ hiện/ẩn.
- Có giữ `castShadow` cho tàu hay không.
- Kích thước chính xác từng kiểu.

## 10. Quyết định do agent đưa ra (người dùng có thể bác)

- 4 kiểu tàu ở §6.
- Chia 8/7 giữa Cầu Rồng và Cầu sông Hàn.
- LED đứng yên.
- Làm lại tàu buồm cao (G7).
- Hiện/ẩn so le theo mức đêm.
- Có test mới `test:boats`.
- Mục tiêu draw call không tăng ở mọi góc cũ, kể cả đêm.
- Tên tàu hư cấu.
- Làm trên nhánh riêng `feature/tau-thuyen-song-han`, **chỉ bắt đầu sau khi nhánh `feature/thu-gon-bang-dieu-khien` hoàn thành và người dùng ra lệnh**.
