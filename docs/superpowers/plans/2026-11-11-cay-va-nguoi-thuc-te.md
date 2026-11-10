# Cây cối và người đi bộ thực tế hơn — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay cây "quả cầu trên que" và "cái ô" bằng cây bóng mát và cây dừa, thay người ống trụ bằng người có tay chân biết đi, chạy, đứng lan can; thêm người lên Cầu Rồng; người rời cầu dần khi bão.

**Architecture:** Giữ nguyên cấu trúc mà các phần khác đang đọc: mỗi loại cây vẫn là cặp `InstancedMesh` thân (`MAT.trunk`) đứng ngay trước tán (`MAT.leaf` / `MAT.palm`), tán vẫn đặt ở tâm và tỉ lệ cũ, chỉ đổi hình học và vật liệu. Người vẫn một `InstancedMesh` cho mỗi hệ, hình học gộp mọi bộ phận, tay chân chuyển động trong vertex shader theo thuộc tính instance (tiền lệ D-026, D-027). Hình học thuần nằm ở `src/common/trees/` và `src/common/people/` để unit test không cần trình duyệt.

**Tech Stack:** Vite 6, TypeScript 5.9, three@0.165, `tsx --test` (unit), Playwright + SwiftShader qua `tests/lib.mjs` (trình duyệt, đọc `dist/`).

**Spec:** `docs/superpowers/specs/2026-11-11-cay-va-nguoi-thuc-te-design.md` (đọc cả spec trước khi làm bất kỳ task nào). Bản dựng thử để xem dáng: `docs/superpowers/specs/tham-chieu/cay-va-nguoi/cay-va-nguoi-dung-thu.html` (ngoài git, có trên máy này); hình học và shader trong đó là điểm xuất phát, được chép ý tưởng nhưng phải giản lược theo trần tam giác.

## Global Constraints

- Đọc `.github/copilot-instructions.md` §3, §6 và `.github/instructions/*.instructions.md` áp cho thư mục sắp sửa.
- `rand()` (`src/common/math.ts`): `buildTrees()` giữ đúng số lời gọi và thứ tự: mỗi vị trí bờ sông và đường dẫn 1 lời gọi, mỗi vị trí công viên 3 lời gọi, rồi mỗi cây tán cầu 3 lời gọi (cao, bán kính, sắc xanh), mỗi cây dừa 1 lời gọi (cao). Không đổi thứ tự `build*()` hiện có trong `src/main.ts`. Ngẫu nhiên mới dùng hash theo chỉ số hoặc `rng(seed)` riêng.
- `rng(1965)` (Trần Thị Lý), `rng(2903)` (Cầu sông Hàn), `rnd` của Thuận Phước, `rng(7001)` (hầm): giữ đúng thứ tự lấy số hiện có.
- Draw call: cây khu phố vẫn 4 `InstancedMesh`, cây Thuận Phước 2, dừa cửa hầm 0 lưới riêng (gộp bê tông); mỗi hệ người 1 `InstancedMesh`; thêm đúng 1 lưới cho người Cầu Rồng.
- Trần tam giác: tán cây bóng mát ≤ 700, thân và cành ≤ 150; tàu lá + búi ngọn + quả dừa ≤ 450, thân dừa ≤ 120; người ≤ 900 đỉnh. Ghi ở `CONFIG.trees.maxTris`, `CONFIG.people.maxVerts`.
- Không ảnh ngoài, không thư viện mới, không `PointLight` / `SpotLight`, không emissive mới. Texture vẽ bằng canvas.
- Mọi thông số ở `src/config.ts`, mỗi dòng chú thích tiếng Việt, đơn vị, `(ước lượng)` khi không có nguồn.
- Comment tiếng Việt, khối tiêu đề `/* ===== ... ===== */`, tiền tố hàm: cây `tr*`, người `pp*`. Không format lại file sẵn có.
- Người không đổ bóng, không vào phản chiếu (layer 1). Không thêm UI, không thêm khóa i18n.
- **Không chạy đủ bộ test.** Chỉ chạy lệnh ghi trong từng task. Trước mỗi test trình duyệt: `npm run build`, và kiểm không còn tiến trình `*-check.mjs` mồ côi.
- Commit theo từng task trên nhánh `feature/cay-va-nguoi-thuc-te`, kết thúc message bằng `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`. Không commit `dist/`, `tests/screens/`, thư mục `150`.
- Việc cần con người quyết: ghi vào mục "Cần người dùng quyết" cuối file này, chọn phương án an toàn nhất, đi tiếp.

## Review Focus

1. Gió bão mạnh nhất (preset Bão): tán không được rời khỏi cành thấy rõ, cây đổ rồi `standTrees()` phải trả đúng ma trận gốc. Test: Task 2 bước 1 (`fallenRestore`, `windAttached`).
2. Cây đã bị dọn scale 0 (hành lang hầm, bờ sông, chân Cầu sông Hàn) phải vẫn scale 0 với hình học mới, không để lại cành hay quả dừa lơ lửng. Test: Task 2 bước 1 (`clearedStayZero`).
3. Người đứng lan can và người đi cùng không được nằm ngoài lề (xuyên lan can, đứng giữa làn xe). Test: Task 5 bước 1 (`insideSidewalk`).
4. Bật lại sau bão và bật/tắt nút người: người trở lại đúng số, không ai kẹt ở scale 0. Test: Task 5 bước 1 (`stormClear`, `toggleBack`).
5. Camera rất xa hoặc rất gần Cầu Rồng: người Cầu Rồng ẩn khi xa hơn `hideDistance`, hiện lại khi gần, không lỗi console. Test: Task 5 bước 1 (`dragonLod`).

---

## Cấu trúc file

| File | Trách nhiệm |
|---|---|
| `src/common/trees/shapes.ts` (mới) | Hình học thuần: thân + cành cây bóng mát, tán cụm lá, thân dừa, tàu lá + búi ngọn + quả, cây dừa tĩnh cho hầm |
| `src/common/trees/textures.ts` (mới) | Canvas texture: vân lá, tàu dừa răng lược (có alpha) |
| `src/common/people/gait.ts` (mới) | Toán dáng đi thuần: nhịp bước, góc khớp (bản CPU của công thức shader, cho unit test) |
| `src/common/people/shapes.ts` (mới) | Hình học người gộp + thuộc tính đỉnh |
| `src/common/people/material.ts` (mới) | Vật liệu người dùng chung, vá vertex shader |
| `src/common/people/kinds.ts` (mới) | Gán kiểu người (đi, chạy, đứng, đi cùng, trẻ em, nón, ba lô) cho một danh sách `Walker` |
| `src/common/people.ts` (sửa) | `createPeople` / `stepPeople`: giữ chữ ký, dùng các phần trên, dọn dần khi bão |
| `src/environment/pedestrians.ts` (mới) | Người trên Cầu Rồng: `buildDragonPeople` / `updateDragonPeople` |
| `src/environment/trees.ts`, `src/bridges/thuan-phuoc/site.ts`, `src/bridges/han-tunnel/outdoor.ts`, `src/core/materials.ts` (sửa) | Dùng hình học và vật liệu cây mới |
| `tests/trees-unit/`, `tests/people-unit/`, `tests/trees-check.mjs`, `tests/people-check.mjs` (mới) | Test |

---

### Task 1: Hình học và texture cây (thuần, có unit test)

**Model đề nghị:** Opus.

**Files:**
- Create: `src/common/trees/shapes.ts`, `src/common/trees/textures.ts`, `tests/trees-unit/shapes.test.ts`
- Modify: `src/config.ts` (thêm `CONFIG.trees`), `package.json` (script `test:trees:unit`: `tsx --test tests/trees-unit/*.test.ts`)

**Interfaces:**
- Produces (mọi hình học có `position`, `normal`, `uv`, `color`; không index hoặc có index đều được, nhưng thống nhất trong một hàm):
  - `trShadeTrunkGeo(): THREE.BufferGeometry` — gốc xòe + thân + 5–6 cành. Không gian chuẩn hóa: gốc ở y = 0, **đầu cành cao nhất ở y = 1**, bề ngang tính theo "bán kính tán" (đầu cành tỏa tới bán kính khoảng 0,7). Chỗ tách cành ở y ≈ 0,5. Màu vỏ nâu xám nằm trong `color`.
  - `trShadeCrownGeo(): THREE.BufferGeometry` — 8–11 cụm lá nằm trong khối cầu đơn vị tâm gốc tọa độ (mọi đỉnh có bán kính ≤ 1,12; đáy tán xuống tới y ≈ −0,75 để che đầu cành). `color` là độ sáng tương đối (sáng ở trên ≈ 1, sẫm ở dưới và trong khe ≈ 0,4), vì màu xanh đến từ `instanceColor`.
  - `trPalmTrunkGeo(): THREE.BufferGeometry` — cao 1 (y từ 0 đến 1), bán kính đáy 0,35 và đỉnh 0,2 (đơn vị trước khi instance nhân 0,8), gốc phình, vòng sẹo bằng dải màu đỉnh xen kẽ theo chiều cao (≥ 10 đoạn), **cong nhẹ**: đỉnh lệch `CONFIG.trees.palm.bend` theo +X.
  - `trPalmCrownGeo(): THREE.BufferGeometry` — gốc tọa độ là đỉnh thân; 12–16 tàu lá dài 0,75–1,15 (đơn vị = hệ số tỉ lệ đều của instance), tàu non dựng đứng, tàu già rũ xuống dưới y = 0; búi ngọn và 4–6 quả dừa gộp chung. UV tàu lá: u ngang tàu, v dọc tàu trong vùng `v ≥ 0,1`; UV búi ngọn và quả trỏ vào ô đặc `u, v ∈ [0, 0,06]` của texture tàu lá.
  - `trPalmStaticGeo(h: number): THREE.BufferGeometry` — nguyên một cây dừa cao `h` mét cho lưới bê tông gộp của hầm: thân + 8 tàu lá dạng dải thuôn **hai mặt** (nhân đôi tam giác đảo chiều quấn), không cần UV có nghĩa, có `color` xanh / nâu. ≤ 260 tam giác.
  - `trFrondTexture(): THREE.CanvasTexture`, `trLeafTexture(): THREE.CanvasTexture` trong `textures.ts` (chỉ gọi trong trình duyệt). Texture tàu lá: nền trong suốt, sống lá và lá chét đủ dày để còn thấy khi mipmap (bản thử: nét 5,2 px trên bước 8,5 px), ô đặc trắng ở góc `[0, 0,06]²`.
  - `CONFIG.trees = { maxTris: { shadeCrown: 700, shadeTrunk: 150, palmCrown: 450, palmTrunk: 120, palmStatic: 260 }, shade: { blobs, branches, ... }, palm: { fronds, bend: 0.35 /* m lệch đỉnh thân, ước lượng */, crownScale: 0.42 /* tỉ lệ đều của tán dừa trên mỗi mét cao thân… */ } }` — người làm chọn tên trường con, nhưng `maxTris` và `palm.bend` đúng tên này.

- [ ] **Bước 1: Viết test trước** `tests/trees-unit/shapes.test.ts` (mẫu: `tests/traffic-unit/shapes.test.ts`):

```ts
const tris = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.getAttribute('position').count) / 3;
test('số tam giác trong trần', () => {
  const M = CONFIG.trees.maxTris;
  assert.ok(tris(trShadeCrownGeo()) <= M.shadeCrown); assert.ok(tris(trShadeTrunkGeo()) <= M.shadeTrunk);
  assert.ok(tris(trPalmCrownGeo()) <= M.palmCrown); assert.ok(tris(trPalmTrunkGeo()) <= M.palmTrunk);
  assert.ok(tris(trPalmStaticGeo(10)) <= M.palmStatic);
});
test('đủ thuộc tính position/normal/uv/color, không NaN', () => { /* cả 5 hình */ });
test('tán bóng mát nằm trong cầu đơn vị và dẹt rộng', () => { /* max |p| ≤ 1.12; bbox: rộng X ≥ 1.7, min y ≤ -0.6 */ });
test('tán có ≥ 8 cụm: mép không tròn trơn', () => { /* bán kính ngang lớn nhất theo 24 hướng dao động ≥ 12 % */ });
test('thân bóng mát cao đúng 1, có cành tỏa', () => { /* bbox.min.y ≈ 0, max.y ≈ 1; ở y > 0.8 có đỉnh bán kính ngang ≥ 0.5; ở y < 0.3 mọi đỉnh ≤ 0.3 */ });
test('thân dừa cao 1, đỉnh lệch đúng palm.bend', () => { /* tâm các đỉnh y > 0.98 có x ≈ CONFIG.trees.palm.bend (±0.03) */ });
test('tàu dừa: có tàu dựng lên và tàu rũ xuống', () => { /* max y ≥ 0.6, min y ≤ -0.25, bán kính ngang lớn nhất ≥ 0.75 */ });
test('cây dừa tĩnh cao h, đứng trên y = 0, hai mặt', () => { /* bbox.min.y ≈ 0; max.y trong [h, h + 0.45h]; mỗi tam giác tàu lá có bản đảo chiều */ });
```

- [ ] **Bước 2:** `npm run test:trees:unit` → LỖI (chưa có module).
- [ ] **Bước 3:** Viết `shapes.ts` và `CONFIG.trees`. Cụm lá: khối cầu thấp đa giác (ví dụ `IcosahedronGeometry(1, 1)` 80 tam giác) nhiễu nhẹ, pháp tuyến hướng tâm cụm để bóng mềm; sắp như bản thử (vành ngoài thấp, vành giữa, đỉnh) nhưng ít cụm hơn.
- [ ] **Bước 4:** Viết `textures.ts` (chép ý `leafTex`, `frondTex` của bản thử; không import trong test).
- [ ] **Bước 5:** `npm run test:trees:unit` → mọi test ĐẠT. `npm run typecheck` → không lỗi.
- [ ] **Bước 6:** Commit `feat(trees): hình học cây bóng mát và cây dừa`.

---

### Task 2: Cây khu phố và Thuận Phước dùng hình mới, giữ gió / cây đổ / dây đèn / dọn cây

**Model đề nghị:** Opus.

**Files:**
- Create: `tests/trees-check.mjs`
- Modify: `src/environment/trees.ts`, `src/bridges/thuan-phuoc/site.ts`, `src/core/materials.ts`, `src/main.ts` (móc `__app.trees`), `package.json` (`test:trees`: `node tests/trees-check.mjs`), có thể `src/environment/weather/wind.ts`

**Interfaces:**
- Consumes: mọi hàm `tr*` của Task 1.
- Produces: `treesTest` (export từ `src/environment/trees.ts`, gắn vào `__app.trees` khi `?test`): `{ meshes(): { name: string; count: number; tris: number }[]; positions(name: string): number[] }` — `positions` trả `[x, z]` của từng instance (làm tròn 3 chữ số). Tên lưới: `trees-shade-trunk`, `trees-shade-crown`, `trees-palm-trunk`, `trees-palm-crown`, `tp-trees-trunk`, `tp-trees-crown`.

**Quy ước ma trận instance (quyết định của plan, giữ để `fallen.ts`, `promenade.ts`, dọn cây không phải sửa):**

| Lưới | Vị trí | Tỉ lệ | Xoay |
|---|---|---|---|
| thân bóng mát | `(x, landY, z)` như cũ | `(r, h + 0.6·r, r)` (cũ: `(1, h, 1)`) | yaw theo hash chỉ số |
| tán bóng mát | `(x, landY + h + 0.6·r, z)` **như cũ** | `(r, 0.85·r, r)` **như cũ** | cùng yaw |
| thân dừa | `(x, landY, z)` như cũ | `(0.8, h, 0.8)` như cũ | yaw theo hash chỉ số |
| tán dừa | đỉnh thân sau khi cong và xoay: `(x, landY + h, z) + Ry(yaw)·(0.8·bend, 0, 0)` | đều `s = CONFIG.trees.palm.crownScale · h` (cũ: `(3.8, 1.6, 3.8)`) | cùng yaw |

`h`, `r`, sắc xanh vẫn lấy từ đúng các lời gọi `rand()` / `rnd()` hiện có, đúng thứ tự. `setColorAt` của tán bóng mát giữ nguyên.

**Vật liệu (`src/core/materials.ts`):** `MAT.trunk`: `color` trắng + `vertexColors: true` (màu vỏ nằm trong hình học). `MAT.leaf`: thêm `vertexColors: true`, `map` = `trLeafTexture()`. `MAT.palm`: `color` trắng, `vertexColors: true`, `map` = `trFrondTexture()`, `alphaTest: 0.4`, giữ `DoubleSide`. Sau khi đổi, `grep -rn "MAT\.trunk\|MAT\.leaf\|MAT\.palm" src` và bảo đảm **mọi** lưới dùng ba vật liệu này có thuộc tính `color` (thiếu thì ra màu đen).

- [x] **Bước 1: Viết `tests/trees-check.mjs` trước, chạy trên code CHƯA sửa để lấy mốc.** Mẫu: `tests/traffic-check.mjs` (dùng `serveDir`, `launch`, `openApp`, `frames`, `setWx`). Tạm thêm `treesTest` tối thiểu (chỉ `positions` đọc từ 4 lưới cũ theo vật liệu) để in ra mốc, rồi chép vào hằng số trong test:
  - `MAIN_TREE_POS`: số instance và tổng kiểm (ví dụ tổng `x·31 + z` làm tròn) của vị trí `[x, z]` từng loại cây khu phố và cây Thuận Phước; `MAIN_BOAT_SPEEDS` chép từ `tests/traffic-check.mjs`.
  - Các kiểm tra:
    1. `meshCount`: đúng 6 lưới tên ở trên, không còn `SphereGeometry` / `ConeGeometry` nào dùng `MAT.leaf` / `MAT.palm`.
    2. `posKept`: số instance và tổng kiểm vị trí khớp `MAIN_TREE_POS`.
    3. `randKept`: tốc độ 7 tàu chạy chung khớp `MAIN_BOAT_SPEEDS` (cây dựng trước xe và tàu, nên lệch `rand()` là lộ ngay).
    4. `trisBudget`: `tris` mỗi lưới ≤ trần ở `CONFIG.trees.maxTris`.
    5. `pairs`: `__app.weather.fallen.state().pairs` bằng giá trị đo trên code chưa sửa.
    6. `fallenRestore`: chụp `fallen.snapshot()`, `fallen.fell()`, chờ đổ xong, `fallen.stand()`, snapshot bằng đúng bản đầu.
    7. `clearedStayZero`: số instance tán có scale 0 (đã dọn) bằng giá trị đo trên code chưa sửa, và thân cùng chỉ số cũng scale 0.
    8. `windAttached`: preset Bão, chờ gió ổn định; không lỗi shader; `swayNow().treeLean > 0`.
    9. Không lỗi console.
    10. Ảnh (bỏ bằng `--no-shots`) vào `tests/screens/trees-*.png`: cây bóng mát và dừa gần 20 m trên bờ Bạch Đằng (ngày), toàn cảnh mặc định (ngày), dải đi bộ Bạch Đằng (đêm, thấy dây đèn), kè Thuận Phước, bờ sông khi Bão.
- [x] **Bước 2:** `npm run build && npm run test:trees -- --no-shots` trên code chưa sửa: `posKept`, `randKept`, `pairs`, `fallenRestore`, `clearedStayZero` ĐẠT; `meshCount` LỖI. Chép mốc vào test.
- [x] **Bước 3:** Sửa `materials.ts`, `trees.ts`, `site.ts` theo bảng trên; hoàn thiện `treesTest`.
- [x] **Bước 4:** Gió: thân và cành không lắc trong khi tán dịch tới 0,06 m mỗi mét cao. Nếu ảnh Bão cho thấy tán rời cành, vá thêm `MAT.trunk` bằng `patchTree(MAT.trunk, 'tree-trunk-wind')` trong `wind.ts` (cùng công thức nên thân, cành, tán nghiêng cùng nhau). Ghi lựa chọn vào comment đầu `wind.ts`.
- [x] **Bước 5:** `npm run build && npm run test:trees` → mọi kiểm tra ĐẠT. **Mở và nhìn** từng ảnh `tests/screens/trees-*.png`: cây ra dáng theo G1, G2; dây đèn đêm bám tán; không có cây đen, không có mảng vuông trong suốt sai. Chỉnh hình / màu cho tới khi đạt.
- [x] **Bước 6:** `npm run test:trees:unit`, `npm run typecheck` → ĐẠT.
- [x] **Bước 7 (cổng hiệu năng, một lần):** `npm run test:perf -- --strict`. ĐẠT thì ghi số vào mục "Kết quả" cuối file này. LỖI: giảm số cụm lá / tàu lá một lần, chạy lại; vẫn LỖI thì ghi vào "Cần người dùng quyết" kèm số đo và đi tiếp.
- [ ] **Bước 8:** Commit `feat(trees): cây bóng mát và cây dừa thay quả cầu và nón ở khu phố, Thuận Phước`.

---

### Task 3: Hàng dừa cửa hầm

**Model đề nghị:** Sonnet.

**Files:**
- Modify: `src/bridges/han-tunnel/outdoor.ts` (`hrBuildDecor`), `tests/trees-check.mjs`

**Interfaces:**
- Consumes: `trPalmStaticGeo(h)` (Task 1), `prepColored` đang dùng trong file.

- [x] **Bước 1:** Thêm vào `tests/trees-check.mjs`: `tunnelPalms` — số `InstancedMesh` và `Mesh` con của nhóm hầm không đổi so với giá trị đo trước khi sửa (chạy một lần trước để lấy số); lưới bê tông của hầm tăng số tam giác (có cây mới); không lỗi console. Thêm ảnh `trees-tunnel-portal.png` (cửa hầm phía Đông, ngày).
- [x] **Bước 2:** Trong `hrBuildDecor`, thay cặp `tg` + `cg` bằng `trPalmStaticGeo(h)` đặt tại `(x, y, z)`, xoay yaw theo chỉ số (không gọi thêm `rnd()`), vẫn đẩy vào `bridge.concreteParts` qua `prepColored` (giữ màu đỉnh của hình). Thứ tự và số lời gọi `rnd()` giữ nguyên: mỗi cây vẫn đúng 1 lời gọi lấy `h`.
- [x] **Bước 3:** `npm run build && npm run test:trees` → ĐẠT; nhìn ảnh cửa hầm: hàng dừa ra dáng dừa, tàu lá không bị mất mặt sau.
- [x] **Bước 4:** `npm run test:tunnel` (một lần; test này chạm trực tiếp phần vừa sửa) → ĐẠT, hoặc ghi lỗi có sẵn không liên quan.
- [x] **Bước 5:** Commit `feat(trees): hàng dừa cửa hầm dùng dáng dừa mới`.

---

### Task 4: Hình học, dáng đi và vật liệu người (thuần, có unit test)

**Model đề nghị:** Opus.

**Files:**
- Create: `src/common/people/gait.ts`, `src/common/people/shapes.ts`, `src/common/people/material.ts`, `src/common/people/kinds.ts`, `tests/people-unit/gait.test.ts`, `tests/people-unit/shapes.test.ts`, `tests/people-unit/kinds.test.ts`
- Modify: `src/config.ts` (`CONFIG.people`), `package.json` (`test:people:unit`: `tsx --test tests/people-unit/*.test.ts`)

**Interfaces:**
- Produces:
  - `CONFIG.people`: `maxVerts: 900`; `legLength: 0.86` (m); `walk: { amp: 0.34, speed: [1.05, 1.35] }`; `run: { amp: 0.6, speed: [2.6, 3.0], cadence: 8.8 /* rad/s, ≈ 1,4 chu kỳ/giây */, lean: 0.17 }`; `mix: { run: 0.12, stand: 0.2, companion: 0.18, child: 0.25 /* phần người đi cùng là trẻ em */, hat: 0.25, pack: 0.25, photo: 0.33 /* phần người đứng giơ tay chụp ảnh */ }`; `adultScale: [0.94, 1.08]`, `childScale: 0.6`, `companionGap: 0.6` (m); `shirts`, `pants` (mảng màu hex; 7 màu áo cũ đứng đầu); `dragon: { n: 70, seed: 4107, hideDistance: 1500, headBias: … }`.
  - `gait.ts`: `export type PersonKind = 'walk' | 'run' | 'stand'`;
    `ppCadence(kind: PersonKind, speed: number, scale: number): number` — rad/s; đi: `2π·speed / (4·legLength·scale·sin(walk.amp))`; chạy: `run.cadence / √scale`; đứng: 0.
    `ppAngles(part: 'legL' | 'legR' | 'armL' | 'armR', amp: number, phase: number): { root: number; joint: number }` — đúng công thức §5 của spec, trộn đi/chạy bằng `run = smoothstep(0.42, 0.6, amp)` như bản thử.
    `ppStride(kind, scale): number` — quãng đường một chu kỳ (m).
  - `shapes.ts`: `ppBuildGeometry(): THREE.BufferGeometry` — người cao khoảng 1,65 m ở tỉ lệ 1, **mặt hướng +X**, chân chạm y = 0; thuộc tính đỉnh `aPart` (0 thân/đầu/tóc, 1 chân trái, 2 chân phải, 3 tay trái, 4 tay phải, 5 nón lá, 6 ba lô), `aSeg` (0 đoạn trên, 1 đoạn dưới khớp), `aPivot` (cao độ hông 0,86 / vai 1,37), `aPivot2` (gối 0,46 / khuỷu 1,1), `aMask` (0 màu cố định, 1 áo, 2 quần), `aFix` (vec3 màu cố định: da, tóc, giày, nón, ba lô). `export const PP_HIP = 0.86, PP_KNEE = 0.46, PP_SHOULDER = 1.37, PP_ELBOW = 1.1`.
  - `material.ts`: `ppMaterial(): THREE.MeshStandardMaterial` — một vật liệu dùng chung (tạo một lần), vá vertex shader như bản thử, đọc `shared.uTime`; thuộc tính instance: `aVar` (vec4: pha, biên độ, cờ, nhịp), `aPants` (vec3), áo qua `instanceColor`. Cờ: 1 nón, 2 ba lô, 4 chụp ảnh. `customProgramCacheKey` cố định. Thêm vật liệu vào tập bóc mặt cắt hầm nếu `cutaway.ts` cần (xem cách D-027 làm với xe).
  - `kinds.ts`:
    ```ts
    export interface PersonInfo { kind: PersonKind; scale: number; flags: number; phase: number; follow: number /* chỉ số người mình đi cùng, −1 nếu không */ }
    export function ppAssignKinds(n: number, seed: number, opts?: { run?: boolean }): PersonInfo[]
    ```
    Dùng `rng(seed)` riêng. Tỉ lệ theo `CONFIG.people.mix` (sai số ±1 người). Người đi cùng luôn có `follow = i − 1`, và người `i − 1` phải là `'walk'` không đi cùng ai. `opts.run === false` → không ai `'run'`. Người `'stand'` có cờ chụp ảnh theo `mix.photo`. Trẻ em: `scale = childScale`, luôn là người đi cùng.

- [ ] **Bước 1: Viết test trước.**
  - `gait.test.ts`: đi bộ không trượt: `ppCadence('walk', v, s) · ppStride('walk', s) / 2π ≈ v` (sai số 1 %) với `v ∈ {1.05, 1.2, 1.35}`, `s ∈ {0.6, 1, 1.08}`; chạy ≈ 1,4 chu kỳ/giây ở `s = 1`; đứng = 0; `ppAngles('legL', 0.34, φ)` và `('legR', …)` lệch pha π; gối luôn ≤ 0 (gập về sau); biên độ hông khi đi ≤ 0,4 rad; khi chạy gối gập sâu nhất ≥ 1,5 rad; tay ngược dấu chân cùng bên ở `φ = π/2`.
  - `shapes.test.ts`: số đỉnh ≤ `CONFIG.people.maxVerts`; bbox: cao 1,6–1,9 (tính cả nón), `min.y` ≈ 0, rộng Z ≤ 0,7; đủ 7 giá trị `aPart`; mọi đỉnh `aSeg = 1` có `aPart ∈ 1..4`; đỉnh chân có `aPivot = PP_HIP`; không NaN.
  - `kinds.test.ts`: `ppAssignKinds(80, 1)` dài 80; cùng seed cho cùng kết quả; tỉ lệ từng kiểu trong ±2 người so với `mix`; mọi `follow ≥ 0` thỏa điều kiện trên; `{ run: false }` không có `'run'`; trẻ em luôn có `follow ≥ 0`.
- [ ] **Bước 2:** `npm run test:people:unit` → LỖI.
- [ ] **Bước 3:** Viết bốn file và `CONFIG.people` (hình và shader: xuất phát từ `personGeo`, `patchPerson` của bản thử; giảm số cạnh để ≤ 900 đỉnh).
- [ ] **Bước 4:** `npm run test:people:unit`, `npm run typecheck` → ĐẠT.
- [ ] **Bước 5:** Commit `feat(people): hình học, dáng đi và vật liệu người đi bộ`.

---

### Task 5: Người mới ở Trần Thị Lý, Cầu sông Hàn, Cầu Rồng; rời cầu dần khi bão

**Model đề nghị:** Opus.

**Files:**
- Create: `src/environment/pedestrians.ts`, `tests/people-check.mjs`
- Modify: `src/common/people.ts`, `src/bridges/tran-thi-ly/life.ts`, `src/bridges/song-han/life.ts`, `src/bridges/tran-thi-ly/materials.ts`, `src/bridges/song-han/materials.ts` (bỏ `person` nếu không còn dùng), `src/main.ts` (gọi dựng, cập nhật, móc `__app.people`), `package.json` (`test:people`: `node tests/people-check.mjs`)

**Interfaces:**
- Consumes: Task 4.
- Produces:
  - `Walker` thêm trường tùy chọn: `kind?: PersonKind; scale?: number; flags?: number; phase?: number; face?: number /* rad quanh Y, chỉ cho người đứng */`.
  - `createPeople(bridge, list, name, rnd)` — bỏ tham số `mat` (dùng `ppMaterial()`); `rnd` vẫn dùng để chọn màu áo **đúng một lời gọi mỗi người như cũ**; màu quần từ hash chỉ số.
  - `stepPeople(P, dt, elapsed, closable = true)` — người thứ `i` ẩn (scale 0) khi `closable && vanished(i, weatherFx.clear)`; người đứng không di chuyển; người có `follow` chép vị trí người dẫn cộng lệch.
  - `ppApplyKinds(list: Walker[], infos: PersonInfo[], place: (w: Walker, info: PersonInfo, i: number) => void): void` trong `people.ts` — gán `kind`, `scale`, `flags`, `phase`; với người chạy đặt `speed` trong `CONFIG.people.run.speed`; với người đi cùng chép `x`, `z`, `dir`, `speed`, `lo`, `hi`, `axis`, `profile` của người dẫn rồi lệch ngang `companionGap` (về phía trong lề); gọi `place` cho người đứng để từng cầu đặt sát lan can và đặt `face`.
  - `src/environment/pedestrians.ts`: `buildDragonPeople(): void`, `updateDragonPeople(dt: number, elapsed: number, cam: THREE.Camera): void`, `export const peopleTest = { systems(): { name: string; count: number; visible: number }[] }` (đếm cả `ttl-people`, `sh-people`, `dragon-people` bằng cách tìm theo tên trong `scene`; `visible` = số instance scale > 0).

**Đặt người (quyết định của plan):**
- Trần Thị Lý: 46 người lề cầu `ppAssignKinds(46, 1966)`; 34 người cầu Nguyễn Văn Trỗi `ppAssignKinds(34, 1967, { run: false })`. Người đứng trên lề cầu: `z = ±(TTL.hw − 0.55)`, mặt quay ra ngoài cầu; trên Nguyễn Văn Trỗi: mép gần nhất của dải `nvtZ ± 3`, lùi vào 0,4 m, mặt quay ra ngoài.
- Cầu sông Hàn: 36 người lề cầu `ppAssignKinds(36, 2904)`, người đứng `z = ±(SH.hw − 0.55)`; 40 người Bạch Đằng `ppAssignKinds(40, 2905)`, người đứng ở `x = −264.5` (sát lan can kè, mép kè x = −262), mặt quay về +X (ra sông).
- Thứ tự lấy `rnd()` khi dựng `list` giữ nguyên từng dòng; `ppApplyKinds` chạy **sau** khi `list` dựng xong và **trước** `createPeople`.
- Cầu Rồng (`buildDragonPeople`, gọi trong `main.ts` ngay sau `new SunWheel()` / trước `buildWeather()`; `updateDragonPeople` gọi trong `animate` cạnh `updateTraffic`): `rng(CONFIG.people.dragon.seed)`; 70 người; `x ∈ [−325, 325]`, hai lề `z = ±(CONFIG.width / 2 − CONFIG.sidewalk / 2 − 0.15)`, `y = deckY(x) + 0.25`; người đứng `z = ±(CONFIG.width / 2 − 0.5)` mặt quay ra ngoài, và hai phần ba số người đứng có `x > 150` (đầu rồng ở phía Đông, +X). Nhóm tên `dragon-people` thêm vào `scene`, mọi lưới `layers.set(1)`, `frustumCulled = false`; ẩn cả nhóm khi camera xa tim cầu hơn `hideDistance`. Đóng cầu khi bão: `closable = true`.
- Hai cầu `BridgeBase`: giữ `peopleOn`, nút bật/tắt và `details.visible` như cũ.

- [ ] **Bước 1: Viết `tests/people-check.mjs` trước** (mẫu `tests/traffic-check.mjs`):
  1. `systems`: đúng 3 hệ `ttl-people` 80, `sh-people` 76, `dragon-people` 70; mỗi hệ đúng 1 `InstancedMesh`, cùng một vật liệu.
  2. `noOldShape`: không còn lưới người nào ≤ 200 đỉnh (ống trụ cũ).
  3. `moving`: sau 60 khung, ≥ 60 % instance đã đổi vị trí; số instance đứng yên khớp số người `'stand'` (±1).
  4. `insideSidewalk`: mọi instance hiện của `dragon-people` có `|z| ∈ [CONFIG.width/2 − CONFIG.sidewalk, CONFIG.width/2]` và `y ≥ deckY(x)`; tương tự cho lề hai cầu kia (đọc hằng số qua `page.evaluate`, hoặc chép số vào test kèm comment nguồn).
  5. `stormClear`: `setWx('storm')`, chờ `clearSec`: `visible = 0` ở cả 3 hệ; giữa chừng (≈ nửa thời gian) `0 < visible < count`; hết bão: `visible = count`.
  6. `toggleBack`: bấm `#btnTtlPeople` hai lần (dùng `tap` của `lib.mjs`): nhóm ẩn rồi hiện lại đủ 80.
  7. `dragonLod`: đặt camera xa tim Cầu Rồng 2 000 m → nhóm `dragon-people` `visible === false`; về 300 m → `true`.
  8. `randKept`: tốc độ 7 tàu khớp `MAIN_BOAT_SPEEDS` (người Cầu Rồng không được chạm `rand()`).
  9. Không lỗi console (kể cả lỗi biên dịch shader).
  10. Ảnh `tests/screens/people-*.png`: lề Cầu Rồng gần 10 m (ngày), lề Trần Thị Lý, lề Cầu sông Hàn, Bạch Đằng, và một ảnh đêm trên Cầu Rồng.
- [ ] **Bước 2:** `npm run build && npm run test:people -- --no-shots` → LỖI ở `systems` / `noOldShape`.
- [ ] **Bước 3:** Sửa `people.ts`, hai `life.ts`, viết `pedestrians.ts`, nối `main.ts`.
- [ ] **Bước 4:** `npm run build && npm run test:people` → ĐẠT. **Mở và nhìn** từng ảnh: người đứng trên lề (không lơ lửng, không chìm), mặt hướng theo chiều đi, người đứng quay ra sông, có nón lá / ba lô / trẻ em, áo quần đủ màu.
- [ ] **Bước 5:** `npm run test:people:unit`, `npm run test:trees -- --no-shots`, `npm run typecheck` → ĐẠT.
- [ ] **Bước 6:** Commit `feat(people): người có tay chân đi, chạy, đứng lan can; thêm người Cầu Rồng; rời cầu khi bão`.

---

### Task 6: Tài liệu, memory bank, pull request, merge

**Model đề nghị:** Sonnet cho tài liệu; phiên chính tạo PR và merge.

**Files:**
- Modify: `tests/KET-QUA.md`, `README.md` (mục Cấu trúc: `src/common/trees/`, `src/common/people/`, `src/environment/pedestrians.ts`, test mới), `.github/copilot-instructions.md` §5 (4 lệnh test mới), `.github/memory-bank/decisions.md` (D-028), `.github/memory-bank/activeContext.md`, `.github/memory-bank/progress.md`, `.github/memory-bank/systemPatterns.md` (quy ước ma trận cặp thân/tán; người một lưới mỗi hệ), file này (đánh dấu bước, mục Kết quả)

- [ ] **Bước 1:** `npm run test:weather` và `npm run test:riverfront`, mỗi lệnh một lần (chạm trực tiếp cây đổ, gió, dây đèn, dọn cây). Ghi kết quả thật. Nếu lỗi do thay đổi này thì sửa; nếu test so ảnh / số đo cũ không còn đúng vì cây đổi dáng thì cập nhật mốc và ghi rõ.
- [ ] **Bước 2:** Ghi `tests/KET-QUA.md`: mục mới cho D-028 gồm số tam giác từng lưới cây, số đỉnh người, số lưới (cây 6, người 3), kết quả các test đã chạy, và danh sách **chưa chạy** theo yêu cầu người dùng: `test:drawcalls`, so thời gian khung với `main`, `test:citynight -- --baseline` (mốc sẽ đổi vì cây đổi dáng), `test:tour`, `test:voice`, `test:sunwheel`, `test:mobile`, `test:explore`, `test:boats`, `test:traffic`, `test:multi*`; FPS GPU thật chưa đo.
- [ ] **Bước 3:** Cập nhật memory bank theo `.github/prompts/update-memory-bank.prompt.md`: D-028 trong `decisions.md`; hàng mới ở `progress.md`; `activeContext.md` có mục **"Cần người dùng quyết"** chép từ cuối file này.
- [ ] **Bước 4:** `npm run typecheck && npm run build` → ĐẠT. Commit `docs(trees-people): kết quả, README, memory bank (D-028)`.
- [ ] **Bước 5:** `git push -u origin feature/cay-va-nguoi-thuc-te`; `gh pr create` (tiêu đề tiếng Việt, mô tả: tóm tắt, test đã chạy / chưa chạy, mục cần người dùng quyết; kết thúc bằng dòng `🤖 Generated with [Claude Code](https://claude.com/claude-code)`); `gh pr merge --merge`; về `main`, `git pull`.

---

## Kết quả

_(điền khi làm)_

### Task 2 (2026-11-11)
- Mốc đo trên code chưa sửa (`8c56cdd`, `test:trees -- --no-shots`): `meshCount` LỖI (quả cầu / nón), các mục khác ĐẠT. Mốc: cây bóng mát khu phố 890, dừa 246, Thuận Phước 128; 3 cặp thân–tán; tán đã dọn 26 / 2 / 0.
- `npm run test:trees` (có ảnh): **Tất cả ĐẠT** — 6 lưới; tam giác mỗi cây: thân bóng mát 150, tán 640, thân dừa 120, tán dừa 396; vị trí khớp mốc; 7 tốc độ tàu trùng `main`; cây đổ dựng lại trùng ma trận; bão `treeLean` 0,03 m/m; không lỗi console.
- `npm run test:trees:unit` 8/8, `npm run typecheck` ĐẠT.
- Gió: vá thêm `MAT.trunk` (`tree-trunk-wind`) để tán dừa không rời đỉnh thân (ghi ở đầu `wind.ts`).
- `npm run test:perf -- --strict` (một lần, 2026-11-11, ~90 phút trên SwiftShader): **perf-check: đạt** — mọi thao tác +0 program, render dài nhất ≤ 77 ms (ngưỡng 150). Khung đầu 26 646 ms, 172 program. Render trung bình (ms) overview 24,7 · head 26,0 · hrOverview 21,9 · swOverview 13,7 · tpBay 20,2; draw call 268 / 288 / 252 / 150 / 262. So với lần đo 2026-11-09 (trước D-026, D-027, cây mới; không cùng mốc): render 14,8 / 14,0 / 13,0 / 8,2 / 13,3, khung đầu 9 206 ms. Thời gian so với `main` hiện tại: **chưa đo**.

## Cần người dùng quyết

_(điền khi làm; chép sang `activeContext.md` ở Task 6)_

- So thời gian khung với `main` (mong muốn lệch ≤ 15 %) và `test:drawcalls` chưa chạy theo yêu cầu; có chạy bù không.
- (Task 2) `test:perf --strict` đạt, nhưng thời gian render trung bình trên SwiftShader cao hơn khoảng 1,6–1,9 lần so với lần đo 2026-11-09 (mốc đó trước cả D-026, D-027), khung đầu 26,6 s so với 9,2 s. Tổng tam giác cây khoảng 0,93 triệu (cũ ≈ 0,17 triệu), vẽ ở các lượt cảnh, bóng và phản chiếu. Nếu GPU thật thấy chậm: giảm cụm lá (`CONFIG.trees.shade.blobs`) / tàu lá (`palm.fronds`), hoặc bỏ cây khỏi lượt phản chiếu.
- Mức chi tiết cây sau khi giản lược (≤ 850 và ≤ 570 tam giác mỗi cây) thấp hơn bản dựng thử đã duyệt; xem demo rồi quyết có cần tăng (đổi lấy độ mượt) không.
- Cầu Rồng 70 người, ngày đêm như nhau; có muốn đông hơn về đêm / cuối tuần không.
