import * as THREE from 'three';
import { BridgeBase, blinkBeacon } from '../../common/BridgeBase';
import { stepTraffic, type Traffic } from '../../common/traffic';
import { stepBoats, type Boats } from '../../common/boats';
import { TP, tpRoadY } from './profile';
import { tpMaterials, type TpMaterials } from './materials';
import { tpBuildTowers } from './towers';
import { tpBuildDeck } from './deck';
import { tpBuildCables } from './cables';
import { tpBuildApproaches } from './approaches';
import { tpBuildSite } from './site';
import { tpBuildTraffic, tpBuildBoats } from './life';

/* ======================================================================
   CẦU THUẬN PHƯỚC — cầu treo dây võng 3 nhịp ở cửa sông Hàn
   Nằm phía Bắc (−Z) Cầu Rồng ~2,9 km, chạy Tây – Đông như Cầu Rồng.
   Trả về một THREE.Group (this.group), có update() và dispose().
   ====================================================================== */
export class ThuanPhuocBridge extends BridgeBase<TpMaterials> {
  declare traffic: Traffic;
  declare boats: Boats;
  houses!: THREE.InstancedMesh;   // nhà quanh hai đầu cầu (site.ts), để drClearRoads dọn nhà trên đường dọc mới

  constructor() {
    super('ThuanPhuocBridge', 'tp', TP.z, new THREE.Vector3(0, 40, TP.z), TP.lodDistance);
    this.mats = tpMaterials();
    tpBuildTowers(this);
    tpBuildDeck(this);
    tpBuildCables(this);
    tpBuildApproaches(this);
    tpBuildSite(this);
    tpBuildTraffic(this);
    tpBuildBoats(this);
    this.finalize();
  }
  update(dt: number, elapsed: number, cam: THREE.Camera) {
    const near = this.updateLod(cam);
    blinkBeacon(this.mats.beacon, elapsed);
    if (!near) return;
    stepTraffic(this.traffic, dt, tpRoadY);
    stepBoats(this.boats, dt, elapsed, -1300, 900);
  }
}
