import { CONFIG } from '../../config';
import { rng } from '../math';
import type { PersonKind } from './gait';

/* =====================================================================
   CHIA KIỂU NGƯỜI (spec G8, §7) — chọn theo chỉ số trên danh sách người đang có, tổng số không đổi.
   Dùng rng(seed) riêng (không gọi rand(), không đụng rnd của cầu). Số người mỗi kiểu = làm tròn n × CONFIG.people.mix.
   - Người đi cùng (đi đôi hoặc trẻ em) i luôn theo người i − 1; người i − 1 đi bộ một mình (không chạy, không đứng, không đi cùng ai).
   - Trẻ em: tỉ lệ childScale, luôn là người đi cùng. Người chụp ảnh: chỉ trong số người đứng.
   - flags = tổng cờ PP_FLAG (khớp aVar.z trong material.ts).
   ===================================================================== */
export const PP_FLAG = { hat: 1, pack: 2, photo: 4 } as const;
export interface PersonInfo { kind: PersonKind; scale: number; flags: number; phase: number; follow: number /* chỉ số người mình đi cùng, −1 nếu không */ }

/* Xáo trộn Fisher–Yates bằng bộ sinh r */
function ppShuffle<T>(a: T[], r: () => number): T[] {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export function ppAssignKinds(n: number, seed: number, opts?: { run?: boolean }): PersonInfo[] {
  const P = CONFIG.people, M = P.mix, r = rng(seed), [s0, s1] = P.adultScale;
  const out: PersonInfo[] = Array.from({ length: n }, () => ({ kind: 'walk' as PersonKind, scale: s0 + r() * (s1 - s0), flags: 0, phase: r() * Math.PI * 2, follow: -1 }));
  // người đi cùng: chọn chỉ số i ≥ 1 sao cho i − 1 và i + 1 không cũng là người đi cùng (người dẫn không đi cùng ai)
  const comp = new Set<number>(), nComp = Math.round(n * M.companion);
  for (const i of ppShuffle(Array.from({ length: Math.max(0, n - 1) }, (_, k) => k + 1), r)) {
    if (comp.size >= nComp) break;
    if (!comp.has(i - 1) && !comp.has(i + 1)) comp.add(i);
  }
  const compList = [...comp].sort((a, b) => a - b);
  for (const i of compList) out[i].follow = i - 1;
  for (const i of ppShuffle(compList.slice(), r).slice(0, Math.round(compList.length * M.child))) out[i].scale = P.childScale;
  // người đứng và người chạy: lấy từ những người không đi cùng và không dẫn ai
  const free = ppShuffle(out.map((_, i) => i).filter((i) => !comp.has(i) && !comp.has(i + 1)), r);
  const nStand = Math.min(free.length, Math.round(n * M.stand)), nRun = opts?.run === false ? 0 : Math.min(free.length - nStand, Math.round(n * M.run));
  const stand = free.slice(0, nStand);
  for (const i of stand) out[i].kind = 'stand';
  for (const i of free.slice(nStand, nStand + nRun)) out[i].kind = 'run';
  // cờ: nón lá, ba lô trên mọi người; chụp ảnh trong số người đứng
  for (const i of ppShuffle(out.map((_, k) => k), r).slice(0, Math.round(n * M.hat))) out[i].flags |= PP_FLAG.hat;
  for (const i of ppShuffle(out.map((_, k) => k), r).slice(0, Math.round(n * M.pack))) out[i].flags |= PP_FLAG.pack;
  for (const i of ppShuffle(stand.slice(), r).slice(0, Math.round(stand.length * M.photo))) out[i].flags |= PP_FLAG.photo;
  return out;
}
