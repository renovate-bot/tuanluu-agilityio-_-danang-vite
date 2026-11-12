/* ============================ Lái xe: HUD (đồng hồ tốc độ, bản đồ nhỏ, gợi ý phím) ============================
   DOM + canvas 2D, không tốn lệnh vẽ 3D. Khung #drHud (index.html): #drSpeed / #drKmh (km/h), #drMap (canvas), #drMapNote (chú thích Hầm), #drHint.
   - Bản đồ nhỏ: Bắc (−Z) ở trên, Đông ở phải, không xoay. Nền (sông, đất, các ô mặt đường, năm công trình) vẽ MỘT lần vào canvas ẩn từ chính
     mạng đường DrNet (không lệch với đường lái được); mỗi lần cập nhật chỉ chép nền + chấm xe, tối đa CONFIG.drive.hud.mapMs một lần (10 lần/giây).
   - Hầm vượt sông Hàn là công trình chưa xây: ô hầm vẽ màu riêng và chú thích #drMapNote ghi "phương án đề xuất" (khóa drMapTunnel).
   - Đồng hồ: ghi DOM chỉ khi số km/h đổi; không tạo chuỗi / mảng mới khi giá trị hiển thị không đổi (D-018).
   - Gợi ý phím tự ẩn sau CONFIG.drive.hud.hintMs (chỉ hiện ở máy có chuột, CSS). Module không đụng DOM lúc import (test đơn vị chạy trong Node). */
import { CONFIG } from '../../config';
import { drBounds, type DrNet } from './net';
import type { DrState } from './motion';

export interface DrMapDot { x: number; z: number; color: string }
type DrRect = { x0: number; x1: number; z0: number; z1: number };

/* Chiếu (x, z) lên ô w × h px, một tỉ lệ cho cả hai trục: góc Tây Bắc (x0, z0) về (0, 0), Bắc (−Z) ở trên, Đông ở phải */
export function drMapProject(b: DrRect, w: number, h: number, x: number, z: number, out: { u: number; v: number }): void {
  const s = Math.min(w / (b.x1 - b.x0), h / (b.z1 - b.z0));
  out.u = (x - b.x0) * s; out.v = (z - b.z0) * s;
}

/* km/h hiển thị của tốc độ v (m/s, có dấu): làm tròn |v| × 3,6 */
export function drKmh(v: number): number { return Math.round(Math.abs(v) * 3.6); }

const H = CONFIG.drive.hud;
const _p = { u: 0, v: 0 };                                          // điểm chiếu tái dùng
let net: DrNet | null = null, bounds: DrRect | null = null;
let el: { root: HTMLElement | null; kmh: HTMLElement | null; map: HTMLCanvasElement | null; hint: HTMLElement | null } | null = null;
let bg: HTMLCanvasElement | null = null, bgNet: DrNet | null = null;   // nền bản đồ nhỏ và mạng đường nó vẽ từ
let ctx: CanvasRenderingContext2D | null = null;
let mw = 0, mh = 0;                                                  // cỡ canvas bản đồ (px)
let lastKmh = -1, lastMap = -1e9, hintTimer = 0;

/* Nền bản đồ nhỏ: đất, sông (|x| < bankX), ô mặt đường theo loại, năm công trình. Vẽ lại khi đổi mạng hoặc cỡ */
function drMapBackdrop(n: DrNet, b: DrRect, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d')!, C = H.colors, p = _p;
  g.fillStyle = C.land; g.fillRect(0, 0, w, h);
  drMapProject(b, w, h, -CONFIG.bankX, b.z0, p); const u0 = p.u;
  drMapProject(b, w, h, CONFIG.bankX, b.z1, p);
  g.fillStyle = C.river; g.fillRect(u0, 0, p.u - u0, h);
  const s = Math.min(w / (b.x1 - b.x0), h / (b.z1 - b.z0));
  /* ô mặt đường: đường thường vẽ trước, cầu rồi hầm đè lên; nét tối thiểu roadMin px */
  for (const kind of ['road', 'junction', 'slip', 'bridge', 'tunnel'] as const) {
    g.fillStyle = kind === 'bridge' ? C.bridge : kind === 'tunnel' ? C.tunnel : C.road;
    for (const q of n.pads) {
      if (q.kind !== kind) continue;
      drMapProject(b, w, h, q.x0, q.z0, p);
      let uu = p.u, vv = p.v, ww = (q.x1 - q.x0) * s, hh = (q.z1 - q.z0) * s;
      if (ww < H.roadMin) { uu -= (H.roadMin - ww) / 2; ww = H.roadMin; }
      if (hh < H.roadMin) { vv -= (H.roadMin - hh) / 2; hh = H.roadMin; }
      g.fillRect(uu, vv, ww, hh);
    }
  }
  /* năm công trình: chấm ở giữa dòng sông (x = 0) tại z của từng công trình; Hầm cùng màu ô hầm (phương án đề xuất, ghi ở chú thích) */
  const marks: [number, string][] = [[CONFIG.songHan.z, C.mark], [0, C.mark], [CONFIG.tranThiLy.z, C.mark], [CONFIG.thuanPhuoc.z, C.mark], [CONFIG.hanTunnel.z, C.tunnel]];
  for (const [z, col] of marks) {
    drMapProject(b, w, h, 0, z, p);
    g.beginPath(); g.arc(p.u, p.v, 2.5, 0, Math.PI * 2); g.fillStyle = col; g.fill();
    g.lineWidth = 1; g.strokeStyle = C.edge; g.stroke();
  }
  g.strokeStyle = C.edge; g.lineWidth = 1; g.strokeRect(0.5, 0.5, w - 1, h - 1);
  return c;
}

function drPlaceDot(x: number, z: number, r: number, col: string): void {
  drMapProject(bounds!, mw, mh, x, z, _p);
  ctx!.beginPath(); ctx!.arc(_p.u, _p.v, r, 0, Math.PI * 2); ctx!.fillStyle = col; ctx!.fill();
}

/* Hiện HUD, dựng bản đồ nền theo mạng đường và cỡ màn hình (điện thoại nhỏ hơn); hẹn giờ ẩn gợi ý phím */
export function drHudShow(n: DrNet): void {
  if (!el) {
    const d = (id: string) => document.getElementById(id);
    el = { root: d('drHud'), kmh: d('drKmh'), map: d('drMap') as HTMLCanvasElement | null, hint: d('drHint') };
  }
  net = n;
  if (!bounds || bgNet !== n) { const b = drBounds(n); bounds = { x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1 }; }
  const touch = typeof window.matchMedia === 'function' && window.matchMedia('(hover: none)').matches;
  const edge = touch ? H.mapTouch : H.mapDesk, bw = bounds.x1 - bounds.x0, bh = bounds.z1 - bounds.z0;
  const nw = Math.max(1, Math.round(edge * Math.min(1, bw / bh))), nh = Math.max(1, Math.round(edge * Math.min(1, bh / bw)));
  if (el.map) {
    if (nw !== mw || nh !== mh || bgNet !== n) { mw = nw; mh = nh; el.map.width = mw; el.map.height = mh; if (el.root) el.root.style.setProperty('--dr-map-h', mh + 'px'); bg = drMapBackdrop(n, bounds, mw, mh); bgNet = n; }
    ctx = el.map.getContext('2d');
  }
  lastKmh = -1; lastMap = -1e9;
  if (el.hint) el.hint.classList.remove('off');
  window.clearTimeout(hintTimer);
  hintTimer = window.setTimeout(() => { if (el && el.hint) el.hint.classList.add('off'); }, H.hintMs);
}

export function drHudHide(): void {
  window.clearTimeout(hintTimer);
  net = null; ctx = null;
}

/* Mỗi khung: số km/h (ghi DOM khi đổi), bản đồ nhỏ (tối đa mapMs một lần); others: xe người khác (Task 11) */
export function drHudUpdate(s: DrState, others: DrMapDot[]): void {
  if (!el || !net) return;
  const k = drKmh(s.v);
  if (k !== lastKmh) { lastKmh = k; if (el.kmh) el.kmh.textContent = String(k); }
  const now = performance.now();
  if (!ctx || !bg || !bounds || now - lastMap < H.mapMs) return;
  lastMap = now;
  ctx.drawImage(bg, 0, 0);
  for (let i = 0; i < others.length; i++) drPlaceDot(others[i].x, others[i].z, H.otherR, others[i].color);
  /* xe của mình: mũi tên hướng xe (tiến = (cos yaw, −sin yaw) trên (x, z), cũng là hướng (u, v) vì bản đồ không xoay) */
  drMapProject(bounds, mw, mh, s.x, s.z, _p);
  const fx = Math.cos(s.yaw), fz = -Math.sin(s.yaw), R = H.meR;
  ctx.beginPath();
  ctx.moveTo(_p.u + fx * R * 1.5, _p.v + fz * R * 1.5);
  ctx.lineTo(_p.u - fx * R + fz * R * 0.9, _p.v - fz * R - fx * R * 0.9);
  ctx.lineTo(_p.u - fx * R - fz * R * 0.9, _p.v - fz * R + fx * R * 0.9);
  ctx.closePath(); ctx.fillStyle = H.colors.me; ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.stroke();
}
