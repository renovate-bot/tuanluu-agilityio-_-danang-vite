/* Thêm aria-label Buy me a coffee vào cả 9 file src/i18n/locales/*.json.
   node scripts/add-donate-locales.mjs */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'i18n', 'locales');
const K = ['donateAria'];
const T = {
  vi: ['Mời tác giả một ly cà phê qua MoMo (mở tab mới)'],
  en: ['Buy the author a coffee via MoMo (opens in a new tab)'],
  ko: ['MoMo로 제작자에게 커피 한 잔 사주기 (새 탭에서 열림)'],
  ja: ['MoMoで作者にコーヒーをおごる（新しいタブで開きます）'],
  zh: ['通过 MoMo 请作者喝杯咖啡（在新标签页中打开）'],
  th: ['เลี้ยงกาแฟผู้สร้างผ่าน MoMo (เปิดในแท็บใหม่)'],
  ar: ['ادعُ المؤلف إلى فنجان قهوة عبر MoMo (يفتح في علامة تبويب جديدة)'],
  hi: ['MoMo से लेखक को एक कॉफ़ी पिलाएँ (नए टैब में खुलता है)'],
  ru: ['Угостить автора кофе через MoMo (откроется в новой вкладке)']
};
for (const [code, vals] of Object.entries(T)) {
  const file = join(dir, `${code}.json`);
  const json = JSON.parse(await readFile(file, 'utf8'));
  K.forEach((k, i) => { json[k] = vals[i]; });
  await writeFile(file, JSON.stringify(json, null, 2) + '\n');
  console.log(code, K.length, 'khóa');
}
