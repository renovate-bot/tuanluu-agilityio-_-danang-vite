/* ============================ Nhạc nền & âm thanh ============================
   Toàn bộ âm thanh được tổng hợp bằng Web Audio, không dùng file ngoài.
   - Đàn tranh: dây gảy (Karplus–Strong), có luyến "nhấn" và vê.
   - Đàn bầu: giai điệu chậm, trượt cao độ và rung (vibrato).
   - Nền trầm (Rê – La), mõ gỗ, tiếng sông Hàn, tiếng dế về đêm.
   - Trình diễn: tiếng lửa phụt + trống, tiếng phun nước, to nhỏ theo khoảng cách camera.
   - Cầu sông Hàn: còi báo khi quay, tiếng động cơ mâm xoay.
   Thang âm ngũ cung Rê – Mi – Sol – La – Si (hơi hướng điệu Bắc). */

import { CONFIG } from '../config';

interface AudioState {
  ctx: AudioContext | null; on: boolean; volume: number; night: number; beat: number; nextTime: number; timer: number;
  deg: number; pluck: Map<number, AudioBuffer>; noise: AudioBuffer | null; white?: AudioBuffer;
  waterSrc: AudioBufferSourceNode | null; waterGain: GainNode | null; lastFire: boolean; lastWater: boolean; distGain: number;
  master?: GainNode; tone?: BiquadFilterNode; music?: GainNode; sfx?: GainNode; verb?: ConvolverNode; verbSend?: GainNode;
  droneGain?: GainNode; riverGain?: GainNode; motorGain?: GainNode; swingGain?: number; ducked?: boolean; nightSet?: number;
  ext?: GainNode; extOn?: boolean;   // cổng riêng của tiếng xe khi chưa bật âm thanh chung (extPort)
  wxDuck: number; rainGain?: GainNode; windGain?: GainNode; windBp?: BiquadFilterNode; wxRain: number; wxWind: number; wxIndoors: number; patterAt: number;   // thời tiết (GĐ7)
}
type AudioCtor = typeof AudioContext;

const MUSIC_GAIN = 0.9, DUCK_GAIN = 0.3;     // hạ nhạc nền khi có giọng thuyết trình

export function createAudio() {
  const SCALE = [0, 2, 5, 7, 9];                 // bán cung tính từ nốt gốc
  const ROOT = 146.83;                            // Rê 3
  const noteFreq = (deg) => {                     // bậc trên thang ngũ cung → tần số
    const oct = Math.floor(deg / 5), i = ((deg % 5) + 5) % 5;
    return ROOT * Math.pow(2, oct + SCALE[i] / 12);
  };
  const A: AudioState = { ctx: null, on: false, volume: 0.7, night: 0, beat: 0, nextTime: 0, timer: 0,
    deg: 7, pluck: new Map(), noise: null, waterSrc: null, waterGain: null, lastFire: false, lastWater: false, distGain: 1, wxDuck: 1, wxRain: 0, wxWind: 0, wxIndoors: 0, patterAt: 0 };
  const R = Math.random;

  function build() {
    const ctx = A.ctx = new ((window.AudioContext || (window as unknown as { webkitAudioContext: AudioCtor }).webkitAudioContext))();
    A.nightSet = undefined;   // nút mới tạo: lên lịch lại giá trị theo đêm ở khung kế tiếp
    // Chuỗi tổng: nén nhẹ → loa
    A.master = ctx.createGain(); A.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
    A.master.connect(comp).connect(ctx.destination);
    A.tone = ctx.createBiquadFilter(); A.tone.type = 'lowpass'; A.tone.frequency.value = 9000;
    A.tone.connect(A.master);
    A.music = ctx.createGain(); A.music.gain.value = musicLevel(); A.music.connect(A.tone);
    A.sfx = ctx.createGain(); A.sfx.gain.value = 1; A.sfx.connect(A.master);
    // Hồi âm: đáp ứng xung tự sinh (nhiễu tắt dần, stereo)
    const len = ctx.sampleRate * 3.2, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (R() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    A.verb = ctx.createConvolver(); A.verb.buffer = ir;
    A.verbSend = ctx.createGain(); A.verbSend.gain.value = 0.32;
    A.verbSend.connect(A.verb).connect(A.tone);
    // Nhiễu nâu dùng chung (sông, lửa, nước)
    const nl = ctx.sampleRate * 4, nb = ctx.createBuffer(1, nl, ctx.sampleRate), nd = nb.getChannelData(0);
    let last = 0; for (let i = 0; i < nl; i++) { last = (last + 0.02 * (R() * 2 - 1)) / 1.02; nd[i] = last * 3.5; }
    A.noise = nb;
    const wl = ctx.sampleRate * 2, wb = ctx.createBuffer(1, wl, ctx.sampleRate), wd = wb.getChannelData(0);
    for (let i = 0; i < wl; i++) wd[i] = R() * 2 - 1;
    A.white = wb;
    buildDrone(); buildRiver(); buildWater(); buildWeatherSound();
  }
  const musicLevel = () => (A.ducked ? DUCK_GAIN : MUSIC_GAIN) * A.wxDuck;   // nhạc nền: giọng thuyết trình và bão cùng hạ


  /* Dây gảy Karplus–Strong, dựng sẵn mỗi nốt một lần */
  function pluckBuf(f) {
    const key = Math.round(f * 10);
    if (A.pluck.has(key)) return A.pluck.get(key);
    const sr = A.ctx.sampleRate, len = Math.floor(sr * 2.6), N = Math.max(2, Math.round(sr / f));
    const buf = A.ctx.createBuffer(1, len, sr), out = buf.getChannelData(0), ring = new Float32Array(N);
    let prev = 0; for (let i = 0; i < N; i++) { const n = R() * 2 - 1; ring[i] = 0.6 * n + 0.4 * prev; prev = n; }
    const decay = 0.9965 + Math.min(0.0025, 60 / f * 0.0008);
    let peak = 0;
    for (let i = 0; i < len; i++) {
      const j = i % N, k = (i + 1) % N, y = ring[j];
      out[i] = y; ring[j] = decay * 0.5 * (y + ring[k]);
      if (Math.abs(y) > peak) peak = Math.abs(y);
    }
    for (let i = 0; i < len; i++) out[i] /= peak || 1;
    A.pluck.set(key, buf); return buf;
  }
  function tranh(deg, t, vel = 0.5, bend = 0) {
    const ctx = A.ctx, src = ctx.createBufferSource(), g = ctx.createGain(), pan = ctx.createStereoPanner();
    src.buffer = pluckBuf(noteFreq(deg));
    if (bend) { // "nhấn": gảy rồi nhấn dây lên cao, sau đó nhả về
      src.playbackRate.setValueAtTime(1, t);
      src.playbackRate.linearRampToValueAtTime(Math.pow(2, bend / 12), t + 0.22);
      src.playbackRate.linearRampToValueAtTime(1, t + 0.75);
    }
    g.gain.value = vel * 0.32;
    pan.pan.value = Math.max(-0.8, Math.min(0.8, (deg - 9) * 0.07));
    src.connect(g).connect(pan); pan.connect(A.music); pan.connect(A.verbSend);
    src.start(t); src.stop(t + 2.6);
  }
  /* Đàn bầu: một câu nhạc trượt cao độ liền mạch */
  let bauWave = null;
  function bauPhrase(t, beat) {
    const ctx = A.ctx;
    bauWave = bauWave || ctx.createPeriodicWave(new Float32Array([0, 0, 0, 0, 0, 0]), new Float32Array([0, 1, 0.42, 0.16, 0.07, 0.03]));
    const osc = ctx.createOscillator(); osc.setPeriodicWave(bauWave);
    const vib = ctx.createOscillator(), vibG = ctx.createGain(); vib.frequency.value = 5.3; vibG.gain.value = 0;
    vib.connect(vibG).connect(osc.frequency);
    const g = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
    g.gain.value = 0;
    osc.connect(lp).connect(g); g.connect(A.music); g.connect(A.verbSend);
    let d = 10 + Math.floor(R() * 3), time = t, prevF = noteFreq(d);
    const notes = 3 + Math.floor(R() * 3);
    osc.frequency.setValueAtTime(prevF, t);
    for (let n = 0; n < notes; n++) {
      const dur = beat * (n === notes - 1 ? 3 + Math.floor(R() * 2) : [1, 1.5, 2][Math.floor(R() * 3)]);
      if (n > 0) { // trượt sang nốt mới
        d = Math.max(8, Math.min(15, d + [-2, -1, 1, 2, -1][Math.floor(R() * 5)]));
        osc.frequency.setValueAtTime(prevF, time);
        prevF = noteFreq(d);
        osc.frequency.exponentialRampToValueAtTime(prevF, time + 0.18);
      }
      g.gain.setTargetAtTime(n === 0 ? 0.11 : 0.085, time, 0.06);
      g.gain.setTargetAtTime(0.06, time + dur * 0.5, 0.2);
      vibG.gain.setValueAtTime(0, time); vibG.gain.linearRampToValueAtTime(noteFreq(d) * 0.012, time + dur * 0.8);
      time += dur;
    }
    g.gain.setTargetAtTime(0, time - beat * 0.5, 0.35);
    osc.start(t); vib.start(t); osc.stop(time + 2); vib.stop(time + 2);
    return time;
  }
  function mo(t, vel = 0.35) { // mõ gỗ
    const ctx = A.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(980, t); o.frequency.exponentialRampToValueAtTime(760, t + 0.06);
    g.gain.setValueAtTime(vel * 0.22, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(g); g.connect(A.music); g.connect(A.verbSend); o.start(t); o.stop(t + 0.15);
  }
  function drum(t, vel = 1) { // trống lớn khi rồng phun lửa
    const ctx = A.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(92, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.45);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.55 * vel, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(g); g.connect(A.music); g.connect(A.verbSend); o.start(t); o.stop(t + 1);
  }
  function buildDrone() {
    const ctx = A.ctx; A.droneGain = ctx.createGain(); A.droneGain.gain.value = 0.05;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
    const lfo = ctx.createOscillator(), lfoG = ctx.createGain(); lfo.frequency.value = 0.05; lfoG.gain.value = 160;
    lfo.connect(lfoG).connect(lp.frequency); lfo.start();
    for (const [f, type] of [[73.42, 'triangle'], [110.0, 'sine'], [146.83, 'sine']] as [number, OscillatorType][]) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = (R() - 0.5) * 8;
      o.connect(lp); o.start();
    }
    lp.connect(A.droneGain).connect(A.music);
  }
  function buildRiver() {
    const ctx = A.ctx, src = ctx.createBufferSource(); src.buffer = A.noise; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 650;
    A.riverGain = ctx.createGain(); A.riverGain.gain.value = 0.05;
    const lfo = ctx.createOscillator(), lfoG = ctx.createGain(); lfo.frequency.value = 0.09; lfoG.gain.value = 0.02;
    lfo.connect(lfoG).connect(A.riverGain.gain); lfo.start();
    src.connect(lp).connect(A.riverGain).connect(A.sfx); src.start();
  }
  function buildWater() {
    const ctx = A.ctx, src = ctx.createBufferSource(); src.buffer = A.white; src.loop = true;
    const hp = ctx.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 3200; hp.Q.value = 0.5;
    A.waterGain = ctx.createGain(); A.waterGain.gain.value = 0;
    src.connect(hp).connect(A.waterGain).connect(A.sfx); src.start();
  }
  /* Thời tiết (GĐ7, mục 7): mưa = nhiễu trắng qua bandpass + lowpass; gió = nhiễu nâu qua bandpass trượt tần số; sấm gọi riêng. Mọi gain ban đầu 0. */
  function buildWeatherSound() {
    const ctx = A.ctx, W = CONFIG.weather.sound;
    const rs = ctx.createBufferSource(); rs.buffer = A.white; rs.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = W.rainBand[0]; bp.Q.value = W.rainBand[1];
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = W.rainLow;
    A.rainGain = ctx.createGain(); A.rainGain.gain.value = 0; rs.connect(bp).connect(lp).connect(A.rainGain).connect(A.sfx); rs.start();
    const ws = ctx.createBufferSource(); ws.buffer = A.noise; ws.loop = true;
    A.windBp = ctx.createBiquadFilter(); A.windBp.type = 'bandpass'; A.windBp.frequency.value = W.windBase; A.windBp.Q.value = W.windQ;
    A.windGain = ctx.createGain(); A.windGain.gain.value = 0; ws.connect(A.windBp).connect(A.windGain).connect(A.sfx); ws.start();
  }
  /* "Tí tách": một hạt mưa ngắn, ngẫu nhiên (Math.random như phần nhạc, KHÔNG dùng rand() của cảnh) */
  function patter(t, v) {
    const ctx = A.ctx, o = ctx.createOscillator(), g = ctx.createGain(), pan = ctx.createStereoPanner();
    o.frequency.value = 1800 + R() * 2600; pan.pan.value = R() * 1.6 - 0.8;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    o.connect(g).connect(pan).connect(A.sfx); o.start(t); o.stop(t + 0.04);
  }
  function cricket(t) {
    const ctx = A.ctx, o = ctx.createOscillator(), am = ctx.createOscillator(), amG = ctx.createGain(), g = ctx.createGain(), pan = ctx.createStereoPanner();
    o.frequency.value = 4300 + R() * 600; am.frequency.value = 28 + R() * 10; amG.gain.value = 0.5;
    g.gain.value = 0; pan.pan.value = R() * 1.6 - 0.8;
    const n = 2 + Math.floor(R() * 3);
    for (let i = 0; i < n; i++) { const s = t + i * 0.32; g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(0.012, s + 0.03); g.gain.linearRampToValueAtTime(0, s + 0.18); }
    am.connect(amG).connect(g.gain);
    o.connect(g).connect(pan).connect(A.sfx); o.start(t); am.start(t); o.stop(t + n * 0.32 + 0.2); am.stop(t + n * 0.32 + 0.2);
  }
  function fireWhoosh(t) {
    const ctx = A.ctx, src = ctx.createBufferSource(); src.buffer = A.noise;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.7;
    bp.frequency.setValueAtTime(260, t); bp.frequency.exponentialRampToValueAtTime(1100, t + 0.25); bp.frequency.exponentialRampToValueAtTime(380, t + 1.6);
    const g = ctx.createGain(), v = 1.6 * A.distGain;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.07); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.7);
    src.connect(bp).connect(g).connect(A.sfx);
    src.start(t, R() * 2); src.stop(t + 1.8);
    drum(t, 0.6 + 0.4 * A.distGain);
  }

  /* Bộ lập lịch: soạn nhạc theo phách, nhìn trước 0,3 giây */
  let bauUntil = 0, phrase = 0;
  const PROG = [0, 3, 1, 4, 0, 2, 3, 0];          // vòng hợp âm (bậc ngũ cung)
  function schedule() {
    const ctx = A.ctx, beat = 60 / (74 - 14 * A.night);
    while (A.nextTime < ctx.currentTime + 0.3) {
      const t = A.nextTime, b = A.beat, inBar = b % 8, bar = Math.floor(b / 8), chord = PROG[bar % PROG.length];
      if (inBar === 0) { // rải hợp âm đầu ô nhịp
        for (let k = 0; k < 3; k++) tranh(chord + k * 2 + 5, t + k * 0.07, 0.45 - k * 0.08);
        if (b % 16 === 0 && t > bauUntil && R() < 0.75) { bauUntil = bauPhrase(t + beat * 2, beat); phrase++; }
      }
      // giai điệu đàn tranh: bước ngẫu nhiên trên thang ngũ cung, quanh hợp âm
      const busy = t < bauUntil ? 0.28 : 0.6;
      for (const off of [0, 0.5]) {
        if (inBar === 0 && off === 0) continue;
        if (R() < busy * (off ? 0.55 : 1)) {
          A.deg += [-2, -1, -1, 1, 1, 2, 0][Math.floor(R() * 7)];
          if (A.deg < chord + 5) A.deg += 2; if (A.deg > chord + 14) A.deg -= 3;
          tranh(A.deg, t + off * beat, 0.3 + R() * 0.25, R() < 0.18 ? (R() < 0.5 ? 1 : 2) : 0);
        }
      }
      if (inBar === 7 && R() < 0.5) { // vê (tremolo) cuối câu
        for (let k = 0; k < 6; k++) tranh(A.deg, t + k * beat / 7, 0.28 - k * 0.03);
      }
      if (inBar === 0 || inBar === 3 || inBar === 6) mo(t, inBar === 0 ? 0.4 : 0.25);
      if (A.night > 0.6 && R() < 0.12) cricket(t + R() * beat);
      A.nextTime += beat; A.beat++;
    }
  }

  return {
    get on() { return A.on; },
    start() {
      if (!A.ctx) build();
      A.ctx.resume();
      A.on = true;
      if (A.nextTime < A.ctx.currentTime) A.nextTime = A.ctx.currentTime + 0.1;
      A.master.gain.cancelScheduledValues(A.ctx.currentTime);
      A.master.gain.setTargetAtTime(A.volume, A.ctx.currentTime, 0.4);
      clearInterval(A.timer); A.timer = window.setInterval(schedule, 60); schedule();
    },
    stop() {
      if (!A.ctx) return;
      A.on = false; clearInterval(A.timer);
      A.master.gain.setTargetAtTime(0, A.ctx.currentTime, 0.25);
      setTimeout(() => { if (!A.on && !A.extOn) A.ctx.suspend(); }, 1200);
    },
    setVolume(v) { A.volume = v; if (A.ctx && A.on) A.master.gain.setTargetAtTime(v, A.ctx.currentTime, 0.08); },
    duck(on) { A.ducked = on; if (A.music) A.music.gain.setTargetAtTime(musicLevel(), A.ctx.currentTime, 0.3); },
    /* Mỗi khung (hoặc ~10 lần/giây): rain, wind (m/s tức thời), wxStorm (0–1, hạ nhạc), indoors (camera trong hầm / dưới nước: nhỏ đi). Chưa bật âm thanh thì chỉ nhớ giá trị. */
    setWeather(rain, wind, storm, indoors) {
      const W = CONFIG.weather.sound; A.wxRain = rain; A.wxWind = wind; A.wxIndoors = indoors ? W.indoors : 1;
      A.wxDuck = 1 - (1 - W.musicDuck) * Math.min(1, storm);
      if (!A.ctx || !A.on) return;
      const now = A.ctx.currentTime, k = A.wxIndoors;
      A.rainGain.gain.setTargetAtTime(W.rainGain * rain * k, now, 0.4);
      A.windGain.gain.setTargetAtTime(W.windGain * Math.min(1.3, (wind / 28) ** 2) * k, now, 0.3);
      A.windBp.frequency.setTargetAtTime(W.windBase + W.windPerMs * wind, now, 0.3);
      A.music.gain.setTargetAtTime(musicLevel(), now, 0.5);
      if (rain > 0.05 && now > A.patterAt) { patter(now + R() * 0.1, 0.02 * rain * k); A.patterAt = now + 0.1 / Math.max(0.05, rain * W.patter * 0.1); }
    },
    /* Sấm: nhiễu nâu lowpass 120–300 Hz, rền 2–4 s, trễ delay giây (khoảng cách / 343 m/s), to ∝ loud (1 = ở 800 m) */
    thunder(delay, loud) {
      if (!A.ctx || !A.on) return;
      const ctx = A.ctx, W = CONFIG.weather.sound, t = ctx.currentTime + delay, dur = W.thunderSec[0] + R() * (W.thunderSec[1] - W.thunderSec[0]);
      const src = ctx.createBufferSource(); src.buffer = A.noise;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = W.thunderLow[0] + R() * (W.thunderLow[1] - W.thunderLow[0]);
      const g = ctx.createGain(), v = W.thunderGain * Math.min(1.5, loud) * A.wxIndoors;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.12); g.gain.setTargetAtTime(0.0001, t + 0.3, dur / 4);
      src.connect(lp).connect(g).connect(A.sfx); src.start(t, R() * 2); src.stop(t + dur + 0.5);
    },
    /* Cổng cho hiệu ứng ngoài (tiếng xe của chế độ lái): ngữ cảnh + nút hiệu ứng, chỉ khi người xem đã bấm phát ít nhất một lần (chưa có ngữ cảnh thì null: không tạo ở đây).
       Nút tắt tiếng chung (master) vẫn chặn mọi thứ nối vào đây; `on` cho biết tiếng đang bật */
    sfxPort() { return A.ctx && A.sfx ? { ctx: A.ctx, out: A.sfx as AudioNode, on: A.on } : null; },
    /* Cổng riêng cho tiếng xe khi người xem bật bằng nút 🔊 của chế độ lái mà CHƯA bật âm thanh chung (nút nhạc ẩn trong chế độ khám phá).
       Gọi trong thao tác của người xem (bấm): tạo ngữ cảnh nếu chưa có (master vẫn 0, không lên lịch nhạc ⇒ không phát nhạc / tiếng nền), resume,
       trả nút ra riêng nối thẳng loa với âm lượng chung. on = false: thả cổng, âm thanh chung đang tắt thì ngưng ngữ cảnh. Chưa ai gọi thì không đổi gì */
    extPort(on = true) {
      A.extOn = on;
      if (!on) { if (A.ctx && !A.on) A.ctx.suspend(); return null; }
      if (!A.ctx) build();
      A.ctx.resume();
      if (!A.ext) { A.ext = A.ctx.createGain(); A.ext.connect(A.ctx.destination); }
      A.ext.gain.value = A.volume;
      return { ctx: A.ctx, out: A.ext as AudioNode };
    },
    pause() { if (A.ctx && A.on) { clearInterval(A.timer); A.ctx.suspend(); } else if (A.ctx && A.extOn) A.ctx.suspend(); },
    resume() { if (A.ctx && A.on) { A.ctx.resume(); A.nextTime = Math.max(A.nextTime, A.ctx.currentTime + 0.1); A.timer = window.setInterval(schedule, 60); } else if (A.ctx && A.extOn) A.ctx.resume(); },
    /* Gọi mỗi khung hình: ngày/đêm, trạng thái trình diễn, khoảng cách camera tới đầu rồng */
    /* Cầu sông Hàn: còi báo khi quay, tiếng động cơ mâm xoay; to nhỏ theo khoảng cách camera */
    setSwingDistance(d) { A.swingGain = Math.max(0.08, Math.min(1, 160 / Math.max(d, 1))); },
    horn() {
      if (!A.ctx || !A.on) return;
      const ctx = A.ctx, t = ctx.currentTime, g = ctx.createGain(), lp = ctx.createBiquadFilter(), v = 0.32 * (A.swingGain ?? 0.3);
      lp.type = 'lowpass'; lp.frequency.value = 1500;
      g.gain.setValueAtTime(0.0001, t);
      for (const [a, b] of [[0, 1.3], [1.7, 3.0]]) { g.gain.exponentialRampToValueAtTime(v, t + a + 0.06); g.gain.setValueAtTime(v, t + b - 0.1); g.gain.exponentialRampToValueAtTime(0.0001, t + b); }
      for (const f of [311, 370]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start(t); o.stop(t + 3.1); }
      lp.connect(g).connect(A.sfx);
    },
    motor(on) {
      if (!A.ctx) return;
      const ctx = A.ctx;
      if (!A.motorGain) {
        A.motorGain = ctx.createGain(); A.motorGain.gain.value = 0;
        const src = ctx.createBufferSource(); src.buffer = A.noise; src.loop = true;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220;
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 52; const og = ctx.createGain(); og.gain.value = 0.25;
        src.connect(lp).connect(A.motorGain); o.connect(og).connect(A.motorGain); A.motorGain.connect(A.sfx); src.start(); o.start();
      }
      A.motorGain.gain.setTargetAtTime(on && A.on ? 0.5 * (A.swingGain ?? 0.3) : 0, ctx.currentTime, 0.6);
    },
    update(night, fireOn, waterOn, distToHead) {
      if (!A.ctx || !A.on) return;
      const now = A.ctx.currentTime;
      A.night = night;
      A.distGain = Math.max(0.12, Math.min(1, 90 / Math.max(distToHead, 1)));
      if (Math.abs(night - (A.nightSet ?? -1)) > 1e-3) {   // chỉ lên lịch lại khi đêm đổi (mỗi lời gọi thêm một sự kiện tự động hoá vào dòng thời gian, D-018)
        A.nightSet = night;
        A.tone.frequency.setTargetAtTime(9000 - 5200 * night, now, 0.5);    // đêm: âm êm, tối hơn
        A.verbSend.gain.setTargetAtTime(0.3 + 0.18 * night, now, 0.5);
        A.droneGain.gain.setTargetAtTime(0.045 + 0.03 * night, now, 0.5);
      }
      if (fireOn && !A.lastFire) fireWhoosh(now + 0.02);
      if (waterOn !== A.lastWater) A.waterGain.gain.setTargetAtTime(waterOn ? 0.22 * A.distGain : 0, now, waterOn ? 0.15 : 0.6);
      A.lastFire = fireOn; A.lastWater = waterOn;
    }
  };
}

/* Một bộ âm thanh cho cả trang; chỉ tạo AudioContext khi người xem bấm phát (chính sách autoplay của trình duyệt) */
export const audio = createAudio();
