# Dù lượn nhiều người (5 slot) — thiết kế

_2026-11-09 · Trạng thái: đã duyệt_

## 1. Ý định

Khách lạ tình cờ vào trang và gặp nhau trên bầu trời Đà Nẵng: đang lượn trên sông Hàn thì thấy một cánh dù khác có tên ai đó bay ngang. Tối đa 5 người bay cùng lúc. Người đến sau không bị từ chối khô khan mà được xem một người đang bay. Không phải trò chơi có mục tiêu, không có nhóm hẹn trước.

## 2. Mục tiêu / không làm / thất bại

**Mục tiêu**
- Một bầu trời chung, 5 slot, số chỗ còn lại hiện trước khi bay.
- Tên đại diện tối đa 9 ký tự.
- Khi bay thấy người khác kèm tên, khoảng cách, danh sách góc màn hình.
- Hết chỗ: xem bám theo ngẫu nhiên một người đang bay; có chỗ thì được mời.

**Không làm** (đợt này): nhiều phòng; va chạm giữa các dù; chat; tài khoản / đăng nhập; bảng xếp hạng; hàng đợi; giới hạn thời gian mỗi lượt; bay hoặc xem trên điện thoại / cảm ứng; đồng bộ thời tiết, giờ ngày/đêm giữa các máy (mỗi máy giữ cài đặt của mình).

**Coi là thất bại dù vẫn chạy**
- Có 6 người bay cùng lúc.
- Máy chủ lỗi hoặc hết hạn mức làm hỏng trang hay chặn bay một mình.
- Slot bị giữ lâu bởi người đã rời máy.
- Góc nhìn cũ tăng draw call, hoặc Tour / chế độ tham quan thay đổi hành vi.
- Phát sinh chi phí tiền.

## 3. Trải nghiệm (người dùng đã duyệt)

1. Màn chọn phương tiện giữ nguyên. Bấm **Dù lượn** chuyển sang **một bước riêng** trong cùng hộp thoại: số chỗ (5 chấm + "Còn N trên 5 chỗ"), danh sách tên đang bay, ô tên, nút **Bay ngay**. Số chỗ và danh sách cập nhật trực tiếp.
2. Bay: mình giữ cánh cờ đỏ sao vàng; **người khác mỗi slot một màu cánh**. Tên hiển thị kèm khoảng cách đặt **bên dưới** cánh dù (khác bản phác, bản phác đặt ở trên). Có danh sách người bay ở góc màn hình.
3. **Hết chỗ:** vào chế độ xem, bám theo ngẫu nhiên một người đang bay. Người xem không điều khiển được và không xuất hiện trên trời. Có dòng "Đang xem: Tên".
4. **Có chỗ trống khi đang xem:** thông báo nhỏ "Có 1 chỗ trống, bay ngay?" kèm nút; màn hình vẫn xem tiếp. Không tự kéo vào, không xếp hàng. Tên đã lưu thì một lần bấm; chưa có thì nhập ngay trong thông báo. Máy chủ nhận người đầu tiên; người chậm thấy "Đã có người nhanh hơn" và xem tiếp.
5. **Người đang được xem rời đi:** tự chuyển sang người khác. Không còn ai bay: chỉ còn lời mời.
6. **Rời máy:** không chạm phím 60 giây thì đếm ngược 15 giây "Bạn còn đó không?"; hết giờ thì trả slot và chuyển sang xem. Đóng tab hoặc mất mạng: trả slot sau vài giây.

Mẫu tham khảo (không commit): `.superpowers/brainstorm/3035-1794240706/content/chon-slot.html` (phương án B), `nguoi-bay-khac.html` (phương án B).

## 4. Quyết định của Claude (người dùng đã xem và đồng ý ở mức tóm tắt)

- **Máy chủ: Cloudflare Workers + một Durable Object duy nhất** (bầu trời chung); trang vẫn ở Netlify. Lý do: Netlify không giữ được kết nối liên tục; một Durable Object xử lý tuần tự nên giành slot cuối không thành 6 người; trình duyệt dùng WebSocket có sẵn, không thêm thư viện runtime.
- Nhãn tên kèm khoảng cách (sông dài vài km, không có nhãn thì khó tìm nhau).
- Máy chủ lỗi hoặc hết hạn mức: bay một mình như hiện nay, có dòng báo ngắn.
- Điện thoại giữ khóa thẻ Dù lượn như hiện tại.
- Tên: lọc từ tục cơ bản tiếng Việt + tiếng Anh ở máy chủ; được phép trùng.
- Chống chiếm slot chỉ nhắm vào khách bình thường: các kiểm tra ở §6 là đủ, không xử lý địa chỉ IP (tránh vấn đề riêng tư). Người cố tình viết script hoặc mở nhiều tab có thể chiếm nhiều slot; chấp nhận trong đợt này. Kiểm tra rời máy chạy ở trình duyệt.

## 5. Ràng buộc

**Hạn mức miễn phí Cloudflare** ([pricing, cập nhật 18/10/2026](https://developers.cloudflare.com/durable-objects/platform/pricing/)): 100.000 request/ngày, 13.000 GB-s/ngày, reset 00:00 UTC (7:00 giờ Việt Nam); vượt thì thao tác lỗi, không tính tiền. Chỉ SQLite-backed Durable Object dùng được ở gói Free.
- Tin WebSocket gửi đi miễn phí. Tin nhận vào tính tỉ lệ 20:1. **Trang giá không nói rõ tỉ lệ này áp cho gói Free.**
- Tính toán: 5 người × 5 tin/s = 25 tin/s. Có tỉ lệ 20:1: khoảng 22 giờ đủ 5 người mỗi ngày. Không có tỉ lệ: khoảng 1,1 giờ. Vì vậy **giai đoạn đầu phải đo thật trên Cloudflare, trước khi làm giao diện** (bảng số liệu của Cloudflare hiện số tin thật, không phản ánh tỉ lệ, nên phải gửi vượt 100.000 tin nhận vào trong một ngày UTC trước khi ra mắt rồi xem máy chủ còn nhận không). Quy tắc (người dùng đã duyệt): có tỉ lệ 20:1 thì gửi 5 tin/s; không có thì vẫn làm trên Cloudflare với 2 tin/s (khoảng 14 giờ-người/ngày), chấp nhận dù người khác hơi trễ. Giai đoạn này cần người dùng tạo tài khoản Cloudflare miễn phí trước.
- Thời lượng: dùng WebSocket Hibernation API. Trường hợp xấu nhất, chạy liên tục 24 h × 128 MB = 10.800 GB-s, vẫn dưới hạn.
- Vượt hạn mức theo ngày rơi vào nhánh "bay một mình" ở §7.

**Bất biến dự án** (`.github/copilot-instructions.md` §3):
- Không gọi `rand()`; chọn ngẫu nhiên người để xem dùng `Math.random`. Không đổi thứ tự `build*()`.
- Đồ họa nhiều người chỉ dựng khi vào chế độ bay/xem qua mạng. **Mọi góc nhìn cũ: chênh draw call 0.** Bay một mình: chênh 0 so với hiện tại. Khi đủ 5 người: tối đa +4 draw call (bay) hoặc +5 (xem), mỗi dù một lần vẽ, dùng chung hình học `exBuildGlider`. Nhãn tên là HTML phủ trên canvas (0 draw call).
- Mọi thông số ở `CONFIG.explore.multi`, chú thích tiếng Việt + đơn vị.
- Khóa i18n mới đủ 9 ngôn ngữ, `ar` là RTL (giao diện nhiều người phải kiểm RTL).
- Người dùng cho phép thêm thư viện ngoài cho tính năng này khi thật sự có ích; với thiết kế hiện tại WebSocket có sẵn là đủ nên phía trình duyệt chưa cần. `wrangler` chỉ là devDependency của thư mục máy chủ. Không thêm đèn; đèn ban đêm của dù người khác đọc `shared.uNight` như dù hiện có.
- Chú thích, phong cách code theo §6 của file hướng dẫn. README cập nhật mục Cấu trúc.

## 6. Hành vi kỹ thuật cần giữ

**Máy chủ là nguồn sự thật về slot.** Giữ danh sách slot trong bộ nhớ Durable Object, không cần lưu bền; khởi động lại thì bầu trời trống.

- Kết nối WebSocket mở khi vào bước riêng ở §3.1 (là người quan sát, nhận số chỗ và danh sách), chỉ giành slot khi bấm Bay ngay.
- Màn chọn phương tiện chưa kết nối gì; chọn "Tham quan có hướng dẫn" thì không bao giờ kết nối.
- Tin tối thiểu: quan sát nhận trạng thái sảnh và vị trí; `join(name)` → được slot hoặc hết chỗ; `pos`; `leave`; nhịp sống. Máy chủ phát vị trí gộp cho mọi kết nối.
- Mỗi slot chỉ được kết nối sở hữu nó cập nhật. Máy chủ kiểm tra độ dài tin, giới hạn tần suất, kẹp vị trí trong `CONFIG.explore.bounds`, kiểm tra `Origin` (danh sách cho phép: `https://danangbridges.netlify.app` + localhost; deploy preview không nằm trong danh sách). Giới hạn tổng kết nối (đề xuất 200, `CONFIG` phía máy chủ); vượt thì từ chối, khách rơi vào nhánh §7.
- Không có tin từ slot quá vài giây (đề xuất 10 s, xét bằng alarm): trả slot. Đóng WebSocket: trả slot ngay.

**Tên.** 9 ký tự tính theo grapheme (`Intl.Segmenter`, để tiếng Việt có dấu không bị tính 2). Cắt khoảng trắng; loại ký tự điều khiển và ký tự điều hướng bidi; rỗng thì không cho bay. Máy chủ kiểm tra lại, không tin máy khách. Hiển thị bằng `textContent`. Trình duyệt nhớ tên qua `localStorage`.

**Vị trí.** Gửi đề xuất 5 lần/s (đo ở GĐ đầu), `pos`, `yaw`, `bank`; bỏ qua khi không đổi nhưng vẫn có nhịp sống. Bên nhận nội suy có độ trễ để dù chuyển động mượt; không cấp phát mỗi khung (theo D-018).

**Cất cánh.** Cùng điểm `CONFIG.explore.takeoff`, lệch nhỏ theo slot để không chồng nhau.

**Rời máy.** Đếm bằng bộ hẹn giờ, không dùng `requestAnimationFrame` (tab ẩn dừng rAF). Nhịp sống gửi bằng bộ hẹn giờ. Tab ẩn vẫn đếm idle bình thường.

**Tương thích.** `?test` không kết nối mạng và không đổi hành vi, trừ khi có tham số riêng cho test nhiều người. `?explore=glider` vẫn bay một mình, không qua slot, để test hiện có giữ nguyên. Nút Thoát và Esc giữ cách tải lại trang hiện có; đóng kết nối trả slot.

## 7. Trường hợp lỗi

| Tình huống | Xử lý |
|---|---|
| Không kết nối được, hoặc quá thời gian chờ (đề xuất 4 s) ở bước riêng | Thay số chỗ bằng dòng báo + nút "Bay một mình" (không cần tên) |
| Bấm Bay ngay đúng lúc chỗ cuối bị lấy | Vào chế độ xem, giữ tên |
| Tên bị máy chủ từ chối | Báo tại ô nhập, ở lại bước riêng |
| Mất kết nối khi đang bay | Tiếp tục bay một mình, người khác biến mất, có dòng báo. Không tự nối lại trong đợt này |
| Mất kết nối khi đang xem | Thoát về trạng thái tải lại / màn chọn, có dòng báo |

## 8. Việc để người làm plan quyết định

Cấu trúc file (gợi ý: máy chủ ở thư mục riêng ngoài `src/`, phía khách trong `src/explore/`); định dạng tin (JSON hay nhị phân); bộ màu cánh cụ thể theo slot (5 màu phân biệt rõ cả ban đêm và với cánh cờ); kích thước atlas cho từng màu; danh sách từ cấm; nhịp nội suy; thời điểm nhãn thu nhỏ theo khoảng cách. Cách test: chạy `wrangler dev` cục bộ, vài trình duyệt/kết nối giả, có script `test:multi` phủ: giành chỗ cuối, người thứ sáu thành người xem, trả slot do idle/đóng tab, máy chủ tắt.

Việc người dùng cần tự làm: tạo tài khoản Cloudflare miễn phí và đăng nhập `wrangler` để triển khai.
