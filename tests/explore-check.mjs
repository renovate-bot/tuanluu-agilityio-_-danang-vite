// Kiểm tra chế độ tự khám phá bằng dù lượn (kế hoạch feature/explore-du-luon).
//   Mục 1: mô hình bay thuần (src/explore/flight.ts) qua móc tạm window.__app.exFlight.
//
//   npm run build && npm run test:explore
import { fileURLToPath } from 'node:url';
import { serveDir, launch, openApp, frames } from './lib.mjs';

const problems = [];
const check = (name, ok) => { if (!ok) problems.push(name); console.log(`${ok ? 'đạt ' : 'LỖI '} ${name}`); return ok; };

const srv = await serveDir(fileURLToPath(new URL('../dist/', import.meta.url)));
const browser = await launch();
try {
  // Mục 1 — mô hình bay thuần
  const P = await openApp(browser, srv.url);
  await frames(P.page, 2);
  const has = await P.page.evaluate(() => !!(window.__app && window.__app.exFlight));
  check('có __app.exFlight', has);
  if (has) {
    const r = await P.page.evaluate(() => {
      const { exCreate, exStep, exInputFromKeys, CONFIG_explore: C } = window.__app.exFlight;
      const dt = 1 / 60, out = {};
      const run = (s, inp, sec, each) => { for (let i = 0; i < Math.round(sec * 60); i++) { exStep(s, inp, dt); if (each) each(s); } };
      // 1a tốc độ ngang không đổi
      let ok = true, last = null;
      for (const [turn, climb] of [[1, 1], [-1, -1], [1, -1], [0, 0]]) {
        const s = exCreate(); last = null;
        run(s, { turn, climb }, 30, (s) => { if (last) { const v = Math.hypot(s.pos.x - last.x, s.pos.z - last.z) / dt; if (v < 24.99 || v > 25.01) ok = false; } last = { x: s.pos.x, z: s.pos.z }; });
      }
      out.a = ok;
      // 1b rẽ trái / phải
      let s = exCreate(); let y0 = s.yaw; run(s, { turn: 1, climb: 0 }, 3); out.bL = s.yaw - y0;
      s = exCreate(); y0 = s.yaw; run(s, { turn: -1, climb: 0 }, 3); out.bR = s.yaw - y0;
      // 1c lên/xuống
      s = exCreate(); run(s, { turn: 0, climb: 1 }, 200); out.cUp = s.pos.y;
      s = exCreate(); run(s, { turn: 0, climb: -1 }, 200); out.cDown = s.pos.y;
      // 1d thả phím
      s = exCreate(); run(s, { turn: 1, climb: 0 }, 2); run(s, { turn: 0, climb: 0 }, 2.5); const yb = s.yaw; run(s, { turn: 0, climb: 0 }, 0.5);
      out.dBank = s.bank; out.dYaw = s.yaw - yb;
      // 1e ranh giới khi bay thẳng
      s = exCreate(); ok = true;
      run(s, { turn: 0, climb: 0 }, 600, (s) => { if (s.pos.x < C.bounds.x0 || s.pos.x > C.bounds.x1 || s.pos.z < C.bounds.z0 || s.pos.z > C.bounds.z1) ok = false; });
      out.e = ok;
      // 1f giữ A ở góc, hướng ra ngoài
      s = exCreate(); s.pos.set(C.bounds.x1 - 50, 300, C.bounds.z0 + 50); s.yaw = Math.PI / 4; s.bank = 0; ok = true;
      let flips = 0, prev = 0;
      const t = [0];
      for (let i = 0; i < 600 * 60; i++) {
        exStep(s, { turn: 1, climb: 0 }, dt);
        if (s.pos.x < C.bounds.x0 || s.pos.x > C.bounds.x1 || s.pos.z < C.bounds.z0 || s.pos.z > C.bounds.z1) ok = false;
        if (i >= 540 * 60) { const sg = Math.sign(s.bank); if (sg !== 0 && prev !== 0 && sg !== prev) flips++; if (sg !== 0) prev = sg; }
      }
      out.f = ok; out.fFlips = flips;
      // 1g phím
      const k = (...a) => exInputFromKeys(new Set(a));
      out.g = [k('a').turn === 1, k('arrowright').turn === -1, k('a', 'd').turn === 0, k('w').climb === 1, k('s', 'arrowup').climb === 0, k().turn === 0 && k().climb === 0];
      // 1h
      s = exCreate();
      out.h = s.pos.x === C.takeoff[0] && s.pos.y === C.takeoff[1] && s.pos.z === C.takeoff[2] && s.yaw === C.takeoffYaw && s.bank === 0;
      return out;
    });
    check('1a tốc độ ngang luôn 25 m/s', r.a);
    check(`1b A rẽ trái (+${r.bL.toFixed(2)}), D rẽ phải (${r.bR.toFixed(2)})`, r.bL > 0.5 && r.bR < -0.5);
    check(`1c W lên tới 800, S xuống tới 30 (${r.cUp}, ${r.cDown})`, r.cUp === 800 && r.cDown === 30);
    check(`1d thả phím tự cân bằng (bank ${r.dBank.toExponential(1)}, Δyaw ${r.dYaw.toExponential(1)})`, Math.abs(r.dBank) < 0.01 && Math.abs(r.dYaw) < 0.005);
    check('1e bay thẳng 600 s không ra khỏi khung', r.e);
    check(`1f giữ A ở góc không vượt khung, bank đổi dấu ${r.fFlips} lần (≤ 2)`, r.f && r.fFlips <= 2);
    check('1g exInputFromKeys', r.g.every(Boolean));
    check('1h exCreate tại điểm cất cánh', r.h);
  }
  check('console sạch', P.errors.length === 0);
  if (P.errors.length) console.log(P.errors.join('\n'));
  await P.page.close();
} catch (e) {
  problems.push('ngoại lệ: ' + e); console.log(e);
} finally {
  await browser.close(); srv.close();
}
console.log(problems.length ? `explore-check: LỖI (${problems.length}): ${problems.join('; ')}` : 'explore-check: đạt');
process.exit(problems.length ? 1 : 0);
