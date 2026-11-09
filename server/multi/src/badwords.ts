/* ===== Lọc tên tục (ngắn gọn, vi + en) ===== */
const BAD = ['dit', 'du ma', 'dm', 'dcm', 'dmm', 'cac', 'lon', 'buoi', 'dkm', 'vcl', 'vl', 'cutt', 'dam', 'fuck', 'shit', 'bitch', 'cunt', 'dick', 'pussy', 'asshole', 'nigger', 'nigga', 'fag', 'rape', 'sex'];

// Hạ chữ thường, bỏ dấu (đ → d), bỏ ký tự ngăn cách rồi tìm từ cấm
export function exIsBad(name: string): boolean {
  const flat = name.toLowerCase().replace(/đ/g, 'd').normalize('NFD').replace(/\p{M}/gu, '');
  const spaced = flat.replace(/[^a-z0-9]+/g, ' ').trim();
  const tight = spaced.replace(/ /g, '');
  const words = spaced.split(' ');
  return BAD.some(b => (b.length <= 3 ? words.includes(b) || tight === b : tight.includes(b.replace(/ /g, ''))));
}
