import { CONFIG } from '../../config';
import type { WeatherParams } from './state';

/* ===== [weather] Ảnh hưởng của thời tiết lên cầu: gió theo cao độ, cấp Beaufort, giãn nở, võng cáp =====
   Module THUẦN: số lấy từ CONFIG, không ghi cứng. Kết quả là "tính gần đúng" (xem docs/superpowers/specs/2026-10-21-thoi-tiet-design.md mục 3). */
export type BridgeKey = 'dragon' | 'thuanPhuoc' | 'tranThiLy' | 'songHan' | 'hanTunnel';
export type BridgeStatus = 'open' | 'limited' | 'closed';
export interface BridgeImpact {
  key: BridgeKey; windDeck: number; windTop: number;   // m/s tại mặt cầu và đỉnh tháp (0 nếu không có tháp)
  level: number;                                       // cấp Beaufort ở mặt cầu
  status: BridgeStatus; effects: string[];             // trạng thái theo thông báo của thành phố; khoá hiệu ứng
  expand: number;                                      // m — giãn nở nhiệt toàn cầu so với nhiệt độ chuẩn
  sag: number;                                         // m — cáp chủ võng thêm (chỉ Thuận Phước)
}

/* Vận tốc gió ở cao độ z (m) từ v10: v(z) = v10 · (z / 10)^α. */
export const windAt = (z: number, v10: number) => v10 * Math.pow(Math.max(z, 1) / CONFIG.weather.windRefH, CONFIG.weather.windAlpha);

/* Cấp Beaufort 0–16 (đếm ngưỡng dưới đã vượt). */
export const beaufort = (v: number) => CONFIG.weather.beaufort.filter(b => v >= b).length;

/* Giãn nở dọc: ΔL = L · α · ΔT. */
export const expansion = (length: number, coef: number, temp: number) => length * coef * (temp - CONFIG.weather.thermal.refTemp);

/* Cáp chủ võng thêm khi nóng, gần đúng parabol: S ≈ L(1 + 8/3 (f/L)²), Δf ≈ 3·L·ΔS / (16·f). */
export function cableSag(temp: number) {
  const { span: L, sagRatio } = CONFIG.weather.cableSag, f = L / sagRatio, S = L * (1 + 8 / 3 * Math.pow(f / L, 2));
  const dS = S * CONFIG.weather.thermal.steel * (temp - CONFIG.weather.thermal.refTemp);
  return 3 * L * dS / (16 * f);
}

/* Cao độ mặt cầu / đỉnh tháp lấy từ CONFIG của từng cầu. */
function heights(): { key: BridgeKey; deck: number; top: number; length: number; coef: number }[] {
  const TP = CONFIG.thuanPhuoc, TTL = CONFIG.tranThiLy, SH = CONFIG.songHan, W = CONFIG.weather.thermal;
  return [
    { key: 'dragon', deck: CONFIG.deckMidY, top: 0, length: CONFIG.length, coef: W.steel },
    { key: 'thuanPhuoc', deck: TP.roadCenterY, top: TP.towerTop, length: TP.totalLength, coef: W.steel },
    { key: 'tranThiLy', deck: Math.max(...TTL.roadProfile.map(p => p[1])), top: TTL.pylonHeight, length: TTL.totalLength, coef: W.concrete },
    { key: 'songHan', deck: SH.deckY, top: 0, length: SH.totalLength, coef: W.steel },
    { key: 'hanTunnel', deck: 0, top: 0, length: 0, coef: 0 }   // hầm ngầm: không chịu gió, không giãn nở theo khí hậu
  ];
}

/* Bảng ảnh hưởng cho từng công trình theo thời tiết hiện tại. */
export function bridgeImpacts(w: WeatherParams): BridgeImpact[] {
  return heights().map(h => {
    const windDeck = windAt(h.deck, w.wind), windTop = h.top ? windAt(h.top, w.wind) : 0, effects: string[] = [];
    if (h.key === 'hanTunnel') return { key: h.key, windDeck: 0, windTop: 0, level: 0, status: 'open' as BridgeStatus, effects, expand: 0, sag: 0 };
    const expand = expansion(h.length, h.coef, w.temp), sag = h.key === 'thuanPhuoc' ? cableSag(w.temp) : 0;
    if (w.rain > 0 && w.wind > 0 && (h.key === 'thuanPhuoc' || h.key === 'tranThiLy' || h.key === 'songHan')) effects.push('rainWindCable');
    if (w.temp - CONFIG.weather.thermal.refTemp >= 8) effects.push('thermal');
    if (w.closed) effects.push(h.key === 'songHan' ? 'swingLocked' : 'closed');
    return { key: h.key, windDeck, windTop, level: beaufort(windDeck), status: (w.closed ? 'closed' : 'open') as BridgeStatus, effects, expand, sag };
  });
}
