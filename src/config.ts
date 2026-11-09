import * as THREE from 'three';

/* =====================================================================
   CONFIG — toàn bộ thông số (1 đơn vị = 1 mét)
   Trục X: dọc cầu, Tây (trung tâm, đuôi rồng) → Đông (biển, đầu rồng)
   Trục Z: dọc sông Hàn, -Z là hướng Bắc (cửa sông, bán đảo Sơn Trà)
   Mỗi cầu một khối riêng bên dưới; thêm cầu mới = thêm một khối + một thư mục trong src/bridges/.
   ===================================================================== */
const sum = (a: number[]) => a.reduce((p, q) => p + q, 0);

/* ------------------------- Chung + Cầu Rồng ------------------------- */
const base = {
  length: 666,                       // tổng chiều dài
  mainSpans: [70, 85, 200, 85, 70],  // 5 nhịp chính — nhịp phụ là ƯỚC LƯỢNG, nhịp giữa 200 m
  approachPiers: [-294],             // trụ nhịp dẫn (3 nhịp dẫn: 2 bờ Tây, 1 bờ Đông) — ước lượng
  spanRise: { 70: 13, 85: 19, 200: 37 } as Record<number, number>, // độ vồng thân rồng trên mặt cầu — ước lượng
  width: 37.5, laneWidth: 3.75, lanesPerDir: 3, median: 6, sidewalk: 2.5, shoulder: 2.0,
  deckMidY: 10.0,                    // cao độ mặt cầu giữa sông — ước lượng
  roadY: 2.6,                        // cao độ đường trên bờ
  landY: 2.5,
  bankX: 262,                        // mép kè hai bờ (sông rộng ~524 m tại cầu) — ước lượng
  bodyRadius: 2.2, headRadius: 3.4,  // bán kính thân rồng — ước lượng
  scaleStep: 1.5, scalesPerRing: 9,
  hangerStep: 5,
  ttl: { z: 1300 },                 // vị trí Cầu Trần Thị Lý; thông số chi tiết ở CONFIG.tranThiLy
  shadowMapSize: 2048,
  fireCount: 420, waterCount: 520,
  showCycle: 48                      // giây — 9 lần phun lửa rồi phun nước
};

/* ---------------------------- Cầu Thuận Phước ----------------------------
   Cầu treo dây võng 3 nhịp ở cửa sông Hàn, phía Bắc (−Z) Cầu Rồng ~2,9 km. */
const thuanPhuocBase = {
  z: -2900,                 // m — vị trí Bắc–Nam (−Z là Bắc), cách Cầu Rồng ~2,9 km
  totalLength: 1856,        // m — tổng chiều dài (tham khảo; hình học tính từ các nhịp bên dưới)
  mainSpan: 405,            // m — nhịp chính
  sideSpan: 125,            // m — mỗi nhịp biên
  approachSpans: 12,        // số nhịp cầu dẫn mỗi bên
  approachSpanLen: 50,      // m — mỗi nhịp dẫn (dầm hộp BTCT dự ứng lực)
  embankment: 120,          // m — đoạn đường đắp sau mố, hạ về mặt đất (ước lượng)
  abutmentRise: 4.8,        // m — mặt đường tại mố cao hơn mặt đất (ước lượng)
  deckWidth: 18,            // m — bề rộng mặt cầu
  laneWidth: 3.5,           // m — mỗi làn, 2 làn mỗi chiều
  median: 1.0,              // m — dải phân cách giữa (ước lượng)
  sidewalk: 1.5,            // m — lề + lan can mỗi bên (ước lượng)
  girderDepth: 2.9,         // m — chiều cao dầm hộp thép khí động (ước lượng)
  girderTip: 10.5,          // m — nửa bề rộng tới mũi dầm (ước lượng); hanger neo tại đây
  girderSegments: 69,       // đốt dầm thép hàn nối
  approachDepth: 2.8,       // m — chiều cao dầm hộp BTCT cầu dẫn (ước lượng)
  roadCenterY: 31.6,        // m — mặt đường giữa nhịp: 27 m tĩnh không + 2,9 m dầm + vồng (ước lượng)
  roadAnchorY: 28.6,        // m — mặt đường tại khối neo (ước lượng)
  pileCapTop: 2.5,          // m — đỉnh bệ cọc trên mặt nước (ước lượng)
  plinthTop: 11.5,          // m — đỉnh bệ trụ; tháp cao 80 m tính từ đây → đỉnh ~91,5 m trên mặt nước
  towerHeight: 80,          // m — chiều cao tháp từ bệ
  legBase: [5.2, 3.6] as [number, number],      // m — tiết diện cột tại chân (dọc cầu × ngang cầu), ước lượng
  legTop: [3.8, 2.6] as [number, number],       // m — tiết diện cột tại đỉnh, ước lượng
  legZBase: 13.2,           // m — tâm cột theo phương ngang tại chân (ước lượng)
  legZTop: 10.8,            // m — tâm cột tại đỉnh = mặt phẳng cáp chủ
  chamfer: 0.45,            // m — vát cạnh cột
  topBeam: [84, 89.5] as [number, number],      // m — cao độ đáy/đỉnh dầm ngang trên (ước lượng)
  lowBeam: [22, 26.2] as [number, number],      // m — dầm ngang dưới, đỡ dầm cầu (ước lượng)
  cablePlaneZ: 10.8,        // m — mặt phẳng cáp chủ (mỗi bên)
  cableRadius: 0.18,        // m — cáp chủ Ø360 mm
  sagRatio: 1 / 9.5,        // độ võng nhịp chính f/L (ước lượng, trong khoảng 1/9 – 1/10)
  saddleY: 92.2,            // m — tim cáp tại yên ngựa đỉnh tháp (ước lượng)
  anchorCableY: 33,         // m — điểm cáp đi vào buồng neo (ước lượng)
  hangersMain: 39,          // hanger mỗi mặt phẳng ở nhịp chính
  hangersSide: 9,           // hanger mỗi mặt phẳng ở mỗi nhịp biên → (39 + 2×9) × 2 = 114
  hangerR: 0.0325,          // m — hanger thường Ø65 mm
  hangerRSpecial: 0.0505,   // m — hanger đặc biệt Ø101 mm (gần tháp, giữa nhịp, đầu nhịp biên)
  bandRadius: 0.32,         // m — kẹp cáp (ước lượng)
  lampSpacing: 30,          // m — cột đèn trên cầu (ước lượng)
  lodDistance: 1700         // m — xa hơn thì ẩn chi tiết nhỏ (lan can, cột đèn, kẹp cáp, xe)
};
function deriveTp(C: typeof thuanPhuocBase) {
  const towerX = C.mainSpan / 2;                                   // 202,5 m — tim tháp
  const anchorX = towerX + C.sideSpan;                             // 327,5 m — đầu phần cầu treo
  const endX = anchorX + C.approachSpans * C.approachSpanLen;      // 927,5 m — mố cầu dẫn
  const cableAnchorX = anchorX + 8.5;                              // m — cáp vào buồng neo (ước lượng)
  const sag = C.mainSpan * C.sagRatio;                             // ≈ 42,6 m
  const sideSag = sag * ((cableAnchorX - towerX) / C.mainSpan) ** 2; // cùng lực ngang → f tỉ lệ L²
  const towerTop = C.plinthTop + C.towerHeight;                    // 91,5 m
  return { ...C, towerX, anchorX, endX, cableAnchorX, sag, sideSag, towerTop };
}

/* ---------------------------- Cầu Trần Thị Lý ----------------------------
   Cầu dây văng BTCT một tháp nghiêng, hệ dây 3 mặt phẳng ("cánh buồm căng gió"),
   phía Nam (thượng lưu, +Z) Cầu Rồng ~1,3 km. */
const tranThiLyBase = {
  z: base.ttl.z,              // m — 1300, phía Nam Cầu Rồng
  totalLength: 731,           // m — 12 nhịp
  pylonX: -130,               // m — tim chân tháp; tháp gần bờ Tây, nhịp chính vượt sông về phía Đông (ước lượng)
  mainSpan: 230,              // m — nhịp dây văng chính, phía Đông tháp
  backSpans: [40, 40, 40],    // m — nhịp sau tháp, nơi neo dây xoắn (ước lượng)
  westSpans: [49, 38.5, 38.5],// m — nhịp dẫn bờ Tây; trụ giữa đặt trên dải phân cách đường Bạch Đằng (ước lượng)
  eastSpans: [51, 51, 51, 46, 56], // m — nhịp dẫn bờ Đông; một trụ trên dải phân cách Trần Hưng Đạo (ước lượng)
  deckWidth: 34.5,            // m — bề rộng mặt cầu
  median: 5.5,                // m — dải phân cách giữa, mang tháp và neo dây nhịp chính
  laneWidth: 3.75,            // m
  lanesPerDir: 3,             // 6 làn xe
  sidewalk: 3.25,             // m — lề bộ hành mỗi bên gồm lan can: (34,5 − 5,5 − 6×3,75) / 2
  girderDepth: 2.6,           // m — dầm hộp BTCT (ước lượng)
  // m — cao độ mặt đường (ước lượng): đổ xuống nút giao phía Tây, vồng nhẹ giữa sông, hạ về bờ Đông
  roadProfile: [[-530, 2.6], [-470, 2.6], [-376, 6.4], [-250, 10.8], [-130, 12.6], [-15, 13.2], [100, 12.2], [253, 8.6], [355, 5.8], [450, 2.6], [510, 2.6]] as [number, number][],
  pylonHeight: 145,           // m — chiều cao thẳng đứng tính từ chân tháp
  pylonAboveDeck: 134,        // m — phần nhô trên mặt cầu (chân tháp thấp hơn mặt cầu ~11 m)
  leanDeg: 12,                // độ — nghiêng về phía Tây, ra xa nhịp chính
  pylonBaseY: 1.5,            // m — cao độ chân tháp, đặt trên 2 gối cầu (ước lượng)
  pylonLen: [12, 3.0] as [number, number],        // m — kích thước dọc cầu tại chân / đỉnh (ước lượng, dáng cánh buồm)
  pylonWid: [5.0, 2.8] as [number, number],       // m — kích thước ngang cầu tại chân / đỉnh, lọt dải phân cách 5,5 m (ước lượng)
  pylonRings: 64,             // số vòng tiết diện dựng tháp
  bearingR: 1.7,              // m — bán kính gối cầu (ước lượng)
  staysFront: 18,             // dây mặt trước (ước lượng trong khoảng 15–25)
  staysBack: 18,              // dây mỗi mặt sau
  anchorT: [0.5, 0.96] as [number, number],       // đoạn thân tháp có neo dây, tính theo tỉ lệ chiều dài trục tháp (ước lượng)
  frontDeck: [24, 226] as [number, number],       // m — từ tim tháp tới neo dầm của dây trước: gần → xa
  backDeck: [14, 116] as [number, number],        // m — dây sau: neo dầm gần tháp nhất (dây cao nhất) → xa nhất (dây thấp nhất)
  backDeckZ: 17.7,            // m — neo dây sau ở mép ngoài dầm
  stayR: 0.1,                 // m — dây văng gồm vỏ bọc (ước lượng)
  hdpeR: 0.17,                // m — ống bảo vệ HDPE gần neo dầm (ước lượng)
  hdpeLen: 4.0,               // m
  lampSpacing: 30,            // m
  nvtZ: -65,                  // m — cầu Nguyễn Văn Trỗi cũ, sát phía Bắc (cục bộ)
  nvtDeckY: 7.0,              // m — mặt cầu đi bộ (ước lượng)
  nvtWidth: 9,                // m (ước lượng)
  nvtTruss: 6,                // m — chiều cao dàn thép (ước lượng)
  nvtSpans: 8,                // nhịp dàn thép qua sông (ước lượng)
  lodDistance: 1500           // m
};
function deriveTtl(C: typeof tranThiLyBase) {
  const westEnd = C.pylonX - sum(C.backSpans) - sum(C.westSpans);  // −376 m — mố Tây
  const mainEnd = C.pylonX + C.mainSpan;                           // 100 m — cuối nhịp dây văng
  const eastEnd = mainEnd + sum(C.eastSpans);                      // 355 m — mố Đông
  const spanCount = C.backSpans.length + C.westSpans.length + 1 + C.eastSpans.length; // 12
  const piers: number[] = []; let x = C.pylonX;
  for (const s of [...C.backSpans, ...C.westSpans]) { x -= s; piers.push(x); }
  piers.pop();                                                     // điểm cuối là mố
  x = mainEnd; piers.push(x);
  for (const s of C.eastSpans) { x += s; piers.push(x); }
  piers.pop();
  const lean = THREE.MathUtils.degToRad(C.leanDeg);
  const axisLen = C.pylonHeight / Math.cos(lean);                  // ≈ 148,2 m dọc trục tháp
  const hw = C.deckWidth / 2;
  const laneOffsets = Array.from({ length: C.lanesPerDir }, (_, i) => C.median / 2 + C.laneWidth * (i + 0.5)); // 4,625 / 8,375 / 12,125
  return { ...C, westEnd, mainEnd, eastEnd, spanCount, piers, lean, axisLen, hw, laneOffsets };
}

/* ---------------------------- Cầu sông Hàn ----------------------------
   Cầu quay dây văng (khánh thành 29/3/2000), giữa Cầu Rồng (Nam) và Cầu Thuận Phước (Bắc). */
const songHanBase = {
  z: -1080,                   // m — dải đường trống trong khu phố, cách Cầu Rồng ~1,1 km về phía Bắc
  totalLength: 487.7,         // m
  deckWidth: 12.9,            // m
  swingSpan: 122.7,           // m — nhịp quay, dây văng đối xứng
  gap: 1.0,                   // m — khe hở mỗi đầu cánh với nhịp cố định (11×33 + 122,7 + 2×1,0 = 487,7)
  fixedSpan: 33,              // m — nhịp BTCT dự ứng lực
  westSpans: 6,               // nhịp cố định phía Tây (ước lượng theo ảnh)
  eastSpans: 5,               // nhịp cố định phía Đông (ước lượng)
  laneWidth: 3.35,            // m — 1 làn mỗi chiều (ước lượng)
  median: 2.2,                // m — dải giữa mang tháp và neo dây (ước lượng)
  sidewalk: 2.0,              // m — lề bộ hành gồm lan can (ước lượng): 2×3,35 + 2,2 + 2×2,0 = 12,9
  deckY: 13.8,                // m — mặt đường nhịp quay; đáy dầm ~11,5 m → tĩnh không ~11 m theo ảnh (ước lượng)
  swingDepth: 2.3,            // m — dầm thép nhịp quay (ước lượng)
  fixedDepth: 1.9,            // m — dầm BTCT nhịp cố định (ước lượng)
  roadProfile: [[-340, 2.6], [-290, 2.6], [-260.35, 4.4], [-200, 8.4], [-130, 12.4], [-80, 13.75], [-62.35, 13.8], [-30, 13.8],
    [30, 13.8], [62.35, 13.8], [80, 13.75], [130, 12.2], [190, 8.0], [227.35, 5.0], [262, 3.4], [290, 2.6], [340, 2.6]] as [number, number][], // m (ước lượng)
  // trụ quay (rim-bearing turntable), ước lượng theo ảnh
  drumR: 10,                  // m — bán kính trống trụ
  drumTop: 9.4,               // m — mặt trên phần cố định
  railR: 7.5,                 // m — bán kính vành ray
  rollers: 40,                // số con lăn quanh vành
  rimTop: 10.8,               // m — vành quay (thuộc phần quay)
  // tháp thép xanh chữ A dọc cầu + cột đôi ở tim (ước lượng theo ảnh)
  mastHeight: 38,             // m trên mặt cầu
  aFoot: 15,                  // m — chân chữ A cách tâm theo phương dọc cầu
  aApex: 19,                  // m — đỉnh chữ A trên mặt cầu
  stays: 9,                   // dây mỗi phía, một mặt phẳng ở tim cầu
  stayTop: [25, 36.5] as [number, number],        // m trên mặt cầu — đoạn neo dây trên cột
  stayDeck: [20, 59.2] as [number, number],       // m từ tâm — đoạn neo dây trên dầm
  stayR: 0.07,                // m (ước lượng)
  lift: 0.05,                 // m — nâng nhịp quay khỏi gối đầu cánh khi mở khóa
  rotateDir: 1,               // +1: ngược chiều kim đồng hồ nhìn từ trên xuống; −1: cùng chiều
  timing: {                   // giây thời gian thật (chia cho hệ số tăng tốc)
    amber: 4, barrier: 8, stopMax: 60, unlock: 20, rotate: 150, openHold: 1800, lock: 20
  },
  barrierX: 68.35,            // m — barie hai đầu nhịp quay
  autoSchedule: { days: [6, 0], hour: 23, utcOffset: 7 }, // 23:00 thứ Bảy, Chủ nhật giờ Việt Nam
  lodDistance: 1200,          // m — xa hơn: ẩn chi tiết nhỏ (barie, đèn tín hiệu, cơ cấu mâm xoay, fender…)
  farDistance: 1500           // m — xa hơn nữa: ẩn mặt đường, dải LED, lề
};
function deriveSh(C: typeof songHanBase) {
  const swingHalf = C.swingSpan / 2;                                   // 61,35 m
  const fixedStart = swingHalf + C.gap;                                // 62,35 m
  const westEnd = -(fixedStart + C.westSpans * C.fixedSpan);           // −260,35 m
  const eastEnd = fixedStart + C.eastSpans * C.fixedSpan;              // 227,35 m
  const hw = C.deckWidth / 2;
  const lane = C.median / 2 + C.laneWidth / 2;                         // 2,775 m
  const piers: number[] = [];
  for (let k = 1; k < C.westSpans; k++) piers.push(-(fixedStart + k * C.fixedSpan));
  for (let k = 1; k < C.eastSpans; k++) piers.push(fixedStart + k * C.fixedSpan);
  const restX = fixedStart + 0.05;                                     // tâm trụ đón (ước lượng)
  return { ...C, swingHalf, fixedStart, westEnd, eastEnd, hw, lane, piers, restX };
}

/* ---------------------------- Hầm vượt sông Hàn ----------------------------
   Phương án đề xuất 2025 (chưa xây): tuyến thẳng Đống Đa – Trần Phú (Hải Châu) → Vân Đồn – Trần Hưng Đạo (Sơn Trà),
   ≈ 1.670 m: hầm kín qua sông 600 m (hầm dìm), hầm kín trên bờ 380 m, hầm hở 415 m. 6 làn, 60 km/h, 6.880 tỷ đồng.
   Đã công bố: chiều dài từng đoạn, số làn, tốc độ, độ dốc tham khảo, vị trí tuyến. Còn lại là thiết kế ước lượng.
   Tọa độ cục bộ: tim sông là x = 0, đối xứng hai bờ; group đặt tại z = −1700. Mét. */
const hanTunnelBase = {
  z: -1700,                   // m — ~620 m phía Bắc Cầu sông Hàn, ~1,2 km phía Nam Cầu Thuận Phước (ước lượng)
  immersedHalf: 300,          // m — |x| ≤ 300: hầm dìm (5 đốt × 120 m = 600 m)
  coverHalf: 490,             // m — 300 < |x| ≤ 490: hầm kín trên bờ, đào hở rồi lấp (2 × 190 = 380 m)
  rampHalf: 697.5,            // m — 490 < |x| ≤ 697,5: hầm hở (2 × 207,5 = 415 m)
  approachHalf: 835,          // m — 697,5 < |x| ≤ 835: đường dẫn trên mặt đất (2 × 137,5 m)
  elements: 5, elementLen: 120, // đốt hầm dìm bê tông cốt thép đúc sẵn (ước lượng)
  // mặt cắt ngang: |1,0| ống 12,5 |0,6| hành lang 3,0 |0,6| ống 12,5 |1,0| = 31,2 m (ước lượng, theo hầm Thủ Thiêm)
  halfWidth: 15.6, outerWall: 1.0, midWall: 0.6, corridorHalf: 1.5,
  tubeNear: 2.1, tubeFar: 14.6, tubeCenter: 8.35, // m — mép trong gần / xa tim, tim ống
  laneWidth: 3.5, lanesPerDir: 3, shoulder: 1.0,   // 2 làn ô tô + 1 làn xe máy sát lề phải
  slabBelow: 1.5,             // m — bản đáy dưới mặt đường
  clear: 5.8,                 // m — chiều cao trong ống (tĩnh không 4,75 m + thiết bị)
  roofT: 1.2,                 // m — bản nóc → đốt dìm cao 1,5 + 5,8 + 1,2 = 8,5 m
  corridorClear: 2.6,         // m — chiều cao hành lang thoát nạn
  carSpeed: 16.7, bikeSpeed: 11.1, // m/s — 60 km/h ô tô, 40 km/h xe máy
  // trắc dọc: [|x|, cao độ mặt đường] là các điểm đổi dốc; vc = chiều dài đường cong đứng parabol tại đó (ước lượng)
  profile: [[0, -14.6], [90, -14.33], [300, -10.35], [490, -5.6], [705, 3.84], [745, 2.6]] as [number, number][],
  vc: [0, 40, 0, 80, 24, 20],
  bedMid: -6, bedBank: -2.5, bedFlat: 90, // m — đáy sông ở luồng giữa (|x| ≤ 90) và sát kè (ước lượng)
  minCover: 1.0,              // m — nóc hầm dìm thấp hơn đáy sông tối thiểu
  floodSill: 1.0,             // m — gờ chắn ngập ở đỉnh dốc cửa hầm hở, cao hơn mặt phố
  maxGrade: { immersed: 0.02, cover: 0.035, ramp: 0.045 }, // độ dốc dọc tối đa từng đoạn (đoạn đáy sông 0,3% là điểm trũng)
  trenchBottomHalf: 19, trenchSlope: 2.5, // hào nạo vét cho hầm dìm: nửa bề rộng đáy, mái dốc 1 : 2,5
  louverLen: 80,              // m — mái lam che nắng mưa sát cửa hầm kín, mỗi phía
  louverGap: 2.0,             // m — bước lam
  fanStep: 100, sosStep: 50, crossStep: 100, signalStep: 150, // bước thiết bị dọc hầm kín
  gantryX: 747.5,             // m — khung giới hạn chiều cao, cách đầu hầm hở 50 m
  heightLimit: 4.5,
  lodDistance: 600, farDistance: 650, hideDistance: 1500, lifeDistance: 450   // chi tiết nhỏ ẩn xa hơn 600 m; mặt đường/vỉa hè xa hơn 650 m; xe xa hơn 450 m; cả công trình xa hơn 1.500 m
};
function deriveHr(C: typeof hanTunnelBase) {
  const nodes = C.profile.map(([x, y], i) => ({ x, y, L: C.vc[i] })), last = nodes[nodes.length - 1];
  const grades = nodes.slice(1).map((n, i) => (n.y - nodes[i].y) / (n.x - nodes[i].x));
  const gIn = nodes.map((_, i) => (i > 0 ? grades[i - 1] : grades[0])), gOut = nodes.map((_, i) => (i < grades.length ? grades[i] : 0));
  /* mặt đường theo |x|: đường gãy khúc, bo bằng parabol quanh điểm đổi dốc; phẳng 2,6 m sau x = 745 */
  const roadY = (x: number) => {
    const a = Math.abs(x);
    for (let k = 1; k < nodes.length; k++) {
      const n = nodes[k];
      if (n.L && Math.abs(a - n.x) < n.L / 2) { const t = a - (n.x - n.L / 2); return n.y - gIn[k] * n.L / 2 + gIn[k] * t + (gOut[k] - gIn[k]) * t * t / (2 * n.L); }
    }
    if (a >= last.x) return last.y;
    let i = 1; while (a > nodes[i].x) i++;
    return nodes[i - 1].y + grades[i - 1] * (a - nodes[i - 1].x);
  };
  const bedY = (x: number) => { const a = Math.abs(x); return a <= C.bedFlat ? C.bedMid : a >= 262 ? C.bedBank : C.bedMid + (C.bedBank - C.bedMid) * (a - C.bedFlat) / (262 - C.bedFlat); };
  const roofTop = C.clear + C.roofT;                                // nóc ống so với mặt đường: 7,0 m
  const laneOffsets = Array.from({ length: C.lanesPerDir }, (_, i) => C.tubeCenter + C.laneWidth * (i - (C.lanesPerDir - 1) / 2)); // 4,85 / 8,35 / 11,85
  const elementEdges = Array.from({ length: C.elements + 1 }, (_, i) => -C.immersedHalf + i * C.elementLen);
  const cutZ = C.tubeCenter + C.laneWidth / 2;   // mặt cắt dọc đi giữa làn ô tô và làn xe máy của ống Nam (xe chạy hướng Đông): xe máy còn nguyên, ô tô bị bóc cùng nửa phía Bắc
  const grade = (x: number) => (roadY(x + 0.5) - roadY(x - 0.5));
  return { ...C, roadY, bedY, roofTop, laneOffsets, elementEdges, cutZ, grade };
}

/* ---------------------------- Hai bờ sông Hàn ----------------------------
   Địa danh thật ven sông, hai tòa chiếu LED trái tim + "DN", bảng quảng cáo, chi tiết bờ. Mét; tọa độ thế giới (z âm là phía Bắc).
   Đã xác minh bằng nguồn công khai: số tầng Novotel Danang Premier Han River (37), Vinpearl Condotel Riverfront (36 tầng nổi + sky bar),
   Trung tâm Hành chính Đà Nẵng (34 tầng nổi, 166,8 m, dáng ngọn hải đăng). Chưa có nguồn công khai nào cho TỌA ĐỘ, nên mọi vị trí là ước lượng. */
const riverfrontBase = {
  floorH: 3.8,                                          // m — chiều cao một tầng (ước lượng)
  novotel: { x: -352, z: -1150, w: 38, d: 38, floors: 37 },       // bờ Tây, 36 Bạch Đằng; chiếu trái tim, mặt chính quay +X (ước lượng vị trí)
  vinpearl: { x: 352, z: -1150, w: 40, d: 40, floors: 37 },       // bờ Đông, 341 Trần Hưng Đạo; 36 tầng nổi + sky bar; mặt chính quay −X (ước lượng vị trí)
  admin: { x: -470, z: -1230, h: 166.8, r0: 17, r1: 9 },          // Trung tâm Hành chính, 24 Trần Phú: 34 tầng, 166,8 m; chân/đỉnh thân (ước lượng)
  market: { x: -366, z: -500, w: 64, d: 48, h: 13 },              // Chợ Hàn: 3 tầng, mặt tiền quay +X (ước lượng)
  museum: { x: -376, z: 110, w: 54, d: 36, h: 9 },                // Bảo tàng Điêu khắc Chăm: tường vàng đất, mái ngói (ước lượng)
  love: { z: -78, length: 38, width: 6 },                         // Cầu Tình Yêu + cá chép hóa rồng, nhô ra từ kè Đông (ước lượng)
  hotels: [{ x: 372, z: -420, w: 36, d: 34, floors: 22 }, { x: 372, z: -660, w: 34, d: 34, floors: 17 }, { x: 374, z: -880, w: 36, d: 36, floors: 25 }], // cụm khách sạn ven Trần Hưng Đạo (ước lượng)
  clearMargin: 4,                                                 // m — lề dọn nhà ngẫu nhiên quanh chân công trình
  heart: {
    cycle: 24, beat: 0.08, cell: 0.8,                             // chu kỳ hoạt cảnh (s), biên độ tim đập, ô LED (m)
    panelW: 34, panelFrac: 0.66, gap: 0.08,                       // bề rộng tấm (m), tỉ lệ chiều cao phủ, khe so với mặt kính (m)
    dayLevel: 0.04,                                               // độ sáng ban ngày so với ban đêm (≤ 5%)
    intensity: 1.7, duetOffset: 12                                // cường độ LED, lệch pha chế độ Đối đáp (s)
  },
  ads: { panos: 8, roofs: 5, screens: 3, banners: 16, switchEvery: 8, fade: 0.6 },   // số lượng bảng; màn LED đổi quảng cáo mỗi 8 s, chuyển mờ 0,6 s
  promenade: { chunk: 600, lod: 400, benchStep: 20, railStep: 4, lights: 8 }         // dải đi bộ: độ dài chunk LOD, ẩn khi camera xa hơn (m)
};

/* ---------------------------- Thời tiết ----------------------------
   Lớp điều biến sau ngày/đêm (D-009). Preset `now` là no-op. Đơn vị: m, m/s, °C, giây; mọi số là (ước lượng) trừ khi ghi nguồn.
   KHÔNG đặt ngưỡng gió bằng số cho cấm lưu thông / khoá quay cầu: bật theo trạng thái (preset Bão, mốc 60 s kịch bản) — "theo thông báo của thành phố". */
const weatherBase = {
  seed: 20061001,                                       // hạt giống riêng cho nhiễu gió, mưa, chớp — ngày bão Xangsane, không dùng rand()
  enabled: false,                                       // false = không áp gì lên cảnh (mặc định, bảo toàn ảnh và draw call chuẩn)
  swayExaggeration: 20,                                 // hệ số phóng đại dao động cáp/cây khi hiển thị (cố định ×20, không có thanh chỉnh)
  windAlpha: 0.12,                                      // số mũ hồ sơ gió v(z) = v10·(z/10)^α, mặt nước/địa hình trống (cần xác minh theo TCVN 2737)
  windRefH: 10,                                         // m — cao độ chuẩn của v10
  gust: { period: 7, octaves: 3, steps: 256 },          // nhiễu gió giật: chu kỳ cơ bản (s), số tầng sóng, độ dài bảng nhiễu (ước lượng)
  thermal: { steel: 12e-6, concrete: 10.5e-6, refTemp: 25 },   // hệ số giãn nở nhiệt (/°C) thép, bê tông (phổ biến; cần xác minh theo TCVN 11823:2017) và nhiệt độ chuẩn (°C)
  cableSag: { span: 405, sagRatio: 9.5 },               // cáp chủ Thuận Phước: nhịp (m), L/f — dùng tính võng thêm khi nóng
  beaufort: [0.3, 1.6, 3.4, 5.5, 8.0, 10.8, 13.9, 17.2, 20.8, 24.5, 28.5, 32.7, 37.0, 41.5, 46.2, 51.0],   // m/s — ngưỡng dưới cấp 1…16, thang Beaufort ở độ cao 10 m
  tau: { rain: 4, wet: 40, wind: 6, temp: 20, cloud: 10, haze: 10, level: 30, lightning: 3 },   // s — hằng số thời gian tiến về target (mưa tới nhanh, mặt ướt khô chậm, nước dâng/rút chậm) (ước lượng)
  levelMax: 1.2,                                        // m — mực nước sông dâng tối đa (không làm ngập phố)
  rain: { count: 6000, box: [160, 90, 160] as [number, number, number], fall: 18, len: 1.6 },   // số vệt; hộp bao quanh camera (m); tốc độ rơi (m/s); độ dài vệt (m) (ước lượng)
  rainLook: { width: 0.03, alpha: 0.55, color: 0xc4ccd4 },   // m — bề rộng vệt; độ đục tối đa (0–1); màu vệt ban ngày (ước lượng, chỉnh theo ảnh)
  wetness: { roughness: 0.25, darken: 0.65, bridgeDarken: 0.8, bridgeRough: 0.45 },   // mặt ướt (mục 4.4): roughness đường khi ướt hẳn; màu đường ×0,65; bê tông/thép cầu (bridgePatch): màu ×0,8, roughness về tối đa 0,45 (ước lượng). Không đổi envMapIntensity: đường dùng scene.environment nên three bỏ qua giá trị này
  lightning: {
    minGap: 3, maxGap: 12, distMin: 800, distMax: 3000,   // s giữa hai tia chớp (cường độ chớp 1 → minGap, 0 → maxGap, nhân ngẫu nhiên 0,6–1,4); khoảng cách tia chớp tới camera (m) (ước lượng)
    height: 700, segs: 12, branches: 3, branchSegs: 5,   // m — độ cao chân mây; số đoạn tia chính; số nhánh; số đoạn mỗi nhánh (ước lượng)
    jitter: 0.1, widthK: 0.004, yawSpread: 0.6,          // lệch ngang mỗi đoạn (tỉ lệ độ dài đoạn); bề rộng vệt = 0,004 × khoảng cách (m); tia chớp chọn hướng trong ±0,6 rad quanh hướng nhìn của camera (ước lượng)
    flickers: [2, 3] as [number, number], flickMs: [60, 90] as [number, number], gapMs: [40, 70] as [number, number],   // số nháy mỗi lần chớp; thời gian một nháy (ms); khoảng tắt giữa hai nháy (ms)
    hemiPulse: 2.5, expPulse: 1.6, pulseSec: 0.3,        // hemi.intensity cộng thêm, toneMappingExposure nhân thêm (đỉnh), thời gian tắt dần (s)
    color: [3, 3, 4] as [number, number, number]         // màu HDR của tia chớp (cho bloom ban đêm)
  },
  // Vận hành khi bão (GĐ5). KHÔNG đặt ngưỡng gió cho cấm lưu thông / khoá quay cầu: theo trạng thái `closed` của preset Bão ("theo thông báo của thành phố")
  ops: {
    clearSec: 5,                                        // s — dọn hết xe trên Cầu Rồng, Trần Thị Lý và các cầu khi đóng cầu (mục 2.1)
    boatAwaySec: 12,                                    // s — thuyền dừng và ẩn dần khi bão (về bến) (ước lượng)
    showMaxWind: 10, showMaxRain: 0.5                   // m/s, 0–1 — trình diễn lửa/nước Cầu Rồng tạm dừng khi gió trung bình hoặc mưa vượt mức (ước lượng, cần xác minh thực tế)
  },
  // Hiệu năng (D-010): mưa giảm overdraw, tự hạ chất lượng khi FPS thấp. Mọi số (ước lượng), chỉnh theo đo trên GPU thật
  perf: {
    rainNear: 1.5,                                      // m — bỏ vệt mưa gần camera hơn mức này (vệt sát mắt phủ cả màn hình = overdraw lớn nhất)
    rainFadeFar: 70,                                    // m — alpha vệt mưa giảm dần về 0 ở khoảng cách này (cho phép hộp/N nhỏ mà vẫn thấy dày)
    // pixelRatio tối đa khi mưa: chuyển sang CONFIG.perf.rainMaxRatio (bộ quản lý chất lượng, D-018)
    adaptiveWindow: 2,                                  // s — cửa sổ đo FPS trung bình để quyết định hạ chất lượng
    adaptiveMinFps: 40,                                 // FPS — dưới mức này thì hạ một bậc chất lượng
    adaptiveSteps: [1, 0.6, 0.35] as number[],          // hệ số nhân rain.count theo bậc chất lượng (bậc 0 = đầy đủ)
    maxFrameMs: 150                                     // ms — khung dài nhất cho phép khi đổi preset (bắt khựng do biên dịch shader), dùng trong test:weather
  },
  presets: {
    now: null,                                          // Hiện trạng: no-op, không áp gì
    summer: { temp: 37, rain: 0, wind: 3, gust: 1, cloud: 0.1, haze: 0.6, level: 0, lightning: 0, closed: false },      // Nắng hè (ước lượng)
    rain: { temp: 26, rain: 0.7, wind: 6, gust: 3, cloud: 0.85, haze: 0, level: 0.4, lightning: 0, closed: false },     // Mưa (ước lượng)
    monsoon: { temp: 22, rain: 0.25, wind: 14, gust: 5, cloud: 0.7, haze: 0, level: 0.2, lightning: 0, closed: false }, // Gió mùa Đông Bắc (ước lượng)
    storm: { temp: 25, rain: 1, wind: 28, gust: 10, cloud: 1, haze: 0, level: 1.2, lightning: 0.8, closed: true }       // Bão (ước lượng); cấm lưu thông theo trạng thái preset
  },
  // Khí quyển (mục 4.2). Trọng số: sunny = haze; gray = max(mưa, (mây − grayCloud)·grayGain); stormK = min(mưa, gió / stormWind). Mọi số (ước lượng)
  atmosphere: {
    stormWind: 28,                                      // m/s — gió làm chuẩn cho trọng số bão (= gió preset Bão); thanh cường độ 50 % thì stormK = 0,5
    grayCloud: 0.5, grayGain: 1.4,                      // độ phủ mây bắt đầu xám trời; hệ số khuếch đại
    nightDim: 0.9,                                      // màu thời tiết (ban ngày) tối đi theo đêm: nhân (1 − nightDim·night)
    hazeFog: 0.3, hazeTint: 1,                          // sương nóng: mật độ ×(1 + 0,3·haze) = ×1,3 ở haze 1; mức pha màu be
    rainFog: 8, stormFog: 10,                           // mật độ sương ×8 khi mưa 1 (×5,6 ở mưa 0,7), ×10 khi bão
    sunSky: [3, 1.0], graySky: [12, 3], stormSky: [20, 4],   // Sky [turbidity, rayleigh]: nắng gắt trong / mưa / bão
    sunBoost: 0.15, hemiBoost: 0.05, expBoost: 0.08,    // nắng hè: sun ×1,15, hemi ×1,05, exposure ×1,08
    sunCloud: 0.85, stormSun: 0.67,                     // sun ×(1 − 0,85·mây), bão thêm ×0,67 (mây 1 → ×0,1)
    hemiGray: 0.7, hemiStorm: 0.5,                      // hemi ×0,7 khi xám, ×0,5 khi bão
    expGray: 0.9, expStorm: 0.8,                        // exposure ×0,9 khi xám, ×0,8 khi bão
    cloudThin: 0.7, cloudNightOpacity: 0.4, cloudNightDim: 0.12, cloudSpin: 0.004,   // mây nắng mỏng (opacity ×0,3); mây dày ban đêm opacity 0,6; màu mây ban đêm ×0,12; tốc độ xoay cụm mây khi bão (rad/s)
    sunWave: 2.0, grayWave: 4, stormWave: 7, stormSize: 0.4   // water.distortionScale (nắng / mưa / bão) và water.size khi bão (gốc 2,4 và 0,6)
  },
  // Gió (mục 4.5, GĐ4): biên độ THẬT (m) trước khi nhân swayExaggeration; v = gió tức thời tại cao độ tham chiếu (windAt). Mọi số (ước lượng), mô phỏng trực quan, không phải phân tích kết cấu
  wind: {
    refLen: 40,                                         // m — dây ngắn hơn mức này lắc ít hơn tỉ lệ (biên độ × min(1, dài / refLen))
    cableSegs: 8,                                       // số đoạn dọc mỗi dây có lắc (hanger TP, dây văng TTL/SH): shader dịch theo sin(π·t) nên dây 1 đoạn (đỉnh chỉ ở hai đầu) không cong được; 0 draw call thêm
    tp: { h: 50, amp: 0.03, refWind: 30, maxAmp: 0.06, omega: 2.2 },   // hanger Thuận Phước: cao độ giữa hanger (m), biên độ (m) ở refWind (m/s), tăng theo v², trần (m), tần số góc hiển thị (rad/s)
    ttl: { h: 50, peak: 0.05, lo: 6, hi: 18, rainOn: [0.1, 0.3] as [number, number], dryAmp: 0.008, buffet: 0.1, buffetRise: 6, refWind: 30, omega: 3.0 },   // dây văng TTL: rung mưa–gió cực đại (m) khi gió trong [lo, hi] m/s VÀ mưa > ~0,2 (nhận dần trong rainOn); không mưa chỉ còn dryAmp·(v/refWind)²; gió vượt hi thì thêm dao động do gió giật buffet·(v/refWind)² (m, nhận dần trong hi…hi + buffetRise m/s) (ước lượng)
    sh: { h: 35, amp: 0.015, refWind: 30, maxAmp: 0.03, omega: 2.6 },  // dây văng Cầu sông Hàn (ngắn, căng): như TP nhưng nhỏ hơn
    trees: { lean: 0.03, sway: 0.02, refWind: 28, max: 0.06, omega: 1.6 },   // tán cây: độ nghiêng tĩnh / dao động (m dịch trên mỗi m cao) ở refWind, tăng theo v², trần; KHÔNG nhân phóng đại (cây lắc thấy được thật)
    boatRock: 0.08,                                     // biên độ tròng trành thuyền × (1 + 0,08·gió m/s) → bão 28 m/s ≈ ×3,2
    whisker: 0.06,                                      // râu rồng đung đưa × (1 + 0,06·gió)
    waveSpeed: 0.04, windWave: 3,                       // tốc độ trôi pháp tuyến nước × (1 + 0,04·gió); distortionScale cộng 3·(gió/stormWind) (ngoài phần bão đã có)
    fire: 1.0, water: 0.15, mist: 1.2                   // hệ số cộng vận tốc gió vào hạt lửa / tia nước / sương Cầu Rồng (1/s): vel += gió·k·dt
  },
  // Nắng hè (mục 4.7, GĐ7): ảo ảnh mặt đường (shader MAT.road/road2, cường độ = uHaze × (1 − đêm)). Mọi số (ước lượng)
  summer: {
    mirageNear: 60, mirageFar: 200,                     // m — ảo ảnh bắt đầu hiện từ 60 m và đủ mạnh ở 200 m tính từ camera
    mirageGraze: 0.28,                                  // |cos| giữa tia nhìn và pháp tuyến mặt đường: nhỏ hơn mức này (nhìn sát mặt) mới có ảo ảnh
    mirageMix: 0.55, mirageLift: 0.12,                  // tỉ lệ trộn tối đa màu sương/trời vào mặt đường; cộng sáng thêm
    mirageWobble: 0.004, mirageFreq: 2.2                // độ lệch UV mặt đường (đơn vị UV) và tần số dao động (rad/s)
  },
  // Cây đổ sau bão (mục 4.8, GĐ7): chọn gần góc nhìn, nghiêng quanh gốc theo hướng gió; không đụng instance đã dọn scale 0
  fallen: {
    count: [6, 10] as [number, number],                 // số cây đổ mỗi lần (chọn bằng rng riêng, seed + 7)
    angleDeg: 80, jitter: 0.3,                          // độ nghiêng cuối (°) và lệch hướng ngẫu nhiên (rad)
    radius: 350, pool: 40,                              // m — chỉ xét cây trong bán kính quanh điểm nhìn; chọn trong `pool` cây gần nhất
    fallSec: 3, hold: 120,                              // s — thời gian đổ dần; thời gian giữ trạng thái "sau bão" khi chọn preset (hết thì dựng lại cây)
    armWind: 20, calmWind: 8                            // m/s — gió hiện tại đạt mức này thì "bão đã qua đỉnh"; gió đích dưới calmWind (và hết cấm) thì cây đổ
  },
  // Âm thanh thời tiết (mục 7, GĐ7): Web Audio tổng hợp. Mọi số (ước lượng)
  sound: {
    rainGain: 0.2, rainBand: [3500, 0.6] as [number, number], rainLow: 6500,   // gain mưa tối đa; bandpass (Hz, Q) và lowpass (Hz)
    patter: 28,                                         // số "tí tách" tối đa mỗi giây khi mưa 1
    windGain: 0.4, windBase: 180, windPerMs: 22, windQ: 1.6,   // gain gió tối đa (∝ (v/28)²); tần số bandpass = windBase + windPerMs·v (Hz)
    thunderLow: [120, 300] as [number, number], thunderSec: [2, 4] as [number, number], thunderGain: 1.1,   // lowpass sấm (Hz); thời lượng rền (s); gain ở 800 m
    musicDuck: 0.7, indoors: 0.15                       // nhạc nền hạ còn 70 % khi bão (−30 %); tiếng mưa/gió còn 15 % khi camera trong hầm / dưới nước
  },
  // Kịch bản bão (mục 6, GĐ7): dòng thời gian `duration` giây khi không có giọng đọc; mỗi mốc đặt target (cộng dồn từ trạng thái trung tính) và đổi chú thích
  // Camera bay liên tục qua STORM_TOUR (views/tourStops.ts, mỗi mốc một điểm) như Tour; có giọng đọc thì cửa sổ mỗi mốc kéo dài cho đọc xong (D-013)
  // Cấm lưu thông / khoá quay cầu / tắt quảng cáo bật theo `closed` (mốc 60 s, "theo thông báo của thành phố"), không theo ngưỡng gió
  scenario: {
    duration: 120,
    arrive: 0.45,                                       // camera tới điểm của mốc k ở T_k + arrive·W_k (W_k: cửa sổ mốc k): chú thích đổi khi camera đang bay tới, như SWITCH 0,55 của Tour
    pad: 1.2,                                           // s — nghỉ sau lời đọc trước mốc kế (như PAD của Tour)
    entryArc: 0.15, entryArcMax: 250,                   // đoạn bay vào điểm đầu: nâng giữa đường thêm entryArc × khoảng cách (tối đa entryArcMax m) để không xuyên tháp cầu (ước lượng)
    steps: [
      { t: 0, p: { wind: 6, cloud: 0.6 }, cap: 'wxS1' },
      { t: 15, p: { wind: 10, cloud: 0.9, rain: 0.3 }, cap: 'wxS2' },
      { t: 30, p: { wind: 15, rain: 0.6 }, cap: 'wxS3' },
      { t: 45, p: { wind: 22, gust: 8, rain: 0.9, lightning: 0.5 }, cap: 'wxS4' },
      { t: 60, p: { wind: 28, gust: 10, rain: 1, level: 0.8, closed: true }, cap: 'wxS5' },
      { t: 80, p: { level: 1.2, lightning: 0.9 }, cap: 'wxS6' },
      { t: 95, p: { wind: 12, gust: 3, rain: 0.5, lightning: 0.2 }, cap: 'wxS7' },
      { t: 110, p: { wind: 3, gust: 0, rain: 0, cloud: 0.3, lightning: 0, level: 0.2, closed: false }, cap: 'wxS8' }
    ] as { t: number; p: Record<string, number | boolean>; cap: string }[]
  },
  windDir: 0,                                           // rad — hướng gió thổi tới mặc định (0 = từ Tây sang Đông, +X)
  monthPreset: ['monsoon', 'monsoon', 'now', 'now', 'summer', 'summer', 'summer', 'summer', 'rain', 'rain', 'monsoon', 'monsoon'] as string[]   // preset tự chọn theo tháng 1–12, chỉ khi URL không có ?test (ước lượng theo mùa khí hậu)
};

/* ---------------------------- Vòng quay Mặt Trời (Sun Wheel) ----------------------------
   Asia Park, bờ Tây, phía Nam Cầu Trần Thị Lý. Mét, độ, giây; tọa độ thế giới (z âm là phía Bắc), mặt đất y = landY.
   Đã có nguồn: 115 m, 64 cabin × 6 khách, ~15 phút/vòng, 980 t, 13 000 LED trên 32 thanh, mở 18/7/2014, trước là "Igosu 108" (Biwako Tower, Shiga, 1992, 108 m)
   (Wikipedia, danang.gov.vn, vietnamtourism.vn, vietnambooking). Tọa độ tâm và hướng mặt phẳng do người dùng đo trên Google Maps (2026-10-22).
   Phần còn lại (đường kính, bệ, tháp đỡ, vị trí x) là ước lượng đo tỉ lệ trên ảnh. Theo một số nguồn vòng quay đã ngừng từ 9/2025; mô hình thể hiện lúc còn vận hành. */
const sunWheelBase = {
  lat: 16.040525, lon: 108.228459,   // ° — tâm vòng quay (người dùng đo); so Cầu Rồng (16,06116°N; 108,22719°E): 2 282 m về Nam, 136 m về Đông
  z: 2280,                           // m — theo khoảng cách Nam–Bắc tới Cầu Rồng (mô hình coi sông thẳng)
  x: -440,                           // m — (ước lượng) 262 mép kè + ~180 m vào bờ Tây, đọc trên ảnh vệ tinh; không lấy từ kinh độ vì sông thật lệch Đông dần về phía Nam
  azimuth: 83,                       // ° — phương vị mặt phẳng vòng quay (83°↔263°, Đông Đông Bắc – Tây Tây Nam); trục quay 173°↔353°
  height: 115,                       // m — đỉnh cabin so với mặt đất (có nguồn)
  cabins: 64, seats: 6,              // số cabin, khách mỗi cabin (có nguồn: 384 khách)
  spokes: 32, leds: 13000,           // thanh chính mang LED, tổng số LED (có nguồn)
  period: 900,                       // s — một vòng ≈ 15 phút (có nguồn)
  speeds: [0, 1, 10, 60],            // hệ số tốc độ quay: dừng, thật, ×10, ×60
  mass: 980,                         // t (có nguồn, một nguồn)
  rimR: 46.5,                        // m — bán kính vành (ước lượng, suy từ height = baseH + 2·(rimR + cabinH); đường kính ≈ 93 m)
  cabinH: 4.5,                       // m — cabin + giá treo, treo ngoài vành (ước lượng)
  baseH: 13,                         // m — mặt sàn mái bệ so với mặt đất; cabin thấp nhất chạm sàn này (ước lượng)
  baseLen: 100, baseDepth: 30,       // m — bệ dọc mặt vòng quay, và bề sâu theo trục quay (ước lượng)
  plaza: { len: 120, depth: 70 },    // m — quảng trường lát đá phía mặt Nam, nối vào bệ (ước lượng)
  clearMargin: 6,                    // m — lề dọn nhà/cây quanh nền
  lodDistance: 1500,                 // m — xa hơn thì ẩn cabin, chi tiết nhà ga
  /* ---- hình học (GĐ2), đọc tỉ lệ từ ảnh n1 (chính diện) và a1 (flycam); toàn bộ là ước lượng ---- */
  rim: { gap: 5, tube: 0.45, ties: 64 },          // m — hai vòng vành chính cách nhau 5 m theo trục quay, bán kính ống 0,45 m; 64 thanh giằng giữa hai vòng (ước lượng)
  ring2: 0.65, ring2Tube: 0.25,                   // vành phụ ở 0,65 R (theo ảnh n2), ống 0,25 m (ước lượng)
  hubRing: 7, hubRingTube: 0.3,                   // m — vành nhỏ quanh moay-ơ, bán kính 7 m (ước lượng)
  hub: { r: 2.6, len: 7 },                        // m — moay-ơ: bán kính, dài theo trục quay (ước lượng)
  spokeR: 0.22, cableR: 0.07, cables: 64,         // m — bán kính 32 thanh chính và 64 cáp chéo mảnh (ước lượng; n1 thấy nhiều hơn 32 đường)
  axle: { r: 1.3, len: 24 },                      // m — trục tĩnh theo phương 173°/353°, dài qua hai mặt giàn (ước lượng)
  legs: { zTop: 10, zBot: 13, xBot: 26, xTop: 3, w: 1.2, brace: 0.5, tiers: 5 },   // m — giàn tháp hình thang mỗi bên mặt vòng quay: mặt giàn cách mặt vòng quay 10 m ở trục, 13 m ở chân; chân rộng ±26 m trên mặt bệ, đỉnh ±3 m; tiết diện chân 1,2 m, giằng 0,5 m; 5 tầng giằng ngang (ước lượng, n1)
  cabin: { r: 1.5, len: 1.3, glass: 0.8 },        // m — cabin hình viên nang đứng: bán kính 1,5, thân thẳng 1,3 (cao 4,3 m), dải kính cao ±0,8 m quanh giữa (ước lượng)
  station: { towerW: 17, towerH: 15, archW: 7, archH: 8.5, archX: 21, panel: 0.55, deckPlanters: 8 },   // m — tháp vuông hai đầu bệ rộng 17, cao 15; 3 vòm cuốn rộng 7, cao 8,5, cách nhau 21 m; ốp đá xám (hệ số màu 0,55); 8 bồn cây trên sàn mái (ước lượng, n1)
  pavilion: { w: 12, h1: 4, h2: 3, roof1: 3, roof2: 2.6 },   // m — lầu trên tháp: rộng 12, tầng dưới cao 4, tầng trên 3, mái dưới cao 3, mái trên 2,6 (ước lượng, n1/a1)
  gate: { r: 9, tube: 0.9, stageD: 8 },           // m — cổng vòm vàng giữa mặt Nam (sân khấu): bán kính vòm 9, ống 0,9, sân khấu sâu 8 (ước lượng, a1)
  sign: { w: 16, h: 3.2, below: 13 },             // m — biển "SUN WHEEL" rộng 16, cao 3,2, tâm thấp hơn trục 13 m, mặt Nam (ước lượng, n1)
  lamps: { n: 8, h: 8 },                          // cột đèn quảng trường: số cột, cao m (ước lượng)
  /* ---- chuyển động (GĐ3) ---- */
  speedAccel: 6,                                  // hệ số tốc độ/giây — đổi tốc độ mượt: dừng ↔ ×60 mất ≈ 10 s, dừng ↔ ×1 chưa tới 0,2 s (ước lượng)
  stepMax: 0.1,                                   // s — bước tích phân tối đa khi một khung dài (không bỏ sót đổi tốc độ)
  placeEps: 1e-4,                                 // rad — lệch góc tối thiểu để dựng lại ma trận 64 cabin
  /* ---- LED ban đêm (GĐ4): emissive trong shader, nhân shared.uNight, không thêm mesh/đèn. Độ sáng là hệ số emissive (ước lượng, chỉnh theo ảnh n1/a2, bloom ngưỡng 0,98) ---- */
  led: {
    shows: ['white', 'pink', 'rays', 'heart', 'off'],   // thứ tự uShow 0–4: trắng (n1–n3), hồng tím (a2), tia chạy, nhịp tim (đồng bộ LED trái tim riverfront), tắt
    show: 0,                                       // kiểu mặc định: trắng
    spoke: 1.5, rim: 2.2, ring: 1.2, cable: 0.35, hub: 0.6,   // độ sáng 32 thanh chính, viền vành chính, vành phụ/vành moay-ơ, cáp chéo, moay-ơ (ước lượng)
    flood: 0.32,                                   // giàn tháp đỡ + trục được chiếu trắng (n1–n3): độ sáng ở kiểu trắng; các kiểu màu bằng một nửa, tắt = 0 (ước lượng)
    cabinRing: 2.0, cabinShell: 0.12,              // viền LED đỏ quanh cabin (hai vòng sát mép dải kính) và ánh đỏ cả vỏ (ước lượng)
    cabinRingW: 0.22,                              // m — bề cao mỗi vòng viền LED cabin (ước lượng)
    lamp: 1.6,                                     // đèn cột quảng trường (ánh vàng ấm), sáng mọi kiểu show (ước lượng)
    pinkWave: 0.8,                                 // rad/s — tốc độ dải màu hồng ↔ tím trượt dọc nan (ước lượng)
    rayRate: 0.6, rayCount: 1.5,                   // tia chạy: số vòng sóng/giây và số sóng trên một bán kính (≈ 1,1 s một sóng từ moay-ơ ra vành) (ước lượng)
    heartBase: 0.25                                // nhịp tim: độ sáng nền giữa hai nhịp; đỉnh nhịp cộng thêm 1 (ước lượng)
  },
  /* ---- ngồi cabin (GĐ5): camera gắn tâm cabin, không thêm mesh/đèn ---- */
  ride: {
    eyeUp: 0.4,                                    // m — mắt cao hơn tâm cabin (ngồi trên ghế, cabin cao 4,3 m) (ước lượng)
    pitch0: -0.12,                                 // rad — góc nhìn xuống lúc lên cabin, hơi chúi để thấy cầu phía Bắc (ước lượng)
    pitchMax: 1.4,                                 // rad — giới hạn ngẩng/cúi khi kéo chuột (≈ 80°)
    lookSpeed: 0.005,                              // rad/px — tốc độ xoay khi kéo chuột
    enterTime: 1.6                                 // s — thời gian bay từ góc nhìn hiện tại vào cabin (ước lượng, như flyTo)
  },
  /* ---- Tour (GĐ7): điểm 4 lên cabin, tua nhanh tới đỉnh rồi giảm tốc; điểm 5 ngắm 4 cầu từ đỉnh; điểm 6 show LED đêm. Không thêm mesh/đèn ---- */
  tour: {
    climbSpeed: 40,                                // hệ số tốc độ khi lên đỉnh (ước lượng): với speedAccel = 6, đáy → đỉnh ≈ 18 s, ngắn nhất trong khoảng ×30–×50
    topSpeed: 1,                                   // hệ số tốc độ khi tới đỉnh: quay thật, cabin nhích chậm quanh đỉnh để ngắm cầu
    climbSec: 18,                                  // s — thời gian điểm 4 hiện tối thiểu (kể cả khi tắt giọng), đủ để lên tới đỉnh ở climbSpeed (ước lượng)
    topSec: 12,                                    // s — thời gian điểm 5 hiện tối thiểu (ước lượng)
    show: 'pink'                                   // kiểu show LED ở điểm 6 (hồng tím, như ảnh a2)
  },
  /* ---- thời tiết (GĐ6): dừng theo `closed` của preset Bão (không có ngưỡng gió, D-012); cabin lắc theo windFx. Không thêm mesh/đèn ---- */
  storm: {
    stopSec: 10,                                   // s — từ lúc bão đóng cửa tới khi vòng quay dừng hẳn, giảm tốc tuyến tính từ tốc độ lúc đó (ước lượng)
    sway: {
      ref: 25,                                     // m/s — gió (độ lớn windFx) mà cabin lắc tới biên độ tối đa; biên độ ∝ (gió/ref)², có trần (ước lượng)
      maxTilt: 0.16,                               // rad — góc nghiêng tối đa của cabin (≈ 9°) (ước lượng)
      mean: 0.5,                                   // phần nghiêng cố định theo hướng gió; phần còn lại là dao động quanh đó (ước lượng)
      omega: 1.6,                                  // rad/s — tần số lắc của cabin treo (giá treo ngắn nhưng cabin nặng, có cản) (ước lượng)
      phase: 2.4,                                  // rad — lệch pha cố định giữa hai cabin liền kề (không dùng rand()) (ước lượng)
      pivotUp: 3.6                                 // m — điểm treo cao hơn tâm cabin (nửa cabin 2,15 m + giá treo ≈ 1,5 m) (ước lượng)
    }
  }
};
function deriveSunWheel(C: typeof sunWheelBase) {
  const yaw = THREE.MathUtils.degToRad(90 - C.azimuth);          // quay quanh Y: trục X cục bộ (dọc mặt vòng quay) về phương vị 83°, +7° lệch Bắc
  const cabinR = C.rimR + C.cabinH / 2;                          // bán kính tâm cabin, treo ngoài vành
  const hubY = base.landY + C.baseH + C.cabinH + C.rimR;      // cao độ trục ≈ 66,5 so với mặt nước (≈ 64 so với mặt đất)
  const topY = hubY + C.rimR + C.cabinH;                         // đỉnh cabin ≈ 117,5 so với mặt nước (115 m so với mặt đất)
  const omega = 2 * Math.PI / C.period;                          // rad/s ở tốc độ thật
  const cabinStep = 2 * Math.PI / C.cabins;
  /* nền cần dọn: bệ + quảng trường theo hệ cục bộ (X dọc mặt, Z về mặt Nam), đổi sang khung bao trục thế giới */
  const local = { x0: -Math.max(C.baseLen, C.plaza.len) / 2, x1: Math.max(C.baseLen, C.plaza.len) / 2, z0: -C.baseDepth / 2, z1: C.baseDepth / 2 + C.plaza.depth };
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const pts = [[local.x0, local.z0], [local.x1, local.z0], [local.x1, local.z1], [local.x0, local.z1]].map(([lx, lz]) => [C.x + lx * c + lz * s, C.z - lx * s + lz * c]);
  const site = { x0: Math.min(...pts.map((p) => p[0])), x1: Math.max(...pts.map((p) => p[0])), z0: Math.min(...pts.map((p) => p[1])), z1: Math.max(...pts.map((p) => p[1])) };
  return { ...C, yaw, cabinR, hubY, topY, omega, cabinStep, local, site };
}

/* ---- Tour 4 cầu ----
   Hành trình một chiều Trần Thị Lý → Cầu Rồng → Cầu sông Hàn → Thuận Phước (~4,2 km), điểm dừng ở views/tourStops.ts (ALL_TOUR) */
const tourAllBase = {
  segMax: 24,    // s — trần thời lượng một đoạn bay (Tour từng cầu: 16 s); đoạn chuyển giữa hai cầu dài 1–1,8 km (ước lượng)
  holdMin: 6     // s — giữ khung hình tối thiểu ở điểm cuối trước khi trả điều khiển; có giọng đọc thì kéo tới hết clip (ước lượng)
};

/* ------------------------- Hiệu năng (tối ưu, D-018) -------------------------
   Đo thời gian khung (HUD) và ngưỡng giật khựng dùng chung cho test:perf / test:weather */
const perfBase = {
  hudSamples: 240,    // số khung giữ trong vòng mẫu để tính trung bình / p95 / max trên HUD (≈ 4 s ở 60 FPS)
  maxHitchMs: 150,    // ms — khung dài nhất cho phép khi đổi trạng thái (đêm, mặt cắt, bóng, bay tới công trình) (ước lượng, theo weather.perf.maxFrameMs)
  /* Bậc chất lượng, tốt → nhẹ. Chế độ Tự động đi lên/xuống theo thang này; chọn tay Cao/Trung bình/Thấp nhảy tới bậc `manual`.
     ratio: pixelRatio tối đa (không vượt devicePixelRatio); shadow: cạnh shadow map (px), 0 = tắt bóng; shadowEvery / reflectEvery: vẽ lại bóng / phản chiếu nước
     mỗi n khung (0 = tắt phản chiếu, mặt nước phản chiếu màu trời); bloom: tỉ lệ độ phân giải bloom ban đêm (0 = tắt); clouds: số tấm mây. Mọi số (ước lượng), chỉnh theo đo trên GPU thật */
  steps: [
    { tier: 'high', ratio: 2, shadow: 2048, shadowEvery: 1, reflectEvery: 1, bloom: 1, clouds: 26 },      // = cảnh gốc (bảng draw call chuẩn đo ở bậc này)
    { tier: 'high', ratio: 1.5, shadow: 2048, shadowEvery: 1, reflectEvery: 1, bloom: 1, clouds: 26 },
    { tier: 'medium', ratio: 1.5, shadow: 1024, shadowEvery: 2, reflectEvery: 2, bloom: 0.5, clouds: 26 },
    { tier: 'medium', ratio: 1.25, shadow: 1024, shadowEvery: 2, reflectEvery: 2, bloom: 0.5, clouds: 26 },
    { tier: 'medium', ratio: 1, shadow: 1024, shadowEvery: 2, reflectEvery: 3, bloom: 0.5, clouds: 18 },
    { tier: 'low', ratio: 1, shadow: 0, shadowEvery: 1, reflectEvery: 0, bloom: 0, clouds: 12 },
    { tier: 'low', ratio: 0.75, shadow: 0, shadowEvery: 1, reflectEvery: 0, bloom: 0, clouds: 12 }
  ],
  manual: { high: 0, medium: 2, low: 5 } as Record<'high' | 'medium' | 'low', number>,   // bậc ứng với lựa chọn tay
  adapt: {
    window: 2,          // s — cửa sổ đo thời gian khung trung bình
    downMs: 22,         // ms — trung bình cửa sổ trên mức này (≈ dưới 45 FPS) thì hạ một bậc
    upMs: 12,           // ms — trung bình dưới mức này (≈ trên 80 FPS) liên tục `upHold` giây thì nâng một bậc
    upHold: 10,         // s
    cooldown: 3,        // s — tối thiểu giữa hai lần đổi bậc (đổi pixelRatio phải cấp lại framebuffer)
    ignoreMs: 400       // ms — bỏ khung dài hơn (đổi tab, biên dịch một lần) khỏi trung bình: không hạ chất lượng vì một lần giật
  },
  rainMaxRatio: 1.5,    // pixelRatio tối đa khi mưa đang hiện (thay cho weather.perf.rainMaxPixelRatio, áp qua bộ quản lý chất lượng)
  start: { phone: 5, weak: 2 }   // bậc khởi đầu ở chế độ Tự động: điện thoại / máy tính yếu (≤ 4 GB RAM hoặc ≤ 4 luồng); còn lại bậc 0
};

/* ------------------------- Giao diện gọn (điện thoại) -------------------------
   Chế độ gọn bật khi cửa sổ khớp compactQuery: bảng điều khiển thu thành hai tờ (Cài đặt / Góc nhìn) */
const uiBase = {
  compactQuery: '(max-width: 760px), (max-height: 500px)',   // media query bật chế độ gọn: điện thoại dọc (≤ 760 px rộng) hoặc ngang (≤ 500 px cao)
  resizeDebounceMs: 120,   // ms — chờ sau khi đổi cỡ cửa sổ / xoay máy rồi mới tính lại bố cục (ước lượng)
  donate: {
    url: 'https://me.momo.vn/bbk9x'   // URL nhận tiền MoMo; dùng alias riêng, không dùng số điện thoại vì URL nằm trong bundle công khai
  }
};

/* ------------------------- Tự khám phá bằng dù lượn -------------------------
   Chế độ bay tự do (W/A/S/D), mô hình bay ở explore/flight.ts. Mọi số đều (ước lượng) */
const exploreBase = {
  speed: 50,           // m/s — tốc độ ngang khi cất cánh (ước lượng)
  speedMin: 15,        // m/s — tốc độ ngang nhỏ nhất, giữ Q (ước lượng)
  speedMax: 100,       // m/s — tốc độ ngang lớn nhất, giữ E (ước lượng)
  speedAccel: 30,      // m/s² — mức tăng/giảm tốc khi giữ Q/E (ước lượng)
  turnRate: 0.6,       // rad/s — tốc độ đổi hướng ở góc nghiêng tối đa (ước lượng)
  bankMax: 0.45,       // rad — góc nghiêng tối đa (ước lượng)
  bankRate: 2.5,       // 1/s — tốc độ tiến tới góc nghiêng đích (ước lượng)
  climbRate: 20,      // m/s — tốc độ lên/xuống khi giữ W/S (ước lượng)
  floor: 7,            // m — độ cao tối thiểu, y thế giới; chân người treo thấp hơn gốc ~4,4 m nên vẫn trên mặt đất (2,5 m), đủ chui gầm cầu (ước lượng)
  ceiling: 800,        // m — độ cao tối đa, y thế giới (ước lượng)
  takeoff: [2600, 702, -4700] as [number, number, number],   // m — điểm cất cánh [x, y, z], đỉnh Sơn Trà phía Bắc (ước lượng)
  takeoffYaw: Math.atan2(-1800, -2600),   // rad — hướng ban đầu về phía Thuận Phước (0, −2900) (ước lượng)
  bounds: { x0: -2600, x1: 3600, z0: -5600, z1: 2800 },   // m — khung được phép bay; ra sát mép thì bị lái vòng về, không tường cứng (ước lượng)
  returnMargin: 400,   // m — bề rộng dải sát mép khung bắt đầu lái về trong (ước lượng)
  returnEngage: 0.3,   // không đơn vị — trong dải sát mép, hướng bay · hướng vào dưới số này thì bỏ qua phím và lái về (ước lượng)
  returnRelease: 0.6,  // không đơn vị — hướng bay · hướng vào đạt số này thì trả phím cho người chơi; lớn hơn returnEngage để có trễ (ước lượng)
  returnShort: 150,    // m — gần mép hơn số này thì rẽ đường ngắn về trong, xa hơn thì giữ chiều đang rẽ của người chơi (ước lượng)
  returnTurnSpeed: 40, // m/s — khi đang tự lái về khung mà bay nhanh hơn số này thì rẽ gắt theo tỉ lệ, giữ bán kính vòng về (ước lượng)
  chase: { back: 18, up: 9, lookDown: 4, lag: 0.25, lagSpeed: 25, look: 30 },   // m phía sau, m phía trên, m điểm nhìn thấp hơn dù (giữ người treo trong khung), s trễ của camera bám đuôi, m/s bay nhanh hơn số này thì giảm trễ để dù không tụt xa, m nhìn trước (ước lượng)
  glider: {
    span: 11,         // m sải cánh (ước lượng)
    lines: 7,         // m khoảng treo: người treo cách cánh xuống dưới bao nhiêu mét (ước lượng)
    originAt: 0.55,   // tỉ lệ khoảng treo tính từ cánh xuống tới gốc group, không đơn vị (ước lượng)
    lineCount: 7,     // số dây treo mỗi bên, từ cánh xuống vai (ước lượng)
    chord: 2.6,       // m dây cung cánh (ước lượng)
    arch: 0.28,       // độ võng hai đầu cánh, tỉ lệ theo nửa sải (không đơn vị, ước lượng)
    segs: 16,         // số đoạn cánh theo sải (ước lượng)
    flagRed: '#da251d',    // màu nền cánh: đỏ cờ Việt Nam (ước lượng theo màu cờ thường dùng)
    flagStar: '#ffcd00',   // màu sao vàng (ước lượng theo màu cờ thường dùng)
    starRadius: 1.05,      // m bán kính ngoài ngôi sao, ~2/5 dây cung như tỉ lệ sao trên cờ (ước lượng)
    cells: 36,             // số ô khí vẽ trên cánh theo sải (ước lượng)
    tilt: 0.35,            // rad nghiêng cánh cho mép sau hạ xuống, để camera bám đuôi thấy được hình in (ước lượng)
    roughness: 0.6         // độ nhám vải dù, thấp hơn để có ánh bóng (ước lượng)
  }
};

export const CONFIG = {
  ...base,
  perf: perfBase,
  ui: uiBase,
  mainTotal: sum(base.mainSpans),
  thuanPhuoc: deriveTp(thuanPhuocBase),
  tranThiLy: deriveTtl(tranThiLyBase),
  songHan: deriveSh(songHanBase),
  hanTunnel: deriveHr(hanTunnelBase),
  sunWheel: deriveSunWheel(sunWheelBase),
  riverfront: riverfrontBase,
  weather: weatherBase,
  tourAll: tourAllBase,
  explore: exploreBase
};
export type SongHanConfig = typeof CONFIG.songHan;
export type HanTunnelConfig = typeof CONFIG.hanTunnel;
