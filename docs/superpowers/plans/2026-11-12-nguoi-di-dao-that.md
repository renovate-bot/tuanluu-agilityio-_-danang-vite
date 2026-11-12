# Người đi dạo dạng người thật — Kế hoạch thực hiện

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay nhân vật đi dạo dạng khối bằng 5 mô hình người có xương (Microsoft Rocketbox, MIT) với chuyển động đứng / đi / chạy bộ / chạy nhanh / chụp ảnh thu từ người thật, và bỏ hẳn tính năng nhảy.

**Architecture:** Một script Blender chuyển FBX Rocketbox thành `public/people/p0..p4.glb` (mỗi file: lưới có skin + 5 animation cùng tên, tốc độ tự nhiên ghi trong `extras`). Phía trình duyệt, `stAvatars` giữ nguyên mặt ngoài nhưng bên trong mỗi slot là một bản sao `SkeletonUtils.clone` + `AnimationMixer`, trọng số từng đoạn do một hàm thuần tính từ dáng và tốc độ; hình khối cũ ở lại làm hình tạm khi chưa nạp xong hoặc nạp lỗi. `GLTFLoader` nạp bằng `import()` động nên trang thường không tải gì thêm.

**Tech Stack:** Vite 6, TypeScript 5.9, three@0.165 (`three/addons`: `GLTFLoader`, `SkeletonUtils`), Blender 4.5 (`C:\Program Files\Blender Foundation\Blender 4.5\blender.exe`, chỉ để sinh file), `tsx --test`, Playwright + SwiftShader (`tests/lib.mjs`).

**Spec:** `docs/superpowers/specs/2026-11-12-nguoi-di-dao-that-design.md` — đọc trước khi làm bất kỳ task nào.

## Global Constraints

- Đọc `.github/copilot-instructions.md` và file `.github/instructions/*.instructions.md` của vùng sắp sửa trước khi sửa.
- Không đổi thứ tự lệnh `build*()`, không thêm / bớt lời gọi `rand()`. Nhân vật dựng lười, ngoài thứ tự dựng cảnh.
- Trang không vào Đi dạo và không có người đi dạo: không request `people/*.glb`, không thêm lệnh vẽ.
- Không thêm thư viện runtime (không sửa `dependencies`). Không Draco / Meshopt.
- Mọi thông số ở `src/config.ts`, mỗi dòng có chú thích tiếng Việt, đơn vị, `(ước lượng)`.
- i18n đủ 9 ngôn ngữ: `vi,en,ko,ja,zh,th,ar,hi,ru`.
- Comment tiếng Việt, khối tiêu đề `/* ===== … ===== */`, dòng dài kiểu file xung quanh, tiền tố hàm `st*`.
- Không cấp phát mỗi khung (D-018).
- Không sửa `server/multi/`, không deploy. Giá trị dáng trên mạng giữ nguyên: 0 đứng, 1 đi, 2 chạy, 3 (nay là rơi), 4 chụp ảnh.
- Trần dung lượng: mỗi `.glb` ≤ 1,5 MB, cả năm ≤ 6 MB (thứ tự nhường khi vượt: spec §7).
- File nguồn Rocketbox (FBX, TGA) không commit; chỉ commit `.glb` và `LICENSE-Rocketbox.txt`.
- Viết file bằng công cụ sửa file, không dán mã có dấu `>` vào lệnh shell. Không chạy hai test trình duyệt cùng lúc; trước khi chạy kiểm không còn tiến trình `*-check.mjs` mồ côi.
- Commit trên nhánh `feature/nguoi-di-dao-that`, kết thúc thông điệp bằng `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`. Không push, không mở PR (người điều phối làm).
- Gặp điều spec bảo "ghi lại để báo" thì thêm vào mục **Ghi chú để báo** cuối file này.

## Review Focus

1. Nạp `.glb` lỗi hoặc rất chậm: nhân vật vẫn hiện (hình khối) và vẫn đi được, không có promise bị từ chối chưa bắt. → Task 4 (unit) và Task 5 (trình duyệt, chặn request).
2. Slot đổi chủ / mình đổi slot / rời chế độ trong lúc `.glb` đang nạp: không hiện nhầm nhân vật ở slot đã trống, không để sót bản sao trong cảnh. → Task 4.
3. Khung rất dài (tab ẩn rồi quay lại): `mixer.update` nhận `dt` đã kẹp `CONFIG.stroll.dtMax`, pha hai đoạn trộn không lệch nhau. → Task 4.
4. Khách bản cũ còn gửi dáng 3 khi nhảy: người đó hiện đứng yên, không lỗi. → Task 3 (unit).
5. Giữ Space trên máy tính khi một nút đang focus: không nhảy, không bấm nút, không cuộn trang. → Task 2 + Task 5.

---

### Task 1: Script chuyển đổi và 5 file `.glb`

**Files:**
- Create: `scripts/people/convert.py`, `public/people/p0.glb` … `p4.glb`, `public/people/LICENSE-Rocketbox.txt`, `tests/stroll-unit/glb.test.ts`
- Modify: `package.json` (thêm `"gen:people"`), `.gitignore` (thêm `scripts/people/.cache/`)

**Interfaces:**
- Produces: mỗi `public/people/p<k>.glb` có
  - đúng 5 animation tên `idle`, `walk`, `jog`, `sprint`, `photo`; `walk` / `jog` / `sprint` có `extras.speed` (m/s, > 0); `idle` / `photo` có `extras.speed` = 0;
  - một cảnh, gốc ở chân (y = 0), đơn vị mét, đứng theo +Y, **mặt hướng +X**;
  - xương tên gốc Rocketbox (three đổi dấu cách thành `_`: `Bip01_Pelvis`, `Bip01_L_Foot`, `Bip01_R_Foot`, `Bip01_Head`);
  - `asset.extras` hoặc `scenes[0].extras` có `height` (m, chiều cao tư thế đứng).

Bảng nhân vật và đoạn: spec §4, §5. Commit Rocketbox ghim: `0943055db6ec570bcef9f2c8b41c9e5467c808f9`; tải từ `https://raw.githubusercontent.com/microsoft/Microsoft-Rocketbox/<commit>/<đường dẫn>`.

- [x] **Step 1: Viết test `tests/stroll-unit/glb.test.ts`** (đọc phần JSON của GLB bằng `fs`, không cần three): với `k` = 0..4 kiểm file tồn tại, `size ≤ 1.5 * 1024 * 1024`, tổng ≤ 6 MB, tên animation sắp xếp bằng `['idle','jog','photo','sprint','walk']`, `speed` của `walk` trong (0,5; 2,5), `jog` trong (2; 5), `sprint` trong (4; 8) và `walk < jog < sprint`, có đúng 1 skin với ≥ 50 khớp, không có `KHR_draco_mesh_compression` / `EXT_meshopt_compression` trong `extensionsUsed`, `height` trong (1,5; 1,95); `LICENSE-Rocketbox.txt` tồn tại và chứa `MIT`.
- [x] **Step 2:** `npm run test:stroll:unit` → FAIL (chưa có file).
- [x] **Step 3: Viết `scripts/people/convert.py`.** Đầu file: cách chạy, Blender đã thử, commit ghim, bảng nhân vật / đoạn. Tải nguồn vào `scripts/people/.cache/` (bỏ qua file đã có). Lõi gắn chuyển động **đã chạy được ở bản thử**, giữ đúng cách này:

```python
# với mỗi đoạn: nhập FBX chuyển động -> bộ xương nguồn `src`; `arm` là bộ xương nhân vật đã nhập trước
f0, f1 = (int(round(x)) for x in src.animation_data.action.frame_range)
def pel(fr):
    sc.frame_set(fr); bpy.context.view_layer.update()
    return (src.matrix_world @ src.pose.bones['Bip01 Pelvis'].matrix).translation.copy()
drift = pel(f1) - pel(f0)                      # quãng trôi thẳng -> speed = drift.length / ((f1 - f0) / fps)
for pb in arm.pose.bones:
    if pb.name in src.pose.bones:
        c = pb.constraints.new('COPY_TRANSFORMS'); c.target = src; c.subtarget = pb.name
# chọn arm, vào POSE, chọn hết rồi:
bpy.ops.nla.bake(frame_start=f0, frame_end=f1, only_selected=False, visual_keying=True,
                 clear_constraints=True, use_current_action=False, bake_types={'POSE'})
act = arm.animation_data.action
# đoạn di chuyển: trừ phần trôi khỏi xương hông để chạy tại chỗ
pb = arm.pose.bones['Bip01 Pelvis']
dl = (arm.matrix_world.to_3x3() @ pb.bone.matrix_local.to_3x3()).inverted() @ drift
for fc in act.fcurves:
    if fc.data_path == 'pose.bones["Bip01 Pelvis"].location':
        for kp in fc.keyframe_points:
            t = (kp.co.x - f0) / (f1 - f0); d = dl[fc.array_index] * t
            kp.co.y -= d; kp.handle_left.y -= d; kp.handle_right.y -= d
# xóa vật thể nguồn và action thừa, đặt lại pose (matrix_basis.identity()) trước đoạn kế
# Blender 4.5: gán action phải kèm slot (strip.action_slot = act.slots[0]; animation_data.action_slot = …)
```

  Số đo bản thử với `Male_Adult_10`: 80 xương, 6 732 tam giác, 3 vật liệu (`*_body`, `*_head`, `*_opacity`); `m_walk_cool_01` 1,05 m/s (chu kỳ 1,267 s), `m_run_fast_01` 5,84 m/s (0,6 s); bộ xương nhân vật sau khi nhập có scale 0,01 và quay −90° quanh Z, hướng trôi là −Y của Blender (tức mặt hướng −Y) — phải áp biến đổi và quay để mặt hướng **+X của glTF** sau `export_yup`. Phần còn lại theo spec §7: texture màu thân 1024 / đầu 512 JPEG ~80, bỏ normal + specular, mảnh `opacity` dùng PNG alpha nhỏ + `alphaMode MASK`, 30 khung/giây, xóa đường cong xương mặt, cắt `idle` ~6 s và `photo` chỉ phần giơ máy ≤ 0,8 s, ghi `extras.speed` (custom property trên action + `export_extras=True`) và `height`. Xuất `export_animation_mode='NLA_TRACKS'`, mỗi track tên theo đoạn. Cuối script in bảng (tam giác, xương, byte, thời lượng, speed) và xuất ảnh 4 khung mỗi đoạn vào `scripts/people/.cache/preview/`.
- [x] **Step 4:** Chạy `npm run gen:people` (`"gen:people": "\"C:/Program Files/Blender Foundation/Blender 4.5/blender.exe\" -b --python scripts/people/convert.py"`; script đọc `BLENDER` không cần thiết, đường dẫn này ghi ở đầu file để máy khác sửa). **Mở từng ảnh preview bằng công cụ đọc ảnh**: mỗi nhân vật ở `walk`, `jog`, `sprint`, `photo` phải có tay chân đúng dáng (không chữ T, không vặn), texture đúng, tóc không thành mảng đặc. Nhân vật hỏng → thay theo spec §4 và ghi vào **Ghi chú để báo**.
- [x] **Step 5:** Chép `LICENSE.md` của Rocketbox vào `public/people/LICENSE-Rocketbox.txt` (thêm 2 dòng đầu: nguồn + commit).
- [x] **Step 6:** `npm run test:stroll:unit` → `glb.test.ts` PASS. Vượt trần thì nhường theo thứ tự spec §7, ghi lại mức đã nhường.
- [x] **Step 7:** Commit `feat(stroll): script chuyển Rocketbox sang glb và 5 nhân vật có xương`.

### Task 2: Bỏ nhảy

**Files:**
- Modify: `src/explore/stroll/motion.ts`, `keys.ts`, `touch.ts`, `index.ts`, `index.html` (`#stJump`), `src/styles/main.css` (quy tắc `#stJump`), `src/config.ts` (`jumpHeight`, chú thích `lowMax`, `people.jump`), `src/i18n/locales/*.json` (9 file), `src/common/people/kinds.ts`, `material.ts`, `gait.ts`
- Test: `tests/stroll-unit/motion.test.ts`, `keys.test.ts`, `touch.test.ts`, `mapData.test.ts`, `avatars.test.ts`, `tests/people-unit/gait.test.ts`

**Interfaces:**
- Produces: `StInput = { mx, mz, run, camYaw }` (không còn `jump`); `ST_POSE_FALL = 3` thay `ST_POSE_JUMP` (cùng giá trị); `StTouchHandlers = { look, photo, activity }`; `PP_FLAG = { hat: 1, pack: 2, photo: 4 }`; `ppAngles(part, amp, phase)` (bỏ tham số `jump`).

- [x] **Step 1: Sửa test trước.** `motion.test.ts`: bỏ các test nhảy; thêm `'bước khỏi bậc cao hơn stepMax thì rơi, dáng ST_POSE_FALL, chạm đất hết rơi'` và `'chạy thẳng vào gờ chắn xe Cầu Rồng 0,9 m: không qua'` (dùng bản đồ thật `stBuildStaticMap()`, từ điểm xuất phát chạy theo −Z 3 s, khẳng định `z` không vượt mép trong của gờ). `mapData.test.ts`: bỏ khẳng định "nhảy cao 1,2 m phải qua gờ"; thêm test Cầu sông Hàn: từ lề đi bộ tới được lòng đường mà không rời đất, **hoặc** nếu bản đồ không có lối thì test khẳng định điều ngược lại và ghi vào **Ghi chú để báo** (không sửa bản đồ). `keys.test.ts` / `touch.test.ts`: bỏ `jump`; thêm `'Space không sinh đầu vào nào'`. `avatars.test.ts`: bỏ phần cờ nhảy (file này Task 4 viết lại). `gait.test.ts`: bỏ test `jump`.
- [x] **Step 2:** `npm run test:stroll:unit; npm run test:people:unit` → FAIL / lỗi kiểu.
- [x] **Step 3: Gỡ mã.** Theo spec §6. Trong `index.ts`: bỏ `jumpQueued` và nhánh `k === ' '`, nhưng **vẫn** `preventDefault` cho Space ở keydown / keyup khi đang đi dạo và mục tiêu không phải ô nhập (Review Focus 5: không cuộn trang, không bấm nút đang focus) và không thêm `' '` vào `keys`. `motion.ts`: bỏ bước 3 (nhảy), giữ rơi; `feet` vẫn tính như cũ. `material.ts` / `gait.ts` / `kinds.ts` / `config.ts`: xóa cờ 8 và `CONFIG.people.jump`. Chú thích đầu các file sửa cho khớp.
- [x] **Step 4: i18n.** Xóa khóa `stJump` ở 9 file; `stHint` bỏ đoạn Space (vi: `"W A S D: đi · giữ Shift: chạy · kéo chuột: xoay camera · P: chụp ảnh · Esc: thoát"`; 8 ngôn ngữ còn lại: xóa đúng mục Space cùng dấu ngăn của nó, không dịch lại phần khác).
- [x] **Step 5:** `npm run typecheck; npm run test:stroll:unit; npm run test:people:unit; npm run test:multi:unit` → PASS. `grep -rn -i "jump\|stJump" src index.html` chỉ còn kết quả không liên quan (nếu có thì giải thích trong commit).
- [x] **Step 6:** Commit `feat(stroll): bỏ tính năng nhảy, dáng 3 thành rơi`.

### Task 3: Hàm chọn đoạn và quy tắc nhân vật (thuần)

**Files:**
- Create: `src/explore/stroll/anim.ts`, `tests/stroll-unit/anim.test.ts`
- Modify: `src/config.ts` (`CONFIG.stroll.anim`)

**Interfaces:**
- Consumes: `ST_POSE_*` từ `motion.ts` (Task 2; nếu làm trước Task 2 thì dùng số 0–4 qua hằng hiện có).
- Produces:
  - `CONFIG.stroll.anim = { walkTo: 1.8, jogAt: 3.5, sprintFrom: 7.0, rateMin: 0.6, rateMax: 1.6, fade: 0.2, fallMin: 0.1, others: 4, models: ['people/p0.glb', …, 'people/p4.glb'] }`
  - `export const ST_CLIPS = ['idle', 'walk', 'jog', 'sprint', 'photo'] as const; export type StClip = typeof ST_CLIPS[number];`
  - `export interface StClipMix { w: Float32Array /* 5 trọng số theo thứ tự ST_CLIPS, tổng = 1 */; rate: number /* hệ số tua đoạn di chuyển */; loco: boolean }`
  - `export function stClipMix(pose: number, speed: number, natural: ArrayLike<number> /* speed tự nhiên theo ST_CLIPS */, out: StClipMix): void` — không cấp phát.
  - `export function stModelFor(slot: number, isSelf: boolean): number` — mình → 0; người khác → `1 + (((slot % 4) + 4) % 4)`.

- [x] **Step 1: Viết `anim.test.ts`** với `natural = [0, 1.05, 3.0, 5.84, 0]`:
  - đứng (`pose` 0) → `idle` = 1, `loco` false;
  - `pose` 1, `v` 1,0 → `walk` = 1, `rate` ≈ 0,952;
  - `pose` 1, `v` 3,5 → `jog` = 1, `rate` ≈ 1,167;
  - `pose` 2, `v` 10 → `sprint` = 1, `rate` = 1,6 (kẹp);
  - `pose` 2, `v` 5,25 → `jog` = 0,5, `sprint` = 0,5, `rate` = 5,25 / 4,42 ≈ 1,188;
  - `pose` 1, `v` 2,65 → `walk` = 0,5, `jog` = 0,5;
  - `pose` 1, `v` 0,05 → `walk` = 1, `rate` = 0,6 (kẹp dưới);
  - `pose` 4 → `photo` = 1; `pose` 3, `v` 0 → `idle`; `pose` 3, `v` 6 → như chạy ở 6 m/s; `pose` 7 hoặc `NaN` → `idle` (Review Focus 4);
  - mọi trường hợp: tổng `w` = 1 ± 1e-6, không âm;
  - `stModelFor`: (2, true) → 0; người khác slot 0..4 → 1, 2, 3, 4, 1; slot −1 → trong 1..4.
- [x] **Step 2:** `npm run test:stroll:unit` → FAIL.
- [x] **Step 3:** Viết `anim.ts` và thêm `CONFIG.stroll.anim` (chú thích từng số, đơn vị, `(ước lượng)`).
- [x] **Step 4:** `npm run typecheck; npm run test:stroll:unit` → PASS.
- [x] **Step 5:** Commit `feat(stroll): chọn và trộn đoạn chuyển động theo dáng và tốc độ`.

### Task 4: Nhân vật có xương trong `stAvatars`

**Files:**
- Create: `src/explore/stroll/rig.ts` (nạp + một nhân vật có xương), `src/explore/stroll/blocky.ts` (hình khối cũ tách từ `avatars.ts`, làm hình tạm)
- Modify: `src/explore/stroll/avatars.ts`, `src/explore/index.ts` (nạp trước khi chọn thẻ Đi dạo), `src/main.ts` (`__app.stroll` thêm thứ test cần), `src/config.ts` (`labelAbove` nếu cần, xóa `cadenceMax` nếu `blocky.ts` không dùng)
- Test: `tests/stroll-unit/avatars.test.ts` (viết lại)

**Interfaces:**
- Consumes: `stClipMix`, `stModelFor`, `ST_CLIPS`, `CONFIG.stroll.anim` (Task 3); định dạng `.glb` (Task 1).
- Produces (mặt ngoài `stAvatars` không đổi tên): `build(): THREE.Group` (tên `'stroll-people'`), `mesh: THREE.Group | null`, `setSelf`, `sync`, `onPos`, `update(nowMs)`, `slotState`, `name`, `clear`, `self`; thêm:
  - `preload(model?: number): void` — bắt đầu nạp (mặc định 0), không ném lỗi;
  - `debug(slot: number): { model: number; real: boolean; mix: number[]; rate: number } | null` — cho test.
- `rig.ts`:
  - `stRigLoad(model: number): Promise<StRigSource | null>` — nhớ đệm theo `model`; lỗi → `console.warn` một lần cho mỗi `model`, trả `null`, không thử lại; URL = `import.meta.env.BASE_URL + CONFIG.stroll.anim.models[model]`.
  - `class StRig { readonly root: THREE.Object3D; constructor(src: StRigSource); pose(pose: number, speed: number, dt: number): void; reset(): void; dispose(): void }` — `pose` gọi `stClipMix`, làm mượt trọng số về đích với hằng thời gian `fade`, đặt `timeScale` các đoạn di chuyển theo `rate × (thời lượng đoạn / thời lượng chuẩn)` sao cho **cùng pha** (một biến pha 0–1 chung cho `walk` / `jog` / `sprint`; đặt `action.time = pha × thời lượng`), `photo` là `LoopOnce` + `clampWhenFinished` và phát lại từ đầu mỗi lần dáng chuyển sang chụp ảnh.

Quy tắc:
- `import('three/addons/loaders/GLTFLoader.js')` và `import('three/addons/utils/SkeletonUtils.js')` **động**, chỉ trong `stRigLoad`.
- Sau khi nạp: mọi `Mesh` `layers.set(1)`, `castShadow = false`, `receiveShadow = false`, `frustumCulled = false`; vật liệu `metalness = 0`, `roughness = 0.85`; vật liệu `alphaMode MASK` giữ `alphaTest`, `transparent = false`.
- Mỗi slot: `blocky` hiện khi slot đang hiện mà chưa có `StRig`; có `StRig` thì ẩn `blocky` của slot đó. Slot đổi chủ / đổi model / `clear()`: gỡ `StRig` khỏi nhóm và `dispose()` mixer (không dispose geometry / texture dùng chung của nguồn). Kết quả nạp về sau khi slot đã đổi chủ hoặc đã trống thì bỏ (so một số thế hệ của slot) — Review Focus 2.
- `dt` cho mixer: mình dùng `dt` của `stStep` đã kẹp; người khác dùng hiệu `nowMs` giữa hai lần `update`, kẹp `CONFIG.stroll.dtMax` — Review Focus 3. Mình được cập nhật trong `setSelf` (đang gọi mỗi khung), nên `setSelf` cần biết `dt`: thêm tham số thứ ba tùy chọn `dt = 0` và sửa `index.ts` truyền vào.
- `explore/index.ts`: khi người dùng chọn thẻ Đi dạo ở màn chọn (trước sảnh) gọi `stAvatars.preload(0)`.
- Nhãn tên: nếu chiều cao model (`height`) + 0,25 > `labelAbove` thì nâng `labelAbove` trong config cho mọi nhân vật không bị nhãn đè đầu.

- [x] **Step 1: Viết lại `tests/stroll-unit/avatars.test.ts`** (Node, không GPU; giả `stRigLoad` bằng cách cho `avatars.ts` nhận bộ nạp qua `stAvatars.__setLoader(fn)` chỉ dùng trong test):
  - `'build trả Group tên stroll-people, gọi hai lần trả cùng một đối tượng'`;
  - `'setSelf khi chưa nạp: hình khối hiện, debug(slot).real === false, model 0'`;
  - `'nạp xong: real === true, hình khối của slot ẩn'`;
  - `'nạp lỗi (loader trả null): vẫn hình khối, không ném, không unhandledRejection'` (Review Focus 1);
  - `'slot đổi chủ trong lúc đang nạp: kết quả cũ bị bỏ, nhóm không có con thừa'` (Review Focus 2);
  - `'người khác slot 0..4 dùng model 1,2,3,4,1; mình ở slot 3 dùng model 0'`;
  - `'clear() gỡ hết nhân vật thật khỏi nhóm'`.
- [x] **Step 2:** `npm run test:stroll:unit` → FAIL.
- [x] **Step 3:** Tách `blocky.ts` (mã InstancedMesh hiện có, bỏ dáng nhảy), viết `rig.ts`, viết lại `avatars.ts`, sửa `index.ts` / `explore/index.ts` / `main.ts`.
- [x] **Step 4:** `npm run typecheck; npm run test:stroll:unit; npm run test:multi:unit; npm run build` → PASS; trong `dist/assets` `GLTFLoader` nằm ở chunk riêng (không trong chunk vào chính: `grep -l GLTFLoader dist/assets/*.js` trả đúng file chunk phụ).
- [x] **Step 5: Xem bằng mắt.** `npm run dev`, mở `http://localhost:5173/?test&explore=stroll` bằng Playwright (mẫu `tests/lib.mjs`), chụp 4 ảnh vào `tests/screens/`: đứng, chạy bộ (W), chạy nhanh (Shift), chụp ảnh (P); thêm 1 ảnh ban đêm. **Mở ảnh xem**: nhân vật đứng trên mặt lề (không chìm, không lơ lửng), mặt hướng theo hướng đi, tay chân đúng dáng. Nhân vật đen kịt ban đêm → ghi vào **Ghi chú để báo**.
- [x] **Step 6:** Commit `feat(stroll): nhân vật đi dạo là mô hình có xương, hình khối làm hình tạm`.

### Task 5: Kiểm tra trình duyệt

**Files:**
- Modify: `tests/stroll-check.mjs`, `tests/mobile-check.mjs`, `tests/multi-check.mjs`

**Interfaces:**
- Consumes: `window.__app.stroll.avatars.debug(slot)`, `stroll-people` là `Group`, xương `Bip01_Pelvis` / `Bip01_L_Foot`.

- [x] **Step 1:** `stroll-check.mjs` (sửa các mục cũ ở dòng ~334, ~402–409, ~433, ~603 và comment đầu file):
  - chờ `debug(self).real === true` bằng `waitForFunction(…, { polling: 500 })`; kiểm đúng 1 nhân vật thật đang hiện, `model === 0`, mọi mesh con ở lớp 1, `castShadow === false`;
  - chuyển động: lấy mẫu 12 lần (mỗi lần sau một bước `stroll.step(1/30, { mz: 1, run: true, … })`) khoảng cách dọc hướng đi giữa `Bip01_L_Foot` và `Bip01_Pelvis` → biên độ > 0,2 m; đứng yên 12 mẫu → biên độ < 0,05 m;
  - Space: gửi keydown Space 80 khung, `state.air` chưa từng `true`, `document.activeElement` không bị bấm;
  - không còn `#stJump` trong DOM; 9 ngôn ngữ không có khóa `stJump`, `stHint` không chứa `Space`;
  - trang thứ hai chặn `**/people/*.glb` (`page.route(…, r => r.abort())`): vào Đi dạo vẫn đi được 60 khung, `debug(self).real === false`, không có `pageerror`;
  - trang `?test` không explore: không có request `people/` nào (đếm bằng `page.on('request')`), không có `stroll-people`.
- [x] **Step 2:** `mobile-check.mjs`: bỏ `#stJump` khỏi danh sách và phần đo chồng lấn với cần gạt; giữ `#stPad`, `#stPhoto`. `multi-check.mjs` mục 6a: đếm nhân vật đang hiện bằng `avatars.debug(slot)` thay cho `m.count`; thêm kiểm bot đi dạo ở slot `s` có `model === 1 + (s % 4)`.
- [x] **Step 3:** `npm run build`, rồi chạy lần lượt (không song song): `npm run test:stroll`, `npm run test:mobile`, `npm run test:people`, `npm run test:explore`, `npm run test:multi`. Ghi dòng kết quả cuối của từng lệnh. Lỗi do máy chậm thì xử lý theo `.github/instructions/tests.instructions.md` (polling, `idleMs`), không nới điều kiện kiểm.
- [x] **Step 4:** Commit `test(stroll): kiểm nhân vật có xương, bỏ kiểm nhảy`.

### Task 6: Tài liệu và memory bank

**Files:**
- Modify: `.github/memory-bank/activeContext.md`, `progress.md`, `decisions.md` (D-030), `systemPatterns.md` (cạm bẫy: tư thế gốc file chuyển động Rocketbox khác file nhân vật; Blender 4.5 action slot; nạp động GLTFLoader), `.github/copilot-instructions.md` (§3 mục 5: ngoại lệ hình người D-030; §5: `gen:people`), `README.md` (mục Cấu trúc: `public/people/`, `scripts/people/`; ghi nguồn Rocketbox MIT), spec (trạng thái), plan này (đánh dấu ô, số đo thật, **Ghi chú để báo**)

- [x] **Step 1:** Cập nhật các file trên; chỉ ghi điều có thật (test nào đã chạy / chưa chạy, không deploy).
- [x] **Step 2:** `npm run typecheck` → PASS. Commit `docs(stroll): D-030, memory bank, hướng dẫn agent`.

---

## Ghi chú để báo

_(người làm điền: nhân vật đã thay, mức nhường dung lượng, vùng không tới được khi bỏ nhảy, ảnh đêm, test chưa chạy…)_

- Task 1: không thay nhân vật nào (5 nhân vật spec §4 đều đạt khi xem ảnh). Nhường dung lượng **mức 1**: ngón tay giữ tư thế trung bình của từng đoạn (không cử động ngón); mức 0 cho tổng 6,39 MB > 6 MB. Kết quả 5,79 MB, lớn nhất `p3` 1,42 MB. `Male_Adult_17` (p4) không có mảnh alpha nên chỉ 2 lưới. `idle` dài 5,6 s (dời điểm đầu, khép vòng 0,3 s; lệch vòng gốc nam 6,1°, nữ 4,7°). `photo` tua nhanh 1,67× (nam) / 1,92× (nữ) để còn 0,8 s; động tác giơ máy là tay không (Rocketbox không có máy ảnh).
- Task 4: `GLTFLoader` / `SkeletonUtils` lúc đầu bị `manualChunks` của `vite.config.ts` gom vào chunk `three` (tải ở mọi trang); đã sửa `manualChunks` loại hai file này, nay ở chunk riêng `GLTFLoader-*.js` (45 kB) và `SkeletonUtils-*.js` (3,9 kB), chỉ tải khi có người đi dạo. Chunk `three` vẫn lớn thêm khoảng 61 kB (560,8 → 621,6 kB, gzip 161 kB; mốc trước là bản build 00:35 trước Task 1): các lớp three mà GLTFLoader / AnimationMixer cần (vật liệu vật lý, keyframe track, SkinnedMesh…) nay không còn bị tree-shake. Chunk `index` 581,8 → 586,9 kB. Cần `test:perf --strict` cuối nhánh để xem ảnh hưởng.
- Task 4: ảnh `tests/screens/rig-*.png` (dist, SwiftShader, 960×540): đứng, đứng nhìn ngang, chạy bộ (W, 3,5 m/s → 100 % `jog`, tua 1,22), chạy nhanh (Shift, 10 m/s → `sprint`, tua 1,6), chụp ảnh, ban đêm. Mặt quay theo hướng đi, tay chân đúng dáng, giày chạm mặt lề (không chìm / lơ lửng ở ảnh đứng), tóc không thành mảng đặc. Ban đêm nhân vật **không** đen kịt (đèn cảnh + môi trường đủ sáng, áo đỏ vẫn rõ). Ảnh chạy chụp ngang nên gờ lan can che bàn chân. Chụp ảnh: hai tay giơ trước ngực, không có máy ảnh (Rocketbox không có), như ghi ở Task 1.
- Task 4: `labelAbove` giữ 2,1 m (nhân vật cao nhất 1,83 m + 0,25 = 2,08 m).
- Task 4: kết quả nạp không gắn trực tiếp vào slot (chỉ vào bộ đệm mô hình); bản sao chỉ tạo trong vòng khung cho slot đang hiện đúng mô hình lúc đó, nên không cần số thế hệ cho từng slot (Review Focus 2). Lần đầu hiện một nhân vật thật three biên dịch shader mới (MeshPhysicalMaterial do `KHR_materials_specular`), có thể khựng một khung.
- Task 5 (2026-11-12, mã `230a5e7`, test `7881b09`; SwiftShader máy này): `test:stroll` "stroll-check: đạt" 75 kiểm (31 phút; lần 1 trượt 2 kiểm ở mục 1/2 vì tia thẳng xuống của test trúng tóc nhân vật có xương: `through` chỉ bỏ đối tượng tên `stroll-people`, nay bỏ mọi lưới con của nhóm; lỗi test, không phải mã). `test:mobile` "mobile-check: đạt" 143 kiểm (19 phút). `test:people` "Tất cả ĐẠT" 37 (11 phút). `test:explore` "explore-check: đạt" 71 (25 phút). `test:multi`: Mục 6 (đi dạo, gồm 6a / 6b mới) đạt đủ ở lần 1 và 2; **cả 3 lần đều trượt ở Mục 5 (dù lượn rời máy)**, mỗi lần khác nhau (lần 1: "Đóng trang đang bay", "Tab ẩn và rAF dừng 23 s"; lần 2: "Bay một mình", "Không phím: đếm ngược", "Tab ẩn"; lần 3: hết giờ 60 s ngay đầu Mục 5, dừng test). Chạy `test:multi` trên bản `main` `a309fa8` (worktree riêng) cũng trượt đúng "Đóng trang đang bay" + "Tab ẩn" → lỗi có sẵn / do máy chậm, không do nhánh (nhánh chỉ sửa comment trong `src/explore/multi/`). Đã thêm chẩn đoán vào chữ hai kiểm Mục 5 (ws quan sát còn mở, `readyState` 1, không bị đóng: máy chủ thật sự thấy lobby 0 khi trang ẩn 23 s, nghi khung đầu dài chặn nhịp sống > `slotTimeoutMs`); chưa sửa.
- Task 5: biên độ bàn chân trái so với hông dọc hướng đi (12 mẫu, bước 1/30 s): chạy 10 m/s (100 % `sprint`, tua 1,6) **0,883 m** (lần 1: 0,894 m); đứng (100 % `idle`) **0,002 m**. Trang chặn `people/*.glb`: 1 request bị chặn, 1 cảnh báo, giữ W 62 khung đi 10,2 m bằng hình khối, không lỗi. Trang `?test` thường: 7 request, 0 tới `people/`, 0 chunk GLTFLoader / SkeletonUtils. Draw call: mình +3 (3 lưới, p0); bot ở trang dù lượn +3. Ảnh `tests/screens/stroll-rig-{day,night}-{stand,run}.png` (960×540; ở lần 1 ảnh ngày còn 480×270 vì canvas chưa đổi cỡ, đã sửa chờ canvas).
- Task 5: trong lúc chạy có phiên khác chạy `trees-check`, `drawcalls.mjs`, `perf-check.mjs --strict --label=d031` trên máy (thấy lúc 02:33–04:14); lần 1 `test:stroll` có thể chạy chồng với chúng; các lần sau đã chờ chúng xong. Ở gốc repo có thêm file rỗng lạc `Math.abs(window.__app.dayNight.night` (01:45, không do lệnh của Task 5), chưa xóa.
