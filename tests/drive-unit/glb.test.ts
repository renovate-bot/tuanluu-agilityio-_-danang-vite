/* ===== Lái xe: public/car/vf3.glb (sinh bằng scripts/car/convert.py) — đọc phần JSON của GLB, không cần three ===== */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '../../public/car');
const FILE = join(DIR, 'vf3.glb');
const MAX_BYTES = 1_500_000, MAX_TRIS = 45_000;
type Vec = [number, number, number];

function glbJson(file: string): any {
  const b = readFileSync(file);
  assert.equal(b.readUInt32LE(0), 0x46546c67, 'không phải GLB');            // 'glTF'
  const len = b.readUInt32LE(12);
  assert.equal(b.readUInt32LE(16), 0x4e4f534a, 'chunk đầu không phải JSON'); // 'JSON'
  return JSON.parse(b.subarray(20, 20 + len).toString('utf8'));
}

/* Ma trận 4x4 cột-chính của một nút (matrix hoặc TRS) */
function nodeMat(n: any): number[] {
  if (n.matrix) return n.matrix.slice();
  const [x, y, z, w] = n.rotation ?? [0, 0, 0, 1], [sx, sy, sz] = n.scale ?? [1, 1, 1], [tx, ty, tz] = n.translation ?? [0, 0, 0];
  return [
    (1 - 2 * (y * y + z * z)) * sx, (2 * (x * y + z * w)) * sx, (2 * (x * z - y * w)) * sx, 0,
    (2 * (x * y - z * w)) * sy, (1 - 2 * (x * x + z * z)) * sy, (2 * (y * z + x * w)) * sy, 0,
    (2 * (x * z + y * w)) * sz, (2 * (y * z - x * w)) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
    tx, ty, tz, 1];
}
const mul = (a: number[], b: number[]): number[] => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
const apply = (m: number[], p: Vec): Vec => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];

/* Mọi nút có lưới -> hộp bao thế giới của từng primitive */
function worldBoxes(j: any): { node: string; mat: string; tris: number; min: Vec; max: Vec }[] {
  const out: any[] = [];
  const parent = new Map<number, number>();
  j.nodes.forEach((n: any, i: number) => (n.children ?? []).forEach((c: number) => parent.set(c, i)));
  const world = (i: number): number[] => { const m = nodeMat(j.nodes[i]); return parent.has(i) ? mul(world(parent.get(i)!), m) : m; };
  j.nodes.forEach((n: any, i: number) => {
    if (n.mesh === undefined) return;
    const W = world(i);
    for (const p of j.meshes[n.mesh].primitives) {
      const a = j.accessors[p.attributes.POSITION];
      const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
      for (let c = 0; c < 8; c++) {
        const q = apply(W, [c & 1 ? a.max[0] : a.min[0], c & 2 ? a.max[1] : a.min[1], c & 4 ? a.max[2] : a.min[2]]);
        for (let d = 0; d < 3; d++) { mn[d] = Math.min(mn[d], q[d]); mx[d] = Math.max(mx[d], q[d]); }
      }
      out.push({ node: n.name, mat: j.materials[p.material]?.name, tris: j.accessors[p.indices].count / 3, min: mn, max: mx, tex: j.materials[p.material]?.pbrMetallicRoughness?.baseColorTexture });
    }
  });
  return out;
}
const nodeByName = (j: any, name: string): { n: any; i: number } => { const i = j.nodes.findIndex((n: any) => n.name === name); assert.ok(i >= 0, `thiếu nút ${name}`); return { n: j.nodes[i], i }; };
/* Tâm bánh thế giới = gốc của nút (cha là vf3 có thể có biến đổi) */
function wheelCentre(j: any, name: string): Vec {
  const { i } = nodeByName(j, name);
  const parent = new Map<number, number>();
  j.nodes.forEach((n: any, k: number) => (n.children ?? []).forEach((c: number) => parent.set(c, k)));
  const world = (k: number): number[] => { const m = nodeMat(j.nodes[k]); return parent.has(k) ? mul(world(parent.get(k)!), m) : m; };
  return apply(world(i), [0, 0, 0]);
}

test('vf3.glb tồn tại, ≤ 1,5 MB, ≤ 45 000 tam giác', () => {
  assert.ok(existsSync(FILE), 'thiếu public/car/vf3.glb (chạy npm run gen:car)');
  const n = statSync(FILE).size;
  assert.ok(n <= MAX_BYTES, `${n} byte > ${MAX_BYTES}`);
  const tris = worldBoxes(glbJson(FILE)).reduce((s, b) => s + b.tris, 0);
  assert.ok(tris <= MAX_TRIS, `${tris} tam giác > ${MAX_TRIS}`);
});

test('có đủ nút vf3, body, wheel_fl, wheel_fr, wheel_rl, wheel_rr; bốn bánh đúng chỗ', () => {
  const j = glbJson(FILE);
  for (const n of ['vf3', 'body', 'wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr']) nodeByName(j, n);
  const c = Object.fromEntries(['fl', 'fr', 'rl', 'rr'].map(k => [k, wheelCentre(j, 'wheel_' + k)]));
  for (const s of ['l', 'r']) assert.ok(Math.abs(c['f' + s][0] - c['r' + s][0] - 2.075) < 0.15, `chiều dài cơ sở ${s}: ${c['f' + s][0] - c['r' + s][0]}`);
  assert.ok(c.fl[0] > 0 && c.rl[0] < 0, 'bánh trước phải ở +X (mũi xe)');
  assert.ok(Math.abs(c.fl[2] + c.fr[2]) < 0.02 && Math.abs(c.rl[2] + c.rr[2]) < 0.02, 'không đối xứng qua Z');
  assert.ok(c.fl[2] < 0 && c.fr[2] > 0, 'bánh trái (fl) phải ở -Z (trái khi mũi +X, Y lên)');
  assert.ok(c.fl[0] - c.rl[0] > 0 && Math.abs(c.fl[2] - c.fr[2]) > 1.2 && Math.abs(c.fl[2] - c.fr[2]) < 1.9, 'vết bánh ngoài khoảng');
  const bs = worldBoxes(j).filter(b => b.node.startsWith('wheel_'));
  for (const b of bs) assert.ok(b.tris > 0, `${b.node} rỗng`);
  /* bốn nút dùng chung một lưới; bánh phải xoay 180 độ quanh Y (nên bánh phải quay ngược góc, xem convert.py) */
  const w = Object.fromEntries(['fl', 'fr', 'rl', 'rr'].map(k => [k, nodeByName(j, 'wheel_' + k).n]));
  for (const k of ['fr', 'rl', 'rr']) assert.equal(w[k].mesh, w.fl.mesh, `wheel_${k} khác lưới với wheel_fl`);
  const rot = (n: any): number[] => n.rotation ?? [0, 0, 0, 1];
  for (const k of ['fl', 'rl']) assert.ok(rot(w[k]).slice(0, 3).every((x: number) => Math.abs(x) < 1e-3) && Math.abs(Math.abs(rot(w[k])[3]) - 1) < 1e-3, `wheel_${k} không được xoay`);
  for (const k of ['fr', 'rr']) { const q = rot(w[k]); assert.ok(Math.abs(q[0]) < 1e-3 && Math.abs(q[2]) < 1e-3 && Math.abs(Math.abs(q[1]) - 1) < 1e-3 && Math.abs(q[3]) < 1e-3, `wheel_${k} phải xoay 180 độ quanh Y: ${q}`); }
});

test('thân xe ≤ 5 primitive, mesh bánh ≤ 3 primitive (số lệnh vẽ)', () => {
  const j = glbJson(FILE);
  assert.ok(j.meshes[nodeByName(j, 'body').n.mesh].primitives.length <= 5, `body ${j.meshes[nodeByName(j, 'body').n.mesh].primitives.length} primitive`);
  assert.ok(j.meshes[nodeByName(j, 'wheel_fl').n.mesh].primitives.length <= 3, 'mesh bánh > 3 primitive');
});

test('có vật liệu paint, lamp_head, lamp_tail', () => {
  const names: string[] = glbJson(FILE).materials.map((m: any) => m.name);
  for (const n of ['paint', 'lamp_head', 'lamp_tail']) assert.ok(names.includes(n), `thiếu vật liệu ${n}: ${names}`);
  assert.ok(!names.includes('Material.004') && !names.includes('Material.005'), 'còn vật liệu biển số');
});

test('dài 3,19 ± 0,02 m theo X, đáy khung bao y = 0 ± 0,02, mũi +X', () => {
  const bs = worldBoxes(glbJson(FILE));
  const mn = [0, 1, 2].map(d => Math.min(...bs.map(b => b.min[d]))), mx = [0, 1, 2].map(d => Math.max(...bs.map(b => b.max[d])));
  assert.ok(Math.abs(mx[0] - mn[0] - 3.19) < 0.02, `dài ${mx[0] - mn[0]}`);
  assert.ok(Math.abs(mn[1]) < 0.02, `đáy y = ${mn[1]}`);
  assert.ok(mx[1] > 1.4 && mx[1] < 1.9, `cao ${mx[1]}`);
  assert.ok(mx[2] - mn[2] > 1.6 && mx[2] - mn[2] < 2.0, `rộng ${mx[2] - mn[2]}`);
  assert.ok(Math.abs(mx[0] + mn[0]) < 0.4, 'gốc lệch xa khỏi giữa xe');
});

test('không còn biển số: không lưới 12 tam giác có ảnh ở hai đầu xe, không ảnh phình to', () => {
  const j = glbJson(FILE);
  const bs = worldBoxes(j) as any[];
  const hits = bs.filter(b => b.tris === 12 && b.tex && (Math.abs(b.min[0]) > 1.0 || Math.abs(b.max[0]) > 1.0));
  assert.equal(hits.length, 0, 'còn lưới dạng biển số: ' + hits.map(h => h.node + '/' + h.mat));
  for (const im of j.images ?? []) assert.ok(j.bufferViews[im.bufferView].byteLength < 600_000, 'ảnh quá lớn (ảnh biển số cũ ~2 MB?)');
  assert.ok((j.images ?? []).length <= 4, `còn ${j.images?.length} ảnh (nguồn có 6, hai ảnh là biển số)`);
});

test('LICENSE-VF3.txt ghi tác giả, giấy phép, nguồn Sketchfab và các thay đổi', () => {
  const f = join(DIR, 'LICENSE-VF3.txt');
  assert.ok(existsSync(f), 'thiếu LICENSE-VF3.txt');
  const t = readFileSync(f, 'utf8');
  for (const s of ['Hoàng Huy', 'CC-BY-4.0', 'sketchfab.com/3d-models/vinfast-vf3-6a2caea4505347d18c47ef4d47840859', 'biển số', 'bánh']) assert.ok(t.includes(s), `thiếu "${s}"`);
});
