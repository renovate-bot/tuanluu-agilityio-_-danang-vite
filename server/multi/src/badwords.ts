/* ===== Lọc tên tục (ngắn gọn, vi + en) ===== */
// Từ tục tiếng Việt có dấu: chặn khi là một từ riêng, viết đúng dấu (không lẫn với lớn, lợn, Các, Buổi, Bưởi)
const TONED = ['cặc', 'buồi', 'lồn'];
// Cùng các từ đó gõ không dấu: chỉ chặn khi cả tên đúng là từ đó (gõ không dấu thì không phân biệt được với từ thường)
const PLAIN = ['cac', 'buoi', 'lon'];
// Chặn khi là một từ riêng trong tên (hoặc cả tên khi bỏ ngăn cách: v.c.l); không chặn khi chỉ là một phần của từ (Grape, Dickson)
const WORD = ['dit', 'dm', 'dcm', 'dmm', 'dkm', 'vcl', 'vl', 'fag', 'sex', 'rape', 'dick'];
// Chặn khi xuất hiện ở bất kỳ đâu trong tên đã bỏ ngăn cách
const SUB = ['du ma', 'cutt', 'fuck', 'shit', 'bitch', 'cunt', 'pussy', 'asshole', 'nigger', 'nigga'];

// Hạ chữ thường; so từ có dấu trước, rồi bỏ dấu (đ → d), bỏ ký tự ngăn cách và tìm từ cấm
export function exIsBad(name: string): boolean {
  const low = name.toLowerCase().normalize('NFC');
  const tonedWords = low.split(/[^\p{L}\p{N}]+/u);
  if (TONED.some(b => tonedWords.includes(b)) || PLAIN.includes(tonedWords.join(''))) return true;
  const flat = low.replace(/đ/g, 'd').normalize('NFD').replace(/\p{M}/gu, '');
  const spaced = flat.replace(/[^a-z0-9]+/g, ' ').trim();
  const tight = spaced.replace(/ /g, '');
  const words = spaced.split(' ');
  return WORD.some(b => words.includes(b) || tight === b) || SUB.some(b => tight.includes(b.replace(/ /g, '')));
}
