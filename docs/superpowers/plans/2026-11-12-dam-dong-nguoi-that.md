# Đám đông người đi bộ dạng người thật (D-032): plan thực hiện

> **Cho agent thực hiện:** làm từng task theo thứ tự, mỗi task một agent (model Opus hoặc Sonnet như ghi ở từng task, không dùng Fable 5.2). Bước dùng ô `- [ ]` để theo dõi. Đọc spec trước khi làm.

**Mục tiêu:** ba hệ người đi bộ (`ttl-people`, `sh-people`, `dragon-people`, 226 người) vẽ người thật giản lược từ Rocketbox, mỗi hệ vẫn 1 lệnh vẽ, lùi về hình khối khi không dùng được.

**Kiến trúc:** một script Blender sinh `public/people/crowd.bin` (10 lưới giản lược + ma trận xương nướng theo khung) và `crowd.jpg` (atlas). Trang tải hai tệp trước khi dựng cảnh. `createPeople` dựng mỗi hệ thành một `THREE.BatchedMesh` với vật liệu skinning đọc ma trận xương từ texture; `stepPeople` vẫn tính vị trí trên CPU. Đường hình khối cũ giữ nguyên làm đường lùi.

**Công nghệ:** three@0.165 (`BatchedMesh`, `DataTexture` half-float, `onBeforeCompile`), Blender 4.5 (Python), TypeScript, `tsx --test`, Playwright (test trình duyệt sẵn có).

**Spec:** `docs/superpowers/specs/2026-11-12-dam-dong-nguoi-that-design.md`. Bản dựng thử tham khảo (không vào git, có thể chép ý): `scripts/people/.cache/spike-crowd/` (`bake.py`, `lib.js`, `crowd.html`).

## Ràng buộc chung

- Không thêm / bớt / đổi thứ tự lời gọi `rand()`, `rnd()` của cầu, `rng` của `ppAssignKinds` và của danh sách người Cầu Rồng. Số ngẫu nhiên mới dùng băm theo chỉ số.
- Mỗi hệ đúng 1 lệnh vẽ. Lớp 1, `castShadow = receiveShadow = false`.
- Mọi lưới, vật liệu, texture tạo lúc dựng, trước `prewarm`; không đổi define / program lúc chạy; texture trong uniform phải `renderer.initTexture`.
- Không sửa hành vi của `src/common/people/{shapes,material,gait,kinds}.ts` và `src/explore/stroll/*`.
- Thông số mới ở `CONFIG.people.crowd` trong `src/config.ts`, mỗi dòng có chú thích tiếng Việt, đơn vị, `(ước lượng)` nếu không có nguồn.
- Không thêm thư viện runtime. Không thêm khóa i18n (không có chữ mới trên giao diện).
- Trần tệp: `crowd.bin` ≤ 1 100 000 byte, `crowd.jpg` ≤ 400 000 byte, tổng ≤ 1 500 000 byte. Mỗi lưới ≤ 1 600 tam giác. 22 xương, 2 xương mỗi đỉnh.
- Comment tiếng Việt, khối tiêu đề `/* ===== ... ===== */`, dòng dài kiểu file xung quanh. Chỉ `git add` đúng file mình sửa (gốc repo có file rỗng lạc, không đụng). Không commit `dist/`, `tests/screens/`, `scripts/people/.cache/`.
- Test trình duyệt (SwiftShader) rất chậm: không chạy hai test cùng lúc; trước khi chạy kiểm không còn tiến trình `*-check.mjs` / `wrangler` / `drawcalls.mjs` / `gpu-time.mjs` khác.
- Không đổi `server/multi`; không deploy.

## Trọng tâm review

1. Tải `crowd.bin` lỗi / chậm quá `loadTimeoutMs` / `crowd.jpg` lỗi giải mã: trang vẫn dựng xong với hình khối, không treo, không lỗi console ngoài một `console.warn`. (Task 3)
2. Thiếu `WEBGL_multi_draw`: không được rơi vào nhánh mỗi người một lệnh vẽ của r165; phải dùng hình khối. (Task 2, kiểm bằng hàm thuần `crowdUsable`)
3. Bão dọn người rồi trả lại: người ẩn bằng `setVisibleAt` phải hiện lại đúng chỗ, người đi cùng ẩn cùng người dẫn. (Task 3)
4. `dragon-people` quay lưng lại cầu và ở xa hơn `hideDistance`: 0 lệnh vẽ. (Task 3)
5. Trang chạy lâu: pha chuyển động tính từ `uTime` tuyệt đối vẫn mượt sau 3 giờ (độ chính xác float). (Task 2, test đơn vị cho hàm tính khung trên CPU với `t = 10 800 s`)

---

### Task 1 (Opus): script sinh dữ liệu, tệp `crowd.bin` / `crowd.jpg`, bộ đọc

**Tệp:**
- Tạo: `scripts/people/crowd.py`, `public/people/crowd.bin`, `public/people/crowd.jpg`, `src/common/people/crowdData.ts`, `tests/people-unit/crowdData.test.ts`
- Sửa: `package.json` (thêm `"gen:crowd"`, cùng kiểu lệnh `gen:people`), `public/people/LICENSE-Rocketbox.txt` (thêm tên 5 nhân vật mới), `src/config.ts` (`CONFIG.people.crowd`)

**Giao diện tạo ra** (Task 2 dùng đúng các tên này):

```ts
// src/common/people/crowdData.ts
export type CrowdClipName = 'walk' | 'jog' | 'idle' | 'photo';
export interface CrowdClip { row: number; frames: number; fps: number; loop: boolean; speed: number }   // row: hàng đầu của đoạn trong texture chuyển động; speed: m/s tự nhiên ở tỉ lệ 1 (0 với idle, photo)
export interface CrowdChar {
  id: string;            // tên Rocketbox
  child: boolean; female: boolean;
  height: number;        // m, ở tỉ lệ 1
  geometry: THREE.BufferGeometry;           // position (Float32 ×3), normal (×3), uv (×2, toạ độ trong atlas), aBones (Uint8 ×2), aW (Float32 ×1: trọng số xương thứ nhất), có index
  hat: THREE.BufferGeometry | null;         // cùng bộ attribute, thêm nón lá; null với trẻ em
  clips: Record<CrowdClipName, CrowdClip>;
}
export interface CrowdParsed { chars: CrowdChar[]; bones: number; animWidth: number; animHeight: number; animData: Uint16Array; maxVerts: number; maxIndices: number }   // animData: RGBA half-float, mỗi hàng một khung, 3 texel mỗi xương
export interface CrowdData extends CrowdParsed { anim: THREE.DataTexture; atlas: THREE.Texture }
export function crowdParse(buf: ArrayBuffer): CrowdParsed;          // thuần, chạy được trong node; ném lỗi khi sai magic / phiên bản
export function crowdLoad(): Promise<CrowdData | null>;             // tải bin + jpg theo BASE_URL, tối đa CONFIG.people.crowd.loadTimeoutMs; lỗi bất kỳ → console.warn một lần, trả null; ?crowd=off → null ngay, không tải
export function crowdGet(): CrowdData | null;                       // kết quả của lần crowdLoad đã xong (null nếu chưa / lỗi)
```

`CONFIG.people.crowd`: `{ bin: 'people/crowd.bin', atlas: 'people/crowd.jpg', loadTimeoutMs: 8000, heightScale: 0.93, rateMin: 0.6, rateMax: 1.6, tint: [0.88, 1.0], cullPad: 0.6 }`.

Định dạng `crowd.bin` do task này quyết (little-endian; đầu tệp có magic + phiên bản + phần JSON mô tả + khối nhị phân); ghi mô tả định dạng trong comment đầu `crowdData.ts` và đầu `crowd.py`. Lưới trong tệp đã ở hệ: mét, mặt +X, chân y = 0.

- [x] **Bước 1:** viết `tests/people-unit/crowdData.test.ts` (đọc `public/people/crowd.bin` bằng `fs`, gọi `crowdParse`):
  - `chars.length === 10`; đúng 2 `child`; có cả `female` true và false; `id` không trùng; có đủ 5 id của D-030.
  - Mỗi lưới: có index; `index.count / 3 ≤ 1600` (bản `hat` ≤ 1 640); đủ attribute `position, normal, uv, aBones, aW` đúng `itemSize`; không NaN; `aBones < bones`; `0 ≤ aW ≤ 1`; `uv` trong [0, 1]; min y trong [−0,02; 0,02]; chiều cao lưới khớp `height` ±0,03; người lớn `1,5 < height < 1,95`, trẻ em `0,9 < height < 1,5`; đỉnh có x lớn nhất ở vùng y < 0,15 (mũi giày) có x > 0,1.
  - `hat`: người lớn khác null, trẻ em null; đỉnh cao nhất của `hat` cao hơn của `geometry`.
  - `bones === 22`; `animWidth === bones * 3`; `animData.length === animWidth * animHeight * 4`.
  - Mỗi nhân vật đủ 4 đoạn; `row + frames ≤ animHeight`; các đoạn không chồng hàng nhau (trong cùng nhân vật và giữa các nhân vật); `walk.fps === 15`, `jog.fps === 30`; `idle.speed === 0`, `photo.speed === 0`, `photo.loop === false`; `0,5 < walk.speed < 2`, `2 < jog.speed < 5`.
  - Dung lượng: theo trần ở Ràng buộc chung; `crowd.jpg` bắt đầu bằng `FF D8`.
  - `crowdParse(new ArrayBuffer(16))` ném lỗi.
  - Giấy phép: `LICENSE-Rocketbox.txt` có tên cả 10 nhân vật.
- [x] **Bước 2:** chạy `npm run test:people:unit`, thấy test mới hỏng vì chưa có tệp / hàm.
- [x] **Bước 3:** viết `scripts/people/crowd.py`. Dùng lại cách tải nguồn, ghim commit và nướng chuyển động của `convert.py` (import hàm nếu được, không sửa hành vi `convert.py`). Mỗi nhân vật: gộp 80 xương còn 22 (danh sách ở spec §3 / `spike-crowd/bake.py`), giữ 2 xương mỗi đỉnh, nướng tư thế ngón tay vào lưới, bỏ mảnh opacity, giản lược tới ≤ 1 600 tam giác có bảo vệ vùng đầu, xếp body + head vào một ô atlas 384², thêm bản đội nón lá (nón 10 cạnh, gắn cứng xương đầu, uv trỏ vào ô màu nón trong atlas). Chuyển động: `walk` / `idle` / `photo` 15 fps, `jog` 30 fps, `idle` khoảng 3 s, đã trừ quãng trôi của hông. Xuất ảnh xem trước từng nhân vật vào `scripts/people/.cache/preview-crowd/`. Chọn 3 người lớn + 2 trẻ em mới theo spec §4.2; nếu trẻ em không dùng được thì làm theo đường lùi trong spec và sửa test Bước 1 cho khớp (ghi rõ trong báo cáo).
- [x] **Bước 4:** chạy `npm run gen:crowd`; xem ảnh xem trước của cả 10 nhân vật (đúng hướng, không vỡ lưới, không hói, nón đúng chỗ).
- [x] **Bước 5:** viết `crowdData.ts` (`crowdParse`, `crowdLoad`, `crowdGet`) và `CONFIG.people.crowd`.
- [x] **Bước 6:** `npm run typecheck`, `npm run test:people:unit` đạt.
- [x] **Bước 7:** commit (`feat(people): dữ liệu đám đông người thật ...`). Ghi vào mục "Ghi chú để báo" cuối plan: 5 nhân vật mới, số tam giác / dung lượng thật, mọi lệch so với plan.

### Task 2 (Opus): vẽ bằng BatchedMesh, ghép vào `createPeople`, đường lùi

**Tệp:**
- Tạo: `src/common/people/crowd.ts`, `tests/people-unit/crowd.test.ts`
- Sửa: `src/common/people.ts`, `src/environment/pedestrians.ts`, `src/main.ts`, `index.html` (preload), các chỗ dùng `People.mesh` (tìm bằng grep; `TranThiLyBridge.ts`, `SongHanBridge.ts`, `BridgeBase.ts` nếu có)

**Dùng từ Task 1:** `crowdLoad`, `crowdGet`, `CrowdData`, `CrowdChar`, `CrowdClip`, `CONFIG.people.crowd`.

**Giao diện tạo ra:**

```ts
// src/common/people/crowd.ts
export function crowdUsable(data: CrowdData | null, hasMultiDraw: boolean): boolean;      // thuần
export function crowdPick(chars: { child: boolean }[], system: string, i: number, isChild: boolean, avoid: number): number;   // thuần, tất định; chỉ số nhân vật; avoid: chỉ số của người đi cùng (−1 nếu không có) để không trùng
export function crowdRate(speed: number, natural: number, scale: number): number;         // thuần; kẹp [rateMin, rateMax]; natural = 0 → 1
export function crowdFrame(t: number, clip: CrowdClip, rate: number, phase: number): number;   // thuần, bản CPU của công thức trong shader: khung (số thực) trong [0, frames); loop = false → frames − 1
export function crowdMaterial(data: CrowdData): THREE.MeshStandardMaterial;                 // một bản dùng chung cho 3 hệ, name = 'peopleCrowd', customProgramCacheKey 'peopleCrowd'
export function crowdBuild(data: CrowdData, list: Walker[], system: string): THREE.BatchedMesh;   // một id mỗi người, đã setColorAt cho mọi id, sortObjects = false
// src/common/people.ts
export interface People { list: Walker[]; mesh: THREE.InstancedMesh | THREE.BatchedMesh; group: THREE.Group; real: boolean }
```

`createPeople` giữ nguyên chữ ký và giữ nguyên lời gọi `rnd()` chọn màu áo (một lần mỗi người, kể cả khi vẽ người thật). Khi `crowdUsable(crowdGet(), renderer.extensions.has('WEBGL_multi_draw'))` thì dựng `crowdBuild`, ngược lại đi đúng đường cũ. `stepPeople`: người thật ẩn bằng `setVisibleAt(i, false)` và hiện lại bằng `true`; hình khối giữ cách scale 0. Tỉ lệ người thật theo spec §4.10; người chụp ảnh giữ khung cuối `photo`; cờ nón → lưới `hat`.

`main.ts`: `await crowdLoad()` trước lệnh dựng đầu tiên (không đổi thứ tự các lệnh dựng). `index.html`: `<link rel="preload" as="fetch" crossorigin>` cho `crowd.bin` và `as="image"` cho `crowd.jpg`, đường dẫn đúng với `base` của Vite.

`peopleTest` (`pedestrians.ts`) trả thêm: `real`, `tris` (tổng tam giác các id), `chars` (số nhân vật khác nhau đang dùng), `visible` đếm bằng `getVisibleAt` khi là người thật; `positions()` chạy được cho cả hai loại lưới. Giữ các trường cũ để nhánh hình khối vẫn kiểm được.

- [x] **Bước 1:** viết `tests/people-unit/crowd.test.ts`:
  - `crowdUsable(null, true) === false`; `crowdUsable(data, false) === false`; `crowdUsable(data, true) === true`.
  - `crowdPick`: tất định; `isChild` → nhân vật `child`, ngược lại không `child`; với `avoid ≥ 0` kết quả khác `avoid` khi có từ 2 lựa chọn; trên 80 người của một hệ dùng ít nhất 6 nhân vật người lớn khác nhau; hai tên hệ khác nhau cho dãy khác nhau.
  - `crowdRate(1.2, 1.2, 1) === 1`; kẹp ở 0,6 và 1,6; `natural = 0` → 1; `scale` 0,5 làm nhịp tăng gấp đôi trước khi kẹp.
  - `crowdFrame`: trong [0, frames) với `t` = 0; 1; 10 800 s; tại `t = 10 800` hai lần gọi cách nhau 1/60 s lệch đúng `fps × rate / 60` khung (sai số < 0,02, tính modulo `frames`); `loop = false` → `frames − 1`.
  - `crowdBuild` với dữ liệu thật (`crowdParse` + texture giả): `isBatchedMesh`; số id = số người; `sortObjects === false`; `material.name === 'peopleCrowd'`; người có cờ nón dùng lưới có đỉnh cao hơn.
- [x] **Bước 2:** chạy, thấy hỏng.
- [x] **Bước 3:** viết `crowd.ts`. Shader: tính ma trận skin trong `beginnormal_vertex` (2 xương × 2 khung, `texelFetch`, nội suy tuyến tính, đoạn lặp thì khung cuối nội suy về khung đầu), dùng lại ở `begin_vertex`; thông số theo người đọc từ một `DataTexture` float theo `batchId`; uniform thời gian là `shared.uTime`. Xem mục API r165 trong spec §5. `initTexture` cho texture chuyển động và texture thông số.
- [x] **Bước 4:** sửa `people.ts`, `pedestrians.ts`, `main.ts`, `index.html` và các chỗ dùng `People.mesh`.
- [x] **Bước 5:** `npm run typecheck`, `npm run test:people:unit`, `npm run test:stroll:unit`, `npm run build` đạt.
- [x] **Bước 6:** tự xem bằng mắt: mở bản build (`?test`), chụp ảnh ba hệ ngày và đêm vào `tests/screens/crowd-*.png` (không commit); người đứng trên lề, đúng hướng đi, không bay, không chui; `?crowd=off` ra hình khối như cũ. Sửa tới khi đúng.
- [x] **Bước 7:** commit (`feat(people): đám đông người thật bằng BatchedMesh ...`). Ghi "Ghi chú để báo".

### Task 3 (Opus): test trình duyệt và đo

**Tệp:** sửa `tests/people-check.mjs`; sửa test khác chỉ khi nó vỡ vì thay đổi này (ghi lý do).

- [x] **Bước 1:** `tests/people-check.mjs` chạy hai lượt trong cùng một lần gọi:
  - Lượt người thật (mặc định): ba hệ `real === true`, `meshes === 1`, cùng một `material.uuid`, `materialName === 'peopleCrowd'`, `chars ≥ 6` mỗi hệ, `tris` mỗi hệ ≤ `count × 1640`; bật / tắt một hệ làm `renderer.info.render.calls` đổi đúng 1; giữ nguyên ý các kiểm `moving`, `insideSidewalk`, `clearLamps`, `standOverRiver`, `stormClear` (đếm bằng `visible`), `toggleBack`, `dragonLod`, `dragonCull`, `randKept`, console sạch; chân người đúng mặt lề (±0,02 m).
  - Lượt hình khối, mở với `?crowd=off`: các kiểm cũ giữ nguyên (`materialName === 'peopleWalk'`, `verts ≤ 900`, `instAttrs`), và trang không gửi yêu cầu nào tới `people/crowd.`.
  - Thêm một trang chặn `**/people/crowd.*` (route abort): dựng xong, `real === false`, đúng một `console.warn`, không lỗi.
  - Chụp ảnh ba hệ ngày / đêm vào `tests/screens/` (có cờ `--no-shots`).
- [ ] **Bước 2:** `npm run build`, rồi lần lượt, mỗi lệnh một lần, không chạy song song: `test:people`, `test:stroll`, `test:mobile`, `test:drawcalls` (so với bảng `tests/KET-QUA.md`: không góc nào tăng), `test:perf -- --strict`, `test:gpu` (so với số `main` ở đầu `tests/KET-QUA.md`: tăng ≤ 0,5 ms ngày và đêm). `test:perf` nếu chỉ lỗi ở bước "chất lượng … (đêm)" với +0 program thì chạy lại đúng một lần và ghi cả hai kết quả.
- [ ] **Bước 3:** lỗi do code thì sửa (kể cả trong `src/`), chạy lại đúng test đó. Lỗi có sẵn trên `main` thì chứng minh bằng một lần chạy trên `main` rồi ghi lại, không sửa.
- [ ] **Bước 4:** thêm số đo mới vào `tests/KET-QUA.md` (mục D-032: GPU ms, lệnh vẽ, tam giác). Commit. Ghi "Ghi chú để báo".

### Task 4 (Sonnet): tài liệu

- [ ] `.github/memory-bank/decisions.md` (D-032), `systemPatterns.md` (BatchedMesh r165: cạm bẫy ở spec §5; cách thêm nhân vật qua `gen:crowd`; đường lùi), `activeContext.md`, `progress.md` (ghi luôn D-030 đã merge PR #28), `.github/copilot-instructions.md` (§3 mục 5: ngoại lệ gồm cả đám đông; §5: `gen:crowd`, mô tả `test:people*`), `.github/instructions/*` áp cho `src/common/**` / `tests/**` nếu có quy tắc mới, `README.md` (Cấu trúc, ghi nguồn), trạng thái spec, ô plan. Chỉ ghi kết quả test có thật; chỗ chờ số PR ghi `PR-CHO-DIEN`.

---

## Ghi chú để báo

(Các agent thực hiện điền: lệch so với plan, số đo thật, điều người dùng cần biết.)

### Task 1 (2026-11-12)

- **5 nhân vật mới** (Rocketbox commit `0943055`): `Male_Adult_09` (nam, áo phông đen, jean sáng, tóc dài buộc), `Female_Adult_17` (nữ, áo phông xanh lá, jean sáng, tóc búi), `Female_Adult_08` (nữ, áo phông xám, jean, tóc nâu dài), `Male_Child_01` (bé trai, áo len xanh dương, jean), `Female_Child_01` (bé gái, áo hồng tay trắng, jean). Người lớn 4 nam 4 nữ. Trẻ em dùng được (không cần đường lùi spec §4.2): bộ xương tên `Bip02` (đổi tên thành `Bip01` khi nhập), chép chuyển động người lớn bằng góc quay + vị trí hông thu theo tỉ lệ cao hông (0,79).
- **Số thật:** mỗi người 1 499–1 500 tam giác (bản nón +20 = 1 519–1 520), 977–1 094 đỉnh (nón +60); cao người lớn 1,726–1,822 m, trẻ em 1,431 / 1,434 m (tỉ lệ 1, chưa nhân `heightScale`). `crowd.bin` 1 045 904 B, `crowd.jpg` 266 630 B (1920 × 768, ô 384², JPEG q85), tổng 1 312 534 B: trong trần, **không phải nhượng gì** (idle đủ ≈ 3,2–3,3 s, vị trí / pháp tuyến / uv để float32, index u16). Texture chuyển động 66 × 1 030 (RGBA half-float, 543 840 B).
- **Tốc độ tự nhiên (m/s, tỉ lệ 1):** nam walk 1,048 / jog 2,88; nữ walk 1,214 / jog 2,765 (cùng đoạn nguồn nên mọi người lớn cùng giới giống nhau); bé trai 0,83 / 2,428; bé gái 1,003 / 2,405.
- **Lệch plan:**
  - `npm run gen:crowd` = `node scripts/people/blender.mjs scripts/people/crowd.py` (tệp mới `blender.mjs`), không cùng kiểu `gen:people`: npm 11 trên máy này chạy script qua cmd.exe và không gọi được đường dẫn exe có dấu cách trong ngoặc kép (`'C:/Program' is not recognized`). `gen:people` hiện cũng hỏng vì lý do này (chưa sửa, ngoài phạm vi). Đường dẫn Blender đổi được bằng biến môi trường `BLENDER`.
  - `convert.py`: bọc khối chạy trong `if __name__ == '__main__':` (để `crowd.py` nạp làm thư viện) và thêm tham số `rot_only=False` cho `add_clip` (dùng cho trẻ em). Mặc định giữ nguyên hành vi; không chạy lại `gen:people`, 5 tệp `p*.glb` không đổi.
  - Giản lược bảo vệ thêm cẳng tay + bàn tay (trọng số 0,5) và vùng miệng (0,02) ngoài vùng đầu (0,15): không có thì tay gập (chụp ảnh, chạy) thành hình quạt và răng / lưỡi lòi ra thành vệt xám ở miệng.
  - Test đơn vị thêm kiểm ma trận xương khung đầu của walk là phép quay thuần (cột dài 1 ± 0,02) và kiểm phiên bản lạ bị từ chối.
- **Còn thấy trong ảnh xem trước** (`scripts/people/.cache/preview-crowd/`): khi nhìn sát mặt, `Female_Adult_08` còn khe miệng tối, `Female_Adult_12` có khuyên môi; ở cỡ 120 px không thấy. Trẻ em chạy (`jog`) bay khỏi mặt đất ≈ 3,6 cm, nhưng trẻ em chỉ là người đi cùng (đi bộ) nên không dùng `jog`.
- **Cho Task 2:** `uv` có v = 0 ở mép trên ảnh, atlas từ `crowdLoad` đã `flipY = false` (ImageBitmap). Lưới ở tư thế chữ T / A (tay dang), mặt +X, chân y = 0; khối cầu bao (đã `computeBoundingSphere`) bán kính ≈ 0,88–0,94 m người lớn, 0,74 m trẻ em, tâm y ≈ 0,86–0,91 / 0,72 m, chưa nới `cullPad`. Skin: 2 xương mỗi đỉnh, `aBones` (u8, chỉ số 0..21), `aW` = trọng số xương thứ nhất, xương thứ hai 1 − `aW`; ma trận xương b của khung r ở texel (b × 3 + j, r), j = 0..2 là ba hàng của ma trận 3×4 (đỉnh mới = dot(hàng, (p, 1))). Nón lá là lưới gắn cứng xương đầu (chỉ số 5) trong bản `hat`, 10 cạnh, bán kính vành 0,21 m, đỉnh cao hơn đỉnh đầu ≈ 0,1 m, có mặt trong. `maxVerts` 1 154, `maxIndices` 4 560 (bản nón). `crowdLoad` đọc `?crowd=off` qua `location.search`; khi preload trong `index.html` dùng `crossorigin` để khớp chế độ `fetch` mặc định.

### Task 2 (2026-11-12)

- **Đã làm:** `src/common/people/crowd.ts` (`crowdUsable`, `crowdPick`, `crowdRate`, `crowdFrame`, `crowdMaterial`, `crowdBuild` đúng chữ ký plan), `createPeople` / `stepPeople` hai nhánh, `peopleTest` chạy cho cả hai loại lưới, `await crowdLoad()` đầu khối khởi tạo của `main.ts`, preload trong `index.html`, `gen:people` sửa thành `node scripts/people/blender.mjs scripts/people/convert.py` (không chạy).
- **Số đo:** `typecheck` đạt; `test:people:unit` 33/33 (5 test mới), `test:stroll:unit` 87/87; `build` đạt: `index` 593,62 → 602,85 kB, `three` 621,61 → 633,60 kB (`BatchedMesh` vào bundle). Bản build mở bằng Chromium SwiftShader (`?test`, 960×540): ba hệ `real`, cùng một vật liệu `peopleCrowd`; tam giác ttl 120 388 / sh 114 357 / dragon 105 329; nhân vật khác nhau 10 / 10 / 9; nón 21 / 19 / 18. Tắt `visible` lưới của một hệ: `renderer.info.render.calls` giảm đúng 1 ở cả ngày và đêm cho cả ba hệ (vd. 240 → 239 Cầu Rồng ngày, 128 → 127 Trần Thị Lý đêm); quay lưng lại Cầu Rồng ở gần: 260 → 260 (hệ tốn 0 lệnh vẽ). `?crowd=off`: ba hệ `peopleWalk` 853 đỉnh, 0 yêu cầu tới `people/crowd.`. Console: không lỗi / cảnh báo shader (chỉ cảnh báo có sẵn "KHR_parallel_shader_compile not supported" của SwiftShader và lỗi tải font / gtag do script tự chặn).
- **Lệch plan:**
  - `People` thêm trường `real` như plan; thông tin theo id (nhân vật, nón, tỉ lệ, tổng tam giác) để ở `mesh.userData.crowd` (`CrowdInfo`), thêm export `crowdParams` (texture thông số cho `initTexture`). Không đổi chữ ký nào trong plan.
  - Thông số từng người nằm trong **một** texture dùng chung cho cả 3 hệ (một vật liệu ⇒ không có uniform riêng theo hệ); chỉ số người trong texture ghi vào kênh alpha của `batchingColorTexture` (r165 `setColorAt` chỉ ghi rgb). Đọc trường riêng `_colorsTexture` của `BatchedMesh` (r165 không có API khác): nâng three phải kiểm lại.
  - Preload: cả hai tệp `as="fetch"` + `crossorigin` (plan ghi `as="image"` cho jpg: không khớp `fetch()` ⇒ tải hai lần + cảnh báo "preloaded but not used"); chèn bằng script nhỏ trong `index.html` để `?crowd=off` không gửi yêu cầu nào.
  - `perObjectFrustumCulled = true` ở cả ba hệ (khối cầu từng id nới `cullPad / tỉ lệ`): khi mọi người của hệ ra ngoài khung nhìn, r165 không gọi lệnh vẽ nào ⇒ một số góc trong `test:drawcalls` có thể **giảm** 1 (không tăng).
  - Pha chuyển động: `mod(uTime, chu kỳ người)` trước khi nhân khung/giây; `crowdFrame` là bản CPU cùng công thức (double). Sai số còn lại do chính `uTime` float32 sau 3 giờ (≈ 1 ms ⇒ ≤ 0,05 khung), không thấy được.
- **Xem bằng mắt** (`tests/screens/crowd-*.png`, không commit): người đứng đúng mặt lề, đi đúng hướng, chân không trượt rõ, có nón lá, người chạy (`jog`) đúng dáng; đêm sáng như cảnh (không đen). SwiftShader không có `KHR_parallel_shader_compile` ⇒ bộ đèn luôn `full`: **chưa kiểm được** chuyển bộ đèn `day` / `night` (D-031) bằng mắt; vật liệu là `MeshStandardMaterial` thường nên đi cùng đường hâm như mọi vật liệu khác.
- **Cho Task 3:** `systems()` nay trả thêm `real, tris, chars, hats`; người thật bị bão ẩn giữ ma trận cũ (đếm bằng `visible`, đừng dựa vào scale 0); `positions().scale` của người thật là tỉ lệ so với lưới (`heightScale × Walker.scale`, trẻ em `heightScale`), không phải `Walker.scale`. Bật / tắt để đếm lệnh vẽ phải đổi `visible` của **lưới** (nhóm bị `update` của cầu ghi đè mỗi khung). `test:perf` cần xem số program: vật liệu mới thêm program theo bộ đèn như mọi vật liệu, đồng thời `peopleWalk` không còn được dùng.


### Task 3, Bước 1 + `test:people` (2026-11-12)

- **Đã làm:** `tests/people-check.mjs` viết lại thành năm trang trong một lần gọi: A người thật (bộ kiểm cũ + `drawCalls`, `noSlip`, `feet`, người đi cùng ẩn cùng người dẫn khi bão, ma trận đúng chỗ sau bão, `dragon-people` 0 lệnh vẽ khi xa / quay lưng đếm bằng `_multiDrawCount`, mỗi tệp `crowd.*` tải đúng 1 lần, không cảnh báo shader, ảnh không đen kịt), B `?crowd=off` (bộ kiểm cũ, 0 yêu cầu tới `people/crowd.`), C chặn `crowd.*`, D `crowd.bin` chậm 12 s (> `loadTimeoutMs`), E `crowd.jpg` không giải mã được (C/D/E: dựng xong, hình khối đủ người, đúng 1 `console.warn "[people]"`, không lỗi). `tests/lib.mjs`: `openApp` thêm tuỳ chọn `before(page)` (gắn route / nghe console trước khi mở trang; test khác không đổi). `peopleTest` (`pedestrians.ts`, chỉ đọc): `positions()` thêm `visible, follow, lx, lz, speed` và với người thật `char, clip, rate` (đọc lại từ texture thông số shader dùng), `natural`; thêm `crowdFeet()` (skin lưới trên CPU từ `crowd.bin`, y thấp nhất mỗi đoạn). `crClip` trong `crowd.ts` thêm `export` (không đổi hành vi).
- **Lỗi thật đã sửa:** ảnh đêm Cầu sông Hàn đen kịt ở người thật (`?crowd=off` thì bình thường). Nguyên nhân: `crowd.bin` có 5 đỉnh pháp tuyến dài 0 ở `Female_Adult_03` (đỉnh 968–972, thân, y ≈ 1 m; Blender trả pháp tuyến góc 0 sau giản lược) ⇒ `normalize()` ra NaN ⇒ điểm ảnh NaN, ban đêm bloom lan ra cả khung. Sửa trong `crowdParse` (`crowdData.ts`, hàm `crFixNormals`): đỉnh pháp tuyến 0 lấy tổng pháp tuyến mặt các tam giác dùng nó. Test đơn vị mới trong `crowdData.test.ts` (mọi pháp tuyến dài 1). **Gốc ở `crowd.py`**: lần sinh lại sau nên sửa luôn ở đó (chưa sửa, cần Blender).
- **Kết quả `test:people`** (bản build có sửa trên, 960×540 SwiftShader): "Tất cả ĐẠT", exit 0, 20,3 phút: A 73/73, B 49/49, C 4/4, D 6/6, E 4/4. Lệnh vẽ bật / tắt lưới: ttl 118 → 117, sh 216 → 215, dragon 204 → 203 (ngày). `dragon-people`: 2 001 m 0 lệnh vẽ; quay lưng ở 1 381 m / 1 081 m 0 lệnh vẽ; nhìn vào ở 292 m 1 lệnh mỗi khung. Bão: giữa chừng 43/80, 43/76, 37/70, 0 người đi cùng lệch người dẫn. Tải chậm: trang chờ hết hạn 8 s rồi dựng hình khối (lý do "quá 8000 ms"). Nhịp phát 0,78–1,60, tốc độ ÷ tốc độ chân 1,000–1,069 (chỉ vài người Cầu sông Hàn chạm trần `rateMax`). Ba lần chạy: lần 1 (34 phút) 3 lỗi `feet` do oracle chấm cả pha bay của `jog` + phát hiện ảnh đen; lần 2 dừng tay sau khi thêm kiểm ảnh đen; lần 3 đạt.
- **Ngưỡng `feet` (tôi đặt, không có trong plan):** đi / đứng chấm mọi khung, chạy chỉ khung chạm đất; lơ lửng > 2 cm hoặc chìm > 3 cm là lỗi; chìm 2–3 cm chỉ in ra. Dữ liệu thật: `Female_Adult_08` `walk` chìm 2,0–2,2 cm ở vài khung (12 người dùng), trẻ em `jog` bay 3,7 cm ở khung thấp nhất (trẻ em không chạy nên không dùng). Muốn chặt ±2 cm thì phải sửa chuyển động trong `crowd.py`.
- **Chưa chạy** (theo phạm vi lần này): `test:stroll`, `test:mobile`, `test:drawcalls`, `test:perf -- --strict`, `test:gpu`; chưa cập nhật `tests/KET-QUA.md`. Kiểm "chân đúng mặt lề" vẫn chấm gốc hình (ma trận) như cũ, chặt hơn ±0,02 m. Bộ đèn `day` / `night` (D-031) vẫn chưa kiểm được trên SwiftShader.
- **Môi trường:** máy này thiếu `node_modules/.bin` nên `npm run build` / `typecheck` báo "'tsc' is not recognized"; đã chạy trực tiếp `node node_modules/typescript/bin/tsc --noEmit` và `node node_modules/vite/bin/vite.js build`. Trong lúc làm có người khác sửa `src/config.ts` (`strollBase.walk` 3,5 → 1,6, chưa commit) làm `test:stroll:unit` hỏng 1 ("hướng theo camYaw"); không thuộc task này, không commit, bản build dùng cho `test:people` có thay đổi đó (không đụng người đi bộ).
