// Kiểm tra dù lượn nhiều người ở phía khách (kế hoạch feature/du-luon-nhieu-nguoi, Task 5).
//   Mục 1: 4 bot Node WebSocket bay cùng — dù, màu, nhãn tên, nhãn dưới cánh, draw call (≤ +4), roster, bot thoát.
//   Mục 2: ?test không có multi= thì không mở WebSocket nào.
//   Mục 3 (Task 6): bước chọn slot + nhập tên trong màn chọn — số chỗ trực tiếp, tên, chống chèn HTML/RTL, nhớ tên, máy chủ tắt, đổi ngôn ngữ.
//   Mục 4 (Task 7): chế độ xem (5 bot), lời mời vào chỗ trống, giành trước, người xem rời, ô tên không lái dù, Esc, mất máy chủ khi xem và khi bay.
//   Mục 5 (Task 8): rời máy — đếm ngược, trả slot, camera giữ nguyên, lời mời còn dùng, phím giữ slot, nhịp sống không nhân đôi, đóng trang, tab ẩn + rAF dừng.
//   Mục 6 (đi dạo, Task 7): khách cũ chỉ thấy flyers / f; sảnh đi dạo qua màn chọn, người bay hiện thành dù và người đi dạo chạy hiện đúng dáng;
//          dù lượn đã vào bay thấy người đi dạo (1 instance, danh sách "Đi dạo 1/5 · Bay 1/5", nhãn, draw call +1); 5 bot đi dạo → chế độ xem, camera ≤ 8 m,
//          gõ wasd trong ô lời mời không điều khiển gì, lời mời → vào đi, Esc; rời máy khi đi dạo → đếm ngược → xem.
//   Sửa sau review cuối: bot bay thẳng thì dù nội suy đi đều (Mục 1); ?multi= bị bỏ qua khi không có ?test (Mục 2b); Quay lại / Esc ở bước sảnh,
//   Bay một mình hiện cả khi có máy chủ (Mục 3); bị giành chỗ ngay ở sảnh có báo (Mục 4); thông báo mất kết nối / nhường chỗ tự ẩn (Mục 4, 5).
//   Tự spawn `wrangler dev` ở cổng 8799 và luôn kill khi xong hoặc lỗi.
//
//   npm run build && npm run test:multi
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { serveDir, launch, openApp, frames } from './lib.mjs';

const PORT = 8799, HOST = `127.0.0.1:${PORT}`;
const NOIDLE = '&idleMs=600000';   // rời máy sau 10 phút: cho các mục không thử rời máy (chỉ đọc khi có ?test)
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
// Bot bay thẳng theo +X với vận tốc v (m/s), gửi ts = giờ của bot như khách thật
function lineBot(name, v, oz) {
  const ws = new WebSocket(`ws://${HOST}/sky`, { headers: { Origin: 'http://127.0.0.1' } });
  const b = { ws, timer: null }, t0 = Date.now();
  ws.onopen = () => ws.send(JSON.stringify({ t: 'join', name }));
  ws.onmessage = (e) => {
    if (JSON.parse(e.data).t === 'joined' && !b.timer) b.timer = setInterval(() => { const ts = Date.now(); ws.send(JSON.stringify({ t: 'pos', x: Math.round((BASE.x + 60 + v * (ts - t0) / 1000) * 10) / 10, y: BASE.y + 5, z: BASE.z + oz, yaw: 0, bank: 0, ts })); }, 200);
  };
  b.close = () => { clearInterval(b.timer); try { ws.close(); } catch { /* bỏ qua */ } };
  return b;
}

let srv, browser, page;
const bots = [];
const wbots = [];   // bot đi dạo (Mục 6)
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

  // Mục 2b — không có ?test thì ?multi= bị bỏ qua (dùng địa chỉ cấu hình). Mọi WebSocket bị chặn giả, không ra mạng thật
  {
    const Q = await browser.newPage({ viewport: { width: 480, height: 270 } });
    await Q.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    const urls = [];
    await Q.routeWebSocket(/.*/, (ws) => { urls.push(ws.url()); ws.close(); });
    await Q.goto(srv.url + '?chooser&multi=' + encodeURIComponent(`ws://${HOST}/sky`), { waitUntil: 'load', timeout: 180000 });
    await Q.waitForSelector('#chooser', { state: 'visible', timeout: 240000 });
    await Q.click('#chooser [data-pick="glider"]');
    for (let i = 0; i < 40 && !urls.length; i++) await sleep(250);
    check(`Không có ?test: ?multi= bị bỏ qua, WebSocket mở tới địa chỉ cấu hình (${urls.join(', ')})`, urls.length >= 1 && urls.every((u) => !u.includes(HOST)));
    await Q.close();
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
    // Bay một mình hiện cả khi có máy chủ; Esc và nút Quay lại về các thẻ, đóng kết nối, chọn Dù lượn lại vẫn vào sảnh
    // Đếm socket khách tự đóng (close() rồi readyState CLOSING/CLOSED); sự kiện close của Playwright chờ bắt tay đóng với wrangler dev quá lâu
    await L.page.evaluate(() => { window.__wsClosed = 0; const c = WebSocket.prototype.close; WebSocket.prototype.close = function (...a) { c.apply(this, a); if (this.readyState >= 2) window.__wsClosed++; }; });
    const closedNow = () => L.page.evaluate(() => window.__wsClosed);
    const soloOnline = await L.page.evaluate(() => document.getElementById('exMpSolo').getClientRects().length > 0);
    check('Có máy chủ: nút Bay một mình vẫn hiện ở sảnh', soloOnline);
    const backState = () => L.page.evaluate(() => { const c = document.getElementById('chooser'); return { cards: !c.querySelector('.ex-cards').hidden, lobby: !document.getElementById('exMpLobby').hidden, title: !document.getElementById('exTitle').hidden, label: c.getAttribute('aria-labelledby'), session: window.__app.multi.session, open: !c.hidden, focus: document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.pick : null }; });
    const reenter = async (label) => {
      await L.page.click('#chooser [data-pick="glider"]');
      const ok = await L.page.waitForFunction(() => /Còn 2 trên 5/.test(document.getElementById('exMpSeats')?.innerText || '') && !document.getElementById('exMpLobby').hidden, null, { timeout: 30000 }).then(() => true, () => false);
      check(`${label}: chọn Dù lượn lại vào sảnh, "Còn 2 trên 5"`, ok && (await rows()).length === 3);
    };
    const wsBefore = ws3, closedBefore = await closedNow();
    await L.page.keyboard.press('Escape');
    await L.page.waitForFunction(() => window.__app.multi.session === null, null, { timeout: 10000 }).catch(() => {});
    await sleep(500);
    const e1 = await backState(), c1 = await closedNow() - closedBefore;
    check(`Esc ở sảnh: về các thẻ (tiêu đề hiện, aria-labelledby=${e1.label}, focus ${e1.focus}), hộp vẫn mở, phiên đóng, ${c1} WebSocket đóng`, e1.cards && !e1.lobby && e1.title && e1.label === 'exTitle' && e1.session === null && e1.open && e1.focus === 'glider' && c1 === 1);
    await reenter('Sau Esc');
    await L.page.click('#exMpBack');
    await L.page.waitForFunction(() => window.__app.multi.session === null, null, { timeout: 10000 }).catch(() => {});
    await sleep(500);
    const e2 = await backState(), c2 = await closedNow() - closedBefore;
    check(`Nút Quay lại: về các thẻ, phiên đóng, tổng ${c2} WebSocket đóng`, e2.cards && !e2.lobby && e2.title && e2.label === 'exTitle' && e2.session === null && e2.open && c2 === 2);
    await reenter('Sau Quay lại');
    check(`Quay lại rồi vào lại: mỗi lần vào một WebSocket (${ws3 - wsBefore} mới)`, ws3 - wsBefore === 2);
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
  // NOIDLE: các mục không thử rời máy đặt thời gian rời máy rất dài; SwiftShader trên máy chậm có thể 3 s/khung nên 60 s không phím trôi qua giữa chừng và slot bị trả
  const P = await openApp(browser, srv.url + '?multi=' + encodeURIComponent(`ws://${HOST}/sky`) + NOIDLE);
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

  // Bot bay thẳng 15 m/s vào chỗ trống: vị trí nội suy lấy mỗi 50 ms trên đoạn đã nhận phải tiến đều (không đứng rồi vọt)
  bots.push(lineBot('Line', 15, 40));
  await page.waitForFunction(() => [0, 1, 2, 3, 4].some((i) => window.__app.multi.remotes.name(i) === 'Line' && window.__app.multi.remotes.slotState(i)), null, { timeout: 30000 }).catch(() => {});
  await page.evaluate(() => { const s = window.__app.multi.session, o = s.onPos; window.__lastPos = 0; s.onPos = (f) => { window.__lastPos = performance.now(); o(f); }; });
  await sleep(4000);
  const line = await page.evaluate(() => {
    const A = window.__app, R = A.multi.remotes, i = [0, 1, 2, 3, 4].find((k) => R.name(k) === 'Line');
    if (i === undefined) return null;
    const la = window.__lastPos, delay = 2.5 * 1000 / 5, xs = [];
    for (let t = la - 1300; t <= la - 700; t += 50) { R.update(t + delay); const st = R.slotState(i); xs.push(st ? st.pos.x : NaN); }
    R.update(performance.now());
    return xs.slice(1).map((x, k) => x - xs[k]);
  });
  const lineOk = line && line.length >= 10 && line.every((d) => Math.abs(d - 0.75) < 0.2);
  check(`Bot bay thẳng 15 m/s: bước nội suy mỗi 50 ms đều quanh 0,75 m (${line ? line.map((d) => d.toFixed(2)).join(' ') : 'không thấy bot'})`, lineOk);

  check('console không lỗi', P.errors.length === 0);
  if (P.errors.length) console.log(P.errors.join('\n'));

  // Mục 4 (Task 7) — chế độ xem và lời mời vào chỗ trống. Dọn Mục 1 trước để phòng trống
  await page.close();
  bots.splice(0).forEach((b) => b.close());
  await sleep(2000);
  const URLW = srv.url + '?chooser&multi=' + encodeURIComponent(`ws://${HOST}/sky`) + NOIDLE;
  const live = [];
  const addBot = (n) => { const i = live.length; const b = bot(n, 90 + i * 20, (i - 2) * 15); b.name = n; live.push(b); return b; };
  const dropBot = (n) => { const i = live.findIndex((b) => b.name === n); if (i >= 0) live.splice(i, 1)[0].close(); };
  const watchedName = (pg) => pg.evaluate(() => { const A = window.__app, s = A.multi.session; return A.multi.remotes.name(s.watched); });
  const enterWatch = async (pg) => { await pg.waitForSelector('#chooser', { state: 'visible', timeout: 240000 }); await pg.click('#chooser [data-pick="glider"]'); await pg.waitForFunction(() => window.__app.explore.watching, null, { timeout: 30000 }).catch(() => {}); };
  ['W1', 'W2', 'W3', 'W4'].forEach(addBot);
  await sleep(2500);

  // Bị giành chỗ ngay ở sảnh (bấm Bay ngay đúng lúc chỗ cuối có người): sang chế độ xem và báo lý do
  {
    const X = await openApp(browser, URLW);
    await X.page.waitForSelector('#chooser', { state: 'visible', timeout: 240000 });
    await X.page.click('#chooser [data-pick="glider"]');
    await X.page.waitForFunction(() => /Còn 1 trên 5/.test(document.getElementById('exMpSeats')?.innerText || ''), null, { timeout: 30000 }).catch(() => {});
    await X.page.evaluate(() => { const s = window.__app.multi.session; const orig = s.recv; s.recv = function (m) { if (m.t === 'lobby') return; return orig.call(this, m); }; });
    addBot('W5');
    await sleep(1500);
    await X.page.fill('#exMpNameIn', 'Kha');
    await X.page.click('#exMpFly');
    await X.page.waitForFunction(() => window.__app.explore.watching, null, { timeout: 30000, polling: 100 }).catch(() => {});
    await X.page.waitForFunction(() => { const n = document.getElementById('exMpNotice'); return n.getClientRects().length > 0 && n.innerText.trim().length > 0; }, null, { timeout: 10000, polling: 100 }).catch(() => {});   // polling theo thời gian: khung SwiftShader chậm hơn cả lateMs
    const xl = await X.page.evaluate(() => { const n = document.getElementById('exMpNotice'); return { phase: window.__app.multi.session.phase, notice: window.__app.multi.session.notice, txt: n.innerText, vis: n.getClientRects().length > 0 }; });
    check(`Bị giành chỗ ở sảnh: sang xem và báo "${xl.txt}"`, xl.phase === 'watching' && xl.notice === 'late' && xl.vis && /giành trước/.test(xl.txt));
    check('Lỗi console của trang bị giành chỗ ở sảnh = 0', X.errors.length === 0);
    await X.page.close();
  }

  const W = await openApp(browser, URLW);
  await enterWatch(W.page);
  await W.page.waitForFunction(() => [0, 1, 2, 3, 4].filter((i) => window.__app.multi.remotes.slotState(i)).length === 5, null, { timeout: 60000 }).catch(() => {});
  await frames(W.page, 20);
  const w0 = await W.page.evaluate(() => { const A = window.__app, s = A.multi.session, el = document.getElementById('exMpWatch'); return { watching: A.explore.watching, active: A.explore.active(), mode: A.cam.mode, phase: s.phase, text: el.innerText, vis: el.getClientRects().length > 0, own: A.explore.glider, st: A.explore.state, body: document.body.classList.contains('explore'), chooser: document.getElementById('chooser').hidden, inviteHidden: document.getElementById('exMpInvite').getClientRects().length === 0 }; });
  const wn0 = await watchedName(W.page);
  check(`5 bot: Dù lượn vào thẳng chế độ xem, dòng "${w0.text}" có tên "${wn0}", không dù của mình, không có lời mời`, w0.watching && !w0.active && w0.mode === 'glider' && w0.phase === 'watching' && w0.vis && w0.text.includes(wn0) && /Đang xem/.test(w0.text) && w0.own === null && w0.st === null && w0.body && w0.chooser && w0.inviteHidden);
  const poses = () => W.page.evaluate(() => { const R = window.__app.multi.remotes, o = {}; for (let i = 0; i < 5; i++) { const st = R.slotState(i); if (st) o[i] = [st.pos.x, st.pos.y, st.pos.z]; } return o; });
  const before = await poses();
  for (const k of ['w', 'a', 's', 'd', 'ArrowUp', 'q']) await W.page.keyboard.press(k);
  await frames(W.page, 5);
  const after0 = await poses();
  const k0 = await W.page.evaluate(() => ({ keys: window.__app.keys.size, state: window.__app.explore.state, own: window.__app.explore.glider }));
  check('Xem: phím WASD/mũi tên/Q không đổi vị trí dù nào, keys rỗng, không có dù của mình', JSON.stringify(before) === JSON.stringify(after0) && k0.keys === 0 && k0.state === null && k0.own === null);

  // Draw call: cùng một tư thế camera, 0 và 5 dù người khác
  const dc = await W.page.evaluate((B) => {
    const A = window.__app, R = A.multi.remotes, { renderer, scene, camera } = A;
    const gs = [0, 1, 2, 3, 4].map((i) => R.group(i)).filter(Boolean);
    camera.position.set(B.x - 60, B.y + 25, B.z + 10); camera.lookAt(B.x + 130, B.y, B.z); camera.updateMatrixWorld(true);
    const meas = () => { renderer.render(scene, camera); renderer.info.reset(); renderer.render(scene, camera); return renderer.info.render.calls; };
    const withB = meas(); gs.forEach((g) => { g.visible = false; }); const without = meas(); gs.forEach((g) => { g.visible = true; });
    return { withB, without, n: gs.length };
  }, BASE);
  check(`Draw call ${dc.without} (0 bot) -> ${dc.withB} (${dc.n} bot) cùng tư thế camera: chênh ${dc.withB - dc.without} ≤ +5`, dc.n === 5 && dc.withB - dc.without <= 5 && dc.withB - dc.without >= 1);

  // Một bot (không phải người đang xem) rời: hiện lời mời, camera vẫn bám
  const gone = ['W1', 'W2', 'W3', 'W4', 'W5'].find((n) => n !== wn0);
  dropBot(gone);
  await W.page.waitForFunction(() => document.getElementById('exMpInvite').getClientRects().length > 0, null, { timeout: 15000 }).catch(() => {});
  await frames(W.page, 15);
  const inv = await W.page.evaluate(() => { const A = window.__app, s = A.multi.session, st = A.multi.remotes.slotState(s.watched), c = A.camera.position; return { text: document.getElementById('exMpWatch').innerText, invite: s.invite, input: document.getElementById('exMpInviteName').getClientRects().length > 0, msg: document.getElementById('exMpInvite').innerText, dist: st ? Math.hypot(st.pos.x - c.x, st.pos.y - c.y, st.pos.z - c.z) : -1, hasState: !!st }; });
  check(`Một bot rời: lời mời "${inv.msg.replace(/\n/g, ' ')}", ô tên hiện (chưa nhớ tên), vẫn xem "${wn0}", camera cách dù ${Math.round(inv.dist)} m`, inv.invite && inv.input && inv.text.includes(wn0) && inv.hasState && inv.dist > 0 && inv.dist < 300);

  // Gõ wasd trong ô tên của lời mời (ô chỉ hiện khi chưa có tên hợp lệ nên làm trước lần bấm mời)
  await W.page.click('#exMpInviteName');
  await W.page.keyboard.type('wasd');
  await frames(W.page, 3);
  const typed = await W.page.evaluate(() => ({ v: document.getElementById('exMpInviteName').value, keys: window.__app.keys.size, watching: window.__app.explore.watching }));
  check(`Gõ wasd trong ô tên lời mời: ô nhận "${typed.v}", keys rỗng (${typed.keys}), vẫn xem`, typed.v === 'wasd' && typed.keys === 0 && typed.watching);
  await W.page.fill('#exMpInviteName', '');

  // Bot khác giành trước: chặn bản tin lobby ở khách để lời mời còn cũ, rồi bot mới vào kịp trước khi bấm
  await W.page.evaluate(() => { const s = window.__app.multi.session; const orig = s.recv; s.recv = function (m) { if (m.t === 'lobby') return; return orig.call(this, m); }; });
  addBot('Late');
  await sleep(1000);
  await W.page.fill('#exMpInviteName', 'Mai');
  await W.page.click('#exMpInviteFly');
  await W.page.waitForFunction(() => { const n = document.getElementById('exMpNotice'); return !n.hidden && n.innerText.trim().length > 0; }, null, { timeout: 15000 }).catch(() => {});
  const late = await W.page.evaluate(() => { const A = window.__app, n = document.getElementById('exMpNotice'); delete A.multi.session.recv; return { txt: n.innerText, phase: A.multi.session.phase, watching: A.explore.watching, btn: document.getElementById('exMpInviteFly').disabled }; });
  check(`Bot khác giành trước: hiện "${late.txt}", vẫn xem, nút mở lại`, /giành trước/.test(late.txt) && late.phase === 'watching' && late.watching && late.btn === false);

  // Người đang xem rời: dòng Đang xem đổi tên khác trong 1 giây
  const wn1 = await watchedName(W.page);
  const textBefore = await W.page.evaluate(() => document.getElementById('exMpWatch').innerText);
  dropBot(wn1);
  const changed = await W.page.waitForFunction((old) => { const t = document.getElementById('exMpWatch').innerText; return t && t !== old; }, textBefore, { timeout: 1000, polling: 50 }).then(() => true, () => false);
  const wn2 = await watchedName(W.page);
  check(`Người đang xem ("${wn1}") rời: đổi sang "${wn2}" trong 1 giây`, changed && wn2 && wn2 !== wn1);

  // Esc khi xem: thoát
  await Promise.all([W.page.waitForNavigation({ timeout: 90000 }).catch(() => null), W.page.keyboard.press('Escape')]);
  check('Esc khi xem: thoát, trang tải lại không còn ?chooser', !/chooser/.test(W.page.url()));
  check('Lỗi console của trang xem = 0', W.errors.length === 0);
  if (W.errors.length) console.log(W.errors.join('\n'));
  await W.page.close();

  // Bấm mời khi có chỗ: bay được (trang mới, phòng đầy rồi một bot rời)
  addBot('Y');
  await sleep(2500);
  const F = await openApp(browser, URLW);
  await enterWatch(F.page);
  dropBot(live[0].name);
  await F.page.waitForFunction(() => document.getElementById('exMpInvite').getClientRects().length > 0, null, { timeout: 15000 }).catch(() => {});
  await F.page.evaluate(() => { const s = window.__app.multi.session; window.__joins = 0; const j = s.join.bind(s); s.join = (n) => { window.__joins++; j(n); }; });
  // Tên bị máy chủ từ chối: ô nhập hiện lại (trống), không gửi lại tên đó, không nhớ; tên đã nhớ mà bị từ chối cũng vậy
  const badState = () => F.page.evaluate(() => { const i = document.getElementById('exMpInviteName'), b = document.getElementById('exMpInviteFly'); return { input: i.getClientRects().length > 0, v: i.value, off: b.disabled, joins: window.__joins, ls: localStorage.getItem('exMpName'), phase: window.__app.multi.session.phase }; });
  const waitBad = (n) => F.page.waitForFunction((k) => window.__joins === k && window.__app.multi.session.notice === 'nameBad', n, { timeout: 15000 }).catch(() => {});
  await F.page.fill('#exMpInviteName', 'fuck');
  await F.page.click('#exMpInviteFly');
  await waitBad(1); await frames(F.page, 3);
  const nb1 = await badState();
  check(`Tên bị từ chối: ô nhập hiện lại và trống, nút tắt, ${nb1.joins} join, chưa nhớ ("${nb1.ls}"), vẫn xem`, nb1.input && nb1.v === '' && nb1.off && nb1.joins === 1 && nb1.ls !== 'fuck' && nb1.phase === 'watching');
  await F.page.evaluate(() => { localStorage.setItem('exMpName', 'dit'); document.getElementById('exMpInviteName').dispatchEvent(new Event('input')); });
  await F.page.click('#exMpInviteFly');
  await waitBad(2); await frames(F.page, 3);
  const nb2 = await badState();
  check(`Tên đã nhớ bị từ chối: ô nhập hiện lại, tên bị xóa khỏi bộ nhớ ("${nb2.ls}"), ${nb2.joins} join`, nb2.input && nb2.v === '' && nb2.off && nb2.joins === 2 && !nb2.ls);
  await F.page.fill('#exMpInviteName', 'Mai');
  await F.page.dblclick('#exMpInviteFly');
  await F.page.waitForFunction(() => window.__app.explore.active() && window.__app.multi.session.phase === 'flying', null, { timeout: 60000 }).catch(() => {});
  await frames(F.page, 5);
  const fl = await F.page.evaluate(() => { const A = window.__app, g = A.explore.glider, R = A.multi.remotes; return { slot: A.multi.session.mySlot, joins: window.__joins, own: !!g && g.visible && !!g.parent && ![0, 1, 2, 3, 4].some((i) => R.group(i) === g), cls: document.body.classList.contains('ex-watching'), inv: document.getElementById('exMpInvite').getClientRects().length === 0 && document.getElementById('exMpWatch').getClientRects().length === 0, roster: document.getElementById('exMpRoster').innerText, ls: localStorage.getItem('exMpName'), st: !!A.explore.state }; });
  check(`Bấm mời khi có chỗ: bay được, slot ${fl.slot}, dù riêng của mình, giao diện xem gỡ, roster có Mai, ${fl.joins} lần join (2 bị từ chối + 1) dù bấm đúp, tên đã nhớ sau khi vào`, fl.slot >= 0 && fl.own && fl.st && !fl.cls && fl.inv && fl.roster.includes('Mai') && fl.joins === 3 && fl.ls === 'Mai');

  // Mô phỏng máy chủ tắt bằng cách gọi onClose của kết nối (bắt tay đóng WebSocket với wrangler dev quá chậm để chờ)
  // Máy chủ tắt khi bay: vẫn bay, người khác biến mất, có exMpLost
  await F.page.evaluate(() => window.__app.multi.session.t.onClose());
  await F.page.waitForFunction(() => window.__app.multi.session.phase === 'solo', null, { timeout: 15000, polling: 100 }).catch(() => {});
  await frames(F.page, 1);   // một khung: thông báo chỉ hiện noticeMs 8 s, khung SwiftShader chậm có thể 3 s
  const fl2 = await F.page.evaluate(() => { const A = window.__app, n = document.getElementById('exMpNotice'); return { active: A.explore.active(), others: [0, 1, 2, 3, 4].filter((i) => A.multi.remotes.slotState(i) || A.multi.remotes.group(i)).length, txt: n.innerText, shown: n.getClientRects().length > 0, roster: document.getElementById('exMpRoster').getClientRects().length > 0 }; });
  check(`Máy chủ tắt khi bay: vẫn bay, ${fl2.others} dù người khác, thông báo "${fl2.txt}"`, fl2.active && fl2.others === 0 && fl2.shown && /Mất kết nối/.test(fl2.txt) && !fl2.roster);
  const lostGone = await F.page.waitForFunction(() => document.getElementById('exMpNotice').getClientRects().length === 0, null, { timeout: 14000 }).then(() => true, () => false);
  check('Thông báo mất kết nối khi bay tự ẩn sau vài giây', lostGone && await F.page.evaluate(() => window.__app.explore.active()));
  check('Lỗi console của trang bay = 0', F.errors.length === 0);
  if (F.errors.length) console.log(F.errors.join('\n'));
  await F.page.close();   // đóng trang bay trước khi mở trang khác: SwiftShader dùng chung CPU
  // Chờ máy chủ trả chỗ của trang vừa đóng (bắt tay đóng với wrangler dev có thể chậm): nếu Z vào lúc phòng còn đủ 5 thì bị từ chối và trang sau không vào chế độ xem
  await new Promise((ok) => {
    const ws = new WebSocket(`ws://${HOST}/sky`, { headers: { Origin: 'http://127.0.0.1' } });
    const done = () => { clearTimeout(tm); try { ws.close(); } catch { /* bỏ qua */ } ok(); };
    const tm = setTimeout(done, 20000);
    ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.t === 'lobby' && m.flyers.length <= 4) done(); };
  });
  addBot('Z');   // phòng lại đủ 5 (4 bot + Z) để trang tiếp theo vào thẳng chế độ xem
  await sleep(2500);

  // Máy chủ tắt khi xem: quay về màn chọn và hiện exMpLost (phòng đủ 5)
  const L = await openApp(browser, URLW);
  await enterWatch(L.page);
  await Promise.all([L.page.waitForNavigation({ timeout: 90000 }).catch(() => null), L.page.evaluate(() => window.__app.multi.session.t.onClose())]);
  const flag = await L.page.evaluate(() => sessionStorage.getItem('exMpNotice'));
  check(`Máy chủ tắt khi xem: gọi thoát (trang tải lại), cờ sessionStorage "${flag}"`, flag === 'lost' && !/chooser/.test(L.page.url()));
  await L.page.goto(srv.url + '?chooser&test&multi=' + encodeURIComponent('ws://127.0.0.1:9/sky'), { waitUntil: 'load' });
  await L.page.waitForFunction(() => window.__app && document.getElementById('loading')?.classList.contains('done'), null, { timeout: 180000 });
  await L.page.waitForSelector('#chooser', { state: 'visible', timeout: 240000 });
  const lost = await L.page.evaluate(() => ({ txt: document.getElementById('exMpLostNote').innerText, shown: document.getElementById('exMpLostNote').getClientRects().length > 0, flag: sessionStorage.getItem('exMpNotice') }));
  check(`Màn chọn hiện "${lost.txt}" một lần (cờ đã xóa: ${lost.flag}), không nói "bay một mình"`, lost.shown && /Mất kết nối/.test(lost.txt) && /Chọn Dù lượn/.test(lost.txt) && !/một mình/.test(lost.txt) && lost.flag === null);
  await L.page.close();

  // Mục 5 (Task 8) — rời máy. Dọn bot Mục 4 để phòng trống, một ws chỉ nghe sảnh để đếm số người bay
  live.splice(0).forEach((b) => b.close());
  await sleep(2500);
  const obs = { n: -1 }; const ows = new WebSocket(`ws://${HOST}/sky`, { headers: { Origin: 'http://127.0.0.1' } });
  ows.onmessage = (e) => { const m = JSON.parse(e.data); if (m.t === 'lobby') obs.n = m.flyers.length; };
  const lobbyIs = async (n, ms) => { for (let t0 = Date.now(); Date.now() - t0 < ms; await sleep(100)) if (obs.n === n) return true; return obs.n === n; };
  check('Phòng trống trước Mục 5 (ws quan sát thấy 0 người bay)', await lobbyIs(0, 8000));
  const URLI = srv.url + '?multi=' + encodeURIComponent(`ws://${HOST}/sky`);
  const idleVis = (pg) => pg.evaluate(() => document.getElementById('exMpIdle').getClientRects().length > 0);

  // 5a-5c: không phím -> đếm ngược -> chuyển xem; camera đứng yên; lời mời dùng được; vào bay lại không bị hỏi ngay
  const I = await openApp(browser, URLI + '&idleMs=7000&idleWarnMs=4000');
  await I.page.evaluate(() => {   // gắn máy đo TRƯỚC khi bay (khung đầu SwiftShader có thể chậm hơn cả thời gian rời máy): chữ đếm ngược, tin hb, vị trí camera cuối khi còn bay
    const A = window.__app; window.__hb = 0; window.__camLast = null; window.__idleTexts = [];
    const el = document.getElementById('exMpIdle');
    new MutationObserver(() => { if (!el.hidden && el.textContent) window.__idleTexts.push(el.textContent); }).observe(el, { childList: true, characterData: true, subtree: true, attributes: true });
    const nt = document.getElementById('exMpNotice'); window.__noticeTexts = [];   // thông báo nay tự ẩn sau noticeMs: ghi lại lúc hiện, khung SwiftShader chậm có thể làm lần đọc sau trễ hơn
    new MutationObserver(() => { if (!nt.hidden && nt.textContent) window.__noticeTexts.push(nt.textContent); }).observe(nt, { childList: true, characterData: true, subtree: true, attributes: true });
    const wrap = setInterval(() => { const t = A.multi.session && A.multi.session.t; if (!t) return; clearInterval(wrap); const send = t.send.bind(t); t.send = (m) => { if (m.t === 'hb') window.__hb++; send(m); }; }, 20);
    const rec = () => { const s = A.multi.session; if (s && s.phase === 'flying') window.__camLast = A.camera.position.toArray(); requestAnimationFrame(rec); }; rec();
    A.multi.fly('Idle');
  });
  await I.page.waitForFunction(() => window.__app.explore.active() && window.__app.multi.session.phase === 'flying', null, { timeout: 60000 });
  await I.page.keyboard.press('a');   // đặt lại đồng hồ rời máy sau khung đầu chậm (SwiftShader ~0,5 s/khung); từ đây không phím nào nữa
  check('Bay một mình: ws quan sát thấy 1 người bay', await lobbyIs(1, 5000));
  await I.page.waitForFunction(() => window.__app.multi.session.phase === 'watching', null, { timeout: 20000 }).catch(() => {});
  const warnTxts = await I.page.evaluate(() => window.__idleTexts);
  check(`Không phím: hiện đếm ngược ("${warnTxts[0]}" ... "${warnTxts.at(-1)}", ${warnTxts.length} lần đổi chữ, có số giây giảm dần)`, warnTxts.length >= 2 && warnTxts.every((x) => /^Bạn còn đó không\? \d+ giây$/.test(x)) && Number(warnTxts[0].match(/\d+/)[0]) > Number(warnTxts.at(-1).match(/\d+/)[0]));
  await frames(I.page, 10);
  const rel = await I.page.evaluate(() => { const A = window.__app, s = A.multi.session, c = A.camera.position.toArray(), l = window.__camLast; return { phase: s.phase, watching: A.explore.watching, st: A.explore.state, glider: A.explore.glider && A.explore.glider.visible, keys: A.keys.size, notice: window.__noticeTexts.find((x) => /đứng yên/.test(x)) || '', noticeVis: window.__noticeTexts.some((x) => /đứng yên/.test(x)), idle: document.getElementById('exMpIdle').getClientRects().length > 0, inv: document.getElementById('exMpInvite').getClientRects().length > 0, sn: s.notice, dist: l ? Math.hypot(c[0] - l[0], c[1] - l[1], c[2] - l[2]) : -1, body: document.body.classList.contains('ex-watching') }; });
  check(`Hết giờ: sang chế độ xem, thông báo "${rel.notice}", đếm ngược ẩn, camera lệch ${rel.dist.toFixed(2)} m so với lúc còn bay, không dù riêng`, rel.phase === 'watching' && rel.watching && rel.st === null && !rel.glider && rel.sn === 'released' && rel.noticeVis && /đứng yên/.test(rel.notice) && !rel.idle && rel.body && rel.dist >= 0 && rel.dist < 2);
  check('Lobby máy chủ giảm một người (1 -> 0)', await lobbyIs(0, 4000));
  check('Lời mời hiện sau khi nhường chỗ', rel.inv);
  const hbWatch = await I.page.evaluate(async () => { const a = window.__hb; await new Promise((r) => setTimeout(r, 3500)); return window.__hb - a; });
  check(`Đang xem: không còn nhịp sống (${hbWatch} hb trong 3,5 s)`, hbWatch === 0);
  const relGone = await I.page.waitForFunction(() => document.getElementById('exMpNotice').getClientRects().length === 0, null, { timeout: 12000 }).then(() => true, () => false);
  check('Thông báo nhường chỗ tự ẩn sau vài giây, vẫn xem, lời mời còn', relGone && await I.page.evaluate(() => window.__app.explore.watching && document.getElementById('exMpInvite').getClientRects().length > 0));
  await I.page.click('#exMpInviteFly');
  await I.page.waitForFunction(() => window.__app.explore.active() && window.__app.multi.session.phase === 'flying', null, { timeout: 30000 }).catch(() => {});
  const t0 = Date.now();
  const re = await I.page.evaluate(() => ({ phase: window.__app.multi.session.phase, active: window.__app.explore.active(), idle: document.getElementById('exMpIdle').getClientRects().length > 0, ex: document.body.classList.contains('ex-watching') }));
  check('Bấm lời mời sau khi nhường chỗ: bay lại được, chưa bị hỏi "Bạn còn đó không?" ngay', re.phase === 'flying' && re.active && !re.idle && !re.ex && await lobbyIs(1, 4000));

  // 5d: bấm phím lúc đếm ngược giữ slot; 5e: nhịp sống không nhân đôi sau khi vào bay lại
  await I.page.waitForFunction(() => document.getElementById('exMpIdle').getClientRects().length > 0, null, { timeout: 8000, polling: 100 }).catch(() => {});
  const shown2 = await idleVis(I.page);
  await I.page.keyboard.press('a');
  // đo ngay (polling theo thời gian): chờ 3 khung SwiftShader chậm có thể lâu hơn idleMs 7 s và đếm ngược hiện lại đúng luật
  const hidAfterKey = await I.page.waitForFunction(() => document.getElementById('exMpIdle').getClientRects().length === 0, null, { timeout: 3000, polling: 50 }).then(() => true, () => false);
  const hb0 = await I.page.evaluate(() => window.__hb), hbT0 = Date.now();
  let still = true;
  for (let i = 0; i < 24; i++) { await I.page.keyboard.press(i % 2 ? 'w' : 'ArrowLeft'); await sleep(400); if (obs.n !== 1) still = false; }
  const live2 = await I.page.evaluate(() => ({ phase: window.__app.multi.session.phase, hb: window.__hb }));
  const hbN = live2.hb - hb0;
  check(`Bấm phím lúc đếm ngược: đếm ngược ẩn, giữ slot qua ${((Date.now() - t0) / 1000).toFixed(0)} s (quá hạn 3 s nhiều lần), lobby vẫn 1 người`, shown2 && hidAfterKey && live2.phase === 'flying' && still);
  // khoảng đo là thời gian thật của vòng bấm phím (≥ 9,6 s; trang SwiftShader chậm thì mỗi lần bấm lâu hơn): nhân đôi sẽ gần gấp đôi số chu kỳ
  const hbSec = (Date.now() - hbT0) / 1000, hbLo = Math.max(1, Math.floor(hbSec / 3) - 1), hbHi = Math.ceil(hbSec / 3) + 1;
  check(`Vào bay lại từ lời mời: nhịp sống không nhân đôi (${hbN} hb trong ${hbSec.toFixed(1)} s, chu kỳ 3 s => ${hbLo} đến ${hbHi})`, hbN >= hbLo && hbN <= hbHi);
  check('Lỗi console của trang rời máy = 0', I.errors.length === 0);
  if (I.errors.length) console.log(I.errors.join('\n'));
  await I.page.close();
  await lobbyIs(0, 6000);

  // 5f: đóng trang đang bay: bot thấy lobby giảm trong 3 s
  const C = await openApp(browser, URLI);
  await C.page.evaluate(() => window.__app.multi.fly('Closer'));
  await C.page.waitForFunction(() => window.__app.explore.active() && window.__app.multi.session.phase === 'flying', null, { timeout: 60000 });
  const sawOne = await lobbyIs(1, 5000);
  await C.page.close();
  check('Đóng trang đang bay: ws quan sát thấy lobby giảm về 0 trong 3 s', sawOne && await lobbyIs(0, 3000));

  // 5g: tab ẩn + rAF dừng 23 s (lâu hơn slotTimeoutMs 10 s + một chu kỳ quét 10 s): chỉ nhịp sống giữ slot; quay lại không lỗi
  const H = await openApp(browser, URLI);
  await H.page.evaluate(() => window.__app.multi.fly('Hidden'));
  await H.page.waitForFunction(() => window.__app.explore.active() && window.__app.multi.session.phase === 'flying', null, { timeout: 60000 });
  await lobbyIs(1, 5000);
  await H.page.evaluate(() => {
    const raf = window.requestAnimationFrame.bind(window); window.__raf = raf; window.__held = [];
    window.requestAnimationFrame = (cb) => { window.__held.push(cb); return 0; };
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await sleep(23000);
  const keptHidden = obs.n === 1;
  const phaseHidden = await H.page.evaluate(() => window.__app.multi.session.phase);
  await H.page.evaluate(() => {
    delete document.hidden; delete document.visibilityState;
    document.dispatchEvent(new Event('visibilitychange'));
    window.requestAnimationFrame = window.__raf; const h = window.__held.splice(0); h.forEach((cb) => window.__raf(cb));
  });
  await frames(H.page, 20);
  const back = await H.page.evaluate(() => ({ phase: window.__app.multi.session.phase, active: window.__app.explore.active() }));
  check(`Tab ẩn và rAF dừng 23 s: slot còn (lobby ${obs.n}, phase ${phaseHidden}); quay lại vẫn bay, console không lỗi`, keptHidden && phaseHidden === 'flying' && back.phase === 'flying' && back.active && H.errors.length === 0);
  if (H.errors.length) console.log(H.errors.join('\n'));
  await H.page.close();
  try { ows.close(); } catch { /* bỏ qua */ }
  await sleep(2000);

  // Mục 6 (Task 7, đi dạo) — người đi dạo và người bay thấy nhau, sảnh đi dạo, chế độ xem, lời mời, ô tên, khách cũ, rời máy
  const URLC = srv.url + '?chooser&multi=' + encodeURIComponent(`ws://${HOST}/sky`);
  const RUN_AMP = 0.6;   // CONFIG.people.run.amp: biên độ hông khi chạy (rad)
  const peopleOn = (pg) => pg.evaluate(() => { const m = window.__app.scene.getObjectByName('stroll-people'); if (!m) return { has: false, n: 0, vis: false }; const M = new window.__app.THREE.Matrix4(); let n = 0; for (let i = 0; i < m.count; i++) { m.getMatrixAt(i, M); if (Math.abs(M.determinant()) > 1e-9) n++; } return { has: true, n, vis: m.visible }; });
  const walkCard = async (pg) => { await pg.waitForSelector('#chooser', { state: 'visible', timeout: 240000 }); await pg.click('#chooser [data-pick="walk"]'); };
  const walkTo = async (pg, name) => {   // sảnh đi dạo → nhập tên → Đi dạo ngay → đang đi với slot
    await pg.waitForFunction(() => /Còn \d trên 5 chỗ đi dạo/.test(document.getElementById('exMpSeats')?.innerText || ''), null, { timeout: 30000 }).catch(() => {});
    await pg.fill('#exMpNameIn', name);
    await pg.click('#exMpFly');
    await pg.waitForFunction(() => window.__app.stroll.stroll.active() && window.__app.multi.session.phase === 'flying', null, { timeout: 60000 }).catch(() => {});
  };
  /* Bot đi dạo: join kind 'walk', đứng tại (x, y, z) gửi pose 5 lần/s; b.slot = slot được cấp */
  function walkBot(name, x, y, z, pose) {
    const ws = new WebSocket(`ws://${HOST}/sky`, { headers: { Origin: 'http://127.0.0.1' } });
    const b = { ws, timer: null, name, slot: -1 };
    ws.onopen = () => ws.send(JSON.stringify({ t: 'join', name, kind: 'walk' }));
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.t === 'joined' && !b.timer) { b.slot = m.slot; b.timer = setInterval(() => ws.send(JSON.stringify({ t: 'pos', x, y, z, yaw: 0, pose, ts: Date.now() })), 200); }
    };
    b.close = () => { clearInterval(b.timer); try { ws.close(); } catch { /* bỏ qua */ } };
    wbots.push(b);
    return b;
  }
  const dropW = (b) => { b.close(); const i = wbots.indexOf(b); if (i >= 0) wbots.splice(i, 1); };

  // 6d — bot giả khách cũ (join không kind, chỉ đọc flyers / f) cùng phòng với 2 bot đi dạo (Review Focus 4)
  {
    const oldMsgs = [];
    const ows2 = new WebSocket(`ws://${HOST}/sky`, { headers: { Origin: 'http://127.0.0.1' } });
    let oldTimer = null;
    ows2.onopen = () => ows2.send(JSON.stringify({ t: 'join', name: 'Cu' }));
    ows2.onmessage = (e) => { const m = JSON.parse(e.data); oldMsgs.push(m); if (m.t === 'joined' && !oldTimer) oldTimer = setInterval(() => ows2.send(JSON.stringify({ t: 'pos', x: 300, y: 120, z: 0, yaw: 0, bank: 0 })), 200); };
    const a = walkBot('DaoA', -230, 8, 17.4, 1), b = walkBot('DaoB', -226, 8, 17.4, 2);
    await sleep(3000);
    const lob = oldMsgs.filter((m) => m.t === 'lobby'), pos = oldMsgs.filter((m) => m.t === 'pos'), jn = oldMsgs.find((m) => m.t === 'joined');
    const lastLob = lob.at(-1) || { flyers: [] };
    const okLob = lob.length >= 2 && lob.every((m) => Array.isArray(m.flyers) && m.flyers.every((f) => typeof f.slot === 'number' && typeof f.name === 'string' && f.name !== 'DaoA' && f.name !== 'DaoB'));
    const okPos = pos.length >= 3 && pos.every((m) => Array.isArray(m.f) && m.f.every((r) => Array.isArray(r) && r.length >= 6 && r[2] >= 7));   // f chỉ có người bay (y ≥ sàn bay 7 m); người đi dạo ở trường w
    const sawW = pos.some((m) => Array.isArray(m.w) && m.w.length > 0);
    check(`6d khách cũ: ${lob.length} lobby, flyers cuối ${JSON.stringify(lastLob.flyers)} không có người đi dạo; ${pos.length} gói pos đều có f kiểu cũ, f không có người đi dạo (w riêng: ${sawW}); joined ${JSON.stringify(jn)}`,
      okLob && okPos && sawW && jn && jn.slot === 0 && !('kind' in jn) && lastLob.flyers.length === 1 && lastLob.flyers[0].name === 'Cu');
    clearInterval(oldTimer); try { ows2.close(); } catch { /* bỏ qua */ }
    dropW(a); dropW(b);
    await sleep(2000);
  }

  // 6b — trang đi dạo qua màn chọn: sảnh "Còn 5 trên 5 chỗ đi dạo", vào đi; bot bay hiện thành dù, bot đi dạo thứ hai hiện thành người chạy
  const GY = {};   // cao độ đứng thật tại các chỗ đặt bot (đọc từ bản đồ đi dạo của trang này)
  {
    const S = await openApp(browser, URLC + NOIDLE);
    await walkCard(S.page);
    await S.page.waitForFunction(() => /Còn 5 trên 5 chỗ đi dạo/.test(document.getElementById('exMpSeats')?.innerText || ''), null, { timeout: 30000 }).catch(() => {});
    const seats = await S.page.evaluate(() => ({ seats: document.getElementById('exMpSeats').innerText, go: document.getElementById('exMpFly').innerText, sky: document.getElementById('exMpSky').innerText }));
    check(`6b bấm thẻ Đi dạo: sảnh "${seats.sky}", "${seats.seats}", nút "${seats.go}"`, seats.seats === 'Còn 5 trên 5 chỗ đi dạo' && seats.go === 'Đi dạo ngay' && seats.sky === 'Sông Hàn, Đà Nẵng');
    await walkTo(S.page, 'Dao');
    const me = await S.page.evaluate(() => { const A = window.__app, s = A.stroll.stroll.state, x = []; for (const [px, pz] of [[-230, 17.4], [-226, 17.4], [-238, 17.4], [-234, 17.4], [-222, 17.4], [-218, 17.4]]) x.push([px, A.stroll.stGroundY(A.stroll.stroll.map, px, pz)]); return { slot: A.multi.session.mySlot, kind: A.multi.session.kind, x: s.x, z: s.z, gy: x, hidden: document.getElementById('chooser').hidden, roster: document.getElementById('exMpRoster').innerText }; });
    for (const [px, y] of me.gy) GY[px] = Math.round(y * 100) / 100;
    check(`6b vào đi dạo: slot ${me.slot}, xuất phát (${me.x.toFixed(2)}, ${me.z.toFixed(2)}) lệch theo slot, hộp đóng, danh sách "${me.roster.replace(/\n/g, ' | ')}"`, me.kind === 'walk' && me.slot === 0 && Math.abs(me.x - (-240 + 2.5 * (0 - 2))) < 0.5 && me.hidden && /Đi dạo 1\/5 · Bay 0\/5/.test(me.roster) && me.roster.includes('Dao'));
    const flyB = bot('BayB', 90, 0); bots.push(flyB);
    const runB = walkBot('ChayB', -230, GY[-230], 17.4, 2);
    await S.page.waitForFunction(() => { const A = window.__app; return [0, 1, 2, 3, 4].some((i) => A.multi.remotes.slotState(i)) && [1, 2, 3, 4].some((i) => A.stroll.avatars.slotState(i)); }, null, { timeout: 60000 }).catch(() => {});
    await frames(S.page, 5);
    const r = await S.page.evaluate(() => {
      const A = window.__app, R = A.multi.remotes, V = A.stroll.avatars, m = V.mesh, a = m.geometry.attributes.aVar.array;
      const fi = [0, 1, 2, 3, 4].find((i) => R.slotState(i)), wi = [1, 2, 3, 4].find((i) => V.slotState(i));
      const g = fi === undefined ? null : R.group(fi);
      return { fly: fi === undefined ? null : R.name(fi), gVis: !!g && g.visible && !!g.parent, walk: wi === undefined ? null : V.name(wi), pose: wi === undefined ? -1 : V.slotState(wi).pose, amp: wi === undefined ? 0 : a[wi * 4 + 1], cad: wi === undefined ? 0 : a[wi * 4 + 3],
        roster: document.getElementById('exMpRoster').innerText, sent: null };
    });
    check(`6b bot bay "${r.fly}" hiện thành dù (${r.gVis}); bot đi dạo "${r.walk}" hiện thành người, pose ${r.pose}, biên độ hông ${r.amp.toFixed(2)} (chạy ${RUN_AMP}), nhịp ${r.cad.toFixed(1)}`, r.fly === 'BayB' && r.gVis && r.walk === 'ChayB' && r.pose === 2 && Math.abs(r.amp - RUN_AMP) < 1e-3 && r.cad > 0);
    check(`6b danh sách hai nhóm "${r.roster.replace(/\n/g, ' | ')}"`, /Đi dạo 2\/5 · Bay 1\/5/.test(r.roster) && r.roster.includes('ChayB') && r.roster.includes('BayB'));
    // Mình gửi vị trí có pose: bot quan sát nhận w có slot của mình
    const seen = await new Promise((ok) => {
      const ws = new WebSocket(`ws://${HOST}/sky`, { headers: { Origin: 'http://127.0.0.1' } });
      const t = setTimeout(() => { try { ws.close(); } catch { /* bỏ qua */ } ok(null); }, 8000);
      ws.onmessage = (e) => { const m = JSON.parse(e.data); const row = m.t === 'pos' && Array.isArray(m.w) ? m.w.find((x) => x[0] === 0) : null; if (row) { clearTimeout(t); try { ws.close(); } catch { /* bỏ qua */ } ok(row); } };
    });
    check(`6b trang đi dạo gửi vị trí: hàng w của slot 0 ${JSON.stringify(seen)} (7 phần tử, pose 0..4, gần điểm xuất phát)`, !!seen && seen.length === 7 && seen[5] >= 0 && seen[5] <= 4 && Math.abs(seen[1] - (-245)) < 5);
    check('6b lỗi console của trang đi dạo = 0', S.errors.length === 0);
    if (S.errors.length) console.log(S.errors.join('\n'));
    await S.page.close();
    flyB.close(); bots.splice(bots.indexOf(flyB), 1); dropW(runB);
    await sleep(2000);
  }

  // 6a — trang dù lượn đã vào bay (qua màn chọn → sảnh → tên → Bay ngay) thấy bot đi dạo: 1 instance, danh sách, nhãn tên, draw call +1
  {
    const G = await openApp(browser, URLC + NOIDLE);
    await G.page.waitForSelector('#chooser', { state: 'visible', timeout: 240000 });
    await G.page.click('#chooser [data-pick="glider"]');
    await G.page.waitForFunction(() => /Còn 5 trên 5 chỗ$/.test(document.getElementById('exMpSeats')?.innerText || ''), null, { timeout: 30000 }).catch(() => {});
    await G.page.fill('#exMpNameIn', 'Phi');
    await G.page.click('#exMpFly');
    await G.page.waitForFunction(() => window.__app.explore.active() && window.__app.multi.session.phase === 'flying', null, { timeout: 60000 });
    await G.page.evaluate(() => { const s = window.__app.explore.state; const pin = () => { s.pos.set(-300, 16, 17.4); s.yaw = 0; s.bank = 0; requestAnimationFrame(pin); }; pin(); });
    await frames(G.page, 30);
    const calls = () => G.page.evaluate(() => { const { renderer, scene, camera } = window.__app; renderer.render(scene, camera); renderer.info.reset(); renderer.render(scene, camera); return renderer.info.render.calls; });
    const p0 = await peopleOn(G.page), c0 = await calls();
    const wb = walkBot('DiBo', -230, GY[-230] ?? 8, 17.4, 1);
    await G.page.waitForFunction(() => { const V = window.__app.stroll.avatars; return [0, 1, 2, 3, 4].some((i) => V.slotState(i)); }, null, { timeout: 60000 }).catch(() => {});
    await frames(G.page, 10);
    const p1 = await peopleOn(G.page), c1 = await calls();
    const r = await G.page.evaluate(() => ({ roster: document.getElementById('exMpRoster').innerText, label: [...document.querySelectorAll('#exMpLabels .ex-mp-label')].filter((e) => !e.hidden).map((e) => e.textContent), slot: window.__app.multi.session.mySlot, kind: window.__app.multi.session.kind }));
    check(`6a dù lượn (${r.kind}, slot ${r.slot}) trước bot đi dạo: stroll-people ${p0.has ? p0.n + ' instance' : 'chưa dựng'}; sau: ${p1.n} instance, hiện ${p1.vis}`, r.kind === 'fly' && r.slot === 0 && (!p0.has || (p0.n === 0 && !p0.vis)) && p1.has && p1.n === 1 && p1.vis);
    check(`6a danh sách "${r.roster.replace(/\n/g, ' | ')}"`, /Đi dạo 1\/5 · Bay 1\/5/.test(r.roster) && r.roster.includes('DiBo') && r.roster.includes('Phi'));
    check(`6a nhãn tên bot đi dạo (${r.label.join(' ; ')})`, r.label.some((l) => /^DiBo · \d+ m$/.test(l)));
    check(`6a draw call trước bot ${c0} → sau ${c1}: tăng đúng 1`, c1 - c0 === 1);
    check('6a lỗi console của trang dù lượn = 0', G.errors.length === 0);
    if (G.errors.length) console.log(G.errors.join('\n'));
    await G.page.close();
    dropW(wb);
    await sleep(2000);
  }

  // 6c — 5 bot đi dạo giữ chỗ: chế độ xem, camera ≤ 8 m sau người được xem; gõ wasd trong ô lời mời; một bot rời → lời mời → vào đi
  {
    const xs = [-238, -234, -230, -226, -222];
    const five = xs.map((x, i) => walkBot('Xem' + i, x, GY[x] ?? 8, 17.4, 0));
    await sleep(2500);
    const W = await openApp(browser, URLC + NOIDLE);
    await walkCard(W.page);
    await W.page.waitForFunction(() => window.__app.stroll.stroll.watching, null, { timeout: 30000 }).catch(() => {});
    await W.page.waitForFunction(() => { const A = window.__app, s = A.multi.session; return s && s.watched >= 0 && A.stroll.avatars.slotState(s.watched); }, null, { timeout: 60000 }).catch(() => {});
    await frames(W.page, 10);
    const wv = () => W.page.evaluate(() => {
      const A = window.__app, s = A.multi.session, st = s.watched >= 0 ? A.stroll.avatars.slotState(s.watched) : null, c = A.camera.position;
      return { watching: A.stroll.stroll.watching, active: A.stroll.stroll.active(), mode: A.cam.mode, phase: s.phase, kind: s.kind, name: A.stroll.avatars.name(s.watched), text: document.getElementById('exMpWatch').innerText,
        dist: st ? Math.hypot(st.x - c.x, st.y - c.y, st.z - c.z) : -1, cam: [c.x, c.y, c.z], invite: document.getElementById('exMpInvite').getClientRects().length > 0, chooser: document.getElementById('chooser').hidden, people: A.stroll.avatars.mesh ? A.stroll.avatars.mesh.visible : false };
    });
    const w0 = await wv();
    check(`6c 5 bot đi dạo: thẻ Đi dạo vào thẳng chế độ xem (${w0.mode}, ${w0.phase}), "${w0.text}", camera cách người được xem ${w0.dist.toFixed(2)} m (≤ 8), không lời mời`,
      w0.watching && !w0.active && w0.mode === 'stroll' && w0.phase === 'watching' && w0.kind === 'walk' && w0.chooser && /^Đang xem: /.test(w0.text) && w0.text.includes(w0.name) && w0.dist > 0 && w0.dist <= 8 && !w0.invite && w0.people);
    const gone = five.find((b) => b.name !== w0.name);
    dropW(gone);
    await W.page.waitForFunction(() => document.getElementById('exMpInvite').getClientRects().length > 0, null, { timeout: 15000 }).catch(() => {});
    const inv = await W.page.evaluate(() => ({ txt: document.getElementById('exMpInviteText').innerText, btn: document.getElementById('exMpInviteFly').innerText, input: document.getElementById('exMpInviteName').getClientRects().length > 0 }));
    check(`6c một bot rời: lời mời "${inv.txt}" + nút "${inv.btn}", ô tên hiện`, inv.txt === 'Có chỗ trống. Bạn muốn đi dạo không?' && inv.btn === 'Vào đi dạo' && inv.input);
    // Gõ wasd trong ô tên lời mời (Review Focus 3): ô nhận chữ, không có gì di chuyển
    const camA = (await wv()).cam;
    await W.page.click('#exMpInviteName');
    await W.page.keyboard.type('wasd');
    await frames(W.page, 5);
    const typed = await W.page.evaluate(() => ({ v: document.getElementById('exMpInviteName').value, keys: window.__app.keys.size, st: window.__app.stroll.stroll.state, watching: window.__app.stroll.stroll.watching }));
    const camB = (await wv()).cam;
    const moved = Math.hypot(camA[0] - camB[0], camA[1] - camB[1], camA[2] - camB[2]);
    check(`6c gõ wasd trong ô tên lời mời: ô "${typed.v}", keys ${typed.keys}, không nhân vật của mình, camera dịch ${moved.toFixed(3)} m, vẫn xem`, typed.v === 'wasd' && typed.keys === 0 && typed.st === null && typed.watching && moved < 0.05);
    await W.page.fill('#exMpInviteName', 'Moi');
    await W.page.click('#exMpInviteFly');
    await W.page.waitForFunction(() => window.__app.stroll.stroll.active() && window.__app.multi.session.phase === 'flying', null, { timeout: 30000 }).catch(() => {});
    await frames(W.page, 3);
    const jn = await W.page.evaluate(() => { const A = window.__app; return { act: A.stroll.stroll.active(), watching: A.stroll.stroll.watching, slot: A.multi.session.mySlot, cls: document.body.classList.contains('ex-watching'), inv: document.getElementById('exMpInvite').getClientRects().length === 0, roster: document.getElementById('exMpRoster').innerText }; });
    check(`6c bấm lời mời: vào đi dạo với slot ${jn.slot} (chỗ bot vừa rời ${gone.slot}), giao diện xem gỡ, danh sách có Moi`, jn.act && !jn.watching && jn.slot === gone.slot && !jn.cls && jn.inv && jn.roster.includes('Moi') && /Đi dạo 5\/5/.test(jn.roster));
    // Esc khi đang đi: thoát
    await Promise.all([W.page.waitForNavigation({ timeout: 90000 }).catch(() => null), W.page.keyboard.press('Escape')]);
    check('6c Esc khi đi dạo nhiều người: thoát, trang tải lại không còn ?chooser', !/chooser/.test(W.page.url()));
    check('6c lỗi console của trang xem đi dạo = 0', W.errors.length === 0);
    if (W.errors.length) console.log(W.errors.join('\n'));
    await W.page.close();
    five.forEach((b) => dropW(b));
    await sleep(2500);
  }

  // 6e — rời máy khi đi dạo: ?idleMs=1500&idleWarnMs=1000 → đếm ngược rồi chuyển sang xem
  {
    const I2 = await openApp(browser, URLC + '&idleMs=1500&idleWarnMs=1000');
    await I2.page.evaluate(() => { window.__idleTexts = []; const el = document.getElementById('exMpIdle'); new MutationObserver(() => { if (!el.hidden && el.textContent) window.__idleTexts.push(el.textContent); }).observe(el, { childList: true, characterData: true, subtree: true, attributes: true }); });
    await walkCard(I2.page);
    await walkTo(I2.page, 'Ngu');
    await I2.page.waitForFunction(() => window.__app.stroll.stroll.watching, null, { timeout: 30000 }).catch(() => {});
    await frames(I2.page, 3);
    const r = await I2.page.evaluate(() => { const A = window.__app, s = A.multi.session; return { texts: window.__idleTexts, watching: A.stroll.stroll.watching, st: A.stroll.stroll.state, phase: s.phase, notice: s.notice, mode: A.cam.mode, inv: document.getElementById('exMpInvite').getClientRects().length > 0, idle: document.getElementById('exMpIdle').getClientRects().length > 0, self: A.stroll.avatars.self }; });
    check(`6e không phím khi đi dạo: đếm ngược ("${r.texts[0]}", ${r.texts.length} lần) rồi sang xem (${r.phase}, ${r.notice}), không nhân vật của mình (${r.self}), lời mời hiện`,
      r.texts.length >= 1 && r.texts.every((x) => /^Bạn còn đó không\? \d+ giây$/.test(x)) && r.watching && r.st === null && r.phase === 'watching' && r.notice === 'released' && r.mode === 'stroll' && r.inv && !r.idle && r.self === -1);
    check('6e lỗi console của trang rời máy đi dạo = 0', I2.errors.length === 0);
    if (I2.errors.length) console.log(I2.errors.join('\n'));
    await I2.page.close();
  }
  wbots.splice(0).forEach((b) => b.close());

  live.splice(0).forEach((b) => b.close());
} catch (e) {
  check('ngoại lệ: ' + e.message, false);
} finally {
  bots.forEach((b) => b.close());
  wbots.forEach((b) => b.close());
  try { await browser?.close(); } catch { /* bỏ qua */ }
  try { srv?.close(); } catch { /* bỏ qua */ }
  stop();
  await sleep(1500);
}
console.log(problems.length ? `multi-check: LỖI (${problems.length}): ${problems.join('; ')}` : 'multi-check: đạt');
process.exit(problems.length ? 1 : 0);
