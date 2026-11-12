/* ============================ Lái xe: đầu vào từ bàn phím (thuần) ============================
   Tập phím theo vị trí vật lý (e.code: KeyW, ArrowUp, Space...) nên bố cục không Latin (ru, ar, th, hi) vẫn dùng WASD.
   W/↑ ga, S/↓ phanh, A/← lái trái (steer +1), D/→ lái phải (steer −1), hai phím trái phải triệt nhau; Space phanh tay.
   Chỉ ánh xạ: lùi (giữ phanh khi xe đã đứng) do drStep (motion.ts) xử lý. Không cấp phát (gọi mỗi khung). */
import type { DrInput } from './motion';

/* Các e.code chế độ lái ghi vào tập phím (index.ts chặn hành vi mặc định của mũi tên và Space) */
export const DR_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);

export function drInputFromKeys(keys: Set<string>, out: DrInput): DrInput {
  out.gas = keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0;
  out.brake = keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0;
  out.steer = (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) - (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0);
  out.hand = keys.has('Space');
  return out;
}

/* Mất tiêu điểm (blur cửa sổ) hoặc ẩn tab thì nhả hết phím (Review Focus 2): keyup không tới nữa, không nhả thì xe giữ ga mãi.
   Gắn bộ nghe vào win / doc, trả hàm nhả phím (index.ts gọi thêm khi focus vào ô nhập) */
export function drBindDrop(win: EventTarget, doc: EventTarget & { hidden: boolean }, keys: Set<string>): () => void {
  const drop = (): void => { keys.clear(); };
  win.addEventListener('blur', drop);
  doc.addEventListener('visibilitychange', () => { if (doc.hidden) drop(); });
  return drop;
}
