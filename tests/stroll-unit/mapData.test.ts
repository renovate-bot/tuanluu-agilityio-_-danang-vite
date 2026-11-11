/* ===== Đi dạo: test dữ liệu vùng đi được (src/explore/stroll/mapData.ts) =====
   Bản đồ tĩnh dựng từ CONFIG + biên dạng hai cầu: điểm xuất phát, vòng khép kín (BFS lưới 1 m), cổng nhịp quay,
   Cầu Tình Yêu, mép kè, không đứng trên mặt nước, liên tục cao độ, khung bounds, thân rồng, tháp Cầu sông Hàn. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CONFIG } from '../../src/config.ts';
import { multiParams } from '../../src/explore/multi/params.ts';
import { deckY } from '../../src/bridges/dragon/profile.ts';
import { stValid, stZoneAt, stGroundY, stSetGate, type StMap } from '../../src/explore/stroll/map.ts';
import { ST_GATE_SWING, stBuildZones, stBuildStructures, stBuildStaticMap, stSpawn, stSpinePoints, stSpinePoint } from '../../src/explore/stroll/mapData.ts';

const C = CONFIG.stroll, B = C.bounds, SHZ = CONFIG.songHan.z;
const map = stBuildStaticMap();

/* ---- BFS trên lưới 1 m (4 hướng), nút hợp lệ + điểm giữa cạnh hợp lệ, chân ở mặt đứng (feet 0) ---- */
const NX = B.x1 - B.x0 + 1, NZ = B.z1 - B.z0 + 1;
const node = (x: number, z: number) => (z - B.z0) * NX + (x - B.x0);
function bfs(m: StMap, sx: number, sz: number, box = { x0: B.x0, x1: B.x1, z0: B.z0, z1: B.z1 }): Uint8Array {
  const seen = new Uint8Array(NX * NZ), q = new Int32Array(NX * NZ);
  assert.ok(stValid(m, sx, sz, 0), `điểm đầu BFS (${sx}, ${sz}) phải hợp lệ`);
  let h = 0, t = 0; seen[node(sx, sz)] = 1; q[t++] = node(sx, sz);
  while (h < t) {
    const k = q[h++], x = k % NX + B.x0, z = Math.floor(k / NX) + B.z0;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz;
      if (nx < box.x0 || nx > box.x1 || nz < box.z0 || nz > box.z1) continue;
      const nk = node(nx, nz);
      if (seen[nk]) continue;
      if (!stValid(m, nx, nz, 0) || !stValid(m, x + dx / 2, z + dz / 2, 0)) continue;
      seen[nk] = 1; q[t++] = nk;
    }
  }
  return seen;
}
const reached = (seen: Uint8Array, x: number, z: number) => seen[node(x, z)] === 1;

/* chân vòm: điểm thân rồng lặn xuống dưới mặt cầu, cách tính như body.ts:31-36 */
function archFeet(): number[] {
  const xs: number[] = []; let x0 = -CONFIG.mainTotal / 2; xs.push(x0);
  for (const s of CONFIG.mainSpans) { x0 += s; xs.push(x0); }
  return xs;
}

/* lan can kè ven sông, chép bố cục promenade.ts:24,55-60: mỗi cột z có đoạn [z − 0,14, z + railStep]; bỏ ở chân cầu / hầm (blocked(z, 4))
   và ở bờ Đông trước Cầu Tình Yêu (đoạn chạm |z − love.z| < width/2 + railGap) */
const RF = CONFIG.riverfront, LV = RF.love, RSTEP = RF.promenade.railStep;
const RF_RAIL = CONFIG.bankX + 1 + 0.28 / 2;                          // mặt phía bờ của cột lan can kè, m
const rfBlocked = (z: number, pad = 0) => Math.abs(z) < 34 + pad || Math.abs(z - CONFIG.songHan.z) < 18 + pad || Math.abs(z - CONFIG.ttl.z) < 40 + pad || Math.abs(z - (CONFIG.ttl.z - 65)) < 14 + pad || Math.abs(z - CONFIG.hanTunnel.z) < 28 + pad;
function railSegs(sd: number): [number, number][] {
  const segs: [number, number][] = [], g0 = LV.z - LV.width / 2 - LV.railGap, g1 = LV.z + LV.width / 2 + LV.railGap;
  for (let z = (sd < 0 ? -2600 : -2300) + 2; z < 2600; z += RSTEP) {
    if (rfBlocked(z, 4)) continue;
    if (sd > 0 && z + RSTEP > g0 && z - 0.14 < g1) continue;
    segs.push([z - 0.14, z + RSTEP]);
  }
  return segs;
}
const RAIL = { [-1]: railSegs(-1), [1]: railSegs(1) } as Record<number, [number, number][]>;
const railAt = (sd: number, z: number) => RAIL[sd].some(([a, b]) => z >= a && z <= b);

const out = { x: 0, z: 0 };
const SPAWN = (() => { stSpawn(map, 2, out); return { x: Math.round(out.x), z: Math.round(out.z) }; })();

test('điểm xuất phát slot 0–4 và −1 hợp lệ, cách nhau ≥ 2 m, cao độ = deckY(x) + lề 0,25 ± 0,01', () => {
  const pts: { x: number; z: number }[] = [];
  for (const slot of [0, 1, 2, 3, 4, -1]) {
    const p = { x: 0, z: 0 }; stSpawn(map, slot, p);
    assert.ok(stValid(map, p.x, p.z, 0), `slot ${slot} không hợp lệ (${p.x}, ${p.z})`);
    assert.equal(stZoneAt(map, p.x, p.z)?.id, 'dragon');
    assert.ok(Math.abs(stGroundY(map, p.x, p.z) - (deckY(p.x) + 0.25)) <= 0.01, `slot ${slot} cao độ ${stGroundY(map, p.x, p.z)}`);
    if (slot >= 0) pts.push(p); else assert.deepEqual(p, pts[2]);
  }
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) assert.ok(Math.hypot(pts[i].x - pts[j].x, pts[i].z - pts[j].z) >= 2, `slot ${i}, ${j} quá gần`);
});

test('vòng khép kín: BFS lưới 1 m (feet 0, cổng mở) từ điểm xuất phát tới giữa Cầu Rồng, bờ Đông, giữa Cầu sông Hàn, bờ Tây rồi về', () => {
  const seen = bfs(map, SPAWN.x, SPAWN.z);
  /* đồ thị vô hướng: một BFS từ điểm xuất phát chạm tới mọi đích ⇔ mọi chặng của vòng (kể cả chặng về) đều có đường */
  const legs: [string, number, number][] = [['giữa Cầu Rồng', 0, 10], ['bờ Đông', 300, -500], ['giữa Cầu sông Hàn', 0, SHZ + 3], ['bờ Tây', -300, -500], ['điểm xuất phát', SPAWN.x, SPAWN.z]];
  for (const [name, x, z] of legs) assert.ok(reached(seen, x, z), `không tới được ${name} (${x}, ${z})`);
  assert.equal(stZoneAt(map, 0, SHZ + 3)?.id, 'shSwing');
});

test('không nhảy: từ lề Cầu Rồng tới lòng đường có đường qua đầu cầu, gờ chắn xe chặn lối thẳng (nhảy qua được)', () => {
  /* kỳ vọng ghi rõ: lề → lòng đường đi được bằng chân (vòng qua đầu gờ ở x = ±333), nên chặng "giữa Cầu Rồng" ở test trên dùng lòng đường (0, 10) */
  const seen = bfs(map, SPAWN.x, SPAWN.z);
  assert.ok(reached(seen, SPAWN.x, 10), 'lề không nối được lòng đường khi không nhảy');
  assert.equal(stValid(map, SPAWN.x, 16.1, 0), false, 'gờ chắn xe phải chặn khi chân ở mặt đứng');
  assert.equal(stValid(map, SPAWN.x, 16.1, CONFIG.stroll.jumpHeight), true, 'nhảy cao 1,2 m phải qua được gờ 0,9 m');
});

test('cổng shSwing đóng: không qua được Cầu sông Hàn; bờ Đông và bờ Tây vẫn nối nhau qua Cầu Rồng', () => {
  const m = stBuildStaticMap();
  stSetGate(m, ST_GATE_SWING, true);
  assert.equal(stValid(m, 0, SHZ + 3, 0), false);
  /* trong khung quanh Cầu sông Hàn (không có Cầu Rồng) thì hai đầu cầu không nối nhau */
  const near = bfs(m, -100, SHZ, { x0: B.x0, x1: B.x1, z0: SHZ - 200, z1: SHZ + 200 });
  assert.equal(reached(near, 100, SHZ), false, 'nhịp quay đóng mà vẫn qua được cầu');
  const all = bfs(m, -300, -500);
  assert.ok(reached(all, 300, -500), 'bờ Tây không còn nối bờ Đông');
  assert.ok(reached(all, 100, SHZ), 'đầu cầu phía Đông phải tới được qua Cầu Rồng');
  assert.ok(reached(all, 0, 10), 'Cầu Rồng phải đi được');
});

test('Cầu Tình Yêu: có đường từ bờ Đông tới giữa cầu tàu qua khe lan can kè; ngoài lan can 0,5 m không hợp lệ; tượng chặn', () => {
  const L = CONFIG.riverfront.love, x0 = CONFIG.bankX - L.length, xm = Math.round((x0 + CONFIG.bankX) / 2);
  const seen = bfs(map, 300, -500);
  assert.ok(reached(seen, xm, L.z), 'không tới được giữa Cầu Tình Yêu');
  /* lối vào: cột lưới x = 263 nằm giữa mép kè và mép vùng bờ (263,49); ngoài mặt cầu thì chỉ đi được ở vùng love, tức là qua khe lan can */
  assert.ok(reached(seen, 263, L.z), 'đường lên cầu tàu không qua khe lan can kè');
  assert.equal(stZoneAt(map, 263, L.z)?.id, 'love');
  for (let z = B.z0; z <= B.z1; z++) if (reached(seen, 263, z)) assert.match(stZoneAt(map, 263, z).id, /^(love|dragon|songHanE)$/, `(263, ${z}) đi được ngoài khe lan can`);
  /* khe lan can trong cảnh phủ cả bề rộng vùng love cộng bán kính người; bờ Tây vẫn có lan can ở đó */
  const lz = stBuildZones().find((zn) => zn.id === 'love');
  for (let z = lz.z0 - C.radius; z <= lz.z1 + C.radius; z += 0.05) assert.equal(railAt(1, z), false, `lan can kè bờ Đông còn ở z = ${z}`);
  assert.ok(railAt(-1, L.z), 'bờ Tây phải còn lan can');
  assert.ok(railAt(1, L.z - L.width / 2 - L.railGap - RSTEP - 0.5) && railAt(1, L.z + L.width / 2 + L.railGap + RSTEP), 'khe lan can bờ Đông quá rộng');
  assert.equal(stZoneAt(map, xm, L.z)?.id, 'love');
  assert.ok(Math.abs(stGroundY(map, xm, L.z) - 3.0) < 1e-9, 'mặt cầu tàu cao 3,0 m (landmarks.ts:62)');
  for (const s of [-1, 1]) assert.equal(stValid(map, xm, L.z + s * (L.width / 2 + 0.5), 0), false);
  assert.equal(stValid(map, x0 + 1.8, L.z, 0), false, 'bệ tượng cá chép phải chặn');
});

test('mép kè: 2 000 z ngẫu nhiên, (±(262 − 0,1), z) không hợp lệ trừ vùng cầu / love', () => {
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 2000; i++) {
    const z = B.z0 + rnd() * (B.z1 - B.z0);
    for (const s of [-1, 1]) {
      const x = s * (CONFIG.bankX - 0.1);
      if (!stValid(map, x, z, 0)) continue;
      const id = stZoneAt(map, x, z).id;
      assert.match(id, /^(dragon|songHan|sh|love)/, `(${x}, ${z}) hợp lệ trong vùng ${id}`);
    }
  }
});

test('lan can kè: 2 000 z ngẫu nhiên có lan can, tâm cách mặt cột lan can ít hơn radius không hợp lệ ở cả hai bờ', () => {
  let seed = 13, n = 0; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 2000; i++) {
    const z = B.z0 + rnd() * (B.z1 - B.z0);
    for (const s of [-1, 1]) {
      if (!railAt(s, z)) continue;                                        // chân cầu, lối vào Cầu Tình Yêu: không có lan can
      const x = s * (RF_RAIL + C.radius - 0.05);
      assert.equal(stValid(map, x, z, Infinity), false, `(${x}, ${z}) xuyên lan can kè`);
      n++;
    }
  }
  assert.ok(n > 3500, `quá ít điểm có lan can (${n})`);
  assert.ok(stValid(map, RF_RAIL + C.radius + 0.05, -500, 0) && stValid(map, -(RF_RAIL + C.radius + 0.05), -500, 0), 'ngay sau lan can phải đi được');
});

test('không đứng trên mặt nước: lưới 1 m, mọi điểm hợp lệ có |x| < 262 thuộc vùng cầu hoặc love', () => {
  for (let x = -261; x <= 261; x++) for (let z = B.z0; z <= B.z1; z++) {
    if (!stValid(map, x, z, Infinity)) continue;
    const id = stZoneAt(map, x, z).id;
    assert.ok(/^(dragon|songHanW|songHanE|shSwing|love)$/.test(id), `(${x}, ${z}) trên mặt nước thuộc vùng ${id}`);
  }
});

test('liên tục cao độ: hai điểm hợp lệ kề nhau trên lưới 0,5 m chênh ≤ stepMax + 0,05', () => {
  const nx = (B.x1 - B.x0) * 2 + 1, lim = C.stepMax + 0.05;
  let prev = new Float64Array(nx), cur = new Float64Array(nx), worst = 0;
  for (let j = 0; j <= (B.z1 - B.z0) * 2; j++) {
    const z = B.z0 + j / 2;
    for (let i = 0; i < nx; i++) {
      const x = B.x0 + i / 2;
      cur[i] = stValid(map, x, z, 0) ? stGroundY(map, x, z) : NaN;
      if (Number.isNaN(cur[i])) continue;
      if (i > 0 && !Number.isNaN(cur[i - 1])) { const d = Math.abs(cur[i] - cur[i - 1]); if (d > worst) worst = d; assert.ok(d <= lim, `(${x - 0.5}, ${z}) → (${x}, ${z}) chênh ${d}`); }
      if (j > 0 && !Number.isNaN(prev[i])) { const d = Math.abs(cur[i] - prev[i]); if (d > worst) worst = d; assert.ok(d <= lim, `(${x}, ${z - 0.5}) → (${x}, ${z}) chênh ${d}`); }
    }
    const t = prev; prev = cur; cur = t;
  }
  assert.ok(worst > 0.2, 'phải có bậc lề / dải phân cách được cộng vào cao độ');
});

test('bến du thuyền bờ Tây và mọi điểm ngoài bounds không hợp lệ; bounds bằng multiParams; mọi vùng nằm trong bounds', () => {
  assert.deepEqual(C.bounds, multiParams.stroll.bounds);
  /* bến du thuyền: promenade.ts:71-76, phao nổi x = −(262 − 8), z = 104 ± 23; cầu dẫn từ kè xuống phao */
  for (const [x, z] of [[-254, 104], [-258, 104], [-248, 95], [-261.9, 104], [-257.8, 104]]) assert.equal(stValid(map, x, z, 0), false, `bến du thuyền (${x}, ${z})`);
  for (const zn of stBuildZones()) assert.ok(zn.x0 >= B.x0 && zn.x1 <= B.x1 && zn.z0 >= B.z0 && zn.z1 <= B.z1, `vùng ${zn.id} ra ngoài bounds`);
  let seed = 11; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 2000; i++) {
    const x = (rnd() - 0.5) * 3000, z = (rnd() - 0.5) * 6000;
    if (x >= B.x0 && x <= B.x1 && z >= B.z0 && z <= B.z1) continue;
    assert.equal(stValid(map, x, z, Infinity), false, `(${x}, ${z}) ngoài bounds mà hợp lệ`);
  }
});

test('thân rồng: tim dải phân cách tại chân vòm không hợp lệ; giữa hai chân vòm dưới nhịp vòm cao hợp lệ', () => {
  const feet = archFeet();
  for (const x of feet) assert.equal(stValid(map, x, 0, 0), false, `chân vòm x = ${x}`);
  for (let i = 0; i + 1 < feet.length; i++) {
    const xm = (feet[i] + feet[i + 1]) / 2;
    assert.equal(stValid(map, xm, 0, 0), true, `giữa nhịp x = ${xm}`);
    assert.ok(Math.abs(stGroundY(map, xm, 0) - (deckY(xm) + 0.3)) < 1e-9, 'dải phân cách cao 0,3 m (deck.ts:19)');
  }
  /* thân rồng chỉ chặn dải phân cách: lòng đường cạnh chân vòm vẫn đi được */
  for (const x of feet) assert.equal(stValid(map, x, 8, 0), true, `lòng đường cạnh chân vòm x = ${x}`);
});

test('đường tim thân rồng của mapData khớp CatmullRomCurve3 centripetal của three (body.ts:29-39)', () => {
  const pts = stSpinePoints();
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, y, 0)), false, 'centripetal');
  const p = { x: 0, y: 0 };
  for (let i = 0; i <= 500; i++) {
    const t = i / 500, v = curve.getPoint(t); stSpinePoint(pts, t, p);
    assert.ok(Math.abs(v.x - p.x) < 1e-6 && Math.abs(v.y - p.y) < 1e-6, `t = ${t}: (${v.x}, ${v.y}) ≠ (${p.x}, ${p.y})`);
  }
});

test('tim tháp Cầu sông Hàn không hợp lệ; chân chữ A chặn; gờ chắn xe là tường thấp', () => {
  assert.equal(stValid(map, 0, SHZ, 0), false);
  assert.equal(stValid(map, 0, SHZ, Infinity), false, 'tháp cao vô hạn, nhảy không qua');
  for (const s of [-1, 1]) assert.equal(stValid(map, s * 14.5, SHZ, Infinity), false, 'chân chữ A');
  const lows = stBuildStructures().filter((s) => s.top !== undefined);
  assert.ok(lows.length >= 4, 'gờ chắn xe hai cầu');
  for (const s of lows) assert.ok(s.top > C.stepMax && s.top < C.lowMax, `tường thấp cao ${s.top}`);
});
