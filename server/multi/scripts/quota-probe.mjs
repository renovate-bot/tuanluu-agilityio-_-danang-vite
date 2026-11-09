/* ===== Đo hạn mức miễn phí Cloudflare: gửi hàng loạt tin hb rồi thử kết nối mới =====
   Dùng: node server/multi/scripts/quota-probe.mjs wss://danang-sky.<tài-khoản>.workers.dev/sky [soTin=120000] [tinMoiGiay=400] */
const url = process.argv[2];
const TOTAL = Number(process.argv[3] || 120000);
const RATE = Number(process.argv[4] || 400);
const ORIGIN = 'https://danangbridges.netlify.app';
if (!url) { console.error('Thiếu URL'); process.exit(2); }

const open = () => new Promise((res, rej) => {
  const ws = new WebSocket(url, { headers: { Origin: ORIGIN } });
  ws.onopen = () => res(ws);
  ws.onerror = e => rej(new Error('lỗi kết nối: ' + (e.message || 'không rõ')));
});

const ws = await open();
let sent = 0, closeCode = null, closeReason = '';
ws.onclose = e => { closeCode = e.code; closeReason = e.reason; };
const t0 = Date.now();
const TICK = 50, perTick = Math.round(RATE * TICK / 1000);
while (sent < TOTAL && closeCode === null) {
  for (let i = 0; i < perTick && sent < TOTAL; i++) { ws.send('{"t":"hb"}'); sent++; }
  await new Promise(r => setTimeout(r, TICK));
  if (sent % 10000 < perTick) console.log(`đã gửi ${sent} sau ${((Date.now() - t0) / 1000).toFixed(0)} s, bufferedAmount=${ws.bufferedAmount}`);
}
await new Promise(r => setTimeout(r, 1000));
console.log(`GỬI: ${sent}/${TOTAL} tin trong ${((Date.now() - t0) / 1000).toFixed(1)} s; đóng=${closeCode === null ? 'không' : closeCode + ' ' + closeReason}`);
try { ws.close(); } catch {}

// Kết nối mới + join
let result;
try {
  const w2 = await open();
  result = await new Promise(res => {
    const to = setTimeout(() => res('hết giờ chờ phản hồi join'), 8000);
    w2.onmessage = e => { const m = JSON.parse(e.data); if (m.t === 'joined' || m.t === 'rejected') { clearTimeout(to); res(JSON.stringify(m)); } };
    w2.onclose = e => { clearTimeout(to); res('đóng ' + e.code + ' ' + e.reason); };
    w2.send(JSON.stringify({ t: 'join', name: 'probe' }));
  });
  try { w2.send('{"t":"leave"}'); w2.close(); } catch {}
} catch (e) { result = 'KHÔNG KẾT NỐI ĐƯỢC: ' + e.message; }
console.log('KẾT NỐI MỚI:', result);
