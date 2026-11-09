/* Thêm khóa dịch của màn chọn phương tiện và giao diện khi bay (chế độ Tự khám phá) vào cả 9 file src/i18n/locales/*.json.
   Bản dịch 8 ngôn ngữ ngoài tiếng Việt chưa có người bản ngữ duyệt. `ar` là RTL (file ar.json đã có _dir).
   node scripts/add-explore-locales.mjs */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'i18n', 'locales');
const K = ['exTitle', 'exGlider', 'exGliderDesc', 'exCar', 'exBike', 'exWalk', 'exGuided', 'exGuidedDesc', 'exSoon', 'exDesktopOnly', 'exHint', 'exExit'];
const T = {
  vi: ['Bạn muốn khám phá Đà Nẵng thế nào?', 'Dù lượn', 'Bay tự do trên sông Hàn', 'Ô tô', 'Xe máy', 'Đi bộ', 'Tham quan có hướng dẫn', 'Tour, góc nhìn và thuyết minh', 'Sắp có', 'Chỉ dùng trên máy tính', 'W/S hoặc ↑/↓ để lên/xuống · A/D hoặc ←/→ để rẽ · Esc để thoát', 'Thoát'],
  en: ['How would you like to explore Da Nang?', 'Paraglider', 'Fly freely over the Han River', 'Car', 'Motorbike', 'On foot', 'Guided tour', 'Tours, viewpoints and narration', 'Coming soon', 'Desktop only', 'W/S or ↑/↓ to climb/descend · A/D or ←/→ to turn · Esc to exit', 'Exit'],
  ko: ['다낭을 어떻게 둘러보시겠어요?', '패러글라이더', '한강 위를 자유롭게 비행', '자동차', '오토바이', '도보', '가이드 투어', '투어, 시점, 해설', '곧 제공', '데스크톱 전용', 'W/S 또는 ↑/↓ 상승/하강 · A/D 또는 ←/→ 회전 · Esc 종료', '나가기'],
  ja: ['ダナンをどのように楽しみますか？', 'パラグライダー', 'ハン川の上を自由に飛ぶ', '車', 'バイク', '徒歩', 'ガイド付きツアー', 'ツアー、視点、ナレーション', '近日公開', 'パソコン専用', 'W/S または ↑/↓ で上昇/下降 · A/D または ←/→ で旋回 · Esc で終了', '終了'],
  zh: ['您想如何探索岘港？', '滑翔伞', '在汉江上自由飞行', '汽车', '摩托车', '步行', '导览参观', '游览、视角和讲解', '即将推出', '仅限电脑', 'W/S 或 ↑/↓ 升降 · A/D 或 ←/→ 转向 · Esc 退出', '退出'],
  th: ['คุณอยากสำรวจดานังแบบไหน?', 'พาราไกลเดอร์', 'บินอิสระเหนือแม่น้ำหาน', 'รถยนต์', 'มอเตอร์ไซค์', 'เดินเท้า', 'ชมแบบมีไกด์', 'ทัวร์ มุมมอง และคำบรรยาย', 'เร็วๆ นี้', 'ใช้ได้เฉพาะคอมพิวเตอร์', 'W/S หรือ ↑/↓ เพื่อขึ้น/ลง · A/D หรือ ←/→ เพื่อเลี้ยว · Esc เพื่อออก', 'ออก'],
  ar: ['كيف تريد استكشاف دا نانغ؟', 'المظلة الشراعية', 'حلّق بحرية فوق نهر هان', 'سيارة', 'دراجة نارية', 'سيرًا على الأقدام', 'جولة مرشدة', 'جولات وزوايا رؤية وتعليق صوتي', 'قريبًا', 'للحاسوب فقط', 'W/S أو ↑/↓ للصعود/الهبوط · A/D أو ←/→ للانعطاف · Esc للخروج', 'خروج'],
  hi: ['आप दा नांग को कैसे देखना चाहेंगे?', 'पैराग्लाइडर', 'हान नदी के ऊपर खुली उड़ान', 'कार', 'मोटरसाइकिल', 'पैदल', 'गाइडेड टूर', 'टूर, दृश्य और कमेंट्री', 'जल्द आ रहा है', 'केवल कंप्यूटर पर', 'W/S या ↑/↓ से ऊपर/नीचे · A/D या ←/→ से मुड़ें · Esc से बाहर', 'बाहर निकलें'],
  ru: ['Как вы хотите исследовать Дананг?', 'Парапланер', 'Свободный полёт над рекой Хан', 'Автомобиль', 'Мотоцикл', 'Пешком', 'Экскурсия с гидом', 'Туры, ракурсы и озвучка', 'Скоро', 'Только для компьютера', 'W/S или ↑/↓ — вверх/вниз · A/D или ←/→ — поворот · Esc — выход', 'Выход']
};
for (const [code, vals] of Object.entries(T)) {
  const file = join(dir, `${code}.json`);
  const json = JSON.parse(await readFile(file, 'utf8'));
  K.forEach((k, i) => { json[k] = vals[i]; });
  await writeFile(file, JSON.stringify(json, null, 2) + '\n');
  console.log(code, K.length, 'khóa');
}
