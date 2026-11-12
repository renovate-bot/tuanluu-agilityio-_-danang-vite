/* ============================ Lái xe: hình học mặt đường mới (thuần, không đụng renderer / MAT) ============================
   Dựng mặt đường cho mọi ô 'road' / 'slip' / 'junction' của mạng lái xe (explore/drive/roadData.ts) chỗ CHƯA có mặt đường thật:
   ô trừ đi các dải mặt đường đã có (OLD). Phần còn lại là "mảnh mới", lát đúng cao độ ô (roadY + 0,02; vùng site.ts landY + 0,02):
   - mảnh phủ đủ bề ngang ô đường / nhánh rẽ: UV v 0..1 như ROADS2 (vạch mép, vạch đứt giữa hai làn);
   - mảnh khác (nút giao, mảnh lẻ): UV v cố định ở vùng nhựa trơn của texture (không vạch).
   Dải giữa / vỉa hè trên bờ ở mọi trục (streets.ts, site.ts: drCutBoxes; dải giữa trên bờ của Cầu sông Hàn, Trần Thị Lý, Thuận Phước,
   dải giữa cỏ + vỉa hè gạch của hầm: drCutAlongX) chia đoạn tại ô, chỗ trống được mảnh mới lấp: không còn gờ nổi trên ô đường
   (xe bám cao độ phẳng của ô, spec "xe không chìm dưới mặt đường"). Không cắt gì trên nhịp cầu.
   Dải giữa đường mới (hai đường dọc, hai đường nối): một hộp giữa mỗi cặp ô hai chiều, tự ngắt ở nút giao.
   Mọi hàm không gọi rand() / rng (test driveRoads.test.ts). Hình học: indexed, đủ position / normal / uv để gộp với ROADS2 / MEDIANS.

   Bảng mặt đường đã có (file : hình học đã đọc), dùng để trừ:
   | Tuyến | Mặt cắt mỗi chiều | Dọc tuyến | Nguồn |
   | Trục Cầu Rồng (trên bờ) | |z| 3..16,25 | x −1900..−333, 333..1480 | streets.ts:17-20 |
   | Trục Cầu sông Hàn | |z + 1080| 1,1..4,45 | x −1900..−62,35, 62,35..1480 | song-han/fixedSpans.ts:46-50 |
   | Trục Trần Thị Lý | |z − 1300| 2,75..14 | x −1900..1480 | tran-thi-ly/deck.ts:17-21 |
   | Trục hầm (mặt phố + dốc) | |z + 1700| 2,1..14,6 | x −1900..−490, 490..1480 | han-tunnel/outdoor.ts:93-97 |
   | Trục Thuận Phước | |z + 2900| 0,5..7,5 | x −1500..1480 | thuan-phuoc/deck.ts:27-31 |
   | Bạch Đằng / Trần Hưng Đạo | |x ∓ 299| 1,5..10,5 | Tây z −3210..2600, Đông −3660..2600 | streets.ts:25-28; thuan-phuoc/site.ts:30-38 |
   Dải nổi cũ chia đoạn bằng drCutAlongX: dải giữa Cầu sông Hàn trên bờ (song-han/fixedSpans.ts), Trần Thị Lý trên bờ (tran-thi-ly/deck.ts),
   dải giữa cỏ và vỉa hè gạch hầm (han-tunnel/outdoor.ts hrBuildSurface), dải giữa Thuận Phước trên bờ (thuan-phuoc/deck.ts). */
import * as THREE from 'three';
import { CONFIG } from '../config';
import { drBuildPads } from '../explore/drive/roadData';
import type { DrPad } from '../explore/drive/net';
import { SH } from '../bridges/song-han/profile';
import { TTL } from '../bridges/tran-thi-ly/profile';
import { HR } from '../bridges/han-tunnel/profile';
import { TP } from '../bridges/thuan-phuoc/profile';

export interface DrRect { x0: number; x1: number; z0: number; z1: number }
interface DrPiece extends DrRect { y: number; full: boolean; alongX: boolean }   // mảnh mặt đường cần dựng

const R = CONFIG.drive.roads, ROAD = CONFIG.roadY, LAND = CONFIG.landY;
const EPS = 1e-6, MIN = 1e-3;                                       // m — chồng nhau / mảnh bỏ qua khi mỏng hơn
const LIFT = 0.02;                                                  // m — mặt đường mới cao hơn mặt đất đường, như ROADS2 ven sông (streets.ts y − 0,01)
const PLAIN_V = 0.3;                                                // v texture road2 ở vùng nhựa trơn (vạch mép 0,06 / 0,94, vạch giữa 0,5)
const MED_H = 0.3;                                                  // m — dải giữa đường mới cao như streets.ts
const LIN = R.median / 2, LOUT = LIN + R.half;                      // 1,5 / 10,5
const AX0 = R.axisX0, AX1 = R.axisX1;
const RIVER = { W: [-2600, 2600], E: [-2300, 2600] };               // m — z hai đường ven sông trong streets.ts:25
const SITE = { W: -3250 + 40, E: -3700 + 40 };                      // m — đầu Bắc mặt đường nối dài trong site.ts:16,32

/* hai dải đối xứng quanh tim c theo trục ngang (along x) hoặc dọc (along z), mép trong a, mép ngoài b */
const bandX = (x0: number, x1: number, c: number, a: number, b: number): DrRect[] => [{ x0, x1, z0: c - b, z1: c - a }, { x0, x1, z0: c + a, z1: c + b }];
const bandZ = (c: number, a: number, b: number, z0: number, z1: number): DrRect[] => [{ x0: c - b, x1: c - a, z0, z1 }, { x0: c + a, x1: c + b, z0, z1 }];

/* ===== Mặt đường đã có (bằng mặt đất, phần cầu / hầm không cần vì ô 'bridge' / 'tunnel' không dựng) ===== */
function drOld(): DrRect[] {
  const out: DrRect[] = [];
  const DR_X = CONFIG.length / 2, DR_IN = CONFIG.median / 2, DR_OUT = DR_IN + CONFIG.lanesPerDir * CONFIG.laneWidth + CONFIG.shoulder;
  for (const [a, b] of [[AX0, -DR_X], [DR_X, AX1]]) out.push(...bandX(a, b, 0, DR_IN, DR_OUT));
  for (const [a, b] of [[AX0, -SH.fixedStart], [SH.fixedStart, AX1]]) out.push(...bandX(a, b, SH.z, SH.median / 2, SH.median / 2 + SH.laneWidth));
  out.push(...bandX(AX0, AX1, TTL.z, TTL.median / 2, TTL.median / 2 + TTL.lanesPerDir * TTL.laneWidth));
  const hrW = HR.shoulder * 2 + HR.laneWidth * HR.lanesPerDir;
  for (const [a, b] of [[AX0, -HR.coverHalf], [HR.coverHalf, AX1]]) out.push(...bandX(a, b, HR.z, HR.tubeCenter - hrW / 2, HR.tubeCenter + hrW / 2));
  out.push(...bandX(R.tpX0, AX1, TP.z, TP.median / 2, TP.median / 2 + 2 * TP.laneWidth));
  out.push(...bandZ(-R.riverX, LIN, LOUT, SITE.W, RIVER.W[1]), ...bandZ(R.riverX, LIN, LOUT, SITE.E, RIVER.E[1]));
  return out;
}
/* ===== Trừ hình chữ nhật: alongX = cắt các lát theo x trước (giữ đủ bề ngang z cho ô chạy dọc X) ===== */
function drSub(a: DrRect, b: DrRect, alongX: boolean): DrRect[] {
  const ix0 = Math.max(a.x0, b.x0), ix1 = Math.min(a.x1, b.x1), iz0 = Math.max(a.z0, b.z0), iz1 = Math.min(a.z1, b.z1);
  if (ix1 - ix0 <= EPS || iz1 - iz0 <= EPS) return [a];
  const out: DrRect[] = [];
  if (alongX) {
    out.push({ x0: a.x0, x1: ix0, z0: a.z0, z1: a.z1 }, { x0: ix1, x1: a.x1, z0: a.z0, z1: a.z1 });
    out.push({ x0: ix0, x1: ix1, z0: a.z0, z1: iz0 }, { x0: ix0, x1: ix1, z0: iz1, z1: a.z1 });
  } else {
    out.push({ x0: a.x0, x1: a.x1, z0: a.z0, z1: iz0 }, { x0: a.x0, x1: a.x1, z0: iz1, z1: a.z1 });
    out.push({ x0: a.x0, x1: ix0, z0: iz0, z1: iz1 }, { x0: ix1, x1: a.x1, z0: iz0, z1: iz1 });
  }
  return out.filter((r) => r.x1 - r.x0 > MIN && r.z1 - r.z0 > MIN);
}
const drSubAll = (a: DrRect, bs: DrRect[], alongX: boolean) => bs.reduce((acc, b) => acc.flatMap((r) => drSub(r, b, alongX)), [a]);
const drOverlap = (a: DrRect, b: DrRect) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > EPS && Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0) > EPS;

/* ===== Mảnh mới (tính một lần: dữ liệu thuần, không ngẫu nhiên) ===== */
let cache: { pieces: DrPiece[]; medians: DrRect[]; open: DrPad[] } | null = null;
function drPlan() {
  if (cache) return cache;
  const open = drBuildPads().filter((p) => p.kind === 'road' || p.kind === 'slip' || p.kind === 'junction');
  const old = drOld();
  /* mặt đường nối dài trong site.ts thấp hơn roadY 0,08 m: mảnh lấp chỗ dải giữa của nó dùng cùng cao độ */
  const yOf = (r: DrRect) => {
    const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    return Math.abs(Math.abs(cx) - R.riverX) <= LOUT && cz < (cx < 0 ? RIVER.W[0] : RIVER.E[0]) ? LAND + LIFT : ROAD + LIFT;
  };
  const pieces: DrPiece[] = [], medians: DrRect[] = [];
  for (const p of open) {
    const alongX = p.x1 - p.x0 >= p.z1 - p.z0, lane = p.kind !== 'junction';
    for (const r of drSubAll(p, old, alongX)) {
      const full = lane && (alongX ? Math.abs(r.z0 - p.z0) < MIN && Math.abs(r.z1 - p.z1) < MIN : Math.abs(r.x0 - p.x0) < MIN && Math.abs(r.x1 - p.x1) < MIN);
      pieces.push({ ...r, y: yOf(r), full, alongX });
    }
    /* dải giữa đường mới: giữa cặp ô hai chiều (.W/.E hoặc .N/.S) không chồng mặt đường cũ nào */
    const m = /^(.*)\.(W|N)$/.exec(p.id);
    if (p.kind === 'road' && m && !old.some((o) => drOverlap(o, p))) {
      const q = open.find((o) => o.id === `${m[1]}.${m[2] === 'W' ? 'E' : 'S'}`);
      if (q) medians.push(m[2] === 'W' ? { x0: p.x1, x1: q.x0, z0: p.z0, z1: p.z1 } : { x0: p.x0, x1: p.x1, z0: p.z1, z1: q.z0 });
    }
  }
  cache = { pieces, medians, open };
  return cache;
}

/* Tứ giác nằm ngang, đỉnh 0 → 1 chạy dọc tuyến (finalizeRoads.fixUV đọc hướng từ hai đỉnh này rồi ghi lại u theo mét) */
function drQuad(r: DrPiece): THREE.BufferGeometry {
  const y = r.y, pos: number[] = [], uv: number[] = [];
  const v0 = r.full ? 0 : PLAIN_V, v1 = r.full ? 1 : PLAIN_V;
  if (r.alongX) pos.push(r.x0, y, r.z0, r.x1, y, r.z0, r.x0, y, r.z1, r.x1, y, r.z1);
  else pos.push(r.x0, y, r.z0, r.x0, y, r.z1, r.x1, y, r.z0, r.x1, y, r.z1);
  uv.push(0, v0, 1, v0, 0, v1, 1, v1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(r.alongX ? [0, 2, 1, 1, 2, 3] : [0, 1, 2, 2, 1, 3]);   // mặt hướng lên (+y)
  return g;
}

/* Hình học đường mới: mặt đường (đẩy vào ROADS2) và dải giữa đường mới (đẩy vào MEDIANS). Mỗi lần gọi trả hình học mới */
export function drRoadGeos(): { roads2: THREE.BufferGeometry[]; medians: THREE.BufferGeometry[] } {
  const P = drPlan();
  const roads2 = P.pieces.map(drQuad);
  const medians = P.medians.map((r) => new THREE.BoxGeometry(r.x1 - r.x0, MED_H, r.z1 - r.z0).translate((r.x0 + r.x1) / 2, ROAD + MED_H / 2, (r.z0 + r.z1) / 2));
  return { roads2, medians };
}
/* Mảnh mặt đường mới, tọa độ thế giới: vùng phải dọn nhà / cây / đèn */
export function drNewRects(): DrRect[] {
  return drPlan().pieces.map((r) => ({ x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1 }));
}
/* Điểm (x, z) thế giới có nằm trên mặt đường mới (nới lề margin) không */
export function drOnNewRoad(x: number, z: number, margin: number): boolean {
  return drPlan().pieces.some((r) => x > r.x0 - margin && x < r.x1 + margin && z > r.z0 - margin && z < r.z1 + margin);
}
/* Dải giữa / vỉa hè cũ (streets.ts, site.ts) trừ đi mọi ô road / slip / junction: phần còn lại, tọa độ thế giới */
export function drCutRects(r: DrRect): DrRect[] {
  const alongX = r.x1 - r.x0 >= r.z1 - r.z0;
  return drSubAll(r, drPlan().open, alongX);
}
/* Như drCutRects nhưng trả hộp y0..y1 (BoxGeometry như streets.ts); rect và hình học theo tọa độ cục bộ lệch zOff so với thế giới (site.ts: TP.z) */
export function drCutBoxes(x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, zOff = 0): THREE.BufferGeometry[] {
  return drCutRects({ x0, x1, z0: z0 + zOff, z1: z1 + zOff }).map((r) => new THREE.BoxGeometry(r.x1 - r.x0, y1 - y0, r.z1 - r.z0).translate((r.x0 + r.x1) / 2, (y0 + y1) / 2, (r.z0 + r.z1) / 2 - zOff));
}
/* Dải nổi cũ chạy dọc X (dải giữa / vỉa hè trên bờ của các trục cầu, hầm), tim zc (thế giới), nửa bề ngang hw, đoạn x0..x1:
   bỏ trọn bề ngang mọi khoảng x mà một ô road / slip / junction chồng lên dải; trả các khoảng [a, b] còn lại */
export function drCutSpans(x0: number, x1: number, zc: number, hw: number): [number, number][] {
  const band: DrRect = { x0, x1, z0: zc - hw, z1: zc + hw };
  let spans: [number, number][] = [[x0, x1]];
  for (const p of drPlan().open) {
    if (!drOverlap(p, band)) continue;
    spans = spans.flatMap(([a, b]): [number, number][] => [[a, Math.min(b, p.x0)], [Math.max(a, p.x1), b]]).filter(([a, b]) => b - a > MIN);
  }
  return spans;
}
/* Dựng dải nổi theo các khoảng của drCutSpans: mk(len, xc, segs) như bentBox(len, …, xc, …, segs, profile) của công trình;
   số đoạn chia của mỗi khúc theo tỉ lệ chiều dài (vẫn bám profile như trước). Hình học gộp vào đúng lưới cũ: không thêm lệnh vẽ */
export function drCutAlongX<G extends THREE.BufferGeometry>(x0: number, x1: number, zc: number, hw: number, segs: number, mk: (len: number, xc: number, segs: number) => G): G[] {
  return drCutSpans(x0, x1, zc, hw).map(([a, b]) => mk(b - a, (a + b) / 2, Math.max(1, Math.ceil(segs * (b - a) / (x1 - x0)))));
}

/* Hệ số nhân ngưỡng ẩn theo khoảng cách của Hầm (HanTunnel.update): chế độ lái đặt CONFIG.drive.tunnelFar, thoát đặt lại 1 */
export const driveView = { far: 1 };
