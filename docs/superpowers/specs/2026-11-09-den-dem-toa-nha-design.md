# Thiết kế: Ánh đèn đêm đa sắc trên các tòa nhà và phản chiếu xuống sông

_2026-11-09 · Ảnh tham chiếu (ban đêm, người dùng cung cấp): <https://furamavietnam.com/wp-content/uploads/2026/07/33-1662171125-da-nang-1.jpg>_

## 1. Ý định

Người dùng thấy các tòa nhà gần như một màu trắng. Thứ họ muốn là **cảnh đêm giống ảnh**; **ban ngày giữ nguyên**. Ba điều làm nên "Đà Nẵng về đêm" theo lời người dùng: **màu vàng ấm đặc trưng**, **các tòa cao tầng lung linh ánh đèn**, **ánh đèn phản chiếu xuống sông**. Trong ba mockup, người dùng chọn hướng C (vàng ấm chủ đạo + vài tháp kính xanh + viền LED nhiều màu trên nóc tháp cao).

## 2. Mục tiêu

Chỉ khi trời tối (mọi hiệu ứng nhân với `shared.uNight`):

| # | Hạng mục | Yêu cầu | Nguồn |
|---|---|---|---|
| G1 | Cửa sổ vàng ấm | Mỗi tòa một sắc vàng riêng (ổn định, không đổi theo khung hình); vàng ấm là màu áp đảo toàn cảnh | người dùng |
| G2 | Tháp cao lung linh | Tháp cao bật đèn dày và sáng hơn nhà thấp | người dùng; tỉ lệ cụ thể: người dựng |
| G3 | Tháp kính xanh | Khoảng 1/6 tháp cao có cửa sổ xanh dương hoặc xanh ngọc | mockup C; tỉ lệ do agent đề xuất, người dùng đã đồng ý |
| G4 | Viền LED | Tháp cao từ khoảng 60 m: viền quanh nóc + đoạn trên của các cạnh đứng; màu tím, hồng, xanh, vàng, cố định theo từng tòa, **không nhấp nháy** | mockup C; ngưỡng và "không nhấp nháy" do agent đề xuất, người dùng đã đồng ý |
| G5 | Phản chiếu | Đèn thành phố in xuống sông sáng hơn và kéo thành **vệt dọc dài** như ảnh, mang màu của đèn. Áp dụng cho **mọi nguồn sáng trong ảnh phản chiếu** (nhà, LED cầu, địa danh), làm một lần trong shader nước | người dùng |
| G6 | Xa hơn 2.200 m | Khối trơn ở level `far` có ánh vàng nhẹ về đêm, để đường chân trời không tối hẳn | agent đề xuất, người dùng đã đồng ý |

Phạm vi áp dụng: nhà khu phố hai bờ (`src/environment/city.ts`) và nhà quanh Cầu Thuận Phước (`src/bridges/thuan-phuoc/site.ts`).

## 3. Ngoài phạm vi

- Không đổi màu tường ban ngày; không sửa bảng `palette` trong `city.ts` và `site.ts`.
- Không đổi bản thân LED của cầu, mặt LED trái tim, biển quảng cáo, Vòng quay Mặt Trời (phản chiếu của chúng trên sông thì có đổi theo G5).
- Không làm pháo hoa dù có trong ảnh.
- Bản thân địa danh riverfront (`landmarks.ts`) **giữ nguyên hình ảnh** dù dùng chung `patchWindows`.
- Không thêm tùy chọn bật/tắt hay khóa i18n: không có UI mới.

**Coi là hỏng dù chạy được:** ban ngày khác đi; cảnh đêm thành "cầu vồng" lấn át màu vàng; LED nhấp nháy gây rối mắt; tăng draw call ở góc nhìn cũ.

## 4. Ràng buộc (bất biến của dự án)

- **`rand()`:** không thêm/bớt lời gọi, không đổi thứ tự `build*()`. Biến thể từng tòa lấy bằng hash từ vị trí instance trong shader; không dùng `rand()` cũng không cần `rng()` mới.
- **Draw call:** chênh 0 ở mọi góc cũ (chỉ sửa shader; không thêm mesh, không thêm lượt vẽ). Dao động `swTour` đã biết (D-018) không tính.
- **Không có `PointLight`/`SpotLight` mới**, không ảnh ngoài, không thư viện runtime. Đèn đêm bằng emissive, đọc `shared.uNight`.
- **Thông số ở `src/config.ts`** (mục mới, ví dụ `CONFIG.cityNight`), chú thích tiếng Việt, có đơn vị, ghi `(ước lượng)`.
- **Hiệu năng:** `test:perf --strict` đạt; không thêm chương trình shader biên dịch sau khởi động (`src/core/prewarm.ts` phải bao phủ biến thể mới). Không tăng độ phân giải phản chiếu 512².
- **Instance đã thu về scale 0** (dọn nhà cho hầm, riverfront, Vòng quay) vẫn phải vô hình; hash không được làm chúng hiện lại.
- Khi bậc chất lượng tắt phản chiếu (`reflectState.every = 0`), G5 không được gây lỗi hoặc vệt sáng sai.

## 5. Điểm neo kỹ thuật

- `patchWindows` (`src/common/shaders.ts:8`) đang tô cửa sổ bằng shader và dùng chung `customProgramCacheKey = 'windows'` cho cả ba nơi gọi. Vì địa danh phải giữ nguyên, cần tùy chọn bật hiệu ứng mới và **khóa cache riêng theo biến thể**.
- Hash hiện tại dùng `floor(vBPos.xz * 0.02)`, tức theo vùng 50 m, không theo từng tòa. G1–G4 cần định danh từng tòa từ cột dịch chuyển của `instanceMatrix`, cộng `modelMatrix` (mỗi cụm LOD có gốc riêng); chiều cao tòa lấy từ thang Y của `instanceMatrix`.
- Hình học nhà là hộp đơn vị đã tịnh tiến (`y ∈ [0,1]`), thuận tiện để xác định vùng nóc và cạnh.
- `farMat` ở `city.ts:32` chưa có shader đêm; G6 cần vá riêng ở đây.
- Mặt nước dùng `three/addons/objects/Water.js` với mirror 512², `distortionScale: 2.4` (`src/core/water.ts`). Vật thể layer 1 (`noReflect`) không vào phản chiếu; nhà Thuận Phước nằm trong nhóm này nên không có G5. Các nhà đó cao dưới 48 m (`site.ts:47`), không đạt ngưỡng tháp cao, nên thực tế chỉ có G1 (quyết định của agent: giữ một ngưỡng chung, không thêm ngưỡng riêng).

## 6. Tiêu chí nghiệm thu

1. Ban ngày: ảnh chụp ở các góc cũ giống trước khi đổi về mắt thường; về mã, mọi nhánh mới nhân `uNight`, nên `uNight = 0` không đóng góp.
2. Ban đêm, nhìn toàn cảnh tương đương góc ảnh tham chiếu: vàng ấm áp đảo, thấy tháp xanh và viền LED, mặt sông có vệt dọc nhiều màu. Người dùng duyệt bằng ảnh chụp trước khi coi là xong.
3. `npm run typecheck`, `npm run build` đạt; đủ bộ test ở §5 của `copilot-instructions.md` chạy một lần cuối nhánh; `test:drawcalls` chênh 0 (trừ dao động đã biết).

## 7. Để người dựng tự quyết

Công thức shader cụ thể; số cụ thể cho độ sáng, mật độ đèn, độ dài vệt; cách làm vệt dọc (kéo mẫu mirror theo trục dọc trong shader nước hay cách khác trong giới hạn §4).

## 8. Quyết định do agent đưa ra (người dùng đã đồng ý ở bản tóm tắt)

Tỉ lệ 1/6 tháp xanh; ngưỡng LED khoảng 60 m; LED đứng yên; áp dụng thêm cho nhà Thuận Phước; giữ nguyên địa danh; ánh vàng ở level `far`; làm trên nhánh riêng tách khỏi việc dù lượn ban đêm đang dở.
