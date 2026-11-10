import * as THREE from 'three';
import { CONFIG } from '../../config';
import { shared } from '../../core/shared';
import { Role } from './shapes';

/* =====================================================================
   VẬT LIỆU XE CỘ — một vật liệu cho mọi hệ xe (thay MAT.vehicle / glass / headLamp / tailLamp), theo mẫu đội tàu (D-026).
   - aPart (theo đỉnh) ≠ aType (theo instance) ⇒ thu đỉnh về gốc: tam giác suy biến, không rasterize ⇒ một InstancedMesh vẽ cả 3 loại xe.
   - aRole (theo đỉnh, xem Role): Paint → aPaint (màu thân theo xe), Accent → aAccent (áo người lái), Helmet → aAccent.brg (mũ), còn lại giữ màu đỉnh.
   - Đèn pha / đèn hậu: emissive trong shader, bật khi uNight ≥ lamp.nightOn; ban ngày đỉnh đèn mang màu headDay / tailDay. Không đèn thật, không texture.
   Bóng đổ dùng vhDepthMaterial cùng bản vá, nếu không lượt vẽ bóng sẽ vẽ chồng cả 3 loại.
   ===================================================================== */
const V = CONFIG.vehicles;
const f = (x: number) => x.toFixed(3);   // số → hằng GLSL

const VS_HEAD = /* glsl */`
attribute float aPart;
attribute float aRole;
attribute float aType;
attribute vec3 aPaint;
attribute vec3 aAccent;
varying float vLamp;
`;
const VS_COLLAPSE = /* glsl */`#include <begin_vertex>
if ( abs( aPart - aType ) > 0.5 ) transformed = vec3( 0.0 );`;
const VS_COLOR = /* glsl */`#include <color_vertex>
if ( abs( aRole - ${f(Role.Paint)} ) < 0.5 ) vColor.rgb = aPaint;                 // thân xe theo màu của xe
else if ( abs( aRole - ${f(Role.Accent)} ) < 0.5 ) vColor.rgb = aAccent;           // áo người lái
else if ( abs( aRole - ${f(Role.Helmet)} ) < 0.5 ) vColor.rgb = aAccent.brg;       // mũ bảo hiểm: hoán vị kênh màu áo
vLamp = abs( aRole - ${f(Role.Head)} ) < 0.5 ? 1.0 : ( abs( aRole - ${f(Role.Tail)} ) < 0.5 ? 2.0 : 0.0 );   // 1 đèn pha, 2 đèn hậu, 0 khác`;

const uniforms = {
  uNight: shared.uNight,
  uHead: { value: new THREE.Color().setRGB(...V.lamp.head) },   // màu tuyến tính > 1 (sáng hơn MAT.headLamp cũ, xem config)
  uTail: { value: new THREE.Color().setRGB(...V.lamp.tail) }    // màu tuyến tính > 1 (giữ đúng MAT.tailLamp cũ)
};

export const vhMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: V.roughness, metalness: V.metalness });
vhMaterial.name = 'vehicleFleet';
vhMaterial.onBeforeCompile = (s) => {
  Object.assign(s.uniforms, uniforms);
  s.vertexShader = VS_HEAD + s.vertexShader.replace('#include <begin_vertex>', VS_COLLAPSE).replace('#include <color_vertex>', VS_COLOR);
  s.fragmentShader = /* glsl */`
uniform float uNight;
uniform vec3 uHead;
uniform vec3 uTail;
varying float vLamp;
` + s.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
// đèn bật theo ngưỡng đêm (như cũ: ẩn mesh đèn khi uNight ≤ ${V.lamp.nightOn}), không nhấp nháy
float lampOn = step( ${f(V.lamp.nightOn)}, uNight );
if ( vLamp > 0.5 && vLamp < 1.5 ) totalEmissiveRadiance += uHead * lampOn;   // đèn pha
else if ( vLamp > 1.5 ) totalEmissiveRadiance += uTail * lampOn;              // đèn hậu`);
  vhMaterial.userData.fs = s.fragmentShader;
  vhMaterial.userData.vs = s.vertexShader;
};
vhMaterial.customProgramCacheKey = () => 'vehicleFleet';

export const vhDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
vhDepthMaterial.onBeforeCompile = (s) => {
  s.vertexShader = 'attribute float aPart;\nattribute float aType;\n' + s.vertexShader.replace('#include <begin_vertex>', VS_COLLAPSE);
  vhDepthMaterial.userData.vs = s.vertexShader;
};
vhDepthMaterial.customProgramCacheKey = () => 'vehicleDepth';
