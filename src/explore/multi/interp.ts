/* ===== Dù lượn nhiều người: nội suy vị trí dù người khác (thuần, không import) =====
   Vòng đệm cố định 8 mẫu (t, x, y, z, yaw, bank), nội suy tuyến tính, yaw đi đường ngắn qua ±π, kẹp ở mẫu cuối. Không cấp phát khi push/sample (D-018). */
const N = 8, W = 6;   // số mẫu tối đa; số trường mỗi mẫu
export interface ExPose { x: number; y: number; z: number; yaw: number; bank: number }

export class ExTrack {
  private buf = new Float64Array(N * W);
  private head = 0;      // chỉ số ô sẽ ghi tiếp
  private n = 0;         // số mẫu đang có
  get count(): number { return this.n; }

  push(t: number, x: number, y: number, z: number, yaw: number, bank: number): void {
    if (this.n > 0 && t <= this.buf[((this.head + N - 1) % N) * W]) return;   // mẫu cũ hoặc trùng giờ: bỏ để giữ thứ tự
    const o = this.head * W, b = this.buf;
    b[o] = t; b[o + 1] = x; b[o + 2] = y; b[o + 3] = z; b[o + 4] = yaw; b[o + 5] = bank;
    this.head = (this.head + 1) % N;
    if (this.n < N) this.n++;
  }

  /* Ghi vị trí tại thời điểm t vào out; false nếu chưa có mẫu */
  sample(t: number, out: ExPose): boolean {
    if (this.n === 0) return false;
    const b = this.buf, first = (this.head + N - this.n) % N * W;
    const last = ((this.head + N - 1) % N) * W;
    let a = first, c = first;
    if (t >= b[last]) a = c = last;
    else if (t > b[first]) {
      for (let i = 0; i < this.n - 1; i++) {
        const p = (first + i * W) % (N * W), q = (p + W) % (N * W);
        if (t <= b[q]) { a = p; c = q; break; }
      }
    }
    const k = a === c ? 0 : (t - b[a]) / (b[c] - b[a]);
    out.x = b[a + 1] + (b[c + 1] - b[a + 1]) * k;
    out.y = b[a + 2] + (b[c + 2] - b[a + 2]) * k;
    out.z = b[a + 3] + (b[c + 3] - b[a + 3]) * k;
    let dy = b[c + 4] - b[a + 4];
    dy -= Math.round(dy / (2 * Math.PI)) * 2 * Math.PI;
    out.yaw = b[a + 4] + dy * k;
    out.bank = b[a + 5] + (b[c + 5] - b[a + 5]) * k;
    return true;
  }

  reset(): void { this.n = 0; this.head = 0; }
}
