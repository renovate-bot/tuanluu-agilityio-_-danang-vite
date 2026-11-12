---
applyTo: "src/**/*.ts"
description: Quy tắc chung khi viết code Three.js trong src/
---

# Code Three.js trong `src/`

- **Seed:** không thêm/bớt/đổi thứ tự lời gọi `rand()` (`common/math.ts`). Ngẫu nhiên mới → `const r = rng(<seed riêng>)`.
- **Thông số:** không hard-code số đo trong file dựng hình. Đặt ở `src/config.ts` (chú thích tiếng Việt, đơn vị, `(ước lượng)`), đọc qua `CONFIG.<khối>` hoặc `profile.ts`.
- **Draw call:**
  - Bộ phận tĩnh cùng vật liệu → đẩy vào `concreteParts`/`steelParts` hoặc gộp bằng `mergeGeometries`.
  - Vật lặp lại → `InstancedMesh`; ẩn instance bằng ma trận scale 0.
  - Chi tiết nhỏ → `details` (LOD) hoặc `farHide`; không cần phản chiếu → `noReflect` / `layers.set(1)`.
- **Vật liệu:** tái dùng `MAT` (`core/materials.ts`) khi có thể; vật liệu riêng tạo trong `materials.ts` của công trình và dispose được.
- **Ngày/đêm:** đọc `shared.uNight`; đèn bằng emissive/shader, không thêm `PointLight`/`SpotLight`.
- **Texture:** phần cảnh dựng bằng code vẽ texture bằng canvas (`common/textures.ts`, `core/textures.ts`). Mô hình ngoài và texture đi kèm được phép theo D-033 (`copilot-instructions.md` §3 mục 5): giấy phép, ghi nguồn, trần dung lượng có test, đường lùi khi tải lỗi.
- **Hệ trục:** X Tây→Đông, −Z Bắc, mét; y = 0 mặt nước.
- **Dispose:** mọi geometry/material/`CanvasTexture` tự tạo phải giải phóng được (theo `BridgeBase.dispose()`).
- Comment tiếng Việt; khối tiêu đề `/* ===== ... ===== */` mô tả công trình/vị trí ở đầu file chính.
- Sau khi sửa: `npm run typecheck`.
- **Đèn (D-031):** không đặt `visible` của đèn ngoài `core/lights.ts`; cường độ ghi trước `stepLights()` trong `animate()`. Đèn cường độ 0 vẫn tốn shader mọi điểm ảnh.
- **Lưới nặng có đổ bóng / phản chiếu:** cân nhắc bản thưa qua `core/passLod.ts` thay vì vẽ đủ chi tiết ở cả ba lượt (bóng, phản chiếu, chính).
- **Người đi bộ thật (D-032, `src/common/people/crowd*.ts`):** mỗi hệ một `THREE.BatchedMesh` (r165), mỗi người một `addGeometry`; phải `setColorAt` cho mọi id; chỉ dựng khi `crowdUsable(crowdGet(), có WEBGL_multi_draw)`, thiếu `WEBGL_multi_draw` thì r165 vẽ mỗi người một lệnh nên phải dùng hình khối cũ. Chọn nhân vật bằng băm chỉ số, không `rand()` / `rng`. Ẩn người bằng `setVisibleAt`. Mọi lưới / vật liệu / texture tạo lúc dựng; texture trong uniform phải `renderer.initTexture`. Làm nóng `BatchedMesh` phải qua `bmUncull` trong `core/prewarm.ts` (tạm tắt `perObjectFrustumCulled` và đặt `_visibilityChanged`), nếu không mọi id bị cắt thì three bỏ lệnh vẽ. Vật liệu hình khối `peopleWalk` vẫn cần trong cảnh cho hình tạm của Đi dạo (`stBlocky`). Chi tiết: `systemPatterns.md` mục "Mẫu đám đông người thật".
