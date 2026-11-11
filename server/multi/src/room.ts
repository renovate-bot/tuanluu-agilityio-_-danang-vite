/* ===== Phòng bầu trời chung: logic thuần, không phụ thuộc Cloudflare (Durable Object bọc ngoài) ===== */
import { multiParams as P } from '../../../src/explore/multi/params';
import { exSanitizeName } from '../../../src/explore/multi/protocol';
import type { ServerMsg, Flyer, Kind } from '../../../src/explore/multi/protocol';
import { exIsBad } from './badwords';

export type Out = { to: string | 'all'; msg: ServerMsg };

// pos: [slot, x, y, z, yaw, bank (người đi dạo: pose), giờ gửi]; giờ gửi = ts của khách (khách mới) hoặc giờ máy chủ nhận (khách cũ); dirty: có vị trí mới chưa phát
interface Slot { id: string; name: string; seen: number; pos: number[] | null; dirty: boolean }
interface Conn { stamps: number[] }

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const wrapPi = (a: number) => a - Math.round(a / (2 * Math.PI)) * 2 * Math.PI;   // góc về [−π, π]

export class SkyRoom {
  private conns = new Map<string, Conn>();
  private slots: (Slot | null)[] = new Array(P.slots).fill(null);
  private walkSlots: (Slot | null)[] = new Array(P.stroll.slots).fill(null);   // nhóm chỗ đi dạo, tách khỏi nhóm bay
  private lastBroadcast = -Infinity;

  private lobby(): Out {
    const flyers: Flyer[] = [];
    const walkers: Flyer[] = [];
    this.slots.forEach((s, i) => { if (s) flyers.push({ slot: i, name: s.name }); });
    this.walkSlots.forEach((s, i) => { if (s) walkers.push({ slot: i, name: s.name }); });
    return { to: 'all', msg: { t: 'lobby', flyers, walkers } };
  }

  connect(id: string, now: number): Out[] | null {
    if (!this.conns.has(id) && this.conns.size >= P.maxConns) return null;
    this.conns.set(id, { stamps: [] });
    return [{ to: id, msg: this.lobby().msg }];
  }

  slotOf(id: string): number { return this.slots.findIndex(s => s !== null && s.id === id); }   // slot bay, -1 nếu không bay

  walkSlotOf(id: string): number { return this.walkSlots.findIndex(s => s !== null && s.id === id); }   // slot đi dạo, -1 nếu không đi dạo

  kindOf(id: string): Kind | null { return this.slotOf(id) >= 0 ? 'fly' : this.walkSlotOf(id) >= 0 ? 'walk' : null; }

  hasFlyers(): boolean { return this.slots.some(s => s !== null) || this.walkSlots.some(s => s !== null); }   // còn ai giữ slot (bay hoặc đi): giữ alarm quét

  /* Giờ có tin cuối của người giữ slot (để lưu vào attachment); -1 nếu không giữ slot */
  seenOf(id: string): number {
    const i = this.slotOf(id);
    if (i >= 0) return this.slots[i].seen;
    const w = this.walkSlotOf(id);
    return w < 0 ? -1 : this.walkSlots[w].seen;
  }

  /* Dựng lại sau hibernation. seen lấy từ attachment nếu có; không có (attachment cũ) thì coi như vừa im lặng gần hết hạn:
     người còn bay có một chu kỳ nhịp sống để lên tiếng, người đã chết không được gia hạn thêm mỗi lần thức dậy */
  restore(list: { id: string; slot: number; name: string; seen?: number; kind?: 'walk' }[], now: number): void {
    for (const e of list) {
      const group = e.kind === 'walk' ? this.walkSlots : this.slots;
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
    const kind = this.kindOf(id);
    const group = kind === 'walk' ? this.walkSlots : this.slots;
    const slot = kind === 'walk' ? this.walkSlotOf(id) : this.slotOf(id);
    switch (m.t) {
      case 'join': return this.onJoin(id, kind !== null, m.name, m.kind === 'walk', now);
      case 'leave': return this.release(id) ? [this.lobby()] : [];
      case 'hb': if (slot < 0) return []; group[slot].seen = now; return this.flush(now);
      case 'pos': return slot >= 0 ? this.onPos(conn, group[slot]!, slot, kind === 'walk', m, now) : [];
      default: return [];
    }
  }

  private onJoin(id: string, holding: boolean, rawName: unknown, walk: boolean, now: number): Out[] {
    if (holding) return [];
    const name = typeof rawName === 'string' ? exSanitizeName(rawName) : null;
    if (name === null || exIsBad(name)) return [{ to: id, msg: walk ? { t: 'rejected', why: 'name', kind: 'walk' } : { t: 'rejected', why: 'name' } }];
    const group = walk ? this.walkSlots : this.slots;
    const free = group.findIndex(s => s === null);
    if (free < 0) return [{ to: id, msg: walk ? { t: 'rejected', why: 'full', kind: 'walk' } : { t: 'rejected', why: 'full' } }];
    group[free] = { id, name, seen: now, pos: null, dirty: false };
    return [{ to: id, msg: walk ? { t: 'joined', slot: free, kind: 'walk' } : { t: 'joined', slot: free } }, this.lobby()];
  }

  private onPos(conn: Conn, s: Slot, slot: number, walk: boolean, m: any, now: number): Out[] {
    const { x, y, z, yaw, ts } = m;
    const tilt = walk ? m.pose : m.bank;   // người đi dạo gửi pose, người bay gửi bank; trường kia bị bỏ qua
    for (const v of [x, y, z, yaw, tilt]) if (typeof v !== 'number' || !Number.isFinite(v)) return [];
    conn.stamps = conn.stamps.filter(t => now - t < 1000);
    if (conn.stamps.length >= P.posMaxPerSec) return [];
    conn.stamps.push(now);
    s.seen = now;
    const stamp = typeof ts === 'number' && Math.abs(ts) <= Number.MAX_SAFE_INTEGER ? ts : now;   // ts ngoài ±2^53 (kể cả NaN/∞) coi như không gửi, tránh đẩy độ lệch giờ của khách thành ∞
    if (walk) {
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
    const f: number[][] = [], w: number[][] = [];
    for (const t of this.slots) if (t && t.dirty) { f.push(t.pos!); t.dirty = false; }
    for (const t of this.walkSlots) if (t && t.dirty) { w.push(t.pos!); t.dirty = false; }
    if (!f.length && !w.length) return [];
    this.lastBroadcast = now;
    return [{ to: 'all', msg: w.length ? { t: 'pos', f, w } : { t: 'pos', f } }];
  }

  // Trả slot của kết nối; true nếu có slot được trả
  private release(id: string): boolean {
    const i = this.slotOf(id);
    if (i >= 0) { this.slots[i] = null; return true; }
    const w = this.walkSlotOf(id);
    if (w < 0) return false;
    this.walkSlots[w] = null;
    return true;
  }

  disconnect(id: string): Out[] {
    this.conns.delete(id);
    return this.release(id) ? [this.lobby()] : [];
  }

  sweep(now: number): Out[] {
    const out: Out[] = [];
    for (const group of [this.slots, this.walkSlots]) group.forEach((s, i) => {
      if (s && now - s.seen > P.slotTimeoutMs) { out.push({ to: s.id, msg: { t: 'released' } }); group[i] = null; }
    });
    if (out.length) out.push(this.lobby());
    return out;
  }
}
