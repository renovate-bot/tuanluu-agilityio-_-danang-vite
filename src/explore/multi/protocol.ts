/* ===== Dù lượn nhiều người: định dạng tin khách ⇄ máy chủ (JSON) ===== */
import { multiParams } from './params';

export type ClientMsg =
  | { t: 'join'; name: string }
  | { t: 'pos'; x: number; y: number; z: number; yaw: number; bank: number }
  | { t: 'hb' }
  | { t: 'leave' };

export interface Flyer { slot: number; name: string }

// f: mỗi phần tử [slot, x, y, z, yaw, bank]
export type ServerMsg =
  | { t: 'lobby'; flyers: Flyer[] }
  | { t: 'joined'; slot: number }
  | { t: 'rejected'; why: 'full' | 'name' }
  | { t: 'pos'; f: number[][] }
  | { t: 'released' };

// Bỏ ký tự điều khiển và bidi/định dạng (giữ U+200D để ghép emoji), cắt khoảng trắng; rỗng hoặc quá nameMax grapheme → null
export function exSanitizeName(raw: string): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.replace(/[\p{Cc}\p{Cf}]/gu, c => (c === '‍' ? c : '')).trim();
  if (!s) return null;
  const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  let n = 0;
  for (const _ of seg.segment(s)) if (++n > multiParams.nameMax) return null;
  return s;
}
