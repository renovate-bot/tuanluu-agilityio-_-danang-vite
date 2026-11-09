/* Thêm khóa dịch của chế độ dù lượn nhiều người vào cả 9 file src/i18n/locales/*.json.
   Bản dịch 8 ngôn ngữ ngoài tiếng Việt chưa có người bản ngữ duyệt. Các giai đoạn sau thêm khóa vào K và T. `ar` là RTL.
   node scripts/add-multi-locales.mjs */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'i18n', 'locales');
const K = ['exMpFlying'];
const T = {
  vi: ['Đang bay {n}/5'],
  en: ['Flying {n}/5'],
  ko: ['비행 중 {n}/5'],
  ja: ['飛行中 {n}/5'],
  zh: ['飞行中 {n}/5'],
  th: ['กำลังบิน {n}/5'],
  ar: ['يحلّقون {n}/5'],
  hi: ['उड़ान में {n}/5'],
  ru: ['В полёте {n}/5']
};
for (const [code, vals] of Object.entries(T)) {
  const file = join(dir, `${code}.json`);
  const json = JSON.parse(await readFile(file, 'utf8'));
  K.forEach((k, i) => { json[k] = vals[i]; });
  await writeFile(file, JSON.stringify(json, null, 2) + '\n');
  console.log(code, K.length, 'khóa');
}
