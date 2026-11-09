/* ===== Dù lượn nhiều người: nội suy vị trí dù người khác (thuần, không import) =====
   Vòng đệm cố định 8 mẫu (t, x, y, z, yaw, bank), nội suy tuyến tính, yaw đi đường ngắn qua ±π, kẹp ở mẫu cuối. Không cấp phát khi push/sample (D-018).
   Mẫu đặt theo giờ của người gửi (e[6]) quy ra giờ khách, nên trễ mạng và việc máy chủ gộp gói không làm dù đứng rồi vọt. */
const N = 8, W = 6;   // số mẫu tối đa; số trường mỗi mẫu
export interface ExPose { x: number; y: number; z: number; yaw: number; bank: number }
export interface ExClockParams { clockRelax: number; clockSlewMs: number; clockWarmup: number }   // xem multiParams

export class ExTrack {
  private buf = new Float64Array(N * W);
  private head = 0;      // chỉ số ô sẽ ghi tiếp
  private n = 0;         // số mẫu đang có
  private off = NaN;     // độ lệch giờ người gửi → giờ khách (ms); NaN = chưa có mẫu nào có giờ
  private fed = 0;       // số mẫu có giờ đã nhận: clockWarmup mẫu đầu lấy thẳng mức nhỏ nhất (gói đầu có thể trễ vì khung hình chậm), sau đó mới giới hạn slew
  get count(): number { return this.n; }

  push(t: number, x: number, y: number, z: number, yaw: number, bank: number): void {
    if (this.n > 0 && t <= this.buf[((this.head + N - 1) % N) * W]) return;   // mẫu cũ hoặc trùng giờ: bỏ để giữ thứ tự
    const o = this.head * W, b = this.buf;
    b[o] = t; b[o + 1] = x; b[o + 2] = y; b[o + 3] = z; b[o + 4] = yaw; b[o + 5] = bank;
    this.head = (this.head + 1) % N;
    if (this.n < N) this.n++;
  }

  /* Một mục của gói pos e = [slot, x, y, z, yaw, bank, giờ gửi?] nhận lúc nowMs.
     Có giờ gửi (máy chủ mới): giờ khách = giờ gửi + độ lệch; độ lệch bám mức nhỏ nhất (gói ít trễ nhất) nhưng sau clockWarmup mẫu đầu mỗi mẫu chỉ giảm tối đa clockSlewMs,
     và nới lên clockRelax phần chênh khi mạng chậm đi: độ lệch đổi chậm nên dù không bị co giãn thời gian.
     Không có (máy chủ cũ phát lại vị trí cũ của mọi slot mỗi gói): đóng dấu giờ nhận, bỏ mục trùng mẫu cuối để dù không đứng chờ */
  feed(e: number[], nowMs: number, k: ExClockParams): void {
    const ts = e[6];
    if (typeof ts === 'number' && Number.isFinite(ts)) {
      const c = nowMs - ts;
      if (this.off !== this.off || (c < this.off && this.fed < k.clockWarmup)) this.off = c;
      else if (c < this.off) this.off -= Math.min(this.off - c, k.clockSlewMs);
      else this.off += (c - this.off) * k.clockRelax;
      this.fed++;
      this.push(ts + this.off, e[1], e[2], e[3], e[4], e[5]);
      return;
    }
    if (this.n > 0) {
      const o = ((this.head + N - 1) % N) * W, b = this.buf;
      if (b[o + 1] === e[1] && b[o + 2] === e[2] && b[o + 3] === e[3] && b[o + 4] === e[4] && b[o + 5] === e[5]) return;
    }
    this.push(nowMs, e[1], e[2], e[3], e[4], e[5]);
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

  reset(): void { this.n = 0; this.head = 0; this.off = NaN; this.fed = 0; }
}
