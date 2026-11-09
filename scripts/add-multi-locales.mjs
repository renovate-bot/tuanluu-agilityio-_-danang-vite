/* Thêm khóa dịch của chế độ dù lượn nhiều người vào cả 9 file src/i18n/locales/*.json.
   Bản dịch 8 ngôn ngữ ngoài tiếng Việt chưa có người bản ngữ duyệt. Các giai đoạn sau thêm khóa vào K và T. `ar` là RTL.
   node scripts/add-multi-locales.mjs */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'i18n', 'locales');
const K = ['exMpFlying', 'exMpSeats', 'exMpSky', 'exMpName', 'exMpNameMax', 'exMpFly', 'exMpSolo', 'exMpOffline', 'exMpNameBad'];
const T = {
  vi: ['Đang bay {n}/5', 'Còn {n} trên 5 chỗ', 'Bầu trời Đà Nẵng', 'Tên của bạn', 'Tối đa {n} ký tự', 'Bay ngay', 'Bay một mình', 'Không kết nối được máy chủ. Bạn vẫn bay được, nhưng một mình.', 'Tên này không dùng được, hãy chọn tên khác.'],
  en: ['Flying {n}/5', '{n} of 5 seats free', 'Da Nang sky', 'Your name', 'Up to {n} characters', 'Fly now', 'Fly solo', "Can't reach the server. You can still fly, but alone.", "That name can't be used. Please pick another."],
  ko: ['비행 중 {n}/5', '5자리 중 {n}자리 남음', '다낭의 하늘', '내 이름', '최대 {n}자', '바로 비행', '혼자 비행', '서버에 연결할 수 없습니다. 혼자서는 비행할 수 있습니다.', '사용할 수 없는 이름입니다. 다른 이름을 입력하세요.'],
  ja: ['飛行中 {n}/5', '5席中、残り{n}席', 'ダナンの空', 'あなたの名前', '最大{n}文字', '今すぐ飛ぶ', '一人で飛ぶ', 'サーバーに接続できません。一人で飛ぶことはできます。', 'この名前は使えません。別の名前にしてください。'],
  zh: ['飞行中 {n}/5', '5个位置，还剩{n}个', '岘港的天空', '你的名字', '最多{n}个字符', '立即起飞', '单独飞行', '无法连接服务器。你仍可单独飞行。', '此名字不可用，请换一个。'],
  th: ['กำลังบิน {n}/5', 'เหลือ {n} จาก 5 ที่นั่ง', 'ท้องฟ้าดานัง', 'ชื่อของคุณ', 'สูงสุด {n} ตัวอักษร', 'บินเลย', 'บินคนเดียว', 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ คุณยังบินคนเดียวได้', 'ใช้ชื่อนี้ไม่ได้ กรุณาเลือกชื่ออื่น'],
  ar: ['يحلّقون {n}/5', 'متبقٍّ {n} من 5 مقاعد', 'سماء دا نانغ', 'اسمك', 'الحد الأقصى {n} حروف', 'حلّق الآن', 'حلّق وحدك', 'تعذّر الاتصال بالخادم. ما زال بإمكانك التحليق وحدك.', 'لا يمكن استخدام هذا الاسم، اختر اسمًا آخر.'],
  hi: ['उड़ान में {n}/5', '5 में से {n} जगह खाली', 'दा नांग का आकाश', 'आपका नाम', 'अधिकतम {n} अक्षर', 'अभी उड़ें', 'अकेले उड़ें', 'सर्वर से कनेक्ट नहीं हो सका। आप अकेले उड़ सकते हैं।', 'यह नाम उपयोग नहीं हो सकता, कोई और नाम चुनें।'],
  ru: ['В полёте {n}/5', 'Свободно мест: {n} из 5', 'Небо Дананга', 'Ваше имя', 'Не более {n} символов', 'Лететь', 'Лететь одному', 'Не удалось подключиться к серверу. Можно лететь одному.', 'Это имя недоступно, выберите другое.']
};
for (const [code, vals] of Object.entries(T)) {
  const file = join(dir, `${code}.json`);
  const json = JSON.parse(await readFile(file, 'utf8'));
  K.forEach((k, i) => { json[k] = vals[i]; });
  await writeFile(file, JSON.stringify(json, null, 2) + '\n');
  console.log(code, K.length, 'khóa');
}
