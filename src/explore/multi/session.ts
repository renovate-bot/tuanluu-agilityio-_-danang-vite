/* ===== Dù lượn nhiều người: máy trạng thái phiên (không DOM, không three) ===== */
import type { Flyer, ServerMsg } from './protocol';
import type { Transport } from './client';
import { multiParams } from './params';

export type Phase = 'connecting' | 'lobby' | 'flying' | 'watching' | 'solo';
export type Notice = '' | 'offline' | 'lost' | 'late' | 'nameBad' | 'released';

export class MultiSession {
  phase: Phase = 'connecting';
  flyers: Flyer[] = [];
  mySlot = -1;
  watched = -1;       // slot đang xem, -1 = không ai
  invite = false;     // đang xem và còn chỗ trống
  notice: Notice = '';
  name = '';
  onChange: () => void = () => {};
  onPos: (f: number[][]) => void = () => {};
  private t: Transport | null = null;
  private disposed = false;
  private first = true; // chưa nhận lobby nào

  constructor(private connect: () => Promise<Transport>, private pick: (n: number) => number = n => Math.floor(Math.random() * n)) {}

  open(): void {
    this.connect().then(t => {
      if (this.disposed) { t.close(); return; }
      this.t = t;
      t.onMessage = m => this.recv(m);
      t.onClose = () => this.lost();
    }, () => {
      if (this.disposed) return;
      this.phase = 'solo'; this.notice = 'offline'; this.onChange();
    });
  }

  join(name: string): void {
    this.name = name; this.notice = '';
    this.t?.send({ t: 'join', name });
  }

  // Rời chỗ bay (do rời máy): trả slot, chuyển sang xem, báo 'released' như khi máy chủ thu hồi chỗ
  leave(): void {
    if (this.phase !== 'flying') return;
    this.t?.send({ t: 'leave' });
    this.notice = 'released'; this.toWatching();
    this.onChange();
  }

  // ts: giờ gửi (ms, đồng hồ của khách này) để người xem đặt mẫu theo trục giờ người gửi
  sendPos(x: number, y: number, z: number, yaw: number, bank: number, ts: number): void {
    if (this.phase === 'flying') this.t?.send({ t: 'pos', x, y, z, yaw, bank, ts });
  }

  heartbeat(): void {
    if (this.phase === 'flying') this.t?.send({ t: 'hb' });
  }

  dispose(): void {
    this.disposed = true;
    this.t?.close(); this.t = null;
  }

  private toWatching(): void {
    this.phase = 'watching'; this.mySlot = -1;
    this.flyers = this.flyers.filter(f => f.slot !== this.mySlotWas);
    this.fixWatched();
  }
  private mySlotWas = -1;

  // Giữ watched nếu người đó còn; không thì chọn ngẫu nhiên người khác
  private fixWatched(): void {
    const ids = this.flyers.map(f => f.slot);
    if (this.phase === 'watching') {
      if (!ids.includes(this.watched)) this.watched = ids.length ? ids[this.pick(ids.length)] : -1;
      this.invite = ids.length < multiParams.slots;
    } else { this.watched = -1; this.invite = false; }
  }

  private lost(): void {
    if (this.disposed) return;
    this.phase = 'solo'; this.notice = 'lost';
    this.flyers = []; this.mySlot = -1; this.watched = -1; this.invite = false;
    this.t = null; this.onChange();
  }

  private recv(m: ServerMsg): void {
    if (this.disposed) return;
    switch (m.t) {
      case 'lobby':
        this.flyers = m.flyers;
        if (this.first) {
          this.first = false;
          if (m.flyers.length >= multiParams.slots) this.phase = 'watching';
          else this.phase = 'lobby';
        }
        // đang bay: danh sách chỉ để hiển thị
        this.fixWatched();
        break;
      case 'joined':
        this.phase = 'flying'; this.mySlot = m.slot; this.mySlotWas = m.slot; this.notice = '';
        this.fixWatched();
        break;
      case 'rejected':
        if (m.why === 'name') this.notice = 'nameBad';
        else {
          if (this.phase === 'watching') this.notice = 'late';
          else { this.phase = 'watching'; }
          this.fixWatched();
        }
        break;
      case 'pos':
        this.onPos(m.f);
        return;
      case 'released':
        if (this.phase === 'flying') { this.notice = 'released'; this.toWatching(); }
        break;
    }
    this.onChange();
  }
}
