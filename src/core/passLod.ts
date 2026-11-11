import * as THREE from 'three';

/* =====================================================================
   BẢN THƯA THEO LƯỢT VẼ (D-031) — lưới có hình học gộp [bản đầy đủ | bản thưa] trong một buffer (không index).
   Lượt chính vẽ drawRange (0, full); lượt bóng và lượt phản chiếu mặt nước (512², méo sóng, không thấy chi tiết) vẽ (full, lod).
   - Lượt bóng: three r165 gọi object.onBeforeShadow ngay trước renderBufferDirect (đọc geometry.drawRange lúc vẽ) và onAfterShadow ngay sau ⇒ đổi sang bản thưa rồi trả lại.
   - Lượt gương: water.ts bọc draw bằng passLodEnter() / passLodLeave(); bộ đếm lồng nhau, > 0 thì mọi lưới đã đăng ký dùng bản thưa.
     Lượt bóng chạy bên trong lượt gương (shadowEvery > 1) trả về bản thưa chứ không về bản đầy đủ giữa chừng.
   - Hai lưới dùng chung một geometry vẫn đúng (trạng thái theo geometry); không cấp phát mỗi khung.
   Không thêm lưới / lệnh vẽ: chỉ đổi phạm vi đỉnh của lệnh vẽ đã có.
   ===================================================================== */
interface Entry { geo: THREE.BufferGeometry; full: number; lod: number }
const entries: Entry[] = [];
let mirrorDepth = 0;   // số lượt gương đang lồng nhau

const setLod = (e: Entry, lod: boolean) => { if (lod) e.geo.setDrawRange(e.full, e.lod); else e.geo.setDrawRange(0, e.full); };

/* Đăng ký lưới: geometry gồm fullCount đỉnh đầy đủ rồi lodCount đỉnh thưa; mặc định (lượt chính) vẽ bản đầy đủ */
export function passLodAdd(mesh: THREE.Mesh, fullCount: number, lodCount: number) {
  const geo = mesh.geometry as THREE.BufferGeometry;
  let e = entries.find((x) => x.geo === geo);
  if (!e) { e = { geo, full: fullCount, lod: lodCount }; entries.push(e); }
  const en = e;
  setLod(en, mirrorDepth > 0);
  mesh.onBeforeShadow = () => setLod(en, true);
  mesh.onAfterShadow = () => setLod(en, mirrorDepth > 0);
}

/* Vào / ra lượt phản chiếu mặt nước (gọi cặp trong try / finally) */
export function passLodEnter() {
  if (mirrorDepth++ === 0) for (let i = 0; i < entries.length; i++) setLod(entries[i], true);
}
export function passLodLeave() {
  if (mirrorDepth > 0 && --mirrorDepth === 0) for (let i = 0; i < entries.length; i++) setLod(entries[i], false);
}

/* Số đỉnh bản đầy đủ / bản thưa của một geometry đã đăng ký (cho API test), không có thì undefined */
export const passLodInfo = (geo: THREE.BufferGeometry) => entries.find((x) => x.geo === geo);
