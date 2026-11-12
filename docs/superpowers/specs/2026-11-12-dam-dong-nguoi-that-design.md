# Đám đông người đi bộ dạng người thật (D-032): thiết kế

_Ngày: 2026-11-12 · Trạng thái: đã xây (commit `3f46eb4`, `06cdaa0`, `b436841`, `6e8a0dc`; các test nặng cuối nhánh xem plan), PR #29 · Nhánh: `feature/dam-dong-nguoi-that` (đã duyệt hướng: người dùng xem demo D-030 và bảo làm tiếp, không hỏi lại)_

## 1. Ý định

Sau D-030 (nhân vật đi dạo là người thật), 226 người đi bộ trên ba cầu vẫn là hình khối. Người dùng muốn "update cho tất cả human còn lại". Việc này thay hình khối của ba hệ người đi bộ bằng người thật giản lược từ Microsoft Rocketbox, có chuyển động thu từ người thật, mà không làm chậm cảnh và không tăng lệnh vẽ.

## 2. Mục tiêu, ngoài phạm vi, điều phải tránh

**Mục tiêu**
- G1. Ba hệ `ttl-people` (80), `sh-people` (76), `dragon-people` (70) vẽ người thật: 10 nhân vật khác nhau (8 người lớn, 2 trẻ em), đi / chạy / đứng / chụp ảnh.
- G2. Mỗi hệ vẫn đúng 1 lệnh vẽ; bảng draw call ở `tests/KET-QUA.md` không đổi.
- G3. Thời gian GPU mỗi khung (`npm run test:gpu`, cùng máy) tăng không quá 0,5 ms so với `main` ở cả ngày và đêm.
- G4. Vị trí, hướng, tốc độ, kiểu, số lượng của từng người giữ nguyên như hiện nay (cùng chuỗi `rnd()` / `rng`); bão vẫn dọn người dần; nút bật / tắt và ẩn theo khoảng cách như cũ.
- G5. Khi không dùng được người thật (tải lỗi, quá thời gian chờ, thiếu `WEBGL_multi_draw`, hoặc `?crowd=off`) cảnh chạy đúng như hôm nay bằng hình khối.

**Ngoài phạm vi**
- Người lái xe tay ga (hệ xe), người treo dù lượn, nhân vật đi dạo (D-030) và hình tạm khối của đi dạo (`stroll/blocky.ts`).
- Tăng số người, thêm người ở Thuận Phước / hai bờ sông / vòng quay.
- Đổ bóng cho người, phản chiếu người trên nước, LOD theo khoảng cách.
- Máy chủ `server/multi` (không đổi, không deploy).

**Điều phải tránh**
- Thêm lệnh `rand()` hay chen số ngẫu nhiên vào chuỗi `rng` sẵn có của danh sách người và `ppAssignKinds`.
- Đổi shader program lúc đang chạy; tạo vật liệu / lưới sau bước làm nóng (D-018, D-031).
- Sửa `src/common/people/{shapes,material,gait,kinds}.ts` theo cách làm đổi hình tạm của đi dạo.

## 3. Kết quả bản dựng thử (2026-11-12, `scripts/people/.cache/spike-crowd/`, không vào git)

- `THREE.BatchedMesh` (r165) vẽ 226 người, mỗi người một lưới riêng, trong 1 lệnh vẽ (`WEBGL_multi_draw`); có sẵn trên Intel Arc (ANGLE D3D11) và trên Chromium SwiftShader mà test dùng.
- GPU của riêng đám đông ở 1920×1080 trên Intel Arc: 0,19 ms với lưới 900 tam giác, 0,26 ms với 1 500, 0,41 ms với 2 500; 10 nhân vật không tốn hơn 2 nhân vật.
- Cách gộp mọi nhân vật vào một `InstancedMesh` rồi thu đỉnh thừa về 0: 4,5 ms với 10 nhân vật. Loại.
- Lưới 1 500 tam giác có bảo vệ vùng đầu khi giản lược còn nhìn ra người thật ở cỡ 120 px và không có vệt tối quanh cằm; 22 xương, 2 xương mỗi đỉnh; bỏ mảnh tóc / lông mi dùng opacity thì không hói.
- Ô atlas 384² không phân biệt được với 512² ở cỡ 120 px.
- Ma trận xương nướng 15 fps: lệch phân vị 99 trên thân 13–17 mm khi đi; chạy cần 30 fps (6–9 mm).
- Thiếu `WEBGL_multi_draw` thì r165 vẽ mỗi người một lệnh (khoảng 160 lệnh): phải lùi về hình khối.

## 4. Quyết định

Các mục đánh dấu (tôi quyết) là lựa chọn của người viết spec theo lời "phần còn lại bạn tự quyết định"; người dùng chưa xem từng mục.

1. **Nguồn:** Microsoft Rocketbox, MIT, cùng commit đã ghim ở D-030 (`0943055db6ec570bcef9f2c8b41c9e5467c808f9`). Ngoại lệ bất biến #5 của D-030 (mô hình và texture ngoài cho nhân vật người) mở rộng cho đám đông người đi bộ, không mở cho thứ khác.
2. **Nhân vật (tôi quyết):** 10 nhân vật = 5 người lớn của D-030 (`Male_Adult_10`, `Female_Adult_12`, `Male_Adult_01`, `Female_Adult_03`, `Male_Adult_17`) + 3 người lớn mới + 1 bé trai + 1 bé gái của Rocketbox. Người thực hiện chọn 5 nhân vật mới theo tiêu chí: quần áo thường ngày (không đồng phục, không vest nếu có lựa chọn khác), cân bằng nam nữ, khác rõ với 5 người đã có; ghi tên vào plan. Nếu trẻ em Rocketbox không dùng được (không có ở commit đã ghim, bộ xương khác) thì dùng 10 người lớn và trẻ em là người lớn thu nhỏ `childScale` như hiện nay; báo lại.
3. **Lưới:** mỗi nhân vật khoảng 1 500 tam giác (trần 1 600), có bảo vệ vùng đầu khi giản lược, 22 xương, 2 xương mỗi đỉnh, tư thế ngón tay nướng vào lưới, bỏ mảnh opacity. Mặt hướng +X, chân y = 0, đơn vị mét.
4. **Nón lá (tôi quyết):** giữ. Mỗi người lớn có thêm một bản lưới đội nón lá (nón 10 cạnh gắn cứng vào xương đầu, màu lấy từ một ô màu trong atlas). Ba lô bỏ (cờ `pack` không còn tác dụng với người thật).
5. **Chuyển động:** `walk`, `jog`, `idle`, `photo` nướng thành ma trận xương 3×4 half-float cho từng nhân vật; `walk` / `idle` / `photo` 15 fps, `jog` 30 fps; `idle` cắt còn khoảng 3 s. Người chạy dùng `jog`; người đứng dùng `idle`; người đứng có cờ chụp ảnh giữ khung cuối của `photo`. Nhịp phát = tốc độ người ÷ (tốc độ tự nhiên của đoạn × tỉ lệ người), kẹp `[rateMin, rateMax]` để chân không trượt.
6. **Vẽ:** mỗi hệ một `BatchedMesh`, một vật liệu `peopleCrowd` (`MeshStandardMaterial` + `onBeforeCompile`), một atlas, một texture chuyển động dùng chung, một texture thông số theo người. `sortObjects = false`. Lớp 1, không đổ bóng, không nhận bóng, như hiện nay.
7. **Tệp:** `public/people/crowd.bin` (lưới + chuyển động, định dạng riêng, không cần GLTFLoader) và `public/people/crowd.jpg` (atlas, ô 384²). Trần: `crowd.bin` ≤ 1,1 MB, `crowd.jpg` ≤ 400 kB, tổng ≤ 1,5 MB. Sinh bằng `npm run gen:crowd` (Blender 4.5).
8. **Nạp (tôi quyết):** tải ngay khi mở trang (thêm `<link rel="preload">`), `main.ts` chờ tải xong rồi mới dựng cảnh (build target es2022 cho phép `await` ở cấp module), tối đa `loadTimeoutMs`. Nhờ vậy mọi lưới và vật liệu có sẵn trước bước làm nóng, không có đổi hình giữa chừng. Hệ quả: mọi lượt mở trang tải thêm tối đa 1,5 MB và khung đầu chậm hơn đúng bằng thời gian tải.
9. **Chọn nhân vật cho từng người (tôi quyết):** băm theo chỉ số người và tên hệ, không dùng `rnd()` / `rng`. Người là trẻ em (theo `ppAssignKinds`) nhận nhân vật trẻ em; còn lại nhận người lớn. Hai người đi cùng nhau không trùng nhân vật.
10. **Chiều cao (tôi quyết):** người lớn = chiều cao thật của nhân vật × `heightScale` (0,93, ước lượng, cho vóc người Việt) × tỉ lệ riêng 0,94–1,08 sẵn có; trẻ em = chiều cao thật của nhân vật trẻ em × `heightScale`.
11. **Màu:** mỗi người một hệ số sáng 0,88–1,0 (băm) nhân vào màu, để hai người cùng nhân vật không giống hệt. Màu áo / quần ngẫu nhiên cũ không còn tác dụng với người thật, nhưng lời gọi `rnd()` chọn màu áo vẫn giữ (một lần mỗi người) để chuỗi không đổi.
12. **Lùi về hình khối:** điều kiện ở G5. Đường cũ (`ppBuildGeometry`, `ppMaterial`, `InstancedMesh`) giữ nguyên trong mã.

## 5. Ràng buộc kỹ thuật đã xác minh (three r165)

- `new BatchedMesh(maxGeometryCount, maxVertexCount, maxIndexCount, material)`; không có `addInstance`: mỗi người gọi `addGeometry(geo)` một lần (chép dữ liệu, khoảng 10 MB bộ nhớ GPU cho 226 người).
- Mọi lưới thêm vào phải cùng bộ attribute; attribute tùy biến được chép. Trong shader: `attribute float batchId`, `batchingMatrix` có từ `#include <batching_vertex>`.
- Phải gọi `setColorAt` cho mọi id (lỗi r165: thiếu thì renderer tra lại program mỗi khung).
- Không dùng `setInstanceCountAt`.
- Bounding sphere từng id chép từ lưới nguồn: nới thêm 0,6 m cho chuyển động. Bounding sphere của cả đối tượng không tự cập nhật: `ttl-people`, `sh-people` đặt `frustumCulled = false`; `dragon-people` giữ khối cầu cố định và `frustumCulled = true` như hiện nay.
- Texture nằm trong uniform không được `prewarm` tải trước: phải tự `renderer.initTexture`.

## 6. Kiểm chứng

- Test đơn vị: đọc được `crowd.bin`; 10 nhân vật; mỗi lưới ≤ 1 600 tam giác, chân |y| < 0,02, cao 0,9–1,95 m, mũi giày ở phía +X; đủ 4 đoạn, tốc độ tự nhiên `walk` < `jog`; trần dung lượng; chọn nhân vật tất định, trẻ em nhận nhân vật trẻ em, người đi cùng không trùng; nhịp phát nằm trong khoảng kẹp.
- `test:people` (trình duyệt): ba hệ là người thật, mỗi hệ 1 lưới và 1 lệnh vẽ; người vẫn di chuyển trong lề, đứng sát lan can, rời cầu khi bão rồi trở lại; bật / tắt; `dragon-people` không tốn lệnh vẽ khi quay lưng lại cầu và khi ở xa; chuỗi `rand()` giữ nguyên (tốc độ 7 tàu); không lỗi console. Chạy lại toàn bộ với `?crowd=off` và với yêu cầu `people/crowd.*` bị chặn: hình khối như cũ.
- Cuối nhánh, mỗi lệnh một lần: `test:drawcalls` (bảng không đổi), `test:perf -- --strict` (+0 program ở mọi thao tác), `test:gpu` (G3), `test:stroll`, `test:mobile`.

## 6b. Khác với thiết kế ban đầu (khi xây)

- Nhân vật mới: `Male_Adult_09`, `Female_Adult_17`, `Female_Adult_08`, `Male_Child_01`, `Female_Child_01`; trẻ em dùng được (bộ xương `Bip02` đổi tên `Bip01`, chuyển động người lớn thu theo tỉ lệ cao hông), không phải dùng đường lùi §4.2. `crowd.bin` 1 045 904 byte, `crowd.jpg` 266 630 byte (trong trần §4.7).
- Nạp (§4.8): `main.ts` chỉ gọi `await crowdLoad()` khi renderer có `WEBGL_multi_draw`; thiếu thì không tải, không chờ, `console.info`. Preload trong `index.html` đều `as="fetch"` + `crossorigin` (không phải `as="image"` cho jpg) và vẫn chạy ở máy thiếu `WEBGL_multi_draw`.
- Nhịp phát (§4.5): trẻ em có trần riêng `rateMaxChild` 2,1 (người lớn vẫn kẹp `[rateMin 0,6, rateMax 1,6]`).
- Dữ liệu: `crowdParse` vá pháp tuyến dài 0 (`crFixNormals`, 5 đỉnh ở `Female_Adult_03` làm ảnh đêm đen kịt vì NaN) và từ chối tệp có chỉ số xương / đoạn chuyển động ngoài khoảng.
- Một texture thông số dùng chung cả ba hệ (một vật liệu), chỉ mục người ở kênh alpha của `_colorsTexture` (trường nội bộ r165). `perObjectFrustumCulled` bật ở cả ba hệ nên có góc nhìn giảm 1 lệnh vẽ (không tăng); làm nóng phải qua `bmUncull` (`core/prewarm.ts`).
- Khi ba hệ dùng người thật, `main.ts` thêm sẵn lưới `stroll-blocky` ẩn vào cảnh trước `prewarm` vì hình tạm của Đi dạo vẫn dùng vật liệu `peopleWalk`.
- `gen:crowd` và `gen:people` chạy qua `scripts/people/blender.mjs` (npm 11 trên Windows không gọi được đường dẫn exe có dấu cách trong `package.json`); `convert.py` có sửa nhỏ không đổi hành vi, chưa chạy lại.

## 7. Rủi ro đã biết

- Điện thoại thiếu `WEBGL_multi_draw` sẽ thấy hình khối; chưa có số liệu máy nào thiếu.
- Bàn tay lệch vài cm khi chạy / chụp ảnh (tư thế ngón nướng theo dáng đi).
- Người đứng chụp ảnh là tư thế tĩnh.
- Rocketbox mặc đồ kiểu Âu; chỉ có nón lá là nét địa phương.
- `test:perf --strict` từng lỗi một lần ở bước "chất lượng Trung bình (đêm)" sau khi gộp D-031 (chưa rõ nguyên nhân); nếu lặp lại phải phân biệt với ảnh hưởng của việc này.
