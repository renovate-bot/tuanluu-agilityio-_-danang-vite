import * as THREE from 'three';
import { rng } from '../math';

/* =====================================================================
   TEXTURE CÂY — vẽ bằng canvas (không ảnh ngoài), chỉ gọi trong trình duyệt.
   Ý lấy từ leafTex / frondTex của bản thử docs/superpowers/specs/tham-chieu/cay-va-nguoi/cay-va-nguoi-dung-thu.html.
   Không import file này trong unit test hay trong shapes.ts (cần document).
   ===================================================================== */

/* Vân lá cho tán cây bóng mát: nền xanh nhạt, rải đốm lá hình bầu dục nhiều sắc; lặp 3 × 2 trên uv khối cầu */
export function trLeafTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d')!, r = rng(11);
  g.fillStyle = '#c9dcae'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const l = 55 + r() * 40, x = r() * 256, y = r() * 256;
    g.fillStyle = `hsl(${88 + r() * 26}, ${35 + r() * 30}%, ${l}%)`;
    g.beginPath(); g.ellipse(x, y, 3 + r() * 5, 2 + r() * 3, r() * 3.14, 0, 6.3); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* Tàu lá dừa: nền trong suốt (vật liệu dùng alphaTest), sống lá giữa + lá chét răng lược hai bên.
   Nét 5,2 px trên bước 8,5 px để còn thấy khi mipmap. u ngang tàu, v dọc tàu (tàu chỉ dùng v ≥ 0,1).
   Dải đặc trắng v ∈ [0, 0,09] suốt bề ngang (đáy canvas vì flipY; tàu lá chỉ dùng v ≥ 0,1) cho búi ngọn và quả (uv 0,015): màu lấy hết từ color đỉnh.
   Dải rộng cả bề ngang + kẹp mép (ClampToEdge mặc định) để các mức mipmap xa vẫn đặc, búi ngọn không bị alphaTest cắt mất. */
export function trFrondTexture(): THREE.CanvasTexture {
  const W = 128, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d')!, r = rng(5);
  g.clearRect(0, 0, W, H); g.lineCap = 'round';
  for (let y = H + 10; y > 12; y -= 8.5) for (const s of [-1, 1]) {
    g.strokeStyle = `hsl(${92 + r() * 16}, ${45 + r() * 20}%, ${72 + r() * 22}%)`; g.lineWidth = 5.2;
    g.beginPath(); g.moveTo(W / 2, y); g.lineTo(W / 2 + s * (56 + r() * 6), y - 20 - r() * 6); g.stroke();
  }
  g.strokeStyle = '#e8efc0'; g.lineWidth = 5; g.beginPath(); g.moveTo(W / 2, H); g.lineTo(W / 2, 0); g.stroke();
  const sqH = Math.floor(0.09 * H);
  g.fillStyle = '#ffffff'; g.fillRect(0, H - sqH, W, sqH);   // dải đặc: u ∈ [0, 1], v ∈ [0, 0,09]
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
