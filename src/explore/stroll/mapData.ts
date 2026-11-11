/* ============================ Đi dạo: vùng đi được và kết cấu trên mặt cầu ============================
   Dựng dữ liệu tĩnh cho lõi va chạm (map.ts) từ CONFIG và biên dạng hai cầu. Thuần: chỉ import CONFIG, deckY, shRoadY / SH; không dựng cảnh, không đụng DOM.
   Nhà ven sông và chân đế địa danh thêm lúc chạy (Task 6, stAddSolids), không ở đây.
   Luật (spec §4, plan "Bậc thấp trên mặt cầu"):
   - Mép vùng là nơi TÂM nhân vật tới được: lan can / mép kè lùi vào radius.
   - Bậc ≤ stepMax (lề, dải phân cách, mặt đường) cộng sẵn vào y(x, z) của vùng: nhân vật tự bước lên.
   - Gờ cao hơn stepMax, thấp hơn lowMax là tường thấp (top = chiều cao thật). Lan can, thân rồng, tháp, tượng: cao vô hạn.
   - Không đi dưới gầm cầu: vùng bờ cắt quanh phần cầu cao hơn mặt đất, nối với cầu ở đầu cầu nơi mặt cầu hạ về mặt đường.

   Bảng nguồn số (file : dòng của hình học đã đọc; (ước lượng) = số chọn ở đây, không có trong hình học):
   | Số | Giá trị | Nguồn |
   | Mép kè hai bờ | |x| = 262 | config.ts:22 (bankX) |
   | Mặt đất / mặt đường bờ | 2,5 / 2,6 m | config.ts:20-21 (landY, roadY) |
   | Cầu Rồng: mặt cầu dài | |x| ≤ 333 | config.ts:14 (length), deck.ts:17; deckY(±333) = roadY (profile.ts:7) |
   | Cầu Rồng: lan can | tim |z| = 18,65, dày 0,14 → mặt trong 18,58 | deck.ts:23 (hw − 0,1) |
   | Cầu Rồng: gờ mép ngoài | tới |z| = 19,0 | deck.ts:26 (hw + 0,1, rộng 0,3) |
   | Cầu Rồng: gờ chắn xe | |z| 15,9–16,25, cao 0,9 | deck.ts:14-15,22 (sideIn = 3 + 13,25) |
   | Cầu Rồng: lề / dải phân cách / mặt đường | +0,25 / +0,3 (|z| ≤ 3) / +0,02 | deck.ts:21 / 19 / 35 |
   | Thân rồng: điểm điều khiển, bán kính | (x, deckY + yr) | body.ts:15-20,27-39; config.ts:15-17,23 |
   | Thân rồng: bề ngang | 1,03 r + 0,085 (đai sườn) | body.ts:49,57 |
   | Đường nối dài Cầu Rồng trên bờ | đường +0,03 |z| 3–16,25, dải giữa +0,3, vỉa hè +0,2 ở |z| 16,7–19,7, |x| ≥ 333 | streets.ts:15-22 |
   | Đường ven sông | tim |x| = 299, mặt đường +0,02 ở 1,5 < |x − 299| ≤ 10,5, dải giữa 3 m +0,3 | streets.ts:25-29 |
   | Cầu sông Hàn: tâm | z = −1080, x cục bộ = x thế giới | config.ts:152; SongHanBridge.ts:42 |
   | Cầu sông Hàn: mặt cầu + lan can | |x| ≤ 290, cao độ shRoadY | fixedSpans.ts:58; swingSpan.ts:38; profile.ts:10 |
   | Cầu sông Hàn: lan can | tim |dz| = 6,3, dày 0,12 → mặt trong 6,24 | common/deck.ts:16 (hw − 0,15) |
   | Cầu sông Hàn: gờ chắn bánh | |dz| 4,445–4,695, cao 0,545 | common/deck.ts:14 |
   | Cầu sông Hàn: lề / dải giữa / mặt đường | +0,25 / +0,3 (|dz| ≤ 1,1) / +0,03 | common/deck.ts:13; fixedSpans.ts:52, swingSpan.ts:24; fixedSpans.ts:48 |
   | Cầu sông Hàn: mố | rộng deckWidth + 1 → |dz| ≤ 6,95 | fixedSpans.ts:18 |
   | Cầu sông Hàn: đường nối trên bờ | đường +0,03 ở |dz| 1,1–4,45, dải giữa +0,3, |x| ≥ 290 | fixedSpans.ts:48-55 |
   | Nhịp quay | |x| ≤ fixedStart 62,35 | config.ts:193-194 |
   | Cột đôi ở tim tháp | x ±0,4, |dz| ≤ 1,0 | swingSpan.ts:45 (z ±0,55, tiết diện 0,9 × 0,8) |
   | Chân chữ A | từ (±15, +0,2) tới (0, +19), tiết diện 1,0 × 1,4 | swingSpan.ts:46; config.ts:176-177 |
   | Neo dây văng | x 20–59,2, đỉnh 25–36,5 trên cột | swingSpan.ts:58-62; config.ts:179-180 |
   | Hộp barie | (±68,35, ±4,6), 0,45 × 1,0 | signals.ts:10-17; config.ts:187 |
   | Cầu Tình Yêu | x 224–262, z −78, rộng 6, mặt 3,0 m | landmarks.ts:61-62 |
   | Cầu Tình Yêu: lan can / khóa tình yêu | tim ±2,9, dày 0,12 / ±2,8 dày 0,06 → mặt trong 2,77 | landmarks.ts:64-65 |
   | Bệ tượng cá chép | 3,4 × 3,4 tại x 225,8, cao 1,2 | landmarks.ts:66-71 |
   | Bến du thuyền bờ Tây | x −254 ± …, z 104, trong lòng sông | promenade.ts:70-76 (không có vùng nào ở |x| < 262 ngoài cầu) |
   ============================================================================================================ */
import { CONFIG } from '../../config';
import { deckY } from '../../bridges/dragon/profile';
import { SH, shRoadY } from '../../bridges/song-han/profile';
import { stMakeMap, stNearestValid, type StZone, type StSolid, type StMap } from './map';

export const ST_GATE_SWING = 'shSwing';

const R = CONFIG.stroll.radius, BK = CONFIG.bankX, LAND = CONFIG.landY, ROAD = CONFIG.roadY;
const BX = CONFIG.stroll.bounds;
const REACH = 2.5;                         // m — tầm người trên mặt đứng: kết cấu thấp hơn mức này thì chặn (spec §4)

/* ----- Cầu Rồng (deck.ts) ----- */
const DR_X = CONFIG.length / 2;                                     // 333 — hai đầu mặt cầu
const DR_HW = CONFIG.width / 2;                                     // 18,75
const DR_RAIL_IN = DR_HW - 0.1 - 0.07;                              // 18,58 — mặt trong tay vịn
const DR_EDGE = DR_HW + 0.25;                                       // 19,0 — mép ngoài gờ mép
const DR_MED = CONFIG.median / 2;                                   // 3
const DR_SIDE_IN = DR_MED + CONFIG.lanesPerDir * CONFIG.laneWidth + CONFIG.shoulder;   // 16,25 — mép trong lề
const DR_CURB = { z0: DR_SIDE_IN - 0.35, z1: DR_SIDE_IN, top: 0.9 };   // gờ chắn xe
const DR_SIDEWALK = 0.25, DR_MEDIAN = 0.3, DR_ROAD = 0.02;          // m trên deckY
const DR_ARCH_GAP = 8;                                              // m — gộp hai đoạn thân rồng cách nhau không quá số này: chân vòm là cả đoạn thân cắm xuống rồi trồi lên khỏi mặt cầu (đoạn thân nằm hẳn dưới mặt cầu dài nhất 6,75 m ở x = ±255; giữa hai chân vòm cách ≥ 40 m) (ước lượng)

/* ----- Đường trên bờ (streets.ts) ----- */
const AX_SIDE = { z0: 16.7, z1: 19.7 };                             // vỉa hè đường nối dài Cầu Rồng, cao +0,2
const RV_X = 299, RV_MED = 1.5, RV_HALF = 10.5;                     // đường ven sông Bạch Đằng / Trần Hưng Đạo

/* ----- Cầu sông Hàn (fixedSpans.ts, swingSpan.ts, common/deck.ts) ----- */
const SHZ = SH.z;
const SH_X = 290;                                                   // lan can / lề phần cố định tới |x| = 290 (fixedSpans.ts:58)
const SH_RAIL_IN = SH.hw - 0.15 - 0.06;                             // 6,24
const SH_EDGE = SH.hw;                                              // 6,45 — mép ngoài gờ mép
const SH_ABUT = SH.hw + 0.5;                                        // 6,95 — nửa bề rộng mố
const SH_CURB_C = SH.hw - SH.sidewalk + 0.12;                       // 4,57 — tim gờ chắn bánh
const SH_CURB = { z0: SH_CURB_C - 0.125, z1: SH_CURB_C + 0.125, top: 0.545 };
const SH_MED = SH.median / 2;                                       // 1,1
const SH_LANE_OUT = SH.lane + SH.laneWidth / 2;                     // 4,45 — mép ngoài làn xe
const SH_SIDEWALK = 0.25, SH_MEDIAN = 0.3, SH_ROAD = 0.03;
const SH_LAND_HALF = 7.5;                                           // m — nửa bề rộng vùng đầu cầu trên bờ, chồng 0,2 m lên vùng bờ (ước lượng)

/* ----- Cầu Tình Yêu (landmarks.ts) ----- */
const LV = CONFIG.riverfront.love, LV_X0 = BK - LV.length;          // 224
const LV_IN = LV.width / 2 - 0.2 - 0.03;                            // 2,77 — mặt trong hàng khóa tình yêu
const LV_RAIL = LV.width / 2 - 0.1 + 0.06;                          // 2,96 — mặt ngoài tay vịn
const LV_DECK = 2.55 + 0.45;                                        // 3,0 — mặt cầu tàu
const LV_END = 2.8;                                                 // m — cao độ đứng ở chỗ nối kè: dốc 0,2 m trong 2 m cuối để bậc xuống mặt kè 2,5 ≤ stepMax (ước lượng)
const LV_RAMP = 2;                                                  // m — chiều dài đoạn dốc đó (ước lượng)

/* ===== Cao độ đứng ===== */
function stDragonY(x: number, z: number): number {
  const az = Math.abs(z), base = deckY(x);
  if (az <= DR_MED) return base + DR_MEDIAN;
  if (az < (DR_CURB.z0 + DR_CURB.z1) / 2) return base + DR_ROAD;
  return base + DR_SIDEWALK;
}
function stSongHanY(x: number, z: number): number {
  const adz = Math.abs(z - SHZ), base = shRoadY(x);
  if (adz <= SH_MED) return base + SH_MEDIAN;
  if (adz < SH_CURB_C) return base + SH_ROAD;
  return base + SH_SIDEWALK;
}
/* Mặt bờ: mặt đất, cộng mặt đường / dải phân cách / vỉa hè nơi có (lấy mặt cao nhất, như khối nào nằm trên cùng) */
function stBankY(x: number, z: number): number {
  const ax = Math.abs(x), az = Math.abs(z), adz = Math.abs(z - SHZ), ar = Math.abs(ax - RV_X);
  let y = LAND;
  if (ax >= DR_X) {                                                 // Nguyễn Văn Linh / Võ Văn Kiệt
    if (az <= DR_MED) y = Math.max(y, ROAD + 0.3);
    else if (az <= DR_SIDE_IN) y = Math.max(y, ROAD + 0.03);
    else if (az >= AX_SIDE.z0 && az <= AX_SIDE.z1) y = Math.max(y, ROAD + 0.2);
  }
  if (ax >= SH_X) {                                                 // Lê Duẩn / Phạm Văn Đồng
    if (adz <= SH_MED) y = Math.max(y, ROAD + 0.3);
    else if (adz <= SH_LANE_OUT) y = Math.max(y, ROAD + 0.03);
  }
  if (ar <= RV_MED) y = Math.max(y, ROAD + 0.3);                    // Bạch Đằng / Trần Hưng Đạo
  else if (ar <= RV_HALF) y = Math.max(y, ROAD + 0.02);
  return y;
}
function stLoveY(x: number): number {
  const xr = BK + R - LV_RAMP;
  return x <= xr ? LV_DECK : LV_DECK + (LV_END - LV_DECK) * (x - xr) / LV_RAMP;
}

/* ===== Vùng đi được (thứ tự = ưu tiên khi chồng nhau) ===== */
export function stBuildZones(): StZone[] {
  const zs: StZone[] = [];
  const add = (id: string, x0: number, x1: number, z0: number, z1: number, y: StZone['y'], gate?: string) => {
    const zn: StZone = { id, x0, x1, z0, z1, y }; if (gate) zn.gate = gate; zs.push(zn);
  };
  const shH = SH_RAIL_IN - R;                                       // 5,89
  /* Cầu sông Hàn: nhịp quay có cổng, hai phần cố định tới |x| = 290 nơi mặt cầu về 2,6 m */
  add('shSwing', -SH.fixedStart, SH.fixedStart, SHZ - shH, SHZ + shH, stSongHanY, ST_GATE_SWING);
  add('songHanW', -SH_X, -SH.fixedStart, SHZ - shH, SHZ + shH, stSongHanY);
  add('songHanE', SH.fixedStart, SH_X, SHZ - shH, SHZ + shH, stSongHanY);
  /* Cầu Rồng: cả bề rộng giữa hai lan can */
  const drH = DR_RAIL_IN - R;                                       // 18,23
  add('dragon', -DR_X, DR_X, -drH, drH, stDragonY);
  /* Cầu Tình Yêu: lối vào duy nhất là cạnh x = 262,35 chung với vùng bờ Đông */
  add('love', LV_X0 + R, BK + R, LV.z - (LV_IN - R), LV.z + (LV_IN - R), stLoveY);
  /* đầu cầu trên bờ: đường nối dài, cùng cao độ với vùng bờ */
  for (const [id, s] of [['dragonW', -1], ['dragonE', 1]] as [string, number][]) {
    add(id, s < 0 ? BX.x0 : DR_X, s < 0 ? -DR_X : BX.x1, -AX_SIDE.z1, AX_SIDE.z1, stBankY);
  }
  for (const [id, s] of [['shLandW', -1], ['shLandE', 1]] as [string, number][]) {
    add(id, s < 0 ? BX.x0 : SH_X, s < 0 ? -SH_X : BX.x1, SHZ - SH_LAND_HALF, SHZ + SH_LAND_HALF, stBankY);
  }
  /* hai bờ: từ mép kè lùi radius ra tới hết khung; cắt quanh thân Cầu Rồng (|z| < 19,35) và thân Cầu sông Hàn (|dz| < 7,3) */
  const drCut = DR_EDGE + R, shCut = SH_ABUT + R;
  for (const [id, s] of [['bankW', -1], ['bankE', 1]] as [string, number][]) {
    const x0 = s < 0 ? BX.x0 : BK + R, x1 = s < 0 ? -(BK + R) : BX.x1;
    add(id, x0, x1, BX.z0, SHZ - shCut, stBankY);
    add(id, x0, x1, SHZ + shCut, -drCut, stBankY);
    add(id, x0, x1, drCut, BX.z1, stBankY);
  }
  return zs;
}

/* ===== Đường tim thân rồng: chép điểm điều khiển body.ts:27-38 và CatmullRomCurve3 centripetal của three (không import three) ===== */
export function stSpinePoints(): [number, number][] {
  const pts: [number, number][] = [];
  const add = (x: number, yr: number) => pts.push([x, deckY(x) + yr]);
  add(-366, 11); add(-361, 16); add(-354, 17.5); add(-347, 14); add(-340, 8.5); add(-331, 4.5); add(-316, 3.0); add(-298, 3.4); add(-276, 2.4);
  let x0 = -CONFIG.mainTotal / 2; add(x0, -3);
  for (const s of CONFIG.mainSpans) {
    const rise = CONFIG.spanRise[s];
    for (const t of [0.12, 0.28, 0.5, 0.72, 0.88]) add(x0 + s * t, -3 + (rise + 3) * Math.sin(Math.PI * t));
    x0 += s; add(x0, -3);
  }
  add(272, 2.4); add(289, 3.0); add(303, 4.6); add(314, 7.4); add(323, 10.4); add(330, 13);
  return pts;
}
/* Một trục của đa thức Catmull-Rom không đều (giống CubicPoly.initNonuniformCatmullRom của three) */
function stCr(a: number, b: number, c: number, d: number, dt0: number, dt1: number, dt2: number, t: number): number {
  const t1 = ((b - a) / dt0 - (c - a) / (dt0 + dt1) + (c - b) / dt1) * dt1;
  const t2 = ((c - b) / dt1 - (d - b) / (dt1 + dt2) + (d - c) / dt2) * dt1;
  const c2 = -3 * b + 3 * c - 2 * t1 - t2, c3 = 2 * b - 2 * c + t1 + t2;
  return b + t1 * t + c2 * t * t + c3 * t * t * t;
}
export function stSpinePoint(pts: [number, number][], t: number, out: { x: number; y: number }): void {
  const l = pts.length, p = (l - 1) * t;
  let i = Math.floor(p), w = p - i;
  if (w === 0 && i === l - 1) { i = l - 2; w = 1; }
  const p1 = pts[i], p2 = pts[i + 1];
  const p0: [number, number] = i > 0 ? pts[i - 1] : [2 * pts[0][0] - pts[1][0], 2 * pts[0][1] - pts[1][1]];
  const p3: [number, number] = i + 2 < l ? pts[i + 2] : [2 * pts[l - 1][0] - pts[l - 2][0], 2 * pts[l - 1][1] - pts[l - 2][1]];
  const d = (a: [number, number], b: [number, number]) => Math.pow((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2, 0.25);
  let dt0 = d(p0, p1), dt1 = d(p1, p2), dt2 = d(p2, p3);
  if (dt1 < 1e-4) dt1 = 1;
  if (dt0 < 1e-4) dt0 = dt1;
  if (dt2 < 1e-4) dt2 = dt1;
  out.x = stCr(p0[0], p1[0], p2[0], p3[0], dt0, dt1, dt2, w);
  out.y = stCr(p0[1], p1[1], p2[1], p3[1], dt0, dt1, dt2, w);
}

/* Bán kính thân theo phần độ dài cung u (body.ts:15-20) */
function stSpineRadius(u: number): number {
  const Rb = CONFIG.bodyRadius, sm = (t: number) => t * t * (3 - 2 * t);
  if (u < 0.06) return 0.25 + (Rb - 0.25) * sm(u / 0.06);
  if (u > 0.95) return Rb + (CONFIG.headRadius - Rb) * sm((u - 0.95) / 0.05);
  return Rb;
}

/* Thân / chân vòm / đầu / đuôi rồng trong tầm người: lấy mẫu đường tim, đánh dấu ô x (0,25 m) nơi ống thân (mặt cắt dọc z = 0)
   chạm dải [mặt cầu, mặt cầu + dải phân cách + REACH]; gộp ô liền nhau thành hình chữ nhật trên dải phân cách. */
function stDragonSolids(): StSolid[] {
  const pts = stSpinePoints(), N = 8000, p = { x: 0, y: 0 };
  const xs = new Float64Array(N + 1), ys = new Float64Array(N + 1), len = new Float64Array(N + 1);
  for (let i = 0; i <= N; i++) {
    stSpinePoint(pts, i / N, p); xs[i] = p.x; ys[i] = p.y;
    if (i > 0) len[i] = len[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
  }
  const X0 = -400, STEP = 0.25, M = Math.round(800 / STEP) + 1;
  const half = new Float64Array(M);                                 // 0 = ô trống, > 0 = nửa bề ngang thân tại ô
  for (let i = 0; i <= N; i++) {
    const r = stSpineRadius(len[i] / len[N]), rr = 1.03 * r + 0.085;
    const g0 = Math.max(0, Math.ceil((xs[i] - rr - X0) / STEP)), g1 = Math.min(M - 1, Math.floor((xs[i] + rr - X0) / STEP));
    for (let g = g0; g <= g1; g++) {
      const x = X0 + g * STEP, lo = deckY(x), hi = lo + DR_MEDIAN + REACH;
      const yb = ys[i] < lo ? lo : ys[i] > hi ? hi : ys[i];
      const dx = xs[i] - x, dy = ys[i] - yb;
      if (dx * dx + dy * dy < rr * rr && rr > half[g]) half[g] = rr;
    }
  }
  const out: StSolid[] = [];
  let cur: StSolid = null, last = -Infinity;
  for (let g = 0; g < M; g++) {
    if (half[g] === 0) continue;
    const x = X0 + g * STEP;
    if (cur && x - last <= DR_ARCH_GAP) { cur.x1 = x + STEP; cur.z1 = Math.max(cur.z1, half[g]); cur.z0 = -cur.z1; }
    else { cur = { kind: 'rect', x0: x - STEP, x1: x + STEP, z0: -half[g], z1: half[g] }; out.push(cur); }
    last = x;
  }
  return out;
}

/* Tháp chữ A, cột đôi, neo dây văng, hộp barie Cầu sông Hàn (tọa độ cục bộ + z cầu) */
function stSongHanSolids(): StSolid[] {
  const out: StSolid[] = [];
  const rect = (x0: number, x1: number, dz0: number, dz1: number, top?: number) => {
    const s: StSolid = { kind: 'rect', x0, x1, z0: SHZ + dz0, z1: SHZ + dz1 }; if (top !== undefined) s.top = top; out.push(s);
  };
  const H = SH_MEDIAN + REACH;                                      // tầm chặn tính từ mặt cầu, m
  rect(-0.4, 0.4, -1.0, 1.0);                                       // cột đôi ở tim (swingSpan.ts:45)
  const legIn = SH.aFoot - SH.aFoot * (H - 0.2) / (SH.aApex - 0.2); // ≈ 12,9 m — chân chữ A lên tới tầm H
  for (const s of [-1, 1]) {
    const a = legIn - 0.9, b = SH.aFoot + 0.9;                      // + nửa tiết diện 1,4 m chiếu ngang, làm tròn lên 0,9 (ước lượng)
    rect(s < 0 ? -b : a, s < 0 ? -a : b, -0.5, 0.5);                // chân chữ A, rộng 1,0 theo z
    for (let i = 0; i < SH.stays; i++) {                            // neo dây văng: dây thấp hơn tầm H trong đoạn gần neo
      const k = i / (SH.stays - 1), xd = SH.stayDeck[1] + (SH.stayDeck[0] - SH.stayDeck[1]) * k, top = SH.stayTop[1] + (SH.stayTop[0] - SH.stayTop[1]) * k;
      const xin = xd - (H - 0.35) * (xd - 0.5) / (top - 0.35);
      const a2 = xin - 0.1, b2 = xd + 0.3;                          // + bán kính dây, đầu neo (ước lượng)
      rect(s < 0 ? -b2 : a2, s < 0 ? -a2 : b2, -0.15, 0.15);        // dây 0,07 m + neo (ước lượng)
    }
    for (const sz of [-1, 1]) {                                     // hộp barie 0,45 × 1,0 trên gờ chắn bánh
      const bz = sz * (SH.hw - SH.sidewalk + 0.15);
      rect(s * SH.barrierX - 0.225, s * SH.barrierX + 0.225, bz - 0.225, bz + 0.225);
    }
    rect(-SH_X, SH_X, s < 0 ? -SH_CURB.z1 : SH_CURB.z0, s < 0 ? -SH_CURB.z0 : SH_CURB.z1, SH_CURB.top);   // gờ chắn bánh, liền qua khe nhịp quay
    for (const [x0, x1] of [[-SH_X, -SH.fixedStart], [SH.fixedStart, SH_X]]) {
      rect(x0, x1, s < 0 ? -SH_EDGE : SH_RAIL_IN, s < 0 ? -SH_RAIL_IN : SH_EDGE);   // lan can phần cố định (chặn hai đầu ở |x| = 290)
    }
  }
  return out;
}

export function stBuildStructures(): StSolid[] {
  const out: StSolid[] = stDragonSolids();
  for (const s of [-1, 1]) {
    out.push({ kind: 'rect', x0: -DR_X, x1: DR_X, z0: s < 0 ? -DR_EDGE : DR_RAIL_IN, z1: s < 0 ? -DR_RAIL_IN : DR_EDGE });                 // lan can Cầu Rồng
    out.push({ kind: 'rect', x0: -DR_X, x1: DR_X, z0: s < 0 ? -DR_CURB.z1 : DR_CURB.z0, z1: s < 0 ? -DR_CURB.z0 : DR_CURB.z1, top: DR_CURB.top });   // gờ chắn xe
    out.push({ kind: 'rect', x0: LV_X0, x1: BK, z0: s < 0 ? LV.z - LV_RAIL : LV.z + LV_IN, z1: s < 0 ? LV.z - LV_IN : LV.z + LV_RAIL });      // lan can + khóa Cầu Tình Yêu
  }
  out.push(...stSongHanSolids());
  out.push({ kind: 'rect', x0: LV_X0 + 1.8 - 1.7, x1: LV_X0 + 1.8 + 1.7, z0: LV.z - 1.7, z1: LV.z + 1.7 });   // bệ + tượng cá chép hóa rồng (bệ cao 1,2 > lowMax)
  return out;
}

export function stBuildStaticMap(): StMap {
  return stMakeMap(stBuildZones(), stBuildStructures(), CONFIG.stroll.radius);
}

/* Điểm xuất phát slot: lệch theo x quanh spawn; slot < 0 (đi một mình) dùng giữa. Gọi một lần lúc vào chế độ, không mỗi khung */
export function stSpawn(map: StMap, slot: number, out: { x: number; z: number }): void {
  const S = CONFIG.stroll.spawn, k = slot < 0 ? 2 : slot;
  const x = S.x + S.spread * (k - 2), z = S.z;
  if (!stNearestValid(map, x, z, out)) { out.x = x; out.z = z; }
}
