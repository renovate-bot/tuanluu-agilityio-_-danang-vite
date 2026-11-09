/* ===== Dù lượn nhiều người: thông số dùng chung khách + máy chủ (không import gì; config.ts import file này) ===== */
export const multiParams = {
  url: 'wss://danang-sky.tuanlv5490.workers.dev/sky', // địa chỉ WebSocket của máy chủ Cloudflare; rỗng = chỉ bay một mình
  slots: 5,              // số chỗ bay cùng lúc (theo thiết kế)
  nameMax: 9,            // số grapheme tối đa của tên hiển thị (ước lượng)
  graphemeCpMax: 10,     // code point tối đa trong một grapheme: đủ cho emoji gia đình có màu da, chặn chồng hàng trăm dấu (ước lượng)
  nameCpMax: 48,         // code point tối đa của cả tên (9 emoji gia đình 5 code point vẫn qua) (ước lượng)
  sendHz: 5,             // lần/s khách gửi vị trí (ước lượng, đo ở giai đoạn đầu)
  broadcastMs: 100,      // ms tối thiểu giữa hai lần máy chủ phát gói vị trí gộp (ước lượng)
  posMaxPerSec: 8,       // gói pos tối đa một kết nối được gửi trong 1 s, quá thì bỏ (ước lượng)
  heartbeatMs: 3000,     // ms giữa hai nhịp sống khi không đổi vị trí (ước lượng)
  slotTimeoutMs: 10000,  // ms không có tin thì máy chủ trả slot (ước lượng)
  sweepMs: 10000,        // ms giữa hai lần máy chủ quét slot hết hạn (ước lượng)
  connectTimeoutMs: 4000, // ms chờ kết nối WebSocket trước khi coi là lỗi (ước lượng)
  idleMs: 60000,         // ms không chạm phím thì hiện hỏi "Bạn còn đó không?" (ước lượng)
  idleWarnMs: 15000,     // ms đếm ngược sau khi hỏi, hết thì trả slot (ước lượng)
  idleTickMs: 500,       // ms giữa hai lần kiểm tra rời máy (setInterval, không dùng rAF để tab ẩn vẫn đếm) (ước lượng)
  maxConns: 200,         // số kết nối đồng thời tối đa của phòng (ước lượng)
  maxMsgBytes: 256,      // độ dài tối đa của một tin nhận từ khách, tính theo đơn vị UTF-16 của chuỗi JSON (không phải byte) (ước lượng)
  interpSends: 2.5,      // độ trễ nội suy, tính theo số chu kỳ gửi (ước lượng)
  spawnSpread: 30,       // m lệch điểm cất cánh theo slot để không chồng nhau (ước lượng)
  labelBelow: 9,         // m đặt nhãn tên bên dưới cánh dù (ước lượng)
  lateMs: 5000,          // ms hiện "chỗ vừa bị giành" ở chế độ xem rồi tự ẩn (ước lượng)
  pendingMs: 4000,       // ms tối đa khóa nút vào bay khi chờ máy chủ trả lời (ước lượng)
  colors: ['#2f9e6e', '#e8892b', '#a855c7', '#2a8fd6', '#e0c02e'], // màu cánh theo slot (ước lượng)
  bounds: { x0: -2600, x1: 3600, z0: -5600, z1: 2800 }, // m — khung bay, phải bằng CONFIG.explore.bounds (có test kiểm)
  floor: 7,              // m — độ cao tối thiểu, phải bằng CONFIG.explore.floor
  ceiling: 800,          // m — độ cao tối đa, phải bằng CONFIG.explore.ceiling
  bankMax: 0.45,         // rad — góc nghiêng tối đa, phải bằng CONFIG.explore.bankMax (máy chủ kẹp bank nhận được)
  clockRelax: 0.01,      // phần chênh được nhận thêm mỗi mẫu khi độ lệch giờ người gửi → giờ khách tăng (mạng chậm đi), không đơn vị (ước lượng)
  clockSlewMs: 4         // ms tối đa độ lệch giờ người gửi → giờ khách được giảm mỗi mẫu (gói nhanh hơn tới), giữ dù không vọt (ước lượng)
};
