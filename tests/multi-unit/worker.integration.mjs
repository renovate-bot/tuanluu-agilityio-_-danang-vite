/* ===== Test tích hợp Worker dù lượn nhiều người: spawn `wrangler dev`, kiểm join/đầy/lobby/Origin ===== */
import { spawn } from 'node:child_process';
import http from 'node:http';

const PORT = 8799;
const HOST = `127.0.0.1:${PORT}`;
const ORIGIN = 'https://danangbridges.netlify.app';
const dir = new URL('../../server/multi/', import.meta.url);

const wr = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['wrangler', 'dev', '--port', String(PORT)], { cwd: dir, shell: process.platform === 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
let log = '';
wr.stdout.on('data', d => { log += d; }); wr.stderr.on('data', d => { log += d; });
const stop = () => { try { if (process.platform === 'win32') spawn('taskkill', ['/pid', String(wr.pid), '/T', '/F']); else wr.kill(); } catch {} };
process.on('exit', stop);

let fails = 0;
const ok = (c, m) => { console.log((c ? 'ĐẠT ' : 'LỖI ') + m); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Gửi yêu cầu nâng cấp WebSocket thô, trả mã HTTP
function upgradeStatus(origin) {
  return new Promise(res => {
    const headers = { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==' };
    if (origin) headers.Origin = origin;
    const req = http.request({ host: '127.0.0.1', port: PORT, path: '/sky', headers });
    req.on('response', r => { res(r.statusCode); r.resume(); });
    req.on('upgrade', (r, sock) => { res(r.statusCode); sock.destroy(); });
    req.on('error', () => res(0));
    req.end();
  });
}

function client() {
  const ws = new WebSocket(`ws://${HOST}/sky`, { headers: { Origin: ORIGIN } });
  const msgs = [];
  ws.onmessage = e => msgs.push(JSON.parse(e.data));
  const opened = new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(new Error('ws error')); });
  return { ws, msgs, opened, send: o => ws.send(JSON.stringify(o)) };
}
const last = (c, t) => [...c.msgs].reverse().find(m => m.t === t);

try {
  for (let i = 0; i < 120; i++) { if (/Ready on/.test(log)) break; await sleep(500); }
  ok(/Ready on/.test(log), 'wrangler dev sẵn sàng');

  const cs = [];
  for (let i = 0; i < 6; i++) { const c = client(); await c.opened; cs.push(c); }
  await sleep(300);
  ok(cs.every(c => c.msgs[0] && c.msgs[0].t === 'lobby'), 'mỗi kết nối nhận lobby ngay khi vào');
  cs.forEach((c, i) => c.send({ t: 'join', name: 'P' + i }));
  await sleep(1000);
  const joined = cs.filter(c => last(c, 'joined')).length;
  const full = cs.filter(c => (last(c, 'rejected') || {}).why === 'full').length;
  ok(joined === 5 && full === 1, `6 kết nối join: ${joined} joined, ${full} rejected full`);

  const gone = cs.find(c => last(c, 'joined'));
  const stay = cs.find(c => c !== gone && last(c, 'joined'));
  gone.ws.close();
  await sleep(1000);
  const lob = last(stay, 'lobby');
  ok(lob && lob.flyers.length === 4, `đóng một kết nối: lobby còn ${lob ? lob.flyers.length : '?'} tên`);

  ok(await upgradeStatus('https://evil.example') === 403, 'Origin lạ -> 403');
  ok(await upgradeStatus(null) === 403, 'không có Origin -> 403');
  ok(await upgradeStatus('http://localhost:5173') === 101, 'Origin http://localhost:5173 -> 101');
  cs.forEach(c => { try { c.ws.close(); } catch {} });
} catch (e) {
  ok(false, 'ngoại lệ: ' + e.message + '\n' + log.slice(-1500));
}
stop();
await sleep(500);
console.log(fails ? `${fails} LỖI` : 'TẤT CẢ ĐẠT');
process.exit(fails ? 1 : 0);
