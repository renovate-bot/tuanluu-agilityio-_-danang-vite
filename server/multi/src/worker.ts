/* ===== Worker + Durable Object phòng bầu trời chung: bọc SkyRoom, WebSocket hibernation ===== */
import { multiParams as P } from '../../../src/explore/multi/params';
import { SkyRoom } from './room';
import type { Out } from './room';

interface Env { SKY: DurableObjectNamespace; ALLOWED_ORIGINS: string }
interface Att { id: string; slot: number; name: string; seen?: number; kind?: 'walk' | 'drive' }   // seen: giờ có tin cuối của người giữ slot, ghi thưa (mỗi heartbeatMs) để sống sót qua hibernation; kind: 'walk' = slot nằm ở nhóm đi dạo, 'drive' = nhóm lái xe, không có = nhóm bay

// So khớp scheme + hostname, bỏ cổng
function originKey(o: string): string | null {
  try { const u = new URL(o); return u.protocol + '//' + u.hostname; } catch { return null; }
}

// Mục cho phép có '*' (vd. bản xem trước PR của Netlify): '*' chỉ khớp một đoạn chữ thường/số, không có '.' hay '-'
function originAllowed(key: string, pattern: string): boolean {
  const p = originKey(pattern.replace(/\*/g, 'x'));
  if (!p) return false;
  if (!pattern.includes('*')) return p === key;
  const re = new RegExp('^' + pattern.trim().split('*').map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[a-z0-9]+') + '$');
  return re.test(key);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname !== '/sky') return new Response('Not found', { status: 404 });
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('Expected WebSocket', { status: 426 });
    const key = originKey(req.headers.get('Origin') || '');
    if (!key || !env.ALLOWED_ORIGINS.split(',').some(s => originAllowed(key, s.trim()))) return new Response('Forbidden', { status: 403 });
    return env.SKY.get(env.SKY.idFromName('sky')).fetch(req);
  }
};

export class SkyObject implements DurableObject {
  private room = new SkyRoom();
  private names = new Map<number, string>();
  private walkNames = new Map<number, string>();   // tên người đi dạo theo slot, lấy từ walkers của lobby
  private driveNames = new Map<number, string>();  // tên người lái theo slot, lấy từ drivers của lobby
  private armed: boolean | null = null;   // đã đặt alarm chưa; null = chưa biết (vừa dựng hoặc vừa thức dậy): hỏi storage một lần

  constructor(private state: DurableObjectState, _env: Env) {
    // Đánh thức sau hibernation: dựng lại phòng từ attachment của từng socket
    const now = Date.now();
    const list: Att[] = [];
    for (const ws of this.state.getWebSockets()) {
      const a = ws.deserializeAttachment() as Att | null;
      if (!a) continue;
      this.room.connect(a.id, now);
      if (a.slot >= 0) list.push(a);
    }
    this.room.restore(list, now);
  }

  async fetch(_req: Request): Promise<Response> {
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    const id = crypto.randomUUID();
    this.state.acceptWebSocket(server);
    server.serializeAttachment({ id, slot: -1, name: '' } as Att);
    const outs = this.room.connect(id, Date.now());
    if (outs === null) { server.close(1013, 'full'); return new Response(null, { status: 503 }); }
    this.dispatch(outs);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, data: string | ArrayBuffer): Promise<void> {
    const a = ws.deserializeAttachment() as Att | null;
    if (!a || typeof data !== 'string') return;
    this.dispatch(this.room.message(a.id, data, Date.now()));
    await this.armAlarm();
  }

  async webSocketClose(ws: WebSocket): Promise<void> { this.drop(ws); }
  async webSocketError(ws: WebSocket): Promise<void> { this.drop(ws); }

  async alarm(): Promise<void> {
    this.armed = false;   // alarm đã chạy thì không còn alarm nào chờ
    this.dispatch(this.room.sweep(Date.now()));
    await this.armAlarm();
  }

  private drop(ws: WebSocket): void {
    const a = ws.deserializeAttachment() as Att | null;
    if (a) this.dispatch(this.room.disconnect(a.id));
  }

  // Gửi tin ra socket rồi ghi lại slot/tên/seen mới vào attachment (để sống sót qua hibernation); seen chỉ ghi khi cũ hơn heartbeatMs
  private dispatch(outs: Out[]): void {
    const socks = this.state.getWebSockets();
    for (const o of outs) {
      const text = JSON.stringify(o.msg);
      for (const ws of socks) {
        const a = ws.deserializeAttachment() as Att | null;
        if (!a || (o.to !== 'all' && o.to !== a.id)) continue;
        try { ws.send(text); } catch { /* socket đã đóng */ }
      }
      if (o.msg.t === 'lobby') {
        this.names = new Map(o.msg.flyers.map(f => [f.slot, f.name]));
        this.walkNames = new Map((o.msg.walkers ?? []).map(f => [f.slot, f.name]));
        this.driveNames = new Map((o.msg.drivers ?? []).map(f => [f.slot, f.name]));
      }
    }
    for (const ws of socks) {
      const a = ws.deserializeAttachment() as Att | null;
      if (!a) continue;
      const kind = this.room.kindOf(a.id);
      const walk = kind === 'walk', drive = kind === 'drive';
      const slot = walk ? this.room.walkSlotOf(a.id) : drive ? this.room.driveSlotOf(a.id) : this.room.slotOf(a.id);
      const name = slot >= 0 ? ((walk ? this.walkNames : drive ? this.driveNames : this.names).get(slot) ?? a.name) : '';
      const seen = this.room.seenOf(a.id);
      const stale = slot >= 0 && !(seen - (a.seen ?? -Infinity) < P.heartbeatMs);
      const k = walk ? 'walk' : drive ? 'drive' : undefined;   // loại ghi trong attachment; người bay không ghi (attachment như bản cũ)
      if (slot !== a.slot || name !== a.name || a.kind !== k || stale) {
        const next: Att = slot < 0 ? { id: a.id, slot, name } : k ? { id: a.id, slot, name, seen, kind: k } : { id: a.id, slot, name, seen };
        ws.serializeAttachment(next);
      }
    }
  }

  private async armAlarm(): Promise<void> {
    if (!this.room.hasFlyers() || this.armed) return;
    if (this.armed === null && (await this.state.storage.getAlarm()) !== null) { this.armed = true; return; }
    this.armed = true;
    try { await this.state.storage.setAlarm(Date.now() + P.sweepMs); } catch (e) { this.armed = false; throw e; }
  }
}
