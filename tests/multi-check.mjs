// Kiểm tra dù lượn nhiều người ở phía khách (kế hoạch feature/du-luon-nhieu-nguoi, Task 5).
//   Mục 1: 4 bot Node WebSocket bay cùng — dù, màu, nhãn tên, nhãn dưới cánh, draw call (≤ +4), roster, bot thoát.
//   Mục 2: ?test không có multi= thì không mở WebSocket nào.
//   Mục 3 (Task 6): bước chọn slot + nhập tên trong màn chọn — số chỗ trực tiếp, tên, chống chèn HTML/RTL, nhớ tên, máy chủ tắt, đổi ngôn ngữ.
//   Mục 4 (Task 7): chế độ xem (5 bot), lời mời vào chỗ trống, giành trước, người xem rời, ô tên không lái dù, Esc, mất máy chủ khi xem và khi bay.
//   Mục 5 (Task 8): rời máy — đếm ngược, trả slot, camera giữ nguyên, lời mời còn dùng, phím giữ slot, nhịp sống không nhân đôi, đóng trang, tab ẩn + rAF dừng.
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

  // Mục 4 (Task 7) — chế độ xem và lời mời vào chỗ trống. Dọn Mục 1 trước để phòng trống
  await page.close();
  bots.splice(0).forEach((b) => b.close());
  await sleep(2000);
  const URLW = srv.url + '?chooser&multi=' + encodeURIComponent(`ws://${HOST}/sky`);
  const live = [];
  const addBot = (n) => { const i = live.length; const b = bot(n, 90 + i * 20, (i - 2) * 15); b.name = n; live.push(b); return b; };
  const dropBot = (n) => { const i = live.findIndex((b) => b.name === n); if (i >= 0) live.splice(i, 1)[0].close(); };
  const watchedName = (pg) => pg.evaluate(() => { const A = window.__app, s = A.multi.session; return A.multi.remotes.name(s.watched); });
  const enterWatch = async (pg) => { await pg.waitForSelector('#chooser', { state: 'visible', timeout: 240000 }); await pg.click('#chooser [data-pick="glider"]'); await pg.waitForFunction(() => window.__app.explore.watching, null, { timeout: 30000 }).catch(() => {}); };
  ['W1', 'W2', 'W3', 'W4', 'W5'].forEach(addBot);
  await sleep(2500);

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
  const changed = await W.page.waitForFunction((old) => { const t = document.getElementById('exMpWatch').innerText; return t && t !== old; }, textBefore, { timeout: 1000 }).then(() => true, () => false);
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
  await F.page.waitForFunction(() => window.__app.multi.session.phase === 'solo', null, { timeout: 15000 }).catch(() => {});
  await frames(F.page, 5);
  const fl2 = await F.page.evaluate(() => { const A = window.__app, n = document.getElementById('exMpNotice'); return { active: A.explore.active(), others: [0, 1, 2, 3, 4].filter((i) => A.multi.remotes.slotState(i) || A.multi.remotes.group(i)).length, txt: n.innerText, shown: n.getClientRects().length > 0, roster: document.getElementById('exMpRoster').getClientRects().length > 0 }; });
  check(`Máy chủ tắt khi bay: vẫn bay, ${fl2.others} dù người khác, thông báo "${fl2.txt}"`, fl2.active && fl2.others === 0 && fl2.shown && /Mất kết nối/.test(fl2.txt) && !fl2.roster);
  check('Lỗi console của trang bay = 0', F.errors.length === 0);
  if (F.errors.length) console.log(F.errors.join('\n'));
  await F.page.close();   // đóng trang bay trước khi mở trang khác: SwiftShader dùng chung CPU
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
  check(`Màn chọn hiện "${lost.txt}" một lần (cờ đã xóa: ${lost.flag})`, lost.shown && /Mất kết nối/.test(lost.txt) && lost.flag === null);
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
  const rel = await I.page.evaluate(() => { const A = window.__app, s = A.multi.session, c = A.camera.position.toArray(), l = window.__camLast; return { phase: s.phase, watching: A.explore.watching, st: A.explore.state, glider: A.explore.glider && A.explore.glider.visible, keys: A.keys.size, notice: document.getElementById('exMpNotice').innerText, noticeVis: document.getElementById('exMpNotice').getClientRects().length > 0, idle: document.getElementById('exMpIdle').getClientRects().length > 0, inv: document.getElementById('exMpInvite').getClientRects().length > 0, sn: s.notice, dist: l ? Math.hypot(c[0] - l[0], c[1] - l[1], c[2] - l[2]) : -1, body: document.body.classList.contains('ex-watching') }; });
  check(`Hết giờ: sang chế độ xem, thông báo "${rel.notice}", đếm ngược ẩn, camera lệch ${rel.dist.toFixed(2)} m so với lúc còn bay, không dù riêng`, rel.phase === 'watching' && rel.watching && rel.st === null && !rel.glider && rel.sn === 'released' && rel.noticeVis && /đứng yên/.test(rel.notice) && !rel.idle && rel.body && rel.dist >= 0 && rel.dist < 2);
  check('Lobby máy chủ giảm một người (1 -> 0)', await lobbyIs(0, 4000));
  check('Lời mời hiện sau khi nhường chỗ', rel.inv);
  const hbWatch = await I.page.evaluate(async () => { const a = window.__hb; await new Promise((r) => setTimeout(r, 3500)); return window.__hb - a; });
  check(`Đang xem: không còn nhịp sống (${hbWatch} hb trong 3,5 s)`, hbWatch === 0);
  await I.page.click('#exMpInviteFly');
  await I.page.waitForFunction(() => window.__app.explore.active() && window.__app.multi.session.phase === 'flying', null, { timeout: 30000 }).catch(() => {});
  const t0 = Date.now();
  const re = await I.page.evaluate(() => ({ phase: window.__app.multi.session.phase, active: window.__app.explore.active(), idle: document.getElementById('exMpIdle').getClientRects().length > 0, ex: document.body.classList.contains('ex-watching') }));
  check('Bấm lời mời sau khi nhường chỗ: bay lại được, chưa bị hỏi "Bạn còn đó không?" ngay', re.phase === 'flying' && re.active && !re.idle && !re.ex && await lobbyIs(1, 4000));

  // 5d: bấm phím lúc đếm ngược giữ slot; 5e: nhịp sống không nhân đôi sau khi vào bay lại
  await I.page.waitForFunction(() => document.getElementById('exMpIdle').getClientRects().length > 0, null, { timeout: 8000 }).catch(() => {});
  const shown2 = await idleVis(I.page);
  await I.page.keyboard.press('a');
  await frames(I.page, 3);
  const hidAfterKey = !(await idleVis(I.page));
  const hb0 = await I.page.evaluate(() => window.__hb);
  let still = true;
  for (let i = 0; i < 24; i++) { await I.page.keyboard.press(i % 2 ? 'w' : 'ArrowLeft'); await sleep(400); if (obs.n !== 1) still = false; }
  const live2 = await I.page.evaluate(() => ({ phase: window.__app.multi.session.phase, hb: window.__hb }));
  const hbN = live2.hb - hb0;
  check(`Bấm phím lúc đếm ngược: đếm ngược ẩn, giữ slot qua ${((Date.now() - t0) / 1000).toFixed(0)} s (quá hạn 3 s nhiều lần), lobby vẫn 1 người`, shown2 && hidAfterKey && live2.phase === 'flying' && still);
  check(`Vào bay lại từ lời mời: nhịp sống không nhân đôi (${hbN} hb trong ~9,6 s, chu kỳ 3 s => 2 đến 4)`, hbN >= 2 && hbN <= 4);
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

  live.splice(0).forEach((b) => b.close());
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
