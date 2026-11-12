/* ============================ Lái xe: dữ liệu mạng đường ============================
   Sinh danh sách ô mặt đường DrPad[] (spec §4) từ CONFIG.drive.roads và biên dạng cao độ của bốn cầu + hầm. Không import three.
   - Mỗi chiều xe của mỗi tuyến là một dãy ô (hậu tố .N / .S cho tuyến dọc X, .W / .E cho tuyến dọc Z); dải giữa không thuộc ô nào nên tự chặn.
   - Mỗi nút giao là một ô 'junction' phủ cả hai chiều và dải giữa (chỗ mở dải giữa để rẽ trái, quay đầu); cuối mỗi đường cụt có một ô
     'junction' để quay đầu. Ô 'road' / 'slip' / 'junction' chưa có mặt đường thì Task 2 (environment/driveRoads.ts) dựng từ chính các ô này.
   - Gầm Cầu Rồng đóng (người dùng chọn 2026-11-12): đường ven sông không có ô giữa hai nhánh rẽ; xe đổi phía qua ô nút giao trên trục z = 0 ngay ngoài |x| = 333.
   - Đường ven sông chui dưới Trần Thị Lý, Thuận Phước và chạy trên hầm: ô chồng mặt bằng nhưng khác tầng.

   Bảng nguồn số (file : hình học đã đọc):
   | Tuyến | Mặt cắt mỗi chiều (|z − tim| hoặc |x − tim|) | Dọc tuyến | Nguồn |
   | Trục Cầu Rồng z = 0 | 3..16,25 (dải giữa 6, 3 làn × 3,75 + lề 2); trên cầu tới gờ chắn xe 15,9 | x −1900..1480, cầu |x| ≤ 333 (deckY) | streets.ts:15-22; dragon/deck.ts:13-22 |
   | Trục Cầu sông Hàn z = −1080 | 1,1..4,45 (1 làn 3,35) | x −1900..1480, cầu |x| ≤ 290 (shRoadY), nhịp quay |x| ≤ 62,35 | song-han/fixedSpans.ts:46-52; config.ts deriveSh |
   | Trục Trần Thị Lý z = 1300 | 2,75..14,0 (3 làn × 3,75) | x −1900..1480, cầu x −470..450 (ttlRoadY) | tran-thi-ly/deck.ts:12-20 |
   | Trục hầm z = −1700 | 2,1..14,6 (tim ống 8,35, bề rộng 12,5) | x −1900..1480, ống |x| ≤ 697,5 (hrRoadY) | han-tunnel/outdoor.ts:93-96; bore.ts:38-40 |
   | Trục Thuận Phước z = −2900 | 0,5..7,5 (dải giữa 1, 2 làn × 3,5) | x −1500..1480, cầu |x| ≤ 1047,5 (tpRoadY) | thuan-phuoc/deck.ts:27-36; profile.ts |
   | Đường ven sông |x| = 299 | 1,5..10,5 (hai dải 9 m, dải giữa 3 m) | Tây z −3210..2600, Đông −3660..2600 | streets.ts:25-29; thuan-phuoc/site.ts:31-38 |
   Cao độ ô đường bằng phẳng lấy CONFIG.roadY (mặt vẽ ở streets.ts cao hơn 0,02 m, ở site.ts thấp hơn 0,08 m; trong stepMax). */
import { CONFIG } from '../../config';
import { deckY } from '../../bridges/dragon/profile';
import { SH, shRoadY } from '../../bridges/song-han/profile';
import { TTL, ttlRoadY } from '../../bridges/tran-thi-ly/profile';
import { TP, tpRoadY } from '../../bridges/thuan-phuoc/profile';
import { HR, hrRoadY } from '../../bridges/han-tunnel/profile';
import type { DrPad } from './net';

export const DR_GATE_SWING = 'shSwing';

type DrY = DrPad['y'];
const R = CONFIG.drive.roads, ROAD = CONFIG.roadY;
const flat: DrY = () => ROAD;
const LIN = R.median / 2, LOUT = LIN + R.half;                      // 1,5 / 10,5 — mặt cắt đường mới và đường ven sông
const AX0 = R.axisX0, AX1 = R.axisX1;

/* ----- Cầu Rồng (streets.ts, dragon/deck.ts) ----- */
const DR_X = CONFIG.length / 2;                                     // 333 — đầu mặt cầu, deckY(±333) = roadY
const DR_IN = CONFIG.median / 2;                                    // 3
const DR_OUT = DR_IN + CONFIG.lanesPerDir * CONFIG.laneWidth + CONFIG.shoulder;   // 16,25 — mép ngoài lề xe, trên bờ
const DR_CURB = DR_OUT - 0.35;                                      // 15,9 — mặt trong gờ chắn xe trên cầu (dragon/deck.ts:21)
/* ----- Cầu sông Hàn (fixedSpans.ts) ----- */
const SH_IN = SH.median / 2;                                        // 1,1
const SH_OUT = SH.lane + SH.laneWidth / 2;                          // 4,45
const SH_X = SH.roadProfile[SH.roadProfile.length - 2][0];          // 290 — mặt cầu về roadY (lan can phần cố định tới đây)
/* ----- Trần Thị Lý (tran-thi-ly/deck.ts) ----- */
const TTL_IN = TTL.median / 2;                                      // 2,75
const TTL_OUT = TTL_IN + TTL.lanesPerDir * TTL.laneWidth;           // 14,0
const TTL_W = TTL.roadProfile[1][0], TTL_E = TTL.roadProfile[TTL.roadProfile.length - 2][0];   // −470 / 450 — chân dốc hai đầu (deck.ts xr0 / xr1)
/* ----- Hầm (han-tunnel/outdoor.ts, bore.ts) ----- */
const HR_W = HR.shoulder * 2 + HR.laneWidth * HR.lanesPerDir;       // 12,5 — bề rộng mặt đường mỗi ống
const HR_IN = HR.tubeCenter - HR_W / 2, HR_OUT = HR.tubeCenter + HR_W / 2;   // 2,1 / 14,6
/* ----- Thuận Phước (thuan-phuoc/deck.ts) ----- */
const TP_IN = TP.median / 2;                                        // 0,5
const TP_OUT = TP_IN + 2 * TP.laneWidth;                            // 7,5
const TP_END = TP.endX + TP.embankment;                             // 1047,5 — đường đắp về mặt đất

/* ===== Mô tả tuyến ===== */
interface DrRect { id: string; x0: number; x1: number; z0: number; z1: number }
interface DrSpan { id: string; kind: DrPad['kind']; a: number; b: number; y: DrY; out?: number; gate?: string }
interface DrLine {
  id: string; along: 'x' | 'z'; c: number; lin: number; lout: number;   // tim tuyến (z nếu dọc X, x nếu dọc Z), mép trong / ngoài mỗi chiều tính từ tim
  a: number; b: number; y: DrY;                                     // đoạn dọc tuyến, cao độ phần đường thường
  spans?: DrSpan[];                                                 // đoạn cầu / hầm: ô riêng mỗi chiều, kind và cao độ riêng
  holes?: [number, number][];                                       // đoạn không có ô (gầm Cầu Rồng)
}

const AXES: DrLine[] = [
  { id: 'dragon', along: 'x', c: 0, lin: DR_IN, lout: DR_OUT, a: AX0, b: AX1, y: flat,
    spans: [{ id: 'dragon.bridge', kind: 'bridge', a: -DR_X, b: DR_X, y: (x) => deckY(x), out: DR_CURB }] },
  { id: 'songHan', along: 'x', c: SH.z, lin: SH_IN, lout: SH_OUT, a: AX0, b: AX1, y: (x) => shRoadY(x),
    spans: [
      { id: 'songHan.bridgeW', kind: 'bridge', a: -SH_X, b: -SH.fixedStart, y: (x) => shRoadY(x) },
      { id: 'songHan.swing', kind: 'bridge', a: -SH.fixedStart, b: SH.fixedStart, y: (x) => shRoadY(x), gate: DR_GATE_SWING },
      { id: 'songHan.bridgeE', kind: 'bridge', a: SH.fixedStart, b: SH_X, y: (x) => shRoadY(x) }
    ] },
  { id: 'ttl', along: 'x', c: TTL.z, lin: TTL_IN, lout: TTL_OUT, a: AX0, b: AX1, y: (x) => ttlRoadY(x),
    spans: [{ id: 'ttl.bridge', kind: 'bridge', a: TTL_W, b: TTL_E, y: (x) => ttlRoadY(x) }] },
  { id: 'tunnel', along: 'x', c: HR.z, lin: HR_IN, lout: HR_OUT, a: AX0, b: AX1, y: (x) => hrRoadY(x),
    spans: [{ id: 'tunnel.tube', kind: 'tunnel', a: -HR.rampHalf, b: HR.rampHalf, y: (x) => hrRoadY(x) }] },   // .N / .S = ống Bắc / ống Nam
  { id: 'thuanPhuoc', along: 'x', c: TP.z, lin: TP_IN, lout: TP_OUT, a: R.tpX0, b: AX1, y: (x) => tpRoadY(x),
    spans: [{ id: 'thuanPhuoc.bridge', kind: 'bridge', a: -TP_END, b: TP_END, y: (x) => tpRoadY(x) }] }
];
const SD = R.slipDragon, ST = R.slipTtl;
const RIVERS: DrLine[] = [
  { id: 'bachDang', along: 'z', c: -R.riverX, lin: LIN, lout: LOUT, a: R.northW, b: R.southZ, y: flat, holes: [[-SD.zIn, SD.zIn]] },
  { id: 'tranHungDao', along: 'z', c: R.riverX, lin: LIN, lout: LOUT, a: R.northE, b: R.southZ, y: flat, holes: [[-SD.zIn, SD.zIn]] }
];
const VERTS: DrLine[] = [
  { id: 'west', along: 'z', c: R.westX, lin: LIN, lout: LOUT, a: TP.z - TP_OUT, b: TTL.z + TTL_OUT, y: flat },
  { id: 'east', along: 'z', c: R.eastX, lin: LIN, lout: LOUT, a: TP.z - TP_OUT, b: TTL.z + TTL_OUT, y: flat }
];
const LINKS: DrLine[] = [
  { id: 'linkW', along: 'x', c: R.linkWestZ, lin: LIN, lout: LOUT, a: R.westX, b: -R.riverX, y: flat },
  { id: 'linkE', along: 'x', c: R.linkEastZ, lin: LIN, lout: LOUT, a: R.riverX, b: R.eastX, y: flat }
];

/* ===== Nút giao ===== */
function drJunctions(): DrRect[] {
  const out: DrRect[] = [];
  const add = (id: string, x0: number, x1: number, z0: number, z1: number) => out.push({ id, x0, x1, z0, z1 });
  for (const A of AXES) {                                           // quay đầu ở hai đầu trục ngang
    add(`jct.${A.id}.endW`, A.a, A.a + R.endLen, A.c - A.lout, A.c + A.lout);
    add(`jct.${A.id}.endE`, A.b - R.endLen, A.b, A.c - A.lout, A.c + A.lout);
  }
  for (const V of VERTS) {                                          // đường dọc mới cắt năm trục ngang và đường nối
    for (const A of AXES) add(`jct.${V.id}.${A.id}`, V.c - LOUT, V.c + LOUT, A.c - A.lout, A.c + A.lout);
    const L = V.id === 'west' ? R.linkWestZ : R.linkEastZ;
    add(`jct.${V.id}.link`, V.c - LOUT, V.c + LOUT, L - LOUT, L + LOUT);
  }
  for (const V of RIVERS) {
    const x0 = V.c - LOUT, x1 = V.c + LOUT, L = V.c < 0 ? R.linkWestZ : R.linkEastZ;
    add(`jct.${V.id}.endN`, x0, x1, V.a, V.a + R.endLen);
    add(`jct.${V.id}.link`, x0, x1, L - LOUT, L + LOUT);
    add(`jct.${V.id}.songHan`, x0, x1, SH.z - SH_OUT, SH.z + SH_OUT);   // giao cùng cao độ duy nhất có sẵn
    add(`jct.${V.id}.dragon.N`, x0, x1, -SD.zOut, -SD.zIn);
    add(`jct.${V.id}.dragon.S`, x0, x1, SD.zIn, SD.zOut);
    add(`jct.${V.id}.ttl.N`, x0, x1, TTL.z - ST.zOut, TTL.z - ST.zIn);
    add(`jct.${V.id}.ttl.S`, x0, x1, TTL.z + ST.zIn, TTL.z + ST.zOut);
  }
  add('jct.dragon.W', -DR_X - SD.jLen, -DR_X, -SD.zOut, SD.zOut);  // chỗ nhánh rẽ nhập trục, ngay ngoài chân Cầu Rồng (cũng là chỗ đổi phía qua gầm)
  add('jct.dragon.E', DR_X, DR_X + SD.jLen, -SD.zOut, SD.zOut);
  add('jct.ttl.W', TTL_W - ST.jLen, TTL_W, TTL.z - ST.zOut, TTL.z + ST.zOut);
  add('jct.ttl.E', TTL_E, TTL_E + ST.jLen, TTL.z - ST.zOut, TTL.z + ST.zOut);
  return out;
}

/* ===== Rải ô dọc một tuyến: cắt bởi nút giao chồng lên dải đường và lỗ; đoạn cầu / hầm thành ô riêng; phần còn lại là ô đường ===== */
function drFillLine(L: DrLine, jcts: DrRect[], out: DrPad[]): void {
  const X = L.along === 'x';
  const sides: [string, number][] = X ? [['N', -1], ['S', 1]] : [['W', -1], ['E', 1]];
  const emit = (id: string, kind: DrPad['kind'], a: number, b: number, y: DrY, lout: number, gate?: string) => {
    for (const [sfx, s] of sides) {
      const c0 = L.c + s * L.lin, c1 = L.c + s * lout, lo = Math.min(c0, c1), hi = Math.max(c0, c1);
      const p: DrPad = X ? { id: `${id}.${sfx}`, kind, x0: a, x1: b, z0: lo, z1: hi, y } : { id: `${id}.${sfx}`, kind, x0: lo, x1: hi, z0: a, z1: b, y };
      if (gate) p.gate = gate;
      out.push(p);
    }
  };
  type Cut = { a: number; b: number; span?: DrSpan };
  const cuts: Cut[] = [];
  const bc0 = L.c - L.lout, bc1 = L.c + L.lout;                     // dải đường theo mặt cắt ngang
  for (const j of jcts) {
    const [ja, jb, jc0, jc1] = X ? [j.x0, j.x1, j.z0, j.z1] : [j.z0, j.z1, j.x0, j.x1];
    if (Math.min(jb, L.b) - Math.max(ja, L.a) > 1e-6 && Math.min(jc1, bc1) - Math.max(jc0, bc0) > 1e-6) cuts.push({ a: ja, b: jb });
  }
  for (const [a, b] of L.holes || []) cuts.push({ a, b });
  for (const s of L.spans || []) cuts.push({ a: s.a, b: s.b, span: s });
  cuts.sort((p, q) => p.a - q.a);
  let cur = L.a, k = 0;
  for (const c of cuts) {
    if (c.a > cur + 1e-6) emit(`${L.id}.${k++}`, 'road', cur, Math.min(c.a, L.b), L.y, L.lout);
    if (c.span) {                                                   // đoạn cầu bị nút giao đè đầu / cuối thì cắt bớt (Cầu sông Hàn |x| 288,5..290)
      const a = Math.max(cur, c.a); let b = c.b;
      for (const d of cuts) if (d !== c && d.a >= a && d.a < b) b = d.a;
      if (b > a + 1e-6) emit(c.span.id, c.span.kind, a, b, c.span.y, c.span.out ?? L.lout, c.span.gate);
    }
    cur = Math.max(cur, c.b);
  }
  if (L.b > cur + 1e-6) emit(`${L.id}.${k++}`, 'road', cur, L.b, L.y, L.lout);
}

/* ===== Danh sách ô ===== */
export function drBuildPads(): DrPad[] {
  const out: DrPad[] = [], jcts = drJunctions();
  for (const j of jcts) out.push({ id: j.id, kind: 'junction', x0: j.x0, x1: j.x1, z0: j.z0, z1: j.z1, y: flat });
  for (const L of [...AXES, ...RIVERS, ...VERTS, ...LINKS]) drFillLine(L, jcts, out);
  /* nhánh rẽ hai chiều: từ ô nút giao trên trục tới mép ngoài đường ven sông, đi hai bên dốc cầu */
  const slip = (id: string, x0: number, x1: number, z0: number, z1: number) => out.push({ id, kind: 'slip', x0, x1, z0, z1, y: flat });
  const rOut = R.riverX + LOUT;                                     // 309,5 — mép ngoài đường ven sông phía đất liền
  for (const [sx, s] of [['W', -1], ['E', 1]] as [string, number][]) {
    const [dx0, dx1] = s < 0 ? [-DR_X, -rOut] : [rOut, DR_X];
    slip(`slip.dragon.${sx}.N`, dx0, dx1, -SD.zOut, -SD.zIn);
    slip(`slip.dragon.${sx}.S`, dx0, dx1, SD.zIn, SD.zOut);
    const [tx0, tx1] = s < 0 ? [TTL_W, -rOut] : [rOut, TTL_E];
    slip(`slip.ttl.${sx}.N`, tx0, tx1, TTL.z - ST.zOut, TTL.z - ST.zIn);
    slip(`slip.ttl.${sx}.S`, tx0, tx1, TTL.z + ST.zIn, TTL.z + ST.zOut);
  }
  return out;
}

/* Chỗ xuất phát slot: trên Cầu Rồng, làn giữa chiều đi Đông (z > 0, yaw = 0), lệch theo x gap × (slot − 2); slot < 0 (lái một mình) dùng giữa */
export function drSpawnPose(slot: number): { x: number; z: number; yaw: number } {
  const S = CONFIG.drive.spawn, k = slot < 0 ? 2 : slot;
  return { x: S.x + S.gap * (k - 2), z: S.lane, yaw: 0 };
}
