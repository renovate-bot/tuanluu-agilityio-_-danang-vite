"""/* ===== Chuyển nhân vật Microsoft Rocketbox (FBX + TGA) sang public/people/p0..p4.glb cho chế độ Đi dạo ===== */

Cách chạy (máy người phát triển, không cần cho build):
    npm run gen:people
    # tức: "C:/Program Files/Blender Foundation/Blender 4.5/blender.exe" -b --python scripts/people/convert.py
    # chỉ làm một số nhân vật / bỏ ảnh xem trước:  ... --python scripts/people/convert.py -- 0 3 --no-preview
Máy khác: sửa đường dẫn Blender trong package.json ("gen:people"). Đã thử: Blender 4.5.10 LTS (Windows).

Nguồn: https://github.com/microsoft/Microsoft-Rocketbox (giấy phép MIT), commit ghim COMMIT bên dưới.
File nguồn (FBX, TGA) tải vào scripts/people/.cache/ (đã gitignore, bỏ qua file đã có); chỉ commit .glb + LICENSE-Rocketbox.txt.

Nhân vật (spec 2026-11-12-nguoi-di-dao-that-design.md §4):
    p0  Male_Adult_10    nam trẻ nét Á, áo khoác thể thao đỏ (nhân vật chính)   bộ chuyển động nam
    p1  Female_Adult_12  nữ trẻ, hoodie đen, quần lửng                          nữ
    p2  Male_Adult_01    nam, áo polo kẻ, quần soóc (khách du lịch)              nam
    p3  Female_Adult_03  nữ trẻ nét Á, tóc đen ngắn, áo hai dây tím              nữ
    p4  Male_Adult_17    nam, hoodie xanh trắng, mũ, quần jean                   nam
Đoạn (§5), tên trong glb: idle (đứng thở, cắt ~6 s cho khớp vòng lặp), walk, jog, sprint (chạy tại chỗ, trừ quãng trôi
của hông; tốc độ tự nhiên ghi vào animations[i].extras.speed, m/s), photo (chỉ phần giơ máy, ≤ 0,8 s, hết ở tư thế máy
trước mặt). Kết quả: mặt hướng +X, đứng +Y, chân ở y = 0, mét; scenes[0].extras.height = chiều cao tư thế đứng (m).

Cuối script in bảng (tam giác, xương, byte, thời lượng, speed) và xuất ảnh kiểm tra (nạp lại chính file glb vừa xuất)
vào scripts/people/.cache/preview/p<k>.jpg: mỗi hàng một đoạn, 4 khung.
"""
import bpy, os, sys, math, json, struct, urllib.request, urllib.error
import numpy as np
from mathutils import Vector

# ===== Đường dẫn, nguồn =====
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, '..', '..'))
CACHE = os.path.join(HERE, '.cache')
OUT = os.path.join(REPO, 'public', 'people')
PREV = os.path.join(CACHE, 'preview')
COMMIT = '0943055db6ec570bcef9f2c8b41c9e5467c808f9'                     # commit Rocketbox ghim (master 2026-11-12)
RAW = f'https://raw.githubusercontent.com/microsoft/Microsoft-Rocketbox/{COMMIT}/'

# ===== Bảng nhân vật: (tên Rocketbox, mã texture, bộ chuyển động) =====
CHARS = [
    ('Male_Adult_10', 'm024', 'm'),
    ('Female_Adult_12', 'f012', 'f'),
    ('Male_Adult_01', 'm002', 'm'),
    ('Female_Adult_03', 'f003', 'f'),
    ('Male_Adult_17', 'm022', 'm'),
]
# ===== Bảng đoạn: tên trong glb -> (thư mục nguồn, tên file không tiền tố giới, loại) =====
CLIPS = [
    ('idle', 'static', 'idle_neutral_01', 'idle'),
    ('walk', 'xy', 'walk_cool_01', 'loco'),     # nữ dùng walk_neutral_01 (xem CLIP_F)
    ('jog', 'xy', 'run_neutral_01', 'loco'),
    ('sprint', 'xy', 'run_fast_01', 'loco'),
    ('photo', 'static', 'take_picture', 'photo'),
]
CLIP_F = {'walk': 'walk_neutral_01'}             # đoạn nữ khác tên nam (spec §5)
ANIM_DIR = {'xy': 'Assets/Animations/all_animations_max_motextr_xy/', 'static': 'Assets/Animations/all_animations_max_motextr_static/'}

FPS = 30                    # khung/giây lấy mẫu chuyển động (spec §7)
IDLE_LEN = (5.0, 7.0)       # s, khoảng tìm độ dài vòng lặp idle (đích ~6 s)
IDLE_START = 3.0            # s, điểm đầu idle được dời tối đa chừng này để vòng lặp khớp hơn
PHOTO_MAX = 0.8             # s, thời lượng tối đa phần giơ máy (tua nhanh nếu dài hơn)
TEX = {'body': 1024, 'head': 512, 'alpha': 512}   # px, cạnh texture màu sau khi thu nhỏ
JPEG_Q = 80                 # chất lượng JPEG texture màu
ROUGH = 0.8                 # độ nhám vật liệu (bỏ specular map)
# Mức nhường dung lượng (spec §7), 0 = không nhường: 1 bỏ chuyển động ngón tay (giữ tư thế trung bình của đoạn, tay
# hơi khum), 2 bỏ kênh vị trí / tỉ lệ trừ hông, 3 idle / photo 15 khung/giây (bỏ khung lẻ), 4 idle còn ~4 s
# Đang dùng 1: mức 0 cho tổng 6,39 MB > trần 6 MB (2026-11-12).
NHUONG = 1
CAP_FILE, CAP_ALL = int(1.5 * 1024 * 1024), 6 * 1024 * 1024

ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ONLY = [int(a) for a in ARGV if a.isdigit()] or list(range(len(CHARS)))
NO_PREVIEW = '--no-preview' in ARGV


# ===== Tải nguồn vào .cache (bỏ qua file đã có; 404 ghi dấu .missing để không thử lại) =====
def fetch(rel, dst):
    if os.path.exists(dst): return dst
    if os.path.exists(dst + '.missing'): return None
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    print('  tải', rel)
    try:
        with urllib.request.urlopen(RAW + rel.replace(' ', '%20'), timeout=120) as r: data = r.read()
    except urllib.error.HTTPError as e:
        if e.code == 404: open(dst + '.missing', 'w').close(); return None
        raise
    with open(dst + '.part', 'wb') as f: f.write(data)
    os.replace(dst + '.part', dst); return dst


def fetch_char(name, code):
    d = os.path.join(CACHE, 'src', name)
    fbx = fetch(f'Assets/Avatars/Adults/{name}/Export/{name}.fbx', os.path.join(d, name + '.fbx'))
    for t in ('body_color', 'head_color', 'opacity_color'):     # bỏ normal + specular (spec §7)
        fetch(f'Assets/Avatars/Adults/{name}/Textures/{code}_{t}.tga', os.path.join(d, f'{code}_{t}.tga'))
    return fbx


def fetch_clip(sex, clip):
    _, kind, base, _ = clip
    fn = f'{sex}_{CLIP_F.get(clip[0], base) if sex == "f" else base}.max.fbx'
    return fetch(ANIM_DIR[kind] + fn, os.path.join(CACHE, 'anim', fn)), fn.replace('.max.fbx', '')


# ===== Tiện ích Blender =====
def fcurves(act):
    """F-curve của action (Blender 4.4+ action có slot: lấy qua channelbag nếu .fcurves không còn)."""
    try: return list(act.fcurves)
    except AttributeError: return [fc for ly in act.layers for st in ly.strips for cb in st.channelbags for fc in cb.fcurves]


def fc_remove(act, fc):
    try: act.fcurves.remove(fc)
    except (AttributeError, RuntimeError):
        for ly in act.layers:
            for st in ly.strips:
                for cb in st.channelbags:
                    if fc in list(cb.fcurves): cb.fcurves.remove(fc); return


def bone_of(fc):
    p = fc.data_path
    return p.split('"')[1] if p.startswith('pose.bones["') else None


def setf(sc, fr):
    sc.frame_set(int(fr)); bpy.context.view_layer.update()


def wpos(ob, bone):
    return (ob.matrix_world @ ob.pose.bones[bone].matrix).translation.copy()


def descendants(arm, root):
    out = set(); st = [arm.data.bones[root]]
    while st:
        b = st.pop()
        for c in b.children: out.add(c.name); st.append(c)
    return out


# ===== Vật liệu: chỉ giữ texture màu (thu nhỏ), mảnh alpha dùng ROUND -> glTF alphaMode MASK =====
def fix_materials(log):
    for m in bpy.data.materials:
        if not m.use_nodes: continue
        nt = m.node_tree; bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if bsdf is None: continue
        col = next((l.from_node for l in nt.links if l.to_node == bsdf and l.to_socket.name == 'Base Color'), None)
        alpha_linked = any(l.to_node == bsdf and l.to_socket.name == 'Alpha' for l in nt.links)
        for n in [n for n in nt.nodes if n not in (bsdf, col) and n.type != 'OUTPUT_MATERIAL']: nt.nodes.remove(n)
        bsdf.inputs['Roughness'].default_value = ROUGH; bsdf.inputs['Metallic'].default_value = 0.0
        if col is None or col.type != 'TEX_IMAGE' or col.image is None or col.image.size[0] == 0:
            log.append(f'vật liệu {m.name}: không có texture màu'); continue
        img = col.image
        role = 'alpha' if alpha_linked else ('head' if 'head' in m.name.lower() else 'body')
        n = TEX[role]
        if img.size[0] > n: img.scale(n, n)
        if role == 'alpha':
            # tô màu trung bình vào vùng trong suốt: PNG nén tốt hơn, mép không bị viền tối khi lọc mipmap
            px = np.empty(img.size[0] * img.size[1] * 4, dtype=np.float32); img.pixels.foreach_get(px); px = px.reshape(-1, 4)
            on = px[:, 3] >= 0.5
            if on.any(): px[~on, :3] = px[on, :3].mean(axis=0)
            img.pixels.foreach_set(px.ravel()); img.update()
            rnd = nt.nodes.new('ShaderNodeMath'); rnd.operation = 'ROUND'
            nt.links.new(col.outputs['Alpha'], rnd.inputs[0]); nt.links.new(rnd.outputs[0], bsdf.inputs['Alpha'])
        log.append(f'vật liệu {m.name}: {role} {img.size[0]}px')


# ===== Phân tích đoạn nguồn (trước khi nướng) =====
def pose_sample(sc, src, fr, bones):
    setf(sc, fr)
    Mp = src.matrix_world @ src.pose.bones['Bip01 Pelvis'].matrix
    rel = {b: (Mp.inverted() @ (src.matrix_world @ src.pose.bones[b].matrix)).to_quaternion() for b in bones}
    return Mp.to_quaternion(), Mp.translation.z, rel


def pose_dist(a, b):
    """Độ lệch hai tư thế: góc lớn nhất (độ) giữa các xương (so với hông) + hướng hông + 100 x lệch cao hông (m)."""
    def qa(p, q):   # góc giữa hai quaternion, bỏ dấu (q và -q cùng một phép quay)
        return 2 * math.acos(min(1.0, abs(p.dot(q))))
    ang = max(qa(a[2][k], b[2][k]) for k in a[2])
    return math.degrees(max(ang, qa(a[0], b[0]))) + 100 * abs(a[1] - b[1])


def pick_loop(sc, src, f0, f1, lo, hi, bones, starts=0):
    """Chọn cặp (a, e): a trong [f0, f0 + starts], độ dài e - a trong [lo, hi] khung, tư thế e gần tư thế a nhất."""
    a_max = min(f0 + starts, f1 - lo)
    S = {fr: pose_sample(sc, src, fr, bones) for fr in range(f0, f1 + 1)}
    best = (1e9, f0, f1)
    for a in range(f0, max(f0, a_max) + 1):
        for e in range(a + max(lo, 2), min(a + hi, f1) + 1):
            d = pose_dist(S[a], S[e])
            if d < best[0]: best = (d, a, e)
    return best[1], best[2], best[0]


def pick_photo(sc, src, f0, f1):
    """Phần giơ máy: từ lúc hai tay bắt đầu lên tới khi tay gần cao nhất (máy trước mặt)."""
    hz = []
    for fr in range(f0, f1 + 1):
        setf(sc, fr); hz.append(0.5 * (wpos(src, 'Bip01 R Hand').z + wpos(src, 'Bip01 L Hand').z))
    hz = np.array(hz); zmax = hz.max(); p = int(np.argmax(hz >= hz.min() + 0.95 * (zmax - hz.min())))
    zlo = hz[:p + 1].min(); s = 0
    for i in range(p, -1, -1):
        if hz[i] <= zlo + 0.08 * (zmax - zlo): s = i; break
    return f0 + s, f0 + p, float(hz[s]), float(hz[p])


# ===== Gắn một đoạn vào bộ xương nhân vật =====
def add_clip(sc, arm, base, clip, path, keep, info):
    name, _, _, kind = clip
    before = set(bpy.data.actions)
    bpy.ops.import_scene.fbx(filepath=path); sc.render.fps = FPS; sc.render.fps_base = 1
    src = next(o for o in bpy.data.objects if o not in base and o.type == 'ARMATURE')
    sact = src.animation_data.action
    f0, f1 = (int(round(x)) for x in sact.frame_range)
    sc.frame_start, sc.frame_end = f0, f1
    cmp_bones = [b for b in keep if b != 'Bip01 Pelvis' and b in src.pose.bones and 'Finger' not in b]
    note = ''
    if kind == 'loco':
        a, b, err = pick_loop(sc, src, f0, f1, (f1 - f0) // 2, f1 - f0, cmp_bones); note = f'lệch vòng {err:.1f}°'
    elif kind == 'idle':
        lo, hi = IDLE_LEN if NHUONG < 4 else (3.5, 4.5)
        lo, hi = int(lo * FPS), int(hi * FPS)
        if f1 - f0 < lo: lo, hi = (f1 - f0) // 2, f1 - f0
        a, b, err = pick_loop(sc, src, f0, f1, lo, hi, cmp_bones, starts=int(IDLE_START * FPS)); note = f'khung {a}-{b}, lệch vòng {err:.1f}°'
    else:
        a, b, z0, z1 = pick_photo(sc, src, f0, f1); note = f'tay {z0:.2f}->{z1:.2f} m, gốc {(b - a) / FPS:.2f}s'
        k = min(1.0, PHOTO_MAX * FPS / max(1, b - a))
        if k < 1.0:   # tua nhanh: co trục thời gian của đoạn nguồn quanh khung a
            for fc in fcurves(sact):
                for kp in fc.keyframe_points:
                    for p in (kp.co, kp.handle_left, kp.handle_right): p.x = a + (p.x - a) * k
            b = a + int(round((b - a) * k)); note += f', tua x{1 / k:.2f}'
    setf(sc, a); p0 = wpos(src, 'Bip01 Pelvis'); setf(sc, b); p1 = wpos(src, 'Bip01 Pelvis')
    drift = (p1 - p0) if kind == 'loco' else Vector((0, 0, 0))
    dur = (b - a) / FPS; speed = drift.length / dur if kind == 'loco' else 0.0
    # ràng buộc Copy Transforms từng xương cùng tên (bỏ xương mặt / ngón nếu đang nhường), rồi nướng visual keying
    for pb in arm.pose.bones:
        if pb.name in keep and pb.name in src.pose.bones:
            c = pb.constraints.new('COPY_TRANSFORMS'); c.target = src; c.subtarget = pb.name
    bpy.ops.object.select_all(action='DESELECT'); arm.select_set(True); bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='POSE'); bpy.ops.pose.select_all(action='SELECT')
    bpy.ops.nla.bake(frame_start=a, frame_end=b, only_selected=False, visual_keying=True,
                     clear_constraints=True, use_current_action=False, bake_types={'POSE'})
    bpy.ops.object.mode_set(mode='OBJECT')
    for pb in arm.pose.bones:   # xương không có cặp nguồn vẫn giữ ràng buộc rỗng? dọn cho chắc
        for c in list(pb.constraints): pb.constraints.remove(c)
    act = arm.animation_data.action; act.name = name; act.use_fake_user = True
    # bỏ đường cong của xương không diễn (mặt, ngón khi nhường), và kênh vị trí / tỉ lệ khi nhường mức 2
    for fc in fcurves(act):
        bn = bone_of(fc)
        if bn is None: continue
        prop = fc.data_path.rsplit('.', 1)[-1]
        if bn not in keep or (NHUONG >= 2 and bn != 'Bip01 Pelvis' and prop in ('location', 'scale')): fc_remove(act, fc)
    # kênh gần như hằng (nhiễu nướng) -> đặt hằng để bộ xuất chỉ giữ 2 khóa; quaternion: lệch < 0,002 (~0,2°)
    TOL = {'location': 0.05, 'scale': 1e-3, 'rotation_quaternion': 2e-3}
    for fc in fcurves(act):
        prop = fc.data_path.rsplit('.', 1)[-1]
        if prop not in TOL or bone_of(fc) == 'Bip01 Pelvis': continue
        v = [kp.co.y for kp in fc.keyframe_points]
        if v and (max(v) - min(v) < TOL[prop] or (NHUONG >= 1 and 'Finger' in bone_of(fc))):
            m = sum(v) / len(v)
            for kp in fc.keyframe_points: kp.co.y = kp.handle_left.y = kp.handle_right.y = m
    if kind == 'idle':   # khép vòng idle: 0,3 s cuối kéo dần về đúng tư thế khung đầu (không giật khi lặp)
        nb = int(0.3 * FPS); grp = {}
        for fc in fcurves(act): grp.setdefault((fc.data_path, fc.data_path.endswith('rotation_quaternion')), {})[fc.array_index] = fc
        for (dp, isq), g in grp.items():
            va = {i: fc.evaluate(a) for i, fc in g.items()}; vb = {i: fc.evaluate(b) for i, fc in g.items()}
            if isq and sum(va[i] * vb[i] for i in va) < 0: va = {i: -x for i, x in va.items()}   # cùng bán cầu quaternion
            for i, fc in g.items():
                dv = va[i] - vb[i]
                for kp in fc.keyframe_points:
                    s = (kp.co.x - (b - nb)) / nb
                    if s > 0:
                        s = s * s * (3 - 2 * s); kp.co.y += dv * s; kp.handle_left.y += dv * s; kp.handle_right.y += dv * s
        note += ', khép vòng 0,3 s'
    if NHUONG >= 3 and kind != 'loco':   # 15 khung/giây cho idle / photo: bỏ khóa lẻ
        for fc in fcurves(act):
            for kp in reversed(list(fc.keyframe_points)):
                if (int(round(kp.co.x)) - a) % 2 == 1 and int(round(kp.co.x)) != b: fc.keyframe_points.remove(kp)
    # trừ quãng trôi thẳng của hông (chạy tại chỗ) và đưa hông về giữa theo phương ngang
    pb = arm.pose.bones['Bip01 Pelvis']; M = (arm.matrix_world.to_3x3() @ pb.bone.matrix_local.to_3x3()).inverted()
    acc = Vector((0, 0, 0)); n = 0
    for fr in range(a, b + 1):
        setf(sc, fr); t = (fr - a) / (b - a); q = wpos(arm, 'Bip01 Pelvis') - drift * t; acc += Vector((q.x, q.y, 0)); n += 1
    ctr = acc / n
    pel = [fc for fc in fcurves(act) if fc.data_path == 'pose.bones["Bip01 Pelvis"].location']
    for fc in pel:
        for kp in fc.keyframe_points:
            t = (kp.co.x - a) / (b - a); dl = M @ (drift * t + ctr); d = dl[fc.array_index]
            kp.co.y -= d; kp.handle_left.y -= d; kp.handle_right.y -= d
    # kiểm: hông còn lệch ngang bao nhiêu, chân thấp nhất / cao nhất
    hx, fz = 0.0, []
    for fr in range(a, b + 1):
        setf(sc, fr); hp = wpos(arm, 'Bip01 Pelvis'); hx = max(hx, math.hypot(hp.x, hp.y))
        fz.append(min(wpos(arm, f'Bip01 {s} Toe0').z for s in 'LR'))
    act['speed'] = round(speed, 3)
    info[name] = dict(src=os.path.basename(path).replace('.max.fbx', ''), frames=(a, b), dur=round(dur, 3), speed=round(speed, 3),
                      note=note, hip_xy=round(hx, 3), toe_min=round(min(fz), 3), toe_max=round(max(fz), 3))
    print(f'  CLIP {name:6s} {info[name]}')
    arm.animation_data.action = None
    tr = arm.animation_data.nla_tracks.new(); tr.name = name; tr.mute = True   # tắt tới lúc xuất để không lẫn vào đoạn kế
    st = tr.strips.new(name, a, act)
    if hasattr(st, 'action_slot') and len(act.slots): st.action_slot = act.slots[0]
    for o in [o for o in bpy.data.objects if o not in base]: bpy.data.objects.remove(o, do_unlink=True)
    for x in [x for x in bpy.data.actions if x not in before and x != act]: bpy.data.actions.remove(x)
    for pb in arm.pose.bones: pb.matrix_basis.identity()


# ===== Ghi extras vào GLB (sửa chunk JSON, giữ nguyên chunk BIN) =====
def glb_patch(path, fn):
    b = open(path, 'rb').read()
    jl = struct.unpack_from('<I', b, 12)[0]; j = json.loads(b[20:20 + jl]); rest = b[20 + jl:]
    fn(j)
    js = json.dumps(j, separators=(',', ':'), ensure_ascii=False).encode('utf8'); js += b' ' * ((4 - len(js) % 4) % 4)
    out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + len(rest)) + struct.pack('<II', len(js), 0x4E4F534A) + js + rest
    open(path, 'wb').write(out); return j


# ===== Một nhân vật: nhập, gắn 5 đoạn, quay mặt +X, xuất glb =====
def convert(k):
    name, code, sex = CHARS[k]
    print(f'== p{k}: {name} ({sex})')
    fbx = fetch_char(name, code)
    clips = [(c,) + fetch_clip(sex, c) for c in CLIPS]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene; sc.render.fps = FPS; sc.render.fps_base = 1
    bpy.ops.import_scene.fbx(filepath=fbx)
    arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE'); meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    arm.animation_data_clear(); arm.animation_data_create()
    for a in list(bpy.data.actions): bpy.data.actions.remove(a)
    log = []; fix_materials(log)
    for l in log: print('  ' + l)
    face = descendants(arm, 'Bip01 Head')
    keep = {b.name for b in arm.data.bones if b.name not in face}
    base = set(bpy.data.objects); info = {}
    for c, path, _ in clips: add_clip(sc, arm, base, c, path, keep, info)
    # mặt nhân vật Rocketbox nhìn -Y của Blender; quay +90° quanh Z -> nhìn +X (glTF +X sau export_yup)
    arm.rotation_euler.z += math.pi / 2; bpy.context.view_layer.update()
    arm.data.pose_position = 'REST'; bpy.context.view_layer.update()
    toe, foot = arm.matrix_world @ arm.data.bones['Bip01 L Toe0'].head_local, arm.matrix_world @ arm.data.bones['Bip01 L Foot'].head_local
    dg = bpy.context.evaluated_depsgraph_get(); zs = []; tris = 0
    for o in meshes:
        e = o.evaluated_get(dg); me = e.to_mesh(); me.calc_loop_triangles(); tris += len(me.loop_triangles)
        zs += [(o.matrix_world @ v.co).z for v in me.vertices]; e.to_mesh_clear()
    height = max(zs); arm.data.pose_position = 'POSE'
    print(f'  hướng mặt: mũi chân - cổ chân = ({toe.x - foot.x:.3f}, {toe.y - foot.y:.3f}) m (Blender), cao {height:.3f} m, chân thấp nhất {min(zs):.3f} m')
    assert toe.x - foot.x > 0.05 and abs(toe.y - foot.y) < 0.06, 'mặt không hướng +X'
    for t in arm.animation_data.nla_tracks: t.mute = False
    os.makedirs(OUT, exist_ok=True); out = os.path.join(OUT, f'p{k}.glb')
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_animations=True, export_animation_mode='NLA_TRACKS',
                              export_image_format='JPEG', export_image_quality=JPEG_Q, export_yup=True, export_extras=False,
                              export_frame_step=1, export_force_sampling=True, export_optimize_animation_size=True,
                              export_anim_slide_to_zero=True, export_tangents=False, export_cameras=False, export_lights=False,
                              export_morph=False, export_skins=True, export_all_influences=False, export_reset_pose_bones=True)

    def patch(j):
        for an in j['animations']: an['extras'] = {'speed': info[an['name']]['speed']}
        j['scenes'][0]['extras'] = {'height': round(height, 3), 'source': f'Microsoft Rocketbox {name} (MIT), commit {COMMIT[:7]}'}
    j = glb_patch(out, patch)
    size = os.path.getsize(out)
    mats = [(m.get('name'), m.get('alphaMode', 'OPAQUE')) for m in j.get('materials', [])]
    prims = sum(len(m['primitives']) for m in j['meshes'])
    return dict(k=k, name=name, bytes=size, tris=tris, bones=len(j['skins'][0]['joints']), prims=prims, mats=mats,
                height=round(height, 3), clips=info, anims=[a['name'] for a in j['animations']])


# ===== Ảnh kiểm tra: nạp lại glb vừa xuất, đo hướng mặt / chân, chụp 4 khung mỗi đoạn =====
def preview(k):
    import glob
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene; sc.render.fps = FPS
    bpy.ops.import_scene.gltf(filepath=os.path.join(OUT, f'p{k}.glb'))
    arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE'); bones = arm.pose.bones
    def bone(n):
        return next(b for b in bones if b.name in (n, n.replace(' ', '_')))
    bpy.context.view_layer.update()
    sizes = {i.name: tuple(i.size) for i in bpy.data.images}
    if arm.animation_data is None: arm.animation_data_create()
    for t in arm.animation_data.nla_tracks: t.mute = True
    os.makedirs(PREV, exist_ok=True); tmp = os.path.join(PREV, 'tmp'); os.makedirs(tmp, exist_ok=True)
    sc.render.engine = 'BLENDER_EEVEE_NEXT'; sc.render.resolution_x, sc.render.resolution_y = 300, 420
    sc.view_settings.view_transform = 'Standard'
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (0.6, 0.65, 0.72, 1)
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sun.data.energy = 3
    sun.rotation_euler = (math.radians(50), 0, math.radians(60)); sc.collection.objects.link(sun)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam; cam.data.lens = 75
    checks = {}; files = []
    for nm in ('idle', 'walk', 'jog', 'sprint', 'photo'):
        act = next(a for a in bpy.data.actions if a.name == nm or a.name.startswith(nm + '_') or a.name.startswith(nm + '.'))
        arm.animation_data.action = act
        if hasattr(act, 'slots') and len(act.slots): arm.animation_data.action_slot = act.slots[0]
        f0, f1 = (int(round(x)) for x in act.frame_range)
        toe = []; hip = 0.0; fwd = []
        for fr in range(f0, f1 + 1):
            setf(sc, fr)
            toe.append(min((arm.matrix_world @ bone(f'Bip01 {s} Toe0').matrix).translation.z for s in 'LR'))
            hp = (arm.matrix_world @ bone('Bip01 Pelvis').matrix).translation; hip = max(hip, math.hypot(hp.x, hp.y))
            fwd.append(sum((arm.matrix_world @ bone(f'Bip01 {s} Toe0').matrix).translation.x - (arm.matrix_world @ bone(f'Bip01 {s} Foot').matrix).translation.x for s in 'LR') / 2)
        checks[nm] = dict(frames=(f0, f1), toe_min=round(min(toe), 3), hip_xy=round(hip, 3), toe_fwd_x=round(float(np.mean(fwd)), 3))
        fr_list = (0.0, 1 / 3, 2 / 3, 1.0) if nm == 'photo' else (0.0, 0.25, 0.5, 0.75)
        for i, u in enumerate(fr_list):
            setf(sc, f0 + (f1 - f0) * u)
            c = Vector((0, 0, 0.95)); cam.location = c + Vector((3.4, -2.6, 0.35))
            cam.rotation_euler = (c - cam.location).to_track_quat('-Z', 'Y').to_euler()
            fp = os.path.join(tmp, f'p{k}_{nm}_{i}.png'); sc.render.filepath = fp; bpy.ops.render.render(write_still=True); files.append(fp)
    # ghép 5 hàng x 4 khung thành một ảnh
    w_, h_ = 300, 420; sheet = np.zeros((5 * h_, 4 * w_, 4), dtype=np.float32)
    for idx, fp in enumerate(files):
        im = bpy.data.images.load(fp); px = np.empty(w_ * h_ * 4, dtype=np.float32); im.pixels.foreach_get(px)
        r, c = divmod(idx, 4); y0 = (4 - r) * h_
        sheet[y0:y0 + h_, c * w_:(c + 1) * w_] = px.reshape(h_, w_, 4); bpy.data.images.remove(im)
    out = bpy.data.images.new(f'sheet{k}', 4 * w_, 5 * h_, alpha=False); out.pixels.foreach_set(sheet.ravel())
    out.filepath_raw = os.path.join(PREV, f'p{k}.jpg'); out.file_format = 'JPEG'; out.save(quality=85)
    for fp in files: os.remove(fp)
    return checks, sizes


def write_license():
    src = fetch('LICENSE.md', os.path.join(CACHE, 'LICENSE.md'))
    txt = open(src, encoding='utf8').read()
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, 'LICENSE-Rocketbox.txt'), 'w', encoding='utf8', newline='\n') as f:
        f.write('Nguồn / Source: Microsoft Rocketbox, https://github.com/microsoft/Microsoft-Rocketbox\n')
        f.write(f'Commit: {COMMIT} — p0..p4.glb chuyển đổi bằng scripts/people/convert.py (đã thu nhỏ texture, cắt chuyển động)\n\n')
        f.write(txt)


# ===== Chạy =====
write_license()
res = [convert(k) for k in ONLY]
prev = {} if NO_PREVIEW else {k: preview(k) for k in ONLY}
print('\n===== KẾT QUẢ =====')
print(f'mức nhường dung lượng: {NHUONG}')
total = 0
for r in res:
    total += r['bytes']
    print(f"p{r['k']} {r['name']:16s} {r['bytes']:>9d} B  {r['tris']} tam giác  {r['bones']} xương  {r['prims']} primitive  cao {r['height']} m  {r['mats']}")
    for nm, c in r['clips'].items():
        print(f"    {nm:6s} {c['src']:22s} {c['dur']:6.3f}s  speed {c['speed']:5.2f} m/s  {c['note']}  hông lệch {c['hip_xy']} m  mũi chân z {c['toe_min']}..{c['toe_max']}")
    if r['k'] in prev:
        ch, sz = prev[r['k']]
        print(f"    nạp lại glb: ảnh {sz}")
        for nm, c in ch.items(): print(f"    nạp lại {nm:6s} {c}")
        print(f"    ảnh xem trước: {os.path.join(PREV, 'p%d.jpg' % r['k'])}")
all_sizes = sum(os.path.getsize(os.path.join(OUT, f'p{k}.glb')) for k in range(len(CHARS)) if os.path.exists(os.path.join(OUT, f'p{k}.glb')))
print(f'tổng 5 file: {all_sizes} B (trần {CAP_ALL}); vượt trần từng file: {[r["k"] for r in res if r["bytes"] > CAP_FILE]}')
