/* ===== Worker + Durable Object phòng bầu trời chung: bọc SkyRoom, WebSocket hibernation ===== */
import { multiParams as P } from '../../../src/explore/multi/params';
import { SkyRoom } from './room';
import type { Out } from './room';

interface Env { SKY: DurableObjectNamespace; ALLOWED_ORIGINS: string }
interface Att { id: string; slot: number; name: string }

// So khớp scheme + hostname, bỏ cổng
function originKey(o: string): string | null {
  try { const u = new URL(o); return u.protocol + '//' + u.hostname; } catch { return null; }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname !== '/sky') return new Response('Not found', { status: 404 });
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('Expected WebSocket', { status: 426 });
    const key = originKey(req.headers.get('Origin') || '');
    const allowed = env.ALLOWED_ORIGINS.split(',').map(s => originKey(s.trim()));
    if (!key || !allowed.includes(key)) return new Response('Forbidden', { status: 403 });
    return env.SKY.get(env.SKY.idFromName('sky')).fetch(req);
  }
};

export class SkyObject implements DurableObject {
  private room = new SkyRoom();
  private names = new Map<number, string>();

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
    this.dispatch(this.room.sweep(Date.now()));
    await this.armAlarm();
  }

  private drop(ws: WebSocket): void {
    const a = ws.deserializeAttachment() as Att | null;
    if (a) this.dispatch(this.room.disconnect(a.id));
  }

  // Gửi tin ra socket rồi ghi lại slot/tên mới vào attachment (để sống sót qua hibernation)
  private dispatch(outs: Out[]): void {
    const socks = this.state.getWebSockets();
    for (const o of outs) {
      const text = JSON.stringify(o.msg);
      for (const ws of socks) {
        const a = ws.deserializeAttachment() as Att | null;
        if (!a || (o.to !== 'all' && o.to !== a.id)) continue;
        try { ws.send(text); } catch { /* socket đã đóng */ }
      }
      if (o.msg.t === 'lobby') this.names = new Map(o.msg.flyers.map(f => [f.slot, f.name]));
    }
    for (const ws of socks) {
      const a = ws.deserializeAttachment() as Att | null;
      if (!a) continue;
      const slot = this.room.slotOf(a.id);
      const name = slot >= 0 ? (this.names.get(slot) ?? a.name) : '';
      if (slot !== a.slot || name !== a.name) ws.serializeAttachment({ id: a.id, slot, name } as Att);
    }
  }

  private async armAlarm(): Promise<void> {
    if (!this.room.hasFlyers()) return;
    if ((await this.state.storage.getAlarm()) === null) await this.state.storage.setAlarm(Date.now() + P.sweepMs);
  }
}
