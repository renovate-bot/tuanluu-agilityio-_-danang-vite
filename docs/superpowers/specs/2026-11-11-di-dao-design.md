# Đi dạo nhiều người (5 slot, góc nhìn sau lưng) — thiết kế

_2026-11-11 · Trạng thái: Đã xây, merge PR #23 · Quyết định: D-029 · Nhánh: `feature/di-dao`_

## 1. Ý định

Dự án đã có dù lượn 5 slot để ngắm Đà Nẵng từ trên trời. Tính năng này thêm cách ngắm từ mặt đất: người chơi điều khiển một nhân vật đi dạo trên Cầu Rồng, Cầu sông Hàn và hai bờ sông, camera theo sau lưng như các trò chơi thế giới mở góc nhìn thứ ba, gặp người đi dạo khác và nhìn lên thấy người đang bay dù. Đi tới chỗ đẹp thì chụp một tấm ảnh làm kỷ niệm. Không có nhiệm vụ, không có điểm số.

"Kiểu GTA" ở đây chỉ là cách đặt camera và cách điều khiển (góc nhìn thứ ba, đi / chạy / nhảy tự do). Không dùng tên, nhân vật, giao diện hay hình ảnh của trò chơi nào.

## 2. Mục tiêu / không làm / thất bại

**Mục tiêu**
- Chế độ "Đi dạo" chọn từ màn chọn phương tiện (thẻ `data-pick="walk"` đang khóa "Sắp có" trong `index.html`), dùng được trên **máy tính và điện thoại**.
- Nhân vật đi bộ, chạy, nhảy; camera sau lưng, xoay được quanh nhân vật.
- Đi được trên Cầu Rồng, Cầu sông Hàn và dải ven sông hai bờ nối hai cầu thành một vòng khép kín.
- Không đi xuyên tòa nhà, không rơi xuống sông, không ra khỏi vùng đã làm.
- 5 chỗ đi dạo, riêng với 5 chỗ bay. Người đi dạo và người bay dù thấy nhau (hình + tên).
- Chụp ảnh: lưu đúng khung hình đang thấy thành file ảnh.

**Không làm** (đợt này): Trần Thị Lý, Thuận Phước, Hầm, Vòng quay Mặt Trời, các dãy phố phía trong; vào trong nhà; lên xe / tàu; bơi; va chạm giữa người chơi với nhau, với xe, với người đi bộ có sẵn, với cây và cột đèn; chat, biểu cảm; chọn trang phục; tay cầm chơi game; đổi giữa đi và bay mà không qua màn chọn; dù lượn trên điện thoại; đồng bộ ngày đêm, thời tiết, trạng thái quay cầu giữa các máy.

**Coi là thất bại dù vẫn chạy** (người dùng nêu hai mục đầu)
- Nhân vật đi xuyên qua tòa nhà.
- Nhân vật rơi xuống sông hoặc đứng trên mặt nước.
- Có 6 người đi dạo cùng lúc, hoặc chế độ đi dạo làm dù lượn mất chỗ / hỏng.
- Máy chủ lỗi làm hỏng trang hay chặn đi dạo một mình.
- Góc nhìn cũ tăng draw call; Tour, tham quan, dù lượn đổi hành vi; vị trí nhà / cây / xe đổi (chuỗi `rand()`).

## 3. Trải nghiệm

Mục có dấu **(ND)** là người dùng nói hoặc chọn; còn lại là đề xuất của Claude mà người dùng đã đồng ý ở mức tóm tắt.

1. **Vào chế độ.** Màn chọn có thẻ "Đi dạo" bấm được trên cả máy tính lẫn điện thoại. Bấm thì sang bước sảnh như dù lượn: số chỗ đi dạo còn lại, tên đang có mặt, ô tên (≤ 9 ký tự, dùng chung tên đã lưu với dù lượn), nút vào. Không có máy chủ thì đi một mình ngay.
2. **Xuất phát ở Cầu Rồng (ND).** Trên lề phía Tây cầu, mỗi slot lệch nhau vài mét để không chồng lên nhau.
3. **Di chuyển (ND: đi bộ, chạy, nhảy; nhanh hơn người thật để đi được nhiều nơi).** Đề xuất: đi 3,5 m/s, chạy 10 m/s (chạy hết Cầu Rồng 666 m mất khoảng một phút), nhảy cao khoảng 1,2 m. Các số này là ước lượng, người dùng sẽ chỉnh sau khi thử. Nhảy chỉ để vui: không vượt được lan can, mép kè hay tường nhà.
4. **Camera.** Sau lưng và hơi cao hơn nhân vật, xoay quanh nhân vật theo ý người chơi; nhân vật quay mặt theo hướng đi. Camera không chui vào nhà và không xuống dưới mặt đất / mặt nước: gặp vật cản thì kéo lại gần nhân vật.
5. **Điều khiển máy tính.** W A S D đi (theo hướng camera), giữ Shift chạy, Space nhảy, kéo chuột xoay camera, P hoặc nút 📷 chụp ảnh, Esc thoát.
6. **Điều khiển điện thoại (ND chọn phương án B).** Cần gạt ảo bên trái: gạt nhẹ là đi, gạt hết cỡ là chạy. Bên phải hai nút: Nhảy và 📷. Vuốt nửa phải màn hình để xoay camera. Không có nút Chạy. Bản phác vẽ điện thoại cầm ngang (Claude đoán); cầm dọc vẫn phải dùng được với cùng bố cục.
7. **Trên màn hình khi đi.** Nút Thoát, nút 📷, danh sách người chơi dạng "Đi dạo n/5 · Bay n/5" kèm tên. Bảng điều khiển tham quan ẩn như khi bay dù.
8. **Người chơi khác (ND: người đi và người bay thấy nhau).** Người đi dạo khác hiện là nhân vật có dáng đi / chạy / đứng / nhảy đúng với việc họ đang làm, màu áo theo slot (cùng bảng màu `multiParams.colors`), tên kèm khoảng cách phía trên đầu. Người bay dù hiện như trong chế độ dù lượn hiện nay. Người bay dù cũng thấy người đi dạo bên dưới.
9. **Hết chỗ đi dạo.** Vào chế độ xem bám theo một người đang đi dạo, có lời mời khi trống chỗ; cùng luật với dù lượn.
10. **Rời máy.** 60 giây không chạm phím / màn hình thì hỏi "Bạn còn đó không?", đếm ngược 15 giây rồi trả chỗ; cùng luật với dù lượn.
11. **Chụp ảnh (ND: thấy gì chụp nấy).** Bấm 📷: nhân vật giơ tay chụp (tư thế đã có trong dáng người), màn hình chớp nhẹ, một file PNG của đúng khung hình 3D hiện tại được lưu về máy. Ảnh không có nút bấm, không có nhãn tên; có nhân vật của mình vì camera ở sau lưng. Trên điện thoại ảnh phải tới được tay người dùng (tải về hoặc bảng chia sẻ của hệ điều hành).
12. **Ranh giới vùng đi được.** Tới mép vùng đã làm thì bị chặn nhẹ nhàng (trượt dọc ranh giới), không có tường nhìn thấy, không có thông báo lỗi.
13. **Cầu sông Hàn quay (ND chọn: chỉ đóng hai đầu).** Khi đi dạo, cầu chỉ quay theo lịch thật đã có (23:00 thứ Bảy, Chủ nhật, một lượt khoảng 36 phút); chế độ đi dạo không tự kích hoạt quay và không tăng tốc quay. Khi cầu rời trạng thái đóng (từ lúc chặn xe), nhịp quay đóng với người đi dạo: hai đầu nhịp thành tường, ai đang đứng trên nhịp được đưa về đầu cầu gần nhất (chuyển mượt, không giật hình). Không có chuyện người đứng trên nhịp quay theo cầu. Cầu đóng lại thì đi qua được như thường.
14. **Ban đêm.** Cầu Rồng tự phun lửa / nước như khi bay dù ban đêm (đẹp cho ảnh chụp). Ngày đêm và thời tiết dùng như hiện có; bão không cấm đi dạo.
15. **Cầu Tình Yêu (ND chọn: đi được).** Người đi dạo đi lên được cầu tàu có tượng cá chép hóa rồng ở bờ Đông để chụp ảnh. Bến du thuyền bờ Tây chưa làm: mép kè ở đó vẫn chặn.

Bản phác đã duyệt (không commit): `.superpowers/brainstorm/23141-1794372046/content/walk-controls.html`, phương án B.

## 4. Vùng đi được và va chạm

Đây là phần quyết định thành bại (mục 2).

**Vùng đi được, bản đầu**
- Mặt Cầu Rồng (z = 0) và mặt Cầu sông Hàn (z = −1080), toàn bộ bề rộng giữa hai lan can ngoài, gồm cả lòng đường (xe chạy xuyên qua người chơi, không va chạm).
- Dải ven sông hai bờ giữa hai cầu, có phần dư ở hai đầu đủ để lên xuống cầu: từ mép kè |x| = 262 vào trong tới hết đường ven sông và các địa danh sát bờ. Ước lượng ban đầu của Claude: |x| ≤ 400, z từ khoảng −1300 tới +220. Người làm chỉnh ranh giới chính xác theo hình học thật, miễn giữ được vòng khép kín: Cầu Rồng → bờ Đông → Cầu sông Hàn → bờ Tây → Cầu Rồng.
- Cầu Tình Yêu (`CONFIG.riverfront.love`: z = −78, dài 38 m, rộng 6 m, nhô ra từ kè Đông): mặt cầu tàu đi được, là ngoại lệ duy nhất của luật mép kè.
- Mọi chỗ khác là ngoài vùng, kể cả bến du thuyền bờ Tây.

**Luật va chạm**
- Nhân vật là một hình tròn trên mặt bằng (bán kính khoảng 0,35 m). Vật cản là tường thẳng đứng cao vô hạn: không có cách nào nhảy qua.
- Vật cản: mọi tòa nhà đang hiện trong vùng (lấy sau khi tất cả các bước dọn nhà đã chạy; `collectBuildings()` trong `src/environment/riverfront/clearance.ts` đã trả đúng danh sách này), chân đế địa danh ven sông và pano (`footprints` trong `src/environment/riverfront/index.ts`), lan can ngoài của hai cầu, mép kè, ranh giới vùng, hai đầu nhịp quay khi cầu không đóng.
- **Kết cấu trên mặt cầu là vật rắn (ND chọn: chặn lại).** Thân, đầu, đuôi rồng và các chân vòm ở dải phân cách Cầu Rồng; tháp và chân dây văng Cầu sông Hàn: không đi xuyên được, camera cũng tránh như tránh nhà. Chỉ cần chặn phần chạm tới tầm người (từ mặt cầu lên khoảng 2,5 m); phần vòm ở trên cao thì đi bên dưới được. Dữ liệu va chạm cho các kết cấu này phải dựng riêng từ hình học của cầu, vì chúng không có trong danh sách nhà hay chân đế.
- Cầu Tình Yêu: lan can cầu tàu là tường, tượng cá chép và các khối trên cầu tàu là vật cản; chân đế của nó trong `footprints` không còn là tường nguyên khối. Chỗ nối bờ là lối duy nhất ra vào.
- Mép kè và mép cầu chặn tuyệt đối: không có trạng thái "rơi".
- Mỗi điểm trên mặt bằng có đúng một cao độ đứng được: mặt đất (`CONFIG.landY` / `roadY`), mặt cầu (`deckY(x)` của Cầu Rồng, `shRoadY(x)` của Cầu sông Hàn) hoặc mặt cầu tàu Cầu Tình Yêu. Không đi dưới gầm cầu trong bản đầu; chỗ mặt cầu cao hơn mặt đất thì thành cầu là tường, người chơi lên cầu ở đầu cầu nơi mặt cầu hạ về mặt đường.
- Cây, cột đèn, ghế, xe, người đi bộ có sẵn, người chơi khác: đi xuyên qua được (không làm đợt này).
- Va chạm tính ở máy khách. Máy chủ chỉ kẹp vị trí vào khung vùng đi được, không kiểm từng tòa nhà.

**Chứng minh**
- Test tự động không cần trình duyệt: cho nhân vật giả đi ngẫu nhiên rất nhiều bước (cả chạy và nhảy, cả áp sát rồi trượt dọc tường, cả khung hình dài) từ nhiều điểm xuất phát; không bước nào kết thúc bên trong chân đế nhà, bên trong thân rồng / tháp cầu / tượng, ngoài mép kè (trừ mặt Cầu Tình Yêu), ngoài lan can cầu và cầu tàu, hay ngoài vùng.
- Test tự động chứng minh vòng khép kín đi được: có đường từ điểm xuất phát qua cả hai cầu và hai bờ rồi về lại.
- Test trình duyệt: cao độ chân nhân vật khớp mặt cầu / mặt đất tại các điểm mẫu; khi cầu rời trạng thái đóng thì người trên nhịp quay được đưa về đầu cầu và không ai vào được nhịp cho tới khi cầu đóng lại.

## 5. Quyết định kỹ thuật của Claude

Người dùng giao phần "làm thế nào"; các mục dưới đây là lựa chọn của Claude, dựa trên code hiện có.

- **Tên trong code.** Dự án đã có góc nhìn `walk` (mắt người trên lề Cầu Rồng, `src/views/camera.ts`); giữ nguyên nó. Chế độ mới gọi là `stroll` trong code (`cam.mode = 'stroll'`, `?explore=stroll`), thư mục `src/explore/stroll/`, tiền tố hàm `st*`, thông số ở `CONFIG.stroll` (mỗi dòng có chú thích tiếng Việt, đơn vị, `(ước lượng)`).
- **Máy chủ: mở rộng phòng hiện có**, không lập phòng thứ hai, vì hai nhóm phải thấy nhau. Cùng một Durable Object `sky`, thêm nhóm 5 slot đi dạo bên cạnh 5 slot bay. Tin vị trí của người đi dạo mang thêm trạng thái dáng (đứng / đi / chạy / đang nhảy / đang chụp ảnh) và không có góc nghiêng; máy chủ kẹp theo khung và cao độ của vùng đi dạo thay vì sàn 7 m của dù.
- **Tương thích.** Bản khách dù lượn đang chạy ở tab cũ phải tiếp tục hoạt động với máy chủ mới (không hiểu người đi dạo thì bỏ qua họ, không lỗi). Bản khách mới gặp máy chủ cũ thì đi dạo một mình, không lỗi. Nhờ vậy thứ tự đưa Worker và trang lên không quan trọng.
- **Đưa Worker lên Cloudflare là thao tác phải hỏi người dùng trước** (ghi chú dự án: bản Worker đang chạy còn là bản cũ hơn code trong repo).
- **Nhân vật: dùng hình và vật liệu người đi bộ có sẵn** (`src/common/people/`), một `InstancedMesh` cho mọi người đi dạo đang hiện (mình + người khác). Dáng nhảy là phần mới. Thay đổi shader người không được làm đổi hình dáng hay số lệnh vẽ của các hệ người hiện có (`test:people` phải vẫn đạt).
- **Dáng đi ở tốc độ nhanh.** Tốc độ nhanh hơn người thật nên bước chân sẽ không khớp tuyệt đối với quãng đường; chấp nhận trượt chân nhẹ, ưu tiên dáng trông tự nhiên (nhịp bước không quá 1,5 lần nhịp chạy hiện có).
- **Người bay dù nhìn từ dưới đất và người đi dạo nhìn từ dù** dùng lại phần hiển thị người khác của dù lượn (`src/explore/multi/remote.ts`, `labels.ts`, `interp.ts`), mở rộng cho loại nhân vật mới.
- **Chụp ảnh** lấy từ canvas WebGL ngay sau một lần vẽ (không bật giữ bộ đệm cho mọi khung), không qua máy chủ, không thêm thư viện.
- **Điều khiển cảm ứng** tự viết bằng sự kiện con trỏ, không thêm thư viện.
- **Cầu quay và nhiều người.** Trạng thái quay cầu không đồng bộ giữa các máy (giữ nguyên như dù lượn; lịch quay theo giờ Việt Nam nên các máy thường trùng nhau, nhưng nút quay trong chế độ tham quan thì không). Một người đi trên nhịp ở máy họ (cầu đang đóng) có thể hiện lơ lửng trên chỗ hở ở máy khác đang thấy cầu mở. Chấp nhận trong bản đầu; ghi vào hạn chế.
- **Draw call.** Góc nhìn cũ: tăng 0. Trong chế độ đi dạo và dù lượn: thêm tối đa 1 lệnh vẽ cho người đi dạo, cộng phần dù của người bay như hiện nay.

## 6. Ràng buộc của dự án (từ `.github/copilot-instructions.md`)

- Không thêm / bớt lời gọi `rand()`, không đổi thứ tự `build*()`. Dữ liệu va chạm thu sau khi cảnh dựng xong, chỉ đọc.
- Mọi thông số ở `src/config.ts`; chuỗi giao diện mới có đủ 9 ngôn ngữ (`ar` là RTL, cần gạt và nút vẫn đúng tay).
- Không thêm thư viện runtime, ảnh ngoài, `PointLight` / `SpotLight`.
- Comment tiếng Việt, phong cách như file xung quanh.
- Test mới theo mẫu hiện có: một bộ nhanh không trình duyệt (va chạm, chuyển động, giao thức, phòng máy chủ) và một bộ trình duyệt (`test:stroll:unit`, `test:stroll`). Các bộ phải vẫn đạt: `test:multi:unit`, `test:multi:worker`, `test:multi`, `test:explore`, `test:people`, `test:mobile`; bộ nặng (`test:drawcalls`, `test:perf --strict`) chạy một lần cuối nhánh.
- Làm trên `feature/di-dao`; cập nhật memory bank và `decisions.md` (D-029) khi xong.

## 7. Để người làm quyết

- Ranh giới chính xác của dải ven sông và chỗ lên xuống ở bốn đầu cầu (cần đọc hình học thật của mố cầu, đường dẫn, lối dạo; đầu Đông Cầu sông Hàn trong config kết thúc ở x ≈ 227, phía trong mép kè, nên phải kiểm chỗ nối với bờ).
- Cấu trúc dữ liệu va chạm (lưới ô, danh sách đoạn tường...) và cách trượt dọc tường.
- Hình dạng tin nhắn mới và cách đánh số slot, miễn đạt yêu cầu tương thích ở mục 5.
- Thông số camera (khoảng cách, độ cao, độ trễ), kích thước cần gạt và nút (vùng chạm ≥ 44 px), ngưỡng gạt nhẹ / gạt hết cỡ.
- Dáng nhảy và cách thêm vào shader người.
- Tên file ảnh, hiệu ứng chớp, cách đưa ảnh tới người dùng trên iOS Safari và Android Chrome.
- Chuỗi giao diện và bản dịch 8 ngôn ngữ còn lại (đánh dấu cần người bản ngữ duyệt, như các tính năng trước).

## 8. Hạn chế biết trước

- Người đi dạo trên nhịp quay có thể hiện sai chỗ ở máy khác khi hai máy thấy cầu ở hai trạng thái khác nhau (mục 5).
- Không ai được đứng trên nhịp quay lúc cầu quay; cầu cũng hiếm khi quay trong chế độ đi dạo (chỉ theo lịch thật).
- Một người có thể mở nhiều tab để chiếm nhiều chỗ (như dù lượn, không giới hạn theo IP).
- Va chạm tính ở máy khách: người sửa mã phía mình có thể hiện ở chỗ không hợp lệ trong khung vùng; không ảnh hưởng người khác ngoài hình ảnh.
- FPS trên điện thoại thật chưa biết; chế độ này lần đầu đưa cảnh 3D có điều khiển liên tục lên điện thoại.

## 9. Khác so với ý định ban đầu

- Thông báo chụp ảnh ở phần tử riêng `#stToast`, không dùng `#exMpNotice` (dùng chung thì ghi đè thông báo nhiều người).
- Thêm dòng hướng dẫn `#stHint` trên máy tính (anh em của `#exHint`, hiện khi `body.explore.stroll`, ẩn trên cảm ứng).
- Vùng bờ thụt vào ngoài lan can dải dạo (|x| 263,49) thay vì chạy tới mép kè 262, để không đi xuyên lan can; lan can dải dạo có một khe ở lối vào Cầu Tình Yêu (`CONFIG.riverfront.love.railGap`). Dải hẹp giữa lan can và mép nước không đi tới được.
- `?explore=glider` vẫn bay một mình, không qua slot; test nhiều người vào dù lượn qua màn chọn → sảnh → Bay ngay (R1).
- Danh sách người chơi (chế độ dù lượn) đổi tiêu đề thành "Đi dạo n/5 · Bay n/5".
