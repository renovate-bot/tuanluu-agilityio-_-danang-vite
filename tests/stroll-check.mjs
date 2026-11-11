// Kiểm tra chế độ đi dạo một mình trên máy tính (docs/superpowers/plans/2026-11-11-di-dao.md, Task 6).
//   Trang A `?test&explore=stroll`:
//   Mục 1: vào chế độ (cam.mode, lớp body, bảng tham quan ẩn, điểm xuất phát, cao độ lề Cầu Rồng).
//   Mục 2: cao độ chân khớp mặt cầu / mặt đất tại 12 điểm mẫu (tia thẳng xuống vào cảnh).
//   Mục 3: oracle độc lập với bản đồ: hơn 30 000 bước ngẫu nhiên (11 điểm xa nhà + 16 điểm sát tường nhà), mỗi 20 bước 8 tia ngang × 3 cao độ vào tam giác thật của các lưới rắn;
//          mỗi bước tâm nhân vật không nằm trong hộp bao nhà (theo hình học), đếm bước gần nhà (không rỗng), đẩy thẳng vào một bức tường để chứng minh tia thấy tường.
//   Mục 4: không ra ngoài mép kè trừ cầu / Cầu Tình Yêu, không thấp hơn mặt đất.
//   Mục 5: camera sát tường nhà không chui vào nhà, không xuống dưới mặt đất.
//   Mục 8: draw call của người đi dạo đúng 1.
//   Mục 7: cầu quay: sơ tán khỏi nhịp, không vào lại khi chưa đóng, đóng thì vào được.
//   Mục 6: phím W theo hướng camera, blur dừng (Review Focus 3), gõ trong ô nhập không điều khiển, Space một lần nhảy một lần, Esc thoát.
//   Trang B `?test`: không có `stroll-people` trong cảnh.
//   Mục 9 (Task 7): sảnh đi dạo qua màn chọn với máy chủ giả (routeWebSocket): chữ đi dạo, đổi ngôn ngữ ar / en đổi ngay, Quay lại → Dù lượn về chữ dù lượn,
//          máy chủ cũ (lobby không walkers) → ngoại tuyến, Đi một mình.
//   Mục 11 (Task 9): chụp ảnh: PNG đúng khung WebGL (tên, kích thước = canvas, 400 điểm mẫu), phím p, 5 lần bấm, đổi cỡ cửa sổ, bậc thấp, preserveDrawingBuffer = false.
//   Mục 10 (Task 7): cả 9 file locale có đủ khóa st* và exWalk / exWalkDesc.
//
//   npm run build && npm run test:stroll
//
//   Oracle mục 3 (không dùng bản đồ va chạm): tam giác thế giới của các lưới rắn, xếp vào lưới ô 2 m để chỉ thử tam giác gần nhân vật
//   (Raycaster trên cả cảnh với 24 000 tia không xong trong thời gian hợp lý trên SwiftShader). Thử tia bằng Ray.intersectTriangle
//   không loại mặt sau = vật liệu DoubleSide. Lưới dùng: nhà level gần của THREE.LOD (InstancedMesh, mọi instance còn hiện quanh khung đi dạo),
//   `dragon-body` (thân rồng), `dragon-head` (cả nhóm đầu rồng), `sh-tower` (tháp Cầu sông Hàn), `rf-landmarks` (địa danh ven sông, gồm cả
//   cầu tàu, lan can, hàng khóa và tượng cá chép Cầu Tình Yêu). Không dùng: cây, cột đèn, ghế, xe, người, dây văng, bảng quảng cáo (spec §4: đi xuyên được).
//   Cao độ tia tính từ cao độ đứng tại chỗ (không từ chân khi đang nhảy): spec chỉ chặn trong tầm người tính từ mặt đứng.
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { serveDir, launch, openApp, frames } from './lib.mjs';

const problems = [];
const check = (name, ok) => { if (!ok) problems.push(name); console.log(`${ok ? 'đạt ' : 'LỖI '} ${name}`); return ok; };

/* Chạy trong trang: hàm dùng chung (đặt nhân vật, tìm vùng, tia thẳng xuống) */
function installHelpers() {
  const a = window.__app, S = a.stroll, T = a.THREE;
  const map = () => S.stroll.map;
  const zoneAt = (x, z) => {
    for (const zn of map().zones) {
      if (x < zn.x0 || x > zn.x1 || z < zn.z0 || z > zn.z1) continue;
      if (zn.gate !== undefined && map().closed.has(zn.gate)) continue;
      return zn;
    }
    return null;
  };
  const put = (x, z) => {
    const s = S.stroll.state, g = S.stGroundY(map(), x, z);
    s.x = x; s.z = z; s.y = g; s.vy = 0; s.air = false; s.evac = false; s.speed = 0; s.tx = x; s.tz = z; s.photo = 0;
    return g;
  };
  /* vật đi xuyên được (spec §4) hoặc không phải mặt rắn: bỏ qua khi tìm mặt đứng */
  const through = (o) => {
    if (o.isInstancedMesh || o.isPoints || o.isLine || o.isSprite || o.name === 'stroll-people') return true;
    for (let p = o; p; p = p.parent) if (!p.visible) return true;
    return false;
  };
  const rc = new T.Raycaster(); rc.layers.enableAll(); rc.camera = a.camera;
  const down = (x, y, z) => {
    rc.set(new T.Vector3(x, y + 3, z), new T.Vector3(0, -1, 0)); rc.near = 0; rc.far = 10;
    for (const h of rc.intersectObject(a.scene, true)) if (!through(h.object)) return { y: h.point.y, name: h.object.name || h.object.type, par: h.object.parent?.name || '' };
    return null;
  };
  window.__st = { zoneAt, put, down };
}

const srv = await serveDir(fileURLToPath(new URL('../dist/', import.meta.url)));
const browser = await launch();
try {
  const A = await openApp(browser, srv.url + '?explore=stroll');
  const P = A.page;
  await frames(P, 3);
  const has = await P.evaluate(() => !!(window.__app && window.__app.stroll && window.__app.stroll.stroll));
  check('có __app.stroll', has);
  if (!has) throw new Error('chưa có chế độ đi dạo (__app.stroll)');
  await P.evaluate(installHelpers);

  // Mục 1 — vào chế độ
  {
    const r = await P.evaluate(() => {
      const a = window.__app, S = a.stroll, s = S.stroll.state, C = S.CONFIG_stroll;
      const vis = (sel) => { a.ui?.reveal(document.querySelector(sel)); const e = document.querySelector(sel); return !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden'; };
      const hidden = ['[data-bridge="dragon"]', '[data-view="tour"]', '[data-view="allTour"]', '#tourCaption', '.specs', 'h1'].filter((q) => vis(q));
      a.ui?.closeSheets();   // reveal mở tờ điều khiển; tờ còn mở thì Esc đầu chỉ đóng tờ (compactUI)
      const d = window.__st.down(s.x, s.y, s.z);
      return { mode: a.cam.mode, ctl: a.controls.enabled, ex: document.body.classList.contains('explore'), st: document.body.classList.contains('stroll'), act: S.stroll.active(),
        leaked: hidden, x: s.x, z: s.z, y: s.y, sx: C.spawn.x, sz: C.spawn.z, hit: d, obj: !!a.scene.getObjectByName('stroll-people') };
    });
    check(`1 cam.mode ${r.mode}, controls ${r.ctl}, body.explore ${r.ex}, body.stroll ${r.st}, active ${r.act}, scene có stroll-people ${r.obj}`, r.mode === 'stroll' && r.ctl === false && r.ex && r.st && r.act && r.obj);
    check(`1 bảng tham quan ẩn (lọt: ${r.leaked.join(',') || '-'})`, r.leaked.length === 0);
    check(`1 xuất phát slot −1 tại (${r.x.toFixed(2)}, ${r.z.toFixed(2)}) = spawn (${r.sx}, ${r.sz})`, Math.abs(r.x - r.sx) < 1e-6 && Math.abs(r.z - r.sz) < 1e-6);
    check(`1 y ${r.y.toFixed(3)} = mặt lề Cầu Rồng ${r.hit ? r.hit.y.toFixed(3) + ' (' + r.hit.name + ')' : '-'} ± 0,02`, !!r.hit && Math.abs(r.y - r.hit.y) <= 0.02);
  }

  // Mục 2 — cao độ tại 12 điểm mẫu
  {
    const r = await P.evaluate(() => {
      const S = window.__app.stroll, SHZ = -1080;
      const pts = [
        ['Cầu Rồng lề Nam', -240, 17.4], ['Cầu Rồng lề Bắc', 150, -17.6], ['Cầu Rồng lòng đường gần đầu Tây', -300, 9], ['Cầu Rồng đường dẫn Đông (vỉa hè)', 345, 18.2],
        ['Cầu sông Hàn lề Nam phần cố định', -150, SHZ + 5.5], ['Cầu sông Hàn lề Bắc nhịp quay', 40, SHZ - 5.5], ['Cầu sông Hàn lòng đường', 200, SHZ + 3], ['Cầu sông Hàn đường dẫn Đông', 300, SHZ + 2.5],
        ['bờ Tây lối dạo', -275, -500], ['bờ Đông lối dạo', 275, -600], ['bờ Tây đường Bạch Đằng', -305, -300], ['Cầu Tình Yêu', 240, -78]
      ];
      return pts.map(([n, x, z]) => {
        const ok = S.stValid(S.stroll.map, x, z, 0), y = window.__st.put(x, z), d = window.__st.down(x, y, z);
        return { n, x, z, ok, y, hit: d };
      });
    });
    for (const p of r) check(`2 ${p.n} (${p.x}, ${p.z}): hợp lệ ${p.ok}, chân ${p.y.toFixed(3)}, mặt trúng ${p.hit ? p.hit.y.toFixed(3) + ' ' + p.hit.name + (p.hit.par ? '<' + p.hit.par : '') : '-'} (≤ 0,15)`,
      p.ok && !!p.hit && Math.abs(p.y - p.hit.y) <= 0.15);
  }

  // Mục 3 + 4 — 20 000 bước ngẫu nhiên, oracle bằng tam giác thật của lưới rắn
  {
    const r = await P.evaluate(() => {
      const a = window.__app, S = a.stroll, T = a.THREE, C = S.CONFIG_stroll, map = S.stroll.map, B = C.bounds, R = C.radius;
      const Ray = new T.Raycaster().ray.constructor;
      /* --- gom tam giác thế giới của các lưới rắn vào lưới ô 2 m --- */
      const CELL = 2, cells = new Map(), tri = [];
      const key = (ix, iz) => ix * 100003 + iz;
      const v = [new T.Vector3(), new T.Vector3(), new T.Vector3()], mw = new T.Matrix4(), mi = new T.Matrix4(), p = new T.Vector3(), q = new T.Quaternion(), sc = new T.Vector3();
      const boxes = [];   // hộp bao thế giới của từng nhà (cho mục 5)
      const counts = {};
      const addGeo = (geo, m, tag, box) => {
        const pos = geo.attributes.position, idx = geo.index, n = idx ? idx.count : pos.count;
        for (let i = 0; i + 2 < n; i += 3) {
          for (let k = 0; k < 3; k++) v[k].fromBufferAttribute(pos, idx ? idx.getX(i + k) : i + k).applyMatrix4(m);
          const x0 = Math.min(v[0].x, v[1].x, v[2].x), x1 = Math.max(v[0].x, v[1].x, v[2].x), z0 = Math.min(v[0].z, v[1].z, v[2].z), z1 = Math.max(v[0].z, v[1].z, v[2].z);
          if (box) { box.x0 = Math.min(box.x0, x0); box.x1 = Math.max(box.x1, x1); box.z0 = Math.min(box.z0, z0); box.z1 = Math.max(box.z1, z1); }
          if (x1 < B.x0 - 5 || x0 > B.x1 + 5 || z1 < B.z0 - 5 || z0 > B.z1 + 5) continue;
          const t = tri.length; tri.push([v[0].clone(), v[1].clone(), v[2].clone(), tag]);
          for (let ix = Math.floor(x0 / CELL); ix <= Math.floor(x1 / CELL); ix++) for (let iz = Math.floor(z0 / CELL); iz <= Math.floor(z1 / CELL); iz++) {
            const k = key(ix, iz); let l = cells.get(k); if (!l) { l = []; cells.set(k, l); } l.push(t);
          }
          counts[tag] = (counts[tag] || 0) + 1;
        }
      };
      const addObj = (root, tag) => {
        root.updateMatrixWorld(true);
        root.traverse((o) => {
          if (!o.isMesh) return;
          if (o.isInstancedMesh) { for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, mi); mi.decompose(p, q, sc); if (sc.x < 1e-6) continue; addGeo(o.geometry, mw.multiplyMatrices(o.matrixWorld, mi), tag); } }
          else addGeo(o.geometry, o.matrixWorld, tag);
        });
      };
      a.scene.updateMatrixWorld(true);
      /* nhà: InstancedMesh level gần của THREE.LOD (như collectBuildings) */
      a.scene.traverse((o) => {
        if (!o.isInstancedMesh || !o.parent || !o.parent.isLOD || o.parent.levels[0]?.object !== o) return;
        for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, mi); mi.decompose(p, q, sc); if (sc.x < 1e-6) continue;
          mw.multiplyMatrices(o.matrixWorld, mi); p.set(0, 0, 0).applyMatrix4(mw);
          if (p.x < B.x0 - 60 || p.x > B.x1 + 60 || p.z < B.z0 - 60 || p.z > B.z1 + 60) continue;
          const box = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity }; addGeo(o.geometry, mw, 'nhà', box); boxes.push(box);
        }
      });
      const named = {};
      for (const n of ['dragon-body', 'dragon-head', 'sh-tower', 'rf-landmarks']) { const o = a.scene.getObjectByName(n); named[n] = !!o; if (o) addObj(o, n); }
      /* --- 24 tia ngang dài R quanh (x, z) ở 3 cao độ trên mặt đứng --- */
      const ray = new Ray(), tgt = new T.Vector3(), seen = new Set();
      const DIRS = Array.from({ length: 8 }, (_, i) => [Math.cos(i * Math.PI / 4), Math.sin(i * Math.PI / 4)]);
      const gather = (x, z, L) => {
        seen.clear();
        for (let ix = Math.floor((x - L) / CELL); ix <= Math.floor((x + L) / CELL); ix++) for (let iz = Math.floor((z - L) / CELL); iz <= Math.floor((z + L) / CELL); iz++) {
          const l = cells.get(key(ix, iz)); if (l) for (const t of l) seen.add(t);
        }
      };
      const probe = (x, g, z) => {
        gather(x, z, R); const hits = [];
        if (!seen.size) return hits;
        for (const dh of [0.3, 1.0, 1.7]) for (const [dx, dz] of DIRS) {
          ray.origin.set(x, g + dh, z); ray.direction.set(dx, 0, dz);
          for (const t of seen) {
            const h = tri[t], hp = ray.intersectTriangle(h[0], h[1], h[2], false, tgt);
            if (hp && hp.distanceTo(ray.origin) <= R) { hits.push({ tag: h[3], dh, d: +hp.distanceTo(ray.origin).toFixed(4) }); break; }
          }
        }
        return hits;
      };
      /* một tia ngang dài len từ (x, y, z) theo (dx, dz): khoảng cách tới tam giác gần nhất, hoặc null */
      const castH = (x, y, z, dx, dz, len) => {
        gather(x, z, len); let best = null;
        ray.origin.set(x, y, z); ray.direction.set(dx, 0, dz);
        for (const t of seen) {
          const h = tri[t], hp = ray.intersectTriangle(h[0], h[1], h[2], false, tgt);
          if (hp) { const d = hp.distanceTo(ray.origin); if (d <= len && (best === null || d < best)) best = d; }
        }
        return best;
      };
      /* khoảng cách mặt bằng từ (x, z) tới hộp nhà (0 nếu ở trong); trong hộp (đã thu 1 cm) = nhân vật nằm trong khối nhà */
      const EPS = 0.01;
      const boxDist = (b, x, z) => Math.hypot(Math.max(b.x0 - x, 0, x - b.x1), Math.max(b.z0 - z, 0, z - b.z1));
      const inBox = (b, x, z) => x > b.x0 + EPS && x < b.x1 - EPS && z > b.z0 + EPS && z < b.z1 - EPS;
      window.__st.boxes = boxes;   // mục 5 dùng lại hộp theo hình học
      /* --- 10 điểm xuất phát, 2 000 bước mỗi điểm --- */
      let seed = 20261111;
      const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      const starts = [[-240, 17.4], [0, -10], [-300, 60], [-320, -500], [-320, -1150], [-150, -1074.5], [30, -1083], [320, -1150], [240, -78], [340, -660], [150, -1074.5]];
      const badStart = [], fails = [], out4 = [], inp = { mx: 0, mz: 0, run: false, jump: false, camYaw: 0 };
      const BRIDGE = new Set(['shSwing', 'songHanW', 'songHanE', 'dragon', 'love']);
      let samples = 0, steps = 0, minY = Infinity, zonesSeen = new Set();
      /* chứng minh oracle không rỗng: mỗi BƯỚC kiểm tâm nhân vật không nằm trong khối nhà, đo khoảng cách tới nhà gần nhất, đếm bước đứng im khi đang đẩy */
      const inside = [], frozen = [];
      let near = 0, touch = 0, minBoxD = Infinity, still = 0, px = 0, pz = 0, frozenN = 0;
      const s = S.stroll.state;
      /* điểm xuất phát sát nhà: các nhà đi tới được lấy cách đều trong danh sách, đặt cách mặt tường 1,5 m, 1 000 bước mỗi điểm (đi ngẫu nhiên quanh nhà) */
      const startsN = starts.map(([x, z]) => [x, z, 2000]);
      let nearStarts = 0;
      for (let bi = 0; bi < boxes.length && nearStarts < 16; bi++) {
        const b = boxes[bi], mx = (b.x0 + b.x1) / 2, mz = (b.z0 + b.z1) / 2;
        for (const [x, z] of [[b.x1 + 1.5, mz], [b.x0 - 1.5, mz], [mx, b.z1 + 1.5], [mx, b.z0 - 1.5]]) {
          if (S.stValid(map, x, z, 0)) { startsN.push([x, z, 1000]); nearStarts++; break; }
        }
      }
      let expectSteps = 0;
      for (const [sx, sz, n] of startsN) {
        if (!S.stValid(map, sx, sz, 0)) { badStart.push(`${sx},${sz}`); continue; }
        expectSteps += n;
        window.__st.put(sx, sz);
        let left = 0; still = 0; px = s.x; pz = s.z;
        for (let i = 0; i < n; i++) {
          inp.jump = false;
          if (left-- <= 0) {
            left = 10 + Math.floor(rnd() * 50);
            inp.mx = rnd() < 0.3 ? 0 : rnd() * 2 - 1; inp.mz = rnd() < 0.2 ? 0 : rnd() * 2 - 1; inp.run = rnd() < 0.5; inp.jump = rnd() < 0.4; inp.camYaw = rnd() * Math.PI * 2;
            still = 0;
          }
          const dt = rnd() < 0.05 ? 0.1 : 1 / 30;
          S.stroll.step(dt, inp); steps++;
          if (s.y < minY) minY = s.y;
          let dMin = Infinity;
          for (const b of boxes) {
            if (inBox(b, s.x, s.z)) { if (inside.length < 8) inside.push({ x: +s.x.toFixed(3), z: +s.z.toFixed(3), step: steps, box: [b.x0, b.x1, b.z0, b.z1].map((n) => +n.toFixed(2)) }); }
            const d = boxDist(b, s.x, s.z); if (d < dMin) dMin = d;
          }
          if (dMin < minBoxD) minBoxD = dMin;
          if (dMin <= 1.5) near++;
          if (dMin <= R + 0.05) touch++;
          /* đứng im ≥ 30 bước liền trong một đoạn đầu vào đang đẩy */
          if (Math.hypot(inp.mx, inp.mz) > 0.3 && Math.hypot(s.x - px, s.z - pz) < 1e-5) { if (++still === 30) { frozenN++; if (frozen.length < 6) frozen.push({ x: +s.x.toFixed(2), z: +s.z.toFixed(2), boxD: +dMin.toFixed(2) }); } } else still = 0;
          px = s.x; pz = s.z;
          if (i % 20 === 19) {
            samples++;
            const g = S.stGroundY(map, s.x, s.z), zn = window.__st.zoneAt(s.x, s.z);
            if (zn) zonesSeen.add(zn.id);
            const hits = probe(s.x, g === g ? g : s.y, s.z);
            if (hits.length && fails.length < 12) fails.push({ x: +s.x.toFixed(3), z: +s.z.toFixed(3), g: +(g === g ? g : s.y).toFixed(3), air: s.air, hits: hits.slice(0, 3) });
            else if (hits.length) fails.push(null);
            if (!(Math.abs(s.x) >= 262 - R || (zn && BRIDGE.has(zn.id))) && out4.length < 12) out4.push({ x: +s.x.toFixed(3), z: +s.z.toFixed(3), zone: zn ? zn.id : null });
          }
        }
      }
      /* --- đẩy thẳng vào tường nhà đã biết: dừng cách tường ≈ bán kính, tia 1,0 m về phía tường phải thấy tường --- */
      const wall = { tried: 0, ok: false };
      for (const b of boxes) {
        if (wall.tried >= 60) break;
        const mz = (b.z0 + b.z1) / 2;
        if (b.z1 - b.z0 < 6) continue;
        for (const [sx0, face, dir] of [[b.x1 + 3, b.x1, -1], [b.x0 - 3, b.x0, 1]]) {
          if (wall.ok) break;
          let okLine = true;
          for (let k = 0; k <= 5; k++) if (!S.stValid(map, sx0 + dir * k * 0.5, mz, 0)) okLine = false;   // đoạn đi thẳng vào tường (tới cách tường 0,5 m) hợp lệ
          if (!okLine) continue;
          wall.tried++;
          window.__st.put(sx0, mz);
          const w = { mx: 0, mz: 1, run: false, jump: false, camYaw: dir > 0 ? 0 : Math.PI };   // mz = 1: camYaw 0 → +X, π → −X; đi bộ
          for (let i = 0; i < 90; i++) S.stroll.step(1 / 30, w);   // 3 s tới sát tường
          for (let i = 0; i < 120; i++) S.stroll.step(1 / 240, w);   // bước nhỏ ≈ 0,01 m: dừng tại tường, không còn hụt cả một bước
          const gap = dir > 0 ? face - s.x : s.x - face, g = S.stGroundY(map, s.x, s.z);
          if (!(gap >= 0 && gap < 1.5) || Math.abs(s.z - mz) > 1) continue;   // bị chặn bởi thứ khác trước khi tới tường: thử nhà khác
          const d = castH(s.x, g + 1.0, s.z, dir, 0, 1.0);
          wall.ok = true; wall.gap = +gap.toFixed(3); wall.hit = d === null ? null : +d.toFixed(3); wall.box = [b.x0, b.x1, b.z0, b.z1].map((n) => +n.toFixed(2)); wall.dir = dir;
          wall.inBox = inBox(b, s.x, s.z);
        }
        if (wall.ok) break;
      }
      return { tris: tri.length, counts, named, buildings: boxes.length, badStart, nFail: fails.length, fails: fails.filter(Boolean), samples, steps, out4, minY, landY: 2.5, zones: [...zonesSeen].sort(),
        inside, near, touch, minBoxD, frozenN, frozen, wall, R, expectSteps, nearStarts };
    });
    console.log(`   oracle: ${r.tris} tam giác (${JSON.stringify(r.counts)}), ${r.buildings} nhà; vùng đã đi qua: ${r.zones.join(',')}`);
    console.log(`   oracle: ${r.near} bước cách nhà ≤ 1,5 m, ${r.touch} bước sát tường (≤ R + 0,05), khoảng cách nhà gần nhất ${r.minBoxD.toFixed(3)} m; ${r.frozenN} đoạn đứng im ≥ 30 bước khi đang đẩy ${r.frozenN ? JSON.stringify(r.frozen) : ''}`);
    check(`3 có đủ lưới oracle ${JSON.stringify(r.named)}`, Object.values(r.named).every(Boolean) && r.buildings > 50);
    check(`3 điểm xuất phát hợp lệ, gồm ${r.nearStarts} điểm sát nhà (lỗi: ${r.badStart.join(' ') || '-'})`, r.badStart.length === 0 && r.nearStarts >= 10);
    check(`3 vùng đã đi qua gồm songHanE, shSwing, songHanW, dragon, love, bankE, bankW: ${r.zones.join(',')}`, ['songHanE', 'shSwing', 'songHanW', 'dragon', 'love', 'bankE', 'bankW'].every((z) => r.zones.includes(z)));
    check(`3 mọi bước (${r.steps}): tâm nhân vật không nằm trong khối nhà (lọt: ${r.inside.length ? JSON.stringify(r.inside) : '-'})`, r.inside.length === 0);
    check(`3 không rỗng: ${r.near} bước cách nhà ≤ 1,5 m (> 0)`, r.near > 0);
    check(`3 chạm tường thật: đẩy thẳng vào nhà ${r.wall.ok ? `(hộp ${JSON.stringify(r.wall.box)}, hướng ${r.wall.dir > 0 ? '+X' : '−X'}, thử ${r.wall.tried})` : `không tìm được nhà (thử ${r.wall.tried})`}: cách tường ${r.wall.gap} m, tia 1,0 m trúng ở ${r.wall.hit} m (≤ R ${r.R} + 0,05), tâm không trong nhà ${!r.wall.inBox}`,
      r.wall.ok && r.wall.hit !== null && r.wall.hit <= r.R + 0.05 && r.wall.gap <= r.R + 0.05 && !r.wall.inBox);
    check(`3 ${r.steps} bước, ${r.samples} mẫu × 24 tia vào lưới rắn: ${r.nFail} mẫu trúng (= 0) ${r.nFail ? JSON.stringify(r.fails) : ''}`, r.nFail === 0 && r.steps === r.expectSteps);
    check(`4 mọi mẫu có |x| ≥ 261,65 hoặc trên cầu / Cầu Tình Yêu (lọt: ${r.out4.length ? JSON.stringify(r.out4) : '-'})`, r.out4.length === 0);
    check(`4 y thấp nhất ${r.minY.toFixed(3)} ≥ landY − 0,01`, r.minY >= 2.5 - 0.01);
  }

  // Mục 5 — camera sát tường nhà
  {
    const r = await P.evaluate(() => {
      const a = window.__app, S = a.stroll, T = a.THREE, C = S.CONFIG_stroll, map = S.stroll.map, B = C.bounds, R = C.radius;
      const mi = new T.Matrix4(), mw = new T.Matrix4(), p = new T.Vector3(), q = new T.Quaternion(), sc = new T.Vector3();
      const boxes = window.__st.boxes;   // hộp bao theo hình học thật, dựng ở mục 3
      const inside = (x, z) => boxes.some((b) => x > b.x0 + 1e-6 && x < b.x1 - 1e-6 && z > b.z0 + 1e-6 && z < b.z1 - 1e-6);
      const cases = [];
      const P5 = [C.cam.pitchMin, C.cam.pitch, C.cam.pitchMax];
      for (const b of boxes) {
        if (cases.length >= 30) break;
        const mx = (b.x0 + b.x1) / 2, mz = (b.z0 + b.z1) / 2, e = R + 0.02;
        for (const [px, pz, nx, nz] of [[b.x1 + e, mz, 1, 0], [b.x0 - e, mz, -1, 0], [mx, b.z1 + e, 0, 1], [mx, b.z0 - e, 0, -1], [b.x1 + e, b.z0 + 2, 1, 0], [b.x0 - e, b.z1 - 2, -1, 0]]) {
          if (!S.stValid(map, px, pz, 0)) continue;
          cases.push([px, pz, Math.atan2(-nz, nx)]); break;   // mặt hướng ra ngoài tường: camera sau lưng nằm phía trong nhà nếu không tránh
        }
      }
      const bad = [], tgt = new T.Vector3(), cs = { yaw: 0, pitch: 0 };
      let minD = Infinity;
      cases.forEach(([x, z, yaw], i) => {
        const y = window.__st.put(x, z); S.stroll.state.yaw = yaw;
        cs.yaw = yaw; cs.pitch = P5[i % 3];
        S.stCamPlace(a.camera, tgt, S.stroll.state, cs, map, 0, true);
        const c = a.camera.position, d = Math.hypot(c.x - x, c.y - (y + C.cam.height), c.z - z);
        if (d < minD) minD = d;
        if (inside(c.x, c.z) || c.y < 2.5 || d < C.cam.minDist - 1e-6) bad.push({ x: +x.toFixed(2), z: +z.toFixed(2), cam: [+c.x.toFixed(2), +c.y.toFixed(2), +c.z.toFixed(2)], d: +d.toFixed(2) });
      });
      S.stCamPlace(a.camera, a.controls.target, S.stroll.state, S.stroll.cam, map, 0, true);
      return { n: cases.length, bad, minD };
    });
    check(`5 ${r.n} vị trí sát tường nhà: camera ngoài chân đế nhà, y ≥ 2,5, cách đầu ≥ minDist (nhỏ nhất ${r.minD.toFixed(2)} m) (lỗi: ${r.bad.length ? JSON.stringify(r.bad.slice(0, 5)) : '-'})`, r.n === 30 && r.bad.length === 0);
  }

  // Mục 8 — draw call của người đi dạo
  {
    const r = await P.evaluate(() => {
      const a = window.__app, S = a.stroll, { renderer, scene, camera } = a, mesh = S.avatars.mesh;
      window.__st.put(-240, 17.4); S.stroll.state.yaw = 0; S.stroll.cam.yaw = 0; S.stroll.cam.pitch = S.CONFIG_stroll.cam.pitch;
      S.stroll.step(1 / 60, { mx: 0, mz: 0, run: false, jump: false, camYaw: 0 });
      S.stCamPlace(camera, a.controls.target, S.stroll.state, S.stroll.cam, S.stroll.map, 0, true);
      const calls = () => { renderer.render(scene, camera); renderer.info.reset(); renderer.render(scene, camera); return renderer.info.render.calls; };
      const on = calls(); mesh.visible = false; const off = calls(); mesh.visible = true;
      return { on, off, layer: mesh.layers.mask, cast: mesh.castShadow };
    });
    check(`8 đi dạo: ${r.on} lệnh vẽ, ẩn người đi dạo ${r.off}: chênh ${r.on - r.off} (= 1); lớp ${r.layer}, bóng ${r.cast}`, r.on - r.off === 1 && r.layer === 2 && r.cast === false);
  }

  // Mục 7 — cầu quay
  {
    const SHX = await P.evaluate(() => {
      window.__st.put(5, -1077);
      window.__frames = 0; const tick = () => { window.__frames++; window.__ftick = requestAnimationFrame(tick); }; tick();
      window.__app.songHan.ctrl.start(60);
      return window.__app.songHan.ctrl.cfg.fixedStart;
    });
    const r1 = await P.evaluate((X) => new Promise((ok) => {
      const a = window.__app, s = a.stroll.stroll.state, f0 = window.__frames;
      const w = () => {
        const f = window.__frames - f0;
        if (Math.abs(s.x) >= X && !s.evac) return ok({ f, x: s.x, z: s.z, state: a.songHan.ctrl.state, mode: a.cam.mode });
        if (f > 600) return ok({ f, x: s.x, z: s.z, state: a.songHan.ctrl.state, mode: a.cam.mode, timeout: true });
        requestAnimationFrame(w);
      };
      w();
    }), SHX);
    check(`7 cầu quay: sau ${r1.f} khung nhân vật ở x = ${r1.x.toFixed(2)} (|x| ≥ ${SHX}), trạng thái ${r1.state} ≠ CLOSED, camera vẫn ${r1.mode}`, !r1.timeout && Math.abs(r1.x) >= SHX && r1.state !== 'CLOSED' && r1.mode === 'stroll');
    const walkIn = () => P.evaluate((X) => {
      const S = window.__app.stroll, s = S.stroll.state; let minAx = Infinity;
      const inp = { mx: 0, mz: 1, run: false, jump: false, camYaw: s.x > 0 ? Math.PI : 0 };   // đi thẳng về tim cầu
      for (let i = 0; i < 500; i++) { S.stroll.step(1 / 30, inp); minAx = Math.min(minAx, Math.abs(s.x)); }
      return { minAx, state: window.__app.songHan.ctrl.state };
    }, SHX);
    const r2 = await walkIn();
    check(`7 khi chưa đóng (${r2.state}): 500 bước về tim cầu, |x| nhỏ nhất ${r2.minAx.toFixed(3)} ≥ ${SHX}`, r2.state !== 'CLOSED' && r2.minAx >= SHX);
    await P.evaluate(() => { const c = window.__app.songHan.ctrl; c.speed = 3000; window.__keepClosing = setInterval(() => c.requestClose(), 100); });
    await P.waitForFunction(() => window.__app.songHan.ctrl.state === 'CLOSED', null, { timeout: 240000 });
    await P.evaluate(() => clearInterval(window.__keepClosing));
    await frames(P, 2);
    const r3 = await walkIn();
    await P.evaluate(() => cancelAnimationFrame(window.__ftick));
    check(`7 cầu đóng lại: vào lại được nhịp quay (|x| nhỏ nhất ${r3.minAx.toFixed(2)})`, r3.state === 'CLOSED' && r3.minAx < SHX - 5);
  }

  // Mục 6 — phím
  {
    await P.evaluate(() => { const S = window.__app.stroll; window.__st.put(-240, 17.4); S.stroll.state.yaw = 0; S.stroll.cam.yaw = Math.PI; window.__app.keys.clear(); });
    await P.focus('canvas');
    const p0 = await P.evaluate(() => { const s = window.__app.stroll.stroll.state; return { x: s.x, z: s.z }; });
    await P.keyboard.down('w');
    await frames(P, 60);
    const p1 = await P.evaluate(() => { const s = window.__app.stroll.stroll.state; return { x: s.x, z: s.z, speed: s.speed }; });
    const dx = p1.x - p0.x, dz = p1.z - p0.z, d = Math.hypot(dx, dz);
    check(`6 giữ W 60 khung, camera nhìn về −X: dịch (${dx.toFixed(2)}, ${dz.toFixed(2)}) theo hướng camera`, d > 1 && -dx / d > 0.99);
    await P.evaluate(() => window.dispatchEvent(new Event('blur')));
    await frames(P, 60);
    const p2 = await P.evaluate(() => { const s = window.__app.stroll.stroll.state; return { speed: s.speed, keys: window.__app.keys.size, x: s.x }; });
    await frames(P, 5);
    const x3 = await P.evaluate(() => window.__app.stroll.stroll.state.x);
    check(`6 blur khi đang giữ W: keys ${p2.keys} (= 0), sau 60 khung tốc độ ${p2.speed} (= 0), đứng yên (${(x3 - p2.x).toExponential(1)})`, p2.keys === 0 && p2.speed === 0 && x3 === p2.x);
    await P.keyboard.up('w');
    // gõ trong ô nhập: không điều khiển nhân vật (Review Focus 3)
    await P.evaluate(() => { const i = document.createElement('input'); i.id = '__stTestInput'; i.style.cssText = 'position:fixed;left:0;top:0;z-index:99'; document.body.appendChild(i); });
    await P.focus('#__stTestInput');
    const q0 = await P.evaluate(() => window.__app.stroll.stroll.state.x);
    await P.keyboard.type('wwwd wasd');
    await frames(P, 20);
    const q1 = await P.evaluate(() => ({ x: window.__app.stroll.stroll.state.x, keys: window.__app.keys.size, v: document.getElementById('__stTestInput').value, air: window.__app.stroll.stroll.state.air }));
    check(`6 gõ "${q1.v}" trong ô nhập: nhân vật đứng yên (${(q1.x - q0).toExponential(1)}), keys ${q1.keys}`, q1.v === 'wwwd wasd' && q1.x === q0 && q1.keys === 0 && !q1.air);
    await P.evaluate(() => document.getElementById('__stTestInput').remove());
    await P.focus('canvas');
    // giữ Space: nhảy đúng một lần
    await P.evaluate(() => { window.__jumps = 0; let prev = false; const s = window.__app.stroll.stroll.state; const w = () => { if (s.air && !prev) window.__jumps++; prev = s.air; window.__jw = requestAnimationFrame(w); }; w(); });
    await P.keyboard.down(' ');
    await frames(P, 80);
    await P.keyboard.up(' ');
    await frames(P, 30);
    const jumps = await P.evaluate(() => { cancelAnimationFrame(window.__jw); return window.__jumps; });
    check(`6 giữ Space 80 khung: nhảy ${jumps} lần (= 1)`, jumps === 1);
    // chọn ô cài đặt bằng chuột rồi giữ W: ô chọn bỏ focus, nhân vật đi (không đổi chất lượng / ngôn ngữ bằng phím)
    for (const id of ['qualitySel', 'langSelect']) {
      await P.evaluate(() => { const S = window.__app.stroll; window.__st.put(-240, 17.4); S.stroll.state.yaw = 0; S.stroll.cam.yaw = Math.PI; window.__app.keys.clear(); });
      const pre = await P.evaluate((i) => { window.__app.ui.openSheet('settings'); const s = document.getElementById(i); s.focus(); const had = document.activeElement === s; const v0 = s.value; s.dispatchEvent(new Event('pointerdown')); s.dispatchEvent(new Event('change')); return { had, v0, off: document.activeElement !== s }; }, id);
      const m0 = await P.evaluate(() => window.__app.stroll.stroll.state.x);
      await P.keyboard.down('w'); await frames(P, 60); await P.keyboard.up('w');
      const m1 = await P.evaluate((i) => ({ x: window.__app.stroll.stroll.state.x, v: document.getElementById(i).value }), id);
      await P.evaluate(() => window.__app.ui.closeSheets());
      check(`6 chọn #${id} bằng chuột trong đi dạo: có focus trước (${pre.had}), sau đó bỏ focus (${pre.off}), giữ W đi ${(m0 - m1.x).toFixed(2)} m về −X, giá trị "${m1.v}" = "${pre.v0}"`, pre.had && pre.off && m0 - m1.x > 1 && m1.v === pre.v0);
    }
    // bố cục không Latin: phím vật lý W (e.code KeyW) đi tới dù e.key là "ц"
    await P.evaluate(() => { const S = window.__app.stroll; window.__st.put(-240, 17.4); S.stroll.state.yaw = 0; S.stroll.cam.yaw = Math.PI; window.__app.keys.clear(); document.activeElement && document.activeElement.blur(); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ц', code: 'KeyW', bubbles: true })); });
    const c0 = await P.evaluate(() => window.__app.stroll.stroll.state.x);
    await frames(P, 60);
    await P.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ц', code: 'KeyW', bubbles: true })));
    await frames(P, 3);
    const c1 = await P.evaluate(() => ({ x: window.__app.stroll.stroll.state.x, keys: window.__app.keys.size }));
    check(`6 phím key="ц" code=KeyW: đi ${(c0 - c1.x).toFixed(2)} m về −X (> 1), nhả phím thì keys ${c1.keys} (= 0)`, c0 - c1.x > 1 && c1.keys === 0);
    // dòng hướng dẫn phím (máy tính, có chuột): #stHint hiện đúng chữ, #exHint của dù lượn vẫn ẩn
    const hint = await P.evaluate(() => ({ st: document.getElementById('stHint').innerText, stShown: document.getElementById('stHint').getClientRects().length > 0, ex: document.getElementById('exHint').getClientRects().length > 0 }));
    check(`6 #stHint hiện "${hint.st}" (stHint vi), #exHint ẩn (${hint.ex})`, hint.stShown && hint.st === JSON.parse(readFileSync(new URL('../src/i18n/locales/vi.json', import.meta.url), 'utf8')).stHint && !hint.ex);
    // Esc thoát
    await P.evaluate(() => { window.__reloadMark = 1; });
    await P.keyboard.press('Escape');
    await P.waitForFunction(() => !window.__reloadMark, null, { timeout: 240000 });
    await P.waitForURL((u) => !u.href.includes('explore='), { timeout: 240000, waitUntil: 'commit' });
    check('6 Esc thoát: tải lại thật, URL không còn explore=', !P.url().includes('explore='));
  }
  check('console sạch (trang đi dạo)', A.errors.length === 0);
  if (A.errors.length) console.log(A.errors.join('\n'));
  await P.close();

  // Mục 8b — trang ?test không explore: không có người đi dạo trong cảnh
  {
    const N = await openApp(browser, srv.url);
    await frames(N.page, 3);
    const r = await N.page.evaluate(() => ({ obj: !!window.__app.scene.getObjectByName('stroll-people'), mode: window.__app.cam.mode, st: document.body.classList.contains('stroll'), act: window.__app.stroll?.stroll.active() }));
    check(`8 ?test không explore: không có stroll-people (${r.obj}), mode ${r.mode}, body.stroll ${r.st}, active ${r.act}`, !r.obj && r.mode === 'orbit' && !r.st && r.act === false);
    const pdb = await N.page.evaluate(() => window.__app.renderer.getContextAttributes().preserveDrawingBuffer);
    check(`11 góc nhìn cũ: preserveDrawingBuffer ${pdb} (= false)`, pdb === false);
    check('console sạch (trang ?test)', N.errors.length === 0);
    await N.page.close();
  }

  // Mục 11 (Task 9) — chụp ảnh: PNG đúng là khung WebGL vừa vẽ (Review Focus 5); Playwright bắt sự kiện download
  {
    const C = await openApp(browser, srv.url + '?explore=stroll');
    const Q = C.page, got = [];
    Q.on('download', (d) => got.push(d));
    await frames(Q, 3);
    const NAME = /^danang-\d{8}-\d{6}\.png$/;
    /* mở file trong trang: kích thước, số màu khác nhau trong 400 điểm mẫu, có phải toàn đen không */
    const analyse = async (d) => {
      const buf = readFileSync(await d.path());
      const r = await Q.evaluate(async (b64) => {
        const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
        const bmp = await createImageBitmap(new Blob([u], { type: 'image/png' }));
        const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
        const g = c.getContext('2d'); g.drawImage(bmp, 0, 0);
        const cols = new Set(); let lit = 0;
        for (let iy = 0; iy < 20; iy++) for (let ix = 0; ix < 20; ix++) {
          const px = g.getImageData(Math.min(bmp.width - 1, Math.floor((ix + 0.5) * bmp.width / 20)), Math.min(bmp.height - 1, Math.floor((iy + 0.5) * bmp.height / 20)), 1, 1).data;
          cols.add(px[0] + ',' + px[1] + ',' + px[2]); if (px[0] + px[1] + px[2] > 12) lit++;
        }
        return { w: bmp.width, h: bmp.height, colors: cols.size, lit };
      }, buf.toString('base64'));
      return { name: d.suggestedFilename(), ...r };
    };
    const waitCount = async (n) => { const t0 = Date.now(); while (got.length < n && Date.now() - t0 < 240000) await Q.waitForTimeout(200); };
    const valid = (a) => NAME.test(a.name) && a.colors >= 20 && a.lit > 0;
    const cv = () => Q.evaluate(() => { const c = document.querySelector('canvas'); return { w: c.width, h: c.height }; });
    // bấm #stPhoto: đúng 1 file
    await Q.click('#stPhoto');
    await waitCount(1);
    const toast = await Q.evaluate(() => { const e = document.getElementById('stToast'); return { hidden: e.hidden, text: e.textContent, shown: e.getClientRects().length > 0 }; });   // ô riêng #stToast; đọc ngay: thông báo tự ẩn sau noticeMs (8 s), SwiftShader chậm
    await frames(Q, 4);
    const a1 = await analyse(got[0]), c1 = await cv();
    check(`11 bấm #stPhoto: ${got.length} file (= 1) "${a1.name}", ${a1.w}×${a1.h} = canvas ${c1.w}×${c1.h}, ${a1.colors} màu / 400 điểm, sáng ${a1.lit}`, got.length === 1 && valid(a1) && a1.w === c1.w && a1.h === c1.h);
    const last = await Q.evaluate(() => window.__app.stroll.stroll.photoLast);
    check(`11 thông báo "${toast.text}" (stPhotoSaved) ở #stToast, đang hiện`, !toast.hidden && toast.shown && toast.text === 'Đã lưu ảnh');
    // thông báo nhiều người đang hiện ở #exMpNotice: chụp ảnh không được đè lên
    await Q.evaluate(() => { const n = document.getElementById('exMpNotice'); n.textContent = 'MP-NOTICE-GIU-NGUYEN'; n.hidden = false; });
    const nA = got.length;
    await Q.evaluate(() => document.getElementById('stPhoto').click());
    await waitCount(nA + 1);
    const both = await Q.evaluate(() => ({ mp: document.getElementById('exMpNotice').textContent, mpHidden: document.getElementById('exMpNotice').hidden, st: document.getElementById('stToast').textContent, stHidden: document.getElementById('stToast').hidden }));
    check(`11 chụp khi #exMpNotice đang có chữ: giữ "${both.mp}", #stToast "${both.st}" (stPhotoSaved)`, both.mp === 'MP-NOTICE-GIU-NGUYEN' && !both.mpHidden && !both.stHidden && both.st === 'Đã lưu ảnh');
    await Q.evaluate(() => { const n = document.getElementById('exMpNotice'); n.textContent = ''; n.hidden = true; });
    await frames(Q, 4);
    got.splice(nA);   // file thêm này chỉ để kiểm thông báo; các mục sau đếm lại từ đây
    check(`11 photoLast ${JSON.stringify(last)} khớp file`, !!last && last.name === a1.name && last.w === a1.w && last.h === a1.h && last.size > 1000);
    // phím p: thêm đúng 1 file; pose 4 khi đứng yên rồi về 0
    await Q.evaluate(() => document.activeElement && document.activeElement.blur());
    await Q.keyboard.press('p');
    const pose = await Q.evaluate(() => {
      const S = window.__app.stroll.stroll, idle = { mx: 0, mz: 0, run: false, jump: false, camYaw: 0 }, hold = window.__app.stroll.CONFIG_stroll.photoHold;
      S.step(0.016, idle); const p0 = S.state.pose;
      let t = 0, p1 = p0; while (t < hold - 0.1) { S.step(0.05, idle); t += 0.05; p1 = S.state.pose; }
      for (let i = 0; i < 6; i++) S.step(0.05, idle);
      return { p0, p1, end: S.state.pose };
    });
    check(`11 phím p: pose ${pose.p0} → ${pose.p1} trong photoHold (= 4) → ${pose.end} (= 0)`, pose.p0 === 4 && pose.p1 === 4 && pose.end === 0);
    await waitCount(2); await frames(Q, 4);
    check(`11 phím p: thêm đúng 1 file (tổng ${got.length} = 2), tên hợp lệ`, got.length === 2 && NAME.test(got[1].suggestedFilename()));
    // 5 lần bấm trong một khung
    const n0 = got.length;
    await Q.evaluate(() => { const b = document.getElementById('stPhoto'); for (let i = 0; i < 5; i++) b.click(); });
    await waitCount(n0 + 1); await frames(Q, 6);
    const many = got.slice(n0), am = [];
    for (const d of many) am.push(await analyse(d));
    check(`11 bấm 5 lần trong một khung: ${many.length} file (1..5), mỗi file hợp lệ (${am.map((a) => a.colors).join(',')} màu)`, many.length >= 1 && many.length <= 5 && am.every(valid));
    // đổi kích thước rồi bấm ngay: kích thước file = canvas lúc chụp
    const n1 = got.length;
    await Q.setViewportSize({ width: 560, height: 315 });
    await Q.evaluate(() => document.getElementById('stPhoto').click());
    await waitCount(n1 + 1); await frames(Q, 6);
    const ar = await analyse(got[n1]), lr = await Q.evaluate(() => window.__app.stroll.stroll.photoLast);
    check(`11 đổi cỡ cửa sổ rồi bấm ngay: file ${ar.w}×${ar.h} = canvas lúc chụp ${lr.w}×${lr.h}, ${got.length - n1} file (= 1)`, got.length === n1 + 1 && valid(ar) && ar.w === lr.w && ar.h === lr.h);
    // bậc chất lượng thấp nhất
    const n2 = got.length;
    await Q.evaluate(() => { const s = document.getElementById('qualitySel'); s.value = 'low'; s.dispatchEvent(new Event('change', { bubbles: true })); });
    await frames(Q, 4);
    await Q.evaluate(() => document.getElementById('stPhoto').click());
    await waitCount(n2 + 1); await frames(Q, 4);
    const aq = await analyse(got[n2]);
    check(`11 chất lượng thấp: ${got.length - n2} file (= 1), ${aq.w}×${aq.h}, ${aq.colors} màu, hợp lệ`, got.length === n2 + 1 && valid(aq));
    check('console sạch (chụp ảnh)', C.errors.length === 0);
    if (C.errors.length) console.log(C.errors.join('\n'));
    await Q.close();
  }

  // Mục 9 (Task 7) — sảnh đi dạo đổi ngôn ngữ; máy chủ giả bằng routeWebSocket (không cần wrangler): gửi lobby có walkers, rồi bản máy chủ cũ (không walkers)
  {
    const L = await browser.newPage({ viewport: { width: 480, height: 270 } });
    const errs = []; L.on('pageerror', (e) => errs.push(String(e)));
    L.on('console', (m) => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)|ERR_FAILED|net::/.test(m.text())) errs.push(m.text()); });
    await L.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    let oldServer = false, opened = 0;
    await L.routeWebSocket(/127\.0\.0\.1:1\/sky/, (ws) => { opened++; ws.send(JSON.stringify(oldServer ? { t: 'lobby', flyers: [{ slot: 0, name: 'Bay' }] } : { t: 'lobby', flyers: [{ slot: 0, name: 'Bay' }], walkers: [] })); });
    await L.addInitScript(() => { try { sessionStorage.setItem('exMpNotice', 'lostWalk'); } catch { /* bỏ qua */ } });   // như vừa mất kết nối khi xem người đi dạo
    await L.goto(srv.url + '?test&chooser&multi=' + encodeURIComponent('ws://127.0.0.1:1/sky'), { waitUntil: 'load', timeout: 180000 });
    await L.waitForFunction(() => window.__app && document.getElementById('loading')?.classList.contains('done'), null, { timeout: 180000 });
    await L.waitForSelector('#chooser', { state: 'visible', timeout: 240000 });
    const loc = (c) => JSON.parse(readFileSync(new URL(`../src/i18n/locales/${c}.json`, import.meta.url), 'utf8'));
    {
      const note = () => L.evaluate(() => { const n = document.getElementById('exMpLostNote'); return { txt: n.innerText, shown: n.getClientRects().length > 0, flag: sessionStorage.getItem('exMpNotice') }; });
      const n0 = await note();
      check(`9 mất kết nối khi xem người đi dạo: màn chọn hiện "${n0.txt}" (stLostChooser vi, nhắc Đi dạo), cờ đã xóa (${n0.flag})`, n0.shown && n0.txt === loc('vi').stLostChooser && /Đi dạo/.test(n0.txt) && n0.flag === null);
      await L.selectOption('#exLang', 'en');
      const n1 = await note();
      check(`9 đổi sang en: "${n1.txt}" (stLostChooser en)`, n1.txt === loc('en').stLostChooser);
      await L.selectOption('#exLang', 'vi');
    }
    const lobbyTxt = () => L.evaluate(() => ({ sky: document.getElementById('exMpSky').innerText, seats: document.getElementById('exMpSeats').innerText, go: document.getElementById('exMpFly').innerText, solo: document.getElementById('exMpSolo').innerText, dir: document.documentElement.dir, list: document.getElementById('exMpList').children.length, kind: window.__app.multi.session && window.__app.multi.session.kind }));
    await L.click('#chooser [data-pick="walk"]');
    await L.waitForFunction(() => /Còn 5 trên 5 chỗ đi dạo/.test(document.getElementById('exMpSeats')?.innerText || ''), null, { timeout: 30000 }).catch(() => {});
    const v0 = await lobbyTxt(), V = loc('vi');
    check(`9 bấm thẻ Đi dạo: sảnh "${v0.sky}", "${v0.seats}", nút "${v0.go}", không liệt kê người bay (${v0.list}), phiên ${v0.kind}`, v0.kind === 'walk' && v0.seats === 'Còn 5 trên 5 chỗ đi dạo' && v0.sky === V.stSky && v0.go === V.stGo && v0.solo === V.stSolo && v0.list === 0);
    for (const c of ['ar', 'en']) {
      await L.selectOption('#exLang', c);
      const r = await lobbyTxt(), T = loc(c);
      check(`9 đổi sang ${c}: "${r.seats}", nút "${r.go}", tiêu đề "${r.sky}", dir ${r.dir}`, r.seats === T.stSeats.replace('{n}', '5') && r.go === T.stGo && r.sky === T.stSky && r.dir === (c === 'ar' ? 'rtl' : 'ltr'));
    }
    await L.selectOption('#exLang', 'vi');
    // Quay lại rồi chọn Dù lượn: chữ sảnh trở về của dù lượn
    await L.click('#exMpBack');
    await L.click('#chooser [data-pick="glider"]');
    await L.waitForFunction(() => /Còn 4 trên 5 chỗ$/.test(document.getElementById('exMpSeats')?.innerText || ''), null, { timeout: 30000 }).catch(() => {});
    const g = await lobbyTxt();
    check(`9 Quay lại rồi chọn Dù lượn: "${g.sky}", "${g.seats}", nút "${g.go}"`, g.kind === 'fly' && g.sky === V.exMpSky && g.go === V.exMpFly && g.seats === V.exMpSeats.replace('{n}', '4'));
    // Máy chủ cũ (lobby không có walkers): đi dạo coi là ngoại tuyến, đóng kết nối, nút Đi một mình
    await L.click('#exMpBack');
    oldServer = true;
    await L.click('#chooser [data-pick="walk"]');
    await L.waitForFunction(() => !document.getElementById('exMpOffline').hidden, null, { timeout: 30000 }).catch(() => {});
    const o = await L.evaluate(() => ({ off: document.getElementById('exMpOffline').innerText, solo: document.getElementById('exMpSolo').innerText, phase: window.__app.multi.session && window.__app.multi.session.phase }));
    check(`9 máy chủ cũ: "${o.off}", nút "${o.solo}", phase ${o.phase}, ${opened} kết nối giả`, o.off === V.stOffline && o.solo === V.stSolo && o.phase === 'solo' && opened === 3);
    await L.click('#exMpSolo');
    await L.waitForFunction(() => window.__app.stroll.stroll.active(), null, { timeout: 60000 }).catch(() => {});
    const so = await L.evaluate(() => ({ act: window.__app.stroll.stroll.active(), hidden: document.getElementById('chooser').hidden, session: window.__app.multi.session }));
    check('9 bấm Đi một mình: đi dạo một mình, hộp đóng, không còn phiên', so.act && so.hidden && so.session === null);
    check('console sạch (sảnh đi dạo)', errs.length === 0);
    if (errs.length) console.log(errs.join('\n'));
    await L.close();
  }

  // Mục 10 (Task 7) — cả 9 file locale có đủ mọi khóa st* và exWalkDesc (không rỗng)
  {
    const codes = ['vi', 'en', 'ko', 'ja', 'zh', 'th', 'ar', 'hi', 'ru'];
    const all = Object.fromEntries(codes.map((c) => [c, JSON.parse(readFileSync(new URL(`../src/i18n/locales/${c}.json`, import.meta.url), 'utf8'))]));
    const need = ['stSky', 'stSeats', 'stFull', 'stGo', 'stSolo', 'stOffline', 'stRoster', 'stWatch', 'stInvite', 'stInviteGo', 'stLate', 'stReleased', 'stLost', 'stJump', 'stPhoto', 'stPhotoSaved', 'stPhotoFail'];
    const keys = [...new Set([...need, ...codes.flatMap((c) => Object.keys(all[c]).filter((k) => /^st[A-Z]/.test(k))), 'exWalk', 'exWalkDesc'])];
    const miss = [];
    for (const c of codes) for (const k of keys) if (typeof all[c][k] !== 'string' || !all[c][k].trim()) miss.push(`${c}.${k}`);
    const params = codes.filter((c) => !all[c].stSeats.includes('{n}') || !all[c].stRoster.includes('{w}') || !all[c].stRoster.includes('{f}') || !all[c].stWatch.includes('{name}'));
    check(`10 9 locale có đủ ${keys.length} khóa st* + exWalk/exWalkDesc (thiếu: ${miss.join(',') || '-'}), tham số đủ (lỗi: ${params.join(',') || '-'}), exWalk vi "${all.vi.exWalk}"`, miss.length === 0 && params.length === 0 && all.vi.exWalk === 'Đi dạo' && all.ar._dir === 'rtl');
  }
} catch (e) {
  problems.push('ngoại lệ: ' + e); console.log(e);
} finally {
  await browser.close(); srv.close();
}
console.log(problems.length ? `stroll-check: LỖI (${problems.length}): ${problems.join('; ')}` : 'stroll-check: đạt');
process.exit(problems.length ? 1 : 0);
