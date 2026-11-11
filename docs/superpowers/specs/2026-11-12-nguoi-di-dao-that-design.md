# Người đi dạo dạng người thật (mô hình có xương, đi và chạy thu từ người thật) — thiết kế

_2026-11-12 · Trạng thái: Đã xây (nhánh chưa merge; test trình duyệt đang chạy, xem memory bank) · Quyết định: D-030 · Nhánh: `feature/nguoi-di-dao-that`_

## 1. Ý định

Sau khi thử chế độ Đi dạo (D-029), người dùng thấy hai điều giả nhất:

- Nhân vật là các khối ghép (viên nang, quả cầu, hộp), không giống người.
- Khi nhảy, nhân vật đưa hai tay ra trước rồi đứng im trên không, "giống zombie hơn là người nhảy".

Người dùng muốn hình người trông thật nhất có thể và chuyển động thật nhất có thể. Trong lúc trao đổi họ quyết định thêm: **được dùng mô hình và ảnh ngoài** cho việc này, **bỏ hẳn nhảy** (chỉ đi và chạy), **giữ tốc độ nhanh như hiện nay**.

Việc được tách làm hai dự án. Tài liệu này là dự án 1: **người chơi đi dạo** (mình và tối đa 4 người khác, nhìn gần). Dự án 2 (đám đông vài trăm người đi bộ trên cầu và bờ sông) thiết kế sau, khi người dùng đã xem dự án 1 trên demo.

## 2. Mục tiêu / không làm / thất bại

Mục có dấu **(ND)** là người dùng nói hoặc chọn. Còn lại là quyết định của Claude (người dùng giao "phần còn lại tự quyết, có vấn đề thì ghi lại rồi báo").

**Mục tiêu**
- **(ND)** Nhân vật đi dạo là mô hình người có xương, có texture, thay cho khối ghép.
- **(ND)** Nhân vật chính (nhân vật mình điều khiển): nam trẻ, nét châu Á, phong cách đường phố / hiphop. Người dùng đã xem ảnh và chọn Rocketbox `Male_Adult_10` (áo khoác thể thao đỏ sọc trắng, quần gió đen, sneaker trắng).
- **(ND)** Các nhân vật còn lại do Claude chọn, phải đa dạng và hợp bối cảnh Đà Nẵng.
- **(ND)** Chỉ đi và chạy, bằng chuyển động thu từ người thật. Giữ `CONFIG.stroll.walk` 3,5 m/s và `run` 10 m/s.
- **(ND)** Bỏ hẳn tính năng nhảy: phím Space, nút "Nhảy" trên điện thoại, chữ hướng dẫn.
- Đứng yên có dáng thở nhẹ; chụp ảnh có động tác giơ máy thật.
- Người khác (qua mạng) cũng là mô hình có xương, cùng bộ chuyển động.

**Không làm** (đợt này)
- Đám đông người đi bộ có sẵn (`src/common/people/`, `src/environment/pedestrians.ts`, người trên các cầu): giữ nguyên hình khối và dáng trong shader. Đó là dự án 2.
- Người treo dưới dù lượn.
- Chọn nhân vật / trang phục trong giao diện.
- Biểu cảm mặt, cử động ngón tay, tóc và vải bay.
- Đổi giao thức mạng hoặc Worker `danang-sky` (không deploy gì).
- Chuyển động bắt đầu / dừng / quay người riêng (chỉ trộn giữa các đoạn lặp).

**Coi là thất bại dù vẫn chạy**
- Nhân vật còn tay dang chữ T, tay chân vặn sai, hoặc trượt đứng im như tượng khi đang di chuyển.
- Tải mô hình lỗi hoặc chậm làm không đi dạo được, hoặc làm trang lỗi.
- Trang thường (không vào Đi dạo, không có ai đi dạo) phải tải thêm file mô hình, hoặc tăng draw call ở góc nhìn cũ.
- Vị trí nhà / cây / xe đổi (chuỗi `rand()`), dù lượn hoặc Tour đổi hành vi.
- Còn sót nút, phím hoặc chữ "Nhảy" ở bất kỳ ngôn ngữ nào.
- File nguồn có giấy phép không cho phát hành lại nằm trong repo (repo công khai, giấy phép MIT).

## 3. Nguồn mô hình và giấy phép

Đã thử trong lúc brainstorm (bản nháp trong thư mục tạm; phần lõi của script chuyển đổi đã chạy được chép vào plan):

| Nguồn | Kết quả |
|---|---|
| Microsoft Rocketbox (`github.com/microsoft/Microsoft-Rocketbox`, giấy phép MIT) | 115 nhân vật chung một bộ xương `Bip01` 80 xương, có ảnh xem trước; hàng chục đoạn đi / chạy / đứng / chụp ảnh. Chuyển sang glTF bằng Blender 4.5 chạy được. **Chọn.** |
| Tự dựng bằng MPFB / MakeHuman (CC0) | Mặt đơ, da lòi qua quần áo, kho đồ CC0 không có hoodie. Loại. |
| Mixamo, chợ mô hình (CGTrader…), Ready Player Me | Giấy phép không cho đưa file gốc lên repo công khai, hoặc dịch vụ đã đóng. Loại. |

- **Ngoại lệ của bất biến số 5** ("không thêm ảnh ngoài"): người dùng cho phép riêng cho hình người. Ghi vào `decisions.md` (D-030) và `copilot-instructions.md` §3 mục 5. Vẫn không thêm thư viện runtime: `GLTFLoader` và `SkeletonUtils` nằm trong `three/addons` đã có.
- Rocketbox **không có đoạn nhảy**; vì người dùng bỏ nhảy nên không cần nguồn thứ hai.
- Giấy phép MIT đòi giữ dòng bản quyền: chép `LICENSE.md` của Rocketbox vào `public/people/LICENSE-Rocketbox.txt`, thêm một dòng ghi nguồn trong README.
- File nguồn (FBX, TGA, hàng chục MB mỗi nhân vật) **không commit**. Script chuyển đổi tải chúng từ một commit cố định của Rocketbox vào thư mục đã gitignore. Chỉ commit file `.glb` kết quả.

## 4. Nhân vật

Năm nhân vật, đánh số 0–4:

| # | Rocketbox | Mô tả | Bộ chuyển động |
|---|---|---|---|
| 0 | `Male_Adult_10` | **(ND)** nhân vật chính: nam trẻ nét Á, áo khoác thể thao đỏ, quần gió đen, sneaker | nam |
| 1 | `Female_Adult_12` | nữ trẻ, hoodie đen, quần lửng, sneaker | nữ |
| 2 | `Male_Adult_01` | nam trẻ, áo polo kẻ, quần soóc, sneaker (dáng khách du lịch) | nam |
| 3 | `Female_Adult_03` | nữ trẻ nét Á, tóc đen ngắn, áo hai dây tím, quần đen, giày bệt | nữ |
| 4 | `Male_Adult_17` | nam, hoodie xanh trắng, mũ, quần jean | nam |

Commit Rocketbox ghim: `0943055db6ec570bcef9f2c8b41c9e5467c808f9` (nhánh `master` ngày 2026-11-12). Đường dẫn nguồn: `Assets/Avatars/Adults/<tên>/Export/<tên>.fbx`, `…/Textures/*.tga`, `Assets/Animations/all_animations_max_motextr_xy/` (đi, chạy) và `…_static/` (đứng, chụp ảnh); mọi đoạn nêu ở §5 đã kiểm là có.

Bốn nhân vật 1–4 là lựa chọn của Claude theo ảnh xem trước. Người làm phải xuất ảnh từng nhân vật sau khi chuyển đổi và xem lại; nếu một nhân vật hỏng (texture lỗi, hình không hợp) thì thay bằng nhân vật Rocketbox khác cùng tiêu chí (đồ thường ngày, không phải áo choàng / khăn trùm kiểu Trung Đông, không vest công sở) và ghi lại trong plan.

**Ai là nhân vật nào** (quyết định của Claude):
- Nhân vật mình điều khiển **luôn là số 0**, kể cả khi đi nhiều người và mình giữ slot khác 0. Lý do: người dùng gọi đó là "nhân vật chính".
- Người khác ở slot `s` hiện bằng nhân vật `1 + (s mod 4)`. Như vậy người khác không bao giờ trùng hình với mình, hai người khác chỉ trùng hình khi ở slot 0 và 4.
- Hệ quả đã chấp nhận: hai máy khác nhau thấy cùng một người bằng hình khác nhau (mỗi máy thấy chính mình là số 0). Nhãn tên trên đầu vẫn là thứ nhận diện, như hiện nay. Màu áo theo slot (`multiParams.colors`) không còn dùng cho người đi dạo.
- Đang xem (hết chỗ) hoặc đang bay dù: không có "mình" đi dạo, mọi người đi dạo theo quy tắc `1 + (s mod 4)`.

## 5. Chuyển động

### Các đoạn (clip)

Mỗi file `.glb` chứa mô hình và 5 đoạn đã gắn sẵn vào xương của chính nhân vật đó, tên đoạn giống nhau ở mọi nhân vật:

| Tên trong glb | Nguồn (nam / nữ) | Ghi chú |
|---|---|---|
| `idle` | `m_idle_neutral_01` / `f_idle_neutral_01` | cắt còn khoảng 6 s đầu, lặp; người làm chọn điểm cắt sao cho đầu và cuối khớp (hoặc trộn 0,3 s) |
| `walk` | `m_walk_cool_01` / `f_walk_neutral_01` | đi bộ; đo được nam 1,05 m/s tự nhiên, chu kỳ 1,27 s |
| `jog` | `m_run_neutral_01` / `f_run_neutral_01` | chạy bộ; tốc độ tự nhiên do script đo |
| `sprint` | `m_run_fast_01` / `f_run_fast_01` | chạy nhanh; đo được nam 5,84 m/s tự nhiên, chu kỳ 0,6 s |
| `photo` | `m_take_picture` / `f_take_picture` | chỉ cắt phần **giơ máy lên** và kết thúc ở tư thế máy trước mặt, dài ≤ 0,8 s (tua nhanh lúc nướng nếu đoạn gốc chậm hơn); `photoHold` giữ 1,2 s |

Nếu một đoạn nữ tên như trên không tồn tại hoặc hỏng, dùng đoạn nữ gần nhất (`f_walk_neutral`, `f_run_fast_01`…), ghi trong plan.

Cách gắn (đã thử, chạy được): file chuyển động Rocketbox có tư thế gốc khác file nhân vật, chép thẳng đường cong thì tay vẫn dang chữ T. Phải cho bộ xương nguồn diễn, đặt ràng buộc Copy Transforms từng xương cùng tên lên bộ xương nhân vật, rồi nướng (`nla.bake`, visual keying). Với đoạn di chuyển, trừ phần trôi thẳng của xương hông (`Bip01 Pelvis`) để nhân vật chạy tại chỗ, giữ lại lắc hông và nhún. Quãng trôi chia thời lượng là **tốc độ tự nhiên** của đoạn; script ghi số này vào `extras` của từng animation trong glb (khóa `speed`, m/s) để mã đọc, không chép tay vào config.

### Chọn và trộn đoạn theo tốc độ

Một hàm thuần (không three, có unit test) nhận dáng (`pose`) và tốc độ mặt bằng `v`, trả trọng số từng đoạn và hệ số tua:

- `pose` đứng yên → `idle` 100 %.
- `pose` chụp ảnh → `photo` 100 %, chạy một lần (không lặp), hết thì giữ khung cuối (tư thế giơ máy) tới khi đổi dáng; hạ tay là do trộn chéo về `idle`.
- `pose` rơi (3) → nếu `v` > 0,1 m/s thì như đi / chạy theo `v` (chạy khỏi bậc không bị đứng hình), ngược lại `idle`. Người khác ở dáng 3 có tốc độ danh định 0 nên là `idle`.
- `pose` đi hoặc chạy → trộn theo `v` trên ba mốc: `walk` tại `v ≤ walkTo`, `jog` tại `v = jogAt`, `sprint` tại `v ≥ sprintFrom`; giữa hai mốc trộn tuyến tính hai đoạn kề nhau. Mặc định `walkTo` 1,8 · `jogAt` 3,5 · `sprintFrom` 7,0 m/s (ước lượng, đặt trong `CONFIG.stroll.anim`).
- Hệ số tua = `v` chia tốc độ tự nhiên của hỗn hợp (trung bình theo trọng số), kẹp trong `[rateMin, rateMax]` = `[0,6; 1,6]`. Ở 10 m/s đoạn `sprint` tua 1,6 lần (lẽ ra 1,71): chân trượt nhẹ khoảng 7 %, đổi lại guồng chân không quá hoạt hình. Người dùng đã chấp nhận "hơi game" khi chọn giữ tốc độ.
- Hai đoạn di chuyển đang trộn phải **đồng pha**: cùng vị trí tương đối trong chu kỳ (three: `syncWith` hoặc tự đặt `time` theo một pha chung 0–1), nếu không chân sẽ đan vào nhau.
- Đổi giữa nhóm (đứng ↔ di chuyển ↔ chụp ảnh): trộn chéo trong `fade` 0,2 s.

Hệ quả cần báo người dùng: bấm W (3,5 m/s) thì nhân vật **chạy bộ nhẹ**, không phải đi bộ, vì 3,5 m/s nhanh gấp hơn hai lần đi bộ thật. Dáng đi bộ thật chỉ thấy khi gạt nhẹ cần gạt trên điện thoại hoặc lúc tăng / giảm tốc. Muốn W là đi bộ thật thì phải hạ `CONFIG.stroll.walk` về khoảng 1,6 m/s; người dùng đã chọn giữ tốc độ nên không đổi.

### Người khác (qua mạng)

Gói vị trí không đổi: vẫn chở `pose` (0 đứng, 1 đi, 2 chạy, 4 chụp ảnh), không có tốc độ. Người khác dùng tốc độ danh định như hiện nay (`walk` / `run` của config) để chọn đoạn.

## 6. Bỏ nhảy

- `StInput.jump`, `jumpQueued`, phím Space, hàm `jump` của `stTouchBind`, nút `#stJump` (HTML + CSS), `CONFIG.stroll.jumpHeight`: xóa.
- Khóa i18n `stJump`: xóa ở 9 ngôn ngữ. `stHint`: bỏ phần "Space: nhảy" ở 9 ngôn ngữ.
- **Rơi vẫn giữ**: bước khỏi bậc cao hơn `stepMax` thì nhân vật rơi theo `gravity` (trạng thái `air`), vì bản đồ có bậc. Chỉ bỏ lối chủ động rời đất.
- Dáng số 3 (`ST_POSE_JUMP`) đổi tên `ST_POSE_FALL`, **giữ giá trị 3** để tương thích giao thức (máy chủ kẹp `poseMax`, khách bản cũ còn gửi 3). Khi vẽ: xem §5 (theo tốc độ; người khác là `idle`).
- Tường thấp (trường `top`: gờ chắn xe Cầu Rồng 0,9 m, gờ Cầu sông Hàn 0,545 m): mã va chạm giữ nguyên, nhưng vì không nhảy được nữa nên chúng thành vật cản cứng khi đi trên mặt đất. Người làm phải kiểm bằng test có sẵn hoặc thêm kiểm: từ điểm xuất phát vẫn tới được Cầu Rồng (lề), Cầu sông Hàn và dải ven sông hai bờ mà không cần nhảy (lòng đường Cầu Rồng đã có test đi vòng qua đầu cầu trong `tests/stroll-unit/mapData.test.ts`; Cầu sông Hàn chưa có, phải thêm). Nếu có vùng chỉ tới được bằng nhảy thì **ghi lại và báo**, không tự mở lối mới (đổi bản đồ là việc khác).
- Dọn mã chết ở người đi bộ khối: cờ `PP_FLAG.jump`, `CONFIG.people.jump`, nhánh nhảy trong shader `material.ts` và `gait.ts` chỉ phục vụ nhân vật đi dạo cũ. Xem §7: hình khối cũ vẫn được giữ làm hình tạm, nhưng hình tạm không nhảy, nên các phần này xóa được. Cờ `photo` giữ (người đứng chụp ảnh trong đám đông dùng).

## 7. Kiến trúc

### File mô hình

- `public/people/p0.glb` … `p4.glb`: mỗi file một nhân vật + 5 đoạn. Trần dung lượng: **≤ 1,5 MB mỗi file, ≤ 6 MB cả năm** (bản thử chưa tối ưu: 4,4 MB với texture 2048 và đoạn chưa cắt).
- Cách đạt: texture màu thân 1024 px, đầu 512 px, JPEG chất lượng khoảng 80; **bỏ normal map và specular** (ở khoảng cách camera 6 m không thấy khác, đổi lấy dung lượng); mảnh trong suốt (tóc / lông mi, vật liệu `opacity`) giữ kênh alpha bằng PNG cỡ nhỏ và `alphaTest` thay vì trộn trong suốt; lấy mẫu chuyển động 30 khung/giây; bỏ đường cong của xương mặt (`Bip01 MJaw`, môi, mí, mày…) vì không diễn mặt. Không dùng nén Draco / Meshopt (cần thêm bộ giải nén). Nếu vẫn vượt trần, nhường theo thứ tự: (1) bỏ đường cong xương ngón tay (giữ bàn tay ở tư thế nghỉ hơi khum), (2) bỏ kênh tỉ lệ và kênh vị trí của mọi xương trừ `Bip01 Pelvis`, (3) `idle` và `photo` lấy mẫu 15 khung/giây, (4) rút `idle` còn 4 s, (5) nới trần lên 2 MB mỗi file / 10 MB cả năm và ghi lại để báo. Không giảm lưới.
- Hướng và tỉ lệ nướng sẵn vào file: mét, chân ở y = 0, **mặt hướng +X** (như hình khối cũ, để mã đặt `yaw` không đổi), trục đứng +Y. Chiều cao nhân vật giữ như Rocketbox (khoảng 1,7–1,83 m).

### Script chuyển đổi

- `scripts/people/convert.py` (cùng chỗ với các script hiện có) chạy bằng Blender (`blender -b --python scripts/people/convert.py`), lệnh `npm run gen:people`. Đầu file ghi cách chạy, phiên bản Blender đã thử (4.5), commit Rocketbox đã ghim, bảng nhân vật và đoạn. Tải nguồn vào `scripts/people/.cache/` (thêm vào `.gitignore`).
- Script in bảng: số tam giác, số xương, dung lượng, thời lượng và tốc độ tự nhiên từng đoạn; và xuất ảnh kiểm tra từng nhân vật ở vài khung của từng đoạn vào `scripts/people/.cache/preview/`.
- Máy không có Blender vẫn build và chạy được dự án, vì `.glb` đã commit. Đây là công cụ của người phát triển, giống `gen:voice`.

Đường dẫn file tĩnh ghép với `import.meta.env.BASE_URL` (mẫu `src/audio/narration.ts`).

### Mã (thay `src/explore/stroll/avatars.ts`, giữ nguyên mặt ngoài)

`stAvatars` giữ nguyên các hàm mà nơi khác gọi (`build`, `setSelf`, `sync`, `onPos`, `update`, `slotState`, `name`, `clear`, `self`, `mesh`), để `index.ts`, `multi/index.ts`, `labels.ts`, `watch.ts` không phải đổi cách dùng. Bên trong tách ba phần:

1. **Chọn đoạn (thuần):** hàm ở §5, file riêng, có unit test.
2. **Nạp mô hình:** `import()` động `GLTFLoader` + `SkeletonUtils` (không vào gói chính), nạp `p<k>.glb` khi lần đầu cần nhân vật `k`, nhớ đệm theo `k`. Bắt đầu nạp `p0` ngay khi người dùng chọn thẻ Đi dạo ở màn chọn (trước sảnh), để vào tới nơi thường đã có.
3. **Nhân vật hiện hình:** mỗi slot đang hiện có một bản sao (`SkeletonUtils.clone`) + một `AnimationMixer`. `build()` trả một `THREE.Group` tên `stroll-people` (tên giữ nguyên vì test và mã khác tìm theo tên). Mỗi khung: đặt vị trí / hướng, tính trọng số bằng hàm thuần, `mixer.update(dt)`.

**Hình tạm:** trong lúc `.glb` của một slot chưa nạp xong, hoặc nạp lỗi, slot đó hiện bằng hình người khối cũ (InstancedMesh + `ppMaterial` hiện có, đi / chạy trong shader). Nạp xong thì đổi sang mô hình thật ở khung kế tiếp. Nạp lỗi: `console.warn` một lần, giữ hình khối, không thử lại trong phiên. Nhờ vậy lỗi mạng không bao giờ làm mất nhân vật.

**Vẽ:**
- Lớp 1 như cũ (không vào phản chiếu mặt nước).
- Số lệnh vẽ: mỗi nhân vật thật tối đa 3 (thân, đầu, mảnh alpha). Script gộp được vật liệu thì gộp, không bắt buộc. Tối đa 5 nhân vật → thêm ≤ 15 lệnh vẽ, **chỉ khi có người đi dạo đang hiện**. Góc nhìn cũ không có người đi dạo: +0 (bất biến số 2).
- Đổ bóng: **không** (`castShadow = false`, như hình khối cũ). Vùng bóng mặt trời của cảnh rộng 940 m với `normalBias` 0,6 m (`src/core/lights.ts`), người rộng khoảng 0,45 m nên bóng sẽ hỏng, và lượt bóng còn nhân đôi số lệnh vẽ. Chân không có bóng là hạn chế đã biết, ghi ở §10.
- Vật liệu: giữ `MeshStandardMaterial` do bộ nạp tạo, đặt `roughness` cao, `metalness` 0, `envMapIntensity` theo cảnh. Không emissive, không đèn mới. Ban đêm nhân vật tối theo ánh sáng cảnh như các vật khác; người làm xem ảnh đêm, nếu nhân vật đen kịt thì ghi lại để báo.
- `frustumCulled`: tắt cho SkinnedMesh (hộp bao theo tư thế gốc sai khi diễn), 5 nhân vật nên không đáng kể.
- Không cấp phát mỗi khung (D-018): véc-tơ, mảng trọng số tái dùng.

**Nhãn tên:** `CONFIG.stroll.labelAbove` chỉnh theo chiều cao nhân vật mới nếu cần.

## 8. Thông số mới trong `src/config.ts`

`CONFIG.stroll.anim` (mọi số là ước lượng, có chú thích tiếng Việt và đơn vị):
`walkTo` 1,8 m/s · `jogAt` 3,5 m/s · `sprintFrom` 7,0 m/s · `rateMin` 0,6 · `rateMax` 1,6 · `fade` 0,2 s · `models` (5 đường dẫn `people/p0.glb`…) · `others` 4 (số nhân vật dành cho người khác).

Xóa: `CONFIG.stroll.jumpHeight`, `CONFIG.stroll.cadenceMax` (nếu hình tạm không còn cần), `CONFIG.stroll.pants` giữ cho hình tạm, `CONFIG.people.jump`.

## 9. Kiểm tra

**Unit (nhanh, không trình duyệt)**
- Hàm chọn đoạn: tổng trọng số = 1; đứng → `idle`; 3,5 m/s → `jog` 100 %; 10 m/s → `sprint` 100 %, tua = `rateMax`; giữa hai mốc trộn đúng hai đoạn kề; chụp ảnh → `photo`; dáng 3 → `idle`.
- Quy tắc nhân vật theo slot: mình → 0; người khác slot 0..4 → 1,2,3,4,1.
- `motion`: không còn trường `jump`; bước khỏi bậc vẫn rơi; đứng trước gờ 0,9 m không qua được.
- File `.glb` (đọc bằng Node, không cần trình duyệt): 5 file tồn tại, mỗi file ≤ 1,5 MB, có đủ 5 animation đúng tên, mỗi animation di chuyển có `extras.speed` > 0, có `LICENSE-Rocketbox.txt`.
- `people`: không còn cờ nhảy; test dáng cũ vẫn đạt.

**Trình duyệt** (sửa `tests/stroll-check.mjs`, `mobile-check.mjs`, `multi-check.mjs`)
- Vào Đi dạo: sau khi nạp, `stroll-people` có đúng 1 SkinnedMesh-nhân vật đang hiện, là nhân vật 0; không có lỗi console.
- Chuyển động thật sự chạy: khi giữ chạy, vị trí thế giới của một xương bàn chân so với hông thay đổi theo thời gian (biên độ > 0,2 m); khi đứng yên thì gần như không đổi (< 0,05 m).
- Không còn `#stJump`; Space không làm nhân vật rời đất; 9 ngôn ngữ không có `stJump`, `stHint` không chứa từ "Space".
- Nạp lỗi (chặn request `.glb` trong test): vẫn đi được, hiện hình khối, không lỗi chưa bắt.
- Trang `?test` không vào Đi dạo: không có request nào tới `people/*.glb`, không có `stroll-people`.
- Nhiều người: bot đi dạo ở slot khác hiện bằng nhân vật `1 + (s mod 4)`.
- Ảnh chụp ngày và đêm ở điểm xuất phát (đứng, chạy) vào `tests/screens/` để người xem lại.

**Chạy trước khi báo xong:** `typecheck`, `build`, `test:stroll:unit`, `test:people:unit`, `test:multi:unit`, `test:stroll`, `test:mobile`, `test:people`, `test:multi`, `test:explore`. Các test nặng còn lại (`test:drawcalls`, `test:perf --strict`, `test:tour`…) không liên quan trực tiếp (mô hình chỉ nạp khi có người đi dạo); chạy `test:perf --strict` một lần cuối nhánh vì gói chính có thể đổi kích thước, còn lại ghi "chưa chạy" trong memory bank nếu không chạy.

## 10. Rủi ro và điều cần báo người dùng

- **W là chạy bộ nhẹ, không phải đi bộ** (§5). Do giữ tốc độ 3,5 m/s.
- **Chân trượt nhẹ ở 10 m/s** (khoảng 7 %).
- **Chất lượng hình là game khoảng 2010**: từ camera 6 m giống người thật, không phải mức ảnh chụp. Bỏ normal map để nhẹ file.
- **Hai máy thấy cùng một người bằng hình khác nhau** (§4).
- **Gờ chắn xe thành vật cản cứng** (§6); nếu phát hiện vùng không tới được thì báo.
- **Nhân vật không đổ bóng** xuống đường (§7); muốn có phải làm bóng riêng, là việc khác.
- **Dung lượng**: thêm tối đa 6 MB trong `public/people/`, chỉ tải khi vào Đi dạo (hoặc khi đang bay dù mà có người đi dạo).
- Bản dịch `stHint` sau khi cắt chữ ở 8 ngôn ngữ vẫn cần người bản ngữ duyệt (như trước).
- Trong lúc brainstorm đã cài tiện ích MPFB vào Blender của người dùng và Pillow vào Python; MPFB không còn dùng, có thể gỡ.

## 11. Việc để người làm tự quyết

Tên hàm / file bên trong `src/explore/stroll/`, cách cắt `idle` và `photo`, có gộp vật liệu hay không, cỡ texture cụ thể miễn đạt trần dung lượng, cách đồng pha hai đoạn, tên xương dùng trong test, thay nhân vật 1–4 nếu bản chọn hỏng.

## 12. Số đo thật sau khi xây (2026-11-12)

- 5 file glb: 1 106 536 / 1 191 780 / 1 210 332 / 1 423 620 / 853 588 byte, tổng 5,79 MB (trong trần 6 MB); nhường dung lượng mức 1 (ngón tay giữ tư thế trung bình); không thay nhân vật nào so với §4.
- Chunk: GLTFLoader 45 kB và SkeletonUtils 3,9 kB tách riêng; `three` 560,8 → 621,6 kB, `index` 581,8 → 586,9 kB.
- Test không trình duyệt tại `eb61432`: `test:stroll:unit` 84/84, `test:multi:unit` 63/63, `test:people:unit` 19/19. Quyết định và hệ quả: D-030.
