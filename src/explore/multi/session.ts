/* ===== Dù lượn, đi dạo và lái xe nhiều người: máy trạng thái phiên (không DOM, không three) =====
   Một phiên thuộc một loại (kind): 'fly' giành chỗ bay, 'walk' giành chỗ đi dạo, 'drive' giành chỗ lái xe. Ba nhóm 5 slot riêng; peers là nhóm cùng loại với mình
   (dùng cho đầy chỗ, chọn người xem, lời mời). Phase 'flying' nghĩa là "đang giữ chỗ" cho mọi loại (đi dạo, lái xe cũng vậy). */
import type { Flyer, Kind, ServerMsg } from './protocol';
import type { Transport } from './client';
import { multiParams } from './params';

export type Phase = 'connecting' | 'lobby' | 'flying' | 'watching' | 'solo';
export type Notice = '' | 'offline' | 'lost' | 'late' | 'nameBad' | 'released';

export class MultiSession {
  phase: Phase = 'connecting';
  flyers: Flyer[] = [];
  walkers: Flyer[] = [];   // người đi dạo (lobby.walkers); máy chủ cũ không gửi
  drivers: Flyer[] = [];   // người lái xe (lobby.drivers); máy chủ cũ không gửi
  mySlot = -1;
  watched = -1;       // slot đang xem (trong nhóm cùng loại), -1 = không ai
  invite = false;     // đang xem và còn chỗ trống
  notice: Notice = '';
  name = '';
  onChange: () => void = () => {};
  onPos: (f: number[][]) => void = () => {};
  onWalkPos: (w: number[][]) => void = () => {};
  peersDrive: (d: number[][]) => void = () => {};   // nhóm d của gói pos (mẫu onWalkPos): mỗi phần tử [slot, x, y, z, yaw, v, st, giờ gửi]
  private t: Transport | null = null;
  private disposed = false;
  private first = true; // chưa nhận lobby nào

  constructor(private connect: () => Promise<Transport>, private pick: (n: number) => number = n => Math.floor(Math.random() * n), readonly kind: Kind = 'fly') {}

  /* Danh sách cùng loại với mình */
  get peers(): Flyer[] { return this.kind === 'walk' ? this.walkers : this.kind === 'drive' ? this.drivers : this.flyers; }

  /* Số chỗ của nhóm cùng loại */
  private get cap(): number { return this.kind === 'walk' ? multiParams.stroll.slots : this.kind === 'drive' ? multiParams.drive.slots : multiParams.slots; }

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

  /* Người lái chỉ xin chỗ sau khi lobby đầu đã có drivers: máy chủ cũ (main trước D-034) coi join kind 'drive' là join bay và cho chiếm một chỗ bay */
  join(name: string): void {
    this.name = name; this.notice = '';
    if (this.kind === 'drive' && this.first) return;
    this.t?.send(this.kind === 'fly' ? { t: 'join', name } : { t: 'join', name, kind: this.kind });
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

  // Người lái: v tốc độ có dấu (m/s), st góc lái (rad) thay cho bank / pose; ts giờ gửi (ms, đồng hồ khách này), không truyền thì lấy performance.now()
  sendDrive(p: { x: number; y: number; z: number; yaw: number; v: number; st: number; ts?: number }): void {
    if (this.phase !== 'flying') return;
    const ts = typeof p.ts === 'number' ? p.ts : Math.round(performance.now());
    this.t?.send({ t: 'pos', x: p.x, y: p.y, z: p.z, yaw: p.yaw, v: p.v, st: p.st, ts });
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
    else if (this.kind === 'drive') this.drivers = this.drivers.filter(f => f.slot !== this.mySlotWas);
    else this.flyers = this.flyers.filter(f => f.slot !== this.mySlotWas);
    this.fixWatched();
  }
  private mySlotWas = -1;

  // Giữ watched nếu người đó còn; không thì chọn ngẫu nhiên người khác (cùng loại)
  private fixWatched(): void {
    const ids = this.peers.map(f => f.slot);
    if (this.phase === 'watching') {
      if (!ids.includes(this.watched)) this.watched = ids.length ? ids[this.pick(ids.length)] : -1;
      this.invite = ids.length < this.cap;
    } else { this.watched = -1; this.invite = false; }
  }

  private lost(): void {
    if (this.disposed) return;
    this.phase = 'solo'; this.notice = 'lost';
    this.flyers = []; this.walkers = []; this.drivers = []; this.mySlot = -1; this.watched = -1; this.invite = false;
    this.t = null; this.onChange();
  }

  /* Máy chủ cũ (lobby đầu không có walkers / drivers) không biết chỗ đi dạo / lái xe: đóng kết nối, đi / lái một mình như khi không kết nối được */
  private offline(): void {
    const t = this.t;
    this.t = null;
    if (t) { t.onClose = () => {}; t.onMessage = () => {}; t.close(); }
    this.phase = 'solo'; this.notice = 'offline';
    this.flyers = []; this.walkers = []; this.drivers = [];
    this.onChange();
  }

  private recv(m: ServerMsg): void {
    if (this.disposed) return;
    switch (m.t) {
      case 'lobby':
        if (this.first && this.kind === 'walk' && !Array.isArray(m.walkers)) { this.first = false; this.offline(); return; }
        if (this.first && this.kind === 'drive' && !Array.isArray(m.drivers)) { this.first = false; this.offline(); return; }
        this.flyers = m.flyers;
        this.walkers = Array.isArray(m.walkers) ? m.walkers : [];
        this.drivers = Array.isArray(m.drivers) ? m.drivers : [];
        if (this.first) {
          this.first = false;
          if (this.peers.length >= this.cap) this.phase = 'watching';
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
        if (Array.isArray(m.d)) this.peersDrive(m.d);
        return;
      case 'released':
        if (this.phase === 'flying') { this.notice = 'released'; this.toWatching(); }
        break;
    }
    this.onChange();
  }
}
