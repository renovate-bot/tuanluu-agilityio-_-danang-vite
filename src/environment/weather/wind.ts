import * as THREE from 'three';
import { CONFIG } from '../../config';
import { MAT } from '../../core/materials';
import { shared, weatherU, windFx } from '../../core/shared';
import { windAt } from './impact';
import type { WeatherParams } from './state';

/* ===== [weather] Gió (mục 4.5): 0 draw call, chỉ uniform + vài hệ số vô hướng =====
   - Cây: vá MAT.leaf, MAT.palm VÀ MAT.trunk (D-028) — dịch đỉnh theo hướng gió trong vertex shader, tỉ lệ độ cao điểm trên mặt đất, pha theo vị trí instance.
     Thân + cành vá cùng công thức để tán dừa (đặt đúng đỉnh thân, dịch tới 0,06 m mỗi m cao ⇒ ≈ 0,7 m ở ngọn 12 m) không rời thân, cành bóng mát không chọc ra khỏi tán:
     điểm cùng độ cao dịch như nhau nên cả cây nghiêng cùng nhau. Bóng đổ không lắc (depth material mặc định) — chấp nhận.
   - Dây: option `sway` của bridgePatch (common/shaders.ts) đọc uSwayTp/Ttl/Sh; biên độ tính ở đây: TP và SH tăng theo v², TTL theo đường cong mưa–gió.
   - Thuyền, lửa/nước Cầu Rồng, râu rồng, tốc độ sóng: hệ số trong windFx (core/shared.ts), mặc định trung tính.
   Gió = 0 (preset `now`): mọi uniform/hệ số về ĐÚNG giá trị trung tính, nhánh shader không chạy. */
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function patchTree(mat: THREE.MeshStandardMaterial, key: string) {
  mat.customProgramCacheKey = () => key;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = shared.uTime; sh.uniforms.uWindDir = weatherU.uWindDir;
    sh.uniforms.uTreeLean = weatherU.uTreeLean; sh.uniforms.uTreeSway = weatherU.uTreeSway;
    const w = CONFIG.weather.wind.trees.omega;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime; uniform vec2 uWindDir; uniform float uTreeLean; uniform float uTreeSway;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        #ifdef USE_INSTANCING
        if (uTreeLean + uTreeSway > 0.0) {
          vec3 twC = (modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xyz;
          float twH = max((modelMatrix * instanceMatrix * vec4(transformed, 1.0)).y - ${CONFIG.landY.toFixed(2)}, 0.0);   // độ cao điểm trên mặt đất
          float twPh = dot(twC.xz, vec2(0.13, 0.17));
          float twG = uTreeLean + uTreeSway * sin(uTime * ${w.toFixed(2)} + twPh);
          float twS = uTreeSway * 0.3 * sin(uTime * ${(w * 1.31).toFixed(2)} + twPh * 2.0);
          vec3 twD = (vec3(uWindDir.x, 0.0, uWindDir.y) * twG + vec3(-uWindDir.y, 0.0, uWindDir.x) * twS) * twH;
          mvPosition.xyz += mat3(viewMatrix) * twD; gl_Position = projectionMatrix * mvPosition;
        }
        #endif`);
  };
  mat.needsUpdate = true;
}

/* Vá shader cây: tán và thân (gọi trong buildWeather, trước khung hình đầu). */
export function buildWind() {
  patchTree(MAT.leaf, 'tree-leaf-wind');
  patchTree(MAT.palm, 'tree-palm-wind');
  patchTree(MAT.trunk, 'tree-trunk-wind');   // thân + cành nghiêng cùng tán (xem đầu file)
}

/* Mỗi khung: c = thời tiết hiện tại, v = gió tức thời ở 10 m (m/s), on = weather đang bật (false → biên độ dây = 0). */
export function updateWind(c: WeatherParams, v: number, on: boolean) {
  const W = CONFIG.weather.wind, K = on ? CONFIG.weather.swayExaggeration : 0;
  if (c.wind < 1e-3 && c.gust < 1e-3) v = 0;                    // dưới ngưỡng: trung tính chính xác
  const d = weatherU.uWindDir.value; d[0] = Math.cos(c.windDir); d[1] = Math.sin(c.windDir);
  // Hanger TP: tăng theo v², có trần
  const vTp = windAt(W.tp.h, v);
  weatherU.uSwayTp.value = v ? K * Math.min(W.tp.maxAmp, W.tp.amp * (vTp / W.tp.refWind) ** 2) : 0;
  // Dây TTL: rung mưa–gió cực đại khi gió vừa [lo, hi] VÀ có mưa; hết mưa chỉ còn phần gió khô (nhỏ); gió vượt hi (bão) thì gió giật làm dây dao động (buffeting) thay cho rung mưa–gió
  const T = W.ttl, vTtl = windAt(T.h, v);
  const band = smooth(T.lo - 2, T.lo + 1, vTtl) * (1 - smooth(T.hi - 2, T.hi + 4, vTtl)), wetF = smooth(T.rainOn[0], T.rainOn[1], c.rain);
  const buffet = T.buffet * smooth(T.hi, T.hi + T.buffetRise, vTtl);
  weatherU.uSwayTtl.value = v ? K * (T.peak * band * wetF + (T.dryAmp + buffet) * (vTtl / T.refWind) ** 2) : 0;
  // Dây Cầu sông Hàn: như TP, nhỏ hơn
  const vSh = windAt(W.sh.h, v);
  weatherU.uSwaySh.value = v ? K * Math.min(W.sh.maxAmp, W.sh.amp * (vSh / W.sh.refWind) ** 2) : 0;
  // Cây: không phóng đại; nghiêng theo gió trung bình, dao động theo gió tức thời
  const Tr = W.trees;
  weatherU.uTreeLean.value = v ? Math.min(Tr.max, Tr.lean * (c.wind / Tr.refWind) ** 2) : 0;
  weatherU.uTreeSway.value = v ? Math.min(Tr.max, Tr.sway * (v / Tr.refWind) ** 2) : 0;
  // Hệ số CPU: vector gió (m/s), thuyền, râu rồng, tốc độ sóng
  windFx.x = v * d[0]; windFx.z = v * d[1];
  windFx.boatRock = 1 + W.boatRock * v; windFx.whisker = 1 + W.whisker * v; windFx.waveSpeed = 1 + W.waveSpeed * v;
}

/* Biên độ đang hiển thị (m, đã phóng đại) — cho test / bảng ảnh hưởng */
export const swayNow = () => ({ tp: weatherU.uSwayTp.value, ttl: weatherU.uSwayTtl.value, sh: weatherU.uSwaySh.value, treeLean: weatherU.uTreeLean.value, treeSway: weatherU.uTreeSway.value, boatRock: windFx.boatRock });
