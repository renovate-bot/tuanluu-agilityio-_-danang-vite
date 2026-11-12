/* ============================ Lái xe: va chạm thân xe nhiều tầng ============================
   Thân xe là hình chữ nhật có hướng (dài × rộng VF 3), tâm ở giữa hai trục bánh, cao độ p.y là mặt đường tại tâm.
   - Thân xe hợp lệ khi 9 điểm mẫu (4 góc, 4 trung điểm cạnh, tâm) đều có mặt đường cùng tầng (drGround hữu hạn từ yRef = p.y),
     không chồng vật cản nào có khoảng cao độ giao [y + sim.floor, y + chiều cao xe], không chồng hộp xe tự động cùng tầng (trừ hộp bỏ qua).
   - Luật xe tự động (spec §6): đầu mỗi drMove, hộp nào đã chồng tư thế xuất phát thì bỏ qua cả lượt đó; nhờ vậy xe tự động đâm tới
     thì đi xuyên, người chơi tự lao vào thì bị chặn, đã chồng thì vẫn lái ra được theo mọi hướng.
   - Đường thoát: tư thế đầu lượt đã chồng vật cản tĩnh hoặc ra ngoài ô thì nhận bước con không làm tệ hơn (drBad), để không kẹt vĩnh viễn.
   - Vật cản tra qua chỉ mục lưới ô DRC m (mẫu stroll/map.ts), giữ ngoài DrNet trong một WeakMap; dựng lười, nối thêm khi drAddSolids
     push vật cản mới, dựng lại khi mảng bị thay. Vật cản phủ quá nhiều ô để riêng danh sách "lớn", tra tuyến tính.
   - drFits / drMove / drSegClear chạy mỗi khung: không cấp phát (D-018), trừ khi lưới nối thêm vật cản hoặc mảng bỏ qua phải nới.
   Quy ước hướng: yaw = 0 mũi xe hướng +X; vectơ tiến (cos yaw, −sin yaw); dyaw > 0 là rẽ trái khi tiến. */
import { CONFIG } from '../../config';
import { drGround, type DrNet, type DrSolid } from './net';

export interface DrPose { x: number; y: number; z: number; yaw: number }
export interface DrBox { x: number; y: number; z: number; yaw: number; hl: number; hw: number }   // hộp xe tự động: nửa dài, nửa rộng

const CAR = CONFIG.drive.car, SIM = CONFIG.drive.sim;
const HL = CAR.length / 2, HW = CAR.width / 2;                       // nửa dài, nửa rộng thân xe, m
const AX = CAR.wheelbase / 2;                                        // tâm → trục sau, m
const REACH = AX + Math.hypot(HL, HW);                               // trục sau → góc xe xa nhất: quãng góc xe quét khi xoay dyaw là ≤ REACH · |dyaw|
const EPS = 1e-9;

/* ===== Chỉ mục lưới vật cản ===== */
const DRC = 16;          // cạnh ô lưới, m
const DR_BIG = 64;       // vật cản phủ hơn số ô này thì vào danh sách "lớn"
const DR_OFF = 32768;    // dời chỉ số ô về số dương để ghép khóa (±524 km)
const drKey = (ix: number, iz: number): number => (ix + DR_OFF) * 65536 + (iz + DR_OFF);
interface DrGrid { arr: DrSolid[]; n: number; cells: Map<number, number[]>; big: number[] }
const GRIDS = new WeakMap<DrNet, DrGrid>();

function drIndexOne(g: DrGrid, s: DrSolid, i: number): void {
  const c = s.kind === 'circle';
  const x0 = c ? s.cx - s.r : s.x0, x1 = c ? s.cx + s.r : s.x1, z0 = c ? s.cz - s.r : s.z0, z1 = c ? s.cz + s.r : s.z1;
  const ix0 = Math.floor(x0 / DRC), ix1 = Math.floor(x1 / DRC), iz0 = Math.floor(z0 / DRC), iz1 = Math.floor(z1 / DRC);
  if ((ix1 - ix0 + 1) * (iz1 - iz0 + 1) > DR_BIG) { g.big.push(i); return; }
  for (let ix = ix0; ix <= ix1; ix++) for (let iz = iz0; iz <= iz1; iz++) {
    const k = drKey(ix, iz); let list = g.cells.get(k);
    if (!list) { list = []; g.cells.set(k, list); }
    list.push(i);
  }
}
/* Lưới của net, cập nhật theo net.solids (drAddSolids chỉ push nên chỉ nối phần mới) */
function drGrid(net: DrNet): DrGrid {
  let g = GRIDS.get(net);
  if (!g || g.arr !== net.solids || g.n > net.solids.length) { g = { arr: net.solids, n: 0, cells: new Map(), big: [] }; GRIDS.set(net, g); }
  while (g.n < net.solids.length) { drIndexOne(g, net.solids[g.n], g.n); g.n++; }
  return g;
}

/* ===== Hình học ===== */
/* Thân xe (tâm x, z; cos c, sin s) chồng vật cản sol không (chỉ mặt bằng). Trục tiến f = (c, −s), trục ngang n = (s, c) */
function drHitSolid(sol: DrSolid, x: number, z: number, c: number, s: number): boolean {
  const ac = Math.abs(c), as = Math.abs(s);
  if (sol.kind === 'circle') {
    const dx = sol.cx - x, dz = sol.cz - z;
    let lf = dx * c - dz * s, ln = dx * s + dz * c;                   // tâm tròn trong hệ thân xe
    lf = lf > HL ? HL : lf < -HL ? -HL : lf; ln = ln > HW ? HW : ln < -HW ? -HW : ln;
    const ex = x + lf * c + ln * s - sol.cx, ez = z - lf * s + ln * c - sol.cz;
    return ex * ex + ez * ez < sol.r * sol.r - EPS;
  }
  const ex = (sol.x1 - sol.x0) / 2, ez = (sol.z1 - sol.z0) / 2, dx = (sol.x0 + sol.x1) / 2 - x, dz = (sol.z0 + sol.z1) / 2 - z;
  if (Math.abs(dx) >= ex + HL * ac + HW * as - EPS) return false;    // tách theo trục X
  if (Math.abs(dz) >= ez + HL * as + HW * ac - EPS) return false;    // trục Z
  if (Math.abs(dx * c - dz * s) >= HL + ex * ac + ez * as - EPS) return false;   // trục tiến
  if (Math.abs(dx * s + dz * c) >= HW + ex * as + ez * ac - EPS) return false;   // trục ngang
  return true;
}
/* Độ lấn của thân xe vào vật cản sol (m, ≤ 0 là không chồng): hộp lấy độ chồng nhỏ nhất trên 4 trục tách (SAT);
   tròn lấy r − khoảng cách từ tâm tròn tới thân xe (tâm tròn nằm trong thân xe thì r + khoảng tới cạnh gần nhất). Chỉ dùng cho đường thoát */
function drPenSolid(sol: DrSolid, x: number, z: number, c: number, s: number): number {
  const ac = Math.abs(c), as = Math.abs(s);
  if (sol.kind === 'circle') {
    const dx = sol.cx - x, dz = sol.cz - z, lf = dx * c - dz * s, ln = dx * s + dz * c;
    const ef = Math.abs(lf) - HL, en = Math.abs(ln) - HW;
    if (ef <= 0 && en <= 0) return sol.r - Math.max(ef, en);
    const qf = ef > 0 ? ef : 0, qn = en > 0 ? en : 0;
    return sol.r - Math.hypot(qf, qn);
  }
  const ex = (sol.x1 - sol.x0) / 2, ez = (sol.z1 - sol.z0) / 2, dx = (sol.x0 + sol.x1) / 2 - x, dz = (sol.z0 + sol.z1) / 2 - z;
  return Math.min(ex + HL * ac + HW * as - Math.abs(dx), ez + HL * as + HW * ac - Math.abs(dz),
    HL + ex * ac + ez * as - Math.abs(dx * c - dz * s), HW + ex * as + ez * ac - Math.abs(dx * s + dz * c));
}
/* Thân xe chồng hộp xe tự động b không (cùng tầng: chân hai xe chênh < chiều cao xe) */
function drHitBox(b: DrBox, x: number, y: number, z: number, c: number, s: number): boolean {
  if (Math.abs(b.y - y) >= CAR.height) return false;
  const bc = Math.cos(b.yaw), bs = Math.sin(b.yaw), dx = b.x - x, dz = b.z - z;
  /* bốn trục tách: f1 = (c, −s), n1 = (s, c), f2 = (bc, −bs), n2 = (bs, bc); hình chiếu nửa hộp lên trục a là hl|f·a| + hw|n·a| */
  const ff = c * bc + s * bs, fn = c * bs - s * bc;                  // f1·f2, f1·n2
  const nf = s * bc - c * bs, nn = s * bs + c * bc;                  // n1·f2, n1·n2
  if (Math.abs(dx * c - dz * s) >= HL + b.hl * Math.abs(ff) + b.hw * Math.abs(fn) - EPS) return false;
  if (Math.abs(dx * s + dz * c) >= HW + b.hl * Math.abs(nf) + b.hw * Math.abs(nn) - EPS) return false;
  if (Math.abs(dx * bc - dz * bs) >= b.hl + HL * Math.abs(ff) + HW * Math.abs(nf) - EPS) return false;
  if (Math.abs(dx * bs + dz * bc) >= b.hw + HL * Math.abs(fn) + HW * Math.abs(nn) - EPS) return false;
  return true;
}

/* ===== Thân xe hợp lệ ===== */
export function drFits(net: DrNet, p: DrPose, boxes: DrBox[], nBoxes: number, ignore: Uint8Array): boolean {
  const yRef = p.y, c = Math.cos(p.yaw), s = Math.sin(p.yaw);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const lf = i * HL, ln = j * HW;
    if (Number.isNaN(drGround(net, p.x + lf * c + ln * s, p.z - lf * s + ln * c, yRef))) return false;
  }
  const ya = yRef + SIM.floor, yb = yRef + CAR.height, sol = net.solids, g = drGrid(net);
  const big = g.big;
  for (let i = 0; i < big.length; i++) { const o = sol[big[i]]; if (o.y1 > ya && o.y0 < yb && drHitSolid(o, p.x, p.z, c, s)) return false; }
  const R = HL * Math.abs(c) + HW * Math.abs(s), Rz = HL * Math.abs(s) + HW * Math.abs(c);   // nửa khung bao thân xe theo X, Z
  const ix0 = Math.floor((p.x - R) / DRC), ix1 = Math.floor((p.x + R) / DRC), iz0 = Math.floor((p.z - Rz) / DRC), iz1 = Math.floor((p.z + Rz) / DRC);
  for (let ix = ix0; ix <= ix1; ix++) for (let iz = iz0; iz <= iz1; iz++) {
    const list = g.cells.get(drKey(ix, iz));
    if (!list) continue;
    for (let i = 0; i < list.length; i++) { const o = sol[list[i]]; if (o.y1 > ya && o.y0 < yb && drHitSolid(o, p.x, p.z, c, s)) return false; }
  }
  for (let i = 0; i < nBoxes; i++) if (!ignore[i] && drHitBox(boxes[i], p.x, yRef, p.z, c, s)) return false;
  return true;
}

/* ===== Đường thoát ===== */
/* Mức "tệ" của tư thế p không hợp lệ, ghi vào BAD_N, BAD_D:
   BAD_N = số điểm mẫu (trong 9) không có mặt đường cùng tầng; BAD_D = tổng độ lấn (drPenSolid > 0) vào các vật cản tĩnh cùng khoảng cao độ.
   Đường thoát nhận bước con khi cả hai không tăng: lấn theo SAT tăng ngay khi đi sâu thêm, và chỉ giảm sau khi vượt quá nửa vật cản,
   nên từ chỗ chồng nông không bao giờ đi xuyên qua được; đi vào vật cản mới thì tổng tăng. */
let BAD_N = 0, BAD_D = 0;
function drBad(net: DrNet, p: DrPose): void {
  const yRef = p.y, c = Math.cos(p.yaw), s = Math.sin(p.yaw);
  let n = 0, d = 0;
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const lf = i * HL, ln = j * HW;
    if (Number.isNaN(drGround(net, p.x + lf * c + ln * s, p.z - lf * s + ln * c, yRef))) n++;
  }
  const ya = yRef + SIM.floor, yb = yRef + CAR.height, sol = net.solids, g = drGrid(net), big = g.big;
  for (let i = 0; i < big.length; i++) { const o = sol[big[i]]; if (o.y1 > ya && o.y0 < yb) { const q = drPenSolid(o, p.x, p.z, c, s); if (q > 0) d += q; } }
  const R = HL * Math.abs(c) + HW * Math.abs(s), Rz = HL * Math.abs(s) + HW * Math.abs(c);
  const ix0 = Math.floor((p.x - R) / DRC), ix1 = Math.floor((p.x + R) / DRC), iz0 = Math.floor((p.z - Rz) / DRC), iz1 = Math.floor((p.z + Rz) / DRC);
  for (let ix = ix0; ix <= ix1; ix++) for (let iz = iz0; iz <= iz1; iz++) {
    const list = g.cells.get(drKey(ix, iz));
    if (!list) continue;
    for (let k = 0; k < list.length; k++) {
      const i = list[k], o = sol[i];
      /* vật cản phủ nhiều ô được gặp nhiều lần: chỉ cộng ở ô đầu tiên (ô thấp nhất) mà nó và khung bao thân xe cùng có */
      if (!(o.y1 > ya && o.y0 < yb)) continue;
      const cx0 = o.kind === 'circle' ? o.cx - o.r : o.x0, cz0 = o.kind === 'circle' ? o.cz - o.r : o.z0;
      if (ix !== Math.max(ix0, Math.floor(cx0 / DRC)) || iz !== Math.max(iz0, Math.floor(cz0 / DRC))) continue;
      const q = drPenSolid(o, p.x, p.z, c, s); if (q > 0) d += q;
    }
  }
  BAD_N = n; BAD_D = d;
}

/* ===== Dời thân xe ===== */
let IGN = new Uint8Array(16);                                        // hộp bỏ qua trong lượt drMove hiện tại
const CUR: DrPose = { x: 0, y: 0, z: 0, yaw: 0 }, CAND: DrPose = { x: 0, y: 0, z: 0, yaw: 0 };
let mNet: DrNet, mBoxes: DrBox[], mN = 0;                            // tham số của lượt drMove hiện tại (tránh truyền lại / tạo closure)
let mEsc = false, mBadN = 0, mBadD = 0;                              // đang ở đường thoát (CUR không hợp lệ) và mức tệ của CUR
const BAD_TOL = 1e-6;                                                // m — dung sai làm tròn khi so tổng độ lấn

/* Thử đặt thân xe tại CAND (cao độ lấy lại theo mặt đường tại tâm); được thì chép sang CUR.
   CUR hợp lệ: CAND phải hợp lệ (luật thường). CUR không hợp lệ (đường thoát): CAND hợp lệ, hoặc không chạm hộp xe tự động
   chưa bỏ qua và mức tệ (drBad) không tăng; tâm không có mặt đường thì giữ cao độ cũ. */
function drTry(): boolean {
  let y = drGround(mNet, CAND.x, CAND.z, CUR.y);
  if (Number.isNaN(y)) { if (!mEsc) return false; y = CUR.y; }
  CAND.y = y;
  if (drFits(mNet, CAND, mBoxes, mN, IGN)) mEsc = false;
  else {
    if (!mEsc) return false;
    const c = Math.cos(CAND.yaw), s = Math.sin(CAND.yaw);
    for (let i = 0; i < mN; i++) if (!IGN[i] && drHitBox(mBoxes[i], CAND.x, y, CAND.z, c, s)) return false;
    drBad(mNet, CAND);
    if (BAD_N > mBadN || BAD_D > mBadD + BAD_TOL) return false;
    mBadN = BAD_N; mBadD = BAD_D;
  }
  CUR.x = CAND.x; CUR.y = CAND.y; CUR.z = CAND.z; CUR.yaw = CAND.yaw;
  return true;
}
/* Bước con kiểu xe đạp: trục sau đi sd theo hướng giữa bước, xe xoay sy; tâm = trục sau + AX theo hướng mới */
function drTryArc(sd: number, sy: number): boolean {
  const y0 = CUR.yaw, ym = y0 + sy / 2, y1 = y0 + sy;
  const rx = CUR.x - AX * Math.cos(y0) + sd * Math.cos(ym), rz = CUR.z + AX * Math.sin(y0) - sd * Math.sin(ym);
  CAND.x = rx + AX * Math.cos(y1); CAND.z = rz - AX * Math.sin(y1); CAND.yaw = y1;
  return drTry();
}
function drTryShift(dx: number, dz: number): boolean {
  CAND.x = CUR.x + dx; CAND.z = CUR.z + dz; CAND.yaw = CUR.yaw;
  return drTry();
}

/* Dời thân xe từ p quãng dist (m, âm = lùi; quãng của trục sau) và xoay dyaw (rad), kết quả vào out (out có thể là p).
   Chia bước con ≤ sim.sub (tính cả quãng góc xe quét khi xoay). Bước con bị chặn thì thử: chỉ tịnh tiến (bỏ xoay), chỉ thành phần X,
   chỉ thành phần Z (trượt dọc vật cản thẳng trục); không được thì dừng. Tư thế đầu lượt đã chồng vật cản tĩnh / ra ngoài ô
   (chỗ xuất phát đặt sai, vật cản thêm đè lên xe) thì đi theo đường thoát của drTry cho tới khi hợp lệ trở lại. Trả phần quãng đã đi theo hướng định đi:
   1 = trọn; trượt theo một trục tính bằng bình phương cos góc giữa trục đó và hướng định đi; 0 = đứng hẳn. */
export function drMove(net: DrNet, p: DrPose, dist: number, dyaw: number, boxes: DrBox[], nBoxes: number, out: DrPose): number {
  if (IGN.length < nBoxes) IGN = new Uint8Array(Math.max(nBoxes, IGN.length * 2));
  const c0 = Math.cos(p.yaw), s0 = Math.sin(p.yaw);
  for (let i = 0; i < nBoxes; i++) IGN[i] = drHitBox(boxes[i], p.x, p.y, p.z, c0, s0) ? 1 : 0;
  mNet = net; mBoxes = boxes; mN = nBoxes;
  CUR.x = p.x; CUR.y = p.y; CUR.z = p.z; CUR.yaw = p.yaw;
  mEsc = !drFits(net, CUR, boxes, nBoxes, IGN);                      // hộp chồng sẵn đã bỏ qua: không hợp lệ chỉ vì vật cản tĩnh / ra ngoài ô
  if (mEsc) { drBad(net, CUR); mBadN = BAD_N; mBadD = BAD_D; }
  const n = Math.max(1, Math.ceil((Math.abs(dist) + Math.abs(dyaw) * REACH) / SIM.sub));
  const sd = dist / n, sy = dyaw / n;
  let done = 0;
  for (let k = 0; k < n; k++) {
    if (drTryArc(sd, sy)) { done += 1; continue; }
    if (sd === 0) break;                                              // xoay tại chỗ bị chặn
    if (sy !== 0 && drTryShift(sd * Math.cos(CUR.yaw), -sd * Math.sin(CUR.yaw))) { done += 1; continue; }
    const tx = sd * Math.cos(CUR.yaw), tz = -sd * Math.sin(CUR.yaw);
    if (Math.abs(tx) > EPS && drTryShift(tx, 0)) { done += tx * tx / (sd * sd); continue; }
    if (Math.abs(tz) > EPS && drTryShift(0, tz)) { done += tz * tz / (sd * sd); continue; }
    break;
  }
  out.x = CUR.x; out.y = CUR.y; out.z = CUR.z; out.yaw = CUR.yaw;
  mNet = null; mBoxes = null;
  return done / n;
}

/* ===== Đoạn thẳng (camera) ===== */
/* Tham số t ∈ [0, 1] nơi đoạn a + t·d đi vào vật cản o (khối hộp / trụ đứng giữa y0..y1); 1 nếu không cắt; 0 nếu a ở trong */
function drSegHit(o: DrSolid, ax: number, ay: number, az: number, dx: number, dy: number, dz: number): number {
  let t0 = -Infinity, t1 = Infinity;
  if (Math.abs(dy) < EPS) { if (ay < o.y0 || ay > o.y1) return 1; }
  else { const a = (o.y0 - ay) / dy, b = (o.y1 - ay) / dy; t0 = a < b ? a : b; t1 = a < b ? b : a; }
  if (o.kind === 'circle') {
    const ox = ax - o.cx, oz = az - o.cz, A = dx * dx + dz * dz, B = 2 * (ox * dx + oz * dz), C = ox * ox + oz * oz - o.r * o.r;
    if (A < EPS) { if (C > 0) return 1; }
    else {
      const D = B * B - 4 * A * C;
      if (D < 0) return 1;
      const q = Math.sqrt(D), a = (-B - q) / (2 * A), b = (-B + q) / (2 * A);
      if (a > t0) t0 = a; if (b < t1) t1 = b;
    }
  } else {
    if (Math.abs(dx) < EPS) { if (ax < o.x0 || ax > o.x1) return 1; }
    else { const a = (o.x0 - ax) / dx, b = (o.x1 - ax) / dx; if (Math.min(a, b) > t0) t0 = Math.min(a, b); if (Math.max(a, b) < t1) t1 = Math.max(a, b); }
    if (Math.abs(dz) < EPS) { if (az < o.z0 || az > o.z1) return 1; }
    else { const a = (o.z0 - az) / dz, b = (o.z1 - az) / dz; if (Math.min(a, b) > t0) t0 = Math.min(a, b); if (Math.max(a, b) < t1) t1 = Math.max(a, b); }
  }
  if (t0 > t1 || t1 < 0 || t0 > 1) return 1;
  return t0 > 0 ? t0 : 0;
}

/* Phần đoạn thẳng a → b (0..1) đi được trước khi chạm vật cản (cùng khoảng cao độ, vì vật cản có y0..y1 tuyệt đối) */
export function drSegClear(net: DrNet, ax: number, ay: number, az: number, bx: number, by: number, bz: number): number {
  const g = drGrid(net), sol = net.solids, dx = bx - ax, dy = by - ay, dz = bz - az;
  let t = 1;
  const big = g.big;
  for (let i = 0; i < big.length; i++) { const h = drSegHit(sol[big[i]], ax, ay, az, dx, dy, dz); if (h < t) t = h; }
  const ix0 = Math.floor(Math.min(ax, bx) / DRC), ix1 = Math.floor(Math.max(ax, bx) / DRC);
  const iz0 = Math.floor(Math.min(az, bz) / DRC), iz1 = Math.floor(Math.max(az, bz) / DRC);
  for (let ix = ix0; ix <= ix1; ix++) for (let iz = iz0; iz <= iz1; iz++) {
    const list = g.cells.get(drKey(ix, iz));
    if (!list) continue;
    for (let i = 0; i < list.length; i++) { const h = drSegHit(sol[list[i]], ax, ay, az, dx, dy, dz); if (h < t) t = h; }
  }
  return t;
}
