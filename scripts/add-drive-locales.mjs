/* Thêm khóa dịch HUD / cảm ứng của chế độ lái xe (D-034 Task 9) vào cả 9 file src/i18n/locales/*.json (mẫu: scripts/add-stroll-locales.mjs).
   Khóa: drSpeedUnit (đơn vị đồng hồ), drHint (dòng gợi ý phím, máy tính), drGas / drBrake (nút bàn đạp cảm ứng),
   drMapTunnel (chú thích Hầm trên bản đồ nhỏ: công trình CHƯA XÂY nên luôn ghi "phương án đề xuất"), drLostChooser (màn chọn sau khi mất kết nối lúc xem), drWatch (đang xem xe của người khác).
   drCardDesc đã có từ Task 7 (bỏ qua nếu khóa đã tồn tại, không ghi đè). Tên thẻ "Ô tô" dùng khóa exCar có sẵn.
   Khóa thêm theo từng khóa (bảng X, sửa cuối D-034): drCreditLabel / drCreditMod / drCreditTm (dòng ghi công CC BY 4.0 của mô hình VF 3 ở màn chọn, nội dung theo public/car/LICENSE-VF3.txt),
   drSound (aria-label nút bật / tắt tiếng xe 🔊 / 🔇 trong #drHud).
   Sửa cuối D-034: bỏ khóa drRoster (không còn chỗ dùng; danh sách người chơi dùng drRosterAll); ar drGas "بنزين" (xăng) → "تسارع" (tăng tốc), cần người bản ngữ duyệt.
   Bản dịch 8 ngôn ngữ ngoài tiếng Việt do người làm viết, cần người bản ngữ duyệt. `ar` là RTL.
   node scripts/add-drive-locales.mjs */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'i18n', 'locales');
const K = ['drSpeedUnit', 'drHint', 'drGas', 'drBrake', 'drMapTunnel', 'drLostChooser', 'drWatch'];
const T = {
  vi: ['km/h', 'W A S D hoặc mũi tên: lái · Space: phanh tay · H: còi · kéo chuột: xoay camera · Esc: thoát', 'GA', 'PHANH', 'Hầm (phương án đề xuất)', 'Mất kết nối. Chọn Ô tô để kết nối lại.', 'Đang xem: {name}'],
  en: ['km/h', 'W A S D or arrows: drive · Space: handbrake · H: horn · drag mouse: turn camera · Esc: exit', 'GAS', 'BRAKE', 'Tunnel (proposed plan)', 'Connection lost. Choose Car to reconnect.', 'Watching: {name}'],
  ko: ['km/h', 'W A S D 또는 화살표: 운전 · Space: 핸드브레이크 · H: 경적 · 마우스 드래그: 카메라 회전 · Esc: 나가기', '가속', '브레이크', '터널 (제안 계획)', '연결이 끊어졌습니다. 다시 연결하려면 자동차를 선택하세요.', '관전 중: {name}'],
  ja: ['km/h', 'W A S D または矢印: 運転 · Space: サイドブレーキ · H: クラクション · マウスドラッグ: カメラ回転 · Esc: 終了', 'アクセル', 'ブレーキ', 'トンネル（提案案）', '接続が切れました。再接続するには「車」を選んでください。', '観戦中: {name}'],
  zh: ['km/h', 'W A S D 或方向键：驾驶 · Space：手刹 · H：鸣笛 · 拖动鼠标：旋转视角 · Esc：退出', '油门', '刹车', '隧道（建议方案）', '连接已断开。请选择“汽车”重新连接。', '正在观看：{name}'],
  th: ['กม./ชม.', 'W A S D หรือลูกศร: ขับ · Space: เบรกมือ · H: บีบแตร · ลากเมาส์: หมุนกล้อง · Esc: ออก', 'คันเร่ง', 'เบรก', 'อุโมงค์ (แนวทางที่เสนอ)', 'การเชื่อมต่อขาดหาย เลือก รถยนต์ เพื่อเชื่อมต่อใหม่', 'กำลังดู: {name}'],
  ar: ['كم/س', 'W A S D أو الأسهم: القيادة · Space: فرملة اليد · H: البوق · اسحب الفأرة: تدوير الكاميرا · Esc: خروج', 'تسارع', 'فرامل', 'النفق (مقترح)', 'انقطع الاتصال. اختر «سيارة» لإعادة الاتصال.', 'تشاهد: {name}'],
  hi: ['किमी/घं', 'W A S D या तीर: चलाएँ · Space: हैंडब्रेक · H: हॉर्न · माउस खींचें: कैमरा घुमाएँ · Esc: बाहर', 'गैस', 'ब्रेक', 'सुरंग (प्रस्तावित योजना)', 'कनेक्शन टूट गया। दोबारा जुड़ने के लिए कार चुनें।', 'देख रहे हैं: {name}'],
  ru: ['км/ч', 'W A S D или стрелки: ехать · Space: ручной тормоз · H: сигнал · перетащить мышью: повернуть камеру · Esc: выход', 'ГАЗ', 'ТОРМОЗ', 'Тоннель (предлагаемый проект)', 'Связь потеряна. Выберите «Автомобиль», чтобы подключиться снова.', 'Наблюдаете: {name}']
};
/* Khóa thêm sau Task 9: { khóa: { mã ngôn ngữ: bản dịch } } — đủ 9 ngôn ngữ */
const X = {
  drCreditLabel: { vi: 'Mô hình xe', en: 'Car model', ko: '자동차 모델', ja: '車の3Dモデル', zh: '汽车模型', th: 'โมเดลรถ', ar: 'نموذج السيارة', hi: 'कार मॉडल', ru: 'Модель автомобиля' },
  drSound: { vi: 'Tiếng xe', en: 'Car sound', ko: '자동차 소리', ja: '車の音', zh: '汽车声音', th: 'เสียงรถ', ar: 'صوت السيارة', hi: 'कार की आवाज़', ru: 'Звук машины' },
  drCreditMod: { vi: 'đã chỉnh sửa', en: 'modified', ko: '수정됨', ja: '改変あり', zh: '已修改', th: 'มีการดัดแปลง', ar: 'معدّل', hi: 'संशोधित', ru: 'изменена' },
  drCreditTm: {
    vi: 'VinFast, VF 3 là nhãn hiệu của chủ sở hữu; mô hình minh hoạ, không phải sản phẩm chính thức.',
    en: 'VinFast and VF 3 are trademarks of their owner; illustrative model, not an official product.',
    ko: 'VinFast, VF 3는 해당 소유자의 상표입니다. 설명용 모델이며 공식 제품이 아닙니다.',
    ja: 'VinFast、VF 3 は所有者の商標です。説明用のモデルで、公式製品ではありません。',
    zh: 'VinFast、VF 3 是其所有者的商标；模型仅作示意，并非官方产品。',
    th: 'VinFast และ VF 3 เป็นเครื่องหมายการค้าของเจ้าของ โมเดลนี้ใช้เพื่อประกอบภาพ ไม่ใช่ผลิตภัณฑ์อย่างเป็นทางการ',
    ar: 'VinFast وVF 3 علامتان تجاريتان لمالكهما؛ نموذج توضيحي وليس منتجًا رسميًا.',
    hi: 'VinFast और VF 3 उनके स्वामी के ट्रेडमार्क हैं; यह चित्रण के लिए मॉडल है, आधिकारिक उत्पाद नहीं।',
    ru: 'VinFast и VF 3 — товарные знаки их владельца; модель иллюстративная, не официальный продукт.'
  }
};
for (const [k, tr] of Object.entries(X)) if (Object.keys(tr).length !== Object.keys(T).length) throw new Error(`${k}: thiếu ngôn ngữ`);
for (const [code, vals] of Object.entries(T)) {
  if (vals.length !== K.length) throw new Error(`${code}: ${vals.length} bản dịch, cần ${K.length}`);
  const file = join(dir, `${code}.json`);
  const json = JSON.parse(await readFile(file, 'utf8'));
  let added = 0;
  K.forEach((k, i) => { if (!(k in json)) { json[k] = vals[i]; added++; } });
  for (const [k, tr] of Object.entries(X)) if (!(k in json)) { json[k] = tr[code]; added++; }
  await writeFile(file, JSON.stringify(json, null, 2) + '\n');
  console.log(code, added, 'khóa mới');
}
