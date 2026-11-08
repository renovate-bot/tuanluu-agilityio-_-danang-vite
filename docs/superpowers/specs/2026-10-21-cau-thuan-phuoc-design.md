# Cầu Thuận Phước — Thiết kế
_2026-10-21 · Trạng thái: Đã xây (merge b500bb5) · Prompt gốc: prompts/cau-thuan-phuoc.md tại c418f92_

Đọc lại bản prompt cũ: `git show c418f92:prompts/cau-thuan-phuoc.md`. Tài liệu này mô tả cái ĐÃ XÂY, đối chiếu với `src/bridges/thuan-phuoc/` và `CONFIG.thuanPhuoc` trong `src/config.ts`.

## 1. Mục đích và lý do
- Mô hình 3D Cầu Thuận Phước, cầu cực Bắc trên sông Hàn, nơi sông đổ ra vịnh Đà Nẵng: cầu treo dây võng 3 nhịp, tháp BTCT chữ H, 114 hanger, hai khối cầu dẫn BTCT 12 nhịp.
- Thêm vào CÙNG cảnh với Cầu Rồng, không đổi hành vi Cầu Rồng; dùng chung nước, trời, đèn, bloom, hệ xe và thuyền có sẵn.
- Điểm nhấn phải có (prompt): đèn LED đổi màu ban đêm theo ý "những cơn gió hướng ra biển" (xanh dương, tím, hồng, xanh lá, chạy dọc cầu từ Tây sang Đông).
- Prompt gốc yêu cầu `ThuanPhuocBridge.js` trả `THREE.Group`; tính năng được dựng trong `tests/original/index.html` rồi chuyển sang Vite + TS cùng cả dự án (mục 7). Bản HTML là chuẩn hồi quy draw call (D-003).

## 2. Phạm vi: có / không có
Có:
- Hai tháp BTCT chữ H (bốn cột), bệ cọc dưới nước, bệ trụ, hai dầm ngang, yên ngựa, gối cầu, đèn báo hàng không (`towers.ts`).
- Dầm hộp thép khí động liên tục (69 đốt), mặt đường 4 làn, dải phân cách, lề, lan can, khe co giãn, cột đèn (`deck.ts`).
- Hai cáp chủ parabol 3 đoạn mỗi mặt phẳng, 114 hanger, kẹp cáp (`cables.ts`).
- Hai cầu dẫn BTCT 12 nhịp × 50 m, khối neo cáp, mố, đường đắp, trụ instanced (`approaches.ts`).
- Mở rộng địa hình cửa sông: bờ đất, kè, đường ven sông, nhà thấp tầng, cây (`site.ts`).
- Xe 4 làn và ba thuyền đi qua nhịp chính (`life.ts`).
- Bốn góc nhìn (`tpBay`, `tpWater`, `tpDrive`, `tpBoth`), Tour 7 điểm, bảng thông số, nút bật/tắt xe và thuyền.
- Thuyết minh Tour vi/en/ru; giao diện 9 ngôn ngữ.

Không có (xem mục 7, 9):
- Dầm ngang giữa của tháp (prompt: "cân nhắc").
- Slider/GUI chọn mẫu LED riêng cho Thuận Phước (chỉ Trần Thị Lý có `#ttlPatternSel`).
- Người đi bộ, ảnh tham chiếu thật, normal map ảnh (bê tông dùng nhiễu procedural).

## 3. Thông số đã dùng
Mọi số nằm trong `thuanPhuocBase` (`src/config.ts`), xuất ra `CONFIG.thuanPhuoc` (hàm `deriveTp` tính thêm). Mét, 1 đơn vị = 1 m. Tọa độ cục bộ: x = 0 ở tim cầu, group dời tới `z`.

| Thông số | Giá trị | Nguồn | Khóa |
|---|---|---|---|
| Vị trí Bắc–Nam | z = −2.900 m (phía Bắc Cầu Rồng ~2,9 km; sau Cầu sông Hàn ở z = −1.080) | prompt: 2,5–3 km | `z` |
| Tổng chiều dài | 1.856 m (chỉ tham khảo; hình học tính từ các nhịp) | prompt (số thật) | `totalLength` |
| Nhịp chính | 405 m | prompt (số thật) | `mainSpan` |
| Nhịp biên | 125 m mỗi bên | prompt (số thật) | `sideSpan` |
| Cầu dẫn | 12 nhịp × 50 m mỗi bên (dầm hộp BTCT dự ứng lực) | prompt (số thật) | `approachSpans`, `approachSpanLen` |
| Tim tháp / đầu cầu treo / mố | x = ±202,5 / ±327,5 / ±927,5 m | tính từ các nhịp | `towerX`, `anchorX`, `endX` |
| Bề rộng mặt cầu | 18 m | prompt (số thật) | `deckWidth` |
| Làn xe | 3,5 m, 2 làn mỗi chiều = 4 làn | prompt: 4 làn; 3,5 m (ước lượng) | `laneWidth` |
| Dải phân cách / lề | 1,0 m / 1,5 m mỗi bên | (ước lượng) | `median`, `sidewalk` |
| Dầm hộp thép | cao 2,9 m, nửa rộng tới mũi 10,5 m (hanger neo ở đây), 69 đốt | 69 đốt: prompt; còn lại (ước lượng) | `girderDepth`, `girderTip`, `girderSegments` |
| Dầm hộp BTCT cầu dẫn | cao 2,8 m | (ước lượng) | `approachDepth` |
| Mặt đường giữa nhịp / tại khối neo | 31,6 m / 28,6 m | 27 m tĩnh không (prompt) + 2,9 m dầm + vồng; còn lại (ước lượng) | `roadCenterY`, `roadAnchorY` |
| Mố cao hơn mặt đất | 4,8 m; đường đắp sau mố 120 m | (ước lượng) | `abutmentRise`, `embankment` |
| Đỉnh bệ cọc / bệ trụ | 2,5 m / 11,5 m trên mặt nước | (ước lượng) | `pileCapTop`, `plinthTop` |
| Chiều cao tháp | 80 m tính từ bệ trụ → đỉnh 91,5 m trên mặt nước | prompt: 80 m, ~90–92 m (số thật) | `towerHeight`, `towerTop` |
| Tiết diện cột (chân → đỉnh) | 5,2×3,6 → 3,8×2,6 m; vát 0,45 m | (ước lượng) | `legBase`, `legTop`, `chamfer` |
| Tâm cột theo ngang cầu | ±13,2 m (chân) → ±10,8 m (đỉnh = mặt phẳng cáp chủ) | (ước lượng) | `legZBase`, `legZTop`, `cablePlaneZ` |
| Dầm ngang trên / dưới | 84–89,5 m / 22–26,2 m | (ước lượng) | `topBeam`, `lowBeam` |
| Cáp chủ | 2 bó, Ø360 mm (bán kính 0,18 m) | prompt (số thật) | `cableRadius` |
| Độ võng nhịp chính | f/L = 1/9,5 → f ≈ 42,6 m; nhịp biên theo f ∝ L² | prompt: ước lượng 1/9–1/10 | `sagRatio`, `sag`, `sideSag` |
| Yên ngựa / điểm cáp vào buồng neo | tim cáp 92,2 m / 33 m; neo cách đầu cầu treo 8,5 m | (ước lượng) | `saddleY`, `anchorCableY`, `cableAnchorX` |
| Hanger | 39 mỗi mặt phẳng ở nhịp chính + 9 mỗi nhịp biên → (39 + 2×9) × 2 = 114 | prompt: 114 bó (số thật) | `hangersMain`, `hangersSide` |
| Đường kính hanger | Ø65 mm thường (0,0325 m), Ø101 mm đặc biệt (0,0505 m) | prompt (số thật) | `hangerR`, `hangerRSpecial` |
| Kẹp cáp | bán kính 0,32 m | (ước lượng) | `bandRadius` |
| Cột đèn | cách nhau 30 m | (ước lượng) | `lampSpacing` |
| LOD | ẩn chi tiết nhỏ, xe, thuyền khi xa hơn 1.700 m (xe/thuyền: 1,3× ngưỡng) | (ước lượng) | `lodDistance` |
| Tĩnh không thông thuyền | 27 m | prompt (số thật) | không có khóa riêng; nằm trong `roadCenterY` |

Lưu ý độ tin cậy (giữ từ prompt gốc): độ võng cáp, kích thước tiết diện tháp, cao độ dầm ngang không có số liệu chính xác; prompt cho phép ước lượng và ghi rõ trong comment. Cột "(ước lượng)" ở trên giữ đúng tinh thần đó (`tpNote` ghi lại cho người xem: "Độ võng cáp và tiết diện tháp là ước lượng").

Một số hằng số dựng nằm trong mã chứ không phải `CONFIG`: số mẫu cáp chủ `n = max(12, round(L/2))` (`cables.ts`), kích thước khối neo 48 × 32 m và buồng neo 24×5 / 22×4,4 m (`approaches.ts`), bệ cọc 26×40 m (`towers.ts`). Chưa vào `CONFIG` (mục 9).

## 4. Hình dạng, hành vi như đã xây
`ThuanPhuocBridge` (`ThuanPhuocBridge.ts`) kế thừa `BridgeBase` (D-006): có `group`, `details` (LOD), `life`, gộp bê tông và thép bằng `finalize()`. Thứ tự dựng trong constructor: `tpBuildTowers`, `tpBuildDeck`, `tpBuildCables`, `tpBuildApproaches`, `tpBuildSite`, `tpBuildTraffic`, `tpBuildBoats`. Trong `src/main.ts` cầu được dựng sau `buildCity()`/`buildTrees()` nên không đụng chuỗi `rand()` (mục 6).

- `profile.ts`: `tpRoadY(x)` cao độ mặt đường (vồng parabol trên phần cầu treo, đường cong Hermite liền dốc qua 12 nhịp dẫn, rồi đường đắp về mặt đất); `tpCableY(x)` tim cáp chủ: parabol `y = y_top − 4f·u(1−u)` ở nhịp chính, gãy góc tại yên ngựa, parabol riêng ở nhịp biên; `tpHangerStations()` vị trí hanger (loại đặc biệt: hai hanger đầu và cuối mỗi nhịp chính, hanger giữa, hanger đầu/cuối mỗi nhịp biên).
- `towers.ts`: mỗi tháp có bệ cọc, hai bệ trụ, hai cột thon dần nghiêng nhẹ vào trong (`loftOct`), yên ngựa (hộp đế + nắp nửa trụ), dầm ngang trên và dưới, gối cầu. Cột và dầm ngang gộp thành một mesh `tp-towers` (vật liệu `tower`). Vệt nước bám ở chân bệ qua `wetLineColor`. Bốn đèn báo hàng không (`InstancedMesh`) chớp bằng `blinkBeacon`.
- `deck.ts`: dầm hộp thép `extrudeAlongX` theo `tpRoadY` (mesh `tp-girder`); 68 gân nối đốt `InstancedMesh` (trong `details`); mặt đường hai dải 4 làn kéo dài tới x = −1.500 và 1.480 để nối đường bờ (`roadStrip`, lớp `noReflect`); dải phân cách; lề, gờ, lan can, khe co giãn và cột đèn dùng helper chung `src/common/deck.ts`.
- `cables.ts`: cáp chủ là `TubeGeometry` theo `CatmullRomCurve3` lấy mẫu từ `tpCableY`, 3 đoạn × 2 mặt phẳng gộp thành mesh `tp-main-cables`; 114 hanger là một `InstancedMesh` hình trụ nhiều đoạn (`CONFIG.weather.wind.cableSegs` = 8 đoạn, mục 7) đặt bằng `segmentMatrix`; kẹp cáp `InstancedMesh` nằm trong `details`.
- `approaches.ts`: dầm hộp BTCT liền mỗi bên, khối neo cáp + hai buồng neo, mố và tường chắn đường đắp (`fillBlock`), 22 trụ cầu dẫn (thân trụ và xà mũ, hai `InstancedMesh`).
- `site.ts`: bờ đất, kè đá, dải lát, đường ven sông nối dài (x = ±299 m, dải phân cách cỏ), nhà thấp tầng/trung tầng và cây dọc kè. Bộ sinh riêng `rng(1965)`, nhà đặt theo lưới 34 m, bỏ ngẫu nhiên 30 %, chừa hành lang |z| < 42 quanh tim cầu.
- `materials.ts`: `bridgePatch` thêm LED vào vật liệu có sẵn, bảng màu `'sea'`: tháp `led: 0.75`, cáp chủ `led: 2.6`, hanger `led: 1.8`; chỉ sáng ban đêm (đọc `shared.uNight`), màu chạy dọc cầu theo trục X. Bê tông và thép có nhiễu procedural (`noise: true`).
- `life.ts`: xe dùng hệ chung `src/common/traffic.ts` (`seed: 405`, hai làn mỗi chiều: n = 20 tốc độ 16 và n = 30 tốc độ 11 có 60 % xe máy); ba thuyền dùng `src/common/boats.ts` (22 m, 18 m, 46 m) đi qua nhịp chính.
- `update(dt, elapsed, cam)`: `updateLod` (ẩn `details` khi xa), `blinkBeacon`, rồi `stepTraffic` và `stepBoats` khi xe/thuyền hiện. `dispose()` kế thừa từ `BridgeBase`.

## 5. Tương tác, UI, i18n, thuyết minh
- Chọn cầu: nút `data-bridge="tp"`; `BRIDGE_HOME.tp` = `tpBay` (`src/views/presets.ts`).
- Danh sách góc nhìn (`index.html`, `data-list="tp"`): Tour tự động (`tpTour`), `tpBay` "Toàn cảnh từ vịnh", `tpWater` "Mặt nước dưới nhịp chính", `tpDrive` "Lái xe qua cầu", `tpBoth` "Toàn cảnh hai cầu", `wxRiverMouth` "Từ cửa sông (thời tiết)", nút `#btnTpLife` bật/tắt xe và thuyền.
- `tpBay` (300, 78, z − 470); `tpWater` (−150, 3,0, z + 24), điểm nhìn đặt sát mặt nước vì OrbitControls không cho camera thấp hơn điểm nhìn; `tpBoth` (−760, 540, −3.800) nhìn về Nam thấy Thuận Phước gần, Cầu Rồng xa. `tpDrive` là chế độ camera riêng (`src/views/camera.ts`): chạy từ x = −1.300 đến 1.300 với 16 m/s, lặp, cao 1,45 m trên làn ngoài.
- Tour 7 điểm `TP_TOUR` (`src/views/tourStops.ts`), tên điểm (`tpStops` trong `vi.json`): Cửa ngõ ra biển, Dưới nhịp chính 405 m, Tháp chữ H, Yên ngựa đỉnh tháp, Từ cầu dẫn phía Tây, Hướng về Sơn Trà, Những cơn gió ra biển. Đi hết các điểm phía Bắc rồi mới vượt cầu ở độ cao an toàn (trên cáp chủ / đỉnh tháp). Ba điểm cuối của Tour 4 cầu (`ALL_TOUR` điểm 11–13: trên cao phía Nam, yên ngựa đỉnh tháp Tây, từ vịnh) dùng lại các tọa độ này.
- Bảng Thông số: 1.856 m, 18 m, "Nhịp chính" 405 m, ghi chú `tpNote` (khóa `tpLengthVal`, `tpWidthVal`, `tpSpan`, `tpSpanVal`, `tpNote`).
- i18n đủ 9 ngôn ngữ cho `tpStops`, `vTpBay`, `vTpWater`, `vTpDrive`, `vTpBoth`, `tpTraffic`, `tpNote` (đã kiểm khóa `tpStops`, `tpNote`, `vTpDrive` có trong cả 9 `src/i18n/locales/*.json`; `ar` là RTL).
- Thuyết minh Tour: vi và en (`7c60d82`), ru (`0a0b6be`), clip `public/voice/<lang>/tpStops-0…6.mp3` (D-005). ko, ja, zh, th, ar, hi chưa có.

## 6. Ràng buộc đã tuân thủ
- **`rand()` có seed (D-002).** Không file nào trong `src/bridges/thuan-phuoc/` gọi `rand()`; nhà và cây ở `site.ts` dùng `rng(1965)` riêng, xe dùng `seed: 405`. Cầu dựng sau `buildCity()`/`buildTrees()` trong `main.ts`, nên không đổi vị trí nhà/cây cũ.
- **Draw call.** Bảng `now` gần nhất trong `tests/KET-QUA.md` (2026-10-24), ngày / đêm: `tpBay` 276 / 297, `tpWater` 117 / 138, `tpDrive` 125 / 145, `tpBoth` 282 / 315. Chuẩn hồi quy là bản gốc: 36/36 lần đo chênh 0 (2026-10-20, `progress.md`). Cách giảm: gộp hình học (`mergeGeometries`) cho bê tông, thép, tháp, cáp chủ, mặt đường; `InstancedMesh` cho hanger, kẹp cáp, trụ cầu dẫn, đèn báo, nhà, cây; LOD `details`; lớp 1 (không phản chiếu) cho mặt đường, nhà, chi tiết nhỏ. Từ Vòng quay Mặt Trời, `tpBay` và `tpBoth` tăng 2 draw call (đã chấp nhận, ngân sách ≤ +2); `wxRiverMouth` cũng +2.
- **Đèn.** Ban đêm bằng emissive (`bridgePatch`, `shared.uNight`), không `PointLight`/`SpotLight` mới (bất biến 5). Prompt đề nghị "UnrealBloomPass dùng lại composer": đã dùng bloom có sẵn của cảnh.
- **Texture** vẽ bằng canvas (`makeLaneTexture`), không ảnh ngoài; không thêm thư viện runtime.
- **Bóng đổ.** Thân dầm, tháp, cáp chủ, cột, trụ cầu dẫn, nhà, cây có `castShadow`/`receiveShadow`. Việc điều chỉnh shadow camera bao hai cầu (prompt) chưa đối chiếu.
- Công trình đã xây thật, không cần ghi "phương án đề xuất".

## 7. Khác so với ý định ban đầu
- Prompt: module JS `src/bridges/thuanPhuoc/` gồm `ThuanPhuocBridge.js`, `towers.js`, `deck.js`, `cables.js`, `approaches.js`, `lighting.js`, `materials.js`, `config.js`. Đã xây: TypeScript trong `src/bridges/thuan-phuoc/` (`ThuanPhuocBridge.ts`, `towers.ts`, `deck.ts`, `cables.ts`, `approaches.ts`, `materials.ts`, thêm `profile.ts`, `life.ts`, `site.ts`, `index.ts`). Không có `lighting.js`: LED nằm trong `materials.ts` (`bridgePatch`). Không có `config.js`: thông số ở `CONFIG.thuanPhuoc`. Lý do: cùng mẫu với mọi cầu khác (D-006) và bất biến 3 (mọi thông số ở `src/config.ts`).
- Prompt: `update(deltaTime, elapsed)`. Đã xây: `update(dt, elapsed, cam)` (cần camera cho LOD).
- Prompt: hỏi người dùng chọn giữ tỉ lệ thật hay rút ngắn khoảng cách. Đã xây: giữ tỉ lệ thật (z = −2.900, ~2,9 km từ Cầu Rồng) và mở rộng sông, bờ đất, sương, LOD. Câu trả lời của người dùng không còn bản ghi trong repo (chưa đối chiếu).
- Prompt: hanger "cách đều trung bình ~9,9 m". Đã xây: 39 hanger chia đều nhịp chính → 405 / 40 = 10,125 m; 9 hanger mỗi nhịp biên → 125 / 10 = 12,5 m (tính từ `tpHangerStations()`). Tổng vẫn 114.
- Prompt: tháp "cao 80 m tính từ bệ cọc". Đã xây: 80 m tính từ đỉnh bệ trụ (`plinthTop` 11,5 m) → đỉnh 91,5 m, nằm trong khoảng 90–92 m của prompt.
- Prompt: dầm cầu treo "extrude theo đường cong đứng nhẹ". Đã xây: `extrudeAlongX(…, tpRoadY)`; hạ dần từ ~30 m xuống đất ở cầu dẫn bằng đường Hermite; mặt đường tại khối neo 28,6 m (prompt "~30 m" gần tháp).
- Prompt: trụ cầu dẫn "đôi hoặc đơn". Đã xây: trụ đơn tiết diện ô-van + xà mũ.
- Prompt: dầm ngang giữa tháp (tùy ảnh). Đã xây: hai dầm ngang (trên, dưới) như yêu cầu tối thiểu.
- Prompt: tháp có "mép bê tông bevel nhẹ" và normal map. Đã xây: vát cạnh `chamfer` 0,45 m; nhiễu bê tông procedural trong shader (`noise: true`), không có normal map riêng.
- Prompt: bật/tắt xe, thuyền, đèn báo bằng GUI. Đã xây: chỉ nút `#btnTpLife` (xe và thuyền cùng nút); đèn báo hàng không luôn chớp.
- Prompt: núi Sơn Trà dạng low-poly ở phía Đông. Đã xây: núi có sẵn từ `buildMountains()` của bản gốc (ngoài thư mục cầu); vị trí so với hướng Đông của Thuận Phước chưa đối chiếu.
- Prompt: báo cáo draw call trước/sau khi thêm cầu. Đã xây: thay bằng bảng `tests/KET-QUA.md` và `test:drawcalls`.
- Thay đổi do tính năng sau:
  - Thời tiết (`feature/weather`): vật liệu thêm `weather: true`, đường dùng `registerWet` (mặt ướt khi mưa, `5f780b4`); hanger có `sway: 'tp'` (lắc theo gió, `e3906e7`; biên độ `CONFIG.weather.wind.tp`); cáp chủ `sag: 'cable'` và hanger `sag: 'hanger'` (võng thêm khi nóng, `edced8b`); hình trụ hanger đổi từ 1 đoạn sang `cableSegs` = 8 đoạn vì shader `sin(π·t)` = 0 ở mọi đỉnh nên dây 1 đoạn không cong (`8c7ef9e`); xe ẩn dần và thuyền về bến khi bão đóng cầu (`weatherFx.clear`, `closable`, D-012, `1b39173`); bảng "Ảnh hưởng tới cầu" có ô riêng (gió tại mặt cầu và đỉnh tháp, "Cấm lưu thông theo thông báo của thành phố"); thêm góc nhìn `wxRiverMouth`; điểm "Từ cửa sông" chỉnh về (260, 36, z − 330) vì ở 900 m cầu quá nhỏ.
  - Tối ưu độ mượt (D-018, `134d5c8`): hàm update của xe/thuyền không cấp phát mỗi khung (commit chung nhiều phần; không sửa file nào trong `thuan-phuoc/`).
  - Tour 4 cầu (D-015, `e672add` đường bay + `cd52a47` thuyết minh `allStops`): ba điểm cuối `ALL_TOUR` đi qua Thuận Phước và kết thúc ở vịnh; không sửa file nào trong `thuan-phuoc/`.
  - Vòng quay Mặt Trời: `tpBay`, `tpBoth`, `wxRiverMouth` thấy vòng quay nên +2 draw call.
- Chưa làm (yêu cầu prompt không có trong mã): nhân vật/người đi bộ; vị trí bơm/sóng bạc đầu cửa sông (thuộc thời tiết); so ảnh thật để chỉnh tiết diện tháp.

## 8. Kiểm tra
- `tests/drawcalls.mjs` (`npm run test:drawcalls`): bốn góc `tpBay`, `tpWater`, `tpDrive`, `tpBoth` + `wxRiverMouth`, ngày/đêm. Lần so bản gốc đầy đủ: 36/36 chênh 0 (2026-10-20). Từ đó chỉ có cột `bản Vite` (`tests/KET-QUA.md`, bảng 2026-10-24).
- `tests/tour-check.mjs` (`npm run test:tour`): `tp` 7 điểm dừng, đạt (log GĐ8 Vòng quay 2026-10-24; 8/8 tour đạt 2026-10-27). Raycast đường bay không chạm hình học cầu.
- `tests/voice-check.mjs` (`npm run test:voice`): `tpStops` vi + en + ru, đạt (2026-10-27).
- `tests/weather-check.mjs` (`npm run test:weather`): kiểm điểm ảnh dây lắc ở mốc 4 kịch bản bão (`uSway` 1 m phải đổi > 200 px; ghi nhận ở dây TTL, cơ chế `uSway` chung cho hanger TP và dây SH); đạt (2026-10-27, chạy lại ngoài giờ tự quay). Số đo `impact()` ở bão: TP mặt cầu 32,1 m/s (cấp 11).
- Chưa có test riêng cho hình học tháp/cáp (kiểm bằng ảnh và draw call). Chưa có test cho `tpDrive`.

## 9. Còn mở
- Đối chiếu số ước lượng: độ võng cáp, tiết diện tháp, dầm ngang, cao độ mố, khối neo.
- Số draw call từng preset thời tiết (`rain`, `storm`) chưa ghi vào `KET-QUA.md`.
- Chạy `npm run test:drawcalls -- tests/original` để biết vì sao bảng 2026-10-24 cao hơn bảng 2026-10-20 (mọi góc, chưa xác định nguyên nhân).
- Đưa các hằng số rời trong `cables.ts`, `approaches.ts`, `towers.ts` vào `CONFIG`.
- Thuyết minh ko, ja, zh, th, ar, hi.
- Sóng bạc đầu cửa sông (thời tiết), đo FPS GPU thật.
