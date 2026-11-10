// Chụp ảnh tự xem Giai đoạn 7: nắng hè (ảo ảnh, võng cáp), cây đổ sau bão, kịch bản bão (chú thích, thanh tiến độ), 9 ngôn ngữ -> tests/screens/weather-gd7/
// In kèm: draw call now vs summer, ma trận cây dựng lại có trùng gốc, kịch bản chạy hết + trả preset, rò rỉ geometries/textures sau 3 lần bật/tắt, âm thanh (nếu AudioContext chạy được).
//   npm run build && node tests/weather-gd7-shots.mjs
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { serveDir, launch, openApp, frames, pickView, tap, pick } from './lib.mjs';
import { setWx, snapAtmosphere } from './weather-lib.mjs';

const OUT = fileURLToPath(new URL('./screens/weather-gd7/', import.meta.url));
fs.mkdirSync(OUT, { recursive: true });
const LOCALES = ['vi', 'en', 'ko', 'ja', 'zh', 'th', 'ar', 'hi', 'ru'];
const problems = [];

// 1) i18n: 11 khoá GĐ7 đủ ở 9 ngôn ngữ, giữ nguyên tham số {k}
const dir = fileURLToPath(new URL('../src/i18n/locales/', import.meta.url));
const vi = JSON.parse(fs.readFileSync(`${dir}vi.json`, 'utf8'));
const KEYS = ['wxStormRun', 'wxStormStop', 'wxStormHint', 'wxS1', 'wxS2', 'wxS3', 'wxS4', 'wxS5', 'wxS6', 'wxS7', 'wxS8'];
for (const l of LOCALES) {
  const j = JSON.parse(fs.readFileSync(`${dir}${l}.json`, 'utf8'));
  for (const k of KEYS) {
    if (typeof j[k] !== 'string' || !j[k]) { problems.push(`${l}: thiếu khoá ${k}`); continue; }
    const a = (vi[k].match(/\{\w+\}/g) || []).sort().join(), b = (j[k].match(/\{\w+\}/g) || []).sort().join();
    if (a !== b) problems.push(`${l}: khoá ${k} lệch tham số (${a} ≠ ${b})`);
  }
}

const srv = await serveDir(fileURLToPath(new URL('../dist/', import.meta.url)));
const browser = await launch();
const { page, errors } = await openApp(browser, srv.url, { width: 1100, height: 620 });
const calls = async () => { await frames(page, 4); return page.evaluate(() => window.__app.renderer.info.render.calls); };
const mem = () => page.evaluate(() => { const m = window.__app.renderer.info.memory; return { g: m.geometries, t: m.textures }; });
const setNight = (n) => page.evaluate((n) => { const d = window.__app.dayNight; d.target = d.night = n; }, n);
const shot = async (name) => { await frames(page, 3); await page.screenshot({ path: `${OUT}${name}.png` }); };
try {
  // 2) Nắng hè: draw call, võng cáp (uniform), ảnh Thuận Phước + đường phố ngày/đêm
  for (const [b, v] of [['tp', 'tpBay'], ['dragon', 'wxStreet']]) {
    await setNight(0); await pickView(page, b, v);
    await setWx(page, 'now'); const c0 = await calls(); await shot(`${v}-ngay-now`);
    await setWx(page, 'summer'); const c1 = await calls();
    const sag = await page.evaluate(() => window.__app.weather.impact().find((r) => r.key === 'thuanPhuoc').sag);
    console.log(v, 'draw call now', c0, 'summer', c1, 'chênh', c1 - c0, '| võng thêm (m, chưa phóng đại)', sag.toFixed(3));
    if (c1 - c0 > 0) problems.push(`${v}: summer tăng draw call ${c1 - c0}`);
    await shot(`${v}-ngay-summer`);
    await setNight(1); await shot(`${v}-dem-summer`);
    await setNight(0);
  }
  // tpBay ở sát cáp để thấy võng: now vs summer
  await pickView(page, 'tp', 'tpBay');
  await page.evaluate(() => { const { camera, controls } = window.__app; camera.position.set(0, 40, -2900 + 300); controls.target.set(0, 40, -2900); controls.update(); });
  await setWx(page, 'now'); await shot('tp-cap-now'); await setWx(page, 'summer'); await shot('tp-cap-summer');
  await setWx(page, 'now');

  // 3) Cây đổ: đổ ngay quanh điểm nhìn, dựng lại → ma trận trùng gốc tuyệt đối
  await pickView(page, 'dragon', 'wxStreet');
  const treeMats = () => page.evaluate(() => window.__app.weather.fallen.snapshot());
  const before = await treeMats();
  await page.evaluate(() => window.__app.weather.fallen.fell());
  await page.waitForTimeout(300);
  const info = await page.evaluate(() => window.__app.weather.fallen.state());
  console.log('cây: số cặp', info.pairs, 'đã chọn đổ', info.down);
  if (!info.pairs) problems.push('fallen: không tìm thấy cặp thân–tán cây');
  if (!info.down) problems.push('fallen: không chọn được cây nào quanh điểm nhìn');
  await page.evaluate(() => { const w = window.__app.weather; w.setParams({ wind: 3 }, true); });
  await frames(page, 80);                                    // đổ xong (fallSec = 3 s ở dt ≤ 0,05)
  console.log('góc cây sau chờ', (await page.evaluate(() => window.__app.weather.fallen.state().angle)).toFixed(3), 'rad');
  await shot('trees-fallen-street');
  await page.evaluate(() => { const { camera, controls } = window.__app; camera.position.set(-230, 16, 60); controls.target.set(-200, 5, 0); controls.update(); });
  await shot('trees-fallen-wide');
  await page.evaluate(() => window.__app.weather.fallen.stand());
  const after = await treeMats();
  const same = before.length === after.length && before.every((a, i) => a.length === after[i].length && a.every((x, j) => x === after[i][j]));
  console.log('ma trận cây sau dựng lại trùng gốc:', same);
  if (!same) problems.push('fallen: ma trận cây sau stand() khác gốc');
  await page.evaluate(() => window.__app.weather.setParams({ wind: 0 }, true));
  await setWx(page, 'now');

  // 4) Kịch bản bão: tua nhanh ×12, chụp ở các mốc, kiểm trả preset, rò rỉ
  await pickView(page, 'dragon', 'overview');
  await pick(page, '#weatherSel', 'rain'); await frames(page, 2);
  const pre = await page.evaluate(() => { const s = window.__app.weather.state; return { preset: s.preset, k: s.intensity, night: window.__app.dayNight.night }; });
  const m0 = await mem(), memRuns = [];
  const snaps = new Set([0, 3, 4, 5, 7]);
  for (let run = 0; run < 3; run++) {
    await tap(page, '#btnWxStorm');
    await page.evaluate(() => { window.__app.weather.scenario.speed = 12; });
    const caps = [];
    for (let guard = 0; guard < 4000; guard++) {
      const r = await page.evaluate(() => { const s = window.__app.weather.scenario; return { run: s.running, step: s.step, t: s.t, text: document.getElementById('wxScenarioText').textContent, hidden: document.getElementById('wxScenario').hidden }; });
      if (!r.run) break;
      if (caps[caps.length - 1]?.step !== r.step && r.step >= 0) {
        caps.push(r);
        if (run === 0 && snaps.has(r.step)) { await page.waitForTimeout(400); await shot(`scenario-s${r.step + 1}`); }
      }
      await frames(page, 2);
    }
    console.log(`lần ${run + 1}: chú thích`, caps.map((c) => `${c.step + 1}:${c.text.slice(0, 28)}`).join(' | '));
    if (caps.length !== 8) problems.push(`kịch bản lần ${run + 1}: ${caps.length}/8 chú thích`);
    await frames(page, 4);
    const end = await page.evaluate(() => { const s = window.__app.weather.state; return { preset: s.preset, k: s.intensity, running: window.__app.weather.scenario.running, hidden: document.getElementById('wxScenario').hidden, pressed: document.getElementById('btnWxStorm').getAttribute('aria-pressed'), night: window.__app.dayNight.night, trees: window.__app.weather.fallen.state().down }; });
    if (end.preset !== pre.preset || end.k !== pre.k) problems.push(`kịch bản lần ${run + 1}: preset ${end.preset}/${end.k} ≠ ${pre.preset}/${pre.k}`);
    if (end.running || !end.hidden || end.pressed !== 'false') problems.push(`kịch bản lần ${run + 1}: UI chưa trả về (${JSON.stringify(end)})`);
    if (end.night !== pre.night) problems.push('kịch bản làm đổi ngày/đêm');
    if (end.trees) problems.push(`kịch bản lần ${run + 1}: cây vẫn đổ sau khi kết thúc`);
    memRuns.push(await mem());
  }
  // Lần 1–2 được phép tạo tài nguyên lười (mưa, chớp, mesh chỉ hiện khi bão… lần đầu được vẽ); rò rỉ thật = lần 3 còn tăng nữa
  console.log('geometries/textures trước', m0, 'sau từng lần', JSON.stringify(memRuns));
  // Kiểm chặt (đúng đặc tả) nằm ở tests/weather-check.mjs (GĐ7): mốc đo sau khi mesh chớp đã được vẽ một lần. Ở đây chỉ in số để tham khảo.
  if (memRuns[2].g > memRuns[1].g || memRuns[2].t > memRuns[1].t) problems.push(`rò rỉ: sau lần 2 ${JSON.stringify(memRuns[1])} → sau lần 3 ${JSON.stringify(memRuns[2])}`);

  // 5) Dừng giữa chừng + người xem chọn preset khác khi đang chạy
  await tap(page, '#btnWxStorm'); await page.evaluate(() => { window.__app.weather.scenario.speed = 12; }); await frames(page, 30);
  await tap(page, '#btnWxStorm'); await frames(page, 3);
  const stopped = await page.evaluate(() => ({ running: window.__app.weather.scenario.running, preset: window.__app.weather.state.preset, sel: document.getElementById('weatherSel').value }));
  console.log('sau Dừng kịch bản:', JSON.stringify(stopped));
  if (stopped.running || stopped.preset !== 'rain') problems.push('Dừng kịch bản không trả preset cũ');
  await tap(page, '#btnWxStorm'); await frames(page, 4); await pick(page, '#weatherSel', 'summer'); await frames(page, 3);
  const user = await page.evaluate(() => ({ running: window.__app.weather.scenario.running, preset: window.__app.weather.state.preset }));
  if (user.running || user.preset !== 'summer') problems.push('chọn preset khi đang chạy kịch bản không dừng kịch bản');

  // 6) Esc / kéo chuột chỉ trả camera
  await pick(page, '#weatherSel', 'now'); await tap(page, '#btnWxStorm'); await frames(page, 4);
  await page.keyboard.press('Escape');
  const own = await page.evaluate(() => ({ owned: window.__app.weather.scenario.cameraOwned, running: window.__app.weather.scenario.running }));
  console.log('sau Esc:', JSON.stringify(own));
  if (own.owned || !own.running) problems.push('Esc phải trả camera nhưng giữ kịch bản chạy');
  await tap(page, '#btnWxStorm'); await frames(page, 3);

  // 7) Âm thanh: bật audio rồi thử setWeather / thunder (chỉ kiểm không lỗi; không nghe được trong headless)
  const snd = await page.evaluate(async () => {
    try { const a = window.__app.audio; a.start(); a.setWeather(0.8, 20, 0.7, false); a.thunder(0.5, 1); a.setWeather(0.8, 20, 0.7, true); a.setWeather(0, 0, 0, false); return { on: a.on }; }
    catch (e) { return { error: String(e) }; }
  });
  console.log('âm thanh:', JSON.stringify(snd));
  if (snd.error) problems.push('audio: ' + snd.error);

  // 8) Chú thích ở 9 ngôn ngữ (khung cuối của kịch bản)
  await tap(page, '#btnWxStorm'); await page.evaluate(() => { window.__app.weather.scenario.speed = 12; });
  await page.waitForFunction(() => window.__app.weather.scenario.step >= 3, null, { timeout: 240000 });
  for (const l of LOCALES) {
    await pick(page, '#langSelect', l); await page.waitForTimeout(500);
    const r = await page.evaluate(() => ({ text: document.getElementById('wxScenarioText').textContent, btn: document.getElementById('btnWxStorm').textContent, dir: document.documentElement.dir }));
    if (/\{\w+\}|^wx[A-Z]/.test(r.text + r.btn)) problems.push(`${l}: chú thích hiện tham số/khoá trần: ${r.text}`);
    if (['ar', 'ru', 'ja', 'en'].includes(l)) await shot(`scenario-lang-${l}`);
    console.log(l, JSON.stringify(r.btn), r.text.slice(0, 50));
  }
  await pick(page, '#langSelect', 'vi');
  await tap(page, '#btnWxStorm');
} catch (e) { problems.push('lỗi script: ' + e.message); }
finally { await page.close(); await browser.close(); srv.close?.(); }
if (errors.length) problems.push('console: ' + errors.slice(0, 5).join(' | '));
console.log(problems.length ? 'VẤN ĐỀ:\n- ' + problems.join('\n- ') : 'weather-gd7-shots: không vấn đề');
process.exit(0);
