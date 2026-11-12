/* ===== Phòng bầu trời chung: logic thuần, không phụ thuộc Cloudflare (Durable Object bọc ngoài) ===== */
import { multiParams as P } from '../../../src/explore/multi/params';
import { exSanitizeName } from '../../../src/explore/multi/protocol';
import type { ServerMsg, Flyer, Kind } from '../../../src/explore/multi/protocol';
import { exIsBad } from './badwords';

export type Out = { to: string | 'all'; msg: ServerMsg };

// pos: [slot, x, y, z, yaw, bank (người đi dạo: pose), giờ gửi]; người lái: [slot, x, y, z, yaw, v, st, giờ gửi]; giờ gửi = ts của khách (khách mới) hoặc giờ máy chủ nhận (khách cũ); dirty: có vị trí mới chưa phát
interface Slot { id: string; name: string; seen: number; pos: number[] | null; dirty: boolean }
interface Conn { stamps: number[] }

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const wrapPi = (a: number) => a - Math.round(a / (2 * Math.PI)) * 2 * Math.PI;   // góc về [−π, π]

export class SkyRoom {
  private conns = new Map<string, Conn>();
  private slots: (Slot | null)[] = new Array(P.slots).fill(null);
  private walkSlots: (Slot | null)[] = new Array(P.stroll.slots).fill(null);   // nhóm chỗ đi dạo, tách khỏi nhóm bay
  private driveSlots: (Slot | null)[] = new Array(P.drive.slots).fill(null);   // nhóm chỗ lái xe, tách khỏi hai nhóm kia
  private lastBroadcast = -Infinity;

  private lobby(): Out {
    const flyers: Flyer[] = [];
    const walkers: Flyer[] = [];
    const drivers: Flyer[] = [];
    this.slots.forEach((s, i) => { if (s) flyers.push({ slot: i, name: s.name }); });
    this.walkSlots.forEach((s, i) => { if (s) walkers.push({ slot: i, name: s.name }); });
    this.driveSlots.forEach((s, i) => { if (s) drivers.push({ slot: i, name: s.name }); });
    return { to: 'all', msg: { t: 'lobby', flyers, walkers, drivers } };
  }

  connect(id: string, now: number): Out[] | null {
    if (!this.conns.has(id) && this.conns.size >= P.maxConns) return null;
    this.conns.set(id, { stamps: [] });
    return [{ to: id, msg: this.lobby().msg }];
  }

  slotOf(id: string): number { return this.slots.findIndex(s => s !== null && s.id === id); }   // slot bay, -1 nếu không bay

  walkSlotOf(id: string): number { return this.walkSlots.findIndex(s => s !== null && s.id === id); }   // slot đi dạo, -1 nếu không đi dạo

  driveSlotOf(id: string): number { return this.driveSlots.findIndex(s => s !== null && s.id === id); }   // slot lái xe, -1 nếu không lái

  kindOf(id: string): Kind | null { return this.slotOf(id) >= 0 ? 'fly' : this.walkSlotOf(id) >= 0 ? 'walk' : this.driveSlotOf(id) >= 0 ? 'drive' : null; }

  hasFlyers(): boolean { return [this.slots, this.walkSlots, this.driveSlots].some(g => g.some(s => s !== null)); }   // còn ai giữ slot (bay, đi hoặc lái): giữ alarm quét

  private groupOf(kind: Kind | null): (Slot | null)[] { return kind === 'walk' ? this.walkSlots : kind === 'drive' ? this.driveSlots : this.slots; }

  /* Giờ có tin cuối của người giữ slot (để lưu vào attachment); -1 nếu không giữ slot */
  seenOf(id: string): number {
    const i = this.slotOf(id);
    if (i >= 0) return this.slots[i].seen;
    const w = this.walkSlotOf(id);
    if (w >= 0) return this.walkSlots[w].seen;
    const d = this.driveSlotOf(id);
    return d < 0 ? -1 : this.driveSlots[d].seen;
  }

  /* Dựng lại sau hibernation. seen lấy từ attachment nếu có; không có (attachment cũ) thì coi như vừa im lặng gần hết hạn:
     người còn bay có một chu kỳ nhịp sống để lên tiếng, người đã chết không được gia hạn thêm mỗi lần thức dậy */
  restore(list: { id: string; slot: number; name: string; seen?: number; kind?: 'walk' | 'drive' }[], now: number): void {
    for (const e of list) {
      const group = this.groupOf(e.kind === 'walk' || e.kind === 'drive' ? e.kind : 'fly');
      if (e.slot < 0 || e.slot >= group.length) continue;
      if (!this.conns.has(e.id)) this.conns.set(e.id, { stamps: [] });
      const seen = typeof e.seen === 'number' && Number.isFinite(e.seen) ? Math.min(e.seen, now) : now - P.slotTimeoutMs + P.heartbeatMs;
      group[e.slot] = { id: e.id, name: e.name, seen, pos: null, dirty: false };
    }
  }

  message(id: string, raw: string, now: number): Out[] {
    const conn = this.conns.get(id);
    if (!conn || typeof raw !== 'string' || raw.length > P.maxMsgBytes) return [];
    let m: any;
    try { m = JSON.parse(raw); } catch { return []; }
    if (!m || typeof m !== 'object') return [];
    const kind = this.kindOf(id);   // loại theo slot kết nối đang giữ, không theo trường trong gói
    const group = this.groupOf(kind);
    const slot = kind === null ? -1 : group.findIndex(s => s !== null && s.id === id);
    switch (m.t) {
      case 'join': return this.onJoin(id, kind !== null, m.name, m.kind === 'walk' || m.kind === 'drive' ? m.kind : 'fly', now);
      case 'leave': return this.release(id) ? [this.lobby()] : [];
      case 'hb': if (slot < 0) return []; group[slot].seen = now; return this.flush(now);
      case 'pos': return slot >= 0 ? this.onPos(conn, group[slot]!, slot, kind, m, now) : [];
      default: return [];
    }
  }

  // kind 'fly': tin trả lời không có trường kind (khách cũ hiểu được); 'walk' / 'drive' kèm kind
  private onJoin(id: string, holding: boolean, rawName: unknown, kind: Kind, now: number): Out[] {
    if (holding) return [];
    const k = kind === 'fly' ? {} : { kind };
    const name = typeof rawName === 'string' ? exSanitizeName(rawName) : null;
    if (name === null || exIsBad(name)) return [{ to: id, msg: { t: 'rejected', why: 'name', ...k } }];
    const group = this.groupOf(kind);
    const free = group.findIndex(s => s === null);
    if (free < 0) return [{ to: id, msg: { t: 'rejected', why: 'full', ...k } }];
    group[free] = { id, name, seen: now, pos: null, dirty: false };
    return [{ to: id, msg: { t: 'joined', slot: free, ...k } }, this.lobby()];
  }

  private onPos(conn: Conn, s: Slot, slot: number, kind: Kind, m: any, now: number): Out[] {
    const { x, y, z, yaw, ts } = m;
    const walk = kind === 'walk', drive = kind === 'drive';
    const tilt = drive ? m.v : walk ? m.pose : m.bank;   // người lái gửi v + st, người đi dạo gửi pose, người bay gửi bank; trường của loại khác bị bỏ qua
    const st = drive ? m.st : 0;
    for (const v of [x, y, z, yaw, tilt, st]) if (typeof v !== 'number' || !Number.isFinite(v)) return [];
    conn.stamps = conn.stamps.filter(t => now - t < 1000);
    if (conn.stamps.length >= P.posMaxPerSec) return [];
    conn.stamps.push(now);
    s.seen = now;
    const stamp = typeof ts === 'number' && Math.abs(ts) <= Number.MAX_SAFE_INTEGER ? ts : now;   // ts ngoài ±2^53 (kể cả NaN/∞) coi như không gửi, tránh đẩy độ lệch giờ của khách thành ∞
    if (drive) {
      const D = P.drive, B = D.bounds;
      s.pos = [slot, clamp(x, B.x0, B.x1), clamp(y, D.yMin, D.yMax), clamp(z, B.z0, B.z1), wrapPi(yaw), clamp(tilt, -D.vMax, D.vMax), clamp(st, -D.steerMax, D.steerMax), stamp];
    } else if (walk) {
      const B = P.stroll.bounds;
      s.pos = [slot, clamp(x, B.x0, B.x1), clamp(y, P.stroll.yMin, P.stroll.yMax), clamp(z, B.z0, B.z1), wrapPi(yaw), clamp(Math.round(tilt), 0, P.stroll.poseMax), stamp];
    } else {
      s.pos = [slot, clamp(x, P.bounds.x0, P.bounds.x1), clamp(y, P.floor, P.ceiling), clamp(z, P.bounds.z0, P.bounds.z1), wrapPi(yaw), clamp(tilt, -P.bankMax, P.bankMax), stamp];
    }
    s.dirty = true;
    return this.flush(now);
  }

  /* Phát gói gộp các slot có vị trí mới (cách lần trước >= broadcastMs). Vị trí bị hãm trong cửa sổ vẫn dirty nên đi ở lần phát sau (pos hoặc hb của bất kỳ ai).
     Không phát lại vị trí cũ: khách cũ đóng dấu theo giờ nhận nên mẫu lặp làm dù đứng rồi vọt. Khách mới đặt mẫu theo e[6] */
  private flush(now: number): Out[] {
    if (now - this.lastBroadcast < P.broadcastMs) return [];
    const f: number[][] = [], w: number[][] = [], d: number[][] = [];
    for (const t of this.slots) if (t && t.dirty) { f.push(t.pos!); t.dirty = false; }
    for (const t of this.walkSlots) if (t && t.dirty) { w.push(t.pos!); t.dirty = false; }
    for (const t of this.driveSlots) if (t && t.dirty) { d.push(t.pos!); t.dirty = false; }
    if (!f.length && !w.length && !d.length) return [];
    this.lastBroadcast = now;
    // f luôn có (khách cũ đọc m.f); w / d chỉ có khi có người cử động, khách cũ bỏ qua trường lạ
    const msg: { t: 'pos'; f: number[][]; w?: number[][]; d?: number[][] } = { t: 'pos', f };
    if (w.length) msg.w = w;
    if (d.length) msg.d = d;
    return [{ to: 'all', msg }];
  }

  // Trả slot của kết nối; true nếu có slot được trả
  private release(id: string): boolean {
    const i = this.slotOf(id);
    if (i >= 0) { this.slots[i] = null; return true; }
    const w = this.walkSlotOf(id);
    if (w >= 0) { this.walkSlots[w] = null; return true; }
    const d = this.driveSlotOf(id);
    if (d < 0) return false;
    this.driveSlots[d] = null;
    return true;
  }

  disconnect(id: string): Out[] {
    this.conns.delete(id);
    return this.release(id) ? [this.lobby()] : [];
  }

  sweep(now: number): Out[] {
    const out: Out[] = [];
    for (const group of [this.slots, this.walkSlots, this.driveSlots]) group.forEach((s, i) => {
      if (s && now - s.seen > P.slotTimeoutMs) { out.push({ to: s.id, msg: { t: 'released' } }); group[i] = null; }
    });
    if (out.length) out.push(this.lobby());
    return out;
  }
}
