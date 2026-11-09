/* ===== Phòng bầu trời chung: logic thuần, không phụ thuộc Cloudflare (Durable Object bọc ngoài) ===== */
import { multiParams as P } from '../../../src/explore/multi/params';
import { exSanitizeName } from '../../../src/explore/multi/protocol';
import type { ServerMsg, Flyer } from '../../../src/explore/multi/protocol';
import { exIsBad } from './badwords';

export type Out = { to: string | 'all'; msg: ServerMsg };

interface Slot { id: string; name: string; seen: number; pos: number[] | null }
interface Conn { stamps: number[] }

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export class SkyRoom {
  private conns = new Map<string, Conn>();
  private slots: (Slot | null)[] = new Array(P.slots).fill(null);
  private lastBroadcast = -Infinity;

  private lobby(): Out {
    const flyers: Flyer[] = [];
    this.slots.forEach((s, i) => { if (s) flyers.push({ slot: i, name: s.name }); });
    return { to: 'all', msg: { t: 'lobby', flyers } };
  }

  connect(id: string, now: number): Out[] | null {
    if (!this.conns.has(id) && this.conns.size >= P.maxConns) return null;
    this.conns.set(id, { stamps: [] });
    return [{ to: id, msg: this.lobby().msg }];
  }

  slotOf(id: string): number { return this.slots.findIndex(s => s !== null && s.id === id); }

  hasFlyers(): boolean { return this.slots.some(s => s !== null); }

  restore(list: { id: string; slot: number; name: string }[], now: number): void {
    for (const e of list) {
      if (e.slot < 0 || e.slot >= P.slots) continue;
      if (!this.conns.has(e.id)) this.conns.set(e.id, { stamps: [] });
      this.slots[e.slot] = { id: e.id, name: e.name, seen: now, pos: null };
    }
  }

  message(id: string, raw: string, now: number): Out[] {
    const conn = this.conns.get(id);
    if (!conn || typeof raw !== 'string' || raw.length > P.maxMsgBytes) return [];
    let m: any;
    try { m = JSON.parse(raw); } catch { return []; }
    if (!m || typeof m !== 'object') return [];
    const slot = this.slotOf(id);
    switch (m.t) {
      case 'join': return this.onJoin(id, slot, m.name, now);
      case 'leave': return this.release(id) ? [this.lobby()] : [];
      case 'hb': if (slot >= 0) this.slots[slot].seen = now; return [];
      case 'pos': return slot >= 0 ? this.onPos(conn, slot, m, now) : [];
      default: return [];
    }
  }

  private onJoin(id: string, slot: number, rawName: unknown, now: number): Out[] {
    if (slot >= 0) return [];
    const name = typeof rawName === 'string' ? exSanitizeName(rawName) : null;
    if (name === null || exIsBad(name)) return [{ to: id, msg: { t: 'rejected', why: 'name' } }];
    const free = this.slots.findIndex(s => s === null);
    if (free < 0) return [{ to: id, msg: { t: 'rejected', why: 'full' } }];
    this.slots[free] = { id, name, seen: now, pos: null };
    return [{ to: id, msg: { t: 'joined', slot: free } }, this.lobby()];
  }

  private onPos(conn: Conn, slot: number, m: any, now: number): Out[] {
    const { x, y, z, yaw, bank } = m;
    for (const v of [x, y, z, yaw, bank]) if (typeof v !== 'number' || !Number.isFinite(v)) return [];
    conn.stamps = conn.stamps.filter(t => now - t < 1000);
    if (conn.stamps.length >= P.posMaxPerSec) return [];
    conn.stamps.push(now);
    const s = this.slots[slot]!;
    s.seen = now;
    s.pos = [slot, clamp(x, P.bounds.x0, P.bounds.x1), clamp(y, P.floor, P.ceiling), clamp(z, P.bounds.z0, P.bounds.z1), yaw, bank];
    if (now - this.lastBroadcast < P.broadcastMs) return [];
    this.lastBroadcast = now;
    const f: number[][] = [];
    for (const t of this.slots) if (t && t.pos) f.push(t.pos);
    return [{ to: 'all', msg: { t: 'pos', f } }];
  }

  // Trả slot của kết nối; true nếu có slot được trả
  private release(id: string): boolean {
    const i = this.slotOf(id);
    if (i < 0) return false;
    this.slots[i] = null;
    return true;
  }

  disconnect(id: string): Out[] {
    this.conns.delete(id);
    return this.release(id) ? [this.lobby()] : [];
  }

  sweep(now: number): Out[] {
    const out: Out[] = [];
    this.slots.forEach((s, i) => {
      if (s && now - s.seen > P.slotTimeoutMs) { out.push({ to: s.id, msg: { t: 'released' } }); this.slots[i] = null; }
    });
    if (out.length) out.push(this.lobby());
    return out;
  }
}
