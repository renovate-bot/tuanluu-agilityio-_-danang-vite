// Kiểm tra dù lượn nhiều người ở phía khách (kế hoạch feature/du-luon-nhieu-nguoi, Task 5).
//   Mục 1: 4 bot Node WebSocket bay cùng — dù, màu, nhãn tên, nhãn dưới cánh, draw call (≤ +4), roster, bot thoát.
//   Mục 2: ?test không có multi= thì không mở WebSocket nào.
//   Mục 3 (Task 6): bước chọn slot + nhập tên trong màn chọn — số chỗ trực tiếp, tên, chống chèn HTML/RTL, nhớ tên, máy chủ tắt, đổi ngôn ngữ.
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

  // Mục 3 — bước chọn slot và nhập tên (bắt đầu từ phòng trống; mọi bot/trang đóng trước Mục 1)
  {
    const URL3 = srv.url + '?chooser&multi=' + encodeURIComponent(`ws://${HOST}/sky`);
    const lobbyBots = [bot('Linh', 90, 0), bot('<img src>', 110, 18), bot('Sakura', 130, -18)];
    await sleep(2500);
    const L = await openApp(browser, URL3);
    await L.page.waitForSelector('#chooser', { state: 'visible', timeout: 240000 });
    let ws3 = 0; L.page.on('websocket', () => ws3++);
    check('Chưa bấm Dù lượn: không có phiên, không WebSocket', ws3 === 0 && await L.page.evaluate(() => window.__app.multi.session) === null);
    const txt = (sel) => L.page.evaluate((s) => document.querySelector(s)?.innerText ?? null, sel);
    const rows = () => L.page.evaluate(() => [...document.querySelectorAll('#exMpList .ex-mp-row span')].map((e) => e.textContent));
    await L.page.click('#chooser [data-pick="glider"]');
    await L.page.waitForFunction(() => /Còn 2 trên 5/.test(document.getElementById('exMpSeats')?.innerText || ''), null, { timeout: 30000 }).catch(() => {});
    const seats2 = await txt('#exMpSeats');
    check(`Bấm Dù lượn: sảnh hiện "${seats2}" (Còn 2) và 3 tên bot`, /Còn 2 trên 5/.test(seats2 || '') && (await rows()).length === 3);
    const sk = await L.page.evaluate(() => ({ lobbyVisible: !document.getElementById('exMpLobby').hidden, cardsHidden: document.querySelector('#chooser .ex-cards').hidden, heading: document.querySelector('#exMpLobby h2').innerText, filled: document.querySelectorAll('#exMpDots i.on').length, total: document.querySelectorAll('#exMpDots i').length, inert: !!document.getElementById('exLang').closest('[inert]') }));
    check(`Sảnh thay thẻ trong cùng hộp thoại: tiêu đề "${sk.heading}", ${sk.filled}/${sk.total} chấm, ô ngôn ngữ còn dùng được`, sk.lobbyVisible && sk.cardsHidden && sk.heading === 'Bầu trời Đà Nẵng' && sk.filled === 3 && sk.total === 5 && !sk.inert);
    lobbyBots.push(bot('مرحبا', 150, 0));
    await L.page.waitForFunction(() => /Còn 1 trên 5/.test(document.getElementById('exMpSeats')?.innerText || ''), null, { timeout: 30000 }).catch(() => {});
    const r4 = await rows();
    check(`Bot thứ tư vào: "Còn 1" không tải lại (${r4.join(' | ')})`, /Còn 1 trên 5/.test(await txt('#exMpSeats')) && r4.length === 4);
    const html = await L.page.evaluate(() => ({ imgs: document.querySelectorAll('#chooser img').length, body: getComputedStyle(document.body).direction, root: document.documentElement.dir }));
    check('Tên "<img src>" hiện nguyên chuỗi, không tạo phần tử img; tên RTL không đổi dir của body/trang', r4.includes('<img src>') && r4.includes('مرحبا') && html.imgs === 0 && html.body === 'ltr' && html.root === 'ltr');
    // Tên 10 ký tự tắt nút; 'Trường' bật
    await L.page.fill('#exMpNameIn', '1234567890');
    const dis10 = await L.page.evaluate(() => document.getElementById('exMpFly').disabled);
    await L.page.fill('#exMpNameIn', 'Trường');
    const dis6 = await L.page.evaluate(() => document.getElementById('exMpFly').disabled);
    await L.page.fill('#exMpNameIn', '');
    const disEmpty = await L.page.evaluate(() => document.getElementById('exMpFly').disabled);
    check(`Tên 10 ký tự: nút tắt (${dis10}); "Trường": bật (${!dis6}); rỗng: tắt (${disEmpty})`, dis10 && !dis6 && disEmpty);
    // Đổi ngôn ngữ ngay ở bước riêng: dòng số chỗ dịch, tên giữ nguyên
    await L.page.fill('#exMpNameIn', 'Trường');
    await L.page.selectOption('#exLang', 'en');
    const en = await L.page.evaluate(() => ({ seats: document.getElementById('exMpSeats').innerText, names: [...document.querySelectorAll('#exMpList .ex-mp-row span')].map((e) => e.textContent), btn: document.getElementById('exMpFly').innerText, v: document.getElementById('exMpNameIn').value }));
    check(`Đổi sang en: "${en.seats}", nút "${en.btn}", tên bot và tên đã gõ giữ nguyên`, /1 of 5/.test(en.seats) && en.names.join('|') === r4.join('|') && en.v === 'Trường' && en.btn === 'Fly now');
    await L.page.selectOption('#exLang', 'ar');
    await frames(L.page, 3);
    const ar = await L.page.evaluate(() => { const b = document.querySelector('#chooser .ex-box'), r = b.getBoundingClientRect(); return { dir: document.documentElement.dir, over: b.scrollWidth - b.clientWidth, inView: r.left >= 0 && r.right <= innerWidth }; });
    check(`lang=ar: dir=${ar.dir}, hộp không tràn ngang (${ar.over} px) và nằm trong khung nhìn`, ar.dir === 'rtl' && ar.over <= 0 && ar.inView);
    await L.page.selectOption('#exLang', 'vi');
    // Tải lại: tên đã nhớ sẵn
    await L.page.reload({ waitUntil: 'load' });
    await L.page.waitForFunction(() => window.__app && document.getElementById('loading')?.classList.contains('done'), null, { timeout: 180000 });
    await L.page.waitForSelector('#chooser', { state: 'visible', timeout: 240000 });
    await L.page.click('#chooser [data-pick="glider"]');
    await L.page.waitForFunction(() => /Còn 1 trên 5/.test(document.getElementById('exMpSeats')?.innerText || ''), null, { timeout: 30000 }).catch(() => {});
    const kept = await L.page.evaluate(() => ({ v: document.getElementById('exMpNameIn').value, off: document.getElementById('exMpFly').disabled, ls: localStorage.getItem('exMpName') }));
    check(`Tải lại: tên đã nhớ sẵn ("${kept.v}", localStorage "${kept.ls}"), nút Bay ngay bật`, kept.v === 'Trường' && kept.ls === 'Trường' && !kept.off);
    // Bay ngay -> vào trời với slot cuối
    await L.page.click('#exMpFly');
    await L.page.waitForFunction(() => window.__app.explore.active() && window.__app.multi.session.phase === 'flying', null, { timeout: 60000 });
    await frames(L.page, 5);
    const fl = await L.page.evaluate(() => ({ hidden: document.getElementById('chooser').hidden, slot: window.__app.multi.session.mySlot, roster: document.getElementById('exMpRoster').innerText }));
    check(`Bay ngay: hộp đóng, slot ${fl.slot}, roster đủ 5/5 có Trường và tên chứa thẻ HTML`, fl.hidden && fl.slot === 4 && /5\/5/.test(fl.roster) && fl.roster.includes('Trường') && fl.roster.includes('<img src>'));
    check('Lỗi console của trang sảnh = 0', L.errors.length === 0);
    if (L.errors.length) console.log(L.errors.join('\n'));
    await L.page.close();
    lobbyBots.forEach((b) => b.close());

    // Máy chủ tắt: cổng không có gì
    const O = await openApp(browser, srv.url + '?chooser&multi=' + encodeURIComponent('ws://127.0.0.1:9/sky'));
    await O.page.waitForSelector('#chooser', { state: 'visible', timeout: 240000 });
    await O.page.click('#chooser [data-pick="glider"]');
    await O.page.waitForFunction(() => !document.getElementById('exMpOffline').hidden, null, { timeout: 30000 }).catch(() => {});
    const off = await O.page.evaluate(() => ({ msg: document.getElementById('exMpOffline').innerText, solo: !document.getElementById('exMpSolo').hidden, name: document.getElementById('exMpNameIn').offsetParent !== null, fly: document.getElementById('exMpFly').offsetParent !== null }));
    check(`Máy chủ tắt: hiện "${off.msg}" và nút Bay một mình, không đòi tên`, off.msg.length > 0 && off.solo && !off.name && !off.fly);
    await O.page.click('#exMpSolo');
    await O.page.waitForFunction(() => window.__app.explore.active(), null, { timeout: 60000 }).catch(() => {});
    check('Bấm Bay một mình: bay được, hộp đóng', await O.page.evaluate(() => window.__app.explore.active() && document.getElementById('chooser').hidden));
    check('Lỗi console của trang ngoại tuyến = 0', O.errors.length === 0);
    await O.page.close();
    await sleep(1500);
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
