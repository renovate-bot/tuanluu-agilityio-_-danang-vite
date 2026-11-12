/* ============================ Lái xe: tiếng mô tơ điện và còi ============================
   Tổng hợp bằng Web Audio, không tệp âm thanh. Dùng chung AudioContext và nút tắt tiếng của trang (audio/index.ts sfxPort):
   - Không tự tạo AudioContext: chỉ nối vào khi người xem đã bấm phát âm thanh (chính sách autoplay); chưa thì im lặng và thử lại mỗi lần update.
   - Nối vào nút hiệu ứng (sfx) → master, nên tắt tiếng chung hay âm lượng chung đều chặn / chỉnh luôn tiếng xe.
   - Mô tơ: hai dao động (tam giác + sin ở quãng tám trên) qua lọc thông thấp, tần số và âm lượng theo |v|. Còi: hai nốt vuông cùng bật / tắt.
   - update chỉ ghi tham số tối đa mỗi CONFIG.drive.sound.updateMs (mỗi lần là một sự kiện tự động hoá, D-018). stop() dừng và ngắt mọi nút. */
import { CONFIG } from '../../config';
import { audio } from '../../audio';

interface DrSnd { ctx: AudioContext; o1: OscillatorNode; o2: OscillatorNode; lp: BiquadFilterNode; g: GainNode; hg: GainNode; h: OscillatorNode[] }
let snd: DrSnd | null = null;
let want = false, hornOn = false, lastAt = -1e9;

/* Dựng chuỗi nút nếu âm thanh trang đã sẵn sàng; trả có dựng được không */
function drSndBuild(): boolean {
  const port = audio.sfxPort();
  if (!port) return false;
  const S = CONFIG.drive.sound, { ctx, out } = port;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = S.lowpass;
  const g = ctx.createGain(); g.gain.value = 0;
  const o1 = ctx.createOscillator(); o1.type = 'triangle'; o1.frequency.value = S.base;
  const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = S.base * 2;
  const mix = ctx.createGain(); mix.gain.value = 0.5;
  o1.connect(lp); o2.connect(mix).connect(lp); lp.connect(g).connect(out);
  const hg = ctx.createGain(); hg.gain.value = hornOn ? S.hornGain : 0;
  const h = S.hornHz.map((f) => { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f; o.connect(hg); o.start(); return o; });
  hg.connect(out);
  o1.start(); o2.start();
  snd = { ctx, o1, o2, lp, g, hg, h };
  return true;
}

export const drSound = {
  /* Vào chế độ lái: bật mô tơ (nếu âm thanh trang đã sẵn sàng; nếu chưa, update thử lại) */
  start(): void { want = true; lastAt = -1e9; if (!snd) drSndBuild(); },
  /* Mỗi khung với tốc độ v (m/s, có dấu): ghi tham số tối đa mỗi updateMs */
  update(v: number): void {
    if (!want) return;
    const now = performance.now();
    if (now - lastAt < CONFIG.drive.sound.updateMs) return;
    lastAt = now;
    if (!snd && !drSndBuild()) return;
    const S = CONFIG.drive.sound, a = Math.abs(v), k = Math.min(1, a / CONFIG.drive.perf.vMax), t = snd!.ctx.currentTime;
    snd!.o1.frequency.setTargetAtTime(S.base + S.perMs * a, t, S.smooth);
    snd!.o2.frequency.setTargetAtTime((S.base + S.perMs * a) * 2, t, S.smooth);
    snd!.g.gain.setTargetAtTime(S.gainIdle + (S.gainMax - S.gainIdle) * k, t, S.smooth);
  },
  /* Còi (giữ phím H): đổi trạng thái mới ghi tham số */
  horn(on: boolean): void {
    if (on === hornOn) return;
    hornOn = on;
    if (snd) snd.hg.gain.setTargetAtTime(on ? CONFIG.drive.sound.hornGain : 0, snd.ctx.currentTime, 0.02);
  },
  /* Rời chế độ: dừng các dao động và ngắt nút */
  stop(): void {
    want = false; hornOn = false;
    if (!snd) return;
    for (const o of [snd.o1, snd.o2, ...snd.h]) { try { o.stop(); } catch { /* đã dừng */ } o.disconnect(); }
    snd.lp.disconnect(); snd.g.disconnect(); snd.hg.disconnect();
    snd = null;
  }
};
