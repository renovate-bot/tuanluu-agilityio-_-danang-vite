/* ===== Lái xe: tham số nhiều người của máy chủ (src/explore/multi/params.ts, chép số) khớp hình học và thông số xe =====
   params.ts không import gì nên khung kẹp / vMax / steerMax là số chép tay: test này giữ chúng bằng mạng đường thật và CONFIG.drive. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../src/config.ts';
import { multiParams as P } from '../../src/explore/multi/params.ts';
import { drMakeNet, drBounds } from '../../src/explore/drive/net.ts';
import { drBuildPads } from '../../src/explore/drive/roadData.ts';

const B = drBounds(drMakeNet(drBuildPads(), []));

test('multiParams.drive: 5 chỗ, khung kẹp chứa trọn drBounds(net) và không rộng hơn 100 m mỗi phía', () => {
  const D = P.drive;
  assert.equal(D.slots, 5);
  assert.ok(D.bounds.x0 <= B.x0 && D.bounds.x0 >= B.x0 - 100, `x0 ${D.bounds.x0} / ${B.x0}`);
  assert.ok(D.bounds.x1 >= B.x1 && D.bounds.x1 <= B.x1 + 100, `x1 ${D.bounds.x1} / ${B.x1}`);
  assert.ok(D.bounds.z0 <= B.z0 && D.bounds.z0 >= B.z0 - 100, `z0 ${D.bounds.z0} / ${B.z0}`);
  assert.ok(D.bounds.z1 >= B.z1 && D.bounds.z1 <= B.z1 + 100, `z1 ${D.bounds.z1} / ${B.z1}`);
  assert.ok(D.yMin <= B.yMin && D.yMin >= B.yMin - 10, `yMin ${D.yMin} / ${B.yMin}`);
  assert.ok(D.yMax >= B.yMax && D.yMax <= B.yMax + 10, `yMax ${D.yMax} / ${B.yMax}`);
});

test('multiParams.drive: vMax ≥ tốc độ tối đa xe, steerMax ≥ góc lái lớn nhất asin(wheelbase / turnRadius)', () => {
  assert.ok(P.drive.vMax >= CONFIG.drive.perf.vMax);
  assert.ok(P.drive.vMax <= CONFIG.drive.perf.vMax * 1.2, 'dư nhỏ, không rộng tùy ý');
  const steer = Math.asin(CONFIG.drive.car.wheelbase / CONFIG.drive.perf.turnRadius);
  assert.ok(P.drive.steerMax >= steer, `steerMax ${P.drive.steerMax} / ${steer}`);
  assert.ok(P.drive.steerMax <= steer + 0.1);
});
