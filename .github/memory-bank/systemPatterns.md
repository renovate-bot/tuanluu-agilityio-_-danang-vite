# System Patterns

## Kiến trúc tổng thể

```
main.ts ── thứ tự dựng cố định (seed!) ──► scene
  ├─ core/         renderer, camera, controls, bloom, trời, nước, đèn, shared uniforms (uTime, uNight), dayNight
  ├─ common/       hình học (boxAt, loft, beamBetween…), shaders (patchWindows), texture canvas, BridgeBase, xe/thuyền/người
  ├─ environment/  sông, núi, phố, nhà (city.ts), cây, giao thông; riverfront/ (địa danh, LED, quảng cáo, bờ)
  ├─ bridges/<x>/  mỗi công trình một thư mục, một lớp kế thừa BridgeBase (trừ dragon: hàm rời, có trước BridgeBase)
  ├─ views/        presets (dữ liệu góc nhìn), tourStops (dữ liệu Tour), tour, camera, state
  ├─ audio/        nhạc, tiếng xe/còi, narration
  ├─ ui/           panel, setupUI + UI riêng từng công trình (swingUI, hrUI)
  └─ i18n/         t(), stops(), 9 file locales JSON
vòng animate(): shared.uTime → dayNight → cập nhật hiệu ứng/giao thông/camera → bridge.update(dt, t, camera) → renderFrame
```

## Mẫu: một công trình mới (`src/bridges/<ten>/`)
| File | Vai trò |
|---|---|
| `index.ts` | Chỉ re-export: lớp, `XX` (profile), hàm cao độ (vd. `shRoadY`) |
| `profile.ts` | Hằng số dẫn xuất từ `CONFIG.<ten>` + hàm hình học thuần (trắc dọc, cao độ) — **không** import three scene |
| `materials.ts` | `xxMaterials()` trả về object kế thừa `BridgeMaterials` (bắt buộc `concrete`, `steel`; `textures[]` để dispose) |
| `<Ten>Bridge.ts` | `class extends BridgeBase<XxMaterials>`: constructor gọi lần lượt `xxBuild*(this)`, cuối cùng `this.finalize()`; `update()` gọi `updateLod()` |
| `life.ts` | Xe/thuyền/người riêng của công trình, đặt trong `this.life` |
| các phần khác | Mỗi bộ phận một file, hàm `xxBuildPhan(b: BridgeBase)` đẩy hình học vào `b.concreteParts`/`b.steelParts` hoặc thêm mesh vào `b.group`/`b.details` |

Tích hợp: khối `xxBase` + `deriveXx()` trong `config.ts` → `new` trong `main.ts` (sau mọi `rand`) → thêm vào mảng `bridges` → `setupUI` → `VIEWS` + nút `index.html` → Tour trong `tourStops.ts` + khóa i18n → narration → test.

## Mẫu: phần cảnh không phải công trình (`environment/riverfront/`)
Không kế thừa `BridgeBase`: module `index.ts` giữ một đối tượng `current`, export `buildX()` / `updateX(dt, time)` / các hàm bật-tắt (`setHeartsEnabled`, `setHeartsMode`, `setAdsEnabled`) / `disposeX()`. Gọi `buildX()` trong `main.ts` sau mọi `rand`, `updateX()` trong `animate()`, thêm vào `window.__app`.

## Mẫu: điều biến thời tiết (`environment/weather/`)
- Thứ tự cập nhật trong `animate()`: `applyNight()` → `updateWeather(dt, time, night)`. Thời tiết chỉ **điều biến** kết quả ngày/đêm (màu trời, sương, nước), không tự tính lại ngày/đêm; hệ số đêm nhân vào màu ban ngày (`1 − 0,9·night`).
- Trọng số lấy từ tham số liên tục (`state.current`), không theo tên preset. Khi các trọng số ≈ 0 và `level` ≈ 0 thì `restore()` trả đúng giá trị gốc một lần rồi thôi đụng vào: preset `now` là no-op và kiểm tra khôi phục khớp tuyệt đối.
- Uniform riêng `weatherU` (`core/shared.ts`) cho shader; không đổi `uNight`.
- Không thêm `PointLight`; hiệu ứng đêm bằng emissive/bloom.
- Ngân sách draw call: mưa ≤ +1, bão ≤ +2 (chớp), preset thời tiết ≤ +3 tổng; `now` chênh 0. Mưa/chớp không vẽ trong hầm.
- Cây/dây/thuyền chỉ đổi qua shader hoặc ma trận instance (`wind.ts`, `fallen.ts`); cây đổ dùng cặp thân–tán `InstancedMesh`, lưu ma trận gốc để `stand()` khôi phục đúng.
- Kịch bản bão (`scenario.ts`) chạy theo `dt` đã kẹp 0,05 s; kết thúc phải trả preset, ngày/đêm và thanh cường độ cũ.

## Mẫu: công trình chuyển động + ngồi cabin (`bridges/sun-wheel/`)
- Chuyển động là tích phân deterministic `advance(dt)` (bước ≤ `stepMax`), không phụ thuộc khung hình: kiểm bằng số (×1 đúng 2π/10 sau 90 s, ×60 đúng 60 lần).
- Cabin là một `InstancedMesh` chỉ tịnh tiến (đứng thẳng, không xoay theo góc); ma trận chỉ dựng lại khi `details` hiện và góc lệch ≥ `placeEps`. Ma trận instance là float32, nên so sánh vị trí dùng ngưỡng ~1e-4 m, không 1e-6.
- Ngồi cabin là chế độ camera `'swRide'` (`views/camera.ts`); tư thế đặt trong `SunWheel.update()` sau `advance()`, không trong `updateCamera()` (tránh giật một bước `dt`). Mọi đường rời chế độ đi qua `dropRide()`.
- Tour dùng `tourHooks.sw` (khe riêng, không dùng `tourHooks.stop` của Hầm) và giữ `cam.mode = 'tour'`; cabin ghi đè camera sau `updateTour()` (D-017).
- Thời tiết điều khiển bằng `weatherFx.wheelStopped` (= `closed`); dừng là giảm tuyến tính trong `stopSec`, không đổi tốc độ đích người dùng chọn.
- Đo draw call góc `sw*`: đặt hướng nhìn mặc định và để tốc độ đạt đích trước khi đo (frustum culling biển hiệu nhỏ). Tổng cảnh ngày/đêm có thể lệch do phần khác của cảnh, nên kiểm chênh 0 bằng cách đo riêng nhóm vòng quay (bật/tắt group).

## Mẫu hiệu năng
- Shader đã biên dịch sẵn lúc `buildWeather()` (mưa, chớp có hai biến thể): đổi preset không được làm tăng `renderer.info.programs`.
- Mưa/chớp là mesh ẩn tới lúc cần; three.js chỉ đếm geometry khi được vẽ lần đầu, nên đo rò rỉ phải vẽ trước một khung.
- `BridgeBase.finalize()` gộp bê tông + thép thành 2 mesh; `details` (LOD) ẩn khi xa hơn `lodDistance`; `farHide` ẩn khi rất xa.
- Chi tiết nhỏ, xe, người: layer 1 → không vẽ trong lượt phản chiếu mặt nước.
- Vật lặp lại → `InstancedMesh`. Ẩn instance = ma trận scale 0 (không xóa, để giữ chỉ số).
- Nhiều kiểu cùng loại (tàu D-026, xe D-027) → một `InstancedMesh` mỗi hệ, hình học gộp có `aPart`, instance có `aType`, vertex shader thu đỉnh khác kiểu về gốc; mẫu: `src/environment/boats/`, `src/common/vehicles/`. Hình học gộp dùng chung buffer: không sửa tại chỗ, không `dispose()` geometry của một hệ.
- Vật liệu dùng chung ở `core/materials.ts` (`MAT`); `dispose()` không giải phóng vật liệu dùng chung.
- **Không đổi program key khi đang chạy (D-018).** Những thứ làm three biên dịch lại MỌI vật liệu liên quan: `castShadow` của đèn, số đèn, `clippingPlanes`/`clipIntersection`, `defines`, `needsUpdate`, render target khác (canvas ↔ composer). Bật/tắt bằng uniform, hằng số mặt phẳng (mặt cắt Hầm đẩy plane ra 1e7), xoá shadow map (`stepShadows`), đổi sampler (phản chiếu tắt). Đo bằng `npm run test:perf -- --strict`: mỗi thao tác phải +0 program.
- **Biên dịch trước** ở `core/prewarm.ts` (chạy sau `setupUI`, trước `animate()`): `compileAsync` hai biến thể + upload texture + vẽ thật một lần với mọi object hiện, `frustumCulled = false`, mọi level LOD, InstancedMesh rỗng có 1 instance. Object/vật liệu mới tạo SAU prewarm (lúc chạy) sẽ biên dịch lười → tạo sẵn lúc dựng và ẩn.
- **Hàm chạy mỗi khung không cấp phát:** vector/matrix/quaternion tạm ở cấp module (`_v`, `_m`…), vòng `for` thay `forEach` + mảng tạm, mảng dùng lại (`length = 0`). Không ghi ma trận / upload buffer của mesh đang ẩn (đèn xe ban ngày, hạt lửa không còn hạt, tín hiệu cầu khi `details` ẩn) — nhưng trạng thái tích lũy (vị trí xe) vẫn cộng như cũ để khi hiện lại đúng chỗ.
- **Bậc chất lượng** (`core/quality.ts`, `CONFIG.perf.steps`): bậc 0 = cảnh gốc, `?test` khóa bậc 0. Hiệu ứng mới tốn GPU nên có nút giảm ở bậc thấp, đổi được khi chạy mà không biên dịch lại (pixelRatio, cỡ RT, chu kỳ vẽ, số instance).

## Mẫu giao diện điện thoại (`body.compact`, D-019)
- `src/ui/compactUI.ts`: trạng thái gọn + `openSheet/closeSheets/reveal`; CSS gọn đều đặt sau `body.compact` trong `src/styles/main.css`; ngưỡng ở `CONFIG.ui.compactQuery`. Panel không chuyển DOM, chỉ đổi vai bằng class `sheet-*` trên `body`.
- Phần tử nằm trong panel có thể đang bị tờ đóng che → test dùng `tap`/`pick` (`tests/lib.mjs`, gọi `__app.ui.reveal`), KHÔNG gọi `page.click` trực tiếp. Kiểm "đang hiện" bằng `checkVisibility()`, vì `offsetParent` luôn null với phần tử `position: fixed`.
- Chữ hướng dẫn khác nhau chuột/cảm ứng: hai `<span>` ẩn/hiện bằng `(hover:none)`, không dò `navigator`. Khóa i18n mới thêm bằng script `scripts/add-*-locales.mjs`; `apply()` có chốt bỏ qua khóa thiếu thay vì hiện nguyên khóa.

## Mẫu chế độ điều khiển tự do (`src/explore/`, D-020)
- Mô hình thuần (`flight.ts`: tư thế + bước + phím → đầu vào, không đụng three scene) tách khỏi hiển thị (`glider.ts`, `chase.ts`) để test được bằng `__app.exFlight`; điều phối ở `index.ts` (`explore.update(dt)` gọi sau `updateCamera`, camera do explore đặt).
- Mép khung bay và camera bám phụ thuộc tốc độ: đổi `speedMax` thì phải chạy lại mục 1e/1f của `test:explore` (kiểm ở cả tốc độ thấp nhất và cao nhất). Đổi `chase` thì sửa số ghi cứng trong mục 2e/2f/3e của test.
- Camera là `CameraMode` riêng (`'glider'`) và tắt `controls` như `walk`; giao diện đổi bằng class `body.explore` (giữ lại một danh sách phần tử, ẩn phần còn lại), không dựng lại DOM.
- Đối tượng chỉ có khi chế độ bật (dù) thì thêm vào scene lúc vào chế độ, không thêm lúc dựng cảnh: các góc nhìn cũ không đổi draw call.
- Thoát chế độ bằng tải lại trang bỏ tham số URL, để không phải viết code khôi phục trạng thái dùng chung.
- Gốc nhóm mô hình đặt ở tâm hình học cần bám (giữa cánh và người), không phải mép.
- Bố cục `body.explore` trên máy tính: góc trên đầu dòng là `.brand` (từ D-025 lúc đóng chỉ còn nút ⚙ ≈ 50 px; mở ra có ngôn ngữ, nút Đêm, Chất lượng hình, cao ≈ 175 px ở 1280×720), giữa trên là `#exHint`, góc trên cuối dòng là `#btnExExit`, giữa dưới là `#exSpeed`, góc dưới cuối dòng là danh sách người bay `#exMpRoster`. Phần tử mới không đặt theo số `top` cố định cạnh `.brand` (từng đè lên nhau). `.stats` chỉ hiện ở góc dưới cuối dòng khi URL có `?test`, nên lúc test sẽ chồng lên `#exMpRoster`.

## Mẫu đi dạo: bản đồ va chạm thuần + oracle độc lập (`src/explore/stroll/`, D-029)
- `map.ts` thuần (lưới ô, không import three / CONFIG) tách khỏi `mapData.ts` / `sceneData.ts` (đọc CONFIG, dựng vùng + vật cản) và `motion.ts` (bước chuyển động, nhận `StMap`); test đơn vị tự dựng bản đồ nhỏ nên không cần trình duyệt. Cùng nguyên tắc với `flight.ts` của dù (mục `explore/`).
- Kiểm "không xuyên" bằng oracle **độc lập với `map.ts`**: `tests/stroll-check.mjs` bắn tia lên mesh có tên (`Ray.intersectTriangle`) và so từng bước với hộp tòa nhà; phải có bằng chứng không rỗng (bước gần tường thật, tường thật đẩy lại) vì oracle từng đạt vì nhân vật đứng yên trong hộp.
- Vùng đi được suy từ hình học trong CONFIG, **không chép số**: bờ thụt vào ngoài lan can dải dạo (|x| 263,49), lối Cầu Tình Yêu dùng `CONFIG.riverfront.love.railGap` ở cả `promenade.ts` lẫn `mapData.ts`. `mapData.test.ts` chép bố cục lan can: đổi `promenade.ts` phải sửa test.
- `CONFIG.stroll.bounds` phải bằng `multiParams.stroll.bounds` (máy chủ kẹp theo khung này; test kiểm). Đối tượng chỉ dựng khi vào chế độ (`stroll-people`) để góc cũ không đổi draw call.
- Bước có `dt` lớn bị chia nhỏ theo `dtMax`; bậc cao hơn `stepMax` so với cao độ vùng đo bằng epsilon (nối dải phân cách Cầu Rồng ↔ bờ = 0,3500083).
- Phím điều khiển theo `e.code` (`keys.ts`), thông báo ảnh ở `#stToast` riêng; `#exMpNotice` dành cho thông báo nhiều người.

## Mẫu ngày/đêm và hiệu ứng
- Đọc `shared.uNight` (0 → 1) trong shader hoặc `update()`; không tự giữ trạng thái ngày/đêm riêng.
- Đèn: emissive + bloom (`core/postprocessing.ts`). Không thêm đèn động mới.
- Cửa sổ sáng: `patchWindows` (`common/shaders.ts`).

## Mẫu dữ liệu tách khỏi code
- Góc nhìn: `views/presets.ts` (`VIEWS`, tọa độ thế giới). Điểm dừng Tour: `views/tourStops.ts`. Tên/lời Tour: khóa trong locales, **đúng thứ tự** với mảng điểm dừng.
- Cờ điểm dừng: `swing`, `immerse`, `cutaway`, `interior`.

## Mẫu cây và người (D-028)
- Cây = cặp InstancedMesh thân + tán **cùng chỉ số** (`trees-shade-*`, `trees-palm-*`, `tp-trees-*`). Ma trận tán giữ đúng tâm / tỉ lệ quả cầu cũ để `fallen.ts`, `promenade.ts`, dọn cây (scale 0) và gió đọc ma trận tán như trước. Dừa: thân cong `x = bend·y²` theo +X cục bộ nên tán đặt ở `(x, landY + h, z) + Ry(yaw)·(bend·trunkWidth, 0, 0)`; mọi code đọc x/z tán của dừa (dây đèn `promenade.ts`) phải trừ độ lệch này. Dọn cây phải scale 0 **cả hai** lưới cùng chỉ số (`clearedStayZero` so hai tập).
- Yaw cây = `trYaw(i, seed)` (băm theo chỉ số, `rng` riêng), không gọi `rand()`.
- Người: **một InstancedMesh mỗi hệ** (`ppBuildGeometry()` không cache vì `aVar`/`aPants` gắn vào hình), chung `ppMaterial()`. Phải `setColorAt` cho **mọi** instance (không có `instanceColor` thì `USE_INSTANCING_COLOR` tắt và người trắng); `aPants` là màu **tuyến tính** (qua `THREE.Color.setHex`).
- Phần ngẫu nhiên mới của người dùng `rng(seed)` riêng (1966, 1967, 2904, 2905, 4107, 4108), danh sách người cũ giữ nguyên số lời gọi `rnd()`.

## Mẫu kiểm thử
- `?test` → `window.__app` (renderer, scene, camera, cam, songHan, hr, tours, narration…). Thêm đối tượng mới vào `__app` khi cần kiểm.
- `tests/lib.mjs`: `serveDir`, `launch` (SwiftShader), `openApp`, `frames`, `waitFlight`. Test đọc `dist/` → build trước.
- Mỗi test gom lỗi vào `problems[]` + kiểm tra console sạch, in kết quả tiếng Việt.

## Cạm bẫy đã biết
- Thêm/bớt một lời gọi `rand()` ở bất cứ đâu trước cuối chuỗi dựng → toàn bộ nhà/cây/xe xê dịch, draw call lệch bảng chuẩn.
- `city.ts`: không sửa `avoid()` hay vòng `place()`; nhà nằm trong `InstancedMesh` thuộc `THREE.LOD` (`near` + `far`).
- `OrbitControls` không cho camera thấp hơn điểm nhìn → góc nhìn sát nước cần `maxPolar` (tới `Math.PI * 0.97`).
- Mặt cắt địa chất của hầm: `clippingPlanes` gán cố định cho vật liệu chung từ lúc dựng (D-018), tắt = plane đầu ở 1e7; nước vẫn đổi `transparent`/`depthWrite` → tắt phải trả **đúng** giá trị gốc (test:tunnel kiểm).
- Chữ trên mặt LED / bảng: kiểm tra không bị lật gương theo hướng mặt.
- Hiệu ứng dịch đỉnh trong vertex shader (lắc dây `sin(π·t)`, võng cáp) cần hình học có đỉnh ở giữa: `CylinderGeometry(1, 1, 1, n)` mặc định 1 đoạn dọc nên dây không cong dù uniform đúng (lỗi GĐ4, phát hiện 2026-10-22). Kiểm hiệu ứng shader bằng **điểm ảnh** (vẽ hai khung, đếm px khác — mẫu trong `tests/weather-check.mjs` mốc 4), không chỉ đọc uniform.
- Preset camera thấp hơn điểm nhìn mà không có `maxPolar` (vd `swFront`): khung đầu sau chuyến bay OrbitControls kẹp camera lên. Mã nào "nhớ tư thế camera để trả lại" (ngồi cabin) phải chốt qua `controls.update()` (damping tắt) trước khi lưu. Draw call phụ thuộc hướng nhìn (frustum culling mesh nhỏ như biển hiệu): test so ngày/đêm hoặc quay/dừng phải đặt cùng hướng nhìn và để vòng quay đạt tốc độ đích trước khi đo.
- `env(safe-area-inset-*)` luôn bằng 0 nếu thiếu `viewport-fit=cover` trong `<meta viewport>` (index.html): tai thỏ/thanh home vẫn đè lên thanh dưới mà không báo lỗi. Có `cover` thì mọi mép cố định phải tự cộng `env(...)`.
- Chế độ gọn không có `?test`-only nào: đo giả lập điện thoại phải mở trang KHÔNG `?test` (bậc chất lượng Tự động, `device.phone`), khi đó không có `__app`, tự chờ `#loading.done` và đọc `#ftime`/`#fps` bằng `textContent` (HUD ẩn).
- Trong lệnh shell / heredoc, biểu thức như `p.y > p.ground` bị coi là chuyển hướng `>` và tạo file rỗng lạc ở gốc repo (từng sinh `p.ground`, `p.y`; file `0` có thể cùng nguyên nhân). Viết so sánh trong file bằng công cụ ghi file, không dán vào lệnh shell; kiểm `git status` có file rỗng lạ không.
- Nhân vật đi dạo (D-030): file `public/people/p<k>.glb` do `npm run gen:people` sinh (Blender 4.5, `scripts/people/convert.py`), không sửa tay; thêm / đổi nhân vật = sửa bảng nhân vật đầu `convert.py`, chạy lại, rồi commit `.glb`, kiểm `tests/stroll-unit/glb.test.ts` (≤ 1,5 MB mỗi file, tổng ≤ 6 MB, đủ 5 đoạn, ≥ 50 khớp, có `LICENSE-Rocketbox.txt`). File chuyển động Rocketbox có tư thế gốc khác file nhân vật: chép thẳng đường cong thì tay dang chữ T, phải cho bộ xương nguồn diễn rồi nướng vào xương nhân vật (xem `convert.py`); Blender 4.5 dùng action slot nên gắn chuyển động theo cách đã chạy được trong script, đừng đổi tùy ý.
- Nhân vật đi dạo: `GLTFLoader` / `SkeletonUtils` chỉ được nạp bằng `import()` động trong `rig.ts`, và `vite.config.ts` `manualChunks` phải loại hai file này khỏi chunk `three` (nếu không chúng vào mọi trang). Mỗi slot một bản sao `SkeletonUtils.clone` + `AnimationMixer` riêng, dùng chung geometry / texture / vật liệu của nguồn (đừng `dispose` chúng khi gỡ bản sao). Nhân vật ở layer 1 (không phản chiếu nước) và `castShadow = false`; `frustumCulled = false` vì hộp bao theo tư thế gốc sai khi diễn. Glb chưa tải xong hoặc lỗi thì slot hiện hình khối (`blocky.ts`), lỗi chỉ `console.warn` một lần cho mô hình đó và không thử lại trong phiên. Bản sao chỉ tạo trong vòng khung cho slot đang hiện đúng mô hình, nên kết quả nạp về muộn không gắn nhầm. Mixer không cấp phát mỗi khung; walk / jog / sprint đồng pha bằng pha chung 0 đến 1 (`timeScale` 0, đặt `time` tay).
- Test không trình duyệt cho nhân vật thay bộ nạp bằng `stAvatars.__setLoader(fn)` (nạp giả, không GPU, không glb thật); `glb.test.ts` đọc phần JSON của GLB bằng `fs`. Test trình duyệt đi dạo chạy trên `dist/` nên cần build trước, và glb được tải từ `import.meta.env.BASE_URL + 'people/...'`.
- Tốc độ di chuyển đi dạo (3,5 / 10 m/s) không khớp tốc độ tự nhiên của chuyển động thu, nên `anim.ts` trộn theo tốc độ và kẹp hệ số tua trong `[rateMin, rateMax]`; muốn phím W ra dáng đi bộ thật thì hạ `CONFIG.stroll.walk` về khoảng 1,6 (đổi cảm giác điều khiển, hỏi người dùng).
- Dáng 3 của giao thức đi dạo là rơi (`ST_POSE_FALL`), không còn nhảy; giữ giá trị 3 để máy chủ (kẹp `poseMax`) và khách bản cũ không hỏng. Space không sinh đầu vào nhưng vẫn `preventDefault` khi đang đi dạo.
