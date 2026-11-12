import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MAT } from '../core/materials';
import { weatherFx } from '../core/shared';

/* Bộ vật liệu của một cầu: bê tông và thép là bắt buộc để gộp hình học; textures được dispose cùng cầu */
export interface BridgeMaterials {
  concrete: THREE.Material;
  steel: THREE.Material;
  textures?: THREE.Texture[];
}
/* Phần tối thiểu mà các hàm dựng chi tiết dùng chung cần (cũng dùng cho nhịp quay cầu sông Hàn) */
export interface BridgeParts {
  group: THREE.Group;
  details: THREE.Group;
  concreteParts: THREE.BufferGeometry[];
  noReflect: THREE.Object3D[];
}

/* ---------- lớp nền cho mọi cầu ----------
   group + details (LOD) + life, gộp bê tông/thép, lớp không phản chiếu, dispose() */
export abstract class BridgeBase<M extends BridgeMaterials = BridgeMaterials> implements BridgeParts {
  prefix: string;
  group = new THREE.Group();
  details = new THREE.Group();   // ẩn khi ở xa (LOD)
  life = new THREE.Group();      // xe cộ, thuyền, người
  lifeOn = true;
  closable = true;               // theo lệnh đóng cầu của thời tiết; Hầm đặt false
  lodDistance: number;
  center: THREE.Vector3;
  concreteParts: THREE.BufferGeometry[] = [];
  steelParts: THREE.BufferGeometry[] = [];
  noReflect: THREE.Object3D[] = [];
  stats: Record<string, number> = {};
  farHide: THREE.Object3D[] = [];  // vật thể ẩn khi camera ở rất xa (mặt đường, dải LED…)
  farDistance = Infinity;
  mats: M;

  constructor(name: string, prefix: string, z: number, center: THREE.Vector3, lodDistance: number) {
    this.prefix = prefix;
    this.group.name = name; this.group.position.z = z;
    this.details.name = `${prefix}-details`;
    this.life.name = `${prefix}-life`;
    this.group.add(this.details, this.life);
    this.lodDistance = lodDistance; this.center = center;
  }
  abstract update(dt: number, elapsed: number, cam: THREE.Camera): void;
  /* gộp bê tông (bệ, neo, dầm, gờ) và thép nhỏ thành ít draw call; gắn lớp 1 cho phần không cần phản chiếu */
  finalize() {
    if (this.concreteParts.length) {
      const conc = new THREE.Mesh(mergeGeometries(this.concreteParts), this.mats.concrete);
      conc.name = `${this.prefix}-concrete`; conc.castShadow = conc.receiveShadow = true; this.group.add(conc);
    }
    if (this.steelParts.length) {
      const steel = new THREE.Mesh(mergeGeometries(this.steelParts.map((g) => { if (g.attributes.uv) g.deleteAttribute('uv'); return g; })), this.mats.steel);
      steel.castShadow = true; this.group.add(steel);
    }
    this.concreteParts = this.steelParts = null;
    // Chi tiết nhỏ, mặt đường, nhà cửa, xe: chỉ vẽ trực tiếp (lớp 1), bỏ khỏi lượt vẽ phản chiếu của mặt nước
    for (const o of [this.details, this.life, ...this.noReflect]) o.traverse((c) => c.layers.set(1));
  }
  setLifeVisible(on: boolean) { this.lifeOn = on; }
  /* LOD: ẩn chi tiết nhỏ khi camera ở xa; trả về true nếu cần cập nhật xe/thuyền */
  updateLod(cam: THREE.Camera) {
    const dist = cam.position.distanceTo(this.center);
    this.details.visible = dist < this.lodDistance;
    this.life.visible = this.lifeOn && !(this.closable && weatherFx.clear >= 1) && dist < this.lodDistance * 1.3;   // đóng cầu (bão) xong thì ẩn cả xe, thuyền, người; lifeOn (nút người dùng) giữ nguyên
    const far = dist > this.farDistance;
    for (const o of this.farHide) o.visible = !far && o.userData.on !== false;
    return this.life.visible;
  }
  dispose() {
    const sharedMats = new Set<THREE.Material>(Object.values(MAT));
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose();
      if ((o as THREE.BatchedMesh).isBatchedMesh) (o as THREE.BatchedMesh).dispose();   // người thật (D-032): texture ma trận / màu riêng của lưới; vật liệu + atlas / chuyển động dùng chung 3 hệ không đụng
    });
    for (const [k, mat] of Object.entries(this.mats)) if (k !== 'textures' && mat && (mat as THREE.Material).isMaterial && !sharedMats.has(mat as THREE.Material)) (mat as THREE.Material).dispose();
    (this.mats.textures || []).forEach((t) => t.dispose());
    this.group.removeFromParent();
  }
}

/* đèn báo hàng không: chớp 0,25 s mỗi 1,5 s; đủ sáng để bloom ban đêm */
export function blinkBeacon(mat: THREE.MeshBasicMaterial, elapsed: number, phase = 0) {
  const on = ((elapsed + phase) % 1.5) < 0.25;
  mat.color.setRGB(on ? 3.0 : 0.22, on ? 0.18 : 0.02, on ? 0.08 : 0.01);
}
