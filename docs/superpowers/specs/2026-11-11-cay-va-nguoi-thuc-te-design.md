# Thiết kế: Cây cối và người đi bộ trông thực tế hơn

_2026-11-11 · Ảnh tham chiếu do người dùng cung cấp (pngtree, có watermark, **chỉ để xem dáng, không được dùng làm texture**):_
- _Cây bóng mát: `docs/superpowers/specs/tham-chieu/cay-va-nguoi/cay-bong-mat.png`_
- _Cây dừa: `docs/superpowers/specs/tham-chieu/cay-va-nguoi/cay-dua.png`_

_Bản dựng thử người dùng đã duyệt (three.js, một file HTML, chỉ để tham chiếu hình dáng và chuyển động, không phải code dự án): `docs/superpowers/specs/tham-chieu/cay-va-nguoi/cay-va-nguoi-dung-thu.html` (mở qua máy chủ tĩnh, ví dụ `npx vite docs/superpowers/specs/tham-chieu/cay-va-nguoi`, rồi vào `/cay-va-nguoi-dung-thu.html`), cùng ảnh chụp `ban-dung-thu-*.png`. Thư mục `tham-chieu/` nằm trong `.gitignore`, chỉ có trên máy người dùng._

## 1. Ý định

Người dùng thấy cây và người trong demo "không giống thực tế lắm":

- **Người** "chỉ là các hình khối rất thiếu sức sống". Họ muốn người trông thật hơn, và giao agent quyết chi tiết với điều kiện "phù hợp và sống động, gần gũi".
- **Cây** "chỉ là các ô tròn", "nên được cập nhật cho phù hợp với cây cối ở Đà Nẵng". Họ đưa hai ảnh mẫu: một cây bóng mát tán rộng và một cây dừa.

Người dùng đã xem bản dựng thử đặt cạnh cây và người hiện tại, qua ba vòng:

1. Cây bóng mát và cây dừa: "cây ổn".
2. Người đi bộ: bản đầu "bước quá dài và không tự nhiên"; bản sửa (bước ngắn, có gối, có khuỷu): "dáng người đi bình thường ổn".
3. Người chạy bộ: bản đầu "không giống lắm"; bản sửa (nhịp nhanh, thân đổ trước, gối gập sâu, bật lên giữa hai bước): "đồng ý".

Hình dáng và chuyển động trong bản dựng thử là **mốc tối thiểu về cảm nhận**, chấm bằng ảnh và quan sát ở §8, không chấm theo từng chi tiết của file dựng thử. Bản dựng thử không tính tới hiệu năng (tán cây ở đó tốn khoảng 29 000 tam giác); người dựng phải giản lược để đạt §6.

## 2. Hiện trạng (để người dựng định hướng)

### Cây

| Chỗ | File | Dạng | Ghi chú |
|---|---|---|---|
| Hai bờ sông, đường dẫn hai đầu Cầu Rồng, công viên đầu cầu | `src/environment/trees.ts` (`buildTrees`) | 4 `InstancedMesh`: thân + tán cầu (`MAT.trunk`, `MAT.leaf`), thân + tán nón (`MAT.trunk`, `MAT.palm`) | Dùng `rand()` chung. Bờ sông: cứ 14 m một cây mỗi bờ, một phần ba là "dừa". Đường dẫn: cứ 16 m. Công viên: 160 cây. Tổng trên một nghìn cây. |
| Kè mới khu Thuận Phước | `src/bridges/thuan-phuoc/site.ts` | thân + tán cầu, cùng vật liệu | `rnd` riêng của cầu |
| Hàng cọ ven đường dẫn hầm | `src/bridges/han-tunnel/outdoor.ts` (`hrBuildDecor`) | trụ + nón, **gộp vào lưới bê tông** của hầm (màu theo đỉnh, 0 lệnh vẽ riêng) | `rng(7001)` |

Cây tán cầu: thân cao `h` = 3–5,5 m, tán bán kính `r` = 2,4–4,2 m (dẹt 0,85), màu xanh đổi theo instance. Cây "dừa": thân cao 8–12 m, tán là hình nón mở úp rộng 3,8 m.

Các phần đang dựa vào cấu trúc cây hiện tại:

- **Gió** (`src/environment/weather/wind.ts`): vá vertex shader của `MAT.leaf` và `MAT.palm`, dịch đỉnh theo hướng gió tỉ lệ với độ cao trên mặt đất. Thân (`MAT.trunk`) không lắc.
- **Cây đổ sau bão** (`src/environment/weather/fallen.ts`): tìm cặp "thân `MAT.trunk` đứng ngay trước tán `MAT.leaf` / `MAT.palm` trong cùng cha, cùng số instance", nghiêng cả hai quanh gốc rồi ghi lại đúng ma trận gốc.
- **Dây đèn quấn cây ở dải đi bộ Bạch Đằng** (`src/environment/riverfront/promenade.ts`, `collectTrees`): đọc vị trí và tỉ lệ instance của tán để rải điểm đèn quanh tán (bán kính `r × 0,95`) và dọc thân.
- **Dọn cây** bằng scale 0 theo tập vật liệu: `hideBankTrees()` trong `SongHanBridge.ts`, `han-tunnel/corridor.ts`, `riverfront/clearance.ts`; mặt cắt hầm `han-tunnel/cutaway.ts` cũng liệt kê các vật liệu này.

### Người

- Dùng chung `src/common/people.ts`: mỗi người là một ống trụ gộp một quả cầu, một `InstancedMesh` cho mỗi cầu, 7 màu áo, trượt dọc lề và nhún 5 cm. Nhóm người nằm trong `noReflect`, không đổ bóng.
- **Cầu Trần Thị Lý** (`tran-thi-ly/life.ts`): 46 người trên lề cầu, 34 người trên cầu Nguyễn Văn Trỗi. `rng(1965)`.
- **Cầu sông Hàn** (`song-han/life.ts`): 36 người trên lề phần cầu cố định, 40 người trên lề ven sông Bạch Đằng (đi dọc trục Z). `rng(2903)`.
- Mỗi cầu có nút bật/tắt người (`btnTtlPeople`, `btnShPeople`), và người ẩn theo `details.visible`.
- **Cầu Rồng và Cầu Thuận Phước chưa có người.** Cầu Rồng có lề 2,5 m mỗi bên (`CONFIG.sidewalk`), cao độ theo `deckY(x)`, dựng trong `src/bridges/dragon/deck.ts`; Cầu Rồng không phải lớp `BridgeBase`.
- Khi bão, xe bị dọn dần qua `vanished(i, weatherFx.clear)` trong `src/common/traffic.ts`; người không có bước dọn dần riêng (người dựng kiểm `BridgeBase.update` xem nhóm nào đang bị ẩn khi `weatherFx.clear` đạt 1). G10 nghĩa là: người biến mất **dần** như xe, ở cả ba cầu, kể cả Cầu Rồng không thuộc `BridgeBase`.

Tiền lệ nên đọc trước: xe cộ (D-027, `src/common/vehicles/`, [spec](2026-11-10-xe-co-thuc-te-design.md)) và tàu thuyền (D-026). Ở đó mỗi hệ là một `InstancedMesh`, hình học gộp, biến thể chọn theo thuộc tính instance trong shader.

## 3. Mục tiêu

| # | Hạng mục | Yêu cầu | Nguồn |
|---|---|---|---|
| G1 | Cây bóng mát | Mọi cây tán cầu thành cây bóng mát: gốc xòe, thân tách thành vài cành lớn tỏa ra, tán vòm dẹt rộng hơn cao, ghép từ nhiều cụm lá nên mép tán lồi lõm, sáng ở trên và sẫm ở dưới và trong khe. Xanh lá tươi. | người dùng (ảnh mẫu, duyệt bản thử) |
| G2 | Cây dừa | Mọi cây "nón" thành cây dừa: thân mảnh xám nâu có vòng sẹo, cong nhẹ, gốc hơi phình; búi ngọn có vài quả dừa; nhiều tàu lá răng lược tỏa đủ hướng, tàu non dựng đứng, tàu già vươn ngang rồi rũ xuống quá búi ngọn. | người dùng (ảnh mẫu, duyệt bản thử) |
| G3 | Phạm vi cây | Đổi ở cả ba chỗ trong §2 (khu phố, Thuận Phước, hàng cọ cửa hầm) để cả cảnh đồng nhất. Vị trí, chiều cao và độ rộng từng cây giữ như hiện tại (lấy từ cùng các số ngẫu nhiên). | đề xuất của agent, người dùng đồng ý |
| G4 | Cây không lặp | Các cây cùng loại không trông như bản sao: khác hướng xoay, cỡ, sắc xanh. | quyết định của agent |
| G5 | Người có dáng | Người có đầu, tóc, thân, hai tay, hai chân có khớp gối và khuỷu, bàn chân; áo và quần khác màu; cao thấp khác nhau. | người dùng duyệt bản thử |
| G6 | Dáng đi | Bước ngắn tự nhiên, gối gập khi đưa chân lên trước, tay vung nhẹ ngược nhịp chân, thân nhún và lắc vai nhẹ. **Nhịp bước khớp tốc độ đi, chân không trượt trên mặt đường.** Thông số đã duyệt ở §5. | người dùng ("dáng người đi bình thường ổn") |
| G7 | Dáng chạy | Người chạy bộ có dáng riêng, không phải dáng đi tua nhanh: nhịp nhanh, thân đổ về trước, gối gập sâu, khuỷu gập vuông, bật lên giữa hai bước. Thông số đã duyệt ở §5. | người dùng ("đồng ý") |
| G8 | Các kiểu người | Đi một mình; đi đôi cạnh nhau; người lớn dắt trẻ em; chạy bộ; đứng lan can quay mặt ra sông, vài người giơ tay chụp ảnh; vài người đội nón lá; vài người đeo ba lô. | người dùng giao agent quyết; đã thấy trong bản thử |
| G9 | Phạm vi người | Người mới thay người cũ ở Cầu Trần Thị Lý (cả cầu Nguyễn Văn Trỗi) và Cầu sông Hàn (cả lề ven sông Bạch Đằng), số người như cũ. **Thêm người lên hai lề Cầu Rồng.** Cầu Thuận Phước để trống. | đề xuất của agent, người dùng đồng ý |
| G10 | Bão | Khi cầu đóng vì bão (`closed`), người rời khỏi mọi chỗ ở G9, hết bão thì trở lại, giống xe cộ. | đề xuất của agent, người dùng đồng ý |
| G11 | Giữ hiệu ứng cây | Gió vẫn làm cây nghiêng và lắc; cây vẫn đổ sau bão và dựng lại đúng chỗ; dây đèn đêm ở dải đi bộ vẫn bám cây; cây vẫn bị dọn ở hành lang hầm, bờ sông, chân Cầu sông Hàn; mặt cắt hầm vẫn bóc được cây. | đề xuất của agent, người dùng đồng ý |
| G12 | Độ mượt | Không kém bản hiện tại (chi tiết ở §6). Cây ở xa được phép giản lược. | đề xuất của agent, người dùng đồng ý |

## 4. Ngoài phạm vi

- Không đổi vị trí, số lượng, mật độ cây. Không thêm loài cây khác (phượng, bàng, cau, hoa giấy…), không thêm bụi cỏ, bồn hoa.
- Không thêm người ở dải đi bộ ven sông ngoài 40 người đang có của hệ Cầu sông Hàn, không thêm người ở Cầu Thuận Phước, công viên, vỉa hè khu phố, Vòng quay Mặt Trời.
- Không đổi tốc độ, làn, chiều đi của người đang có ở Trần Thị Lý và Cầu sông Hàn, trừ những người được chọn làm người chạy bộ, người đứng, hoặc người đi cùng (đi đôi, trẻ em).
- Người không tránh nhau, không dừng lại rồi đi tiếp, không lên xuống cầu thang, không tương tác với xe, không ngồi, không đi xe đạp.
- Không làm khuôn mặt, ngón tay, tóc dài, váy, áo dài, nếp vải.
- Không thêm UI, nút, khóa i18n (Cầu Rồng không có nút bật/tắt người); không đổi Tour hay lời thuyết minh.
- Không đổi người treo dưới dù lượn, người lái xe tay ga (D-027), cây trong mô phỏng mặt cắt địa chất.
- Người và cây không phát sáng ban đêm (không thêm đèn, không thêm emissive).

**Coi là hỏng dù vẫn chạy được:**
- Từ các góc cầu nhìn cây vẫn như quả cầu trên que, hoặc cây dừa vẫn như cái ô.
- Chân người trượt trên mặt đường thấy rõ, người đi lùi, người lơ lửng hoặc chìm xuống lề, người đi xuyên lan can.
- Người chạy bộ trông như đi bộ tua nhanh.
- Vị trí nhà, cây, xe, tàu xê dịch so với `main` (chuỗi `rand()` bị lệch).
- Ảnh pngtree hoặc bất kỳ ảnh ngoài nào xuất hiện trong bản build.
- Cây đổ sau bão không dựng lại đúng chỗ, hoặc tán rời khỏi thân khi gió mạnh.
- Dây đèn đêm ở dải đi bộ treo lơ lửng ngoài cây.
- Độ mượt kém hẳn bản hiện tại.

## 5. Dáng đi và dáng chạy đã duyệt

Số trong bản dựng thử, là điểm xuất phát; người dựng được tinh chỉnh miễn G6, G7 vẫn đạt. Góc dương = đưa về phía trước. `φ` là pha của chu kỳ hai bước; chân trái dùng `φ`, chân phải `φ + π`, tay ngược pha với chân cùng bên.

| Thông số | Đi bộ | Chạy bộ |
|---|---|---|
| Tốc độ | 1,05–1,35 m/s (trẻ em đi cùng người lớn: theo người lớn) | 2,6–3,0 m/s |
| Biên độ hông `A` | 0,34 rad | 0,6 rad |
| Góc hông | `A·sin φ + 0,12·A` | `A·sin φ + 0,22` |
| Góc gối (gập về sau) | `2·A·max(0, cos(φ − 0,35))² + 0,06` | `0,38 + 1,5·max(0, cos(φ + 0,45))²` |
| Góc vai | `0,65·A·sin φ − 0,05` | `1,15·A·sin φ − 0,05` |
| Góc khuỷu | `0,16 + 0,35·A·max(0, sin φ)` | khoảng 1,4 rad cộng dao động nhỏ |
| Thân | thẳng | đổ về trước 0,17 rad quanh hông |
| Nhún | thấp nhất khi hai chân dang rộng, biên độ khoảng 4 cm | cao nhất giữa hai bước (pha bay), biên độ khoảng 7,5 cm |
| Nhịp | `ω = 2π·v / (4·L·sin A)`, `L` = chiều dài chân (0,86 m × tỉ lệ người), để chân trụ không trượt | khoảng 1,4 chu kỳ/giây (170 bước/phút) |
| Lắc vai | 1,8 cm sang hai bên theo `sin φ` | như đi bộ |

Người đứng: không vung tay chân, quay mặt ra phía sông. Người chụp ảnh: một tay giơ ngang tầm mắt (vai 1,0 rad, khuỷu 1,05 rad). Tỉ lệ người lớn 0,94–1,08; trẻ em khoảng 0,6.

Tỉ lệ các kiểu trong bản thử (26 người): 9 đi một mình, 3 đôi, 1 cặp người lớn và trẻ em, 4 chạy bộ, 6 đứng lan can (2 người chụp ảnh); khoảng một phần tư đội nón lá, một phần tư đeo ba lô. Người dựng giữ tỉ lệ gần như vậy trên mỗi cầu.

## 6. Ràng buộc (bất biến của dự án)

- **`rand()`:** `buildTrees()` giữ đúng số lời gọi và thứ tự như hiện tại: 1 lời gọi cho mỗi vị trí bờ sông và đường dẫn, 2 lời gọi cho mỗi vị trí công viên (cộng 1 để chọn phía), rồi 3 lời gọi cho mỗi cây tán cầu (cao, bán kính, sắc xanh) và 1 lời gọi cho mỗi cây dừa (cao). Thứ tự `build*()` trong `src/main.ts` giữ nguyên. Mọi phần ngẫu nhiên mới (hướng xoay cây, kiểu người, màu quần, nón, ba lô, pha bước) dùng hash theo chỉ số hoặc `rng(seed)` riêng. Người trên Cầu Rồng dựng bằng `rng(seed)` riêng, không gọi `rand()`.
- **Bộ sinh riêng của từng cầu:** `rng(1965)`, `rng(2903)`, `rnd` của Thuận Phước và `rng(7001)` giữ đúng thứ tự lấy số hiện có cho vị trí, hướng, tốc độ, kích thước, để người và cây đứng đúng chỗ cũ.
- **Draw call:** ở mọi góc nhìn cũ, cả ngày lẫn đêm, không cao hơn bảng trong `tests/KET-QUA.md`, **trừ +1 cho hệ người mới của Cầu Rồng** ở những góc thấy cầu này (dao động `swTour` đã biết, D-018, không tính). Tính cả lượt bóng và lượt phản chiếu. Hệ quả:
  - Cây khu phố vẫn 4 lệnh vẽ (thân + tán cho mỗi loại), cây Thuận Phước vẫn 2. Cành thuộc lưới thân, quả dừa và búi ngọn thuộc lưới thân hoặc lưới tàu lá. Chia cụm LOD kiểu `city.ts` sẽ làm tăng lệnh vẽ nên chỉ dùng nếu tổng vẫn không tăng.
  - Hàng dừa cửa hầm vẫn nằm trong lưới bê tông gộp (0 lệnh vẽ riêng). Lưới này không có texture trong suốt, nên tàu lá ở đây làm bằng hình học thuần (quyết định của agent: dải lá thuôn, không cần răng lược).
  - Mỗi hệ người vẫn 1 lệnh vẽ; mọi kiểu người, nón, ba lô nằm chung một hình học gộp, bật/tắt theo thuộc tính instance.
- **Số tam giác (quyết định của agent, chọn trước vì không đo so với `main`):** cây bóng mát tối đa 850 tam giác (tán ≤ 700, thân và cành ≤ 150), cây dừa tối đa 570 (tàu lá, búi ngọn, quả ≤ 450, thân ≤ 120), người tối đa 900 đỉnh. Ghi thành trần trong `CONFIG` và có unit test giữ. Với hơn một nghìn cây vẽ ba lượt (cảnh, bóng, phản chiếu), bản thử 29 000 tam giác mỗi cây là không dùng được. Nếu cần, giản lược cây ở xa trong vertex shader hoặc bỏ cây khỏi lượt phản chiếu, miễn không tăng lệnh vẽ.
- **Hiệu năng:** cổng duy nhất phải chạy là `npm run test:perf -- --strict`, **một lần sau khi xong cây khu phố** (cây là rủi ro chính). Nếu không đạt: giảm số tam giác một lần (bớt cụm lá, bớt tàu lá) rồi chạy lại; vẫn không đạt thì ghi vào mục "Cần người dùng quyết" và đi tiếp với bản nhẹ nhất đã thử, không dừng chờ. So thời gian khung với `main` (lệch ≤ 15 % ở toàn cảnh, `wxStreet`, `rfBank`) là mong muốn nhưng **không chạy** theo lời người dùng; ghi "chưa đo". Bảng draw call trong `tests/KET-QUA.md` chưa đo lại từ sau D-026 và D-027, nên ràng buộc draw call kiểm bằng cách đếm lưới: số `InstancedMesh` của cây và người trong test mới.
- **Người không đổ bóng, không vào phản chiếu** (như hiện tại, quyết định của agent). Cây vẫn đổ bóng như hiện tại.
- **Không ảnh ngoài, không thư viện mới.** Vân lá, răng lược tàu dừa, vòng sẹo thân vẽ bằng canvas. Không thêm `PointLight` / `SpotLight`.
- **Thông số ở `src/config.ts`** (ví dụ `CONFIG.trees`, `CONFIG.people`): mỗi dòng có chú thích tiếng Việt, đơn vị, `(ước lượng)` khi không có nguồn. Gồm ít nhất: số người Cầu Rồng, tỉ lệ các kiểu người, tốc độ và các thông số dáng ở §5, kích thước cây, mốc số tam giác.
- **Phong cách code:** comment tiếng Việt, khối tiêu đề `/* ===== ... ===== */`, không format lại file sẵn có.

## 7. Phần người dùng đã quyết và phần để người dựng

**Đã quyết (không đổi nếu chưa hỏi lại):** G1–G12; dựng cây và người bằng hình khối, không dán ảnh; dáng đi và dáng chạy ở §5 là mốc cảm nhận.

**Quyết định của agent, người dùng chưa bàn chi tiết (người dựng theo, người dùng có thể đổi khi đọc):**
- Cầu Rồng: khoảng 70 người (ước lượng), chia hai lề, dọc phần cầu trên sông; người đứng lan can tập trung hơn ở đoạn gần đầu rồng. Ngày và đêm như nhau.
- Người rời cầu khi bão theo cùng cách xe biến mất dần (`weatherFx.clear`), gồm cả 40 người ven sông Bạch Đằng và người trên cầu Nguyễn Văn Trỗi.
- Các kiểu người chọn theo chỉ số instance, đều lấy từ những người đang có nên tổng số người mỗi cầu không đổi: người đứng (đặt sát lan can, tốc độ 0); người chạy bộ (đổi tốc độ); người đi cùng (đi đôi hoặc trẻ em): vẫn lấy đủ các số ngẫu nhiên của mình theo thứ tự cũ để chuỗi `rnd` không lệch, nhưng vị trí, chiều và tốc độ chép từ người đứng ngay trước trong danh sách, lệch ngang khoảng 0,6 m. Kiểm chuỗi seed ở §8.6 áp cho nhà, cây, xe, tàu; với người chỉ kiểm tổng số và thứ tự lấy số.
- Trên cầu Nguyễn Văn Trỗi (cầu đi bộ) **không có người chạy bộ**; các kiểu khác như các lề còn lại.
- Màu: giữ 7 màu áo cũ, thêm vài màu; quần 5–6 màu trầm; da và tóc một màu.
- Cỡ cây lấy từ `h`, `r` hiện có: tán cây bóng mát lấp gần đầy khối bầu dục bán kính `r` (dẹt 0,85) đặt ở cao độ cũ, để dây đèn quấn cây vẫn bám tán.
- Không thêm lệnh `npm` bật/tắt hay tham số URL mới.

**Để người dựng quyết:**
- Cách dựng hình (số cụm lá, số tàu lá, số cạnh), cách giản lược cây xa, cách giữ cặp thân/tán cho `fallen.ts` và `promenade.ts` (giữ nguyên cấu trúc hay sửa các chỗ đọc nó), có vá gió cho thân/cành hay không.
- Cách tổ chức file (ví dụ `src/environment/trees/`, `src/common/people/`), tên hàm theo tiền tố của dự án.
- Chuyển động tính trong vertex shader hay trên CPU.
- Có cho thân dừa cong hay không ở những cây có dây đèn quấn thân.
- Test: nên có test nhanh không trình duyệt (số đỉnh, công thức nhịp bước không trượt, số lời gọi `rand()`), và test trình duyệt đọc `dist/` (mỗi hệ một lệnh vẽ, vị trí cây khớp `main`, bão dọn người, cây đổ rồi dựng lại, gió). Tên lệnh theo mẫu `test:traffic` / `test:traffic:unit`.

## 8. Nghiệm thu

1. **Ảnh ngày**, chụp ở bản build, đặt cạnh ảnh cùng góc của `main`:
   - cây bóng mát và cây dừa nhìn gần khoảng 20 m trên bờ Bạch Đằng;
   - toàn cảnh Cầu Rồng từ góc nhìn mặc định (cây hai bờ ở xa 300–600 m vẫn ra dáng cây, không là chấm tròn);
   - hàng dừa ở cửa hầm; cây ở kè Thuận Phước;
   - lề Cầu Rồng, lề Cầu Trần Thị Lý, lề Cầu sông Hàn nhìn gần khoảng 10 m: thấy người đi, chạy, đứng lan can, nón lá, ba lô, trẻ em.
2. **Ảnh đêm**: dải đi bộ Bạch Đằng có dây đèn bám đúng tán và thân cây.
3. **Chuyển động**, người dùng xem trên `npm run dev`: người đi không trượt chân, người chạy ra dáng chạy, cây lắc khi chọn Gió mùa và Bão, cây đổ sau bão rồi dựng lại.
4. **Bão**: người biến mất dần trên cả ba cầu khi `closed`, trở lại khi hết bão.
5. **Số đo**: draw call theo §6 (`test:drawcalls`), `test:perf -- --strict`, so thời gian khung với `main`.
6. **Chuỗi seed**: vị trí nhà, cây, xe, tàu khớp `main` (so ma trận instance hoặc bằng chứng tương đương).
7. Test: `typecheck`, `build` và test mới của tính năng phải đạt. **Người dùng nói không cần chạy đủ bộ test** (2026-11-11): chỉ chạy thêm test chạm trực tiếp vào phần đã sửa khi cần bằng chứng (`test:weather` cho cây đổ và gió, `test:riverfront` cho dây đèn và dọn cây), mỗi test tối đa một lần ở cuối nhánh. Những test không chạy (`test:drawcalls`, `test:perf --strict`, `test:citynight -- --baseline`, …) ghi rõ là **chưa chạy** trong `tests/KET-QUA.md` và memory bank; mục 5 khi đó thay bằng số đếm lệnh vẽ của từng hệ trong test mới và ghi chú "chưa đo so với `main`".

## 8b. Cách chốt (người dùng dặn 2026-11-11)

Người dùng cho phép làm hết không cần hỏi lại: xong thì tạo pull request, merge vào `main`, cập nhật các file hướng dẫn AI (memory bank trong `.github/memory-bank/`, `copilot-instructions.md` §5 nếu có lệnh test mới, README mục Cấu trúc). Việc nào cần con người quyết thì **ghi lại** trong mục "Cần người dùng quyết" của plan và của `activeContext.md`, chọn phương án an toàn nhất để đi tiếp, không dừng chờ.

## 9. Ghi chú cho kế hoạch

- Nhánh: `feature/cay-va-nguoi-thuc-te`, tách từ `main` (D-027 đã merge PR #19).
- Quyết định kiến trúc ghi vào `.github/memory-bank/decisions.md` (số tiếp theo: D-028).
- Nên chia giai đoạn để người dùng duyệt sớm trên demo: (1) cây bóng mát và cây dừa khu phố cùng các hiệu ứng phụ thuộc; (2) cây Thuận Phước và cửa hầm; (3) hình và chuyển động người ở hai cầu đang có; (4) người Cầu Rồng và bão; (5) số đo, tài liệu, memory bank.
- Khi thực hiện, người dùng yêu cầu giao việc cho agent con chạy model Opus hoặc Sonnet tùy độ khó, không dùng Fable 5.2.
