/* ===== Dù lượn nhiều người: kết nối WebSocket tới máy chủ ===== */
import type { ClientMsg, ServerMsg } from './protocol';

export interface Transport {
  send(m: ClientMsg): void;
  close(): void;
  onMessage: (m: ServerMsg) => void;
  onClose: () => void;
}

// Mở WebSocket; reject khi lỗi hoặc quá hạn timeoutMs
export function exConnect(url: string, timeoutMs: number): Promise<Transport> {
  return new Promise<Transport>((resolve, reject) => {
    let ws: WebSocket;
    try { ws = new WebSocket(url); } catch (e) { reject(e); return; }
    let opened = false;
    const tm = setTimeout(() => { if (!opened) { try { ws.close(); } catch (e) { /* bỏ qua */ } reject(new Error('timeout')); } }, timeoutMs);
    const t: Transport = {
      send: m => { if (ws.readyState === 1) ws.send(JSON.stringify(m)); },
      close: () => { try { ws.close(); } catch (e) { /* bỏ qua */ } },
      onMessage: () => {},
      onClose: () => {}
    };
    ws.onopen = () => { opened = true; clearTimeout(tm); resolve(t); };
    ws.onmessage = ev => {
      let m: ServerMsg;
      try { m = JSON.parse(String(ev.data)); } catch (e) { return; }
      if (m && typeof m.t === 'string') t.onMessage(m);
    };
    ws.onerror = () => { if (!opened) { clearTimeout(tm); reject(new Error('ws error')); } };
    ws.onclose = () => { clearTimeout(tm); if (!opened) reject(new Error('closed')); else t.onClose(); };
  });
}
