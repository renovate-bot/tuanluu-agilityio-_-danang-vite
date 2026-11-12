import * as THREE from 'three';

/* Trạng thái camera dùng chung giữa camera.ts, tour.ts và UI */
export type CameraMode = 'orbit' | 'fly' | 'drive' | 'tpDrive' | 'hrDrive' | 'walk' | 'tour' | 'storm' | 'swRide' | 'glider' | 'stroll' | 'car';   // storm: camera theo hành trình kịch bản bão; swRide: ngồi cabin Vòng quay Mặt Trời (camera do SunWheel.update đặt); glider: bay dù lượn (camera do explore.update đặt); stroll: đi dạo (camera do stroll.update đặt); car: lái xe tự khám phá (camera do drive.update đặt; 'drive' là góc nhìn lái qua Cầu Rồng có sẵn)
export const cam = {
  mode: 'orbit' as CameraMode,
  /* flyTo đang chạy; then === 'tour' nghĩa là bay xong thì bắt đầu Tour */
  flight: { t: 0, dur: 1.6, fromP: new THREE.Vector3(), fromT: new THREE.Vector3(), toP: new THREE.Vector3(), toT: new THREE.Vector3(), then: null as 'tour' | null }
};
/* Phím đang giữ (chế độ đi bộ) */
export const keys = new Set<string>();
