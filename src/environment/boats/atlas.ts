import * as THREE from 'three';
import { CONFIG } from '../../config';
import { ATLAS_ROWS } from './hulls';

/* =====================================================================
   ATLAS BIỂN TÊN TÀU — vẽ bằng canvas (không ảnh ngoài). Mỗi tên một hàng; hàng cuối trắng (mọi bộ phận khác lấy uv ở đây).
   Hàng r chiếm v ∈ [r/ROWS, (r+1)/ROWS] (flipY mặc định ⇒ hàng 0 nằm ở đáy canvas).
   Tên hư cấu (CONFIG.boats.names), không dùng tên hãng thật.
   ===================================================================== */
const W = 512, H = 64;
export function btNameAtlas(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = W; c.height = H * ATLAS_ROWS;
  const g = c.getContext('2d')!;
  const names = CONFIG.boats.names;
  for (let r = 0; r < ATLAS_ROWS; r++) {
    const y = c.height - (r + 1) * H;
    if (r === ATLAS_ROWS - 1) { g.fillStyle = '#ffffff'; g.fillRect(0, y, W, H); continue; }   // hàng trắng
    g.fillStyle = '#16233f'; g.fillRect(0, y, W, H);
    g.strokeStyle = '#e8c24a'; g.lineWidth = 4; g.strokeRect(4, y + 4, W - 8, H - 8);
    g.fillStyle = '#ffffff'; g.font = 'bold 40px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(names[r], W / 2, y + H / 2 + 2, W - 30);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
