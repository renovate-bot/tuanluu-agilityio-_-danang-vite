/* ============================ Tự khám phá: hiệu ứng ban đêm khi bay dù ============================
   Đang bay dù và trời đêm: Cầu Rồng tự phun lửa/nước, Cầu sông Hàn tự xoay lặp lại (D-022). Thông số ở CONFIG.explore.nightShows, đọc mỗi bước.
   Không cần trả lại show.on khi rời dù: thoát dù là tải lại trang (D-020). */
import { CONFIG } from '../config';
import { dayNight } from '../core/dayNight';
import { show } from '../bridges/dragon/effects';
import type { SwingController } from '../bridges/song-han/SwingController';

/* enabled: tắt khi có ?test để các phép đo đêm không dao động; rest: số giây nghỉ còn lại trước lượt quay tiếp */
export const exNight = { enabled: true, rest: 0, show };

let ctrl: SwingController | null = null;
export function exNightBind(c: SwingController): void { ctrl = c; }

/* Gọi mỗi bước bay / đi dạo; swing = false (đi dạo): chỉ phun lửa / nước, không tự quay và không tăng tốc Cầu sông Hàn (spec đi dạo §3 mục 13) */
export function exNightStep(dt: number, swing = true): void {
  if (!exNight.enabled || !ctrl) return;
  const C = CONFIG.explore.nightShows, night = dayNight.target > 0.5;
  if (show.on !== night) { show.on = night; show.t = 0; }   // đổi trời: bắt đầu lại từ lần phun đầu
  if (!swing) return;
  if (ctrl.state !== 'CLOSED') {                            // đang quay (cả khi đã sang ngày): đi nốt tới khi đóng
    ctrl.speed = C.swingSpeed;
    if (ctrl.state === 'OPEN') ctrl.requestClose();
    exNight.rest = C.swingRest;
    return;
  }
  if (!night) return;
  exNight.rest = Math.max(0, exNight.rest - dt);
  if (exNight.rest === 0 && ctrl.canStart()) ctrl.start(C.swingSpeed);   // hỏi canStart trước để bão không phát swingBlocked mỗi khung
}
