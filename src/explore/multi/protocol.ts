/* ===== Dù lượn nhiều người: định dạng tin khách ⇄ máy chủ (JSON) ===== */
import { multiParams } from './params';

export type ClientMsg =
  | { t: 'join'; name: string }
  | { t: 'pos'; x: number; y: number; z: number; yaw: number; bank: number; ts?: number }   // ts: giờ gửi theo đồng hồ của khách (ms); máy chủ cũ bỏ qua
  | { t: 'hb' }
  | { t: 'leave' };

export interface Flyer { slot: number; name: string }

// f: mỗi phần tử [slot, x, y, z, yaw, bank, giờ gửi (ms)]; chỉ gồm slot có vị trí mới. Giờ gửi = ts của khách, khách cũ không gửi ts thì là giờ máy chủ nhận;
// mỗi slot một trục giờ riêng, khách nhận tự quy đổi. Máy chủ cũ (trước bản sửa giật) gửi 6 phần tử và phát lại vị trí cũ của mọi slot: khách mới nhận được cả hai dạng
export type ServerMsg =
  | { t: 'lobby'; flyers: Flyer[] }
  | { t: 'joined'; slot: number }
  | { t: 'rejected'; why: 'full' | 'name' }
  | { t: 'pos'; f: number[][] }
  | { t: 'released' };

// Ký tự trông như khoảng trống dù thuộc nhóm chữ/ký hiệu (chữ đệm Hangul, chữ nổi trống, nguyên âm ẩn Khmer): không tính là chữ thấy được
const BLANK = /[\u115F\u1160\u3164\uFFA0\u2800\u17B4\u17B5]/gu;
const VISIBLE = /[\p{L}\p{N}\p{S}\p{P}]/u;

/* Bỏ ký tự điều khiển và bidi/định dạng (giữ U+200D để ghép emoji), cắt khoảng trắng.
   null nếu: rỗng; không có chữ/số/ký hiệu/dấu câu nào thấy được; quá nameMax grapheme; một grapheme quá graphemeCpMax code point (chồng dấu); tổng quá nameCpMax code point */
export function exSanitizeName(raw: string): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.replace(/[\p{Cc}\p{Cf}]/gu, c => (c === '\u200D' ? c : '')).trim();
  if (!s || !VISIBLE.test(s.replace(BLANK, ''))) return null;
  const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  let n = 0, cps = 0;
  for (const g of seg.segment(s)) {
    let k = 0;
    for (const _ of g.segment) k++;
    cps += k;
    if (++n > multiParams.nameMax || k > multiParams.graphemeCpMax || cps > multiParams.nameCpMax) return null;
  }
  return s;
}
