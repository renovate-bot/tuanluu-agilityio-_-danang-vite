/* ============================ Đi dạo: cần gạt ảo (thuần) ============================
   Độ lệch núm so với tâm (px, phải +, xuống +) → hướng đi (mz: lên màn hình là tới, mx: phải) độ dài 1 và cờ chạy.
   Gạt nhẹ (k < run) là đi, gạt hết cỡ (k ≥ run) là chạy; k < dead là vùng chết. Không cấp phát (gọi mỗi khung). */
import { CONFIG } from '../../config';

export function stStick(dx: number, dy: number, radius: number, out: { mx: number; mz: number; run: boolean }): void {
  const S = CONFIG.stroll.stick;
  const h = Math.sqrt(dx * dx + dy * dy);
  const k = radius > 0 ? Math.min(1, h / radius) : 0;
  if (k < S.dead || h < 1e-9) { out.mx = 0; out.mz = 0; out.run = false; return; }
  out.mx = dx / h; out.mz = -dy / h; out.run = k >= S.run;
}
