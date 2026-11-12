/* ===== Chạy Blender nền với một script Python (npm run gen:crowd) ===== */
// npm 11 trên Windows chạy script qua cmd.exe, không gọi được đường dẫn exe có dấu cách nằm trong ngoặc kép
// ('C:/Program' is not recognized); nên gọi Blender từ node. Đường dẫn Blender: biến môi trường BLENDER, mặc định bản 4.5 LTS.
// Cách dùng: node scripts/people/blender.mjs <script.py> [-- tham số cho script]
import { spawnSync } from 'node:child_process';

const exe = process.env.BLENDER || 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe';
const [script, ...rest] = process.argv.slice(2);
const r = spawnSync(exe, ['-b', '--python-exit-code', '1', '--python', script, ...rest], { stdio: 'inherit' });
if (r.error) { console.error(`Không chạy được Blender (${exe}): ${r.error.message}. Đặt biến môi trường BLENDER.`); process.exit(1); }
process.exit(r.status ?? 1);
