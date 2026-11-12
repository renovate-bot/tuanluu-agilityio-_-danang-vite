"""/* ===== Sinh dữ liệu đám đông người đi bộ dạng người thật (D-032): public/people/crowd.bin + crowd.jpg ===== */

Cách chạy (máy người phát triển, không cần cho build):
    npm run gen:crowd
    # tức: node scripts/people/blender.mjs scripts/people/crowd.py  (chạy Blender nền: -b --python-exit-code 1 --python ...)
    # bỏ ảnh xem trước:  npm run gen:crowd -- -- --no-preview
Đường dẫn Blender: biến môi trường BLENDER (mặc định "C:/Program Files/Blender Foundation/Blender 4.5/blender.exe", xem
scripts/people/blender.mjs). Đã thử: Blender 4.5.10 LTS (Windows).
Dữ liệu hiện tại có 5 đỉnh pháp tuyến dài 0 ở Female_Adult_03, đang được crFixNormals (src/common/people/crowdData.ts) vá lúc
đọc; lần sinh lại sau nên sửa tại nguồn.

Nguồn: Microsoft Rocketbox (MIT), cùng commit ghim với convert.py; FBX / TGA tải vào scripts/people/.cache/ (gitignore).
Dùng lại hàm của convert.py (tải nguồn, sửa vật liệu, gắn + nướng đoạn chuyển động, trừ quãng trôi của hông); không đổi
hành vi convert.py. Spec: docs/superpowers/specs/2026-11-12-dam-dong-nguoi-that-design.md §4.

Mỗi nhân vật: gộp 80 xương còn 22 (KEEP), 2 xương mỗi đỉnh, tư thế ngón tay (khung đầu của walk) nướng vào lưới, bỏ mảnh
opacity (tóc mảnh, lông mi), giản lược còn ≤ TRI_TARGET tam giác có bảo vệ vùng đầu (nhóm đỉnh của Decimate), một ô atlas
CELL² (thân, đầu, ô màu nón lá), thêm bản đội nón lá (nón HAT_SIDES cạnh gắn cứng xương đầu; người lớn).
Chuyển động: walk / idle / photo 15 khung/giây, jog 30; idle ≈ 3 s; ma trận xương 3×4 (từ tư thế nghỉ sang tư thế khung,
hệ three: mét, +Y lên, mặt +X, chân y = 0) lưu half-float.

Định dạng crowd.bin (little-endian), phiên bản 1:
    0   4 byte  'DNCR'
    4   u32     phiên bản (1)
    8   u32     J = số byte phần JSON (đã đệm dấu cách tới bội 4)
    12  J byte  JSON utf-8: { bones, boneNames, anim: {width, height, offset, bytes}, source,
                chars: [{ id, child, female, height, verts, tris, hatVerts, hatTris,
                          pos, nrm, uv, bones, w, idx,      <- offset (byte, tính từ đầu khối nhị phân) từng mảng
                          clips: { walk|jog|idle|photo: { row, frames, fps, loop, speed } } }] }
    12+J        khối nhị phân, mỗi mảng bắt đầu ở bội 4:
                pos f32 ×3, nrm f32 ×3, uv f32 ×2 (v = 0 ở mép TRÊN của crowd.jpg, dùng texture.flipY = false),
                bones u8 ×2 (chỉ số trong boneNames), w f32 ×1 (trọng số xương thứ nhất, xương thứ hai 1 − w),
                idx u16 ×3 mỗi tam giác. Đỉnh 0..verts−1 / tam giác 0..tris−1 là người; hatVerts / hatTris nối tiếp là nón
                (index của nón trỏ vào mảng đỉnh chung). Bản đội nón = toàn bộ mảng.
                anim: u16 (half-float) RGBA, width = bones × 3 texel, mỗi hàng một khung; texel (b × 3 + j) = hàng j của ma
                trận 3×4 xương b. Đoạn của nhân vật = các hàng row .. row + frames − 1.
Tốc độ tự nhiên speed (m/s, tỉ lệ 1) tính cho nhịp fps ghi trong tệp (đã bù chỗ làm tròn số khung).

Cuối script in bảng (tam giác, đỉnh, cao, tốc độ, byte) và xuất ảnh xem trước dựng lại từ chính dữ liệu đã ghi (skinning
2 xương, ma trận half-float, atlas JPEG) vào scripts/people/.cache/preview-crowd/<k>_<tên>.jpg.
"""
import bpy, os, sys, math, json, struct, importlib.util
import numpy as np
from mathutils import Matrix, Vector

# ===== Đường dẫn; nạp convert.py làm thư viện (khối chạy của nó nằm sau if __name__ == '__main__') =====
HERE = os.path.dirname(os.path.abspath(__file__))
sys.dont_write_bytecode = True                                          # không để __pycache__ lại trong scripts/people/
_spec = importlib.util.spec_from_file_location('rb_convert', os.path.join(HERE, 'convert.py'))
cv = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(cv)
OUT = cv.OUT
PREV = os.path.join(cv.CACHE, 'preview-crowd')

# ===== Bảng nhân vật: (tên Rocketbox, mã texture, bộ chuyển động m/f, trẻ em) =====
CHARS = [
    ('Male_Adult_10', 'm024', 'm', False),      # 5 người của D-030
    ('Female_Adult_12', 'f012', 'f', False),
    ('Male_Adult_01', 'm002', 'm', False),
    ('Female_Adult_03', 'f003', 'f', False),
    ('Male_Adult_17', 'm022', 'm', False),
    ('Male_Adult_09', 'm017', 'm', False),      # nam tóc dài buộc, áo phông đen, quần jean sáng
    ('Female_Adult_17', 'f006', 'f', False),    # nữ tóc vàng búi, áo phông xanh lá, quần jean sáng
    ('Female_Adult_08', 'f008', 'f', False),    # nữ tóc nâu dài, áo phông xám, quần jean
    ('Male_Child_01', 'cm001', 'm', True),      # bé trai áo len xanh dương, quần jean (bộ xương Bip02, cao 1,43 m)
    ('Female_Child_01', 'cf001', 'f', True),    # bé gái tóc vàng đuôi ngựa, áo hồng, quần jean
]
# ===== Đoạn: tên -> (mục trong cv.CLIPS, khung/giây nướng, lặp) =====
CLIPS = {'walk': ('walk', 15, True), 'jog': ('jog', 30, True), 'idle': ('idle', 15, True), 'photo': ('photo', 15, False)}
KEEP = ['Bip01 Pelvis', 'Bip01 Spine', 'Bip01 Spine1', 'Bip01 Spine2', 'Bip01 Neck', 'Bip01 Head']
for _s in 'LR':
    KEEP += [f'Bip01 {_s} {b}' for b in ('Clavicle', 'UpperArm', 'Forearm', 'Hand', 'Thigh', 'Calf', 'Foot', 'Toe0')]
HEAD = KEEP.index('Bip01 Head')
IDLE_LEN = (2.6, 3.4)       # s, khoảng tìm độ dài vòng lặp idle (đích ~3 s, spec §4.5)
TRI_TARGET = 1500           # tam giác mỗi người (trần 1 600, spec §4.3)
HEAD_KEEP = 0.15            # trọng số nhóm đỉnh Decimate cho vùng đầu (thấp = giữ lại nhiều hơn), thân 1,0
MOUTH_KEEP = 0.02           # trọng số cho vùng miệng (xương hàm, lưỡi, môi, khoé miệng): giản lược mạnh làm răng / lưỡi lòi ra thành vệt xám
MOUTH = ('MJaw', 'MTongue', 'Lip', 'lip', 'Mouth')   # mảnh tên xương Rocketbox của vùng miệng
ARM_KEEP = 0.5             # trọng số cho cẳng tay + bàn tay: giữ đủ đỉnh quanh khuỷu để tay gập (chụp ảnh, chạy) không thành hình quạt
CELL = 384                  # px, cạnh ô atlas mỗi nhân vật (spec §4.7)
COLS = 5                    # số ô atlas mỗi hàng
# vùng trong ô (theo uv gốc dưới-trái của ô): thân, đầu, ô màu nón lá (x, y, rộng, cao, phần của ô)
REG = {'body': (0, 0, 0.75, 1), 'head': (0.75, 0.5, 0.25, 0.5), 'hat': (0.75, 0, 0.25, 0.5)}
JPEG_Q = 85                 # chất lượng JPEG atlas
HAT = dict(sides=10, r=0.21, h=0.17, drop=0.075, color=(0.86, 0.79, 0.60))   # nón lá: cạnh, bán kính vành m, cao m, vành thấp hơn đỉnh đầu m, màu sRGB (ước lượng)
CAP_BIN, CAP_JPG, CAP_ALL = 1_100_000, 400_000, 1_500_000
C = Matrix(((1, 0, 0, 0), (0, 0, 1, 0), (0, -1, 0, 0), (0, 0, 0, 1)))   # Blender Z lên -> three Y lên
Ci = C.inverted()
NO_PREVIEW = '--no-preview' in cv.ARGV


# ===== Tải nguồn: người lớn ở Assets/Avatars/Adults, trẻ em ở Assets/Avatars/Children (không có ảnh opacity) =====
def fetch_char(name, code, child):
    d = os.path.join(cv.CACHE, 'src', name); grp = 'Children' if child else 'Adults'
    fbx = cv.fetch(f'Assets/Avatars/{grp}/{name}/Export/{name}.fbx', os.path.join(d, name + '.fbx'))
    for t in ('body_color', 'head_color') + (() if child else ('opacity_color',)):
        cv.fetch(f'Assets/Avatars/{grp}/{name}/Textures/{code}_{t}.tga', os.path.join(d, f'{code}_{t}.tga'))
    return fbx


def set_action(arm, act):
    for t in arm.animation_data.nla_tracks: t.mute = True
    arm.animation_data.action = act
    if hasattr(act, 'slots') and len(act.slots): arm.animation_data.action_slot = act.slots[0]


def set_time(sc, fr):
    i = math.floor(fr); sc.frame_set(i, subframe=fr - i); bpy.context.view_layer.update()


def bone_mats(arm):
    """Ma trận 3×4 (hệ three) đưa đỉnh từ tư thế nghỉ sang tư thế hiện tại, cho 22 xương giữ lại."""
    A = arm.matrix_world; Ai = A.inverted(); out = []
    for b in KEEP:
        pb = arm.pose.bones[b]
        F = C @ A @ pb.matrix @ pb.bone.matrix_local.inverted() @ Ai @ Ci
        out.append([F[r][c] for r in range(3) for c in range(4)])
    return np.array(out, dtype=np.float64)


def kept_index(arm, name):
    """Xương giữ lại gần nhất tính từ xương name đi lên cha (xương mặt -> đầu, ngón -> bàn tay); không có -> hông."""
    b = arm.data.bones.get(name)
    while b is not None and b.name not in KEEP: b = b.parent
    return KEEP.index(b.name) if b is not None else 0


def posed_verts(obj):
    dg = bpy.context.evaluated_depsgraph_get(); e = obj.evaluated_get(dg); m = e.to_mesh()
    M = C @ obj.matrix_world; out = np.array([(M @ v.co)[:] for v in m.vertices]); e.to_mesh_clear(); return out


def top2(W):
    idx = np.argsort(-W, axis=1)[:, :2]; w = np.take_along_axis(W, idx, 1); s = w.sum(1, keepdims=True); s[s == 0] = 1
    return idx, w / s


# ===== Một nhân vật: nhập, gắn 4 đoạn, nướng ma trận xương, gộp xương, giản lược, xuất mảng =====
def build(k):
    name, code, sex, child = CHARS[k]
    print(f'== {k}: {name} ({sex}{", trẻ em" if child else ""})')
    fbx = fetch_char(name, code, child)
    src_clips = {c[0]: c for c in cv.CLIPS}
    clips = [(src_clips[CLIPS[n][0]],) + cv.fetch_clip(sex, src_clips[CLIPS[n][0]]) for n in ('idle', 'walk', 'jog', 'photo')]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene; sc.render.fps = cv.FPS; sc.render.fps_base = 1
    bpy.ops.import_scene.fbx(filepath=fbx)
    arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    obj = next(o for o in bpy.data.objects if o.type == 'MESH')
    for b in arm.data.bones:   # trẻ em Rocketbox dùng bộ xương "Bip02": đổi tên cho khớp đoạn chuyển động (nhóm đỉnh đổi theo)
        if b.name.startswith('Bip02'): b.name = 'Bip01' + b.name[5:]
    arm.animation_data_clear(); arm.animation_data_create()
    for a in list(bpy.data.actions): bpy.data.actions.remove(a)
    log = []; cv.fix_materials(log)
    face = cv.descendants(arm, 'Bip01 Head'); keep = {b.name for b in arm.data.bones if b.name not in face}
    base = set(bpy.data.objects); info = {}
    for c, path, _ in clips: cv.add_clip(sc, arm, base, c, path, keep, info, rot_only=child)
    arm.rotation_euler.z += math.pi / 2; bpy.context.view_layer.update()   # mặt -Y của Rocketbox -> +X
    # ---- tư thế nghỉ (hệ three) ----
    arm.data.pose_position = 'REST'; bpy.context.view_layer.update()
    rest = posed_verts(obj); arm.data.pose_position = 'POSE'; bpy.context.view_layer.update()
    n = len(rest)
    # ---- nướng ma trận xương theo đoạn ----
    anim = {}
    for nm, (_, fps, loop) in CLIPS.items():
        act = bpy.data.actions[nm]; set_action(arm, act)
        f0, f1 = act.frame_range; dur = (f1 - f0) / cv.FPS
        N = max(2, round(dur * fps)); cnt = N if loop else N + 1
        rows = []
        for i in range(cnt): set_time(sc, f0 + (f1 - f0) * i / N); rows.append(bone_mats(arm))
        speed = info[nm]['speed'] * dur * fps / N if nm in ('walk', 'jog') else 0.0   # bù làm tròn: chu kỳ phát = N / fps
        anim[nm] = dict(rows=np.array(rows), fps=fps, loop=loop, speed=round(speed, 4), dur=dur, note=info[nm]['note'])
    # ---- gộp trọng số 80 -> 22 xương ----
    me = obj.data; vg = {g.index: g.name for g in obj.vertex_groups}
    W = np.zeros((n, len(KEEP))); hand_only = np.zeros(n, bool); hand_of = np.full(n, -1); mouth = np.zeros(n, bool)
    hands = {s: {f'Bip01 {s} Hand'} | {b.name for b in arm.data.bones if b.name.startswith(f'Bip01 {s} Finger')} for s in 'LR'}
    for v in me.vertices:
        names = [(vg[g.group], g.weight) for g in v.groups if g.weight > 0 and g.group in vg]
        for nm, w in names: W[v.index, kept_index(arm, nm)] += w
        if sum(w for nm, w in names if any(t in nm for t in MOUTH)) > 0.3: mouth[v.index] = True
        for s in 'LR':
            if names and all(nm in hands[s] for nm, _ in names): hand_only[v.index] = True; hand_of[v.index] = KEEP.index(f'Bip01 {s} Hand')
    # ---- nướng tư thế ngón tay (khung đầu của walk) vào lưới: xương ngón đã gộp vào bàn tay ----
    set_action(arm, bpy.data.actions['walk']); set_time(sc, bpy.data.actions['walk'].frame_range[0])
    posed = posed_verts(obj); Mk = bone_mats(arm).reshape(-1, 3, 4); rest_new = rest.copy()
    for i in np.nonzero(hand_only)[0]:
        M = np.vstack([Mk[hand_of[i]], [0, 0, 0, 1]]); rest_new[i] = (np.linalg.inv(M) @ np.r_[posed[i], 1])[:3]
    # ---- tư thế đặt chân: chân thấp nhất mỗi đoạn (kiểm, không sửa) ----
    foot = {}
    for nm, a in anim.items():
        P4 = np.c_[rest_new, np.ones(n)]; idx, w = top2(W); lo = []
        for Mf in a['rows'][:: max(1, len(a['rows']) // 6)]:
            Mr = Mf.reshape(-1, 3, 4); p = np.einsum('nij,nj->ni', Mr[idx[:, 0]], P4) * w[:, :1] + np.einsum('nij,nj->ni', Mr[idx[:, 1]], P4) * w[:, 1:]
            lo.append(p[:, 1].min())
        foot[nm] = (round(float(min(lo)), 3), round(float(max(lo)), 3))
    # ---- lưới mới: tư thế nghỉ đã nướng ngón, 22 nhóm đỉnh, bỏ mảnh opacity ----
    roles = ['alpha' if 'opacity' in m.name.lower() else 'head' if 'head' in m.name.lower() else 'body' for m in me.materials]
    obj.modifiers.clear(); obj.parent = None; obj.matrix_world = Matrix.Identity(4)
    for v in me.vertices: v.co = Ci @ Vector(rest_new[v.index])
    for g in list(obj.vertex_groups): obj.vertex_groups.remove(g)
    groups = [obj.vertex_groups.new(name=b) for b in KEEP]
    for i in range(n):
        for j in range(len(KEEP)):
            if W[i, j] > 1e-4: groups[j].add([i], float(W[i, j]), 'REPLACE')
    obj.vertex_groups.new(name='mouth').add([int(i) for i in np.nonzero(mouth)[0]], 1.0, 'REPLACE')   # đi theo đỉnh khi xóa mặt
    for o in [o for o in bpy.data.objects if o != obj]: bpy.data.objects.remove(o, do_unlink=True)
    import bmesh
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if roles[f.material_index] == 'alpha'], context='FACES')
    bm.to_mesh(me); bm.free()
    full_tris = sum(len(p.vertices) - 2 for p in me.polygons)
    # ---- giản lược có bảo vệ vùng đầu: tìm tỉ lệ lớn nhất cho ≤ TRI_TARGET ----
    vgp = obj.vertex_groups.new(name='dec'); hv = {v for p in me.polygons if roles[p.material_index] == 'head' for v in p.vertices}
    arm_g = {g.index for g in obj.vertex_groups if g.name.split(' ', 2)[-1] in ('Forearm', 'Hand')}
    mouth_g = obj.vertex_groups['mouth'].index
    for v in me.vertices:
        fa = sum(g.weight for g in v.groups if g.group in arm_g); mo = any(g.group == mouth_g for g in v.groups)
        vgp.add([v.index], MOUTH_KEEP if mo else HEAD_KEEP if v.index in hv else ARM_KEEP if fa > 0.3 else 1.0, 'REPLACE')
    md = obj.modifiers.new('dec', 'DECIMATE'); md.decimate_type = 'COLLAPSE'; md.use_collapse_triangulate = True
    md.vertex_group = 'dec'; md.vertex_group_factor = 4.0
    lo, hi = 0.0, 1.0
    for _ in range(16):
        md.ratio = (lo + hi) / 2; dg = bpy.context.evaluated_depsgraph_get(); e = obj.evaluated_get(dg); mm = e.to_mesh(); mm.calc_loop_triangles(); nt = len(mm.loop_triangles); e.to_mesh_clear()
        if nt > TRI_TARGET: hi = md.ratio
        else: lo = md.ratio
    md.ratio = lo
    bpy.context.view_layer.objects.active = obj; obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier='dec')
    if me.has_custom_normals:
        with bpy.context.temp_override(object=obj, active_object=obj): bpy.ops.mesh.customdata_custom_splitnormals_clear()
    me.shade_smooth(); me.calc_loop_triangles()
    # ---- mảng đỉnh (tách theo uv + vật liệu) ----
    gname = {g.index: KEEP.index(g.name) for g in obj.vertex_groups if g.name in KEEP}
    vW = np.zeros((len(me.vertices), len(KEEP)))
    for v in me.vertices:
        for g in v.groups:
            if g.group in gname: vW[v.index, gname[g.group]] += g.weight
    vi, vw = top2(vW)
    uvl = me.uv_layers.active.data; cn = me.corner_normals
    keymap = {}; P = []; Nn = []; U = []; B = []; Wt = []; R = []; I = []
    for t in me.loop_triangles:
        for li, vix in zip(t.loops, t.vertices):
            uv = uvl[li].uv; key = (vix, round(uv[0], 5), round(uv[1], 5), t.material_index)
            j = keymap.get(key)
            if j is None:
                j = keymap[key] = len(P)
                P.append((C @ me.vertices[vix].co)[:]); Nn.append((C.to_3x3() @ cn[li].vector).normalized()[:])
                U.append((uv[0], uv[1])); B.append(vi[vix]); Wt.append(vw[vix, 0]); R.append(roles[t.material_index])
            I.append(j)
    P = np.array(P, np.float32); Nn = np.array(Nn, np.float32); U = np.array(U, np.float64)
    B = np.array(B, np.uint8); Wt = np.array(Wt, np.float32); I = np.array(I, np.uint32)
    # uv trong ô: vùng theo vật liệu; uv lặp ngoài [0, 1] đưa về [0, 1]
    U = np.where((U < 0) | (U > 1), U - np.floor(U), U)
    reg = np.array([REG[r] for r in R]); U = np.c_[reg[:, 0] + U[:, 0] * reg[:, 2], reg[:, 1] + U[:, 1] * reg[:, 3]]
    height = float(P[:, 1].max())
    print(f'  {full_tris} -> {len(I) // 3} tam giác, {len(P)} đỉnh, cao {height:.3f} m, chân thấp nhất {P[:, 1].min():.3f} m, tay nướng lại {int(hand_only.sum())} đỉnh')
    for nm, a in anim.items(): print(f"  {nm:5s} {len(a['rows'])} khung @{a['fps']} ({a['dur']:.2f} s) speed {a['speed']} m/s, chân thấp nhất {foot[nm]} m; {a['note']}")
    return dict(id=name, female=sex == 'f', child=child, height=height, P=P, N=Nn, U=U, B=B, W=Wt, I=I, anim=anim,
                full_tris=full_tris, foot=foot)


# ===== Nón lá: nón HAT_SIDES cạnh, mặt ngoài + mặt trong, gắn cứng xương đầu =====
def hat_mesh(ch):
    P, B, W = ch['P'], ch['B'], ch['W']
    hm = (B[:, 0] == HEAD) & (W > 0.5); top = float(P[hm, 1].max())
    cap = hm & (P[:, 1] > top - 0.1); cx, cz = float(P[cap, 0].mean()), float(P[cap, 2].mean())
    yb = top - HAT['drop']; n = HAT['sides']; r, h = HAT['r'], HAT['h']
    ring = np.array([(cx + r * math.cos(2 * math.pi * i / n), yb, cz + r * math.sin(2 * math.pi * i / n)) for i in range(n)])
    pos, nrm, idx = [], [], []
    for inner in (False, True):
        ap = np.array((cx, yb + h - (0.03 if inner else 0), cz)); dy = -0.004 if inner else 0.0
        for i in range(n):
            a, b = ring[i] + (0, dy, 0), ring[(i + 1) % n] + (0, dy, 0)
            fn = np.cross(b - ap, a - ap); fn /= np.linalg.norm(fn)
            out = (a + b) / 2 - np.array((cx, (a[1] + b[1]) / 2, cz))
            if (np.dot(fn, out) < 0) != inner: fn = -fn       # mặt ngoài hướng ra, mặt trong hướng vào / xuống
            tri = [ap, a, b]
            if np.dot(np.cross(tri[1] - tri[0], tri[2] - tri[0]), fn) < 0: tri = [ap, b, a]   # thứ tự ngược chiều kim đồng hồ khi nhìn từ phía mặt
            o = len(pos); pos += tri; nrm += [fn] * 3; idx += [o, o + 1, o + 2]
    return np.array(pos, np.float32), np.array(nrm, np.float32), np.array(idx, np.uint32)


# ===== Atlas: COLS × hàng ô CELL², thân + đầu thu nhỏ, ô màu nón =====
def make_atlas(chars):
    rows = (len(chars) + COLS - 1) // COLS; Wd, Ht = COLS * CELL, rows * CELL
    px = np.ones((Ht, Wd, 4), np.float32)          # gốc dưới-trái như Blender
    rects = []
    for k, ch in enumerate(chars):
        cx, cy = (k % COLS) * CELL, (rows - 1 - k // COLS) * CELL      # ô k đếm từ trên xuống trong ảnh
        rects.append((cx / Wd, cy / Ht, CELL / Wd, CELL / Ht))
        for role, (rx, ry, rw, rh) in REG.items():
            x0, y0, w, h = cx + int(rx * CELL), cy + int(ry * CELL), int(rw * CELL), int(rh * CELL)
            if role == 'hat': px[y0:y0 + h, x0:x0 + w, :3] = HAT['color']; continue
            im = ch['imgs'].get(role)
            if im is None: px[y0:y0 + h, x0:x0 + w, :3] = 0.5; continue
            c = im.copy(); c.scale(w, h); a = np.empty(w * h * 4, np.float32); c.pixels.foreach_get(a)
            px[y0:y0 + h, x0:x0 + w] = a.reshape(h, w, 4); bpy.data.images.remove(c)
    px[..., 3] = 1
    img = bpy.data.images.new('crowd_atlas', Wd, Ht, alpha=False); img.pixels.foreach_set(px.ravel())
    path = os.path.join(OUT, 'crowd.jpg'); img.filepath_raw = path; img.file_format = 'JPEG'
    q = JPEG_Q
    while True:
        img.save(filepath=path, quality=q)
        if os.path.getsize(path) <= CAP_JPG - 20_000 or q <= 60: break
        q -= 5
    return rects, (Wd, Ht), q


# ===== Ghi crowd.bin =====
def write_bin(chars, rects):
    blob = bytearray(); meta = []; anim_rows = []; row = 0

    def put(arr):
        while len(blob) % 4: blob.append(0)
        o = len(blob); blob.extend(np.ascontiguousarray(arr).tobytes()); return o
    for ch, rect in zip(chars, rects):
        P, N, U, B, W, I = ch['P'], ch['N'], ch['U'], ch['B'], ch['W'], ch['I']
        nv, nt = len(P), len(I) // 3
        hv = ht = 0
        if not ch['child']:
            hp, hn, hi = hat_mesh(ch); hc = REG['hat']; hv, ht = len(hp), len(hi) // 3
            P = np.r_[P, hp]; N = np.r_[N, hn]; U = np.r_[U, np.tile((hc[0] + hc[2] / 2, hc[1] + hc[3] / 2), (hv, 1))]
            B = np.r_[B, np.full((hv, 2), HEAD, np.uint8)]; W = np.r_[W, np.ones(hv, np.float32)]; I = np.r_[I, hi + nv]
        UA = np.c_[rect[0] + U[:, 0] * rect[2], 1 - (rect[1] + U[:, 1] * rect[3])]      # v = 0 ở mép trên ảnh
        assert len(P) < 65536
        m = dict(id=ch['id'], child=ch['child'], female=ch['female'], height=round(ch['height'], 4), verts=nv, tris=nt, hatVerts=hv, hatTris=ht,
                 pos=put(P.astype('<f4')), nrm=put(N.astype('<f4')), uv=put(np.clip(UA, 0, 1).astype('<f4')), bones=put(B.astype(np.uint8)),
                 w=put(np.clip(W, 0, 1).astype('<f4')), idx=put(I.astype('<u2')), clips={})
        for nm, a in ch['anim'].items():
            m['clips'][nm] = dict(row=row, frames=len(a['rows']), fps=a['fps'], loop=a['loop'], speed=a['speed'])
            anim_rows.append(a['rows']); row += len(a['rows'])
        meta.append(m); ch['hatVerts'] = hv; ch['hatTris'] = ht; ch['UA'] = UA; ch['Pall'] = P; ch['Ball'] = B; ch['Wall'] = W; ch['Iall'] = I
    A = np.concatenate(anim_rows).astype('<f2')          # (hàng, 22, 12)
    ao = put(A)
    head = dict(bones=len(KEEP), boneNames=KEEP, anim=dict(width=len(KEEP) * 3, height=int(A.shape[0]), offset=ao, bytes=A.nbytes),
                source=f'Microsoft Rocketbox (MIT), commit {cv.COMMIT}', chars=meta)
    js = json.dumps(head, separators=(',', ':'), ensure_ascii=False).encode('utf8'); js += b' ' * ((4 - len(js) % 4) % 4)
    path = os.path.join(OUT, 'crowd.bin')
    with open(path, 'wb') as f: f.write(b'DNCR' + struct.pack('<II', 1, len(js)) + js + bytes(blob))
    return A, head


# ===== Ảnh xem trước: dựng lại từ dữ liệu đã ghi (half-float, 2 xương, atlas JPEG) =====
def preview(chars, A, head):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene; sc.render.engine = 'BLENDER_EEVEE_NEXT'; sc.view_settings.view_transform = 'Standard'
    PW, PH = 240, 360; sc.render.resolution_x, sc.render.resolution_y = PW, PH
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (0.6, 0.65, 0.72, 1)
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sun.data.energy = 3
    sun.rotation_euler = (math.radians(50), 0, math.radians(60)); sc.collection.objects.link(sun)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
    atlas = bpy.data.images.load(os.path.join(OUT, 'crowd.jpg'))
    mat = bpy.data.materials.new('m'); mat.use_nodes = True; nt = mat.node_tree; bsdf = nt.nodes['Principled BSDF']
    tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = atlas; nt.links.new(tx.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.8
    A3 = A.astype(np.float64).reshape(A.shape[0], -1, 3, 4)
    os.makedirs(PREV, exist_ok=True); tmp = os.path.join(PREV, 'tmp'); os.makedirs(tmp, exist_ok=True); outs = []
    for k, (ch, m) in enumerate(zip(chars, head['chars'])):
        cl = m['clips']; nv = ch['Pall'].shape[0] if not ch['child'] else m['verts']
        hat_ok = not ch['child']
        shots = [('walk', 0, False), ('walk', cl['walk']['frames'] // 2, False), ('jog', cl['jog']['frames'] // 4, False), ('idle', 0, False),
                 ('photo', cl['photo']['frames'] - 1, False), ('walk', cl['walk']['frames'] // 4, hat_ok), ('face', 0, False), ('face', 0, hat_ok)]
        files = []
        for si, (nm, fr, hat) in enumerate(shots):
            nvx = nv if hat else m['verts']; ntx = (m['tris'] + m['hatTris']) if hat else m['tris']
            P = ch['Pall'][:nvx].astype(np.float64); Bi = ch['Ball'][:nvx]; Wv = ch['Wall'][:nvx].astype(np.float64)[:, None]
            if nm != 'face':
                Mr = A3[cl[nm]['row'] + fr]; P4 = np.c_[P, np.ones(len(P))]
                P = np.einsum('nij,nj->ni', Mr[Bi[:, 0]], P4) * Wv + np.einsum('nij,nj->ni', Mr[Bi[:, 1]], P4) * (1 - Wv)
            me = bpy.data.meshes.new('p'); Pb = np.c_[P[:, 0], -P[:, 2], P[:, 1]]
            tris = ch['Iall'][:ntx * 3].reshape(-1, 3)
            me.from_pydata(Pb.tolist(), [], tris.tolist()); me.materials.append(mat)
            uvl = me.uv_layers.new(); UA = ch['UA']
            for li, lp in enumerate(me.loops): u = UA[lp.vertex_index]; uvl.data[li].uv = (u[0], 1 - u[1])
            me.shade_smooth(); ob = bpy.data.objects.new('p', me); sc.collection.objects.link(ob)
            if nm == 'face':
                hz = ch['height'] - 0.12; c = Vector((0, 0, hz)); cam.location = c + Vector((0.75, -0.35, 0.05)); cam.data.lens = 85
            else:
                c = Vector((0, 0, ch['height'] * 0.52)); cam.location = c + Vector((3.4, -2.6, 0.35)); cam.data.lens = 75
            cam.rotation_euler = (c - cam.location).to_track_quat('-Z', 'Y').to_euler()
            fp = os.path.join(tmp, f'{k}_{si}.png'); sc.render.filepath = fp; bpy.ops.render.render(write_still=True); files.append(fp)
            bpy.data.objects.remove(ob, do_unlink=True); bpy.data.meshes.remove(me)
        sheet = np.zeros((PH, len(files) * PW, 4), np.float32)
        for i, fp in enumerate(files):
            im = bpy.data.images.load(fp); a = np.empty(PW * PH * 4, np.float32); im.pixels.foreach_get(a)
            sheet[:, i * PW:(i + 1) * PW] = a.reshape(PH, PW, 4); bpy.data.images.remove(im); os.remove(fp)
        out = bpy.data.images.new(f's{k}', len(files) * PW, PH, alpha=False); out.pixels.foreach_set(sheet.ravel())
        out.filepath_raw = os.path.join(PREV, f'{k}_{ch["id"]}.jpg'); out.file_format = 'JPEG'; out.save(quality=85); outs.append(out.filepath_raw)
    return outs


def write_license():
    """Thêm (hoặc thay) một dòng ghi nguồn đám đông sau dòng Commit của LICENSE-Rocketbox.txt (convert.py viết phần đầu)."""
    path = os.path.join(OUT, 'LICENSE-Rocketbox.txt'); mark = 'Đám đông người đi bộ / Crowd:'
    lines = [l for l in open(path, encoding='utf8').read().split('\n') if not l.startswith(mark)]
    lines.insert(2, f'{mark} crowd.bin + crowd.jpg chuyển đổi bằng scripts/people/crowd.py (giản lược lưới, gộp xương, nướng chuyển động); '
                    f'nhân vật: {", ".join(c[0] for c in CHARS)}')
    with open(path, 'w', encoding='utf8', newline='\n') as f: f.write('\n'.join(lines))


# ===== Chạy =====
cv.IDLE_LEN = IDLE_LEN
chars = [build(k) for k in range(len(CHARS))]
bpy.ops.wm.read_factory_settings(use_empty=True)
# ảnh nguồn mất khi đặt lại cảnh: nạp lại texture màu gốc từ .cache (make_atlas thu nhỏ thẳng về cỡ ô)
for ch, (name, code, sex, child) in zip(chars, CHARS):
    d = os.path.join(cv.CACHE, 'src', name); ch['imgs'] = {}
    for role in ('body', 'head'):
        ch['imgs'][role] = bpy.data.images.load(os.path.join(d, f'{code}_{role}_color.tga'))
rects, asize, q = make_atlas(chars)
A, head = write_bin(chars, rects)
write_license()
pv = [] if NO_PREVIEW else preview(chars, A, head)
bsz, jsz = os.path.getsize(os.path.join(OUT, 'crowd.bin')), os.path.getsize(os.path.join(OUT, 'crowd.jpg'))
print('\n===== KẾT QUẢ =====')
for ch, m in zip(chars, head['chars']):
    sp = {nm: c['speed'] for nm, c in m['clips'].items() if c['speed']}
    print(f"{m['id']:16s} {'nữ' if m['female'] else 'nam'} {'trẻ em' if m['child'] else 'người lớn'}  {ch['full_tris']} -> {m['tris']} tam giác (+{m['hatTris']} nón), {m['verts']} đỉnh (+{m['hatVerts']}), cao {m['height']:.3f} m, tốc độ {sp}, chân {ch['foot']}")
print(f"texture chuyển động {head['anim']['width']} × {head['anim']['height']} (half RGBA, {head['anim']['bytes']} B); atlas {asize[0]} × {asize[1]} JPEG q{q}")
print(f'crowd.bin {bsz} B (trần {CAP_BIN}), crowd.jpg {jsz} B (trần {CAP_JPG}), tổng {bsz + jsz} B (trần {CAP_ALL})')
for p in pv: print('ảnh xem trước:', p)
assert bsz <= CAP_BIN and jsz <= CAP_JPG and bsz + jsz <= CAP_ALL, 'vượt trần dung lượng'
