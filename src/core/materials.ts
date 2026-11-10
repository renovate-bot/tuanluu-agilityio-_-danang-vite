import * as THREE from 'three';
import { shared } from './shared';
import { canvasTex } from './textures';
import { makeRoadTexture } from '../common/textures';

/* ============================ Vật liệu dùng chung ============================ */
const stoneMap = canvasTex(256, 128, (g, w, h) => {
  g.fillStyle = '#7d7a72'; g.fillRect(0, 0, w, h);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) {
    const v = 120 + Math.random() * 40; g.fillStyle = `rgb(${v},${v - 4},${v - 12})`;
    g.fillRect(c * 32 + (r % 2) * 16 + 2, r * 32 + 2, 28, 28);
  }
});
stoneMap.wrapS = stoneMap.wrapT = THREE.RepeatWrapping;
stoneMap.repeat.set(1200, 1);

export const MAT = {
  gold: new THREE.MeshStandardMaterial({ color: 0xd9a63a, metalness: 0.9, roughness: 0.34 }),
  scale: new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.92, roughness: 0.3, side: THREE.DoubleSide }),
  concrete: new THREE.MeshStandardMaterial({ color: 0xbab8b1, roughness: 0.92, metalness: 0.0 }),
  pier: new THREE.MeshStandardMaterial({ color: 0xa9a69d, roughness: 0.95 }),
  girder: new THREE.MeshStandardMaterial({ color: 0x8b9096, roughness: 0.55, metalness: 0.5 }),
  paver: new THREE.MeshStandardMaterial({ color: 0xc8b89c, roughness: 0.9 }),
  rail: new THREE.MeshStandardMaterial({ color: 0xa3a9ae, roughness: 0.3, metalness: 0.85 }),
  cable: new THREE.MeshStandardMaterial({ color: 0xc9ced2, roughness: 0.25, metalness: 0.95 }),
  land: new THREE.MeshStandardMaterial({ color: 0x9a9f86, roughness: 1 }),
  sand: new THREE.MeshStandardMaterial({ color: 0xe2d3a8, roughness: 1 }),
  grass: new THREE.MeshStandardMaterial({ color: 0x5f8a45, roughness: 1 }),
  mountain: new THREE.MeshStandardMaterial({ color: 0x2f4c33, roughness: 1, flatShading: true }),
  trunk: new THREE.MeshStandardMaterial({ color: 0x6b5238, roughness: 1 }),
  leaf: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }),
  palm: new THREE.MeshStandardMaterial({ color: 0x4f8f3a, roughness: 0.85, side: THREE.DoubleSide }),
  lampPole: new THREE.MeshStandardMaterial({ color: 0x5a6066, roughness: 0.5, metalness: 0.7 }),
  bulb: new THREE.MeshBasicMaterial({ color: 0x9a9890 }),
  mouth: new THREE.MeshStandardMaterial({ color: 0x7a1a12, roughness: 0.6 }),
  tooth: new THREE.MeshStandardMaterial({ color: 0xf3ead2, roughness: 0.35, metalness: 0.2 }),
  eye: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, emissive: 0xffe9b0, emissiveIntensity: 0.05 }),
  pupil: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1, emissive: 0xff3010, emissiveIntensity: 0 }),
  /* Dải LED (vật liệu tự phát sáng) dùng cho viền thân rồng và lan can */
  ledRail: new THREE.ShaderMaterial({
    uniforms: shared,
    vertexShader: `varying float vX; void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vX = wp.x; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `uniform float uTime; uniform float uNight; varying float vX;
    void main(){
      float k = 0.5 + 0.5 * sin(uTime * 0.6 + vX * 0.012);
      float w = 0.5 + 0.5 * sin(vX * 0.09 - uTime * 3.2);
      vec3 led = mix(vec3(1.0,0.72,0.28), vec3(0.22,0.55,1.0), k) * (0.5 + 1.8 * w);
      vec3 dayc = vec3(0.42,0.40,0.34);
      gl_FragColor = vec4(mix(dayc, led, uNight), 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`
  }),
  road: new THREE.MeshStandardMaterial({ map: makeRoadTexture(3), roughness: 0.88 }),
  road2: new THREE.MeshStandardMaterial({ map: makeRoadTexture(2), roughness: 0.88 }),
  stone: new THREE.MeshStandardMaterial({ roughness: 0.95, map: stoneMap })
};
