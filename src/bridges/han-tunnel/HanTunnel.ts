import * as THREE from 'three';
import { shared } from '../../core/shared';
import { BridgeBase } from '../../common/BridgeBase';
import { createTraffic, stepTraffic, type Traffic } from '../../common/traffic';
import { boatKeepOut } from '../../environment/traffic';
import { HR, hrRoadY, hrInside } from './profile';
import { hrMaterials, hrUpdateLamps, type HrMaterials } from './materials';
import { buildBore, spinFans, type Bore } from './bore';
import { hrBuildOutdoor } from './outdoor';
import { hrBuildRiverbed, type Riverbed } from './riverbed';
import { hrClearCorridor } from './corridor';
import { Cutaway } from './cutaway';
import { ImmersionController, IM_STATES, type ImState } from './immersion';

/* ======================================================================
   HẦM VƯỢT SÔNG HÀN — phương án đề xuất 2025 (chưa xây), nối Đống Đa (Hải Châu) với Vân Đồn (Sơn Trà)
   Group đặt tại z = −1700; tim sông là x = 0. Hầm dìm 5 đốt × 120 m qua sông, hầm kín trên bờ, hầm hở hai đầu.
   ====================================================================== */
export class HanTunnel extends BridgeBase<HrMaterials> {
  underground = new THREE.Group();    // vỏ + nội thất hầm kín: chỉ hiện khi camera ở trong hầm, bật mặt cắt hoặc đang mô phỏng dìm
  bores!: { west: Bore; mid: Bore; east: Bore };
  riverbed!: Riverbed;
  cutaway!: Cutaway;
  readonly cfg = HR;
  ctrl = new ImmersionController();
  traffic!: Traffic;
  sim = new THREE.Group();
  private masts: THREE.Mesh[] = [];
  private tugs: THREE.Group[] = [];
  private bulk: THREE.Mesh[] = [];
  private fanAngle = 0;
  forceInterior = false;               // Tour/UI muốn thấy nội thất bất kể vị trí camera

  constructor() {
    super('HanTunnel', 'hr', HR.z, new THREE.Vector3(0, 5, HR.z), HR.lodDistance);
    this.mats = hrMaterials();
    this.farDistance = HR.farDistance;
    this.closable = false;           // bão: hầm vẫn lưu thông (bơm thoát nước làm việc), không theo lệnh đóng cầu
    hrClearCorridor();               // phải chạy trước khi dựng cọ và đèn của chính hầm
    // vỏ + nội thất theo ba đoạn: đốt 3 (±60 m) tách riêng để mô phỏng dìm
    const M = this.mats;
    this.bores = { west: buildBore(-HR.coverHalf, -60, M, 'hr-bore-w'), mid: buildBore(-60, 60, M, 'hr-bore-mid'), east: buildBore(60, HR.coverHalf, M, 'hr-bore-e') };
    this.underground.name = 'hr-underground';
    this.underground.add(this.bores.west.group, this.bores.mid.group, this.bores.east.group);
    this.underground.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = true; });
    this.group.add(this.underground); this.noReflect.push(this.underground);
    this.riverbed = hrBuildRiverbed(M);
    this.group.add(this.riverbed.group); this.noReflect.push(this.riverbed.group);
    hrBuildOutdoor(this);
    this.buildSim();
    this.traffic = createTraffic(this, { seed: 3100, x0: -1500, x1: 1480, name: 'hr-traffic', lanes: [
      { off: HR.laneOffsets[0], n: 34, speed: HR.carSpeed, bike: 0.03, bus: 0.12 },
      { off: HR.laneOffsets[1], n: 30, speed: HR.carSpeed, bike: 0.06, bus: 0.12 },
      { off: HR.laneOffsets[2], n: 110, speed: HR.bikeSpeed, bike: 0.94, bus: 0 }   // làn phải: xe máy
    ] });
    this.finalize();
    // tiết kiệm draw call: bê tông/thép gộp không vào lượt phản chiếu mặt nước; thép và cột đèn không đổ bóng
    for (const o of this.group.children) { const me = o as THREE.Mesh; if (me.isMesh && (me.name === 'hr-concrete' || me.material === this.mats.steel)) { me.layers.set(1); if (me.material === this.mats.steel) me.castShadow = false; } }
    this.details.traverse((o) => { (o as THREE.Mesh).castShadow = false; });
    this.cutaway = new Cutaway(this.mats);
    this.ctrl.addEventListener('immerseStart', () => { this.cutaway.setGlass(true); boatKeepOut.on = true; });
    this.ctrl.addEventListener('immerseDone', () => { this.cutaway.setGlass(false); boatKeepOut.on = false; });
    this.applySim();
  }
  /* Phần chỉ có khi mô phỏng dìm: vách ngăn kín hai đầu đốt, tháp định vị, tàu kéo, phao đánh dấu hào */
  private buildSim() {
    const M = this.mats, sim = this.sim;
    sim.name = 'hr-sim'; sim.visible = false;
    for (const s of [-1, 1]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.7, HR.roofTop + HR.slabBelow, HR.halfWidth * 2), M.bulk);
      b.position.set(s * (60 - 0.35), hrRoadY(s * 60) + (HR.roofTop - HR.slabBelow) / 2, 0); b.visible = false; b.castShadow = true;
      this.bores.mid.group.add(b); this.bulk.push(b);
      const mast = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1, 1.2), M.pontoon); mast.castShadow = true; sim.add(mast); this.masts.push(mast);
      const tug = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.BoxGeometry(5.5, 2.4, 14), M.tug), cab = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.4, 5), M.pontoon);
      hull.position.y = 0.6; cab.position.set(0, 2.6, -2); hull.castShadow = cab.castShadow = true; tug.add(hull, cab); sim.add(tug); this.tugs.push(tug);
    }
    const buoy = new THREE.InstancedMesh(new THREE.SphereGeometry(0.9, 10, 8), M.buoy, 4), m = new THREE.Matrix4();
    [[-70, -47], [70, -47], [-70, 47], [70, 47]].forEach(([x, z], i) => buoy.setMatrixAt(i, m.makeTranslation(x, 0.2, z)));
    sim.add(buoy);
    this.group.add(sim); this.noReflect.push(sim);
  }
  /* Tư thế đốt 3 và các phụ kiện theo trạng thái mô phỏng */
  private applySim() {
    const c = this.ctrl, busy = c.busy, mid = this.bores.mid, rb = this.riverbed.ribbons[2], t = performance.now() / 1000;
    // Đốt nổi dập dềnh theo sóng: chỉ chìm xuống (−0,08…0 m), không bao giờ cao hơn FLOAT_LIFT (mạn khô +0,8 m), kể cả khung đầu của BALLAST
    mid.group.position.set(c.gap, c.lift + (busy && c.lift > 1 ? (Math.sin(t * 1.3) - 1) * 0.04 : 0), c.zOff);
    mid.fit.visible = !busy || c.state === 'DONE';
    this.sim.visible = busy && c.state !== 'DONE';
    this.bulk.forEach((b) => { b.visible = busy && c.state !== 'BACKFILL' && c.state !== 'DONE'; });
    rb.visible = !busy || c.fill > 0.01; rb.scale.z = busy ? Math.max(c.fill, 0.001) : 1;
    const top = hrRoadY(0) + HR.roofTop + c.lift;
    this.masts.forEach((m, i) => {
      const s = i ? 1 : -1, h = Math.max(1, 6 - top);
      m.position.set(c.gap + s * 45, top + h / 2, c.zOff); m.scale.set(1, h, 1); m.visible = c.state !== 'BACKFILL';
    });
    this.tugs.forEach((g, i) => {
      const s = i ? 1 : -1;
      g.position.set(s * 78 + c.gap, 0.4 + Math.sin(t * 1.1 + i) * 0.06, c.zOff - 22 - c.tugs * 160);
      g.rotation.z = Math.sin(t * 0.9 + i * 2) * 0.012;
    });
  }
  setForceInterior(on: boolean) { this.forceInterior = on; }
  /* Thuyền đang chạy ngang vùng thi công thì giữ lại ở mép vùng cấm (dùng cho thuyền của các cầu khác) */
  holdBoats(list: { z: number; dir: number }[]) {
    if (!this.ctrl.busy) return;
    for (const b of list) if (b.z > boatKeepOut.z0 && b.z < boatKeepOut.z1) b.z = b.dir > 0 ? boatKeepOut.z0 : boatKeepOut.z1;
  }
  update(dt: number, elapsed: number, cam: THREE.Camera) {
    this.updateLod(cam); const c = this.ctrl, dist = cam.position.distanceTo(this.center);
    this.group.visible = dist < HR.hideDistance;   // xa quá thì không vẽ gì (bê tông, thép gộp không có LOD riêng)
    c.update(dt);
    hrUpdateLamps(this.mats, shared.uNight.value);
    const p = cam.position, inside = hrInside(p.x, p.y, p.z - 0);
    this.underground.visible = this.details.visible && (inside || this.cutaway.section || c.busy || this.forceInterior);
    if (this.underground.visible) {
      this.fanAngle += dt * 14;
      for (const b of Object.values(this.bores)) spinFans(b, this.fanAngle);
    }
    this.applySim();
    // Đáy sông là một phần của chế độ mặt cắt / nước trong / mô phỏng: KHÔNG phụ thuộc LOD chi tiết (lodDistance 600 m nhỏ hơn khoảng cách góc hrOverview ≈ 800 m).
    // Xa hơn hideDistance thì cả group đã ẩn. Chế độ tắt thì vẫn ẩn → góc nhìn thường không thêm draw call
    this.riverbed.group.visible = this.cutaway.section || this.cutaway.glass || c.busy;
    this.life.visible = this.life.visible && !c.busy && dist < HR.lifeDistance;     // đóng đường khi thi công; xe chỉ vẽ khi camera gần
    if (this.life.visible) stepTraffic(this.traffic, dt, hrRoadY, false);   // hầm vẫn lưu thông khi bão (phương án đề xuất)
  }
  get state(): ImState { return this.ctrl.state; }
  static readonly states = IM_STATES;
}
