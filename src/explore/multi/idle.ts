/* ===== Dù lượn nhiều người: đếm thời gian rời máy (không DOM, không timer; người gọi đưa mốc thời gian vào) =====
   Không chạm phím idleMs thì 'warn' (hỏi "Bạn còn đó không?"), thêm idleWarnMs nữa thì 'expired' (trả slot). */
export type IdleState = 'ok' | 'warn' | 'expired';

export class ExIdle {
  private last = 0;   // ms — mốc phím cuối (hoặc mốc reset)
  constructor(private idleMs: number, private warnMs: number) {}

  activity(now: number): void { this.last = now; }
  reset(now: number): void { this.last = now; }

  tick(now: number): IdleState {
    const d = now - this.last;
    return d < this.idleMs ? 'ok' : d < this.idleMs + this.warnMs ? 'warn' : 'expired';
  }

  /* Số giây còn lại tới lúc hết hạn, làm tròn lên (không âm) */
  remaining(now: number): number {
    return Math.max(0, Math.ceil((this.idleMs + this.warnMs - (now - this.last)) / 1000));
  }
}
