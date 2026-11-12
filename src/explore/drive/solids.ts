/* ============================ Lái xe: vật cản cứng tĩnh ============================
   Dữ liệu vật cản cho va chạm thân xe (collide.ts) và camera (drSegClear): suy từ CONFIG và biên dạng cầu / hầm, không cần cảnh.
   Mỗi vật cản có khoảng cao độ tuyệt đối [y0, y1]: xe chỉ bị chặn khi khoảng đó giao thân xe, nên lan can trên mặt cầu không chặn
   đường ven sông bên dưới và tường ống hầm không chặn đường phố bên trên. Nhà và chân đế địa danh thêm lúc chạy (sceneSolids.ts).
   Luật (spec §6, plan Task 3):
   - Mép ô đã là bó vỉa / dải giữa (xe không ra ngoài ô được) nên không dựng vật cản cho vỉa hay dải giữa đường; chỉ dựng thứ cao hơn
     mặt đường ≥ 0,35 m nằm trong hoặc sát ô, và thứ camera sau xe có thể vướng (thân rồng, tháp, tường hầm).
   - Gờ chắn bánh, lề bộ hành và lan can mỗi bên cầu gộp thành một vật cản "lề cầu" (mặt trong gờ chắn → mặt ngoài lan can, cao tới
     đỉnh tay vịn): với thân xe tương đương gờ chắn (đỉnh 0,545 m đã chặn), với camera là xấp xỉ an toàn.
   - Vật cản dọc mặt dốc chia đoạn (drAlongX) để cao độ trong mỗi đoạn lệch ≤ CONFIG.drive.solids.yTol.
   - Kết cấu trên nhịp quay Cầu sông Hàn đứng yên ở vị trí đóng: khi cầu quay, cổng DR_GATE_SWING đã bỏ ô nhịp quay nên xe không tới đó.

   Bảng nguồn số (file : hình học đã đọc; (ước lượng) = chọn ở đây):
   | Vật | Hình học | Nguồn |
   | Cầu Rồng: gờ chắn xe → lan can | |z| 15,9..18,72, cao 1,22 trên deckY, |x| ≤ 333 | dragon/deck.ts:13-28 (gờ 0,35 × 0,9; tay vịn hw − 0,1 dày 0,14; LED tới 1,215) |
   | Thân rồng | đường tim stSpinePoints, bán kính 1,03 r + 0,085 | dragon/body.ts:15-20,27-39,49; stroll/mapData.ts |
   | Dây treo dưới bụng rồng | chân dây |z| = 2,8, bán kính 0,11, khi bụng cách dải giữa ≥ 2,5 m, |x| < 255 | dragon/body.ts:140-151 |
   | Trụ nhịp dẫn Cầu Rồng | x = −294, z = ±8,5, bán trục 2,0 × 2,8, tới đáy bản mặt cầu deckY − 0,5 | dragon/deck.ts:47-56; config.ts approachPiers |
   | Lề cầu chung (common/deck.ts) | gờ chắn tâm hw − lề + 0,12 rộng 0,25 cao 0,545; tay vịn hw − 0,15 dày 0,12 đỉnh 1,245 | common/deck.ts:9-18 |
   | Cầu sông Hàn | lề cầu |x| ≤ 288,5 (cố định + nhịp quay; vẽ tới 290, cắt ở mép làn đường ven sông); cột đôi x ±0,45 |dz| ≤ 1,0 cao 38; chân chữ A (±15, +0,2) → (0, +19) tiết diện 1,0 × 1,4; dây văng neo dầm (x 20..59,2, +0,35) → cột (±0,5, +25..36,5); hộp barie 0,45 × 0,45 cao 1,0 tại (±68,35, ±4,6) | fixedSpans.ts:64; swingSpan.ts:38-55; signals.ts:10-17 |
   | Trần Thị Lý | lề cầu x −470..450; tháp nghiêng ttlPylonPoint lấy mẫu quanh mặt cầu, |dz| ≤ Wz / 2 = 2,5; trụ trên bờ x ±1,3 |dz| ≤ 9,5 tới đáy dầm | tran-thi-ly/deck.ts:16,32; pylon.ts; approaches.ts:12-15 |
   | Thuận Phước | lề cầu |x| ≤ 1 047,5; tháp (mặt trong ≥ 11,4) và buồng neo (≥ 9,5) cách mép làn 7,5 hơn 1 m: không dựng | thuan-phuoc/deck.ts:39; towers.ts; approaches.ts:20-21 |
   | Hầm, đoạn kín |x| ≤ 490 | tường ngoài |dz| 14,6..15,6 và khối giữa |dz| ≤ 2,1 (tường + hành lang) từ mặt đường tới nóc + 7,0 | han-tunnel/shell.ts:22-30; config.ts hanTunnel |
   | Hầm, đoạn hở 490..697,5 | tường ngoài tới wallTop = max(đường + 1,1, mặt đất + 0,6); dải giữa |dz| ≤ 2,1 cao 0,9 | han-tunnel/outdoor.ts:19,38-40 |
   ============================================================================================================ */
import { CONFIG } from '../../config';
import { deckY } from '../../bridges/dragon/profile';
import { SH, shRoadY } from '../../bridges/song-han/profile';
import { TTL, ttlRoadY, ttlPylonSection, ttlPylonPoint } from '../../bridges/tran-thi-ly/profile';
import { TP, tpRoadY } from '../../bridges/thuan-phuoc/profile';
import { HR, hrRoadY } from '../../bridges/han-tunnel/profile';
import { stSpinePoints, stSpinePoint } from '../stroll/mapData';
import type { DrSolid } from './net';

/* Hai barie Cầu sông Hàn (Tây / Đông nhịp quay): tên dùng cho hiển thị và sơ tán (Task 8). Hộp barie là vật cản tĩnh; tay barie không:
   khi cầu quay, ô nhịp quay đã bị cổng DR_GATE_SWING bỏ khỏi mạng đường */
export const DR_BARRIER_W = 'shBarrierW', DR_BARRIER_E = 'shBarrierE';
export const DR_BARRIER_X: Record<string, number> = { [DR_BARRIER_W]: -SH.barrierX, [DR_BARRIER_E]: SH.barrierX };

type DrF = (x: number) => number;
const TOL = CONFIG.drive.solids.yTol, LAND = CONFIG.landY;

/* Vật cản chữ nhật dọc trục X trên mặt dốc: chia đoạn (bước ≤ 1 m) sao cho lo(x) và hi(x) trong mỗi đoạn lệch ≤ TOL; y0 = min lo, y1 = max hi */
function drAlongX(out: DrSolid[], x0: number, x1: number, z0: number, z1: number, lo: DrF, hi: DrF): void {
  const n = Math.max(1, Math.ceil(x1 - x0)), dx = (x1 - x0) / n;
  let a = x0, l0 = lo(x0), l1 = l0, h0 = hi(x0), h1 = h0;
  for (let i = 1; i <= n; i++) {
    const x = x0 + dx * i, l = lo(x), h = hi(x);
    if (Math.max(l1, l) - Math.min(l0, l) > TOL || Math.max(h1, h) - Math.min(h0, h) > TOL) {
      const xp = x - dx;                                            // đóng đoạn tại điểm trước, đoạn mới bắt đầu từ đó
      if (xp > a + 1e-9) {
        out.push({ kind: 'rect', x0: a, x1: xp, z0, z1, y0: l0, y1: h1 });
        a = xp; l0 = l1 = lo(xp); h0 = h1 = hi(xp);
      }
    }
    l0 = Math.min(l0, l); l1 = Math.max(l1, l); h0 = Math.min(h0, h); h1 = Math.max(h1, h);
  }
  out.push({ kind: 'rect', x0: a, x1: x1, z0, z1, y0: l0, y1: h1 });
}
/* Lề cầu hai bên (gờ chắn bánh + lề + lan can) của cầu dựng bằng common/deck.ts addDeckEdges */
function drDeckEdges(out: DrSolid[], zc: number, inner: number, outer: number, top: number, x0: number, x1: number, prof: DrF): void {
  for (const s of [-1, 1]) drAlongX(out, x0, x1, s < 0 ? zc - outer : zc + inner, s < 0 ? zc - inner : zc + outer, prof, (x) => prof(x) + top);
}
const CD_TOP = 1.245;                                               // m — đỉnh tay vịn common/deck.ts (1,2 + 0,09 / 2)
const cdInner = (hw: number, sidewalk: number) => hw - sidewalk + 0.12 - 0.125;   // mặt trong gờ chắn bánh
const cdOuter = (hw: number) => hw - 0.15 + 0.06;                   // mặt ngoài tay vịn

/* ===== Cầu Rồng ===== */
const DR_X = CONFIG.length / 2;                                     // 333
const DR_IN = CONFIG.median / 2 + CONFIG.lanesPerDir * CONFIG.laneWidth + CONFIG.shoulder - 0.35;   // 15,9 — mặt trong gờ chắn xe
const DR_OUT = CONFIG.width / 2 - 0.1 + 0.07;                       // 18,72 — mặt ngoài tay vịn
const DR_TOP = 1.22;                                                // m — đỉnh dải LED trên tay vịn (1,19 + 0,025, làm tròn lên)
const DR_HANG = 2.8 + 0.11;                                         // m — |z| chân dây treo + bán kính
const DR_CELL = 1;                                                  // m — ô lấy mẫu thân rồng dọc x
const DR_TOP_MERGE = 4;                                             // m — gộp ô liền nhau khi đỉnh lệch không quá số này (đỉnh chỉ cần cho camera) (ước lượng)

/* Bán kính thân theo phần độ dài cung u (body.ts:15-20; bản thuần như stroll/mapData.ts) */
function drSpineRadius(u: number): number {
  const Rb = CONFIG.bodyRadius, sm = (t: number) => t * t * (3 - 2 * t);
  if (u < 0.06) return 0.25 + (Rb - 0.25) * sm(u / 0.06);
  if (u > 0.95) return Rb + (CONFIG.headRadius - Rb) * sm((u - 0.95) / 0.05);
  return Rb;
}
/* Thân / đầu / đuôi / chân vòm rồng và màn dây treo: mỗi ô x 1 m là một khối từ chân (mặt cầu hoặc bụng rồng) tới lưng rồng.
   - Ô có thân nằm hẳn dưới mặt cầu (rồng lặn xuống trụ) bỏ.
   - Nhịp chính (|x| < mainTotal / 2), bụng cao hơn dải giữa: dây treo nối bụng với mặt cầu ⇒ khối từ mặt cầu, |z| ≥ chân dây treo.
   - Thân cắt mặt cầu (chân vòm): khối từ mặt cầu. Còn lại (đuôi, cổ, đầu trên cao): khối từ bụng, nên xe đi được bên dưới đầu rồng. */
function drDragonSolids(out: DrSolid[]): void {
  const pts = stSpinePoints(), N = 8000, p = { x: 0, y: 0 };
  const xs = new Float64Array(N + 1), ys = new Float64Array(N + 1), len = new Float64Array(N + 1);
  for (let i = 0; i <= N; i++) {
    stSpinePoint(pts, i / N, p); xs[i] = p.x; ys[i] = p.y;
    if (i > 0) len[i] = len[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
  }
  const X0 = -400, M = Math.round(800 / DR_CELL);
  const lo = new Float64Array(M).fill(Infinity), hi = new Float64Array(M).fill(-Infinity), half = new Float64Array(M);
  for (let i = 0; i <= N; i++) {
    const rr = 1.03 * drSpineRadius(len[i] / len[N]) + 0.085;
    const g0 = Math.max(0, Math.floor((xs[i] - rr - X0) / DR_CELL)), g1 = Math.min(M - 1, Math.floor((xs[i] + rr - X0) / DR_CELL));
    for (let g = g0; g <= g1; g++) {
      lo[g] = Math.min(lo[g], ys[i] - rr); hi[g] = Math.max(hi[g], ys[i] + rr); half[g] = Math.max(half[g], rr);
    }
  }
  const half2 = CONFIG.mainTotal / 2;
  let cur: DrSolid = null, cy0 = 0, cy1 = 0, ch = 0;
  for (let g = 0; g < M; g++) {
    if (hi[g] === -Infinity) { cur = null; continue; }
    const xa = X0 + g * DR_CELL, xb = xa + DR_CELL, d = Math.min(deckY(xa), deckY(xb));
    if (hi[g] < d) { cur = null; continue; }                       // thân dưới mặt cầu
    let y0 = lo[g], h = half[g];
    if (Math.abs(xa + DR_CELL / 2) < half2 && lo[g] > d) { y0 = d; h = Math.max(h, DR_HANG); }
    else if (lo[g] < d) y0 = d;
    const y1 = hi[g];
    if (cur && Math.abs(h - ch) <= 0.05 && Math.max(cy1, y0) - Math.min(cy0, y0) <= TOL && Math.abs(y1 - cur.y1) <= DR_TOP_MERGE) {
      cur.x1 = xb; cur.y0 = Math.min(cur.y0, y0); cur.y1 = Math.max(cur.y1, y1); cy0 = Math.min(cy0, y0); cy1 = Math.max(cy1, y0);
      continue;
    }
    cur = { kind: 'rect', x0: xa, x1: xb, z0: -h, z1: h, y0, y1 }; out.push(cur); cy0 = cy1 = y0; ch = h;
  }
}
function drDragon(out: DrSolid[]): void {
  drDeckEdges(out, 0, DR_IN, DR_OUT, DR_TOP, -DR_X, DR_X, deckY);
  drDragonSolids(out);
  for (const px of CONFIG.approachPiers) for (const s of [-1, 1]) {   // trụ nhịp dẫn: cột ô-van bán trục 2,0 × 2,8 tới đáy bản mặt cầu
    out.push({ kind: 'rect', x0: px - 2.0, x1: px + 2.0, z0: s * 8.5 - 2.8, z1: s * 8.5 + 2.8, y0: LAND, y1: deckY(px) - 0.5 });
  }
}

/* ===== Cầu sông Hàn (tọa độ cục bộ x, z + SH.z) ===== */
/* Lề cầu vẽ tới |x| = 290 (fixedSpans.ts:64), chồng 1,5 m lên làn phía sông của đường ven sông (mép ngoài |x| = 288,5): cắt ở mép làn đó để
   xe đi sát bó vỉa Bạch Đằng / Trần Hưng Đạo hay rẽ vào cầu không vướng đầu lan can (ô đường ven sông là mặt đường thật) */
const SH_EDGE_X = CONFIG.drive.roads.riverX - CONFIG.drive.roads.median / 2 - CONFIG.drive.roads.half;   // 288,5
function drSongHan(out: DrSolid[]): void {
  const Z = SH.z, S = SH.deckY;
  drDeckEdges(out, Z, cdInner(SH.hw, SH.sidewalk), cdOuter(SH.hw), CD_TOP, -SH_EDGE_X, SH_EDGE_X, shRoadY);   // phần cố định nối liền lề nhịp quay
  const rect = (x0: number, x1: number, dz: number, y0: number, y1: number) => out.push({ kind: 'rect', x0, x1, z0: Z - dz, z1: Z + dz, y0, y1 });
  rect(-0.45, 0.45, 1.0, S, S + SH.mastHeight);                     // cột đôi ở tim
  const legX = (h: number) => SH.aFoot * (1 - Math.min(1, Math.max(0, (h - 0.2) / (SH.aApex - 0.2))));
  const stayX = (xd: number, top: number, h: number) => xd - Math.max(0, h - 0.35) * (xd - 0.5) / (top - 0.35);
  for (const s of [-1, 1]) {
    for (const [h0, h1] of [[0, 3], [3, 8], [8, 14], [14, SH.aApex + 0.8]]) {   // chân chữ A theo dải cao (nửa tiết diện 0,7 + 0,2)
      const a = legX(h1) - 0.9, b = legX(h0) + 0.9;
      rect(s < 0 ? -b : a, s < 0 ? -a : b, 0.5, S + h0, S + h1);
    }
    for (let i = 0; i < SH.stays; i++) {                            // dây văng: hai dải thấp, đủ cho camera (ước lượng)
      const k = i / (SH.stays - 1), xd = SH.stayDeck[1] + (SH.stayDeck[0] - SH.stayDeck[1]) * k, top = SH.stayTop[1] + (SH.stayTop[0] - SH.stayTop[1]) * k;
      for (const [h0, h1] of [[0, 4], [4, 10]]) {
        const a = stayX(xd, top, h1) - 0.1, b = (h0 === 0 ? xd + 0.3 : stayX(xd, top, h0) + 0.1);
        rect(s < 0 ? -b : a, s < 0 ? -a : b, 0.15, S + h0, S + h1);
      }
    }
    for (const sz of [-1, 1]) {                                     // hộp barie trên gờ chắn bánh
      const bx = s * SH.barrierX, bz = Z + sz * (SH.hw - SH.sidewalk + 0.15), y = shRoadY(bx);
      out.push({ kind: 'rect', x0: bx - 0.225, x1: bx + 0.225, z0: bz - 0.225, z1: bz + 0.225, y0: y, y1: y + 1.25 });
    }
  }
}

/* ===== Trần Thị Lý (z = TTL.z) ===== */
function drTranThiLy(out: DrSolid[]): void {
  const Z = TTL.z;
  drDeckEdges(out, Z, cdInner(TTL.hw, TTL.sidewalk), cdOuter(TTL.hw), CD_TOP, -470, 450, ttlRoadY);
  /* thân tháp nghiêng trên dải giữa: lấy mẫu hai mép tiết diện (mép sau, mép trước) theo t, giữ điểm trong từng dải cao trên mặt cầu */
  const d = ttlRoadY(TTL.pylonX);
  for (const [h0, h1] of [[0, 4], [4, 8], [8, 16]]) {
    let x0 = Infinity, x1 = -Infinity, wz = 0, ya = Infinity, yb = -Infinity;
    for (let t = 0; t <= 0.3; t += 0.0005) {
      const sec = ttlPylonSection(t);
      for (const lx of [sec.back, sec.front]) {
        const q = ttlPylonPoint(t, lx, 0);
        if (q.y < d + h0 || q.y > d + h1) continue;
        x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); wz = Math.max(wz, sec.Wz / 2);
      }
    }
    if (!(x1 > x0)) continue;
    for (let x = x0; x <= x1; x += 0.5) { const y = ttlRoadY(x); ya = Math.min(ya, y); yb = Math.max(yb, y); }
    out.push({ kind: 'rect', x0, x1, z0: Z - wz, z1: Z + wz, y0: ya + h0, y1: yb + h1 });
  }
  /* trụ trên bờ (trên dải giữa đường ven sông và dưới dốc cầu): thân 2,6 × 19 từ mặt đất tới đáy dầm */
  for (const x of TTL.piers) {
    if (Math.abs(x) < CONFIG.bankX) continue;
    out.push({ kind: 'rect', x0: x - 1.3, x1: x + 1.3, z0: Z - 9.5, z1: Z + 9.5, y0: LAND, y1: ttlRoadY(x) - TTL.girderDepth });
  }
}

/* ===== Thuận Phước (z = TP.z): chỉ lề cầu; tháp và buồng neo xa mép làn hơn 1 m ===== */
function drThuanPhuoc(out: DrSolid[]): void {
  const E = TP.endX + TP.embankment;
  drDeckEdges(out, TP.z, cdInner(TP.deckWidth / 2, TP.sidewalk), cdOuter(TP.deckWidth / 2), CD_TOP, -E, E, tpRoadY);
}

/* ===== Hầm vượt sông Hàn (phương án đề xuất; z = HR.z) ===== */
function drTunnel(out: DrSolid[]): void {
  const Z = HR.z, a = HR.coverHalf, c = HR.rampHalf;
  const roof = (x: number) => hrRoadY(x) + HR.roofTop;
  const wallTop = (x: number) => Math.max(hrRoadY(x) + 1.1, LAND + 0.6);
  const midTop = (x: number) => hrRoadY(x) + 0.9;
  const runs: [number, number, DrF, DrF][] = [[-a, a, roof, roof], [-c, -a, wallTop, midTop], [a, c, wallTop, midTop]];   // [x0, x1, đỉnh tường ngoài, đỉnh khối giữa]
  for (const [x0, x1, outerTop, midHi] of runs) {
    for (const s of [-1, 1]) drAlongX(out, x0, x1, s < 0 ? Z - HR.halfWidth : Z + HR.tubeFar, s < 0 ? Z - HR.tubeFar : Z + HR.halfWidth, hrRoadY, outerTop);
    drAlongX(out, x0, x1, Z - HR.tubeNear, Z + HR.tubeNear, hrRoadY, midHi);
  }
}

/* Danh sách vật cản tĩnh, dựng mới mỗi lần gọi (gọi một lần lúc vào chế độ lái) */
export function drBuildSolids(): DrSolid[] {
  const out: DrSolid[] = [];
  drDragon(out);
  drSongHan(out);
  drTranThiLy(out);
  drThuanPhuoc(out);
  drTunnel(out);
  return out;
}
