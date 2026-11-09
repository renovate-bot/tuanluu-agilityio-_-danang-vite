# Ánh đèn đêm đa sắc trên tòa nhà — Kế hoạch thực hiện

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Về đêm, các tòa nhà có đèn vàng ấm, tháp xanh, viền LED và mặt sông có vệt phản chiếu dài; ban ngày giữ nguyên.

**Architecture:** Chỉ sửa shader. `patchWindows` có thêm biến thể theo từng tòa (định danh lấy từ `instanceMatrix`), `farMat` có ánh vàng, shader nước kéo vệt từ ảnh mirror sẵn có. Mọi đóng góp mới nhân `uNight`.

**Tech Stack:** Vite 6, TypeScript 5.9, three@0.165, GLSL, Playwright + SwiftShader.

**Spec:** [2026-11-09-den-dem-toa-nha-design.md](../specs/2026-11-09-den-dem-toa-nha-design.md)

## Global Constraints

- Không thêm/bớt lời gọi `rand()`, không đổi thứ tự `build*()`; không dùng `rng()` mới.
- Draw call chênh 0 ở mọi góc cũ (trừ dao động `swTour` đã biết, D-018); không thêm mesh hay lượt vẽ.
- Không `PointLight`/`SpotLight` mới, không ảnh ngoài, không thư viện runtime, không UI hay khóa i18n mới.
- Thông số ở `CONFIG.cityNight` (`src/config.ts`): chú thích tiếng Việt, đơn vị, `(ước lượng)`.
- Không tăng mirror 512². `test:perf --strict` đạt, 0 chương trình shader mới sau khởi động.
- Comment tiếng Việt; làm trên `feature/den-dem-toa-nha` tách từ `main`, trong worktree riêng; không chạm các thay đổi dù lượn ban đêm đang dở ở thư mục chính.
- Test SwiftShader nặng chỉ chạy một lần ở cuối nhánh (Task 3); không chạy hai test cùng lúc; trước đó kiểm tiến trình `*-check.mjs` mồ côi.

## Review Focus

1. Instance đã thu về scale 0 (hành lang Hầm, riverfront, Vòng quay): vẫn vô hình về đêm → Task 1, mục `corridor`.
2. Lúc chuyển ngày → đêm (`uNight` = 0,5): độ sáng tăng dần, không bật đột ngột → Task 2, mục `dusk`.
3. Bậc chất lượng tắt phản chiếu (`reflectState.every = 0`): mặt nước không có vệt sai, không lỗi → Task 2, mục `noMirror`.
4. Mặt cắt Hầm ban đêm: vật liệu nhà vẫn bị bóc đúng, gồm `farMat` đã vá → `test:tunnel`, Task 3.
5. Địa danh riverfront: dùng đúng khóa cache `windows` cũ → Task 1, mục `landmark`.

---

### Task 1: Đèn theo từng tòa (G1–G4, G6)

**Files:**
- Modify: `src/config.ts` (thêm `cityNight`), `src/common/shaders.ts:8-40`, `src/environment/city.ts:31-32`, `src/bridges/thuan-phuoc/materials.ts:23`, `src/main.ts` (thêm vào `__app` nếu thiếu), `package.json`
- Test: `tests/citynight-check.mjs` (mới)

**Interfaces:**
- Produces: `CONFIG.cityNight`, `patchWindows(mat: Mat, opts?: { perBuilding?: boolean }): void`, `patchFarGlow(mat: Mat): void`, script `test:citynight`, các hàm trong test `setNight(page, v)`, `aim(page, pos, target)`, `sample(page, rect)`.

- [ ] **Step 1: Tạo worktree và chụp mốc chuẩn**

Dùng superpowers:using-git-worktrees, tạo `feature/den-dem-toa-nha` từ `main`; chép spec và plan này sang. Cài phụ thuộc, `npm run build`, rồi dùng `tests/citynight-check.mjs --baseline` (viết ở Step 2) lưu `tests/screens/citynight-base-{day,night}.png` từ bản **chưa sửa**.
Khung chụp `aim([0, 28, 500], [0, 30, -1200])`, 960×540.

- [ ] **Step 2: Viết test đỏ**

Theo `tests.instructions.md`. Các mục:
- `dayDiff`: `uNight = 0`, chênh RGB trung bình so với `citynight-base-day.png` < 3/255 (nước và xe động nên có dung sai).
- `warmDominant`: đêm, trong các pixel sáng ở nửa trên ảnh, nhóm ấm (`r>150, b<0.75r`) ≥ 60 %.
- `coolSeen`: nhóm xanh (`b>150, r<0.7b`) ≥ 0,1 % số pixel nửa trên.
- `ledSeen`: nhóm tím/hồng (`r>150, b>130, g<0.65·min(r,b)`) ≥ 0,05 % số pixel nửa trên.
- `landmark`: material của mesh `rf-landmarks` có `customProgramCacheKey() === 'windows'`; material nhà gần trong LOD có khóa `'windows-city'`.
- `corridor`: đêm, `aim([-500, 120, -1700], [-500, 0, -1699])`, 10 % giữa ảnh không có pixel ấm sáng.
- `errors` console rỗng.

Thêm `"test:citynight": "node tests/citynight-check.mjs"`.

- [ ] **Step 3: Chạy test, xác nhận đỏ**

Run: `npm run test:citynight -- --no-shots`
Expected: FAIL ở `coolSeen`, `ledSeen`, `landmark`; `dayDiff` đạt.

- [ ] **Step 4: Thêm `CONFIG.cityNight`**

Giá trị khởi điểm, đều `(ước lượng)`: `towerH: 60` (m), `lowLit: 0.58`, `towerLit: 0.85` (tỉ lệ cửa sổ sáng), `lowGain: 1.3`, `towerGain: 1.9`, `coolShare: 1/6`, `ledBand: 1.2` (m), `ledEdgeFrac: 0.5` (phần trên cạnh đứng), `ledWidth: 0.7` (m), `ledGain: 3.2`, `farGlow: 0.16`.

- [ ] **Step 5: Sửa `patchWindows`**

Không truyền `opts`: GLSL và khóa `'windows'` giữ nguyên từng ký tự. `perBuilding: true`: khóa `'windows-city'`, thêm các varying hằng theo instance:
- `vBId` = `(modelMatrix * instanceMatrix[3]).xz`; `vBSize` = độ dài ba cột đầu của `instanceMatrix`.
- Nhánh `#ifdef USE_INSTANCING`. Không chia cho kích thước, để instance scale 0 an toàn.

Trong emissive: `seed = bHash(vBId)`. Bảng 4 sắc vàng ấm chọn theo `seed` (giữ `vec3(1.0, 0.78, 0.46)` là một sắc). `isTower = step(towerH, vBSize.y)`. Tháp có `seed2 < coolShare` dùng xanh dương/xanh ngọc. Ngưỡng sáng từ `lowLit`/`towerLit`, cường độ từ `lowGain`/`towerGain`. Giữ `bHash(cl + …)` cho từng cửa sổ.
LED chỉ khi `isTower`: mặt bên trong `ledBand` tính từ đỉnh, và góc đứng trong `ledWidth` tính từ cạnh trên phần `ledEdgeFrac`. Màu từ `LED_PALETTES` hoặc bảng tím/hồng/xanh/vàng, cố định theo `seed`. Không phụ thuộc `uTime`. Mọi đóng góp nhân `uNight`.

Gọi `perBuilding: true` ở `city.ts:31` và `thuan-phuoc/materials.ts:23`. Số từ config chèn vào GLSL dạng hằng (`toFixed`), không thêm uniform ngoài `uNight`.

- [ ] **Step 6: `patchFarGlow`**

Khóa `'far-glow'`, gắn cho `farMat`, cộng `vec3(1.0, 0.75, 0.42) * farGlow * uNight` vào `totalEmissiveRadiance` chỉ trên mặt bên.

- [ ] **Step 7: Xanh test và kiểm mắt**

Run: `npm run typecheck && npm run build && npm run test:citynight`
Expected: PASS. Xem `tests/screens/citynight-night.png`, chỉnh `CONFIG.cityNight` nếu cầu vồng lấn át vàng.

- [ ] **Step 8: Commit**

```bash
git add src tests/citynight-check.mjs package.json docs/superpowers
git commit -m "feat(city): đèn đêm vàng ấm, tháp xanh, viền LED theo từng tòa"
```

### Task 2: Vệt phản chiếu trên sông (G5)

**Files:**
- Modify: `src/core/water.ts:36-45`, `src/config.ts`, `src/main.ts` (`reflectState` vào `__app` nếu thiếu)
- Test: `tests/citynight-check.mjs`

**Interfaces:**
- Consumes: các hàm test của Task 1, `CONFIG.cityNight`.
- Produces: `CONFIG.cityNight.streak = { taps: 6, reach: 0.09, threshold: 0.35, gain: 1.6 }` (`(ước lượng)`; `reach` theo tọa độ mirror).

- [ ] **Step 1: Thêm test đỏ**

- `streak`: đêm, độ sáng trung bình dải 40 % dưới ảnh ≥ 1,3 lần `citynight-base-night.png`.
- `dusk`: độ sáng toàn ảnh ở `uNight` 0 ≤ 0,5 ≤ 1 (đặt qua `dayNight`).
- `noMirror`: `reflectState.every = 0`, đêm: độ lệch chuẩn độ sáng dải nước < 12/255; `errors` rỗng; trả `every = 1`.

- [ ] **Step 2: Chạy, xác nhận `streak` đỏ**

Run: `npm run build && npm run test:citynight -- --no-shots`
Expected: FAIL ở `streak`.

- [ ] **Step 3: Vá shader nước trong `buildWater`, trước lần biên dịch đầu**

`water.material.uniforms.uNight = shared.uNight`. Thay đúng chuỗi `vec3 reflectionSample = vec3( texture2D( mirrorSampler, mirrorCoord.xy / mirrorCoord.w + distortion ) );`, có `if` báo lỗi khi chuỗi không còn khớp với three.

Dòng gốc giữ nguyên, sau đó khi `uNight > 0.001`: lấy `taps` mẫu dọc trục V của mirror, trọng số giảm dần, cộng `max(c - threshold, 0.0) * gain * uNight` vào `reflectionSample`. Hướng V chọn sao cho vệt kéo **về phía camera**, xác định bằng ảnh chụp. Giữ `distortion` để vệt gợn theo sóng.

- [ ] **Step 4: Xanh test và kiểm mắt**

Run: `npm run typecheck && npm run build && npm run test:citynight`
Expected: PASS. Đối chiếu `citynight-night.png` với ảnh tham chiếu.

- [ ] **Step 5: Commit**

```bash
git add src/core/water.ts src/config.ts src/main.ts tests/citynight-check.mjs
git commit -m "feat(water): vệt đèn phản chiếu dài trên sông về đêm"
```

### Task 3: Người dùng duyệt, đủ bộ test, tài liệu

**Files:**
- Modify: `tests/KET-QUA.md`, `.github/copilot-instructions.md` (§5 thêm lệnh), `.github/memory-bank/{decisions,activeContext,progress}.md`

- [ ] **Step 1: Gửi ảnh ngày/đêm cho người dùng duyệt** (tiêu chí 2 của spec); chỉnh `CONFIG.cityNight` theo phản hồi.
- [ ] **Step 2: Chạy đủ bộ, từng test một**

Run: `npm run build`, rồi `test:drawcalls`, `test:tour`, `test:voice`, `test:tunnel`, `test:riverfront`, `test:weather`, `test:sunwheel`, `test:mobile`, `test:explore`, `test:perf -- --strict`, `test:citynight`.
Expected: tất cả đạt; `test:drawcalls` chênh 0 trừ `swTour`. Báo đúng kết quả thật nếu có lỗi.

- [ ] **Step 3: Ghi `KET-QUA.md`, D-022 trong `decisions.md`, cập nhật `activeContext.md` và `progress.md`** (chưa đo GPU thật nếu vẫn chưa đo).
- [ ] **Step 4: Commit**

```bash
git add tests/KET-QUA.md .github
git commit -m "docs(city): kết quả kiểm tra và memory bank đèn đêm (D-022)"
```
