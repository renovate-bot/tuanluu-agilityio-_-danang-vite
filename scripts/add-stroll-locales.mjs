/* Thêm khóa dịch của chế độ đi dạo nhiều người vào cả 9 file src/i18n/locales/*.json (mẫu: scripts/add-multi-locales.mjs).
   exWalk đổi chữ thẻ "Đi bộ" thành "Đi dạo". Khóa stJump, stPhoto, stPhotoSaved, stPhotoFail dùng ở nút cảm ứng và chụp ảnh (giai đoạn sau).
   Bản dịch 8 ngôn ngữ ngoài tiếng Việt do người làm viết, cần người bản ngữ duyệt. `ar` là RTL.
   node scripts/add-stroll-locales.mjs */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'i18n', 'locales');
const K = ['exWalk', 'exWalkDesc', 'stSky', 'stSeats', 'stFull', 'stGo', 'stSolo', 'stOffline', 'stRoster', 'stWatch', 'stInvite', 'stInviteGo', 'stLate', 'stReleased', 'stLost', 'stJump', 'stPhoto', 'stPhotoSaved', 'stPhotoFail'];
const T = {
  vi: ['Đi dạo', 'Dạo bộ trên cầu và hai bờ sông', 'Sông Hàn, Đà Nẵng', 'Còn {n} trên 5 chỗ đi dạo', 'Đã đủ 5 người đi dạo', 'Đi dạo ngay', 'Đi một mình', 'Không kết nối được máy chủ. Bạn vẫn đi dạo được, nhưng một mình.', 'Đi dạo {w}/5 · Bay {f}/5', 'Đang xem: {name}', 'Có chỗ trống. Bạn muốn đi dạo không?', 'Vào đi dạo', 'Đã có người nhanh hơn.', 'Bạn đã nhường chỗ.', 'Mất kết nối. Bạn vẫn đi dạo được, nhưng một mình.', 'Nhảy', 'Chụp ảnh', 'Đã lưu ảnh', 'Không lưu được ảnh'],
  en: ['Stroll', 'Walk the bridges and both riverbanks', 'Han River, Da Nang', '{n} of 5 walking spots free', 'All 5 walking spots are taken', 'Start walking', 'Walk alone', "Can't reach the server. You can still walk, but alone.", 'Walking {w}/5 · Flying {f}/5', 'Watching: {name}', 'A spot is free. Want to go for a walk?', 'Join the walk', 'Someone was quicker.', 'You gave up your spot.', 'Connection lost. You can still walk, but alone.', 'Jump', 'Take photo', 'Photo saved', "Couldn't save the photo"],
  ko: ['산책', '다리와 강 양쪽 둑을 걸어요', '다낭 한강', '산책 자리 5개 중 {n}개 남음', '산책 자리 5개가 모두 찼습니다', '바로 산책', '혼자 산책', '서버에 연결할 수 없습니다. 혼자서는 산책할 수 있습니다.', '산책 {w}/5 · 비행 {f}/5', '관전 중: {name}', '빈자리가 있습니다. 산책하시겠어요?', '산책 참가', '다른 사람이 더 빨랐습니다.', '자리를 양보했습니다.', '연결이 끊어졌습니다. 혼자서는 계속 산책할 수 있습니다.', '점프', '사진 찍기', '사진을 저장했습니다', '사진을 저장하지 못했습니다'],
  ja: ['散歩', '橋と川の両岸を歩く', 'ダナン・ハン川', '散歩の枠 5 つのうち残り {n}', '散歩の枠 5 つが埋まっています', '今すぐ散歩', '一人で散歩', 'サーバーに接続できません。一人で散歩することはできます。', '散歩 {w}/5 · 飛行 {f}/5', '観戦中: {name}', '枠が空きました。散歩しますか？', '散歩に参加', '他の人が先でした。', '枠を譲りました。', '接続が切れました。一人で散歩を続けられます。', 'ジャンプ', '写真を撮る', '写真を保存しました', '写真を保存できませんでした'],
  zh: ['散步', '漫步大桥与两岸', '岘港汉江', '5个散步名额，还剩{n}个', '5个散步名额已满', '立即散步', '独自散步', '无法连接服务器。你仍可独自散步。', '散步 {w}/5 · 飞行 {f}/5', '正在观看：{name}', '有空位。想去散步吗？', '加入散步', '有人比你更快。', '你已让出位置。', '连接已断开。你仍可独自散步。', '跳跃', '拍照', '照片已保存', '无法保存照片'],
  th: ['เดินเล่น', 'เดินเล่นบนสะพานและริมสองฝั่งแม่น้ำ', 'แม่น้ำหาน ดานัง', 'เหลือ {n} จาก 5 ที่สำหรับเดินเล่น', 'ที่เดินเล่นครบ 5 คนแล้ว', 'เดินเล่นเลย', 'เดินคนเดียว', 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ คุณยังเดินเล่นคนเดียวได้', 'เดินเล่น {w}/5 · บิน {f}/5', 'กำลังดู: {name}', 'มีที่ว่าง อยากเดินเล่นไหม', 'เข้าร่วมเดินเล่น', 'มีคนเร็วกว่า', 'คุณสละที่แล้ว', 'การเชื่อมต่อขาดหาย คุณยังเดินเล่นคนเดียวได้', 'กระโดด', 'ถ่ายรูป', 'บันทึกรูปแล้ว', 'บันทึกรูปไม่ได้'],
  ar: ['نزهة', 'تمشَّ على الجسور وضفتي النهر', 'نهر هان، دا نانغ', 'متبقٍّ {n} من 5 أماكن للنزهة', 'اكتملت أماكن النزهة الخمسة', 'ابدأ النزهة', 'تنزّه وحدك', 'تعذّر الاتصال بالخادم. ما زال بإمكانك التنزّه وحدك.', 'يتنزّهون {w}/5 · يحلّقون {f}/5', 'تشاهد: {name}', 'يوجد مكان شاغر. هل تريد التنزّه؟', 'انضم إلى النزهة', 'سبقك شخص آخر.', 'لقد تخلّيت عن مكانك.', 'انقطع الاتصال. ما زال بإمكانك التنزّه وحدك.', 'اقفز', 'التقط صورة', 'تم حفظ الصورة', 'تعذّر حفظ الصورة'],
  hi: ['सैर', 'पुलों और नदी के दोनों किनारों पर टहलें', 'हान नदी, दा नांग', 'सैर की 5 में से {n} जगह खाली', 'सैर की सभी 5 जगहें भर गईं', 'अभी सैर करें', 'अकेले सैर करें', 'सर्वर से कनेक्ट नहीं हो सका। आप अकेले सैर कर सकते हैं।', 'सैर {w}/5 · उड़ान {f}/5', 'देख रहे हैं: {name}', 'एक जगह खाली है। सैर करना चाहेंगे?', 'सैर में शामिल हों', 'कोई और पहले पहुँच गया।', 'आपने अपनी जगह छोड़ दी।', 'कनेक्शन टूट गया। आप अकेले सैर जारी रख सकते हैं।', 'कूदें', 'फ़ोटो लें', 'फ़ोटो सहेजी गई', 'फ़ोटो सहेजी नहीं जा सकी'],
  ru: ['Прогулка', 'Пешком по мостам и обоим берегам реки', 'Река Хан, Дананг', 'Свободно мест для прогулки: {n} из 5', 'Все 5 мест для прогулки заняты', 'Гулять', 'Гулять одному', 'Не удалось подключиться к серверу. Можно гулять одному.', 'Гуляют {w}/5 · Летят {f}/5', 'Наблюдаете: {name}', 'Есть свободное место. Хотите прогуляться?', 'Присоединиться', 'Кто-то оказался быстрее.', 'Вы уступили место.', 'Связь потеряна. Можно гулять дальше одному.', 'Прыжок', 'Сфотографировать', 'Фото сохранено', 'Не удалось сохранить фото']
};
for (const [code, vals] of Object.entries(T)) {
  if (vals.length !== K.length) throw new Error(`${code}: ${vals.length} bản dịch, cần ${K.length}`);
  const file = join(dir, `${code}.json`);
  const json = JSON.parse(await readFile(file, 'utf8'));
  K.forEach((k, i) => { json[k] = vals[i]; });
  await writeFile(file, JSON.stringify(json, null, 2) + '\n');
  console.log(code, K.length, 'khóa');
}
