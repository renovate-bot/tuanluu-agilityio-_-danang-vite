/* ===== Dù lượn nhiều người: thông số dùng chung khách + máy chủ (không import gì; config.ts import file này) ===== */
export const multiParams = {
  url: 'wss://danang-sky.tuanlv5490.workers.dev/sky', // địa chỉ WebSocket của máy chủ Cloudflare; rỗng = chỉ bay một mình
  slots: 5,              // số chỗ bay cùng lúc (theo thiết kế)
  nameMax: 9,            // số grapheme tối đa của tên hiển thị (ước lượng)
  sendHz: 5,             // lần/s khách gửi vị trí (ước lượng, đo ở giai đoạn đầu)
  broadcastMs: 100,      // ms tối thiểu giữa hai lần máy chủ phát gói vị trí gộp (ước lượng)
  posMaxPerSec: 8,       // gói pos tối đa một kết nối được gửi trong 1 s, quá thì bỏ (ước lượng)
  heartbeatMs: 3000,     // ms giữa hai nhịp sống khi không đổi vị trí (ước lượng)
  slotTimeoutMs: 10000,  // ms không có tin thì máy chủ trả slot (ước lượng)
  sweepMs: 10000,        // ms giữa hai lần máy chủ quét slot hết hạn (ước lượng)
  connectTimeoutMs: 4000, // ms chờ kết nối WebSocket trước khi coi là lỗi (ước lượng)
  idleMs: 60000,         // ms không chạm phím thì hiện hỏi "Bạn còn đó không?" (ước lượng)
  idleWarnMs: 15000,     // ms đếm ngược sau khi hỏi, hết thì trả slot (ước lượng)
  maxConns: 200,         // số kết nối đồng thời tối đa của phòng (ước lượng)
  maxMsgBytes: 256,      // byte tối đa của một tin nhận từ khách (ước lượng)
  interpSends: 2.5,      // độ trễ nội suy, tính theo số chu kỳ gửi (ước lượng)
  spawnSpread: 30,       // m lệch điểm cất cánh theo slot để không chồng nhau (ước lượng)
  labelBelow: 9,         // m đặt nhãn tên bên dưới cánh dù (ước lượng)
  colors: ['#2f9e6e', '#e8892b', '#a855c7', '#2a8fd6', '#e0c02e'], // màu cánh theo slot (ước lượng)
  bounds: { x0: -2600, x1: 3600, z0: -5600, z1: 2800 }, // m — khung bay, phải bằng CONFIG.explore.bounds (có test kiểm)
  floor: 7,              // m — độ cao tối thiểu, phải bằng CONFIG.explore.floor
  ceiling: 800           // m — độ cao tối đa, phải bằng CONFIG.explore.ceiling
};
