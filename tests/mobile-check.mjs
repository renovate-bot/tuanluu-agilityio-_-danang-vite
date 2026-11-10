// Kiểm tra giao diện điện thoại (kế hoạch feature/mobile-ui).
//   Mục 1: hạ tầng chế độ gọn (body.compact, sheet).
//   Mục 2: bố cục gọn — thanh trên, thanh dưới, hai sheet (Cài đặt, Góc nhìn).
//   Mục 3: chữ hướng dẫn cảm ứng, ẩn Đi bộ, sheet tự đóng khi Tour/bão, vệt mờ cuộn của hàng chip.
//   Buy me a coffee: URL an toàn, panel Cài đặt, vùng chạm, aria-label 9 ngôn ngữ.
//
//   npm run build && npm run test:mobile
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { serveDir, launch, openApp, frames, waitFlight, pick } from './lib.mjs';

const problems = [];
const check = (name, ok) => { if (!ok) problems.push(name); console.log(`${ok ? 'đạt ' : 'LỖI '} ${name}`); return ok; };

/* Phần tử "đang hiện": có hộp hiển thị. Không dùng offsetParent vì .panel là position:fixed (offsetParent luôn null) */
const VISIBLE = (el) => (el.checkVisibility ? el.checkVisibility() : el.getClientRects().length > 0);
/* Hộp getBoundingClientRect() của các phần tử đang hiện (mọi phần tử khớp từng selector) */
const rects = (page, sels) => page.evaluate(([sels, vis]) => {
  const visible = new Function('return ' + vis)();
  return sels.flatMap((s) => [...document.querySelectorAll(s)].filter(visible).map((el) => { const b = el.getBoundingClientRect(); return { sel: s, left: b.left, top: b.top, right: b.right, bottom: b.bottom, width: b.width, height: b.height }; }));
}, [sels, VISIBLE.toString()]);
const allMatch = (page, sels, want) => page.evaluate(([sels, vis, want]) => {
  const visible = new Function('return ' + vis)();
  return sels.every((s) => { const els = [...document.querySelectorAll(s)]; return els.length > 0 && els.every((el) => visible(el) === want); });
}, [sels, VISIBLE.toString(), want]);
const hiddenAll = (page, sels) => allMatch(page, sels, false);
const visibleAll = (page, sels) => allMatch(page, sels, true);
/* Hai hộp chồng nhau khi phần giao có diện tích > 0,5 px mỗi chiều */
const noOverlap = (r) => r.every((a, i) => r.every((b, j) => j <= i || Math.min(a.right, b.right) - Math.max(a.left, b.left) <= 0.5 || Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) <= 0.5));

/* Phần tử ở tâm (đã cuộn vào tầm nhìn) có là chính nó hoặc con của nó — không bị chú thích/panel khác che */
const topAtCenter = (page, sel) => page.evaluate((sel) => {
  const el = document.querySelector(sel); el.scrollIntoView({ block: 'nearest' });
  const b = el.getBoundingClientRect(), t = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
  return !!t && (t === el || el.contains(t));
}, sel);
/* Mục 5: Tour đang chạy + tờ Cài đặt mở; act(page) là cú bấm cảnh / Esc. Trả [tờ đóng?, Tour còn chạy?] sau act */
const startTour = async (page) => {
  await page.evaluate(() => document.querySelector('[data-view="tour"]').click());
  await page.waitForFunction(() => document.body.classList.contains('touring'));
  await page.evaluate(() => window.__app.ui.openSheet('settings')); await frames(page, 1);
};
const sheetTour = (page) => page.evaluate(() => [window.__app.ui.ui.sheet === 'none' && !/sheet-/.test(document.body.className), document.body.classList.contains('touring')]);
const srv = await serveDir(fileURLToPath(new URL('../dist/', import.meta.url)));
const browser = await launch();
const allErrors = [];
try {
  // Mục 1 — hạ tầng
  const P = await openApp(browser, srv.url, { width: 390, height: 844, mobile: true });
  check('dọc 390×844: body.compact', await P.page.evaluate(() => document.body.classList.contains('compact') && window.__app.ui.ui.compact));
  await P.page.evaluate(() => window.__app.ui.openSheet('settings'));
  check('mở settings', await P.page.evaluate(() => document.body.classList.contains('sheet-settings') && !document.body.classList.contains('sheet-views')));
  await P.page.evaluate(() => window.__app.ui.openSheet('views'));
  check('chỉ một sheet', await P.page.evaluate(() => document.body.classList.contains('sheet-views') && !document.body.classList.contains('sheet-settings')));
  await P.page.evaluate(() => window.__app.ui.closeSheets());
  check('đóng hết', await P.page.evaluate(() => !/sheet-/.test(document.body.className)));

  // Mục 2 — bố cục gọn (trang dọc P)
  P.page.setDefaultTimeout(180000);   // máy bận (SwiftShader) có khung hình dài > 60 s; thiếu phần tử vẫn báo lỗi sau 3 phút
  await frames(P.page, 2);
  // đóng: các panel đang hiện chiếm ≤ 22 % diện tích, không chồng nhau, nằm trọn trong màn hình
  const r = await rects(P.page, ['.brand', '.views', '.specs', '.stats']);
  check('đóng: diện tích panel ≤ 22 %', r.reduce((s, b) => s + b.width * b.height, 0) <= 0.22 * 390 * 844);
  check('đóng: không chồng nhau', noOverlap(r));
  check('đóng: trong màn hình', r.every((b) => b.left >= 0 && b.top >= 0 && b.right <= 390 && b.bottom <= 844));
  check('đóng: #brandBody ẩn, .view-list ẩn', await hiddenAll(P.page, ['#brandBody', '.view-list']));
  const btns = await rects(P.page, ['#btnSettings', '#btnViewsSheet', '.tour-all']);
  check('nút thanh ≥ 40 px', btns.length === 3 && btns.every((b) => b.height >= 40));
  check('.views không tràn ngang', await P.page.evaluate(() => { const v = document.querySelector('.views'); return v.scrollWidth <= v.clientWidth; }));
  // settings
  await P.page.tap('#btnSettings');
  const s = (await rects(P.page, ['.brand']))[0];
  check('settings: cao ≤ 70 %, chạm đáy', s.height <= 0.7 * 844 + 1 && Math.abs(s.bottom - 844) < 2);
  check('settings: có #weatherSel, #qualitySel, #langSelect hiện', await visibleAll(P.page, ['#weatherSel', '#qualitySel', '#langSelect']));
  check('settings: .views ẩn', await hiddenAll(P.page, ['.views']));
  check('settings: aria-expanded', await P.page.evaluate(() => document.getElementById('btnSettings').getAttribute('aria-expanded') === 'true'));
  await P.page.tap('#scene', { position: { x: 200, y: 100 } });
  check('chạm canvas đóng sheet', await P.page.evaluate(() => !/sheet-/.test(document.body.className)));
  // nút đóng ✕ và Esc
  await P.page.tap('#btnSettings');
  await P.page.tap('.brand .sheet-close');
  check('nút ✕ đóng sheet cài đặt', await P.page.evaluate(() => !/sheet-/.test(document.body.className)));
  await P.page.tap('#btnSettings'); await P.page.tap('#btnSettings');
  check('bấm lại #btnSettings thì đóng', await P.page.evaluate(() => !/sheet-/.test(document.body.className)));
  await P.page.tap('#btnViewsSheet'); await P.page.keyboard.press('Escape');
  check('Esc đóng sheet góc nhìn', await P.page.evaluate(() => !/sheet-/.test(document.body.className)));
  // views
  await P.page.tap('#btnViewsSheet');
  check('views: lưới góc nhìn Cầu Rồng hiện', await visibleAll(P.page, ['[data-list="dragon"] [data-view="overview"]']));
  check('views: cao ≤ 55 % + thanh', (await rects(P.page, ['[data-list="dragon"]']))[0].height <= 0.55 * 844 + 1);
  check('views: lưới 2 cột', await P.page.evaluate(() => getComputedStyle(document.querySelector('[data-list="dragon"]')).gridTemplateColumns.split(' ').length === 2));
  check('views: .views không tràn ngang', await P.page.evaluate(() => { const v = document.querySelector('.views'); return v.scrollWidth <= v.clientWidth; }));
  await P.page.tap('[data-view="head"]');
  check('chọn góc nhìn: sheet đóng, camera bay', await P.page.evaluate(() => !/sheet-/.test(document.body.className) && ['fly', 'orbit'].includes(window.__app.cam.mode)));
  // chip cầu
  await P.page.tap('[data-bridge="sh"]'); await P.page.tap('#btnViewsSheet');
  check('chip sh: danh sách sh hiện, swing-box trọn hàng', await visibleAll(P.page, ['[data-list="sh"] #btnSwing']));
  check('chip sh: swing-box chiếm 2 cột', await P.page.evaluate(() => { const l = document.querySelector('[data-list="sh"]').getBoundingClientRect(), b = document.querySelector('[data-list="sh"] .swing-box').getBoundingClientRect(); return b.width > 0.8 * l.width; }));
  // xoay khi sheet mở
  await P.page.setViewportSize({ width: 844, height: 390 }); await frames(P.page, 3);
  const v = (await rects(P.page, ['[data-list="sh"]']))[0];
  check('xoay: sheet trong màn hình', !!v && v.top >= 0 && v.bottom <= 390);
  await P.page.setViewportSize({ width: 390, height: 844 });
  await P.page.evaluate(() => window.__app.ui.closeSheets());

  // Mục 3 — chữ cảm ứng, hover, sheet tự đóng, vệt mờ hàng chip
  await P.page.evaluate(() => { document.querySelector('.seg').scrollLeft = 0; });   // chạm chip ở mục 2 đã cuộn hàng chip
  await frames(P.page, 3);
  const fade = () => P.page.evaluate(() => { const c = document.querySelector('.seg').classList; return { start: c.contains('more-start'), end: c.contains('more-end') }; });
  const f0 = await fade();
  check('hàng chip: chưa cuộn thì mờ cuối, không mờ đầu', f0.end && !f0.start);
  await P.page.evaluate(() => { const s = document.querySelector('.seg'); s.scrollLeft = s.scrollWidth; });
  await frames(P.page, 3);
  const f1 = await fade();
  check('hàng chip: cuộn tới cuối thì hết mờ cuối, mờ đầu', !f1.end && f1.start);
  await P.page.screenshot({ path: 'tests/screens/mobile/t3-bar-fade-end.png' });
  await P.page.evaluate(() => { document.querySelector('.seg').scrollLeft = 0; });
  await frames(P.page, 3);
  await P.page.screenshot({ path: 'tests/screens/mobile/t3-bar-fade.png' });
  await P.page.evaluate(() => document.querySelector('[data-bridge="dragon"]').click());
  await P.page.evaluate(() => window.__app.ui.openSheet('views'));
  await frames(P.page, 2);
  check('cảm ứng: ẩn nút Đi bộ (tờ Góc nhìn đang mở)', await visibleAll(P.page, ['[data-list="dragon"] [data-view="overview"]']) && await hiddenAll(P.page, ['[data-view="walk"]']));
  await P.page.tap('[data-list="dragon"] [data-view="tour"]'); await waitFlight(P.page);
  check('Tour: sheet đóng, chú thích hiện', await P.page.evaluate(() => !/sheet-/.test(document.body.className) && !document.getElementById('tourCaption').hidden));
  const [cap, bar] = await rects(P.page, ['#tourCaption', '.views']);
  check('Tour: chú thích không bị thanh dưới che', cap.bottom <= bar.top + 1);
  check('cảm ứng: chữ thoát là bản touch', await visibleAll(P.page, ['#tourCaption .hint-touch']) && await hiddenAll(P.page, ['#tourCaption .hint-mouse']));
  check('cảm ứng: không hiện khóa i18n thô', await P.page.evaluate(() => !/Touch$/.test(document.querySelector('#tourCaption .hint-touch').textContent)));
  await P.page.screenshot({ path: 'tests/screens/mobile/t3-tour-touch.png' });
  // Tờ Góc nhìn mở lúc Tour chạy phải nằm trên chú thích: nút cuối lưới chạm được
  await P.page.evaluate(() => window.__app.ui.openSheet('views')); await frames(P.page, 2);
  await P.page.evaluate(() => { const b = [...document.querySelectorAll('.view-list button')].filter((e) => e.checkVisibility()).pop(); b.dataset.lastView = '1'; });
  check('Tour + tờ Góc nhìn: nút cuối lưới không bị chú thích che', await topAtCenter(P.page, '[data-last-view]'));
  await P.page.evaluate(() => window.__app.ui.closeSheets());
  await P.page.keyboard.press('Escape');
  await P.page.evaluate(() => window.__app.ui.openSheet('settings'));
  await P.page.evaluate(() => document.getElementById('btnWxStorm').click());
  check('kịch bản bão: sheet đóng', await P.page.evaluate(() => !/sheet-/.test(document.body.className)));
  check('kịch bản bão: chữ touch', await visibleAll(P.page, ['#wxScenario .hint-touch']) && await hiddenAll(P.page, ['#wxScenario .hint-mouse']));
  // Tờ Cài đặt mở lúc kịch bản bão chạy phải nằm trên chú thích: nút dừng bão chạm được
  await P.page.evaluate(() => window.__app.ui.openSheet('settings')); await frames(P.page, 2);
  check('bão + tờ Cài đặt: #btnWxStorm không bị chú thích che', await topAtCenter(P.page, '#btnWxStorm'));
  await P.page.evaluate(() => window.__app.ui.closeSheets());
  await P.page.evaluate(() => document.getElementById('btnWxStorm').click());

  // Mục 5 — hiệu năng điện thoại: safe-area, bỏ blur khi gọn, gộp resize
  check('viewport-fit=cover', await P.page.evaluate(() => /viewport-fit=cover/.test(document.querySelector('meta[name=viewport]').content)));
  check('gọn: panel không backdrop-filter', await P.page.evaluate(() => [...document.querySelectorAll('.panel')].every((e) => { const s = getComputedStyle(e); return (s.backdropFilter || s.webkitBackdropFilter || 'none') === 'none'; })));
  const nResize = await P.page.evaluate(async () => {
    const r = window.__app.renderer, orig = r.setSize.bind(r); let c = 0; r.setSize = (...a) => { c++; return orig(...a); };
    for (let i = 0; i < 5; i++) window.dispatchEvent(new Event('resize'));
    await new Promise((ok) => setTimeout(ok, 400)); await new Promise((ok) => requestAnimationFrame(ok));
    r.setSize = orig; return c;
  });
  check('resize gộp: setSize 1 lần cho 5 sự kiện', nResize === 1);

  // Buy me a coffee (MoMo): ẩn khi URL rỗng/không an toàn, hiện trong tờ Cài đặt
  const DONATE_URL = 'https://me.momo.vn/bbk9x';
  check('donate: URL rỗng thì ẩn', await P.page.evaluate(() => window.__app.ui.donate.set('') === false && document.getElementById('donateLink').hidden));
  check('donate: javascript: bị từ chối', await P.page.evaluate(() => window.__app.ui.donate.set('javascript:alert(1)') === false && document.getElementById('donateLink').hidden && !document.getElementById('donateLink').getAttribute('href')?.startsWith('javascript')));
  check('donate: http: bị từ chối', await P.page.evaluate(() => window.__app.ui.donate.set('http://me.momo.vn/x') === false && document.getElementById('donateLink').hidden));
  check('donate: https gắn được', await P.page.evaluate((u) => window.__app.ui.donate.set(u) === true, DONATE_URL));
  await P.page.evaluate(() => window.__app.ui.openSheet('settings'));
  await frames(P.page, 2);
  check('donate: hiện trong tờ Cài đặt', await visibleAll(P.page, ['#donateLink']));
  check('donate: href, tab mới, rel', await P.page.evaluate((u) => { const a = document.getElementById('donateLink'); return a.href === u && a.target === '_blank' && /noopener/.test(a.rel) && /noreferrer/.test(a.rel); }, DONATE_URL));
  check('donate: chữ tiếng Anh cố định', await P.page.evaluate(() => document.getElementById('donateLink').textContent.trim() === 'Buy me a coffee'));
  check('donate: cao ≥ 40 px khi gọn', (await rects(P.page, ['#donateLink']))[0].height >= 40);
  check('donate: là phần tử cuối của #brandBody', await P.page.evaluate(() => document.getElementById('brandBody').lastElementChild.id === 'donateLink'));
  await P.page.evaluate(() => window.__app.ui.closeSheets());

  // Mục 4 — i18n 9 ngôn ngữ cho khóa mới, không tràn chữ, RTL
  await P.page.evaluate(() => window.__app.ui.closeSheets());
  const KEYS = ['settings', 'close', 'tourExitTouch', 'wxStormHintTouch', 'swRideHintTouch', 'donateAria'];
  for (const code of ['vi', 'en', 'ko', 'ja', 'zh', 'th', 'ar', 'hi', 'ru']) {
    const json = JSON.parse(fs.readFileSync(`src/i18n/locales/${code}.json`, 'utf8'));
    check(`${code}: đủ ${KEYS.length} khóa`, KEYS.every((k) => typeof json[k] === 'string' && json[k].length > 0));
    await pick(P.page, '#langSelect', code);
    check(`${code}: aria donate đã dịch`, await P.page.evaluate((v) => document.getElementById('donateLink').getAttribute('aria-label') === v, json.donateAria));
    for (const sh of ['settings', 'views']) {
      await P.page.evaluate((s) => window.__app.ui.openSheet(s), sh);
      await frames(P.page, 2);
      // Không dùng offsetParent (.panel là position:fixed). Tờ không hiện lúc đo = LỖI, không bỏ qua
      const r = await P.page.evaluate(([vis, need]) => {
        const visible = new Function('return ' + vis)();
        const shown = document.querySelector(need);
        const over = [...document.querySelectorAll('.brand, .views, #brandBody, .view-list:not([hidden])')].filter((e) => visible(e) && e.scrollWidth > e.clientWidth + 1).map((e) => e.className || e.id);
        return { shown: !!shown && visible(shown), over };
      }, [VISIBLE.toString(), sh === 'settings' ? '#brandBody' : '.view-list:not([hidden])']);
      check(`${code} ${sh}: tờ hiện và không tràn ngang`, r.shown && r.over.length === 0);
      if (r.over.length) console.log('   tràn:', r.over.join(', '));
    }
    if (code === 'ar') {
      await P.page.evaluate(() => window.__app.ui.openSheet('settings'));   // vòng trên mở 'views' cuối cùng nên .brand đang ẩn (rộng 0)
      await frames(P.page, 2);
      check('ar: dir=rtl, sheet trọn bề ngang', await P.page.evaluate(() => document.documentElement.dir === 'rtl' && Math.abs(document.querySelector('.brand').getBoundingClientRect().width - innerWidth) < 2));
      await P.page.evaluate(() => window.__app.ui.closeSheets());
      await P.page.evaluate(() => { document.querySelector('.seg').scrollLeft = 0; });
      await frames(P.page, 3);
      check('ar: hàng chip lúc nghỉ có mờ cuối', (await fade()).end);
      await P.page.evaluate(() => { const s = document.querySelector('.seg'); s.scrollLeft = -s.scrollWidth; });   // RTL: cuối dòng là scrollLeft âm
      await frames(P.page, 3);
      const fa = await fade();
      check('ar: cuộn tới cuối thì mờ đầu, hết mờ cuối', fa.start && !fa.end);
      await P.page.evaluate(() => { document.querySelector('.seg').scrollLeft = 0; });
    }
  }
  await pick(P.page, '#langSelect', 'vi');
  // Mục 5 (điện thoại): chạm cảnh khi có tờ mở chỉ đóng tờ, Tour vẫn chạy
  await startTour(P.page);
  await P.page.touchscreen.tap(195, 250); await frames(P.page, 1);
  check('điện thoại: Tour + tờ mở, chạm cảnh chỉ đóng tờ', JSON.stringify(await sheetTour(P.page)) === '[true,true]');
  await P.page.keyboard.press('Escape');
  allErrors.push(...P.errors); await P.page.close();

  // cửa sổ máy tính hẹp (chuột): gọn nhưng giữ nút Đi bộ + chữ chuột
  const N = await openApp(browser, srv.url, { width: 700, height: 700 });
  check('máy tính hẹp: compact, Đi bộ hiện', await N.page.evaluate(() => document.body.classList.contains('compact')) && await N.page.evaluate(() => { window.__app.ui.openSheet('views'); return document.querySelector('[data-view="walk"]').offsetParent !== null; }));
  await N.page.evaluate(() => { document.getElementById('tourCaption').hidden = false; });
  check('chuột: chữ thoát là bản chuột', await visibleAll(N.page, ['#tourCaption .hint-mouse']) && await hiddenAll(N.page, ['#tourCaption .hint-touch']));
  allErrors.push(...N.errors); await N.page.close();

  // Mỗi lúc chỉ mở một trang: hai trang cùng chạy vòng vẽ làm SwiftShader quá tải (page.goto hết giờ)
  const L = await openApp(browser, srv.url, { width: 844, height: 390, mobile: true });
  check('ngang 844×390: body.compact', await L.page.evaluate(() => document.body.classList.contains('compact')));
  await L.page.evaluate(() => document.getElementById('btnWxStorm').click()); await frames(L.page, 3);   // sheet tự đóng khi bão bắt đầu (MutationObserver) nên mở sau
  await L.page.evaluate(() => window.__app.ui.openSheet('settings')); await frames(L.page, 2);
  check('ngang: bão + tờ Cài đặt: #btnWxStorm không bị chú thích che', await topAtCenter(L.page, '#btnWxStorm'));
  await L.page.evaluate(() => { window.__app.ui.closeSheets(); document.getElementById('btnWxStorm').click(); });
  allErrors.push(...L.errors); await L.page.close();

  const D = await openApp(browser, srv.url, { width: 1280, height: 800 });
  check('máy tính 1280×800: không compact', await D.page.evaluate(() => !document.body.classList.contains('compact')));
  await D.page.evaluate(() => window.__app.ui.donate.set('https://me.momo.vn/bbk9x'));
  check('máy tính: donate nằm trong .brand', await D.page.evaluate(() => { const a = document.getElementById('donateLink').getBoundingClientRect(), b = document.querySelector('.brand').getBoundingClientRect(); return a.height > 0 && a.top >= b.top && a.bottom <= b.bottom + 1 && a.left >= b.left - 1 && a.right <= b.right + 1; }));
  // máy tính không đổi
  const b = await rects(D.page, ['.brand']);
  check('máy tính: .brand neo trái 14 px, .views rộng 228 px', b.length === 1 && Math.abs(b[0].left - 14) < 1
    && await D.page.evaluate(() => getComputedStyle(document.querySelector('.views')).width === '228px'));
  check('máy tính: vẫn blur', await D.page.evaluate(() => /blur/.test(getComputedStyle(document.querySelector('.brand')).backdropFilter)));
  check('máy tính: không có nút sheet', await hiddenAll(D.page, ['#btnSettings', '#btnViewsSheet', '.sheet-close']));
  allErrors.push(...D.errors); await D.page.close();

  // Mục 5 — thu gọn trên máy tính (D-025): hành vi dùng chung
  const E = await openApp(browser, srv.url, { width: 1440, height: 780 });
  E.page.setDefaultTimeout(180000);
  await E.page.evaluate(() => window.__app.ui.reveal(document.querySelector('[data-bridge="hr"]')));
  check('máy tính: reveal mở tờ Góc nhìn cho chip cầu', await E.page.evaluate(() => window.__app.ui.ui.sheet === 'views'));
  await E.page.evaluate(() => window.__app.ui.closeSheets());
  await startTour(E.page);
  await E.page.mouse.click(720, 400); await frames(E.page, 1);
  check('máy tính: Tour + tờ mở, bấm cảnh chỉ đóng tờ', JSON.stringify(await sheetTour(E.page)) === '[true,true]');
  await E.page.mouse.click(720, 400); await frames(E.page, 1);
  check('máy tính: không có tờ, bấm cảnh thoát Tour như cũ', (await sheetTour(E.page))[1] === false);
  await startTour(E.page);
  await E.page.keyboard.press('Escape'); await frames(E.page, 1);
  check('máy tính: Tour + tờ mở, Esc chỉ đóng tờ', JSON.stringify(await sheetTour(E.page)) === '[true,true]');
  await E.page.keyboard.press('Escape'); await frames(E.page, 1);
  check('máy tính: Esc lần hai thoát Tour', (await sheetTour(E.page))[1] === false);
  await E.page.evaluate(() => document.querySelector('[data-view="swRide"]').click()); await waitFlight(E.page);
  await E.page.evaluate(() => window.__app.ui.openSheet('settings')); await frames(E.page, 1);
  await E.page.keyboard.press('Escape'); await frames(E.page, 1);
  check('máy tính: cabin + tờ mở, Esc chỉ đóng tờ', await E.page.evaluate(() => window.__app.ui.ui.sheet === 'none' && window.__app.cam.mode === 'swRide'));
  await E.page.keyboard.press('Escape'); await frames(E.page, 1);
  check('máy tính: Esc lần hai xuống cabin', await E.page.evaluate(() => window.__app.cam.mode !== 'swRide'));
  await E.page.evaluate(() => window.__app.ui.openSheet('settings'));
  await E.page.setViewportSize({ width: 700, height: 700 }); await frames(E.page, 2);
  const s1 = await E.page.evaluate(() => window.__app.ui.ui.sheet === 'none' && !/sheet-/.test(document.body.className));
  await E.page.evaluate(() => window.__app.ui.openSheet('views'));
  await E.page.setViewportSize({ width: 1440, height: 780 }); await frames(E.page, 2);
  check('qua ngưỡng: tờ đóng cả hai chiều', s1 && await E.page.evaluate(() => window.__app.ui.ui.sheet === 'none' && !/sheet-/.test(document.body.className)));
  allErrors.push(...E.errors); await E.page.close();
  const G = await openApp(browser, srv.url + '?explore=glider', { width: 1440, height: 780 });
  G.page.setDefaultTimeout(180000);
  await G.page.evaluate(() => window.__app.ui.openSheet('settings')); await frames(G.page, 1);
  await G.page.keyboard.press('Escape'); await frames(G.page, 1);
  check('dù lượn: tờ mở, Esc chỉ đóng tờ', await G.page.evaluate(() => window.__app.ui.ui.sheet === 'none' && window.__app.explore.active()));
  allErrors.push(...G.errors); await G.page.close();

  check('console sạch', allErrors.length === 0);
  if (allErrors.length) console.log(allErrors.join('\n'));
} catch (e) {
  problems.push('ngoại lệ: ' + e); console.log(e);
} finally {
  await browser.close(); srv.close();
}
console.log(problems.length ? `mobile-check: LỖI (${problems.length}): ${problems.join('; ')}` : 'mobile-check: đạt');
process.exit(problems.length ? 1 : 0);
