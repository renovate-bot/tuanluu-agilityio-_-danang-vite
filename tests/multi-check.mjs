// Kiểm tra dù lượn nhiều người ở phía khách (kế hoạch feature/du-luon-nhieu-nguoi, Task 5).
//   Mục 1: 4 bot Node WebSocket bay cùng — dù, màu, nhãn tên, nhãn dưới cánh, draw call (≤ +4), roster, bot thoát.
//   Mục 2: ?test không có multi= thì không mở WebSocket nào.
//   Tự spawn `wrangler dev` ở cổng 8799 và luôn kill khi xong hoặc lỗi.
//
//   npm run build && npm run test:multi
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { serveDir, launch, openApp, frames } from './lib.mjs';

const PORT = 8799, HOST = `127.0.0.1:${PORT}`;
const problems = [];
const check = (name, ok) => { if (!ok) problems.push(name); console.log(`${ok ? 'đạt ' : 'LỖI '} ${name}`); return ok; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const wr = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['wrangler', 'dev', '--port', String(PORT)], { cwd: fileURLToPath(new URL('../server/multi/', import.meta.url)), shell: process.platform === 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
let log = ''; wr.stdout.on('data', (d) => { log += d; }); wr.stderr.on('data', (d) => { log += d; });
const stop = () => { try { if (process.platform === 'win32') spawn('taskkill', ['/pid', String(wr.pid), '/T', '/F']); else wr.kill(); } catch { /* bỏ qua */ } };
process.on('exit', stop);

// Dù chính đứng yên ở BASE, hướng +X; bot bay tại chỗ phía trước, hơi lệch hai bên
const BASE = { x: 500, y: 150, z: 100 };
function bot(name, ox, oz) {
  const ws = new WebSocket(`ws://${HOST}/sky`, { headers: { Origin: 'http://127.0.0.1' } });
  const b = { ws, timer: null };
  ws.onopen = () => ws.send(JSON.stringify({ t: 'join', name }));
  ws.onmessage = (e) => {
    if (JSON.parse(e.data).t === 'joined' && !b.timer) b.timer = setInterval(() => ws.send(JSON.stringify({ t: 'pos', x: BASE.x + ox, y: BASE.y + 5, z: BASE.z + oz, yaw: 0, bank: 0 })), 200);
  };
  b.close = () => { clearInterval(b.timer); try { ws.close(); } catch { /* bỏ qua */ } };
  return b;
}

let srv, browser, page;
const bots = [];
try {
  for (let i = 0; i < 120; i++) { if (/Ready on/.test(log)) break; await sleep(500); }
  check('wrangler dev sẵn sàng', /Ready on/.test(log));
  srv = await serveDir(fileURLToPath(new URL('../dist/', import.meta.url)));
  browser = await launch();

  // Mục 2 — không multi=: không mở WebSocket (cả ?explore=glider lẫn ?test thường)
  for (const q of ['', '?explore=glider']) {
    const P = await openApp(browser, srv.url + q);
    let ws = 0; P.page.on('websocket', () => ws++);
    await frames(P.page, 15);
    const u = await P.page.evaluate(() => window.__app.multi.url());
    check(`Không có multi= (${q || '?test'}): không có WebSocket nào được mở`, ws === 0 && u === '' && await P.page.evaluate(() => window.__app.multi.session) === null);
    await P.page.close();
  }

  // Mục 1
  const P = await openApp(browser, srv.url + '?multi=' + encodeURIComponent(`ws://${HOST}/sky`));
  page = P.page;
  check('multi.url() lấy từ ?multi=', await page.evaluate(() => window.__app.multi.url()) === `ws://${HOST}/sky`);
  await page.evaluate(() => window.__app.multi.fly('Tester'));
  await page.waitForFunction(() => window.__app.explore.active() && window.__app.multi.session.phase === 'flying', null, { timeout: 60000 });
  const mine = await page.evaluate(() => window.__app.multi.session.mySlot);
  check('vào phòng và bay với slot ' + mine, mine >= 0);
  // Ghim dù chính tại BASE sau mỗi lần animate (rAF đăng ký sau chạy sau)
  await page.evaluate((B) => {
    const s = window.__app.explore.state;
    const pin = () => { s.pos.set(B.x, B.y, B.z); s.yaw = 0; s.bank = 0; requestAnimationFrame(pin); };
    pin();
  }, BASE);
  // draw call: dựng hai lần, đo lần hai (LOD theo camera hiện tại)
  const calls = () => page.evaluate(() => { const { renderer, scene, camera } = window.__app; renderer.render(scene, camera); renderer.info.reset(); renderer.render(scene, camera); return renderer.info.render.calls; });
  await frames(page, 40);   // camera bám ổn định
  const c0 = await calls();

  ['Ann', 'Binh', 'Chi', 'Dung'].forEach((n, i) => bots.push(bot(n, 90 + i * 20, (i - 1.5) * 18)));
  await page.waitForFunction(() => [0, 1, 2, 3, 4].filter(i => window.__app.multi.remotes.slotState(i)).length === 4, null, { timeout: 60000 });
  await frames(page, 20);
  const info = await page.evaluate(() => {
    const A = window.__app, R = A.multi.remotes, out = { slots: [], maps: [], labels: [], below: [], roster: null };
    for (let i = 0; i < 5; i++) {
      if (!R.slotState(i)) continue;
      out.slots.push(i);
      const g = R.group(i); const ids = []; g.traverse((o) => { if (o.isMesh && o.material && o.material.map) ids.push(o.material.map.uuid); });
      out.maps.push(ids.sort().join(','));
      const st = R.slotState(i), v = new A.THREE.Vector3(st.pos.x, st.pos.y, st.pos.z).project(A.camera);
      const py = (-v.y * 0.5 + 0.5) * innerHeight;
      const el = [...document.querySelectorAll('#exMpLabels .ex-mp-label')].find((e) => !e.hidden && e.textContent.startsWith(R.name(i) + ' '));
      out.labels.push(el ? el.textContent : null);
      out.below.push(el ? el.getBoundingClientRect().top - py : null);
    }
    out.roster = document.getElementById('exMpRoster').innerText;
    return out;
  });
  check('4 bot bay: exRemotes có 4 dù', info.slots.length === 4);
  check('4 màu khác nhau (4 bản đồ màu riêng: ' + info.maps.map((m) => m.length).join('/') + ')', new Set(info.maps).size === 4);
  check('nhãn hiện đúng tên (Ann, Binh, Chi, Dung) kèm khoảng cách', ['Ann', 'Binh', 'Chi', 'Dung'].every((n) => info.labels.some((l) => l && l.startsWith(n + ' · ') && /\d+ m|\d\.\d km/.test(l))));
  check('nhãn nằm dưới cánh: top của nhãn > điểm chiếu của dù (' + info.below.map((x) => x === null ? '-' : Math.round(x)).join(',') + ' px)', info.below.length === 4 && info.below.every((x) => x !== null && x > 0));
  check('roster: "Đang bay 5/5" và đủ 5 tên', /5\/5/.test(info.roster) && ['Tester', 'Ann', 'Binh', 'Chi', 'Dung'].every((n) => info.roster.includes(n)));
  const c4 = await calls();
  check(`Draw call chênh giữa 0 bot (${c0}) và 4 bot trong khung nhìn (${c4}) ≤ +4`, c4 - c0 <= 4);

  bots.pop().close();
  await page.waitForFunction(() => [0, 1, 2, 3, 4].filter(i => window.__app.multi.remotes.slotState(i)).length === 3, null, { timeout: 30000 }).catch(() => {});
  const after = await page.evaluate(() => ({
    n: [0, 1, 2, 3, 4].filter(i => window.__app.multi.remotes.slotState(i)).length,
    roster: document.getElementById('exMpRoster').innerText, vis: [...document.querySelectorAll('#exMpLabels .ex-mp-label')].filter((e) => !e.hidden).length
  }));
  check(`Bot đóng kết nối: dù biến mất (còn ${after.n}), roster còn 4 người bay (3 bot + mình), nhãn còn ${after.vis}`, after.n === 3 && /4\/5/.test(after.roster) && !after.roster.includes('Dung') && after.vis === 3);

  check('console không lỗi', P.errors.length === 0);
  if (P.errors.length) console.log(P.errors.join('\n'));
} catch (e) {
  check('ngoại lệ: ' + e.message, false);
} finally {
  bots.forEach((b) => b.close());
  try { await browser?.close(); } catch { /* bỏ qua */ }
  try { srv?.close(); } catch { /* bỏ qua */ }
  stop();
  await sleep(1500);
}
console.log(problems.length ? `multi-check: LỖI (${problems.length}): ${problems.join('; ')}` : 'multi-check: đạt');
process.exit(problems.length ? 1 : 0);
