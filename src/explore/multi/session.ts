/* ===== Dù lượn và đi dạo nhiều người: máy trạng thái phiên (không DOM, không three) =====
   Một phiên thuộc một loại (kind): 'fly' giành chỗ bay, 'walk' giành chỗ đi dạo. Hai nhóm 5 slot riêng; peers là nhóm cùng loại với mình
   (dùng cho đầy chỗ, chọn người xem, lời mời). Phase 'flying' nghĩa là "đang giữ chỗ" cho cả hai loại (đi dạo cũng vậy). */
import type { Flyer, Kind, ServerMsg } from './protocol';
import type { Transport } from './client';
import { multiParams } from './params';

export type Phase = 'connecting' | 'lobby' | 'flying' | 'watching' | 'solo';
export type Notice = '' | 'offline' | 'lost' | 'late' | 'nameBad' | 'released';

export class MultiSession {
  phase: Phase = 'connecting';
  flyers: Flyer[] = [];
  walkers: Flyer[] = [];   // người đi dạo (lobby.walkers); máy chủ cũ không gửi
  mySlot = -1;
  watched = -1;       // slot đang xem (trong nhóm cùng loại), -1 = không ai
  invite = false;     // đang xem và còn chỗ trống
  notice: Notice = '';
  name = '';
  onChange: () => void = () => {};
  onPos: (f: number[][]) => void = () => {};
  onWalkPos: (w: number[][]) => void = () => {};
  private t: Transport | null = null;
  private disposed = false;
  private first = true; // chưa nhận lobby nào

  constructor(private connect: () => Promise<Transport>, private pick: (n: number) => number = n => Math.floor(Math.random() * n), readonly kind: Kind = 'fly') {}

  /* Danh sách cùng loại với mình */
  get peers(): Flyer[] { return this.kind === 'walk' ? this.walkers : this.flyers; }

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
    this.t?.send(this.kind === 'walk' ? { t: 'join', name, kind: 'walk' } : { t: 'join', name });
  }

  // Rời chỗ (do rời máy): trả slot, chuyển sang xem, báo 'released' như khi máy chủ thu hồi chỗ
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

  // Người đi dạo: pose (0 đứng, 1 đi, 2 chạy, 3 rơi (bản cũ: nhảy), 4 chụp ảnh) thay cho bank
  sendWalk(x: number, y: number, z: number, yaw: number, pose: number, ts: number): void {
    if (this.phase === 'flying') this.t?.send({ t: 'pos', x, y, z, yaw, pose, ts });
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
    if (this.kind === 'walk') this.walkers = this.walkers.filter(f => f.slot !== this.mySlotWas);
    else this.flyers = this.flyers.filter(f => f.slot !== this.mySlotWas);
    this.fixWatched();
  }
  private mySlotWas = -1;

  // Giữ watched nếu người đó còn; không thì chọn ngẫu nhiên người khác (cùng loại)
  private fixWatched(): void {
    const ids = this.peers.map(f => f.slot);
    if (this.phase === 'watching') {
      if (!ids.includes(this.watched)) this.watched = ids.length ? ids[this.pick(ids.length)] : -1;
      this.invite = ids.length < (this.kind === 'walk' ? multiParams.stroll.slots : multiParams.slots);
    } else { this.watched = -1; this.invite = false; }
  }

  private lost(): void {
    if (this.disposed) return;
    this.phase = 'solo'; this.notice = 'lost';
    this.flyers = []; this.walkers = []; this.mySlot = -1; this.watched = -1; this.invite = false;
    this.t = null; this.onChange();
  }

  /* Máy chủ cũ (lobby đầu không có walkers) không biết chỗ đi dạo: đóng kết nối, đi một mình như khi không kết nối được */
  private offline(): void {
    const t = this.t;
    this.t = null;
    if (t) { t.onClose = () => {}; t.onMessage = () => {}; t.close(); }
    this.phase = 'solo'; this.notice = 'offline';
    this.flyers = []; this.walkers = [];
    this.onChange();
  }

  private recv(m: ServerMsg): void {
    if (this.disposed) return;
    switch (m.t) {
      case 'lobby':
        if (this.first && this.kind === 'walk' && !Array.isArray(m.walkers)) { this.first = false; this.offline(); return; }
        this.flyers = m.flyers;
        this.walkers = Array.isArray(m.walkers) ? m.walkers : [];
        if (this.first) {
          this.first = false;
          if (this.peers.length >= (this.kind === 'walk' ? multiParams.stroll.slots : multiParams.slots)) this.phase = 'watching';
          else this.phase = 'lobby';
        }
        // đang giữ chỗ: danh sách chỉ để hiển thị
        this.fixWatched();
        break;
      case 'joined':
        this.phase = 'flying'; this.mySlot = m.slot; this.mySlotWas = m.slot; this.notice = '';
        this.fixWatched();
        break;
      case 'rejected':
        if (m.why === 'name') this.notice = 'nameBad';
        else {
          this.notice = 'late';   // giành trước khi đang xem, hoặc ngay ở sảnh (chỗ cuối vừa có người lúc bấm): đều báo lý do
          this.phase = 'watching';
          this.fixWatched();
        }
        break;
      case 'pos':
        this.onPos(m.f);
        if (Array.isArray(m.w)) this.onWalkPos(m.w);
        return;
      case 'released':
        if (this.phase === 'flying') { this.notice = 'released'; this.toWatching(); }
        break;
    }
    this.onChange();
  }
}
