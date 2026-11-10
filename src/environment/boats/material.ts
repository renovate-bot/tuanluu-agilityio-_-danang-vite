import * as THREE from 'three';
import { CONFIG } from '../../config';
import { shared } from '../../core/shared';
import { ATLAS_ROWS } from './hulls';
import { btNameAtlas } from './atlas';

/* =====================================================================
   VẬT LIỆU ĐỘI TÀU — một vật liệu cho mọi tàu (D-026).
   - aPart (theo đỉnh) ≠ aBoat.x (theo instance) ⇒ thu đỉnh về gốc: tam giác suy biến, không rasterize ⇒ một InstancedMesh vẽ nhiều kiểu.
   - aBoat = (kiểu, biến thể màu sọc, màu LED, tên); aGlow (theo đỉnh) = loại đèn (hulls.ts → Glow).
   - Đèn đêm bằng emissive nhân uNight; không đèn thật.
   Bóng đổ dùng btDepthMaterial cùng bản vá, nếu không lượt vẽ bóng sẽ vẽ chồng mọi kiểu.
   ===================================================================== */
const B = CONFIG.boats;
const STRIPES = B.palette.stripes;   // màu sọc thân theo biến thể (config.ts)

const VS_HEAD = /* glsl */`
attribute float aPart;
attribute float aGlow;
attribute vec4 aBoat;
varying float vGlow;
varying vec4 vBoat;
`;
const VS_COLLAPSE = /* glsl */`#include <begin_vertex>
if ( abs( aPart - aBoat.x ) > 0.5 ) transformed = vec3( 0.0 );`;

const uniforms = {
  uNight: shared.uNight,
  uStripe: { value: STRIPES.map((c) => new THREE.Color(c)) },
  uWin: { value: new THREE.Color(B.windowColor).multiplyScalar(B.windowGain) },
  uLed: { value: B.led.colors.map((c) => new THREE.Color(c).multiplyScalar(B.led.gain)) },
  uNavR: { value: new THREE.Color(B.palette.navRed).multiplyScalar(B.palette.navGain) },
  uNavG: { value: new THREE.Color(B.palette.navGreen).multiplyScalar(B.palette.navGain) }
};

export const btFleetMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05, map: btNameAtlas() });
btFleetMaterial.name = 'boatFleet';
btFleetMaterial.onBeforeCompile = (s) => {
  Object.assign(s.uniforms, uniforms);
  s.vertexShader = VS_HEAD + s.vertexShader
    .replace('#include <begin_vertex>', VS_COLLAPSE)
    .replace('#include <uv_vertex>', `#include <uv_vertex>
vGlow = aGlow; vBoat = aBoat;
if ( aGlow > 4.5 && aGlow < 5.5 ) vMapUv.y += aBoat.w / ${ATLAS_ROWS.toFixed(1)};   // biển tên: dịch tới hàng tên của tàu`);
  s.fragmentShader = /* glsl */`
uniform float uNight;
uniform vec3 uStripe[ ${STRIPES.length} ];
uniform vec3 uWin;
uniform vec3 uLed[ ${B.led.colors.length} ];
uniform vec3 uNavR;
uniform vec3 uNavG;
varying float vGlow;
varying vec4 vBoat;
` + s.fragmentShader
    .replace('#include <color_fragment>', `#include <color_fragment>
if ( vGlow > 6.5 ) diffuseColor.rgb = uStripe[ int( clamp( vBoat.y, 0.0, ${(STRIPES.length - 1).toFixed(1)} ) ) ];   // sọc thân theo biến thể`)
    .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
// đèn đêm đứng yên (không nhấp nháy): chỉ nhân uNight
if ( vGlow > 0.5 && vGlow < 1.5 ) totalEmissiveRadiance += uWin * uNight;                                                      // cửa sổ cabin vàng ấm
else if ( vGlow > 1.5 && vGlow < 2.5 ) totalEmissiveRadiance += uLed[ int( clamp( vBoat.z, 0.0, ${(B.led.colors.length - 1).toFixed(1)} ) ) ] * uNight;   // viền LED theo màu của tàu
else if ( vGlow > 2.5 && vGlow < 3.5 ) totalEmissiveRadiance += uNavR * uNight;                             // đèn mạn đỏ
else if ( vGlow > 3.5 && vGlow < 4.5 ) totalEmissiveRadiance += uNavG * uNight;                             // đèn mạn xanh
else if ( vGlow > 4.5 && vGlow < 5.5 ) totalEmissiveRadiance += diffuseColor.rgb * 1.4 * uNight;                              // biển tên sáng
else if ( vGlow > 5.5 && vGlow < 6.5 ) totalEmissiveRadiance += vColor * 2.0 * uNight;                                        // đèn lồng`);
  btFleetMaterial.userData.fs = s.fragmentShader;
  btFleetMaterial.userData.vs = s.vertexShader;
};
btFleetMaterial.customProgramCacheKey = () => 'boatFleet';

export const btDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
btDepthMaterial.onBeforeCompile = (s) => {
  s.vertexShader = 'attribute float aPart;\nattribute vec4 aBoat;\n' + s.vertexShader.replace('#include <begin_vertex>', VS_COLLAPSE);
  btDepthMaterial.userData.vs = s.vertexShader;
};
btDepthMaterial.customProgramCacheKey = () => 'boatDepth';
