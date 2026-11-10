# Thiết kế: Xe cộ trên cầu và đường trông thực tế hơn

_2026-11-10 · Ảnh tham chiếu do người dùng cung cấp:_
- _Ô tô (đoàn siêu xe): <https://media.auto5.vn/files/hoanghai98/2021/05/27/1-084451.jpg>_
- _Xe máy (xe tay ga): <https://izigo.vn/wp-content/uploads/2026/01/izigo-vn-4.jpg>_
- _Xe buýt (buýt nhỏ vàng Đà Nẵng): <https://www.danangbus.vn/UploadImages/z4587494461607_92430e8ae763cf63fe0f38e5753f1a0b.jpg>_

_Bản dựng thử người dùng đã duyệt (three.js, một file HTML, chỉ để tham chiếu hình dáng, không phải code dự án): `docs/superpowers/specs/tham-chieu/xe-co/xe-dung-thu.html` cùng ảnh chụp `ban-dung-thu-ngay.png` và ba ảnh gốc (`car.jpg`, `bike.jpg`, `bus.jpg`). Thư mục `tham-chieu/` nằm trong `.gitignore`, chỉ có trên máy người dùng._

## 1. Ý định

Người dùng thấy mọi phương tiện đang chạy "chỉ là các ô vuông di chuyển", **nhìn góc nào cũng vuông**. Họ muốn xe trông thực tế hơn, theo ba ảnh tham chiếu:

- **Ô tô** giống siêu xe: thân thấp và bẹt, mũi nhọn, khoang kính hình giọt nước, cánh gió sau, màu rực.
- **Xe máy** giống xe tay ga: yếm trước, sàn để chân, yên dài, hai bánh nhỏ.
- **Xe buýt** giống buýt nhỏ vàng của Đà Nẵng: thân vàng, dải xanh trắng chạy chéo dọc thân, dải cửa sổ tối.

Người dùng đã xem bản dựng thử đặt cạnh xe khối hộp hiện tại và nói: "Tôi đồng ý với mẫu đề xuất". Hình dáng trong bản dựng thử là mốc tối thiểu, **chấm bằng ảnh nghiệm thu ở §7** (nhìn gần khoảng 10 m và nhìn từ góc cầu), không chấm theo từng chi tiết của file dựng thử. Người dựng được làm đẹp hơn (bo tròn hơn, bớt góc cạnh) và được bỏ chi tiết không nhìn ra ở 10 m (vành bánh, khuếch tán sau, cánh gió trước, số cạnh bánh xe).

## 2. Hiện trạng (để người dựng định hướng)

| Hệ xe | Chỗ | Số xe | Ghi chú |
|---|---|---|---|
| Khu phố: Cầu Rồng, 2 làn trong của Trần Thị Lý, đường Bạch Đằng, Trần Hưng Đạo | `src/environment/traffic.ts` (`buildTraffic` / `updateTraffic`) | 536 | Gắn vào `scene`. Dùng `rand()` chung (bất biến §3.1 của `copilot-instructions.md`). `PATHS.ttl.hidden` tắt làn bằng nút. Xe trên Cầu Rồng và Trần Thị Lý bị dọn khi bão. |
| Làn ngoài Trần Thị Lý | `src/bridges/tran-thi-ly/life.ts` | theo `lanes` | `createTraffic`, seed 731, buýt `0xe8b923` |
| Thuận Phước | `src/bridges/thuan-phuoc/life.ts` | theo `lanes` | seed 405, buýt `0x2f7fc1` |
| Cầu sông Hàn | `src/bridges/song-han/life.ts` | 52 | seed 2000, buýt `0x2f7fc1`. `shStepTraffic` cho xe xếp hàng trước barie khi cầu quay, cách nhau 7,5 m. |
| Hầm vượt sông Hàn | `src/bridges/han-tunnel/HanTunnel.ts` | 348 | seed 3100, buýt `0xe0a21b`. `closable = false` (hầm vẫn lưu thông khi bão). Chỉ vẽ khi camera gần hơn `HR.lifeDistance`. |

- Phần dùng chung ở `src/common/traffic.ts`: bảng kích thước `TYPES` (`car`, `bus`, `bike`), `CAR_COLORS`, `BIKE_COLORS`, `placePart`, `createTraffic`, `stepTraffic`.
- Mỗi hệ có 4 `InstancedMesh` hộp đơn vị: thân (`MAT.vehicle`, màu theo instance, `castShadow`), cabin (`MAT.glass`), đèn pha (`MAT.headLamp`), đèn hậu (`MAT.tailLamp`). Hai mesh đèn chỉ hiện khi `shared.uNight > 0.3`. Vậy mỗi hệ tốn 2 lệnh vẽ ban ngày, 4 ban đêm, cộng lượt vẽ bóng của thân và lượt phản chiếu (hệ khu phố nằm ở layer 0).
- `src/core/dayNight.ts` bật/tắt `vHead` / `vTail` của hệ khu phố. `src/bridges/han-tunnel/cutaway.ts` liệt kê `MAT.vehicle`, `MAT.glass`, `MAT.headLamp`, `MAT.tailLamp` trong tập vật liệu bị mặt cắt bóc.
- Tiền lệ nên đọc trước: tàu thuyền (D-026), `src/environment/boats/` và [spec tàu thuyền](2026-11-10-tau-thuyen-song-han-design.md). Ở đó mỗi đội tàu là một `InstancedMesh`, hình học gộp nhiều kiểu, chọn kiểu theo thuộc tính instance, đèn đêm bằng emissive trong shader.

## 3. Mục tiêu

| # | Hạng mục | Yêu cầu | Nguồn |
|---|---|---|---|
| G1 | Ô tô | Mọi ô tô thành siêu xe: thấp, bẹt, mũi vuốt nhọn, khoang kính giọt nước lùi về giữa, nắp máy sau, cánh gió sau, bốn bánh thấy rõ. Không còn ô tô thường. | người dùng |
| G2 | Màu ô tô | Bảng màu rực như ảnh: cam, vàng, đỏ, trắng, và vài màu nữa (ví dụ xanh dương, xanh lá, xám đậm, đen). Thay bảng trắng / xám / đen hiện tại. | người dùng đồng ý đề xuất của agent; danh sách màu cụ thể do người dựng chọn |
| G3 | Xe máy | Xe tay ga có yếm, sàn để chân, yên, đầu đèn tròn, hai bánh; **có người lái** đội mũ bảo hiểm. Màu xe, màu áo, màu mũ khác nhau giữa các xe. | người dùng duyệt bản dựng thử; người lái là đề xuất của agent, người dùng đồng ý |
| G4 | Xe buýt | Buýt nhỏ dài khoảng 7 m: thân vàng, dải xanh dương viền trắng chạy chéo dọc thân, dải cửa sổ tối, kính lái nghiêng, cục điều hòa trên nóc. **Mọi hệ xe dùng chung kiểu buýt này**, kể cả Thuận Phước và Cầu sông Hàn đang dùng buýt xanh. | người dùng đồng ý đề xuất của agent |
| G5 | Đèn đêm | Như hiện tại: đèn pha trắng ấm ở đầu, đèn hậu đỏ ở đuôi, chỉ sáng khi đêm (`shared.uNight > 0.3` hoặc nhân `uNight`). Xe máy một đèn pha. Độ sáng nhìn từ góc cầu tương đương hiện tại. | giữ hành vi cũ |
| G6 | Phạm vi | Cả năm hệ xe ở §2 đổi cùng lúc, cùng một bộ hình. | người dùng đồng ý |
| G7 | Nhìn từ mọi góc | Nhìn gần (10–30 m, như khi lái xe trong hầm hoặc bay dù lượn sát cầu) thấy rõ dáng từng loại. Nhìn từ các góc cầu (khoảng 80–300 m) vẫn phân biệt được ô tô, xe máy, xe buýt và không còn cảm giác "hàng hộp". | người dùng ("góc nào cũng là ô vuông") |

## 4. Ngoài phạm vi

- Không đổi số xe, làn, tốc độ, chiều chạy, tỉ lệ xe máy / buýt / ô tô của bất kỳ hệ nào.
- Không đổi hành vi: xếp hàng trước barie Cầu sông Hàn, dọn xe khi bão, tắt làn `PATHS.ttl`, ẩn xe hầm theo khoảng cách, hầm vẫn lưu thông khi bão.
- Không làm bánh xe quay, đèn xi nhan, xe đổi làn, xe vượt nhau, va chạm, tiếng động cơ.
- Không thêm xe tải, taxi, xe đạp, xích lô hay ô tô thường.
- Không thêm UI, nút, khóa i18n; không đổi Tour hay lời thuyết minh.
- Không đổi xe mô phỏng thi công hầm (sà lan, tàu kéo) và không đổi tàu thuyền.

**Coi là hỏng dù vẫn chạy được:**
- Từ góc cầu nhìn vẫn như khối hộp.
- Xuất hiện logo, tên hãng xe hay tên đơn vị vận tải có thật (McLaren, Audi, VinFast, DanaBus, FUTA…), hoặc biển số thật.
- Draw call tăng ở bất kỳ góc nhìn cũ nào.
- Vị trí nhà, cây, xe, tàu xê dịch so với `main` (chuỗi `rand()` bị lệch).
- Xe máy chạy mà không có người lái.
- Xe chìm xuống mặt đường, lơ lửng, hoặc chạy lùi (đầu xe quay ngược hướng chạy).
- Xe xếp hàng trước barie Cầu sông Hàn chồng lên nhau.

## 5. Ràng buộc (bất biến của dự án)

- **`rand()`:** `buildTraffic()` giữ đúng số lời gọi và thứ tự như hiện tại. Mỗi xe: 1 lời gọi chọn loại, 1 lời gọi vị trí, và **chỉ ô tô** có thêm 1 lời gọi chọn màu (`Math.floor(rand() * số màu)`). Đổi nội dung bảng màu thì được, kể cả đổi số màu, vì số lời gọi không đổi. Thứ tự `build*()` trong `src/main.ts` giữ nguyên. Các hệ theo cầu giữ `rng(seed)` với seed hiện có và đúng thứ tự lấy số. Mọi phần ngẫu nhiên mới (màu áo, màu mũ, biến thể) dùng hash theo chỉ số hoặc `rng` riêng.
- **Draw call:** ở mọi góc nhìn cũ, cả ngày lẫn đêm, không cao hơn bảng trong `tests/KET-QUA.md` (dao động `swTour` đã biết, D-018, không tính). Tính cả lượt bóng và lượt phản chiếu. Ban ngày mỗi hệ đang tốn 2 lệnh vẽ, nên **ba mesh riêng cho ba loại xe là không đạt**. Hướng đã có tiền lệ: một `InstancedMesh` cho mỗi hệ, hình học gộp ba loại, chọn loại theo thuộc tính instance (D-026). Kỳ vọng mỗi hệ còn 1 lệnh vẽ cả ngày lẫn đêm.
- **Số đỉnh:** với cách gộp của D-026, mỗi instance tốn đỉnh của mọi loại trong mesh. Hệ khu phố có 536 xe, hầm 348 xe, nên tổng đỉnh ba loại phải nhỏ. Bản dựng thử tốn khoảng 3 000 đỉnh cho ba loại (ước lượng), quá nặng nếu nhân với 536 xe và ba lượt vẽ (cảnh, bóng, phản chiếu).
  - Mốc định hướng (quyết định của agent): cả ba loại cộng lại khoảng 1 500–2 000 đỉnh, đạt được bằng cách bỏ chi tiết không thấy ở 10 m. Đây là mốc, không phải trần cứng.
  - Khi dáng xe và số đỉnh xung đột: giữ dáng nhìn được ở 10 m, rồi giảm tải theo thứ tự: bỏ xe khỏi lượt bóng, bỏ xe khỏi lượt phản chiếu nếu ảnh không đổi đáng kể, cuối cùng mới đổi kiến trúc (ví dụ các loại dùng chung khe đỉnh).
  - Thước đo: `test:perf` đã in ms trung bình từng bước ở 5 góc. Bước `traffic` và `render` không được tăng quá 15 % so với `main` đo cùng máy, cùng lần (`test:perf` chạy nhanh, đo `main` làm mốc là được phép). `--strict` vẫn phải đạt nhưng tự nó không đo tải đỉnh. FPS trên GPU thật chưa đo được, ghi vào phần còn thiếu.
- **Đèn:** không thêm `PointLight` / `SpotLight`. Đèn pha, đèn hậu bằng emissive.
  - Mốc so: bảng mới nhất trong `tests/KET-QUA.md` (đo tại `9ae6c2a`). `test:drawcalls` chỉ chạy một lần cuối nhánh. Chỉ khi lần đó có góc tăng mới đo thêm bản build của `main` để tách phần do xe với phần D-023 / D-026 chưa đo.
- **Hình ảnh:** không ảnh ngoài, không thư viện runtime mới. Dải xanh trắng và cửa sổ xe buýt làm bằng màu đỉnh hoặc texture canvas.
- **Thông số ở `src/config.ts`:** kích thước từng loại, bảng màu ô tô, màu xe máy, màu áo và mũ, màu buýt, độ sáng đèn. Mỗi dòng chú thích tiếng Việt, đơn vị, `(ước lượng)` nếu không có nguồn. Các hằng `TYPES`, `CAR_COLORS`, `BIKE_COLORS` đang nằm trong `src/common/traffic.ts` chuyển về `config.ts` trong đợt này.
- **Hiệu năng:** `test:perf --strict` đạt. Vật liệu mới được `src/core/prewarm.ts` biên dịch trước; không có chương trình shader mới biên dịch sau khởi động. Giữ nguyên tắc không cấp phát mỗi khung (D-018).
- **Mặt cắt hầm:** vật liệu xe mới phải nằm trong tập vật liệu bị bóc của `cutaway.ts`, để chế độ mặt cắt vẫn bóc đúng ô tô ở nửa phía Bắc và giữ xe máy.
- **Bóng đổ:** nếu xe còn đổ bóng thì lượt vẽ bóng không được vẽ chồng mọi loại xe (xem `btDepthMaterial`).

## 6. Kích thước (mốc cho `config.ts`)

| Loại | Dài × rộng × cao (m) | Nguồn |
|---|---|---|
| Siêu xe | 4,5 × 1,95 × 1,2 | xấp xỉ McLaren 720S (4,54 × 1,93 × 1,20 theo công bố của hãng); người dựng kiểm lại trước khi ghi nguồn, nếu không thì ghi `(ước lượng)` |
| Xe tay ga + người lái | 1,8 × 0,7 × 1,6 (xe cao khoảng 1,1) | ước lượng |
| Xe buýt nhỏ | 7,0 × 2,1 × 2,7 | ước lượng theo ảnh |

Xe buýt ngắn đi (11 m → 7 m) là thay đổi có chủ ý. Khoảng cách xếp hàng 7,5 m trước barie Cầu sông Hàn giữ nguyên; buýt 7 m vừa khít nên hết cảnh buýt đè lên xe sau.

Hệ quả cần biết: làn xe trong hầm rộng 3,5 m, siêu xe rộng 1,95 m và buýt 2,1 m đều vừa.

## 7. Tiêu chí nghiệm thu

1. **Ảnh chụp cho người dùng duyệt**, ngày và đêm, ít nhất ở: mặt Cầu Rồng nhìn gần, góc toàn cảnh Cầu Rồng, Cầu sông Hàn lúc xe xếp hàng trước barie, trong hầm (góc lái xe), đường Bạch Đằng.
2. **Test tự động mới** `test:traffic` (đọc `dist/`, theo mẫu `tests/boats-check.mjs`), kiểm tra:
   - số xe từng hệ và loại của từng xe trùng `main`;
   - vị trí ban đầu và tốc độ của xe hệ khu phố trùng `main` (chứng minh chuỗi `rand()` không lệch); vị trí vài nhà hoặc cây dựng sau `buildTraffic()` cũng trùng;
   - không còn mesh hộp cũ; mỗi hệ đúng số lệnh vẽ đã chọn;
   - đèn chỉ sáng khi đêm;
   - bão: xe trên các cầu bị dọn, xe trong hầm vẫn chạy;
   - Cầu sông Hàn quay: xe dừng trước barie, không xe nào chồng lên xe khác.
3. `npm run typecheck`, `npm run build` đạt. `test:tunnel`, `test:explore`, `test:citynight` chạy vì xe hiện trong các cảnh đó; `test:citynight` cần chụp lại mốc `--baseline` nếu ảnh ban ngày đổi do xe, ghi lý do vào `tests/KET-QUA.md`.
4. Đủ bộ test ở §5 của `copilot-instructions.md` chạy **một lần cuối nhánh**, không chạy song song với việc khác. `test:drawcalls` không có góc cũ nào tăng; số mới ghi vào `tests/KET-QUA.md`.
5. Ghi quyết định kiến trúc vào `.github/memory-bank/decisions.md` (D-027) và cập nhật memory bank, README nếu thêm thư mục.

## 8. Để người dựng tự quyết

- Cách dựng hình (lofting theo mặt cắt như bản dựng thử, `mergeGeometries`, số phân đoạn) và mức bo tròn.
- Cách đạt ngân sách draw call và đỉnh; có đơn giản hóa xe ở xa hay không (chỉ làm nếu cần để đạt `test:perf`).
- Một hay hai kiểu dáng siêu xe. Một kiểu là đủ; kiểu thứ hai chỉ thêm khi ngân sách đỉnh cho phép.
- Màu theo instance làm bằng `instanceColor`, thuộc tính riêng hay bảng màu trong shader.
- Dải xanh trắng của buýt bằng màu đỉnh hay texture canvas.
- Tư thế và mức chi tiết người lái (tối thiểu: thân, đầu có mũ, tay tới ghi đông, chân).
- Giữ `castShadow` cho xe hay không.
- Tên file, cách chia module (gợi ý: `src/common/vehicles/`, tiền tố hàm `vh*`).
- Danh sách màu cụ thể, miễn rực và đủ khác nhau.

## 9. Quyết định do agent đưa ra (người dùng có thể bác)

- Xe máy có người lái đội mũ bảo hiểm (người dùng đã đồng ý trên bản dựng thử).
- Xe buýt loại nhỏ 7 m thay khối 11 m; một kiểu buýt vàng cho mọi cầu, bỏ buýt xanh.
- Không vẽ logo, tên hãng, biển số thật.
- Bánh xe không quay.
- Chuyển `TYPES`, `CAR_COLORS`, `BIKE_COLORS` về `config.ts`.
- Có test mới `test:traffic`.
- Mục tiêu draw call: không tăng ở mọi góc cũ; kỳ vọng giảm.
- Làm trên nhánh `feature/xe-co-thuc-te`.
- Sau builder check: mốc đỉnh 1 500–2 000 và thứ tự nhượng bộ khi dáng xe xung đột với số đỉnh; ngưỡng 15 % cho bước `traffic` / `render`; mốc draw call là bảng `9ae6c2a`, chỉ đo `main` khi có góc tăng.
