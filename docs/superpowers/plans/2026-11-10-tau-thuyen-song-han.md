# Tàu thuyền sông Hàn sống động — Kế hoạch thực hiện

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay khối hộp bằng du thuyền nhiều kiểu, có LED về đêm, và thêm khoảng 15 tàu tụ quanh Cầu Rồng và Cầu sông Hàn vào buổi tối, với draw call không tăng ở mọi góc cũ.

**Architecture:**
- Mọi tàu vẽ bằng **một `InstancedMesh` cho mỗi đội tàu** (gọi là "fleet"). Hình học của fleet gộp các kiểu tàu nó cần. Mỗi đỉnh mang `aPart` (thuộc kiểu nào); mỗi instance mang `aBoat` (kiểu, biến thể, màu LED, biển tên). Vertex shader thu các đỉnh không thuộc kiểu của instance về một điểm. Nhờ vậy mỗi fleet chỉ tốn 1 lệnh vẽ (thay cho 3 như hiện nay), có thêm `customDepthMaterial` cùng bản vá để bóng không vẽ chồng các kiểu.
- Một vật liệu dùng chung, gồm màu đỉnh, atlas canvas cho biển tên và emissive theo `aGlow` × `uNight`.
- Tàu tụ tập nằm trong fleet chung ở layer 0, nên có phản chiếu và vệt D-023 sẵn có.

**Tech Stack:** Vite 6, TypeScript 5.9, three@0.165 (`mergeGeometries`, `onBeforeCompile`), GLSL, `tsx --test` (unit), Playwright + SwiftShader.

**Spec:** [2026-11-10-tau-thuyen-song-han-design.md](../specs/2026-11-10-tau-thuyen-song-han-design.md)

## Global Constraints

- **Thời điểm bắt đầu:** chỉ khi nhánh `feature/thu-gon-bang-dieu-khien` đã xong và người dùng ra lệnh.
- **Nhánh:** làm trên `feature/tau-thuyen-song-han` tách từ `main` mới nhất, trong worktree riêng.
- **`rand()`:** giữ đúng **14 lời gọi** trong `buildBoats()` (`speed` rồi `len`, mỗi tàu, i = 0..6). Không đổi thứ tự `build*()` trong `src/main.ts`. Mọi ngẫu nhiên mới dùng `rng(seed)`.
- **Draw call:** không góc nào trong `tests/drawcalls.mjs` (ngày + đêm) **cao hơn** bản `main` đo cùng máy. Dao động `swTour` ±2 đã biết (D-018) không tính.
- **Vật liệu đèn:** không `PointLight`/`SpotLight` mới. Đèn bằng emissive nhân `shared.uNight`. LED đứng yên, không nhấp nháy.
- **Tài nguyên:** không ảnh ngoài, không thư viện runtime, không UI hay khóa i18n mới. Tên tàu hư cấu, không dùng tên hãng thật.
- **Thông số:** đặt trong `CONFIG.boats` (`src/config.ts`), chú thích tiếng Việt, có đơn vị, ghi `(ước lượng)`.
- **Tiền tố hàm:** `bt*`. Thư mục mới: `src/environment/boats/`.
- **Vùng cấm cho tàu tụ tập** (khoảng cách tính tới tâm tàu, cộng nửa chiều dài):
  - hành lang hầm |z + 1700| < 30;
  - dưới mặt cầu |z − zCầu| < 25 (Cầu Rồng z = 0, Cầu sông Hàn z = −1080);
  - vòng quay và luồng Cầu sông Hàn |x| < 75 khi |z + 1080| < 200 (nhịp quay 61,35 m, ước lượng);
  - các làn tàu chạy x ∈ {−100, −48, −22, 22, 31, 41, 48, 82} ± 12 m;
  - mép kè |x| > 262 − 20.
- **Hiệu năng:** `test:perf --strict` đạt, 0 chương trình shader mới sau khởi động.
- **Kiểm thử:** test SwiftShader nặng chỉ chạy **một lần ở Task 5**, không chạy hai test song song, trước đó kiểm không còn tiến trình `*-check.mjs` mồ côi. Các task 1–4 dùng `typecheck`, unit test và `test:boats`.
- **Phong cách:** comment tiếng Việt, khối tiêu đề `/* ===== ... ===== */`, kiểu "một dòng một ý".

## Review Focus

1. **Bóng đổ:** lượt vẽ bóng dùng `MeshDepthMaterial` mặc định sẽ vẽ chồng mọi kiểu tàu thành một khối. Cần `customDepthMaterial` có cùng bản vá → Task 3, kiểm `depthPatched`.
2. **Mặt cắt Hầm** (`cutaway.ts` liệt kê `MAT.hull`/`boatCabin`/`boatRoof`): vật liệu fleet mới phải được bóc đúng khi bật mặt cắt → Task 3 cập nhật danh sách, `test:tunnel` ở Task 5.
3. **Chuyển đêm nhanh** (`stepNight` hội tụ trong khoảng 2 s): tàu tụ tập vẫn hiện dần, không bật cùng lúc → Task 4, kiểm `crowdRamp`.
4. **Bão lúc đang đêm:** tàu tụ tập phải về bến cùng tàu khác, và hiện lại khi hết bão → Task 4, kiểm `crowdStorm`.
5. **Mốc `test:citynight` (`warmDominant` ≥ 60 %)** khi có 15 tàu LED nhiều màu trong khung: LED phải mảnh và cửa sổ vàng ấm áp đảo → Task 4 chạy `test:citynight -- --no-shots` (chỉ phần đêm; `dayDiff` sẽ lệch có chủ đích, chụp lại mốc ở Task 5).

---

### Task 1: Thông số và vị trí tàu tụ tập (logic thuần)

**Files:**
- Modify: `src/config.ts` (thêm `CONFIG.boats`), `package.json` (script `test:boats:unit`)
- Create: `src/environment/boats/crowd.ts`
- Test: `tests/boats-unit/crowd.test.ts`

**Interfaces:**
- Produces:
  - `type BoatTypeId = 'A' | 'B' | 'C' | 'D' | 'E'`: A du thuyền hai thân, B tàu gỗ kiểu cũ, C du thuyền 3 tầng, D tàu cá/hàng, E tàu buồm cao.
  - `CONFIG.boats`:
    - `types: Record<BoatTypeId, { len: [number, number]; w: number; floors: number }>`
    - `crowd: { seed: number; groups: { name: 'dragon' | 'songHan'; n: number; zMin: number; zMax: number }[]; minGap: number; drift: number; yawSwing: number; nightOn: [number, number] }`
    - `led: { colors: number[]; gain: number }`, `windowColor: number`, `names: string[]`
  - `interface CrowdSlot { x: number; z: number; yaw: number; type: BoatTypeId; len: number; variant: number; led: number; name: number; phase: number }`
  - `btCrowdSlots(cfg = CONFIG.boats.crowd): CrowdSlot[]`: tất định, dùng `rng(cfg.seed)`.
  - `btInExclusion(x: number, z: number, halfLen: number): boolean`: theo vùng cấm ở Global Constraints.
  - `btCrowdAlpha(i: number, n: number, night: number, boatAway: number): number`: trả 0..1, hiện so le từng tàu.

- [ ] **Step 1: Viết test hỏng**, trong `tests/boats-unit/crowd.test.ts` (`node:test` + `assert`, như `tests/multi-unit/`):
  - `slots đủ số`: `btCrowdSlots()` có 8 tàu với `|z| < 300` và 7 tàu với `|z + 1080| < 300`, tổng 15.
  - `slots ngoài vùng cấm`: mọi s có `btInExclusion(s.x, s.z, s.len / 2) === false`.
  - `slots cách nhau`: khoảng cách tâm giữa hai tàu bất kỳ ≥ `CONFIG.boats.crowd.minGap`.
  - `slots tất định`: gọi hai lần cho kết quả `deepEqual`.
  - `slots nhiều kiểu`: mỗi cụm có ≥ 2 kiểu trong {A, B, C}; trong mỗi cụm, không có hai tàu cùng (type, variant, led).
  - `exclusion biên`: `btInExclusion(0, -1700, 5)`, `btInExclusion(-22, 400, 10)`, `btInExclusion(0, -1080, 10)`, `btInExclusion(250, 100, 10)` đều `true`; `btInExclusion(-150, 120, 12)` là `false`.
  - `alpha`: `btCrowdAlpha(i, 15, 0, 0) === 0` và `btCrowdAlpha(i, 15, 1, 0) === 1` với mọi i; `btCrowdAlpha(i, 15, 1, 1) === 0`; theo `night` tăng dần 0 → 1 (bước 0,01) thì alpha không giảm; ở `night` giữa `nightOn[0]` và `nightOn[1]` có ít nhất một tàu 0 < alpha < 1, và không phải mọi tàu cùng giá trị.
- [ ] **Step 2: Chạy** `npm run test:boats:unit` (script `tsx --test tests/boats-unit/*.test.ts`). Kỳ vọng: FAIL vì thiếu module.
- [ ] **Step 3: Viết `CONFIG.boats`** (các số trong spec §6: A 24–28 m, B 20–24 m, C 30–35 m, D 12–46 m, E ≈ 30 m; `led.colors` gồm tím, xanh lá, xanh dương, hồng, vàng; ít nhất 8 tên hư cấu, ví dụ "Sông Hàn 01", "Ngọc Biển", "Hoa Sen", "Bạch Đằng Star"). Viết `crowd.ts`: rải vị trí bằng thử–loại (lấy mẫu trong cụm, loại nếu `btInExclusion` hoặc gần hơn `minGap`); kiểu, biến thể, LED và tên lấy từ `rng`. Hàm alpha dùng ngưỡng riêng từng tàu `h_i = (i·0,618) mod 1` trong khoảng `nightOn`, cộng dải mượt, nhân `1 − smoothstep` theo `boatAway` (cùng tinh thần `vanished()`).
- [ ] **Step 4: Chạy** `npm run test:boats:unit` và `npm run typecheck`. Kỳ vọng: PASS.
- [ ] **Step 5: Commit**: `feat(boats): thông số tàu và vị trí tàu tụ tập ban đêm`.

### Task 2: Hình học từng kiểu tàu

**Files:**
- Create: `src/environment/boats/hulls.ts`
- Test: `tests/boats-unit/hulls.test.ts`

**Interfaces:**
- Consumes: `BoatTypeId`, `CONFIG.boats.types` (Task 1).
- Produces:
  - `enum Glow { None = 0, Window = 1, Led = 2, NavRed = 3, NavGreen = 4, Plate = 5, Lantern = 6 }`
  - `btBuildTypeGeometry(type: BoatTypeId): THREE.BufferGeometry`: không index (hoặc index thống nhất cho mọi kiểu), có `position`, `normal`, `color` (màu ban ngày), `uv` (biển tên trỏ vào ô atlas 0; phần khác trỏ vào ô trắng), `aGlow`. Đáy (keel) ở y = 0 tại mực nước, mũi về +Z. Chiều dài **chuẩn hóa = 1** theo Z; fleet sẽ scale đều theo `len`.
  - `btBuildFleetGeometry(types: BoatTypeId[]): THREE.BufferGeometry`: gộp bằng `mergeGeometries`, thêm `aPart` = chỉ số kiểu trong `['A','B','C','D','E']`.

Dáng từng kiểu theo spec §6 và ảnh tham chiếu:
- thân vuốt mũi (A: hai thân);
- tầng boong và cabin có dải cửa sổ `Window`;
- lan can boong trên (thanh mảnh, gộp);
- mái che;
- LED `Led` dọc mép boong và mép mái;
- đèn mạn `NavRed`/`NavGreen`;
- biển tên `Plate`;
- lốp chống va dọc mạn (A, B);
- cờ đỏ sao vàng nhỏ ở mũi và đuôi (màu đỉnh đỏ, sao vàng là tam giác gộp);
- C có dây đèn lồng `Lantern` ở boong thượng;
- D có cabin lái ở đuôi;
- E có cột buồm và buồm.

- [ ] **Step 1: Viết test hỏng** `tests/boats-unit/hulls.test.ts`:
  - `mọi kiểu có thuộc tính`: với mỗi kiểu, có `position`, `color`, `uv`, `aGlow`; mọi giá trị `aGlow` là số nguyên trong 0..6.
  - `kích thước chuẩn`: bounding box theo Z dài 1 ± 0,02; `min.y ≥ −0,05`.
  - `có đèn`: kiểu A, B, C có đỉnh `Led`, `Window`, `Plate`; kiểu D có `Window` và `NavRed`.
  - `vừa phải`: số đỉnh mỗi kiểu ≤ 4000.
  - `fleet`: `btBuildFleetGeometry(['A','B','C'])` có số đỉnh bằng tổng ba kiểu, và `aPart` chỉ nhận 0, 1, 2.
  - `khác dáng`: bounding box (tỉ lệ cao/dài, rộng/dài) của A, B, C đôi một khác nhau > 0,03.
- [ ] **Step 2: Chạy** `npm run test:boats:unit`. Kỳ vọng: FAIL.
- [ ] **Step 3: Cài đặt** bằng `BoxGeometry`/`CylinderGeometry`/`ExtrudeGeometry` (thân vuốt từ `Shape`), mỗi phần gán `color` và `aGlow` rồi `mergeGeometries` (bỏ index để gộp đồng nhất).
- [ ] **Step 4: Chạy** `npm run test:boats:unit` và `npm run typecheck`. Kỳ vọng: PASS.
- [ ] **Step 5: Commit**: `feat(boats): hình học 5 kiểu tàu (du thuyền, tàu gỗ, 3 tầng, tàu cá, tàu buồm)`.

### Task 3: Fleet, vật liệu và thay thế khối hộp (ban ngày)

**Files:**
- Create:
  - `src/environment/boats/fleet.ts`
  - `src/environment/boats/material.ts`
  - `src/environment/boats/atlas.ts` (canvas biển tên)
  - `tests/boats-check.mjs`
- Modify:
  - `src/environment/traffic.ts:84-112` (`buildBoats`/`updateBoats` dùng fleet; giữ 14 lời gọi `rand()`; `len = lo + r·(hi − lo)` với `r = rand()` theo kiểu A/B của tàu `i`)
  - `src/common/boats.ts` (`Boats` = `{ list; fleet: BoatFleet }`, `BridgeBoat` thêm `type?: BoatTypeId`)
  - `src/bridges/{song-han,thuan-phuoc,tran-thi-ly}/life.ts` (gán `type`; tàu hàng 46 m là D; tàu buồm cao là fleet 1 instance kiểu E trong group `sh-tall-ship`, bỏ 4 mesh cũ)
  - `src/bridges/han-tunnel/cutaway.ts:98` (thay `MAT.hull`/`boatCabin`/`boatRoof` bằng `btFleetMaterial`, hoặc thêm nó nếu vật liệu cũ còn chỗ khác dùng)
  - `src/core/dayNight.ts:35` (bỏ dòng `boatCabin` nếu không còn dùng)
  - `src/main.ts:117` (`__app.boats`)
  - `package.json` (`test:boats`)

**Interfaces:**
- Consumes:
  - `btBuildFleetGeometry`, `Glow` (Task 2)
  - `CONFIG.boats`, `CrowdSlot` (Task 1)
- Produces:
  - `interface BoatInfo { type: BoatTypeId; variant: number; led: number; name: number }`
  - `interface BoatFleet { mesh: THREE.InstancedMesh; types: BoatTypeId[] }`
  - `btCreateFleet(capacity: number, types: BoatTypeId[], parent: THREE.Object3D): BoatFleet`: `frustumCulled = false`, `castShadow = true`, đặt `customDepthMaterial`.
  - `btSetInfo(f: BoatFleet, i: number, info: BoatInfo): void`: ghi `aBoat` (vec4: chỉ số kiểu, biến thể, LED, tên); chỉ gọi lúc dựng.
  - `btSetBoat(f: BoatFleet, i: number, base: THREE.Vector3, q: THREE.Quaternion, len: number): void`
  - `btHideBoat(f: BoatFleet, i: number): void`
  - `btCommit(f: BoatFleet): void`
  - `btFleetMaterial: THREE.MeshStandardMaterial` (dùng chung, `customProgramCacheKey = () => 'boatFleet'`)
  - `__app.boats = { fleets: () => BoatFleet[], crowd: CrowdSlot[], crowdAlpha: () => number[] }`. `crowd`/`crowdAlpha` là mảng rỗng tới Task 4.

- [ ] **Step 1: Viết test hỏng** `tests/boats-check.mjs` (mẫu `tests/citynight-check.mjs`: `serveDir` `dist/`, `openApp`, ẩn UI). Phần ngày:
  - `fleetOnly`: trong `scene`, không còn `InstancedMesh` nào dùng `MAT.hull`/`MAT.boatCabin`/`MAT.boatRoof`. Số mesh dùng `btFleetMaterial` = 5 (chung, Sông Hàn, Thuận Phước, Trần Thị Lý, tàu buồm).
  - `depthPatched`: mọi fleet mesh có `customDepthMaterial`, và chuỗi shader sau `onBeforeCompile` chứa `aPart`.
  - `randKept`: 7 tàu chung có `speed` trong [3, 5]; dãy `speed` trùng với dãy đo trên `main` (ghi cứng 7 số lấy ở Step 2 từ `main`).
  - `dayShots`: chụp `tests/screens/boats-day-{dragon,songhan,ttl,tp}.png` từ 4 góc gần (camera cách tàu gần nhất khoảng 80 m).
- [ ] **Step 2: Ghi mốc trên `main`:** trước khi sửa code, `npm run build`, rồi chép `dist/` sang `../danang-dist-main/` (ngoài repo). Lấy 7 giá trị `speed` qua `page.evaluate` (thêm tạm một dòng log, không commit) và điền vào `randKept`.
- [ ] **Step 3: Chạy** `npm run build && npm run test:boats`. Kỳ vọng: FAIL ở `fleetOnly`.
- [ ] **Step 4: Cài đặt.** Bản vá vertex shader:
  ```glsl
  // thu đỉnh không thuộc kiểu của instance về gốc (tam giác suy biến, không rasterize)
  if ( abs( aPart - aBoat.x ) > 0.5 ) transformed = vec3( 0.0 );
  ```
  Đặt ngay sau `#include <begin_vertex>` trong cả `btFleetMaterial` lẫn `customDepthMaterial` (`MeshDepthMaterial` với `depthPacking: RGBADepthPacking`).
  - Màu ngày lấy từ `color`; biến thể đổi sắc sọc thân (đỏ, xanh, cam), chỉ áp lên đỉnh có màu sọc (đánh dấu bằng kênh màu hoặc `aGlow`, người dựng chọn).
  - Atlas canvas: hàng ô biển tên vẽ `CONFIG.boats.names` và một ô trắng; `uv` của `Plate` dịch theo `aBoat.w`.
  - Tàu theo cầu giữ layer 1 (fleet là con của `bridge.life`, được `BridgeBase` đặt layer).
  - `hanTunnel.holdBoats(songHan.boats.list)` không đổi.
- [ ] **Step 5: Chạy** `npm run typecheck`, `npm run build`, `npm run test:boats`. Kỳ vọng: phần ngày PASS, không có lỗi console.
- [ ] **Step 6: Đo nhanh draw call:**
  ```bash
  node tests/drawcalls.mjs ../danang-dist-main
  ```
  Kỳ vọng: mọi góc ban ngày có `chênh ≤ 0`. Lệnh này nặng; chạy riêng một mình. Đây là ngoại lệ có chủ đích vì kiến trúc phụ thuộc vào số này; nếu cần, chạy lại ở Task 5.
- [ ] **Step 7: Dừng, gửi người dùng 4 ảnh `boats-day-*`** để duyệt dáng tàu ban ngày. Sửa theo góp ý trước khi qua Task 4.
- [ ] **Step 8: Commit**: `feat(boats): du thuyền nhiều kiểu thay khối hộp, mỗi đội tàu một lệnh vẽ`.

### Task 4: Đèn đêm và tàu tụ tập

**Files:**
- Modify: `src/environment/boats/material.ts` (emissive đêm), `src/environment/traffic.ts` (fleet chung thêm 15 slot tụ tập, `updateBoats` gọi bước tụ tập), `tests/boats-check.mjs`
- Create: `src/environment/boats/crowdStep.ts` (nếu `traffic.ts` dài quá; không thì đặt trong `traffic.ts`)

**Interfaces:**
- Consumes: `btCrowdSlots`, `btCrowdAlpha` (Task 1), `btSetBoat`/`btHideBoat`/`btSetInfo` (Task 3), `dayNight.night`, `weatherFx.boatAway`, `windFx.boatRock`.
- Produces: `btStepCrowd(f: BoatFleet, first: number, t: number): void`. Ghi các instance `first .. first + 14`:
  - trôi tròn bán kính `CONFIG.boats.crowd.drift` m;
  - yaw lắc ±`yawSwing` quanh `slot.yaw` theo `phase`;
  - tròng trành như tàu chạy;
  - `len × alpha` khi 0 < alpha < 1 (thu nhỏ đều từ tâm);
  - ẩn khi alpha = 0.

- [ ] **Step 1: Thêm kiểm tra hỏng vào `tests/boats-check.mjs`:**
  - `crowdDay`: `night = 0` → mọi `crowdAlpha` = 0, và các instance tụ tập có ma trận scale 0.
  - `crowdNight`: `night = 1` → 15 alpha = 1; vị trí thế giới mỗi tàu cách slot ≤ `drift + 1` m; không tàu nào `btInExclusion`.
  - `crowdRamp`: đặt `dayNight.target = 1` từ 0 rồi lấy mẫu mỗi khung; tại một khung nào đó có tàu đã hiện và tàu chưa hiện.
  - `crowdStorm`: `night = 1`, chọn preset bão rồi chờ `w.fx().boatAway >= 1` (cùng cách `setWx` trong `weather-check.mjs`) → mọi alpha = 0; về `now`, chờ `boatAway <= 0` → lại 15.
  - `ledBright`: chụp đêm từ góc ảnh tham chiếu (`[0, 60, 420]` nhìn `[0, 0, -100]`, ước lượng). Vùng mặt nước phía dưới có điểm ảnh LED nhiều màu (đếm điểm có max kênh > 150 thuộc ≥ 3 nhóm sắc khác nhau) và có vệt dọc, tức có cột điểm sáng dài ≥ 20 px trên vùng nước. Lưu `tests/screens/boats-night-{dragon,songhan}.png`.
  - `noFlicker`: hai ảnh cách 30 khung, camera và tàu đứng yên (tạm `dt = 0` qua đặt `speed` về 0 trong test): sai khác trung bình vùng LED < 3/255.
- [ ] **Step 2: Chạy** `npm run build && npm run test:boats`. Kỳ vọng: FAIL ở `crowdNight`.
- [ ] **Step 3: Cài đặt emissive** trong `btFleetMaterial`:
  ```
  emissive += glowColor(aGlow, aBoat.z) × uNight × gain
  ```
  - `Window`: `CONFIG.boats.windowColor` (vàng ấm).
  - `Led`: `CONFIG.boats.led.colors[aBoat.z]`, đứng yên.
  - `Plate`: texel atlas × trắng ấm.
  - `NavRed`/`NavGreen`, `Lantern`: nhiều màu theo vị trí đỉnh.

  Chỉnh `gain` sao cho LED vượt `CONFIG.cityNight.streak.threshold` trong ảnh phản chiếu nhưng không làm bloom lóa. Thêm 15 slot vào fleet chung (dung lượng 22), gọi `btSetInfo` từ `btCrowdSlots()`.
- [ ] **Step 4: Chạy** `npm run typecheck`, `npm run build`, `npm run test:boats`. Kỳ vọng: PASS.
- [ ] **Step 5: Chạy** `node tests/citynight-check.mjs --no-shots`. Kỳ vọng: `warmDominant`, `dusk`, `duskWater`, `streak` ĐẠT; `dayDiff` có thể LỖI (có chủ đích, chụp lại mốc ở Task 5). Nếu `warmDominant` LỖI: giảm độ dày hoặc `gain` LED, tăng cửa sổ vàng, không sửa ngưỡng test.
- [ ] **Step 6: Dừng, gửi người dùng ảnh `boats-night-*`** (so với ảnh tham chiếu) để duyệt. Sửa theo góp ý.
- [ ] **Step 7: Commit**: `feat(boats): LED đêm nhiều màu và cụm tàu tụ tập quanh Cầu Rồng, Cầu sông Hàn`.

### Task 5: Đo đủ bộ, tài liệu, memory bank

**Files:**
- Modify: `tests/KET-QUA.md`, `README.md` (mục **Cấu trúc**: `src/environment/boats/`), `.github/memory-bank/{activeContext,progress,decisions}.md` (D-025), `.github/copilot-instructions.md` §5 (thêm `test:boats`, `test:boats:unit`)

- [ ] **Step 1:** Kiểm không còn tiến trình `*-check.mjs`/`drawcalls.mjs` mồ côi (PowerShell `Get-CimInstance Win32_Process`).
- [ ] **Step 2:** `npm run build`, rồi `node tests/drawcalls.mjs ../danang-dist-main`. Kỳ vọng: không góc nào `chênh > 0`, trừ `swTour` ±2. Ghi bảng vào `KET-QUA.md`.
- [ ] **Step 3:** Sau khi người dùng đã duyệt ảnh ngày (Task 3), chạy `node tests/citynight-check.mjs --baseline` trên bản này, rồi chạy `npm run test:citynight`. Kỳ vọng: ĐẠT. Ghi lý do chụp lại mốc vào `KET-QUA.md`.
- [ ] **Step 4:** Chạy lần lượt `test:boats:unit`, `test:boats`, `test:tour`, `test:voice`, `test:tunnel`, `test:riverfront`, `test:weather`, `test:sunwheel`, `test:mobile`, `test:explore`, `test:multi:unit`, `test:perf -- --strict`. Kỳ vọng: tất cả ĐẠT, 0 program mới sau khởi động. Ghi kết quả thật, kể cả lỗi.
- [ ] **Step 5:** Cập nhật README, memory bank (D-025: một `InstancedMesh` mỗi đội tàu với hình học gộp và chọn kiểu theo instance; lý do: ngân sách draw call), `copilot-instructions.md` §5.
- [ ] **Step 6: Commit**: `docs(boats): kết quả đo, README, memory bank (D-025)`.
