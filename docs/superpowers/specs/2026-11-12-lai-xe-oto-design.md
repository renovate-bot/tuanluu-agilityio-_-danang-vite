# Lái xe ô tô VinFast VF 3 (5 slot, camera sau xe) — thiết kế

_2026-11-12 · Trạng thái: Đã triển khai trên nhánh (HEAD `7b31a4c`), chưa merge, PR #30; Worker chưa deploy; các test nặng chưa chạy theo lời người dùng, xem `activeContext.md` và `tests/KET-QUA.md` · Quyết định: D-034 (chế độ lái xe), D-033 (cho phép mô hình ngoài) · Nhánh: `feature/lai-xe-oto`_

Mục có dấu **(ND)** là người dùng nói hoặc chọn. Mục có dấu **(Claude)** là Claude tự quyết, người dùng chưa nói tới. Còn lại là đề xuất của Claude mà người dùng đã đồng ý khi được trình bày (bản đồ, bố cục màn hình, danh sách hành vi).

## 1. Ý định

Dự án đã có hai cách tự khám phá: dù lượn (từ trên trời) và đi dạo (từ mặt đất, chậm, chỉ quanh Cầu Rồng và Cầu sông Hàn). Chế độ này thêm cách thứ ba: lái một chiếc ô tô, đủ nhanh để **đi hết mọi công trình trong một lượt chơi**: bốn cây cầu và chui qua Hầm vượt sông Hàn **(ND)**. Xe là VinFast VF 3, mẫu xe nhỏ quen mặt ở Việt Nam **(ND)**. Không nhiệm vụ, không điểm số.

"Kiểu GTA" **(ND)** ở đây chỉ là cách đặt camera (góc nhìn thứ ba, sau và trên xe) và cách điều khiển. Không dùng tên, nhân vật, giao diện, bản đồ hay hình ảnh của trò chơi nào.

## 2. Mục tiêu / không làm / thất bại

**Mục tiêu**
- Thẻ "Ô tô" trong màn chọn phương tiện (`data-pick="car"` đang khóa "Sắp có" trong `index.html`) bấm được, trên **máy tính và điện thoại**.
- Xuất phát ở Cầu Rồng **(ND)**, lái tự do trên **đường lớn** **(ND)**; từ điểm xuất phát tới được, không rời mặt đường, cả bốn cầu và lòng hầm, theo cả hai chiều.
- Giữ ga thì xe nhanh dần như xe thật, theo số liệu công bố của VF 3 **(ND)**; không có nút tăng tốc vượt số liệu thật **(ND)**.
- Xe không đi xuyên xe khác, lan can, dải phân cách, tường hầm, tòa nhà **(ND: "không cho đụng vào")**.
- 5 chỗ lái xe **(ND)**, riêng với 5 chỗ bay và 5 chỗ đi dạo; thấy xe của nhau chạy trên đường, có tên như đi dạo và dù lượn **(ND)**.
- Cầu Thuận Phước nối được với mạng đường **(ND)**.

**Không làm** (đợt này): xe tự động biết né / dừng chờ xe người chơi; đèn giao thông; điểm, nhiệm vụ, đua; pin và sạc; góc nhìn trong buồng lái; hư hỏng, nổ, lật xe, trượt bánh; rẽ vào khe giữa các dãy nhà; đổi xe / chọn màu; lên xuống xe để đi bộ; tay cầm chơi game; va chạm giữa xe người chơi với nhau và với người đi dạo; đồng bộ ngày đêm, thời tiết, trạng thái cầu quay giữa các máy; xe tự động trên các đường xây mới; đèn pha rọi sáng mặt đường.

**Coi là thất bại dù vẫn chạy**
- Xe đi xuyên tòa nhà, lan can, tường hầm, thân rồng, tháp cầu; xe rơi xuống sông, chìm dưới mặt đường hay bay trên không.
- Có một cầu hoặc lòng hầm không lái tới được từ Cầu Rồng.
- Có 6 người lái cùng lúc; chế độ lái xe làm dù lượn hoặc đi dạo mất chỗ / hỏng; khách cũ (chưa tải bản mới) hỏng khi máy chủ mới chạy.
- Máy chủ lỗi hoặc còn bản cũ làm hỏng trang hay chặn lái xe một mình.
- Mô hình xe tải chậm / lỗi làm treo chế độ hoặc để người chơi lái một chiếc xe vô hình.
- Góc nhìn cũ tăng draw call (ngưỡng ở mục 9); Tour, tham quan, dù lượn, đi dạo đổi hành vi; vị trí nhà / cây / xe tự động đổi (chuỗi `rand()`).

## 3. Trải nghiệm

1. **Vào chế độ.** Bấm thẻ "Ô tô" → sảnh như hai chế độ kia: số chỗ lái còn lại, tên đang có mặt, ô tên (≤ 9 ký tự, dùng chung tên đã lưu), nút vào. Không có máy chủ, hoặc máy chủ còn bản cũ chưa biết loại "lái xe", thì lái một mình ngay. `?explore=drive` vào thẳng, một mình.
2. **Xuất phát ở Cầu Rồng (ND).** Trên làn xe chiều Tây → Đông, nửa phía Tây cầu, mũi xe hướng Đông; mỗi slot lệch nhau dọc làn để không chồng lên nhau. Vị trí chính xác do người làm chọn sao cho không trùng chỗ xe tự động hay dừng.
3. **Lái (ND: nhanh dần như xe thật).** Theo mục 5. Bánh quay theo tốc độ, hai bánh trước xoay theo tay lái, thân xe nghiêng theo dốc cầu / dốc hầm.
4. **Camera kiểu góc nhìn thứ ba (ND).** Sau và hơi cao hơn xe, bám theo đuôi xe khi rẽ (có trễ nhẹ cho mượt). Kéo chuột / vuốt để nhìn quanh; thả ra vài giây thì camera tự về sau xe. Lùi xe thì camera không tự quay ra trước. Camera không chui vào nhà, không xuống dưới mặt đường; trong hầm camera hạ thấp và áp sát xe để không xuyên trần.
5. **Điều khiển máy tính.** W / ↑ ga, S / ↓ phanh (xe đã đứng thì giữ tiếp là lùi), A D / ← → lái, Space phanh tay, H còi, kéo chuột nhìn quanh, Esc thoát.
6. **Điều khiển điện thoại.** Ngón trái: cần gạt ngang để bẻ lái. Ngón phải: bàn đạp GA (to) và PHANH (nhỏ hơn, bên trái GA); giữ PHANH khi xe đã đứng thì lùi. Vuốt vùng trống để nhìn quanh. Cầm ngang là chính; cầm dọc vẫn dùng được với cùng bố cục **(Claude)**.
7. **Trên màn hình.** Nút Thoát (trên trái); danh sách "Lái xe n/5 · Đi dạo n/5 · Bay n/5" kèm tên (cùng chỗ với danh sách của hai chế độ kia); đồng hồ tốc độ km/h dạng số (dưới phải); **bản đồ nhỏ** (dưới trái): sông, các đường lái được, năm công trình, chấm vị trí + hướng xe của mình, chấm xe người khác; gợi ý phím (máy tính, tự ẩn sau vài giây **(Claude)**). Bảng điều khiển tham quan ẩn như khi bay dù.
8. **Người chơi khác (ND).** Xe người khác là cùng mô hình VF 3, **màu sơn theo slot** (`multiParams.colors`), bánh quay và bẻ lái theo dữ liệu nhận được, tên nổi phía trên nóc (kèm khoảng cách như đi dạo). Người lái thấy người bay dù và người đi dạo như hiện có; người bay dù và người đi dạo thấy xe và tên người lái. Xe của mình: màu của slot mình; lái một mình: màu slot 0 **(Claude)**.
9. **Hết chỗ lái.** Xem bám theo một xe đang chạy, có lời mời khi trống chỗ; cùng luật với hai chế độ kia.
10. **Rời máy.** 60 s không chạm thì hỏi, đếm ngược 15 s rồi trả chỗ; cùng luật.
11. **Ban đêm.** Đèn pha, đèn hậu tự sáng theo `shared.uNight`; đèn phanh sáng khi phanh (cả ngày lẫn đêm). Tất cả là emissive trên xe, **không** `SpotLight` / `PointLight`. Cầu Rồng tự phun, Cầu sông Hàn theo lịch như khi đi dạo.
12. **Âm thanh.** Tiếng mô tơ điện rì nhẹ, cao độ và âm lượng theo tốc độ; tiếng còi; tổng hợp bằng Web Audio (mẫu: âm thanh thời tiết hiện có), không tệp âm thanh. Theo nút tắt tiếng chung của trang nếu có **(Claude)**.
13. **Thời tiết.** Bão không cấm lái; xe tự động bị dọn theo luật hiện có, xe người chơi vẫn chạy.

Bản phác đã duyệt (không commit): `.superpowers/brainstorm/22389-1794472409/content/mang-duong-va-man-hinh.html`.

## 4. Mạng đường

### 4.1 Hiện trạng (đã đọc mã, 2026-11-12)

- Đường ven sông (`src/environment/streets.ts`): Bạch Đằng tim x = −299, z −2600..2600; Trần Hưng Đạo tim x = +299, z −2300..2600. Mỗi tuyến hai dải 9 m (tim ±6 m quanh tim tuyến), dải giữa 3 m cao 0,3 m. `src/bridges/thuan-phuoc/site.ts` nối dài hai tuyến này về phía Bắc, chui dưới Cầu Thuận Phước, tới z ≈ −3210 (Tây) và −3660 (Đông).
- Trục ngang: z = 0 (Cầu Rồng; mặt phố x −1900..−333 và 333..1480), z = −1080 (Cầu sông Hàn, x −1900..1480), z = +1300 (Trần Thị Lý, x −1900..1480), z = −1700 (Hầm; mặt phố x −1900..−780 và 780..1480, dốc và lòng hầm ở giữa), z = −2900 (Thuận Phước, x −1500..1480).
- Chỗ mặt đường trục ngang hạ về `roadY` 2,6 m: Cầu Rồng |x| = 333; Cầu sông Hàn |x| = 290; Trần Thị Lý x = −470 và +450; Hầm |x| = 745; Thuận Phước |x| = 1047,5.
- **Đường ven sông chỉ giao cùng cao độ với trục ngang ở Cầu sông Hàn.** Dốc Cầu Rồng (cao khoảng 5,3 m tại |x| = 299) và Trần Thị Lý bắc vượt phía trên đường ven sông; hầm chui bên dưới. Không có đường dọc nào khác nối các trục ngang.
- Đất liền: `src/environment/river.ts` dựng bờ Tây tới z = −2600, bờ Đông tới z = −2300; `tpBuildSite()` (`thuan-phuoc/site.ts`) đắp tiếp tới z = −3250 (Tây) và −3700 (Đông). **Đường dẫn Thuận Phước (z = −2900) nằm trên đất**, nhưng không có đường nào ở mặt đất nối nó với phần còn lại: nó hạ về mặt đất ở |x| = 1047,5, giữa khu nhà.
- Khu phố (`src/environment/city.ts`): nhà trên lưới 36 m, z −1800..1800, bỏ trống các cột / hàng có chỉ số chia hết cho 5 ("chừa đường") nhưng không có mặt đường ở đó.
- Nhà quanh Thuận Phước (`site.ts`, một `InstancedMesh` thường, bộ sinh riêng `rng(1965)`): lưới 34 m **không chừa hành lang**, bờ Tây x −1700..−360, z ≈ −3190..−2620; bờ Đông x 360..1380, z ≈ −3300..−2320. Giữa hai khu nhà còn dải trống: bờ Tây z −2600..−1800, bờ Đông z −2300..−1800.
- **Tĩnh không dưới dốc Cầu Rồng thấp** (bản mặt cầu dày 0,5 m, `dragon/deck.ts`): trên dải xe phía xa sông (|x| 300,5..309,5) chỉ còn khoảng 2,0 → 0,9 m, thấp hơn xe (1,62 m); dải phía gần sông bờ Tây có cột trụ x = −294 đứng giữa dải. Xe tự động hiện chạy xuyên qua cả hai chỗ. Dưới dốc Trần Thị Lý đủ cao (≥ 1,8 m ở chỗ thấp nhất).
- Hầm ẩn theo khoảng cách camera tới tim hầm (`src/config.ts`, `HanTunnel.ts`, `han-tunnel/outdoor.ts`): mặt đường trục hầm `hr-road` ẩn khi xa hơn 650 m, cả công trình ẩn khi xa hơn 1 500 m, phần ngầm cần chi tiết đang hiện (gần hơn 600 m) và `hrInside`.

### 4.2 Xây thêm (người dùng đã duyệt trên bản đồ, trừ mục ghi (Claude))

1. **Hai đường dọc mới**, mỗi bờ một đường, từ z = −2900 tới z = +1300, cắt cả năm trục ngang ở mặt đất:
   - Bờ Tây tim **x = −1064**: cột lưới bị bỏ trống của `buildCity` (`ix = −30`); hành lang không nhà khoảng x −1082,5..−1045,5.
   - Bờ Đông tim **x = +1096**: cột `ix = 30`; hành lang khoảng x 1077,5..1114,5.
   - Mặt cắt: 2 làn mỗi chiều, dải giữa, tổng bề rộng mặt đường ≤ 24 m để lọt hành lang (ước lượng; người làm kiểm bằng danh sách nhà thật sau mọi bước dọn nhà, lệch thì chỉnh tim đường chứ không dỡ nhà).
   - Tên hiển thị trên bản đồ nhỏ: không đặt tên đường thật (đây là đường giản lược của mô hình, không khớp một con đường cụ thể) **(Claude)**.
2. **Nhánh rẽ chân Cầu Rồng** (hai bờ): nối mặt phố trục z = 0 ngay ngoài |x| = 333 với đường ven sông, đi hai bên dốc cầu (vùng |z| < 48 không có nhà). **Gầm dốc Cầu Rồng đóng với xe người chơi (ND chọn "chặn gầm, đi vòng", 2026-11-12):** đường ven sông bị chặn ở hai phía dốc cầu; xe đi dọc đường ven sông rẽ vào nhánh rẽ, băng qua trục z = 0 ở mặt đất (chỗ mở dải giữa ngay ngoài chân dốc) rồi theo nhánh rẽ bên kia trở lại đường ven sông. Không sửa hình học cầu. Chỗ chặn không có tường nhìn thấy; xe tự động vẫn chạy xuyên gầm như cũ.
3. **Nhánh rẽ chân Trần Thị Lý** (hai bờ): nối trục z = 1300 tại x = −470 / +450 với đường ven sông, đi hai bên dốc cầu (vùng |z − 1300| < 40 không có nhà).
4. **Không cần đất mới** (bản đồ đã duyệt vẽ "đất mới" ở phía Bắc là sai: đất đã có sẵn từ `tpBuildSite()`). Thay vào đó, đoạn Bắc của hai đường dọc (bờ Tây z −2900..−2600, bờ Đông z −2900..−2320) đi xuyên khu nhà Thuận Phước, vốn không có hành lang: **thu các nhà nằm trên mặt đường và vỉa về scale 0 (Claude)**, theo mẫu dọn nhà sẵn có; không đổi `rng(1965)`.
5. **Hai đường nối phía Bắc (Claude, không có trên bản đồ đã duyệt):** nối Bạch Đằng sang đường dọc bờ Tây ở z ≈ −2560, và Trần Hưng Đạo sang đường dọc bờ Đông ở z ≈ −2260, đi trong dải trống giữa hai khu nhà. Đoạn đường ven sông phía Bắc hai đường nối này (chui dưới Cầu Thuận Phước, tới z ≈ −3210 / −3660) **lái được**, cuối đường có chỗ quay đầu **(Claude)**.
6. **Chỗ mở dải giữa** tại mọi nút giao để rẽ trái và quay đầu.
7. **Ranh phía Nam (Claude):** đường ven sông phía Nam Trần Thị Lý (z > khoảng 1400) không lái được; chặn mềm như ranh vùng của đi dạo (trượt dọc ranh, không tường nhìn thấy).

Kết quả phải là **một mạng liền**: từ bất kỳ đoạn đường lái được nào tới được mọi đoạn khác. Có test kiểm (mục 10).

### 4.3 Ràng buộc khi dựng đường và đất mới

- Không gọi `rand()`; không đổi thứ tự các lệnh `build*()` hiện có.
- **Không thêm lệnh vẽ ở góc nhìn cũ:** mặt đường mới gộp vào các lưới đường đang có (`ROADS2` / `ROADS3` / `MEDIANS` trước `finalizeRoads()`). Nếu chỗ nào buộc phải thêm lưới riêng thì ghi rõ lý do và số lệnh vẽ tăng trong plan, người dùng duyệt.
- Dọn cây, cột đèn, vật trang trí nằm trên mặt đường mới theo mẫu thu instance về scale 0 (cả `near` lẫn `far` của LOD). Hành lang hầm |z + 1700| < 30 không đặt gì thêm ngoài chính mặt đường giao cắt ở chỗ hầm đã lên mặt đất.
- `site.ts` dựng mặt đường ven sông nối dài thành lưới riêng của Thuận Phước; chỗ mở dải giữa / chỗ quay đầu ở đó sửa ngay trong lưới ấy, không thêm lưới.
- Đường mới có vạch kẻ, vỉa, dải giữa như đường hiện có; không có đèn đường mới phát sáng thật. Có cột đèn hay không do người làm quyết theo ngân sách lệnh vẽ.
- Mọi tọa độ mới nằm ở `src/config.ts`, ghi `(ước lượng)`.
- Đường mới hiện ở **mọi** chế độ (tham quan, Tour, dù lượn) vì là một phần của cảnh. Ảnh chuẩn / mốc của `test:citynight`, `test:drawcalls` ở các góc Thuận Phước và toàn cảnh sẽ đổi; chụp lại mốc.

## 5. Xe và chuyển động

### 5.1 Số liệu VF 3 (ghi nguồn trong `CONFIG.drive`)

| Thông số | Giá trị | Nguồn |
|---|---|---|
| Dài × rộng × cao | 3 190 × 1 679 × 1 622 mm | VinFast / Bonbanh / VnExpress |
| Chiều dài cơ sở | 2 075 mm | như trên |
| Tốc độ tối đa | 100 km/h | auto-data.net, Bonbanh |
| 0–50 km/h | 5,3 s | vinfastauto.id |
| 0–100 km/h | 19,3 s | Bonbanh (bản Eco 2026), Autofun |
| Bán kính quay vòng tối thiểu | 4,05 m | Bonbanh (bản Plus 2026) |
| Lốp | 175/75 R16 (đường kính ngoài ≈ 0,669 m, tính từ cỡ lốp) | Bonbanh |
| Khoảng sáng gầm | 191 mm (nguồn khác ghi 175 mm) | VnExpress |
| Động cơ | 32 kW, 110 Nm, cầu sau | VinFast |
| Khối lượng không tải | 857 kg | auto-data.net |

Đường dẫn nguồn: xem mục 12.

### 5.2 Mô hình chuyển động

- Mô hình "xe đạp" động học trên mặt bằng: vị trí, hướng, tốc độ dọc, góc lái. Không mô phỏng lốp, treo, trượt.
- **Đường cong tăng tốc** đi qua hai điểm công bố (50 km/h ở 5,3 s, 100 km/h ở 19,3 s) và tiệm cận 100 km/h; dạng hàm do người làm chọn, có test đơn vị kiểm hai mốc với sai số ≤ 0,3 s.
- Nhả ga: giảm tốc nhẹ (mô phỏng hãm tái sinh), ước lượng khoảng 1,5 m/s². Phanh: khoảng 7 m/s². Phanh tay: khoảng 9 m/s², không gây trượt. Lùi: tối đa 20 km/h. Tất cả `(ước lượng)`, người dùng chỉnh sau khi thử.
- Lên dốc / xuống dốc không đổi gia tốc **(Claude)**: dốc lớn nhất của mạng đường chỉ khoảng 4,5 %.
- **Lái:** góc lái tối đa suy từ bán kính quay vòng 4,05 m và chiều dài cơ sở. Tốc độ càng cao góc lái cho phép càng nhỏ, sao cho gia tốc ngang không vượt một trần (ước lượng 0,6 g) — thay cho trượt bánh. Bàn phím: góc lái tiến dần về đích và tự trả về 0 khi nhả.
- **Cao độ và nghiêng:** xe bám mặt đường của đoạn đang chạy; dốc dọc lấy từ hàm cao độ của cầu / hầm (`deckY`, `shRoadY`, `ttlRoadY`, `tpRoadY`, `hrRoadY`).
- Bước mô phỏng cố định hoặc chia bước con, để ở 100 km/h (27,8 m/s) không xuyên vật cản mỏng ở khung dài.

### 5.3 Mô hình 3D

- **Nguồn:** "Vinfast Vf3" của Hoàng Huy (@danghoanghuy69), Sketchfab, **CC-BY-4.0**, `https://sketchfab.com/3d-models/vinfast-vf3-6a2caea4505347d18c47ef4d47840859`. Người dùng đã tải về `assets/vinfast_vf3.glb` (6 794 860 byte; tác giả, giấy phép, nguồn ghi sẵn trong `asset.extras` của tệp).
- **Đã kiểm trong tệp:** 41 928 tam giác, 10 lưới chia theo vật liệu, 6 ảnh (hai JPEG 2,3 + 2,1 MB chiếm phần lớn dung lượng), không xương, không chuyển động. Khung bao 1,45 × 1,33 × 2,41 đơn vị, mũi xe hướng +Z của glTF. Bốn bánh nằm chung một lưới (vật liệu `BANH`, 13 824 tam giác). Thân sơn là một vật liệu màu phẳng (`Material.001`, hồng). Kính đen đặc, không có nội thất. Có logo chữ V, chữ "VF3", biển số "62A-093.85" trước và sau (lưới `Object_12`, `Object_13`, mỗi lưới 12 tam giác, vật liệu có ảnh).
- **Xử lý bằng script, lệnh `npm run gen:car`** (Blender 4.5 qua cơ chế của `scripts/people/blender.mjs`; mẫu: `scripts/people/convert.py`):
  - chuyển tệp gốc sang `scripts/car/vinfast_vf3.glb` và commit **(Claude)**: Sketchfab bắt đăng nhập nên script không tự tải được như Rocketbox; thư mục `assets/` bỏ;
  - phóng đều cho **dài đúng 3,19 m**, đặt gốc ở giữa hai trục bánh trên mặt đường, mũi xe theo quy ước của mã xe hiện có (+X); tỉ lệ rộng / cao của mô hình lệch xe thật vài phần trăm, chấp nhận;
  - **tách bốn bánh** thành bốn vật riêng có gốc ở tâm bánh (để quay và bẻ lái);
  - **xóa hai biển số (ND)**; **giữ logo và chữ VF3 (ND)**;
  - gộp các lưới còn lại theo vật liệu, thu nhỏ / nén ảnh;
  - đánh dấu vật liệu thân sơn (để đổi màu theo slot) và vật liệu đèn pha / đèn hậu (để phát sáng);
  - xuất `public/car/vf3.glb` + ảnh xem trước để duyệt bằng mắt.
- **Trần (có test kiểm):** `public/car/vf3.glb` ≤ 1,5 MB; ≤ 45 000 tam giác; đủ 4 bánh tách rời; có `public/car/LICENSE-VF3.txt` ghi tên mô hình, tác giả, đường dẫn, CC-BY-4.0 và các thay đổi đã làm (CC-BY đòi nêu thay đổi). README mục Cấu trúc + dòng ghi nguồn. Nếu không đạt 1,5 MB mà vẫn giữ được chi tiết đèn và logo thì báo người dùng số đạt được.
- **Nạp:** `GLTFLoader` có sẵn (mẫu `src/explore/stroll/rig.ts`): tải khi vào chế độ (và khi có người lái xuất hiện ở chế độ khác), nhớ cache, không bao giờ ném lỗi. **Hình tạm:** trong lúc chưa tải xong hoặc khi lỗi, vẽ xe bằng hình học dựng bằng mã (dùng lại dáng xe của `src/common/vehicles/shapes.ts` hoặc một khối hộp đúng kích thước VF 3), vẫn lái được bình thường.
- **Shader:** làm nóng trước khi hiện (mẫu `stRigSetWarm`) để không khựng khung; `test:perf -- --strict` phải đạt.
- **Thương hiệu:** tên "VinFast VF 3" và logo được dùng để gọi đúng mẫu xe trong một trang trình diễn; không ghi hay ngụ ý VinFast tài trợ / chứng nhận. Người dùng đã quyết giữ logo (2026-11-12).

## 6. Va chạm

Phần quyết định thành bại. Dùng lại được: các hàm hình học và dữ liệu của đi dạo (`src/explore/stroll/map.ts`, `mapData.ts`, `sceneData.ts`: vùng chữ nhật có hàm cao độ, vật cản chữ nhật / tròn, lưới ô 16 m, `collectBuildings()`, `footprints`). Phải làm mới: phần dưới đây.

- **Xe là hình chữ nhật có hướng** 3,19 × 1,68 m (hoặc tương đương, ví dụ ba hình tròn dọc thân), không phải hình tròn 0,35 m của người.
- **Vùng lái được là mặt đường, theo từng đoạn.** Mỗi đoạn đường (mỗi chiều của mỗi tuyến, mỗi nhánh rẽ, mỗi nút giao, mỗi ống hầm) là một dải có bề rộng và hàm cao độ riêng. Ngoài mặt đường là không hợp lệ: vỉa hè, dải đi bộ, nền đất giữa các dãy nhà đều chặn (bó vỉa là tường).
- **Nhiều tầng tại cùng một điểm mặt bằng.** Bạch Đằng / Trần Hưng Đạo chui dưới dốc Cầu Rồng và Trần Thị Lý, và chạy phía trên hầm. Xe thuộc về **đoạn đang chạy** và chỉ đổi đoạn ở chỗ hai đoạn nối nhau cùng cao độ (nút giao, đầu cầu, cửa hầm). Bản đồ một tầng của đi dạo không đủ.
- **Vật cản cứng:** bó vỉa và mép mặt đường; dải giữa (trừ chỗ mở ở nút giao); lan can và gờ chắn cầu; thân, đầu, đuôi rồng và chân vòm (Cầu Rồng); tháp, chân dây văng, barie (Cầu sông Hàn); thân tháp ở dải giữa (Trần Thị Lý); tháp và neo cáp nếu nằm sát làn (Thuận Phước); tường ống, tường hầm hở, dải giữa hầm (Hầm); trụ cầu đứng trên đường ven sông (trụ nhịp dẫn Cầu Rồng tại x = −294, z = ±8,5; trụ Trần Thị Lý trên dải giữa Bạch Đằng); tòa nhà và chân đế địa danh nếu có cái nào lấn mặt đường (`collectBuildings()` chỉ thấy nhà dạng `THREE.LOD` của `buildCity`; nhà quanh Thuận Phước là `InstancedMesh` thường, phải thu riêng). Người làm rà hình học từng công trình để lấy đủ; danh sách này là tối thiểu.
- **Chạm vật cản:** xe trượt dọc theo vật cản và mất tốc độ (phần tốc độ hướng vào vật cản về 0, thêm hãm khi cọ), không dội mạnh, không hư hỏng. Không bao giờ có trạng thái rơi.
- **Xe tự động (ND: không cho đụng vào).** Hiện không có hàm truy vấn vị trí xe tự động; phải thêm một hàm đọc vị trí các xe gần người chơi từ dữ liệu sẵn có (`s`, `lane`, `dir` của `src/environment/traffic.ts` và `createTraffic` trong `src/common/traffic.ts`), **không** đổi cách chúng chạy và không thêm `rand()`. Luật:
  - xe người chơi không tự lấn vào xe tự động được (coi như vật cản đang di chuyển): lao vào đuôi, hông hay đầu xe tự động thì bị chặn và mất tốc độ;
  - **xe tự động đi tới chạm xe người chơi thì đi xuyên qua, không đẩy (ND chọn, 2026-11-12):** xe người chơi không bao giờ bị xô. Khi hai xe đã chồng lên nhau theo cách này, xe người chơi vẫn lái ra được theo mọi hướng (không bị kẹt trong thân xe tự động);
  - xe tự động đang ẩn (bão, tắt làn, ngoài tầm vẽ) không chặn.
- **Cầu sông Hàn quay:** dùng trạng thái đã có của cầu. Từ lúc chặn xe, hai barie là tường; xe người chơi đang ở trên nhịp quay được đưa ra ngoài barie gần nhất (chuyển mượt, mẫu `stEvacStep` của đi dạo). Chế độ lái xe không tự kích hoạt quay.
- **Hầm hiện đủ khi lái:** các ngưỡng ẩn theo khoảng cách (mục 4.1) được nới **riêng cho chế độ lái xe** sao cho mặt đường trục hầm có mặt ở nút giao với hai đường dọc (|x| ≈ 1064 / 1096) và suốt đường vào hầm; lệnh vẽ tăng thêm chỉ khi đang lái, ghi số đo vào plan. Các chế độ khác giữ ngưỡng cũ.
- **Trong hầm:** lòng hầm là hình học thật (`src/bridges/han-tunnel/`): hai ống, tâm ±8,35 m quanh z = −1700, mỗi ống 3 làn; xe người chơi chạy trong ống theo chiều nào cũng được, tường ống là vật cản. Phần ngầm chỉ hiện khi camera ở trong hầm (`hrInside`), nên camera phải vào hầm cùng xe; chỗ cửa hầm không được lóe mặt nước / mặt đất.
- **Xe người chơi khác, người đi dạo, người đi bộ có sẵn, cây, cột đèn:** đi xuyên qua (không làm đợt này).
- **Camera:** kiểm đoạn thẳng xe → camera với cùng dữ liệu vật cản + trần hầm + gầm cầu; vướng thì kéo camera lại gần.
- Va chạm tính ở máy khách. Máy chủ chỉ kẹp vị trí vào khung vùng lái (mục 7).

## 7. Nhiều người

Máy chủ: Cloudflare Worker `danang-sky` (`server/multi/`), Durable Object `sky`; khách: `src/explore/multi/`. Hiện có hai loại `fly` và `walk`, mỗi loại 5 slot.

- **Loại thứ ba `drive`, 5 slot riêng** (`params.ts` dùng chung cho khách và máy chủ). Tên trong sảnh: thêm danh sách người lái.
- **Giao thức** (mở rộng, không đổi nghĩa trường cũ): `join.kind` nhận `'drive'`; `lobby` thêm `drivers`; `pos` phát thêm nhóm `d`; mỗi phần tử gồm slot, x, y, z, hướng xe, một trường gói **tốc độ có dấu và góc lái** (để bánh quay / bẻ lái và nội suy mượt), `ts`. Cách gói do người làm chọn.
- **Kẹp ở máy chủ:** khung vùng lái (ước lượng x −1950..1500, z −3050..1450, y −16..35, người làm lấy từ hình học thật), tốc độ ≤ tốc độ tối đa + dư nhỏ.
- **Tần suất gửi** như hiện có (5 Hz) nếu nội suy đủ mượt ở 100 km/h; nếu xe người khác giật thì ngoại suy theo tốc độ + hướng ở máy khách trước khi nghĩ tới tăng tần suất **(Claude)**.
- **Tương thích hai chiều (bắt buộc, có test):**
  - khách mới + máy chủ cũ: sảnh không có `drivers` → lái một mình, không lỗi (mẫu `offline()` của đi dạo);
  - khách cũ + máy chủ mới: khách cũ phải bỏ qua `drivers` và nhóm `d` mà không lỗi; người làm kiểm bằng mã khách đang chạy trên `main` trước khi deploy.
- **Hiển thị chéo:** người bay dù và người đi dạo thấy xe + tên người lái; người lái thấy dù và người đi dạo. Danh sách và nhãn tên gồm cả ba loại. Người thứ 6 xem bám một xe.
- **Deploy Worker:** cần, và **phải hỏi người dùng riêng** trước khi chạy `npm --prefix server/multi run deploy`. Deploy máy chủ trước, bản khách sau.

## 8. Giao diện và i18n

- Thẻ "Ô tô": bỏ khóa, bỏ chữ "Sắp có", mô tả ngắn. Thẻ `data-pick="bike"` (nhãn "Xe máy") giữ nguyên khóa.
- HUD riêng của chế độ (mẫu `#stHud`): nút thoát, đồng hồ tốc độ, bản đồ nhỏ (canvas 2D, vẽ từ chính dữ liệu mạng đường của mục 6 để không lệch), gợi ý phím, bàn đạp và cần gạt cảm ứng. Vùng chạm ≥ 44 px.
- Mọi chuỗi mới đủ 9 ngôn ngữ (`vi, en, ko, ja, zh, th, ar, hi, ru`); `ar` là RTL (bố cục bàn đạp / cần gạt **không** lật theo RTL, chỉ chữ) **(Claude)**. Bản dịch 8 ngôn ngữ ghi là cần người bản ngữ duyệt.
- Không ghi "phương án đề xuất" cho xe; riêng Hầm vượt sông Hàn vẫn là công trình chưa xây: nhãn trên bản đồ nhỏ ghi "Hầm (phương án đề xuất)".

## 9. Ràng buộc dự án

- **Chuỗi `rand()`:** không thêm / bớt lời gọi, không đổi thứ tự `build*()`. Ngẫu nhiên mới (nếu có) dùng `rng(seed)`.
- **Draw call:** mọi góc nhìn trong bảng `tests/KET-QUA.md` tăng **0** khi không ở chế độ lái và không có người lái nào (đường và đất mới gộp vào lưới cũ). Khi có xe: mỗi chiếc ≤ 6 lệnh vẽ (thân theo vật liệu đã gộp + bánh); 6 chiếc cùng lúc ≤ 36. HUD là DOM / canvas 2D, không tốn lệnh vẽ 3D.
- **Mô hình ngoài:** theo D-033 (giấy phép, ghi nguồn, tệp `LICENSE-*`, trần dung lượng có test, đường lùi).
- **Không thư viện runtime mới; không `PointLight` / `SpotLight`;** đèn xe là emissive đọc `shared.uNight`.
- **Thông số** ở `CONFIG.drive` trong `src/config.ts`, chú thích tiếng Việt, đơn vị, nguồn hoặc `(ước lượng)`. Tham số dùng chung với máy chủ ở `src/explore/multi/params.ts`, có test kiểm hai bên bằng nhau (mẫu `mapData.test.ts` kiểm `bounds`).
- **Mã:** thư mục `src/explore/drive/`, tiền tố hàm `dr*`; comment tiếng Việt; README mục Cấu trúc thêm `src/explore/drive/`, `public/car/`, `scripts/car/`.
- Tour, tham quan, dù lượn, đi dạo không đổi hành vi.

## 10. Kiểm tra

Lệnh mới (thêm vào `copilot-instructions.md` §5):
- `npm run test:drive:unit` (nhanh, không trình duyệt): đường cong tăng tốc qua hai mốc công bố; tốc độ tối đa; bán kính quay vòng nhỏ nhất; giới hạn lái theo tốc độ; va chạm hình chữ nhật có hướng (trượt, không xuyên ở 100 km/h với khung dài); **mạng đường liền** (từ điểm xuất phát tới được mọi đoạn, mọi cầu, cả hai ống hầm; tìm đường trên đồ thị đoạn); chuyển tầng chỉ ở chỗ nối; xe tự động chặn khi người chơi lao vào, đi xuyên khi nó chạm người chơi, không kẹt khi chồng nhau; bàn phím và cảm ứng; tệp `public/car/vf3.glb` (trần dung lượng, tam giác, 4 bánh, không còn lưới biển số, có tệp giấy phép); tham số khách = máy chủ.
- `npm run test:drive` (trình duyệt, đọc `dist/`): vào chế độ từ thẻ và từ `?explore=drive`; xuất phát đúng chỗ; lái tự động theo kịch bản qua từng cầu và hầm, kiểm xe luôn nằm trên mặt đường (cao độ khớp hàm cao độ) và không nằm trong tòa nhà (đối chiếu danh sách nhà thật, gồm cả nhà quanh Thuận Phước); barie Cầu sông Hàn; camera trong hầm không thấy mặt nước; đèn theo đêm; hình tạm khi chặn `vf3.glb`; HUD máy tính; 9 ngôn ngữ; ảnh chụp để xem tay.
- Mở rộng: `test:multi:unit` (loại thứ ba, 5 + 5 + 5, kẹp, khôi phục), `test:multi:worker`, `test:multi` (một mục lái xe: hai máy thấy nhau, người thứ 6 xem), `test:mobile` (bàn đạp, cần gạt, thẻ Ô tô), `test:explore` (màn chọn).
- Chạy lại vì cảnh đổi: `test:drawcalls` (ghi bảng mới vào `tests/KET-QUA.md`), `test:traffic` và `test:trees` (chuỗi `rand()` và vị trí giữ nguyên), `test:riverfront`, `test:tunnel`, `test:stroll`, `test:perf -- --strict`, `test:gpu`, `test:citynight -- --baseline` rồi chạy thường.
- Theo thói quen của dự án, test nặng (SwiftShader) chạy một lần ở cuối nhánh; báo đúng cái nào đã chạy / chưa chạy.

## 11. Để người làm quyết

Dạng hàm tăng tốc; biểu diễn va chạm của xe (OBB hay nhiều hình tròn); cấu trúc dữ liệu đoạn đường / đồ thị; hình dạng chính xác của nhánh rẽ, nút giao, đất mới; có cột đèn trên đường mới hay không; cách gói tốc độ + góc lái trong `pos`; thông số camera (khoảng cách, độ cao, độ trễ, thời gian tự về); tổng hợp âm thanh; cách gộp lưới và nén ảnh trong `gen:car`; bố cục chi tiết HUD trong khuôn khổ bản phác đã duyệt.

**Chia việc và model (ND yêu cầu chia model cho phù hợp; dùng agent con khi thực hiện plan):**
- **Opus** (phần khó, sai là hỏng): mạng đường nhiều tầng + va chạm xe (mục 6); chuyển động xe (mục 5.2); dựng đường / đất mới mà không đổi `rand()` và draw call (mục 4); giao thức và máy chủ nhiều người + tương thích hai chiều (mục 7); camera trong hầm.
- **Sonnet** (theo mẫu có sẵn): script `gen:car` và bộ nạp + hình tạm (mẫu `convert.py`, `rig.ts`); HUD, bản đồ nhỏ, cần gạt / bàn đạp (mẫu `stroll/touch.ts`, `stick.ts`); i18n 9 ngôn ngữ; âm thanh; test đơn vị và test trình duyệt (mẫu `stroll-check.mjs`); cập nhật tài liệu / memory bank.
- Review cuối mỗi giai đoạn bằng model khác với model đã viết phần đó.

## 12. Nguồn

- Mô hình: `https://sketchfab.com/3d-models/vinfast-vf3-6a2caea4505347d18c47ef4d47840859` (Hoàng Huy, CC-BY-4.0).
- Số liệu xe: `https://vnexpress.net/vf-3-xe-dien-re-nhat-cua-vinfast-co-gi-4744294.html` · `https://bonbanh.com/chi-tiet-thong-so-ky-thuat-xe-vinfast-vf3-plus-2026-18369` · `https://bonbanh.com/chi-tiet-thong-so-ky-thuat-xe-vinfast-vf3-eco-2026-18716` · `https://vinfastauto.id/vf3` · `https://www.autofun.co.id/berita/intip-spesifikasi-vinfast-vf-3-pesaing-wuling-air-ev-berbodi-suv-83941` · `https://www.auto-data.net/en/vinfast-vf-3-18.64-kwh-44hp-electric-51794`. Các số lấy qua kết quả tìm kiếm ngày 2026-11-12, chưa mở từng trang để đối chiếu; người làm đối chiếu lại khi ghi vào `config.ts`.
