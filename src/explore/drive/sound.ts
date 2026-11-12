/* ============================ Lái xe: tiếng mô tơ điện và còi ============================
   Tổng hợp bằng Web Audio, không tệp âm thanh. Dùng chung AudioContext của trang (audio/index.ts):
   - Âm thanh chung đã bật (nút nhạc, hoặc cờ đã lưu): nối vào nút hiệu ứng (sfxPort → master), tắt tiếng / âm lượng chung chặn / chỉnh luôn tiếng xe.
   - Chưa bật: im lặng cho tới khi người xem bấm nút 🔊 (#drSoundBtn trong #drHud; nút nhạc ẩn trong chế độ khám phá): lần bấm đó tạo / resume ngữ cảnh
     qua audio.extPort (cổng riêng, không qua master, không phát nhạc nền). Không tự tạo AudioContext ngoài thao tác của người xem (chính sách autoplay).
   - Nút 🔊 / 🔇 bật / tắt riêng tiếng xe; lựa chọn giữ trong trang (drSoundWanted: đã bấm thì theo lựa chọn, chưa bấm thì theo âm thanh chung).
   - Mô tơ: hai dao động (tam giác + sin ở quãng tám trên) qua lọc thông thấp, tần số và âm lượng theo |v|. Còi: hai nốt vuông cùng bật / tắt.
   - update chỉ ghi tham số tối đa mỗi CONFIG.drive.sound.updateMs (mỗi lần là một sự kiện tự động hoá, D-018). stop() dừng và ngắt mọi nút. */
import { CONFIG } from '../../config';
import { audio } from '../../audio';

interface DrSnd { ctx: AudioContext; o1: OscillatorNode; o2: OscillatorNode; lp: BiquadFilterNode; g: GainNode; hg: GainNode; h: OscillatorNode[]; ext: boolean }
let snd: DrSnd | null = null;
let want = false, hornOn = false, lastAt = -1e9;
let pick: boolean | null = null;                 // lựa chọn của người xem bằng nút 🔊 (giữ trong trang); null = chưa bấm
let btn: HTMLElement | null = null, shown: boolean | null = null;

/* Có tiếng xe không: đã bấm nút thì theo lựa chọn; chưa bấm thì theo âm thanh chung (giữ hành vi cũ: ai đã bật nhạc thì có tiếng xe) */
export function drSoundWanted(p: boolean | null, globalOn: boolean): boolean { return p === null ? globalOn : p; }
/* Đường ra: âm thanh chung đang bật ⇒ nút hiệu ứng chung (qua master); không ⇒ cổng riêng nếu người xem đã bật bằng nút; còn lại không phát */
export function drSoundRoute(p: boolean | null, globalOn: boolean): 'sfx' | 'ext' | null {
  if (!drSoundWanted(p, globalOn)) return null;
  return globalOn ? 'sfx' : p === true ? 'ext' : null;
}
const globalOn = (): boolean => { const p = audio.sfxPort(); return !!p && p.on; };

/* Dựng chuỗi nút nếu có đường ra; trả có dựng được không */
function drSndBuild(): boolean {
  const route = drSoundRoute(pick, globalOn());
  const port = route === 'sfx' ? audio.sfxPort() : route === 'ext' ? audio.extPort() : null;
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
  snd = { ctx, o1, o2, lp, g, hg, h, ext: route === 'ext' };
  return true;
}
/* Dừng và ngắt chuỗi nút (giữ want / pick); thả cổng riêng nếu đang dùng */
function drSndTear(): void {
  if (!snd) return;
  for (const o of [snd.o1, snd.o2, ...snd.h]) { try { o.stop(); } catch { /* đã dừng */ } o.disconnect(); }
  snd.lp.disconnect(); snd.g.disconnect(); snd.hg.disconnect();
  if (snd.ext) audio.extPort(false);
  snd = null;
}
/* Nút 🔊 / 🔇: biểu tượng + aria-pressed theo trạng thái (chỉ ghi DOM khi đổi) */
function drSndSync(force = false): void {
  if (!btn) return;
  const on = want && drSoundWanted(pick, globalOn());
  if (!force && on === shown) return;
  shown = on;
  btn.textContent = on ? '🔊' : '🔇';
  btn.setAttribute('aria-pressed', String(on));
}

export const drSound = {
  /* Gắn nút bật / tắt (#drSoundBtn); bấm = toggle (trong thao tác của người xem nên tạo / resume được ngữ cảnh) */
  bind(el: HTMLElement | null): void {
    btn = el;
    if (el) el.addEventListener('click', () => { drSound.toggle(); });
    drSndSync(true);
  },
  /* Vào chế độ lái: bật mô tơ nếu có đường ra (nếu chưa, update thử lại khi âm thanh chung bật sau) */
  start(): void { want = true; lastAt = -1e9; if (!snd) drSndBuild(); drSndSync(true); },
  /* Bật / tắt tiếng xe theo lựa chọn của người xem; trả trạng thái mới */
  toggle(): boolean {
    pick = !drSoundWanted(pick, globalOn());
    if (pick) { lastAt = -1e9; if (!snd && want) drSndBuild(); } else drSndTear();
    drSndSync();
    return pick;
  },
  /* Đang có tiếng xe (theo lựa chọn / âm thanh chung) không */
  get on(): boolean { return want && drSoundWanted(pick, globalOn()); },
  /* Mỗi khung với tốc độ v (m/s, có dấu): ghi tham số tối đa mỗi updateMs */
  update(v: number): void {
    if (!want) return;
    const now = performance.now();
    if (now - lastAt < CONFIG.drive.sound.updateMs) return;
    lastAt = now;
    drSndSync();                                   // âm thanh chung có thể vừa bật (chạm đầu tiên khi đã lưu cờ nhạc)
    if (!drSoundWanted(pick, globalOn())) return;
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
  /* Rời chế độ: dừng các dao động và ngắt nút (lựa chọn của nút giữ lại cho lần lái sau trong trang) */
  stop(): void {
    want = false; hornOn = false;
    drSndTear();
    drSndSync();
  }
};
