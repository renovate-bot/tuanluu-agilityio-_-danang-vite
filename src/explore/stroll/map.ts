/* ============================ Đi dạo: lõi bản đồ va chạm 2D ============================
   Thuần toán học: không import three, không import CONFIG, không đụng DOM. Task sau dựng vùng / vật cản từ cảnh rồi gọi các hàm ở đây.
   - Nhân vật là hình tròn bán kính `radius` trên mặt bằng (x, z). Tâm phải nằm trong một vùng mở (`StZone`) và cách mọi vật cản ít nhất `radius`.
   - Vùng chữ nhật, thứ tự mảng là thứ tự ưu tiên khi chồng nhau (vùng đầu tiên chứa điểm quyết định cao độ đứng). Vùng có `gate` thì cổng đóng coi như không có.
   - Vật cản chữ nhật hoặc tròn; có `top` là tường thấp (chặn khi chân thấp hơn `top`, nhảy qua được), vắng `top` là tường cao vô hạn.
   - Chỉ mục lưới đều (ô STC m) để tra vật cản gần một điểm không phải quét hết ~8 000 nhà; vật cản phủ quá nhiều ô để riêng một danh sách "lớn", tra tuyến tính.
   - stMove / stValid chạy mỗi khung: không cấp phát (D-018). */

export interface StRect { x0: number; x1: number; z0: number; z1: number }
export interface StZone extends StRect { id: string; y: (x: number, z: number) => number; gate?: string }   // y: cao độ đứng tại (x, z), m
export interface StSolid { kind: 'rect' | 'circle'; x0?: number; x1?: number; z0?: number; z1?: number; cx?: number; cz?: number; r?: number; top?: number }   // top: m trên cao độ đứng; vắng = cao vô hạn
export interface StMap { zones: StZone[]; solids: StSolid[]; radius: number; closed: Set<string> }

/* Chỉ mục lưới, giữ trong map nhưng không lộ ra kiểu công khai */
interface StIndex { cells: Map<number, number[]>; big: number[] }
interface StMapI extends StMap { idx: StIndex }

const STC = 16;          // cạnh ô lưới, m (nhà ven sông 10–40 m, mỗi nhà phủ vài ô)
const ST_BIG = 64;       // vật cản phủ hơn số ô này thì vào danh sách "lớn"
const ST_OFF = 32768;    // dời chỉ số ô về số dương để ghép khóa (đủ cho ±524 km)
const stKey = (ix: number, iz: number): number => (ix + ST_OFF) * 65536 + (iz + ST_OFF);

/* Thêm một vật cản (chỉ số i trong map.solids) vào lưới theo hộp bao của nó */
function stIndexOne(idx: StIndex, s: StSolid, i: number): void {
  const x0 = s.kind === 'circle' ? s.cx - s.r : s.x0, x1 = s.kind === 'circle' ? s.cx + s.r : s.x1;
  const z0 = s.kind === 'circle' ? s.cz - s.r : s.z0, z1 = s.kind === 'circle' ? s.cz + s.r : s.z1;
  const ix0 = Math.floor(x0 / STC), ix1 = Math.floor(x1 / STC), iz0 = Math.floor(z0 / STC), iz1 = Math.floor(z1 / STC);
  if ((ix1 - ix0 + 1) * (iz1 - iz0 + 1) > ST_BIG) { idx.big.push(i); return; }
  for (let ix = ix0; ix <= ix1; ix++) for (let iz = iz0; iz <= iz1; iz++) {
    const k = stKey(ix, iz); let list = idx.cells.get(k);
    if (!list) { list = []; idx.cells.set(k, list); }
    list.push(i);
  }
}

export function stMakeMap(zones: StZone[], solids: StSolid[], radius: number): StMap {
  const map: StMapI = { zones, solids: [], radius, closed: new Set<string>(), idx: { cells: new Map<number, number[]>(), big: [] } };
  stAddSolids(map, solids);
  return map;
}

/* Thêm vật cản lúc chạy (nhà thu từ cảnh, Task 6); lưới cập nhật theo */
export function stAddSolids(map: StMap, more: StSolid[]): void {
  const idx = (map as StMapI).idx;
  for (const s of more) { map.solids.push(s); stIndexOne(idx, s, map.solids.length - 1); }
}

export function stSetGate(map: StMap, gate: string, closed: boolean): void {
  if (closed) map.closed.add(gate); else map.closed.delete(gate);
}

export function stZoneAt(map: StMap, x: number, z: number): StZone | null {
  const zs = map.zones;
  for (let i = 0; i < zs.length; i++) {
    const zn = zs[i];
    if (x < zn.x0 || x > zn.x1 || z < zn.z0 || z > zn.z1) continue;
    if (zn.gate !== undefined && map.closed.has(zn.gate)) continue;
    return zn;
  }
  return null;
}

export function stGroundY(map: StMap, x: number, z: number): number {
  const zn = stZoneAt(map, x, z);
  return zn ? zn.y(x, z) : NaN;
}

/* Hình tròn tâm (x, z) bán kính R có chạm vật cản s không (khoảng cách < R) */
function stHitOne(s: StSolid, x: number, z: number, R: number, feet: number): boolean {
  if (s.top !== undefined && feet >= s.top) return false;   // chân đã cao hơn tường thấp
  if (s.kind === 'circle') { const ddx = x - s.cx, ddz = z - s.cz, rr = s.r + R; return ddx * ddx + ddz * ddz < rr * rr; }
  const ddx = s.x0 - x > 0 ? s.x0 - x : x - s.x1 > 0 ? x - s.x1 : 0;
  const ddz = s.z0 - z > 0 ? s.z0 - z : z - s.z1 > 0 ? z - s.z1 : 0;
  return ddx * ddx + ddz * ddz < R * R;
}

/* Có vật cản nào trong bán kính map.radius quanh (x, z) không — chỉ tra các ô lưới phủ hình tròn + danh sách lớn */
function stHit(map: StMap, x: number, z: number, feet: number): boolean {
  const idx = (map as StMapI).idx, sol = map.solids, R = map.radius;
  const big = idx.big;
  for (let i = 0; i < big.length; i++) if (stHitOne(sol[big[i]], x, z, R, feet)) return true;
  const ix0 = Math.floor((x - R) / STC), ix1 = Math.floor((x + R) / STC), iz0 = Math.floor((z - R) / STC), iz1 = Math.floor((z + R) / STC);
  for (let ix = ix0; ix <= ix1; ix++) for (let iz = iz0; iz <= iz1; iz++) {
    const list = idx.cells.get(stKey(ix, iz));
    if (!list) continue;
    for (let i = 0; i < list.length; i++) if (stHitOne(sol[list[i]], x, z, R, feet)) return true;
  }
  return false;
}

/* feet: độ cao chân trên cao độ đứng, m; Infinity = bỏ qua mọi tường thấp */
export function stValid(map: StMap, x: number, z: number, feet: number): boolean {
  return stZoneAt(map, x, z) !== null && !stHit(map, x, z, feet);
}

/* Đi (dx, dz) từ (x, z), kết quả vào out. Chia bước con ≤ radius / 2 nên vật cản phồng theo bán kính (dày ≥ 2·radius) không thể bị nhảy qua.
   Mỗi bước con: thử cả hai trục, rồi chỉ x, rồi chỉ z (trượt dọc tường), không được thì dừng.
   Điểm xuất phát nằm trong tường thấp (vừa đáp xuống giữa tường) thì bước này bỏ qua tường thấp để thoát ra, không bị kẹt. */
export function stMove(map: StMap, x: number, z: number, dx: number, dz: number, feet: number, out: { x: number; z: number }): void {
  let cx = x, cz = z;
  const len = Math.sqrt(dx * dx + dz * dz);
  if (len > 0) {
    const f = !stValid(map, x, z, feet) && stValid(map, x, z, Infinity) ? Infinity : feet;
    const n = Math.max(1, Math.ceil(len / (map.radius * 0.5)));
    const sx = dx / n, sz = dz / n;
    for (let i = 0; i < n; i++) {
      if (stValid(map, cx + sx, cz + sz, f)) { cx += sx; cz += sz; }
      else if (sx !== 0 && stValid(map, cx + sx, cz, f)) cx += sx;
      else if (sz !== 0 && stValid(map, cx, cz + sz, f)) cz += sz;
      else break;
    }
  }
  out.x = cx; out.z = cz;
}

/* Điểm hợp lệ gần nhất (chân trên mặt đứng, tường thấp tính là chặn): vòng tròn nở dần mỗi 0,2 m, tối đa 80 m.
   Dùng cho sơ tán và điểm xuất phát, không gọi mỗi khung (trường hợp xấu nhất vài triệu lần thử). */
const ST_NEAR_STEP = 0.2;   // bước nở vòng và khoảng cách điểm trên vòng, m
const ST_NEAR_MAX = 80;     // bán kính tìm tối đa, m
export function stNearestValid(map: StMap, x: number, z: number, out: { x: number; z: number }): boolean {
  if (stValid(map, x, z, 0)) { out.x = x; out.z = z; return true; }
  const rings = Math.round(ST_NEAR_MAX / ST_NEAR_STEP);
  for (let k = 1; k <= rings; k++) {
    const d = k * ST_NEAR_STEP, n = Math.ceil(2 * Math.PI * d / ST_NEAR_STEP);
    for (let j = 0; j < n; j++) {
      const a = j * 2 * Math.PI / n, px = x + d * Math.cos(a), pz = z + d * Math.sin(a);
      if (stValid(map, px, pz, 0)) { out.x = px; out.z = pz; return true; }
    }
  }
  return false;
}

/* Tham số t (0..1) nơi đoạn a + t·d đi vào vật cản s (hình thật, không phồng theo bán kính); 2 = không chạm */
function stSegEnter(s: StSolid, ax: number, az: number, dx: number, dz: number): number {
  if (s.kind === 'circle') {
    const fx = ax - s.cx, fz = az - s.cz, c = fx * fx + fz * fz - s.r * s.r;
    if (c <= 0) return 0;                                   // xuất phát trong cột
    const a = dx * dx + dz * dz, b = 2 * (fx * dx + fz * dz);
    if (a === 0) return 2;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return 2;
    const t = (-b - Math.sqrt(disc)) / (2 * a);
    return t >= 0 && t <= 1 ? t : 2;
  }
  let tmin = -Infinity, tmax = Infinity;
  if (dx === 0) { if (ax < s.x0 || ax > s.x1) return 2; }
  else { let t1 = (s.x0 - ax) / dx, t2 = (s.x1 - ax) / dx; if (t1 > t2) { const q = t1; t1 = t2; t2 = q; } if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2; }
  if (dz === 0) { if (az < s.z0 || az > s.z1) return 2; }
  else { let t1 = (s.z0 - az) / dz, t2 = (s.z1 - az) / dz; if (t1 > t2) { const q = t1; t1 = t2; t2 = q; } if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2; }
  if (tmax < tmin || tmax < 0 || tmin > 1) return 2;
  return tmin > 0 ? tmin : 0;
}

/* Phần (0..1) của đoạn a→b đi được trước khi chạm vật cản cao vô hạn hoặc ra khỏi mọi vùng mở (cho camera). Không cấp phát. */
const ST_EPS = 1e-7;   // dung sai khi xét điểm nằm trên cạnh chung hai vùng, m
export function stSegClear(map: StMap, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax, dz = bz - az;
  /* 1) vùng: đi theo chuỗi vùng mở chứa điểm hiện tại, mỗi lần nhảy tới chỗ ra xa nhất */
  let t = 0, tz = 0;
  for (let it = 0; it < 64; it++) {
    const px = ax + dx * t, pz = az + dz * t;
    let best = -1;
    for (let i = 0; i < map.zones.length; i++) {
      const zn = map.zones[i];
      if (px < zn.x0 - ST_EPS || px > zn.x1 + ST_EPS || pz < zn.z0 - ST_EPS || pz > zn.z1 + ST_EPS) continue;
      if (zn.gate !== undefined && map.closed.has(zn.gate)) continue;
      const ex = dx > 0 ? (zn.x1 - ax) / dx : dx < 0 ? (zn.x0 - ax) / dx : Infinity;
      const ez = dz > 0 ? (zn.z1 - az) / dz : dz < 0 ? (zn.z0 - az) / dz : Infinity;
      const e = ex < ez ? ex : ez;
      if (e > best) best = e;
    }
    if (best < 0) { tz = t; break; }                        // không vùng nào chứa điểm (chỉ xảy ra khi xuất phát ngoài vùng)
    if (best >= 1) { tz = 1; break; }
    if (best <= t + 1e-9) { tz = t; break; }                // không vùng nào đi tiếp được
    t = best; tz = t;
  }
  /* 2) vật cản cao vô hạn trong hộp bao đoạn; hộp quá lớn thì quét hết */
  let ts = tz;
  const sol = map.solids, idx = (map as StMapI).idx;
  const ix0 = Math.floor(Math.min(ax, bx) / STC), ix1 = Math.floor(Math.max(ax, bx) / STC), iz0 = Math.floor(Math.min(az, bz) / STC), iz1 = Math.floor(Math.max(az, bz) / STC);
  if ((ix1 - ix0 + 1) * (iz1 - iz0 + 1) > sol.length) {
    for (let i = 0; i < sol.length; i++) { const s = sol[i]; if (s.top !== undefined) continue; const e = stSegEnter(s, ax, az, dx, dz); if (e < ts) ts = e; }
    return ts;
  }
  const big = idx.big;
  for (let i = 0; i < big.length; i++) { const s = sol[big[i]]; if (s.top !== undefined) continue; const e = stSegEnter(s, ax, az, dx, dz); if (e < ts) ts = e; }
  for (let ix = ix0; ix <= ix1; ix++) for (let iz = iz0; iz <= iz1; iz++) {
    const list = idx.cells.get(stKey(ix, iz));
    if (!list) continue;
    for (let i = 0; i < list.length; i++) { const s = sol[list[i]]; if (s.top !== undefined) continue; const e = stSegEnter(s, ax, az, dx, dz); if (e < ts) ts = e; }
  }
  return ts;
}
