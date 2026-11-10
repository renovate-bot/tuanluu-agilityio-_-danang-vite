# Xe cộ thực tế hơn — Kế hoạch thực hiện

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay xe khối hộp ở cả năm hệ xe bằng siêu xe, xe tay ga có người lái và buýt nhỏ vàng, với mỗi hệ xe chỉ còn một lệnh vẽ.

**Architecture:**
- Mỗi hệ xe là **một `InstancedMesh`** (gọi là "fleet"), theo mẫu tàu thuyền D-026 (`src/environment/boats/`). Hình học gộp ba loại xe; mỗi đỉnh mang `aPart` (loại) và `aRole` (vai trò màu / đèn); mỗi instance mang `aType`, `aPaint`, `aAccent`. Vertex shader thu đỉnh khác loại về gốc.
- Một vật liệu dùng chung `vhMaterial` (`MeshStandardMaterial` có màu đỉnh, vá bằng `onBeforeCompile`), đèn pha / đèn hậu là emissive bật khi `uNight > 0.3`. Không dùng texture.
- Logic chạy xe (danh sách, tốc độ, xếp hàng, dọn khi bão) giữ nguyên; chỉ đổi phần ghi ma trận: 4 lần `placePart` thành 1 lần `vhSetVehicle`.

**Tech Stack:** Vite 6, TypeScript 5.9, three@0.165 (`mergeGeometries`, `onBeforeCompile`), GLSL, `tsx --test` (unit), Playwright + SwiftShader.

**Spec:** [2026-11-10-xe-co-thuc-te-design.md](../specs/2026-11-10-xe-co-thuc-te-design.md). Hình dáng tham chiếu: `docs/superpowers/specs/tham-chieu/xe-co/xe-dung-thu.html` và `ban-dung-thu-ngay.png` (không commit, có trên máy).

## Global Constraints

- **Nhánh:** `feature/xe-co-thuc-te` (đã tạo, spec đã commit). Commit sau mỗi task. Không commit file `150` (không thuộc việc này), `dist/`, `tests/screens/`.
- **`rand()`:** `buildTraffic()` giữ đúng số lời gọi và thứ tự: mỗi xe 1 lời gọi chọn loại, 1 lời gọi vị trí, **chỉ ô tô** thêm 1 lời gọi chọn màu. `createTraffic()` giữ đúng thứ tự `rnd()` hiện có (loại, vị trí, tốc độ, màu ô tô). Không đổi thứ tự `build*()` trong `src/main.ts`. Ngẫu nhiên mới chỉ dùng hash theo chỉ số.
- **Draw call:** mỗi hệ xe đúng 1 `InstancedMesh`. Không còn mesh hộp `MAT.vehicle` / `MAT.glass` (của xe) / `MAT.headLamp` / `MAT.tailLamp`.
- **Số đỉnh:** hình học gộp ba loại ≤ 2 000 đỉnh (`CONFIG.vehicles.maxVerts`), hình học có index.
- **Đèn:** không `PointLight` / `SpotLight`. Đèn bằng emissive, đọc `shared.uNight`.
- **Tài nguyên:** không ảnh ngoài, không texture mới, không thư viện runtime, không UI hay khóa i18n.
- **Không logo, tên hãng, biển số thật.**
- **Thông số:** mọi kích thước và màu ở `CONFIG.vehicles` (`src/config.ts`): chú thích tiếng Việt, đơn vị trước, `(ước lượng)` nếu không nguồn. File trong `src/common/vehicles/` không chứa hằng màu `0xRRGGBB`.
- **Phong cách:** comment tiếng Việt, khối tiêu đề `/* ===== ... ===== */`, dòng dài "một dòng một ý" như `src/environment/boats/hulls.ts`. Tiền tố hàm `vh*`. Không cấp phát mỗi khung (D-018).
- **Test:** sau mỗi thay đổi `.ts` chạy `npm run typecheck`. Không chạy test nặng (`test:drawcalls`, `test:tour`, `test:perf`, đủ bộ): người dùng duyệt trên demo. Không chạy hai test trình duyệt cùng lúc.
- **Hệ trục xe:** đầu xe hướng **+X**, bề ngang theo Z, mặt đường y = 0, tâm xe ở x = 0, z = 0. Đơn vị mét, không chuẩn hóa (fleet đặt scale 1).

## Review Focus

1. **Bão rồi hết bão:** xe trên Cầu Rồng và Trần Thị Lý ẩn dần rồi trở lại đúng chỗ; xe hai đường ven sông và trong hầm vẫn chạy. Test: `stormClear` trong Task 3.
2. **Xếp hàng trước barie Cầu sông Hàn:** khoảng cách 7,5 m, không xe nào chồng lên xe sau. Test: `types.bus.len ≤ 7.5` trong Task 1.
3. **Mặt cắt hầm:** vật liệu xe mới vẫn bị mặt cắt bóc. Test: `cutaway` trong Task 3.
4. **Ngày ↔ đêm:** đèn tắt hẳn ban ngày, bật khi `uNight > 0.3`, không cần mesh riêng. Test: `lamps` trong Task 3.
5. **Tắt làn Trần Thị Lý (`PATHS.ttl.hidden`):** xe làn đó ẩn, bật lại thì hiện. Test: `laneToggle` trong Task 3.

---

### Task 1: Thông số và hình học ba loại xe

**Files:**
- Modify: `src/config.ts` (khối `vehiclesBase` đặt trước `export const CONFIG`; khóa `vehicles` thêm **cuối** `CONFIG`)
- Create: `src/common/vehicles/shapes.ts`
- Create: `tests/traffic-unit/shapes.test.ts`, `tests/traffic-unit/config.test.ts`
- Modify: `package.json` (thêm `"test:traffic:unit": "tsx --test tests/traffic-unit/*.test.ts"`)

**Interfaces:**
- Produces (config):
  ```ts
  export type VehicleTypeId = 'car' | 'bus' | 'bike';
  CONFIG.vehicles = {
    types: { car: { len: 4.5, w: 1.95, h: 1.2 }, bike: { len: 1.8, w: 0.7, h: 1.6 }, bus: { len: 7.0, w: 2.1, h: 2.7 } },   // m
    carColors: number[],     // ≥ 8 màu rực: cam, vàng, đỏ, trắng, xanh dương, xanh lá, xám đậm, đen …
    bikeColors: number[],    // giữ 5 màu BIKE_COLORS hiện có trong src/common/traffic.ts
    shirtColors: number[],   // ≥ 6 màu áo người lái
    palette: { glass, tyre, dark, seat, skin, trouser, busBody, busStripe, busStripeEdge, busWindow, busAc, headDay, tailDay },   // màu cố định theo đỉnh
    lamp: { head: [2.2, 2.1, 1.8], tail: [2.0, 0.1, 0.05], nightOn: 0.3 },   // giữ đúng giá trị MAT.headLamp / MAT.tailLamp và ngưỡng 0,3 hiện tại
    roughness: number, metalness: number,
    maxVerts: 2000
  }
  ```
  `busBody` vàng khoảng `0xf2c11c`, `busStripe` xanh khoảng `0x2f9be0`, `busStripeEdge` trắng.
- Produces (`shapes.ts`):
  ```ts
  export enum Role { Fixed = 0, Paint = 1, Accent = 2, Head = 3, Tail = 4, Helmet = 5 }
  export const VEHICLE_TYPES: VehicleTypeId[] = ['car', 'bus', 'bike'];
  export function vhBuildTypeGeometry(type: VehicleTypeId): THREE.BufferGeometry;   // có cache
  export function vhBuildFleetGeometry(): THREE.BufferGeometry;                     // gộp 3 loại, thêm aPart = chỉ số trong VEHICLE_TYPES; có cache
  ```
  Mỗi hình học: **có index**; thuộc tính `position`, `normal`, `color` (vec3), `aRole` (float); không có `uv`.
  - `Role.Paint`: màu lấy từ `aPaint` của instance (thân siêu xe, thân xe tay ga). `Role.Accent`: `aAccent` (áo người lái). `Role.Helmet`: mũ bảo hiểm, shader lấy `aAccent.brg`. `Role.Head` / `Role.Tail`: đèn. `Role.Fixed`: dùng `color` của đỉnh.

**Hình dáng (mốc tối thiểu, tọa độ lấy từ bản dựng thử, bỏ chi tiết không thấy ở 10 m):**
- **Siêu xe** (~600 đỉnh): thân loft 7 mặt cắt, khoang kính loft 4 mặt cắt (`palette.glass`), nắp máy sau loft 2 mặt cắt, tấm mái, 4 bánh trụ 8 cạnh chỉ có mặt ngoài, 2 đèn pha nhỏ ở chóp chắn bùn, dải đèn hậu ngang, cánh gió sau có một chân, cánh gió trước và khuếch tán sau màu `palette.dark`. Số đo các mặt cắt: hàm `superCar` trong file dựng thử.
- **Xe tay ga + người lái** (~560 đỉnh): 2 bánh 8 cạnh, thân sau loft 4 mặt cắt, sàn, yếm nghiêng, chắn bùn, phuộc, ghi đông, đèn pha (hộp nhỏ), yên (`palette.seat`), đèn hậu; người lái gồm thân áo (`Role.Accent`), đầu là một cầu thấp đa giác `Role.Helmet` kèm mặt (`palette.skin`), 2 tay tới ghi đông, 2 đùi và 2 ống chân (`palette.trouser`). Số đo: hàm `scooter`.
- **Buýt nhỏ** (~470 đỉnh): thân loft 5 mặt cắt màu `busBody` (kính lái nghiêng nằm trên đoạn 2,3 → 3,3 m), tấm kính lái, mỗi bên một dải cửa sổ tối (`busWindow`) và dải chéo `busStripe` viền `busStripeEdge` làm bằng tấm mỏng đặt sát thân (không texture), kính sau, cục điều hòa `busAc`, 2 đèn pha, 2 đèn hậu đứng, 4 bánh. Số đo: hàm `miniBus` (file dựng thử dùng texture cho hai bên; ở đây thay bằng tấm màu đỉnh, dải chéo thấp ở đầu xe và cao dần về đuôi).
- Hàm loft trong file dựng thử sinh tam giác không index; ở đây mỗi mặt tứ giác dùng 4 đỉnh + index, pháp tuyến phẳng theo mặt, mặt hướng ra ngoài (vật liệu `FrontSide`).

- [ ] **Step 1: Viết test thất bại** `tests/traffic-unit/shapes.test.ts` và `config.test.ts` (import `.ts` trực tiếp như `tests/boats-unit/`):

```ts
// shapes.test.ts
test('mỗi loại khớp kích thước config (sai số 6 %) và đứng trên mặt đường', () => {
  for (const t of VEHICLE_TYPES) {
    const g = vhBuildTypeGeometry(t); g.computeBoundingBox(); const b = g.boundingBox!, T = CONFIG.vehicles.types[t];
    assert.ok(Math.abs((b.max.x - b.min.x) / T.len - 1) < 0.06, `${t} dài`);
    assert.ok(Math.abs((b.max.z - b.min.z) / T.w - 1) < 0.12, `${t} rộng`);
    assert.ok(Math.abs(b.max.y / T.h - 1) < 0.06, `${t} cao`);
    assert.ok(Math.abs(b.min.y) < 0.02, `${t} chạm đường`);
    assert.ok(Math.abs(b.max.x + b.min.x) < 0.1 && Math.abs(b.max.z + b.min.z) < 0.02, `${t} tâm`);
  }
});
test('có index, đủ thuộc tính, không uv', () => { /* index != null; position, normal, color, aRole; uv undefined */ });
test('đèn pha ở nửa đầu xe (+X), đèn hậu ở nửa đuôi', () => { /* mọi đỉnh Role.Head có x > 0, Role.Tail có x < 0; mỗi loại có cả hai */ });
test('siêu xe và xe tay ga có đỉnh Paint; xe tay ga có Accent và Helmet; buýt không có Paint', () => {});
test('hình học gộp ≤ maxVerts, aPart đúng 3 giá trị 0,1,2', () => { /* vhBuildFleetGeometry().getAttribute('position').count <= CONFIG.vehicles.maxVerts */ });
test('mặt hướng ra ngoài: pháp tuyến mỗi tam giác của thân loft không chỉ vào tâm khối', () => { /* với car: ≥ 95 % tam giác có dot(normal, tâmTamGiác − tâmBBox) > 0 */ });
// config.test.ts
test('file trong src/common/vehicles không có hằng màu 0xRRGGBB', () => {});
test('buýt vừa khoảng xếp hàng 7,5 m của Cầu sông Hàn', () => assert.ok(CONFIG.vehicles.types.bus.len <= 7.5));
test('carColors ≥ 8, shirtColors ≥ 6, bikeColors = 5 màu cũ', () => {});
```

- [ ] **Step 2:** `npm run test:traffic:unit` → FAIL (chưa có `shapes.ts`, `CONFIG.vehicles`).
- [ ] **Step 3:** Thêm `vehiclesBase` vào `src/config.ts` (comment đầu khối `/* ---- Xe cộ ---- */`, ghi nguồn kích thước: siêu xe xấp xỉ McLaren 720S nếu kiểm được, không thì `(ước lượng)`), export `VehicleTypeId`, thêm `vehicles: vehiclesBase` cuối `CONFIG`.
- [ ] **Step 4:** Viết `src/common/vehicles/shapes.ts` với lớp `Kit` kiểu `hulls.ts` (`box`, `loft`, `wheel`, `add(geometry, color, role)`), ba hàm dựng, cache, `vhBuildFleetGeometry`.
- [ ] **Step 5:** `npm run test:traffic:unit` → PASS; `npm run typecheck` → không lỗi.
- [ ] **Step 6:** Commit `feat(traffic): thông số và hình học siêu xe, xe tay ga, buýt nhỏ`.

### Task 2: Vật liệu, fleet và thay năm hệ xe

**Files:**
- Create: `src/common/vehicles/material.ts`, `src/common/vehicles/fleet.ts`
- Modify: `src/common/traffic.ts`, `src/environment/traffic.ts`, `src/core/dayNight.ts` (bỏ `vHead` / `vTail`), `src/core/materials.ts` (xóa `vehicle`, `headLamp`, `tailLamp` nếu không còn nơi dùng; `glass` xóa nếu chỉ xe dùng), `src/bridges/han-tunnel/cutaway.ts:99` (thay các `MAT.*` của xe bằng `vhMaterial`), `src/bridges/{tran-thi-ly,thuan-phuoc,song-han}/life.ts`, `src/bridges/han-tunnel/HanTunnel.ts` (bỏ `busColor`, thêm `name`), `src/main.ts` (`__app.traffic`)

**Interfaces:**
- Consumes: `vhBuildFleetGeometry()`, `VEHICLE_TYPES`, `Role`, `CONFIG.vehicles` (Task 1).
- Produces (`material.ts`): `export const vhMaterial: THREE.MeshStandardMaterial` (`name = 'vehicleFleet'`, `vertexColors: true`, `customProgramCacheKey = () => 'vehicleFleet'`, lưu `userData.vs` / `userData.fs`); `export const vhDepthMaterial: THREE.MeshDepthMaterial` (cùng bản vá thu đỉnh, khóa `'vehicleDepth'`, lưu `userData.vs`).
  - Thuộc tính instance: `aType` (float), `aPaint` (vec3), `aAccent` (vec3).
  - Vertex: `abs(aPart − aType) > 0.5` ⇒ `transformed = vec3(0.0)`; sau `#include <color_vertex>` đổi `vColor.rgb` theo `aRole` (Paint → `aPaint`, Accent → `aAccent`, Helmet → `aAccent.brg`); varying `vLamp` = 1 (Head), 2 (Tail), 0 (khác).
  - Fragment: sau `#include <emissivemap_fragment>` cộng `uHead` hoặc `uTail` nhân `step(nightOn, uNight)`. Màu ban ngày của đỉnh đèn là `palette.headDay` / `tailDay`.
- Produces (`fleet.ts`):
  ```ts
  export interface VehicleFleet { mesh: THREE.InstancedMesh; type: THREE.InstancedBufferAttribute; paint: THREE.InstancedBufferAttribute; accent: THREE.InstancedBufferAttribute }
  export const vhFleets: VehicleFleet[];
  export function vhCreateFleet(capacity: number, parent: THREE.Object3D, name: string): VehicleFleet;   // mọi instance khởi đầu scale 0; frustumCulled = false; castShadow = true; customDepthMaterial = vhDepthMaterial; DynamicDrawUsage
  export function vhSetInfo(f: VehicleFleet, i: number, type: VehicleTypeId, paint: number): void;       // accent = shirtColors[(i * 7 + 3) % n]; chỉ gọi lúc dựng
  export function vhSetVehicle(f: VehicleFleet, i: number, base: THREE.Vector3, q: THREE.Quaternion): void;
  export function vhHide(f: VehicleFleet, i: number): void;
  export function vhCommit(f: VehicleFleet): void;
  ```
  Mỗi fleet có `BufferGeometry` riêng nhưng **dùng chung** các `BufferAttribute` và index của `vhBuildFleetGeometry()` (cùng buffer GPU), chỉ thêm ba thuộc tính instance của mình.
- Produces (`common/traffic.ts`): `VehicleType` = `VehicleTypeId`; `Traffic = { list; x0; x1; fleet: VehicleFleet }`; `createTraffic(bridge, { seed, x0, x1, lanes, name })` (bỏ `busColor`); `stepTraffic` giữ chữ ký. Xóa `TYPES`, `CAR_COLORS`, `BIKE_COLORS`, `placePart` (đọc từ `CONFIG.vehicles`); giữ export `_e`, `_q`.
  - Tên fleet: `traffic-city`, `ttl-traffic`, `tp-traffic`, `sh-traffic`, `hr-traffic`.
  - Màu buýt truyền cho `vhSetInfo` là `palette.busBody` (buýt không có đỉnh Paint nên không ảnh hưởng hình).
- Produces (`environment/traffic.ts`): thay `vBody` / `vCabin` / `vHead` / `vTail` bằng `export let cityFleet: VehicleFleet`; `export const trafficTest = { fleets: () => vhFleets, city: () => vehicles, paths: PATHS, material: vhMaterial, types: CONFIG.vehicles.types }`; `main.ts` thêm `traffic: trafficTest` vào `__app`.

- [ ] **Step 1:** Viết `material.ts` và `fleet.ts` theo mẫu `src/environment/boats/material.ts`, `fleet.ts`.
- [ ] **Step 2:** Sửa `common/traffic.ts`. Vòng dựng danh sách giữ nguyên từng lời gọi `rnd()`; chỉ đổi nguồn bảng màu và bỏ `busColor`. `stepTraffic`: xe bị dọn → `vhHide`; còn lại → `vhSetVehicle(T.fleet, i, base, _q)`; cuối hàm `vhCommit`. Bỏ biến `lamps`.
- [ ] **Step 3:** Sửa `environment/traffic.ts` tương tự. **Không thêm, bớt, đổi thứ tự lời gọi `rand()`**: biểu thức chọn màu ô tô vẫn là `colors[Math.floor(rand() * colors.length)]` và vẫn chỉ chạy cho ô tô.
- [ ] **Step 4:** Sửa các nơi gọi, `dayNight.ts`, `cutaway.ts`, `materials.ts`, `main.ts`. Tìm bằng grep mọi chỗ còn nhắc `vHead`, `vTail`, `vBody`, `vCabin`, `busColor`, `MAT.vehicle`, `MAT.headLamp`, `MAT.tailLamp`, `TYPES`, `CAR_COLORS`, `BIKE_COLORS`, `placePart` → không còn.
- [ ] **Step 5:** `npm run typecheck` → không lỗi; `npm run test:traffic:unit`, `npm run test:boats:unit` → PASS; `npm run build` → đạt.
- [ ] **Step 6:** Commit `feat(traffic): mỗi hệ xe một lệnh vẽ, xe có dáng thật thay khối hộp`.

### Task 3: Test trình duyệt, ảnh chụp, chỉnh dáng

**Files:**
- Create: `tests/traffic-check.mjs`
- Modify: `package.json` (`"test:traffic": "node tests/traffic-check.mjs"`), có thể `src/common/vehicles/shapes.ts`, `src/config.ts` (chỉnh dáng / màu sau khi xem ảnh)

**Interfaces:**
- Consumes: `window.__app.traffic` (Task 2), `tests/lib.mjs` (`serveDir`, `launch`, `openApp`, `frames`), `tests/weather-lib.mjs` (`setWx`), `__app.boats.running()`.

- [ ] **Step 1:** Viết `tests/traffic-check.mjs` theo khung `tests/boats-check.mjs` (khung 960×540, cờ `--no-shots`, comment đầu file đánh số mục kiểm). Các mục:
  1. `fleetOnly`: đúng 5 fleet tên `hr-traffic,sh-traffic,tp-traffic,traffic-city,ttl-traffic`, đều dùng vật liệu `vehicleFleet`; trong scene không còn `InstancedMesh` nào có `geometry.type === 'BoxGeometry'` mà `count` bằng số xe của một hệ.
  2. `counts`: `traffic.city().length === 536`; `sh-traffic` 52 instance; `hr-traffic` 348 instance.
  3. `randKept`: `boats.running()` có 7 tàu, `speed` trùng mảng `MAIN_SPEEDS` trong `tests/boats-check.mjs` (sai số < 1e-12). `buildBoats()` chạy ngay sau `buildTraffic()`, nên trùng nghĩa là số lời gọi `rand()` của xe không đổi.
  4. `depthPatched`: mỗi fleet có `customDepthMaterial`, `userData.vs` của cả hai vật liệu chứa `aPart`.
  5. `lamps`: `material.userData.fs` chứa `uNight` và `step(`; không có mesh nào dùng vật liệu tên `headLamp` / `tailLamp`.
  6. `cutaway`: `traffic.material.clippingPlanes.length === 4`.
  7. `moving`: sau 30 khung, vị trí instance 0 của `traffic-city` đổi; scale = 1.
  8. `laneToggle`: đặt `traffic.paths.ttl.hidden = true`, 3 khung → mọi xe có `path === paths.ttl` có scale 0; đặt lại `false` → scale 1.
  9. `stormClear`: `setWx(page, 'storm')`, chờ `weather.fx().clear >= 1` → trong `traffic-city` mọi xe trên `paths.axis` scale 0, xe trên `paths.bachDang` vẫn scale 1; `setWx(page, 'now')`, chờ `clear <= 0` → xe `axis` trở lại scale 1.
  10. Không lỗi console.
  11. Ảnh (nếu không `--no-shots`) vào `tests/screens/traffic-*.png`: ngày và đêm, mặt Cầu Rồng nhìn gần (camera cách một xe khoảng 12 m), toàn cảnh Cầu Rồng, đường Bạch Đằng, Cầu sông Hàn, trong hầm.
- [ ] **Step 2:** `npm run build && npm run test:traffic` → mọi mục ĐẠT. Nếu mục nào LỖI do code Task 2 thì sửa code, không nới test.
- [ ] **Step 3:** Mở từng ảnh `tests/screens/traffic-*.png` và so với `docs/superpowers/specs/tham-chieu/xe-co/ban-dung-thu-ngay.png`. Sửa `shapes.ts` / `config.ts` nếu thấy: xe chìm hoặc lơ lửng, đầu xe quay ngược hướng chạy, mặt bị lộn (thủng, đen), màu sai, đèn không sáng ban đêm hoặc sáng ban ngày, từ góc toàn cảnh vẫn như hộp. Chạy lại Step 2 sau khi sửa.
- [ ] **Step 4:** Commit `test(traffic): test:traffic kiểm fleet, rand, đèn, bão, tắt làn`.

### Task 4: Tài liệu và memory bank

**Files:**
- Modify: `.github/memory-bank/decisions.md` (thêm D-027), `.github/memory-bank/activeContext.md`, `.github/memory-bank/progress.md`, `.github/memory-bank/systemPatterns.md` (mẫu fleet xe, nếu chưa có mục tương tự cho tàu thì thêm một dòng trỏ tới cả hai), `.github/copilot-instructions.md` §5 (thêm `test:traffic:unit`, `test:traffic`), `README.md` mục **Cấu trúc** (thêm `common/vehicles/`), `tests/KET-QUA.md` (mục mới: kết quả `test:traffic`, số đỉnh từng loại, ghi rõ **chưa đo** `test:drawcalls`, `test:perf`, FPS GPU thật), plan này (đánh dấu ô đã xong)

- [ ] **Step 1:** Viết D-027 theo khuôn D-026 (bối cảnh, quyết định, hệ quả: số đỉnh mỗi instance × số xe, buýt xanh đã bỏ, `MAT.vehicle` / `headLamp` / `tailLamp` đã xóa).
- [ ] **Step 2:** Cập nhật `activeContext.md` (trạng thái, bước tiếp theo: test nặng chưa chạy, người dùng duyệt trên demo) và `progress.md` (hàng mới trong bảng "Đã xong", mục "Còn thiếu"). Ngày cập nhật 2026-11-10.
- [ ] **Step 3:** Cập nhật `copilot-instructions.md`, `README.md`, `tests/KET-QUA.md`.
- [ ] **Step 4:** Commit `docs(traffic): kết quả, README, memory bank (D-027)`.
