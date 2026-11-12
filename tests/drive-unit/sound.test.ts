/* ===== Lái xe: nút bật / tắt tiếng xe (src/explore/drive/sound.ts, #drSoundBtn trong index.html) =====
   Node, không Web Audio: chỉ kiểm hàm thuần chọn có tiếng / đường ra và phần khai báo nút (HTML + 9 locale). Tiếng thật chưa ai nghe trong test */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { drSoundWanted, drSoundRoute, drSound } from '../../src/explore/drive/sound.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

test('chưa bấm nút: theo âm thanh chung (đã bật nhạc thì có tiếng như cũ, chưa thì im)', () => {
  assert.equal(drSoundWanted(null, true), true);
  assert.equal(drSoundWanted(null, false), false);
  assert.equal(drSoundRoute(null, true), 'sfx');
  assert.equal(drSoundRoute(null, false), null, 'mặc định TẮT khi chưa bật âm thanh chung: không tự tạo ngữ cảnh');
});

test('đã bấm nút: theo lựa chọn; bật khi chưa có âm thanh chung thì đi cổng riêng (không phát nhạc nền)', () => {
  assert.equal(drSoundWanted(true, false), true);
  assert.equal(drSoundRoute(true, false), 'ext');
  assert.equal(drSoundRoute(true, true), 'sfx', 'âm thanh chung đang bật: qua master như cũ');
  assert.equal(drSoundWanted(false, true), false, 'tắt bằng nút thắng âm thanh chung');
  assert.equal(drSoundRoute(false, true), null);
  assert.equal(drSoundRoute(false, false), null);
});

test('toggle khi chưa vào chế độ lái: chỉ đổi lựa chọn, không dựng nút âm thanh', () => {
  assert.equal(drSound.on, false, 'chưa start: không có tiếng');
  assert.equal(drSound.toggle(), true, 'chưa bấm, âm thanh chung tắt ⇒ bấm lần đầu là bật');
  assert.equal(drSound.toggle(), false, 'bấm lại là tắt');
});

test('#drSoundBtn nằm trong #drHud, có aria-label qua i18n, aria-pressed; khóa drSound đủ 9 ngôn ngữ', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const hud = html.match(/<div id="drHud"[^]*?\n<\/div>/);
  assert.ok(hud, 'thiếu #drHud');
  const b = hud[0].match(/<button id="drSoundBtn"[^>]*>/);
  assert.ok(b, '#drSoundBtn phải nằm trong #drHud');
  for (const s of ['type="button"', 'data-i18n-aria="drSound"', 'aria-label=', 'aria-pressed="false"']) assert.ok(b[0].includes(s), `#drSoundBtn thiếu ${s}`);
  for (const code of ['vi', 'en', 'ko', 'ja', 'zh', 'th', 'ar', 'hi', 'ru']) {
    const j = JSON.parse(readFileSync(join(ROOT, `src/i18n/locales/${code}.json`), 'utf8'));
    assert.ok(typeof j.drSound === 'string' && j.drSound.length > 0, `${code}: thiếu drSound`);
  }
  const css = readFileSync(join(ROOT, 'src/styles/main.css'), 'utf8');
  assert.ok(/#drSoundBtn\{[^}]*width:44px;height:44px/.test(css), 'vùng chạm 44 × 44 px');
});
