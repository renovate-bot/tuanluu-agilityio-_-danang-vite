# Các cây cầu Đà Nẵng 3D — Vite + TypeScript

Chuyển từ một file `index.html` (~4 600 dòng) sang Vite + TypeScript, không dùng framework UI. Mọi tính năng giữ nguyên.
Ngoài bốn cây cầu còn có **Hầm vượt sông Hàn** (phương án đề xuất 2025, chưa xây) — xem mục [Hầm vượt sông Hàn](#hầm-vượt-sông-hàn).

## Chạy

```bash
npm install
npm run dev        # máy chủ phát triển
npm run build      # tsc --noEmit + vite build → dist/
npm run preview    # xem bản build
```

Thêm `?test` vào URL để lộ `window.__app` (renderer, scene, camera, cam, dayNight, tours…) cho script kiểm tra.

## Kiểm tra

Cần Chromium cho Playwright (`npx playwright install chromium` nếu máy chưa có).

```bash
npm run build
npm run test:drawcalls -- [thư-mục-bản-gốc]   # draw call ở 18 góc nhìn × ngày/đêm
npm run test:tour      -- [thư-mục-bản-gốc]   # 5 Tour + Tour 4 cầu (đường bay mở): chú thích, đường bay, quay cầu sông Hàn, mặt cắt + mô phỏng dìm của hầm
npm run test:tunnel                           # hầm: trắc dọc, mặt cắt bật/tắt, mắt thích nghi, mô phỏng dìm, ảnh chụp vào tests/screens/
npm run test:riverfront                       # hai bờ: nhà bị dọn, hướng mặt LED, bật/tắt trái tim, quảng cáo, ảnh chụp vào tests/screens/
npm run test:voice                            # thuyết minh: đủ clip, thời lượng khớp điểm dừng Tour và kịch bản bão
npm run test:weather                          # thời tiết: preset, mưa/gió/bão, đóng cầu, kịch bản 120 s, không rò rỉ bộ nhớ
npm run test:sunwheel                         # Vòng quay Mặt Trời: kích thước, quay, cabin, LED, ngồi cabin, thời tiết, Tour
npm run test:perf     -- [--strict]           # độ mượt: khung dài nhất và số shader biên dịch thêm khi đổi đêm/mặt cắt/bóng/mưa
npm run test:explore                          # tự khám phá (dù lượn): mô hình bay, camera, màn chọn, giao diện khi bay, i18n, đo draw call các tư thế
npm run test:mobile                           # điện thoại: bố cục gọn dọc/ngang, sheet, tràn chữ 9 ngôn ngữ, RTL
```

`tests/original/index.html` là file gốc chỉ sửa hai chỗ: link three từ CDN đổi sang `/three/…` (server kiểm tra lấy từ `node_modules/three`) và thêm móc `?test`. Truyền `tests/original` làm tham số để so sánh hai bản với nhau. Trình duyệt kiểm tra dựng hình bằng CPU (SwiftShader) nên mỗi script chạy khoảng 10–20 phút.

## Cấu trúc

```
src/
  main.ts            thứ tự dựng cảnh + vòng lặp
  config.ts          thông số các cầu
  core/              renderer, scene, camera, controls, bloom, trời/nước, đèn, uniform dùng chung, ngày/đêm
  common/            texture làn đường, loft, boxAt, beamBetween, cột đèn, bảng màu LED, xe cộ, thuyền, người, BridgeBase
  bridges/
    dragon/          Cầu Rồng (mặt cầu, thân, đầu, lửa/nước)
    thuan-phuoc/     Cầu Thuận Phước
    tran-thi-ly/     Cầu Trần Thị Lý
    song-han/        Cầu sông Hàn + SwingController
    han-tunnel/      Hầm vượt sông Hàn (vỏ hầm, nội thất, máng hầm hở, cửa hầm, đáy sông, mặt cắt, mô phỏng dìm)
    sun-wheel/       Vòng quay Mặt Trời (bệ + nhà ga, khung tháp, vành và nan, 64 cabin, LED đêm, ngồi cabin, Tour)
  environment/       sông Hàn, núi, đường phố, thành phố, cây, giao thông
    riverfront/      hai bờ sông: địa danh thật, mặt dựng LED trái tim + "DN", bảng quảng cáo, chi tiết dải đi bộ
    weather/         thời tiết: khí quyển 4 preset, mưa + mặt ướt, gió (cây, dây, thuyền), bão (chớp, đóng cầu, kịch bản 120 s), nắng hè, cây đổ, âm thanh
  explore/           tự khám phá bằng dù lượn: mô hình bay thuần, dù, camera bám, màn chọn phương tiện, điều phối
    multi/           dù lượn nhiều người (5 chỗ): giao thức + thông số dùng chung với máy chủ, phiên, sảnh, dù người khác, nhãn, chế độ xem, rời máy
  views/             góc nhìn có sẵn, flyTo, Tour (đường cong + điểm dừng)
  audio/             nhạc, còi, tiếng xe; narration.ts phát giọng thuyết trình của Tour
  ui/                bảng điều khiển, nút quay cầu, âm thanh, chất lượng hình, chế độ gọn cho điện thoại (compactUI.ts)
  i18n/              index.ts + locales/{vi,en,ko,ja,zh,th,ar,hi,ru}.json
  styles/main.css
server/
  multi/             máy chủ dù lượn nhiều người (Cloudflare Worker + Durable Object, `npm --prefix server/multi run dev`)
```

## Hầm vượt sông Hàn

Mô hình phương án đề xuất 2025 (Sở Xây dựng Đà Nẵng): tuyến thẳng Đống Đa – Trần Phú → Vân Đồn – Trần Hưng Đạo, ≈ 1.670 m = hầm dìm qua sông 600 m (5 đốt × 120 m) + hầm kín trên bờ 380 m + hầm hở 415 m, 6 làn, 60 km/h, 6.880 tỷ đồng, đầu tư dự kiến 2031–2045. Thiết kế: [docs/superpowers/specs/2026-10-21-ham-vuot-song-han-design.md](docs/superpowers/specs/2026-10-21-ham-vuot-song-han-design.md) · kế hoạch: [docs/superpowers/plans/2026-10-21-ham-vuot-song-han.md](docs/superpowers/plans/2026-10-21-ham-vuot-song-han.md).
Chiều dài từng đoạn, số làn, tốc độ, độ dốc tham khảo và tổng mức là số đã công bố; **mặt cắt ngang, độ sâu, đáy sông, kiến trúc cửa hầm, thiết bị là ước lượng** (ghi trong `CONFIG.hanTunnel`, `src/config.ts`).

- Trắc dọc `hrRoadY(x)` (đối xứng qua tim sông): đường gãy khúc bo parabol, dốc ≤ 2% dưới sông, ≤ 3,5% hầm kín bờ, ≤ 4,5% hầm hở; nóc hầm dìm thấp hơn đáy sông ≥ 1 m; gờ chắn ngập ở đỉnh dốc cao hơn mặt phố 1 m. `npm run test:tunnel` kiểm tra các ràng buộc này.
- Xe: mỗi chiều 2 làn ô tô + 1 làn xe máy sơn đất nung sát lề phải (xe máy chiếm đa số lưu lượng ở Đà Nẵng).
- Vỏ hầm và nội thất (`underground`) chỉ vẽ khi camera ở trong hầm, bật **Mặt cắt địa chất** hoặc đang **mô phỏng dìm đốt hầm**; từ trên mặt đất thấy máng hầm hở, mái lam, cửa hầm Tây (gợi tường thành Điện Hải) và Đông (gợi sóng biển, thuyền thúng), gờ chắn ngập + cửa phai, khung giới hạn 4,5 m.
- Mặt cắt địa chất: `clippingPlanes` + `clipIntersection` bóc dải đất phía Bắc mặt cắt dọc ống Nam; nước dùng `discard` trong shader (cũng khoét hai máng hầm hở); tấm địa chất vẽ bằng canvas; nhãn 3D là các `div` (`ui/hrUI.ts`). Tắt là trả mọi vật liệu về nguyên trạng.
- Mô phỏng dìm đốt hầm (`immersion.ts`): FLOAT_IN → POSITION → BALLAST → PULL_JOINT → BACKFILL → DONE. Trong lúc chạy, đường hầm đóng, thuyền tránh vùng thi công (`boatKeepOut`).
- Lái xe xuyên hầm (`hrDrive`): độ phơi sáng giảm còn 70% trong hầm rồi trả về giá trị gốc khi ra.
- Nhà, cây, cột đèn nằm trên hành lang tuyến được **thu nhỏ về 0 sau khi cảnh đã dựng** (`corridor.ts`), nên chuỗi `rand()` của khu phố không đổi. Hầm phải dựng sau mọi lệnh dùng `rand` trong `main.ts`.
- i18n: các khóa `hr*`, `vHr*`, `im_*`, `hrStops` có đủ 9 ngôn ngữ; thuyết minh `hrStops` có tiếng Việt và tiếng Anh (`scripts/narration`).

## Hai bờ sông Hàn

`src/environment/riverfront/` (kế hoạch: [docs/superpowers/specs/2026-10-21-bo-song-han-design.md](docs/superpowers/specs/2026-10-21-bo-song-han-design.md)); thông số ở `CONFIG.riverfront`.
- **Địa danh** (`landmarks.ts`, một mesh gộp, cửa sổ sáng đêm bằng `patchWindows`): Novotel Danang Premier Han River (37 tầng), Vinpearl Condotel Riverfront (36 tầng nổi + sky bar), Trung tâm Hành chính (34 tầng, 166,8 m, dáng ngọn hải đăng), Chợ Hàn, Bảo tàng Điêu khắc Chăm, Cầu Tình Yêu + cá chép hóa rồng, 3 khách sạn ven Trần Hưng Đạo. Số tầng/chiều cao có nguồn công khai (ghi ở đầu `landmarks.ts`); **toạ độ trong cảnh là ước lượng**. Không có logo thật.
- **Mặt dựng trái tim + "DN"** (`heartFacade.ts`): một canvas mặt nạ (R tim, G chữ DN, B viền) + fragment shader lưới chấm LED 0,8 m, chu kỳ 24 s (tim đập → DN hiện dần → tim bọc DN, viền chạy → lấp lánh). Hai tấm gộp một mesh, pha từng tấm là attribute (`Đối đáp` lệch 12 s, `Đồng bộ` cùng pha). Ban ngày tối đa 4% độ sáng ban đêm. Novotel quay +X, Vinpearl quay −X, trục U luôn chạy sang phải người nhìn từ sông.
- **Quảng cáo** (`adAtlas.ts`, `billboards.ts`): atlas canvas 2048², thương hiệu **hư cấu** (danh sách ở đầu `adAtlas.ts`) xen thông điệp du lịch thành phố. 8 pano trụ đơn, 5 bảng nóc nhà, 3 màn LED đổi quảng cáo mỗi 8 s (chuyển mờ 0,6 s), ~100 băng rôn cột đèn, biển hiệu Chợ Hàn/Bảo tàng Chăm.
- **Dải đi bộ** (`promenade.ts`, chia chunk 600 m mỗi chunk một `THREE.LOD`, ẩn khi xa hơn 600 m): lan can kè, ghế đá, bồn hoa, thùng rác, bến du thuyền, mái hiên + bảng hiệu cửa hàng, đèn LED quấn cây Bạch Đằng, đèn trái tim Cầu Tình Yêu.
- Nhà/cây/cột đèn bị đè được **thu nhỏ về 0 sau khi cảnh dựng** (`clearance.ts`, có ảnh chụp ma trận để test); `buildRiverfront()` chạy sau `HanTunnel` trong `main.ts`. UI: nút "Đèn trái tim", chọn Đối đáp/Đồng bộ, "Quảng cáo", góc nhìn `rfHearts` (tự chuyển sang đêm) và `rfBank`.

Ghi chú:
- Bộ sinh số ngẫu nhiên có seed nên `main.ts` giữ đúng thứ tự dựng như bản gốc; đổi thứ tự sẽ làm vị trí nhà, cây, xe thay đổi.
- Giai đoạn 1 để `strict: false` trong `tsconfig.json`; có thể bật dần `strict` theo từng thư mục.

## Giọng thuyết trình của Tour (vi, en, ru)

Mỗi điểm dừng của Tour có một clip mp3 trong `public/voice/<ngôn ngữ>/<khóa>-<i>.mp3`; `public/voice/manifest.json` ghi thời lượng từng clip để Tour kéo dài đoạn bay cho tới khi đọc xong. Ngôn ngữ chưa có clip thì Tour chạy lặng và nút **Thuyết minh** bị khóa.

- **Kịch bản bão** cũng có giọng đọc: khóa `wxStorm`, mỗi mốc của `CONFIG.weather.scenario.steps` một clip. Camera bay theo `STORM_TOUR` (`views/tourStops.ts`) như Tour, và cửa sổ mỗi mốc kéo dài cho tới khi đọc xong (`test:voice` kiểm). Lời mốc 4 nói cố định "hai mươi lần" = `swayExaggeration`; đổi hệ số thì sửa lời và chạy lại `gen:voice`.
- Lời thoại nằm ở `scripts/narration/{vi,en,ru}.json` (theo đúng khóa và thứ tự điểm dừng trong `i18n/locales`). Viết số, đơn vị, từ viết tắt bằng chữ để giọng đọc không vấp.
- Sửa lời thoại hoặc thêm điểm dừng: `npm run gen:voice` chỉ tạo lại clip đã đổi (`-- --force` để tạo lại tất cả), rồi commit `public/voice/`.
- Giọng đọc lấy từ dịch vụ đọc văn bản của Microsoft Edge qua gói `msedge-tts` (không cần tài khoản, nhưng là dịch vụ không chính thức nên có thể đổi hoặc bị giới hạn; clip đã tạo vẫn dùng được bình thường). Giọng: `vi-VN-HoaiMyNeural`, `en-US-AriaNeural`, `ru-RU-SvetlanaNeural` (đổi trong `scripts/gen-narration.mjs`).
- Lời thoại tiếng Nga viết số bằng chữ và chia đúng giống, số, cách; nếu giọng đọc sai trọng âm thì đặt U+0301 sau nguyên âm.
- Thêm ngôn ngữ thứ ba: tạo `scripts/narration/<mã>.json`, thêm giọng vào `VOICES` trong script, chạy lại `npm run gen:voice`.
- Kiểm tra: `npm run build && npm run test:voice` (cần Chromium của Playwright, hoặc đặt `CHROMIUM_PATH` tới Chrome/Edge).
