/* ===== Lái xe: test chuyển động (src/explore/drive/motion.ts) =====
   Hai mốc tăng tốc công bố của VF 3, bán kính quay vòng, góc lái giảm theo tốc độ, nhả ga / phanh / lùi / phanh tay,
   khung rất dài không xuyên lan can (Review Focus 1), chạy thật trên Cầu Rồng. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../src/config.ts';
import { deckY } from '../../src/bridges/dragon/profile.ts';
import { SH, shRoadY } from '../../src/bridges/song-han/profile.ts';
import { drMakeNet, drGround, drSetGate, type DrPad, type DrSolid } from '../../src/explore/drive/net.ts';
import { drBuildPads, drSpawnPose, DR_GATE_SWING } from '../../src/explore/drive/roadData.ts';
import { drBuildSolids } from '../../src/explore/drive/solids.ts';
import { drFits, type DrBox } from '../../src/explore/drive/collide.ts';
import { drAccel, drSteerMax, drCreate, drStep, drEvacStep, type DrState, type DrInput } from '../../src/explore/drive/motion.ts';

const P = CONFIG.drive.perf, L = CONFIG.drive.car.wheelbase, HL = CONFIG.drive.car.length / 2;
const flatPad = (x0: number, x1: number, z0: number, z1: number, y = 2.6): DrPad => ({ id: 'a', kind: 'road', x0, x1, z0, z1, y: () => y });
const state = (x: number, z: number, yaw = 0, v = 0, y = 2.6): DrState => ({ x, y, z, yaw, pitch: 0, v, steer: 0, wheel: 0, braking: false, evac: 0 });
const inp = (gas = 0, brake = 0, steer = 0, hand = false): DrInput => ({ gas, brake, steer, hand });
const DT = 1 / 60;
const longNet = () => drMakeNet([flatPad(-100, 3000, -20, 20)], []);

/* Thời điểm đầu tiên v ≥ target khi giữ ga hết cỡ từ đứng yên; kèm v lớn nhất từng đạt trong maxT giây */
function timeTo(target: number, maxT: number): { t: number; vPeak: number } {
  const net = longNet(), s = state(0, 0), g = inp(1);
  let t = 0, hit = NaN, vPeak = 0;
  while (t < maxT) {
    drStep(s, g, net, [], 0, DT); t += DT;
    vPeak = Math.max(vPeak, s.v);
    if (Number.isNaN(hit) && s.v >= target) hit = t;
  }
  return { t: hit, vPeak };
}

test('0–50 km/h trong 5,3 s', () => {
  const { t } = timeTo(13.889, 10);
  assert.ok(Math.abs(t - P.t50) <= 0.3, `t = ${t}`);
});

test('0–100 km/h trong 19,3 s', () => {
  const { t, vPeak } = timeTo(27.5, 40);
  assert.ok(Math.abs(t - P.t100) <= 0.5, `t = ${t}`);
  assert.ok(vPeak <= P.vMax + 0.01, `vPeak = ${vPeak}`);
});

test('drAccel giảm dần, về 0 tại vMax', () => {
  assert.ok(drAccel(0) > 0);
  for (let v = 0; v < P.vMax; v += 0.5) assert.ok(drAccel(v + 0.5) <= drAccel(v) + 1e-12, `v = ${v}`);
  assert.ok(drAccel(P.vMax) <= 1e-9);
});

test('bán kính quay vòng nhỏ nhất', () => {
  /* Góc lái lớn nhất asin(L / R) (brief) đặt R = 4,05 m vào tâm trục trước; tâm trục sau chạy vòng √(R² − L²) */
  const net = drMakeNet([flatPad(-200, 200, -200, 200)], []);
  const s = state(0, 0), g = inp(0, 0, 1);
  for (let i = 0; i < 180; i++) { s.v = 2; drStep(s, g, net, [], 0, DT); }      // 3 s cho góc lái đạt tối đa
  const fx: number[] = [], fz: number[] = [], rx: number[] = [], rz: number[] = [];
  const yaw0 = s.yaw;
  while (s.yaw - yaw0 < 2 * Math.PI) {
    s.v = 2; drStep(s, g, net, [], 0, DT);
    const cx = Math.cos(s.yaw) * L / 2, cz = -Math.sin(s.yaw) * L / 2;
    fx.push(s.x + cx); fz.push(s.z + cz); rx.push(s.x - cx); rz.push(s.z - cz);
  }
  const radius = (xs: number[], zs: number[]) => {
    const mx = xs.reduce((a, b) => a + b) / xs.length, mz = zs.reduce((a, b) => a + b) / zs.length;
    return xs.reduce((a, x, i) => a + Math.hypot(x - mx, zs[i] - mz), 0) / xs.length;
  };
  const rf = radius(fx, fz), rr = radius(rx, rz);
  assert.ok(Math.abs(rf - P.turnRadius) <= 0.25, `trục trước r = ${rf}`);
  assert.ok(Math.abs(rr - Math.sqrt(P.turnRadius ** 2 - L * L)) <= 0.25, `trục sau r = ${rr}`);
  assert.ok(s.steer > 0, 'steer > 0 là rẽ trái, yaw tăng');
});

test('càng nhanh lái càng ít', () => {
  assert.ok(drSteerMax(27) < drSteerMax(10) && drSteerMax(10) < drSteerMax(1));
  assert.ok(Math.abs(drSteerMax(0) - Math.asin(L / P.turnRadius)) < 1e-12);
  for (let v = 1; v <= P.vMax; v += 0.05) {
    const lat = v * v * Math.tan(drSteerMax(v)) / L;
    assert.ok(lat <= P.latMax + 0.01, `v = ${v}: ${lat}`);
  }
});

test('lái tiến dần về đích rồi tự trả về 0', () => {
  const net = longNet(), s = state(0, 0, 0, 5);
  drStep(s, inp(1, 0, 1), net, [], 0, DT);
  assert.ok(s.steer > 0 && s.steer < drSteerMax(s.v), 'chưa tới đích sau một khung');
  for (let i = 0; i < 60; i++) drStep(s, inp(1, 0, 1), net, [], 0, DT);
  assert.ok(Math.abs(s.steer - drSteerMax(s.v)) < 1e-9, 'tới đích sau 1 s');
  for (let i = 0; i < 60; i++) drStep(s, inp(1, 0, 0), net, [], 0, DT);
  assert.equal(s.steer, 0);
});

test('nhả ga thì chậm dần, không tự lùi', () => {
  const net = longNet(), s = state(0, 0, 0, 10);
  for (let i = 0; i < 120; i++) drStep(s, inp(), net, [], 0, DT);
  assert.ok(Math.abs(s.v - (10 - 2 * P.coast)) < 0.05, `v = ${s.v}`);
  for (let i = 0; i < 1200; i++) drStep(s, inp(), net, [], 0, DT);
  assert.equal(s.v, 0);
  assert.ok(!s.braking);
});

test('phanh rồi giữ thì lùi, tối đa 5,56 m/s', () => {
  const net = longNet(), s = state(500, 0, 0, 10);
  let vMin = 0;
  for (let i = 0; i < 60 * 15; i++) { drStep(s, inp(0, 1), net, [], 0, DT); vMin = Math.min(vMin, s.v); }
  assert.ok(s.v < 0, 'đang lùi');
  assert.ok(vMin >= -P.reverseMax - 1e-9, `vMin = ${vMin}`);
  assert.ok(Math.abs(s.v + P.reverseMax) < 1e-6, 'đạt tốc độ lùi tối đa');
  assert.ok(s.x < 500, 'lùi thật về phía sau');
  /* đang lùi mà đạp ga: phanh về 0 rồi mới tiến */
  let sawStop = false;
  for (let i = 0; i < 60 * 5; i++) { drStep(s, inp(1), net, [], 0, DT); if (s.v === 0) sawStop = true; }
  assert.ok(sawStop && s.v > 0);
});

test('phanh tay dừng nhanh hơn phanh thường', () => {
  const stopTime = (g: DrInput) => {
    const net = longNet(), s = state(0, 0, 0, 20); let t = 0;
    while (s.v > 0 && t < 10) { drStep(s, g, net, [], 0, DT); t += DT; }
    return t;
  };
  const tHand = stopTime(inp(0, 0, 0, true)), tBrake = stopTime(inp(0, 1));
  assert.ok(tHand < tBrake, `${tHand} < ${tBrake}`);
  assert.ok(Math.abs(tBrake - 20 / P.brake) < 0.05);
});

test('khung dài 5 s không xuyên vật cản', () => {
  const rail: DrSolid = { kind: 'rect', x0: 30, x1: 30.3, z0: -20, z1: 20, y0: 2.6, y1: 3.6 };
  const net = drMakeNet([flatPad(-100, 200, -20, 20)], [rail]);
  const s = state(30 - 20 - HL, 0, 0, P.vMax);
  drStep(s, inp(1), net, [], 0, 5);
  assert.ok(drFits(net, s, [], 0, new Uint8Array(1)));
  assert.ok(s.x + HL <= 30 + 1e-6, `x = ${s.x}`);
  assert.ok(s.x + HL > 29, 'xe đã tới sát lan can');
  assert.ok(Number.isFinite(s.y) && s.y === 2.6);
});

test('dt lớn chia bước, tối đa 60 bước', () => {
  const a = state(0, 0, 0, 10), b = state(0, 0, 0, 10), net = longNet();
  drStep(a, inp(), net, [], 0, 60);                                  // 60 bước × 0,1 s = 6 s, phần dư bỏ
  for (let i = 0; i < 60; i++) drStep(b, inp(), net, [], 0, 0.1);
  assert.ok(Math.abs(a.x - b.x) < 1e-9 && a.v === b.v);
});

test('drCreate đặt xe trên mặt Cầu Rồng', () => {
  const net = drMakeNet(drBuildPads(), drBuildSolids());
  const s = drCreate(net, 0), sp = drSpawnPose(0);
  assert.equal(s.x, sp.x); assert.equal(s.z, sp.z); assert.equal(s.yaw, sp.yaw);
  assert.ok(Math.abs(s.y - deckY(s.x)) < 1e-9);
  assert.equal(s.v, 0); assert.equal(s.evac, 0);
});

/* Cọ chéo: xe 20 m/s, mũi chéo 20° vào tường dài (z = 10), góc xe cách tường 5 cm, không ga không phanh, chạy T giây ở bước dt */
function scrape(dt: number, T: number): { v: number; x: number; s: DrState; net: ReturnType<typeof drMakeNet> } {
  const th = 20 * Math.PI / 180, HW = CONFIG.drive.car.width / 2;
  const net = drMakeNet([flatPad(-100, 3000, -20, 20)], [{ kind: 'rect', x0: -100, x1: 3000, z0: 10, z1: 11, y0: 2.6, y1: 4 }]);
  const s = state(0, 10 - HL * Math.sin(th) - HW * Math.cos(th) - 0.05, -th, 20);
  const n = Math.round(T / dt);
  for (let i = 0; i < n; i++) drStep(s, inp(), net, [], 0, dt);
  return { v: s.v, x: s.x, s, net };
}

test('cọ chéo không phụ thuộc tần số khung', () => {
  const r = [1 / 30, 1 / 60, 1 / 144].map((dt) => scrape(dt, 1));
  const vs = r.map((o) => o.v), xs = r.map((o) => o.x);
  const spread = (a: number[]) => (Math.max(...a) - Math.min(...a)) / Math.max(...a);
  assert.ok(spread(vs) <= 0.05, `v = ${vs.map((v) => v.toFixed(3)).join(' / ')}`);
  assert.ok(spread(xs) <= 0.05, `x = ${xs.map((x) => x.toFixed(3)).join(' / ')}`);
  for (const o of r) assert.ok(drFits(o.net, o.s, [], 0, new Uint8Array(1)), 'không xuyên tường');
});

test('cọ chéo 20° giữ lại phần lớn tốc độ', () => {
  for (const dt of [1 / 30, 1 / 60, 1 / 144]) {
    const a = scrape(dt, 0.1).v, b = scrape(dt, 1).v;
    assert.ok(a >= 0.85 * 20 * Math.cos(20 * Math.PI / 180) - 0.05, `dt ${dt.toFixed(4)}: v(0,1 s) = ${a}`);
    assert.ok(b > 10, `dt ${dt.toFixed(4)}: v(1 s) = ${b}`);
  }
});

test('đâm thẳng thì dừng', () => {
  const net = drMakeNet([flatPad(-100, 100, -50, 50)], [{ kind: 'rect', x0: -100, x1: 100, z0: 10, z1: 11, y0: 2.6, y1: 4 }]);
  for (const dt of [1 / 30, 1 / 60, 1 / 144]) {
    const s = state(0, 10 - HL - 1, -Math.PI / 2, 20);                // yaw = −π/2: mũi xe hướng +z, cách tường 1 m
    for (let i = 0; i < Math.round(0.2 / dt); i++) drStep(s, inp(), net, [], 0, dt);
    assert.ok(Math.abs(s.v) < 1, `dt ${dt.toFixed(4)}: v = ${s.v}`);
    assert.ok(drFits(net, s, [], 0, new Uint8Array(1)) && s.z + HL <= 10 + 1e-6, `không xuyên (z = ${s.z})`);
  }
});

test('mọi chỗ xuất phát đều hợp lệ', () => {
  const net = drMakeNet(drBuildPads(), drBuildSolids());
  for (let slot = 0; slot <= 4; slot++) {
    const sp = drSpawnPose(slot), y = drGround(net, sp.x, sp.z, deckY(sp.x));
    assert.ok(Number.isFinite(y), `slot ${slot}: có mặt đường`);
    assert.ok(drFits(net, { x: sp.x, y, z: sp.z, yaw: sp.yaw }, [], 0, new Uint8Array(1)), `slot ${slot}: thân xe hợp lệ`);
  }
});

test('mạng thật: giữ ga 30 s đi thẳng trên Cầu Rồng', () => {
  const net = drMakeNet(drBuildPads(), drBuildSolids());
  const s = drCreate(net, 0), ign = new Uint8Array(1), z0 = s.z;
  for (let i = 0; i < 30 * 60; i++) {
    drStep(s, inp(1), net, [], 0, DT);
    assert.ok(Number.isFinite(s.x) && Number.isFinite(s.y) && Number.isFinite(s.z) && Number.isFinite(s.pitch) && Number.isFinite(s.v), `khung ${i}`);
    assert.ok(drFits(net, s, [], 0, ign), `khung ${i}: x = ${s.x}`);
    if (Math.abs(s.x) <= CONFIG.length / 2) {
      assert.ok(Math.abs(s.y - deckY(s.x)) < 1e-9, `y bám deckY tại x = ${s.x}`);
      const pitch = Math.atan2(deckY(s.x + L / 2) - deckY(s.x - L / 2), L);
      if (Math.abs(s.x) < CONFIG.length / 2 - L) assert.ok(Math.abs(s.pitch - pitch) < 1e-9, 'pitch theo dốc cầu');
    }
  }
  assert.equal(s.z, z0);
  assert.ok(s.x > CONFIG.length / 2, `đã qua hết cầu (x = ${s.x})`);
  assert.ok(s.v > 25);
});

/* ===== Sơ tán khỏi nhịp quay Cầu sông Hàn ===== */
const SH_LANE_Z = SH.z + SH.lane;                                    // tim làn chiều đi Đông (+X) trên Cầu sông Hàn
const OUT_X = SH.barrierX + HL;                                      // 69,945 — đuôi xe ra hẳn ngoài barie
const shNetCache = drMakeNet(drBuildPads(), drBuildSolids());
/* Hộp nào đang chồng thân xe thì bỏ qua (luật drMove): thân xe hợp lệ với vật cản tĩnh mà thêm riêng hộp đó thì không */
const ign = (net: typeof shNetCache, s: DrState, boxes: DrBox[]) => Uint8Array.from(boxes, (b) => drFits(net, s, [], 0, new Uint8Array(0)) && !drFits(net, s, [b], 1, new Uint8Array(1)) ? 1 : 0);

test('sơ tán khỏi nhịp quay giữa hàng xe', () => {
  const net = shNetCache, y = shRoadY(0);
  /* 3 xe tự động: hai xe đứng hàng ngoài barie Đông (như shStepTraffic: barrierX + 3, + 7,5), một xe ngay trên đường ra */
  const boxes: DrBox[] = [SH.barrierX + 3, SH.barrierX + 10.5, 30].map((x) => ({ x, y: shRoadY(x), z: SH_LANE_Z, yaw: 0, hl: 2.25, hw: 0.975 }));
  const s = state(0, SH_LANE_Z, 0, 0, y);
  assert.ok(drFits(net, s, boxes, 0, new Uint8Array(3)), 'cổng mở: đứng giữa nhịp hợp lệ');
  drSetGate(net, DR_GATE_SWING, true);
  try {
    let t = 0;
    while (t < 6 && (t === 0 || s.evac > 0)) { drStep(s, inp(1, 0, 0.7), net, boxes, 3, DT); t += DT; }
    assert.equal(s.evac, 0, `sơ tán xong trong 6 s (t = ${t.toFixed(2)})`);
    assert.ok(Math.abs(s.x) > OUT_X, `ra ngoài barie (x = ${s.x})`);
    assert.ok(Number.isFinite(drGround(net, s.x, s.z, s.y)), 'đứng trên mặt đường');
    assert.ok(drFits(net, s, boxes, 3, ign(net, s, boxes)), 'hợp lệ khi bỏ qua hộp đang chồng');
    assert.ok(!drEvacStep(s, net, DT), 'xong thì trả điều khiển');
    /* lái ra được: lùi về phía Tây thì bị cổng chặn ở mép nhịp, tiến về Đông đi qua hàng xe đang chồng */
    const v0 = s.x;
    for (let i = 0; i < 120; i++) drStep(s, inp(1), net, boxes, 3, DT);
    assert.ok(s.x > v0 + 1, `lái được sau sơ tán (x ${v0} → ${s.x})`);
  } finally { drSetGate(net, DR_GATE_SWING, false); }
});

test('cổng đóng khi xe giữa nhịp thì không lái tự do được', () => {
  const net = shNetCache;
  drSetGate(net, DR_GATE_SWING, true);
  try {
    /* hai xe cùng chỗ, đầu vào khác nhau: quỹ đạo giống hệt nhau trong suốt lúc sơ tán; không lúc nào ra ngoài nhịp ngoài trục x */
    const a = state(-20, SH_LANE_Z, 0.4, 12, shRoadY(0)), b = { ...a };
    const ga = inp(1, 0, 1), gb = inp(0, 1, -1, true);
    for (let i = 0; i < 6 * 60 && (i === 0 || a.evac > 0); i++) {
      drStep(a, ga, net, [], 0, DT); drStep(b, gb, net, [], 0, DT);
      assert.ok(a.x === b.x && a.z === b.z && a.yaw === b.yaw && a.y === b.y, `khung ${i}: đầu vào không đổi quỹ đạo`);
      assert.equal(a.v, 0, 'đứng (không giữ đà) trong lúc sơ tán');
      assert.ok(Math.abs(a.z - SH_LANE_Z) < 4 && a.y > SH.deckY - 1, `khung ${i}: không bay ra sông (z = ${a.z}, y = ${a.y})`);
    }
    assert.equal(a.evac, 0);
    assert.ok(a.x < -OUT_X, `ra barie Tây gần nhất (x = ${a.x})`);
    assert.ok(drFits(net, a, [], 0, new Uint8Array(1)));
  } finally { drSetGate(net, DR_GATE_SWING, false); }
});

test('sơ tán gói trong thời gian còn lại trước khi nhịp xoay', () => {
  const net = shNetCache;
  drSetGate(net, DR_GATE_SWING, true);
  try {
    const s = state(5, SH_LANE_Z, 0, 0, shRoadY(0));
    let t = 0;
    while (drEvacStep(s, net, DT, 1.07)) t += DT;                    // tốc độ quay 30×: (4 + 8 + 20) / 30 s tới ROTATING_OPEN
    assert.ok(t <= 1.07 + DT, `t = ${t}`);
    assert.ok(s.x > OUT_X);
  } finally { drSetGate(net, DR_GATE_SWING, false); }
});

test('cổng mở lại thì đi qua được', () => {
  const net = shNetCache;
  drSetGate(net, DR_GATE_SWING, true);
  try {
    const s = state(-90, SH_LANE_Z, 0, 0, shRoadY(-90));
    for (let i = 0; i < 10 * 60; i++) drStep(s, inp(1), net, [], 0, DT);
    assert.ok(s.x + HL <= -SH.fixedStart + 1e-6 && s.x > -SH.fixedStart - 5, `cổng đóng: dừng ở mép nhịp (x = ${s.x})`);
    assert.equal(s.evac, 0, 'dừng trước nhịp, không sơ tán');
    drSetGate(net, DR_GATE_SWING, false);
    for (let i = 0; i < 15 * 60; i++) drStep(s, inp(1), net, [], 0, DT);
    assert.ok(s.x > SH.barrierX + 10, `cổng mở: qua hết nhịp (x = ${s.x})`);
    assert.ok(Math.abs(s.z - SH_LANE_Z) < 1e-9);
  } finally { drSetGate(net, DR_GATE_SWING, false); }
});
