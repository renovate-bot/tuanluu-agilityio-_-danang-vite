import * as THREE from 'three';
import { CONFIG } from '../../config';
import { shared } from '../../core/shared';

/* =====================================================================
   VẬT LIỆU NGƯỜI ĐI BỘ — một vật liệu dùng chung cho mọi hệ người (spec G5–G8, §5), theo patchPerson của bản dựng thử.
   Tay chân vung trong vertex shader theo shared.uTime, không cập nhật đỉnh trên CPU. Công thức góc khớp giống hệt gait.ts (ppAngles).
   Thuộc tính instance (bên dựng gắn vào hình học của từng InstancedMesh):
   - aVar (vec4): x pha φ0 (rad), y biên độ hông A (0 đứng, walk.amp, run.amp), z cờ (1 nón lá, 2 ba lô, 4 chụp ảnh), w nhịp (rad/s, ppCadence)
   - aPants (vec3): màu quần tuyến tính; màu áo qua instanceColor (setColorAt — bắt buộc gọi để có USE_INSTANCING_COLOR)
   Người không đổ bóng, không vào phản chiếu (spec §6) nên không có vật liệu bóng riêng. Không emissive, không texture.
   Không thêm vào tập bóc mặt cắt hầm (cutaway.ts): người không đứng trong vùng bóc, vật liệu người cũ cũng không có trong tập đó.
   ===================================================================== */
const P = CONFIG.people;
const f = (x: number) => x.toFixed(4);   // số → hằng GLSL

/* pAngles: x góc khớp gốc (hông / vai), y góc khớp giữa (gối / khuỷu); dương = đưa về phía trước. Bản CPU: gait.ts ppAngles */
const VS_HEAD = /* glsl */`
attribute float aPart;
attribute float aSeg;
attribute float aPivot;
attribute float aPivot2;
attribute float aMask;
attribute vec3 aFix;
attribute vec4 aVar;
attribute vec3 aPants;
uniform float uTime;
float pFlag( float b ) { return mod( floor( aVar.z / b ), 2.0 ); }
float pRunMix() { return smoothstep( 0.42, 0.6, aVar.y ); }
float pPhase() { return uTime * aVar.w + aVar.x; }
vec2 pAngles() {
  float A = aVar.y, ph = pPhase(), run = pRunMix();
  if ( aPart > 0.5 && aPart < 2.5 ) {
    float fl = aPart < 1.5 ? ph : ph + 3.14159265;
    float sw = max( 0.0, cos( fl - 0.35 ) ), sr = max( 0.0, cos( fl + 0.45 ) );   // đi: gập gối khi đưa chân lên trước; chạy: gập sớm và sâu hơn
    return vec2( A * sin( fl ) + mix( 0.12 * A, 0.22, run ), -mix( A * 2.0 * sw * sw + 0.06 * step( 0.01, A ), 0.38 + 1.5 * sr * sr, run ) );
  }
  if ( aPart > 2.5 && aPart < 4.5 ) {
    float fa = aPart < 3.5 ? ph + 3.14159265 : ph;
    if ( aPart > 3.5 && pFlag( 4.0 ) > 0.5 ) return vec2( ${f(P.photo.shoulder)}, ${f(P.photo.elbow)} );   // giơ tay phải chụp ảnh
    return vec2( A * ( 0.65 + run * 0.5 ) * sin( fa ) - 0.05, 0.16 + run * 1.25 + A * 0.35 * max( 0.0, sin( fa ) ) );
  }
  return vec2( 0.0 );
}
vec2 pRot( vec2 p, float a ) { float c = cos( a ), s = sin( a ); return vec2( p.x * c - p.y * s, p.x * s + p.y * c ); }
`;
// pháp tuyến quay cùng khớp (beginnormal_vertex chạy trước begin_vertex nên ppA dùng lại được)
const VS_NORMAL = /* glsl */`#include <beginnormal_vertex>
vec2 ppA = pAngles();
float ppLean = ( aPart < 0.5 || aPart > 2.5 ) ? -${f(P.run.lean)} * pRunMix() : 0.0;
objectNormal.xy = pRot( objectNormal.xy, ppA.x + ( aSeg > 0.5 ? ppA.y : 0.0 ) + ppLean );`;
const VS_POS = /* glsl */`#include <begin_vertex>
if ( aSeg > 0.5 ) transformed.xy = pRot( transformed.xy - vec2( 0.0, aPivot2 ), ppA.y ) + vec2( 0.0, aPivot2 );
transformed.xy = pRot( transformed.xy - vec2( 0.0, aPivot ), ppA.x ) + vec2( 0.0, aPivot );
transformed.xy = pRot( transformed.xy - vec2( 0.0, ${f(P.legLength)} ), ppLean ) + vec2( 0.0, ${f(P.legLength)} );   // chạy: thân, đầu, tay đổ về trước quanh hông
if ( aPart > 4.5 && aPart < 5.5 && pFlag( 1.0 ) < 0.5 ) transformed = vec3( 0.0 );   // không đội nón: thu về gốc (tam giác suy biến)
if ( aPart > 5.5 && pFlag( 2.0 ) < 0.5 ) transformed = vec3( 0.0 );                  // không đeo ba lô
float ppPh = pPhase(), ppMove = step( 0.01, aVar.y );
transformed.y += mix( ${f(P.bob.walk)} * cos( 2.0 * ppPh ) - ${f(P.bob.walk)}, ${f(P.bob.run)} * ( 0.5 - 0.5 * cos( 2.0 * ppPh ) ), pRunMix() ) * ppMove;   // đi: thấp nhất khi hai chân dang rộng; chạy: bật lên giữa hai bước
transformed.z += ${f(P.sway)} * sin( ppPh ) * ppMove * smoothstep( 0.3, 1.6, transformed.y );   // lắc vai nhẹ sang hai bên`;
const VS_COLOR = /* glsl */`#include <color_vertex>
#ifdef USE_INSTANCING_COLOR
vColor.rgb = aMask < 0.5 ? aFix : ( aMask < 1.5 ? instanceColor.rgb : aPants );   // cố định / áo / quần
#endif`;

let mat: THREE.MeshStandardMaterial | null = null;
/* Một vật liệu cho mọi hệ người (tạo lần đầu gọi) */
export function ppMaterial(): THREE.MeshStandardMaterial {
  if (mat) return mat;
  const m = new THREE.MeshStandardMaterial({ roughness: P.roughness });
  m.name = 'peopleWalk';
  m.onBeforeCompile = (s) => {
    s.uniforms.uTime = shared.uTime;
    s.vertexShader = VS_HEAD + s.vertexShader.replace('#include <beginnormal_vertex>', VS_NORMAL).replace('#include <begin_vertex>', VS_POS).replace('#include <color_vertex>', VS_COLOR);
    m.userData.vs = s.vertexShader;
  };
  m.customProgramCacheKey = () => 'peopleWalk';
  return (mat = m);
}
