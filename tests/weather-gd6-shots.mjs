// Chụp ảnh tự xem Giai đoạn 6: thẻ "Ảnh hưởng tới cầu", 3 góc nhìn thời tiết, tiếng Ả Rập RTL -> tests/screens/weather-gd6/
// In kèm: khoá i18n thiếu ở 9 ngôn ngữ (so với vi.json, và phần tử data-i18n còn hiện nguyên khoá), draw call 3 góc nhìn mới ở `now` và `rain`.
//   npm run build && node tests/weather-gd6-shots.mjs
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { serveDir, launch, openApp, frames, pickView, tap, pick } from './lib.mjs';
import { setWx } from './weather-lib.mjs';

const OUT = fileURLToPath(new URL('./screens/weather-gd6/', import.meta.url));
fs.mkdirSync(OUT, { recursive: true });
const LOCALES = ['vi', 'en', 'ko', 'ja', 'zh', 'th', 'ar', 'hi', 'ru'];
const problems = [];

// 1) Khoá i18n: mọi ngôn ngữ phải có đủ khoá GĐ6 (không rỗng)
const dir = fileURLToPath(new URL('../src/i18n/locales/', import.meta.url));
const vi = JSON.parse(fs.readFileSync(`${dir}vi.json`, 'utf8'));
const KEYS = ['weather', 'wxNow', 'wxSummer', 'wxRain', 'wxMonsoon', 'wxStorm', 'wxIntensity', 'sWeather', 'swingWeather', 'wxImpact', 'wxImpactNote', 'wxWindDeck', 'wxWindTop', 'wxOpen', 'wxClosed', 'wxClosedNote', 'wxThermal', 'wxSag', 'wxRainWind', 'wxSwingBlocked', 'wxSwingTour', 'wxTunnelOk', 'vWxRiverMouth', 'vWxTtlStays', 'vWxStreet'];
for (const l of LOCALES) {
  const j = JSON.parse(fs.readFileSync(`${dir}${l}.json`, 'utf8'));
  for (const k of KEYS) if (typeof j[k] !== 'string' || !j[k]) problems.push(`${l}: thiếu khoá ${k}`);
  for (const k of KEYS) { // tham số {…} phải giữ nguyên như bản vi
    const a = (vi[k].match(/\{\w+\}/g) || []).sort().join(), b = ((j[k] || '').match(/\{\w+\}/g) || []).sort().join();
    if (a !== b) problems.push(`${l}: khoá ${k} lệch tham số (${a} ≠ ${b})`);
  }
}

const srv = await serveDir(fileURLToPath(new URL('../dist/', import.meta.url)));
const browser = await launch();
const { page, errors } = await openApp(browser, srv.url, { width: 1100, height: 620 });
const calls = async () => { await frames(page, 4); return page.evaluate(() => window.__app.renderer.info.render.calls); };
const setNight = (n) => page.evaluate((n) => { const d = window.__app.dayNight; d.target = d.night = n; }, n);
try {
  // 2) Ba góc nhìn mới: nút có trong đúng danh sách, draw call now vs rain, ảnh
  for (const [b, v] of [['tp', 'wxRiverMouth'], ['ttl', 'wxTtlStays'], ['dragon', 'wxStreet']]) {
    if (!(await page.$(`button[data-view="${v}"]`))) { problems.push(`thiếu nút data-view=${v}`); continue; }
    for (const night of [0, 1]) {
      await setNight(night); await pickView(page, b, v); await setWx(page, 'now');
      const c0 = await calls();
      await setWx(page, 'rain', 0.6); await page.evaluate(() => window.__app.weather.setParams({ wind: 12 }, true)); await frames(page, 4);
      const c1 = await calls();
      console.log(v, night ? 'đêm' : 'ngày', 'draw call now', c0, 'rain60%+gió12', c1, 'chênh', c1 - c0);
      await page.screenshot({ path: `${OUT}${v}-${night ? 'dem' : 'ngay'}-rain.png` });
    }
    await setWx(page, 'now');
  }
  await setNight(0); await pickView(page, 'dragon', 'overview');

  // 3) Thẻ "Ảnh hưởng tới cầu": now / summer / rain 60% + gió 12 / storm
  await tap(page, '#btnWxImpact'); await frames(page, 2);
  const card = () => page.evaluate(() => document.getElementById('wxImpact').innerText);
  for (const [name, k] of [['now', 1], ['summer', 1], ['rain', 0.6], ['storm', 1]]) {
    await setWx(page, name, k);
    if (name === 'rain') await page.evaluate(() => window.__app.weather.setParams({ wind: 12 }, true));
    await page.waitForTimeout(700);
    console.log(`--- thẻ (${name}) ---\n${await card()}`);
    await page.screenshot({ path: `${OUT}impact-${name}.png` });
  }

  // 4) Đổi qua 9 ngôn ngữ: không còn phần tử data-i18n hiện nguyên khoá, thẻ không chứa {tham_số} / khoá trần; ảnh ar (RTL) và ru
  for (const l of LOCALES) {
    await pick(page, '#langSelect', l); await page.waitForTimeout(700);
    const r = await page.evaluate(() => {
      const raw = [...document.querySelectorAll('[data-i18n]')].filter((e) => e.textContent === e.dataset.i18n && e.dataset.i18n.length > 2).map((e) => e.dataset.i18n);
      const t = document.getElementById('wxImpact').innerText;
      return { raw, bad: /\{\w+\}|\bwx[A-Z]\w+/.test(t), dir: document.documentElement.dir };
    });
    if (r.raw.length) problems.push(`${l}: phần tử hiện nguyên khoá: ${r.raw.join(',')}`);
    if (r.bad) problems.push(`${l}: thẻ còn {tham_số} hoặc khoá trần`);
    if ((l === 'ar') !== (r.dir === 'rtl')) problems.push(`${l}: dir = ${r.dir}`);
    if (['ar', 'ru', 'ja'].includes(l)) await page.screenshot({ path: `${OUT}impact-storm-${l}.png` });
    console.log(l, 'dir', r.dir, 'khoá trần', r.raw.length);
  }
  await pick(page, '#langSelect', 'vi');

  // 5) Tour Cầu sông Hàn khi bão: caption có ghi chú hoãn quay
  await setWx(page, 'storm');
  const blocked = await page.evaluate(() => { const c = window.__app.songHan.ctrl; c.fromTour = true; const ok = c.start(30); c.fromTour = false; return { ok, text: document.getElementById('tourText').textContent }; });
  console.log('ctrl.start() khi bão (fromTour):', blocked.ok, '| tourText:', JSON.stringify(blocked.text));
} catch (e) { problems.push('lỗi script: ' + e.message); }
finally { await page.close(); await browser.close(); srv.close?.(); }
if (errors.length) problems.push('console: ' + errors.slice(0, 5).join(' | '));
console.log(problems.length ? 'VẤN ĐỀ:\n- ' + problems.join('\n- ') : 'weather-gd6-shots: không vấn đề');
process.exit(0);
