import { CONFIG } from '../../config';

/* =====================================================================
   DÁNG ĐI / DÁNG CHẠY NGƯỜI ĐI BỘ — bản CPU của shader trong material.ts (spec §5, G6, G7).
   Shader mới là chỗ chạy thật; file này giữ cùng công thức để unit test kiểm (tests/people-unit/gait.test.ts)
   và để code dựng tính nhịp bước (aVar.w) cho từng người. Đổi công thức ở đây thì sửa cả PP_GLSL_ANGLES trong material.ts.
   Góc dương = đưa về phía trước (người hướng +X, quay quanh trục Z). φ là pha chu kỳ hai bước:
   chân trái φ, chân phải φ + π, tay ngược pha chân cùng bên. Trộn đi ↔ chạy theo biên độ: run = smoothstep(0,42; 0,6; A).
   ===================================================================== */
export type PersonKind = 'walk' | 'run' | 'stand';
export type PersonPart = 'legL' | 'legR' | 'armL' | 'armR';
const P = CONFIG.people;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smoothstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/* Mức chạy 0..1 theo biên độ hông (đi 0,34 → 0, chạy 0,6 → 1) */
export const ppRunMix = (amp: number) => smoothstep(0.42, 0.6, amp);
/* Biên độ hông theo kiểu người */
export const ppAmp = (kind: PersonKind) => (kind === 'walk' ? P.walk.amp : kind === 'run' ? P.run.amp : 0);

/* Nhịp (rad/s của φ). Đi: chân trụ không trượt ⇔ ω · bước / 2π = v. Chạy: nhịp cố định, người nhỏ bước nhanh hơn. Đứng: 0 */
export function ppCadence(kind: PersonKind, speed: number, scale: number): number {
  if (kind === 'walk') return (2 * Math.PI * speed) / (4 * P.legLength * scale * Math.sin(P.walk.amp));
  if (kind === 'run') return P.run.cadence / Math.sqrt(scale);
  return 0;
}

/* Quãng đường một chu kỳ hai bước (m): mỗi bước chân trụ quét dây cung 2·L·sin A. Chạy ở tỉ lệ 1 ≈ 1,94 m, khớp 2,6–3,0 m/s ở 1,4 chu kỳ/giây */
export function ppStride(kind: PersonKind, scale: number): number {
  return kind === 'stand' ? 0 : 4 * P.legLength * scale * Math.sin(ppAmp(kind));
}

/* Góc khớp: root = hông / vai, joint = gối (≤ 0, gập về sau) / khuỷu (≥ 0, gập về trước). Không tính tư thế chụp ảnh (cờ, chỉ có trong shader) */
export function ppAngles(part: PersonPart, amp: number, phase: number): { root: number; joint: number } {
  const A = amp, run = ppRunMix(A);
  if (part === 'legL' || part === 'legR') {
    const f = part === 'legL' ? phase : phase + Math.PI;
    const sw = Math.max(0, Math.cos(f - 0.35)), sr = Math.max(0, Math.cos(f + 0.45));   // đi: gập gối khi đưa chân lên trước; chạy: gập sớm và sâu hơn
    const knee = A * 2 * sw * sw + (A >= 0.01 ? 0.06 : 0);
    return { root: A * Math.sin(f) + lerp(0.12 * A, 0.22, run), joint: -lerp(knee, 0.38 + 1.5 * sr * sr, run) };
  }
  const f = part === 'armL' ? phase + Math.PI : phase;
  return { root: A * (0.65 + run * 0.5) * Math.sin(f) - 0.05, joint: 0.16 + run * 1.25 + A * 0.35 * Math.max(0, Math.sin(f)) };
}
